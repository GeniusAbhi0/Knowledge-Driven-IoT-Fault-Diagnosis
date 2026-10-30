/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { ink: { 950: "#070b14", 900: "#0c1220", 800: "#131b2e", 700: "#1c2740", 600: "#2a3858" } },
      keyframes: {
        "pulse-soft": { "0%,100%": { opacity: "1" }, "50%": { opacity: ".45" } },
        shimmer: { "0%": { transform: "translateX(-100%)" }, "100%": { transform: "translateX(250%)" } },
        "dash-flow": { to: { strokeDashoffset: "-24" } },
      },
      animation: { "pulse-soft": "pulse-soft 1.6s ease-in-out infinite", shimmer: "shimmer 1.6s ease-in-out infinite", "dash-flow": "dash-flow 1.2s linear infinite" },
    },
  },
  plugins: [],
};
