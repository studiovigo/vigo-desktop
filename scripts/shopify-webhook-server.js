// Servidor de Webhook da Shopify (Node/Express) com validação HMAC
// Uso:
// 1) Configure a variável de ambiente SHOPIFY_WEBHOOK_SECRET (API secret do app Shopify)
// 2) Rode: npm run webhook:server
// 3) Exponha via túnel (ngrok/cloudflared) e cadastre a URL na Shopify

import express from 'express';
import crypto from 'crypto';
import { processShopifyWebhook } from '../services/shopifyWebhook.js';

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
