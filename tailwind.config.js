/** @type {import('tailwindcss').Config} */

// Helper para que los modificadores de opacidad de Tailwind (bg-slate-900/60,
// etc.) sigan funcionando con colores respaldados por variables CSS — ver
// src/index.css (los tokens se definen ahí como tripletas "R G B").
function withOpacity(variable) {
  return ({ opacityValue }) =>
    opacityValue !== undefined ? `rgb(var(${variable}) / ${opacityValue})` : `rgb(var(${variable}))`;
}

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Big Shoulders Display"', 'system-ui', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        slate: {
          50: withOpacity('--ink'),
          100: withOpacity('--ink'),
          200: withOpacity('--ink'),
          300: withOpacity('--ink-soft'),
          400: withOpacity('--ink-soft'),
          500: withOpacity('--ink-faint'),
          600: withOpacity('--ink-faint'),
          700: withOpacity('--line'),
          800: withOpacity('--surface-soft'),
          900: withOpacity('--surface'),
          950: withOpacity('--bg'),
        },
        sky: {
          300: withOpacity('--gold-bright'),
          400: withOpacity('--gold-bright'),
          500: withOpacity('--gold'),
          600: '#6e4d16',
          700: '#56390f',
        },
        emerald: {
          300: withOpacity('--good'),
          400: withOpacity('--good'),
          500: withOpacity('--good'),
          600: withOpacity('--good'),
        },
        green: {
          300: withOpacity('--good'),
          400: withOpacity('--good'),
          500: withOpacity('--good'),
        },
        red: {
          300: withOpacity('--bad'),
          400: withOpacity('--bad'),
          500: withOpacity('--bad'),
          600: withOpacity('--bad'),
        },
      },
    },
  },
  plugins: [],
};
