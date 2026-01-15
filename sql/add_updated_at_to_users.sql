-- =====================================================
-- Adicionar coluna updated_at à tabela users
-- =====================================================
-- Este script corrige o erro:
-- "record 'new' has no field 'updated_at'"
-- que ocorre ao tentar deletar (soft delete) um usuário.
--
-- O erro acontece porque existe um trigger no banco
-- que tenta atualizar o campo updated_at, mas a tabela
-- users não possui essa coluna.
-- =====================================================

-- 1. Adicionar a coluna updated_at (se não existir)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Atualizar registros existentes para ter a data de criação como updated_at
UPDATE users 
SET updated_at = COALESCE(created_at, NOW())
WHERE updated_at IS NULL;

-- 3. (Opcional) Criar um trigger para atualizar automaticamente o updated_at
-- Se o trigger já existir, você pode ignorar esta parte

-- Primeiro, cria a função (se não existir)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Depois, cria o trigger (se não existir)
-- OBS: Se já existir um trigger similar, este comando vai dar erro
-- Nesse caso, basta executar apenas o ALTER TABLE acima
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_users_updated_at'
    ) THEN
        CREATE TRIGGER update_users_updated_at
            BEFORE UPDATE ON users
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END;
$$;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
-- Execute este SELECT para verificar se a coluna foi adicionada:
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'users' AND column_name = 'updated_at';
