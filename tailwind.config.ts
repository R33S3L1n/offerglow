import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  safelist: [
    "theme-warm",
    "theme-minimal",
    "theme-dark",
    "theme-lilac",
    "theme-ocean",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        serif: ["Playfair Display", "serif"],
      },
      colors: {
        brand: {
          bg: "#f5f2eb",
          dark: "#111111",
          muted: "#6b6b6b",
          accent: "#3b82f6",
        },
      },
    },
  },
  plugins: [],
};

export default config;
