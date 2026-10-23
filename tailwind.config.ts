import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        japanese: ['"Noto Serif JP"', '"Shippori Mincho"', 'serif'],
      },
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        // Official Logo Palette: Circuit Coral & Sapphire Poly-Mesh
        coral: {
          50: '#fff5f3',
          100: '#ffe8e4',
          200: '#ffcfc5',
          300: '#ffa694',
          400: '#ff7c62', // Logo node bright highlight
          500: '#f06449', // Core Logo Circuit Coral
          600: '#ea583c',
          700: '#d9472b',
          800: '#b8351d',
          900: '#932c18',
        },
        sapphire: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#5c9ee6', // Logo Poly Facet Sky/Ice Blue
          500: '#296ec2', // Logo Cobalt Facet
          600: '#1b4987', // Logo Deep Sapphire Blue
          700: '#163e75',
          800: '#0f294d',
          900: '#0b1e38',
          950: '#081220', // Logo Deep Midnight Navy
        },
        primary: {
          50: '#fff5f3',
          100: '#ffe8e4',
          500: '#f06449', // Primary accent matches Logo Coral
          600: '#ea583c',
          700: '#d9472b',
        },
        // Mapped to Logo Deep Midnight Navy
        slate: {
          800: '#0f243e',
          850: '#0b1a2d',
          900: '#081220',
          950: '#050a12',
        }
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      boxShadow: {
        'coral-glow': '0 0 35px -5px rgba(240, 100, 73, 0.45)',
        'sapphire-glow': '0 0 45px -5px rgba(41, 110, 194, 0.4)',
        'glass-glow': '0 0 50px -10px rgba(41, 110, 194, 0.2), 0 8px 32px 0 rgba(0, 0, 0, 0.5)',
      },
      backdropBlur: {
        glass: '18px',
      }
    },
  },
  plugins: [],
}
export default config
