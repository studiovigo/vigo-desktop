-- Limpar pedidos online/fake do sistema

-- 1. Limpar tabela de pedidos online (se existir no Supabase)
-- Nota: Verifique se essa tabela existe no seu schema antes de executar
DELETE FROM online_orders;

-- 2. Limpar vendas marcadas como 'online' na tabela sales
DELETE FROM sales WHERE online = true;

-- 3. Verificar se há registros restantes
SELECT 
  (SELECT COUNT(*) FROM sales WHERE online = true) as vendas_online,
  (SELECT COUNT(*) FROM sales) as total_vendas;
