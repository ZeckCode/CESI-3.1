import React from "react";
import { CheckCircle, Clock, AlertCircle, AlertTriangle, XCircle } from "lucide-react";
import { STATUS_STYLES, FEE_STYLES } from "./enrollmentConstants";
import { statusLabel } from "./enrollmentUtils";

const badgeStyle = (map, key) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  padding: "4px 10px",
  borderRadius: "20px",
  fontSize: "11px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.4px",
  whiteSpace: "nowrap",
  lineHeight: 1,
  ...(map[key] || { background: "#f3f4f6", color: "#6b7280" }),
});

export function StatusBadge({ code, expired }) {
  const displayCode =
    expired && code !== "DROPPED" && code !== "COMPLETED" ? "EXPIRED" : code;

  const icon =
    displayCode === "EXPIRED" ? (
      <AlertTriangle size={12} />
    ) : displayCode === "ACTIVE" || displayCode === "COMPLETED" ? (
      <CheckCircle size={12} />
    ) : displayCode === "DROPPED" ? (
      <XCircle size={12} />
    ) : (
      <Clock size={12} />
    );

  return (
    <span style={badgeStyle(STATUS_STYLES, displayCode)}>
      {icon}
      {statusLabel(displayCode)}
    </span>
  );
}

export function FeeBadge({ fee }) {
  const icon =
    fee === "cash" || fee === "Paid" ? (
      <CheckCircle size={12} />
    ) : fee === "installment" || fee === "Pending" ? (
      <Clock size={12} />
    ) : (
      <AlertCircle size={12} />
    );

  return (
    <span style={badgeStyle(FEE_STYLES, fee)}>
      {icon}
      {String(fee).toUpperCase()}
    </span>
  );
}