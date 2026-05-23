export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          blue: "#2563EB",
          emerald: "#10B981",
          purple: "#7C3AED",
          ink: "#111827",
          cloud: "#F8FAFC"
        }
      },
      boxShadow: {
        soft: "0 20px 60px rgba(15, 23, 42, 0.08)",
        glow: "0 24px 80px rgba(37, 99, 235, 0.18)"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Arial", "sans-serif"]
      }
    }
  },
  plugins: []
};
