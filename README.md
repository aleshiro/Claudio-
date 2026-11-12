# decants_prime · tienda web

Página de una sola pantalla con catálogo, packs, reseñas, carrito y pedido por WhatsApp.
Funciona sola, sin servidor: se puede publicar gratis en GitHub Pages o Vercel.

## Qué hay en esta carpeta

| Archivo | Para qué sirve |
| --- | --- |
| `index.html` | **La página completa.** Es lo único que necesitas editar. |
| `assets/` | Imágenes: ícono e imagen que se ve al compartir el link. En `assets/perfumes/` van las fotos de las botellas. |
| `robots.txt`, `sitemap.xml` | Ayudan a Google a encontrar la página. |
| `tools/` | Herramientas para quien programe. Puedes ignorarla. |

Todo lo editable está al inicio del bloque `<script>` de `index.html`, con explicaciones en español: `CONFIG` (tus datos), `PRODUCTOS`, `PACKS` y `RESENAS`.

## 1. Lo primero: tu número de WhatsApp

1. Abre `index.html` (en GitHub: clic en el archivo y luego en el lápiz ✏️).
2. Busca `569XXXXXXXX` (Ctrl+F).
3. Reemplázalo por tu número con código de país, sin `+` ni espacios. Ejemplo: `56912345678`.
4. Guarda (en GitHub: botón verde **Commit changes**).

Mientras no lo cambies, el carrito muestra un aviso en rojo y WhatsApp le pide al cliente elegir a quién enviar el mensaje.

El mensaje que recibes incluye los perfumes con sus ml, la **forma de entrega**, la **forma de pago** y el **total final a pagar**, con el 5% ya descontado si el cliente dejó su correo. El cliente no puede enviar el pedido sin elegir la entrega.

**Costo de entrega:** en `CONFIG.entregas` cada opción tiene su `costo`, que se suma al total (0 = gratis). Hoy las entregas presenciales valen $0 y Blue Express $3.990.

**Beneficios por monto:** el carrito muestra una barra de progreso con dos metas, definidas en `CONFIG.beneficios`: `vialGratisDesde` (vial sorpresa de 2 ml de regalo, hoy $25.000) y `envioGratisDesde` (envío gratis por Blue Express, hoy $35.000). Se calculan con el subtotal de productos y el beneficio desbloqueado queda escrito en el pedido de WhatsApp. Con `0` se desactivan.

## 2. Perfumes y precios

**Agregar un perfume:** copia un bloque completo de la lista `PRODUCTOS`, pégalo debajo y cambia los datos.

```js
{
  id: "nombre-unico-sin-espacios", nombre: "Nombre del perfume", marca: "Marca", categoria: "Árabe",
  acordes: "Cítrico · Dulce · Amaderado",
  precios: { 3: 4490, 5: 6990, 10: 11990 },
  color: "#49b6e6",
  imagen: "",
},
```

- `categoria` puede ser `"Nicho"`, `"Árabe"` o `"Diseñador"`.
- `precios` es lo que paga el cliente por cada tamaño, sin puntos ni `$`. Puedes quitar o agregar tamaños: los nicho traen también 2 ml.
- `acordes` describe cómo huele en pocas palabras (dulce, cítrico, amaderado). Son orientativos: revísalos.
- `inspiracion` es el texto corto bajo el nombre ("Inspirado en: Creed Aventus", "ADN 100% Original"). Vacío (`""`) no muestra nada.
- `ocasion` dice para qué sirve. Usa estas etiquetas tal cual: `"Calor / Verano"`, `"Fiesta / Noche"`, `"Citas"`, `"Todo Terreno"`, `"Modo Bestia"`. Con ellas funcionan los filtros por ocasión y el Match olfativo.
- `etiqueta: "Más vendido",` muestra ese texto sobre la foto (también sirve en los packs).
- Para marcarlo sin stock agrega la línea `agotado: true,`.
- El catálogo se ordena solo: primero Nicho, después Diseñador y al final Árabe.

**Precio normal tachado:** `CONFIG.ofertaPorcentaje` (hoy en 15) hace que cada tarjeta muestre además un precio normal tachado, calculado como ese porcentaje por sobre tu precio. Úsalo solo si ese es de verdad tu precio fuera de oferta. Con `0` se muestra un solo precio. Para fijar el precio normal exacto de un perfume, agrégale la línea `normal: { 3: 5490, 5: 8490, 10: 13990 },`.

**Marcas:** la fila de círculos del catálogo se arma sola con las marcas de `PRODUCTOS`. Las letras de cada círculo se definen en `CONFIG.monogramas`.

**Match olfativo:** el bloque "Encuentra tu perfume en 3 toques" muestra los tres perfumes que mejor calzan con el momento y el aroma elegidos. Se calcula con `ocasion` y con `acordes` (el primer acorde pesa más), así que no hay nada extra que mantener.

