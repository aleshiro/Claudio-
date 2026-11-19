#!/usr/bin/env node
/*
 * tools/imagenes-compartir.js — la imagen que aparece al compartir la página de cada perfume
 * (vista previa en WhatsApp, Instagram, Facebook, etc.).
 *
 * Crea assets/compartir/<marca>-<id>.jpg (1200 × 630) con la foto de la botella, la marca, el nombre
 * y los tamaños, y después vuelve a generar las páginas para que cada una use su imagen.
 * No lleva precios a propósito: WhatsApp guarda la vista previa mucho tiempo y un precio viejo confunde.
 *
 * Uso (necesita Playwright con Chromium):
 *     node tools/imagenes-compartir.js
 * Ejecútalo cuando agregues un perfume o cambies su foto o su nombre. Si no lo ejecutas,
 * la página de ese perfume usa la imagen general assets/compartir-decantsprime.jpg.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const datos = require("./generar-paginas.js");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (e) {
  console.error("Falta Playwright. Instálalo con:  npm install --no-save playwright && npx playwright install chromium");
  process.exit(1);
}

const CARPETA = path.join(datos.RAIZ, "assets", "compartir");
const COLOR_TAG = { "Nicho": "#c9a560", "Árabe": "#c88e66", "Diseñador": "#d2d5da" };
const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const dominio = datos.SITIO.replace(/^https?:\/\/(www\.)?/, "");

function plantilla(p, foto) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;1,500&family=Jost:wght@400;500&display=swap">
<style>
* { box-sizing: border-box; margin: 0; }
body { width: 1200px; height: 630px; overflow: hidden; position: relative; font-family: Jost, sans-serif; color: #181715;
  background: radial-gradient(48% 70% at 27% 46%, rgb(255 255 255 / .85), transparent 75%), #ece6db; }
.botella { position: absolute; left: 40px; width: 520px; top: 34px; bottom: 146px; display: flex; align-items: flex-end; justify-content: center; }
.botella img { display: block; max-width: 400px; max-height: 100%; filter: drop-shadow(0 18px 18px rgb(0 0 0 / .2)); }
.texto { position: absolute; left: 610px; right: 72px; top: 0; bottom: 118px; display: flex; flex-direction: column; justify-content: center; }
.tag { align-self: flex-start; padding: 7px 14px 6px; border-radius: 3px; font-size: 17px; font-weight: 500; letter-spacing: .18em; text-transform: uppercase; }
.marca { margin-top: 28px; font-size: 22px; font-weight: 500; letter-spacing: .22em; text-transform: uppercase; color: #6b665e; }
.nombre { margin-top: 10px; font-family: "Playfair Display", serif; font-weight: 500; font-size: 68px; line-height: 1.06; letter-spacing: -.005em; }
.tamanos { margin-top: 24px; font-size: 27px; color: #45413b; }
.repisa { position: absolute; left: 0; right: 0; bottom: 0; height: 118px; padding: 0 72px; display: flex; align-items: center; justify-content: space-between; background: #1b2a4a; color: #f6f3ed; }
.logo { font-family: "Playfair Display", serif; font-size: 50px; font-weight: 500; }
.logo em { font-style: italic; margin-left: .2em; }
.dato { text-align: right; font-size: 23px; line-height: 1.35; letter-spacing: .02em; color: #cbd5e1; }
.dato b { color: #f6f3ed; font-weight: 500; }
</style></head><body>
<div class="botella">${foto ? `<img src="${foto}" alt="">` : ""}</div>
<div class="texto">
  <span class="tag" style="background:${COLOR_TAG[p.categoria] || "#d2d5da"}">${esc(p.categoria)}</span>
  <p class="marca">${esc(p.marca)}</p>
  <p class="nombre">${esc(p.nombre)}</p>
  <p class="tamanos">Decant de ${esc(datos.listaMl(p))} ml</p>
</div>
<div class="repisa">
  <p class="logo">decants<em>prime</em></p>
  <p class="dato"><b>${esc(dominio)}</b><br>Rancagua · Santiago · envíos a todo Chile</p>
</div>
</body></html>`;
}

(async () => {
  fs.mkdirSync(CARPETA, { recursive: true });
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const vigentes = new Set();
  for (const p of datos.LISTA) {
    let foto = "";
    if (p.imagen && !/^(https?:|data:)/i.test(p.imagen)) {
      const archivo = path.join(datos.RAIZ, p.imagen.replace(/^\/+/, ""));
      if (fs.existsSync(archivo)) {
        const tipo = /\.png$/i.test(archivo) ? "image/png" : /\.webp$/i.test(archivo) ? "image/webp" : "image/jpeg";
        foto = "data:" + tipo + ";base64," + fs.readFileSync(archivo).toString("base64");
      }
    }
    await pagina.setContent(plantilla(p, foto), { waitUntil: "networkidle" });
    await pagina.evaluate(() => document.fonts.ready);
    // Nombres largos: se achica la letra hasta que quepa en dos líneas
    await pagina.evaluate(() => {
      const n = document.querySelector(".nombre");
      let t = 68;
      while (n.getBoundingClientRect().height > t * 1.06 * 2 + 2 && t > 40) { t -= 2; n.style.fontSize = t + "px"; }
    });
    const nombre = datos.slugDe(p) + ".jpg";
    vigentes.add(nombre);
    await pagina.screenshot({ path: path.join(CARPETA, nombre), type: "jpeg", quality: 86 });
  }
  await navegador.close();
  // Imágenes de perfumes que ya no están en el catálogo
  for (const f of fs.readdirSync(CARPETA)) if (/\.jpg$/.test(f) && !vigentes.has(f)) fs.unlinkSync(path.join(CARPETA, f));
  console.log("Imágenes para compartir: " + vigentes.size + " en assets/compartir/");
  datos.generar();
})().catch((e) => { console.error(e); process.exit(1); });
