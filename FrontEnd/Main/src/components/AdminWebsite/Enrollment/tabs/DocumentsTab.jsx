import React from "react";
import { Paperclip, ExternalLink, Edit2, Trash2 } from "lucide-react";

export default function DocumentsTab({
  currentDocs,
  docUploadType,
  docUploadLabel,
  docSaving,
  editingDocId,
  editingDocLabel,
  editingDocType,
  isReadOnly,
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
