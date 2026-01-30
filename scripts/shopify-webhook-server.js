// Servidor de Webhook da Shopify (Node/Express) com validação HMAC
// Uso:
// 1) Configure a variável de ambiente SHOPIFY_WEBHOOK_SECRET (API secret do app Shopify)
// 2) Rode: npm run webhook:server
// 3) Exponha via túnel (ngrok/cloudflared) e cadastre a URL na Shopify

import express from 'express';
import crypto from 'crypto';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

// Import dinâmico para evitar problemas com Vite/import.meta
const processShopifyWebhook = async (webhookData, topic, shopDomain) => {
  const { db } = await import('../services/db.js');
  const { supabaseDB } = await import('../services/supabaseDB.js');
  
  try {
    // Extrair dados do webhook da Shopify
    const order = webhookData.order || webhookData;
    
    // Extrair informações do cliente
    const customer = order.customer || {};
    const customerName = customer.first_name && customer.last_name 
      ? `${customer.first_name} ${customer.last_name}`
      : customer.first_name || customer.name || "Cliente";
    const customerPhone = customer.phone || "";
    
    // Extrair endereço de entrega
    const shippingAddress = order.shipping_address || order.billing_address || {};
    const formattedAddress = {
      street: shippingAddress.address1 || "",
      number: shippingAddress.address2 || "",
      complement: shippingAddress.address3 || "",
      neighborhood: shippingAddress.city || "",
      city: shippingAddress.city || "",
      state: shippingAddress.province_code || shippingAddress.province || "",
      zipCode: shippingAddress.zip || shippingAddress.postal_code || ""
    };
    
    // Função auxiliar para mapear método de pagamento
    function mapPaymentMethod(order) {
      const status = (order.financial_status || '').toLowerCase();
      const gateways = Array.isArray(order.payment_gateway_names) ? order.payment_gateway_names.map(g => g.toLowerCase()) : [];
      if (status === 'paid') {
        if (gateways.some(g => g.includes('pix'))) return 'pix_direto';
        if (gateways.some(g => g.includes('debit'))) return 'debit';
        if (gateways.some(g => g.includes('credit') || g.includes('visa') || g.includes('mastercard') || g.includes('amex'))) return 'credit';
        return 'credit';
      }
      return 'money';
    }
    
    // Extrair itens do pedido
    const lineItems = order.line_items || [];
    const items = await Promise.all(lineItems.map(async item => {
      const productCode = item.sku || item.variant_id?.toString() || "";
      let product = db.products.findByCode(productCode) || 
                     db.products.list().find(p => 
                       p.code === productCode || 
                       p.code?.includes(productCode) ||
                       productCode.includes(p.code)
                     );
      
      let productId = null;
      try {
        const sbdProduct = await supabaseDB.products.findByCode(productCode);
        if (sbdProduct) {
          productId = sbdProduct.id;
          if (!product) {
            product = { id: sbdProduct.id, name: sbdProduct.name, stock: sbdProduct.stock, code: sbdProduct.sku };
          }
        }
      } catch (e) {
        // ignore
      }
      
      // Atualizar estoque APENAS no Supabase (não usa localStorage)
      if (product && productId) {
        const quantityToDeduct = item.quantity || 1;
        const currentStock = product.stock || 0;
        const newStock = Math.max(0, currentStock - quantityToDeduct);
        
        console.log(`[Shopify Webhook] Decrementando estoque no Supabase: ${product.name} - ${currentStock} → ${newStock} (${quantityToDeduct} unid.)`);
        
        try {
          await supabaseDB.products.updateStock(productId, newStock, {
            name: "Sistema Shopify",
            cpf: "00000000000",
            role: "admin"
          });
          console.log(`[Shopify Webhook] ✓ Estoque atualizado no Supabase: ${product.name}`);
        } catch (updateError) {
          console.error(`[Shopify Webhook] ❌ Erro ao atualizar estoque de ${product.name}:`, updateError);
        }
      } else if (product && !productId) {
        console.warn(`[Shopify Webhook] ⚠ Produto encontrado localmente mas sem ID do Supabase: ${productCode}`);
      } else {
        console.warn(`[Shopify Webhook] ⚠ Produto não encontrado para SKU: ${productCode}`);
      }
      
      return {
        name: item.name || item.title || "Produto",
        code: productCode,
        sku: item.sku || "",
        quantity: item.quantity || 1,
        price: parseFloat(item.price || item.price_set?.shop_money?.amount || 0),
        image: item.image?.src || item.variant?.image || "",
        product_id: productId || product?.id || null
      };
    }));
    
    // Criar pedido
    const firstItem = items[0] || {};
    const newOrder = {
      orderNumber: order.order_number?.toString() || order.name || order.id?.toString(),
      customerName: customerName,
      customerPhone: customerPhone,
      productName: firstItem.name || order.line_items?.[0]?.name || "Produto",
      productCode: firstItem.code || firstItem.sku || "",
      productImage: firstItem.image || "",
      quantity: firstItem.quantity || order.line_items?.[0]?.quantity || 1,
      totalAmount: parseFloat(order.total_price || order.total || 0),
      paymentMethod: mapPaymentMethod(order),
      shippingAddress: formattedAddress,
      items: items,
      status: "aguardo",
      shopifyOrderId: order.id?.toString() || "",
      shopifyOrderName: order.name || ""
    };
    
    console.log(`[Shopify Webhook] 📦 Salvando pedido #${newOrder.orderNumber} na aba Online`);
    const savedOrder = db.onlineOrders.create(newOrder, { 
      name: "Sistema", 
      cpf: "00000000000",
      role: "admin"
    });
    console.log(`[Shopify Webhook] ✓ Pedido salvo com ID: ${savedOrder.id}`);
    
    // Se foi pagamento (orders/paid), criar venda no Supabase
    if ((topic || '').includes('orders/paid') || (topic || '').includes('paid')) {
      console.log(`[Shopify Webhook] 💳 Pedido PAGO - criando venda no Supabase...`);
      try {
        const external_id = order.id ? `shopify-${order.id}` : crypto.randomUUID();
        const saleData = {
          items: items.map(it => ({
            product_id: it.product_id,
            quantity: it.quantity,
            code: it.code,
            sku: it.sku,
            name: it.name,
            price: it.price,
          })).filter(it => it.product_id),
          total_amount: parseFloat(order.total_price || 0),
          payment_method: mapPaymentMethod(order),
          status: 'finalized'
        };
        
        if (saleData.items.length > 0) {
          const result = await supabaseDB.sales.callCreateSaleAtomic(saleData, external_id);
          if (result.status === 'ok' && result.sale_id) {
            await db.onlineOrders.update(savedOrder.id, { 
              saleId: result.sale_id, 
              status: 'processo' 
            }, { name: 'Sistema', cpf: '00000000000', role: 'admin' });
            console.log(`[Shopify Webhook] ✓ Venda criada (ID: ${result.sale_id}) e pedido atualizado`);
          } else {
            console.warn(`[Shopify Webhook] ⚠ Falha ao criar venda:`, result);
          }
        } else {
          console.warn(`[Shopify Webhook] ⚠ Nenhum item válido para criar venda`);
        }
      } catch (err) {
        console.error('[Shopify Webhook] ❌ Erro ao criar venda:', err);
      }
    }
    
    return { success: true, order: savedOrder };
  } catch (error) {
    console.error("[Shopify Webhook] Erro ao processar:", error);
    return { success: false, error: error.message };
  }
};

