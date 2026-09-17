/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./contexts/**/*.{js,ts,jsx,tsx}",
  ],
  presets: [require("nativewind/preset")],
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
    },
  },
  plugins: [],
};
