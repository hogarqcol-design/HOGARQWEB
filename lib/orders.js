'use strict';
const catalog = require('../assets/catalog');
const {HttpError} = require('./http');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function text(value, label, max, optional = false) {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new HttpError(400, 'Revisa '+label+'.');
  value = value.trim();
  if (!optional && !value) throw new HttpError(400, 'Completa '+label+'.');
  return value;
}
function normalize(input) {
  if (!input || !UUID.test(input.requestId)) throw new HttpError(400, 'Identificador de pedido inválido.');
  if (!Array.isArray(input.items) || !input.items.length || input.items.length > 25) throw new HttpError(400, 'Revisa los productos del carrito.');
  const lines = new Map();
  for (const item of input.items) {
    if (!item || typeof item !== 'object') throw new HttpError(400, 'Revisa los productos del carrito.');
    const p = catalog.products.find(p => p.id === item.id);
    if (!p || !catalog.colors.includes(item.color) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 50) throw new HttpError(400, 'Hay un producto, color o cantidad inválida.');
    const k = p.id+':'+item.color;
    const line = lines.get(k) || {id:p.id, name:p.name, color:item.color, price:p.price, quantity:0};
    line.quantity += item.quantity;
    lines.set(k,line);
  }
  const items = [...lines.values()].sort((a,b)=>a.id-b.id || a.color.localeCompare(b.color));
  const quantity = items.reduce((s,i)=>s+i.quantity,0);
  if (quantity > 50) throw new HttpError(400, 'Para pedidos de más de 50 unidades, escríbenos por Instagram.');
  const c = input.customer || {};
  const customer = {};
  for (const [field,label,max,optional] of [['name','nombre',100],['email','correo',254],['phone','teléfono',25],['department','departamento',60],['city','municipio',80],['address','dirección',180],['neighborhood','barrio',100],['apartment','apartamento',80,true],['instructions','indicaciones',400,true]]) customer[field] = text(c[field] ?? '',label,max,optional);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) throw new HttpError(400,'Revisa tu correo electrónico.');
  if (!/^(?:\+?57[ -]?)?[0-9 ()-]{10,18}$/.test(customer.phone) || customer.phone.replace(/\D/g,'').length < 10) throw new HttpError(400,'Revisa tu teléfono de contacto.');
  if (!catalog.departments.includes(customer.department)) throw new HttpError(400,'Selecciona un departamento válido.');
  const bogota = customer.department === 'Bogotá D.C.';
  if (bogota) customer.city = 'Bogotá D.C.';
  else if (/^bogota(?:\s*d\.?\s*c\.?)?$/i.test(customer.city.normalize('NFD').replace(/[\u0300-\u036f]/g,''))) throw new HttpError(400,'Para Bogotá selecciona Bogotá D.C. en el departamento.');
  const subtotal = items.reduce((s,i)=>s+i.price*i.quantity,0);
  const shipping = catalog.shipping(quantity,bogota);
  if (input.consent !== true) throw new HttpError(400,'Autoriza el uso de tus datos para gestionar este pedido.');
  return {items,customer,quantity,subtotal,shipping,total:subtotal+shipping,currency:'COP',delivery:bogota?'2–4 días hábiles':'4–7 días hábiles',consent:true};
}
module.exports = {normalize, UUID};