const app = express();

// Capturar o corpo bruto para validar o HMAC corretamente
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

const PORT = process.env.PORT || 3001;
const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET || '';
const SKIP_HMAC = process.env.SKIP_HMAC === 'true';

function verifyShopifyHmac(req) {
  if (SKIP_HMAC) return true;
  if (!SHOPIFY_WEBHOOK_SECRET) {
    console.warn('[Webhook] SHOPIFY_WEBHOOK_SECRET não configurado. Defina a variável de ambiente.');
    return false;
  }
  try {
    const hmacHeader = req.get('X-Shopify-Hmac-SHA256') || '';
    const computed = crypto
      .createHmac('sha256', SHOPIFY_WEBHOOK_SECRET)
      .update(req.rawBody || Buffer.from(''))
      .digest('base64');
    const valid = crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hmacHeader));
    if (!valid) {
      console.warn('[Webhook] HMAC inválido. Recebido=', hmacHeader, ' Computado=', computed);
    }
    return valid;
  } catch (err) {
    console.error('[Webhook] Erro ao validar HMAC:', err);
    return false;
  }
}

app.get('/health', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.post('/webhook/shopify', async (req, res) => {
  try {
    if (!verifyShopifyHmac(req)) {
      return res.status(401).json({ success: false, error: 'Assinatura inválida' });
    }

    const topic = req.get('X-Shopify-Topic') || 'unknown';
    const shop = req.get('X-Shopify-Shop-Domain') || 'unknown';
    console.log(`[Webhook] Recebido tópico=${topic} loja=${shop}`);

    const result = await processShopifyWebhook(req.body, topic, shop);
    if (result.success) {
      return res.status(200).json({ success: true });
    }
    return res.status(400).json({ success: false, error: result.error || 'Falha ao processar webhook' });
  } catch (err) {
    console.error('[Webhook] Erro inesperado:', err);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

app.listen(PORT, () => {
  console.log(`[Webhook] Servidor iniciado na porta ${PORT}`);
  if (!SHOPIFY_WEBHOOK_SECRET && !SKIP_HMAC) {
    console.warn('[Webhook] Atenção: defina SHOPIFY_WEBHOOK_SECRET para validação HMAC.');
  }
});
