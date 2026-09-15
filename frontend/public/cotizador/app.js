
(function(){
"use strict";
var $ = function(id){ return document.getElementById(id); };
var RUBROS_ORD = ["Protección respiratoria","Protección visual y facial","Protección auditiva","Protección de cabeza","Guantes y manguitos","Calzado de seguridad","Protección contra caídas","Indumentaria de trabajo","Emergencias y primeros auxilios","Señalización y demarcación","Sujeción de cargas","Otros"];

/* ============ estado ============ */
var cfg = { tc:1420, margen:45, iva:21, redondeo:10, rubroMargen:{} };
var margenArt = {};          // clave -> %
var LISTAS = [];             // {id,nombre,prov,moneda,fecha,chunks,activa,items}
var ITEMS = [];              // catálogo unificado
var doc = null;
var lista = null;            // lista de precios para el cliente
var modo = "cot";            // "cot" | "lista": a qué documento van los artículos del catálogo
var vista = "cotizaciones";  // pantalla visible
var filtroEstado = "", filtroCot = "";
var ESTADOS = [["borrador","Borrador"],["enviada","Enviada"],["aceptada","Aceptada"],["rechazada","Rechazada"]];
var HIST = [];               // cotizaciones guardadas, la más nueva primero
var LS = "indseg.cotizador.v2";

function hoy(){ var d=new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*6e4).toISOString().slice(0,10); }
function manana(){ var d=new Date(Date.now()+864e5); return new Date(d.getTime()-d.getTimezoneOffset()*6e4).toISOString().slice(0,10); }
function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function normal(s){ s=String(s||""); return s.normalize ? s.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase() : s.toLowerCase(); }
function fmt(n){ if(!isFinite(n)) n=0; return n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}); }
function num(v){ var n=parseFloat(String(v).replace(/\s/g,"").replace(/,/g,"")); return isFinite(n)?n:0; }
function fechaAR(iso){ if(!iso) return ""; var p=String(iso).split("-"); return p.length===3 ? parseInt(p[2],10)+"/"+parseInt(p[1],10)+"/"+p[0] : iso; }

/* ============ catálogo unificado ============ */
function claveArt(prov, cod, desc){ return normal(prov)+"|"+normal(cod).slice(0,24)+"|"+normal(desc).replace(/[^a-z0-9]/g,"").slice(0,44); }

function construirItems(){
  ITEMS = [];
  LISTAS.forEach(function(L){
    if(!L.activa) return;
    (L.items||[]).forEach(function(it, i){
      ITEMS.push({
        lista:L.id, prov:L.prov, rubro:it.r || "Otros",
        cod:it.c||"", desc:it.d, bulto:it.b||"", mon:it.m||L.moneda, costo:it.v,
        key:claveArt(L.prov, it.c||"", it.d)
      });
    });
  });
  IDX = ITEMS.map(function(it){ return normal(it.desc+" "+it.cod+" "+it.rubro+" "+it.prov); });
  var act = LISTAS.filter(function(L){ return L.activa; }).length;
  $("pCount").value = ITEMS.length;
  $("pCountHint").textContent = act + (act===1?" lista activa":" listas activas");
  pintarFiltrosProv();
}
var IDX = [];

function margenDe(it){
  if(margenArt[it.key] != null) return { v:margenArt[it.key], src:"art" };
  if(cfg.rubroMargen[it.rubro] != null) return { v:cfg.rubroMargen[it.rubro], src:"rubro" };
  return { v:cfg.margen, src:"gen" };
}
function costoARS(mon, v){ return mon === "USD" ? v * cfg.tc : v; }
function redondear(p){
  var r = cfg.redondeo;
  return r > 0 ? Math.round(p/r)*r : Math.round(p*100)/100;
}
/* El margen se toma SOBRE EL PRECIO DE VENTA: costo 100 con 25 % ⇒ 133,33 */
var MG_MAX = 95;
function conMargen(costo, m){
  if(!(costo > 0)) return 0;
  var mm = num(m);
  if(mm > MG_MAX) mm = MG_MAX;
  if(mm < -900) mm = -900;
  return redondear(costo / (1 - mm/100));
}
function margenDesdePrecio(costo, precio){
  if(!(costo > 0) || !(precio > 0)) return null;
  return (1 - costo/precio) * 100;
}
function precioVenta(it){ return conMargen(costoARS(it.mon, it.costo), margenDe(it).v); }
function costoTxt(it){
  return (it.mon==="USD" ? "U$S " : "$ ") + it.costo.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:it.mon==="USD"?3:2});
}

/* ============ cotización ============ */
function docVacio(n){
  return { numero:String(n||""), empresa:"", direccion:"", cotizo:"Federico", fecha:hoy(), entrega:manana(),
    talles:"Talles a partir del XXL - Recargo 10% -\nCamisas a partir del talle 48 - Recargo 15% -", obs:"", items:[],
    estado:"borrador", eventos:[{ ts:Date.now(), t:"creada", d:"Cotización creada" }] };
}
function nombreEstado(e){ var x = ESTADOS.filter(function(p){ return p[0] === e; })[0]; return x ? x[1] : "Borrador"; }
/* agrega un evento al historial; dos guardados seguidos en pocos minutos cuentan como uno */
function registrarEvento(t, d){
  if(!doc.eventos) doc.eventos = [];
  var ult = doc.eventos[doc.eventos.length-1];
  if(ult && ult.t === t && t === "guardada" && Date.now() - ult.ts < 10*60e3){ ult.ts = Date.now(); }
  else doc.eventos.push({ ts:Date.now(), t:t, d:d });
  if(doc.eventos.length > 40) doc.eventos = doc.eventos.slice(-40);
  renderTimeline();
}
function horaAR(ts){
  var a = new Date(ts);
  return a.getDate()+"/"+(a.getMonth()+1)+"/"+a.getFullYear()+" · "+String(a.getHours()).padStart(2,"0")+":"+String(a.getMinutes()).padStart(2,"0");
}
var TL_IC = { creada:"i-plus", guardada:"i-save", pdf:"i-down", estado:"i-flag", duplicada:"i-copy" };
function renderTimeline(){
  var ev = (doc.eventos||[]).slice().reverse();
  $("timeline").innerHTML = ev.length ? ev.map(function(e){
    return '<li><span class="tl-ic"><svg class="ic"><use href="#'+(TL_IC[e.t]||"i-note")+'"/></svg></span>'+
      '<div><div class="tl-t">'+esc(e.d)+'</div><div class="tl-d">'+horaAR(e.ts)+'</div></div></li>';
  }).join("") : '<li><span class="tl-ic"><svg class="ic"><use href="#i-note"/></svg></span><div><div class="tl-d">Sin movimientos todavía.</div></div></li>';
  var g = (doc.eventos||[]).filter(function(e){ return e.t === "guardada"; }).pop();
  $("savedAt").textContent = g ? "Guardada " + horaAR(g.ts).split(" · ")[1] : "Sin guardar";
}
function pintarEstado(){
  var e = doc.estado || "borrador";
  $("fEstado").value = e;
  $("fEstado").className = "chip-select st-" + e;
  $("hNum").textContent = doc.numero ? "N° " + doc.numero : "";
}
function costoLinea(r){ return r.costo ? costoARS(r.mon||"ARS", num(r.costo)) : 0; }
function lineaTotal(r){ return num(r.cant) * num(r.precio) * (1 - num(r.desc_pct)/100); }
function lineaCostoTotal(r){ return num(r.cant) * costoLinea(r); }
function totales(){
  var neto=0, costo=0, netoConCosto=0, nCon=0;
  doc.items.forEach(function(r){
    var lt = lineaTotal(r);
    neto += lt;
    if(costoLinea(r) > 0){ costo += lineaCostoTotal(r); netoConCosto += lt; nCon++; }
  });
  neto = Math.round(neto*100)/100; costo = Math.round(costo*100)/100;
  netoConCosto = Math.round(netoConCosto*100)/100;
  var iva = Math.round(neto*cfg.iva)/100;
  return { neto:neto, iva:iva, total:Math.round((neto+iva)*100)/100,
           costo:costo, netoConCosto:netoConCosto, ganancia:Math.round((netoConCosto-costo)*100)/100,
           nConCosto:nCon, nTotal:doc.items.length };
}

function renderItems(){
  var tb = $("tbody"); tb.innerHTML = "";
  $("emptyMsg").hidden = doc.items.length > 0;
  doc.items.forEach(function(r, i){
    var cARS = costoLinea(r);
    var mgAct = margenDesdePrecio(cARS, num(r.precio));
    var mgTxt = mgAct == null ? "" : mgAct.toFixed(1);
    var tr = document.createElement("tr");
    tr.innerHTML =
      '<td><input class="n" data-k="cant" inputmode="decimal" value="'+esc(r.cant)+'" aria-label="Cantidad"></td>'+
      '<td><input data-k="desc" value="'+esc(r.desc)+'" aria-label="Descripción">'+(r.meta?'<div class="rowmeta">'+esc(r.meta)+'</div>':'')+'</td>'+
      '<td class="cellcost">'+(cARS>0?fmt(cARS):"—")+'</td>'+
      '<td><input class="n" data-k="margen" inputmode="decimal" value="'+esc(mgTxt)+'" '+(cARS>0?'':'disabled')+' aria-label="Margen del renglón"></td>'+
      '<td><input class="n" data-k="precio" inputmode="decimal" value="'+esc(r.precio)+'" aria-label="Precio unitario"></td>'+
      '<td><input class="n" data-k="desc_pct" inputmode="decimal" value="'+esc(r.desc_pct)+'" aria-label="Descuento"></td>'+
      '<td class="r rowtot" id="rt'+i+'">'+fmt(lineaTotal(r))+'</td>'+
      '<td class="acts"><button class="icon-btn danger" data-del="'+i+'" title="Quitar renglón" aria-label="Quitar renglón"><svg class="ic"><use href="#i-x"/></svg></button></td>';
    tr.querySelectorAll("input").forEach(function(inp){
      inp.addEventListener("input", function(){
        var k = inp.getAttribute("data-k");
        if(k === "desc"){ r.desc = inp.value; }
        else if(k === "margen"){
          var c = costoLinea(r);
          if(c > 0){ r.precio = conMargen(c, inp.value);
            var pin = tr.querySelector('[data-k="precio"]'); if(pin) pin.value = r.precio; }
        }
        else if(k === "precio"){
          r.precio = num(inp.value);
          var c2 = costoLinea(r);
          var min = tr.querySelector('[data-k="margen"]');
          if(c2 > 0 && min){ var m2 = margenDesdePrecio(c2, r.precio); min.value = m2 == null ? "" : m2.toFixed(1); }
        }
        else r[k] = num(inp.value);
        $("rt"+i).textContent = fmt(lineaTotal(r));
        pintarTotales(); guardarBorrador();
      });
    });
    tb.appendChild(tr);
  });
  tb.querySelectorAll("[data-del]").forEach(function(b){
    b.addEventListener("click", function(){
      doc.items.splice(parseInt(b.getAttribute("data-del"),10),1);
      renderItems(); guardarBorrador();
    });
  });
  pintarTotales();
}
function pintarTotales(){
  var t = totales();
  $("tNeto").textContent = "$ " + fmt(t.neto);
  $("tIva").textContent = "$ " + fmt(t.iva);
  $("tTotal").textContent = "$ " + fmt(t.total);
  $("tIvaPct").textContent = String(cfg.iva);
  $("tCosto").textContent = t.costo > 0 ? fmt(t.costo) : "—";
  $("tGan").textContent = t.costo > 0 ? fmt(t.ganancia) : "—";
  $("tMg").textContent = (t.costo > 0 && t.netoConCosto > 0) ? ((t.ganancia/t.netoConCosto)*100).toFixed(1) + " %" : "—";
  var mgPct = (t.costo > 0 && t.netoConCosto > 0) ? (t.ganancia/t.netoConCosto)*100 : 0;
  var met = $("mgMeter");
  met.firstElementChild.style.width = Math.max(0, Math.min(100, mgPct)) + "%";
  met.classList.toggle("low", mgPct > 0 && mgPct < 25);
  $("tMgNota").textContent = (t.costo > 0 && t.nConCosto < t.nTotal)
    ? "Calculado sobre " + t.nConCosto + " de " + t.nTotal + " renglones: el resto se cargó a mano, sin costo."
    : "";
}

