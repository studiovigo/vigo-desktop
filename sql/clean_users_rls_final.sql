-- Limpar TODAS as políticas RLS antigas da tabela users
-- e criar apenas as políticas necessárias

-- 1. REMOVER TODAS as políticas antigas
DROP POLICY IF EXISTS "Admins can manage all users" ON users;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON users;
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "users_delete" ON users;
DROP POLICY IF EXISTS "users_insert" ON users;
DROP POLICY IF EXISTS "users_insert_goodadmin" ON users;
DROP POLICY IF EXISTS "users_select_by_store" ON users;
DROP POLICY IF EXISTS "users_select_goodadmin" ON users;
DROP POLICY IF EXISTS "users_select_own" ON users;
DROP POLICY IF EXISTS "users_update" ON users;
DROP POLICY IF EXISTS "users_update_goodadmin" ON users;
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;

-- 2. Remover função antiga se existir
DROP FUNCTION IF EXISTS check_is_goodadmin();

-- 3. Criar apenas 3 políticas simples e necessárias

-- Política 1: Usuários podem ler seu próprio perfil
CREATE POLICY "users_read_own"
ON users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Política 2: Usuários podem atualizar seu próprio perfil
CREATE POLICY "users_update_own"  
ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Política 3: Permitir INSERT público (para cadastro inicial via approve_signup)
CREATE POLICY "users_insert_public"
ON users
FOR INSERT
TO public
WITH CHECK (true);

-- 4. Garantir que RLS está habilitado
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 5. Verificar as políticas finais
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;
