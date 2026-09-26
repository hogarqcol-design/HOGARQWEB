(function(){
'use strict';
const catalog = window.HogarqCatalog;
const $ = selector => document.querySelector(selector);
const money = n => '$'+Number(n).toLocaleString('es-CO')+' COP';
const CART_KEY = 'hogarq-cart-v1';
let cart = [], selected = null, config = {enabled:false,test:true}, requestId = null, pollTimer, polling = false, submitting = false;
const dialog = document.createElement('dialog');
dialog.className = 'shop-dialog';
dialog.setAttribute('aria-labelledby','shopTitle');
// Static markup only. All product/customer/provider text is inserted through textContent.
dialog.innerHTML = `
 <div class="shop-top"><h2 id="shopTitle">Tu pedido</h2><button type="button" class="shop-close" id="closeShop" autofocus>Cerrar</button></div>
 <div id="checkoutNotice" class="shop-notice" role="status">Comprobando disponibilidad de pagos…</div>
 <div class="shop-layout" id="cartContent">
  <div><h3>Las piezas que elegiste</h3><div id="cartLines"></div>
   <dl class="shop-totals"><div><dt>Productos</dt><dd id="cartSubtotal"></dd></div><div><dt>Envío</dt><dd id="cartShipping">Selecciona destino</dd></div><div class="shop-total"><dt>Total</dt><dd id="cartTotal"></dd></div></dl>
   <p id="deliveryText" class="shop-small">Fabricamos bajo pedido. Bogotá: 2–4 días hábiles; resto de Colombia: 4–7. Incluyen fabricación y entrega desde el pago aprobado.</p>
   <details class="shop-small"><summary>Tarifas de envío</summary><p>Bogotá: $20.000 por pedido. Resto de Colombia: 1 producto $30.000; 2 productos $50.000; desde 3 productos, $20.000 por unidad. Soacha y otros municipios vecinos cuentan como resto de Colombia.</p></details>
   <a class="shop-ig" href="https://www.instagram.com/hogarq_col" target="_blank" rel="noopener noreferrer">Prefiero pedir por Instagram ↗</a>
  </div>
  <form id="checkoutForm" class="shop-form">
   <h3>¿A dónde lo enviamos?</h3>
   <label>Nombre completo<input name="name" required maxlength="100" autocomplete="name"></label>
   <label>Correo para la confirmación<input name="email" type="email" required maxlength="254" autocomplete="email"></label>
   <label>Teléfono de contacto<input name="phone" type="tel" required minlength="10" maxlength="25" autocomplete="tel"></label>
   <div class="shop-pair"><label>Departamento<select name="department" required autocomplete="address-level1"><option value="">Selecciona</option></select></label><label>Ciudad o municipio<input name="city" required maxlength="80" autocomplete="address-level2"></label></div>
   <label>Dirección<input name="address" required maxlength="180" autocomplete="address-line1" placeholder="Calle, carrera y número"></label>
   <div class="shop-pair"><label>Barrio<input name="neighborhood" required maxlength="100"></label><label>Apartamento / interior (opcional)<input name="apartment" maxlength="80" autocomplete="address-line2"></label></div>
   <label>Indicaciones de entrega (opcional)<textarea name="instructions" maxlength="400" placeholder="Información para encontrar tu dirección"></textarea></label>
   <label class="shop-consent"><input name="consent" type="checkbox" required><span>Autorizo a Hogarq a usar mis datos para gestionar este pedido, el pago, la entrega y sus correos informativos. No se usarán para publicidad. Puedo consultar sobre mis datos en hogarqcol@gmail.com.</span></label>
   <p class="shop-error" id="checkoutError" role="alert"></p>
   <button type="submit" class="btn buy-primary" id="checkoutPay" disabled>Continuar a Mercado Pago</button>
   <p class="shop-small">Revisarás y pagarás en Mercado Pago. No necesitas responder el correo de confirmación.</p>
  </form>
 </div>
 <div id="orderStatus" class="shop-status" hidden><h3 id="statusTitle">Consultando tu pago…</h3><p id="statusMessage" role="status"></p><p>Pedido: <code id="orderReference"></code></p><div class="purchase-actions"><button class="btn" type="button" id="refreshOrder">Actualizar estado</button><button class="btn" type="button" id="returnCart">Ver carrito</button></div><a class="shop-ig" href="https://www.instagram.com/hogarq_col" target="_blank" rel="noopener noreferrer">Hablar con Hogarq por Instagram ↗</a></div>`;
document.body.append(dialog);
const form = $('#checkoutForm');
catalog.departments.forEach(name=>{const option=document.createElement('option');option.value=option.textContent=name;form.elements.department.append(option);});
function read(storage,key,fallback) { try { return JSON.parse(storage.getItem(key)) ?? fallback; } catch { return fallback; } }
function save(storage,key,value) { try { storage.setItem(key,JSON.stringify(value)); } catch {} }
try { cart=read(localStorage,CART_KEY,[]); } catch {}
if(!Array.isArray(cart)) cart=[];
cart=cart.filter(i=>i && catalog.products.some(p=>p.id===i.id) && catalog.colors.includes(i.color) && Number.isInteger(i.quantity) && i.quantity>0 && i.quantity<=50);
if(cart.reduce((n,i)=>n+i.quantity,0)>50) cart=[];
function changed() { requestId=null; try {save(localStorage,CART_KEY,cart);}catch{} render(); }
function totals() {
 const subtotal=cart.reduce((sum,i)=>sum+catalog.products.find(p=>p.id===i.id).price*i.quantity,0);
 const qty=cart.reduce((sum,i)=>sum+i.quantity,0), department=form.elements.department.value;
 const shipping=department ? catalog.shipping(qty,department==='Bogotá D.C.') : 0;
 $('#cartSubtotal').textContent=money(subtotal);
 $('#cartShipping').textContent=department ? money(shipping) : 'Selecciona destino';
 $('#cartTotal').textContent=money(subtotal+shipping)+(department ? '' : ' + envío');
 document.querySelectorAll('[data-cart-count]').forEach(el=>el.textContent=qty);
 $('#checkoutPay').disabled=!qty || !config.enabled || submitting;
 if(department) $('#deliveryText').textContent='Fabricación y entrega: '+(department==='Bogotá D.C.'?'2–4':'4–7')+' días hábiles desde el pago aprobado. Todos los colores disponibles bajo pedido.';
}
function render() {
 const list=$('#cartLines');list.replaceChildren();
 if(!cart.length){const empty=document.createElement('p');empty.className='shop-small';empty.textContent='Tu carrito está vacío. Elige una lámpara de la colección para comenzar.';list.append(empty);}
 cart.forEach((item,index)=>{
  const p=catalog.products.find(p=>p.id===item.id), line=document.createElement('div');line.className='shop-line';
  const image=document.createElement('img');image.src=catalog.images[p.id][item.color];image.alt=p.name+' · '+item.color;
  const info=document.createElement('div'), title=document.createElement('strong'), detail=document.createElement('p');
  title.textContent=p.name;detail.textContent=item.color+' · '+money(p.price);
  const controls=document.createElement('div');controls.className='shop-controls';
  const label=document.createElement('label');label.textContent='Cantidad ';const qty=document.createElement('input');qty.type='number';qty.min='1';qty.max='50';qty.step='1';qty.value=item.quantity;qty.setAttribute('aria-label','Cantidad de '+p.name+' '+item.color);
  qty.addEventListener('change',()=>{const n=Number(qty.value);if(Number.isInteger(n)&&n>=1&&cart.reduce((sum,i)=>sum+i.quantity,0)-item.quantity+n<=50){item.quantity=n;changed();}else{qty.value=item.quantity;$('#checkoutError').textContent='Para más de 50 unidades, escríbenos por Instagram.';}});
  label.append(qty);const remove=document.createElement('button');remove.type='button';remove.className='shop-remove';remove.textContent='Quitar';remove.setAttribute('aria-label','Quitar '+p.name+' '+item.color);remove.addEventListener('click',()=>{cart.splice(index,1);changed();});
  controls.append(label,remove);info.append(title,detail,controls);line.append(image,info);list.append(line);
 });totals();
}
function showCart(){ $('#cartContent').hidden=false;$('#orderStatus').hidden=true;$('#shopTitle').textContent='Tu pedido';clearTimeout(pollTimer);render();if(!dialog.open)dialog.showModal(); }
document.querySelectorAll('[data-open-cart]').forEach(button=>button.addEventListener('click',showCart));
$('#closeShop').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{clearTimeout(pollTimer);});
document.addEventListener('hogarq:product',event=>{selected=event.detail;$('#addedNote').textContent='';});
function add(buyNow){
 if(!selected)return;
 if(cart.reduce((n,i)=>n+i.quantity,0)>=50){$('#addedNote').textContent='Para más de 50 unidades, escríbenos por Instagram.';return;}
 const existing=cart.find(i=>i.id===selected.id&&i.color===selected.color);
 if(existing)existing.quantity++;else cart.push({...selected,quantity:1});
 changed();$('#addedNote').textContent='Añadida al carrito · '+selected.color+'.';if(buyNow)showCart();
}
$('#addToCart').addEventListener('click',()=>add(false));$('#buyNow').addEventListener('click',()=>add(true));
form.addEventListener('input',()=>{requestId=null;$('#checkoutError').textContent='';});
form.elements.department.addEventListener('change',()=>{
 const city=form.elements.city,bogota=form.elements.department.value==='Bogotá D.C.';
 if(bogota)city.value='Bogotá D.C.';else if(city.readOnly)city.value='';
 city.readOnly=bogota;totals();
});
async function api(url,options={}) {
 const response=await fetch(url,{...options,signal:AbortSignal.timeout(55000),cache:'no-store'});
 let data;try{data=await response.json();}catch{throw Error('No pudimos conectar con la tienda. Intenta de nuevo o escríbenos por Instagram.');}
 if(!response.ok)throw Error(data.error || 'No pudimos completar la solicitud.');return data;
}
async function loadConfig(){
 try{config=await api('/api/config');}catch{config={enabled:false,test:true};}
 $('#checkoutNotice').hidden=config.enabled&&!config.test;
 $('#checkoutNotice').textContent=config.enabled ? 'Modo de prueba: no se realizan cobros reales. Los correos de prueba se envían solo a Hogarq.' : 'Los pagos en línea aún no están disponibles. Puedes preparar tu carrito y pedir por Instagram.';
 totals();
}
form.addEventListener('submit',async event=>{
 event.preventDefault();if(submitting||!form.reportValidity()||!cart.length||!config.enabled)return;
 submitting=true;
 const pay=$('#checkoutPay');pay.disabled=true;pay.textContent='Preparando tu pago…';$('#checkoutError').textContent='';
 try{
  requestId ||= crypto.randomUUID();
  const customer=Object.fromEntries(new FormData(form));delete customer.consent;
  const purchasedCart=cart.map(item=>({...item}));
  const result=await api('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId,items:purchasedCart,customer,consent:form.elements.consent.checked})});
  const url=new URL(result.checkoutUrl);
  if(url.protocol!=='https:'||!['www.mercadopago.com.co','sandbox.mercadopago.com.co'].includes(url.hostname))throw Error('No pudimos abrir el pago. Intenta de nuevo.');
  // Only cart identifiers and the private status token; never addresses or phone numbers.
  try{sessionStorage.setItem('hogarq-order-'+result.id,JSON.stringify({token:result.accessToken,cart:purchasedCart}));}
  catch{throw Error('Permite el almacenamiento de esta pestaña para consultar tu pedido después del pago, o compra por Instagram.');}
  location.assign(url.href);
 }catch(error){$('#checkoutError').textContent=error.name==='TimeoutError'?'La conexión tardó demasiado. Vuelve a intentarlo; conservamos tu pedido.':error.message;}
 finally{submitting=false;pay.textContent='Continuar a Mercado Pago';totals();}
});
let activeOrder=null;
async function checkOrder(){
 if(!activeOrder||polling)return;polling=true;$('#refreshOrder').disabled=true;
 try{
  let saved;try{saved=read(sessionStorage,'hogarq-order-'+activeOrder,null);}catch{}
  if(!saved?.token)throw Error('No encontramos la sesión de este pedido. Revisa tu correo o escríbenos por Instagram con la referencia que aparece abajo.');
  const data=await api('/api/order?id='+encodeURIComponent(activeOrder),{headers:{Authorization:'Bearer '+saved.token}});
  const messages={approved:['Pago aprobado',`${data.test?'Esta es una prueba: no se fabricará ni despachará el pedido. ':''}Recibimos tu pedido por ${money(data.total)}. Fabricación y entrega: ${data.delivery} desde el pago aprobado. ${data.emailAccepted?'Enviamos el aviso por correo.':'Estamos preparando el aviso por correo.'} No necesitas confirmar ni responder.`],pending:['Pago pendiente','Aún esperamos la aprobación de Mercado Pago. Si ya pagaste, no repitas el pago. Te avisaremos por correo cuando se apruebe.'],rejected:['Pago rechazado','Mercado Pago no aprobó este intento. Puedes volver al carrito o escribirnos por Instagram.'],cancelled:['Pago cancelado','Este intento fue cancelado. Puedes volver al carrito.'],refunded:['Pago reembolsado','Este pago tiene un reembolso. Escríbenos si necesitas información sobre el pedido.'],charged_back:['Pago en revisión','Este pago tiene un contracargo. Contacta con Hogarq para revisar el pedido.']};
  const message=messages[data.status]||['Pago en revisión','Mercado Pago todavía está revisando tu pago. No realices otro pago por el mismo pedido.'];
  $('#statusTitle').textContent=(data.test?'Prueba · ':'')+message[0];$('#statusMessage').textContent=message[1];
  if(data.status==='approved'&&JSON.stringify(cart)===JSON.stringify(saved.cart)){cart=[];changed();}
  if(['pending','in_process','authorized'].includes(data.status)&&dialog.open)pollTimer=setTimeout(checkOrder,12000);
 }catch(error){$('#statusTitle').textContent='Consulta de tu pedido';$('#statusMessage').textContent=error.message;}
 finally{polling=false;$('#refreshOrder').disabled=false;}
}
$('#refreshOrder').addEventListener('click',()=>{clearTimeout(pollTimer);checkOrder();});
$('#returnCart').addEventListener('click',showCart);
function showReturn(){
 const id=new URLSearchParams(location.search).get('order');
 if(!id||!/^[0-9a-f-]{36}$/i.test(id))return;
 activeOrder=id;$('#cartContent').hidden=true;$('#orderStatus').hidden=false;$('#shopTitle').textContent='Estado del pedido';$('#orderReference').textContent=id;
 if(!dialog.open)dialog.showModal();checkOrder();
}
render();loadConfig();showReturn();
})();
