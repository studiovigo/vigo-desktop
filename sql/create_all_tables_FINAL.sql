-- =====================================================
-- SCRIPT DE CRIAÇÃO DE TODAS AS TABELAS DO SISTEMA VIGO
-- =====================================================
-- Este script cria APENAS as 14 tabelas que existem no seu Supabase
-- Execute este script no SQL Editor do Supabase
-- =====================================================

-- Habilitar extensão UUID (necessário para gerar UUIDs)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABELA 1: stores (LOJAS) ✓ EXISTE
-- =====================================================
-- Armazena informações das lojas/tenants
CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  cnpj TEXT UNIQUE,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para stores
CREATE INDEX IF NOT EXISTS idx_stores_cnpj ON stores(cnpj);
CREATE INDEX IF NOT EXISTS idx_stores_active ON stores(active);

-- =====================================================
-- TABELA 2: users (USUÁRIOS) ✓ EXISTE
-- =====================================================
-- Armazena informações dos usuários do sistema
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cpf TEXT,
  email TEXT,
  password TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'gerente', 'caixa', 'goodadmin')),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, cpf),
  UNIQUE(store_id, email)
);

-- Índices para users
CREATE INDEX IF NOT EXISTS idx_users_store_id ON users(store_id);
CREATE INDEX IF NOT EXISTS idx_users_cpf ON users(cpf);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);

-- =====================================================
-- TABELA 3: products (PRODUTOS) ✓ EXISTE
-- =====================================================
-- Armazena informações dos produtos
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  description TEXT,
  model_name TEXT,
  color TEXT,
  size TEXT,
  price NUMERIC(10, 2) DEFAULT 0,
  cost_price NUMERIC(10, 2) DEFAULT 0,
  sale_price NUMERIC(10, 2) DEFAULT 0,
  stock INTEGER DEFAULT 0,
  stock_quantity INTEGER DEFAULT 0,
  tax_percentage NUMERIC(5, 2) DEFAULT 0,
  ncm TEXT,
  image TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, sku)
);

-- Índices para products
CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_model_name ON products(model_name);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

-- =====================================================
-- TABELA 4: cash_sessions (SESSÕES DE CAIXA) ✓ EXISTE
-- =====================================================
-- Armazena informações de abertura/fechamento de caixa
CREATE TABLE IF NOT EXISTS cash_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  opening_amount NUMERIC(10, 2) DEFAULT 0,
  closing_amount NUMERIC(10, 2),
  expected_amount NUMERIC(10, 2),
  difference NUMERIC(10, 2),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para cash_sessions
CREATE INDEX IF NOT EXISTS idx_cash_sessions_store_id ON cash_sessions(store_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_user_id ON cash_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_status ON cash_sessions(status);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_opened_at ON cash_sessions(opened_at);

-- =====================================================
-- TABELA 5: sales (VENDAS) ✓ EXISTE
-- =====================================================
-- Armazena informações das vendas
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  cash_session_id UUID REFERENCES cash_sessions(id) ON DELETE SET NULL,
  external_id TEXT,
  sale_date TIMESTAMPTZ DEFAULT NOW(),
  items JSONB DEFAULT '[]'::JSONB,
  total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(10, 2) DEFAULT 0,
  profit_amount NUMERIC(10, 2) DEFAULT 0,
  total_net NUMERIC(10, 2) DEFAULT 0,
  discount_amount NUMERIC(10, 2) DEFAULT 0,
  items_count INTEGER DEFAULT 0,
  payment_method TEXT DEFAULT 'money',
  status TEXT DEFAULT 'finalized' CHECK (status IN ('finalized', 'cancelled', 'pending')),
  metadata JSONB DEFAULT '{}'::JSONB,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, external_id)
);

-- Índices para sales
CREATE INDEX IF NOT EXISTS idx_sales_store_id ON sales(store_id);
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_cash_session_id ON sales(cash_session_id);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_external_id ON sales(external_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);

