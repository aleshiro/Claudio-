# decants_prime · tienda web

Página de una sola pantalla con catálogo, packs, carrito y pedido por WhatsApp.
Funciona sola, sin servidor: se puede publicar gratis en GitHub Pages o Vercel.

## Qué hay en esta carpeta

| Archivo | Para qué sirve |
| --- | --- |
| `index.html` | **La página completa.** Es lo único que necesitas editar. |
| `assets/` | Imágenes: ícono, imagen que se ve al compartir el link, y aquí van tus fotos. |
| `robots.txt`, `sitemap.xml` | Ayudan a Google a encontrar la página. |
| `tools/` | Herramientas para quien programe. Puedes ignorarla. |

## 1. Lo primero: tu número de WhatsApp

1. Abre `index.html` (en GitHub: clic en el archivo y luego en el lápiz ✏️).
2. Busca `569XXXXXXXX` (Ctrl+F).
3. Reemplázalo por tu número con código de país, sin `+` ni espacios. Ejemplo: `56912345678`.
4. Guarda (en GitHub: botón verde **Commit changes**).

Mientras no lo cambies, el carrito muestra un aviso en rojo y WhatsApp le pide al cliente elegir a quién enviar el mensaje.

En ese mismo bloque (`CONFIG`) puedes cambiar tu usuario de Instagram y agregar el de TikTok.

## 2. Perfumes, precios y packs

Todo está al inicio del bloque `<script>` de `index.html`, con explicaciones en español.

**Agregar un perfume:** copia un bloque completo de la lista `PRODUCTOS`, pégalo debajo y cambia los datos.

```js
{
  id: "nombre-unico-sin-espacios",
  nombre: "Nombre del perfume",
  marca: "Marca",
  categoria: "Nicho",              // "Nicho", "Árabe" o "Diseñador"
  notas: "Nota 1 · Nota 2 · Nota 3",
  precios: { 3: 4990, 5: 6990, 10: 12990 },   // tamaño en ml : precio en pesos
  color: "#e2b552",                // color del líquido en el dibujo
  imagen: "",                      // opcional, ver punto 3
},
```

- Los precios van sin puntos ni `$`.
- Si un perfume no tiene algún tamaño, borra ese tamaño de `precios`.
- Para marcarlo sin stock agrega la línea `agotado: true,`.
- **Los precios y notas que vienen cargados son de ejemplo.** Cámbialos por los tuyos.
- El sexto perfume quedó como *Armaf Club de Nuit Intense Man*. Si vendes otra versión de Club de Nuit, cambia el nombre.

**Packs:** lista `PACKS`. Cada pack dice qué perfumes incluye (por su `id`), el tamaño y el precio final. El "antes" y el porcentaje de ahorro se calculan solos.

## 3. Fotos de producto

Mientras no haya foto, cada tarjeta muestra un frasco dibujado cuyo nivel sube según el tamaño elegido.
Para usar una foto real:

1. Sube la imagen a la carpeta `assets/` (idealmente cuadrada o vertical, menos de 300 KB, formato `.jpg` o `.webp`).
2. En el perfume, escribe la ruta: `imagen: "assets/torino-21.jpg",`

Usa nombres de archivo descriptivos (`xerjoff-torino-21-decant.jpg`): también ayudan en Google.

## 4. Descuento por dejar el correo

