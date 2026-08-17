/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Vintage vinyl palette
        cream: "#f5edda",
        parchment: "#ece0c4",
        dust: "#c9b898",
        sepia: "#5a4632",
        wax: "#211b14",
        mustard: "#d8a43f",
        amber: "#c8791f",
        rust: "#a9482a",
        teal: "#3d7b74",
      },
      fontFamily: {
        display: ['"Playfair Display"', "Georgia", "Cambria", "serif"],
        body: ['"Inter"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        vinyl: "0 8px 24px -12px rgba(33, 27, 20, 0.45)",
        groove: "inset 0 0 0 1px rgba(90, 70, 50, 0.15)",
      },
      backgroundImage: {
        grooves:
          "repeating-radial-gradient(circle at 50% 50%, rgba(33,27,20,0.05) 0 2px, transparent 2px 6px)",
      },
    },
  },
  plugins: [],
};
