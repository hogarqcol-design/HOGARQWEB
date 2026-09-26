'use strict';
const {HttpError} = require('./http');
function config() {
  const env = process.env;
  const production = env.PAYMENT_MODE === 'production';
  const site = env.SITE_URL || (env.VERCEL_BRANCH_URL ? 'https://' + env.VERCEL_BRANCH_URL : '');
  let validSite = false;
  try { const u = new URL(site); validSite = u.protocol === 'https:' && !u.username && !u.password && u.pathname === '/' && !u.search && !u.hash; } catch {}
  const modeValid = ['test', 'production'].includes(env.PAYMENT_MODE);
  const ready = env.CHECKOUT_ENABLED === 'true' && modeValid && validSite &&
    (!production || env.VERCEL_ENV === 'production') &&
    ['MERCADOPAGO_ACCESS_TOKEN','MERCADOPAGO_WEBHOOK_SECRET','RESEND_API_KEY','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN'].every(k => !!env[k]);
  let webhookUrl = site.replace(/\/$/, '')+'/api/mercadopago-webhook?source_news=webhooks';
  if (!production && env.VERCEL_AUTOMATION_BYPASS_SECRET) webhookUrl += '&x-vercel-protection-bypass='+encodeURIComponent(env.VERCEL_AUTOMATION_BYPASS_SECRET);
  return {ready: !!ready, production, site: site.replace(/\/$/, ''), webhookUrl,
    token: env.MERCADOPAGO_ACCESS_TOKEN, secret: env.MERCADOPAGO_WEBHOOK_SECRET,
    resend: env.RESEND_API_KEY, from: env.EMAIL_FROM || 'Hogarq <pedidos@hogarq.store>',
    merchant: env.ORDER_EMAIL || 'hogarqcol@gmail.com', testEmail: env.TEST_EMAIL || 'hogarqcol@gmail.com'};
}
function requireConfig() {
  const c = config();
  if (!c.ready) throw new HttpError(503, 'Los pagos en línea aún no están disponibles. Puedes hacer tu pedido por Instagram.');
  return c;
}
module.exports = {config, requireConfig};
