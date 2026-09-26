const {endpoint,json,HttpError} = require('../lib/http');
const {requireConfig} = require('../lib/config');
const {validSignature,settlePayment} = require('../lib/payments');
module.exports = endpoint('POST',async(req,res)=>{
  const c = requireConfig();
  const params = new URL(req.url,'https://hogarq.store').searchParams;
  const topic = params.get('type') || req.body?.type;
  if (topic !== 'payment') { json(res,200,{received:true}); return; }
  const id = params.get('data.id') || '';
  if (!validSignature(req.headers,id,c.secret)) throw new HttpError(401,'Firma inválida.');
  await settlePayment(c,id);
  json(res,200,{received:true});
});
