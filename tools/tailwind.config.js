/*
 * Configuración de Tailwind para decants_prime.
 * Los colores y tipografías reales viven como variables CSS en el bloque
 * ":root" de ../index.html. Aquí solo se les da nombre para usarlos como
 * clases (bg-fondo, text-tinta, font-display, etc.).
 */
const canal = (nombre) => `rgb(var(--${nombre}) / <alpha-value>)`;

module.exports = {
  // "content" lo define build-css.js (lee ../index.html sin el CSS generado).
  content: [],
  future: {
    // En iPhone evita que los estilos :hover queden "pegados" después de tocar.
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      colors: {
        fondo: canal("fondo"),
        papel: canal("papel"),
        piedra: canal("piedra"),
        linea: canal("linea"),
        tinta: canal("tinta"),
        humo: canal("humo"),
        oro: canal("oro"),
        alerta: canal("alerta"),
      },
      fontFamily: {
        display: "var(--font-display)",
        sans: "var(--font-sans)",
      },
    },
  },
  plugins: [],
};
