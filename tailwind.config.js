/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cube: {
          dark: '#0B1020',
          darker: '#070A14',
          card: '#131B2E',
          accent: '#38BDF8',
          glow: 'rgba(56, 189, 248, 0.25)',
        }
      },
      fontFamily: {
        mono: ['Fira Code', 'JetBrains Mono', 'Menlo', 'monospace'],
      }
    },
  },
  plugins: [],
}
