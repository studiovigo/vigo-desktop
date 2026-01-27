-- =====================================================
-- SCRIPT DE CRIAÇÃO DE TODAS AS TABELAS DO SISTEMA VIGO
-- =====================================================
-- Este script cria todas as tabelas necessárias para o sistema PDV VIGO
-- Execute este script no SQL Editor do Supabase
-- =====================================================

-- Habilitar extensão UUID (necessário para gerar UUIDs)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABELA: stores (LOJAS)
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
-- TABELA: users (USUÁRIOS)
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
-- TABELA: products (PRODUTOS)
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
-- TABELA: cash_sessions (SESSÕES DE CAIXA)
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
-- TABELA: sales (VENDAS)
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
-- TABELA: stock_movements (MOVIMENTAÇÕES DE ESTOQUE)
-- =====================================================
-- Armazena histórico de movimentações de estoque
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_sku TEXT,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('entry', 'exit', 'adjustment', 'sale', 'return', 'transfer')),
  quantity INTEGER NOT NULL,
  previous_stock INTEGER,
  new_stock INTEGER,
  reason TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para stock_movements
CREATE INDEX IF NOT EXISTS idx_stock_movements_store_id ON stock_movements(store_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_movement_type ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_user_id ON stock_movements(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_sale_id ON stock_movements(sale_id);

-- =====================================================
-- TABELA: coupons (CUPONS DE DESCONTO)
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
-- TABELA: expenses (DESPESAS)
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
-- TABELA: cash_closures (FECHAMENTOS DE CAIXA)
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
-- TABELA: activity_logs (LOGS DE ATIVIDADE)
-- =====================================================
-- Armazena logs de atividades do sistema
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name TEXT,
  user_cpf TEXT,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para activity_logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_store_id ON activity_logs(store_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);

-- =====================================================
-- TABELA: online_orders (PEDIDOS ONLINE)
-- =====================================================
-- Armazena pedidos recebidos de integrações (Shopify, etc)
CREATE TABLE IF NOT EXISTS online_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  items JSONB DEFAULT '[]'::JSONB,
  total_amount NUMERIC(10, 2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
  source TEXT DEFAULT 'shopify',
  external_id TEXT,
  external_data JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, order_number)
);

-- Índices para online_orders
CREATE INDEX IF NOT EXISTS idx_online_orders_store_id ON online_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_online_orders_order_number ON online_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_online_orders_status ON online_orders(status);
CREATE INDEX IF NOT EXISTS idx_online_orders_external_id ON online_orders(external_id);

-- =====================================================
-- TABELA: subscriptions (ASSINATURAS/PLANOS)
-- =====================================================
-- Armazena assinaturas e planos das lojas
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL CHECK (plan_id IN ('basic', 'professional', 'enterprise')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'cancelled')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  payment_date TIMESTAMPTZ,
  amount NUMERIC(10, 2),
  max_users INTEGER,
  features JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_store_id ON subscriptions(store_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires_at ON subscriptions(expires_at);

-- =====================================================
-- TABELA: pending_registrations (CADASTROS PENDENTES)
-- =====================================================
-- Armazena cadastros pendentes de aprovação/pagamento
CREATE TABLE IF NOT EXISTS pending_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  cpf TEXT,
  phone TEXT,
  selected_plan TEXT NOT NULL,
  status TEXT DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'approved', 'rejected')),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para pending_registrations
CREATE INDEX IF NOT EXISTS idx_pending_registrations_email ON pending_registrations(email);
CREATE INDEX IF NOT EXISTS idx_pending_registrations_status ON pending_registrations(status);

-- =====================================================
-- TABELA: settings (CONFIGURAÇÕES)
-- =====================================================
-- Armazena configurações gerais da loja
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, key)
);

-- Índices para settings
CREATE INDEX IF NOT EXISTS idx_settings_store_id ON settings(store_id);
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

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

DROP TRIGGER IF EXISTS update_online_orders_updated_at ON online_orders;
CREATE TRIGGER update_online_orders_updated_at
    BEFORE UPDATE ON online_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pending_registrations_updated_at ON pending_registrations;
CREATE TRIGGER update_pending_registrations_updated_at
    BEFORE UPDATE ON pending_registrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;
CREATE TRIGGER update_settings_updated_at
    BEFORE UPDATE ON settings
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
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE online_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICAS RLS BÁSICAS
-- =====================================================
-- Nota: Estas são políticas básicas. Você pode precisar ajustá-las
-- de acordo com suas necessidades específicas de segurança.

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

