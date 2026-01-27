-- =====================================================
-- CORRIGIR POLÍTICAS RLS DA TABELA pending_signups
-- =====================================================
-- Execute este script no Supabase SQL Editor
-- =====================================================

-- PASSO 1: Remover todas as políticas antigas (se existirem)
DROP POLICY IF EXISTS "Anyone can insert pending signups" ON pending_signups;
DROP POLICY IF EXISTS "GoodAdmins can view pending signups" ON pending_signups;
DROP POLICY IF EXISTS "GoodAdmins can update pending signups" ON pending_signups;
DROP POLICY IF EXISTS "GoodAdmins can delete pending signups" ON pending_signups;

-- PASSO 2: Desabilitar RLS temporariamente
ALTER TABLE pending_signups DISABLE ROW LEVEL SECURITY;

-- PASSO 3: Reabilitar RLS
ALTER TABLE pending_signups ENABLE ROW LEVEL SECURITY;

-- PASSO 4: Criar política para INSERT público (qualquer pessoa pode solicitar cadastro)
-- IMPORTANTE: Usar 'anon' ao invés de 'public' porque o Supabase ANON KEY usa role 'anon'
CREATE POLICY "Anyone can insert pending signups"
ON pending_signups
FOR INSERT
TO anon
WITH CHECK (true);

-- PASSO 5: Criar política para SELECT (apenas GoodAdmins podem ver)
CREATE POLICY "GoodAdmins can view pending signups"
ON pending_signups
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'goodadmin'
  )
);

-- PASSO 6: Criar política para UPDATE (apenas GoodAdmins podem aprovar/rejeitar)
CREATE POLICY "GoodAdmins can update pending signups"
ON pending_signups
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'goodadmin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'goodadmin'
  )
);

-- PASSO 7: Criar política para DELETE (apenas GoodAdmins podem deletar)
CREATE POLICY "GoodAdmins can delete pending signups"
ON pending_signups
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'goodadmin'
  )
);

-- =====================================================
-- VERIFICAR SE AS POLÍTICAS FORAM CRIADAS
-- =====================================================
SELECT
  schemaname as "Schema",
  tablename as "Tabela",
  policyname as "Nome_Política",
  permissive as "Permissivo",
  roles as "Roles",
  cmd as "Comando"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'pending_signups'
ORDER BY policyname;

-- =====================================================
-- VERIFICAR SE RLS ESTÁ ATIVO
-- =====================================================
SELECT
  schemaname as "Schema",
  tablename as "Tabela",
  rowsecurity as "RLS_Ativo"
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'pending_signups';
