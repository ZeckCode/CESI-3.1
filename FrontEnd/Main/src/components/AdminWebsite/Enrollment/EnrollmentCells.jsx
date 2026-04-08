import React from "react";

export function StudentCell({ row }) {
  return (
    <div className="cell-container student-cell">
      <div className="cell-main">{row.studentName}</div>
      <div className="cell-secondary">
        AY {row.academicYear || "—"} · {row.sectionName || "No section"}
      </div>
    </div>
  );
}

export function ParentCell({ row }) {
  return (
    <div className="cell-container parent-cell">
      <div className="cell-main">{row.parentName}</div>
      <div className="cell-secondary">{row.phone}</div>
    </div>
  );
}