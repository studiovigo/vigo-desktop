-- =====================================================
-- LIMPAR DADOS DE TODAS AS TABELAS
-- =====================================================
-- Remove todos os registros mas MANTÉM tabelas e colunas
-- Usa DELETE respeitando foreign keys
-- =====================================================

-- PASSO 1: Deletar dados nas tabelas dependentes primeiro (ordem de FK)
DELETE FROM sales;
DELETE FROM sale_items;
DELETE FROM cash_closures;
DELETE FROM cash_sessions;
DELETE FROM expenses;
DELETE FROM coupons;
DELETE FROM warehouse_stock;
DELETE FROM closures;
DELETE FROM pos_stations;
DELETE FROM terminals;
DELETE FROM users;
DELETE FROM products;
DELETE FROM pending_signups;
DELETE FROM stores;

-- PASSO 2: Verificar se limpou (contar registros)
SELECT 
  'stores' as tabela, COUNT(*) as registros FROM stores
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'products', COUNT(*) FROM products
UNION ALL
SELECT 'cash_sessions', COUNT(*) FROM cash_sessions
UNION ALL
SELECT 'sales', COUNT(*) FROM sales
UNION ALL
SELECT 'sale_items', COUNT(*) FROM sale_items
UNION ALL
SELECT 'coupons', COUNT(*) FROM coupons
UNION ALL
SELECT 'expenses', COUNT(*) FROM expenses
UNION ALL
SELECT 'cash_closures', COUNT(*) FROM cash_closures
UNION ALL
SELECT 'pending_signups', COUNT(*) FROM pending_signups
UNION ALL
SELECT 'pos_stations', COUNT(*) FROM pos_stations
UNION ALL
SELECT 'terminals', COUNT(*) FROM terminals
UNION ALL
SELECT 'warehouse_stock', COUNT(*) FROM warehouse_stock
UNION ALL
SELECT 'closures', COUNT(*) FROM closures
ORDER BY tabela;

-- Se todos os COUNT retornarem 0, os dados foram removidos com sucesso!
