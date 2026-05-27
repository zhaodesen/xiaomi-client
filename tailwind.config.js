/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Maps to CSS variables defined in src/index.css.
        ink: {
          base: 'var(--bg-base)',
          surface: 'var(--bg-surface)',
          elev: 'var(--bg-elevated)',
          elev2: 'var(--bg-elevated-2)'
        },
        line: {
          subtle: 'var(--border-subtle)',
          DEFAULT: 'var(--border-default)',
          strong: 'var(--border-strong)'
        },
        fg: {
          DEFAULT: 'var(--text-primary)',
          dim: 'var(--text-secondary)',
          mute: 'var(--text-tertiary)',
          ghost: 'var(--text-muted)'
        },
        signal: {
          lime: 'var(--accent-lime)',
          amber: 'var(--accent-amber)',
          blue: 'var(--accent-blue)',
          red: 'var(--accent-red)'
        }
      },
      fontFamily: {
        display: ['var(--font-display)'],
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)']
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)'
      },
      boxShadow: {
        glow: 'var(--shadow-glow-lime)'
      }
    }
  },
  plugins: []
}
