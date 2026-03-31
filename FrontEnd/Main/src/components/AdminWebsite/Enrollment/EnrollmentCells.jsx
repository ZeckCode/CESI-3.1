import React from "react";
import { formatExpiryDate } from "./enrollmentUtils";

export function StudentCell({ row }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontWeight: 700, color: "#111827" }}>{row.studentName}</div>
      <div style={{ fontSize: 11, color: "#64748b" }}>
        AY {row.academicYear || "—"} · {row.sectionName || "No section"}
      </div>
      {row.expired && (
        <div style={{ fontSize: 11, color: "#7e22ce", fontWeight: 700 }}>
          Expired · {formatExpiryDate(row.academicYear)}
        </div>
      )}
    </div>
  );
}

export function ParentCell({ row }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontWeight: 600 }}>{row.parentName}</div>
      <div style={{ fontSize: 11, color: "#64748b" }}>{row.phone}</div>
    </div>
  );
}