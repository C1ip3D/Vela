import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        space: {
          void: "#03060D",
          deep: "#070B16",
          mid: "#0C1220",
          surface: "#101828",
          elevated: "#162032",
          border: "#1C2A45",
          "border-lit": "#253A5E",
        },
        vela: {
          50: "#EEF2FF",
          100: "#E0E7FF",
          200: "#C7D2FE",
          300: "#A5B4FC",
          400: "#818CF8",
          500: "#7C9EF5",
          600: "#6366F1",
          glow: "rgba(124,158,245,0.20)",
        },
        star: {
          bright: "#E8ECFF",
          white: "#D4DAF0",
          dim: "#8B98B8",
          faint: "#4A5578",
        },
        nebula: {
          purple: "#6366F1",
          blue: "#3B82F6",
          teal: "#14B8A6",
          rose: "#F43F5E",
        },
        track: {
          weighted: "#818CF8",
          unweighted: "#A5B4FC",
          term: "#34D399",
        },
      },
      fontFamily: {
        ui: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      boxShadow: {
        "glow-vela": "0 0 24px rgba(124,158,245,0.25)",
        "glow-nebula": "0 0 30px rgba(99,102,241,0.20)",
        "glow-critical": "0 0 20px rgba(244,63,94,0.30)",
        "glow-success": "0 0 16px rgba(16,185,129,0.25)",
        "glow-star": "0 0 8px rgba(124,158,245,0.40)",
        card: "0 4px 24px rgba(0,0,0,0.6)",
        "card-hover": "0 8px 32px rgba(0,0,0,0.7), 0 0 20px rgba(124,158,245,0.08)",
      },
      backgroundImage: {
        "hero-gradient": "linear-gradient(135deg, #070B16 0%, #0C1220 40%, #101828 100%)",
        "sidebar-gradient": "linear-gradient(180deg, #0C1220 0%, #070B16 100%)",
        "nebula-gradient": "radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 60%)",
        "card-gradient": "linear-gradient(135deg, rgba(12,18,32,0.8) 0%, rgba(16,32,50,0.6) 100%)",
        "constellation-glow": "radial-gradient(circle, rgba(124,158,245,0.15) 0%, transparent 70%)",
      },
    },
  },
  plugins: [],
};

export default config;
