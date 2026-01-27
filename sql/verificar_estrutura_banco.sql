-- =====================================================
-- SCRIPT PARA VERIFICAR ESTRUTURA DO BANCO DE DADOS
-- =====================================================
-- Execute este script no Supabase SQL Editor para ver
-- todas as tabelas e seus campos
-- =====================================================

-- =====================================================
-- OPÇÃO 1: LISTAR TODAS AS TABELAS
-- =====================================================
SELECT 
  table_name as "Tabela",
  table_type as "Tipo"
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- =====================================================
-- OPÇÃO 2: LISTAR TODAS AS COLUNAS DE TODAS AS TABELAS
-- =====================================================
SELECT 
  t.table_name as "Tabela",
  c.column_name as "Coluna",
  c.data_type as "Tipo",
  c.character_maximum_length as "Tamanho_Max",
  c.is_nullable as "Permite_Nulo",
  c.column_default as "Valor_Padrão",
  CASE 
    WHEN pk.column_name IS NOT NULL THEN '✓ PK'
    WHEN fk.column_name IS NOT NULL THEN '→ FK'
    ELSE ''
  END as "Chave"
FROM information_schema.tables t
LEFT JOIN information_schema.columns c 
  ON t.table_name = c.table_name 
  AND t.table_schema = c.table_schema
LEFT JOIN (
  SELECT ku.table_name, ku.column_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage ku 
    ON tc.constraint_name = ku.constraint_name
  WHERE tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_schema = 'public'
) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
LEFT JOIN (
  SELECT ku.table_name, ku.column_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage ku 
    ON tc.constraint_name = ku.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
) fk ON c.table_name = fk.table_name AND c.column_name = fk.column_name
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;

-- =====================================================
-- OPÇÃO 3: DETALHES DE UMA TABELA ESPECÍFICA
-- =====================================================
-- Substitua 'pending_signups' pelo nome da tabela que deseja verificar

SELECT 
  column_name as "Coluna",
  data_type as "Tipo",
  character_maximum_length as "Tamanho",
  numeric_precision as "Precisão",
  numeric_scale as "Escala",
  is_nullable as "Nulo?",
  column_default as "Padrão",
  udt_name as "Tipo_Base"
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'pending_signups'
ORDER BY ordinal_position;

-- =====================================================
-- OPÇÃO 4: VERIFICAR ÍNDICES
-- =====================================================
SELECT
  schemaname as "Schema",
  tablename as "Tabela",
  indexname as "Nome_Índice",
  indexdef as "Definição"
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- =====================================================
-- OPÇÃO 5: VERIFICAR FOREIGN KEYS (RELACIONAMENTOS)
-- =====================================================
SELECT
  tc.table_name as "Tabela",
  kcu.column_name as "Coluna",
  ccu.table_name as "Referencia_Tabela",
  ccu.column_name as "Referencia_Coluna",
  tc.constraint_name as "Nome_Constraint"
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- =====================================================
-- OPÇÃO 6: VERIFICAR POLÍTICAS RLS
-- =====================================================
SELECT
  schemaname as "Schema",
  tablename as "Tabela",
  policyname as "Nome_Política",
  permissive as "Permissivo",
  roles as "Roles",
  cmd as "Comando",
  qual as "Condição_USING",
  with_check as "Condição_CHECK"
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- =====================================================
-- OPÇÃO 7: VERIFICAR SE RLS ESTÁ ATIVO
-- =====================================================
SELECT
  schemaname as "Schema",
  tablename as "Tabela",
  rowsecurity as "RLS_Ativo"
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- =====================================================
-- OPÇÃO 8: CONTAR REGISTROS EM CADA TABELA
-- =====================================================
-- ATENÇÃO: Este script pode demorar em tabelas grandes!
-- Descomente as linhas abaixo para executar

/*
SELECT 
  schemaname as "Schema",
  tablename as "Tabela",
  (xpath('/row/cnt/text()', 
    query_to_xml(format('SELECT COUNT(*) AS cnt FROM %I.%I', schemaname, tablename), false, true, ''))
  )[1]::text::int AS "Total_Registros"
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
*/

-- OU use este script mais simples (mas menos eficiente):
/*
SELECT 'stores' as tabela, COUNT(*) as registros FROM stores
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
*/

-- =====================================================
-- OPÇÃO 9: ESTRUTURA COMPLETA EM FORMATO JSON
-- =====================================================
SELECT jsonb_pretty(
  jsonb_object_agg(
    table_name,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'coluna', column_name,
          'tipo', data_type,
          'nulo', is_nullable,
          'padrao', column_default
        ) ORDER BY ordinal_position
      )
      FROM information_schema.columns c2
      WHERE c2.table_schema = 'public'
        AND c2.table_name = t.table_name
    )
  )
) as "Estrutura_Completa_JSON"
FROM (
  SELECT DISTINCT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
) t;

-- =====================================================
-- INSTRUÇÕES DE USO:
-- =====================================================
-- 1. Copie este arquivo completo
-- 2. Abra o Supabase Dashboard → SQL Editor
-- 3. Cole o conteúdo
-- 4. Execute TUDO ou selecione apenas a OPÇÃO que deseja
-- 5. As opções estão numeradas (OPÇÃO 1, OPÇÃO 2, etc.)
-- 
-- DICA: Para executar apenas uma opção:
-- - Selecione o texto da opção desejada
-- - Clique em "Run Selected" ou pressione Ctrl+Enter
-- =====================================================
