# 🔄 ATUALIZAÇÃO DE CHAMADAS DE CÓDIGO

## ⚠️ BREAKING CHANGES - Funções que mudaram de assinatura

As funções em `supabaseSync.js` agora **requerem parâmetros** ao invés de ler localStorage.

---

## 📍 Função: pushProducts()

### ANTES (Quebrado)
```javascript
// Em qualquer componente
import { pushProducts } from './services/supabaseSync';

export async function syncToSupabase() {
  const result = await pushProducts(); // ❌ Lia localStorage internamente
  console.log(result);
}
```

**Problema:**
- Lê localStorage diretamente (`mozyc_pdv_current_user`)
- Se localStorage foi limpo, falha silenciosamente
- Não usa Supabase auth real

### DEPOIS (Correto)
```javascript
// Em qualquer componente
import { pushProducts } from './services/supabaseSync';
import { supabase } from './services/supabaseClient';
import * as db from './services/db'; // Importar db module

export async function syncToSupabase() {
  // Obter usuário autenticado do Supabase
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (!user) {
    console.error('User not authenticated');
    return { success: false, error: 'Not authenticated' };
  }
  
  // Chamar com parâmetros: currentUser e dbModule
  const result = await pushProducts(user, db);
  console.log(result);
}
```

**Benefícios:**
- ✅ Usa Supabase auth real
- ✅ Usa db module (tenantId do Supabase)
- ✅ Falha explicitamente se não autenticado

---

## 📍 Função: pullProducts()

### ANTES (Quebrado)
```javascript
const result = await pullProducts(); // ❌ Lia localStorage
```

### DEPOIS (Correto)
```javascript
const { data: { user } } = await supabase.auth.getUser();
const result = await pullProducts(user, db);
```

---

## 📍 Função: pushSales()

### ANTES (Quebrado)
```javascript
const result = await pushSales(); // ❌ Lia localStorage
```

### DEPOIS (Correto)
```javascript
const { data: { user } } = await supabase.auth.getUser();
const result = await pushSales(user, db);
```

---

## 🔍 Onde Encontrar Chamadas Antigas

### Buscar no código
```bash
# Terminal / Git Bash
grep -r "pushProducts()" --include=\"*.jsx\" --include=\"*.js\"
grep -r "pullProducts()" --include=\"*.jsx\" --include=\"*.js\"
grep -r \"pushSales()\" --include=\"*.jsx\" --include=\"*.js\"
```

### Arquivos que provavelmente usam (procurar):
- `components/GoodAdmin.jsx`
- `components/SimpleUI.jsx`
- `App.jsx` (se tem botões de sync)
- Qualquer componente que chamar `supabaseSync`

---

## 📋 PADRÃO A SEGUIR

### Template para atualizar qualquer chamada

```javascript
import { pushProducts, pullProducts, pushSales } from './services/supabaseSync';
import { supabase } from './services/supabaseClient';
import * as db from './services/db';

async function syncData() {
  // PASSO 1: Validar autenticação
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    console.error('Erro de autenticação:', authError);
    return { success: false, error: 'Not authenticated' };
  }
  
  // PASSO 2: Validar store_id
  if (!user.id) {
    console.error('User not fully initialized');
    return { success: false, error: 'Missing user.id' };
  }
  
  try {
    // PASSO 3: Chamar funções COM parâmetros
    console.log('[Sync] Iniciando sincronização...');
    
    // Push: enviar dados locais para Supabase
    const pushResult = await pushProducts(user, db);
    console.log('[Sync] Push produtos:', pushResult);
    
    // Pull: buscar dados do Supabase
    const pullResult = await pullProducts(user, db);
    console.log('[Sync] Pull produtos:', pullResult);
    
    // Push sales
    const salesResult = await pushSales(user, db);
    console.log('[Sync] Push vendas:', salesResult);
    
    return { 
      success: true, 
      synced: {
        products: pushResult.synced + pullResult.synced,
        sales: salesResult.synced
      }
    };
    
  } catch (error) {
    console.error('[Sync] Erro durante sincronização:', error);
    return { success: false, error: error.message };
  }
}
```

---

## 🎯 CHECKLIST DE ATUALIZAÇÃO

Para cada arquivo que usa `supabaseSync`:

- [ ] Importar `supabase` de `./services/supabaseClient`
- [ ] Importar `db` de `./services/db`
- [ ] Validar usuário com `supabase.auth.getUser()`
- [ ] Passar `user` como primeiro parâmetro
- [ ] Passar `db` como segundo parâmetro
- [ ] Adicionar tratamento de erro se `!user`
- [ ] Testar se sincronização funciona

---

## ⚠️ POTENCIAIS ERROS E SOLUÇÕES

### Erro: "supabaseSync.pushProducts is not a function"
**Causa:** Versão antiga de supabaseSync em cache
**Solução:** Recarregar módulo ou limpar cache do bundler

### Erro: "currentUser is undefined"
**Causa:** User não passou corretamente
**Solução:** Validar `supabase.auth.getUser()` retorna user

### Erro: "dbModule.getDB is not a function"
**Causa:** Importou `db` incorretamente
**Solução:** Usar `import * as db` não `import db`

### Erro: "Cannot read property 'store_id' of null"
**Causa:** User.store_id é null
**Solução:** Validar que store_id foi atribuído no login (App.jsx)

---

## 🧪 TESTE RÁPIDO

Depois de atualizar, testar com este código:

```javascript
// test-sync.js
async function testSync() {
  const { data: { user } } = await supabase.auth.getUser();
  console.log('User:', user?.id, 'Store:', user?.store_id);
  
  if (!user) {
    console.error('❌ Not authenticated');
    return;
  }
  
  try {
    const result = await pushProducts(user, db);
    console.log('✅ pushProducts sucedeu:', result);
  } catch (e) {
    console.error('❌ pushProducts falhou:', e.message);
  }
}

testSync();
```

---

## 📁 RESUMO DAS MUDANÇAS

| Função | Antes | Depois |
|--------|-------|--------|
| `pushProducts()` | `pushProducts()` | `pushProducts(user, db)` |
| `pullProducts()` | `pullProducts()` | `pullProducts(user, db)` |
| `pushSales()` | `pushSales()` | `pushSales(user, db)` |
| `resolveStoreId()` | Retorna `'default_store'` | Retorna `null` se inválido |

---

## 🔗 REFERÊNCIAS

- [supabaseSync.js](services/supabaseSync.js#L117-L250) - Novas assinaturas
- [db.js](services/db.js) - Módulo de banco local
- [supabaseClient.js](services/supabaseClient.js) - Cliente Supabase
- [IMPLEMENTACAO_CORRECOES_2026_01_30.md](IMPLEMENTACAO_CORRECOES_2026_01_30.md) - Contexto completo

---

**Status:** ⏳ Aguardando atualização das chamadas no código
