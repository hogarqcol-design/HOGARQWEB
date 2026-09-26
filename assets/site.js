(function(){
'use strict';

var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* =====================================================
   DATOS
   ===================================================== */
var PRODUCTS = window.HogarqCatalog.products;
var COLORS = window.HogarqCatalog.colors;
var PRODUCT_IMAGES = window.HogarqCatalog.images;
var COVER_COLORS = window.HogarqCatalog.covers;

function $(s){return document.querySelector(s);}
function formatCOP(n){return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.')+' COP';}

/* Portada del catálogo — usa el color asignado en COVER_COLORS */
function getDefaultImage(id){
  if(!PRODUCT_IMAGES[id]) return null;
  var color = COVER_COLORS[id] || 'blanco';
  return PRODUCT_IMAGES[id][color] || PRODUCT_IMAGES[id]['blanco'];
}

/* Color inicial al entrar al detalle — mismo color que la portada */
function getInitialColor(id){
  return COVER_COLORS[id] || 'blanco';
}

/* =====================================================
   REVEAL
   ===================================================== */
var revealObserver = null;
if('IntersectionObserver' in window && !reduceMotion){
  revealObserver = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(entry.isIntersecting){
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },{threshold:.12,rootMargin:'0px 0px -8% 0px'});
}
function observeReveal(el,index){
  if(!revealObserver){el.classList.add('is-visible');return;}
  if(index) el.style.setProperty('--delay',(index*90)+'ms');
  revealObserver.observe(el);
}
function scanReveals(root){
  (root || document).querySelectorAll('[data-reveal]:not(.is-visible)').forEach(function(el){
    var siblings = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children,el) : 0;
    observeReveal(el, el.parentElement && el.parentElement.hasAttribute('data-reveal-group') ? siblings : 0);
  });
}
function watchImage(img){
  if(img.complete){img.classList.add('is-loaded');return;}
  img.addEventListener('load',function(){img.classList.add('is-loaded');});
  img.addEventListener('error',function(){img.classList.add('is-loaded');});
}
document.querySelectorAll('img.img-fade').forEach(watchImage);

scanReveals();

/* =====================================================
   ROUTER
   ===================================================== */
var viewHome = $('#viewHome');
var viewProduct = $('#viewProduct');
var header = $('#header');
var detailGrid = $('#detailGrid');
var currentProductId = null;

function showHome(){
  viewProduct.style.display = 'none';
  viewHome.style.display = 'block';
  header.style.display = '';
  header.classList.remove('is-hidden');
  document.title = 'Hogarq | Lámparas de diseño minimalista en Colombia';
  currentProductId = null;
  updateHeader();
}

function showProduct(id){
  var p = PRODUCTS.find(function(x){return x.id === id;});
  if(!p){showHome();return;}
  currentProductId = id;
  document.dispatchEvent(new CustomEvent('hogarq:product', {detail:{id:id,color:getInitialColor(id)}}));

  var initialColor = getInitialColor(id);
  var img = PRODUCT_IMAGES[id] ? PRODUCT_IMAGES[id][initialColor] : null;
  $('#dIcon').innerHTML = img ? '<img class="img-fade" src="'+img+'" alt="'+p.name+' · '+initialColor+'">' : p.icon;
  $('#dIcon').querySelectorAll('img.img-fade').forEach(watchImage);

  $('#dName').textContent = p.name;
  $('#dSub').textContent = p.sub;
  $('#dPrice').innerHTML = formatCOP(p.price) + '<small>+ envío</small>';

  var colors = $('#dColors');
  colors.innerHTML = '';
  COLORS.forEach(function(c){
    var d = document.createElement('button');
    d.type = 'button';
    d.className = 'dot' + (c === initialColor ? ' active' : '');
    d.dataset.color = c;
    d.setAttribute('aria-label', c);
    d.setAttribute('aria-pressed', c === initialColor ? 'true' : 'false');
    colors.appendChild(d);
  });

  var specs = $('#dSpecs');
  specs.innerHTML = '';
  Object.keys(p.specs).forEach(function(k,i){
    var li = document.createElement('li');
    li.style.setProperty('--delay',(i*45)+'ms');
    li.innerHTML = '<span class="k">'+k+'</span><span class="v">'+p.specs[k]+'</span>';
    specs.appendChild(li);
  });

  viewHome.style.display = 'none';
  viewProduct.style.display = 'block';
  header.style.display = 'none';
  document.title = p.name + ' · HOGARQ';
  window.scrollTo({top:0,behavior:'instant'});

  if(!reduceMotion){
    detailGrid.classList.remove('view-enter');
    void detailGrid.offsetWidth;
    detailGrid.classList.add('view-enter');
  }
}

$('#dColors').addEventListener('click', function(e){
  var dot = e.target.closest('.dot');
  if(!dot || dot.classList.contains('active')) return;
  this.querySelectorAll('.dot').forEach(function(d){d.classList.remove('active');d.setAttribute('aria-pressed','false');});
  dot.classList.add('active');
  dot.setAttribute('aria-pressed','true');
  var set = PRODUCT_IMAGES[currentProductId];
  if(!set) return;
  var color = dot.dataset.color;
  document.dispatchEvent(new CustomEvent('hogarq:product', {detail:{id:currentProductId,color:color}}));
  var img = $('#dIcon img');
  if(!img || !set[color]) return;
  var p = PRODUCTS.find(function(x){return x.id === currentProductId;});
  var nextAlt = (p ? p.name : '') + ' · ' + color;
  if(reduceMotion){ img.src = set[color]; img.alt = nextAlt; return; }
  img.classList.add('is-swapping');
  var pre = new Image();
  pre.onload = pre.onerror = function(){
    if(!img.isConnected || !dot.classList.contains('active')) return;
    img.src = set[color];
    img.alt = nextAlt;
    requestAnimationFrame(function(){img.classList.remove('is-swapping');});
  };
  pre.src = set[color];
});

function route(){
  var m = (location.hash || '').match(/^#producto\/(\d+)$/);
  if(m){showProduct(parseInt(m[1],10));} else {showHome();}
}
window.addEventListener('hashchange', route);

$('#backBtn').addEventListener('click', function(e){
  e.preventDefault();
  location.hash = 'productos';
  showHome();
  $('#productos').scrollIntoView({behavior:'instant', block:'start'});
  var firstCard = $('#grid a');
  if(firstCard) firstCard.focus({preventScroll:true});
});

var videoSection = $('#videoSection');
var progress = $('#scrollProgress');
var lastY = 0;
var nav = $('#mainNav');
var navToggle = $('#navToggle');

function updateHeader(){
  var y = window.scrollY;
  if(viewProduct.style.display === 'block'){
    header.classList.add('on-cream');
  } else if(videoSection){
    var rect = videoSection.getBoundingClientRect();
    header.classList.toggle('on-cream', rect.bottom < 80);
  }
  if(!nav.classList.contains('is-open')){
    header.classList.toggle('is-hidden', y > 240 && y > lastY);
  }
  lastY = y;
  if(progress){
    var max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0) + ')';
  }
}
window.addEventListener('scroll', updateHeader, {passive:true});
window.addEventListener('resize', updateHeader);
route();

navToggle.addEventListener('click', function(){
  var open = nav.classList.toggle('is-open');
  navToggle.classList.toggle('is-open', open);
  navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  navToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
});
nav.addEventListener('click', function(e){
  if(e.target.closest('a')){
    nav.classList.remove('is-open');
    navToggle.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded','false');
  }
});

/* =====================================================
   VIDEO EN AUTOPLAY
   ===================================================== */
var v = $('#sv');
if(v){
  var tryPlay = function(){
    var p = v.play();
    if(p && typeof p.then === 'function'){
      p.catch(function(){
        var kick = function(){
          try{ var playback = v.play(); if(playback) playback.catch(function(){}); }catch(e){}
          document.removeEventListener('click', kick);
          document.removeEventListener('touchstart', kick);
          document.removeEventListener('scroll', kick);
          document.removeEventListener('keydown', kick);
        };
        document.addEventListener('click', kick, {once:true});
        document.addEventListener('touchstart', kick, {once:true});
        document.addEventListener('scroll', kick, {once:true, passive:true});
        document.addEventListener('keydown', kick, {once:true});
      });
    }
  };
  if(v.readyState >= 2){ tryPlay(); }
  else { v.addEventListener('canplay', tryPlay, {once:true}); }

  v.addEventListener('error', function(){
    var err = v.error;
    var msg = 'desconocido';
    if(err){
      switch(err.code){
        case 1: msg = 'MEDIA_ERR_ABORTED'; break;
        case 2: msg = 'MEDIA_ERR_NETWORK'; break;
        case 3: msg = 'MEDIA_ERR_DECODE'; break;
        case 4: msg = 'MEDIA_ERR_SRC_NOT_SUPPORTED'; break;
      }
    }
    console.error('✕ Video:', msg);
  });
}

/* =====================================================
   FORMULARIO
   ===================================================== */
var form = $('#cf');
var note = $('#formNote');
if(form){
  form.addEventListener('submit', function(e){
    e.preventDefault();
    var nombre  = form.elements['nombre'];
    var email   = form.elements['email'];
    var mensaje = form.elements['mensaje'];
    note.classList.remove('is-visible');
    if(!nombre.value.trim() || !email.value.trim() || !mensaje.value.trim()){
      note.textContent = 'Completa nombre, email y mensaje para enviar.';
      note.classList.add('is-error');
      requestAnimationFrame(function(){note.classList.add('is-visible');});
      return;
    }
    note.classList.remove('is-error');
    if(!form.reportValidity()) return;
    var subject = form.elements['asunto'].value.trim() || 'Consulta sobre Hogarq';
    var body = 'Nombre: ' + nombre.value.trim() + '\nCorreo: ' + email.value.trim() + '\n\n' + mensaje.value.trim();
    location.href = 'mailto:Hogarqcol@gmail.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    note.textContent = 'Correo preparado. Envíalo desde tu aplicación de correo. Si no se abre, escríbenos a Hogarqcol@gmail.com.';
    requestAnimationFrame(function(){note.classList.add('is-visible');});

  });
}

document.querySelectorAll('a[href^="#"]').forEach(function(a){
  var href = a.getAttribute('href');
  if(href === '#' || href.indexOf('#producto/') === 0 || href === '#carrito' || href === '#pedido') return;
  a.addEventListener('click', function(e){
    var t = document.querySelector(href);
    if(t){
      e.preventDefault();
      t.scrollIntoView({behavior:reduceMotion ? 'auto' : 'smooth', block:'start'});
    }
  });
});

})();
