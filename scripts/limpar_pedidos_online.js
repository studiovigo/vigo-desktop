// Script para limpar pedidos online do localStorage (IndexedDB/localStorage)
// Execute este código no Console do navegador (F12)

(function clearOnlineOrders() {
  console.log('[Limpar Online] Iniciando limpeza...');
  
  // 1. Limpar do localStorage
  try {
    const userStr = localStorage.getItem('mozyc_pdv_current_user');
    if (!userStr) {
      console.error('[Limpar Online] Usuário não encontrado no localStorage');
      return;
    }
    
    const user = JSON.parse(userStr);
    const tenantId = user.email ? user.email.toLowerCase().replace(/[^a-z0-9]/g, '_') : null;
    const dbKey = tenantId ? `mozyc_pdv_db_v2_tenant_${tenantId}` : 'mozyc_pdv_db_v2';
    
    console.log('[Limpar Online] Chave do banco:', dbKey);
    
    const dbStr = localStorage.getItem(dbKey);
    if (!dbStr) {
      console.error('[Limpar Online] Banco de dados não encontrado');
      return;
    }
    
    const db = JSON.parse(dbStr);
    const countBefore = db.onlineOrders ? db.onlineOrders.length : 0;
    
    console.log(`[Limpar Online] Encontrados ${countBefore} pedidos online`);
    
    // Limpar array de pedidos online
    db.onlineOrders = [];
    
    // Salvar de volta
    localStorage.setItem(dbKey, JSON.stringify(db));
    
    console.log('[Limpar Online] ✅ Pedidos online limpos com sucesso!');
    console.log('[Limpar Online] Recarregue a página (F5) para ver as mudanças');
    
    return { success: true, removed: countBefore };
  } catch (error) {
    console.error('[Limpar Online] Erro:', error);
    return { success: false, error: error.message };
  }
})();
