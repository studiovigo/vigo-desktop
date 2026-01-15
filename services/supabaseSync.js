// Serviço de sincronização bidirecional entre localStorage e Supabase
// Garante que todos os dados sejam sincronizados com store_id válido

import { supabase } from './supabaseClient';
import { supabaseDB } from './supabaseDB';
import { isUsingSQLite, executeQuery, fetchQuery } from './database';

/**
 * Resolve store_id de forma segura com fallback
 * Ordem de prioridade:
 * 1. currentUser.store_id
 * 2. currentUser.tenantId
 * 3. localStorage.mozyc_pdv_current_user.store_id
 * 4. localStorage.mozyc_pdv_current_user.tenantId
 * 5. "default_store" (fallback final)
 * 
 * NUNCA retorna null - sempre retorna um valor válido
 */
export function resolveStoreId(currentUser = null) {
  // Se currentUser foi passado, usar diretamente
  if (currentUser?.store_id) return currentUser.store_id;
  if (currentUser?.tenantId) return currentUser.tenantId;
  
  // Tentar buscar do localStorage
  try {
    const userStr = localStorage.getItem('mozyc_pdv_current_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user.store_id) return user.store_id;
      if (user.tenantId) return user.tenantId;
    }
  } catch (e) {
    console.error('[supabaseSync] Erro ao ler localStorage:', e);
  }
  
  // Fallback final - NUNCA retorna null
  return 'default_store';
}

// Variável global para log único (evita spam no console)
let hasLoggedStoreIdWarning = false;

/**
 * Obtém store_id e loga aviso apenas uma vez
 */
function getStoreIdWithWarning(currentUser = null) {
  const storeId = resolveStoreId(currentUser);
  
  if (!hasLoggedStoreIdWarning) {
    const userStr = localStorage.getItem('mozyc_pdv_current_user');
    const user = userStr ? JSON.parse(userStr) : {};
    
    if (!user.store_id && !user.tenantId) {
      console.warn('⚠️ store_id não estava definido — usando fallback:', storeId);
      hasLoggedStoreIdWarning = true;
    }
  }
  
  return storeId;
}

/**
 * Função auxiliar para converter produto local para Supabase
 * (Usa productMapper se disponível, senão faz conversão básica)
 */
function toSupabaseFormat(product) {
  // Tentar usar productMapper se disponível
  try {
    const { toSupabase } = require('./productMapper');
    if (toSupabase) {
      const mapped = toSupabase(product);
      return mapped;
    }
  } catch (e) {
    // productMapper não disponível, fazer conversão básica
  }
  
  // Conversão básica se productMapper não estiver disponível
  return {
    id: product.id,
    store_id: product.store_id, // Será sobrescrito se necessário
    name: product.name || '',
    sku: product.code || product.sku || '',
    price: product.salePrice || product.price || 0,
    stock: product.stock || product.stockQuantity || 0,
    updated_at: product.updated_at || new Date().toISOString(),
  };
}

/**
 * Função auxiliar para converter produto Supabase para local
 */
function fromSupabaseFormat(product) {
  // Tentar usar productMapper se disponível
  try {
    const { fromSupabase } = require('./productMapper');
    if (fromSupabase) {
      return fromSupabase(product);
    }
  } catch (e) {
    // productMapper não disponível, fazer conversão básica
  }
  
  // Conversão básica
  return {
    ...product,
    code: product.sku || product.code || '',
    salePrice: product.price || 0,
    stockQuantity: product.stock || 0,
  };
}

/**
 * Sincroniza produtos do localStorage para Supabase
 */
export async function pushProducts() {
  try {
    const currentUser = JSON.parse(localStorage.getItem('mozyc_pdv_current_user') || '{}');
    const storeId = getStoreIdWithWarning(currentUser);
    
    // Buscar produtos do localStorage (tentar diferentes chaves)
    let localProducts = [];
    try {
      const tenantId = currentUser.tenantId || currentUser.email?.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'default';
      const dbKey = `mozyc_pdv_db_v2_tenant_${tenantId}`;
      const dbData = JSON.parse(localStorage.getItem(dbKey) || localStorage.getItem('mozyc_pdv_db_v2') || '{}');
      localProducts = dbData.products || [];
    } catch (e) {
      console.warn('[supabaseSync] Erro ao ler produtos do localStorage:', e);
    }
    
    if (localProducts.length === 0) {
      console.log('[supabaseSync] Nenhum produto local para sincronizar');
      return { success: true, synced: 0 };
    }
    
    // Converter para formato Supabase
    const productsToSync = localProducts.map(p => {
      const supabaseProduct = toSupabaseFormat(p);
      return {
        ...supabaseProduct,
        store_id: storeId, // Garantir store_id sempre presente
      };
    });
    
    // Upsert no Supabase (insere ou atualiza)
    const { data, error } = await supabase
      .from('products')
      .upsert(productsToSync, { onConflict: 'id' })
      .select();
    
    if (error) {
      console.error('[supabaseSync] Erro ao sincronizar produtos:', error);
      throw error;
    }
    
    console.log(`[supabaseSync] ✅ ${data.length} produtos sincronizados`);
    return { success: true, synced: data.length };
  } catch (error) {
    console.error('[supabaseSync] Erro ao push produtos:', error);
    return { success: false, error };
  }
}

