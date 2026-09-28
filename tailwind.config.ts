import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        base: "#060a13",
        slate: {
          850: "#151e2e",
          900: "#0f172a",
          950: "#080d1a",
        },
        brand: {
          cyan: "#06b6d4",
          teal: "#14b8a6",
          emerald: "#10b981",
          amber: "#f59e0b",
          rose: "#f43f5e",
        }
      },
      fontFamily: {
        outfit: ["var(--font-outfit)", "Outfit", "-apple-system", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "Consolas", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float": "float 3s ease-in-out infinite",
        "sonar": "sonar 2s cubic-bezier(0, 0.2, 0.8, 1) infinite",
        "scan": "scan 2.5s ease-in-out infinite alternate",
        "glow": "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
        sonar: {
          "0%": { transform: "scale(0.85)", opacity: "0.9" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        glow: {
          "0%": { boxShadow: "0 0 10px rgba(6, 182, 212, 0.3)" },
          "100%": { boxShadow: "0 0 25px rgba(6, 182, 212, 0.7)" },
        }
      }
    },
  },
  plugins: [],
};

export default config;
