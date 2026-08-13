/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: '#12355b',
        greenSoft: '#e9f7f1',
        greenBrand: '#0f8a5f',
        redSoft: '#fff0f0',
        redBrand: '#b54747',
        purpleSoft: '#f3efff',
        purpleBrand: '#6d4db3',
      }
    },
  },
  plugins: [],
}
