import { format } from 'date-fns';

// Função para gerar PDF do fechamento de caixa mantendo o layout da página
export function generateClosurePDF(closure) {
  const formatCurrency = (v) => {
    try {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
    } catch (e) {
      return `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPaymentMethod = (method) => {
    const methods = {
      'money': 'Dinheiro',
      'pix_maquina': 'PIX (Máquina)',
      'pix_direto': 'PIX (Direto)',
      'debit': 'Cartão de Débito',
      'credit': 'Cartão de Crédito'
    };
    return methods[method] || method;
  };

  const closureDate = closure.date ? new Date(closure.date).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
  const closureTime = closure.created_at ? format(new Date(closure.created_at), "HH:mm") : "";
  const managerName = closure.created_by || 'Sistema';

  // Criar HTML do PDF mantendo o layout da página
  const pdfHTML = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fechamento de Caixa - ${closureDate}</title>
  <style>
    @media print {
      body { margin: 0; padding: 0; }
      .no-print { display: none; }
      @page {
        size: A4;
        margin: 15mm;
      }
    }
    body {
      font-family: 'Arial', sans-serif;
      margin: 0;
      padding: 20px;
      background: white;
      color: #333;
    }
    .container {
      max-width: 210mm;
      margin: 0 auto;
      background: white;
    }
    .header {
      background: linear-gradient(to right, #dbeafe, #dcfce7);
      padding: 20px;
      border-radius: 12px;
      margin-bottom: 20px;
      border: 1px solid #e5e7eb;
    }
    .header-title {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 5px;
    }
    .header-date {
      font-size: 24px;
      font-weight: bold;
      color: #111827;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 20px;
    }
    .summary-card {
      padding: 16px;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
    }
    .summary-card-blue {
      background: #dbeafe;
    }
    .summary-card-green {
      background: #dcfce7;
    }
    .summary-card-red {
      background: #fee2e2;
    }
    .summary-card-orange {
      background: #fed7aa;
    }
    .summary-card-purple {
      background: #e9d5ff;
      grid-column: span 4;
      border: 2px solid #c084fc;
    }
    .summary-label {
      font-size: 11px;
      color: #6b7280;
      margin-bottom: 8px;
    }
    .summary-value {
      font-size: 20px;
      font-weight: bold;
    }
    .summary-value-large {
      font-size: 28px;
    }
    .summary-value-blue {
      color: #2563eb;
    }
    .summary-value-green {
      color: #16a34a;
    }
    .summary-value-red {
      color: #dc2626;
    }
    .summary-value-orange {
      color: #ea580c;
    }
    .summary-value-purple {
      color: #9333ea;
    }
    .summary-calc {
      font-size: 10px;
      color: #6b7280;
      margin-top: 8px;
    }
    .section-title {
      font-size: 18px;
      font-weight: bold;
      margin: 24px 0 12px 0;
      color: #111827;
    }
    .payment-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    .payment-card {
      padding: 12px;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      background: #f9fafb;
    }
    .payment-label {
      font-size: 10px;
      color: #6b7280;
      margin-bottom: 4px;
    }
    .payment-value {
      font-size: 16px;
      font-weight: bold;
      color: #111827;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    .stat-card {
      padding: 12px;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      background: #f9fafb;
    }
    .stat-label {
      font-size: 10px;
      color: #6b7280;
      margin-bottom: 4px;
    }
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #111827;
    }
    .stat-value-red {
      color: #dc2626;
    }
    .stat-value-green {
      color: #16a34a;
    }
    .sales-list {
      max-height: 300px;
      overflow-y: auto;
      margin-bottom: 20px;
    }
    .sale-item {
      padding: 12px;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      background: #f9fafb;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .sale-info {
      flex: 1;
    }
    .sale-id {
      font-size: 12px;
      font-weight: bold;
      color: #111827;
      margin-bottom: 4px;
    }
    .sale-details {
      font-size: 10px;
      color: #6b7280;
    }
    .sale-amount {
      font-size: 18px;
      font-weight: bold;
      color: #16a34a;
    }
    .cancelled-item {
      background: #fee2e2;
      border-color: #fca5a5;
    }
    .cancelled-amount {
      color: #dc2626;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 10px;
      color: #6b7280;
    }
    .button-print {
      text-align: center;
      margin: 20px;
    }
    button {
      padding: 10px 20px;
      font-size: 14px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
    }
    button:hover {
      background: #0056b3;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-title">Data do Fechamento</div>
      <div class="header-date">${closureDate}${closureTime ? ' às ' + closureTime : ''}</div>
      <div style="font-size: 12px; color: #6b7280; margin-top: 8px;">Fechado por: ${managerName}</div>
    </div>

    <div class="summary-grid">
      <div class="summary-card summary-card-blue">
        <div class="summary-label">Abertura do Caixa</div>
        <div class="summary-value summary-value-blue">${formatCurrency(closure.openingAmount || 0)}</div>
      </div>
      <div class="summary-card summary-card-green">
        <div class="summary-label">Total de Vendas</div>
        <div class="summary-value summary-value-green">${formatCurrency(closure.totalSales || 0)}</div>
      </div>
      <div class="summary-card summary-card-red">
        <div class="summary-label">Total de Custos</div>
        <div class="summary-value summary-value-red">${formatCurrency(closure.totalCosts || 0)}</div>
      </div>
      <div class="summary-card summary-card-orange">
        <div class="summary-label">Total de Despesas</div>
        <div class="summary-value summary-value-orange">${formatCurrency(closure.totalExpenses || 0)}</div>
      </div>
      <div class="summary-card summary-card-blue">
        <div class="summary-label">Lucro Bruto</div>
        <div class="summary-value summary-value-blue">${formatCurrency(closure.grossProfit || 0)}</div>
      </div>
      ${closure.finalCashAmount !== undefined ? `
      <div class="summary-card summary-card-purple">
        <div class="summary-label">Valor Final no Caixa</div>
        <div class="summary-value summary-value-large summary-value-purple">${formatCurrency(closure.finalCashAmount || 0)}</div>
        <div class="summary-calc">
          Cálculo: Abertura (${formatCurrency(closure.openingAmount || 0)}) + 
          Vendas (${formatCurrency(closure.totalSales || 0)}) - 
          Despesas (${formatCurrency(closure.totalExpenses || 0)}) = 
          ${formatCurrency(closure.finalCashAmount || 0)}
        </div>
      </div>
      ` : ''}
    </div>

    ${Object.keys(closure.paymentMethods || {}).length > 0 ? `
    <div class="section-title">Métodos de Pagamento</div>
    <div class="payment-grid">
      ${Object.entries(closure.paymentMethods || {}).map(([method, amount]) => `
        <div class="payment-card">
          <div class="payment-label">${formatPaymentMethod(method)}</div>
          <div class="payment-value">${formatCurrency(amount)}</div>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <div class="section-title">Estatísticas</div>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Vendas Realizadas</div>
        <div class="stat-value">${closure.sales?.length || 0}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Vendas Canceladas</div>
        <div class="stat-value stat-value-red">${closure.cancelled?.length || 0}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Descontos Aplicados</div>
        <div class="stat-value stat-value-green">${formatCurrency(closure.totalDiscounts || 0)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Despesas Registradas</div>
        <div class="stat-value">${closure.expenses?.length || 0}</div>
      </div>
    </div>

    ${closure.sales && closure.sales.length > 0 ? `
    <div class="section-title">Vendas do Dia (${closure.sales.length})</div>
    <div class="sales-list">
      ${closure.sales.map(sale => `
        <div class="sale-item" style="display: block; padding: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
            <div class="sale-info" style="flex: 1;">
              <div class="sale-id">Venda #${sale.id?.slice(0, 8).toUpperCase() || 'N/A'}</div>
              <div class="sale-details">
                ${sale.sale_date || sale.created_at ? new Date(sale.sale_date || sale.created_at).toLocaleDateString('pt-BR') + ' ' + new Date(sale.sale_date || sale.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
              </div>
              <div class="sale-details" style="margin-top: 4px;">
                <strong>Vendedor:</strong> ${sale.user_name || sale.created_by || 'N/A'}
              </div>
              <div class="sale-details" style="margin-top: 4px;">
                <strong>Pagamento:</strong> ${formatPaymentMethod(sale.payment_method || 'money')}
              </div>
            </div>
            <div class="sale-amount">${formatCurrency(sale.total_amount || 0)}</div>
          </div>
          ${sale.items && sale.items.length > 0 ? `
          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
            <div style="font-size: 11px; color: #6b7280; font-weight: bold; margin-bottom: 6px;">Itens:</div>
            ${sale.items.map(item => `
              <div style="display: flex; justify-content: space-between; font-size: 10px; color: #374151; margin-bottom: 4px;">
                <span>${item.quantity}x ${item.product_name || item.name || 'Produto'}</span>
                <span style="font-weight: 600;">${formatCurrency((item.unit_price || item.price || 0) * item.quantity)}</span>
              </div>
            `).join('')}
          </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${closure.cancelled && closure.cancelled.length > 0 ? `
    <div class="section-title" style="color: #dc2626;">Cancelamentos do Dia (${closure.cancelled.length})</div>
    <div class="sales-list">
      ${closure.cancelled.map(sale => `
        <div class="sale-item cancelled-item" style="display: block; padding: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
            <div class="sale-info" style="flex: 1;">
              <div class="sale-id">Venda #${sale.id?.slice(0, 8).toUpperCase() || 'N/A'}</div>
              <div class="sale-details">
                ${sale.sale_date || sale.created_at ? new Date(sale.sale_date || sale.created_at).toLocaleDateString('pt-BR') + ' ' + new Date(sale.sale_date || sale.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
              </div>
              <div class="sale-details" style="margin-top: 4px;">
                <strong>Vendedor:</strong> ${sale.user_name || sale.created_by || 'N/A'}
              </div>
              <div class="sale-details" style="margin-top: 4px;">
                <strong>Pagamento:</strong> ${formatPaymentMethod(sale.payment_method || 'money')}
              </div>
              ${sale.cancelled_at ? `
              <div class="sale-details" style="margin-top: 4px; color: #dc2626;">
                <strong>Cancelado em:</strong> ${new Date(sale.cancelled_at).toLocaleDateString('pt-BR') + ' ' + new Date(sale.cancelled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </div>
              ` : ''}
              ${sale.cancelled_by ? `
              <div class="sale-details" style="margin-top: 4px; color: #dc2626;">
                <strong>Cancelado por:</strong> ${sale.cancelled_by}
              </div>
              ` : ''}
            </div>
            <div class="sale-amount cancelled-amount">${formatCurrency(sale.total_amount || 0)}</div>
          </div>
          ${sale.items && sale.items.length > 0 ? `
          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #fca5a5;">
            <div style="font-size: 11px; color: #991b1b; font-weight: bold; margin-bottom: 6px;">Itens:</div>
            ${sale.items.map(item => `
              <div style="display: flex; justify-content: space-between; font-size: 10px; color: #7f1d1d; margin-bottom: 4px;">
                <span>${item.quantity}x ${item.product_name || item.name || 'Produto'}</span>
                <span style="font-weight: 600;">${formatCurrency((item.unit_price || item.price || 0) * item.quantity)}</span>
              </div>
            `).join('')}
          </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
    ` : ''}

    <div class="footer">
      <div>Sistema PDV LB Brand</div>
      <div>Relatório gerado em ${new Date().toLocaleString('pt-BR')}</div>
    </div>
  </div>

  <div class="button-print no-print">
    <button onclick="window.print()">Imprimir / Salvar como PDF</button>
  </div>
</body>
</html>
  `;

  // Abrir janela para impressão/salvar como PDF
  const printWindow = window.open('', '_blank');
  printWindow.document.write(pdfHTML);
  printWindow.document.close();
  
  // Aguardar carregamento e abrir diálogo de impressão
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };
}

