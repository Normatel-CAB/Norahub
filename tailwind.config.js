/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand:    { DEFAULT: 'var(--brand)', lite: 'var(--brand-lite)', glow: 'var(--brand-glow)', deep: 'var(--brand-deep)' },
        viz:      { green: 'var(--viz-green)', lime: 'var(--viz-lime)', teal: 'var(--viz-teal)', amber: 'var(--viz-amber)', red: 'var(--viz-red)' },
        surface:  { DEFAULT: 'var(--surface)', 2: 'var(--surface-2)', solid: 'var(--surface-solid)', card: 'var(--surface-card)' },
        hairline: { DEFAULT: 'var(--hairline)', hi: 'var(--hairline-hi)' },
        txt:      { DEFAULT: 'var(--txt)', dim: 'var(--txt-dim)', faint: 'var(--txt-faint)' },
      },
      transitionTimingFunction: { smooth: 'cubic-bezier(0.22, 0.75, 0.28, 1)' },
    },
  },
  plugins: [],
};
