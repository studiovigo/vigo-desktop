/**
 * Script para limpar a fila de vendas pendentes do localStorage
 * 
 * Execute este script no console do navegador (F12)
 * ou importe no código se necessário
 */

// Função para limpar a fila de vendas pendentes
function limparFilaVendas(storeId = null) {
  // Se não fornecer storeId, tenta obter do localStorage
  if (!storeId) {
    storeId = localStorage.getItem('store_id') || 'default';
  }
  
  const pendingKey = `pendingSales_${storeId}`;
  const pendingSales = JSON.parse(localStorage.getItem(pendingKey) || '[]');
  
  console.log(`📋 Vendas pendentes encontradas: ${pendingSales.length}`);
  
  if (pendingSales.length > 0) {
    console.log('📝 Detalhes das vendas pendentes:');
    pendingSales.forEach((sale, index) => {
      console.log(`  ${index + 1}. ID: ${sale.external_id}, Tentativas: ${sale.retries || 0}, Último erro: ${sale.last_error || 'N/A'}`);
    });
  }
  
  // Remover a fila
  localStorage.removeItem(pendingKey);
  console.log(`✅ Fila de vendas pendentes removida! (Chave: ${pendingKey})`);
  
  return {
    removido: true,
    chave: pendingKey,
    vendasRemovidas: pendingSales.length
  };
}

// Função para limpar TODAS as filas de vendas pendentes
function limparTodasFilas() {
  const keys = Object.keys(localStorage);
  const pendingKeys = keys.filter(k => k.startsWith('pendingSales_'));
  
  console.log(`📋 Encontradas ${pendingKeys.length} fila(s) de vendas pendentes`);
  
  let totalVendas = 0;
  pendingKeys.forEach(key => {
    const data = JSON.parse(localStorage.getItem(key) || '[]');
    totalVendas += data.length;
    console.log(`  - ${key}: ${data.length} vendas pendentes`);
    localStorage.removeItem(key);
  });
  
  console.log(`✅ Todas as filas foram removidas! (Total: ${totalVendas} vendas)`);
  
  return {
    removido: true,
    filasRemovidas: pendingKeys.length,
    vendasRemovidas: totalVendas
  };
}

// Função para apenas visualizar (não remover)
function visualizarFilaVendas(storeId = null) {
  if (!storeId) {
    storeId = localStorage.getItem('store_id') || 'default';
  }
  
  const pendingKey = `pendingSales_${storeId}`;
  const pendingSales = JSON.parse(localStorage.getItem(pendingKey) || '[]');
  
  console.log(`📋 Fila: ${pendingKey}`);
  console.log(`📊 Total de vendas pendentes: ${pendingSales.length}`);
  
  if (pendingSales.length > 0) {
    console.table(pendingSales.map(sale => ({
      external_id: sale.external_id,
      retries: sale.retries || 0,
      last_error: sale.last_error || 'N/A',
      last_attempt: sale.last_attempt || 'N/A'
    })));
  } else {
    console.log('✅ Nenhuma venda pendente!');
  }
  
  return pendingSales;
}

// Exportar funções (se estiver em um módulo)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    limparFilaVendas,
    limparTodasFilas,
    visualizarFilaVendas
  };
}

// Expor globalmente para uso no console
if (typeof window !== 'undefined') {
  window.limparFilaVendas = limparFilaVendas;
  window.limparTodasFilas = limparTodasFilas;
  window.visualizarFilaVendas = visualizarFilaVendas;
  
  console.log('✅ Scripts carregados! Use:');
  console.log('  - limparFilaVendas() - Limpar fila da loja atual');
  console.log('  - limparTodasFilas() - Limpar todas as filas');
  console.log('  - visualizarFilaVendas() - Ver vendas pendentes sem remover');
}

