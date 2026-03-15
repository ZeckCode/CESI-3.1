import React from "react";
import { AlertTriangle } from "lucide-react";

const Toast = ({ toasts = [], onDismiss }) => (
  <div
    style={{
      position: "fixed",
      top: 20,
      right: 20,
      zIndex: 9999,
      display: "flex",
      flexDirection: "column",
      gap: 10,
      maxWidth: 380,
    }}
  >
    {toasts.map((t) => (
      <div
        key={t.id}
        style={{
          background:
            t.type === "error"
              ? "#1c0a0a"
              : t.type === "success"
              ? "#052e16"
              : "#1a1d2e",
          color: "white",
          padding: "14px 18px",
          borderRadius: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          borderLeft: `4px solid ${
            t.type === "error"
              ? "#ef4444"
              : t.type === "success"
              ? "#22c55e"
              : "#f59e0b"
          }`,
        }}
      >
        <AlertTriangle
          size={17}
          style={{
            flexShrink: 0,
            marginTop: 1,
            color:
              t.type === "error"
                ? "#f87171"
                : t.type === "success"
                ? "#4ade80"
                : "#fbbf24",
          }}
        />
        <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>
          <div style={{ fontWeight: 700, marginBottom: 3 }}>{t.title}</div>
          <div style={{ opacity: 0.8 }}>{t.message}</div>
        </div>
        <button
          onClick={() => onDismiss(t.id)}
          style={{
            background: "none",
            border: "none",
            color: "white",
            cursor: "pointer",
            padding: 0,
            fontSize: 16,
            opacity: 0.6,
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      </div>
    ))}
  </div>
);

export default Toast;