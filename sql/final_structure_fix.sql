-- =====================================================
-- CORRIGIR ESTRUTURA FINAL DA TABELA pending_signups
-- =====================================================

-- 1. Tornar selected_plan NULLABLE ou adicionar valor padrão
ALTER TABLE pending_signups 
  ALTER COLUMN selected_plan DROP NOT NULL;

-- 2. Tornar campos obrigatórios NOT NULL
ALTER TABLE pending_signups 
  ALTER COLUMN admin_name SET NOT NULL,
  ALTER COLUMN store_name SET NOT NULL,
  ALTER COLUMN cpf_cnpj SET NOT NULL,
  ALTER COLUMN password_hash SET NOT NULL;

-- 3. Verificar estrutura final
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'pending_signups'
ORDER BY ordinal_position;
