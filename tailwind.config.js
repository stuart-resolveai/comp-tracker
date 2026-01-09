/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@tremor/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand colors
        'resolve-lime': '#c4f441',
        'resolve-black': '#1a1a1a',
        'resolve-beige': '#f5f5f0',
        'resolve-dark-green': '#2d4a3e',
      },
    },
  },
  plugins: [],
}