-- =====================================================
-- TABELA 6: sale_items (ITENS DE VENDA) ✓ EXISTE
-- =====================================================
-- Armazena itens individuais de cada venda
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_code TEXT,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  cost_price NUMERIC(10, 2) DEFAULT 0,
  subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
  discount NUMERIC(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para sale_items
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_code ON sale_items(product_code);

-- =====================================================
-- TABELA 7: coupons (CUPONS DE DESCONTO) ✓ EXISTE
-- =====================================================
-- Armazena cupons de desconto
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  discount NUMERIC(5, 2) NOT NULL,
  discount_type TEXT DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  active BOOLEAN DEFAULT TRUE,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, code)
);

-- Índices para coupons
CREATE INDEX IF NOT EXISTS idx_coupons_store_id ON coupons(store_id);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(active);

-- =====================================================
-- TABELA 8: expenses (DESPESAS) ✓ EXISTE
-- =====================================================
-- Armazena despesas da loja
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  date DATE NOT NULL,
  category TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para expenses
CREATE INDEX IF NOT EXISTS idx_expenses_store_id ON expenses(store_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by);

-- =====================================================
-- TABELA 9: cash_closures (FECHAMENTOS DE CAIXA) ✓ EXISTE
-- =====================================================
-- Armazena fechamentos diários de caixa
CREATE TABLE IF NOT EXISTS cash_closures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  cash_session_id UUID REFERENCES cash_sessions(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  opening_amount NUMERIC(10, 2) DEFAULT 0,
  total_sales NUMERIC(10, 2) DEFAULT 0,
  total_costs NUMERIC(10, 2) DEFAULT 0,
  total_expenses NUMERIC(10, 2) DEFAULT 0,
  total_discounts NUMERIC(10, 2) DEFAULT 0,
  gross_profit NUMERIC(10, 2) DEFAULT 0,
  final_cash_amount NUMERIC(10, 2) DEFAULT 0,
  payment_methods JSONB DEFAULT '{}'::JSONB,
  sales JSONB DEFAULT '[]'::JSONB,
  cancelled JSONB DEFAULT '[]'::JSONB,
  expenses JSONB DEFAULT '[]'::JSONB,
  sales_count INTEGER DEFAULT 0,
  cancelled_count INTEGER DEFAULT 0,
  expenses_count INTEGER DEFAULT 0,
  totals JSONB DEFAULT '{}'::JSONB,
  pdf_path TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, date)
);

-- Índices para cash_closures
CREATE INDEX IF NOT EXISTS idx_cash_closures_store_id ON cash_closures(store_id);
CREATE INDEX IF NOT EXISTS idx_cash_closures_date ON cash_closures(date);
CREATE INDEX IF NOT EXISTS idx_cash_closures_cash_session_id ON cash_closures(cash_session_id);
CREATE INDEX IF NOT EXISTS idx_cash_closures_created_by ON cash_closures(created_by);

-- =====================================================
-- TABELA 10: pending_signups (CADASTROS PENDENTES) ✓ EXISTE
-- =====================================================
-- Armazena cadastros pendentes de aprovação/pagamento
CREATE TABLE IF NOT EXISTS pending_signups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_name TEXT NOT NULL,
  store_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  cpf_cnpj TEXT NOT NULL,
  phone TEXT,
  selected_plan TEXT DEFAULT 'basico',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'pending_payment', 'approved', 'rejected', 'active', 'inactive')),
  rejected_reason TEXT,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para pending_signups
CREATE INDEX IF NOT EXISTS idx_pending_signups_email ON pending_signups(email);
CREATE INDEX IF NOT EXISTS idx_pending_signups_status ON pending_signups(status);
CREATE INDEX IF NOT EXISTS idx_pending_signups_admin_name ON pending_signups(admin_name);
CREATE INDEX IF NOT EXISTS idx_pending_signups_store_name ON pending_signups(store_name);
CREATE INDEX IF NOT EXISTS idx_pending_signups_cpf_cnpj ON pending_signups(cpf_cnpj);

-- =====================================================
-- TABELA 11: pos_stations (ESTAÇÕES DE PDV) ✓ EXISTE
-- =====================================================
-- Armazena informações das estações/terminais de PDV
CREATE TABLE IF NOT EXISTS pos_stations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  identifier TEXT NOT NULL,
  location TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
  last_sync TIMESTAMPTZ,
  config JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, identifier)
);

