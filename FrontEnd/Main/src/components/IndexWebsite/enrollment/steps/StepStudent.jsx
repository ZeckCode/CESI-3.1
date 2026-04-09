// StepStudent.jsx
import React, { useState } from "react";
import FieldError from "../FieldError";
import { RELIGION_OPTIONS } from "../constants";
import { onlyDigits } from "../helpers";

const StepStudent = ({
  form,
  setForm,
  errors,
  registerFieldRef,
  ageValidation,
  maxBirthDate,
  onNext,
  onBack,
}) => {
  const [showAgeRefModal, setShowAgeRefModal] = useState(false);
  return (
    <div className="step-card">
      <h3>👤 Student Information</h3>

      <div className="form-grid">
        <div className="form-group">
          <label>Last Name <span className="required">*</span></label>
          <input
            ref={registerFieldRef("lastName")}
            value={form.lastName}
            onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
          />
          <FieldError error={errors.lastName} />
        </div>

        <div className="form-group">
          <label>First Name <span className="required">*</span></label>
          <input
            ref={registerFieldRef("firstName")}
            value={form.firstName}
            onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
          />
          <FieldError error={errors.firstName} />
        </div>

        <div className="form-group">
          <label>Middle Name</label>
          <input
            ref={registerFieldRef("middleName")}
            value={form.middleName}
            onChange={(e) => setForm((prev) => ({ ...prev, middleName: e.target.value }))}
            placeholder="Optional"
          />
          <FieldError error={errors.middleName} />
        </div>

        <div className="form-group">
          <label>Birth Date <span className="required">*</span></label>
          <div className={`birth-date-wrapper ${ageValidation && !ageValidation.ok ? "has-error" : ""}`}>
            <input
              ref={registerFieldRef("birthDate")}
              type="date"
              value={form.birthDate}
              max={maxBirthDate}
              onChange={(e) => setForm((prev) => ({ ...prev, birthDate: e.target.value }))}
              className={ageValidation && !ageValidation.ok ? "birth-date-input--invalid" : ""}
            />
            {ageValidation && !ageValidation.ok && (
              <>
                <button
                  type="button"
                  className="error-icon-inside"
                  onClick={() => setShowAgeRefModal(true)}
                  title="Click to view age reference"
                >
                  !
                </button>
                <div className="hover-error-message">
                  <div className="error-text">{ageValidation.msg}</div>
                </div>
              </>
            )}
          </div>
          <FieldError error={errors.birthDate} />

          {/* Age Reference Modal Overlay */}
          {showAgeRefModal && (
            <div className="age-ref-modal-overlay" onClick={() => setShowAgeRefModal(false)}>
              <div className="age-ref-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>Age Reference Guide</h3>
                  <button
                    type="button"
                    className="modal-close-btn"
                    onClick={() => setShowAgeRefModal(false)}
                  >
                    ×
                  </button>
                </div>
                <div className="modal-body">
                  <table className="age-ref-table">
                    <thead>
                      <tr>
                        <th>Grade Level</th>
                        <th>Min Age</th>
                        <th>Max Age</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="prek"><td>Pre-Kinder</td><td>3</td><td>4</td></tr>
                      <tr className="kinder"><td>Kinder</td><td>4</td><td>5</td></tr>
                      <tr className="g1"><td>Grade 1</td><td>6</td><td>7</td></tr>
                      <tr className="g2"><td>Grade 2</td><td>7</td><td>8</td></tr>
                      <tr className="g3"><td>Grade 3</td><td>8</td><td>9</td></tr>
                      <tr className="g4"><td>Grade 4</td><td>9</td><td>10</td></tr>
                      <tr className="g5"><td>Grade 5</td><td>10</td><td>11</td></tr>
                      <tr className="g6"><td>Grade 6</td><td>11</td><td>12</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
        

        <div className="form-group">
          <label>Gender <span className="required">*</span></label>
          <select
            ref={registerFieldRef("gender")}
            value={form.gender}
            onChange={(e) => setForm((prev) => ({ ...prev, gender: e.target.value }))}
          >
            <option value="">Select</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
          <FieldError error={errors.gender} />
        </div>

        <div className="form-group">
          <label>Email <span className="required">*</span></label>
          <input
            ref={registerFieldRef("email")}
            type="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          />
          <FieldError error={errors.email} />
        </div>

        <div className="form-group">
          <label> Religion <span className="required">*</span></label>
          <select
            ref={registerFieldRef("religion")}
            value={form.religion}
            onChange={(e) => setForm((prev) => ({ ...prev, religion: e.target.value, customReligion: "" }))}
          >
            <option value="">Select</option>
            {RELIGION_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
            <option value="others_specify">Others (specify)</option>
          </select>
          <FieldError error={errors.religion} />
          {form.religion === "others_specify" && (
            <>
              <input
                ref={registerFieldRef("customReligion")}
                type="text"
                placeholder="Please specify your religion"
                value={form.customReligion || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, customReligion: e.target.value }))}
                style={{ marginTop: "8px" }}
              />
              <FieldError error={errors.customReligion} />
            </>
          )}
        </div>

        <div className="form-group">
          <label>Mobile Number <span className="required">* {form.mobile.length}/11</span></label>
          <input
            ref={registerFieldRef("mobile")}
            value={form.mobile}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                mobile: onlyDigits(e.target.value, 11),
              }))
            }
            placeholder="09XXXXXXXXX"
            inputMode="numeric"
          />
          {/* <div className="field-counter"></div> */}
          <FieldError error={errors.mobile} />
        </div>

        <div className="form-group">
          <label>Parent Facebook</label>
          <input
            value={form.parentFacebook}
            onChange={(e) => setForm((prev) => ({ ...prev, parentFacebook: e.target.value }))}
            placeholder="Optional"
          />
        </div>
      </div>

     

      <h3>📍 Address</h3>
      <div className="form-grid">
        <div className="form-group form-group--full">
          <label>House No. / Street <span className="required">*</span></label>
          <input
            ref={registerFieldRef("street")}
            value={form.street}
            onChange={(e) => setForm((prev) => ({ ...prev, street: e.target.value }))}
          />
          <FieldError error={errors.street} />
        </div>

        <div className="form-group">
          <label>Barangay <span className="required">*</span></label>
          <input
            ref={registerFieldRef("barangay")}
            value={form.barangay}
            onChange={(e) => setForm((prev) => ({ ...prev, barangay: e.target.value }))}
          />
          <FieldError error={errors.barangay} />
        </div>

        <div className="form-group">
          <label>City / Municipality <span className="required">*</span></label>
          <input
            ref={registerFieldRef("city")}
            value={form.city}
            onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
          />
          <FieldError error={errors.city} />
        </div>

        <div className="form-group">
          <label>Province <span className="required">*</span></label>
          <input
            ref={registerFieldRef("province")}
            value={form.province}
            onChange={(e) => setForm((prev) => ({ ...prev, province: e.target.value }))}
          />
          <FieldError error={errors.province} />
        </div>

        <div className="form-group">
          <label>Region <span className="required">*</span></label>
          <select
            ref={registerFieldRef("region")}
            value={form.region}
            onChange={(e) => setForm((prev) => ({ ...prev, region: e.target.value }))}
          >
            <option value="">Select Region</option>
            <option value="NCR">NCR – National Capital Region</option>
            <option value="Region I">Region I – Ilocos Region</option>
            <option value="Region II">Region II – Cagayan Valley</option>
            <option value="Region III">Region III – Central Luzon</option>
            <option value="Region IV-A">Region IV-A – CALABARZON</option>
            <option value="Region IV-B">Region IV-B – MIMAROPA</option>
            <option value="Region V">Region V – Bicol Region</option>
            <option value="Region VI">Region VI – Western Visayas</option>
            <option value="Region VII">Region VII – Central Visayas</option>
            <option value="Region VIII">Region VIII – Eastern Visayas</option>
            <option value="Region IX">Region IX – Zamboanga Peninsula</option>
            <option value="Region X">Region X – Northern Mindanao</option>
            <option value="Region XI">Region XI – Davao Region</option>
            <option value="Region XII">Region XII – SOCCSKSARGEN</option>
            <option value="Region XIII">Region XIII – Caraga</option>
            <option value="CAR">CAR – Cordillera Administrative Region</option>
            <option value="BARMM">BARMM – Bangsamoro</option>
          </select>
          <FieldError error={errors.region} />
        </div>
      </div>

 

      <div className="form-actions">
        <button type="button" className="secondary" onClick={onBack}>
          Back
        </button>
        <button type="button" onClick={onNext}>
          Next
        </button>
      </div>
    </div>
  );
};

export default StepStudent;