**Buscador y filtros:** el buscador de la cabecera busca por nombre, marca o acorde. También se puede filtrar por marca y por categoría.

**Packs:** lista `PACKS`. Cada pack dice qué perfumes incluye (por su `id`), el tamaño y el precio final. El "antes" (lo que costarían por separado) y el porcentaje de ahorro se calculan solos. **Los precios de los packs son de ejemplo.**

**Pack destacado:** el que se ve al inicio de la página. Se elige en `CONFIG.packDestacado` escribiendo el `id` del pack.

**Atomizaciones:** cada tarjeta muestra cuántas atomizaciones rinde el tamaño elegido. Se calculan con `CONFIG.atomizacionesPorMl` (10 por ml). Con `0` se ocultan.

## 3. Fotos de los perfumes

Cada tarjeta muestra la **foto de la botella** y, en la esquina, un **decant** que se llena según el tamaño elegido.
Mientras un perfume no tenga foto se ve un recuadro que dice FOTO.

Para poner una, escribe su dirección entre las comillas de `imagen`:

```js
imagen: "assets/perfumes/rasasi-hawas-ice.png",       // un archivo subido a la carpeta assets/perfumes
imagen: "https://tusitio.com/fotos/hawas-ice.jpg",    // o una dirección de internet
```

- **PNG con fondo transparente:** la botella se ve completa sobre el fondo de la tarjeta. Es lo que mejor calza con la página.
- **JPG:** la foto rellena el recuadro, con su fondo incluido.
- Lo más seguro es subir la imagen a este repositorio: un link a otra página puede dejar de funcionar.
- Usa fotos propias o que tengas permiso de usar.

**Para quien programe:** `tools/recortar-fotos.py` quita el fondo blanco de una foto de producto (o respeta el fondo si ya es transparente), la recorta al contorno de la botella y la guarda lista en `assets/perfumes/`.

```bash
pip install pillow numpy
python3 tools/recortar-fotos.py foto-original.jpg rasasi-hawas-ice
```

## 4. Descuento por correo y dónde se guardan los correos

- El porcentaje está en `CONFIG.descuentoCorreo` (5 = 5%). Con `0` se desactiva y la sección desaparece.
- El formulario está en la franja negra bajo el inicio (no es una ventana emergente) y también dentro del carrito.
- Cuando el cliente escribe su correo, el descuento se aplica de inmediato al total del carrito.
- El correo **no** va en el mensaje de WhatsApp. La página lo envía en segundo plano, sin recargar, a la dirección que pongas en `CONFIG.guardarCorreosEn`.

**⚠ Mientras `guardarCorreosEn` esté vacío, los correos no se guardan en ninguna parte.** La página lo recuerda con un aviso bajo el formulario, que desaparece al configurarlo.

### Crear tu link de Formspree (gratis)