-- Índices para pos_stations
CREATE INDEX IF NOT EXISTS idx_pos_stations_store_id ON pos_stations(store_id);
CREATE INDEX IF NOT EXISTS idx_pos_stations_identifier ON pos_stations(identifier);
CREATE INDEX IF NOT EXISTS idx_pos_stations_status ON pos_stations(status);

-- =====================================================
-- TABELA 12: terminals (TERMINAIS) ✓ EXISTE
-- =====================================================
-- Armazena informações dos terminais
CREATE TABLE IF NOT EXISTS terminals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  location TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
  last_activity TIMESTAMPTZ,
  config JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, code)
);

-- Índices para terminals
CREATE INDEX IF NOT EXISTS idx_terminals_store_id ON terminals(store_id);
CREATE INDEX IF NOT EXISTS idx_terminals_code ON terminals(code);
CREATE INDEX IF NOT EXISTS idx_terminals_status ON terminals(status);

-- =====================================================
-- TABELA 13: warehouse_stock (ESTOQUE DE DEPÓSITO) ✓ EXISTE
-- =====================================================
-- Armazena estoque separado por depósito/armazém
CREATE TABLE IF NOT EXISTS warehouse_stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_name TEXT NOT NULL,
  quantity INTEGER DEFAULT 0,
  min_quantity INTEGER DEFAULT 0,
  max_quantity INTEGER,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, product_id, warehouse_name)
);

-- Índices para warehouse_stock
CREATE INDEX IF NOT EXISTS idx_warehouse_stock_store_id ON warehouse_stock(store_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_stock_product_id ON warehouse_stock(product_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_stock_warehouse_name ON warehouse_stock(warehouse_name);

-- =====================================================
-- TABELA 14: closures (FECHAMENTOS - DEPRECATED) ✓ EXISTE
-- =====================================================
-- NOTA: Esta tabela é uma versão antiga de cash_closures
-- Mantida por compatibilidade, mas recomenda-se usar cash_closures
CREATE TABLE IF NOT EXISTS closures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_sales NUMERIC(10, 2) DEFAULT 0,
  total_expenses NUMERIC(10, 2) DEFAULT 0,
  final_amount NUMERIC(10, 2) DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para closures
CREATE INDEX IF NOT EXISTS idx_closures_store_id ON closures(store_id);
CREATE INDEX IF NOT EXISTS idx_closures_date ON closures(date);

-- =====================================================
-- TRIGGERS PARA ATUALIZAR updated_at AUTOMATICAMENTE
-- =====================================================

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para cada tabela que tem updated_at
DROP TRIGGER IF EXISTS update_stores_updated_at ON stores;
CREATE TRIGGER update_stores_updated_at
    BEFORE UPDATE ON stores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cash_sessions_updated_at ON cash_sessions;
CREATE TRIGGER update_cash_sessions_updated_at
    BEFORE UPDATE ON cash_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sales_updated_at ON sales;
CREATE TRIGGER update_sales_updated_at
    BEFORE UPDATE ON sales
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_coupons_updated_at ON coupons;
CREATE TRIGGER update_coupons_updated_at
    BEFORE UPDATE ON coupons
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
CREATE TRIGGER update_expenses_updated_at
    BEFORE UPDATE ON expenses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cash_closures_updated_at ON cash_closures;
CREATE TRIGGER update_cash_closures_updated_at
    BEFORE UPDATE ON cash_closures
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pending_signups_updated_at ON pending_signups;
CREATE TRIGGER update_pending_signups_updated_at
    BEFORE UPDATE ON pending_signups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pos_stations_updated_at ON pos_stations;
CREATE TRIGGER update_pos_stations_updated_at
    BEFORE UPDATE ON pos_stations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_terminals_updated_at ON terminals;
CREATE TRIGGER update_terminals_updated_at
    BEFORE UPDATE ON terminals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_warehouse_stock_updated_at ON warehouse_stock;
CREATE TRIGGER update_warehouse_stock_updated_at
    BEFORE UPDATE ON warehouse_stock
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_closures_updated_at ON closures;
CREATE TRIGGER update_closures_updated_at
    BEFORE UPDATE ON closures
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================
-- Habilitar RLS em todas as tabelas

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminals ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE closures ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICAS RLS BÁSICAS
-- =====================================================

-- Política para stores (usuários podem ver apenas sua própria loja)
DROP POLICY IF EXISTS "Users can view their own store" ON stores;
CREATE POLICY "Users can view their own store" ON stores
    FOR SELECT
    USING (
        id IN (
            SELECT store_id FROM users WHERE id = auth.uid()
        )
    );

-- Política para users (usuários podem ver usuários da mesma loja)
DROP POLICY IF EXISTS "Users can view users from their store" ON users;
CREATE POLICY "Users can view users from their store" ON users
    FOR SELECT
    USING (
        store_id IN (
            SELECT store_id FROM users WHERE id = auth.uid()
        )
    );

-- =====================================================
-- POLÍTICAS RLS: pending_signups (ACESSO PÚBLICO PARA INSERT)
-- =====================================================

-- Permitir INSERT público (qualquer pessoa pode solicitar cadastro)
DROP POLICY IF EXISTS "Anyone can insert pending signups" ON pending_signups;
CREATE POLICY "Anyone can insert pending signups" ON pending_signups
    FOR INSERT
    WITH CHECK (true);

-- Permitir SELECT apenas para goodadmins
DROP POLICY IF EXISTS "Goodadmins can view all pending signups" ON pending_signups;
CREATE POLICY "Goodadmins can view all pending signups" ON pending_signups
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'goodadmin'
        )
    );

