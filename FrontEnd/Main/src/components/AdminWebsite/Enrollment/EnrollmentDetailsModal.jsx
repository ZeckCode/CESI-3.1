import React, { useState } from "react";
import { X, Edit2, CheckCircle, XCircle } from "lucide-react";
import StudentInfoTab from "./tabs/StudentInfoTab";
import ParentInfoTab from "./tabs/ParentInfoTab";
import DocumentsTab from "./tabs/DocumentsTab";
import "../../../styles/EnrollmentDetailsModal.css";

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
  paymentProof,
  lockImportantFields,
  studentPhoto,
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
  onEnterEditMode,
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
  onOpenIdUploadModal,
  calcAge,
  todayISO,
  gradeLabel,
  validateAgeForGrade,
  DOCUMENT_TYPE_OPTIONS,
  GRADE_AGE_RULES,
}) {
  const [activeTab, setActiveTab] = useState("student");

  if (!modalOpen) return null;

  const studentName = editingId
    ? `${formData.first_name || "Student"} ${formData.last_name || ""}`.trim()
    : "View Student Info";

  return (
    <div className="modal-overlay enrollment-modal-overlay">
      <div className="modal-content enrollment-details-modal-content">
        {/* Header */}
        <div className="enrollment-details-header">
          <div className="enrollment-details-title-wrap">
            <h2>{studentName}</h2>
          </div>

          <div className="enrollment-details-actions">
            {isReadOnly && (
              <button
                className="btn-header-icon"
                onClick={onEnterEditMode}
                title="Edit information"
              >
                <Edit2 size={18} />
              </button>
            )}
            <button
              className="btn-header-icon btn-close"
              onClick={onClose}
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="enrollment-details-tabs">
          <button
            className={`tab-button ${activeTab === "student" ? "active" : ""}`}
            onClick={() => setActiveTab("student")}
          >
            Student Info
          </button>
          <button
            className={`tab-button ${activeTab === "parent" ? "active" : ""}`}
            onClick={() => setActiveTab("parent")}
          >
            Parent Info
          </button>
          <button
            className={`tab-button ${activeTab === "documents" ? "active" : ""}`}
            onClick={() => setActiveTab("documents")}
          >
            Documents
          </button>
        </div>

        {/* Tab Content */}
        <div className="enrollment-details-content">
          {activeTab === "student" && (
            <StudentInfoTab
              formData={formData}
              isReadOnly={isReadOnly}
              lockImportantFields={lockImportantFields}
              modalMode={modalMode}
              onInputChange={onInputChange}
              gradeOptions={gradeOptions}
              filteredSections={filteredSections}
              sectionsLoading={sectionsLoading}
              calcAge={calcAge}
              todayISO={todayISO}
              gradeLabel={gradeLabel}
              validateAgeForGrade={validateAgeForGrade}
              GRADE_AGE_RULES={GRADE_AGE_RULES}
            />
          )}

          {activeTab === "parent" && (
            <ParentInfoTab
              formData={formData}
              isReadOnly={isReadOnly}
              modalMode={modalMode}
              onParentChange={onParentChange}
            />
          )}

          {activeTab === "documents" && (
            <DocumentsTab
              currentDocs={currentDocs}
              paymentProof={paymentProof}
              studentPhoto={studentPhoto}
              docUploadType={docUploadType}
              docUploadLabel={docUploadLabel}
              docSaving={docSaving}
              editingDocId={editingDocId}
              editingDocLabel={editingDocLabel}
              editingDocType={editingDocType}
              isReadOnly={isReadOnly}
              setDocUploadType={setDocUploadType}
              setDocUploadLabel={setDocUploadLabel}
              setDocUploadFile={setDocUploadFile}
              setEditingDocLabel={setEditingDocLabel}
              setEditingDocType={setEditingDocType}
              setEditingDocFile={setEditingDocFile}
              onUploadDocument={onUploadDocument}
              onStartEditDocument={onStartEditDocument}
              onCancelEditDocument={onCancelEditDocument}
              onUpdateDocument={onUpdateDocument}
              onDeleteDocument={onDeleteDocument}
              onOpenIdUploadModal={onOpenIdUploadModal}
              DOCUMENT_TYPE_OPTIONS={DOCUMENT_TYPE_OPTIONS}
            />
          )}
        </div>

        {/* Footer Actions */}
        {!isReadOnly && modalMode === "edit" && (
          <div className="enrollment-details-footer">
            <button className="btn-secondary" onClick={onClose}>
              Cancel
            </button>

            {editingId && modalStatus === "PENDING" && (
              <>
                <button className="btn-decline" onClick={onDecline}>
                  <XCircle size={14} />
                  Decline
                </button>
                <button className="btn-approve" onClick={onApprove}>
                  <CheckCircle size={14} />
                  Approve
                </button>
              </>
            )}

            <button className="btn-primary" onClick={onSaveEnrollment}>
              {editingId ? "Save Changes" : "Create Enrollee"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}