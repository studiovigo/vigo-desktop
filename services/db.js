


// Todas as funções de dados agora usam apenas Supabase (store_id)
import { supabaseDB } from './supabaseDB.js';

// Helper para carregar supabaseDB (para compatibilidade com código existente)
async function loadSupabaseDB() {
  return supabaseDB;
}

// Helper para obter store_id do usuário logado (localStorage)
function getLoggedUserStoreId() {
  try {
    const localUser = localStorage.getItem('mozyc_pdv_current_user');
    if (localUser) {
      const parsed = JSON.parse(localUser);
      if (parsed.store_id && parsed.store_id !== 'default_store') {
        return parsed.store_id;
      }
    }
  } catch (e) {
    // ignore parse error
  }
  return null;
}

// Dados iniciais (sem usuário padrão)
const INITIAL_DB = {
  products: [],
  sales: [],
  users: [],
  coupons: [
    { id: 'welcome', code: 'BEMVINDO10', discount: 10, active: true }
  ],
  logs: [],
  settings: {
    cnpj: "",
    shopifyApiKey: "",
    shopifyWebhookUrl: ""
  },
  expenses: [], // Sistema de despesas
  closures: [], // Fechamentos de caixa
  cashOpenings: [], // Aberturas de caixa
  onlineOrders: [], // Pedidos recebidos da Shopify
  subscriptions: [], // Assinaturas/Planos dos tenants
  pendingRegistrations: [] // Cadastros pendentes de pagamento
};

// Planos disponíveis
const PLANS = {
  BASIC: {
    id: 'basic',
    name: 'Básico',
    price: 49.90,
    maxUsers: 3,
    features: ['Até 3 usuários simultâneos', 'Produtos ilimitados', 'Relatórios básicos', 'Suporte por email']
  },
  PROFESSIONAL: {
    id: 'professional',
    name: 'Profissional',
    price: 99.90,
    maxUsers: 10,
    features: ['Até 10 usuários simultâneos', 'Produtos ilimitados', 'Relatórios avançados', 'Integração Shopify', 'Suporte prioritário']
  },
  ENTERPRISE: {
    id: 'enterprise',
    name: 'Empresarial',
    price: 199.90,
    maxUsers: 50,
    features: ['Até 50 usuários simultâneos', 'Produtos ilimitados', 'Relatórios completos', 'Integração Shopify', 'API personalizada', 'Suporte 24/7']
  }
};

// Função síncrona para carregar dados LOCAIS (localStorage) - não usa Supabase
const loadDBLocal = () => {
  try {
    const tenantId = getLoggedUserStoreId() || (() => {
      try {
        const userStr = localStorage.getItem('mozyc_pdv_current_user');
        if (userStr) {
          const user = JSON.parse(userStr);
          if (user.role === 'admin' && user.email) {
            return user.email.toLowerCase().replace(/[^a-z0-9]/g, '_');
          }
          if (user.tenantId) {
            return user.tenantId;
          }
        }
      } catch (e) {}
      return null;
    })();
    
    const dbKey = tenantId ? `mozyc_pdv_db_v2_tenant_${tenantId}` : 'mozyc_pdv_db_v2';
    const dbData = JSON.parse(localStorage.getItem(dbKey) || '{}');
    
    return {
      products: dbData.products || [],
      productModels: dbData.productModels || [],
      users: dbData.users || [],
      sales: dbData.sales || [],
      coupons: dbData.coupons || [],
      logs: dbData.logs || [],
      settings: dbData.settings || {},
      expenses: dbData.expenses || [],
      closures: dbData.closures || [],
      cashOpenings: dbData.cashOpenings || [],
      onlineOrders: dbData.onlineOrders || [],
      subscriptions: dbData.subscriptions || [],
      pendingRegistrations: dbData.pendingRegistrations || [],
    };
  } catch (e) {
    console.error('[loadDBLocal] Erro:', e);
    return {
      products: [],
      productModels: [],
      users: [],
      sales: [],
      coupons: [],
      logs: [],
      settings: {},
      expenses: [],
      closures: [],
      cashOpenings: [],
      onlineOrders: [],
      subscriptions: [],
      pendingRegistrations: [],
    };
  }
};

// Função para salvar dados LOCAIS (localStorage)
const saveDBLocal = (data) => {
  try {
    const tenantId = getLoggedUserStoreId() || (() => {
      try {
        const userStr = localStorage.getItem('mozyc_pdv_current_user');
        if (userStr) {
          const user = JSON.parse(userStr);
          if (user.role === 'admin' && user.email) {
            return user.email.toLowerCase().replace(/[^a-z0-9]/g, '_');
          }
          if (user.tenantId) {
            return user.tenantId;
          }
        }
      } catch (e) {}
      return null;
    })();
    
    const dbKey = tenantId ? `mozyc_pdv_db_v2_tenant_${tenantId}` : 'mozyc_pdv_db_v2';
    localStorage.setItem(dbKey, JSON.stringify(data));
  } catch (e) {
    console.error('[saveDBLocal] Erro:', e);
  }
};

// Nova função: carrega dados diretamente do Supabase
const loadDB = async () => {
  // Carregar produtos, usuários, vendas, etc. do Supabase
  const [products, users, sales, coupons, logs, settings, expenses, closures, cashOpenings, onlineOrders, subscriptions, pendingRegistrations] = await Promise.all([
    supabaseDB.products.list(),
    supabaseDB.users?.list ? supabaseDB.users.list() : [],
    supabaseDB.sales?.list ? supabaseDB.sales.list() : [],
    Promise.resolve([]), // coupons
    Promise.resolve([]), // logs
    Promise.resolve({}), // settings
    supabaseDB.expenses?.list ? supabaseDB.expenses.list() : [],
    supabaseDB.closures?.list ? supabaseDB.closures.list() : [],
    Promise.resolve([]), // cashOpenings
    Promise.resolve([]), // onlineOrders
    Promise.resolve([]), // subscriptions
    Promise.resolve([]), // pendingRegistrations
  ]);
  
  // Carregar productModels do localStorage (não existe no Supabase)
  let productModels = [];
  try {
    const tenantId = getLoggedUserStoreId() || (() => {
      try {
        const userStr = localStorage.getItem('mozyc_pdv_current_user');
        if (userStr) {
          const user = JSON.parse(userStr);
          if (user.role === 'admin' && user.email) {
            return user.email.toLowerCase().replace(/[^a-z0-9]/g, '_');
          }
          if (user.tenantId) {
            return user.tenantId;
          }
        }
      } catch (e) {}
      return null;
    })();
    
    const dbKey = tenantId ? `mozyc_pdv_db_v2_tenant_${tenantId}` : 'mozyc_pdv_db_v2';
    const dbData = JSON.parse(localStorage.getItem(dbKey) || '{}');
    productModels = dbData.productModels || [];
  } catch (e) {
    console.error('[loadDB] Erro ao carregar productModels do localStorage:', e);
  }
  
  return {
    products,
    users,
    sales,
    coupons,
    logs,
    settings,
    expenses,
    closures,
    cashOpenings,
    onlineOrders,
    subscriptions,
    pendingRegistrations,
    productModels,
  };
};



// saveDB agora é um NO-OP (não faz nada)
const saveDB = (data) => {
  // Não salva mais localmente
  return;
};