/* ============ lista de precios ============ */
var NOTAS_LISTA = "*Precios expresados en pesos argentinos. Sujetos a cambios sin previo aviso.\n*Consultá por bordados, logos y descuentos por cantidad.";
var MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
/* productos propios, de la lista de junio 2026 (precio de venta, sin costo) */
var PROPIOS = [
  ["Pantalón de trabajo","Gabardina 8oz","38 - 60","Azul/Beige/Aero",11850],
  ["Camisa de trabajo","Gabardina 6oz","38 - 54","Azul/Beige/Aero",11850],
  ["Pantalón Cargo","Gabardina 8oz","38 - 60","Azul/Negro/Beige/Verde/Gris",16150],
  ["Mameluco Gabardina","Gabardina 8oz","S - 4xl","Azul",24670],
  ["Bermuda Cargo","Gabardina 8oz","38 - 60","Azul/Negro/Beige/Verde/Gris",12475],
  ["Pantalón Náutico","Gabardina 6oz","S - 4xl","Azul/Blanco",11000],
  ["Ambo Médico","Poplin (Chaqueta + Pantalon)","S - 4xl","Azul/Verde/Blanco/Celeste",15000],
  ["Buzo polar 1/2 cierre","Polar","S - 4xl","Azul/Negro",14000],
  ["Campera Polar","Polar","S - 4xl","Azul/Negro",16175],
  ["Chaleco Polar","Polar","S - 4xl","Azul/Negro",11500],
  ["Buzo Frisa c/redondo","Frisa invisible","S - 4xl","Azul/Negro/Blanco",12268],
  ["Remera algodón","Jersey peinado 24/1","S - 4xl","Azul/Negro/Gris/Blanco",6000],
  ["Chomba pique","Pique colegial","S - 4xl","Azul/Negro/Gris",10550],
  ["Campera trucker","Trucker - Matelasse 150grs","S - 4xl","Azul/Blanco",22650],
  ["Chaleco Trucker","Trucker - Matelasse 150grs","S - 4xl","Azul/Blanco",15600],
  ["Mameluco Térmico","Trucker - Matelasse 150grs","S - 4xl","Azul/Blanco",32350],
  ["Pantalón Térmico","Trucker - Matelasse 150grs","S - 4xl","Azul/Blanco",15750]
];
function listaVacia(){
  var d=new Date();
  return { titulo:"Lista de precios", periodo:MESES[d.getMonth()]+" "+d.getFullYear(), para:"", conIva:false, notas:NOTAS_LISTA, items:[] };
}
/* "Talles del S al 3XL" / "T 37 AL 47" → "S - 3XL" */
function tallesDe(desc){
  var m = String(desc||"").match(/\b(?:talles?|t\.?)\s+(?:del\s+)?([0-9]{1,2}|x{0,3}[sml]|[2-5]xl)\s+al\s+([0-9]{1,2}|x{0,3}[sml]|[2-5]xl)\b/i);
  return m ? m[1].toUpperCase()+" - "+m[2].toUpperCase() : "";
}
function precioLista(r){
  var p = num(r.precio);
  return lista && lista.conIva ? redondear(p*(1+cfg.iva/100)) : p;
}
function agregarALista(it){
  lista.items.push({ prod:it.desc, desc:"", talles:tallesDe(it.desc), color:"",
    costo:it.costo, mon:it.mon, precio:precioVenta(it),
    meta: it.prov + (it.cod ? " · cód. " + it.cod : "") + " · costo " + costoTxt(it) });
  renderLista(); guardarBorrador();
  toast("Agregado a la lista: " + (it.desc.length>40 ? it.desc.slice(0,40)+"…" : it.desc));
}
var CAMPOS_LISTA = { lTitulo:"titulo", lPeriodo:"periodo", lPara:"para", lNotas:"notas" };
function formALista(){ for(var id in CAMPOS_LISTA) lista[CAMPOS_LISTA[id]] = $(id).value; lista.conIva = $("lIva").value === "1"; }
function listaAForm(){ for(var id in CAMPOS_LISTA) $(id).value = lista[CAMPOS_LISTA[id]] || ""; $("lIva").value = lista.conIva ? "1" : "0"; }

