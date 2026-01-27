// Serviço simples para conectar com Shopify (GraphQL + REST)
// Uso:
// import { setShopifyCredentials, loadStoredCredentials, graphql, getProductsREST } from './services/shopify'
// setShopifyCredentials({ store: 'minha-loja.myshopify.com', accessToken: 'shpat_xxx' })
// await graphql('{ shop { name } }')

const defaultConfig = {
  store: (import.meta.env.VITE_SHOPIFY_STORE) || '',
  accessToken: (import.meta.env.VITE_SHOPIFY_ACCESS_TOKEN) || '',
  apiVersion: (import.meta.env.VITE_SHOPIFY_API_VERSION) || '2024-01'
};

let runtimeConfig = { ...defaultConfig };

function normalizeStoreDomain(input) {
  if (!input) return '';
  let s = String(input).trim();
  // If full URL, extract hostname
  try {
    if (s.startsWith('http://') || s.startsWith('https://')) {
      const u = new URL(s);
      // Handle admin.shopify.com/store/<slug>
      if (u.hostname === 'admin.shopify.com') {
        const parts = u.pathname.split('/').filter(Boolean);
        const storeIdx = parts.indexOf('store');
        if (storeIdx > -1 && parts[storeIdx + 1]) {
          return `${parts[storeIdx + 1]}.myshopify.com`;
        }
        // Fallback: keep hostname (will fail) but better empty
        return '';
      }
      // Otherwise use hostname directly
      s = u.hostname;
    }
  } catch (_) {
    // ignore URL parse errors
  }
  // If only slug provided (no dots), convert to myshopify domain
  if (s && !s.includes('.')) {
    return `${s}.myshopify.com`;
  }
  // If already a domain, return as-is
  return s;
}

export function setShopifyCredentials({ store, accessToken, apiVersion } = {}) {
  if (store) runtimeConfig.store = normalizeStoreDomain(store);
  if (accessToken) runtimeConfig.accessToken = accessToken;
  if (apiVersion) runtimeConfig.apiVersion = apiVersion;
  try {
    localStorage.setItem('vigo_shopify_credentials', JSON.stringify(runtimeConfig));
  } catch (e) {
    // ignore storage errors
  }
}

export function loadStoredCredentials() {
  try {
    const s = localStorage.getItem('vigo_shopify_credentials');
    if (s) {
      const parsed = JSON.parse(s);
      runtimeConfig = { ...runtimeConfig, ...parsed };
      // normalize store after loading
      runtimeConfig.store = normalizeStoreDomain(runtimeConfig.store);
    }
  } catch (e) {
    // ignore
  }
  return runtimeConfig;
}

export function getShopifyConfig() {
  return runtimeConfig;
}

export function clearShopifyCredentials() {
  runtimeConfig = { ...defaultConfig };
  try { localStorage.removeItem('vigo_shopify_credentials'); } catch (e) {}
}

async function ensureConfigured() {
  if (!runtimeConfig.store || !runtimeConfig.accessToken) {
    // Try load from storage once
    loadStoredCredentials();
  }
  // Normalize in case env provided admin URL or slug
  runtimeConfig.store = normalizeStoreDomain(runtimeConfig.store);
  if (!runtimeConfig.store || !runtimeConfig.accessToken) {
    throw new Error('Credenciais Shopify não configuradas. Use setShopifyCredentials().');
  }
}

export async function graphql(query, variables = {}) {
  await ensureConfigured();
  const url = `https://${runtimeConfig.store}/admin/api/${runtimeConfig.apiVersion}/graphql.json`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': runtimeConfig.accessToken
    },
    body: JSON.stringify({ query, variables })
  });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json;
}


export async function getProductsREST(params = {}) {
  await ensureConfigured();
  // params: { limit }
  const limit = params.limit || 50;
  const url = `https://${runtimeConfig.store}/admin/api/${runtimeConfig.apiVersion}/products.json?limit=${limit}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'X-Shopify-Access-Token': runtimeConfig.accessToken }
  });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json;
}

export async function updateProductREST(productId, body = {}) {
  await ensureConfigured();
  const url = `https://${runtimeConfig.store}/admin/api/${runtimeConfig.apiVersion}/products/${productId}.json`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': runtimeConfig.accessToken
    },
    body: JSON.stringify({ product: body })
  });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json;
}

export async function updateVariantInventoryLevel(locationId, inventoryItemId, available) {
  // Uses InventoryLevel endpoint (REST)
  await ensureConfigured();
  const url = `https://${runtimeConfig.store}/admin/api/${runtimeConfig.apiVersion}/inventory_levels/set.json`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': runtimeConfig.accessToken
    },
    body: JSON.stringify({ location_id: locationId, inventory_item_id: inventoryItemId, available })
  });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json;
}

// Helper: exemplo rápido para sincronizar produtos ao seu DB local
export async function syncProductsExample(saveToLocalCallback) {
  const data = await getProductsREST({ limit: 250 });
  const products = data.products || [];
  if (typeof saveToLocalCallback === 'function') saveToLocalCallback(products);
  return products;
}

export default {
  setShopifyCredentials,
  loadStoredCredentials,
  getShopifyConfig,
  clearShopifyCredentials,
  graphql,
  getProductsREST,
  updateProductREST,
  updateVariantInventoryLevel,
  syncProductsExample
};