// Local migration: ensure sales entries include new metric fields
const migrateLocalSalesSchema = (data) => {
  if (!data || !Array.isArray(data.sales)) return;
  let changed = false;
  for (let i = 0; i < data.sales.length; i++) {
    const s = data.sales[i] || {};
    // add missing numeric fields
    if (s.total_cost === undefined) { s.total_cost = 0; changed = true; }
    if (s.profit_amount === undefined) { s.profit_amount = 0; changed = true; }
    if (s.total_net === undefined) { s.total_net = s.total_amount ?? 0; changed = true; }
    if (s.discount_amount === undefined) { s.discount_amount = s.discount_amount ?? s.discount ?? 0; changed = true; }
    if (s.items_count === undefined) { s.items_count = Array.isArray(s.items) ? s.items.reduce((acc, it) => acc + (Number(it.quantity)||0), 0) : 0; changed = true; }
    if (s.metadata === undefined) { s.metadata = { items: (s.items || []).map(i => ({ sku: i.sku || i.code, product_id: i.product_id, quantity: i.quantity, price: i.price || i.unit_price || i.unitPrice })) }; changed = true; }
    if (s.status === undefined) { s.status = 'finalized'; changed = true; }
  }
  if (changed) saveDB(data);
};


// Função auxiliar de log
const addLog = (data, user, action) => {
  if (!data.logs) data.logs = [];
  data.logs.unshift({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    user_name: user.name,
    user_cpf: user.cpf,
    action: action
  });
};

/**
 * Sincroniza produtos do Supabase para o localStorage (db.products)
 * Converte formato Supabase para formato local e mescla com produtos existentes
 * Prioriza produtos do Supabase (fonte de verdade)
 */
const syncProductsFromSupabase = async () => {
  try {
    // Usar supabaseDB diretamente
    // Carregar produtos locais PRIMEIRO (async)
    const data = await loadDB();
    const localProducts = data.products || [];
    console.log(`[syncProductsFromSupabase] ${localProducts.length} produtos encontrados localmente`);

    // Carregar produtos do Supabase
    const supabaseProducts = await supabaseDB.products.list();
    console.log(`[syncProductsFromSupabase] ${supabaseProducts.length} produtos encontrados no Supabase`);

    // Carregar modelos para vincular modelId baseado em modelName
    const models = data.productModels || [];
    // Converter produtos do Supabase para formato local
    const convertedProducts = supabaseProducts.map(supProd => {
      // Tentar vincular modelId baseado em modelName se modelId estiver vazio
      let modelId = supProd.modelId || null;
      if (!modelId && supProd.model_name) {
        const matchingModel = models.find(m => m.name === supProd.model_name);
        if (matchingModel) {
          modelId = matchingModel.id;
        }
      }
      
      // Mapear campos do Supabase para formato local
      // PRIORIZAR campo 'stock' (coluna principal) sobre 'stock_quantity'
      return {
        id: supProd.id,
        code: supProd.sku || supProd.code || null,
        name: supProd.name || 'Produto sem nome',
        stock: supProd.stock !== undefined && supProd.stock !== null ? supProd.stock : (supProd.stock_quantity || 0),
        stock_quantity: supProd.stock_quantity !== undefined && supProd.stock_quantity !== null ? supProd.stock_quantity : (supProd.stock || 0),
        salePrice: supProd.price || supProd.sale_price || supProd.salePrice || 0,
        costPrice: supProd.cost_price || supProd.costPrice || 0,
        description: supProd.description || null,
        image: supProd.image || null,
        active: supProd.active !== undefined ? supProd.active : true,
        // Manter campos adicionais se existirem
        // Mapear campos do Supabase: model_name -> modelName
        modelId: modelId,
        modelName: supProd.model_name || supProd.modelName || null, // model_name é a coluna no Supabase
        color: supProd.color || null,
        size: supProd.size || null,
        // Mapear campos de impostos e códigos
        taxPercentage: supProd.tax_percentage !== undefined && supProd.tax_percentage !== null ? parseFloat(supProd.tax_percentage) : (supProd.taxPercentage || 0),
        ncm: supProd.ncm || null, // Código NCM
        // Campos do Supabase para referência
        store_id: supProd.store_id,
        updated_at: supProd.updated_at,
        created_at: supProd.created_at,
      };
    });

    // Criar mapas para evitar duplicatas (por ID e por código)
    const supabaseProductsMapById = new Map(convertedProducts.map(p => [p.id, p]));
    const supabaseProductsMapByCode = new Map();
    convertedProducts.forEach(p => {
      if (p.code) {
        supabaseProductsMapByCode.set(p.code, p);
      }
    });

    // Mesclar produtos: priorizar Supabase, manter produtos locais que não estão no Supabase
    const mergedProductsMap = new Map(); // Usar Map para evitar duplicatas
    
    // Adicionar todos os produtos do Supabase (fonte de verdade)
    convertedProducts.forEach(supProd => {
      mergedProductsMap.set(supProd.id, supProd);
    });

    // Adicionar produtos locais que não estão no Supabase (produtos antigos ou offline)
    // IMPORTANTE: Produtos que foram excluídos no Supabase NÃO serão mantidos localmente
    // Isso garante que exclusões sejam propagadas corretamente
    localProducts.forEach(localProd => {
      // Verificar se produto já existe no Supabase (por ID ou código)
      const existsById = localProd.id && supabaseProductsMapById.has(localProd.id);
      const existsByCode = localProd.code && supabaseProductsMapByCode.has(localProd.code);
      
      if (!existsById && !existsByCode) {
        // Produto local que não existe no Supabase
        // Verificar se o produto foi criado no Supabase (tem ID UUID ou numérico do Supabase)
        // Se foi criado no Supabase mas não está mais lá = foi excluído
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(localProd.id);
        const isNumericId = /^\d+$/.test(String(localProd.id));
        const hasStoreId = localProd.store_id !== undefined && localProd.store_id !== null;
        const hasSupabaseFields = localProd.created_at || localProd.updated_at;
        
        // Se o produto tem características de ter sido criado no Supabase (UUID, ID numérico, store_id, ou campos de data)
        // mas não está mais no Supabase, significa que foi excluído
        const wasCreatedInSupabase = isUUID || (isNumericId && hasStoreId) || hasSupabaseFields;
        
        if (!wasCreatedInSupabase) {
          // Produto local antigo (não sincronizado ainda) - manter
          mergedProductsMap.set(localProd.id, localProd);
        } else {
          // Produto que foi criado no Supabase mas não está mais lá = foi excluído
          // Não adicionar ao mergedProducts (remover do localStorage)
          console.log(`[syncProductsFromSupabase] Produto excluído no Supabase removido localmente: ${localProd.name} (${localProd.id})`);
        }
      } else {
        // Produto existe no Supabase, não adicionar versão local (evitar duplicata)
        console.log(`[syncProductsFromSupabase] Produto já existe no Supabase, ignorando versão local: ${localProd.name} (${localProd.id})`);
      }
    });
    
    // Converter Map para array
    const mergedProducts = Array.from(mergedProductsMap.values());

    // Atualizar db.products com produtos mesclados
    data.products = mergedProducts;
    saveDB(data);

    console.log(`[syncProductsFromSupabase] Sincronização concluída: ${mergedProducts.length} produtos no total`);
    
    // Log de estoque após sincronização para debug
    if (mergedProducts.length > 0) {
      console.log(`[syncProductsFromSupabase] Exemplo de estoque após sincronização:`, mergedProducts.slice(0, 3).map(p => ({
        id: p.id,
        name: p.name,
        stock: p.stock,
        stock_quantity: p.stock_quantity
      })));
    }
    
    return mergedProducts;
  } catch (error) {
    console.error('[syncProductsFromSupabase] Erro ao sincronizar produtos:', error);
    throw error;
  }
};

