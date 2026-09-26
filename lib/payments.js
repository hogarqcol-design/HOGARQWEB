'use strict';
const {createHmac, timingSafeEqual} = require('node:crypto');
const {request, HttpError} = require('./http');
const {getOrder, saveOrder, withLock} = require('./store');
const {sendReceipts} = require('./receipts');
async function mp(c, path, data) {
  return request('https://api.mercadopago.com'+path, {
    method:data ? 'POST' : 'GET',
    headers:{Authorization:'Bearer '+c.token,'Content-Type':'application/json'},
    ...(data ? {body:JSON.stringify(data)} : {})
  });
}
function validSignature(headers, id, secret) {
  if (!secret || !/^\d+$/.test(id) || typeof headers['x-request-id'] !== 'string') return false;
  const signature = String(headers['x-signature'] || '').split(',').map(p=>p.trim().split('='));
  const ts = signature.find(([k])=>k==='ts')?.[1];
  if (!/^\d+$/.test(ts || '')) return false;
  const expected = createHmac('sha256',secret).update(`id:${id};request-id:${headers['x-request-id']};ts:${ts};`).digest();
  return signature.filter(([k])=>k==='v1').some(([,value])=>/^[0-9a-f]{64}$/i.test(value || '') && timingSafeEqual(expected,Buffer.from(value,'hex')));
}
async function settlePayment(c, paymentId) {
  if (!/^\d+$/.test(String(paymentId))) throw new HttpError(400,'Pago inválido.');
  const payment = await mp(c,'/v1/payments/'+paymentId);
  const id = payment.external_reference;
  if (!require('./orders').UUID.test(id || '')) return;
  const known = await getOrder(id);
  if (!known) return;
  return withLock('order:'+id,async()=>{
    const order = await getOrder(id);
    if (!order.preferenceId) throw new HttpError(503,'El pedido aún se está preparando.');
    if (String(payment.collector_id) !== String(order.sellerId) || payment.currency_id !== 'COP' ||
      Number(payment.transaction_amount) !== order.total || payment.live_mode !== c.production ||
      payment.metadata?.hogarq_order_id !== order.id) throw new HttpError(422,'El pago no corresponde a este pedido.');
    const merchantOrderId = String(payment.order?.id || '');
    if (!/^\d+$/.test(merchantOrderId)) throw new HttpError(503,'El pago todavía se está sincronizando.');
    const merchantOrder = await mp(c,'/merchant_orders/'+merchantOrderId);
    if (String(merchantOrder.preference_id) !== String(order.preferenceId)) throw new HttpError(422,'Referencia de pago inválida.');
    const approved = payment.status === 'approved' && !(Number(payment.transaction_amount_refunded) > 0);
    if (approved && !order.paymentId) {
      order.paymentId = String(payment.id);
      order.paidAt = payment.date_approved || new Date().toISOString();
      order.status = 'approved';
    } else if (order.paymentId === String(payment.id)) {
      // A refund or chargeback must never continue to display as a valid paid order.
      order.status = Number(payment.transaction_amount_refunded) > 0 ? 'refunded' : payment.status;
    } else if (!order.paymentId) {
      order.status = ['pending','in_process','authorized'].includes(payment.status) ? 'pending' : payment.status;
    } else if (approved && order.paymentId !== String(payment.id)) {
      order.additionalPaymentIds = [...new Set([...(order.additionalPaymentIds || []),String(payment.id)])];
      console.error('hogarq_duplicate_payment_review',order.id);
    }
    await saveOrder(order);
    if (order.status === 'approved') await sendReceipts(c,order);
    return order;
  });
}
async function reconcile(c, order) {
  const result = await mp(c,'/v1/payments/search?external_reference='+encodeURIComponent(order.id)+'&sort=date_created&criteria=desc&limit=20');
  // Only payment IDs come from the search. Every payment is fetched and verified again.
  const candidates = (result.results || []).slice(0,3);
  if (order.paymentId && !candidates.some(p=>String(p.id)===order.paymentId)) candidates.unshift({id:order.paymentId});
  for (const payment of candidates) await settlePayment(c,payment.id);
  return getOrder(order.id);
}
module.exports = {mp, validSignature, settlePayment, reconcile};