/**
 * Sincroniza produtos do Supabase para localStorage
 */
export async function pullProducts() {
  try {
    const currentUser = JSON.parse(localStorage.getItem('mozyc_pdv_current_user') || '{}');
    const storeId = getStoreIdWithWarning(currentUser);
    
    // Buscar produtos do Supabase
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', storeId);
    
    if (error) {
      console.error('[supabaseSync] Erro ao buscar produtos:', error);
      throw error;
    }
    
    if (!data || data.length === 0) {
      console.log('[supabaseSync] Nenhum produto no Supabase para sincronizar');
      return { success: true, synced: 0 };
    }
    
    // Converter para formato local
    const localProducts = data.map(fromSupabaseFormat);
    
    // Salvar no localStorage
    try {
      const tenantId = currentUser.tenantId || currentUser.email?.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'default';
      const dbKey = `mozyc_pdv_db_v2_tenant_${tenantId}`;
      const dbData = JSON.parse(localStorage.getItem(dbKey) || '{}');
      dbData.products = localProducts;
      localStorage.setItem(dbKey, JSON.stringify(dbData));
    } catch (e) {
      console.error('[supabaseSync] Erro ao salvar produtos no localStorage:', e);
    }
    
    console.log(`[supabaseSync] ✅ ${localProducts.length} produtos baixados`);
    return { success: true, synced: localProducts.length };
  } catch (error) {
    console.error('[supabaseSync] Erro ao pull produtos:', error);
    return { success: false, error };
  }
}

/**
 * Sincroniza vendas do localStorage para Supabase
 */
export async function pushSales() {
  try {
    const currentUser = JSON.parse(localStorage.getItem('mozyc_pdv_current_user') || '{}');
    const storeId = getStoreIdWithWarning(currentUser);
    
    // Buscar vendas do localStorage
    const localSales = JSON.parse(localStorage.getItem('sales') || '[]');
    
    if (localSales.length === 0) {
      console.log('[supabaseSync] Nenhuma venda local para sincronizar');
      return { success: true, synced: 0 };
    }
    
    // Preparar vendas para Supabase
    const salesToSync = localSales.map(sale => ({
      id: sale.id,
      store_id: storeId, // Garantir store_id sempre presente
      user_id: sale.user_id || currentUser.id,
      cash_session_id: sale.cash_session_id || sale.cashRegisterId,
      items: sale.items || [],
      total: sale.total_amount || sale.total || 0,
      payment_method: sale.payment_method || 'money',
      created_at: sale.sale_date || sale.created_at || new Date().toISOString(),
      status: sale.status || 'completed',
    }));
    
    // Upsert no Supabase
    const { data, error } = await supabase
      .from('sales')
      .upsert(salesToSync, { onConflict: 'id' })
      .select();
    
    if (error) {
      console.error('[supabaseSync] Erro ao sincronizar vendas:', error);
      throw error;
    }
    
    console.log(`[supabaseSync] ✅ ${data.length} vendas sincronizadas`);
    return { success: true, synced: data.length };
  } catch (error) {
    console.error('[supabaseSync] Erro ao push vendas:', error);
    return { success: false, error };
  }
}

/**
 * Sincroniza vendas do Supabase para localStorage
 */
export async function pullSales() {
  try {
    const currentUser = JSON.parse(localStorage.getItem('mozyc_pdv_current_user') || '{}');
    const storeId = getStoreIdWithWarning(currentUser);
    
    // Buscar vendas do Supabase
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(1000);
    
    if (error) {
      console.error('[supabaseSync] Erro ao buscar vendas:', error);
      throw error;
    }
    
    if (!data || data.length === 0) {
      console.log('[supabaseSync] Nenhuma venda no Supabase para sincronizar');
      return { success: true, synced: 0 };
    }
    
    // Salvar no localStorage
    localStorage.setItem('sales', JSON.stringify(data));
    
    console.log(`[supabaseSync] ✅ ${data.length} vendas baixadas`);
    return { success: true, synced: data.length };
  } catch (error) {
    console.error('[supabaseSync] Erro ao pull vendas:', error);
    return { success: false, error };
  }
}

/**
 * Sincroniza sessões de caixa
 */
