export const C = {
  bg: "#0f1117",
  panel: "#161b27",
  panelBorder: "#2a3045",
  accent: "#4f8ef7",
  accentMuted: "#1e3a6e",
  text: "#e2e8f0",
  textMuted: "#8896b0",
  textDim: "#4a5568",
  danger: "#e05c5c",
  success: "#3dba7e",
  warning: "#e0a020",
  edge: "#4a5568",
};

export const PH = 400;

export const panel = (extra = {}) => ({
  background: C.panel,
  border: `1px solid ${C.panelBorder}`,
  borderRadius: 8,
  padding: "12px",
  display: "flex",
  flexDirection: "column",
  height: PH,
  boxSizing: "border-box",
  overflow: "hidden",
  ...extra,
});

export const lbl = {
  fontSize: 10,
  fontFamily: "monospace",
  letterSpacing: "0.12em",
  color: C.textMuted,
  textTransform: "uppercase",
  marginBottom: 8,
  borderBottom: `1px solid ${C.panelBorder}`,
  paddingBottom: 6,
  flexShrink: 0,
};

export const btn = (v = "default") => ({
  fontSize: 11,
  fontFamily: "monospace",
  padding: "4px 10px",
  borderRadius: 4,
  cursor: "pointer",
  border: `1px solid ${v === "danger" ? C.danger : v === "success" ? C.success : C.panelBorder}`,
  background: v === "danger" ? "rgba(224,92,92,0.12)" : v === "success" ? "rgba(61,186,126,0.12)" : "rgba(255,255,255,0.04)",
  color: v === "danger" ? C.danger : v === "success" ? C.success : C.text,
  whiteSpace: "nowrap",
  flexShrink: 0,
});

export const inp = (extra = {}) => ({
  background: "rgba(255,255,255,0.04)",
  border: `1px solid ${C.panelBorder}`,
  borderRadius: 4,
  color: C.text,
  fontSize: 11,
  fontFamily: "monospace",
  padding: "5px 8px",
  outline: "none",
  ...extra,
});