-- Permitir UPDATE apenas para goodadmins
DROP POLICY IF EXISTS "Goodadmins can update pending signups" ON pending_signups;
CREATE POLICY "Goodadmins can update pending signups" ON pending_signups
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'goodadmin'
        )
    );

-- Permitir DELETE apenas para goodadmins
DROP POLICY IF EXISTS "Goodadmins can delete pending signups" ON pending_signups;
CREATE POLICY "Goodadmins can delete pending signups" ON pending_signups
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'goodadmin'
        )
    );

-- =====================================================
-- POLÍTICAS RLS: products
-- =====================================================

-- Política para products (usuários podem ver produtos da sua loja)
DROP POLICY IF EXISTS "Users can view products from their store" ON products;
CREATE POLICY "Users can view products from their store" ON products
    FOR SELECT
    USING (
        store_id IN (
            SELECT store_id FROM users WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert products in their store" ON products;
CREATE POLICY "Users can insert products in their store" ON products
    FOR INSERT
    WITH CHECK (
        store_id IN (
            SELECT store_id FROM users WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update products in their store" ON products;
CREATE POLICY "Users can update products in their store" ON products
    FOR UPDATE
    USING (
        store_id IN (
            SELECT store_id FROM users WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete products in their store" ON products;
CREATE POLICY "Users can delete products in their store" ON products
    FOR DELETE
    USING (
        store_id IN (
            SELECT store_id FROM users WHERE id = auth.uid()
        )
    );

-- =====================================================
-- POLÍTICAS RLS: sales
-- =====================================================

-- Política para sales (usuários podem ver vendas da sua loja)
DROP POLICY IF EXISTS "Users can view sales from their store" ON sales;
CREATE POLICY "Users can view sales from their store" ON sales
    FOR SELECT
    USING (
        store_id IN (
            SELECT store_id FROM users WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert sales in their store" ON sales;
CREATE POLICY "Users can insert sales in their store" ON sales
    FOR INSERT
    WITH CHECK (
        store_id IN (
            SELECT store_id FROM users WHERE id = auth.uid()
        )
    );

-- =====================================================
-- FUNÇÃO RPC: create_sale_atomic
-- =====================================================
-- Cria uma venda de forma atômica, validando e decrementando estoque

CREATE OR REPLACE FUNCTION create_sale_atomic(
  sale_payload JSONB,
  external_id TEXT,
  store_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sale_id UUID;
  item JSONB;
  product_record RECORD;
BEGIN
  -- Validar estoque para todos os items
  FOR item IN SELECT * FROM jsonb_array_elements(sale_payload->'items')
  LOOP
    -- Buscar produto pelo SKU (code)
    SELECT * INTO product_record
    FROM products
    WHERE sku = (item->>'code')
      AND products.store_id = create_sale_atomic.store_id
    LIMIT 1;
    
    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'status', 'error',
        'message', 'Produto não encontrado: ' || (item->>'code')
      );
    END IF;
    
    -- Validar estoque
    IF product_record.stock < (item->>'quantity')::INTEGER THEN
      RETURN jsonb_build_object(
        'status', 'insufficient_stock',
        'message', 'Estoque insuficiente para: ' || product_record.name,
        'product_id', product_record.id,
        'available', product_record.stock,
        'requested', (item->>'quantity')::INTEGER
      );
    END IF;
  END LOOP;
  
  -- Verificar se venda já existe (idempotência)
  SELECT id INTO sale_id
  FROM sales
  WHERE sales.external_id = create_sale_atomic.external_id
    AND sales.store_id = create_sale_atomic.store_id;
  
  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'already_exists',
      'sale_id', sale_id
    );
  END IF;
  
  -- Criar venda
  INSERT INTO sales (
    store_id,
    user_id,
    cash_session_id,
    external_id,
    items,
    total_amount,
    payment_method,
    status
  ) VALUES (
    create_sale_atomic.store_id,
    (sale_payload->>'user_id')::UUID,
    (sale_payload->>'cash_session_id')::UUID,
    create_sale_atomic.external_id,
    sale_payload->'items',
    (sale_payload->>'total')::NUMERIC,
    sale_payload->>'payment_method',
    COALESCE(sale_payload->>'status', 'finalized')
  )
  RETURNING id INTO sale_id;
  
  -- Decrementar estoque para cada item
  FOR item IN SELECT * FROM jsonb_array_elements(sale_payload->'items')
  LOOP
    UPDATE products
    SET stock = stock - (item->>'quantity')::INTEGER,
        stock_quantity = stock_quantity - (item->>'quantity')::INTEGER
    WHERE sku = (item->>'code')
      AND products.store_id = create_sale_atomic.store_id;
    
    -- Inserir item na tabela sale_items
    INSERT INTO sale_items (
      sale_id,
      product_id,
      product_code,
      product_name,
      quantity,
      unit_price,
      cost_price,
      subtotal
    )
    SELECT
      sale_id,
      p.id,
      p.sku,
      p.name,
      (item->>'quantity')::INTEGER,
      (item->>'price')::NUMERIC,
      p.cost_price,
      (item->>'quantity')::INTEGER * (item->>'price')::NUMERIC
    FROM products p
    WHERE p.sku = (item->>'code')
      AND p.store_id = create_sale_atomic.store_id;
  END LOOP;
  
  RETURN jsonb_build_object(
    'status', 'ok',
    'sale_id', sale_id
  );
END;
$$;

-- =====================================================
-- CONCLUSÃO
-- =====================================================
-- Script executado com sucesso!
-- 
-- ✅ TABELAS CRIADAS/VERIFICADAS (14 TABELAS):
-- 1. stores (lojas)
-- 2. users (usuários)
-- 3. products (produtos)
-- 4. cash_sessions (sessões de caixa)
-- 5. sales (vendas)
-- 6. sale_items (itens de venda)
-- 7. coupons (cupons de desconto)
-- 8. expenses (despesas)
-- 9. cash_closures (fechamentos de caixa)
-- 10. pending_signups (cadastros pendentes)
-- 11. pos_stations (estações de PDV)
-- 12. terminals (terminais)
-- 13. warehouse_stock (estoque de depósito)
-- 14. closures (fechamentos - DEPRECATED)
-- 
-- ✅ FUNÇÕES RPC:
-- - create_sale_atomic (criar venda atômica com validação de estoque)
-- 
-- ✅ RECURSOS:
-- - Triggers para updated_at
-- - Índices para performance
-- - Row Level Security (RLS)
-- - Políticas RLS básicas
-- =====================================================