export async function pushCashSession(session) {
  try {
    const currentUser = JSON.parse(localStorage.getItem('mozyc_pdv_current_user') || '{}');
    const storeId = getStoreIdWithWarning(currentUser);
    
    const { data, error } = await supabase
      .from('cash_sessions')
      .upsert({
        ...session,
        store_id: storeId, // Garantir store_id sempre presente
      }, { onConflict: 'id' })
      .select()
      .single();
    
    if (error) {
      console.error('[supabaseSync] Erro ao sincronizar sessão de caixa:', error);
      throw error;
    }
    
    console.log('[supabaseSync] ✅ Sessão de caixa sincronizada');
    return { success: true, data };
  } catch (error) {
    console.error('[supabaseSync] Erro ao push sessão de caixa:', error);
    return { success: false, error };
  }
}

/**
 * Sincronização completa (push + pull)
 */
export async function syncAll() {
  console.log('[supabaseSync] 🔄 Iniciando sincronização completa...');
  
  try {
    // Push primeiro (enviar dados locais)
    await pushProducts();
    await pushSales();
    
    // Pull depois (baixar dados remotos)
    await pullProducts();
    await pullSales();
    
    console.log('[supabaseSync] ✅ Sincronização completa finalizada');
    return { success: true };
  } catch (error) {
    console.error('[supabaseSync] ❌ Erro na sincronização completa:', error);
    return { success: false, error };
  }
}

export const supabaseSync = {
  pushProducts,
  pullProducts,
  pushSales,
  pullSales,
  pushCashSession,
  syncAll,
  resolveStoreId,
};

// =============================================================
// Fila offline unificada (SQLite quando disponível, fallback localStorage)
// =============================================================

const MAX_QUEUE_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 5 * 60 * 1000; // 5 minutos

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function computeBackoff(attempts) {
  return Math.min(BASE_BACKOFF_MS * Math.pow(2, attempts), MAX_BACKOFF_MS);
}

function getQueueKeys(storeId) {
  return {
    legacy: `pendingSales_${storeId || 'default'}`,
    modern: `pending_queue_${storeId || 'default'}`,
  };
}

function normalizeQueueItem(raw) {
  const parsedData = typeof raw?.data === 'string' ? JSON.parse(raw.data || '{}') : raw?.data || {};
  const payload = parsedData.sale || parsedData;

  return {
    id: raw?.id || raw?.entity_id || payload.external_id,
    external_id: raw?.entity_id || payload.external_id,
    sale: payload,
    store_id: payload.store_id,
    pos_id: payload.pos_id,
    cash_session_id: payload.cash_session_id,
    retries: raw?.attempts || payload.retries || 0,
    status: raw?.status || payload.status || 'pending',
    last_error: raw?.error_message || payload.last_error,
    last_attempt: raw?.last_attempt || payload.last_attempt,
    created_at: raw?.created_at || payload.created_at || new Date().toISOString(),
  };
}

function buildLocalQueueAdapter(storeId) {
  const keys = getQueueKeys(storeId);

  const load = () => {
    const modern = JSON.parse(localStorage.getItem(keys.modern) || '[]');
    const legacy = JSON.parse(localStorage.getItem(keys.legacy) || '[]');
    const merged = [...legacy, ...modern].map(normalizeQueueItem);
    // Deduplicar por external_id
    const seen = new Set();
    const unique = [];
    for (const item of merged) {
      if (item.external_id && !seen.has(item.external_id)) {
        seen.add(item.external_id);
        unique.push(item);
      }
    }
    return unique;
  };

  const save = (items) => {
    localStorage.setItem(keys.modern, JSON.stringify(items));
    // Limpar fila legada para evitar divergência
    localStorage.removeItem(keys.legacy);
  };

  return {
    load,
    remove: (externalId) => {
      const items = load().filter((item) => item.external_id !== externalId);
      save(items);
    },
    upsert: (item) => {
      const items = load();
      const idx = items.findIndex((i) => i.external_id === item.external_id);
      if (idx >= 0) items[idx] = item; else items.push(item);
      save(items);
    },
    count: () => load().filter((i) => i.status === 'pending' || i.status === 'syncing').length,
    loadPending: () => load().filter((i) => i.status === 'pending' || i.status === 'syncing'),
  };
}

