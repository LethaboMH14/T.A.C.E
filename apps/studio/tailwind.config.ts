import type { Config } from 'tailwindcss';

// Every colour, font and radius points at a CSS variable in src/styles/tokens.css,
// which is copied from web/styles.css :root. Change a value there, not here.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        sunken: 'var(--sunken)',
        line: { DEFAULT: 'var(--line)', strong: 'var(--line-strong)' },
        ink: { DEFAULT: 'var(--ink)', 2: 'var(--ink-2)', 3: 'var(--ink-3)' },
        accent: { DEFAULT: 'var(--accent)', ink: 'var(--accent-ink)', weak: 'var(--accent-weak)' },
        blue: 'var(--blue)',
        pink: 'var(--pink)',
        violet: 'var(--violet)',
        ok: { DEFAULT: 'var(--ok)', weak: 'var(--ok-weak)', line: 'var(--ok-line)' },
        bad: { DEFAULT: 'var(--bad)', weak: 'var(--bad-weak)', line: 'var(--bad-line)' },
        run: { DEFAULT: 'var(--run)', weak: 'var(--run-weak)', line: 'var(--run-line)' },
        redo: 'var(--redo)',
      },
      fontFamily: {
        sans: ['var(--font)'],
        display: ['var(--display)'],
        mono: ['var(--mono)'],
      },
      borderRadius: {
        card: 'var(--radius)',
        field: 'var(--radius-sm)',
      },
      boxShadow: {
        card: 'var(--shadow)',
        lift: 'var(--shadow-lift)',
      },
      transitionTimingFunction: {
        studio: 'var(--ease)',
      },
    },
  },
  plugins: [],
} satisfies Config;
