// StepPrivacy.jsx
import React from "react";

const StepPrivacy = ({ onNext }) => {
  return (
    <div className="step-card">
      <h3>🛡 Data Privacy Agreement</h3>
      <p className="info-text">
        I agree that the school may collect, process, and store the information I provide
        for enrollment, student records, communication, and related school transactions.
      </p>

      <div className="form-actions">
        <button type="button" onClick={onNext}>
          I Agree
        </button>
      </div>
    </div>
  );
};

export default StepPrivacy;