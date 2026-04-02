import React from "react";
import { Paperclip, ExternalLink, Edit2, Trash2 } from "lucide-react";

export default function DocumentsTab({
  currentDocs,
  paymentProof,
  docUploadType,
  docUploadLabel,
  docSaving,
  editingDocId,
  editingDocLabel,
  editingDocType,
  isReadOnly,
  studentPhoto,
  onOpenIdUploadModal,
  setDocUploadType,
  setDocUploadLabel,
  setDocUploadFile,
  setEditingDocLabel,
  setEditingDocType,
  setEditingDocFile,
  onUploadDocument,
  onStartEditDocument,
  onCancelEditDocument,
  onUpdateDocument,
  onDeleteDocument,
  DOCUMENT_TYPE_OPTIONS,
}) {
  return (
    <div className="tab-content-scroll">
      {/* Submitted 2x2 Photo Section */}
      {studentPhoto && (
        <div className="tab-section" style={{ background: "#ecfdf5", borderLeft: "4px solid #10b981" }}>
          <div className="tab-section-title">
            <span className="section-icon">📷</span>
            Submitted Student Photo (2x2)
          </div>

          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <img
                src={studentPhoto}
                alt="Student 2x2 Photo"
                style={{
                  maxWidth: "100%",
                  maxHeight: 200,
                  borderRadius: 8,
                  border: "2px solid #10b981",
                }}
              />
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 12, color: "#059669", fontWeight: 600 }}>
                ✓ Ready for ID
              </div>
              <p style={{ fontSize: 13, color: "#047857", margin: 0 }}>
                Student submitted their 2x2 photo during enrollment. Use for student ID photo?
              </p>
              {!isReadOnly && (
                <button
                  className="btn-primary"
                  onClick={onOpenIdUploadModal}
                  style={{ background: "#10b981", borderColor: "#059669", width: "fit-content" }}
                >
                  Use As ID Photo
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add New Document Section */}
      {!isReadOnly && (
        <div className="tab-section">
          <div className="tab-section-title">
            <span className="section-icon">📤</span>
            Add New Document
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Document Type</label>
              <select
                value={docUploadType}
                onChange={(e) => setDocUploadType(e.target.value)}
              >
                {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Custom Label (Optional)</label>
              <input
                value={docUploadLabel}
                onChange={(e) => setDocUploadLabel(e.target.value)}
                placeholder="e.g., Barangay Clearance 2024"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Choose File</label>
            <input
              type="file"
              onChange={(e) => setDocUploadFile(e.target.files?.[0] || null)}
              accept="image/*,.pdf,.doc,.docx"
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              className="btn-primary"
              onClick={onUploadDocument}
              disabled={docSaving}
            >
              {docSaving ? "Uploading..." : "Upload Document"}
            </button>
          </div>
        </div>
      )}

      {/* Payment Proof Section */}
      {paymentProof && (
        <div className="tab-section">
          <div className="tab-section-title">
            <span className="section-icon">💳</span>
            Payment Proof
          </div>

          <div className="documents-grid">
            <div className="document-card">
              <div className="document-card-view">
                <div className="document-card-header">
                  <div className="document-card-title">
                    Proof of Payment
                  </div>
                  <div className="document-card-type">
                    Payment Receipt
                  </div>
                </div>

                <div style={{ marginTop: 12, marginBottom: 12 }}>
                  {paymentProof.proof_image_url ? (
                    <img
                      src={paymentProof.proof_image_url}
                      alt="Payment proof"
                      style={{
                        maxWidth: "100%",
                        maxHeight: 300,
                        borderRadius: 6,
                        border: "1px solid #e2e8f0",
                        cursor: "pointer",
                      }}
                      onClick={() => window.open(paymentProof.proof_image_url, '_blank')}
                      title="Click to view full size"
                    />
                  ) : (
                    <div
                      style={{
                        padding: 40,
                        background: "#f1f5f9",
                        borderRadius: 6,
                        textAlign: "center",
                        color: "#94a3b8",
                        fontSize: 13,
                      }}
                    >
                      No image available
                    </div>
                  )}
                </div>

                <div className="document-card-actions">
                  {paymentProof.proof_image_url && (
                    <a
                      href={paymentProof.proof_image_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-document-link"
                    >
                      <ExternalLink size={14} />
                      Open Full Size
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Documents List */}
      <div className="tab-section">
        <div className="tab-section-title">
          <span className="section-icon">📎</span>
          Submitted Documents
          {currentDocs.length > 0 && (
            <span className="doc-count">{currentDocs.length}</span>
          )}
        </div>

        <div className="documents-grid">
          {currentDocs.length ? (
            currentDocs.map((doc) => (
              <div key={doc.id} className="document-card">
                {editingDocId === doc.id ? (
                  // Edit Mode
                  <div className="document-card-edit">
                    <div className="form-group">
                      <label>Document Type</label>
                      <select
                        value={editingDocType}
                        onChange={(e) => setEditingDocType(e.target.value)}
                      >
                        {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Label</label>
                      <input
                        value={editingDocLabel}
                        onChange={(e) => setEditingDocLabel(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label>Replace File</label>
                      <input
                        type="file"
                        onChange={(e) =>
                          setEditingDocFile(e.target.files?.[0] || null)
                        }
                      />
                    </div>

                    <div className="document-card-actions">
                      <button
                        className="btn-primary"
                        onClick={onUpdateDocument}
                        disabled={docSaving}
                      >
                        {docSaving ? "Saving..." : "Save Changes"}
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={onCancelEditDocument}
                        disabled={docSaving}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div className="document-card-view">
                    <div className="document-card-header">
                      <div className="document-card-title">
                        {doc.label || doc.document_type}
                      </div>
                      <div className="document-card-type">
                        {DOCUMENT_TYPE_OPTIONS.find(
                          (x) => x.value === doc.document_type
                        )?.label || doc.document_type}
                      </div>
                    </div>

                    <div className="document-card-actions">
                      <a
                        href={doc.file}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-document-link"
                      >
                        <Paperclip size={14} />
                        View File
                        <ExternalLink size={14} />
                      </a>

                      {!isReadOnly && (
                        <>
                          <button
                            className="btn-edit"
                            onClick={() => onStartEditDocument(doc)}
                            title="Edit document"
                          >
                            <Edit2 size={14} />
                          </button>

                          <button
                            className="btn-delete"
                            onClick={() => onDeleteDocument(doc.id)}
                            title="Delete document"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📄</div>
              <div className="empty-state-text">
                No documents submitted yet
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
