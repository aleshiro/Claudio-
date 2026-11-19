#!/usr/bin/env node
/*
 * tools/generar-paginas.js — una página por perfume, para Google y para compartir.
 *
 * Lee los datos de index.html (CONFIG, PRODUCTOS, PACKS y RESENAS) y escribe:
 *   decant/<marca>-<id>/index.html   una página por perfume
 *   404.html                          la página que se ve si una dirección no existe
 *   sitemap.xml                       la portada y todas las páginas de perfume
 *   index.html                        solo la lista "Decants por perfume" del pie de página
 *   api/pagar.js                      solo la tabla de precios y las reglas de cobro
 *
 * Ejecútalo cada vez que cambies perfumes, precios, packs o reseñas en index.html:
 *     node tools/generar-paginas.js
 * Si además cambiaste clases de diseño, regenera antes el CSS:  cd tools && npm run todo
 *
 * Solo necesita Node.js; no hay que instalar nada. Lo que este archivo escribe no se edita
 * a mano: cualquier cambio en esos archivos se pierde la próxima vez que se ejecute.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

const RAIZ = path.join(__dirname, "..");
const ARCHIVO_INDEX = path.join(RAIZ, "index.html");
const ARCHIVO_PAGAR = path.join(RAIZ, "api", "pagar.js");
const ARCHIVO_SITEMAP = path.join(RAIZ, "sitemap.xml");
const ARCHIVO_404 = path.join(RAIZ, "404.html");
const CARPETA_FICHAS = path.join(RAIZ, "decant");
const SELLO = "<!-- Generado por tools/generar-paginas.js a partir de index.html: no editar a mano -->";
const HOY = new Date().toISOString().slice(0, 10);
const ANIO = new Date().getFullYear();

let index = fs.readFileSync(ARCHIVO_INDEX, "utf8");

/* ───────────────────────── 1. Datos de la tienda ───────────────────────── */
// Son el primer bloque del <script> de index.html: desde "const CONFIG" hasta el funcionamiento de la página.
const iniDatos = index.indexOf("const CONFIG = {");
const finDatos = index.indexOf('(function () {\n  "use strict";', iniDatos);
if (iniDatos === -1 || finDatos === -1) throw new Error("No encontré los datos de la tienda (const CONFIG = { ... }) en index.html");
const { CONFIG, PRODUCTOS, PACKS, RESENAS } = vm.runInNewContext(
  index.slice(iniDatos, finDatos) + "\n;({ CONFIG, PRODUCTOS, PACKS, RESENAS })", {}, { filename: "index.html" });

const canonica = /<link rel="canonical" href="([^"]+)">/.exec(index);
if (!canonica) throw new Error('Falta <link rel="canonical"> en index.html: de ahí sale la dirección del sitio');
const SITIO = canonica[1].replace(/\/+$/, "");   // por ejemplo https://www.decantsprime.cl

/* ───────────────────────── 2. Utilidades ───────────────────────── */
const DIACRITICOS = new RegExp("[" + String.fromCharCode(0x300) + "-" + String.fromCharCode(0x36f) + "]", "g");
const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clp = (n) => "$" + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const aSlug = (t) => String(t || "").normalize("NFD").replace(DIACRITICOS, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const normalizar = (t) => String(t || "").normalize("NFD").replace(DIACRITICOS, "").toLowerCase();
const plural = (n, uno, varios) => n + " " + (n === 1 ? uno : varios);
const listaY = (a) => (a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " y " + a[a.length - 1]);
const decimal = (n) => n.toFixed(1).replace(".", ",");
const unicos = (a) => a.filter((v, i) => a.indexOf(v) === i);
// JSON seguro dentro de <script>: "<" se escribe como < para que nunca cierre la etiqueta
const LT = String.fromCharCode(92) + "u003c";
const json = (o) => JSON.stringify(o).replace(/</g, LT);
const tinte = (hex) => {
  const h = String(hex || "").replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(h)) return "150 118 58";
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(" ");
};
const titulo = (p) => (p.marca + " " + p.nombre).replace(/\s+/g, " ").trim();

// Dirección de cada perfume: /decant/<marca>-<id>/ (la portada usa la misma regla en urlDe)
function slugDe(p) {
  const marca = aSlug(p.marca), id = aSlug(p.id);
  return marca && id !== marca && id.indexOf(marca + "-") !== 0 ? marca + "-" + id : id;
}
const rutaDe = (p) => "/decant/" + slugDe(p) + "/";

// Precios (la misma lógica que la portada)
const OFERTA = Math.min(90, Math.max(0, Number(CONFIG.ofertaPorcentaje) || 0));
const ATOM = Math.max(0, Number(CONFIG.atomizacionesPorMl) || 0);
const PCT = Math.max(0, Number(CONFIG.descuentoCorreo) || 0);
const tablaPrecios = (p) => p.precios || p.oferta || {};
const tamanosDe = (p) => Object.keys(tablaPrecios(p)).map(Number).sort((a, b) => a - b);
const precioDe = (p, ml) => tablaPrecios(p)[ml] || 0;
const normalDe = (p, ml) => {
  const precio = precioDe(p, ml);
  if (p.normal && p.normal[ml]) return p.normal[ml];
  if (!OFERTA || !precio) return precio;
  const calculado = Math.round(precio / (1 - OFERTA / 100) / 500) * 500 - 10;
  return calculado > precio ? calculado : precio;
};
const ahorroDe = (p, ml) => { const n = normalDe(p, ml), o = precioDe(p, ml); return n > o ? Math.round((1 - o / n) * 100) : 0; };
const desdeDe = (p) => Math.min.apply(null, tamanosDe(p).map((ml) => precioDe(p, ml)));
const inicialDe = (p) => { const t = tamanosDe(p); return t.indexOf(5) !== -1 ? 5 : t[Math.floor((t.length - 1) / 2)]; };

const VISIBLES = PRODUCTOS.filter((p) => !p.soloPrueba && tamanosDe(p).length);
const porId = Object.fromEntries(PRODUCTOS.map((p) => [p.id, p]));
const ORDEN = ["Nicho", "Diseñador", "Árabe"];
const lugar = (p) => { const i = ORDEN.indexOf(p.categoria); return i === -1 ? ORDEN.length : i; };
const LISTA = VISIBLES.map((p, i) => [p, i]).sort((a, b) => lugar(a[0]) - lugar(b[0]) || a[1] - b[1]).map((x) => x[0]);
const ML_MAX = Math.max(10, ...VISIBLES.flatMap(tamanosDe));
const nivel = (ml) => +(ml / ML_MAX * 0.92).toFixed(3);

// Packs
const packValido = (k) => k && Array.isArray(k.incluye) && k.incluye.every((it) => porId[it.id] && precioDe(porId[it.id], it.ml));
const PACKS_OK = (PACKS || []).filter(packValido);
const sumaPack = (k) => k.incluye.reduce((s, it) => s + precioDe(porId[it.id], it.ml), 0);
const precioPack = (k) => (k.precio ? k.precio : Math.round(sumaPack(k) * (1 - (k.descuento || 0) / 100) / 10) * 10);

// Entregas, beneficios y WhatsApp
const ENTREGAS = (CONFIG.entregas || []).map((e) => (typeof e === "string" ? { nombre: e, costo: 0 } : { nombre: String(e.nombre), costo: Math.max(0, Number(e.costo) || 0) }));
const BENEFICIOS = CONFIG.beneficios || {};
const META_ENVIO = Math.max(0, Number(BENEFICIOS.envioGratisDesde) || 0);
const META_VIAL = Math.max(0, Number(BENEFICIOS.vialGratisDesde) || 0);
const BLUE = ENTREGAS.find((e) => /blue express/i.test(e.nombre)) || null;
const PRESENCIALES = ENTREGAS.filter((e) => e !== BLUE);
const numeroWa = String(CONFIG.whatsapp || "").replace(/\D/g, "");
const waListo = numeroWa.length >= 10 && !/x/i.test(String(CONFIG.whatsapp));
const enlaceWa = (texto) => "https://wa.me/" + (waListo ? numeroWa : "") + "?text=" + encodeURIComponent(texto);
const conMercadoPago = Boolean(CONFIG.mercadopago && CONFIG.mercadopago.activo);

