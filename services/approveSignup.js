// Serviço para aprovar solicitações de cadastro
// Cria o usuário no Supabase Auth usando Admin API

import { supabase } from './supabaseClient';

/**
 * Aprova uma solicitação de cadastro criando o usuário no Supabase Auth
 * NOTA: Esta função requer SERVICE_ROLE_KEY. Em produção, use Edge Function.
 * 
 * @param {string} signupId - ID da solicitação
 * @param {Object} signupData - Dados da solicitação (email, password_hash, etc)
 * @param {string} reviewerId - ID do usuário que está aprovando
 * @returns {Promise<Object>} { success: boolean, message: string, userId?: string }
 */
export async function approveSignup(signupId, signupData, reviewerId) {
  try {
    // IMPORTANTE: Esta função deve ser executada via Edge Function ou usar SERVICE_ROLE_KEY
    // Por enquanto, vamos usar uma abordagem que chama a RPC e depois cria o usuário
    
    // 1. Chamar RPC para marcar como aprovado
    const { data: rpcData, error: rpcError } = await supabase.rpc('approve_signup', {
      signup_id: signupId,
      reviewer_id: reviewerId
    });

    if (rpcError) {
      console.error('[approveSignup] Erro na RPC:', rpcError);
      return {
        success: false,
        message: rpcError.message || 'Erro ao aprovar solicitação'
      };
    }

    if (rpcData?.status === 'error') {
      return {
        success: false,
        message: rpcData.message || 'Erro ao processar aprovação'
      };
    }

    // 2. Criar usuário no Supabase Auth
    // NOTA: Como a Edge Function não está disponível, vamos usar signUp() como alternativa
    // O usuário será criado e precisará confirmar o email (ou pode ser confirmado manualmente no Supabase)
    
    let newUserId = null;
    let edgeError = null;
    let createdViaSignUp = false;
    
    // Tentar chamar Edge Function primeiro (se existir)
    try {
      const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('approve-signup', {
        body: {
          signup_id: signupId,
          email: signupData.email,
          password: signupData.password_hash,
          admin_name: signupData.admin_name,
          store_name: signupData.store_name,
          cpf_cnpj: signupData.cpf_cnpj,
          phone: signupData.phone,
          reviewer_id: reviewerId
        }
      });

      if (!edgeErr && edgeData?.success) {
        newUserId = edgeData.user_id;
        console.log('[approveSignup] Usuário criado via Edge Function:', newUserId);
      } else {
        edgeError = edgeErr;
        console.warn('[approveSignup] Edge Function não disponível, usando signUp como fallback');
      }
    } catch (err) {
      edgeError = err;
      console.warn('[approveSignup] Edge Function não disponível, usando signUp como fallback');
    }

    // Se Edge Function falhou ou não existe, usar signUp() como fallback
    if (!newUserId) {
      try {
        // NOTA: password_hash na verdade contém a senha em texto plano (ver App.jsx linha 144)
        // Usar signUp para criar o usuário
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: signupData.email,
          password: signupData.password_hash, // Senha em texto plano
          options: {
            data: {
              admin_name: signupData.admin_name,
              store_name: signupData.store_name,
              cpf_cnpj: signupData.cpf_cnpj,
              phone: signupData.phone
            },
            emailRedirectTo: undefined // Não redirecionar
          }
        });

        if (signUpError) {
          console.error('[approveSignup] Erro ao criar usuário via signUp:', signUpError);
          
          // Verificar se o usuário já existe
          if (signUpError.message?.includes('already registered') || 
              signUpError.message?.includes('already exists') ||
              signUpError.message?.includes('User already registered')) {
            // Se o usuário já existe, precisamos buscar o ID na tabela users
            // ou informar que precisa ser criado manualmente
            const { data: existingUser } = await supabase
              .from('users')
              .select('id')
              .eq('email', signupData.email)
              .maybeSingle();
            
            if (existingUser?.id) {
              newUserId = existingUser.id;
              console.log('[approveSignup] Usuário já existe na tabela users, usando ID:', newUserId);
            } else {
              return {
                success: false,
                message: 'Este email já está cadastrado no Supabase Auth, mas não foi encontrado na tabela users. Por favor, crie o registro manualmente na tabela users ou entre em contato com o suporte.'
              };
            }
          } else {
            return {
              success: false,
              message: signUpError.message || 'Erro ao criar usuário no Supabase Auth. Verifique se o email é válido e a senha atende aos requisitos.'
            };
          }
        } else if (signUpData?.user) {
          newUserId = signUpData.user.id;
          createdViaSignUp = true;
          console.log('[approveSignup] Usuário criado via signUp:', newUserId);
          
          // Tentar confirmar o email automaticamente via RPC
          try {
            const { data: confirmData, error: confirmError } = await supabase.rpc('confirm_user_email', {
              user_email: signupData.email
            });
            
            if (confirmError) {
              console.warn('[approveSignup] Não foi possível confirmar email automaticamente:', confirmError.message);
              console.warn('[approveSignup] O usuário precisará confirmar o email manualmente no Supabase Dashboard');
            } else if (confirmData) {
              console.log('[approveSignup] ✅ Email confirmado automaticamente');
            }
          } catch (confirmErr) {
            console.warn('[approveSignup] Erro ao tentar confirmar email:', confirmErr);
            // Continuar mesmo se a confirmação falhar
          }
        } else {
          return {
            success: false,
            message: 'Erro ao criar usuário. Tente novamente.'
          };
        }
      } catch (err) {
        console.error('[approveSignup] Erro inesperado ao criar usuário:', err);
        return {
          success: false,
          message: err.message || 'Erro inesperado ao criar usuário'
        };
      }
    }
    
    // Gerar store_id como UUID (não string baseada em email)
    // Se rpcData.store_id for um UUID válido, usar ele, senão gerar um novo UUID
    let storeId;
    if (rpcData?.store_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rpcData.store_id)) {
      storeId = rpcData.store_id;
      console.log('[approveSignup] Usando store_id da RPC:', storeId);
    } else {
      // Gerar um UUID aleatório
      // Usar crypto.randomUUID() se disponível, senão gerar manualmente
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        storeId = crypto.randomUUID();
      } else {
        // Fallback: gerar UUID v4 manualmente
        storeId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      }
      console.log('[approveSignup] Gerado novo store_id (UUID):', storeId);
    }

    // 3. Criar registro na tabela users
    // Preparar dados do usuário (incluir apenas campos que existem)
    const userDataToInsert = {
      id: newUserId,
      store_id: storeId,
      tenant_id: storeId,
      name: signupData.admin_name,
      email: signupData.email,
      role: 'admin', // Novo cadastro sempre é admin
      active: true
    };

    // Adicionar cpf apenas se fornecido (coluna pode não existir)
    if (signupData.cpf_cnpj) {
      userDataToInsert.cpf = signupData.cpf_cnpj;
    }

    // Adicionar phone apenas se fornecido (coluna pode não existir)
    if (signupData.phone) {
      userDataToInsert.phone = signupData.phone;
    }

    // Log detalhado antes da inserção
    console.log('[approveSignup] === INICIANDO INSERÇÃO EM USERS ===');
    console.log('[approveSignup] Dados a serem inseridos:', JSON.stringify(userDataToInsert, null, 2));
    console.log('[approveSignup] User ID:', newUserId);
    console.log('[approveSignup] Email:', signupData.email);

    // Inserir em users
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert(userDataToInsert)
      .select()
      .single();

    // Log do resultado da inserção
    if (userError) {
      console.error('[approveSignup] ❌ ERRO ao inserir em users:', userError);
      console.error('[approveSignup] Código do erro:', userError.code);
      console.error('[approveSignup] Mensagem do erro:', userError.message);
      console.error('[approveSignup] Detalhes do erro:', userError.details);
      console.error('[approveSignup] Hint do erro:', userError.hint);
      
      // NOTA: Não podemos deletar o usuário do Auth no frontend (precisa de admin API)
      // O usuário foi criado no Auth mas falhou ao criar na tabela users
      // Será necessário criar manualmente na tabela users ou deletar o usuário do Auth manualmente
      return {
        success: false,
        message: `Erro ao criar perfil do usuário na tabela users: ${userError.message || 'Erro desconhecido'}. Código: ${userError.code || 'N/A'}. O usuário foi criado no Supabase Auth, mas precisa ser criado manualmente na tabela users ou o usuário precisa ser deletado do Auth.`
      };
    }

    console.log('[approveSignup] ✅ Inserção em users bem-sucedida');
    console.log('[approveSignup] Dados retornados:', JSON.stringify(userData, null, 2));

    // 4. VERIFICAR se o usuário realmente existe em users antes de deletar
    console.log('[approveSignup] === VERIFICANDO SE USUÁRIO EXISTE EM USERS ===');
    console.log('[approveSignup] Verificando por ID:', newUserId);
    console.log('[approveSignup] Verificando por Email:', signupData.email);

    let verifiedUser = null;
    let verifyError = null;

    // Tentar verificar por ID primeiro
    const { data: userById, error: idError } = await supabase
      .from('users')
      .select('id, email, name, role, active')
      .eq('id', newUserId)
      .maybeSingle();

    if (idError) {
      console.error('[approveSignup] ❌ ERRO ao verificar usuário por ID:', idError);
      console.error('[approveSignup] Código do erro:', idError.code);
      console.error('[approveSignup] Mensagem do erro:', idError.message);
      verifyError = idError;
    } else if (userById) {
      console.log('[approveSignup] ✅ Usuário encontrado por ID:', JSON.stringify(userById, null, 2));
      verifiedUser = userById;
    } else {
      console.warn('[approveSignup] ⚠️ Usuário não encontrado por ID, tentando por email...');
      
      // Tentar buscar por email como fallback
      const { data: userByEmail, error: emailError } = await supabase
        .from('users')
        .select('id, email, name, role, active')
        .eq('email', signupData.email)
        .maybeSingle();

      if (emailError) {
        console.error('[approveSignup] ❌ ERRO ao verificar usuário por email:', emailError);
        verifyError = emailError;
      } else if (userByEmail) {
        console.log('[approveSignup] ✅ Usuário encontrado por email:', JSON.stringify(userByEmail, null, 2));
        verifiedUser = userByEmail;
      } else {
        console.error('[approveSignup] ❌ Usuário não encontrado nem por ID nem por email');
      }
    }

    // Se não encontrou o usuário, retornar erro
    if (!verifiedUser) {
      const errorMsg = verifyError 
        ? `Erro ao verificar se o usuário foi criado em users: ${verifyError.message || 'Erro desconhecido'}. Código: ${verifyError.code || 'N/A'}.`
        : `Erro: O usuário não foi encontrado em users após a inserção. A inserção pode ter falhado silenciosamente. Verifique manualmente no Supabase.`;
      
      return {
        success: false,
        message: errorMsg
      };
    }

    console.log('[approveSignup] ✅ VERIFICAÇÃO CONCLUÍDA - Usuário confirmado em users');

    // 5. Remover registro da tabela pending_signups (tabela transitoria)
    // SÓ deletar se o usuário foi verificado com sucesso em users
    console.log('[approveSignup] === REMOVENDO DE PENDING_SIGNUPS ===');
    console.log('[approveSignup] Signup ID a ser removido:', signupId);

    const { error: deleteError } = await supabase
      .from('pending_signups')
      .delete()
      .eq('id', signupId);

    if (deleteError) {
      console.error('[approveSignup] ❌ ERRO ao remover registro de pending_signups:', deleteError);
      console.error('[approveSignup] Código do erro:', deleteError.code);
      console.error('[approveSignup] Mensagem do erro:', deleteError.message);
      
      // Retornar sucesso parcial - usuário foi criado, mas não foi possível remover de pending_signups
      return {
        success: true,
        message: `Usuário criado com sucesso em users, mas não foi possível remover de pending_signups: ${deleteError.message}. O registro pode precisar ser removido manualmente.`,
        userId: newUserId,
        userData: verifiedUser,
        needsEmailConfirmation: createdViaSignUp,
        warning: 'pending_signups_not_deleted'
      };
    } else {
      console.log('[approveSignup] ✅ Registro removido de pending_signups com sucesso');
    }

    console.log('[approveSignup] === APROVAÇÃO CONCLUÍDA COM SUCESSO ===');
    console.log('[approveSignup] Usuário ID:', newUserId);
    console.log('[approveSignup] Usuário Email:', signupData.email);
    console.log('[approveSignup] Registro removido de pending_signups:', signupId);
    console.log('[approveSignup] Dados finais do usuário:', JSON.stringify(verifiedUser, null, 2));

    // Mensagem final baseada se precisa de confirmação de email
    let finalMessage = 'Cadastro aprovado e usuário criado com sucesso!';
    if (createdViaSignUp) {
      finalMessage = 'Cadastro aprovado! Usuário criado com sucesso. ' +
        'NOTA: Se o login não funcionar (erro "Email not confirmed"), ' +
        'desabilite a confirmação de email em Supabase Dashboard → Authentication → Settings, ' +
        'ou confirme manualmente em Authentication → Users.';
    }

    return {
      success: true,
      message: finalMessage,
      userId: newUserId,
      userData: verifiedUser || userData, // Usar verifiedUser se disponível, senão userData
      needsEmailConfirmation: createdViaSignUp
    };

  } catch (err) {
    console.error('[approveSignup] Erro inesperado:', err);
    return {
      success: false,
      message: err.message || 'Erro inesperado ao aprovar cadastro'
    };
  }
}

