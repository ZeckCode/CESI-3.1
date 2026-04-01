import React from "react";

export default function ParentInfoTab({
  formData,
  isReadOnly,
  modalMode,
  onParentChange,
}) {
  return (
    <div className="tab-content-scroll">
      {/* Mother Information */}
      <div className="tab-section">
        <div className="tab-section-title">
          <span className="section-icon">👩</span>
          Mother's Information
        </div>

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

      {/* Father Information */}
      <div className="tab-section">
        <div className="tab-section-title">
          <span className="section-icon">👨</span>
          Father's Information
        </div>

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

      {/* Guardian Information */}
      <div className="tab-section">
        <div className="tab-section-title">
          <span className="section-icon">👤</span>
          Guardian's Information (if applicable)
        </div>

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
      </div>
    </div>
  );
}