// Reseñas (solo las publicadas en RESENAS)
const RESENAS_OK = (Array.isArray(RESENAS) ? RESENAS : []).filter((r) => r && r.texto && Number(r.estrellas) >= 1 && Number(r.estrellas) <= 5);
const fotosDe = (r) => (Array.isArray(r.fotos) ? r.fotos : r.foto ? [r.foto] : []).filter((f) => typeof f === "string" && f.trim()).slice(0, 8);
const resenasDe = (id) => RESENAS_OK.filter((r) => r.perfume === id).map((r, i) => [r, i])
  .sort((a, b) => String(b[0].fecha || "").localeCompare(String(a[0].fecha || "")) || a[1] - b[1]).map((x) => x[0]);
const promedio = (l) => l.reduce((s, r) => s + Number(r.estrellas), 0) / l.length;
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const fechaLegible = (f) => { const m = /^(\d{4})-(\d{1,2})/.exec(String(f || "")); return m && MESES[Number(m[2]) - 1] ? MESES[Number(m[2]) - 1] + " de " + m[1] : ""; };
const estrellas = (valor, extra) => '<span class="estrellas' + (extra ? " " + extra : "") + '" role="img" aria-label="' + decimal(valor) + ' de 5 estrellas" style="--lleno:' + (valor / 5 * 100).toFixed(1) + '%"></span>';

