// Função para processar webhook da Shopify e criar pedido no sistema
import { db } from "./db";

export function processShopifyWebhook(webhookData) {
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
    const items = lineItems.map(item => {
      // Tentar encontrar produto no sistema pelo SKU ou código
      const productCode = item.sku || item.variant_id?.toString() || "";
      const product = db.products.findByCode(productCode) || 
                     db.products.list().find(p => 
                       p.code === productCode || 
                       p.code?.includes(productCode) ||
                       productCode.includes(p.code)
                     );
      
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
        price: parseFloat(item.price || 0),
        image: item.image?.src || item.variant?.image || ""
      };
    });
    
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
      paymentMethod: order.financial_status === "paid" ? "Pago" : order.payment_gateway_names?.[0] || "Pendente",
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
  app.post('/webhook/shopify', (req, res) => {
    const result = processShopifyWebhook(req.body);
    if (result.success) {
      res.status(200).json({ success: true });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  });
  */
}

