import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#002D72",
        panel: "#0055A4",
        electric: "#0055A4",
        sky: "#00B1E7",
        gold: "#00B1E7",
        cyan: "#00B1E7",
        table: "#FFFFFF",
        muted: "#6B7280",
      },
      boxShadow: {
        glow: "0 0 32px rgba(0, 177, 231, 0.24)",
        "glow-cyan": "0 0 32px rgba(0, 177, 231, 0.2)",
        "glow-gold": "0 0 32px rgba(0, 177, 231, 0.2)",
      },
    },
  },
  plugins: [],
};

export default config;
