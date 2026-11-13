/*
 * api/pagar.js — cobro automático con Mercado Pago (Checkout Pro) para decants_prime.
 *
 * Qué hace: recibe el carrito desde la página, calcula el total CON SUS PROPIOS PRECIOS
 * (nunca confía en montos enviados por el navegador), crea el cobro en Mercado Pago y
 * devuelve la dirección de pago:  { "url": "https://www.mercadopago.cl/checkout/..." }
 *
 * Cómo se activa (en Vercel):
 *   1. Publica este repositorio en Vercel. Este archivo queda disponible en /api/pagar.
 *   2. En Vercel: Settings > Environment Variables, crea MP_ACCESS_TOKEN con tu Access Token
 *      de producción de Mercado Pago y vuelve a desplegar. El token NUNCA va en el código.
 *   3. En index.html, dentro de CONFIG.mercadopago, escribe:  servidor: "/api/pagar",
 *
 * ⚠ IMPORTANTE: si cambias un precio, un pack, el descuento o el costo de envío en
 *   index.html, cámbialo TAMBIÉN aquí. Si no coinciden, el cliente verá un total en la
 *   página y pagará otro.
 */

// ── Reglas (deben coincidir con CONFIG en index.html) ──
const DESCUENTO_CORREO = 5;          // % de descuento si el cliente dejó su correo
const ENVIO_BLUE_EXPRESS = 3990;     // costo del envío por Blue Express
const ENVIO_GRATIS_DESDE = 35000;    // subtotal desde el que el envío es gratis
const VIAL_GRATIS_DESDE = 25000;     // subtotal desde el que se regala un vial de 2 ml
const MAX_UNIDADES = 99;

// ── Precios por tamaño (ml: pesos). Los mismos del catálogo. ──
const PRODUCTOS = {
  "erba-gold": { nombre: "Xerjoff Erba Gold", precios: { 2: 10490, 3: 12490, 5: 19990, 10: 34990 } },
  "torino-21": { nombre: "Xerjoff Torino 21", precios: { 2: 10490, 3: 12490, 5: 19990, 10: 34990 } },
  "cherry-ink": { nombre: "Lorenzo Pazzaglia Cherry Ink", precios: { 2: 15490, 3: 17490, 5: 28990, 10: 54990 } },
  "summer-hammer": { nombre: "Lorenzo Pazzaglia Summer Hammer", precios: { 2: 16000, 3: 18000, 5: 28000, 10: 52000 } },
  "by-the-fireplace": { nombre: "Maison Margiela By the Fireplace", precios: { 2: 9000, 3: 11000, 5: 17000, 10: 31000 } },
  "le-beau": { nombre: "Jean Paul Gaultier Le Beau Clásico", precios: { 3: 7990, 5: 11990, 10: 19990 } },
  "le-beau-flower": { nombre: "Jean Paul Gaultier Le Beau Flower Edition", precios: { 3: 7990, 5: 11990, 10: 19990 } },
  "stronger-with-you-intensely": { nombre: "Armani Stronger With You Intensely", precios: { 3: 7990, 5: 11990, 10: 20990 } },
  "acqua-di-gio": { nombre: "Armani Acqua di Giò Profondo", precios: { 3: 7990, 5: 11990, 10: 20990 } },
  "1-million-lucky": { nombre: "Paco Rabanne 1 Million Lucky", precios: { 3: 7990, 5: 11490, 10: 19990 } },
  "sauvage-edp": { nombre: "Dior Sauvage EDP", precios: { 3: 7990, 5: 12490, 10: 21990 } },
  "starwalker-extreme": { nombre: "Montblanc Starwalker Extreme", precios: { 3: 4000, 5: 5500, 10: 8900 } },
  "asad-zanzibar": { nombre: "Lattafa Asad Zanzibar", precios: { 3: 4490, 5: 6990, 10: 11990 } },
  "khamrah-qahwa": { nombre: "Lattafa Khamrah Qahwa", precios: { 3: 4490, 5: 6990, 10: 11990 } },
  "opulent-dubai": { nombre: "Lattafa Opulent Dubai", precios: { 3: 2990, 5: 4990, 10: 9990 } },
  "hawas-ice": { nombre: "Rasasi Hawas Ice", precios: { 3: 4990, 5: 7990, 10: 13990 } },
  "hawas-tropical": { nombre: "Rasasi Hawas Tropical", precios: { 3: 4990, 5: 7990, 10: 13990 } },
  "club-de-nuit-precieux-1": { nombre: "Armaf Club de Nuit Precieux 1", precios: { 3: 9990, 5: 15990, 10: 28990 } },
  "club-de-nuit-untold": { nombre: "Armaf Club de Nuit Untold", precios: { 3: 4990, 5: 7990, 10: 13990 } },
  "club-de-nuit-intense": { nombre: "Armaf Club de Nuit Intense Man", precios: { 3: 4490, 5: 6990, 10: 11990 } },
  "odyssey-aqua": { nombre: "Armaf Odyssey Aqua", precios: { 3: 4490, 5: 6990, 10: 11990 } },
  "odyssey-mandarin-sky": { nombre: "Armaf Odyssey Mandarin Sky", precios: { 3: 4490, 5: 6990, 10: 11990 } },
  "turathi-blue": { nombre: "Afnan Turathi Blue", precios: { 3: 4490, 5: 6990, 10: 11990 } },
  "fragaby-1": { nombre: "Risala Fragaby 1", precios: { 3: 3990, 5: 6490, 10: 10990 } },
  "fragaby-2": { nombre: "Risala Fragaby 2", precios: { 3: 3990, 5: 6490, 10: 10990 } },
  "rayhaan-aqua": { nombre: "Rayhaan Aqua", precios: { 3: 4490, 5: 6990, 10: 11990 } },
  "tropical-vibe": { nombre: "Rayhaan Tropical Vibe", precios: { 3: 4490, 5: 6990, 10: 11990 } },
};

