import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--bg-app)",
        foreground: "var(--text-primary)",
        "text-sec": "var(--text-secondary)",
        "text-ter": "var(--text-tertiary)",
        
        glass: {
          surface: "var(--surface-glass)",
          hover: "var(--surface-glass-hover)",
          card: "var(--surface-card)",
          elevated: "var(--surface-elevated)",
        },
        
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          light: "var(--accent-light)",
          glow: "var(--accent-glow)",
        },
        
        // Neutral palette mapped to CSS vars
        n: {
          0:   "#FFFFFF",
          50:  "#F9F9FB",
          100: "#F2F2F5",
          200: "#E4E4E9",
          300: "#CBCBD4",
          400: "#9898A8",
          500: "#6B6B7A",
          600: "#4E4E5C",
          700: "#36363F",
          800: "#222228",
          850: "#18181D",
          900: "#111114",
          950: "#0A0A0C",
        },
        brand: {
          50:  "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
        surface: {
          50:  "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
          950: "#0A0A0C",
        },
      },
      borderRadius: {
        'small': '12px',
        'card': '20px',
        'dropzone': '28px',
        'pill': '9999px',
      },
      letterSpacing: {
        'headline': '-0.03em',
        'heading': '-0.01em',
        'caps': '0.06em',
      },
      lineHeight: {
        'tight-title': '1.05',
      },
      transitionTimingFunction: {
        'apple': 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      transitionDuration: {
        'apple': '250ms',
      },
      boxShadow: {
        'glass': 'var(--shadow-glass)',
        'floating': 'var(--shadow-floating)',
        'accent-button': 'var(--shadow-button)',
      },
    },
  },
  plugins: [],
};
export default config;
