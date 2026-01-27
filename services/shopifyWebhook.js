// Função para processar webhook da Shopify e criar pedido no sistema
import { db } from "./db.js";
import { supabaseDB } from "./supabaseDB.js";
import crypto from "crypto";

function mapPaymentMethod(order) {
  const status = (order.financial_status || '').toLowerCase();
  const gateways = Array.isArray(order.payment_gateway_names) ? order.payment_gateway_names.map(g => g.toLowerCase()) : [];
  // Mapeamento simples para os métodos suportados no sistema
  if (status === 'paid') {
    if (gateways.some(g => g.includes('pix'))) return 'pix_direto';
    if (gateways.some(g => g.includes('debit'))) return 'debit';
    if (gateways.some(g => g.includes('credit') || g.includes('visa') || g.includes('mastercard') || g.includes('amex'))) return 'credit';
    return 'credit';
  }
  return 'money';
}

export async function processShopifyWebhook(webhookData, topic = 'unknown', shopDomain = '') {
  try {
    // Extrair dados do webhook da Shopify
    // Formato esperado do webhook da Shopify (order/paid ou order/created)
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
    
    // Extrair itens do pedido
    const lineItems = order.line_items || [];
    const items = await Promise.all(lineItems.map(async item => {
      // Tentar encontrar produto no sistema pelo SKU ou código
      const productCode = item.sku || item.variant_id?.toString() || "";
      let product = db.products.findByCode(productCode) || 
                     db.products.list().find(p => 
                       p.code === productCode || 
                       p.code?.includes(productCode) ||
                       productCode.includes(p.code)
                     );
      // Tentar também no Supabase para obter product_id
      let productId = null;
      try {
        const sbdProduct = await supabaseDB.products.findByCode(productCode);
        if (sbdProduct) {
          productId = sbdProduct.id;
          // se local não tiver, criar referência mínima
          if (!product) {
            product = { id: sbdProduct.id, name: sbdProduct.name, stock: sbdProduct.stock, code: sbdProduct.sku };
          }
        }
      } catch (e) {
        // ignore
      }
      
      // Se encontrou o produto, atualizar estoque
      if (product) {
        const quantityToDeduct = item.quantity || 1;
        const currentStock = product.stock || 0;
        const newStock = Math.max(0, currentStock - quantityToDeduct);
        
        // Atualizar estoque do produto (sem usuário, pois é automático)
        db.products.update(product.id, { stock: newStock }, { 
          name: "Sistema Shopify", 
          cpf: "00000000000",
          role: "admin"
        });
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
    
    // Se houver apenas um item, usar dados simplificados
    const firstItem = items[0] || {};
    
    // Criar pedido no sistema
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
    
    // Salvar pedido (sem usuário, pois é automático)
    const savedOrder = db.onlineOrders.create(newOrder, { 
      name: "Sistema", 
      cpf: "00000000000",
      role: "admin"
    });
    
    // Se foi pagamento do pedido, criar venda no Supabase
    if ((topic || '').includes('orders/paid')) {
      try {
        const external_id = (order.id ? `shopify-${order.id}` : crypto.randomUUID());
        const saleData = {
          items: items.map(it => ({
            product_id: it.product_id,
            quantity: it.quantity,
            code: it.code,
            sku: it.sku,
            name: it.name,
            price: it.price,
          })),
          total_amount: parseFloat(order.total_price || 0),
          payment_method: mapPaymentMethod(order),
          status: 'finalized'
        };
        const result = await supabaseDB.sales.callCreateSaleAtomic(saleData, external_id);
        if (result.status === 'ok' && result.sale_id) {
          // vincular o pedido online à venda
          await db.onlineOrders.update(savedOrder.id, { saleId: result.sale_id, status: 'processo' }, { name: 'Sistema', cpf: '00000000000', role: 'admin' });
        }
      } catch (err) {
        console.error('Erro ao criar venda no Supabase via webhook:', err);
      }
    }
    
    return { success: true, order: savedOrder };
  } catch (error) {
    console.error("Erro ao processar webhook da Shopify:", error);
    return { success: false, error: error.message };
  }
}

// Função para criar endpoint de webhook (para uso em servidor)
export function createWebhookEndpoint() {
  // Esta função pode ser usada em um servidor Node.js/Express
  // Exemplo:
  /*
  app.post('/webhook/shopify', async (req, res) => {
    const topic = req.get('X-Shopify-Topic') || 'unknown';
    const shop = req.get('X-Shopify-Shop-Domain') || '';
    const result = await processShopifyWebhook(req.body, topic, shop);
    if (result.success) {
      res.status(200).json({ success: true });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  });
  */
}

