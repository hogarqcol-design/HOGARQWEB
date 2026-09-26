'use strict';
const {HttpError} = require('./http');
function config() {
  const env = process.env;
  // Vercel's Upstash integration creates KV_REST_API_*; accept those names
  // directly while retaining the explicit UPSTASH_REDIS_REST_* names.
  const redisUrl = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const redisToken = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  const production = env.PAYMENT_MODE === 'production';
  const site = env.SITE_URL || (env.VERCEL_BRANCH_URL ? 'https://' + env.VERCEL_BRANCH_URL : '');
  let validSite = false;
  try { const u = new URL(site); validSite = u.protocol === 'https:' && !u.username && !u.password && u.pathname === '/' && !u.search && !u.hash; } catch {}
  const modeValid = ['test', 'production'].includes(env.PAYMENT_MODE);
  const ready = env.CHECKOUT_ENABLED === 'true' && modeValid && validSite &&
    (!production || env.VERCEL_ENV === 'production') &&
    ['MERCADOPAGO_ACCESS_TOKEN','MERCADOPAGO_WEBHOOK_SECRET','RESEND_API_KEY'].every(k => !!env[k]) && !!redisUrl && !!redisToken;
  let webhookUrl = site.replace(/\/$/, '')+'/api/mercadopago-webhook?source_news=webhooks';
  if (!production && env.VERCEL_AUTOMATION_BYPASS_SECRET) webhookUrl += '&x-vercel-protection-bypass='+encodeURIComponent(env.VERCEL_AUTOMATION_BYPASS_SECRET);
  return {ready: !!ready, production, site: site.replace(/\/$/, ''), webhookUrl,
    token: env.MERCADOPAGO_ACCESS_TOKEN, secret: env.MERCADOPAGO_WEBHOOK_SECRET,
    redisUrl, redisToken,
    resend: env.RESEND_API_KEY, from: env.EMAIL_FROM || 'Hogarq <pedidos@hogarq.store>',
    merchant: env.ORDER_EMAIL || 'hogarqcol@gmail.com', testEmail: env.TEST_EMAIL || 'hogarqcol@gmail.com'};
}
function requireConfig() {
  const c = config();
  if (!c.ready) throw new HttpError(503, 'Los pagos en línea aún no están disponibles. Puedes hacer tu pedido por Instagram.');
  return c;
}
module.exports = {config, requireConfig};
