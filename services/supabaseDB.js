// Serviço de integração Supabase - Interface compatível com db.js
// Permite usar Supabase mantendo compatibilidade com código existente

import { supabase } from './supabaseClient';

/**
 * Serviço Supabase que replica a interface do db.js
 * Permite migração gradual sem quebrar código existente
 */

// Helper para obter store_id do usuário atual com fallback seguro
// Usa resolveStoreId do supabaseSync para garantir sempre um valor válido
import { resolveStoreId } from './supabaseSync';

const getCurrentStoreId = () => {
  return resolveStoreId(); // Sempre retorna um valor válido (nunca null)
};

// Helper para obter user_id do usuário atual
const getCurrentUserId = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || null;
  } catch (e) {
    console.error('Erro ao obter user_id:', e);
    return null;
  }
};

// Helper para recuperar store_id real quando está como 'default_store'
const getActualStoreId = async () => {
  let storeId = getCurrentStoreId();
  
  // Se storeId é default_store, tentar recuperar o real
  if (storeId === 'default_store') {
    console.log('[supabaseDB] Tentando recuperar store_id real...');
    const { data: allProducts, error } = await supabase
      .from('products')
      .select('store_id')
      .limit(1);
    
    if (!error && allProducts && allProducts.length > 0) {
      storeId = allProducts[0].store_id;
      console.log('[supabaseDB] Store_id recuperado:', storeId);
    }
  }
  
  return storeId;
};

