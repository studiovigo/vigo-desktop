-- Corrigir incompatibilidade de ID entre auth.users e public.users
-- Atualizar o ID na tabela public.users para corresponder ao auth.users

-- Atualizar o ID do usuário adm@lbbrand.com para corresponder ao auth.uid()
UPDATE public.users
SET id = '8fea0bac-c920-44d2-b3a1-5f741ba83557'
WHERE email = 'adm@lbbrand.com';

-- Verificar se a correção funcionou
SELECT 
  au.id as auth_id,
  au.email as auth_email,
  pu.id as users_id,
  pu.email as users_email,
  pu.role,
  pu.store_id,
  CASE 
    WHEN au.id = pu.id THEN '✅ IDs correspondem - CORRIGIDO!'
    ELSE '❌ IDs NÃO correspondem'
  END as status
FROM auth.users au
JOIN public.users pu ON au.email = pu.email
WHERE au.email = 'adm@lbbrand.com';
