import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#121212",
        panel: "#1d1b1a",
        panelSoft: "#262321",
        gold: "#d8b15d",
        sand: "#f2d997",
        border: "#2d2a27",
        text: "#f5f2ee",
        muted: "#9a938a",
        success: "#18b47e",
        danger: "#d45d5d"
      },
      boxShadow: {
        panel: "0 30px 60px rgba(0,0,0,0.28)"
      },
      fontFamily: {
        sans: ["Poppins", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
} satisfies Config;

