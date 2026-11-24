import React from "react";

export default function EnrollmentSection({ title, icon, full = false, children }) {
  return (
    <section
      className={`enrollment-details-section ${
        full ? "enrollment-details-section--full" : ""
      }`}
    >
      <div className="enrollment-details-section__header">
        <span>{icon}</span>
        <span className="enrollment-details-section__title">{title}</span>
      </div>
      <div className="enrollment-details-section__body">{children}</div>
    </section>
  );
}