const PACKS = {
  "trio-arabe": { nombre: "Trío Árabe", precio: 19990 },
  "duo-xerjoff": { nombre: "Dúo Xerjoff", precio: 35990 },
  "descubrimiento": { nombre: "Pack Descubrimiento", precio: 21990 },
};

const correoValido = (c) => typeof c === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.trim());
const clp = (n) => "$" + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

// Calcula el pedido con los precios de este archivo. Lanza un error si algo no existe.
function calcularPedido(cuerpo) {
  const items = Array.isArray(cuerpo && cuerpo.items) ? cuerpo.items : [];
  if (!items.length || items.length > 60) throw new Error("El carrito está vacío.");
  const lineas = items.map((item) => {
    const cantidad = Math.floor(Number(item && item.cantidad));
    if (!(cantidad >= 1 && cantidad <= MAX_UNIDADES)) throw new Error("Cantidad no válida.");
    if (item.tipo === "pack") {
      const pack = Object.prototype.hasOwnProperty.call(PACKS, item.id) ? PACKS[item.id] : null;
      if (!pack) throw new Error("Pack no disponible.");
      return { titulo: pack.nombre, cantidad, unitario: pack.precio };
    }
    const producto = Object.prototype.hasOwnProperty.call(PRODUCTOS, item.id) ? PRODUCTOS[item.id] : null;
    const precio = producto && Object.prototype.hasOwnProperty.call(producto.precios, String(item.ml)) ? producto.precios[String(item.ml)] : 0;
    if (!precio) throw new Error("Perfume o tamaño no disponible.");
    return { titulo: producto.nombre + " " + Number(item.ml) + " ml", cantidad, unitario: precio };
  });
  const subtotal = lineas.reduce((s, l) => s + l.unitario * l.cantidad, 0);
  const descuento = correoValido(cuerpo.correo) ? Math.round(subtotal * DESCUENTO_CORREO / 100) : 0;
  const conEnvio = /blue express/i.test(String(cuerpo.entrega || ""));
  const envio = conEnvio && subtotal < ENVIO_GRATIS_DESDE ? ENVIO_BLUE_EXPRESS : 0;
  return { lineas, subtotal, descuento, envio, conEnvio, vialGratis: subtotal >= VIAL_GRATIS_DESDE, total: subtotal - descuento + envio };
}

module.exports = async function pagar(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido." });
  }
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ error: "Falta configurar MP_ACCESS_TOKEN en el servidor." });

  let cuerpo = req.body;
  if (typeof cuerpo === "string") { try { cuerpo = JSON.parse(cuerpo); } catch (e) { cuerpo = null; } }
  let pedido;
  try {
    pedido = calcularPedido(cuerpo || {});
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  // Detalle legible del pedido (lo ves en tu cuenta de Mercado Pago)
  const detalle = pedido.lineas.map((l) => l.cantidad + " x " + l.titulo).join(", ") +
    (pedido.descuento ? " | Descuento " + DESCUENTO_CORREO + "%: -" + clp(pedido.descuento) : "") +
    (pedido.conEnvio ? " | Envío Blue Express: " + (pedido.envio ? clp(pedido.envio) : "gratis") : "") +
    (pedido.vialGratis ? " | Regalo: vial sorpresa 2 ml" : "");
  const sitio = "https://" + (req.headers["x-forwarded-host"] || req.headers.host || "");

  const preferencia = {
    // Un solo ítem por el total exacto, para que coincida al peso con lo que vio el cliente.
    items: [{ title: "Pedido decants_prime", description: detalle.slice(0, 250), quantity: 1, currency_id: "CLP", unit_price: pedido.total }],
    statement_descriptor: "DECANTS PRIME",
    back_urls: { success: sitio + "/?pago=aprobado", pending: sitio + "/?pago=pendiente", failure: sitio + "/?pago=rechazado" },
    auto_return: "approved",
    metadata: {
      detalle: detalle,
      entrega: String(cuerpo.entrega || "").slice(0, 120),
      correo: correoValido(cuerpo.correo) ? cuerpo.correo.trim().toLowerCase() : "",
      subtotal: pedido.subtotal, descuento: pedido.descuento, envio: pedido.envio, total: pedido.total,
    },
  };
  if (preferencia.metadata.correo) preferencia.payer = { email: preferencia.metadata.correo };

  try {
    const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify(preferencia),
    });
    const datos = await r.json().catch(() => ({}));
    if (!r.ok || !datos.init_point) {
      console.error("Mercado Pago respondió", r.status, datos && datos.message);
      return res.status(502).json({ error: "Mercado Pago no pudo crear el cobro." });
    }
    return res.status(200).json({ url: datos.init_point, total: pedido.total });
  } catch (e) {
    console.error("Error al contactar a Mercado Pago:", e.message);
    return res.status(502).json({ error: "No se pudo contactar a Mercado Pago." });
  }
};

module.exports.calcularPedido = calcularPedido;   // para pruebas
