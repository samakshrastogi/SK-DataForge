/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f2f7f6",
          100: "#dcebe7",
          200: "#b8d7ce",
          300: "#8dbdad",
          400: "#5e9b87",
          500: "#447f6d",
          600: "#356558",
          700: "#2c5148",
          800: "#27423c",
          900: "#243834"
        }
      }
    }
  },
  plugins: []
};