// Imágenes: rutas absolutas, porque las páginas viven en /decant/<perfume>/
const rutaImagen = (src) => (/^(https?:|data:)/i.test(src) ? src : "/" + String(src).replace(/^\/+/, ""));
const urlAbsoluta = (src) => (/^https?:/i.test(src) ? src : SITIO + rutaImagen(src));
const fotoRecortada = (src) => /\.(png|webp|svg)([?#]|$)/i.test(src || "");
function medidas(src) {   // ancho y alto reales de la foto PNG, para que la página no salte al cargar
  if (!src || /^(https?:|data:)/i.test(src)) return "";
  try {
    const fd = fs.openSync(path.join(RAIZ, String(src).replace(/^\/+/, "")), "r");
    const b = Buffer.alloc(24);
    fs.readSync(fd, b, 0, 24, 0);
    fs.closeSync(fd);
    if (b.toString("ascii", 1, 4) === "PNG") return ' width="' + b.readUInt32BE(16) + '" height="' + b.readUInt32BE(20) + '"';
  } catch (e) { /* sin medidas: la foto igual se ve */ }
  return "";
}
const SIN_FOTO = "data:image/svg+xml," + encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'><rect width='400' height='400' fill='#ece7de'/>" +
  "<g fill='none' stroke='#c7bfb1' stroke-width='3' stroke-linejoin='round'><rect x='181' y='96' width='38' height='34' rx='4'/>" +
  "<path d='M190 130v16M210 130v16'/><rect x='156' y='146' width='88' height='132' rx='13'/></g></svg>");
const imagenCompartir = (p) => {
  const propia = "assets/compartir/" + slugDe(p) + ".jpg";
  return fs.existsSync(path.join(RAIZ, propia)) ? SITIO + "/" + propia : SITIO + "/assets/compartir-decantsprime.jpg";
};

/* ───────────────────────── 3. Piezas que se copian de index.html ───────────────────────── */
const cabezaIndex = index.slice(0, index.indexOf("</head>"));
const ESTILOS = (cabezaIndex.match(/<style>[\s\S]*?<\/style>/g) || []).join("\n");
if (ESTILOS.indexOf("TAILWIND:INICIO") === -1) throw new Error("No encontré los estilos (TAILWIND:INICIO) en index.html");
const FUENTES = (/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/.exec(cabezaIndex) || [""])[0];
const iniIconos = index.indexOf('<svg width="0" height="0"');
if (iniIconos === -1) throw new Error("No encontré los íconos (<svg width=\"0\" height=\"0\">) en index.html");
const ICONOS = index.slice(iniIconos, index.indexOf("</svg>", iniIconos) + "</svg>".length);

/* ───────────────────────── 4. Textos de cada perfume ───────────────────────── */
const CATEGORIA_TEXTO = { "Nicho": "nicho", "Diseñador": "de diseñador", "Árabe": "árabe" };
const CATEGORIA_PLURAL = { "Nicho": "Decants nicho", "Diseñador": "Decants de diseñador", "Árabe": "Decants árabes" };
const OCASION_USO = { "Calor / Verano": "los días de calor", "Fiesta / Noche": "salir de noche", "Citas": "una cita", "Todo Terreno": "el día a día" };
const OCASION_DATO = { "Calor / Verano": "Calor y verano", "Fiesta / Noche": "Fiesta y noche", "Citas": "Citas", "Todo Terreno": "Todo terreno", "Modo Bestia": "Larga duración" };
const perfilDe = (p) => String(p.acordes || "").split("·").map((s) => s.trim().toLowerCase()).filter(Boolean);
const listaMl = (p) => listaY(tamanosDe(p).map(String));

function descripcionLarga(p) {
  const partes = [];
  const perfil = perfilDe(p);
  partes.push(titulo(p) + " es un perfume " + (CATEGORIA_TEXTO[p.categoria] || "") + (perfil.length ? " de perfil " + listaY(perfil) : "") + ".");
  const ins = String(p.inspiracion || "").trim();
  if (/^inspirado en:/i.test(ins)) partes.push("Está inspirado en " + ins.replace(/^inspirado en:\s*/i, "") + ".");
  else if (/^adn:/i.test(ins)) partes.push("Su ADN recuerda a " + ins.replace(/^adn:\s*/i, "") + ".");
  const usos = (p.ocasion || []).map((o) => OCASION_USO[o]).filter(Boolean);
  const bestia = (p.ocasion || []).indexOf("Modo Bestia") !== -1;
  if (usos.length) partes.push("Funciona muy bien para " + listaY(usos) + (bestia ? ", y destaca por su duración" : "") + ".");
  else if (bestia) partes.push("Destaca por su duración.");
  partes.push("Cada decant se extrae con jeringa de la botella original y se sella con teflón para que llegue sin derrames.");
  const ref = inicialDe(p);
  if (ATOM) partes.push("Con el de " + ref + " ml tienes cerca de " + Math.round(ref * ATOM) + " atomizaciones para usarlo varios días en tu piel antes de comprar la botella completa.");
  return partes.join(" ");
}

function descripcionCorta(p) {   // para Google y para la vista previa al compartir (unos 150 caracteres)
  const perfil = perfilDe(p);
  const frase = perfil.length ? " " + perfil[0].charAt(0).toUpperCase() + perfil[0].slice(1) + (perfil.length > 1 ? ", " + listaY(perfil.slice(1)) : "") + "." : "";
  return "Decant original de " + titulo(p) + " desde " + clp(desdeDe(p)) + "." + frase + " En " + listaMl(p) + " ml, con envíos a todo Chile.";
}

/* ───────────────────────── 5. Partes comunes de las páginas ───────────────────────── */
const ESTILOS_FICHA = `<style>
/* Página de cada perfume */
@media (min-width: 1024px) { .volver-movil { display: none; } }
.migas a { color: inherit; text-decoration: none; }
@media (hover: hover) { .migas a:hover { color: rgb(var(--tinta)); text-decoration: underline; text-underline-offset: .2em; } }
.ficha-foto .decant .vial { --h: 58px; }
@media (min-width: 640px) { .ficha-foto .decant .vial { --h: 76px; } }
.ficha-foto .decant-ml { font-size: .6875rem; }
.ficha-foto .foto-recortada { padding: 12% 20% 8%; }
.ficha-seg button { min-height: 2.75rem; font-size: .875rem; }
.relacionado { transition: transform .2s; }
@media (hover: hover) { .relacionado:hover { transform: translateY(-2px); } }
.relacionado .foto-recortada { padding: 12% 18% 8%; }
.enlace-wa { color: rgb(var(--humo)); }
@media (hover: hover) { .enlace-wa:hover { color: rgb(var(--tinta)); } }
@media (prefers-reduced-motion: reduce) { .relacionado { transition: none; } }
</style>`;

function cabeza(o) {
  return `<!DOCTYPE html>
<html lang="es-CL">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${SELLO}
<title>${esc(o.titulo)}</title>
<meta name="description" content="${esc(o.descripcion)}">
${o.canonica ? `<link rel="canonical" href="${esc(o.canonica)}">\n` : ""}<meta name="robots" content="${o.robots || "index, follow, max-image-preview:large"}">
<meta name="theme-color" content="#1b2a4a">
<meta property="og:type" content="${o.ogTipo || "website"}">
<meta property="og:locale" content="es_CL">
<meta property="og:site_name" content="${esc(CONFIG.nombre)}">
<meta property="og:title" content="${esc(o.ogTitulo || o.titulo)}">
<meta property="og:description" content="${esc(o.descripcion)}">
${o.canonica ? `<meta property="og:url" content="${esc(o.canonica)}">\n` : ""}<meta property="og:image" content="${esc(o.imagen)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(o.imagenAlt || o.titulo)}">
${o.extraMeta || ""}<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(o.ogTitulo || o.titulo)}">
<meta name="twitter:description" content="${esc(o.descripcion)}">
<meta name="twitter:image" content="${esc(o.imagen)}">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/assets/favicon-96.png" sizes="96x96" type="image/png">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${FUENTES}
${ESTILOS}
${ESTILOS_FICHA}
${o.jsonld ? `<script type="application/ld+json">${o.jsonld}</script>\n` : ""}</head>`;
}

const CABECERA = `<p class="superior">
  <span class="wrap flex items-center justify-center gap-2 py-1.5 text-center leading-snug">
    <svg class="flex-none" width="16" height="16" aria-hidden="true"><use href="#i-camion"/></svg>
    <span>Envíos a todo Chile vía Blue Express | Entregas en Rancagua y Stgo</span>
  </span>
</p>
<header class="pegado z-40 border-b border-linea bg-fondo/95 backdrop-blur-md">
  <div class="wrap fila-cabecera h-14 md:h-[4.5rem] xl:gap-8">
    <a href="/#catalogo" class="icon-btn volver-movil -ml-2.5" aria-label="Volver al catálogo"><svg width="24" height="24" aria-hidden="true"><use href="#i-izq"/></svg></a>
    <a href="/" class="logo justify-self-center" aria-label="${esc(CONFIG.nombre)}, ir al inicio">decants<em>prime</em></a>
    <nav class="hidden gap-6 lg:ml-2 lg:flex xl:gap-8" aria-label="Principal">
      <a class="navlink" href="/#match">Test olfativo</a>
      <a class="navlink" href="/#catalogo">Catálogo</a>
      <a class="navlink" href="/#packs">Packs</a>
      <a class="navlink" href="/#resenas">Reseñas</a>
      <a class="navlink" href="/#envios">Envíos</a>
      <a class="navlink" href="/#contacto">Contacto</a>
    </nav>
    <div class="flex items-center justify-end md:ml-auto">
      <a href="/#carrito" class="icon-btn relative -mr-2.5" data-carrito-enlace aria-label="Ver carrito"><svg width="24" height="24" aria-hidden="true"><use href="#i-bolsa"/></svg><span class="badge" data-contador hidden>0</span></a>
    </div>
  </div>
</header>`;

function redes() {
  const r = [];
  if (CONFIG.instagram) r.push(`<a class="icon-btn -ml-2.5" href="https://www.instagram.com/${esc(encodeURIComponent(CONFIG.instagram))}/" target="_blank" rel="noopener" aria-label="Instagram"><svg width="22" height="22" aria-hidden="true"><use href="#i-instagram"/></svg></a>`);
  if (CONFIG.tiktok) r.push(`<a class="icon-btn" href="https://www.tiktok.com/@${esc(encodeURIComponent(CONFIG.tiktok))}" target="_blank" rel="noopener" aria-label="TikTok"><svg width="22" height="22" aria-hidden="true"><use href="#i-tiktok"/></svg></a>`);
  r.push(`<a class="icon-btn${r.length ? "" : " -ml-2.5"}" href="${esc(enlaceWa("Hola " + CONFIG.nombre + ", tengo una consulta."))}" target="_blank" rel="noopener" aria-label="WhatsApp"><svg width="20" height="20" aria-hidden="true"><use href="#i-whatsapp"/></svg></a>`);
  return r.join("\n        ");
}

const PIE = `<footer class="border-t border-linea">
  <div class="wrap flex flex-col gap-9 py-12 md:flex-row md:justify-between">
    <div class="max-w-sm">
      <a href="/" class="logo">decants<em>prime</em></a>
      <p class="mt-3 text-sm text-humo">Decants de perfumes nicho, árabes y de diseñador. Rancagua, Santiago y todo Chile.</p>
      <p class="mt-5 flex gap-1">
        ${redes()}
      </p>
    </div>
    <nav class="grid grid-cols-2 gap-x-12 gap-y-3 text-sm" aria-label="Pie de página">
      <a class="text-humo" href="/#catalogo">Catálogo</a>
      <a class="text-humo" href="/#packs">Packs</a>
      <a class="text-humo" href="/#match">Test olfativo</a>
      <a class="text-humo" href="/#resenas">Reseñas</a>
      <a class="text-humo" href="/#envios">Envíos</a>
      <a class="text-humo" href="/#ayuda">Preguntas</a>
      <a class="text-humo" href="/#politicas">Políticas</a>
      <a class="text-humo" href="/#contacto">Contacto</a>
    </nav>
  </div>
  <div class="border-t border-linea">
    <p class="wrap py-6 text-xs leading-relaxed text-humo">© ${ANIO} ${esc(CONFIG.nombre)}. No estamos afiliados a las marcas mencionadas. Los nombres y marcas pertenecen a sus respectivos dueños y se usan solo para identificar el perfume original del que se extrae cada decant.</p>
  </div>
</footer>`;

const BARRA = `<a id="barra" class="barra" href="/#carrito" hidden>
  <span class="flex items-center gap-2.5"><svg width="20" height="20" aria-hidden="true"><use href="#i-bolsa"/></svg><span>Ver pedido · <span data-barra-cant>0 productos</span></span></span>
  <svg width="20" height="20" aria-hidden="true"><use href="#i-flecha"/></svg>
</a>`;

const VISOR = `<div id="visor" class="visor" role="dialog" aria-modal="true" aria-label="Foto de cliente" hidden>
  <button id="visor-cerrar" type="button" class="visor-boton" style="top:max(.75rem, env(safe-area-inset-top, 0px));right:max(.75rem, env(safe-area-inset-right, 0px))" aria-label="Cerrar foto"><svg width="22" height="22" aria-hidden="true"><use href="#i-cerrar"/></svg></button>
  <img id="visor-img" src="/assets/favicon.svg" alt="">
  <p id="visor-pie" class="visor-pie"></p>
  <button id="visor-ant" type="button" class="visor-boton" style="left:max(.5rem, env(safe-area-inset-left, 0px));top:50%;transform:translateY(-50%)" aria-label="Foto anterior"><svg width="22" height="22" aria-hidden="true"><use href="#i-izq"/></svg></button>
  <button id="visor-sig" type="button" class="visor-boton" style="right:max(.5rem, env(safe-area-inset-right, 0px));top:50%;transform:translateY(-50%)" aria-label="Foto siguiente"><svg width="22" height="22" aria-hidden="true"><use href="#i-der"/></svg></button>
</div>`;

// Qué perfumes y tamaños existen: para contar bien lo que hay en el carrito
const VALIDOS = {
  productos: Object.fromEntries(PRODUCTOS.filter((p) => !p.agotado && tamanosDe(p).length).map((p) => [p.id, tamanosDe(p)])),
  packs: PACKS_OK.map((k) => k.id),
};

// Funcionamiento de las páginas: tamaño y precio, carrito compartido con la portada y fotos de clientes
const SCRIPT = String.raw`(function () {
  "use strict";
  var F = window.FICHA || null;
  var V = window.VALIDOS || { productos: {}, packs: [] };
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function clp(n) { return "$" + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "."); }
  function plural(n, uno, varios) { return n + " " + (n === 1 ? uno : varios); }
  function leer(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function guardar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

  /* ---- Carrito: el mismo de la portada (el navegador lo guarda como "dp_carrito") ---- */
  function valido(i) {
    if (!i || typeof i.id !== "string") return false;
    if (i.tipo === "producto") return (V.productos[i.id] || []).indexOf(Number(i.ml)) !== -1;
    if (i.tipo === "pack") return V.packs.indexOf(i.id) !== -1;
    return false;
  }
  function carrito() { var c = leer("dp_carrito", []); return Array.isArray(c) ? c : []; }
  function unidades() {
    return carrito().filter(valido).reduce(function (s, i) { return s + Math.max(1, Math.min(99, parseInt(i.cant, 10) || 1)); }, 0);
  }
  function pintarCarrito() {
    var n = unidades();
    $$("[data-contador]").forEach(function (e) { e.textContent = n; e.hidden = n === 0; });
    $$("[data-carrito-enlace]").forEach(function (a) { a.setAttribute("aria-label", "Ver carrito, " + plural(n, "producto", "productos")); });
    var barra = $("#barra");
    if (barra) {
      barra.hidden = n === 0;
      document.body.classList.toggle("con-barra", n > 0);
      var t = $("[data-barra-cant]");
      if (t) t.textContent = plural(n, "producto", "productos");
    }
  }
  pintarCarrito();
  window.addEventListener("storage", function (e) { if (e.key === "dp_carrito") pintarCarrito(); });
  window.addEventListener("pageshow", pintarCarrito);   // al volver con el botón "atrás"

  /* ---- Tamaño, precio y agregar al carrito ---- */
  if (F) {
    var elegido = F.inicial;
    var pintarTamano = function (ml) {
      if (!F.precios[ml]) return;
      elegido = ml;
      $$("[data-ml]").forEach(function (b) { b.setAttribute("aria-pressed", String(Number(b.getAttribute("data-ml")) === ml)); });
      var precio = F.precios[ml], normal = F.normales[ml] || precio;
      var pct = normal > precio ? Math.round((1 - precio / normal) * 100) : 0;
      $("[data-precio]").textContent = clp(precio);
      $("[data-normal]").textContent = clp(normal);
      $("[data-normal-caja]").hidden = !pct;
      var ahorro = $("[data-ahorro]");
      if (ahorro) { ahorro.textContent = "-" + pct + "%"; ahorro.hidden = !pct; }
      var atom = $("[data-atom]");
      if (atom) atom.textContent = F.atom ? "≈ " + Math.round(ml * F.atom) + " atomizaciones" : "";
      var etiqueta = $("[data-decant-ml]");
      if (etiqueta) etiqueta.textContent = ml + " ml";
      var vial = $(".ficha-foto .vial");
      if (vial) vial.style.setProperty("--level", (ml / F.mlMax * 0.92).toFixed(3));
    };
    $$("[data-ml]").forEach(function (b) {
      b.addEventListener("click", function () { pintarTamano(Number(b.getAttribute("data-ml"))); });
    });
    // ?ml=10 en la dirección abre la página con ese tamaño elegido (así enlaza Google cada tamaño)
    var pedido = Number((/[?&]ml=(\d+)/.exec(location.search) || [])[1]);
    if (pedido && F.precios[pedido]) pintarTamano(pedido);

    var agregar = function () {
      var c = carrito(), igual = null;
      for (var k = 0; k < c.length; k++) {
        var i = c[k];
        if (i && i.tipo === "producto" && i.id === F.id && Number(i.ml) === elegido) { igual = i; break; }
      }
      if (igual) igual.cant = Math.min(99, (parseInt(igual.cant, 10) || 1) + 1);
      else c.push({ tipo: "producto", id: F.id, ml: elegido, cant: 1 });
      guardar("dp_carrito", c);
      pintarCarrito();
    };
    var boton = $("[data-agregar]"), aviso = $("[data-agregado]");
    if (boton) boton.addEventListener("click", function () {
      agregar();
      if (aviso) {
        $("[data-agregado-texto]").textContent = F.nombre + " " + elegido + " ml quedó en tu carrito.";
        aviso.hidden = false;
      }
      if (!boton.getAttribute("data-texto")) {
        boton.setAttribute("data-texto", boton.innerHTML);
        boton.textContent = "Agregado ✓";
        setTimeout(function () { boton.innerHTML = boton.getAttribute("data-texto"); boton.removeAttribute("data-texto"); }, 1300);
      }
    });
    var comprar = $("[data-comprar]");
    if (comprar) comprar.addEventListener("click", function () { agregar(); location.href = "/#carrito"; });
  }

  /* ---- Fotos de clientes a pantalla completa ---- */
  var visor = $("#visor"), fotos = $$("[data-foto-cliente]");
  if (visor && fotos.length) {
    var actual = 0, desde = null, x0 = null;
    var mostrar = function () {
      var b = fotos[actual];
      $("#visor-img").src = b.getAttribute("data-src");
      $("#visor-img").alt = b.getAttribute("data-pie");
      $("#visor-pie").textContent = b.getAttribute("data-pie") + (fotos.length > 1 ? " · " + (actual + 1) + " de " + fotos.length : "");
    };
    var abrir = function (i, origen) {
      actual = i; desde = origen;
      $("#visor-ant").hidden = fotos.length < 2;
      $("#visor-sig").hidden = fotos.length < 2;
      mostrar();
      visor.hidden = false;
      document.documentElement.classList.add("bloqueado");
      $("#visor-cerrar").focus();
    };
    var cerrar = function () {
      if (visor.hidden) return;
      visor.hidden = true;
      document.documentElement.classList.remove("bloqueado");
      if (desde) desde.focus();
    };
    var mover = function (paso) {
      if (fotos.length < 2) return;
      actual = (actual + paso + fotos.length) % fotos.length;
      mostrar();
    };
    fotos.forEach(function (b, i) { b.addEventListener("click", function () { abrir(i, b); }); });
    $$("[data-foto-indice]").forEach(function (b) {
      b.addEventListener("click", function () { abrir(Number(b.getAttribute("data-foto-indice")), b); });
    });
    $("#visor-cerrar").addEventListener("click", cerrar);
    $("#visor-ant").addEventListener("click", function () { mover(-1); });
    $("#visor-sig").addEventListener("click", function () { mover(1); });
    visor.addEventListener("click", function (e) { if (e.target === visor) cerrar(); });
    document.addEventListener("keydown", function (e) {
      if (visor.hidden) return;
      if (e.key === "Escape") cerrar();
      else if (e.key === "ArrowLeft") mover(-1);
      else if (e.key === "ArrowRight") mover(1);
    });
    visor.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    visor.addEventListener("touchend", function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 45) mover(dx < 0 ? 1 : -1);
    });
  }
})();`;

function cuerpo(principal, datosPagina) {
  return `<body>
<a class="skip" href="#contenido">Saltar al contenido</a>
${ICONOS}
${CABECERA}
${principal}
${PIE}
${BARRA}
${VISOR}
<script>window.VALIDOS = ${json(VALIDOS)};${datosPagina ? ` window.FICHA = ${json(datosPagina)};` : ""}</script>
<script>
${SCRIPT}
</script>
</body>
</html>
`;
}

/* ───────────────────────── 6. Página de un perfume ───────────────────────── */
const CLASE_TAG = { "Nicho": "tag-nicho", "Árabe": "tag-arabe", "Diseñador": "tag-disenador" };

function frasco(color, lleno) {
  return '<span class="vial" style="--tint:' + tinte(color) + ";--level:" + lleno + '">' +
    '<span class="vial-cap"></span><span class="vial-collar"></span>' +
    '<span class="vial-body"><span class="vial-glass"><span class="vial-liquid"></span></span></span></span>';
}

function tarjetaMini(q) {
  const img = `<img class="foto ${fotoRecortada(q.imagen) ? "foto-recortada" : "foto-llena"}" src="${esc(q.imagen ? rutaImagen(q.imagen) : SIN_FOTO)}" alt="" loading="lazy" decoding="async"${medidas(q.imagen)}>`;
  return `<li>
          <a class="claro relacionado flex h-full flex-col bg-papel" href="${rutaDe(q)}">
            <span class="escenario relative block aspect-square overflow-hidden">${img}</span>
            <span class="flex flex-1 flex-col p-3 sm:p-4">
              <span class="text-[10px] font-medium uppercase leading-snug tracking-[.2em] text-humo">${esc(q.marca)}</span>
              <span class="mt-1 font-display text-[1.1875rem] leading-[1.15] sm:text-[1.375rem]">${esc(q.nombre)}</span>
              ${q.acordes ? `<span class="mt-1.5 text-xs leading-snug text-humo">${esc(q.acordes)}</span>` : ""}
              <span class="mt-auto pt-3 text-sm tabular-nums">Desde <span class="font-medium">${clp(desdeDe(q))}</span></span>
            </span>
          </a>
        </li>`;
}

function relacionados(p) {
  const acordes = perfilDe(p).map(normalizar);
  return VISIBLES.filter((q) => q.id !== p.id && !q.agotado).map((q, i) => {
    let puntos = q.categoria === p.categoria ? 2 : 0;
    perfilDe(q).map(normalizar).forEach((a) => { if (acordes.indexOf(a) !== -1) puntos += 1.5; });
    (q.estilo || []).forEach((e) => { if ((p.estilo || []).indexOf(e) !== -1) puntos += 0.5; });
    (q.ocasion || []).forEach((o) => { if ((p.ocasion || []).indexOf(o) !== -1) puntos += 0.5; });
    return { q, puntos, i };
  }).sort((a, b) => b.puntos - a.puntos || a.i - b.i).slice(0, 4).map((x) => x.q);
}

function datoInspiracion(p) {
  const ins = String(p.inspiracion || "").trim();
  if (/^inspirado en:/i.test(ins)) return ["Inspirado en", ins.replace(/^inspirado en:\s*/i, "")];
  if (/^adn:/i.test(ins)) return ["ADN", ins.replace(/^adn:\s*/i, "")];
  return null;
}

function seccionResenas(p, lista) {
  const nombre = esc(p.nombre);
  const escribir = `<a class="btn btn-negro mt-6 w-full sm:w-auto" href="/#resena-${esc(p.id)}">Escribir una reseña</a>`;
  if (!lista.length) {
    return `<div class="claro mt-6 bg-papel p-5 sm:p-8">
        <p class="text-[.9375rem]">Todavía no hay reseñas de ${nombre}. Si ya lo probaste, cuéntanos cómo te fue: tu opinión ayuda a otras personas a elegir.</p>
        ${escribir}
      </div>`;
  }
  const prom = promedio(lista);
  const barras = [5, 4, 3, 2, 1].map((n) => {
    const c = lista.filter((r) => Number(r.estrellas) === n).length;
    return `<span>${n} <span aria-hidden="true">★</span><span class="sr-only">${plural(n, "estrella", "estrellas")}</span></span><span class="dist-barra"><i style="width:${(c / lista.length * 100).toFixed(1)}%"></i></span><span class="text-right">${c}</span>`;
  }).join("");
  // Todas las fotos de clientes en una fila; las de cada reseña abren esa misma lista
  const todas = [];
  const indices = lista.map((r) => fotosDe(r).map((src) => { todas.push({ src, nombre: r.nombre }); return todas.length - 1; }));
  const filaFotos = todas.length ? `<div class="mt-6 border-t border-linea pt-5">
          <h3 class="text-sm font-medium">Fotos de clientes <span class="font-normal text-humo">(${todas.length})</span></h3>
          <div class="miniaturas mt-3">${todas.map((f, i) => `<button type="button" class="miniatura" data-foto-cliente data-src="${esc(rutaImagen(f.src))}" data-pie="${esc("Foto de " + (f.nombre || "cliente"))}" aria-label="Ver foto ${i + 1} de ${todas.length}"><img src="${esc(rutaImagen(f.src))}" alt="" loading="lazy" decoding="async"></button>`).join("")}</div>
        </div>` : "";
  const items = lista.map((r, k) => `<li class="border-b border-linea py-5 last:border-b-0">
            <div class="flex items-center justify-between gap-3">${estrellas(Number(r.estrellas))}<span class="text-xs text-humo">${esc(fechaLegible(r.fecha))}</span></div>
            <p class="mt-2.5 text-[.9375rem] leading-relaxed">${esc(r.texto)}</p>
            ${indices[k].length ? `<div class="miniaturas mt-3">${indices[k].map((i) => `<button type="button" class="miniatura" data-foto-indice="${i}" aria-label="Ver foto de ${esc(r.nombre || "cliente")}"><img src="${esc(rutaImagen(todas[i].src))}" alt="" loading="lazy" decoding="async"></button>`).join("")}</div>` : ""}
            <p class="mt-3 text-sm font-medium">${esc(r.nombre || "Cliente")}</p>
          </li>`).join("\n          ");
  return `<div class="claro mt-6 bg-papel p-5 sm:p-8">
        <div class="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-10">
          <div>
            <p class="font-display text-5xl leading-none tabular-nums">${decimal(prom)}</p>
            <p class="mt-2.5">${estrellas(prom, "estrellas-grande")}</p>
            <p class="mt-1.5 text-sm text-humo">${plural(lista.length, "reseña", "reseñas")}</p>
          </div>
          <div class="dist" aria-label="Reseñas por puntuación">${barras}</div>
        </div>
        ${filaFotos}
        <h3 class="mt-6 border-t border-linea pt-5 text-sm font-medium">Opiniones</h3>
        <ul class="mt-1">
          ${items}
        </ul>
        ${escribir}
      </div>`;
}

// Datos para Google: un grupo de productos (el perfume) con una variante por tamaño, cada una con su precio,
// su costo de envío y la política de devoluciones de POLITICAS. Cada tamaño tiene su dirección (?ml=5),
// que abre la página con ese tamaño elegido.
const DEVOLUCIONES = { "@type": "MerchantReturnPolicy", applicableCountry: "CL", returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted" };
const PRECIO_VIGENTE_HASTA = (ANIO + 1) + "-12-31";
function envioDe(precio) {
  if (!BLUE) return null;
  const gratis = !BLUE.costo || (META_ENVIO && precio >= META_ENVIO);
  return {
    "@type": "OfferShippingDetails",
    shippingRate: { "@type": "MonetaryAmount", value: gratis ? 0 : BLUE.costo, currency: "CLP" },
    shippingDestination: { "@type": "DefinedRegion", addressCountry: "CL" },
  };
}

function jsonLdFicha(p, lista) {
  const url = SITIO + rutaDe(p);
  const imagenes = p.imagen ? [urlAbsoluta(p.imagen)] : [];
  const producto = {
    "@type": "ProductGroup",
    "@id": url + "#producto",
    name: "Decant " + titulo(p),
    description: descripcionLarga(p),
    url,
    productGroupID: p.id,
    category: "Perfumes > " + (CATEGORIA_PLURAL[p.categoria] || p.categoria),
    variesBy: ["https://schema.org/size"],
    hasVariant: tamanosDe(p).map((ml) => {
      const precio = precioDe(p, ml);
      const oferta = {
        "@type": "Offer",
        url: url + "?ml=" + ml,
        price: precio,
        priceCurrency: "CLP",
        priceValidUntil: PRECIO_VIGENTE_HASTA,
        availability: "https://schema.org/" + (p.agotado ? "OutOfStock" : "InStock"),
        itemCondition: "https://schema.org/NewCondition",
        seller: { "@type": "Organization", name: CONFIG.nombre, url: SITIO + "/" },
        hasMerchantReturnPolicy: DEVOLUCIONES,
      };
      const envio = envioDe(precio);
      if (envio) oferta.shippingDetails = envio;
      const variante = {
        "@type": "Product",
        sku: p.id + "-" + ml + "ml",
        name: "Decant " + titulo(p) + " " + ml + " ml",
        size: ml + " ml",
        inProductGroupWithID: p.id,
        offers: oferta,
      };
      if (imagenes.length) variante.image = imagenes;
      if (p.marca) variante.brand = { "@type": "Brand", name: p.marca };
      return variante;
    }),
  };
  if (p.marca) producto.brand = { "@type": "Brand", name: p.marca };
  if (imagenes.length) producto.image = imagenes;
  if (lista.length) {
    producto.aggregateRating = { "@type": "AggregateRating", ratingValue: +promedio(lista).toFixed(1), reviewCount: lista.length, bestRating: 5, worstRating: 1 };
    producto.review = lista.map((r) => {
      const resena = {
        "@type": "Review",
        author: { "@type": "Person", name: r.nombre || "Cliente" },
        reviewRating: { "@type": "Rating", ratingValue: Number(r.estrellas), bestRating: 5, worstRating: 1 },
        reviewBody: r.texto,
      };
      // Google pide la fecha completa: solo se incluye si la reseña trae día (2026-11-05)
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(r.fecha || ""))) resena.datePublished = String(r.fecha);
      return resena;
    });
  }
  const migas = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: SITIO + "/" },
      { "@type": "ListItem", position: 2, name: "Decant " + titulo(p), item: url },
    ],
  };
  return json({ "@context": "https://schema.org", "@graph": [producto, migas] });
}

