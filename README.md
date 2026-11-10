# decants_prime · tienda web

Página de una sola pantalla con catálogo, packs, carrito y pedido por WhatsApp.
Funciona sola, sin servidor: se puede publicar gratis en GitHub Pages o Vercel.

## Qué hay en esta carpeta

| Archivo | Para qué sirve |
| --- | --- |
| `index.html` | **La página completa.** Es lo único que necesitas editar. |
| `assets/` | Imágenes: ícono e imagen que se ve al compartir el link. En `assets/perfumes/` van las fotos de las botellas. |
| `robots.txt`, `sitemap.xml` | Ayudan a Google a encontrar la página. |
| `tools/` | Herramientas para quien programe. Puedes ignorarla. |

## 1. Lo primero: tu número de WhatsApp

1. Abre `index.html` (en GitHub: clic en el archivo y luego en el lápiz ✏️).
2. Busca `569XXXXXXXX` (Ctrl+F).
3. Reemplázalo por tu número con código de país, sin `+` ni espacios. Ejemplo: `56912345678`.
4. Guarda (en GitHub: botón verde **Commit changes**).

Mientras no lo cambies, el carrito muestra un aviso en rojo y WhatsApp le pide al cliente elegir a quién enviar el mensaje.

El mensaje que recibes incluye los perfumes con sus ml, la **forma de entrega** y el **total final a pagar**, con el 5% ya descontado si el cliente dejó su correo. El correo no va en el mensaje: se guarda aparte (punto 4). El cliente no puede enviar el pedido sin elegir una: Rancagua, Santiago o Blue Express. Esas opciones se editan en `CONFIG.entregas`.

En ese mismo bloque (`CONFIG`) puedes cambiar tu usuario de Instagram y agregar el de TikTok.

## 2. Perfumes, precios de oferta y packs

Todo está al inicio del bloque `<script>` de `index.html`, con explicaciones en español.

**Agregar un perfume:** copia un bloque completo de la lista `PRODUCTOS`, pégalo debajo y cambia los datos.

```js
{
  id: "nombre-unico-sin-espacios", nombre: "Nombre del perfume", marca: "Marca", categoria: "Árabe",
  notas: "Nota 1 · Nota 2 · Nota 3",
  normal: { 3: 3490, 5: 4990, 10: 8490 },   // precio normal: se ve tachado y en gris
  oferta: { 3: 2990, 5: 3990, 10: 6990 },   // precio oferta: es el que se cobra, se ve destacado
  color: "#49b6e6",
  imagen: "",
},
```

- `categoria` puede ser `"Nicho"`, `"Árabe"` o `"Diseñador"`.
- Los precios van sin puntos ni `$`. Al tocar 3, 5 o 10 ml cambian el precio normal, el precio oferta y el porcentaje de descuento de la etiqueta.
- Si borras la línea `oferta`, ese perfume se vende a precio normal, sin tachado.
- Si un perfume no tiene algún tamaño, bórralo de `normal` y de `oferta`.
- Para marcarlo sin stock agrega la línea `agotado: true,`.
- **Todos los precios cargados son de ejemplo.** Cámbialos por los tuyos. El precio normal debe ser uno que realmente cobres cuando no hay oferta.
- Las `notas` son orientativas, tomadas de tiendas y bases de datos de perfumes. Revísalas. Las de *Fragaby 1* y *Fragaby 2* quedaron vacías.

**Buscador y filtros:** el catálogo tiene un buscador por nombre, marca o nota, y filtros por categoría. Funcionan solos con lo que haya en `PRODUCTOS`.

**Packs:** lista `PACKS`. Cada pack dice qué perfumes incluye (por su `id`), el tamaño y el precio final. El "antes" (la suma de los precios oferta de sus decants) y el porcentaje de ahorro se calculan solos. Los packs aparecen antes que los perfumes.

**Pack destacado:** el que se ve al inicio de la página. Se elige en `CONFIG.packDestacado` escribiendo el `id` del pack.

**Atomizaciones:** cada tarjeta muestra cuántas atomizaciones rinde el tamaño elegido. Se calculan con `CONFIG.atomizacionesPorMl` (10 por ml: 3 ml ≈ 30, 5 ml ≈ 50, 10 ml ≈ 100). Cambia ese número si tus atomizadores rinden distinto, o pon `0` para ocultarlo.

## 3. Fotos de los perfumes

Cada tarjeta muestra a la izquierda la **foto de la botella** y a la derecha el **decant**, cuyo nivel sube o baja según el tamaño elegido.
Mientras un perfume no tenga foto se ve un recuadro gris que dice FOTO.

Ya están puestas las fotos de Torino 21, Erba Gold, Cherry Ink y Sauvage EDP, en `assets/perfumes/`, como PNG con fondo transparente.

Para poner otra, escribe su dirección entre las comillas de `imagen`:

```js
imagen: "assets/perfumes/rasasi-hawas-ice.png",       // un archivo subido a la carpeta assets/perfumes
imagen: "https://tusitio.com/fotos/hawas-ice.jpg",    // o una dirección de internet
```

- **PNG con fondo transparente:** la botella se ve completa sobre el fondo oscuro, con un brillo del color del perfume. Es lo que mejor calza con la página.
- **JPG:** la foto rellena el recuadro, con su fondo incluido.
- Lo más seguro es subir la imagen a este repositorio: un link a otra página puede dejar de funcionar.
- Usa fotos propias o que tengas permiso de usar.

**Para quien programe:** `tools/recortar-fotos.py` quita el fondo blanco de una foto de producto, la recorta al contorno de la botella y la guarda lista en `assets/perfumes/`.

```bash
pip install pillow numpy
python3 tools/recortar-fotos.py foto-original.jpg rasasi-hawas-ice
```

## 4. Descuento por correo y dónde se guardan los correos

- El porcentaje está en `CONFIG.descuentoCorreo` (5 = 5%). Con `0` se desactiva y la sección desaparece.
- El formulario está justo después del inicio de la página (no es una ventana emergente) y también dentro del carrito.
- Cuando el cliente escribe su correo y presiona el botón, el descuento se aplica de inmediato al total del carrito.
- El correo **no** se incluye en el mensaje de WhatsApp. La página lo envía en segundo plano, sin recargar, a la dirección que pongas en `CONFIG.guardarCorreosEn`.

**⚠ Mientras `guardarCorreosEn` esté vacío, los correos no se guardan en ninguna parte.** La página lo recuerda con un aviso en rojo bajo el formulario, que desaparece al configurarlo.

### Crear tu link de Formspree (gratis)

1. Entra a [formspree.io](https://formspree.io) y crea una cuenta con tu correo.
2. Presiona **+ New Form**, ponle un nombre (por ejemplo "Correos decants_prime") y créalo.
3. Formspree te muestra un link parecido a `https://formspree.io/f/abcdwxyz`. Cópialo.
4. En `index.html` busca `guardarCorreosEn` y pega el link entre las comillas:

```js
guardarCorreosEn: "https://formspree.io/f/abcdwxyz",
```

5. Guarda. Haz una prueba dejando un correo en la página: debería llegarte un email de Formspree y aparecer en la pestaña **Submissions** de tu formulario, desde donde se pueden descargar todos como planilla.

Datos útiles:

- El plan gratuito tiene un tope mensual de correos (unos 50; revisa el número vigente en su página de planes).
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

Los correos quedan en la pestaña **Respuestas** del formulario y se pueden abrir en una planilla de Google.

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
