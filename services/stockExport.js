// Serviço de Exportação e Importação de Estoque
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { fetchQuery, isUsingSQLite } from './database.js';
import { db } from './db.js'; // Fallback para localStorage

// Importações condicionais do Tauri
let tauriDialog = null;
let tauriFs = null;

try {
  if (typeof window !== 'undefined' && window.__TAURI__) {
    tauriDialog = require('@tauri-apps/plugin-dialog');
    tauriFs = require('@tauri-apps/plugin-fs');
  }
} catch (e) {
  console.warn('Tauri não disponível para exportação/importação');
}

// Exportar estoque para CSV
export async function exportStockToCSV() {
  try {
    let products = [];
    
    if (isUsingSQLite()) {
      products = fetchQuery(`
        SELECT 
          p.code as 'Código',
          p.name as 'Nome',
          p.model_name as 'Modelo',
          p.color as 'Cor',
          p.size as 'Tamanho',
          p.stock as 'Estoque',
          p.cost_price as 'Preço de Custo',
          p.sale_price as 'Preço de Venda'
        FROM products p
        WHERE p.active = 1
        ORDER BY p.model_name, p.color, p.size
      `);
    } else {
      // Fallback para localStorage
      const allProducts = db.products.list();
      products = allProducts.map(p => ({
        'Código': p.code,
        'Nome': p.name || `${p.modelName} ${p.color} ${p.size}`,
        'Modelo': p.modelName || '',
        'Cor': p.color || '',
        'Tamanho': p.size || '',
        'Estoque': p.stock || 0,
        'Preço de Custo': p.costPrice || 0,
        'Preço de Venda': p.salePrice || 0
      }));
    }

    // Converter para CSV
    const csv = Papa.unparse(products, {
      header: true,
      delimiter: ';',
      encoding: 'UTF-8'
    });

    // Salvar arquivo
    if (tauriDialog && tauriFs) {
      const filePath = await tauriDialog.save({
        filters: [{
          name: 'CSV',
          extensions: ['csv']
        }],
        defaultPath: `estoque_${new Date().toISOString().split('T')[0]}.csv`
      });

      if (filePath) {
        await tauriFs.writeTextFile(filePath, '\ufeff' + csv); // BOM para Excel
        return { success: true, filePath, count: products.length };
      }

      return { success: false, message: 'Exportação cancelada' };
    } else {
      // Fallback: download no navegador
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `estoque_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      return { success: true, count: products.length };
    }
  } catch (error) {
    console.error('Erro ao exportar estoque:', error);
    return { success: false, error: error.message };
  }
}

// Exportar estoque para Excel
export async function exportStockToExcel() {
  try {
    let products = [];
    
    if (isUsingSQLite()) {
      products = fetchQuery(`
        SELECT 
          p.code as 'Código',
          p.name as 'Nome',
          p.model_name as 'Modelo',
          p.color as 'Cor',
          p.size as 'Tamanho',
          p.stock as 'Estoque',
          p.cost_price as 'Preço de Custo',
          p.sale_price as 'Preço de Venda'
        FROM products p
        WHERE p.active = 1
        ORDER BY p.model_name, p.color, p.size
      `);
    } else {
      // Fallback para localStorage
      const allProducts = db.products.list();
      products = allProducts.map(p => ({
        'Código': p.code,
        'Nome': p.name || `${p.modelName} ${p.color} ${p.size}`,
        'Modelo': p.modelName || '',
        'Cor': p.color || '',
        'Tamanho': p.size || '',
        'Estoque': p.stock || 0,
        'Preço de Custo': p.costPrice || 0,
        'Preço de Venda': p.salePrice || 0
      }));
    }

    // Criar workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(products);
    
    // Ajustar largura das colunas
    const colWidths = [
      { wch: 15 }, // Código
      { wch: 30 }, // Nome
      { wch: 20 }, // Modelo
      { wch: 15 }, // Cor
      { wch: 10 }, // Tamanho
      { wch: 10 }, // Estoque
      { wch: 15 }, // Preço de Custo
      { wch: 15 }  // Preço de Venda
    ];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Estoque');

    // Salvar arquivo
    if (tauriDialog) {
      const filePath = await tauriDialog.save({
        filters: [{
          name: 'Excel',
          extensions: ['xlsx']
        }],
        defaultPath: `estoque_${new Date().toISOString().split('T')[0]}.xlsx`
      });

      if (filePath) {
        XLSX.writeFile(wb, filePath);
        return { success: true, filePath, count: products.length };
      }

      return { success: false, message: 'Exportação cancelada' };
    } else {
      // Fallback: download no navegador
      XLSX.writeFile(wb, `estoque_${new Date().toISOString().split('T')[0]}.xlsx`);
      return { success: true, count: products.length };
    }
  } catch (error) {
    console.error('Erro ao exportar estoque:', error);
    return { success: false, error: error.message };
  }
}

// Importar estoque de CSV
export async function importStockFromCSV(filePath = null) {
  try {
    let csvContent = '';
    
    if (!filePath) {
      if (tauriDialog && tauriFs) {
        // Abrir diálogo de seleção de arquivo
        const selected = await tauriDialog.open({
          filters: [{
            name: 'CSV',
            extensions: ['csv']
          }],
          multiple: false
        });
        
        if (!selected) {
          return { success: false, message: 'Importação cancelada' };
        }
        
        filePath = selected;
        csvContent = await tauriFs.readTextFile(filePath);
      } else {
        // Fallback: usar input file do navegador
        return new Promise((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.csv';
          input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) {
              resolve({ success: false, message: 'Importação cancelada' });
              return;
            }
            const text = await file.text();
            const result = await processCSVContent(text);
            resolve(result);
          };
          input.click();
        });
      }
    } else {
      csvContent = tauriFs ? await tauriFs.readTextFile(filePath) : '';
    }
    
    return await processCSVContent(csvContent);
  } catch (error) {
    console.error('Erro ao importar estoque:', error);
    return { success: false, error: error.message };
  }
}

// Processar conteúdo CSV
async function processCSVContent(csvContent) {
  try {
    
    // Remover BOM se existir
    if (csvContent.charCodeAt(0) === 0xFEFF) {
      csvContent = csvContent.slice(1);
    }

    // Parse CSV
    const result = Papa.parse(csvContent, {
      header: true,
      delimiter: ';',
      skipEmptyLines: true,
      encoding: 'UTF-8'
    });

    if (result.errors.length > 0) {
      console.warn('Erros no parse do CSV:', result.errors);
    }

    const products = result.data;
    const stats = {
      total: products.length,
      updated: 0,
      created: 0,
      errors: []
    };

    // Processar cada produto
    for (const product of products) {
      try {
        const code = (product['Código'] || product['codigo'] || product['code'] || '').trim();
        const stock = parseInt(product['Estoque'] || product['estoque'] || product['stock'] || 0);
        
        if (!code) {
          stats.errors.push({ row: product, error: 'Código não encontrado' });
          continue;
        }

        if (isUsingSQLite()) {
          // Buscar produto por código
          const { fetchQuery, executeQuery, transaction } = await import('./database.js');
          const existing = fetchQuery('SELECT id, stock FROM products WHERE code = ?', [code]);
          
          if (existing.length > 0) {
            // Atualizar estoque
            transaction(() => {
              executeQuery(
                'UPDATE products SET stock = ?, updated_at = ? WHERE code = ?',
                [stock, new Date().toISOString(), code]
              );
              
              // Registrar movimentação
              executeQuery(`
                INSERT INTO stock_movements 
                (id, product_id, product_code, movement_type, quantity, previous_stock, new_stock, reason)
                VALUES (?, ?, ?, 'ENTRADA', ?, ?, ?, ?)
              `, [
                crypto.randomUUID(),
                existing[0].id,
                code,
                stock - (existing[0].stock || 0),
                existing[0].stock || 0,
                stock,
                'Importação de estoque'
              ]);
            });
            stats.updated++;
          } else {
            stats.errors.push({ row: product, error: `Produto com código ${code} não encontrado` });
          }
        } else {
          // Fallback para localStorage
          const existing = db.products.findByCode(code);
          if (existing) {
            db.products.updateStock(existing.id, stock, { name: 'Sistema', cpf: '00000000000', role: 'admin' });
            stats.updated++;
          } else {
            stats.errors.push({ row: product, error: `Produto com código ${code} não encontrado` });
          }
        }
      } catch (error) {
        stats.errors.push({ row: product, error: error.message });
      }
    }

    return { 
      success: true, 
      stats,
      message: `Importação concluída: ${stats.updated} produtos atualizados, ${stats.errors.length} erros`
    };
  } catch (error) {
    console.error('Erro ao importar estoque:', error);
    return { success: false, error: error.message };
  }
}

// Importar estoque de Excel
export async function importStockFromExcel(filePath = null) {
  try {
    let workbook;
    
    if (!filePath) {
      if (tauriDialog && tauriFs) {
        // Abrir diálogo de seleção de arquivo
        const selected = await tauriDialog.open({
          filters: [{
            name: 'Excel',
            extensions: ['xlsx', 'xls']
          }],
          multiple: false
        });
        
        if (!selected) {
          return { success: false, message: 'Importação cancelada' };
        }
        
        filePath = selected;
        workbook = XLSX.readFile(filePath);
      } else {
        // Fallback: usar input file do navegador
        return new Promise((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.xlsx,.xls';
          input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) {
              resolve({ success: false, message: 'Importação cancelada' });
              return;
            }
            const arrayBuffer = await file.arrayBuffer();
            workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const result = await processExcelWorkbook(workbook);
            resolve(result);
          };
          input.click();
        });
      }
    } else {
      workbook = XLSX.readFile(filePath);
    }

    return await processExcelWorkbook(workbook);
  } catch (error) {
    console.error('Erro ao importar estoque:', error);
    return { success: false, error: error.message };
  }
}

// Processar workbook Excel
async function processExcelWorkbook(workbook) {
  try {
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const products = XLSX.utils.sheet_to_json(worksheet);

    const stats = {
      total: products.length,
      updated: 0,
      created: 0,
      errors: []
    };

    // Processar cada produto
    for (const product of products) {
      try {
        const code = (product['Código'] || product['codigo'] || product['code'] || '').trim();
        const stock = parseInt(product['Estoque'] || product['estoque'] || product['stock'] || 0);
        
        if (!code) {
          stats.errors.push({ row: product, error: 'Código não encontrado' });
          continue;
        }

        if (isUsingSQLite()) {
          // Buscar produto por código
          const { fetchQuery, executeQuery, transaction } = await import('./database.js');
          const existing = fetchQuery('SELECT id, stock FROM products WHERE code = ?', [code]);
          
          if (existing.length > 0) {
            // Atualizar estoque
            transaction(() => {
              executeQuery(
                'UPDATE products SET stock = ?, updated_at = ? WHERE code = ?',
                [stock, new Date().toISOString(), code]
              );
              
              // Registrar movimentação
              executeQuery(`
                INSERT INTO stock_movements 
                (id, product_id, product_code, movement_type, quantity, previous_stock, new_stock, reason)
                VALUES (?, ?, ?, 'ENTRADA', ?, ?, ?, ?)
              `, [
                crypto.randomUUID(),
                existing[0].id,
                code,
                stock - (existing[0].stock || 0),
                existing[0].stock || 0,
                stock,
                'Importação de estoque'
              ]);
            });
            stats.updated++;
          } else {
            stats.errors.push({ row: product, error: `Produto com código ${code} não encontrado` });
          }
        } else {
          // Fallback para localStorage
          const existing = db.products.findByCode(code);
          if (existing) {
            db.products.updateStock(existing.id, stock, { name: 'Sistema', cpf: '00000000000', role: 'admin' });
            stats.updated++;
          } else {
            stats.errors.push({ row: product, error: `Produto com código ${code} não encontrado` });
          }
        }
      } catch (error) {
        stats.errors.push({ row: product, error: error.message });
      }
    }

    return { 
      success: true, 
      stats,
      message: `Importação concluída: ${stats.updated} produtos atualizados, ${stats.errors.length} erros`
    };
  } catch (error) {
    console.error('Erro ao processar Excel:', error);
    return { success: false, error: error.message };
  }
}

// Template de importação (criar arquivo exemplo)
export async function createImportTemplate() {
  const template = [
    {
      'Código': 'EXEMPLO-001',
      'Nome': 'Produto Exemplo',
      'Modelo': 'Modelo Exemplo',
      'Cor': 'Preto',
      'Tamanho': 'M',
      'Estoque': 10,
      'Preço de Custo': 50.00,
      'Preço de Venda': 100.00
    }
  ];

  const csv = Papa.unparse(template, {
    header: true,
    delimiter: ';',
    encoding: 'UTF-8'
  });

  if (tauriDialog && tauriFs) {
    const filePath = await tauriDialog.save({
      filters: [{
        name: 'CSV',
        extensions: ['csv']
      }],
      defaultPath: 'template_importacao_estoque.csv'
    });

    if (filePath) {
      await tauriFs.writeTextFile(filePath, '\ufeff' + csv);
      return { success: true, filePath };
    }

    return { success: false, message: 'Criação de template cancelada' };
  } else {
    // Fallback: download no navegador
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'template_importacao_estoque.csv';
    link.click();
    return { success: true };
  }
}

