'use strict';
const {request} = require('./http');
const {saveOrder} = require('./store');
const money = value => '$'+value.toLocaleString('es-CO')+' COP';
function receipt(c, order, merchant) {
  const buyer = order.customer;
  const prefix = c.production ? '' : '[PRUEBA · NO FABRICAR] ';
  const text = [
    c.production ? 'HOGARQ · Pago aprobado' : 'HOGARQ · SIMULACIÓN. No se ha cobrado dinero real. No fabricar ni despachar.',
    'Pedido: '+order.id, 'Referencia Mercado Pago: '+order.paymentId,
    'Pago aprobado: '+order.paidAt, '',
    ...order.items.map(i=>`${i.name} · ${i.color} · ${i.quantity} unidad(es) × ${money(i.price)} = ${money(i.price*i.quantity)}`),
    '', 'Subtotal: '+money(order.subtotal), 'Envío: '+money(order.shipping), 'Total pagado: '+money(order.total), '',
    'Nombre: '+buyer.name, 'Correo: '+buyer.email, 'Teléfono: '+buyer.phone,
    'Departamento: '+buyer.department, 'Municipio: '+buyer.city,
    'Dirección: '+buyer.address, 'Barrio: '+buyer.neighborhood,
    'Apartamento / interior: '+(buyer.apartment || 'No indicado'),
    'Indicaciones: '+(buyer.instructions || 'Sin indicaciones'), '',
    'Fabricación y entrega: '+order.delivery+' desde el pago aprobado.',
    'Este correo es informativo. No necesitas responder ni confirmar el pedido.',
    'Contacto: '+c.merchant+' · https://www.instagram.com/hogarq_col'
  ].join('\n');
  return {from:c.from,to:[c.production ? (merchant ? c.merchant : buyer.email) : c.testEmail],reply_to:c.merchant,
    subject:prefix+(merchant?'Nuevo pedido pagado':'Recibimos tu pedido')+' · Hogarq · '+order.id.slice(0,8),text};
}
async function sendReceipts(c,order) {
  order.receipts ||= {};
  for (const kind of ['merchant','customer']) {
    const saved = order.receipts[kind];
    if (saved?.sentAt) continue;
    // Persist the exact payload: Resend rejects changed payloads for an existing key.
    if (!saved) {
      order.receipts[kind] = {startedAt:Date.now(),payload:receipt(c,order,kind==='merchant')};
      await saveOrder(order);
    } else if (Date.now()-saved.startedAt > 23*60*60*1000) {
      // The provider's idempotency window is 24h. An ambiguous old send needs review.
      order.receipts[kind].needsReview = true;
      await saveOrder(order);
      console.error('hogarq_email_delivery_review',order.id,kind);
      continue;
    }
    const result = await request('https://api.resend.com/emails', {method:'POST',headers:{Authorization:'Bearer '+c.resend,'Content-Type':'application/json','Idempotency-Key':`hogarq-${c.production?'live':'test'}-${order.id}-${kind}`},body:JSON.stringify(order.receipts[kind].payload)});
    if (!result.id) throw new Error('Email delivery not accepted');
    order.receipts[kind] = {startedAt:order.receipts[kind].startedAt,sentAt:new Date().toISOString(),id:result.id};
    await saveOrder(order);
  }
}
module.exports = {receipt, sendReceipts};
