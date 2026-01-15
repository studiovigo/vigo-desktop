// Cliente Supabase centralizado para Web + Desktop
// Usa apenas a ANON KEY no frontend.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mdlnwgnbcdubsicslscf.supabase.co';

// Para Vite (frontend / Electron renderer), use VITE_SUPABASE_ANON_KEY
// Para Node/Electron main, pode usar SUPABASE_KEY em process.env
// ⚠️ NUNCA coloque chaves hardcoded aqui! Use apenas variáveis de ambiente.

// Tentar ler a chave de diferentes formas (Vite, Node, Electron)
let supabaseKey = '';

// 1. Tentar Vite (import.meta.env.VITE_SUPABASE_ANON_KEY)
if (typeof import.meta !== 'undefined' && import.meta.env) {
  supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
}

// 2. Se não encontrou, tentar process.env (Node/Electron main)
if (!supabaseKey && typeof process !== 'undefined' && process.env) {
  supabaseKey = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
}

// 3. Se ainda não encontrou, tentar window (caso esteja disponível)
if (!supabaseKey && typeof window !== 'undefined' && window.process?.env) {
  supabaseKey = window.process.env.SUPABASE_KEY || window.process.env.VITE_SUPABASE_ANON_KEY || '';
}

if (!supabaseKey || supabaseKey.trim() === '') {
  // Não bloquear a renderização da UI; usar placeholder para que a aplicação suba e exiba a tela de login.
  console.warn(
    '[Supabase] ⚠️ Nenhuma ANON KEY definida. A aplicação continuará, mas chamadas ao Supabase irão falhar até configurar.',
    '\n📝 Configure VITE_SUPABASE_ANON_KEY no arquivo .env.local',
    '\n📁 Caminho: raiz-do-projeto/.env.local',
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


