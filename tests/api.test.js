const {test,beforeEach,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const checkout=require('../api/checkout');
const webhook=require('../api/mercadopago-webhook');
const status=require('../api/order');
const originalFetch=global.fetch, originalEnv={...process.env};
const id='bb9c315a-4635-4a64-9f70-eb2882605818';
let db, mails, preferences, payment, failEmail;
const input=()=>({requestId:id,items:[{id:1,color:'rosado',quantity:2}],customer:{name:'Ana',email:'ana@example.com',phone:'3001234567',department:'Bogotá D.C.',city:'Bogotá',address:'Calle 1 # 2-3',neighborhood:'Centro',apartment:'',instructions:''},consent:true});
async function call(handler,method,url,body,headers={}){
 let result;const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},end(raw){result={status:this.statusCode,body:JSON.parse(raw),headers:this.headers};}};
 await handler({method,url,body,headers:{'content-type':'application/json',origin:'https://preview.example',...headers},socket:{remoteAddress:'127.0.0.1'}},res);return result;
}
function signed(id='123'){
 const ts='1704908010',requestId='notification';const v=createHmac('sha256','webhook-secret').update(`id:${id};request-id:${requestId};ts:${ts};`).digest('hex');return {'x-request-id':requestId,'x-signature':`ts=${ts},v1=${v}`};
}
const notify=()=>call(webhook,'POST','/api/mercadopago-webhook?data.id=123&type=payment',{},signed());
beforeEach(()=>{
 process.env={...originalEnv,CHECKOUT_ENABLED:'true',PAYMENT_MODE:'test',SITE_URL:'https://preview.example',VERCEL_ENV:'preview',MERCADOPAGO_ACCESS_TOKEN:'private-test-value',MERCADOPAGO_WEBHOOK_SECRET:'webhook-secret',RESEND_API_KEY:'resend-test',UPSTASH_REDIS_REST_URL:'https://redis.example',UPSTASH_REDIS_REST_TOKEN:'redis-test'};
 db=new Map();mails=[];preferences=[];failEmail=false;
 payment={id:123,external_reference:id,collector_id:42,currency_id:'COP',transaction_amount:220000,live_mode:false,metadata:{hogarq_order_id:id},order:{id:456},status:'approved',date_approved:'2026-09-25T00:00:00Z'};
 global.fetch=async(url,options={})=>{
  let data;
  if(url==='https://redis.example'){
   const [command,...args]=JSON.parse(options.body);let result;
   if(command==='GET')result=db.get(args[0])??null;
   else if(command==='SET'){if(args.includes('NX')&&db.has(args[0]))result=null;else{db.set(args[0],args[1]);result='OK';}}
   else if(command==='EVAL'){
    const [script,,key,token]=args;
    if(script.includes('INCR')){result=Number(db.get(key)||0)+1;db.set(key,result);}
    else{result=0;if(db.get(key)===token){db.delete(key);result=1;}}
   }else throw Error('Unsupported Redis command '+command);
   data={result};
  }else if(url.endsWith('/users/me')) data={id:42,site_id:'MCO',tags:['test_user']};
  else if(url.endsWith('/checkout/preferences')){preferences.push(JSON.parse(options.body));data={id:'pref-1',sandbox_init_point:'https://sandbox.mercadopago.com.co/checkout/v1/redirect?pref_id=pref-1'};}
  else if(url.includes('/v1/payments/search'))data={results:[payment]};
  else if(url.endsWith('/v1/payments/123'))data=payment;
  else if(url.endsWith('/merchant_orders/456'))data={preference_id:'pref-1'};
  else if(url==='https://api.resend.com/emails'){
   if(failEmail){failEmail=false;return {ok:false,status:503,json:async()=>({})};}
   mails.push({payload:JSON.parse(options.body),key:options.headers['Idempotency-Key']});data={id:'mail-'+mails.length};
  }else throw Error('Unexpected URL '+url);
  return {ok:true,status:200,json:async()=>data};
 };
});
afterEach(()=>{global.fetch=originalFetch;process.env={...originalEnv};});
test('checkout persists full order before redirect; server ignores submitted prices; retry reuses preference',async()=>{
 const body=input();body.items[0].price=1;body.total=2;body.shipping=0;
 const first=await call(checkout,'POST','/api/checkout',body);
 assert.equal(first.status,200);assert.equal(first.body.total,220000);assert.equal(first.body.shipping,20000);
 assert(!JSON.stringify(first.body).includes('Calle'));assert(!JSON.stringify(first.body).includes('private-test-value'));
 const second=await call(checkout,'POST','/api/checkout',body);assert.equal(second.body.checkoutUrl,first.body.checkoutUrl);assert.equal(preferences.length,1);
 assert.equal(preferences[0].items.reduce((s,i)=>s+i.unit_price*i.quantity,0),220000);
 const stored=JSON.parse(db.get('hogarq:test:order:'+id));assert.equal(stored.customer.neighborhood,'Centro');
 assert.equal(mails.length,0);
});
test('verified webhook sends merchant and buyer receipts once even with replay',async()=>{
 await call(checkout,'POST','/api/checkout',input());
 assert.equal((await notify()).status,200);assert.equal(mails.length,2);
 assert.equal((await notify()).status,200);assert.equal(mails.length,2);
 assert(mails.every(m=>m.payload.to[0]==='hogarqcol@gmail.com'));
 assert.match(mails[0].payload.text,/Capas.*rosado.*2 unidad/);
});
test('forged signature, wrong amount, currency, seller or live payment cannot approve an order',async()=>{
 await call(checkout,'POST','/api/checkout',input());
 assert.equal((await call(webhook,'POST','/api/mercadopago-webhook?data.id=123&type=payment',{})).status,401);
 for(const [key,value] of [['transaction_amount',1],['currency_id','USD'],['collector_id',99],['live_mode',true]]){
  const previous=payment[key];payment[key]=value;assert.equal((await notify()).status,422);payment[key]=previous;
 }
 assert.equal(mails.length,0);assert.equal(JSON.parse(db.get('hogarq:test:order:'+id)).status,'pending');
});
test('failed mail is retried after saved approval; return status cannot be forged',async()=>{
 const created=await call(checkout,'POST','/api/checkout',input());failEmail=true;
 assert.equal((await notify()).status,503);
 assert.equal(JSON.parse(db.get('hogarq:test:order:'+id)).status,'approved');
 assert.equal((await notify()).status,200);assert.equal(mails.length,2);
 const unauthorized=await call(status,'GET','/api/order?id='+id+'&status=approved');assert.equal(unauthorized.status,404);
 const found=await call(status,'GET','/api/order?id='+id,null,{authorization:'Bearer '+created.body.accessToken});
 assert.equal(found.body.status,'approved');assert.equal(found.body.emailAccepted,true);assert.equal(mails.length,2);
});
test('pending payments send no receipts and refunds stop appearing as approved',async()=>{
 await call(checkout,'POST','/api/checkout',input());payment.status='pending';await notify();assert.equal(mails.length,0);
 payment.status='approved';await notify();payment.status='refunded';payment.transaction_amount_refunded=220000;await notify();
 assert.equal(JSON.parse(db.get('hogarq:test:order:'+id)).status,'refunded');assert.equal(mails.length,2);
});
test('CORS, missing config and malformed requests fail closed',async()=>{
 assert.equal((await call(checkout,'POST','/api/checkout',input(),{origin:'https://evil.example'})).status,403);
 assert.equal((await call(checkout,'GET','/api/checkout')).status,405);
 delete process.env.MERCADOPAGO_WEBHOOK_SECRET;assert.equal((await call(checkout,'POST','/api/checkout',input())).status,503);
 assert.equal(preferences.length,0);
});
