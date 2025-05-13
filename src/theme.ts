export const theme = {
  colors: {
    primary: "#2563eb",
    primaryDark: "#1e40af",
    accent: "#f59e42",
    background: "#18181b",
    surface: "#23232a",
    border: "#2d2d36",
    text: "#f4f4f5",
    textSecondary: "#a1a1aa",
    error: "#ef4444",
    success: "#22c55e",
    warning: "#facc15",
    placeholder: "#22223b",
  },
  borderRadius: "12px",
  spacing: (factor: number) => `${factor * 8}px`,
  font: {
    family: "'Inter', 'Segoe UI', Arial, sans-serif",
    size: {
      base: "16px",
      heading: "1.5rem",
      subheading: "1.125rem",
      small: "0.875rem",
    },
    weight: {
      normal: 400,
      medium: 500,
      bold: 700,
    },
  },
  shadow: "0 4px 24px rgba(0,0,0,0.12)",
  transition: "all 0.2s cubic-bezier(.4,0,.2,1)",
};