function renderLista(){
  var tb = $("ltbody"); tb.innerHTML = "";
  $("lEmpty").hidden = lista.items.length > 0;
  $("lCount").textContent = lista.items.length ? lista.items.length + (lista.items.length===1?" producto":" productos") : "";
  lista.items.forEach(function(r, i){
    var cARS = costoLinea(r);
    var mg = margenDesdePrecio(cARS, num(r.precio));
    var tr = document.createElement("tr");
    tr.innerHTML =
      '<td><input data-k="prod" value="'+esc(r.prod)+'" aria-label="Producto">'+(r.meta?'<div class="rowmeta">'+esc(r.meta)+'</div>':'')+'</td>'+
      '<td><input data-k="desc" value="'+esc(r.desc)+'" placeholder="Tela, modelo…" aria-label="Descripción"></td>'+
      '<td><input data-k="talles" value="'+esc(r.talles)+'" placeholder="38 - 60" aria-label="Talles"></td>'+
      '<td><input data-k="color" value="'+esc(r.color)+'" placeholder="Azul/Negro" aria-label="Color"></td>'+
      '<td class="cellcost">'+(cARS>0?fmt(cARS):"—")+'</td>'+
      '<td><input class="n" data-k="margen" inputmode="decimal" value="'+(mg==null?"":mg.toFixed(1))+'" '+(cARS>0?'':'disabled')+' aria-label="Margen"></td>'+
      '<td><input class="n" data-k="precio" inputmode="decimal" value="'+esc(r.precio)+'" aria-label="Precio"></td>'+
      '<td class="r rowtot" id="lp'+i+'">'+fmt(precioLista(r))+'</td>'+
      '<td class="acts"><button class="icon-btn" data-up="'+i+'" title="Subir" aria-label="Subir"'+(i===0?' disabled':'')+'><svg class="ic"><use href="#i-up"/></svg></button>'+
        '<button class="icon-btn danger" data-ldel="'+i+'" title="Quitar" aria-label="Quitar"><svg class="ic"><use href="#i-x"/></svg></button></td>';
    tr.querySelectorAll("input").forEach(function(inp){
      inp.addEventListener("input", function(){
        var k = inp.getAttribute("data-k");
        if(k === "margen"){
          var c = costoLinea(r);
          if(c > 0){ r.precio = conMargen(c, inp.value); tr.querySelector('[data-k="precio"]').value = r.precio; }
        } else if(k === "precio"){
          r.precio = num(inp.value);
          var c2 = costoLinea(r), mi = tr.querySelector('[data-k="margen"]');
          if(c2 > 0){ var m2 = margenDesdePrecio(c2, r.precio); mi.value = m2 == null ? "" : m2.toFixed(1); }
        } else r[k] = inp.value;
        $("lp"+i).textContent = fmt(precioLista(r));
        guardarBorrador();
      });
    });
    tb.appendChild(tr);
  });
  tb.querySelectorAll("[data-ldel]").forEach(function(b){
    b.addEventListener("click", function(){ lista.items.splice(parseInt(b.getAttribute("data-ldel"),10),1); renderLista(); guardarBorrador(); });
  });
  tb.querySelectorAll("[data-up]").forEach(function(b){
    b.addEventListener("click", function(){
      var i = parseInt(b.getAttribute("data-up"),10); if(i < 1) return;
      var x = lista.items[i]; lista.items[i] = lista.items[i-1]; lista.items[i-1] = x;
      renderLista(); guardarBorrador();
    });
  });
  $("lPrecioHead").textContent = lista.conIva ? "Precio c/IVA" : "Precio + IVA";
  resumenLista();
}
function resumenLista(){
  var precios = lista.items.map(precioLista).filter(function(p){ return p > 0; });
  var mgs = lista.items.map(function(r){ return margenDesdePrecio(costoLinea(r), num(r.precio)); }).filter(function(m){ return m != null; });
  $("lResN").textContent = String(lista.items.length);
  $("lResMin").textContent = precios.length ? "$ " + fmt(Math.min.apply(null, precios)) : "—";
  $("lResMax").textContent = precios.length ? "$ " + fmt(Math.max.apply(null, precios)) : "—";
  $("lResMg").textContent = mgs.length ? (mgs.reduce(function(a,b){ return a+b; },0)/mgs.length).toFixed(1) + " %" : "—";
}
function cargarPropios(){
  var ya = {}; lista.items.forEach(function(r){ ya[normal(r.prod)] = 1; });
  var n = 0;
  PROPIOS.forEach(function(p){
    if(ya[normal(p[0])]) return;
    lista.items.push({ prod:p[0], desc:p[1], talles:p[2], color:p[3], costo:0, mon:"ARS", precio:p[4], meta:"" }); n++;
  });
  renderLista(); guardarBorrador();
  toast(n ? "Se agregaron " + n + " productos INDSEG (precios de junio: revisalos)." : "Los productos INDSEG ya están en la lista.");
}
function traerDeCotizacion(){
  formADoc();
  var n = 0;
  doc.items.forEach(function(r){
    if(!String(r.desc||"").trim()) return;
    lista.items.push({ prod:r.desc, desc:"", talles:tallesDe(r.desc), color:"", costo:r.costo||0, mon:r.mon||"ARS", precio:num(r.precio), meta:r.meta||"" }); n++;
  });
  renderLista(); guardarBorrador();
  toast(n ? "Se trajeron " + n + " renglones de la cotización." : "La cotización no tiene renglones.");
}
function guardarLista(){
  formALista(); guardarBorrador();
  api("PUT", docPath("listaPrecios","actual"), { titulo:lista.titulo, periodo:lista.periodo, para:lista.para, conIva:lista.conIva,
    notas:lista.notas, items:lista.items, ts:Date.now() })
    .then(function(){ enLinea(); toast("Lista guardada."); }, sinGuardar);
}
var VISTAS = { cotizaciones:"viewCotizaciones", cot:"viewCot", lista:"viewLista", proveedores:"viewProveedores", margenes:"viewMargenes", ajustes:"viewAjustes" };
function setView(v){
  if(!VISTAS[v]) v = "cotizaciones";
  vista = v;
  Object.keys(VISTAS).forEach(function(k){ $(VISTAS[k]).hidden = k !== v; });
  document.querySelectorAll(".nav-item[data-view]").forEach(function(b){
    var activo = b.getAttribute("data-view") === v || (v === "cot" && b.getAttribute("data-view") === "cotizaciones");
    if(activo) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
  if(v === "cot" || v === "lista"){
    modo = v;
    var slot = $(v === "cot" ? "slotCot" : "slotLista");
    slot.appendChild($("catalogo"));
    $("catHint").textContent = v === "lista" ? "Tocá + para sumar el producto a la lista." : "Tocá + para sumar el artículo a la cotización.";
  }
  if(v === "cotizaciones") renderHistorial(HIST);
  try{ localStorage.setItem(LS+".vista", v); }catch(e){}
  window.scrollTo(0, 0);
}

var CAMPOS = { fNum:"numero", fEmpresa:"empresa", fDireccion:"direccion", fCotizo:"cotizo", fFecha:"fecha", fEntrega:"entrega", fTalles:"talles", fObs:"obs" };
function formADoc(){ for(var id in CAMPOS) doc[CAMPOS[id]] = $(id).value; doc.estado = $("fEstado").value || "borrador"; }
function docAForm(){
  for(var id in CAMPOS) $(id).value = doc[CAMPOS[id]] || "";
  if(!doc.estado) doc.estado = "borrador";
  if(!doc.eventos) doc.eventos = [];
  pintarEstado(); renderTimeline();
}

/* ============ catálogo: filtros y render ============ */
var filtroProv = "", filtroRubro = "", filtroQ = "", orden = "rel";

function pintarFiltrosProv(){
  var provs = [];
  LISTAS.forEach(function(L){ if(L.activa && provs.indexOf(L.prov) === -1) provs.push(L.prov); });
  var el = $("provFilters");
  el.innerHTML = '<button class="chip" data-prov="" aria-pressed="'+(filtroProv===""?"true":"false")+'">Todos</button>' +
    provs.map(function(p){ return '<button class="chip" data-prov="'+esc(p)+'" aria-pressed="'+(filtroProv===p?"true":"false")+'">'+esc(p)+'</button>'; }).join("");
  el.querySelectorAll(".chip").forEach(function(c){
    c.addEventListener("click", function(){
      filtroProv = c.getAttribute("data-prov");
      el.querySelectorAll(".chip").forEach(function(o){ o.setAttribute("aria-pressed", o===c ? "true":"false"); });
      renderCatalogo();
    });
  });
  if(provs.indexOf(filtroProv) === -1) filtroProv = "";
}

function renderCatalogo(){
  var terms = normal(filtroQ).split(/\s+/).filter(Boolean);
  var hits = [];
  for(var i=0;i<ITEMS.length;i++){
    var it = ITEMS[i];
    if(filtroProv && it.prov !== filtroProv) continue;
    if(filtroRubro && it.rubro !== filtroRubro) continue;
    var hay = IDX[i], ok = true;
    for(var t=0;t<terms.length;t++){ if(hay.indexOf(terms[t]) === -1){ ok = false; break; } }
    if(ok) hits.push(it);
  }
  if(orden !== "rel"){
    hits = hits.slice();
    hits.sort(function(a,b){
      if(orden === "pv")  return precioVenta(a) - precioVenta(b);
      if(orden === "pvd") return precioVenta(b) - precioVenta(a);
      if(orden === "prov")return a.prov.localeCompare(b.prov) || a.desc.localeCompare(b.desc);
      return a.desc.localeCompare(b.desc);
    });
  }
  var total = hits.length;
  var vis = hits.slice(0, 150);
  var provsEnResultado = [];
  hits.forEach(function(h){ if(provsEnResultado.indexOf(h.prov) === -1) provsEnResultado.push(h.prov); });
  $("resCount").textContent = total === 0 ? "Sin resultados"
    : total + (total===1?" artículo":" artículos")
      + (provsEnResultado.length>1 ? " · " + provsEnResultado.length + " proveedores" : "")
      + (total>vis.length ? " · se muestran "+vis.length : "");

  $("list").innerHTML = vis.map(function(it, n){
    var m = margenDe(it);
    return '<div class="item">'+
      '<div><div class="item-d">'+esc(it.desc)+'</div>'+
      '<div class="item-m"><span class="tag">'+esc(it.prov)+'</span> '+
        (it.cod ? esc(it.cod.length>26 ? it.cod.slice(0,26)+"…" : it.cod)+" · " : "")+
        (it.bulto ? "bulto "+esc(it.bulto)+" · " : "")+'costo '+costoTxt(it)+
        (it.mon==="USD" ? " = $ "+fmt(costoARS("USD", it.costo)) : "")+'</div></div>'+
      '<div class="item-p"><div>'+
        '<div class="pv">'+fmt(precioVenta(it))+'</div>'+
        '<input class="mg'+(m.src==="art"?" over":"")+'" data-mg="'+n+'" value="'+m.v+'" inputmode="decimal" title="Margen de este artículo (%)" aria-label="Margen %">'+
      '</div>'+
      '<button class="add" data-add="'+n+'" title="Agregar a la cotización" aria-label="Agregar">+</button></div>'+
    '</div>';
  }).join("") || (ITEMS.length
    ? '<div class="empty">Nada coincide con esa búsqueda.<br>Probá con menos palabras, o revisá que la lista esté activa.</div>'
    : '<div class="empty">Todavía no hay listas de proveedores.<br>Cargalas desde la pestaña <strong>Listas</strong>.</div>');

  $("list").querySelectorAll("[data-add]").forEach(function(b){
    b.addEventListener("click", function(){ agregar(vis[parseInt(b.getAttribute("data-add"),10)]); });
  });
  $("list").querySelectorAll("[data-mg]").forEach(function(inp){
    inp.addEventListener("change", function(){
      var it = vis[parseInt(inp.getAttribute("data-mg"),10)];
      var v = inp.value.trim();
      if(v === "") delete margenArt[it.key]; else margenArt[it.key] = num(v);
      guardarMargenes(); renderCatalogo(); renderMargenes();
    });
  });
}

function agregar(it){
  if(!it) return;
  if(modo === "lista") return agregarALista(it);
  doc.items.push({ cant:1, desc:it.desc, costo:it.costo, mon:it.mon, margen:margenDe(it).v,
    precio:precioVenta(it), desc_pct:0,
    meta: it.prov + (it.cod ? " · cód. " + it.cod : "") + " · costo " + costoTxt(it) });
  renderItems(); guardarBorrador();
  toast("Agregado: " + (it.desc.length>44 ? it.desc.slice(0,44)+"…" : it.desc));
}

/* ============ listas ============ */
function renderListas(){
  var act = LISTAS.filter(function(L){ return L.activa; });
  $("listCount").textContent = LISTAS.length + (LISTAS.length===1?" lista · ":" listas · ") + act.length + (act.length===1?" activa en el catálogo":" activas en el catálogo");
  $("listasList").innerHTML = LISTAS.map(function(L, i){
    return '<div class="drow">'+
      '<div><div class="lname">'+esc(L.nombre)+'</div><div class="lmeta">'+esc(L.prov)+(L.fecha? ' · cargada '+esc(fechaAR(L.fecha)||L.fecha):'')+'</div></div>'+
      '<span class="mono hide-sm">'+(L.items?L.items.length:0)+'</span>'+
      '<span class="hide-sm">'+(L.moneda==="USD"?"Dólares":L.moneda==="ARS"?"Pesos":"Pesos y dólares")+'</span>'+
      '<label class="switch hide-sm"><input type="checkbox" data-act="'+i+'" '+(L.activa?"checked":"")+' aria-label="Lista activa"></label>'+
      '<button class="icon-btn danger" data-delL="'+i+'" title="Borrar lista" aria-label="Borrar lista"><svg class="ic"><use href="#i-x"/></svg></button>'+
      '</div>';
  }).join("") || '<div class="empty">Todavía no hay listas. Tocá <strong>Importar lista</strong> para cargar la primera.</div>';
  $("listasList").querySelectorAll("[data-act]").forEach(function(c){
    c.addEventListener("change", function(){
      var L = LISTAS[parseInt(c.getAttribute("data-act"),10)];
      L.activa = c.checked;
      construirItems(); renderCatalogo(); renderListas(); guardarListaActiva(L);
    });
  });
  $("listasList").querySelectorAll("[data-delL]").forEach(function(b){
    b.addEventListener("click", function(){
      var i = parseInt(b.getAttribute("data-delL"),10), L = LISTAS[i];
      if(!confirm("¿Borrar la lista «" + L.nombre + "»? Se quitan sus " + L.items.length + " artículos del catálogo.")) return;
      LISTAS.splice(i,1);
      construirItems(); renderCatalogo(); renderListas(); borrarListaDb(L);
    });
  });
}

/* --- parser de pegado / CSV --- */
var impRows = [], impHead = [];
/* elige separador, o devuelve "" si el texto no es una tabla */
function detectarSep(lineas){
  var muestra = lineas.slice(0, 60);
  var conTab = muestra.filter(function(l){ return l.indexOf("\t") > -1; }).length;
  if(conTab >= muestra.length*0.7) return "\t";
  var conPc = muestra.filter(function(l){ return l.indexOf(";") > -1; }).length;
  if(conPc >= muestra.length*0.7) return ";";
  var cols = muestra.map(function(l){ return partir(l, ",").length; });
  var moda = {}, mejor = 0, mejorN = 0;
  cols.forEach(function(c){ moda[c] = (moda[c]||0)+1; if(moda[c] > mejorN){ mejorN = moda[c]; mejor = c; } });
  if(mejor >= 3 && mejorN >= muestra.length*0.8) return ",";
  return "";
}
/* una línea por artículo: el último número de la línea es el precio */
function parsearLineas(lineas){
  var out = [];
  lineas.forEach(function(l){
    l = l.replace(/\.{3,}|_{3,}/g, " ").trim();
    if(l.length < 5) return;
    var re = /-?\d[\d.,]*/g, m, ult = null;
    while((m = re.exec(l)) !== null) ult = m;
    if(!ult) return;
    var v = parsearNumero(ult[0]);
    if(!isFinite(v) || v <= 0) return;
    var d = l.slice(0, ult.index).replace(/[\s$:|\-–—]*$/,"").replace(/\b(u\$s|us\$|usd|\$)\s*$/i,"").trim();
    if(d.length < 4) return;
    var cod = "";
    var mc = d.match(/^(\d{2,8})\s+(.{4,})$/);
    if(mc && /[A-Za-zÁÉÍÓÚÑáéíóúñ]{3}/.test(mc[2])){ cod = mc[1]; d = mc[2].trim(); }
    out.push([d, cod, ult[0]]);   // se guarda crudo: el precio se parsea una sola vez, más abajo
  });
  return out;
}
function partir(linea, sep){
  var out = [], cur = "", q = false;
  for(var i=0;i<linea.length;i++){
    var c = linea[i];
    if(c === '"'){ if(q && linea[i+1] === '"'){ cur += '"'; i++; } else q = !q; }
    else if(c === sep && !q){ out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map(function(x){ return x.trim(); });
}
/* "," o "." como separador decimal: se decide una vez para toda la lista */
var FMTDEC = null;
function detectarFormatoNumero(txt){
  var coma = (txt.match(/\d,\d{1,2}(?!\d)/g)||[]).length;
  var punto = (txt.match(/\d\.\d{1,2}(?!\d)/g)||[]).length;
  if(coma > punto) return "coma";
  if(punto > coma) return "punto";
  var mil3punto = (txt.match(/\d\.\d{3}(?!\d)/g)||[]).length;
  var mil3coma  = (txt.match(/\d,\d{3}(?!\d)/g)||[]).length;
  if(mil3punto > mil3coma) return "coma";   // el punto separa miles
  if(mil3coma > mil3punto) return "punto";  // la coma separa miles
  return null;
}
function parsearNumero(s){
  s = String(s||"").replace(/[^\d.,-]/g,"").trim();
  if(!s) return NaN;
  if(FMTDEC === "coma") return parseFloat(s.replace(/\./g,"").replace(",","."));
  if(FMTDEC === "punto") return parseFloat(s.replace(/,/g,""));
  var lastC = s.lastIndexOf(","), lastD = s.lastIndexOf(".");
  if(lastC > -1 && lastD > -1)
    return lastC > lastD ? parseFloat(s.replace(/\./g,"").replace(",",".")) : parseFloat(s.replace(/,/g,""));
  if(lastC > -1){
    var dec = s.length - lastC - 1;
    return dec <= 2 ? parseFloat(s.replace(",", ".")) : parseFloat(s.replace(/,/g,""));
  }
  return parseFloat(s);
}
function analizarPegado(txt){
  var lineas = txt.split(/\r?\n/).filter(function(l){ return l.trim() !== ""; });
  if(lineas.length < 1){ impRows=[]; impHead=[]; $("mapBox").hidden=true; $("btnImportar").disabled=true; return; }
  FMTDEC = detectarFormatoNumero(txt);
  var modo = $("iModo").value;
  var sep = modo === "lineas" ? "" : (modo === "tabla" ? (detectarSep(lineas) || "\t") : detectarSep(lineas));
  if(sep === ""){
    impHead = ["Descripción","Código","Precio"];
    impRows = parsearLineas(lineas);
    $("modoInfo").textContent = "Leído como texto suelto: de cada línea se toma el último número como precio.";
    llenarMapeo();
    return;
  }
  $("modoInfo").textContent = "Leído como tabla, separada por " + (sep === "\t" ? "tabulaciones" : sep === ";" ? "punto y coma" : "comas") + ".";
  var filas = lineas.map(function(l){ return partir(l, sep); });
  var nCols = Math.max.apply(null, filas.map(function(f){ return f.length; }));
  filas = filas.map(function(f){ while(f.length < nCols) f.push(""); return f; });
  var prim = filas[0].join(" ").toLowerCase();
  var tieneHead = /(descrip|producto|art[ií]culo|detalle|precio|costo|c[oó]digo|cod\b|bulto)/.test(prim) &&
                  filas[0].filter(function(c){ return isFinite(parsearNumero(c)); }).length < nCols/2;
  impHead = tieneHead ? filas[0].map(function(c,i){ return c || ("Columna "+(i+1)); }) : filas[0].map(function(_,i){ return "Columna "+(i+1); });
  impRows = tieneHead ? filas.slice(1) : filas;
  llenarMapeo();
}
function llenarMapeo(){
  if(!impRows.length){ $("mapBox").hidden = true; $("btnImportar").disabled = true; return; }
  $("mapBox").hidden = false;
  var opts = function(incluirVacio){
    return (incluirVacio ? '<option value="-1">— ninguna —</option>' : "") +
      impHead.map(function(h,i){ return '<option value="'+i+'">'+esc(h)+'</option>'; }).join("");
  };
  $("mDesc").innerHTML = opts(false);
  $("mPrecio").innerHTML = opts(false);
  $("mCod").innerHTML = opts(true);
  $("mBulto").innerHTML = opts(true);
  $("mExtra").innerHTML = opts(true);
  // autodeteccion
  var pick = function(rx, fallback){
    for(var i=0;i<impHead.length;i++) if(rx.test(normal(impHead[i]))) return i;
    return fallback;
  };
  var iDesc = pick(/(descrip|producto|articulo|detalle|nombre)/, -1);
  var iPre  = pick(/(precio|costo|importe|valor|unitario)/, -1);
  var iCod  = pick(/(codigo|cod|sku|art\.?$|referencia)/, -1);
  var iBul  = pick(/(bulto|pack|caja|unid)/, -1);
  // "Producto" + "Descripción" en columnas separadas: se suman en la descripción
  var iExtra = -1;
  if(iDesc >= 0){
    for(var e=0;e<impHead.length;e++){
      if(e !== iDesc && /(descrip|detalle|modelo|tela|material)/.test(normal(impHead[e]))){ iExtra = e; break; }
    }
  }
  if(iDesc < 0 || iPre < 0){
    // por contenido: descripcion = columna con mas letras; precio = columna numerica de mayor promedio
    var letras = [], nums = [];
    for(var c=0;c<impHead.length;c++){
      var L=0, N=0, S=0;
      impRows.slice(0,40).forEach(function(f){
        var v = f[c]||"";
        L += (v.match(/[A-Za-zÁÉÍÓÚÑáéíóúñ]/g)||[]).length;
        var n = parsearNumero(v); if(isFinite(n)){ N++; S += n; }
      });
      letras.push(L); nums.push({c:c, n:N, prom:N?S/N:0});
    }
    if(iDesc < 0) iDesc = letras.indexOf(Math.max.apply(null, letras));
    if(iPre < 0){
      var cands = nums.filter(function(x){ return x.c !== iDesc && x.n > impRows.slice(0,40).length*0.6; });
      cands.sort(function(a,b){ return b.prom - a.prom; });
      iPre = cands.length ? cands[0].c : (iDesc === 0 ? 1 : 0);
    }
  }
  // sin encabezado: adivinar código y bulto por el contenido de las columnas libres
  var muestra = impRows.slice(0,40);
  if(muestra.length && (iCod < 0 || iBul < 0)){
    var libres = [];
    for(var c2=0;c2<impHead.length;c2++) if(c2 !== iDesc && c2 !== iPre) libres.push(c2);
    var stats = libres.map(function(c){
      var codOk=0, bulOk=0, llenas=0, vals={};
      muestra.forEach(function(fila){
        var v = (fila[c]||"").trim();
        if(!v) return;
        llenas++; vals[v] = 1;
        if(/^[0-9A-Za-z][0-9A-Za-z\-\/\.\s]{0,16}$/.test(v) && /\d/.test(v)) codOk++;
        var n = parsearNumero(v);
        if(isFinite(n) && n > 0 && n < 100000 && Math.abs(n-Math.round(n)) < 1e-9) bulOk++;
      });
      return { c:c, llenas:llenas, cod:llenas?codOk/llenas:0, bul:llenas?bulOk/llenas:0, uniq:llenas?Object.keys(vals).length/llenas:0 };
    }).filter(function(s){ return s.llenas >= muestra.length*0.5; });
    if(iCod < 0){
      var cs = stats.filter(function(s){ return s.cod > 0.7 && s.uniq > 0.7; });
      cs.sort(function(a,b){ return b.uniq - a.uniq || a.c - b.c; });
      if(cs.length) iCod = cs[0].c;
    }
    if(iBul < 0){
      var bs = stats.filter(function(s){ return s.c !== iCod && s.bul > 0.7; });
      bs.sort(function(a,b){ return a.uniq - b.uniq || a.c - b.c; });
      if(bs.length) iBul = bs[0].c;
    }
  }
  $("mDesc").value = String(Math.max(0,iDesc));
  $("mPrecio").value = String(Math.max(0,iPre));
  $("mCod").value = String(iCod);
  $("mBulto").value = String(iBul);
  $("mExtra").value = String(iExtra);
  vistaPrevia();
  ["mDesc","mPrecio","mCod","mBulto","mExtra"].forEach(function(id){ $(id).onchange = vistaPrevia; });
}
/* "2,62 USS", "U$S 18.90", "$ 11.850": moneda escrita en la celda del precio (null si no dice) */
function monedaDe(txt){
  var t = String(txt||"");
  if(/(\bu\$\s?s\b|\bu\s?s\s?s\b|\busd\b|\bus\$|d[oó]lar)/i.test(t)) return "USD";
  if(/\$|\bars\b|pesos/i.test(t)) return "ARS";
  return null;
}
/* primer importe de la celda: "NUEVO PRODUCTO 11,00 USS" -> 11; "108,92 USS 119,81 USS" -> 108.92 */
function precioDeCelda(txt){
  var m = String(txt||"").match(/\d[\d.,]*\d|\d/);
  return m ? parsearNumero(m[0]) : NaN;
}
/* rubro por palabras clave (del título de sección o de la descripción) */
var RUBRO_CLAVES = [
  ["Guantes y manguitos", /guante|manguito/],
  ["Protección respiratoria", /respirat|mascara|semimascara|full face|filtro|cartucho|barbijo|valvula de (ex|in)halacion|copa nasal|orring/],
  ["Protección visual y facial", /anteojo|antiparra|lente|visor|careta|protector facial|mascara de soldar/],
  ["Protección auditiva", /auditiv|tapon|endoaural|copa auditiva/],
  ["Protección de cabeza", /casco|cofia|capucha termica/],
  ["Calzado de seguridad", /calzado|bota|botin|zapato|zapatilla/],
  ["Protección contra caídas", /arnes|caida|cabo de vida|eslinga de posic|mosqueton|linea de vida|anticaida/],
  ["Emergencias y primeros auxilios", /botiquin|emergencia|lavaojos|primeros auxilios|camilla/],
  ["Señalización y demarcación", /senal|cinta de peligro|cono|demarcac|baliza|cartel/],
  ["Sujeción de cargas", /sujecion|carga|faja de amarre|crique|eslinga/],
  ["Indumentaria de trabajo", /indumentaria|ropa|campera|pantalon|camisa|mameluco|chaleco|capa|traje|delantal|buzo|parka|ambo|faja lumbar|remera|chomba/]
];
function rubroDe(txt){
  var t = normal(txt);
  if(!t) return null;
  for(var i=0;i<RUBRO_CLAVES.length;i++){ if(RUBRO_CLAVES[i][1].test(t)) return RUBRO_CLAVES[i][0]; }
  return null;
}
/* fila de título de sección: un solo texto, sin precio (p. ej. "GUANTES DE CUERO PARA SOLDADOR") */
function esTituloSeccion(f, iP){
  var llenas = f.filter(function(c){ return String(c||"").trim(); });
  return llenas.length === 1 && !isFinite(precioDeCelda(f[iP])) && /[A-Za-zÁÉÍÓÚÑáéíóúñ]{4}/.test(llenas[0]);
}
function filasImportadas(){
  var iD = parseInt($("mDesc").value,10), iP = parseInt($("mPrecio").value,10),
      iC = parseInt($("mCod").value,10),  iB = parseInt($("mBulto").value,10),
      iE = parseInt($("mExtra").value,10);
  var out = [], malas = 0, secciones = 0, seccion = "";
  impRows.forEach(function(f){
    if(esTituloSeccion(f, iP)){ seccion = f.filter(function(c){ return String(c||"").trim(); })[0]; secciones++; return; }
    var d = (f[iD]||"").trim();
    var extra = iE >= 0 && iE !== iD ? (f[iE]||"").trim() : "";
    if(d && extra) d = d + " " + extra;
    var v = precioDeCelda(f[iP]);
    if(!d || d.length < 3 || !isFinite(v) || v <= 0){ malas++; return; }
    var bulto = iB >= 0 ? (f[iB]||"").trim() : "";
    if(/[A-Za-z]/.test(bulto)){ var nb = bulto.match(/\d+(?!.*\d)/); bulto = nb ? nb[0] : ""; }
    out.push({ d:d, v:Math.round(v*1000)/1000, c:(iC>=0?(f[iC]||"").trim():""), b:bulto,
      m:monedaDe(f[iP]), r:rubroDe(d) || rubroDe(seccion) });  // la descripción manda: hay secciones sin título
  });
  return { rows:out, malas:malas, secciones:secciones };
}
/* si la mayoría de los precios dice la moneda, se elige sola en "Moneda de los precios" */
function monedaDetectada(rows){
  var usd = 0, ars = 0;
  rows.forEach(function(x){ if(x.m === "USD") usd++; else if(x.m === "ARS") ars++; });
  if(rows.length && usd >= rows.length * 0.6) return "USD";
  if(rows.length && ars >= rows.length * 0.6) return "ARS";
  return null;
}
function vistaPrevia(){
  var r = filasImportadas();
  var det = monedaDetectada(r.rows);
  if(det && $("iMon").value !== det){ $("iMon").value = det; }
  var mon = $("iMon").value, rub = $("iRubro").value || "Otros";
  $("prevBox").innerHTML = '<table><thead><tr><th>Descripción</th><th>Código</th><th>Bulto</th><th>Rubro</th><th>Precio</th></tr></thead><tbody>'+
    r.rows.slice(0,8).map(function(x){
      var m = x.m || mon;
      return '<tr><td>'+esc(x.d)+'</td><td>'+esc(x.c)+'</td><td>'+esc(x.b)+'</td><td>'+esc(x.r || rub)+'</td>'+
        '<td>'+(m === "USD" ? "U$S " : "$ ")+fmt(x.v)+'</td></tr>';
    }).join("")+
    '</tbody></table>';
  var conRubro = r.rows.filter(function(x){ return x.r; }).length;
  $("impInfo").textContent = r.rows.length + " artículos listos" +
    (det ? " · precios en " + (det === "USD" ? "dólares" : "pesos") + " (detectado)" : "") +
    (r.rows.length ? " · " + conRubro + " con rubro reconocido" : "") +
    (r.malas ? " · " + r.malas + " filas descartadas (sin descripción o sin precio)" : "");
  $("btnImportar").disabled = r.rows.length === 0;
}

/* JSON con artículos {p:proveedor, r:rubro, c:código, d:descripción, b:bulto, m:"USD"|"ARS", v:costo}:
   crea una lista por proveedor, respetando rubro y moneda de cada artículo */
function importarJson(file){
  var fr = new FileReader();
  fr.onload = function(){
    var arr;
    try{ arr = JSON.parse(String(fr.result)); }catch(e){ toast("El archivo no es un JSON válido."); return; }
    if(!Array.isArray(arr)) arr = arr && Array.isArray(arr.items) ? arr.items : [];
    var ok = arr.filter(function(x){ return x && x.d && isFinite(parseFloat(x.v)) && parseFloat(x.v) > 0; });
    if(!ok.length){ toast("El JSON no trae artículos con descripción (d) y costo (v)."); return; }
    var porProv = {};
    ok.forEach(function(x){ var p = String(x.p || "PROPIA").toUpperCase().slice(0,18); (porProv[p] = porProv[p] || []).push(x); });
    var base = file.name.replace(/\.[^.]+$/,"");
    var nuevas = Object.keys(porProv).sort().map(function(p, i){
      var its = porProv[p].map(function(x){ return { p:p, r:x.r||"Otros", c:String(x.c||""), d:String(x.d), b:String(x.b||""),
        m:x.m==="USD"?"USD":"ARS", v:Math.round(parseFloat(x.v)*1000)/1000 }; });
      var mons = {}; its.forEach(function(x){ mons[x.m] = 1; });
      return { id:"l"+Date.now().toString(36)+i, nombre:p+" — "+base, prov:p,
        moneda:Object.keys(mons).length > 1 ? "mixta" : its[0].m, fecha:hoy(), activa:true, items:its };
    });
    nuevas.forEach(function(L){ LISTAS.push(L); });
    construirItems(); renderCatalogo(); renderListas(); renderMargenes();
    nuevas.reduce(function(pr, L){ return pr.then(function(){ return guardarListaNueva(L); }); }, Promise.resolve())
      .then(function(){ toast("Importados " + ok.length + " artículos en " + nuevas.length + (nuevas.length===1?" lista.":" listas.")); })
      .catch(function(){});
    $("impForm").hidden = true;
  };
  fr.onerror = function(){ toast("No se pudo leer el archivo."); };
  fr.readAsText(file, "utf-8");
}

/* PDF de proveedor: el servidor saca la tabla (o el texto) y se revisa en el mapeo antes de importar */
function importarPdf(file){
  $("mapBox").hidden = true;
  $("impInfo").textContent = "";
  $("modoInfo").textContent = "";
  var ejemplo = $("iPaste").placeholder;
  $("iPaste").value = "";
  $("iPaste").placeholder = "Leyendo " + file.name + "…";
  var body = new FormData();
  body.append("file", file);
  fetch("/api/cotizador/pdf-texto", { method:"POST", headers:{ "Authorization":"Bearer " + token() }, body:body })
    .then(function(r){
      if(r.status === 401){ irAlLogin(); throw { code:"la sesión venció" }; }
      if(r.status === 413) throw { code:"el PDF es demasiado grande (máximo 20 MB)" };
      return r.json().catch(function(){ return {}; }).then(function(j){
        if(!r.ok) throw { code: j.detail || ("error " + r.status) };
        return j;
      });
    }, function(){ throw { code:"sin conexión" }; })
    .then(function(j){
      $("iModo").value = j.modo === "tabla" ? "tabla" : "lineas";
      $("iPaste").value = j.texto;
      if(!$("iNombre").value) $("iNombre").value = file.name.replace(/\.[^.]+$/,"");
      analizarPegado(j.texto);
      $("modoInfo").textContent = (j.modo === "tabla"
        ? "Se leyó la tabla del PDF (" + j.filas + " filas"
        : "El PDF no tiene una tabla clara: se leyó el texto línea por línea (" + j.filas + " líneas") +
        ", " + j.paginas + (j.paginas === 1 ? " página)." : " páginas).") + " Revisá las columnas y la vista previa antes de importar.";
      toast("PDF leído. Revisá la vista previa y tocá Importar.");
    })
    .catch(function(e){ toast("No se pudo leer el PDF: " + ((e && e.code) || "error")); })
    .then(function(){ $("iPaste").placeholder = ejemplo; });
}

/* ============ márgenes ============ */
function renderMargenes(){
  var usados = [];
  RUBROS_ORD.forEach(function(r){ if(ITEMS.some(function(i){ return i.rubro === r; })) usados.push(r); });
  ITEMS.forEach(function(i){ if(usados.indexOf(i.rubro) === -1) usados.push(i.rubro); });
  var nArt = Object.keys(margenArt).length;
  $("margCount").textContent = nArt + (nArt===1?" artículo con margen propio":" artículos con margen propio");
  $("margList").innerHTML = usados.map(function(r){
    var n = ITEMS.filter(function(i){ return i.rubro === r; }).length;
    var v = cfg.rubroMargen[r];
    return '<div class="mrow"><div class="grow">'+esc(r)+'<br><small>'+n+' artículos'+(v==null?' · usa el general':'')+'</small></div>'+
      '<input data-rub="'+esc(r)+'" value="'+(v==null?"":v)+'" placeholder="'+cfg.margen+'" inputmode="decimal" aria-label="Margen de '+esc(r)+'"></div>';
  }).join("");
  $("margList").querySelectorAll("[data-rub]").forEach(function(inp){
    inp.addEventListener("change", function(){
      var r = inp.getAttribute("data-rub"), v = inp.value.trim();
      if(v === "") delete cfg.rubroMargen[r]; else cfg.rubroMargen[r] = num(v);
      guardarCfg(); renderCatalogo(); renderMargenes();
    });
  });
}

/* ============ borrador local ============ */
function guardarBorrador(){
  formADoc();
  if(lista) formALista();
  try{ localStorage.setItem(LS, JSON.stringify({ cfg:cfg, doc:doc, lista:lista, margenArt:margenArt })); }catch(e){}
}
function leerBorrador(){ try{ var s=localStorage.getItem(LS); return s?JSON.parse(s):null; }catch(e){ return null; } }

var toastEl=null, toastT=null;
function toast(msg){
  if(toastEl) toastEl.remove();
  toastEl = document.createElement("div");
  toastEl.className = "toast"; toastEl.textContent = msg; toastEl.setAttribute("role","status");
  document.body.appendChild(toastEl);
  clearTimeout(toastT);
  toastT = setTimeout(function(){ if(toastEl){ toastEl.remove(); toastEl = null; } }, 2800);
}

/* ================= PDF ================= */
var WH=[278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
var WB=[278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
/* caracteres Unicode comunes que no entran en Latin-1 → su código WinAnsi */
var WINANSI={8212:151,8211:150,8226:149,8220:147,8221:148,8216:145,8217:146,8364:128,8230:133};
function tw(s,size,bold){ var t=bold?WB:WH, w=0; s=String(s); for(var i=0;i<s.length;i++){ var c=s.charCodeAt(i); w += (c>=32&&c<=126)?t[c-32]:(c===183?278:556); } return w*size/1000; }
function pesc(s){ var o=""; for(var i=0;i<s.length;i++){ var c=s.charCodeAt(i); if(WINANSI[c]) c=WINANSI[c]; else if(c>255) c=63; var ch=String.fromCharCode(c); if(ch==="("||ch===")"||ch==="\\") o+="\\"; o+=ch; } return o; }
function wrapText(s,size,bold,maxW){
  var out=[];
  String(s==null?"":s).split(/\r?\n/).forEach(function(par){
    var w=par.split(/\s+/).filter(Boolean), cur="";
    for(var i=0;i<w.length;i++){ var t=cur?cur+" "+w[i]:w[i]; if(tw(t,size,bold)>maxW && cur){ out.push(cur); cur=w[i]; } else cur=t; }
    if(cur) out.push(cur);
  });
  return out.length?out:[""];
}
function f(n){ return (Math.round(n*100)/100).toString(); }

/* paleta del PDF (RGB 0–1), alineada con la marca */
var C_BAND=[0.169,0.153,0.141], C_RED=[0.71,0.20,0.176], C_INK=[0.114,0.102,0.094],
    C_INK2=[0.38,0.35,0.33], C_INK3=[0.56,0.53,0.50], C_SOFT=[0.965,0.953,0.941],
    C_LINE=[0.86,0.835,0.81], C_CREAM=[0.925,0.906,0.886], C_WHITE=[1,1,1];
function rgb(c){ return f(c[0])+" "+f(c[1])+" "+f(c[2]); }

function Page(){ this.ops=[]; }
Page.prototype.txt=function(x,y,s,size,bold,color){ if(s===""||s==null) return;
  this.ops.push("BT "+rgb(color||C_INK)+" rg /"+(bold?"F2":"F1")+" "+size+" Tf "+f(x)+" "+f(y)+" Td ("+pesc(String(s))+") Tj ET"); };
Page.prototype.txtR=function(x,y,s,size,bold,color){ this.txt(x-tw(String(s),size,bold),y,s,size,bold,color); };
Page.prototype.txtC=function(cx,y,s,size,bold,color){ this.txt(cx-tw(String(s),size,bold)/2,y,s,size,bold,color); };
Page.prototype.line=function(x1,y1,x2,y2,w,color){ this.ops.push(rgb(color||C_LINE)+" RG "+f(w||.6)+" w "+f(x1)+" "+f(y1)+" m "+f(x2)+" "+f(y2)+" l S"); };
Page.prototype.fill=function(x,y,w,h,color){ this.ops.push(rgb(color)+" rg "+f(x)+" "+f(y)+" "+f(w)+" "+f(h)+" re f"); };
Page.prototype.img=function(x,y,w,h){ this.ops.push("q "+f(w)+" 0 0 "+f(h)+" "+f(x)+" "+f(y)+" cm /Im1 Do Q"); };

var PW=595.28, PH=841.89, M=36, BW=PW-2*M;
var EMPRESA="INDUMENTARIA SEGURA S.R.L.", DOMICILIO="Rvdo. Padre Luis Varvello 104",
    TEL="0237 - 4190352", MAIL="federico@indumentariasegura.com.ar";

function ahoraTxt(){
  var a=new Date();
  return a.getDate()+"/"+(a.getMonth()+1)+"/"+a.getFullYear()+" "+String(a.getHours()).padStart(2,"0")+":"+String(a.getMinutes()).padStart(2,"0");
}
function plata(n){ return "$ "+fmt(n); }
function cortar(s,size,bold,maxW){
  s=String(s||"");
  if(tw(s,size,bold)<=maxW) return s;
  while(s.length>1 && tw(s+"...",size,bold)>maxW) s=s.slice(0,-1);
  return s+"...";
}

/* banda superior con logo, título y subtítulo a la derecha; devuelve la y libre */
function banda(p,titulo,sub){
  var bh=80;
  p.fill(0,PH-bh,PW,bh,C_BAND);
  p.fill(0,PH-bh-3,PW,3,C_RED);
  if(window.LOGO && window.LOGO.jpg){
    var ih=42, iw=ih*window.LOGO.w/window.LOGO.h;
    p.img(M-8,PH-bh+(bh-ih)/2,iw,ih);
  }
  p.txtR(PW-M,PH-37,titulo,19,true,C_WHITE);
  if(sub) p.txtR(PW-M,PH-54,sub,9,false,C_CREAM);
  var y=PH-bh-3-17;
  p.txt(M,y,EMPRESA,8,true,C_INK);
  p.txtR(PW-M,y,DOMICILIO+"  ·  Tel. "+TEL+"  ·  "+MAIL,7.5,false,C_INK2);
  return y-14;
}
function etiqueta(p,x,y,s){ p.txt(x,y,String(s).toUpperCase(),6.8,true,C_RED); }
/* pie fijo de cada hoja */
function pieHoja(p,izq,nro,total){
  p.line(M,M+16,PW-M,M+16,.6);
  p.txt(M,M+5,izq,7,false,C_INK3);
  p.txtR(PW-M,M+5,"Emitido "+ahoraTxt()+(total>1?"  ·  Hoja "+nro+" de "+total:""),7,false,C_INK3);
}

/* ---------- cotización ---------- */
function construirPDF(d,t){
  var pages=[], hayDesc=d.items.some(function(r){ return num(r.desc_pct)!==0; });
  var X = hayDesc
    ? { cant:M+34, desc:M+46, precio:PW-M-148, descu:PW-M-96, tot:PW-M-8 }
    : { cant:M+34, desc:M+46, precio:PW-M-106, descu:0, tot:PW-M-8 };
  var descW = X.precio-72-X.desc;
  var sub = "N° "+(d.numero||"s/n")+"  ·  "+fechaAR(d.fecha);

  function nuevaHoja(primera, sinTabla){
    var p=new Page(); pages.push(p);
    var y=banda(p, primera?"COTIZACIÓN":"COTIZACIÓN (cont.)", sub);
    if(primera) y=tarjetas(p,y);
    return { p:p, y:sinTabla ? y : cabeza(p,y) };
  }
  function tarjetas(p,y){
    var gap=12, cw=(BW-gap)/2, ch=66, top=y;
    p.fill(M,top-ch,cw,ch,C_SOFT); p.fill(M,top-ch,2.5,ch,C_RED);
    etiqueta(p,M+14,top-15,"Cliente");
    p.txt(M+14,top-31,cortar(d.empresa||"—",12,true,cw-28),12,true,C_INK);
    wrapText(d.direccion||"",8.5,false,cw-28).slice(0,2).forEach(function(l,i){ p.txt(M+14,top-46-i*11,l,8.5,false,C_INK2); });
    var x2=M+cw+gap;
    p.fill(x2,top-ch,cw,ch,C_SOFT);
    etiqueta(p,x2+14,top-15,"Detalle");
    [["Fecha",fechaAR(d.fecha)],["Entrega",fechaAR(d.entrega)],["Cotizó",d.cotizo]].forEach(function(r,i){
      var yy=top-31-i*13;
      p.txt(x2+14,yy,r[0],8.5,false,C_INK2);
      p.txtR(x2+cw-14,yy,cortar(r[1]||"—",8.5,true,cw-90),8.5,true,C_INK);
    });
    return top-ch-16;
  }
  function cabeza(p,y){
    p.fill(M,y-20,BW,20,C_BAND);
    var ty=y-13.2;
    p.txtR(X.cant,ty,"CANT.",7.2,true,C_WHITE);
    p.txt(X.desc,ty,"DESCRIPCIÓN",7.2,true,C_WHITE);
    p.txtR(X.precio,ty,"P. UNITARIO",7.2,true,C_WHITE);
    if(hayDesc) p.txtR(X.descu,ty,"DESC.",7.2,true,C_WHITE);
    p.txtR(X.tot,ty,"SUBTOTAL",7.2,true,C_WHITE);
    return y-20;
  }

  var h=nuevaHoja(true), p=h.p, y=h.y, LIM=M+30;
  d.items.forEach(function(r,i){
    var lines=wrapText(r.desc||"",8.5,false,descW), rh=lines.length*11+9;
    if(y-rh<LIM){ h=nuevaHoja(false); p=h.p; y=h.y; }
    if(i%2===1) p.fill(M,y-rh,BW,rh,C_SOFT);
    var by=y-14;
    p.txtR(X.cant,by,String(num(r.cant)),8.5,true,C_INK);
    lines.forEach(function(l,k){ p.txt(X.desc,by-k*11,l,8.5,false,C_INK); });
    p.txtR(X.precio,by,fmt(num(r.precio)),8.5,false,C_INK);
    if(hayDesc) p.txtR(X.descu,by,num(r.desc_pct)?num(r.desc_pct)+" %":"—",8.5,false,C_INK2);
    p.txtR(X.tot,by,fmt(lineaTotal(r)),8.5,true,C_INK);
    y-=rh;
  });
  p.line(M,y,PW-M,y,.8,C_BAND);

  /* totales + notas: necesitan ~120 pt */
  var leftW=BW-230;
  var notas=[];
  if(d.talles) notas.push(["Talles", wrapText(d.talles,8,false,leftW-24).slice(0,4)]);
  if(d.obs) notas.push(["Observaciones", wrapText(d.obs,8,false,leftW-24).slice(0,5)]);
  var notasH=notas.reduce(function(a,n){ return a+22+n[1].length*10.5; },0);
  var need=Math.max(104,notasH)+18;
  if(y-need<LIM-6){ h=nuevaHoja(false,true); p=h.p; y=h.y+10; }
  var top=y-16, tx=PW-M-210, tr=PW-M-10;
  p.txt(tx,top-10,"Neto",9,false,C_INK2);            p.txtR(tr,top-10,plata(t.neto),9,false,C_INK);
  p.txt(tx,top-26,"IVA "+cfg.iva+" %",9,false,C_INK2); p.txtR(tr,top-26,plata(t.iva),9,false,C_INK);
  p.line(tx,top-35,PW-M,top-35,.6);
  p.fill(tx-10,top-72,220,30,C_RED);
  p.txt(tx,top-61,"TOTAL",10,true,C_WHITE);
  p.txtR(tr,top-62,plata(t.total),13,true,C_WHITE);
  p.txt(tx,top-88,"Precios en pesos argentinos.",7,false,C_INK3);

  var ny=top;
  if(notas.length){
    p.fill(M,top-notasH-4,leftW,notasH+4,C_SOFT);
    notas.forEach(function(n){
      etiqueta(p,M+12,ny-13,n[0]);
      n[1].forEach(function(l,k){ p.txt(M+12,ny-26-k*10.5,l,8,false,C_INK); });
      ny-=22+n[1].length*10.5;
    });
  }

  pages.forEach(function(pg,i){ pieHoja(pg,"Documento no válido como factura  ·  Cotización N° "+(d.numero||"s/n"),i+1,pages.length); });
  return serializar(pages);
}

/* ---------- lista de precios ---------- */
function construirListaPDF(L){
  var pages=[], filas=L.items;
  /* columnas cortas (talles, color, descripción) al ancho de su texto más largo, con tope;
     producto se queda con el resto */
  var cols=[
    { k:"prod",   t:"PRODUCTO" },
    { k:"desc",   t:"DESCRIPCIÓN", tope:150, min:70 },
    { k:"talles", t:"TALLES",      tope:62,  min:44, c:true },
    { k:"color",  t:"COLOR",       tope:132, min:50, c:true }
  ].filter(function(c){ return c.k==="prod" || filas.some(function(r){ return String(r[c.k]||"").trim(); }); });
  var precioW=86, pad=8, libre=BW-precioW-pad, x=M+pad, usado=0;
  cols.forEach(function(c){
    if(c.k==="prod") return;
    var mx=filas.reduce(function(a,r){ return Math.max(a,tw(String(r[c.k]||""),8.5,false)); },tw(c.t,7.2,true));
    c.ancho=Math.min(c.tope,Math.max(c.min,mx+16)); usado+=c.ancho;
  });
  cols[0].ancho=libre-usado;
  cols.forEach(function(c){ c.x=x; x+=c.ancho; });
  var sub=[L.periodo, L.para ? "Para "+L.para : ""].filter(Boolean).join("  ·  ");

  function nuevaHoja(primera, sinTabla){
    var p=new Page(); pages.push(p);
    var y=banda(p, primera?"LISTA DE PRECIOS":"LISTA DE PRECIOS (cont.)", sub);
    if(sinTabla) return { p:p, y:y+10 };
    if(primera && L.titulo && normal(L.titulo)!=="lista de precios"){
      p.txt(M,y-6,L.titulo,13,true,C_INK); y-=24;
    }
    p.fill(M,y-20,BW,20,C_BAND);
    cols.forEach(function(c){ var ty=y-13.2; if(c.c) p.txtC(c.x+c.ancho/2,ty,c.t,7.2,true,C_WHITE); else p.txt(c.x,ty,c.t,7.2,true,C_WHITE); });
    p.txtR(PW-M-pad,y-13.2,L.conIva?"PRECIO C/IVA":"PRECIO + IVA",7.2,true,C_WHITE);
    return { p:p, y:y-20 };
  }

  var h=nuevaHoja(true), p=h.p, y=h.y, LIM=M+30;
  filas.forEach(function(r,i){
    var fuerte=String(r.prod||"").length<=40;
    var celdas=cols.map(function(c){ return wrapText(r[c.k]||"",8.5,c.k==="prod"&&fuerte,c.ancho-10); });
    var nl=Math.max.apply(null,celdas.map(function(a){ return a.length; })), rh=nl*11+9;
    if(y-rh<LIM){ h=nuevaHoja(false); p=h.p; y=h.y; }
    if(i%2===1) p.fill(M,y-rh,BW,rh,C_SOFT);
    var by=y-14;
    cols.forEach(function(c,ci){
      celdas[ci].forEach(function(l,k){
        if(c.c) p.txtC(c.x+c.ancho/2,by-k*11,l,8.5,false,C_INK2);
        else p.txt(c.x,by-k*11,l,8.5,c.k==="prod"&&fuerte,c.k==="prod"?C_INK:C_INK2);
      });
    });
    p.txtR(PW-M-pad,by,plata(precioLista(r)),8.5,true,C_INK);
    y-=rh;
  });
  p.line(M,y,PW-M,y,.8,C_BAND);

  var notas=wrapText(L.notas||"",8,false,BW-40).slice(0,6);
  var nh=notas.length*11+20;
  if(y-nh-16<LIM-6){ h=nuevaHoja(false,true); p=h.p; y=h.y; }
  if(String(L.notas||"").trim()){
    var ny=y-14;
    p.fill(M,ny-nh,BW,nh,C_SOFT); p.fill(M,ny-nh,2.5,nh,C_RED);
    notas.forEach(function(l,k){ p.txt(M+16,ny-16-k*11,l,8,false,C_INK2); });
  }

  pages.forEach(function(pg,i){ pieHoja(pg,EMPRESA+"  ·  Lista de precios"+(L.periodo?" "+L.periodo:""),i+1,pages.length); });
  return serializar(pages);
}

function serializar(pages){
  var n=pages.length, objs=[], kids=[];
  for(var i=0;i<n;i++) kids.push((4+i*2)+" 0 R");
  objs[1]="<< /Type /Catalog /Pages 2 0 R >>";
  objs[2]="<< /Type /Pages /Kids ["+kids.join(" ")+"] /Count "+n+" >>";
  objs[3]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  var fontB=4+n*2, imgO=fontB+1;
  var jpg = "";
  if(window.LOGO && window.LOGO.jpg){ try{ jpg = atob(window.LOGO.jpg); }catch(e){ jpg = ""; } }
  var res = "/Font << /F1 3 0 R /F2 "+fontB+" 0 R >>" + (jpg ? " /XObject << /Im1 "+imgO+" 0 R >>" : "");
  for(var j=0;j<n;j++){
    var pi=4+j*2, ci=pi+1, content=pages[j].ops.join("\n");
    objs[pi]="<< /Type /Page /Parent 2 0 R /MediaBox [0 0 "+f(PW)+" "+f(PH)+"] /Resources << "+res+" >> /Contents "+ci+" 0 R >>";
    objs[ci]="<< /Length "+content.length+" >>\nstream\n"+content+"\nendstream";
  }
  objs[fontB]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  var maxObj=fontB;
  if(jpg){
    objs[imgO]="<< /Type /XObject /Subtype /Image /Width "+window.LOGO.w+" /Height "+window.LOGO.h+
      " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length "+jpg.length+" >>\nstream\n"+jpg+"\nendstream";
    maxObj=imgO;
  }
  var out="%PDF-1.4\n", off=[];
  for(var o=1;o<=maxObj;o++){ off[o]=out.length; out += o+" 0 obj\n"+(objs[o]||"<< >>")+"\nendobj\n"; }
  var xref=out.length;
  out += "xref\n0 "+(maxObj+1)+"\n0000000000 65535 f \n";
  for(var q=1;q<=maxObj;q++) out += String(off[q]).padStart(10,"0")+" 00000 n \n";
  out += "trailer\n<< /Size "+(maxObj+1)+" /Root 1 0 R >>\nstartxref\n"+xref+"\n%%EOF";
  var bytes=new Uint8Array(out.length);
  for(var b=0;b<out.length;b++) bytes[b]=out.charCodeAt(b)&0xFF;
  return bytes;
}

function guardarArchivo(nombre,bytes){
  var url = URL.createObjectURL(new Blob([bytes],{type:"application/pdf"}));
  var a = document.createElement("a");
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 5000);
  toast("PDF descargado: "+nombre);
}
function slug(s){ return String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""); }
function descargarPDF(){
  formADoc();
  if(!doc.items.length){ toast("Agregá al menos un renglón antes de generar el PDF."); return; }
  var bytes;
  try{ bytes=construirPDF(doc,totales()); }catch(e){ toast("No se pudo armar el PDF: "+e.message); return; }
  guardarArchivo("cotizacion-"+(doc.numero||"s-n")+(doc.empresa?"-"+slug(doc.empresa):"")+".pdf", bytes);
  registrarEvento("pdf", "PDF descargado");
  if(yaGuardada()) guardarCotizacion(true); else guardarBorrador();
}
function yaGuardada(){ return HIST.some(function(h){ return String(h.numero) === String(doc.numero); }); }
function descargarListaPDF(){
  formALista();
  if(!lista.items.length){ toast("Agregá al menos un producto a la lista."); return; }
  var bytes;
  try{ bytes=construirListaPDF(lista); }catch(e){ toast("No se pudo armar el PDF: "+e.message); return; }
  guardarArchivo("lista-de-precios"+(lista.para?"-"+slug(lista.para):"")+(lista.periodo?"-"+slug(lista.periodo):"")+".pdf", bytes);
}

/* ================= persistencia (API del panel AutoCRM) ================= */
var TOKEN_KEY = "autocrm_token";
function token(){ try{ return localStorage.getItem(TOKEN_KEY) || ""; }catch(e){ return ""; } }
function irAlLogin(){
  try{ localStorage.removeItem(TOKEN_KEY); }catch(e){}
  location.href = "/login?next=" + encodeURIComponent("/cotizador/");
}
function api(method, path, body){
  var opts = { method:method, headers:{ "Authorization":"Bearer " + token() } };
  if(body !== undefined){ opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
  return fetch("/api/cotizador" + path, opts).then(function(r){
    if(r.status === 401){ irAlLogin(); throw { code:"la sesión venció" }; }
    if(r.status === 429) throw { code:"demasiados cambios seguidos, esperá unos segundos" };
    if(!r.ok) throw { code:"error " + r.status };
    return r.json();
  }, function(){ throw { code:"sin conexión" }; });
}
function docPath(col, id){ return "/docs/" + col + "/" + encodeURIComponent(id); }
function marcarEstado(txt,on){ $("statusTxt").textContent=txt; $("dot").classList.toggle("on",!!on); }
function enLinea(){ marcarEstado("Guardado en el panel", true); }
function sinGuardar(e){
  var m = (e && e.code) || "error";
  marcarEstado("Sin guardar", false);
  toast("No se pudo guardar (" + m + ").");
}

var tCfg=null;
function guardarCfg(){
  guardarBorrador();
  clearTimeout(tCfg);
  tCfg = setTimeout(function(){
    api("PUT", docPath("config","general"), { tc:cfg.tc, margen:cfg.margen, iva:cfg.iva, redondeo:cfg.redondeo, rubroMargen:cfg.rubroMargen })
      .then(enLinea, sinGuardar);
  }, 800);
}
var tMg=null;
function guardarMargenes(){
  guardarBorrador();
  clearTimeout(tMg);
  tMg = setTimeout(function(){ api("PUT", docPath("margenes","articulos"), { map:margenArt }).then(enLinea, sinGuardar); }, 800);
}
function guardarListaActiva(L){
  api("PATCH", docPath("listas", L.id), { activa:L.activa }).then(enLinea, sinGuardar);
}
var CHUNK = 400;
function guardarListaNueva(L){
  var partes = [];
  for(var i=0;i<L.items.length;i+=CHUNK) partes.push(L.items.slice(i,i+CHUNK));
  L.chunks = partes.length;
  return Promise.all(partes.map(function(p,i){ return api("PUT", docPath("listaItems", L.id+"-"+i), { items:p }); }))
    .then(function(){
      return api("PUT", docPath("listas", L.id), { id:L.id, nombre:L.nombre, prov:L.prov, moneda:L.moneda,
        fecha:L.fecha, n:L.items.length, chunks:partes.length, activa:L.activa, ts:Date.now() });
    })
    .then(enLinea, function(e){ sinGuardar(e); throw e; });
}
function borrarListaDb(L){
  var n = L.chunks || Math.max(1, Math.ceil(L.items.length / CHUNK)), ps = [];
  for(var i=0;i<n;i++) ps.push(api("DELETE", docPath("listaItems", L.id+"-"+i)));
  ps.push(api("DELETE", docPath("listas", L.id)));
  Promise.all(ps).then(function(){ enLinea(); toast("Lista «" + L.nombre + "» borrada."); }, sinGuardar);
}
/* trae todo lo guardado en una sola llamada y lo aplica */
function cargarEstado(){
  marcarEstado("Cargando…", false);
  return api("GET", "/estado").then(function(E){
    var c = (E.config||{}).general;
    if(c){
      ["tc","margen","iva","redondeo"].forEach(function(k){ if(typeof c[k]==="number") cfg[k]=c[k]; });
      if(c.rubroMargen && typeof c.rubroMargen === "object") cfg.rubroMargen = c.rubroMargen;
    }
    var mg = (E.margenes||{}).articulos;
    if(mg && mg.map) margenArt = mg.map;

    var chunks = E.listaItems || {};
    LISTAS = Object.keys(E.listas||{}).map(function(k){ return E.listas[k]; })
      .sort(function(a,b){ return (a.ts||0) - (b.ts||0); })
      .map(function(m){
        var its = [];
        for(var i=0;i<(m.chunks||1);i++){ var ch = chunks[m.id+"-"+i]; if(ch && ch.items) its = its.concat(ch.items); }
        return { id:m.id, nombre:m.nombre, prov:m.prov, moneda:m.moneda, fecha:m.fecha, chunks:m.chunks||1,
                 activa:m.activa !== false, items:its };
      });

    var lp = (E.listaPrecios||{}).actual;
    if(lp && !lista.items.length){
      lista = { titulo:lp.titulo||"Lista de precios", periodo:lp.periodo||"", para:lp.para||"", conIva:!!lp.conIva,
        notas:lp.notas==null?NOTAS_LISTA:lp.notas, items:Array.isArray(lp.items)?lp.items:[] };
    }

    renderHistorial(Object.keys(E.cotizaciones||{}).map(function(k){ return E.cotizaciones[k]; }));
    if(!doc.numero && !doc.items.length) doc.numero = String(proximoNumero());

    construirItems(); pintarParams(); renderListas(); docAForm(); renderItems(); listaAForm(); renderLista();
    guardarBorrador();
    enLinea();
  }).catch(function(e){
    marcarEstado("Sin conexión con el panel", false);
    toast("No se pudieron cargar los datos (" + ((e&&e.code)||"error") + "). Recargá la página.");
  });
}
function guardarCotizacion(silencioso){
  formADoc();
  if(!doc.numero){ toast("Poné un número de cotización antes de guardar."); return; }
  if(silencioso !== true) registrarEvento("guardada", "Cotización guardada");
  guardarBorrador();
  var t = totales(), id = String(doc.numero).replace(/[^A-Za-z0-9_.\-]/g,"_") || "sn";
  var h = {
    numero:doc.numero, empresa:doc.empresa, direccion:doc.direccion, cotizo:doc.cotizo,
    fecha:doc.fecha, entrega:doc.entrega, talles:doc.talles, obs:doc.obs, items:doc.items,
    estado:doc.estado||"borrador", eventos:doc.eventos||[],
    neto:t.neto, iva:t.iva, total:t.total, costo:t.costo, ganancia:t.ganancia,
    tc:cfg.tc, ivaPct:cfg.iva, ts:Date.now()
  };
  api("PUT", docPath("cotizaciones", id), h).then(function(){
    enLinea();
    HIST = [h].concat(HIST.filter(function(x){ return String(x.numero) !== String(h.numero); }));
    renderHistorial(HIST);
    if(silencioso !== true) toast("Cotización "+doc.numero+" guardada.");
  }, sinGuardar);
}
function renderHistorial(list){
  HIST = (list||[]).slice().sort(function(a,b){ return (b.ts||0) - (a.ts||0); });
  var cuenta = { "":HIST.length };
  ESTADOS.forEach(function(e){ cuenta[e[0]] = 0; });
  HIST.forEach(function(h){ var e = h.estado || "borrador"; cuenta[e] = (cuenta[e]||0) + 1; });
  $("navCountCot").textContent = HIST.length ? String(HIST.length) : "";

  var mes = hoy().slice(0,7), delMes = HIST.filter(function(h){ return String(h.fecha||"").slice(0,7) === mes; });
  var totMes = delMes.reduce(function(a,h){ return a + (h.total||0); }, 0);
  $("cotSub").textContent = HIST.length
    ? delMes.length + (delMes.length===1?" cotización":" cotizaciones") + " este mes por $ " + fmt(totMes) + " · " + cuenta.aceptada + (cuenta.aceptada===1?" aceptada":" aceptadas") + " en total"
    : "Todavía no guardaste ninguna cotización.";

  $("estadoTabs").innerHTML = [["","Todas"]].concat(ESTADOS).map(function(e){
    return '<button class="tab" role="tab" data-estado="'+e[0]+'" aria-selected="'+(filtroEstado===e[0])+'">'+e[1]+'<span class="n">'+(cuenta[e[0]]||0)+'</span></button>';
  }).join("");

  var terms = normal(filtroCot).split(/\s+/).filter(Boolean);
  var vis = HIST.filter(function(h){
    if(filtroEstado && (h.estado||"borrador") !== filtroEstado) return false;
    var hay = normal((h.numero||"")+" "+(h.empresa||"")+" "+(h.direccion||""));
    return terms.every(function(t){ return hay.indexOf(t) > -1; });
  });

  var el = $("histList");
  if(!vis.length){
    el.innerHTML = '<div class="blank" style="grid-column:1 / -1"><svg class="ic" style="width:28px;height:28px"><use href="#i-quotes"/></svg>'+
      '<p>'+(HIST.length ? "Ninguna cotización coincide con ese filtro." : "Cuando guardes una cotización va a aparecer acá, con su estado y su total.")+'</p>'+
      (HIST.length ? "" : '<button class="btn btn-dark" data-nueva>Crear la primera</button>')+'</div>';
    var b = el.querySelector("[data-nueva]"); if(b) b.addEventListener("click", nuevaCotizacion);
    return;
  }
  el.innerHTML = vis.map(function(h){
    var e = h.estado || "borrador";
    var mg = (h.costo > 0 && h.neto > 0) ? ((h.ganancia||0) / h.neto * 100).toFixed(1) + " %" : "—";
    return '<button class="qcard" data-num="'+esc(h.numero)+'">'+
      '<div class="qtop"><span>'+(h.ts ? horaAR(h.ts) : esc(fechaAR(h.fecha)))+'</span><span class="chip st-'+e+'">'+nombreEstado(e)+'</span></div>'+
      '<div class="qid"><strong>N° '+esc(h.numero)+'</strong></div>'+
      '<div class="qclient">'+esc(h.empresa||"Sin cliente")+'</div>'+
      '<div class="qrows">'+
        '<div class="qrow"><span>Renglones</span><b>'+((h.items||[]).length)+'</b></div>'+
        '<div class="qrow"><span>Entrega</span><b>'+esc(fechaAR(h.entrega)||"—")+'</b></div>'+
        '<div class="qrow"><span>Margen</span><b>'+mg+'</b></div>'+
      '</div>'+
      '<div class="qtotal"><span><svg class="ic"><use href="#i-quotes"/></svg>Total con IVA</span><b>$ '+fmt(h.total||0)+'</b></div>'+
    '</button>';
  }).join("");
  el.querySelectorAll("[data-num]").forEach(function(b){
    b.addEventListener("click", function(){
      var n = b.getAttribute("data-num");
      cargar(HIST.filter(function(h){ return String(h.numero) === n; })[0]);
    });
  });
}
function cargar(h){
  if(!h) return;
  doc = { numero:h.numero||"", empresa:h.empresa||"", direccion:h.direccion||"", cotizo:h.cotizo||"",
    fecha:h.fecha||hoy(), entrega:h.entrega||manana(), talles:h.talles||"", obs:h.obs||"",
    estado:h.estado||"borrador", eventos:Array.isArray(h.eventos)?h.eventos.slice():[],
    items:(h.items||[]).map(function(r){ return { cant:r.cant, desc:r.desc, costo:r.costo||0, mon:r.mon||"ARS",
      margen:r.margen==null?null:r.margen, precio:r.precio, desc_pct:r.desc_pct, meta:r.meta||"" }; }) };
  docAForm(); renderItems(); guardarBorrador();
  setView("cot");
}
function nuevaCotizacion(){
  var n = proximoNumero(); doc = docVacio(n); docAForm(); renderItems(); guardarBorrador();
  setView("cot"); $("fEmpresa").focus(); toast("Nueva cotización N° " + n);
}
function duplicarCotizacion(){
  formADoc();
  var origen = doc.numero, n = proximoNumero();
  var copia = JSON.parse(JSON.stringify(doc));
  copia.numero = String(n); copia.estado = "borrador"; copia.fecha = hoy(); copia.entrega = manana();
  copia.eventos = [{ ts:Date.now(), t:"duplicada", d:"Copia de la N° " + origen }];
  doc = copia; docAForm(); renderItems(); guardarBorrador();
  toast("Duplicada como N° " + n + ". Guardala para conservarla.");
}
function proximoNumero(){
  var max=0;
  HIST.forEach(function(h){ var n=parseInt(h.numero,10); if(isFinite(n)&&n>max) max=n; });
  var a=parseInt(doc&&doc.numero,10); if(isFinite(a)&&a>max) max=a;
  return max+1;
}

/* ================= arranque ================= */
function pintarParams(){
  $("pTc").value=cfg.tc; $("pMargen").value=cfg.margen; $("pIva").value=cfg.iva; $("pRedondeo").value=String(cfg.redondeo);
  $("paramsLine").textContent = "Dólar $ " + cfg.tc + " · margen " + cfg.margen + " % · IVA " + cfg.iva + " %";
  renderCatalogo(); pintarTotales(); renderMargenes();
}
function start(){
  if(window.LOGO && window.LOGO.jpg){
    var src = "data:image/jpeg;base64," + window.LOGO.jpg;
    $("logoImg").src = src;
    document.querySelectorAll(".band-logo").forEach(function(im){ im.src = src; });
  }

  var saved = leerBorrador();
  if(saved){
    if(saved.cfg){ for(var k in saved.cfg){ if(k==="rubroMargen" && saved.cfg[k]) cfg.rubroMargen = saved.cfg[k]; else if(typeof saved.cfg[k]==="number") cfg[k]=saved.cfg[k]; } }
    if(saved.margenArt) margenArt = saved.margenArt;
  }
  doc = (saved && saved.doc) ? saved.doc : docVacio("");
  if(!doc.items) doc.items = [];
  lista = (saved && saved.lista) ? saved.lista : listaVacia();
  if(!lista.items) lista.items = [];

  var sel=$("rubro"), selI=$("iRubro");
  RUBROS_ORD.forEach(function(r){
    var o=document.createElement("option"); o.value=r; o.textContent=r; sel.appendChild(o);
    var o2=document.createElement("option"); o2.value=r; o2.textContent=r; selI.appendChild(o2);
  });
  selI.value = "Otros";

  construirItems();
  pintarParams();
  docAForm(); renderItems(); renderCatalogo(); renderListas(); renderMargenes();
  listaAForm(); renderLista();
  var vistaGuardada = "cotizaciones";
  try{ vistaGuardada = localStorage.getItem(LS+".vista") || "cotizaciones"; }catch(e){}
  setView(vistaGuardada);
  document.addEventListener("click", function(e){
    var nav = e.target.closest("[data-view]");
    if(nav){ e.preventDefault(); setView(nav.getAttribute("data-view")); return; }
    var tg = e.target.closest("[data-cat-toggle]");
    if(tg){ $("catalogo").parentNode.classList.toggle("open"); return; }
    var tab = e.target.closest("#estadoTabs [data-estado]");
    if(tab){ filtroEstado = tab.getAttribute("data-estado"); renderHistorial(HIST); }
  });
  var tqc = null;
  $("qCot").addEventListener("input", function(){ clearTimeout(tqc); tqc = setTimeout(function(){ filtroCot = $("qCot").value; renderHistorial(HIST); }, 120); });
  $("fEstado").addEventListener("change", function(){
    doc.estado = $("fEstado").value; pintarEstado();
    registrarEvento("estado", "Estado: " + nombreEstado(doc.estado));
    if(yaGuardada()) guardarCotizacion(true); else guardarBorrador();
  });
  $("fNum").addEventListener("input", function(){ doc.numero = $("fNum").value; pintarEstado(); });
  $("btnDuplicar").addEventListener("click", duplicarCotizacion);
  $("btnNueva2").addEventListener("click", nuevaCotizacion);

  Object.keys(CAMPOS).forEach(function(id){ $(id).addEventListener("input", guardarBorrador); });
  Object.keys(CAMPOS_LISTA).forEach(function(id){ $(id).addEventListener("input", guardarBorrador); });
  $("lIva").addEventListener("change", function(){ formALista(); renderLista(); guardarBorrador(); });
  $("btnPropios").addEventListener("click", cargarPropios);
  $("btnTraerCot").addEventListener("click", traerDeCotizacion);
  $("btnLRenglon").addEventListener("click", function(){
    lista.items.push({ prod:"", desc:"", talles:"", color:"", costo:0, mon:"ARS", precio:0, meta:"" });
    renderLista();
    var ins=$("ltbody").querySelectorAll('input[data-k="prod"]');
    if(ins.length) ins[ins.length-1].focus();
  });
  $("btnLVaciar").addEventListener("click", function(){
    if(!lista.items.length) return;
    if(!confirm("¿Vaciar la lista de precios? Se quitan los " + lista.items.length + " productos.")) return;
    lista.items = []; renderLista(); guardarBorrador();
  });
  $("btnLPdf").addEventListener("click", descargarListaPDF);
  $("btnLGuardar").addEventListener("click", guardarLista);

  function onCfg(){
    cfg.tc=num($("pTc").value); cfg.margen=num($("pMargen").value);
    cfg.iva=num($("pIva").value); cfg.redondeo=num($("pRedondeo").value);
    renderCatalogo(); pintarTotales(); renderMargenes(); renderLista(); guardarCfg();
  }
  ["pTc","pMargen","pIva","pRedondeo"].forEach(function(id){ $(id).addEventListener("input", onCfg); });

  var tq=null;
  $("q").addEventListener("input", function(){ clearTimeout(tq); tq=setTimeout(function(){ filtroQ=$("q").value; renderCatalogo(); },110); });
  $("rubro").addEventListener("change", function(){ filtroRubro=$("rubro").value; renderCatalogo(); });
  $("orden").addEventListener("change", function(){ orden=$("orden").value; renderCatalogo(); });

  $("btnRenglon").addEventListener("click", function(){
    doc.items.push({ cant:1, desc:"", costo:0, mon:"ARS", margen:null, precio:0, desc_pct:0, meta:"" });
    renderItems();
    var ins=$("tbody").querySelectorAll('input[data-k="desc"]');
    if(ins.length) ins[ins.length-1].focus();
  });
  $("btnNueva").addEventListener("click", nuevaCotizacion);
  $("btnGuardar").addEventListener("click", function(){ guardarCotizacion(); });
  $("btnPdf").addEventListener("click", descargarPDF);

  // importador
  $("btnNuevaLista").addEventListener("click", function(){
    setView("proveedores");
    var v = $("impForm").hidden;
    $("impForm").hidden = !v;
    if(v) $("iNombre").focus();
  });
  $("btnCancelarImp").addEventListener("click", function(){
    $("impForm").hidden = true; $("iPaste").value=""; $("mapBox").hidden = true; impRows=[]; impHead=[];
  });
  var tp=null;
  $("iPaste").addEventListener("input", function(){ clearTimeout(tp); tp=setTimeout(function(){ analizarPegado($("iPaste").value); },250); });
  $("iModo").addEventListener("change", function(){ analizarPegado($("iPaste").value); });
  $("iMon").addEventListener("change", function(){ if(impRows.length) vistaPrevia(); });
  $("iRubro").addEventListener("change", function(){ if(impRows.length) vistaPrevia(); });
  $("iFile").addEventListener("change", function(){
    var file=this.files && this.files[0]; if(!file) return;
    if(/\.json$/i.test(file.name)){ importarJson(file); this.value=""; return; }
    if(/\.pdf$/i.test(file.name) || file.type === "application/pdf"){ importarPdf(file); this.value=""; return; }
    var fr=new FileReader();
    fr.onload=function(){ $("iPaste").value=String(fr.result).slice(0,900000); analizarPegado($("iPaste").value);
      if(!$("iNombre").value) $("iNombre").value = file.name.replace(/\.[^.]+$/,""); };
    fr.onerror=function(){ toast("No se pudo leer el archivo."); };
    fr.readAsText(file, "utf-8");
  });
  $("btnImportar").addEventListener("click", function(){
    var r = filasImportadas();
    if(!r.rows.length){ toast("No hay filas válidas para importar."); return; }
    var prov = ($("iProv").value || $("iNombre").value || "PROPIA").trim().toUpperCase().slice(0,18);
    var nombre = ($("iNombre").value || prov + " — importada").trim();
    var mon = $("iMon").value, rub = $("iRubro").value || "Otros";
    var items = r.rows.map(function(x){ return { d:x.d, c:x.c, b:x.b, m:x.m || mon, v:x.v, r:x.r || rub }; });
    var monedas = {}; items.forEach(function(x){ monedas[x.m] = 1; });
    var L = { id:"l"+Date.now().toString(36), nombre:nombre, prov:prov,
      moneda:Object.keys(monedas).length > 1 ? "mixta" : (Object.keys(monedas)[0] || mon),
      fecha:hoy(), activa:true, items:items };
    LISTAS.push(L);
    construirItems(); renderCatalogo(); renderListas(); renderMargenes();
    guardarListaNueva(L).catch(function(){});
    $("impForm").hidden=true; $("iPaste").value=""; $("iNombre").value=""; $("iProv").value="";
    $("mapBox").hidden=true; impRows=[]; impHead=[];
    toast("Importados "+L.items.length+" artículos como «"+nombre+"».");
  });
  $("btnLimpiarMarg").addEventListener("click", function(){
    margenArt = {}; guardarMargenes(); renderCatalogo(); renderMargenes();
    toast("Se borraron los márgenes por artículo.");
  });

  cargarEstado();
}
function arrancar(){ if(!token()) return irAlLogin(); start(); }
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
else arrancar();
})();
