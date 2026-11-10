/*
 * Regenera el CSS de Tailwind y lo deja escrito DENTRO de ../index.html,
 * entre las marcas TAILWIND:INICIO y TAILWIND:FIN.
 *
 * Solo hace falta ejecutarlo si se agregan o cambian clases de Tailwind
 * en index.html (cambios de diseño). Para editar productos, precios,
 * textos o el número de WhatsApp NO es necesario.
 *
 * Uso:
 *   cd tools
 *   npm install      (solo la primera vez)
 *   npm run css
 */
const fs = require("fs");
const path = require("path");
const postcss = require("postcss");
const tailwind = require("tailwindcss");
const autoprefixer = require("autoprefixer");
const cssnano = require("cssnano");
const baseConfig = require("./tailwind.config.js");

const ARCHIVO = path.join(__dirname, "..", "index.html");
const INICIO = "/* TAILWIND:INICIO */";
const FIN = "/* TAILWIND:FIN */";

async function main() {
  const html = fs.readFileSync(ARCHIVO, "utf8");
  const desde = html.indexOf(INICIO);
  const hasta = html.indexOf(FIN);
  if (desde === -1 || hasta === -1 || hasta < desde) {
    throw new Error("No encontré las marcas TAILWIND:INICIO / TAILWIND:FIN en index.html");
  }

  // Se analiza el HTML sin el CSS generado anteriormente, para que las
  // clases que ya no se usan desaparezcan del resultado.
  const fuente = html.slice(0, desde) + html.slice(hasta + FIN.length);

  const config = {
    ...baseConfig,
    content: [{ raw: fuente, extension: "html" }],
  };

  const resultado = await postcss([
    tailwind(config),
    autoprefixer({ overrideBrowserslist: ["iOS >= 14", "Safari >= 14", "last 3 Chrome versions", "last 3 Firefox versions", "last 3 Edge versions"] }),
    cssnano({ preset: "default" }),
  ]).process("@tailwind base;@tailwind components;@tailwind utilities;", { from: undefined });

  const nuevo =
    html.slice(0, desde + INICIO.length) + "\n" + resultado.css + "\n" + html.slice(hasta);

  fs.writeFileSync(ARCHIVO, nuevo);
  console.log(`CSS de Tailwind actualizado en index.html (${(resultado.css.length / 1024).toFixed(1)} KB)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
