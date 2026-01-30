# 🚀 Guia de Integração Webhook Shopify

## ✅ O que foi configurado

1. **Webhook `orders/paid`** está configurado no `shopify.app.toml`
2. **Servidor webhook** pronto em `scripts/shopify-webhook-server.js`
3. **Processamento automático** que:
  - ✅ Recebe pedidos pagos da Shopify
  - ✅ Salva na aba "Online" do sistema
  - ✅ Decrementa estoque automaticamente **APENAS no Supabase**
  - ✅ Cria venda no Supabase
  - ⚠️ **Não usa localStorage para estoque** - tudo gerenciado pelo Supabase

---

## 📋 Passo a Passo para Ativar

### 1. Iniciar o servidor webhook

No terminal (PowerShell):

```bash
npm run webhook:server
```

O servidor iniciará na porta **3001** (ou a porta definida no `.env`).

### 2. Expor o servidor publicamente

A Shopify precisa de uma URL pública. Use **ngrok** (recomendado):

#### Instalar ngrok:
```bash
# Via Chocolatey (Windows)
choco install ngrok

# Ou baixar diretamente de: https://ngrok.com/download
```

#### Iniciar túnel:
```bash
ngrok http 3001
```

Você verá algo como:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:3001
```

**Copie a URL `https://abc123.ngrok.io`**

### 3. Configurar webhook na Shopify

1. Acesse: https://admin.shopify.com/store/lb-test-6909/settings/notifications/webhooks
2. Clique em **"Create webhook"**
3. Configure:
   - **Event:** `Order payment` (orders/paid)
   - **URL:** `https://abc123.ngrok.io/webhook/shopify`
   - **Format:** `JSON`
4. Salve

---

## 🧪 Testar a Integração

### Teste manual via curl:

```bash
curl -X POST http://localhost:3001/webhook/shopify \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Topic: orders/paid" \
  -H "X-Shopify-Shop-Domain: lb-test-6909.myshopify.com" \
  -d '{
    "order": {
      "id": 123456789,
      "order_number": 1001,
      "name": "#1001",
      "total_price": "150.00",
      "financial_status": "paid",
      "customer": {
        "first_name": "João",
        "last_name": "Silva",
        "phone": "+5511999999999"
      },
      "line_items": [
        {
          "name": "Produto Teste",
          "sku": "VIGO-001",
          "quantity": 2,
          "price": "75.00"
        }
      ]
    }
  }'
```

### Teste real:

1. Faça um pedido de teste na sua loja Shopify
2. Marque como pago
3. Verifique:
   - ✅ Console do servidor webhook (deve mostrar logs)
   - ✅ Aba "Online" no sistema (pedido deve aparecer)
   - ✅ Estoque do produto (deve ter decrementado)

---

## 🔧 Troubleshooting

### Erro "HMAC inválido"
- Certifique-se que `SHOPIFY_WEBHOOK_SECRET` no `.env` está correto
- Ou defina `SKIP_HMAC=true` para testes locais

### Produto não encontrado
- Verifique se o SKU do produto na Shopify corresponde ao `code` no seu sistema
- Logs mostrarão `⚠ Produto não encontrado para SKU: XXX`

### Pedido não aparece na aba Online
- Verifique se o webhook foi recebido (logs no terminal)
- Confirme que o tópico é `orders/paid`

---

## 📦 Produção

Para ambiente de produção, recomendamos:

1. **Deploy do servidor webhook** em:
   - Heroku (gratuito)
   - Vercel
   - AWS Lambda
   - Railway

2. **Configurar domínio permanente** (não usar ngrok em produção)

3. **Habilitar validação HMAC** (`SKIP_HMAC=false`)

---

## 📚 Recursos Adicionais

- [Documentação de Webhooks Shopify](https://shopify.dev/docs/apps/webhooks)
- [Validação HMAC](https://shopify.dev/docs/apps/webhooks/configuration/https#verify-a-webhook)

---

**Status Atual:** ✅ Tudo configurado e pronto para testar!
