// EnrollmentClosed.jsx
import React from "react";
import { fmtDate } from "./helpers";

const EnrollmentClosed = ({ window_, onClose }) => {
  return (
    <div className="enrollment-container1">
      <div className="enrollment-closed">
        <div className="enrollment-closed__icon">🔒</div>
        <h2 className="enrollment-closed__title">Enrollment is Currently Closed</h2>
        <p className="enrollment-closed__subtitle">
          We are not accepting enrollment submissions at this time.
        </p>

        <div className="enrollment-closed__info">
          <div className="enrollment-closed__info-row">
            <span>📅 Last enrollment period</span>
            <strong>
              {fmtDate(window_.openDate)} – {fmtDate(window_.closeDate)}
            </strong>
          </div>

          <div className="enrollment-closed__info-row">
            <span>🗓 Next enrollment opens</span>
            <strong>{fmtDate(window_.nextOpenDate)}</strong>
          </div>
        </div>

        <p className="enrollment-closed__note">
          For concerns or late enrollment requests, please contact the school office directly.
        </p>

        {onClose && (
          <button className="enrollment-closed__btn" onClick={onClose}>
            Back to Home
          </button>
        )}
      </div>
    </div>
  );
};

export default EnrollmentClosed;