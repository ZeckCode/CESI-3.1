// StepPrivacy.jsx
import React, { useState } from "react";

const StepPrivacy = ({ onNext }) => {
  const [understood, setUnderstood] = useState(false);

  return (
    <div className="step-card">
      <h3>🛡 Data Privacy Agreement</h3>
      <p className="info-text">
        In accordance with the Data Privacy Act of 2012 (Republic Act No. 10173),
        I understand and agree that the school may collect, record, organize, store,
        update, use, and process the personal information and documents I provide.
      </p>
      <p className="info-text">
        This information will be used to evaluate and process enrollment, maintain
        accurate student records, communicate with the student or authorized parent or
        guardian, comply with legal requirements, and provide related school services.
        The school will keep the information only for as long as necessary for these
        purposes and will apply reasonable organizational, physical, and technical
        safeguards to protect it.
      </p>
      <p className="info-text">
        I understand that I may request access to or correction of my personal
        information and may raise privacy concerns through the school. I understand
        that withholding information required for enrollment may prevent the school
        from processing my application.
      </p>

      <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 16 }}>
        <input
          type="checkbox"
          checked={understood}
          onChange={(e) => setUnderstood(e.target.checked)}
          style={{ marginTop: 3 }}
        />
        <span>
          I confirm that I have read and understood this Data Privacy Agreement and
          consent to the collection and processing of my information for the purposes
          stated above.
        </span>
      </label>

      <div className="form-actions">
        <button type="button" onClick={onNext} disabled={!understood}>
          Continue
        </button>
      </div>
    </div>
  );
};

export default StepPrivacy;