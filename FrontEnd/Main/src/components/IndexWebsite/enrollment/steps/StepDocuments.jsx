import React from "react";
import FieldError from "../FieldError";

const StepDocuments = ({ files, setFiles, errors, registerFieldRef }) => {
  const handleFileChange = (key) => (e) => {
    const file = e.target.files?.[0] || null;
    setFiles((prev) => ({
      ...prev,
      [key]: file,
    }));
  };

  return (
    <>
      <h3>📎 Documents</h3>
      <p className="info-text">
        Upload the required student photo and any available supporting documents.
      </p>

      <div className="form-grid">
        <div className="form-group">
          <label>
            Upload 2x2 Picture <span className="required">*</span>
          </label>
          <input
            ref={registerFieldRef("studentPhotoFile")}
            type="file"
            accept=".jpg,.jpeg,.png"
            onChange={handleFileChange("studentPhotoFile")}
          />
          {files.studentPhotoFile && (
            <div className="file-name">{files.studentPhotoFile.name}</div>
          )}
          <FieldError error={errors.studentPhotoFile} />
        </div>

        <div className="form-group">
          <label>Form 137-E</label>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={handleFileChange("form137File")}
          />
          {files.form137File && <div className="file-name">{files.form137File.name}</div>}
        </div>

        <div className="form-group">
          <label>School Form 10 (SF10)</label>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={handleFileChange("sf10File")}
          />
          {files.sf10File && <div className="file-name">{files.sf10File.name}</div>}
        </div>

        <div className="form-group">
          <label>Birth Certificate</label>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={handleFileChange("birthCertificateFile")}
          />
          {files.birthCertificateFile && (
            <div className="file-name">{files.birthCertificateFile.name}</div>
          )}
        </div>

        <div className="form-group">
          <label>Good Moral Certificate</label>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={handleFileChange("goodMoralFile")}
          />
          {files.goodMoralFile && <div className="file-name">{files.goodMoralFile.name}</div>}
        </div>

        <div className="form-group">
          <label>Report Card</label>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={handleFileChange("reportCardFile")}
          />
          {files.reportCardFile && <div className="file-name">{files.reportCardFile.name}</div>}
        </div>

        <div className="form-group">
          <label>Other Document</label>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={handleFileChange("otherDocumentFile")}
          />
          {files.otherDocumentFile && (
            <div className="file-name">{files.otherDocumentFile.name}</div>
          )}
        </div>
      </div>
    </>
  );
};

export default StepDocuments;