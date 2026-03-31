import React from "react";
import { CheckCircle, Edit2, Paperclip, ExternalLink, Trash2, XCircle, X } from "lucide-react";
import EnrollmentSection from "./EnrollmentSection";

export default function EnrollmentDetailsModal({
  modalOpen,
  editingId,
  modalMode,
  formData,
  modalStatus,
  isReadOnly,
  sectionsLoading,
  filteredSections,
  gradeOptions,
  currentDocs,
  docUploadType,
  docUploadLabel,
  docSaving,
  editingDocId,
  editingDocLabel,
  editingDocType,
  setDocUploadType,
  setDocUploadLabel,
  setDocUploadFile,
  setEditingDocLabel,
  setEditingDocType,
  setEditingDocFile,
  onClose,
  onInputChange,
  onParentChange,
  onApprove,
  onDecline,
  onSaveEnrollment,
  onUploadDocument,
  onStartEditDocument,
  onCancelEditDocument,
  onUpdateDocument,
  onDeleteDocument,
  calcAge,
  todayISO,
  gradeLabel,
  validateAgeForGrade,
  DOCUMENT_TYPE_OPTIONS,
  GRADE_AGE_RULES,
}) {
  if (!modalOpen) return null;

  return (
    <div className="modal-overlay enrollment-modal-overlay">
      <div className="modal-content enrollment-modal-content enrollment-modal-content--details">
        <div className="enrollment-modal-header">
          <div className="enrollment-modal-title-wrap">
            <h2>
              {editingId
                ? `${formData.first_name || "Student"} ${formData.last_name || ""}`.trim()
                : formData.student_type === "old" && formData.grade_level
                ? `Promotion Enrollment — ${gradeLabel(formData.grade_level)}`
                : "New Enrollment Record"}
            </h2>
          </div>

          <button type="button" className="enrollment-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Expired modal note removed */}

        {!editingId && formData.student_type === "old" && formData.grade_level && (
          <div className="enrollment-soft-note" style={{ marginBottom: 18 }}>
            <strong>Promotion Enrollment.</strong> Creating a new enrollment for{" "}
            <strong>
              {formData.first_name} {formData.last_name}
            </strong>{" "}
            — promoted to <strong>{gradeLabel(formData.grade_level)}</strong> for AY{" "}
            <strong>{formData.academic_year}</strong>.
          </div>
        )}

        <div className="enrollment-modal-grid">
          <EnrollmentSection title="Academic Information" icon="🎓">
            <div className="form-row">
              <div className="form-group">
                <label>
                  LRN{" "}
                  {[
                    "kinder",
                    "grade1",
                    "grade2",
                    "grade3",
                    "grade4",
                    "grade5",
                    "grade6",
                  ].includes(formData.grade_level) && (
                    <span style={{ color: "#dc2626" }}>*</span>
                  )}
                </label>
                <input
                  name="lrn"
                  value={formData.lrn}
                  onChange={(e) => {
                    const numericValue = e.target.value.replace(/\D/g, "");
                    onInputChange({
                      target: {
                        name: "lrn",
                        value: numericValue.slice(0, 12),
                      },
                    });
                  }}
                  disabled={isReadOnly}
                  maxLength="12"
                  inputMode="numeric"
                  placeholder="12 digits for Kinder-Grade 6"
                />
              </div>

              <div className="form-group">
                <label>Student Type *</label>
                <select
                  name="student_type"
                  value={formData.student_type}
                  onChange={onInputChange}
                  disabled={isReadOnly}
                >
                  <option value="">Select</option>
                  <option value="new">New / Transferee</option>
                  <option value="old">Old Student</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Education Level *</label>
                <select
                  name="education_level"
                  value={formData.education_level}
                  onChange={onInputChange}
                  disabled={isReadOnly}
                >
                  <option value="">Select</option>
                  <option value="preschool">Preschool</option>
                  <option value="elementary">Elementary</option>
                </select>
              </div>

              <div className="form-group">
                <label>Grade Level *</label>
                <select
                  name="grade_level"
                  value={formData.grade_level}
                  onChange={onInputChange}
                  disabled={isReadOnly || !formData.education_level}
                >
                  <option value="">Select</option>
                  {gradeOptions.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label} (age {GRADE_AGE_RULES[g.value]?.min}–
                      {GRADE_AGE_RULES[g.value]?.max})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Section / Room</label>
                <select
                  name="section"
                  value={formData.section}
                  onChange={onInputChange}
                  disabled={isReadOnly || sectionsLoading}
                >
                  <option value="">
                    {sectionsLoading ? "Loading sections..." : "Optional"}
                  </option>
                  {filteredSections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name || s.section_name || `Section ${s.id}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Academic Year *</label>
                <input
                  name="academic_year"
                  value={formData.academic_year}
                  onChange={onInputChange}
                  disabled={isReadOnly}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={onInputChange}
                disabled={isReadOnly}
              >
                <option value="PENDING">Pending</option>
                <option value="ACTIVE">Enrolled</option>
                <option value="DROPPED">Dropped</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
          </EnrollmentSection>

          <EnrollmentSection title="Student Information" icon="👤">
            <div className="form-row">
              <div className="form-group">
                <label>Last Name *</label>
                <input
                  name="last_name"
                  value={formData.last_name}
                  onChange={onInputChange}
                  disabled={isReadOnly}
                />
              </div>
              <div className="form-group">
                <label>First Name *</label>
                <input
                  name="first_name"
                  value={formData.first_name}
                  onChange={onInputChange}
                  disabled={isReadOnly}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Middle Name</label>
                <input
                  name="middle_name"
                  value={formData.middle_name}
                  onChange={onInputChange}
                  disabled={isReadOnly}
                />
              </div>
              <div className="form-group">
                <label>Birth Date</label>
                <input
                  type="date"
                  name="birth_date"
                  value={formData.birth_date || ""}
                  onChange={onInputChange}
                  disabled={isReadOnly}
                  max={todayISO()}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Gender</label>
              <select
                name="gender"
                value={formData.gender}
                onChange={onInputChange}
                disabled={isReadOnly}
              >
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            {formData.birth_date && formData.grade_level && !isReadOnly && (() => {
              const check = validateAgeForGrade(formData.birth_date, formData.grade_level);
              const age = calcAge(formData.birth_date);
              const rule = GRADE_AGE_RULES[formData.grade_level];

              return (
                <div
                  className={check === true ? "enrollment-soft-note" : "enrollment-highlight-note"}
                >
                  {check === true ? (
                    <>
                      Age {age} is valid for {rule?.label} (allowed: {rule?.min}–
                      {rule?.max} yrs)
                    </>
                  ) : (
                    <>{check}</>
                  )}
                </div>
              );
            })()}
          </EnrollmentSection>

          <EnrollmentSection title="Contact Information" icon="📞">
            <div className="form-row">
              <div className="form-group">
                <label>Email</label>
                <input
                  name="email"
                  value={formData.email}
                  onChange={onInputChange}
                  disabled={isReadOnly}
                />
              </div>
              <div className="form-group">
                <label>Religion</label>
                <input
                  name="religion"
                  value={formData.religion}
                  onChange={onInputChange}
                  disabled={isReadOnly}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Telephone</label>
                <input
                  name="telephone_number"
                  value={formData.telephone_number}
                  onChange={onInputChange}
                  disabled={isReadOnly}
                />
              </div>
              <div className="form-group">
                <label>Mobile</label>
                <input
                  name="mobile_number"
                  value={formData.mobile_number}
                  onChange={onInputChange}
                  disabled={isReadOnly}
                  placeholder="09XXXXXXXXX or +639XXXXXXXXX"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Parent Facebook</label>
              <input
                name="parent_facebook"
                value={formData.parent_facebook}
                onChange={onInputChange}
                disabled={isReadOnly}
                placeholder="Facebook profile link"
              />
            </div>
          </EnrollmentSection>

          <EnrollmentSection title="Address" icon="📍">
            <div className="form-group form-group--full">
              <label>House No. / Street</label>
              <input
                name="street"
                value={formData.street}
                onChange={onInputChange}
                disabled={isReadOnly}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Barangay</label>
                <input
                  name="barangay"
                  value={formData.barangay}
                  onChange={onInputChange}
                  disabled={isReadOnly}
                />
              </div>
              <div className="form-group">
                <label>City / Municipality</label>
                <input
                  name="city"
                  value={formData.city}
                  onChange={onInputChange}
                  disabled={isReadOnly}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Province</label>
                <input
                  name="province"
                  value={formData.province}
                  onChange={onInputChange}
                  disabled={isReadOnly}
                />
              </div>
              <div className="form-group">
                <label>Region</label>
                <input
                  name="region"
                  value={formData.region}
                  onChange={onInputChange}
                  disabled={isReadOnly}
                />
              </div>
            </div>

            <div className="form-group">
              <label>ZIP Code</label>
              <input
                name="zip_code"
                value={formData.zip_code}
                onChange={onInputChange}
                disabled={isReadOnly}
              />
            </div>
          </EnrollmentSection>

          <EnrollmentSection title="Parent / Guardian Information" icon="👨‍👩‍👧" full>
            <div>
              <p className="parent-section-label">Mother</p>
              <div className="form-row">
                <div className="form-group">
                  <label>First Name</label>
                  <input
                    name="mother_first"
                    value={formData.parent_info.mother_first}
                    onChange={onParentChange}
                    disabled={isReadOnly}
                  />
                </div>
                <div className="form-group">
                  <label>Middle Name</label>
                  <input
                    name="mother_middle"
                    value={formData.parent_info.mother_middle}
                    onChange={onParentChange}
                    disabled={isReadOnly}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Last Name</label>
                  <input
                    name="mother_last"
                    value={formData.parent_info.mother_last}
                    onChange={onParentChange}
                    disabled={isReadOnly}
                  />
                </div>
                <div className="form-group">
                  <label>Contact Number</label>
                  <input
                    name="mother_contact"
                    value={formData.parent_info.mother_contact}
                    onChange={onParentChange}
                    disabled={isReadOnly}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Occupation</label>
                <input
                  name="mother_occupation"
                  value={formData.parent_info.mother_occupation}
                  onChange={onParentChange}
                  disabled={isReadOnly}
                />
              </div>
            </div>

            <div>
              <p className="parent-section-label">Father</p>
              <div className="form-row">
                <div className="form-group">
                  <label>First Name</label>
                  <input
                    name="father_first"
                    value={formData.parent_info.father_first}
                    onChange={onParentChange}
                    disabled={isReadOnly}
                  />
                </div>
                <div className="form-group">
                  <label>Middle Name</label>
                  <input
                    name="father_middle"
                    value={formData.parent_info.father_middle}
                    onChange={onParentChange}
                    disabled={isReadOnly}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Last Name</label>
                  <input
                    name="father_last"
                    value={formData.parent_info.father_last}
                    onChange={onParentChange}
                    disabled={isReadOnly}
                  />
                </div>
                <div className="form-group">
                  <label>Contact Number</label>
                  <input
                    name="father_contact"
                    value={formData.parent_info.father_contact}
                    onChange={onParentChange}
                    disabled={isReadOnly}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Occupation</label>
                <input
                  name="father_occupation"
                  value={formData.parent_info.father_occupation}
                  onChange={onParentChange}
                  disabled={isReadOnly}
                />
              </div>
            </div>

            <div className="enrollment-divider-space" />

            <p className="parent-section-label">
              Guardian{" "}
              <span style={{ fontWeight: 400, color: "#9ca3af" }}>(if applicable)</span>
            </p>

            <div className="form-row">
              <div className="form-group">
                <label>First Name</label>
                <input
                  name="guardian_first"
                  value={formData.parent_info.guardian_first}
                  onChange={onParentChange}
                  disabled={isReadOnly}
                />
              </div>
              <div className="form-group">
                <label>Middle Name</label>
                <input
                  name="guardian_middle"
                  value={formData.parent_info.guardian_middle}
                  onChange={onParentChange}
                  disabled={isReadOnly}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Last Name</label>
                <input
                  name="guardian_last"
                  value={formData.parent_info.guardian_last}
                  onChange={onParentChange}
                  disabled={isReadOnly}
                />
              </div>
              <div className="form-group">
                <label>Contact Number</label>
                <input
                  name="guardian_contact"
                  value={formData.parent_info.guardian_contact}
                  onChange={onParentChange}
                  disabled={isReadOnly}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Relationship to Student</label>
              <input
                name="guardian_relationship"
                value={formData.parent_info.guardian_relationship}
                onChange={onParentChange}
                disabled={isReadOnly}
              />
            </div>
          </EnrollmentSection>

          <EnrollmentSection title="Payment Information" icon="💰" full>
            <div className="form-row">
              <div className="form-group">
                <label>Payment Mode *</label>
                <select
                  name="payment_mode"
                  value={formData.payment_mode}
                  onChange={onInputChange}
                  disabled={isReadOnly}
                >
                  <option value="">Select</option>
                  <option value="cash">Cash</option>
                  <option value="installment">Installment</option>
                </select>
              </div>

              <div className="form-group">
                <label>Remarks</label>
                <input
                  name="remarks"
                  value={formData.remarks}
                  onChange={onInputChange}
                  disabled={isReadOnly}
                />
              </div>
            </div>
          </EnrollmentSection>

          <EnrollmentSection title="Submitted Documents" icon="📎" full>
            <div className="enrollment-documents-wrap enrollment-new-documents-space">
              <div className="enrollment-documents-intro">
                Admin can review, upload, replace, relabel, or remove documents for
                this enrollment.
              </div>

              <div
                style={{
                  marginBottom: 18,
                  padding: 14,
                  border: "1px solid #e5eaf2",
                  borderRadius: 14,
                  background: "#f8fbff",
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 13 }}>
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
                    <label>Label</label>
                    <input
                      value={docUploadLabel}
                      onChange={(e) => setDocUploadLabel(e.target.value)}
                      placeholder="Optional custom label"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Choose File</label>
                  <input
                    type="file"
                    onChange={(e) => setDocUploadFile(e.target.files?.[0] || null)}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    className="btn-primary"
                    onClick={onUploadDocument}
                    disabled={docSaving}
                  >
                    {docSaving ? "Saving..." : "Upload Document"}
                  </button>
                </div>
              </div>

              <div className="enrollment-documents-grid">
                {currentDocs.length ? (
                  currentDocs.map((doc) => (
                    <div key={doc.id} className="enrollment-document-card">
                      {editingDocId === doc.id ? (
                        <>
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

                          <div className="enrollment-document-card__actions">
                            <button
                              className="btn-primary"
                              onClick={onUpdateDocument}
                              disabled={docSaving}
                            >
                              Save
                            </button>
                            <button
                              className="btn-secondary"
                              onClick={onCancelEditDocument}
                              disabled={docSaving}
                            >
                              Cancel
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="enrollment-document-card__type">
                            {doc.label || doc.document_type}
                          </div>

                          <div className="enrollment-document-card__meta">
                            {DOCUMENT_TYPE_OPTIONS.find(
                              (x) => x.value === doc.document_type
                            )?.label || doc.document_type}
                          </div>

                          <div className="enrollment-document-card__actions">
                            <a
                              href={doc.file}
                              target="_blank"
                              rel="noreferrer"
                              className="enrollment-document-link"
                            >
                              <Paperclip size={12} />
                              View
                              <ExternalLink size={12} />
                            </a>

                            <button
                              className="btn-edit"
                              onClick={() => onStartEditDocument(doc)}
                            >
                              <Edit2 size={14} />
                            </button>

                            <button
                              className="btn-delete"
                              onClick={() => onDeleteDocument(doc.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="enrollment-soft-note">
                    No documents submitted for this enrollment.
                  </div>
                )}
              </div>
            </div>
          </EnrollmentSection>
        </div>

        <div className="form-actions">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>

          {editingId && modalStatus === "PENDING" && (
            <>
              <button className="btn-approve" onClick={onApprove}>
                <CheckCircle size={13} /> Approve
              </button>
              <button className="btn-decline" onClick={onDecline}>
                <XCircle size={13} /> Decline
              </button>
            </>
          )}

          {modalMode === "edit" && (
            <button className="btn-primary" onClick={onSaveEnrollment}>
              {editingId ? "Save Changes" : "Create Enrollee"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}