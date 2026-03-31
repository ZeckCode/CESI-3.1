import React from "react";

const StepConfirmation = ({ email, name, onClose }) => {
  return (
    <div className="step-confirmation">
      <div className="confirmation-header">
        <div className="success-icon">✅</div>
        <h2>Enrollment Submitted Successfully!</h2>
      </div>
      
      <div className="confirmation-body">
        <p>Thank you, <strong>{name}</strong>!</p>
        <p>Your enrollment application has been successfully submitted.</p>
        
        <div className="reminder-box">
          <h3>📧 IMPORTANT REMINDER:</h3>
          <p>Please <strong>constantly check your email</strong> for updates regarding your enrollment status.</p>
          <p>We will notify you at:</p>
          <div className="email-highlight">{email}</div>
          <p>You will receive an email confirming whether your enrollment has been:</p>
          <ul>
            <li>✅ <strong>APPROVED</strong> - You may proceed with next steps</li>
            <li>❌ <strong>DECLINED</strong> - Please contact the registrar's office for assistance</li>
          </ul>
          <div className="reminder-note">
            ⚠️ Check your SPAM/JUNK folder if you don't see our email within 3-5 business days.
          </div>
        </div>
      </div>
      
      <div className="confirmation-footer">
        <button onClick={onClose} className="close-btn">
          Close
        </button>
      </div>
    </div>
  );
};

export default StepConfirmation;