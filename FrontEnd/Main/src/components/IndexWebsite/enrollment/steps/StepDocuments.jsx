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
        Upload the required student photo and any available supporting documents. Max file size is 5MB. Accepted formats: PDF, JPG, JPEG, PNG, DOC, DOCX.
      </p>

      <div className="form-grid">
        <div className="form-group">
          <label>
            Upload 1x1 Picture <span className="required">*</span>
          </label>
          <span style={{ fontSize: '12px', color: '#64748b', marginBottom: 4 }}>
            Upload a <b>1x1 ID photo</b> taken within the last 6 months, with a <b>white or transparent background</b>.
          </span>
          <input
            id="studentPhotoFile"
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
            id="form137File"
            ref={registerFieldRef("form137File")}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={handleFileChange("form137File")}
          />
          {files.form137File && <div className="file-name">{files.form137File.name}</div>}
          <FieldError error={errors.form137File} />
        </div>

        <div className="form-group">
          <label>School Form 10 (SF10)</label>
          <input
            id="sf10File"
            ref={registerFieldRef("sf10File")}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={handleFileChange("sf10File")}
          />
          {files.sf10File && <div className="file-name">{files.sf10File.name}</div>}
          <FieldError error={errors.sf10File} />
        </div>

        <div className="form-group">
          <label>Birth Certificate</label>
          <input
            id="birthCertificateFile"
            ref={registerFieldRef("birthCertificateFile")}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={handleFileChange("birthCertificateFile")}
          />
          {files.birthCertificateFile && (
            <div className="file-name">{files.birthCertificateFile.name}</div>
          )}
          <FieldError error={errors.birthCertificateFile} />
        </div>

        <div className="form-group">
          <label>Good Moral Certificate</label>
          <input
            id="goodMoralFile"
            ref={registerFieldRef("goodMoralFile")}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={handleFileChange("goodMoralFile")}
          />
          {files.goodMoralFile && <div className="file-name">{files.goodMoralFile.name}</div>}
          <FieldError error={errors.goodMoralFile} />
        </div>

        <div className="form-group">
          <label>Report Card</label>
          <input
            id="reportCardFile"
            ref={registerFieldRef("reportCardFile")}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={handleFileChange("reportCardFile")}
          />
          {files.reportCardFile && <div className="file-name">{files.reportCardFile.name}</div>}
          <FieldError error={errors.reportCardFile} />
        </div>

        <div className="form-group">
          <label>Other Document</label>
          <input
            id="otherDocumentFile"
            ref={registerFieldRef("otherDocumentFile")}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={handleFileChange("otherDocumentFile")}
          />
          {files.otherDocumentFile && (
            <div className="file-name">{files.otherDocumentFile.name}</div>
          )}
          <FieldError error={errors.otherDocumentFile} />
        </div>
      </div>
    </>
  );
};

export default StepDocuments;