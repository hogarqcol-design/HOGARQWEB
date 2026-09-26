const {timingSafeEqual} = require('node:crypto');
const {endpoint,json,HttpError} = require('../lib/http');
const {requireConfig} = require('../lib/config');
const {UUID} = require('../lib/orders');
const {getOrder,rateLimit} = require('../lib/store');
const {reconcile} = require('../lib/payments');
module.exports = endpoint('GET',async(req,res)=>{
  const c = requireConfig();
  const id = new URL(req.url,'https://hogarq.store').searchParams.get('id');
  if (!UUID.test(id || '')) throw new HttpError(400,'Pedido inválido.');
  await rateLimit(req,'status',100);
  let order = await getOrder(id);
  const token = String(req.headers.authorization || '').replace(/^Bearer /,'');
  if (!order || Buffer.byteLength(token) !== Buffer.byteLength(order.accessToken) || !timingSafeEqual(Buffer.from(token),Buffer.from(order.accessToken))) throw new HttpError(404,'No encontramos el pedido en esta sesión. Revisa el correo o contáctanos por Instagram.');
  // Reconcile if the webhook was delayed, including when the buyer returned immediately.
  // Do not trust status/payment_id query parameters supplied by the browser.
  let verificationDelayed = false;
  try { order = await reconcile(c,order); } catch {
    verificationDelayed = true;
    console.error('hogarq_order_verification_delayed');
    order = await getOrder(id);
  }
  json(res,200,{id:order.id,status:order.status,total:order.total,delivery:order.delivery,test:!c.production,verificationDelayed,
    emailAccepted:!!order.receipts?.customer?.sentAt});
});
