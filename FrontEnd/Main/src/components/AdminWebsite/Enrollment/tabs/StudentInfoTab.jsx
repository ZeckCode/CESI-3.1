import React from "react";

const RELIGION_OPTIONS = [
  "Roman Catholic",
  "Christian",
  "Iglesia ni Cristo",
  "Muslim",
  "Born Again",
  "Seventh-day Adventist",
  "Jehovah's Witness",
  "Buddhist",
  "Hindu",
  "None",
];

export default function StudentInfoTab({
  formData,
  isReadOnly,
  lockImportantFields,
  modalMode,
  onInputChange,
  gradeOptions,
  filteredSections,
  sectionsLoading,
  calcAge,
  todayISO,
  gradeLabel,
  validateAgeForGrade,
  GRADE_AGE_RULES,
}) {
  const disableImportantFields = isReadOnly || lockImportantFields;

  return (
    <div className="tab-content-scroll">
      {/* Academic Information */}
      <div className="tab-section">
        <div className="tab-section-title">
          <span className="section-icon">🎓</span>
          Academic Information
        </div>

        {lockImportantFields && (
          <div className="enrollment-lock-note">
            Grade and education details are locked after enrollment is approved.
          </div>
        )}

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
              placeholder="12 digits"
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
              disabled={disableImportantFields}
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
              disabled={disableImportantFields || !formData.education_level}
            >
              <option value="">Select</option>
              {gradeOptions.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
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
                {sectionsLoading ? "Loading..." : "Optional"}
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
              placeholder="e.g., 2024-2025"
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
      </div>

      {/* Student Information */}
      <div className="tab-section">
        <div className="tab-section-title">
          <span className="section-icon">👤</span>
          Personal Information
        </div>

        {lockImportantFields && (
          <div className="enrollment-lock-note">
            Name and birth date are locked after enrollment is approved.
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label>Last Name *</label>
            <input
              name="last_name"
              value={formData.last_name}
              onChange={onInputChange}
              disabled={disableImportantFields}
            />
          </div>
          <div className="form-group">
            <label>First Name *</label>
            <input
              name="first_name"
              value={formData.first_name}
              onChange={onInputChange}
              disabled={disableImportantFields}
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
              disabled={disableImportantFields}
            />
          </div>
          <div className="form-group">
            <label>Birth Date</label>
            <input
              type="date"
              name="birth_date"
              value={formData.birth_date || ""}
              onChange={onInputChange}
              disabled={disableImportantFields}
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
            <div className={check === true ? "age-note valid" : "age-note warning"}>
              {check === true ? (
                <>✓ Age {age} is valid for this grade level</>
              ) : (
                <>{check}</>
              )}
            </div>
          );
        })()}
      </div>

      {/* Contact Information */}
      <div className="tab-section">
        <div className="tab-section-title">
          <span className="section-icon">📞</span>
          Contact Information
        </div>

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
            <select
              name="religion"
              value={formData.religion}
              onChange={onInputChange}
              disabled={isReadOnly}
            >
              <option value="">Select</option>
              {RELIGION_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
              <option value="others_specify">Others (specify)</option>
            </select>
            {formData.religion === "others_specify" && (
              <input
                name="custom_religion"
                value={formData.custom_religion || ""}
                onChange={onInputChange}
                disabled={isReadOnly}
                placeholder="Please specify religion"
                style={{ marginTop: 8 }}
              />
            )}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Mobile</label>
            <input
              name="mobile_number"
              value={formData.mobile_number}
              onChange={onInputChange}
              disabled={isReadOnly}
              placeholder="09XXXXXXXXX"
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
      </div>

      {/* Address */}
      <div className="tab-section">
        <div className="tab-section-title">
          <span className="section-icon">📍</span>
          Address
        </div>

        <div className="form-group">
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
      </div>

      {/* Payment Information */}
      <div className="tab-section">
        <div className="tab-section-title">
          <span className="section-icon">💰</span>
          Payment Information
        </div>

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
      </div>
    </div>
  );
}
