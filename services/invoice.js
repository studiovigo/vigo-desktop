// Função para gerar e imprimir Nota Fiscal no padrão da Receita Federal
export function generateInvoice(sale, items, settings, user, invoiceType = 'prevenda') {
  const cnpj = settings?.cnpj || "";
  const isPreVenda = invoiceType === 'prevenda';
  const isNFCe = invoiceType === 'nfce';
  
  const formatCnpj = (cnpj) => {
    if (!cnpj) return "";
    const numbers = cnpj.replace(/\D/g, '');
    if (numbers.length === 14) {
      return `${numbers.slice(0,2)}.${numbers.slice(2,5)}.${numbers.slice(5,8)}/${numbers.slice(8,12)}-${numbers.slice(12)}`;
    }
    return cnpj;
  };

  const formatCurrency = (v) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
  };

  const formatDate = (date) => {
    const d = new Date(date);
    return d.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Criar conteúdo HTML da nota fiscal
  const invoiceHTML = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nota Fiscal</title>
  <style>
    @media print {
      body { margin: 0; }
      .no-print { display: none; }
    }
    body {
      font-family: 'Courier New', monospace;
      font-size: 10px;
      margin: 10px;
      line-height: 1.2;
    }
    .invoice {
      border: 1px solid #000;
      padding: 10px;
      max-width: 80mm;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      border-bottom: 1px dashed #000;
      padding-bottom: 5px;
      margin-bottom: 5px;
    }
    .header h1 {
      font-size: 12px;
      margin: 0;
      font-weight: bold;
    }
    .header h2 {
      font-size: 10px;
      margin: 2px 0;
      font-weight: bold;
    }
    .section {
      margin: 5px 0;
      border-bottom: 1px dashed #000;
      padding-bottom: 3px;
    }
    .section-title {
      font-weight: bold;
      font-size: 9px;
      margin-bottom: 2px;
    }
    .line {
      display: flex;
      justify-content: space-between;
      font-size: 9px;
    }
    .items {
      margin: 5px 0;
    }
    .item {
      margin: 3px 0;
      font-size: 8px;
      border-bottom: 1px dotted #ccc;
      padding-bottom: 2px;
    }
    .item-name {
      font-weight: bold;
      margin-bottom: 1px;
    }
    .item-details {
      display: flex;
      justify-content: space-between;
      font-size: 7px;
    }
    .total {
      font-weight: bold;
      font-size: 11px;
      text-align: right;
      margin-top: 5px;
      border-top: 2px solid #000;
      padding-top: 3px;
    }
    .invoice-type {
      background: ${isPreVenda ? '#fff3cd' : '#d1ecf1'};
      border: 2px ${isPreVenda ? 'dashed #856404' : 'solid #0c5460'};
      padding: 8px;
      margin: 10px 0;
      text-align: center;
      font-weight: bold;
      font-size: 11px;
      color: ${isPreVenda ? '#856404' : '#0c5460'};
    }
    .nfce-space {
      background: #f8f9fa;
      border: 2px dashed #6c757d;
      padding: 15px;
      margin: 10px 0;
      text-align: center;
      min-height: 60px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }
    .nfce-title {
      font-weight: bold;
      font-size: 10px;
      margin-bottom: 5px;
      color: #495057;
    }
    .nfce-placeholder {
      font-size: 8px;
      color: #6c757d;
      font-style: italic;
    }
    .footer {
      text-align: center;
      font-size: 7px;
      margin-top: 10px;
      border-top: 1px dashed #000;
      padding-top: 5px;
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
  <div class="invoice">
    <div class="header">
      <h1>NOTA FISCAL</h1>
      <h2>DANFE - Documento Auxiliar da NF-e</h2>
    </div>

    <!-- Tipo de Nota -->
    <div class="invoice-type">
      ${isPreVenda ? '⚠️ PRÉ-VENDA - NÃO É DOCUMENTO FISCAL' : '✓ NFC-e - NOTA FISCAL ELETRÔNICA'}
    </div>

    ${isPreVenda ? `
    <div style="background: #fff3cd; border: 1px solid #856404; padding: 6px; margin: 8px 0; font-size: 8px; color: #856404; text-align: center;">
      <strong>ATENÇÃO:</strong> Esta é apenas uma pré-venda. Para emissão da NFC-e oficial, solicite ao vendedor.
    </div>
    ` : ''}

    ${isNFCe ? `
    <div class="nfce-space">
      <div class="nfce-title">CHAVE DE ACESSO NFC-e</div>
      <div class="nfce-placeholder">
        [ESPAÇO RESERVADO PARA INTEGRAÇÃO COM API]<br>
        A chave de acesso será exibida aqui após integração
      </div>
    </div>
    <div style="text-align: center; font-size: 8px; margin: 5px 0;">
      <strong>QR CODE NFC-e</strong><br>
      <div style="border: 1px dashed #ccc; padding: 10px; margin: 5px auto; width: 100px; height: 100px; display: flex; align-items: center; justify-content: center; color: #999;">
        [QR CODE]
      </div>
    </div>
    ` : ''}

    <div class="section">
      <div class="section-title">EMITENTE</div>
      <div class="line">CNPJ: ${formatCnpj(cnpj)}</div>
      ${cnpj ? '' : '<div class="line" style="color: red;">CNPJ não configurado nas configurações</div>'}
    </div>

    <div class="section">
      <div class="section-title">DADOS DA VENDA</div>
      <div class="line">Data/Hora: ${formatDate(sale.sale_date)}</div>
      <div class="line">Vendedor: ${user?.name || 'N/A'}</div>
      <div class="line">CPF Vendedor: ${user?.cpf ? user.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : 'Não informado'}</div>
    </div>

    <div class="section">
      <div class="section-title">ITENS</div>
      <div class="items">
        ${items.map((item, index) => `
          <div class="item">
            <div class="item-name">${index + 1}. ${item.name}</div>
            <div class="item-details">
              <span>Qtd: ${item.qtd} x ${formatCurrency(item.price)}</span>
              <span>${formatCurrency(item.price * item.qtd)}</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    ${sale.discount > 0 ? `
    <div class="section">
      <div class="line">Desconto: -${formatCurrency(sale.discount)}</div>
    </div>
    ` : ''}

    <div class="total">
      TOTAL: ${formatCurrency(sale.total_amount)}
    </div>

    <div class="section">
      <div class="section-title">FORMA DE PAGAMENTO</div>
      <div class="line">${getPaymentMethodName(sale.payment_method)}</div>
    </div>

    <div class="footer">
      <div>Este documento é uma representação gráfica</div>
      <div>da Nota Fiscal Eletrônica</div>
      <div style="margin-top: 5px;">Sistema PDV LB Brand</div>
    </div>
  </div>

  <div class="button-print no-print">
    <button onclick="window.print()">Imprimir Nota Fiscal</button>
  </div>
</body>
</html>
  `;

  // Criar iframe oculto para impressão (evita bloqueio de popup)
  const printFrame = document.createElement('iframe');
  printFrame.style.position = 'fixed';
  printFrame.style.right = '0';
  printFrame.style.bottom = '0';
  printFrame.style.width = '0';
  printFrame.style.height = '0';
  printFrame.style.border = 'none';
  document.body.appendChild(printFrame);
  
  const frameDoc = printFrame.contentWindow || printFrame.contentDocument;
  const doc = frameDoc.document || frameDoc;
  
  doc.open();
  doc.write(invoiceHTML);
  doc.close();
  
  // Aguardar carregamento e imprimir
  printFrame.onload = () => {
    setTimeout(() => {
      try {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
      } catch (e) {
        console.error('[invoice] Erro ao imprimir:', e);
        // Fallback: abrir em nova aba
        const blob = new Blob([invoiceHTML], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      }
      
      // Remover iframe após impressão (com delay para não cancelar impressão)
      setTimeout(() => {
        document.body.removeChild(printFrame);
      }, 1000);
    }, 300);
  };
  
  console.log('[invoice] ✅ Nota fiscal gerada:', invoiceType === 'nfce' ? 'NFC-e' : 'Pré-venda');
}

function getPaymentMethodName(method) {
  const methods = {
    'money': 'Dinheiro',
    'pix_maquina': 'PIX Máquina',
    'pix_direto': 'PIX Direto',
    'debit': 'Cartão de Débito',
    'credit': 'Cartão de Crédito'
  };
  return methods[method] || method;
}

