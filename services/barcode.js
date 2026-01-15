// Função para gerar código de barras em SVG usando canvas
function generateBarcodeSVG(code) {
  // Código de barras simples usando linhas verticais
  // Cada dígito representa uma sequência de barras
  const patterns = {
    '0': '11011001100',
    '1': '11001101100',
    '2': '11001100110',
    '3': '10010011000',
    '4': '10010001100',
    '5': '10001001100',
    '6': '10011001000',
    '7': '10011000100',
    '8': '10001100100',
    '9': '11001001000',
    'A': '11001000100',
    'B': '11000100100',
    'C': '10110011100',
    'D': '10011011100',
    'E': '10011001110',
    'F': '10111001100',
    'G': '10011101100',
    'H': '10011100110',
    'I': '11001110010',
    'J': '11001011100',
    'K': '11001001110',
    'L': '11011100100',
    'M': '11001110100',
    'N': '11101101110',
    'O': '11101001100',
    'P': '11100101100',
    'Q': '11100100110',
    'R': '11101100100',
    'S': '11100110100',
    'T': '11100110010',
    'U': '11011011000',
    'V': '11011000110',
    'W': '11000110110',
    'X': '10100011000',
    'Y': '10001011000',
    'Z': '10001000110',
    '-': '10100001100',
    '.': '10000001000',
    ' ': '10000000100',
    '$': '10010000100',
    '/': '10010001000',
    '+': '10001001000',
    '%': '10100010000',
    '*': '10001010000'
  };

  const codeStr = String(code).toUpperCase();
  let svg = '<svg width="200" height="50" xmlns="http://www.w3.org/2000/svg">';
  
  let x = 5;
  const barWidth = 1.5;
  const barHeight = 35;
  
  // Barras de início
  svg += `<rect x="${x}" y="5" width="${barWidth}" height="${barHeight}" fill="black"/>`;
  x += barWidth * 2;
  svg += `<rect x="${x}" y="5" width="${barWidth}" height="${barHeight}" fill="black"/>`;
  x += barWidth * 2;
  
  // Código
  for (let i = 0; i < codeStr.length; i++) {
    const char = codeStr[i];
    const pattern = patterns[char] || patterns['0'];
    
    for (let j = 0; j < pattern.length; j++) {
      if (pattern[j] === '1') {
        svg += `<rect x="${x}" y="5" width="${barWidth}" height="${barHeight}" fill="black"/>`;
      }
      x += barWidth;
    }
  }
  
  // Barras de fim
  svg += `<rect x="${x}" y="5" width="${barWidth}" height="${barHeight}" fill="black"/>`;
  x += barWidth * 2;
  svg += `<rect x="${x}" y="5" width="${barWidth}" height="${barHeight}" fill="black"/>`;
  
  svg += '</svg>';
  return svg;
}

// Função para gerar e imprimir etiquetas de código de barras
// products: array de objetos com { product, quantity } onde quantity é quantas etiquetas imprimir
export function printBarcodeLabels(products, logoPath) {
  const formatCurrency = (v) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
  };

  // Criar HTML para impressão
  let html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Etiquetas de Código de Barras</title>
  <style>
    @media print {
      body { margin: 0; padding: 0; }
      .label { page-break-inside: avoid; }
      .no-print { display: none; }
    }
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 10px;
      background: white;
    }
    .labels-container {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      justify-content: flex-start;
    }
    .label {
      width: 40mm;
      height: 25mm;
      border: 1px solid #ccc;
      padding: 1mm;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: white;
      align-items: center;
      overflow: hidden;
      position: relative;
    }
    .label-logo-container {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: 4mm;
      flex-shrink: 0;
    }
    .label-logo {
      max-width: 18px;
      max-height: 10px;
      object-fit: contain;
    }
    .label-info {
      text-align: center;
      width: 100%;
      height: 4mm;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 0.3mm 0;
    }
    .label-name {
      font-weight: bold;
      font-size: 7px;
      margin: 0;
      padding: 0;
      text-transform: uppercase;
      font-family: Arial, sans-serif;
      line-height: 1.1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .label-price {
      font-size: 5px;
      color: #333;
      font-weight: 600;
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 0;
      line-height: 1;
      margin-top: 0.5mm;
    }
    .label-separator {
      display: none;
    }
    .barcode-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 12mm;
      flex-shrink: 0;
      overflow: hidden;
      padding: 0;
      margin: 0;
    }
    .barcode-svg {
      width: 90%;
      max-width: 35mm;
      height: auto;
      max-height: 10mm;
      margin: 0;
      padding: 0;
      display: block;
    }
    .barcode-code {
      font-size: 6px;
      margin-top: 0.5mm;
      font-family: 'Courier New', monospace;
      letter-spacing: 0.5px;
      font-weight: bold;
      text-align: center;
      line-height: 1;
      padding: 0;
      width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
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
  <div class="labels-container">
`;

  products.forEach(item => {
    const product = item.product || item; // Suporta tanto { product, quantity } quanto produto direto
    const quantity = item.quantity || 1; // Quantidade de etiquetas a imprimir
    
    // Formato: NOME - COR - TAMANHO.    R$ VALOR
    const productName = `${product.modelName || product.name || ''} - ${product.color || ''} - ${product.size || ''}`;
    const price = formatCurrency(product.salePrice || product.sale_price || 0);
    const barcodeSVG = generateBarcodeSVG(product.code);
    
    // Imprimir a quantidade especificada de etiquetas para este produto
    for (let i = 0; i < quantity; i++) {
      html += `
      <div class="label">
        <div class="label-logo-container">
          <img src="${logoPath}" alt="Logo" class="label-logo" onerror="this.style.display='none'">
        </div>
        <div class="label-info">
          <div class="label-name">${productName}</div>
          <div class="label-price">${price}</div>
        </div>
        <div class="label-separator"></div>
        <div class="barcode-container">
          ${barcodeSVG}
          <div class="barcode-code">${product.code}</div>
        </div>
      </div>
      `;
    }
  });

  html += `
  </div>
  <div class="button-print no-print">
    <button onclick="window.print()">Imprimir Etiquetas</button>
  </div>
</body>
</html>
  `;

  // Abrir janela de impressão
  const printWindow = window.open('', '_blank');
  printWindow.document.write(html);
  printWindow.document.close();
  
  // Aguardar carregamento e imprimir automaticamente
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };
}

