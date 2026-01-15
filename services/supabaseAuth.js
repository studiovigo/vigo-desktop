// Camada de autenticação usando Supabase
// Login, logout e gerenciamento básico de usuários (admin/gerente/caixa)

import { supabase } from './supabaseClient';

/**
 * Faz login com email e senha via Supabase Auth.
 * Retorna { user, error }.
 */
export async function loginWithEmail(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('[Supabase Auth] Erro no login:', error);
      return { user: null, error };
    }
    
    if (!data?.user) {
      console.error('[Supabase Auth] Login retornou sem usuário');
      return { 
        user: null, 
        error: { message: 'Erro ao fazer login. Tente novamente.' } 
      };
    }

    // Buscar role e dados adicionais na tabela public.users
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[Supabase Auth] Erro ao buscar perfil:', profileError);
      
      // Se for erro de recursão infinita, informar que precisa executar o SQL de correção
      if (profileError.code === '42P17' || profileError.message?.includes('infinite recursion')) {
        console.error('[Supabase Auth] ERRO CRÍTICO: Recursão infinita detectada nas políticas RLS!');
        console.error('[Supabase Auth] Execute o arquivo sql/fix_goodadmin_users_rls.sql no Supabase SQL Editor');
        return { 
          user: null, 
          error: { 
            message: 'Erro de configuração: Recursão infinita nas políticas RLS. Execute o SQL de correção no Supabase.' 
          } 
        };
      }
      
      // Retornar usuário do Auth mesmo sem perfil (pode ser um usuário novo)
      // Mas apenas se não for erro crítico
      return { user: data.user, error: profileError };
    }

    // Verificar se o usuário está ativo
    // Se active for false, bloquear acesso
    // Se active for null/undefined, considerar como ativo (padrão)
    if (profile && profile.active === false) {
      // Fazer logout para limpar a sessão
      await supabase.auth.signOut();
      return { 
        user: null, 
        error: { 
          message: 'Sua conta está temporariamente desativada. Entre em contato com o suporte.' 
        } 
      };
    }

    const mergedUser = {
      ...data.user,
      ...profile,
    };

    // ✅ GARANTIR que store_id e tenantId estejam presentes e sejam UUID válidos
    // IMPORTANTE: store_id DEVE ser UUID para funcionar com a tabela sales
    if (!mergedUser.store_id || !isValidUUID(mergedUser.store_id)) {
      // Se não tiver store_id válido, usar tenantId (que deve ser UUID) ou gerar novo UUID
      if (mergedUser.tenantId && isValidUUID(mergedUser.tenantId)) {
        mergedUser.store_id = mergedUser.tenantId;
      } else if (profile?.store_id && isValidUUID(profile.store_id)) {
        mergedUser.store_id = profile.store_id;
      } else {
        // Gerar novo UUID se não houver nenhum válido
        // NOTA: Isso deve ser corrigido no banco de dados - cada usuário deve ter um store_id UUID válido
        console.warn('[Supabase Auth] ⚠️ Usuário sem store_id UUID válido. Gerando UUID temporário. Corrija no banco de dados!');
        mergedUser.store_id = crypto.randomUUID();
        mergedUser.tenantId = mergedUser.store_id;
      }
    }
    
    if (!mergedUser.tenantId || !isValidUUID(mergedUser.tenantId)) {
      mergedUser.tenantId = mergedUser.store_id;
    }
    
    // Função auxiliar para validar UUID
    function isValidUUID(str) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str);
    }
    
    // Salvar no localStorage com store_id garantido
    localStorage.setItem('mozyc_pdv_current_user', JSON.stringify(mergedUser));

    console.log('[Supabase Auth] Login bem-sucedido:', mergedUser.email, 'store_id:', mergedUser.store_id);
    return { user: mergedUser, error: null };
  } catch (err) {
    console.error('[Supabase Auth] Erro inesperado:', err);
    return { 
      user: null, 
      error: { message: err.message || 'Erro inesperado ao fazer login' } 
    };
  }
}

/**
 * Logout global.
 */
export async function logout() {
  await supabase.auth.signOut();
}

/**
 * Criação de usuário via Supabase Auth (usa ANON KEY).
 * Admin logado chama essa função para criar caixa/gerente.
 * A role é salva na tabela public.users.
 */
export async function createUserWithRole({ email, password, name, role, store_id }) {
  // 1) Se store_id não foi fornecido, gerar do email
  const finalStoreId = store_id || email.toLowerCase().replace(/[^a-z0-9]/g, '_');

  // 2) Criar usuário no Auth com metadata
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        store_id: finalStoreId,
        tenantId: finalStoreId,
      }
    }
  });

  if (error) return { user: null, error };

  const userId = data.user.id;

  // 3) Inserir/atualizar registro em public.users
  const { data: upserted, error: upsertError } = await supabase
    .from('users')
    .upsert(
      {
        id: userId,
        store_id: finalStoreId, // Sempre presente
        name,
        email,
        role,
      },
      { onConflict: 'id' }
    )
    .select()
    .maybeSingle();

  if (upsertError) {
    return { user: data.user, error: upsertError };
  }

  // 4) Atualizar metadata do usuário no Auth (se necessário)
  if (finalStoreId) {
    await supabase.auth.updateUser({
      data: {
        store_id: finalStoreId,
        tenantId: finalStoreId,
      }
    });
  }

  return { user: { ...data.user, ...upserted, store_id: finalStoreId, tenantId: finalStoreId }, error: null };
}

/**
 * Retorna sessão atual (se existir).
 */
export async function getCurrentSession() {
  const { data } = await supabase.auth.getSession();
  return data.session || null;
}


