-- =====================================================
-- CORREÇÃO: Adicionar colunas faltantes em pending_signups
-- =====================================================
-- Execute este SQL no Supabase SQL Editor para corrigir a tabela

-- Adicionar coluna admin_name (se não existir)
ALTER TABLE pending_signups 
ADD COLUMN IF NOT EXISTS admin_name TEXT;

-- Adicionar coluna store_name (se não existir)
ALTER TABLE pending_signups 
ADD COLUMN IF NOT EXISTS store_name TEXT;

-- Adicionar coluna cpf_cnpj (se não existir)
ALTER TABLE pending_signups 
ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT;

-- Adicionar coluna password_hash (se não existir)
ALTER TABLE pending_signups 
ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Migrar dados existentes da coluna 'name' para 'admin_name' (se houver dados)
UPDATE pending_signups 
SET admin_name = name 
WHERE admin_name IS NULL AND name IS NOT NULL;

-- Migrar dados existentes da coluna 'cpf' para 'cpf_cnpj' (se houver dados)
UPDATE pending_signups 
SET cpf_cnpj = cpf 
WHERE cpf_cnpj IS NULL AND cpf IS NOT NULL;

-- Migrar dados existentes da coluna 'password' para 'password_hash' (se houver dados)
UPDATE pending_signups 
SET password_hash = password 
WHERE password_hash IS NULL AND password IS NOT NULL;

-- Opcional: Remover colunas antigas (descomente se quiser limpar)
-- ALTER TABLE pending_signups DROP COLUMN IF EXISTS name;
-- ALTER TABLE pending_signups DROP COLUMN IF EXISTS cpf;
-- ALTER TABLE pending_signups DROP COLUMN IF EXISTS password;

-- Criar índices nas novas colunas
CREATE INDEX IF NOT EXISTS idx_pending_signups_admin_name ON pending_signups(admin_name);
CREATE INDEX IF NOT EXISTS idx_pending_signups_store_name ON pending_signups(store_name);
CREATE INDEX IF NOT EXISTS idx_pending_signups_cpf_cnpj ON pending_signups(cpf_cnpj);

-- Verificar resultado
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'pending_signups'
ORDER BY ordinal_position;
