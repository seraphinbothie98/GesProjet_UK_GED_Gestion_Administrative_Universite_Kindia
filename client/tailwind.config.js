/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        kindia: {
          blue: '#002B49',     // Deep Institutional Kindia Blue
          lightBlue: '#004070',
          gold: '#D4AF37',      // Emerald / Academic Gold
          emerald: '#10B981',   // Status Green
          amber: '#F59E0B',     // Status Orange
          crimson: '#EF4444',   // Status Red
          slate: '#F8FAFC'
        }
      }
    },
  },
  plugins: [],
}
