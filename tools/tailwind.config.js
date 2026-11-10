/*
 * Configuración de Tailwind para decants_prime.
 * Los colores y tipografías reales viven como variables CSS en el bloque
 * ":root" de ../index.html. Aquí solo se les da nombre para usarlos como
 * clases (bg-ink, text-gold, font-display, etc.).
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
        ink: canal("ink"),
        coal: canal("coal"),
        graphite: canal("graphite"),
        line: canal("line"),
        bone: canal("bone"),
        silver: canal("silver"),
        alert: canal("alert"),
        gold: {
          DEFAULT: canal("gold"),
          soft: canal("gold-soft"),
        },
      },
      fontFamily: {
        display: "var(--font-display)",
        sans: "var(--font-sans)",
      },
    },
  },
  plugins: [],
};