export const db = {
  // Função de sincronização exposta
  syncProducts: syncProductsFromSupabase,

  // Função de DEBUG: listar TODOS os produtos do Supabase sem filtro (emergência)
  debugListAllSupabaseProducts: async () => {
    try {
      const { supabase } = await import('./supabaseClient.js');
      console.log('[DEBUG] Listando TODOS os produtos do Supabase (sem filtro)...');
      
      const { data, error } = await supabase
        .from('products')
        .select('id, name, store_id, sku')
        .limit(100);
      
      if (error) {
        console.error('[DEBUG] Erro ao listar produtos:', error);
        return [];
      }
      
      // Agrupar por store_id
      const byStoreId = {};
      (data || []).forEach(p => {
        if (!byStoreId[p.store_id]) byStoreId[p.store_id] = [];
        byStoreId[p.store_id].push(p);
      });
      
      console.log('[DEBUG] Produtos por store_id:', byStoreId);
      console.log('[DEBUG] Total de produtos:', data?.length || 0);
      
      return data || [];
    } catch (e) {
      console.error('[DEBUG] Erro ao listar todos os produtos:', e);
      return [];
    }
  },
  
  products: {
    list: async () => {
      const data = await loadDB();
      return data.products || [];
    },
    findByCode: async (code) => {
      const data = await loadDB();
      return (data.products || []).find(p => p.code === code);
    },
    listByModel: async (modelId) => {
      const data = await loadDB();
      return (data.products || []).filter(p => p.modelId === modelId);
    },
    create: async (prod, user) => {
      // Salvar no Supabase primeiro
      const sdb = await loadSupabaseDB();
      let createdInSupabase = false;
      
      if (sdb) {
        try {
          const createdProduct = await sdb.products.create(prod, user);
          // Usar o ID retornado pelo Supabase se disponível
          if (createdProduct && createdProduct.id) {
            prod.id = createdProduct.id;
            createdInSupabase = true;
            console.log(`[db.products.create] Produto criado no Supabase: ${prod.name} (${prod.id})`);
          }
        } catch (error) {
          console.error('[db.products.create] Erro ao salvar no Supabase:', error);
          // Continuar salvando localmente mesmo se falhar no Supabase
        }
      }
      
      // Salvar localmente apenas se:
      // 1. Não foi criado no Supabase (fallback offline)
      // 2. Ou se foi criado no Supabase mas precisa estar no localStorage para acesso imediato
      // IMPORTANTE: Se foi criado no Supabase, a sincronização vai adicionar automaticamente
      // Para evitar duplicação, vamos verificar se já existe antes de adicionar
      const data = loadDB();
      
      // IMPORTANTE: Garantir que o produto tem store_id do usuário logado
      if (!prod.store_id || prod.store_id === 'default_store') {
        const userStoreId = getLoggedUserStoreId();
        if (userStoreId) {
          prod.store_id = userStoreId;
        } else {
          console.warn('[db.products.create] Usuário não tem store_id definido!');
        }
      }
      
      // Verificar se produto já existe (por ID ou código)
      const existingById = prod.id ? data.products.find(p => p.id === prod.id) : null;
      const existingByCode = prod.code ? data.products.find(p => p.code === prod.code) : null;
      
      if (!existingById && !existingByCode) {
        // Produto não existe localmente, adicionar
        if (!prod.id) {
          prod.id = crypto.randomUUID();
        }
        data.products.push({ ...prod });
        addLog(data, user, `Cadastrou produto: ${prod.name}`);
        saveDB(data);
        console.log(`[db.products.create] Produto adicionado: ${prod.name} (${prod.id}) com store_id: ${prod.store_id}`);
      } else {
        // Produto já existe, atualizar com dados mais recentes
        const existingIndex = existingById 
          ? data.products.findIndex(p => p.id === prod.id)
          : data.products.findIndex(p => p.code === prod.code);
        
        if (existingIndex > -1) {
          data.products[existingIndex] = { ...data.products[existingIndex], ...prod };
          saveDB(data);
          console.log(`[db.products.create] Produto atualizado: ${prod.name} (${prod.id}) com store_id: ${prod.store_id}`);
        }
      }
    },
    update: async (id, updates, user) => {
      const data = loadDB();
      const index = data.products.findIndex(p => p.id === id);
      if (index > -1) {
        // Atualizar no Supabase primeiro
        const sdb = await loadSupabaseDB();
        if (sdb) {
          try {
            // Mapear campos locais para formato Supabase
            const currentProduct = data.products[index];
            const supabaseUpdates = {
              name: updates.name !== undefined ? updates.name : currentProduct.name,
              sku: updates.code !== undefined ? updates.code : (updates.sku || currentProduct.code),
              price: updates.salePrice !== undefined ? updates.salePrice : (updates.price || currentProduct.salePrice),
              stock_quantity: updates.stock !== undefined ? updates.stock : (currentProduct.stock || 0),
              stock: updates.stock !== undefined ? updates.stock : (currentProduct.stock || 0),
              cost_price: updates.costPrice !== undefined ? updates.costPrice : (updates.cost_price || currentProduct.costPrice),
              sale_price: updates.salePrice !== undefined ? updates.salePrice : (updates.sale_price || currentProduct.salePrice),
              description: updates.description !== undefined ? updates.description : currentProduct.description,
              image: updates.image !== undefined ? updates.image : currentProduct.image,
              active: updates.active !== undefined ? updates.active : (currentProduct.active !== undefined ? currentProduct.active : true),
            };
            
            await sdb.products.update(id, supabaseUpdates, user);
          } catch (error) {
            console.error('[db.products.update] Erro ao atualizar no Supabase:', error);
            // Continuar atualizando localmente mesmo se falhar no Supabase
          }
        }
        
        // Atualizar localmente
        data.products[index] = { ...data.products[index], ...updates };
        addLog(data, user, `Editou produto: ${data.products[index].name}`);
        saveDB(data);
      }
    },
    updateStock: async (id, newStock, user) => {
        const data = loadDB();
        const index = data.products.findIndex(p => p.id === id);
        if (index > -1) {
          const product = data.products[index];
          
          // Atualizar no Supabase primeiro
          const sdb = await loadSupabaseDB();
          if (sdb) {
            try {
              await sdb.products.updateStock(id, newStock, user);
            } catch (error) {
              console.error('[db.products.updateStock] Erro ao atualizar estoque no Supabase:', error);
              // Continuar atualizando localmente mesmo se falhar no Supabase
            }
          }
          
          // Atualizar localmente (ambos os campos)
          const oldStock = product.stock !== undefined && product.stock !== null ? product.stock : (product.stock_quantity || 0);
          addLog(data, user, `Alterou estoque de ${product.name}: ${oldStock} -> ${newStock}`);
          product.stock = newStock; // PRIORIZAR campo stock
          product.stock_quantity = newStock; // Manter sincronizado
          saveDB(data);
        }
    },
    delete: async (id, user) => {
      const data = loadDB();
      const prod = data.products.find(p => p.id === id);
      
      // Deletar do Supabase primeiro quando disponível.
      // Se a exclusão remota falhar, NÃO remover localmente para evitar inconsistência
      const sdb = await loadSupabaseDB();
      if (sdb && prod) {
        try {
          const result = await sdb.products.delete(id, user);
          // Alguns adaptadores retornam objeto { success: true } ou lançam erro.
          if (result && result.success === false) {
            console.error('[db.products.delete] Supabase retornou falha ao deletar:', result);
            throw new Error(result.message || 'Falha ao deletar produto no Supabase');
          }
          console.log(`[db.products.delete] ✓ Produto deletado do Supabase: ${prod.name} (${id})`);
        } catch (error) {
          console.error('[db.products.delete] Erro ao deletar do Supabase:', error);
          // Não continuar — lançar erro para o chamador decidir. Isso impede que a UI mostre
          // remoção local quando a remoção remota falhou (evita registros inconsistentes/null).
          throw error;
        }
      }

      // Se chegou aqui: ou não havia Supabase (offline) ou a exclusão remota teve sucesso.
      // Remover localmente apenas nesses casos.
      const productIndex = data.products.findIndex(p => p.id === id);
      if (productIndex > -1) {
        data.products.splice(productIndex, 1);
        addLog(data, user, `Excluiu produto: ${prod?.name || id}`);
        saveDB(data);
        console.log(`[db.products.delete] ✓ Produto removido do LocalStorage: ${prod?.name || id} (${id})`);
      } else {
        console.warn(`[db.products.delete] Produto não encontrado no LocalStorage: ${id}`);
      }
    }
  },
  productModels: {
    list: async () => (await loadDB()).productModels || [],
    create: async (model, user) => {
      const data = await loadDB();
      if (!data.productModels) data.productModels = [];
      
      const modelCode = model.name.slice(0, 3).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
      const newModel = { ...model, id: crypto.randomUUID(), code: modelCode };
      data.productModels.push(newModel);
      addLog(data, user, `Cadastrou modelo: ${model.name}`);

      // Create individual products from variations
      for (const v of model.variations) {
        // Usar SKU gerado no frontend, ou gerar um se não existir
        const productSku = v.sku || `${modelCode}-${v.color.slice(0,2).toUpperCase()}-${v.size}`;
        const newProduct = {
          id: crypto.randomUUID(),
          modelId: newModel.id,
          modelName: newModel.name,
          code: productSku,
          sku: productSku,
          name: `${newModel.name} ${v.color} ${v.size}`,
          color: v.color,
          size: v.size,
          stock: v.quantity,
          stock_quantity: v.quantity,
          price: model.salePrice,
          costPrice: model.costPrice,
          salePrice: model.salePrice,
          taxPercentage: model.taxPercentage || 0,
          ncm: model.ncm || null,
          image: newModel.image
        };
        
        // Salvar no Supabase primeiro
        try {
          const createdProduct = await supabaseDB.products.create(newProduct, user);
          if (createdProduct && createdProduct.id) {
            newProduct.id = createdProduct.id;
            console.log(`[productModels.create] Produto criado no Supabase: ${newProduct.name} (${newProduct.id})`);
          }
        } catch (error) {
          console.error('[productModels.create] Erro ao salvar produto no Supabase:', error);
          // Continuar salvando localmente mesmo se falhar no Supabase
        }
        
        // Verificar se produto já existe antes de adicionar (evitar duplicatas)
        const existingProduct = data.products.find(p => 
          (p.id && p.id === newProduct.id) || 
          (p.code && p.code === newProduct.code)
        );
        
        if (!existingProduct) {
          data.products.push(newProduct);
          addLog(data, user, `Auto-cadastrou produto: ${newProduct.modelName} ${newProduct.color}/${newProduct.size}`);
          console.log(`[productModels.create] Produto adicionado ao localStorage: ${newProduct.name}`);
        } else {
          // Produto já existe, atualizar com dados mais recentes
          const existingIndex = data.products.findIndex(p => 
            (p.id && p.id === newProduct.id) || 
            (p.code && p.code === newProduct.code)
          );
          if (existingIndex > -1) {
            data.products[existingIndex] = { ...data.products[existingIndex], ...newProduct };
            console.log(`[productModels.create] Produto atualizado no localStorage: ${newProduct.name}`);
          }
        }
      }

      saveDB(data);
    },
    update: async (id, updates, user) => {
      const data = loadDB();
      if (!data.productModels) return;
      const index = data.productModels.findIndex(m => m.id === id);
      if (index > -1) {
        const model = data.productModels[index];
        const modelCode = model.code;
        
        // Atualizar dados básicos do modelo
        data.productModels[index] = { 
          ...model, 
          name: updates.name || model.name,
          costPrice: updates.costPrice !== undefined ? updates.costPrice : model.costPrice,
          salePrice: updates.salePrice !== undefined ? updates.salePrice : model.salePrice,
          taxPercentage: updates.taxPercentage !== undefined ? updates.taxPercentage : (model.taxPercentage || 0),
          image: updates.image !== undefined ? updates.image : model.image
        };
        
        // Atualizar estoque de variações existentes
        if (updates.updateExistingVariations && updates.updateExistingVariations.length > 0) {
          const sdb = await loadSupabaseDB();
          
          for (const variation of updates.updateExistingVariations) {
            const existingProduct = data.products.find(p => 
              p.modelId === id && 
              p.color === variation.color && 
              p.size === variation.size
            );
            
            if (existingProduct) {
              // Atualizar preços e estoque localmente
              const oldStock = existingProduct.stock || 0;
              const newStock = variation.quantity !== undefined ? Math.max(0, parseFloat(variation.quantity)) : oldStock;
              
              existingProduct.costPrice = updates.costPrice !== undefined ? updates.costPrice : existingProduct.costPrice;
              existingProduct.salePrice = updates.salePrice !== undefined ? updates.salePrice : existingProduct.salePrice;
              existingProduct.taxPercentage = updates.taxPercentage !== undefined ? updates.taxPercentage : (existingProduct.taxPercentage || 0);
              existingProduct.ncm = updates.ncm !== undefined ? updates.ncm : existingProduct.ncm;
              existingProduct.modelName = updates.name || existingProduct.modelName;
              existingProduct.image = updates.image !== undefined ? updates.image : existingProduct.image;
              existingProduct.stock = newStock;
              existingProduct.stock_quantity = newStock; // Sincronizar ambos os campos
              
              // Atualizar no Supabase
              if (sdb) {
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(existingProduct.id);
                
                if (isUUID) {
                  try {
                    await sdb.products.update(existingProduct.id, {
                      name: existingProduct.name,
                      sku: existingProduct.sku || existingProduct.code,
                      price: existingProduct.salePrice,
                      sale_price: existingProduct.salePrice,
                      cost_price: existingProduct.costPrice,
                      stock: newStock, // PRIORIZAR campo stock (coluna principal)
                      stock_quantity: newStock, // Manter sincronizado
                      image: existingProduct.image,
                      modelName: existingProduct.modelName || updates.name || model.name, // Salvar model_name no Supabase
                      color: existingProduct.color, // Salvar color no Supabase
                      size: existingProduct.size, // Salvar size no Supabase
                      taxPercentage: existingProduct.taxPercentage, // Salvar tax_percentage no Supabase
                      ncm: existingProduct.ncm, // Salvar ncm no Supabase
                      updated_at: new Date().toISOString()
                    }, user);
                    console.log(`[productModels.update] Produto atualizado no Supabase: ${existingProduct.name} (${existingProduct.id})`);
                  } catch (error) {
                    console.error(`[productModels.update] Erro ao atualizar produto ${existingProduct.id} no Supabase:`, error);
                    // Continuar atualizando localmente mesmo se falhar no Supabase
                  }
                }
              }
              
              // Log de mudança de estoque
              if (newStock !== oldStock) {
                const difference = newStock - oldStock;
                if (difference > 0) {
                  addLog(data, user, `Atualizou estoque do produto ${existingProduct.code}: ${oldStock} → ${newStock} (+${difference})`);
                } else {
                  addLog(data, user, `Atualizou estoque do produto ${existingProduct.code}: ${oldStock} → ${newStock} (${difference})`);
                }
              }
            }
          }
        }
        
        // Criar novos produtos para novas variações
        if (updates.newVariations && updates.newVariations.length > 0) {
          if (!data.products) data.products = [];
          
          const sdb = await loadSupabaseDB();
          for (const variation of updates.newVariations) {
            // Verificar se já existe produto com essa cor/tamanho
            const exists = data.products.some(p => 
              p.modelId === id && 
              p.color === variation.color && 
              p.size === variation.size
            );
            
            if (!exists) {
              // Usar SKU gerado no frontend, ou gerar um se não existir
              const productSku = variation.sku || `${modelCode}-${variation.color.slice(0,2).toUpperCase()}-${variation.size}`;
              const newProduct = {
                id: crypto.randomUUID(),
                modelId: id,
                modelName: updates.name || model.name,
                modelCode: modelCode,
                code: productSku,
                sku: productSku,
                name: `${updates.name || model.name} ${variation.color} ${variation.size}`,
                color: variation.color,
                size: variation.size,
                stock: variation.quantity,
                stock_quantity: variation.quantity,
                price: updates.salePrice || model.salePrice,
                costPrice: updates.costPrice || model.costPrice,
                salePrice: updates.salePrice || model.salePrice,
                taxPercentage: updates.taxPercentage !== undefined ? updates.taxPercentage : (model.taxPercentage || 0),
                ncm: updates.ncm !== undefined ? updates.ncm : (model.ncm || null),
                image: updates.image || model.image,
                active: true,
                createdAt: new Date().toISOString()
              };
              
              // Salvar no Supabase primeiro
              if (sdb) {
                try {
                  const createdProduct = await sdb.products.create(newProduct, user);
                  if (createdProduct && createdProduct.id) {
                    newProduct.id = createdProduct.id;
                    console.log(`[productModels.update] Produto criado no Supabase: ${newProduct.name} (${newProduct.id})`);
                  }
                } catch (error) {
                  console.error('[productModels.update] Erro ao salvar produto no Supabase:', error);
                  // Continuar salvando localmente mesmo se falhar no Supabase
                }
              }
              
              // Verificar se produto já existe antes de adicionar (evitar duplicatas)
              const existingProduct = data.products.find(p => 
                (p.id && p.id === newProduct.id) || 
                (p.code && p.code === newProduct.code)
              );
              
              if (!existingProduct) {
                data.products.push(newProduct);
                addLog(data, user, `Adicionou variação ao modelo ${model.name}: ${variation.color}/${variation.size} (${variation.quantity} un)`);
                console.log(`[productModels.update] Produto adicionado ao localStorage: ${newProduct.name}`);
              } else {
                // Produto já existe, atualizar com dados mais recentes
                const existingIndex = data.products.findIndex(p => 
                  (p.id && p.id === newProduct.id) || 
                  (p.code && p.code === newProduct.code)
                );
                if (existingIndex > -1) {
                  data.products[existingIndex] = { ...data.products[existingIndex], ...newProduct };
                  console.log(`[productModels.update] Produto atualizado no localStorage: ${newProduct.name}`);
                }
              }
            } else {
              // Se já existe, apenas atualiza o estoque
              const existingProduct = data.products.find(p => 
                p.modelId === id && 
                p.color === variation.color && 
                p.size === variation.size
              );
              if (existingProduct) {
                existingProduct.stock = (existingProduct.stock || 0) + variation.quantity;
                addLog(data, user, `Adicionou ${variation.quantity} unidades ao produto ${existingProduct.code}`);
              }
            }
          }
        }
        
        addLog(data, user, `Editou modelo: ${data.productModels[index].name}`);
        saveDB(data);
      }
    },
    delete: async (id, user) => {
      try {
        // Verificar se user está definido
        if (!user) {
          throw new Error('Usuário não definido. Faça login novamente.');
        }
        
        console.log(`[productModels.delete] Iniciando exclusão do modelo: ${id}`);
        
        // Carregar supabaseDB
        const sdb = await loadSupabaseDB();
        
        if (!sdb) {
          throw new Error('Conexão com Supabase não disponível');
        }
        
        // Buscar produtos do modelo no Supabase
        // Primeiro, precisamos identificar o modelo pelo ID ou buscar produtos relacionados
        let modelName = null;
        let supabaseProducts = [];
        
        // Buscar todos os produtos e filtrar pelo modelo
        try {
          const allProducts = await sdb.products.list();
          
          // Encontrar produtos que pertencem a este modelo
          // O ID do modelo pode estar no campo modelId ou o nome no model_name
          supabaseProducts = allProducts.filter(p => {
            // Verificar se o produto pertence ao modelo pelo ID
            if (p.modelId === id || p.model_id === id) return true;
            
            // Verificar pelo nome do modelo (se começar com o mesmo padrão)
            if (p.model_name && p.model_name === id) return true;
            
            return false;
          });
          
          // Se não encontrou por modelId, tentar extrair o nome do modelo do primeiro produto
          if (supabaseProducts.length === 0) {
            // Buscar pelo nome: produtos que têm nome no formato "MODELO - COR - TAM"
            const productsWithModelPattern = allProducts.filter(p => {
              const nameParts = (p.name || '').split(' - ');
              return nameParts.length >= 1;
            });
            
            // Agrupar por possível nome de modelo (primeira parte do nome)
            const modelGroups = {};
            for (const p of productsWithModelPattern) {
              const possibleModelName = (p.name || '').split(' - ')[0];
              if (!modelGroups[possibleModelName]) {
                modelGroups[possibleModelName] = [];
              }
              modelGroups[possibleModelName].push(p);
            }
            
            // Verificar se o ID corresponde a algum grupo
            // Também verificar dados locais para encontrar o nome do modelo
            const data = loadDB();
            const localModel = (data.productModels || []).find(m => m.id === id);
            
            if (localModel) {
              modelName = localModel.name;
              supabaseProducts = allProducts.filter(p => {
                const productModelName = (p.name || '').split(' - ')[0];
                return productModelName === modelName || p.model_name === modelName;
              });
              console.log(`[productModels.delete] Encontrado modelo local: ${modelName}, ${supabaseProducts.length} produtos no Supabase`);
            } else {
              // Tentar usar o ID como nome do modelo diretamente
              supabaseProducts = allProducts.filter(p => {
                const productModelName = (p.name || '').split(' - ')[0];
                return productModelName === id || p.model_name === id;
              });
              if (supabaseProducts.length > 0) {
                modelName = id;
              }
            }
          } else {
            // Extrair nome do modelo do primeiro produto
            if (supabaseProducts[0]) {
              modelName = supabaseProducts[0].model_name || (supabaseProducts[0].name || '').split(' - ')[0];
            }
          }
          
          console.log(`[productModels.delete] Encontrados ${supabaseProducts.length} produto(s) no Supabase para o modelo`);
        } catch (error) {
          console.error('[productModels.delete] Erro ao buscar produtos no Supabase:', error);
        }
        
        // Deletar produtos no Supabase
        let supabaseDeletedCount = 0;
        let supabaseErrorCount = 0;
        const supabaseErrors = [];
        
        for (const product of supabaseProducts) {
          try {
            console.log(`[productModels.delete] Deletando produto: ${product.name} (${product.id})`);
            await sdb.products.delete(product.id, user);
            supabaseDeletedCount++;
            console.log(`[productModels.delete] ✓ Produto deletado: ${product.name}`);
          } catch (error) {
            console.error(`[productModels.delete] ✗ Erro ao deletar produto ${product.id}:`, error);
            supabaseErrors.push({ productId: product.id, productName: product.name, error: error.message || error });
            supabaseErrorCount++;
          }
        }
        
        if (supabaseErrorCount > 0) {
          console.warn(`[productModels.delete] ⚠ ${supabaseErrorCount} produto(s) falharam ao deletar`);
        }
        
        // Deletar também do localStorage (se existir)
        const data = loadDB();
        if (data.productModels) {
          const localModel = data.productModels.find(m => m.id === id);
          if (localModel) {
            modelName = modelName || localModel.name;
            data.productModels = data.productModels.filter(m => m.id !== id);
            data.products = (data.products || []).filter(p => p.modelId !== id && p.modelName !== modelName);
            addLog(data, user, `Excluiu modelo e produtos associados: ${modelName}`);
            saveDB(data);
            console.log(`[productModels.delete] ✓ Modelo removido do localStorage`);
          }
        }
        
        console.log(`[productModels.delete] ✓ Exclusão concluída. ${supabaseDeletedCount} produtos deletados no Supabase`);
        
        return {
          success: true,
          modelName: modelName || id,
          supabaseProductsDeleted: supabaseDeletedCount,
          supabaseErrors: supabaseErrorCount > 0 ? supabaseErrors : null
        };
      } catch (error) {
        console.error('[productModels.delete] Erro ao excluir modelo:', error);
        throw error;
      }
    }
  },
  sales: {
    list: async () => {
      const data = await loadDB();
      return (data.sales || []).sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date));
    },
    listFinalized: async () => {
      const data = await loadDB();
      return (data.sales || []).filter(s => s.status === 'finalized' || !s.status).sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date));
    },
    listCancelled: async () => {
      const data = await loadDB();
      return (data.sales || []).filter(s => s.status === 'cancelled').sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date));
    },
    create: async (sale, user) => {
      const data = await loadDB();
      const newSale = { 
        ...sale, 
        id: sale.id || crypto.randomUUID(),
        status: sale.status || 'finalized', // Status padrão: finalizada
        created_by: user.name,
        created_by_cpf: user.cpf
      };
      
      // Verificar se venda já existe (por external_id ou id)
      const existingIndex = data.sales.findIndex(s => 
        (s.external_id && s.external_id === sale.external_id) || 
        (s.id === newSale.id)
      );
      
      if (existingIndex > -1) {
        // Atualizar venda existente
        data.sales[existingIndex] = { ...data.sales[existingIndex], ...newSale };
        console.log(`[db.sales.create] Venda atualizada: ${newSale.id}`);
      } else {
        // Adicionar nova venda
        data.sales.push(newSale);
        console.log(`[db.sales.create] Venda adicionada: ${newSale.id}`);
      }
      
      // Baixa estoque - ATUALIZAR AMBOS OS CAMPOS
      sale.items.forEach(item => {
        const pIndex = data.products.findIndex(p => p.id === item.product_id);
        if (pIndex > -1) {
          const product = data.products[pIndex];
          const currentStock = product.stock !== undefined && product.stock !== null ? product.stock : (product.stock_quantity || 0);
          const newStock = Math.max(0, currentStock - item.quantity);
          // Atualizar ambos os campos
          product.stock = newStock;
          product.stock_quantity = newStock;
        }
      });
      addLog(data, user, `Realizou venda: R$ ${sale.total_amount.toFixed(2)}`);
      saveDB(data);
      return newSale;
    },
    cancel: async (id, password, user) => {
      // Validar permissão
      if (!user || !(user.role === 'admin' || user.role === 'gerente' || user.role === 'goodadmin')) {
        return { success: false, message: 'Apenas gerente, admin ou goodadmin podem cancelar vendas.' };
      }

      try {
        const { supabase } = await import('./supabaseClient.js');
        
        // 1. Buscar a venda ANTES de cancelar (para pegar os items)
        const { data: sale, error: fetchError } = await supabase
          .from('sales')
          .select('items, status')
          .eq('id', id)
          .single();
        
        if (fetchError) {
          console.error('[db.sales.cancel] Erro ao buscar venda:', fetchError);
          return { success: false, message: 'Venda não encontrada' };
        }
        
        if (sale.status === 'cancelled') {
          return { success: false, message: 'Venda já está cancelada' };
        }
        
        // 2. Cancelar a venda (muda status para 'cancelled')
        const { error: updateError } = await supabase
          .from('sales')
          .update({ status: 'cancelled' })
          .eq('id', id);
        
        if (updateError) {
          console.error('[db.sales.cancel] Erro ao cancelar:', updateError);
          return { success: false, message: updateError.message };
        }
        
        console.log('[db.sales.cancel] ✅ Venda cancelada no Supabase');
        
        // 3. ESTORNAR ESTOQUE no Supabase
        if (sale && sale.items && Array.isArray(sale.items)) {
          for (const item of sale.items) {
            const productId = item.product_id || item.pid;
            const quantity = item.quantity || item.qtd || 1;
            
            if (!productId) continue;
            
            try {
              // Buscar estoque atual
              const { data: product, error: prodError } = await supabase
                .from('products')
                .select('stock_quantity, name')
                .eq('id', productId)
                .single();
              
              if (prodError) {
                console.error('[db.sales.cancel] Erro ao buscar produto:', productId, prodError.message);
                continue;
              }
              
              if (product) {
                const oldStock = product.stock_quantity || 0;
                const newStock = oldStock + quantity;
                
                const { error: stockError } = await supabase
                  .from('products')
                  .update({ stock: newStock, stock_quantity: newStock })
                  .eq('id', productId);
                
                if (stockError) {
                  console.error('[db.sales.cancel] Erro ao estornar estoque:', stockError.message);
                } else {
                  console.log('[db.sales.cancel] ✅ Estoque estornado:', product.name, oldStock, '->', newStock, '(+' + quantity + ')');
                }
              }
            } catch (err) {
              console.error('[db.sales.cancel] Erro ao estornar estoque:', err);
            }
          }
        }
        
        return { success: true, message: 'Venda cancelada com sucesso! Estoque estornado.' };
        
      } catch (error) {
        console.error('[db.sales.cancel] Erro:', error);
        return { success: false, message: error.message || 'Erro ao cancelar venda' };
      }
    }
  },
  users: {
    list: async () => (await loadDB()).users,
    login: async (identifier, password, loginType = "auto") => {
      const users = (await loadDB()).users;
      let user = null;
      
      // Detectar automaticamente se é email ou CPF
      if (loginType === "auto") {
        const isEmail = identifier.includes("@") && identifier.includes(".");
        loginType = isEmail ? "email" : "cpf";
      }
      
      console.log('[db.users.login] Tentando login:', { 
        identifier, 
        loginType, 
        totalUsers: users.length,
        activeUsers: users.filter(u => u.active !== false).length
      });
      
      if (loginType === "cpf") {
        // Login por CPF (GERENTE/CAIXA)
        const normalizedCpf = identifier.replace(/\D/g, '');
        console.log('[db.users.login] CPF normalizado:', normalizedCpf);
        
        // Listar todos os usuários com CPF para debug
        const usersWithCpf = users.filter(u => u.cpf && u.active !== false);
        console.log('[db.users.login] Usuários com CPF cadastrados:', usersWithCpf.map(u => ({
          name: u.name,
          cpf: u.cpf,
          cpfNormalized: u.cpf.replace(/\D/g, ''),
          hasPassword: !!u.password,
          passwordLength: u.password?.length
        })));
        
        user = users.find(u => 
          u.cpf && u.cpf.replace(/\D/g, '') === normalizedCpf && 
          u.password === password && 
          u.active !== false
        );
        
        if (!user) {
          // Verificar se o CPF existe mas a senha está errada
          const userWithCpf = users.find(u => 
            u.cpf && u.cpf.replace(/\D/g, '') === normalizedCpf && 
            u.active !== false
          );
          
          if (userWithCpf) {
            console.log('[db.users.login] ❌ CPF encontrado mas senha incorreta:', {
              name: userWithCpf.name,
              senhaFornecida: password,
              senhaEsperada: userWithCpf.password,
              senhasFaltam: userWithCpf.password === password ? 'Iguais!' : 'Diferentes'
            });
          } else {
            console.log('[db.users.login] ❌ CPF não encontrado no sistema');
          }
        }
      } else {
        // Login por email (ADMIN)
        user = users.find(u => 
          u.email && u.email.toLowerCase() === identifier.toLowerCase() && 
          u.password === password && 
          u.active !== false
        );
      }
      
      if(user) {
          console.log('[db.users.login] ✅ Login bem-sucedido:', user.name);
          const data = loadDB();
          addLog(data, user, "Realizou Login no sistema");
          saveDB(data);
      }
      return user;
    },
    create: (newUser, currentUser) => {
        const data = loadDB();
        // Validar que apenas ADMIN pode criar usuários
        const creator = data.users.find(u => u.id === currentUser.id);
        if (!creator || creator.role !== 'admin') {
            throw new Error("Apenas administradores podem criar usuários");
        }
        
        // Calcular tenantId do criador (ADMIN)
        const creatorTenantId = creator.role === 'admin' && creator.email
            ? creator.email.toLowerCase().replace(/[^a-z0-9]/g, '_')
            : creator.tenantId || 'default';
        
        // TODO: Verificar limite de usuários do plano (desabilitado durante fase de desenvolvimento/teste)
        // if (!db.subscriptions.canAddUser(creatorTenantId)) {
        //     const subscription = db.subscriptions.getByTenantId(creatorTenantId);
        //     const plan = subscription ? PLANS[subscription.planId?.toUpperCase()] : PLANS.BASIC;
        //     const currentUsers = db.subscriptions.getActiveUsersCount(creatorTenantId);
        //     throw new Error(`Limite de usuários atingido! Seu plano ${plan.name} permite até ${plan.maxUsers} usuários. Você tem ${currentUsers} usuários ativos. Faça upgrade do plano para adicionar mais usuários.`);
        // }
        
        // Validar campos baseado no role
        if (newUser.role === 'gerente' || newUser.role === 'caixa') {
            if (!newUser.cpf) {
                throw new Error("CPF é obrigatório para Gerente e Caixa");
            }
            // Verificar se CPF já existe (apenas no mesmo tenant)
            const normalizedCpf = newUser.cpf.replace(/\D/g, '');
            if (data.users.some(u => 
                u.cpf && 
                u.cpf.replace(/\D/g, '') === normalizedCpf && 
                (u.tenantId === creatorTenantId || (!u.tenantId && creatorTenantId === 'default'))
            )) {
                throw new Error("CPF já cadastrado");
            }
        }
        
        // Verificar se email já existe (se fornecido) - apenas no mesmo tenant
        if (newUser.email && data.users.some(u => 
            u.email && 
            u.email.toLowerCase() === newUser.email.toLowerCase() &&
            (u.tenantId === creatorTenantId || (!u.tenantId && creatorTenantId === 'default'))
        )) {
            throw new Error("Email já cadastrado");
        }
        
        // Atribuir tenantId ao novo usuário
        const userToCreate = {
            ...newUser,
            id: crypto.randomUUID(),
            active: true,
            tenantId: newUser.role === 'admin' && newUser.email
                ? newUser.email.toLowerCase().replace(/[^a-z0-9]/g, '_')
                : creatorTenantId
        };
        
        data.users.push(userToCreate);
        addLog(data, currentUser, `Cadastrou usuário: ${newUser.name}`);
        saveDB(data);
    },
    delete: (id, currentUser, password) => {
        const data = loadDB();
        const userToDelete = data.users.find(u => u.id === id);
        const deleter = data.users.find(u => u.id === currentUser.id);
        
        if (!userToDelete) {
            throw new Error("Usuário não encontrado");
        }
        
        // Não permitir deletar ADMIN
        if (userToDelete.role === 'admin') {
            throw new Error("Não é possível remover o administrador");
        }
        
        // Validar permissão (ADMIN ou GERENTE)
        if (!deleter || (deleter.role !== 'admin' && deleter.role !== 'gerente')) {
            throw new Error("Apenas administradores e gerentes podem remover usuários");
        }
        
        // Validar senha
        if (!password || deleter.password !== password) {
            throw new Error("Senha incorreta");
        }
        
        // Marcar como inativo ao invés de deletar
        userToDelete.active = false;
        addLog(data, currentUser, `Removeu usuário: ${userToDelete.name}`);
        saveDB(data);
    }
  },
  coupons: {
      list: () => loadDBLocal().coupons || [],
      create: (coupon, user) => {
          const data = loadDBLocal();
          if (!data.coupons) data.coupons = [];
          data.coupons.push({ ...coupon, id: crypto.randomUUID() });
          addLog(data, user, `Criou cupom: ${coupon.code}`);
          saveDBLocal(data);
      },
      delete: (id, user) => {
          const data = loadDBLocal();
          if (!data.coupons) return;
          data.coupons = data.coupons.filter(c => c.id !== id);
          addLog(data, user, "Removeu cupom");
          saveDBLocal(data);
      }
  },
  logs: {
      list: () => loadDBLocal().logs
  },
  settings: {
    get: () => {
      const data = loadDBLocal();
      return data.settings || { cnpj: "", shopifyApiKey: "", shopifyWebhookUrl: "" };
    },
    update: (updates, user) => {
      const data = loadDBLocal();
      if (!data.settings) data.settings = { cnpj: "", shopifyApiKey: "", shopifyWebhookUrl: "" };
      data.settings = { ...data.settings, ...updates };
      addLog(data, user, "Atualizou configurações gerais");
      saveDBLocal(data);
    }
  },
  onlineOrders: {
    list: () => loadDBLocal().onlineOrders || [],
    create: (order, user) => {
      const data = loadDBLocal();
      if (!data.onlineOrders) data.onlineOrders = [];
      const newOrder = {
        id: crypto.randomUUID(),
        ...order,
        createdAt: new Date().toISOString(),
        status: order.status || "aguardo"
      };
      data.onlineOrders.unshift(newOrder);
      addLog(data, user, `Pedido online recebido: ${order.customerName} - ${order.orderNumber || order.id}`);
      saveDBLocal(data);
      return newOrder;
    },
    update: async (id, updates, user) => {
      const data = loadDBLocal();
      if (!data.onlineOrders) return;
      const index = data.onlineOrders.findIndex(o => o.id === id);
      if (index > -1) {
        data.onlineOrders[index] = { ...data.onlineOrders[index], ...updates };
        addLog(data, user, `Atualizou pedido online: ${data.onlineOrders[index].orderNumber || id}`);
        saveDBLocal(data);
      }
    },
    delete: (id, user) => {
      const data = loadDBLocal();
      if (!data.onlineOrders) return;
      data.onlineOrders = data.onlineOrders.filter(o => o.id !== id);
      addLog(data, user, "Removeu pedido online");
      saveDBLocal(data);
    }
  },
  expenses: {
    list: () => loadDBLocal().expenses || [],
    create: (expense, user) => {
      const data = loadDBLocal();
      if (!data.expenses) data.expenses = [];
      const newExpense = {
        ...expense,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        created_by: user.name
      };
      data.expenses.push(newExpense);
      addLog(data, user, `Adicionou despesa: ${expense.description} - R$ ${expense.amount.toFixed(2)}`);
      saveDBLocal(data);
      return newExpense;
    },
    update: async (id, updates, user) => {
      const data = loadDBLocal();
      if (!data.expenses) return null;
      const index = data.expenses.findIndex(e => e.id === id);
      if (index > -1) {
        data.expenses[index] = { ...data.expenses[index], ...updates };
        addLog(data, user, `Atualizou despesa: ${updates.description || data.expenses[index].description}`);
        saveDBLocal(data);
        return data.expenses[index];
      }
      return null;
    },
    delete: (id, user) => {
      const data = loadDBLocal();
      if (!data.expenses) return false;
      const expense = data.expenses.find(e => e.id === id);
      if (expense) {
        data.expenses = data.expenses.filter(e => e.id !== id);
        addLog(data, user, `Removeu despesa: ${expense.description}`);
        saveDBLocal(data);
        return true;
      }
      return false;
    },
    getTotalByMonth: (year, month) => {
      const expenses = loadDBLocal().expenses || [];
      return expenses
        .filter(e => {
          const date = new Date(e.date);
          return date.getFullYear() === year && date.getMonth() === month;
        })
        .reduce((sum, e) => sum + (e.amount || 0), 0);
    }
  },
  closures: {
    list: () => loadDBLocal().closures || [],
    getByDate: (date) => {
      const closures = loadDBLocal().closures || [];
      const targetDate = new Date(date).toISOString().split('T')[0];
      return closures.find(c => {
        const closureDate = new Date(c.date).toISOString().split('T')[0];
        return closureDate === targetDate;
      });
    },
    create: (closure, user) => {
      const data = loadDBLocal();
      if (!data.closures) data.closures = [];
      const newClosure = {
        ...closure,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        created_by: user.name,
        created_by_cpf: user.cpf
      };
      data.closures.push(newClosure);
      addLog(data, user, `Fechou caixa do dia ${new Date(closure.date).toLocaleDateString('pt-BR')}`);
      saveDBLocal(data);
      return newClosure;
    },
    getById: (id) => {
      const closures = loadDBLocal().closures || [];
      return closures.find(c => c.id === id);
    }
  },
  cashOpenings: {
    list: () => loadDBLocal().cashOpenings || [],
    getByDate: (date) => {
      const openings = loadDBLocal().cashOpenings || [];
      const targetDate = new Date(date).toISOString().split('T')[0];
      return openings.find(o => {
        const openingDate = new Date(o.date).toISOString().split('T')[0];
        return openingDate === targetDate;
      });
    },
    create: (opening, user) => {
      const data = loadDBLocal();
      if (!data.cashOpenings) data.cashOpenings = [];
      const newOpening = {
        ...opening,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        created_by: user.name,
        created_by_cpf: user.cpf
      };
      data.cashOpenings.push(newOpening);
      addLog(data, user, `Abriu caixa do dia ${new Date(opening.date).toLocaleDateString('pt-BR')} com R$ ${opening.amount.toFixed(2)}`);
      saveDBLocal(data);
      return newOpening;
    },
    update: async (id, updates, user) => {
      const data = loadDBLocal();
      if (!data.cashOpenings) return;
      const index = data.cashOpenings.findIndex(o => o.id === id);
      if (index > -1) {
        data.cashOpenings[index] = { ...data.cashOpenings[index], ...updates };
        addLog(data, user, `Atualizou abertura de caixa`);
        saveDBLocal(data);
      }
    },
    getById: (id) => {
      const openings = loadDBLocal().cashOpenings || [];
      return openings.find(o => o.id === id);
    }
  },
  subscriptions: {
    list: () => {
      const tenantId = getCurrentTenantId();
      const subscriptions = loadDBLocal().subscriptions || [];
      // Retornar apenas assinaturas do tenant atual
      return subscriptions.filter(s => s.tenantId === tenantId || (!s.tenantId && !tenantId));
    },
    getByTenantId: (tenantId) => {
      const subscriptions = loadDBLocal().subscriptions || [];
      return subscriptions.find(s => s.tenantId === tenantId);
    },
    create: (subscription) => {
      const data = loadDBLocal();
      if (!data.subscriptions) data.subscriptions = [];
      const newSubscription = {
        ...subscription,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        active: true
      };
      data.subscriptions.push(newSubscription);
      saveDBLocal(data);
      return newSubscription;
    },
    update: (id, updates) => {
      const data = loadDBLocal();
      if (!data.subscriptions) return;
      const index = data.subscriptions.findIndex(s => s.id === id);
      if (index > -1) {
        data.subscriptions[index] = { ...data.subscriptions[index], ...updates };
        saveDBLocal(data);
      }
    },
    getActiveUsersCount: (tenantId) => {
      const data = loadDBLocal();
      const users = data.users || [];
      return users.filter(u => 
        (u.tenantId === tenantId || (!u.tenantId && tenantId === 'default')) && 
        u.active !== false
      ).length;
    },
    canAddUser: (tenantId) => {
      const subscription = db.subscriptions.getByTenantId(tenantId);
      if (!subscription || !subscription.active) return false;
      
      const plan = PLANS[subscription.planId?.toUpperCase()] || PLANS.BASIC;
      const currentUsers = db.subscriptions.getActiveUsersCount(tenantId);
      
      return currentUsers < plan.maxUsers;
    }
  },
  pendingRegistrations: {
    list: () => loadDBLocal().pendingRegistrations || [],
    create: (registration) => {
      const data = loadDBLocal();
      if (!data.pendingRegistrations) data.pendingRegistrations = [];
      const newRegistration = {
        ...registration,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        status: 'pending_payment'
      };
      data.pendingRegistrations.push(newRegistration);
      saveDBLocal(data);
      return newRegistration;
    },
    update: (id, updates) => {
      const data = loadDBLocal();
      if (!data.pendingRegistrations) return;
      const index = data.pendingRegistrations.findIndex(r => r.id === id);
      if (index > -1) {
        data.pendingRegistrations[index] = { ...data.pendingRegistrations[index], ...updates };
        saveDBLocal(data);
      }
    },
    approve: (id) => {
      const data = loadDBLocal();
      if (!data.pendingRegistrations) return null;
      const registration = data.pendingRegistrations.find(r => r.id === id);
      if (!registration) return null;
      
      // Criar usuário ADMIN
      const tenantId = registration.email.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const newUser = {
        id: crypto.randomUUID(),
        name: registration.name,
        email: registration.email,
        password: registration.password,
        role: 'admin',
        active: true,
        tenantId: tenantId
      };
      
      // Criar assinatura
      const subscription = {
        tenantId: tenantId,
        planId: registration.selectedPlan,
        status: 'active',
        paymentDate: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 dias
      };
      
      data.users.push(newUser);
      if (!data.subscriptions) data.subscriptions = [];
      data.subscriptions.push({
        ...subscription,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString()
      });
      
      // Marcar registro como aprovado
      registration.status = 'approved';
      registration.approvedAt = new Date().toISOString();
      
      saveDBLocal(data);
      return { user: newUser, subscription };
    },
    delete: (id) => {
      const data = loadDBLocal();
      if (!data.pendingRegistrations) return;
      data.pendingRegistrations = data.pendingRegistrations.filter(r => r.id !== id);
      saveDBLocal(data);
    }
  }
};

// Exportar planos
export const PLANS_CONFIG = PLANS;

