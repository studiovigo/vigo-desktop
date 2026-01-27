// Cliente Supabase centralizado para Web + Desktop
// Usa apenas a ANON KEY no frontend.

import { createClient } from '@supabase/supabase-js';

// ⚠️ IMPORTANTE: Usar variáveis de ambiente do .env
let supabaseUrl = '';
let supabaseKey = '';

// 1. Tentar Vite (import.meta.env.VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY)
if (typeof import.meta !== 'undefined' && import.meta.env) {
  supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
}

// 2. Se não encontrou, tentar process.env (Node/Electron main)
if (!supabaseUrl && typeof process !== 'undefined' && process.env) {
  supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
}
if (!supabaseKey && typeof process !== 'undefined' && process.env) {
  supabaseKey = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
}

// 3. Se ainda não encontrou, tentar window (caso esteja disponível)
if (!supabaseUrl && typeof window !== 'undefined' && window.process?.env) {
  supabaseUrl = window.process.env.SUPABASE_URL || window.process.env.VITE_SUPABASE_URL || '';
}
if (!supabaseKey && typeof window !== 'undefined' && window.process?.env) {
  supabaseKey = window.process.env.SUPABASE_KEY || window.process.env.VITE_SUPABASE_ANON_KEY || '';
}

if (!supabaseUrl || supabaseUrl.trim() === '') {
  console.warn(
    '[Supabase] ⚠️ Nenhuma URL definida. A aplicação continuará, mas chamadas ao Supabase irão falhar até configurar.',
    '\n📝 Configure VITE_SUPABASE_URL no arquivo .env',
    '\n📁 Caminho: raiz-do-projeto/.env',
    '\n📋 Conteúdo: VITE_SUPABASE_URL="https://seu-projeto.supabase.co"'
  );
  supabaseUrl = 'https://placeholder.supabase.co';
}

if (!supabaseKey || supabaseKey.trim() === '') {
  // Não bloquear a renderização da UI; usar placeholder para que a aplicação suba e exiba a tela de login.
  console.warn(
    '[Supabase] ⚠️ Nenhuma ANON KEY definida. A aplicação continuará, mas chamadas ao Supabase irão falhar até configurar.',
    '\n📝 Configure VITE_SUPABASE_ANON_KEY no arquivo .env',
    '\n📁 Caminho: raiz-do-projeto/.env',
    '\n📋 Conteúdo: VITE_SUPABASE_ANON_KEY="sua_chave_aqui"'
  );
  supabaseKey = 'anon-key-not-set';
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});