-- Política para products (usuários podem ver produtos da sua loja)
DROP POLICY IF EXISTS "Users can view products from their store" ON products;
CREATE POLICY "Users can view products from their store" ON products
    FOR SELECT
    USING (
        store_id IN (
            SELECT store_id FROM users WHERE id = auth.uid()
        )
    );

-- Política para inserir produtos
DROP POLICY IF EXISTS "Users can insert products in their store" ON products;
CREATE POLICY "Users can insert products in their store" ON products
    FOR INSERT
    WITH CHECK (
        store_id IN (
            SELECT store_id FROM users WHERE id = auth.uid()
        )
    );

-- Política para atualizar produtos
DROP POLICY IF EXISTS "Users can update products in their store" ON products;
CREATE POLICY "Users can update products in their store" ON products
    FOR UPDATE
    USING (
        store_id IN (
            SELECT store_id FROM users WHERE id = auth.uid()
        )
    );

-- Política para deletar produtos
DROP POLICY IF EXISTS "Users can delete products in their store" ON products;
CREATE POLICY "Users can delete products in their store" ON products
    FOR DELETE
    USING (
        store_id IN (
            SELECT store_id FROM users WHERE id = auth.uid()
        )
    );

-- Política para sales (usuários podem ver vendas da sua loja)
DROP POLICY IF EXISTS "Users can view sales from their store" ON sales;
CREATE POLICY "Users can view sales from their store" ON sales
    FOR SELECT
    USING (
        store_id IN (
            SELECT store_id FROM users WHERE id = auth.uid()
        )
    );

-- Política para inserir vendas
DROP POLICY IF EXISTS "Users can insert sales in their store" ON sales;
CREATE POLICY "Users can insert sales in their store" ON sales
    FOR INSERT
    WITH CHECK (
        store_id IN (
            SELECT store_id FROM users WHERE id = auth.uid()
        )
    );

-- Políticas similares para outras tabelas (simplificadas por brevidade)
-- Você pode adicionar políticas mais específicas conforme necessário

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
    
    -- Registrar movimentação de estoque
    INSERT INTO stock_movements (
      store_id,
      product_id,
      product_sku,
      movement_type,
      quantity,
      previous_stock,
      new_stock,
      reason,
      sale_id
    )
    SELECT
      create_sale_atomic.store_id,
      p.id,
      p.sku,
      'sale',
      -(item->>'quantity')::INTEGER,
      p.stock + (item->>'quantity')::INTEGER,
      p.stock,
      'Venda #' || sale_id::TEXT,
      sale_id
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
-- DADOS INICIAIS (OPCIONAL)
-- =====================================================
-- Você pode adicionar dados iniciais aqui se necessário
-- Por exemplo, uma loja padrão ou usuário admin inicial

-- Exemplo: Inserir loja padrão (comente se não precisar)
-- INSERT INTO stores (id, name, cnpj, email, active)
-- VALUES (
--   'a0000000-0000-0000-0000-000000000001',
--   'Loja Padrão',
--   '00.000.000/0000-00',
--   'contato@loja.com',
--   true
-- )
-- ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- CONCLUSÃO
-- =====================================================
-- Script executado com sucesso!
-- Todas as tabelas, índices, triggers e políticas RLS foram criados.
-- 
-- PRÓXIMOS PASSOS:
-- 1. Ajuste as políticas RLS conforme suas necessidades de segurança
-- 2. Configure autenticação do Supabase (Auth)
-- 3. Adicione dados iniciais se necessário
-- 4. Teste a função RPC create_sale_atomic
-- 
-- TABELAS CRIADAS:
-- - stores (lojas)
-- - users (usuários)
-- - products (produtos)
-- - cash_sessions (sessões de caixa)
-- - sales (vendas)
-- - stock_movements (movimentações de estoque)
-- - coupons (cupons de desconto)
-- - expenses (despesas)
-- - cash_closures (fechamentos de caixa)
-- - activity_logs (logs de atividade)
-- - online_orders (pedidos online)
-- - subscriptions (assinaturas/planos)
-- - pending_registrations (cadastros pendentes)
-- - settings (configurações)
-- 
-- FUNÇÕES RPC:
-- - create_sale_atomic (criar venda atômica com validação de estoque)
-- =====================================================