function paginaFicha(p) {
  const nombreCompleto = titulo(p);
  const tamanos = tamanosDe(p);
  const ml = inicialDe(p);
  const pct = ahorroDe(p, ml);
  const lista = resenasDe(p.id);
  const url = SITIO + rutaDe(p);
  const imagen = p.imagen ? rutaImagen(p.imagen) : SIN_FOTO;
  const recortada = !p.imagen || fotoRecortada(p.imagen);

  // Datos del perfume
  const datos = [["Marca", esc(p.marca)], ["Tipo", esc(p.categoria)]];
  if (p.acordes) datos.push(["Perfil", esc(p.acordes)]);
  // En las listas, solo la primera palabra va con mayúscula: "Calor y verano, todo terreno y larga duración"
  const frase = (lista) => listaY(lista.map((t, i) => (i ? t.charAt(0).toLowerCase() + t.slice(1) : t)));
  if ((p.estilo || []).length) datos.push(["Estilo", esc(frase(p.estilo))]);
  const ideal = (p.ocasion || []).map((o) => OCASION_DATO[o] || o);
  if (ideal.length) datos.push(["Ideal para", esc(frase(ideal))]);
  datos.push(["Formatos", esc(listaMl(p)) + " ml"]);
  const ins = datoInspiracion(p);
  if (ins) datos.push([ins[0], esc(ins[1])]);
  if (ATOM) datos.push(["Rendimiento", "≈ " + ATOM + " atomizaciones por ml"]);

  // Entregas y pago
  const beneficios = [];
  if (BLUE) beneficios.push(["i-camion", BLUE.costo ? "Envío por Blue Express " + clp(BLUE.costo) + (META_ENVIO ? ", gratis sobre " + clp(META_ENVIO) : "") : "Envío gratis por Blue Express"]);
  if (PRESENCIALES.length) {
    const ciudades = unicos(PRESENCIALES.map((e) => (/ en ([^(]+)/.exec(e.nombre) || [])[1]).filter(Boolean).map((c) => c.trim()));
    const gratis = PRESENCIALES.every((e) => !e.costo);
    beneficios.push(["i-pin", "Entrega presencial" + (gratis ? " gratis" : "") + (ciudades.length ? " en " + listaY(ciudades) : "")]);
  }
  beneficios.push(["i-pago", conMercadoPago ? "Paga con Mercado Pago o transferencia" : "Paga por transferencia"]);
  if (META_VIAL) beneficios.push(["i-caja", "Vial sorpresa de 2 ml de regalo en compras sobre " + clp(META_VIAL)]);
  if (PCT) beneficios.push(["i-bolsa", PCT + "% de descuento dejando tu correo en el carrito"]);

  // Packs que incluyen este perfume
  const enPacks = PACKS_OK.filter((k) => k.incluye.some((it) => it.id === p.id));
  const textoPacks = enPacks.length ? `<p class="mt-5 text-sm">También viene en ${listaY(enPacks.map((k) => {
    const antes = sumaPack(k), ahora = precioPack(k), ahorro = antes > ahora ? Math.round((1 - ahora / antes) * 100) : 0;
    return `el <a class="font-medium underline underline-offset-4" href="/#packs">${esc(k.nombre)}</a> (${clp(ahora)}${ahorro ? ", ahorras " + ahorro + "%" : ""})`;
  }))}.</p>` : "";

  const consulta = enlaceWa("Hola " + CONFIG.nombre + ", tengo una consulta sobre el decant de " + nombreCompleto + ".");
  const estrellasCabecera = lista.length ? `<a href="#opiniones" class="ver-resenas mt-3">${estrellas(promedio(lista))}<span class="ver-texto tabular-nums">${decimal(promedio(lista))} (${plural(lista.length, "reseña", "reseñas")})</span></a>` : "";
  const botones = p.agotado
    ? `<button type="button" class="btn btn-line w-full" disabled>Agotado</button>
          <p class="text-sm text-humo">Está agotado por ahora. <a class="underline underline-offset-4" href="${esc(consulta)}" target="_blank" rel="noopener">Escríbenos</a> y te avisamos cuando vuelva.</p>`
    : `<button type="button" class="btn btn-negro sm:flex-1" data-agregar>Agregar al carrito</button>
          <button type="button" class="btn btn-line sm:flex-1" data-comprar>Comprar ahora</button>`;

  const principal = `<main id="contenido">
  <nav class="wrap pt-5" aria-label="Ruta de navegación">
    <ol class="migas flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-humo">
      <li><a href="/">Inicio</a></li>
      <li aria-hidden="true">/</li>
      <li><a href="/#catalogo">Catálogo</a></li>
      <li aria-hidden="true">/</li>
      <li class="text-tinta" aria-current="page">${esc(p.nombre)}</li>
    </ol>
  </nav>

  <section class="wrap pb-12 pt-4 md:pb-16" aria-labelledby="titulo-ficha">
    <div class="claro grid overflow-hidden bg-papel md:grid-cols-2">
      <div class="escenario ficha-foto relative aspect-square md:aspect-auto md:min-h-[32rem]">
        <img class="foto ${recortada ? "foto-recortada" : "foto-llena"}" src="${esc(imagen)}" alt="${esc("Perfume " + nombreCompleto)}" fetchpriority="high" decoding="async"${medidas(p.imagen)}>
        <span class="tag ${CLASE_TAG[p.categoria] || "tag-disenador"} absolute left-3 top-3 z-10 sm:left-4 sm:top-4">${esc(p.categoria)}</span>
        <span class="tag tag-oferta absolute right-3 top-3 z-10 sm:right-4 sm:top-4" data-ahorro${pct ? "" : " hidden"}>-${pct}%</span>
        ${p.etiqueta ? `<span class="tag tag-top absolute bottom-3 left-3 z-10 sm:bottom-4 sm:left-4">${esc(p.etiqueta)}</span>` : ""}
        <span class="decant absolute bottom-3 right-3 z-10 sm:bottom-4 sm:right-4" aria-hidden="true">${frasco(p.color, nivel(ml))}<span class="decant-ml" data-decant-ml>${ml} ml</span></span>
      </div>

      <div class="flex min-w-0 flex-col p-5 sm:p-8">
        <h1 id="titulo-ficha" class="font-display text-[2rem] leading-[1.1] sm:text-[2.5rem]"><span class="mb-2 block font-sans text-[11px] font-medium uppercase leading-snug tracking-[.2em] text-humo">Decant · ${esc(p.marca)}</span>${esc(p.nombre)}</h1>
        ${estrellasCabecera}
        ${p.acordes ? `<p class="mt-3 text-sm text-humo">${esc(p.acordes)}</p>` : ""}
        ${p.inspiracion ? `<p class="mt-1.5 text-[13px] italic text-humo">${esc(p.inspiracion)}</p>` : ""}

        <p class="eyebrow mt-6">Elige el tamaño</p>
        <div class="seg ficha-seg mt-2.5" style="grid-template-columns:repeat(${tamanos.length},minmax(0,1fr))" role="group" aria-label="Tamaño del decant">
          ${tamanos.map((t) => `<button type="button" data-ml="${t}" aria-pressed="${t === ml}">${t} ml</button>`).join("\n          ")}
        </div>
        <p class="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <s class="text-sm text-humo tabular-nums" data-normal-caja${pct ? "" : " hidden"}><span class="sr-only">Precio normal </span><span data-normal>${clp(normalDe(p, ml))}</span></s>
          <span class="text-[1.75rem] font-medium leading-none tabular-nums"><span class="sr-only">Precio </span><span data-precio>${clp(precioDe(p, ml))}</span></span>
        </p>
        ${ATOM ? `<p class="mt-2 text-sm text-humo tabular-nums" data-atom>≈ ${Math.round(ml * ATOM)} atomizaciones</p>` : ""}

        <div class="mt-6 flex flex-col gap-2.5 sm:flex-row">
          ${botones}
        </div>
        <p class="mt-3 text-sm" role="status" data-agregado hidden><span data-agregado-texto></span> <a class="font-medium underline underline-offset-4" href="/#carrito">Ver pedido</a></p>
        <a class="enlace-wa mt-4 inline-flex items-center gap-2 self-start text-sm" href="${esc(consulta)}" target="_blank" rel="noopener"><svg width="16" height="16" aria-hidden="true"><use href="#i-whatsapp"/></svg>Consultar por WhatsApp</a>

        <ul class="mt-6 grid gap-3 border-t border-linea pt-5 text-sm">
          ${beneficios.map(([icono, texto]) => `<li class="flex items-start gap-3"><svg class="mt-0.5 flex-none" width="18" height="18" aria-hidden="true"><use href="#${icono}"/></svg><span>${esc(texto)}</span></li>`).join("\n          ")}
        </ul>
        ${textoPacks}
      </div>
    </div>
  </section>

  <section class="wrap pb-12 md:pb-16" aria-labelledby="titulo-sobre">
    <div class="grid gap-8 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:gap-14">
      <div>
        <h2 id="titulo-sobre" class="font-display text-[1.75rem] leading-tight md:text-4xl">Sobre este decant</h2>
        <p class="mt-4 max-w-prose text-[1.0625rem] leading-relaxed text-humo">${esc(descripcionLarga(p))}</p>
      </div>
      <dl class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-3 self-start border-t border-linea pt-5 text-sm">
        ${datos.map(([k, v]) => `<dt class="text-humo">${k}</dt><dd>${v}</dd>`).join("\n        ")}
      </dl>
    </div>
  </section>

  <section class="border-y border-linea" aria-label="Así recibes tu decant">
    <ul class="wrap grid grid-cols-2 gap-x-4 gap-y-5 py-7 md:grid-cols-4">
      <li class="flex items-start gap-2.5"><svg class="flex-none" width="20" height="20" aria-hidden="true"><use href="#i-escudo"/></svg><p class="leading-snug"><span class="block text-[13px] font-medium">De la botella original</span><span class="text-xs text-humo">Extraído con jeringa</span></p></li>
      <li class="flex items-start gap-2.5"><svg class="flex-none" width="20" height="20" aria-hidden="true"><use href="#i-caja"/></svg><p class="leading-snug"><span class="block text-[13px] font-medium">Sellado con teflón</span><span class="text-xs text-humo">Llega sin derrames</span></p></li>
      <li class="flex items-start gap-2.5"><svg class="flex-none" width="20" height="20" aria-hidden="true"><use href="#i-bolsa"/></svg><p class="leading-snug"><span class="block text-[13px] font-medium">Atomizador de vidrio</span><span class="text-xs text-humo">Formato de bolsillo</span></p></li>
      <li class="flex items-start gap-2.5"><svg class="flex-none" width="20" height="20" aria-hidden="true"><use href="#i-pin"/></svg><p class="leading-snug"><span class="block text-[13px] font-medium">Rancagua, Santiago y todo Chile</span><span class="text-xs text-humo">En persona o por Blue Express</span></p></li>
    </ul>
  </section>

  <section id="opiniones" class="wrap py-12 md:py-16" aria-labelledby="titulo-opiniones">
    <h2 id="titulo-opiniones" class="font-display text-[1.75rem] leading-tight md:text-4xl">Reseñas de ${esc(p.nombre)}</h2>
    ${seccionResenas(p, lista)}
  </section>

  <section class="border-t border-linea" aria-labelledby="titulo-relacionados">
    <div class="wrap py-12 md:py-16">
      <h2 id="titulo-relacionados" class="font-display text-[1.75rem] leading-tight md:text-4xl">También te puede gustar</h2>
      <ul class="mt-6 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-4">
        ${relacionados(p).map(tarjetaMini).join("\n        ")}
      </ul>
      <a class="btn btn-line mt-8" href="/#catalogo">Ver todo el catálogo</a>
    </div>
  </section>
</main>`;

  const tituloLargo = "Decant " + nombreCompleto + " en " + listaMl(p) + " ml | " + CONFIG.nombre;
  return cabeza({
    // Google muestra unos 60 caracteres: si el nombre es largo, el título va sin los tamaños
    titulo: tituloLargo.length <= 62 ? tituloLargo : "Decant " + nombreCompleto + " | " + CONFIG.nombre,
    ogTitulo: "Decant " + nombreCompleto + " | " + CONFIG.nombre,
    descripcion: descripcionCorta(p),
    canonica: url,
    ogTipo: "product",
    imagen: imagenCompartir(p),
    imagenAlt: "Decant de " + nombreCompleto,
    extraMeta: `<meta property="product:price:amount" content="${desdeDe(p)}">\n<meta property="product:price:currency" content="CLP">\n`,
    jsonld: jsonLdFicha(p, lista),
  }) + "\n" + cuerpo(principal, {
    id: p.id,
    nombre: nombreCompleto,
    precios: Object.fromEntries(tamanos.map((t) => [t, precioDe(p, t)])),
    normales: Object.fromEntries(tamanos.map((t) => [t, normalDe(p, t)])),
    inicial: ml,
    mlMax: ML_MAX,
    atom: ATOM,
  });
}

/* ───────────────────────── 7. Página 404 ───────────────────────── */
function pagina404() {
  const destacados = LISTA.filter((p) => p.etiqueta && !p.agotado);
  const muestra = (destacados.length >= 4 ? destacados : destacados.concat(LISTA.filter((p) => !p.etiqueta && !p.agotado))).slice(0, 4);
  const principal = `<main id="contenido">
  <section class="wrap py-16 md:py-24" aria-labelledby="titulo-404">
    <p class="eyebrow">Error 404</p>
    <h1 id="titulo-404" class="mt-4 font-display text-[2.25rem] leading-[1.1] md:text-6xl">No encontramos esta página</h1>
    <p class="mt-4 max-w-md text-humo">Puede que el perfume ya no esté en el catálogo o que la dirección tenga un error.</p>
    <div class="mt-8 flex flex-wrap gap-3">
      <a class="btn btn-negro" href="/#catalogo">Ver catálogo</a>
      <a class="btn btn-line" href="/">Ir al inicio</a>
    </div>
  </section>
  <section class="border-t border-linea" aria-labelledby="titulo-destacados">
    <div class="wrap py-12 md:py-16">
      <h2 id="titulo-destacados" class="font-display text-[1.75rem] leading-tight md:text-4xl">Los más pedidos</h2>
      <ul class="mt-6 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-4">
        ${muestra.map(tarjetaMini).join("\n        ")}
      </ul>
    </div>
  </section>
</main>`;
  return cabeza({
    titulo: "Página no encontrada | " + CONFIG.nombre,
    descripcion: "Esta dirección no existe. Revisa el catálogo de decants de " + CONFIG.nombre + ".",
    robots: "noindex",
    imagen: SITIO + "/assets/compartir-decantsprime.jpg",
  }) + "\n" + cuerpo(principal, null);
}

/* ───────────────────────── 8. Lista de perfumes del pie de index.html ───────────────────────── */
function listaPie() {
  const grupos = unicos(ORDEN.concat(LISTA.map((p) => p.categoria)))
    .map((cat) => [cat, LISTA.filter((p) => p.categoria === cat)]).filter((g) => g[1].length);
  return `<!-- PERFUMES:INICIO (lo escribe tools/generar-paginas.js: no editar a mano) -->
  <nav class="border-t border-linea" aria-label="Decants por perfume">
    <div class="wrap py-10">
      <h2 class="eyebrow">Decants por perfume</h2>
      <div class="mt-6 grid gap-x-8 gap-y-8 sm:grid-cols-2 md:grid-cols-3">
${grupos.map(([cat, ps]) => `        <div>
          <h3 class="text-sm font-medium">${esc(CATEGORIA_PLURAL[cat] || cat)}</h3>
          <ul class="mt-3 flex flex-col gap-2 text-[13px] leading-snug text-humo">
${ps.map((p) => `            <li><a class="enlace-ficha" href="${rutaDe(p)}">${esc(titulo(p))}</a></li>`).join("\n")}
          </ul>
        </div>`).join("\n")}
      </div>
    </div>
  </nav>
  <!-- PERFUMES:FIN -->`;
}

/* ───────────────────────── 9. Tabla de precios de api/pagar.js ───────────────────────── */
function bloqueApi() {
  const productos = PRODUCTOS.filter((p) => !p.agotado && tamanosDe(p).length);
  const comentario = (texto, ancho) => texto.padEnd(ancho) + " // ";
  return [
    "// CATALOGO:INICIO — lo escribe tools/generar-paginas.js con los datos de index.html. No lo edites aquí:",
    "// cambia los precios en index.html y vuelve a ejecutar  node tools/generar-paginas.js",
    "",
    "// ── Reglas de cobro (vienen de CONFIG en index.html) ──",
    comentario("const DESCUENTO_CORREO = " + PCT + ";", 36) + "% de descuento si el cliente dejó su correo",
    comentario("const ENVIO_BLUE_EXPRESS = " + (BLUE ? BLUE.costo : 0) + ";", 36) + "costo del envío por Blue Express",
    comentario("const ENVIO_GRATIS_DESDE = " + (META_ENVIO || "Infinity") + ";", 36) + "subtotal desde el que el envío es gratis",
    comentario("const VIAL_GRATIS_DESDE = " + (META_VIAL || "Infinity") + ";", 36) + "subtotal desde el que se regala un vial de 2 ml",
    "const MAX_UNIDADES = 99;",
    "",
    "// ── Precios por tamaño (ml: pesos). Los mismos del catálogo. ──",
    "const PRODUCTOS = {",
    ...productos.map((p) => "  " + JSON.stringify(p.id) + ": { nombre: " + JSON.stringify(titulo(p)) + ", precios: { " + tamanosDe(p).map((t) => t + ": " + precioDe(p, t)).join(", ") + " } },"),
    "};",
    "",
    "const PACKS = {",
    ...PACKS_OK.map((k) => "  " + JSON.stringify(k.id) + ": { nombre: " + JSON.stringify(k.nombre) + ", precio: " + precioPack(k) + ", contenido: " + JSON.stringify(k.incluye.map((it) => porId[it.id].nombre + " " + it.ml + " ml").join(" + ")) + " },"),
    "};",
    "// CATALOGO:FIN",
  ].join("\n");
}

/* ───────────────────────── 10. Escritura ───────────────────────── */
function escribirSiCambia(archivo, contenido) {
  let antes = null;
  try { antes = fs.readFileSync(archivo, "utf8"); } catch (e) { /* no existía */ }
  if (antes === contenido) return false;
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  fs.writeFileSync(archivo, contenido);
  return true;
}
function reemplazarEntre(texto, inicio, fin, nuevo, donde) {
  const a = texto.indexOf(inicio), b = texto.indexOf(fin, a);
  if (a === -1 || b === -1) throw new Error("No encontré las marcas " + inicio + " / " + fin + " en " + donde);
  return texto.slice(0, a) + nuevo + texto.slice(b + fin.length);
}

function generar() {
  // Fechas de la última modificación que ya estaban en el sitemap
  let sitemapAnterior = "";
  try { sitemapAnterior = fs.readFileSync(ARCHIVO_SITEMAP, "utf8"); } catch (e) { /* primera vez */ }
  const fechasAnteriores = {};
  sitemapAnterior.replace(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g, (m, loc, fecha) => { fechasAnteriores[loc] = fecha; return m; });
  const huellaAnterior = (/<!-- huella-portada: ([0-9a-f]+) -->/.exec(sitemapAnterior) || [])[1];

  // 1) Lista de perfumes en el pie de index.html (antes que todo lo demás: la portada cambia con ella)
  index = reemplazarEntre(index, "<!-- PERFUMES:INICIO", "<!-- PERFUMES:FIN -->", listaPie(), "index.html");
  escribirSiCambia(ARCHIVO_INDEX, index);

  // 2) Una página por perfume
  const urls = [];
  const vigentes = new Set();
  const resumen = { nuevas: 0, actualizadas: 0, iguales: 0, borradas: 0 };
  for (const p of LISTA) {
    const slug = slugDe(p);
    if (!slug) throw new Error("El perfume " + JSON.stringify(p.id) + " no tiene un id válido");
    if (vigentes.has(slug)) throw new Error("Dos perfumes quedaron con la misma dirección: /decant/" + slug + "/ (cambia el id de uno)");
    vigentes.add(slug);
    const archivo = path.join(CARPETA_FICHAS, slug, "index.html");
    const existia = fs.existsSync(archivo);
    const cambio = escribirSiCambia(archivo, paginaFicha(p));
    resumen[!existia ? "nuevas" : cambio ? "actualizadas" : "iguales"] += 1;
    const loc = SITIO + rutaDe(p);
    urls.push({ loc, lastmod: cambio ? HOY : fechasAnteriores[loc] || HOY, prioridad: "0.8", imagen: p.imagen ? urlAbsoluta(p.imagen) : "" });
  }

  // 3) Páginas de perfumes que ya no están en el catálogo (solo las que creó este archivo)
  if (fs.existsSync(CARPETA_FICHAS)) {
    for (const nombre of fs.readdirSync(CARPETA_FICHAS)) {
      if (vigentes.has(nombre)) continue;
      const archivo = path.join(CARPETA_FICHAS, nombre, "index.html");
      let texto = "";
      try { texto = fs.readFileSync(archivo, "utf8"); } catch (e) { continue; }
      if (texto.indexOf(SELLO) === -1) continue;
      fs.unlinkSync(archivo);
      try { fs.rmdirSync(path.join(CARPETA_FICHAS, nombre)); } catch (e) { /* tenía otros archivos: se deja */ }
      resumen.borradas += 1;
    }
  }

  // 4) Página 404
  escribirSiCambia(ARCHIVO_404, pagina404());

  // 5) Tabla de precios de api/pagar.js
  const pagar = fs.readFileSync(ARCHIVO_PAGAR, "utf8");
  const apiCambio = escribirSiCambia(ARCHIVO_PAGAR, reemplazarEntre(pagar, "// CATALOGO:INICIO", "// CATALOGO:FIN", bloqueApi(), "api/pagar.js"));

  // 6) Sitemap: la portada y cada perfume, con la fecha real de su último cambio
  const huella = crypto.createHash("sha1").update(index).digest("hex").slice(0, 16);
  const portada = { loc: SITIO + "/", lastmod: huella === huellaAnterior ? fechasAnteriores[SITIO + "/"] || HOY : HOY, prioridad: "1.0" };
  const entrada = (u) => [
    "  <url>",
    "    <loc>" + esc(u.loc) + "</loc>",
    "    <lastmod>" + u.lastmod + "</lastmod>",
    "    <changefreq>weekly</changefreq>",
    "    <priority>" + u.prioridad + "</priority>",
    // La foto del perfume, para que también aparezca en Google Imágenes
    u.imagen ? "    <image:image><image:loc>" + esc(u.imagen) + "</image:loc></image:image>" : "",
    "  </url>",
  ].filter(Boolean).join("\n");
  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<!-- Lo escribe tools/generar-paginas.js --><!-- huella-portada: " + huella + " -->",
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    [portada].concat(urls).map(entrada).join("\n"),
    "</urlset>",
    "",
  ].join("\n");
  escribirSiCambia(ARCHIVO_SITEMAP, sitemap);

  console.log("Páginas de perfume: " + LISTA.length + " (" + resumen.nuevas + " nuevas, " + resumen.actualizadas + " actualizadas, " + resumen.iguales + " sin cambios" + (resumen.borradas ? ", " + resumen.borradas + " borradas" : "") + ")");
  console.log("sitemap.xml: " + (urls.length + 1) + " direcciones");
  console.log("api/pagar.js: precios de " + Object.keys(VALIDOS.productos).length + " perfumes y " + PACKS_OK.length + " packs" + (apiCambio ? " (actualizado)" : " (sin cambios)"));
}

// Ejecutado directamente (node tools/generar-paginas.js) escribe todo. Otros archivos de tools/
// pueden usar sus datos con require("./generar-paginas.js") sin escribir nada.
if (require.main === module) generar();
module.exports = { generar, CONFIG, SITIO, RAIZ, LISTA, slugDe, rutaDe, titulo, tamanosDe, listaMl, rutaImagen };
