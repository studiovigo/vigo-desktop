// Script de teste para verificar conexão com Supabase
// Execute este arquivo no console do navegador ou importe no App.jsx temporariamente

import { supabase } from './supabaseClient';

/**
 * Testa a conexão com o Supabase e verifica se consegue ler/escrever dados
 */
export async function testSupabaseConnection() {
  console.log('🧪 Iniciando teste de conexão com Supabase...\n');

  // 1. Verificar se a chave está configurada
  const hasKey = typeof import.meta !== 'undefined' 
    ? import.meta.env.VITE_SUPABASE_ANON_KEY 
    : process.env.SUPABASE_KEY;

  if (!hasKey) {
    console.error('❌ ERRO: Nenhuma chave API encontrada!');
    console.log('📝 Configure VITE_SUPABASE_ANON_KEY no arquivo .env.local');
    return { success: false, error: 'Chave API não configurada' };
  }

  console.log('✅ Chave API encontrada');
  console.log(`🔑 Chave (primeiros 20 chars): ${hasKey.substring(0, 20)}...\n`);

  // 2. Testar conexão básica (verificar se consegue acessar o Supabase)
  try {
    const { data, error } = await supabase.from('users').select('count').limit(1);
    
    if (error) {
      // Se der erro de RLS ou tabela não existe, ainda significa que está conectado
      if (error.code === 'PGRST116' || error.message.includes('relation') || error.message.includes('RLS')) {
        console.log('✅ Conexão com Supabase estabelecida!');
        console.log('⚠️  Aviso: Tabela "users" não existe ou RLS está bloqueando acesso');
        console.log('📝 Execute o arquivo supabase-schema.sql no Supabase SQL Editor\n');
        return { success: true, warning: 'Tabela não encontrada ou RLS ativo' };
      }
      
      console.error('❌ Erro ao conectar:', error.message);
      return { success: false, error: error.message };
    }

    console.log('✅ Conexão com Supabase estabelecida!');
    console.log('✅ Tabela "users" acessível\n');

    // 3. Testar inserção (se RLS permitir)
    const testData = {
      name: 'Teste Conexão',
      email: `teste_${Date.now()}@teste.com`,
      role: 'caixa',
      store_id: null, // Ajuste conforme necessário
    };

    console.log('🧪 Testando inserção de dados...');
    const { data: insertData, error: insertError } = await supabase
      .from('users')
      .insert(testData)
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '42501' || insertError.message.includes('RLS')) {
        console.log('⚠️  Inserção bloqueada por RLS (isso é normal se RLS estiver ativo)');
        console.log('✅ Mas a conexão está funcionando!\n');
        return { success: true, warning: 'RLS bloqueando inserção (normal)' };
      }
      console.error('❌ Erro ao inserir:', insertError.message);
      return { success: false, error: insertError.message };
    }

    console.log('✅ Dados inseridos com sucesso!');
    console.log('📊 Dados inseridos:', insertData);

    // 4. Limpar dados de teste
    if (insertData?.id) {
      await supabase.from('users').delete().eq('id', insertData.id);
      console.log('🧹 Dados de teste removidos\n');
    }

    console.log('🎉 TESTE CONCLUÍDO COM SUCESSO!');
    console.log('✅ Conexão: OK');
    console.log('✅ Leitura: OK');
    console.log('✅ Escrita: OK\n');

    return { success: true, data: insertData };

  } catch (error) {
    console.error('❌ Erro inesperado:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Teste rápido - apenas verifica se consegue conectar
 */
export async function quickTest() {
  try {
    const { data, error } = await supabase.from('users').select('count').limit(0);
    
    if (error && (error.code === 'PGRST116' || error.message.includes('relation'))) {
      return { connected: true, message: 'Conectado, mas tabela não existe' };
    }
    
    if (error) {
      return { connected: false, error: error.message };
    }
    
    return { connected: true, message: 'Conectado com sucesso!' };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

