# Sincronização vigo-web-admin → vigo-desktop

## ✅ Correções Aplicadas (12/01/2026)

### 1. **Conversão de campos camelCase para snake_case no `products.update()`**
   - **Arquivo:** `services/supabaseDB.js`
   - **Problema:** Campos `costPrice` e `salePrice` eram enviados em camelCase, mas o Supabase espera `cost_price` e `sale_price`
   - **Solução:** Adicionada conversão automática na função `update()`:
     ```javascript
     if (updates.costPrice !== undefined) {
       updatesWithStoreId.cost_price = updates.costPrice;
       delete updatesWithStoreId.costPrice;
     }
     if (updates.salePrice !== undefined) {
       updatesWithStoreId.sale_price = updates.salePrice;
       delete updatesWithStoreId.salePrice;
     }
     ```

### 2. **SQL para adicionar `updated_at` à tabela users**
   - **Arquivo:** `sql/add_updated_at_to_users.sql`
   - **Problema:** Trigger no Supabase tenta atualizar `updated_at` em users, mas a coluna não existe
   - **Solução:** Script SQL criado para adicionar a coluna e trigger

## 📝 Diferenças Mantidas

### vigo-desktop NÃO possui:
- ❌ Componente `WarehouseStock.jsx` (gestão de estoque geral do armazém)
- ❌ Funções `users.create()` e `users.delete()` 
- ❌ SQL `transfer_warehouse_to_store.sql`
- ❌ Outras tabelas SQL específicas do web-admin

### Ambos usam corretamente:
- ✅ `stock` como campo principal (não `quantity`)
- ✅ `stock_quantity` para compatibilidade

## 🔄 Próximas Sincronizações

Sempre que corrigir bugs no **vigo-web-admin**, verificar se aplica ao **vigo-desktop**:
- Funções compartilhadas em `services/supabaseDB.js`
- Conversões de campos camelCase ↔ snake_case
- Estrutura de tabelas no Supabase
