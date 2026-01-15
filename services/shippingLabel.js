// Função para gerar e imprimir etiqueta de envio no formato da Prancheta 2
export function printShippingLabel(order) {
  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  // Criar conteúdo HTML da etiqueta
  const labelHTML = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Etiqueta de Envio</title>
  <style>
    @media print {
      body { margin: 0; padding: 0; }
      .no-print { display: none; }
      @page {
        size: A4;
        margin: 0;
      }
    }
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 20px;
      background: white;
    }
    .label {
      width: 210mm;
      min-height: 297mm;
      border: 2px solid #000;
      padding: 15mm;
      box-sizing: border-box;
      background: white;
    }
    .brand-header {
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: 10px;
      margin-bottom: 15px;
    }
    .brand-title {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .brand-subtitle {
      font-size: 14px;
      color: #666;
    }
    .section {
      margin: 15px 0;
      padding: 10px;
      border: 1px solid #ccc;
    }
    .section-title {
      font-weight: bold;
      font-size: 14px;
      margin-bottom: 8px;
      text-decoration: underline;
    }
    .field {
      margin: 8px 0;
      font-size: 12px;
    }
    .field-label {
      font-weight: bold;
      display: inline-block;
      width: 120px;
    }
    .field-value {
      display: inline-block;
    }
    .address-box {
      border: 1px solid #000;
      padding: 10px;
      margin-top: 10px;
      min-height: 80px;
      font-size: 12px;
    }
    .product-section {
      margin-top: 20px;
      border-top: 2px solid #000;
      padding-top: 15px;
    }
    .product-item {
      display: flex;
      gap: 15px;
      margin: 15px 0;
      padding: 10px;
      border: 1px solid #ddd;
    }
    .product-image {
      width: 80px;
      height: 80px;
      object-fit: cover;
      border: 1px solid #ccc;
    }
    .product-info {
      flex: 1;
    }
    .product-name {
      font-weight: bold;
      font-size: 14px;
      margin-bottom: 5px;
    }
    .product-code {
      font-size: 11px;
      color: #666;
      margin-bottom: 5px;
    }
    .product-details {
      font-size: 11px;
      color: #333;
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
  <div class="label">
    <div class="brand-header">
      <div class="brand-title">Brand</div>
      <div class="brand-subtitle">BY: RESILIÊNCIA BIJOUX</div>
    </div>

    <div class="section">
      <div class="section-title">DESTINATÁRIO</div>
      <div class="field">
        <span class="field-label">NOME:</span>
        <span class="field-value">${order.customerName || ""}</span>
      </div>
      <div class="field">
        <span class="field-label">TELEFONE:</span>
        <span class="field-value">${order.customerPhone || ""}</span>
      </div>
      <div class="field">
        <span class="field-label">ATENDENTE:</span>
        <span class="field-value">${order.attendant || ""}</span>
      </div>
      <div class="field">
        <span class="field-label">DATA:</span>
        <span class="field-value">${formatDate(order.createdAt || order.date)}</span>
      </div>
      <div class="field">
        <span class="field-label">ENDEREÇO:</span>
      </div>
      <div class="address-box">
        ${order.shippingAddress ? `
          ${order.shippingAddress.street || ""} ${order.shippingAddress.number || ""}<br>
          ${order.shippingAddress.complement ? order.shippingAddress.complement + "<br>" : ""}
          ${order.shippingAddress.neighborhood || ""}<br>
          ${order.shippingAddress.city || ""} - ${order.shippingAddress.state || ""}<br>
          CEP: ${order.shippingAddress.zipCode || ""}
        ` : order.shippingAddress || ""}
      </div>
    </div>

    <div class="product-section">
      <div class="section-title">PRODUTOS</div>
      ${order.items && order.items.length > 0 ? order.items.map(item => `
        <div class="product-item">
          ${item.image ? `<img src="${item.image}" alt="${item.name}" class="product-image" onerror="this.style.display='none'">` : ""}
          <div class="product-info">
            <div class="product-name">${item.name || ""}</div>
            <div class="product-code">Código: ${item.code || item.sku || ""}</div>
            <div class="product-details">
              Quantidade: ${item.quantity || 1}<br>
              ${item.price ? `Valor: R$ ${parseFloat(item.price).toFixed(2).replace('.', ',')}` : ""}
            </div>
          </div>
        </div>
      `).join('') : `
        <div class="product-item">
          <div class="product-info">
            <div class="product-name">${order.productName || ""}</div>
            <div class="product-code">Código: ${order.productCode || ""}</div>
            <div class="product-details">
              Quantidade: ${order.quantity || 1}<br>
              ${order.totalAmount ? `Valor: R$ ${parseFloat(order.totalAmount).toFixed(2).replace('.', ',')}` : ""}
            </div>
          </div>
        </div>
      `}
    </div>

    ${order.paymentMethod ? `
    <div class="section" style="margin-top: 20px;">
      <div class="field">
        <span class="field-label">MÉTODO DE PAGAMENTO:</span>
        <span class="field-value">${order.paymentMethod}</span>
      </div>
    </div>
    ` : ""}
  </div>

  <div class="button-print no-print">
    <button onclick="window.print()">Imprimir Etiqueta</button>
  </div>
</body>
</html>
  `;

  // Abrir janela de impressão
  const printWindow = window.open('', '_blank');
  printWindow.document.write(labelHTML);
  printWindow.document.close();
  
  // Aguardar carregamento e imprimir automaticamente
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };
}

