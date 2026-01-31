# Principais mudanças no banco de dados

Data de geração: 31/01/2026
**Última atualização do código:** 31/01/2026

## Status de Implementação no vigo-desktop

| # | Mudança | Status | Observação |
|---|---------|--------|------------|
| 1 | `expenses.frequency` | ✅ IMPLEMENTADO | Campo adicionado no create/update/formulário |
| 2 | `sales.items` com product_specs | ✅ IMPLEMENTADO | Items agora incluem product_name, product_specs |
| 3 | `users.updated_at` trigger | ✅ OK (BD-side) | Trigger no banco de dados |
| 4 | `warehouse_stock` tax/ncm/variations | ⚠️ N/A | Desktop não usa warehouse_stock |
| 5 | SKU automático warehouse | ⚠️ N/A | Desktop não usa warehouse_stock |
| 6 | Trigger SKU products | ✅ OK (BD-side) | Trigger no banco de dados |
| 7 | RLS products | ✅ OK (BD-side) | Políticas no banco de dados |
| 8 | `pending_signups.password_hashed` | ✅ IMPLEMENTADO | Código ajustado para usar password_hashed |
| 9 | RPC `transfer_warehouse_to_store` | ⚠️ N/A | Desktop não usa warehouse_stock |

## Visão geral
Este documento resume as mudanças mais relevantes de banco de dados presentes nos scripts SQL do projeto, com foco em schema, políticas RLS, triggers e rotinas de transferência.

## Mudanças principais (por script)

### 1) Despesas: frequência de recorrência
- **O que mudou:** adiciona a coluna `frequency` na tabela `expenses`, com valor padrão `rotativa`.
- **Objetivo:** distinguir despesas fixas vs. rotativas.
- **Script:** [sql/add_frequency_to_expenses.sql](sql/add_frequency_to_expenses.sql)

### 2) Vendas: enriquecimento de itens
- **O que mudou:** atualiza a coluna `items` (JSONB) em `sales` para incluir `product_name` e `product_specs` (SKU, modelo, cor, tamanho, custo, imposto, NCM etc.).
- **Objetivo:** manter detalhes do produto dentro do item de venda.
- **Script:** [sql/add_product_details_to_sales.sql](sql/add_product_details_to_sales.sql)
- **Guia de execução:** [INSTRUCOES_ADD_PRODUCT_DETAILS.md](INSTRUCOES_ADD_PRODUCT_DETAILS.md)

### 3) Usuários: coluna `updated_at` e trigger
- **O que mudou:** adiciona `updated_at` à tabela `users` e cria trigger para atualizar automaticamente.
- **Objetivo:** corrigir erro ao atualizar usuários (soft delete) quando o trigger tenta usar `updated_at`.
- **Script:** [sql/add_updated_at_to_users.sql](sql/add_updated_at_to_users.sql)

### 4) Armazém: impostos, NCM e variações
- **O que mudou:** adiciona `tax`, `ncm` e `variations` em `warehouse_stock`.
- **Objetivo:** suportar variações e impostos diretamente no estoque do armazém.
- **Script:** [sql/update_warehouse_stock.sql](sql/update_warehouse_stock.sql)

### 5) Armazém: correção de SKU nulo
- **O que mudou:** gera SKU automático para registros em `warehouse_stock` com `sku` nulo ou vazio.
- **Objetivo:** evitar produtos sem SKU, padronizando identificadores.
- **Script:** [sql/fix_null_sku.sql](sql/fix_null_sku.sql)

### 6) Produtos: trigger de geração de SKU
- **O que mudou:** remove triggers antigos com erro (`NEW.nome`) e cria trigger correto usando `NEW.name`.
- **Objetivo:** corrigir erro de trigger e padronizar geração automática de SKU.
- **Script:** [sql/fix_products_trigger.sql](sql/fix_products_trigger.sql)

### 7) Produtos: políticas RLS
- **O que mudou:** cria políticas permissivas para `products` (INSERT/SELECT/UPDATE/DELETE).
- **Objetivo:** resolver bloqueios de RLS durante gravações e leituras.
- **Scripts:**
  - [sql/fix_rls_products.sql](sql/fix_rls_products.sql)
  - [sql/fix_rls_products_v2.sql](sql/fix_rls_products_v2.sql)

### 8) Cadastros pendentes: hash de senha
- **O que mudou:** adiciona `password_hashed` e `password_salt` em `pending_signups`, e cria índice para busca rápida.
- **Objetivo:** armazenar senhas com hash bcrypt.
- **Script:** [sql/hash_pending_signups_password.sql](sql/hash_pending_signups_password.sql)

### 9) RPC: transferência de estoque do armazém para loja
- **O que mudou:** cria função `transfer_warehouse_to_store` para transferência atômica de variações, criando/atualizando produtos e ajustando estoque.
- **Objetivo:** manter consistência entre `warehouse_stock` e `products`.
- **Script:** [sql/transfer_warehouse_to_store.sql](sql/transfer_warehouse_to_store.sql)

## Observações
- O arquivo [sql/update_sales_cost_price.sql](sql/update_sales_cost_price.sql) está vazio no momento.
- Antes de aplicar scripts, valide em ambiente de teste e confirme permissões/RLS no Supabase.
