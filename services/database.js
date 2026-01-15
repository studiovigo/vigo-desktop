// Serviço de Banco de Dados SQLite com fallback para localStorage
let Database = null;
let tauriPath = null;
let tauriFs = null;

// Importações condicionais do Tauri
try {
  if (typeof window !== 'undefined' && window.__TAURI__) {
    Database = require('better-sqlite3');
    tauriPath = require('@tauri-apps/api/path');
    tauriFs = require('@tauri-apps/plugin-fs');
  }
} catch (e) {
  console.warn('Tauri não disponível, usando localStorage');
}

let dbInstance = null;
let dbPath = null;
let isTauri = false;

// Verificar se está rodando no Tauri
try {
  if (window.__TAURI__) {
    isTauri = true;
  }
} catch (e) {
  isTauri = false;
}

// Inicializar banco de dados
export async function initDatabase() {
  if (!isTauri || !Database || !tauriPath || !tauriFs) {
    console.warn('Tauri não detectado, usando localStorage como fallback');
    return { success: true, mode: 'localStorage' };
  }

  try {
    const appData = await tauriPath.appDataDir();
    const dbDir = await tauriPath.join(appData, 'sistem-pdv');
    
    // Criar diretório se não existir
    try {
      await tauriFs.readDir(dbDir);
    } catch {
      await tauriFs.createDir(dbDir, { recursive: true });
    }

    dbPath = await tauriPath.join(dbDir, 'database.db');
    dbInstance = new Database(dbPath);
    
    // Configurações de performance
    dbInstance.pragma('journal_mode = WAL'); // Write-Ahead Logging
    dbInstance.pragma('foreign_keys = ON'); // Integridade referencial
    dbInstance.pragma('synchronous = NORMAL');
    
    createTables();
    createIndexes();
    
    console.log('Banco de dados SQLite inicializado:', dbPath);
    return { success: true, mode: 'sqlite', path: dbPath };
  } catch (error) {
    console.error('Erro ao inicializar SQLite:', error);
    return { success: false, error: error.message, mode: 'localStorage' };
  }
}

// Criar tabelas
function createTables() {
  // Tabela de modelos de produtos
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS product_models (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      cost_price REAL DEFAULT 0,
      sale_price REAL DEFAULT 0,
      image TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
    );
  `);

  // Tabela de produtos
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      model_id TEXT,
      model_name TEXT,
      model_code TEXT,
      code TEXT UNIQUE NOT NULL,
      name TEXT,
      color TEXT,
      size TEXT,
      stock INTEGER DEFAULT 0,
      cost_price REAL DEFAULT 0,
      sale_price REAL DEFAULT 0,
      image TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT,
      FOREIGN KEY (model_id) REFERENCES product_models(id) ON DELETE CASCADE
    );
  `);

  // Tabela de vendas
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      sale_date TEXT NOT NULL,
      total_amount REAL NOT NULL,
      payment_method TEXT,
      discount REAL DEFAULT 0,
      status TEXT DEFAULT 'finalized',
      created_by TEXT,
      created_by_cpf TEXT,
      cancelled_at TEXT,
      cancelled_by TEXT,
      cancelled_by_cpf TEXT,
      synced INTEGER DEFAULT 0,
      sync_id TEXT,
      sync_attempts INTEGER DEFAULT 0,
      last_sync_attempt TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Tabela de itens de venda
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_code TEXT,
      product_name TEXT,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
  `);

  // Tabela de movimentação de estoque (auditoria completa)
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS stock_movements (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      product_code TEXT,
      movement_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      previous_stock INTEGER,
      new_stock INTEGER,
      reason TEXT,
      user_name TEXT,
      user_cpf TEXT,
      sale_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      synced INTEGER DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
  `);

  // Tabela de usuários
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      cpf TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Tabela de cupons
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS coupons (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      discount REAL NOT NULL,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Tabela de logs de atividade
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      user_name TEXT,
      user_cpf TEXT,
      action TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Tabela de configurações
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Tabela de despesas
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      category TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
    );
  `);

  // Tabela de fila de sincronização
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      data TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      last_attempt TEXT,
      status TEXT DEFAULT 'pending',
      error_message TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// Criar índices para performance
function createIndexes() {
  dbInstance.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
    CREATE INDEX IF NOT EXISTS idx_products_model ON products(model_id);
    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
    CREATE INDEX IF NOT EXISTS idx_sales_synced ON sales(synced);
    CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
    CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
    CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
    CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(created_at);
    CREATE INDEX IF NOT EXISTS idx_stock_movements_synced ON stock_movements(synced);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp);
  `);
}

// Obter instância do banco
export function getDatabase() {
  if (isTauri && dbInstance) {
    return dbInstance;
  }
  return null;
}

// Verificar se está usando SQLite
export function isUsingSQLite() {
  return isTauri && dbInstance !== null;
}

// Obter caminho do banco
export function getDatabasePath() {
  return dbPath;
}

// Fechar conexão
export function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

// Função auxiliar para executar queries com tratamento de erro
export function executeQuery(query, params = []) {
  if (!isUsingSQLite()) {
    throw new Error('SQLite não está disponível');
  }
  
  try {
    const stmt = dbInstance.prepare(query);
    if (params.length > 0) {
      return stmt.run(...params);
    }
    return stmt.run();
  } catch (error) {
    console.error('Erro ao executar query:', error);
    console.error('Query:', query);
    console.error('Params:', params);
    throw error;
  }
}

// Função auxiliar para buscar dados
export function fetchQuery(query, params = []) {
  if (!isUsingSQLite()) {
    throw new Error('SQLite não está disponível');
  }
  
  try {
    const stmt = dbInstance.prepare(query);
    if (params.length > 0) {
      return stmt.all(...params);
    }
    return stmt.all();
  } catch (error) {
    console.error('Erro ao buscar dados:', error);
    console.error('Query:', query);
    console.error('Params:', params);
    throw error;
  }
}

// Função auxiliar para buscar um único registro
export function fetchOne(query, params = []) {
  if (!isUsingSQLite()) {
    throw new Error('SQLite não está disponível');
  }
  
  try {
    const stmt = dbInstance.prepare(query);
    if (params.length > 0) {
      return stmt.get(...params);
    }
    return stmt.get();
  } catch (error) {
    console.error('Erro ao buscar registro:', error);
    console.error('Query:', query);
    console.error('Params:', params);
    throw error;
  }
}

// Transação
export function transaction(callback) {
  if (!isUsingSQLite()) {
    throw new Error('SQLite não está disponível');
  }
  
  return dbInstance.transaction(callback)();
}

// Verificar integridade do banco
export function checkIntegrity() {
  if (!isUsingSQLite()) {
    return { valid: true, mode: 'localStorage' };
  }
  
  try {
    const result = dbInstance.prepare('PRAGMA integrity_check').get();
    return { 
      valid: result.integrity_check === 'ok', 
      mode: 'sqlite',
      result: result.integrity_check 
    };
  } catch (error) {
    return { valid: false, error: error.message, mode: 'sqlite' };
  }
}

