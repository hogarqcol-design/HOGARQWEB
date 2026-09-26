'use strict';
const {randomUUID, createHash} = require('node:crypto');
const {request, HttpError} = require('./http');
function prefix() { return 'hogarq:' + (process.env.PAYMENT_MODE === 'production' ? 'live:' : 'test:'); }
async function redis(...command) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  if (!url || !url.startsWith('https://') || !process.env.UPSTASH_REDIS_REST_TOKEN) throw new Error('Order storage unavailable');
  const response = await request(url, {method:'POST', headers:{Authorization:'Bearer '+process.env.UPSTASH_REDIS_REST_TOKEN,'Content-Type':'application/json'}, body:JSON.stringify(command)});
  if (response.error) throw new Error('Order storage failed');
  return response.result;
}
const key = id => prefix() + 'order:' + id;
async function getOrder(id) { const raw = await redis('GET', key(id)); return raw ? JSON.parse(raw) : null; }
async function saveOrder(order) { await redis('SET', key(order.id), JSON.stringify(order)); }
async function withLock(id, fn) {
  const lock = prefix()+'lock:'+id, token = randomUUID();
  if (!await redis('SET', lock, token, 'NX', 'EX', 120)) throw new HttpError(409, 'Estamos procesando este pedido. Espera unos segundos y vuelve a intentarlo.');
  try { return await fn(); }
  finally { await redis('EVAL', 'if redis.call("GET",KEYS[1]) == ARGV[1] then return redis.call("DEL",KEYS[1]) else return 0 end', 1, lock, token); }
}
async function rateLimit(req, type, limit) {
  const ip = String(req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0];
  const bucket = prefix()+'rate:'+type+':'+createHash('sha256').update(ip).digest('hex')+':'+Math.floor(Date.now()/600000);
  const n = await redis('EVAL','local n=redis.call("INCR",KEYS[1]); if n==1 then redis.call("EXPIRE",KEYS[1],600) end; return n',1,bucket);
  if (n > limit) throw new HttpError(429, 'Demasiados intentos. Espera unos minutos.');
}
module.exports = {redis, getOrder, saveOrder, withLock, rateLimit};