- El porcentaje está en `CONFIG.descuentoCorreo` (5 = 5%). Con `0` se desactiva y la sección desaparece.
- Cuando el cliente escribe su correo, el descuento se aplica en el carrito y **el correo llega dentro del mensaje de WhatsApp** junto al pedido.
- Para además guardar los correos en una lista, crea un formulario gratuito en [Formspree](https://formspree.io) y pega su dirección en `CONFIG.guardarCorreosEn`.

## 5. Publicar la página gratis

### Opción A: GitHub Pages

1. En GitHub entra a este repositorio → **Settings** → **Pages**.
2. En *Source* elige **Deploy from a branch**.
3. En *Branch* elige la rama que contiene `index.html` y la carpeta **/ (root)**. Guarda.
4. Espera uno o dos minutos. La página queda en `https://aleshiro.github.io/Claudio-/`.

En el plan gratuito de GitHub el repositorio debe ser público.

### Opción B: Vercel

1. Entra a [vercel.com](https://vercel.com) e inicia sesión con tu cuenta de GitHub.
2. **Add New → Project**, elige este repositorio y presiona **Deploy**. No hay nada que configurar.
3. Vercel te da una dirección del tipo `tu-proyecto.vercel.app` y permite conectar un dominio propio.

### Si la dirección final no es `aleshiro.github.io/Claudio-`

Busca `https://aleshiro.github.io/Claudio-/` y reemplázalo por tu dirección real en `index.html` (parte superior), `robots.txt` y `sitemap.xml`. Es importante para Google y para la vista previa al compartir el link.

## 6. SEO: qué ya está hecho y qué te toca a ti

**Ya incluido:** título y descripción con las palabras que la gente busca (decants, perfumes nicho, árabes, diseñador, Rancagua, Santiago, Chile), vista previa para WhatsApp e Instagram, datos estructurados para Google (tienda, productos con precios y preguntas frecuentes), carga rápida y diseño para celular.

**Te toca a ti (gratis, 15 minutos):**

1. Publica la página y pon el link en la biografía de Instagram y TikTok.
2. Regístrala en [Google Search Console](https://search.google.com/search-console) y envía `sitemap.xml`. Sin este paso Google puede tardar semanas en encontrarla.
3. Sube fotos reales de tus decants.
4. Un dominio propio (por ejemplo `decantsprime.cl`) da más confianza y mejora el posicionamiento.

## 7. Pagos en línea: Mercado Pago y Webpay

Hoy el pedido se cierra por WhatsApp y se paga por transferencia. La página ya trae la conexión para pagos en línea, apagada:

```js
pagos: {
  mercadopago: { activo: false, texto: "Pagar con Mercado Pago", servidor: "/api/pago-mercadopago" },
  webpay:      { activo: false, texto: "Pagar con Webpay",       servidor: "/api/pago-webpay" },
},
```

Al poner `activo: true` aparece el botón en el carrito. Pero para que funcione falta una pieza que **no puede vivir en esta página**: un pequeño servidor que guarde tus claves secretas de Mercado Pago o Transbank y cree el cobro. Si las claves estuvieran en `index.html`, cualquiera podría verlas.

Cómo funciona, para quien lo programe:

- La página envía por `POST` a la dirección `servidor` un JSON con `items` (`tipo`, `id`, `ml`, `cantidad`), `correo` y `entrega`.
- El servidor **recalcula los precios con su propia lista** (nunca confía en montos que vengan del navegador), crea el pago y responde:
  - Mercado Pago (Checkout Pro): `{ "url": "<init_point>" }`
  - Webpay Plus: `{ "url": "<url de Transbank>", "token": "<token>" }`
- La página redirige sola al cliente a pagar.

En Vercel ese servidor puede ser una función gratuita dentro de este mismo repositorio (carpeta `api/`).

**Mientras tanto, sin programar nada:** desde la app de Mercado Pago puedes crear un *link de pago* por el total del pedido y enviarlo por el chat de WhatsApp. El cliente paga con tarjeta y tú no tocas código.

## 8. ¿Shopify, Jumpseller o similares?

- Este archivo **no se puede pegar tal cual** en Shopify ni en Jumpseller: esas plataformas usan sus propias plantillas.
- Sí es fácil traspasar el contenido: cada perfume sería un producto y los tamaños 3, 5 y 10 ml sus variantes. Los textos, colores y tipografías se pueden replicar en una plantilla oscura.
- Ventajas de esas plataformas: pagos con tarjeta ya integrados, control de stock, cálculo de envíos, correos automáticos. Jumpseller es chilena y se integra con Webpay, Mercado Pago y Blue Express.
- Desventaja: tienen costo mensual.

Recomendación: parte con esta página gratuita y WhatsApp. Cuando los pedidos por WhatsApp te quiten demasiado tiempo, ese es el momento de pasar a una plataforma de pago.

## 9. Cambios de diseño (para quien programe)

La página usa Tailwind CSS ya compilado e incrustado dentro de `index.html`, por eso carga rápido y no depende de nada externo salvo las tipografías.

- Colores y tipografías: variables en el bloque `:root` al inicio de `index.html`.
- Editar productos, precios o textos **no** requiere recompilar.
- Si agregas o cambias clases de Tailwind, regenera el CSS:

```bash
cd tools
npm install   # solo la primera vez
npm run css
```
