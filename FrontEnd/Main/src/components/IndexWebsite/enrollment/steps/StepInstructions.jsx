import React from "react";

const StepInstructions = ({ onNext, onBack }) => {
  return (
    <div className="step-card">
      <h3>📋 Instructions Before Proceeding</h3>

      <div className="info-text">
        <p>Please prepare the following before filling out the enrollment form:</p>
        <ul>
          <li>Complete student information</li>
          <li>Parent / guardian contact details</li>
          <li>2x2 student picture</li>
          <li>Payment details</li>
          <li>Proof of payment if using online payment</li>
        </ul>
      </div>

      <div className="form-actions">
        <button type="button" className="secondary" onClick={onBack}>
          Back
        </button>
        <button type="button" onClick={onNext}>
          I Understand
        </button>
      </div>
    </div>
  );
};

export default StepInstructions;