function buildSQLiteQueueAdapter(storeId) {
  const loadRows = () => {
    const rows = fetchQuery(
      "SELECT * FROM sync_queue WHERE entity_type = ? ORDER BY created_at ASC",
      ['sale']
    );
    return rows.map(normalizeQueueItem);
  };

  return {
    load: loadRows,
    loadPending: () => loadRows().filter((i) => i.status === 'pending' || i.status === 'syncing'),
    remove: (externalId) => {
      executeQuery('DELETE FROM sync_queue WHERE id = ? OR entity_id = ?', [externalId, externalId]);
    },
    upsert: (item) => {
      executeQuery(
        `INSERT INTO sync_queue (id, entity_type, entity_id, action, data, attempts, last_attempt, status, error_message, created_at)
         VALUES (?, 'sale', ?, 'create', ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
         ON CONFLICT(id) DO UPDATE SET
           data = excluded.data,
           attempts = excluded.attempts,
           last_attempt = excluded.last_attempt,
           status = excluded.status,
           error_message = excluded.error_message`,
        [
          item.external_id,
          item.external_id,
          JSON.stringify({ ...item.sale, external_id: item.external_id, store_id: item.store_id, pos_id: item.pos_id, cash_session_id: item.cash_session_id }),
          item.retries || 0,
          item.last_attempt || new Date().toISOString(),
          item.status || 'pending',
          item.last_error || null,
          item.created_at,
        ]
      );
    },
    count: () => {
      const rows = fetchQuery("SELECT COUNT(1) as c FROM sync_queue WHERE entity_type = 'sale' AND status IN ('pending','syncing')");
      return rows?.[0]?.c || 0;
    },
  };
}

function getQueueAdapter(storeId) {
  try {
    if (isUsingSQLite()) {
      return buildSQLiteQueueAdapter(storeId);
    }
  } catch (e) {
    // Se não conseguir usar SQLite, cai para localStorage
  }
  return buildLocalQueueAdapter(storeId);
}

export async function enqueuePendingSale({ sale, externalId, storeId, posId, cashSessionId, errorMessage }) {
  const resolvedStoreId = storeId || resolveStoreId();
  const payload = { ...sale, store_id: sale.store_id || resolvedStoreId, pos_id: posId || sale.pos_id, cash_session_id: cashSessionId || sale.cash_session_id };

  const item = normalizeQueueItem({
    entity_id: externalId,
    data: { ...payload, external_id: externalId, last_error: errorMessage, status: 'pending' },
    status: 'pending',
    attempts: 0,
    created_at: new Date().toISOString(),
  });

  const adapter = getQueueAdapter(resolvedStoreId);
  adapter.upsert(item);
  return item;
}

export async function getPendingSalesCount(storeId = null) {
  const adapter = getQueueAdapter(storeId || resolveStoreId());
  return adapter.count();
}

export async function syncPendingSalesQueue(storeId = null) {
  const currentStoreId = storeId || resolveStoreId();
  const adapter = getQueueAdapter(currentStoreId);
  const queue = adapter.loadPending();

  if (!queue || queue.length === 0) {
    return { synced: 0, errors: 0, conflicts: 0, pending: 0 };
  }

  let synced = 0;
  let errors = 0;
  let conflicts = 0;

  for (const item of queue) {
    if (!item.external_id || !item.sale) {
      adapter.remove(item.external_id);
      continue;
    }

    if (!item.sale.store_id) {
      item.sale.store_id = currentStoreId;
    }

    if (item.retries >= MAX_QUEUE_ATTEMPTS) {
      adapter.upsert({ ...item, status: 'failed', last_error: item.last_error || 'Max attempts reached' });
      errors++;
      continue;
    }

    const backoff = computeBackoff(item.retries || 0);
    await wait(backoff);

    try {
      const result = await supabaseDB.sales.callCreateSaleAtomic(item.sale, item.external_id);

      if (result?.status === 'ok' || result?.status === 'already_exists') {
        adapter.remove(item.external_id);
        synced++;
      } else if (result?.status === 'insufficient_stock') {
        adapter.upsert({ ...item, status: 'conflict', last_error: result.message, retries: item.retries + 1, last_attempt: new Date().toISOString() });
        conflicts++;
      } else {
        adapter.upsert({ ...item, status: 'pending', retries: (item.retries || 0) + 1, last_error: result?.message || 'Erro desconhecido', last_attempt: new Date().toISOString() });
        errors++;
      }
    } catch (error) {
      adapter.upsert({ ...item, status: 'pending', retries: (item.retries || 0) + 1, last_error: error.message || 'Erro de conexão', last_attempt: new Date().toISOString() });
      errors++;
    }
  }

  return { synced, errors, conflicts, pending: adapter.count() };
}

let pendingSalesInterval = null;

export function startPendingSalesWorker({ intervalMs = 30000, onUpdate } = {}) {
  if (pendingSalesInterval) {
    clearInterval(pendingSalesInterval);
  }

  const tick = async () => {
    const summary = await syncPendingSalesQueue();
    if (onUpdate) {
      const count = await getPendingSalesCount();
      onUpdate({ count, summary });
    }
  };

  // Executa uma vez imediatamente
  tick();

  pendingSalesInterval = setInterval(tick, intervalMs);

  return () => {
    if (pendingSalesInterval) {
      clearInterval(pendingSalesInterval);
      pendingSalesInterval = null;
    }
  };
}

