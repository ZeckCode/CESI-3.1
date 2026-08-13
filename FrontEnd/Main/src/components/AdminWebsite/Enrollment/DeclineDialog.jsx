import React from "react";
import { X } from "lucide-react";

export default function DeclineDialog({
  declineDialogOpen,
  declineSubmitting,
  declineReason,
  targetName,
  onClose,
  onChangeReason,
  onConfirm,
}) {
  if (!declineDialogOpen) return null;

  return (
    <div
      className="modal-overlay enrollment-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-content" style={{ maxWidth: 520, width: "92vw" }}>
        <div className="enrollment-modal-header">
          <div className="enrollment-modal-title-wrap">
            <h2>Confirm Decline — {targetName}</h2>
            <div className="enrollment-modal-subtitle">
              Please provide the reason or remark for declining this enrollment.
            </div>
          </div>

          <button
            type="button"
            className="enrollment-modal-close"
            onClick={onClose}
            disabled={declineSubmitting}
          >
            <X size={18} />
          </button>
        </div>

        <div className="form-group" style={{ marginTop: 10 }}>
          <label>Reason / Remark *</label>
          <textarea
            value={declineReason}
            onChange={(e) => onChangeReason(e.target.value)}
            placeholder="Enter reason for declining this enrollment..."
            rows={5}
            disabled={declineSubmitting}
            style={{
              width: "100%",
              resize: "vertical",
              borderRadius: 10,
              border: "1px solid #d1d5db",
              padding: "12px 14px",
              fontSize: 14,
              outline: "none",
            }}
          />
        </div>

        <div
          style={{
            marginTop: 12,
            padding: "12px 14px",
            borderRadius: 12,
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            color: "#9a3412",
            fontSize: 13,
          }}
        >
          This will mark the enrollment as <strong>Declined</strong> and send the
          reason to the student/guardian email.
        </div>

        <div className="form-actions" style={{ marginTop: 18 }}>
          <button
            className="btn-secondary"
            onClick={onClose}
            disabled={declineSubmitting}
          >
            Cancel
          </button>

          <button
            className="btn-decline"
            onClick={onConfirm}
            disabled={declineSubmitting}
          >
            {declineSubmitting ? "Declining..." : "Confirm Decline"}
          </button>
        </div>
      </div>
    </div>
  );
}