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

        // Traditional Japanese Harmony Palette (日本の伝統色 - Dentō-shoku)
        jp: {
          sumi: '#090e17',          // 藍墨 (Deep Indigo-Sumi Canvas)
          'sumi-card': '#0e1624',   // 深藍 (Card Surface)
          'sumi-elevated': '#141f32', // 紺色 (Elevated Panel)
          'sumi-hover': '#1b2a42',  // 藍鼠 (Hover State)
          shuiro: '#e0533c',        // 朱色 (Torii Vermilion / Cinnabar)
          'shuiro-light': '#f06449',
          'shuiro-subtle': 'rgba(224, 83, 60, 0.12)',
          aiiro: '#2563eb',         // 藍色 (Indigo Dye)
          'aiiro-light': '#5c9ee6',
          'aiiro-subtle': 'rgba(37, 99, 235, 0.12)',
          matcha: '#2ea072',        // 抹茶色 (Japanese Green Tea)
          'matcha-light': '#34d399',
          'matcha-subtle': 'rgba(46, 160, 114, 0.12)',
          yamabuki: '#d99b26',      // 山吹色 (Golden Amber)
          'yamabuki-light': '#f59e0b',
          'yamabuki-subtle': 'rgba(217, 155, 38, 0.12)',
          sakura: '#ffb7c5',        // 桜色 (Cherry Blossom Pink)
          'sakura-subtle': 'rgba(255, 183, 197, 0.14)',
          gofun: '#f4f6fb',         // 胡粉 (Pure Silk Washi White)
          kumo: '#94a3b8',          // 雲色 (Morning Mist Slate)
        },

        // Full-spectrum slate tailored to Japanese Sumi-Indigo
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          750: '#243247',
          800: '#141f32',  // Elevated Indigo-Sumi
          850: '#10192a',
          900: '#0e1624',  // Card Surface
          950: '#090e17',  // Deepest Canvas Background
        },

        coral: {
          50: '#fff5f3',
          100: '#ffe8e4',
          200: '#ffcfc5',
          300: '#ffa694',
          400: '#ff7c62',
          500: '#f06449',
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
          400: '#5c9ee6',
          500: '#296ec2',
          600: '#1b4987',
          700: '#163e75',
          800: '#141f32',
          900: '#0e1624',
          950: '#090e17',
        },
        primary: {
          50: '#fff5f3',
          100: '#ffe8e4',
          500: '#e0533c', // Torii Vermilion
          600: '#d9472b',
          700: '#b8351d',
        },
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      boxShadow: {
        'shuiro-glow': '0 0 35px -5px rgba(224, 83, 60, 0.45)',
        'aiiro-glow': '0 0 45px -5px rgba(37, 99, 235, 0.4)',
        'matcha-glow': '0 0 35px -5px rgba(46, 160, 114, 0.4)',
        'jp-card': '0 10px 30px -10px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(92, 158, 230, 0.08)',
        'jp-elevated': '0 20px 40px -15px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(92, 158, 230, 0.14)',
      },
      backdropBlur: {
        glass: '18px',
      }
    },
  },
  plugins: [],
}
export default config
