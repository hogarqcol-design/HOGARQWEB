const {createHash,randomUUID} = require('node:crypto');
const {endpoint,json,body,HttpError} = require('../lib/http');
const {requireConfig} = require('../lib/config');
const {normalize} = require('../lib/orders');
const {getOrder,saveOrder,withLock,rateLimit} = require('../lib/store');
const {mp} = require('../lib/payments');
module.exports = endpoint('POST',async(req,res)=>{
  const c = requireConfig();
  const origins = [c.site,process.env.VERCEL_URL ? 'https://'+process.env.VERCEL_URL : null];
  if (!origins.includes(req.headers.origin)) throw new HttpError(403,'Origen no permitido.');
  const input = await body(req), normalized = normalize(input);
  await rateLimit(req,'checkout',20);
  const fingerprint = createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  const result = await withLock('order:'+input.requestId,async()=>{
    let order = await getOrder(input.requestId);
    if (order && order.fingerprint !== fingerprint) throw new HttpError(409,'El pedido cambió. Actualiza el carrito e inténtalo de nuevo.');
    if (order?.paymentId) throw new HttpError(409,'Este pedido ya tiene un pago. Consulta su estado antes de volver a pagar.');
    if (order?.checkoutUrl) {
      if (Date.now()-order.createdAt > 86400000) throw new HttpError(409,'Este enlace de pago venció. Inicia un pedido nuevo.');
      return order;
    }
    if (!order) {
      const seller = await mp(c,'/users/me');
      if (seller.site_id !== 'MCO' || (c.production && seller.tags?.includes('test_user'))) throw new HttpError(503,'La cuenta de pagos necesita revisión.');
      if (!c.production && !seller.tags?.includes('test_user')) throw new HttpError(503,'Configura las credenciales del vendedor de prueba de Mercado Pago.');
      order = {...normalized,id:input.requestId,fingerprint,sellerId:seller.id,status:'pending',createdAt:Date.now(),accessToken:randomUUID()};
      await saveOrder(order);
    }
    const back = c.site+'/?order='+order.id+'#pedido';
    const preference = await mp(c,'/checkout/preferences',{
      external_reference:order.id,
      metadata:{hogarq_order_id:order.id},
      items:[...order.items.map(i=>({id:String(i.id)+'-'+i.color,title:'Hogarq · '+i.name+' · '+i.color,quantity:i.quantity,unit_price:i.price,currency_id:'COP'})),
        {id:'shipping',title:'Envío · '+order.customer.city,quantity:1,unit_price:order.shipping,currency_id:'COP'}],
      // A real shopper email must not be used as a sandbox Mercado Pago account.
      ...(c.production ? {payer:{name:order.customer.name,email:order.customer.email}} : {}),
      back_urls:{success:back,pending:back,failure:back},auto_return:'approved',
      notification_url:c.webhookUrl,
      statement_descriptor:'HOGARQ',expires:true,
      expiration_date_to:new Date(order.createdAt+86400000).toISOString()
    });
    const checkoutUrl = c.production ? preference.init_point : preference.sandbox_init_point;
    let target;
    try { target = new URL(checkoutUrl); } catch { throw new Error('Missing checkout URL'); }
    if (target.protocol !== 'https:' || !['www.mercadopago.com.co','sandbox.mercadopago.com.co'].includes(target.hostname)) throw new Error('Invalid checkout host');
    order.preferenceId = preference.id;
    order.checkoutUrl = checkoutUrl;
    await saveOrder(order);
    return order;
  });
  json(res,200,{id:result.id,checkoutUrl:result.checkoutUrl,accessToken:result.accessToken,total:result.total,shipping:result.shipping});
});
