import React from "react";
import { X } from "lucide-react";

export default function IdUploadModal({
  idUploadOpen,
  idUploadPreview,
  idUploading,
  onClose,
  onSelectImage,
  onClearImage,
  onUpload,
}) {
  if (!idUploadOpen) return null;

  return (
    <div
      className="modal-overlay enrollment-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-content" style={{ maxWidth: 460, width: "92vw" }}>
        <div className="enrollment-modal-header">
          <div className="enrollment-modal-title-wrap">
            <h2>Upload Student 1x1 Image</h2>
            <div className="enrollment-modal-subtitle">
              Upload or replace the student's 1x1 image after enrollment approval.
            </div>
          </div>

          <button
            type="button"
            className="enrollment-modal-close"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {idUploadPreview ? (
          <div style={{ marginBottom: 20, textAlign: "center" }}>
            <img
              src={idUploadPreview}
              alt="ID Preview"
              style={{ maxWidth: "100%", maxHeight: 300, borderRadius: 12 }}
            />
            <div style={{ marginTop: 12 }}>
              <button className="btn-secondary" onClick={onClearImage}>
                Remove
              </button>
            </div>
          </div>
        ) : (
          <label
            style={{
              display: "block",
              border: "2px dashed #d1d5db",
              borderRadius: 14,
              padding: 30,
              textAlign: "center",
              cursor: "pointer",
              background: "#f9fafb",
              marginBottom: 20,
            }}
          >
            <input
              type="file"
              accept="image/*"
              onChange={onSelectImage}
              style={{ display: "none" }}
            />
            <div style={{ fontSize: 28, marginBottom: 8 }}>📸</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
              Click to upload student 1x1 image
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
              PNG, JPG up to 5MB
            </div>
          </label>
        )}

        <div className="form-actions">
          <button className="btn-secondary" onClick={onClose} disabled={idUploading}>
            Cancel
          </button>
          <button className="btn-primary" onClick={onUpload} disabled={idUploading || !idUploadPreview}>
            {idUploading ? "Uploading..." : "Upload ID"}
          </button>
        </div>
      </div>
    </div>
  );
}