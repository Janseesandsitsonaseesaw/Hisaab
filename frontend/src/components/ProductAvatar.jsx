import React from "react";

const AVATAR_PALETTES = [
  { bg: "#eff6ff", text: "#1d4ed8" }, // Blue
  { bg: "#ecfdf5", text: "#047857" }, // Green
  { bg: "#fef3c7", text: "#b45309" }, // Amber
  { bg: "#fdf2f8", text: "#be185d" }, // Pink
  { bg: "#faf5ff", text: "#6b21a8" }, // Purple
  { bg: "#fff7ed", text: "#c2410c" }, // Orange
  { bg: "#f0fdfa", text: "#0f766e" }, // Teal
  { bg: "#f5f3ff", text: "#5b21b6" }, // Indigo
];

function getPalette(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTES[h % AVATAR_PALETTES.length];
}

function getInitials(name = "") {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default function ProductAvatar({ name, size = 36 }) {
  const palette = getPalette(name);
  const initials = getInitials(name);

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        backgroundColor: palette.bg,
        color: palette.text,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: `${Math.round(size * 0.36)}px`,
        fontWeight: "700",
        letterSpacing: "0.5px",
        flexShrink: 0,
        boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, 0.04)",
        fontFamily: "var(--font-sans, inherit)"
      }}
      title={name}
    >
      {initials}
    </div>
  );
}
