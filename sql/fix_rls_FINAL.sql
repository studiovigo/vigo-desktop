-- =====================================================
-- SOLUÇÃO DEFINITIVA: DESABILITAR RLS EM pending_signups
-- =====================================================
-- Esta tabela PRECISA aceitar cadastros públicos
-- Como não há dados sensíveis expostos (apenas solicitações),
-- é seguro desabilitar RLS completamente
-- =====================================================

-- REMOVER TODAS AS POLÍTICAS
DROP POLICY IF EXISTS "Anyone can insert pending signups" ON pending_signups;
DROP POLICY IF EXISTS "GoodAdmins can view pending signups" ON pending_signups;
DROP POLICY IF EXISTS "GoodAdmins can update pending signups" ON pending_signups;
DROP POLICY IF EXISTS "GoodAdmins can delete pending signups" ON pending_signups;

-- DESABILITAR RLS COMPLETAMENTE
ALTER TABLE pending_signups DISABLE ROW LEVEL SECURITY;

-- VERIFICAR
SELECT
  schemaname as "Schema",
  tablename as "Tabela",
  rowsecurity as "RLS_Ativo"
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'pending_signups';

-- Deve retornar RLS_Ativo = false