export const supabaseDB = {
  // ============================================
  // PRODUTOS
  // ============================================
  products: {
    list: async () => {
      let storeId = getCurrentStoreId();
      console.log('[supabaseDB.products.list] Buscando produtos com store_id:', storeId);
      
      // Se storeId é default_store, recuperar o real
      if (storeId === 'default_store') {
        storeId = await getActualStoreId();
      }
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', storeId)
        .order('name', { ascending: true });
      
      if (error) {
        console.error('[supabaseDB.products.list] Erro ao listar produtos:', error);
        return [];
      }
      
      // Debug: Se não encontrou produtos e não é default_store, tentar listar TODOS para ver quais existem
      if ((!data || data.length === 0) && storeId !== 'default_store') {
        console.warn('[supabaseDB.products.list] Nenhum produto encontrado para store_id:', storeId);
        console.warn('[supabaseDB.products.list] Listando TODOS os produtos para debug...');
        const { data: allProducts, error: allError } = await supabase
          .from('products')
          .select('id, name, store_id')
          .limit(20);
        
        if (!allError && allProducts) {
          console.warn('[supabaseDB.products.list] Produtos existentes no Supabase (primeiros 20):', 
            allProducts.map(p => ({ id: p.id, name: p.name, store_id: p.store_id }))
          );
        }
      }
      
      return data || [];
    },

    findByCode: async (code) => {
      let storeId = getCurrentStoreId();
      
      // Se storeId é default_store, recuperar o real
      if (storeId === 'default_store') {
        storeId = await getActualStoreId();
      }
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', storeId)
        .eq('sku', code)
        .maybeSingle();
      
      if (error) {
        console.error('[supabaseDB.products.findByCode] Erro ao buscar produto:', error);
        return null;
      }
      return data;
    },

    findById: async (id) => {
      let storeId = getCurrentStoreId();
      
      // Se storeId é default_store, recuperar o real
      if (storeId === 'default_store') {
        storeId = await getActualStoreId();
      }
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', storeId)
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar produto por ID:', error);
        return null;
      }
      return data;
    },

    create: async (product, user) => {
      // Verificar se usuário está autenticado
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Usuário não autenticado. Faça login primeiro.');
      }

      const storeId = getCurrentStoreId(); // Sempre retorna valor válido
      
      // Verificar se produto com mesmo sku já existe (evitar duplicatas)
      if (product.sku || product.code) {
        const existing = await supabaseDB.products.findByCode(product.sku || product.code);
        if (existing) {
          console.warn(`[supabaseDB.products.create] Produto com SKU ${product.sku || product.code} já existe, retornando existente`);
          return existing;
        }
      }
      
      // Garantir que store_id está sempre presente
      const productData = {
        store_id: storeId, // Sempre presente (nunca null)
        name: product.name || product.modelName || 'Produto sem nome',
        sku: product.sku || product.code || null,
        price: product.price || product.salePrice || product.sale_price || 0,
        stock: product.stock !== undefined && product.stock !== null ? product.stock : (product.stock_quantity || 0), // PRIORIZAR campo stock
        stock_quantity: product.stock_quantity !== undefined && product.stock_quantity !== null ? product.stock_quantity : (product.stock || 0), // Manter sincronizado
        cost_price: product.costPrice || product.cost_price || 0,
        sale_price: product.salePrice || product.sale_price || product.price || 0,
        description: product.description || null,
        image: product.image || null,
        active: product.active !== undefined ? product.active : true,
        model_name: product.modelName || product.model_name || null, // Nome do modelo para vincular
        color: product.color || null, // Cor do produto
        size: product.size || null, // Tamanho do produto
        tax_percentage: product.taxPercentage !== undefined && product.taxPercentage !== null ? parseFloat(product.taxPercentage) : (product.tax_percentage || 0), // Imposto
        ncm: product.ncm || null, // Código NCM do produto
        updated_at: new Date().toISOString(),
      };
      
      const { data, error } = await supabase
        .from('products')
        .insert(productData)
        .select()
        .single();
      
      if (error) {
        console.error('Erro ao criar produto:', error);
        throw error;
      }
      
      // Atualizar cache local
      if (data) {
        // PRIORIZAR campo stock (coluna principal)
        const stockValue = data.stock !== undefined && data.stock !== null ? data.stock : (data.stock_quantity || 0);
        await supabaseDB.updateLocalCacheStock(data.id, stockValue);
      }
      
      return data;
    },

    update: async (id, updates, user) => {
      let storeId = getCurrentStoreId();
      
      // Se storeId é default_store, recuperar o real
      if (storeId === 'default_store') {
        storeId = await getActualStoreId();
      }
      
      // Garantir que store_id está sempre presente nos updates
      const updatesWithStoreId = {
        ...updates,
        store_id: storeId, // Sempre presente
        updated_at: new Date().toISOString(),
      };
      
      // Garantir que model_name, color, size sejam atualizados se fornecidos
      if (updates.modelName !== undefined) {
        updatesWithStoreId.model_name = updates.modelName;
        delete updatesWithStoreId.modelName; // Remover camelCase
      }
      if (updates.color !== undefined) {
        updatesWithStoreId.color = updates.color;
      }
      if (updates.size !== undefined) {
        updatesWithStoreId.size = updates.size;
      }
      // Garantir que tax_percentage e ncm sejam atualizados se fornecidos
      if (updates.taxPercentage !== undefined) {
        updatesWithStoreId.tax_percentage = parseFloat(updates.taxPercentage) || 0;
        delete updatesWithStoreId.taxPercentage; // Remover camelCase
      }
      if (updates.ncm !== undefined) {
        updatesWithStoreId.ncm = updates.ncm || null;
      }
      
      // Converter costPrice/salePrice (camelCase) para cost_price/sale_price (snake_case)
      if (updates.costPrice !== undefined) {
        updatesWithStoreId.cost_price = updates.costPrice;
        delete updatesWithStoreId.costPrice;
      }
      if (updates.salePrice !== undefined) {
        updatesWithStoreId.sale_price = updates.salePrice;
        delete updatesWithStoreId.salePrice;
      }
      
      // Garantir que stock_quantity também seja removido se houver stock em snake_case
      if (updates.stock !== undefined) {
        updatesWithStoreId.stock = updates.stock;
      }
      if (updates.stockQuantity !== undefined) {
        updatesWithStoreId.stock_quantity = updates.stockQuantity;
        delete updatesWithStoreId.stockQuantity; // Remover camelCase
      }
      
      // Remover qualquer campo camelCase que ainda possa estar presente
      const fieldsToRemove = [];
      Object.keys(updatesWithStoreId).forEach(key => {
        // Se a chave tem letra maiúscula (camelCase), é inválida para o Supabase
        if (/[A-Z]/.test(key)) {
          fieldsToRemove.push(key);
        }
      });
      fieldsToRemove.forEach(key => delete updatesWithStoreId[key]);
      
      const { data, error } = await supabase
        .from('products')
        .update(updatesWithStoreId)
        .eq('id', id)
        .eq('store_id', storeId) // Filtrar por store_id para segurança
        .select()
        .single();
      
      if (error) {
        console.error('Erro ao atualizar produto:', error);
        throw error;
      }
      
      // Atualizar cache local se estoque foi alterado
      if (updates.stock !== undefined || updates.stock_quantity !== undefined) {
        // PRIORIZAR campo stock (coluna principal)
        const newStock = updates.stock !== undefined && updates.stock !== null ? updates.stock : (updates.stock_quantity || 0);
        await supabaseDB.updateLocalCacheStock(id, newStock);
      }
      
      return data;
    },

    updateStock: async (id, newStock, user) => {
      // Atualizar ambos os campos: stock (principal) e stock_quantity (compatibilidade)
      return await supabaseDB.products.update(id, { 
        stock: newStock, // PRIORIZAR campo stock (coluna principal)
        stock_quantity: newStock // Manter sincronizado
      }, user);
    },

    delete: async (id, user) => {
      let storeId = getCurrentStoreId();
      
      // Se storeId é default_store, recuperar o real
      if (storeId === 'default_store') {
        storeId = await getActualStoreId();
      }
      
      console.log('[supabaseDB.products.delete] Deletando produto com id:', id, 'store_id:', storeId);
      
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)
        .eq('store_id', storeId);
      
      if (error) {
        console.error('[supabaseDB.products.delete] Erro ao deletar produto:', error);
        throw error;
      }
      
      console.log('[supabaseDB.products.delete] Produto deletado com sucesso:', id);
      return { success: true };
    },

    // Buscar produtos por model_name (para exclusão de modelos)
    // Tenta buscar por model_name se a coluna existir, caso contrário busca por nome que começa com o modelo
    listByModelName: async (modelName) => {
      let storeId = getCurrentStoreId();
      
      // Se storeId é default_store, recuperar o real
      if (storeId === 'default_store') {
        storeId = await getActualStoreId();
      }
      
      // Primeiro, tentar buscar por model_name (se a coluna existir)
      let { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', storeId)
        .eq('model_name', modelName);
      
      // Se der erro (coluna não existe) ou não encontrar nada, buscar por nome que começa com o modelo
      if (error || !data || data.length === 0) {
        console.log(`[listByModelName] Buscando produtos por nome que começa com "${modelName}"`);
        const { data: dataByName, error: errorByName } = await supabase
          .from('products')
          .select('*')
          .eq('store_id', storeId)
          .ilike('name', `${modelName}%`); // Busca produtos cujo nome começa com o nome do modelo
        
        if (errorByName) {
          console.error('Erro ao buscar produtos por nome:', errorByName);
          return [];
        }
        return dataByName || [];
      }
      
      return data || [];
    },

    // Atualizar produtos existentes para ter model_name, color, size baseado no nome
    // Extrai do nome do produto: "Bruna Marrom M" -> model_name="Bruna", color="Marrom", size="M"
    updateProductsModelFields: async () => {
      let storeId = getCurrentStoreId();
      
      // Se storeId é default_store, recuperar o real
      if (storeId === 'default_store') {
        storeId = await getActualStoreId();
      }
      
      // Buscar todos os produtos que não têm model_name
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name')
        .eq('store_id', storeId)
        .is('model_name', null);
      
      if (error) {
        console.error('[updateProductsModelFields] Erro ao buscar produtos:', error);
        return { updated: 0, errors: [] };
      }
      
      if (!products || products.length === 0) {
        console.log('[updateProductsModelFields] Nenhum produto precisa ser atualizado');
        return { updated: 0, errors: [] };
      }
      
      console.log(`[updateProductsModelFields] Encontrados ${products.length} produtos para atualizar`);
      
      const errors = [];
      let updated = 0;
      
      // Atualizar cada produto
      for (const product of products) {
        if (!product.name) continue;
        
        // Extrair model_name, color, size do nome
        // Formato esperado: "Modelo Cor Tamanho" (ex: "Bruna Marrom M")
        const parts = product.name.trim().split(/\s+/);
        let modelName = parts[0] || null;
        let color = null;
        let size = null;
        
        // Cores comuns
        const colors = ['Preto', 'Branco', 'Verde', 'Azul', 'Vermelho', 'Amarelo', 'Rosa', 'Cinza', 'Marrom', 'Bege', 'Roxo', 'Laranja'];
        // Tamanhos comuns
        const sizes = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG', 'XXXG'];
        
        // Tentar identificar cor e tamanho
        for (let i = 1; i < parts.length; i++) {
          const part = parts[i];
          if (colors.includes(part) && !color) {
            color = part;
          } else if (sizes.includes(part) && !size) {
            size = part;
          }
        }
        
        // Se não encontrou cor/tamanho, tentar padrões alternativos
        if (!color && parts.length > 1) {
          // Pode ser que a cor seja a segunda parte
          color = parts[1];
        }
        if (!size && parts.length > 2) {
          // Pode ser que o tamanho seja a última parte
          size = parts[parts.length - 1];
        }
        
        // Atualizar produto no Supabase
        const updates = {};
        if (modelName) updates.model_name = modelName;
        if (color) updates.color = color;
        if (size) updates.size = size;
        
        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from('products')
            .update(updates)
            .eq('id', product.id)
            .eq('store_id', storeId);
          
          if (updateError) {
            console.error(`[updateProductsModelFields] Erro ao atualizar produto ${product.id}:`, updateError);
            errors.push({ productId: product.id, productName: product.name, error: updateError.message });
          } else {
            updated++;
            console.log(`[updateProductsModelFields] ✓ Produto atualizado: ${product.name} -> model_name="${modelName}", color="${color}", size="${size}"`);
          }
        }
      }
      
      console.log(`[updateProductsModelFields] Concluído: ${updated} produtos atualizados, ${errors.length} erros`);
      return { updated, errors };
    },
  },

  // ============================================
  // VENDAS
  // ============================================
  sales: {
    // Normaliza o formato das vendas vindas do Supabase para o formato esperado pelo app
    // (muitos trechos do App.jsx usam sale.sale_date e sale.total_amount)
    _normalizeSale: (row) => {
      if (!row) return row;
      const normalized = { ...row };
      // Data: no Supabase geralmente vem como created_at; no app antigo é sale_date
      normalized.sale_date = normalized.sale_date || normalized.created_at || normalized.date || null;
      // Total: alguns schemas usam total_amount; outros usam total
      normalized.total_amount =
        normalized.total_amount ??
        normalized.total ??
        normalized.totalValue ??
        0;
      // Itens: garantir array
      normalized.items = Array.isArray(normalized.items) ? normalized.items : (normalized.items || []);
      return normalized;
    },

    list: async () => {
      const storeId = getCurrentStoreId();
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Erro ao listar vendas:', error);
        return [];
      }
      return (data || []).map(supabaseDB.sales._normalizeSale);
    },

    listFinalized: async () => {
      const storeId = getCurrentStoreId();
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('store_id', storeId)
        .or('status.is.null,status.eq.finalized')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('[supabaseDB.sales.listFinalized] Erro ao listar vendas finalizadas:', error);
        // Fallback para método antigo se houver erro
        const all = await supabaseDB.sales.list();
        return all
          .map(supabaseDB.sales._normalizeSale)
          .filter(s => !s.status || s.status === 'finalized');
      }
      return (data || []).map(supabaseDB.sales._normalizeSale);
    },

    listCancelled: async () => {
      const all = await supabaseDB.sales.list();
      return all
        .map(supabaseDB.sales._normalizeSale)
        .filter(s => s.status === 'cancelled');
    },

    create: async (sale, user) => {
      const storeId = getCurrentStoreId();
      const userId = await getCurrentUserId();
      
      // Obter cash_session_id do caixa atual
      const cashStr = localStorage.getItem('currentCashRegister');
      let cashSessionId = null;
      if (cashStr) {
        try {
          const cash = JSON.parse(cashStr);
          // Buscar sessão de caixa aberta
          const { data: session } = await supabase
            .from('cash_sessions')
            .select('id')
            .eq('store_id', storeId)
            .eq('status', 'open') // Corrigido: usar 'open' em vez de 'aberto'
            .maybeSingle();
          
          cashSessionId = session?.id || null;
        } catch (e) {
          console.error('Erro ao obter cash_session_id:', e);
        }
      }
      
      const { data, error } = await supabase
        .from('sales')
        .insert({
          store_id: storeId, // Sempre presente
          user_id: userId,
          cash_session_id: cashSessionId,
          items: sale.items || [],
          // Compat: alguns schemas usam total_amount (preferido)
          total_amount: sale.total_amount || sale.total || 0,
          payment_method: sale.payment_method || 'money',
          status: sale.status || 'finalized', // Garantir status
        })
        .select()
        .single();
      
      if (error) {
        console.error('Erro ao criar venda:', error);
        throw error;
      }
      
      return supabaseDB.sales._normalizeSale(data);
    },

    /**
     * Cria uma venda de forma atômica usando a função RPC create_sale_atomic
     * Valida estoque e decrementa atomicamente antes de criar a venda
     * 
     * @param {Object} sale - Objeto da venda com items, total, payment_method, etc.
     * @param {string|UUID} external_id - ID externo para idempotência
     * @returns {Promise<Object>} { status: 'ok'|'already_exists'|'insufficient_stock'|'error', sale_id?, message? }
     */
    callCreateSaleAtomic: async (sale, external_id) => {
      const storeId = getCurrentStoreId();
      const userId = await getCurrentUserId();
      
      // Obter cash_session_id do caixa atual
      const cashStr = localStorage.getItem('currentCashRegister');
      let cashSessionId = null;
      if (cashStr) {
        try {
          const cash = JSON.parse(cashStr);
          // Buscar sessão de caixa aberta
          const { data: session } = await supabase
            .from('cash_sessions')
            .select('id')
            .eq('store_id', storeId)
            .eq('status', 'open')
            .maybeSingle();
          
          cashSessionId = session?.id || null;
        } catch (e) {
          console.error('Erro ao obter cash_session_id:', e);
        }
      }
      
      // Preparar payload para a função RPC
      // Garantir que todos os items tenham o campo 'code' (SKU) que é obrigatório
      const itemsWithSKU = (sale.items || []).map(item => {
        // Se não tiver code, tentar buscar do produto
        if (!item.code && !item.sku) {
          console.warn('[callCreateSaleAtomic] Item sem SKU:', item);
        }
        return {
          ...item,
          code: item.code || item.sku || null, // SKU é obrigatório para busca na RPC
        };
      });
      
      const salePayload = {
        items: itemsWithSKU,
        total: sale.total_amount || sale.total || 0,
        payment_method: sale.payment_method || 'money',
        user_id: userId,
        cash_session_id: cashSessionId,
        status: sale.status || 'finalized',
      };
      
      // Log dos items antes de enviar
      console.log('[callCreateSaleAtomic] Items preparados para RPC:', itemsWithSKU.map(i => ({
        product_id: i.product_id,
        code: i.code,
        sku: i.sku,
        quantity: i.quantity,
        name: i.name
      })));
      
      // Converter external_id para UUID se necessário
      // A função RPC espera UUID, então vamos garantir que seja válido
      let externalIdUuid = external_id;
      
      // Se for string, tentar validar como UUID
      if (typeof external_id === 'string') {
        // Regex para validar formato UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(external_id)) {
          // Se não for UUID válido, gerar um UUID determinístico baseado no external_id
          // Isso garante idempotência mesmo com strings não-UUID
          console.warn('[callCreateSaleAtomic] external_id não é UUID válido, usando como está:', external_id);
          // O Supabase pode aceitar string, mas vamos tentar manter como UUID se possível
          externalIdUuid = external_id;
        }
      }
      
      try {
        console.log('[callCreateSaleAtomic] Chamando RPC com:', {
          sale_payload: salePayload,
          external_id: externalIdUuid,
          store_id: storeId
        });
        
        // Chamar função RPC create_sale_atomic
        const { data, error } = await supabase.rpc('create_sale_atomic', {
          sale_payload: salePayload,
          external_id: externalIdUuid,
          store_id: storeId, // Sempre presente
        });
        
        console.log('[callCreateSaleAtomic] Resposta da RPC:', { data, error });
        
        if (error) {
          console.error('[callCreateSaleAtomic] Erro na RPC:', error);
          console.error('[callCreateSaleAtomic] Detalhes do erro:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          
          // Verificar se é erro de função não encontrada
          if (error.message && (
            error.message.includes('Could not find the function') ||
            error.message.includes('function') && error.message.includes('does not exist') ||
            error.message.includes('schema cache')
          )) {
            return {
              status: 'error',
              message: 'A função RPC create_sale_atomic não foi encontrada. Execute sql/forcar_recriar_rpc.sql e depois sql/create_sale_atomic.sql no Supabase SQL Editor.',
              error_code: '42883',
              error_details: error,
              hint: 'A função precisa ser recriada no banco de dados.'
            };
          }
          
          return {
            status: 'error',
            message: error.message || 'Erro ao criar venda atomicamente',
            error_details: error
          };
        }
        
        // Processar resposta da RPC
        // A RPC retorna JSONB, então data pode ser um objeto ou string JSON
        let responseData = data;
        if (typeof data === 'string') {
          try {
            responseData = JSON.parse(data);
          } catch (e) {
            console.error('[callCreateSaleAtomic] Erro ao parsear resposta JSON:', e);
          }
        }
        
        // Log detalhado da estrutura
        console.log('[callCreateSaleAtomic] Dados processados:', responseData);
        console.log('[callCreateSaleAtomic] Tipo:', typeof responseData);
        console.log('[callCreateSaleAtomic] Keys:', responseData ? Object.keys(responseData) : null);
        console.log('[callCreateSaleAtomic] JSON completo:', JSON.stringify(responseData, null, 2));
        
        // Verificar se responseData é válido
        if (!responseData) {
          console.error('[callCreateSaleAtomic] responseData é null ou undefined');
          return {
            status: 'error',
            message: 'Resposta vazia da função RPC',
            data: data,
          };
        }
        
        // Verificar se tem status diretamente
        if (responseData.status) {
          // Se erro retornado pela RPC
          if (responseData.status === 'error') {
            const errorMessage = responseData.message || 'Erro desconhecido na RPC';
            const errorCode = responseData.error_code || null;
            
            console.error('[callCreateSaleAtomic] Erro retornado pela RPC:', {
              message: errorMessage,
              error_code: errorCode,
              data: responseData
            });
            
            return {
              status: 'error',
              message: errorMessage,
              error_code: errorCode,
              data: responseData
            };
          }
          
          // Se estoque insuficiente
          if (responseData.status === 'insufficient_stock') {
            return {
              status: 'insufficient_stock',
              message: responseData.message || 'Estoque insuficiente',
              product_id: responseData.product_id,
              available_stock: responseData.available_stock,
              required_quantity: responseData.required_quantity,
            };
          }
          
          // Sucesso - venda criada ou já existe (idempotência)
          // IMPORTANTE: Mesmo quando a venda já existe, o estoque foi atualizado
          if (responseData.status === 'ok') {
            // Verificar se tem sale_id (pode ser null se a venda já existia)
            const saleId = responseData.sale_id || responseData.saleId || null;
            const externalId = responseData.external_id || responseData.externalId || externalIdUuid;
            
            if (saleId) {
              return {
                status: 'ok',
                sale_id: saleId,
                external_id: externalId,
                message: responseData.message || 'Venda processada com sucesso',
              };
            } else {
              // Se não tem sale_id, pode ser que a estrutura seja diferente
              console.warn('[callCreateSaleAtomic] Status ok mas sem sale_id, tentando buscar na resposta');
            }
          }
        }
        
        // Tentar verificar se tem sale_id diretamente (mesmo sem status)
        if (responseData.sale_id || responseData.saleId) {
          const saleId = responseData.sale_id || responseData.saleId;
          const externalId = responseData.external_id || responseData.externalId || externalIdUuid;
          console.log('[callCreateSaleAtomic] Resposta sem status mas com sale_id, tratando como sucesso');
          return {
            status: 'ok',
            sale_id: saleId,
            external_id: externalId,
            message: responseData.message || 'Venda processada com sucesso',
          };
        }
        
        // Tentar verificar se é um objeto com estrutura aninhada
        // Às vezes o Supabase retorna { data: { status: 'ok', ... } }
        if (responseData.data && typeof responseData.data === 'object') {
          const nestedData = responseData.data;
          if (nestedData.status === 'ok' && nestedData.sale_id) {
            console.log('[callCreateSaleAtomic] Resposta aninhada encontrada, processando...');
            return {
              status: 'ok',
              sale_id: nestedData.sale_id,
              external_id: nestedData.external_id || externalIdUuid,
              message: nestedData.message || 'Venda processada com sucesso',
            };
          }
        }
        
        // Se não tem status nem sale_id, mas tem outras propriedades que indicam sucesso
        // Verificar se tem propriedades que indicam que a venda foi processada
        const hasSuccessIndicators = responseData.id || responseData.saleId || 
                                     responseData.message?.toLowerCase().includes('sucesso') ||
                                     responseData.message?.toLowerCase().includes('criada');
        
        if (hasSuccessIndicators) {
          console.log('[callCreateSaleAtomic] Indicadores de sucesso encontrados, tratando como sucesso');
          return {
            status: 'ok',
            sale_id: responseData.id || responseData.saleId || responseData.sale_id,
            external_id: responseData.external_id || responseData.externalId || externalIdUuid,
            message: responseData.message || 'Venda processada com sucesso',
          };
        }
        
        // Resposta inesperada - log detalhado para debug
        console.error('[callCreateSaleAtomic] Resposta inesperada da RPC:', {
          data: responseData,
          tipo: typeof responseData,
          keys: responseData ? Object.keys(responseData) : null,
          json: JSON.stringify(responseData, null, 2),
          valores: responseData ? Object.entries(responseData).map(([k, v]) => `${k}: ${typeof v} = ${JSON.stringify(v)}`) : null
        });
        return {
          status: 'error',
          message: 'Resposta inesperada da função RPC',
          data: responseData,
        };
      } catch (err) {
        console.error('[callCreateSaleAtomic] Erro inesperado:', err);
        return {
          status: 'error',
          message: err.message || 'Erro inesperado ao criar venda',
        };
      }
    },

    cancel: async (id, password, user) => {
      // TODO: Implementar validação de senha e cancelamento
      const storeId = getCurrentStoreId();
      
      const { data, error } = await supabase
        .from('sales')
        .update({ 
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('store_id', storeId)
        .select()
        .single();
      
      if (error) {
        console.error('Erro ao cancelar venda:', error);
        return { success: false, message: error.message };
      }
      
      return { success: true, message: 'Venda cancelada com sucesso' };
    },
  },

  // ============================================
  // CAIXA (CASH SESSIONS)
  // ============================================
  cashSessions: {
    create: async (openingValue, posId = null) => {
      const storeId = getCurrentStoreId();
      const userId = await getCurrentUserId();
      
      const { data, error } = await supabase
        .from('cash_sessions')
        .insert({
          store_id: storeId, // Sempre presente
          pos_id: posId,
          user_id: userId,
          opening_amount: openingValue,
          status: 'open', // Corrigido: usar 'open' em vez de 'aberto'
        })
        .select()
        .single();
      
      if (error) {
        console.error('Erro ao criar sessão de caixa:', error);
        throw error;
      }
      
      return data;
    },

    close: async (sessionId, closingAmount) => {
      const storeId = getCurrentStoreId();
      
      const { data, error } = await supabase
        .from('cash_sessions')
        .update({
          closed_at: new Date().toISOString(),
          closing_amount: closingAmount,
          status: 'closed',
        })
        .eq('id', sessionId)
        .eq('store_id', storeId)
        .select()
        .single();
      
      if (error) {
        console.error('Erro ao fechar sessão de caixa:', error);
        throw error;
      }
      
      return data;
    },

    getCurrent: async () => {
      const storeId = getCurrentStoreId();
      const userId = await getCurrentUserId();
      
      const { data, error } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('store_id', storeId)
        .eq('user_id', userId)
        .eq('status', 'open') // Corrigido: usar 'open' em vez de 'aberto'
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error('Erro ao buscar sessão atual:', error);
        return null;
      }
      
      return data;
    },
  },

  // ============================================
  // USUÁRIOS
  // ============================================
  users: {
    list: async () => {
      const storeId = getCurrentStoreId();
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('store_id', storeId);
      
      if (error) {
        console.error('Erro ao listar usuários:', error);
        return [];
      }
      return data || [];
    },
  },

  // ============================================
  // FUNÇÕES AUXILIARES
  // ============================================
  
  /**
   * Busca todos os produtos de uma loja específica
   * @param {string} store_id - ID da loja
   * @returns {Promise<Array>} Lista de produtos
   */
  getAllProducts: async (store_id) => {
    if (!store_id) {
      console.warn('[getAllProducts] store_id não fornecido, usando getCurrentStoreId()');
      store_id = getCurrentStoreId();
    }
    
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', store_id)
      .order('name', { ascending: true });
    
    if (error) {
      console.error('[getAllProducts] Erro ao buscar produtos:', error);
      return [];
    }
    
    return data || [];
  },

  /**
   * Atualiza o cache local (localStorage) com o estoque de um produto
   * Mantém sincronização entre Supabase e localStorage
   * 
   * @param {string|UUID} product_id - ID do produto
   * @param {number} qty - Nova quantidade (ou delta se negativo)
   * @returns {Promise<boolean>} true se atualizado com sucesso
   */
  updateLocalCacheStock: async (product_id, qty) => {
    try {
      // Buscar cache local de produtos
      const tenantId = getCurrentStoreId();
      const dbKey = `mozyc_pdv_db_v2_tenant_${tenantId}`;
      const dbStr = localStorage.getItem(dbKey);
      
      if (!dbStr) {
        // Se não existe cache, não há o que atualizar
        return false;
      }
      
      const db = JSON.parse(dbStr);
      
      // Procurar produto no cache local
      const productIndex = db.products?.findIndex(p => p.id === product_id);
      
      if (productIndex !== undefined && productIndex >= 0) {
        // Se qty é negativo, é um decremento (delta)
        // Se qty é positivo, é o novo valor absoluto
        if (qty < 0) {
          // Decremento: subtrair do estoque atual
          db.products[productIndex].stock = Math.max(0, (db.products[productIndex].stock || 0) + qty);
        } else {
          // Valor absoluto: definir novo estoque
          db.products[productIndex].stock = qty;
        }
        
        // Salvar cache atualizado
        localStorage.setItem(dbKey, JSON.stringify(db));
        
        console.log(`[updateLocalCacheStock] Estoque atualizado no cache local: produto ${product_id}, estoque: ${db.products[productIndex].stock}`);
        return true;
      } else {
        console.warn(`[updateLocalCacheStock] Produto ${product_id} não encontrado no cache local`);
        return false;
      }
    } catch (error) {
      console.error('[updateLocalCacheStock] Erro ao atualizar cache local:', error);
      return false;
    }
  },

  // ============================================
  // CUPONS
  // ============================================
  coupons: {
    list: async () => {
      const storeId = getCurrentStoreId();
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('[supabaseDB.coupons.list] Erro ao listar cupons:', error);
        return [];
      }
      return data || [];
    },

    findByCode: async (code) => {
      const storeId = getCurrentStoreId();
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('store_id', storeId)
        .eq('code', code)
        .eq('active', true)
        .maybeSingle();
      
      if (error) {
        console.error('[supabaseDB.coupons.findByCode] Erro ao buscar cupom:', error);
        return null;
      }
      return data;
    },

    create: async (coupon, user) => {
      const storeId = getCurrentStoreId();
      const userId = await getCurrentUserId();
      
      const { data, error } = await supabase
        .from('coupons')
        .insert({
          store_id: storeId,
          code: coupon.code,
          discount: coupon.discount,
          active: coupon.active !== undefined ? coupon.active : true,
        })
        .select()
        .single();
      
      if (error) {
        console.error('[supabaseDB.coupons.create] Erro ao criar cupom:', error);
        throw error;
      }
      
      console.log(`[supabaseDB.coupons.create] Cupom criado: ${data.code} (${data.id})`);
      return data;
    },

    update: async (id, updates, user) => {
      const storeId = getCurrentStoreId();
      
      const updateData = {};
      if (updates.code !== undefined) updateData.code = updates.code;
      if (updates.discount !== undefined) updateData.discount = updates.discount;
      if (updates.active !== undefined) updateData.active = updates.active;
      
      const { data, error } = await supabase
        .from('coupons')
        .update(updateData)
        .eq('id', id)
        .eq('store_id', storeId)
        .select()
        .single();
      
      if (error) {
        console.error('[supabaseDB.coupons.update] Erro ao atualizar cupom:', error);
        throw error;
      }
      
      console.log(`[supabaseDB.coupons.update] Cupom atualizado: ${data.code} (${data.id})`);
      return data;
    },

    delete: async (id, user) => {
      const storeId = getCurrentStoreId();
      
      const { error } = await supabase
        .from('coupons')
        .delete()
        .eq('id', id)
        .eq('store_id', storeId);
      
      if (error) {
        console.error('[supabaseDB.coupons.delete] Erro ao deletar cupom:', error);
        throw error;
      }
      
      console.log(`[supabaseDB.coupons.delete] Cupom deletado: ${id}`);
      return true;
    },
  },

  // ============================================
  // DESPESAS
  // ============================================
  expenses: {
    list: async () => {
      const storeId = getCurrentStoreId();
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('store_id', storeId)
        .order('date', { ascending: false });
      
      if (error) {
        console.error('[supabaseDB.expenses.list] Erro ao listar despesas:', error);
        return [];
      }
      return data || [];
    },

    create: async (expense, user) => {
      const storeId = getCurrentStoreId();
      const userId = await getCurrentUserId();
      
      const { data, error } = await supabase
        .from('expenses')
        .insert({
          store_id: storeId,
          description: expense.description,
          amount: expense.amount,
          date: expense.date,
          category: expense.category || null,
          created_by: userId,
        })
        .select()
        .single();
      
      if (error) {
        console.error('[supabaseDB.expenses.create] Erro ao criar despesa:', error);
        throw error;
      }
      
      console.log(`[supabaseDB.expenses.create] Despesa criada: ${data.description} (${data.id})`);
      return data;
    },

    update: async (id, updates, user) => {
      const storeId = getCurrentStoreId();
      
      const updateData = {};
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.amount !== undefined) updateData.amount = updates.amount;
      if (updates.date !== undefined) updateData.date = updates.date;
      if (updates.category !== undefined) updateData.category = updates.category;
      
      const { data, error } = await supabase
        .from('expenses')
        .update(updateData)
        .eq('id', id)
        .eq('store_id', storeId)
        .select()
        .single();
      
      if (error) {
        console.error('[supabaseDB.expenses.update] Erro ao atualizar despesa:', error);
        throw error;
      }
      
      console.log(`[supabaseDB.expenses.update] Despesa atualizada: ${data.description} (${data.id})`);
      return data;
    },

    delete: async (id, user) => {
      const storeId = getCurrentStoreId();
      
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id)
        .eq('store_id', storeId);
      
      if (error) {
        console.error('[supabaseDB.expenses.delete] Erro ao deletar despesa:', error);
        throw error;
      }
      
      console.log(`[supabaseDB.expenses.delete] Despesa deletada: ${id}`);
      return true;
    },
  },

  // ============================================
  // FECHAMENTOS DE CAIXA
  // ============================================
  closures: {
    list: async () => {
      const storeId = getCurrentStoreId();
      const { data, error } = await supabase
        .from('cash_closures')
        .select('*')
        .eq('store_id', storeId)
        .order('date', { ascending: false });
      
      if (error) {
        console.error('[supabaseDB.closures.list] Erro ao listar fechamentos:', error);
        return [];
      }
      return data || [];
    },

    getByDate: async (date) => {
      const storeId = getCurrentStoreId();
      const targetDate = new Date(date).toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('cash_closures')
        .select('*')
        .eq('store_id', storeId)
        .eq('date', targetDate)
        .maybeSingle();
      
      if (error) {
        console.error('[supabaseDB.closures.getByDate] Erro ao buscar fechamento:', error);
        return null;
      }
      return data;
    },

    getById: async (id) => {
      const storeId = getCurrentStoreId();
      
      const { data, error } = await supabase
        .from('cash_closures')
        .select('*')
        .eq('id', id)
        .eq('store_id', storeId)
        .maybeSingle();
      
      if (error) {
        console.error('[supabaseDB.closures.getById] Erro ao buscar fechamento:', error);
        return null;
      }
      return data;
    },

    create: async (closure, user) => {
      const storeId = getCurrentStoreId();
      const userId = await getCurrentUserId();
      const safeDate = (() => {
        const value = closure.date || closure.closureDate || new Date();
        const d = value instanceof Date ? value : new Date(value);
        return d.toISOString().split('T')[0];
      })();

      // Normalizar listas e contadores
      const sales = Array.isArray(closure.sales) ? closure.sales : (closure.sales || []);
      const cancelled = Array.isArray(closure.cancelled) ? closure.cancelled : (closure.cancelled || []);
      const expenses = Array.isArray(closure.expenses) ? closure.expenses : (closure.expenses || []);

      const totalSales = closure.total_sales ?? closure.totalSales ?? 0;
      const totalCosts = closure.total_costs ?? closure.totalCosts ?? 0;
      const totalExpenses = closure.total_expenses ?? closure.totalExpenses ?? 0;
      const totalDiscounts = closure.total_discounts ?? closure.totalDiscounts ?? 0;
      const openingAmount = closure.opening_amount ?? closure.openingAmount ?? 0;
      const grossProfit = closure.gross_profit ?? closure.grossProfit ?? (totalSales - totalCosts);
      const finalCashAmount = closure.final_cash_amount ?? closure.finalCashAmount ?? (openingAmount + totalSales - totalCosts);

      const payload = {
        store_id: storeId,
        cash_session_id: closure.cash_session_id || closure.cashSessionId || closure.cashRegisterId?.toString?.() || null,
        date: safeDate,
        opening_amount: openingAmount,
        total_sales: totalSales,
        total_costs: totalCosts,
        total_expenses: totalExpenses,
        total_discounts: totalDiscounts,
        gross_profit: grossProfit,
        final_cash_amount: finalCashAmount,
        payment_methods: closure.payment_methods || closure.paymentMethods || {},
        sales,
        cancelled,
        expenses,
        sales_count: closure.sales_count ?? closure.salesCount ?? sales.length,
        cancelled_count: closure.cancelled_count ?? closure.cancelledCount ?? cancelled.length,
        expenses_count: closure.expenses_count ?? closure.expensesCount ?? expenses.length,
        totals: closure.totals || {
          totalSales,
          totalCosts,
          totalExpenses,
          totalDiscounts,
          grossProfit,
          finalCashAmount,
          openingAmount,
        },
        pdf_path: closure.pdf_path || closure.pdfPath || null,
        created_by: userId,
      };

      const { data, error } = await supabase
        .from('cash_closures')
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error('[supabaseDB.closures.create] Erro ao criar fechamento:', error);
        throw error;
      }
      
      console.log(`[supabaseDB.closures.create] Fechamento criado: ${data.date} (${data.id})`);
      return data;
    },
  },
};

