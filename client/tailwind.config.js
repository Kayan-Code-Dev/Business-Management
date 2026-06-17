/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Tajawal", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#eef4fb",
          100: "#d9e6f5",
          200: "#b3cde9",
          300: "#85aedb",
          400: "#5388c7",
          500: "#326bae",
          600: "#1f4e78",
          700: "#1a4267",
          800: "#163654",
          900: "#122a42",
        },
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
      },
    },
  },
  plugins: [],
};
