// Serviço de Sincronização com API
import { fetchQuery, executeQuery, transaction, isUsingSQLite } from './database.js';
import { db } from './db.js'; // Fallback para localStorage

class SyncService {
  constructor(apiUrl) {
    this.apiUrl = apiUrl || '';
    this.isSyncing = false;
    this.syncInterval = null;
    this.lastSyncTime = null;
  }

  // Iniciar sincronização automática
  startAutoSync(intervalMinutes = 5) {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      this.syncPending();
    }, intervalMinutes * 60 * 1000);

    console.log(`Sincronização automática iniciada (intervalo: ${intervalMinutes} minutos)`);
  }

  // Parar sincronização automática
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Sincronizar dados pendentes
  async syncPending() {
    if (this.isSyncing || !this.apiUrl) {
      return;
    }

    this.isSyncing = true;
    this.lastSyncTime = new Date().toISOString();

    try {
      // Validar integridade antes de sincronizar
      const isValid = await this.validateBeforeSync();
      if (!isValid) {
        console.error('Validação de integridade falhou, sincronização cancelada');
        return;
      }

      // 1. Sincronizar vendas (PRIORIDADE MÁXIMA)
      await this.syncSales();
      
      // 2. Sincronizar movimentações de estoque
      await this.syncStockMovements();
      
      // 3. Sincronizar produtos
      await this.syncProducts();
      
      console.log('Sincronização concluída:', this.lastSyncTime);
    } catch (error) {
      console.error('Erro na sincronização:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  // Sincronizar vendas
  async syncSales() {
    if (!isUsingSQLite()) {
      // Fallback: sincronizar do localStorage
      const sales = db.sales.listFinalized().filter(s => !s.synced);
      for (const sale of sales.slice(0, 50)) {
        await this.syncSaleFromLocalStorage(sale);
      }
      return;
    }

    const pendingSales = fetchQuery(`
      SELECT * FROM sales 
      WHERE synced = 0 AND status = 'finalized'
      ORDER BY sale_date ASC
      LIMIT 50
    `);

    for (const sale of pendingSales) {
      try {
        // Buscar itens da venda
        const items = fetchQuery(`
          SELECT * FROM sale_items WHERE sale_id = ?
        `, [sale.id]);

        const saleData = {
          ...sale,
          items: items.map(item => ({
            product_id: item.product_id,
            product_code: item.product_code,
            quantity: item.quantity,
            unit_price: item.unit_price,
            subtotal: item.subtotal
          }))
        };

        // Enviar para API
        const response = await fetch(`${this.apiUrl}/api/sales`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.getAuthToken()}`
          },
          body: JSON.stringify(saleData)
        });

        if (response.ok) {
          const result = await response.json();
          
          // Marcar como sincronizado
          executeQuery(`
            UPDATE sales 
            SET synced = 1, sync_id = ?, last_sync_attempt = ?
            WHERE id = ?
          `, [result.id || result.sync_id, new Date().toISOString(), sale.id]);
          
          console.log(`Venda ${sale.id} sincronizada com sucesso`);
        } else {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`HTTP ${response.status}: ${errorData.message || 'Erro desconhecido'}`);
        }
      } catch (error) {
        // Incrementar tentativas
        const attempts = (sale.sync_attempts || 0) + 1;
        executeQuery(`
          UPDATE sales 
          SET sync_attempts = ?, last_sync_attempt = ?
          WHERE id = ?
        `, [attempts, new Date().toISOString(), sale.id]);

        // Se exceder 10 tentativas, marcar para revisão manual
        if (attempts > 10) {
          console.error(`Venda ${sale.id} não sincronizada após ${attempts} tentativas`);
          executeQuery(`
            UPDATE sales 
            SET status = 'sync_failed'
            WHERE id = ?
          `, [sale.id]);
        }
      }
    }
  }

  // Sincronizar movimentações de estoque
  async syncStockMovements() {
    if (!isUsingSQLite()) {
      return; // Não há movimentações no localStorage
    }

    const movements = fetchQuery(`
      SELECT sm.*, p.code as product_code
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      WHERE sm.synced = 0
      ORDER BY sm.created_at ASC
      LIMIT 100
    `);

    for (const movement of movements) {
      try {
        const response = await fetch(`${this.apiUrl}/api/stock/movements`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.getAuthToken()}`
          },
          body: JSON.stringify({
            product_id: movement.product_id,
            product_code: movement.product_code,
            movement_type: movement.movement_type,
            quantity: movement.quantity,
            previous_stock: movement.previous_stock,
            new_stock: movement.new_stock,
            reason: movement.reason,
            user_name: movement.user_name,
            sale_id: movement.sale_id,
            created_at: movement.created_at
          })
        });

        if (response.ok) {
          executeQuery('UPDATE stock_movements SET synced = 1 WHERE id = ?', [movement.id]);
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        console.error('Erro ao sincronizar movimento de estoque:', error);
      }
    }
  }

  // Sincronizar produtos
  async syncProducts() {
    if (!isUsingSQLite()) {
      return;
    }

    // Sincronizar apenas produtos modificados recentemente
    const products = fetchQuery(`
      SELECT * FROM products
      WHERE updated_at > datetime('now', '-7 days')
      ORDER BY updated_at DESC
      LIMIT 100
    `);

    for (const product of products) {
      try {
        const response = await fetch(`${this.apiUrl}/api/products`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.getAuthToken()}`
          },
          body: JSON.stringify(product)
        });

        if (response.ok) {
          // Produto sincronizado
        }
      } catch (error) {
        console.error('Erro ao sincronizar produto:', error);
      }
    }
  }

  // Validar integridade antes de sincronizar
  async validateBeforeSync() {
    if (!isUsingSQLite()) {
      return true;
    }

    try {
      // Verificar se há vendas sem itens
      const salesWithoutItems = fetchQuery(`
        SELECT s.id FROM sales s
        LEFT JOIN sale_items si ON s.id = si.sale_id
        WHERE si.id IS NULL AND s.status = 'finalized'
      `);

      if (salesWithoutItems.length > 0) {
        console.error('Vendas sem itens encontradas:', salesWithoutItems);
        return false;
      }

      // Verificar se há estoque negativo (pode ser aceitável em alguns casos)
      const negativeStock = fetchQuery(`
        SELECT id, code, stock FROM products WHERE stock < 0
      `);

      if (negativeStock.length > 0) {
        console.warn('Produtos com estoque negativo encontrados:', negativeStock);
        // Não bloqueia sincronização, apenas avisa
      }

      return true;
    } catch (error) {
      console.error('Erro na validação:', error);
      return false;
    }
  }

  // Obter token de autenticação (implementar conforme sua API)
  getAuthToken() {
    // Implementar lógica de autenticação
    // Pode ser salvo em settings ou localStorage
    return localStorage.getItem('api_auth_token') || '';
  }

  // Configurar URL da API
  setApiUrl(url) {
    this.apiUrl = url;
  }

  // Obter status da sincronização
  getStatus() {
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      apiUrl: this.apiUrl,
      hasInterval: this.syncInterval !== null
    };
  }

  // Sincronização manual de uma venda específica
  async syncSaleFromLocalStorage(sale) {
    try {
      const response = await fetch(`${this.apiUrl}/api/sales`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify(sale)
      });

      if (response.ok) {
        sale.synced = true;
        sale.sync_id = (await response.json()).id;
        // Atualizar no localStorage seria necessário aqui
        return { success: true };
      }
    } catch (error) {
      console.error('Erro ao sincronizar venda:', error);
      return { success: false, error: error.message };
    }
  }
}

// Instância singleton
let syncServiceInstance = null;

export function getSyncService(apiUrl) {
  if (!syncServiceInstance) {
    syncServiceInstance = new SyncService(apiUrl);
  }
  return syncServiceInstance;
}

export default SyncService;


