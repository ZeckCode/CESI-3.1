import React from "react";
import FieldError from "../FieldError";
import { onlyDigits } from "../helpers";

const StepFamily = ({ form, setForm, errors, registerFieldRef, onNext, onBack }) => {
  return (
    <div className="step-card">
      <h3>👨‍👩‍👧 Parent / Guardian Information</h3>

      <p className="parent-section-label">Mother</p>
      <div className="form-grid">
        <div className="form-group">
          <label>First Name</label>
          <input
            value={form.motherFirst}
            onChange={(e) => setForm((prev) => ({ ...prev, motherFirst: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label>Middle Name</label>
          <input
            value={form.motherMiddle}
            onChange={(e) => setForm((prev) => ({ ...prev, motherMiddle: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label>Last Name</label>
          <input
            value={form.motherLast}
            onChange={(e) => setForm((prev) => ({ ...prev, motherLast: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label>Mobile Number</label>
          <input
            ref={registerFieldRef("motherContact")}
            value={form.motherContact}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                motherContact: onlyDigits(e.target.value, 11),
              }))
            }
            placeholder="09XXXXXXXXX"
            inputMode="numeric"
          />
          <div className="field-counter">{form.motherContact.length}/11</div>
          <FieldError error={errors.motherContact} />
        </div>
        <div className="form-group">
          <label>Occupation</label>
          <input
            value={form.motherOccupation}
            onChange={(e) => setForm((prev) => ({ ...prev, motherOccupation: e.target.value }))}
          />
        </div>
      </div>

      <p className="parent-section-label">Father</p>
      <div className="form-grid">
        <div className="form-group">
          <label>First Name</label>
          <input
            value={form.fatherFirst}
            onChange={(e) => setForm((prev) => ({ ...prev, fatherFirst: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label>Middle Name</label>
          <input
            value={form.fatherMiddle}
            onChange={(e) => setForm((prev) => ({ ...prev, fatherMiddle: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label>Last Name</label>
          <input
            value={form.fatherLast}
            onChange={(e) => setForm((prev) => ({ ...prev, fatherLast: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label>Mobile Number</label>
          <input
            ref={registerFieldRef("fatherContact")}
            value={form.fatherContact}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                fatherContact: onlyDigits(e.target.value, 11),
              }))
            }
               placeholder="09XXXXXXXXX"
            inputMode="numeric"
          />
          <div className="field-counter">{form.fatherContact.length}/11</div>
          <FieldError error={errors.fatherContact} />
        </div>
        <div className="form-group">
          <label>Occupation</label>
          <input
            value={form.fatherOccupation}
            onChange={(e) => setForm((prev) => ({ ...prev, fatherOccupation: e.target.value }))}
          />
        </div>
      </div>

      <p className="parent-section-label">Guardian (if applicable)</p>
      <div className="form-grid">
        <div className="form-group">
          <label>First Name</label>
          <input
            value={form.guardianFirst}
            onChange={(e) => setForm((prev) => ({ ...prev, guardianFirst: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label>Middle Name</label>
          <input
            value={form.guardianMiddle}
            onChange={(e) => setForm((prev) => ({ ...prev, guardianMiddle: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label>Last Name</label>
          <input
            value={form.guardianLast}
            onChange={(e) => setForm((prev) => ({ ...prev, guardianLast: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label>Mobile Number</label>
          <input
            ref={registerFieldRef("guardianContact")}
            value={form.guardianContact}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                guardianContact: onlyDigits(e.target.value, 11),
              }))
            }
            placeholder="09XXXXXXXXX"
            inputMode="numeric"
          />
          <div className="field-counter">{form.guardianContact.length}/11</div>
          <FieldError error={errors.guardianContact} />
        </div>
        <div className="form-group">
          <label>Relationship to Student</label>
          <input
            value={form.guardianRelationship}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                guardianRelationship: e.target.value,
              }))
            }
          />
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

export default StepFamily;