import React from "react";
import "./EnrollmentConfirmationModal.css";

const EnrollmentConfirmationModal = ({ email, name, onClose }) => {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>✅ Enrollment Submitted!</h2>
        </div>
        <div className="modal-body">
          <p>Thank you, <strong>{name}</strong>!</p>
          <p>Your enrollment application has been successfully submitted.</p>
          
          <div className="reminder-box">
            <h3>📧 IMPORTANT REMINDER:</h3>
            <p>Please <strong>constantly check your email</strong> for updates regarding your enrollment status.</p>
            <p>We will notify you at:</p>
            <p className="email-highlight">{email}</p>
            <p>You will receive an email confirming whether your enrollment has been:</p>
            <ul>
              <li>✅ <strong>APPROVED</strong> - You may proceed with next steps</li>
              <li>❌ <strong>DECLINED</strong> - Please contact the registrar's office for assistance</li>
            </ul>
            <p className="reminder-note">⚠️ Check your SPAM/JUNK folder if you don't see our email within 3-5 business days.</p>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default EnrollmentConfirmationModal;