1. Entra a [formspree.io](https://formspree.io) y crea una cuenta con tu correo.
2. Presiona **+ New Form**, ponle un nombre (por ejemplo "Correos decants_prime") y créalo.
3. Formspree te muestra un link parecido a `https://formspree.io/f/abcdwxyz`. Cópialo.
4. En `index.html` busca `guardarCorreosEn` y pega el link entre las comillas:

```js
guardarCorreosEn: "https://formspree.io/f/abcdwxyz",
```

5. Guarda y haz una prueba dejando un correo en la página: debería llegarte un email de Formspree y aparecer en la pestaña **Submissions**, desde donde se descargan todos como planilla.

Datos útiles:

- El plan gratuito tiene un tope mensual de envíos (unos 50; revisa el número vigente en su página de planes).
- Si la prueba no llega, entra al formulario en Formspree → **Settings** y revisa que no tenga activada una verificación tipo reCAPTCHA, porque bloquea los envíos hechos en segundo plano.
- Si un envío falla (por ejemplo, el cliente se quedó sin señal), la página lo reintenta sola en su próxima visita.

### Alternativa sin tope: Google Forms

1. Crea un formulario en [forms.google.com](https://forms.google.com) con una sola pregunta de respuesta corta llamada "Correo".
2. En el menú ⋮ elige **Obtener enlace prellenado**, escribe `x` en la pregunta y presiona **Obtener enlace**. El link copiado termina en algo como `entry.123456789=x`.
3. En `index.html` pega el link del formulario en `guardarCorreosEn` (sirve el que termina en `/viewform`) y el nombre del campo en `campoGoogleForms`:

```js
guardarCorreosEn: "https://docs.google.com/forms/d/e/XXXXXXXX/viewform",
campoGoogleForms: "entry.123456789",
```

## 5. Reseñas de clientes

La sección **Reseñas** tiene un formulario donde el cliente elige sus estrellas, el perfume y escribe su opinión.

- **Cómo te llegan:** por WhatsApp, con la reseña ya escrita. Si prefieres recibirlas por correo, crea otro formulario en Formspree y pega su link en `CONFIG.guardarResenasEn`.
- **Cómo se publican:** tú decides cuáles. Para publicar una, agrégala a la lista `RESENAS`:

```js
const RESENAS = [
  { nombre: "Camila R.", perfume: "torino-21", estrellas: 5, texto: "Llegó al día siguiente y huele increíble.", fecha: "2026-11" },
];
```

- `perfume` es el `id` del perfume o pack (déjalo `""` si opina de la tienda en general).
- Con las reseñas publicadas se calculan solos el promedio de la tienda y las estrellas de cada tarjeta, con la cantidad entre paréntesis. Google también recibe esas puntuaciones.
- Mientras la lista esté vacía no aparecen estrellas. **Publica solo reseñas reales:** las puntuaciones inventadas son publicidad engañosa y, si un cliente lo nota, cuestan más confianza de la que dan.

## 6. Mercado Pago

En el carrito el cliente elige **Transferencia bancaria** o **Mercado Pago**, y el pedido que te llega por WhatsApp dice cuál eligió. Se configura en `CONFIG.mercadopago` y hay tres formas de cobrar:

| Forma | Qué tienes que hacer | Cómo paga el cliente |
| --- | --- | --- |
| **A. Por el chat** (ya funciona) | Nada. Al recibir el pedido, creas un link de pago por el total en tu app de Mercado Pago y lo envías. | Abre el link que le mandas. |
| **B. Tu link** | Copia "Tu link" de Mercado Pago (está en la sección Link de pago) y pégalo en `linkDePago`. | En el carrito aparece el botón "Pagar con Mercado Pago", que abre tu link; el cliente escribe el total. |
| **C. Cobro automático** | Necesita un pequeño servidor con tu clave secreta. Pega su dirección en `servidor`. | El botón lo lleva directo a pagar el monto exacto. |

Para dejar solo transferencia, pon `activo: false`.

**Sobre la forma C, para quien la programe:** la clave secreta de Mercado Pago no puede vivir en `index.html` porque cualquiera podría verla. La página envía por `POST` a `servidor` un JSON con `items` (`tipo`, `id`, `ml`, `cantidad`), `correo` y `entrega`. El servidor recalcula los precios con su propia lista (nunca confía en montos que vengan del navegador), crea la preferencia de Checkout Pro y responde `{ "url": "<init_point>" }`. En Vercel puede ser una función gratuita dentro de este repositorio (carpeta `api/`).

## 7. Redes sociales

En `CONFIG` escribe tu usuario de `instagram` y de `tiktok`, sin `@`. Aparecen en la sección de contacto y en el pie de página, junto a WhatsApp. Si dejas uno vacío, ese ícono no se muestra.

## 8. Publicar la página gratis

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

## 9. SEO: qué ya está hecho y qué te toca a ti

**Ya incluido:** título y descripción con las palabras que la gente busca, vista previa para WhatsApp e Instagram, datos estructurados para Google (tienda, productos con precios, puntuaciones reales y preguntas frecuentes), carga rápida y diseño para celular.

**Te toca a ti (gratis, 15 minutos):**

1. Publica la página y pon el link en la biografía de Instagram y TikTok.
2. Regístrala en [Google Search Console](https://search.google.com/search-console) y envía `sitemap.xml`. Sin este paso Google puede tardar semanas en encontrarla.
3. Completa las fotos que faltan.
4. Un dominio propio (por ejemplo `decantsprime.cl`) da más confianza y mejora el posicionamiento.

## 10. ¿Shopify, Jumpseller o similares?

- Este archivo **no se puede pegar tal cual** en Shopify ni en Jumpseller: esas plataformas usan sus propias plantillas.
- Sí es fácil traspasar el contenido: cada perfume sería un producto y los tamaños sus variantes.
- Ventajas de esas plataformas: pagos con tarjeta ya integrados, control de stock, cálculo de envíos, reseñas automáticas. Jumpseller es chilena y se integra con Mercado Pago y Blue Express.
- Desventaja: tienen costo mensual.

Recomendación: parte con esta página gratuita y WhatsApp. Cuando los pedidos por WhatsApp te quiten demasiado tiempo, ese es el momento de pasar a una plataforma de pago.

## 11. Cambios de diseño (para quien programe)

La página usa Tailwind CSS ya compilado e incrustado dentro de `index.html`, por eso carga rápido y no depende de nada externo salvo las tipografías.

- Colores y tipografías: variables en el bloque `:root` al inicio de `index.html`.
- Editar productos, precios o textos **no** requiere recompilar.
- Si agregas o cambias clases de Tailwind, regenera el CSS:

```bash
cd tools
npm install   # solo la primera vez
npm run css
```
