/*
 * api/aviso-pago.js — te avisa cuando alguien paga con Mercado Pago.
 *
 * Mercado Pago llama a esta dirección cada vez que cambia un pago (lo configura api/pagar.js
 * con "notification_url"). Este archivo le pregunta a Mercado Pago el pago real (no confía en
 * lo que llega en la notificación) y, si está APROBADO, te envía un correo con:
 * qué compró, cuánto pagó, cómo lo quiere recibir y los datos de contacto del cliente.
 *
 * Dónde llega el aviso:
 *   - Por correo, a través de Formspree. Usa la variable AVISO_FORMSPREE si la creas en Vercel
 *     (recomendado: un formulario de Formspree solo para ventas); si no, usa el mismo
 *     formulario de los correos del descuento.
 *   - Opcional, notificación al celular con la app gratuita ntfy: crea en Vercel la variable
 *     NTFY_TOPIC con un nombre difícil de adivinar (por ejemplo decantsprime-ventas-8k2p9x),
 *     instala la app ntfy y suscríbete a ese mismo nombre.
 *
 * Mercado Pago puede repetir una notificación; en ese caso podrías recibir el mismo aviso
 * dos veces. Fíjate en el número de pago, que es el mismo.
 */
const FORMSPREE_POR_DEFECTO = "https://formspree.io/f/mvkagvap";

const clp = (n) => "$" + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

// Saca el número de pago de las distintas formas en que Mercado Pago avisa
function idDePago(req) {
  const q = req.query || {};
  let cuerpo = req.body;
  if (typeof cuerpo === "string") { try { cuerpo = JSON.parse(cuerpo); } catch (e) { cuerpo = {}; } }
  cuerpo = cuerpo || {};
  const tipo = cuerpo.type || cuerpo.topic || q.type || q.topic || "";
  if (tipo && tipo !== "payment") return "";
  const id = (cuerpo.data && cuerpo.data.id) || q["data.id"] || q.id || "";
  return /^\d{3,20}$/.test(String(id)) ? String(id) : "";
}

async function enviarAvisos(pago) {
  const m = pago.metadata || {};
  const productos = String(m.productos || m.detalle || pago.description || "").trim();
  const primero = productos.split("\n")[0].replace(/^•\s*/, "").split(" — ")[0];
  const titulo = "Nueva venta " + clp(pago.transaction_amount) + ": " + primero + (productos.includes("\n") ? " y más" : "");
  const extras = [
    m.subtotal ? "Subtotal: " + clp(m.subtotal) : "",
    Number(m.descuento) ? "Descuento por correo: -" + clp(m.descuento) : "",
    /blue express/i.test(m.entrega || "") ? "Envío Blue Express: " + (Number(m.envio) ? clp(m.envio) : "gratis") : "",
    /vial sorpresa/i.test(m.detalle || "") ? "Regalo: agregar vial sorpresa de 2 ml" : "",
  ].filter(Boolean);
  const lineas = [
    "QUÉ COMPRÓ",
    productos,
  ].concat(extras, [
    "TOTAL PAGADO: " + clp(pago.transaction_amount),
    "",
    "CÓMO LO RECIBE",
    m.entrega || "sin indicar",
    "",
    "DATOS DEL CLIENTE",
    "Cliente: " + (m.cliente_nombre || [pago.payer && pago.payer.first_name, pago.payer && pago.payer.last_name].filter(Boolean).join(" ") || "sin nombre"),
    "Teléfono: " + (m.cliente_telefono || "sin teléfono"),
    m.cliente_direccion ? "Dirección: " + m.cliente_direccion : "",
    m.cliente_notas ? "Indicaciones: " + m.cliente_notas : "",
    "Correo: " + (m.cliente_correo || m.correo || (pago.payer && pago.payer.email) || "sin correo"),
    "",
    "N° de pago Mercado Pago: " + pago.id + (pago.external_reference ? " (" + pago.external_reference + ")" : ""),
  ]).filter((l, i, arr) => l !== "" || (arr[i - 1] !== "" && i > 0));
  const texto = lineas.join("\n");
  const tareas = [];
  tareas.push(fetch(process.env.AVISO_FORMSPREE || FORMSPREE_POR_DEFECTO, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ _subject: titulo, tipo: "VENTA CON MERCADO PAGO", message: texto }),
  }));
  if (process.env.NTFY_TOPIC) {
    tareas.push(fetch("https://ntfy.sh/" + encodeURIComponent(process.env.NTFY_TOPIC), {
      method: "POST",
      headers: { Title: "Nueva venta " + clp(pago.transaction_amount), Tags: "moneybag", Priority: "high" },
      body: texto,
    }));
  }
  const resultados = await Promise.allSettled(tareas);
  resultados.forEach((r) => { if (r.status === "rejected" || (r.value && !r.value.ok)) console.error("Aviso no enviado:", r.reason || (r.value && r.value.status)); });
}

module.exports = async function avisoPago(req, res) {
  const token = process.env.MP_ACCESS_TOKEN;
  const id = idDePago(req);
  // Siempre se responde 200 para que Mercado Pago no reintente sin parar.
  if (!token || !id) return res.status(200).json({ ok: true });
  try {
    const r = await fetch("https://api.mercadopago.com/v1/payments/" + id, { headers: { Authorization: "Bearer " + token } });
    const pago = await r.json().catch(() => ({}));
    if (r.ok && pago.status === "approved") await enviarAvisos(pago);
  } catch (e) {
    console.error("No se pudo revisar el pago", id, e.message);
  }
  return res.status(200).json({ ok: true });
};

module.exports.idDePago = idDePago;   // para pruebas
