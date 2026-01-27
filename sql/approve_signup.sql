-- =====================================================
-- APROVAR CADASTRO DE USUARIO
-- =====================================================
-- Aprova o cadastro pendente e cria usuario na tabela users
-- =====================================================

-- PASSO 1: Ver dados do cadastro pendente
SELECT 
  id,
  admin_name,
  store_name,
  cpf_cnpj,
  email,
  phone,
  status,
  created_at
FROM pending_signups
WHERE id = '81347c3c-7e7d-4bf1-8586-f9884d971d5c';

-- PASSO 2: Atualizar status do cadastro para 'approved'
UPDATE pending_signups
SET 
  status = 'approved',
  reviewed_at = now(),
  reviewed_by = auth.uid()  -- Usar o ID do admin logado
WHERE id = '81347c3c-7e7d-4bf1-8586-f9884d971d5c';

-- PASSO 3: Verificar aprovação
SELECT 
  id,
  admin_name,
  store_name,
  status,
  reviewed_at
FROM pending_signups
WHERE id = '81347c3c-7e7d-4bf1-8586-f9884d971d5c';

-- PASSO 4: (OPCIONAL) Criar store e usuário na tabela users
-- Descomente se quiser criar automaticamente

-- Criar store primeiro
INSERT INTO stores (name, created_at, updated_at)
SELECT store_name, now(), now()
FROM pending_signups
WHERE id = '81347c3c-7e7d-4bf1-8586-f9884d971d5c'
RETURNING id as store_id;

-- Criar usuário (você vai usar o store_id retornado acima)
INSERT INTO users (
  store_id,
  name,
  email,
  password_hash,
  role,
  cpf,
  phone,
  active,
  created_at,
  updated_at
)
SELECT 
  (SELECT id FROM stores ORDER BY created_at DESC LIMIT 1),  -- Store criado agora
  admin_name,
  email,
  password_hash,
  'goodadmin',
  cpf_cnpj,
  phone,
  true,
  now(),
  now()
FROM pending_signups
WHERE id = '81347c3c-7e7d-4bf1-8586-f9884d971d5c'
RETURNING id as user_id, email;

