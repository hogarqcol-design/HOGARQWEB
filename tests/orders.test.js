const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const {normalize}=require('../lib/orders');
const catalog=require('../assets/catalog');
const {validSignature}=require('../lib/payments');
const {receipt}=require('../lib/receipts');
const {config}=require('../lib/config');
const customer={name:'Cliente de prueba',email:'buyer@example.com',phone:'3001234567',department:'Antioquia',city:'Medellín',address:'Calle 1 # 2-3',neighborhood:'Centro',apartment:'302',instructions:'Portería'};
function input(quantity=1){return {requestId:'bb9c315a-4635-4a64-9f70-eb2882605818',items:[{id:1,color:'rosado',quantity,price:1}],customer:{...customer},consent:true,total:1,shipping:0};}
test('shipping counts units, not lines, and is recomputed server-side',()=>{
 for(const [q,fee] of [[1,30000],[2,50000],[3,60000],[4,80000],[5,100000]]){
  const order=normalize(input(q));assert.equal(order.shipping,fee);assert.equal(order.total,100000*q+fee);
  const local=input(q);local.customer.department='Bogotá D.C.';local.customer.city='Bogotá';assert.equal(normalize(local).shipping,20000);
 }
 const mixed=input();mixed.items.push({id:3,color:'azul',quantity:2});const order=normalize(mixed);assert.equal(order.quantity,3);assert.equal(order.subtotal,280000);assert.equal(order.shipping,60000);
});
test('invalid variants, quantities, personal fields and destination fail closed',()=>{
 for(const quantity of [0,-1,1.5,51,'2',null])assert.throws(()=>normalize(input(quantity)));
 const bad=input();bad.items[0].color='<script>';assert.throws(()=>normalize(bad));
 const wrong=input();wrong.customer.city='Bogotá';assert.throws(()=>normalize(wrong));
 const email=input();email.customer.email='a\r\nb@example.com';assert.throws(()=>normalize(email));
 const missing=input();delete missing.customer.neighborhood;assert.throws(()=>normalize(missing));
 const noConsent=input();noConsent.consent=false;assert.throws(()=>normalize(noConsent));
});
test('duplicate cart lines are merged and optional delivery fields can be empty',()=>{
 const value=input();value.items.push({id:1,color:'rosado',quantity:2});value.customer.apartment='';value.customer.instructions='';
 const order=normalize(value);assert.equal(order.items.length,1);assert.equal(order.items[0].quantity,3);
});
test('signature requires authentic id and request identifier',()=>{
 const secret='test-secret',ts='1704908010',id='12345';
 const hash=createHmac('sha256',secret).update(`id:${id};request-id:request;ts:${ts};`).digest('hex');
 const headers={'x-request-id':'request','x-signature':`ts=${ts},v1=${hash}`};
 assert.equal(validSignature(headers,id,secret),true);
 assert.equal(validSignature(headers,'67890',secret),false);
 assert.equal(validSignature({...headers,'x-request-id':'attacker'},id,secret),false);
 assert.equal(validSignature({},id,secret),false);
});
test('receipt contains products, color, prices and every delivery field; test mail is isolated',()=>{
 const order={...normalize(input()),id:input().requestId,paymentId:'123',paidAt:'2026-09-25T12:00:00Z'};
 const c={production:false,merchant:'hogarqcol@gmail.com',testEmail:'hogarqcol@gmail.com',from:'Hogarq <pedidos@hogarq.store>'};
 for(const merchant of [true,false]){
  const email=receipt(c,order,merchant);assert.deepEqual(email.to,['hogarqcol@gmail.com']);assert.match(email.subject,/NO FABRICAR/);
  for(const value of ['Capas','rosado','130.000',...Object.values(customer)])assert(email.text.includes(value),value);
 }
 assert.deepEqual(receipt({...c,production:true},order,false).to,['buyer@example.com']);
});
test('checkout disabled until explicitly configured; live cannot run on Preview',()=>{
 const snapshot={...process.env};try{process.env.CHECKOUT_ENABLED='false';assert.equal(config().ready,false);process.env.CHECKOUT_ENABLED='true';process.env.PAYMENT_MODE='production';process.env.VERCEL_ENV='preview';assert.equal(config().ready,false);}finally{process.env=snapshot;}
});
