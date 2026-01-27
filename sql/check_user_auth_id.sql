-- Verificar se o ID do usuário na tabela users corresponde ao auth.uid()

-- 1. Ver todos os usuários cadastrados via Auth
SELECT id, email, created_at, confirmed_at
FROM auth.users
ORDER BY created_at DESC;

-- 2. Ver todos os usuários na tabela public.users
SELECT id, email, name, role, store_id, active
FROM public.users
ORDER BY created_at DESC;

-- 3. Verificar se há correspondência entre auth.users e public.users
SELECT 
  au.id as auth_id,
  au.email as auth_email,
  pu.id as users_id,
  pu.email as users_email,
  pu.role,
  pu.store_id,
  CASE 
    WHEN au.id = pu.id THEN '✅ IDs correspondem'
    ELSE '❌ IDs NÃO correspondem - PROBLEMA!'
  END as status
FROM auth.users au
FULL OUTER JOIN public.users pu ON au.email = pu.email
ORDER BY au.created_at DESC;
