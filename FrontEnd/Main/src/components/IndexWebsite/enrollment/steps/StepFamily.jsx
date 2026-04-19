import React, { useRef } from "react";
// Helper to insert a character at the cursor position in an input
function insertAtCursor(input, char) {
  if (!input) return;
  const start = input.selectionStart;
  const end = input.selectionEnd;
  const value = input.value;
  input.value = value.slice(0, start) + char + value.slice(end);
  input.selectionStart = input.selectionEnd = start + char.length;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.focus();
}
import FieldError from "../FieldError";
import { onlyDigits } from "../helpers";

const StepFamily = ({ form, setForm, errors, registerFieldRef, onNext, onBack }) => {
  // Refs for name fields
  const motherFirstRef = useRef();
  const motherMiddleRef = useRef();
  const motherLastRef = useRef();
  const fatherFirstRef = useRef();
  const fatherMiddleRef = useRef();
  const fatherLastRef = useRef();

  return (
    <div className="step-card">
      <h3>👨‍👩‍👧 Parent / Guardian Information</h3>

     {errors.familyRequired && (
      <div className="error-banner">
        <FieldError error={errors.familyRequired} />
      </div>
    )}

      <p className="parent-section-label">Mother</p>
      <div className="form-grid">
        <div className="form-group">
          <label>First Name</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              ref={el => { registerFieldRef("motherFirst")(el); motherFirstRef.current = el; }}
              value={form.motherFirst}
              onChange={(e) => setForm((prev) => ({ ...prev, motherFirst: e.target.value }))}
            />
            <button type="button" className="enye-insert-btn" title="Insert Ñ" onClick={() => insertAtCursor(motherFirstRef.current, 'Ñ')}>Ñ</button>
            <button type="button" className="enye-insert-btn" title="Insert ñ" onClick={() => insertAtCursor(motherFirstRef.current, 'ñ')}>ñ</button>
          </div>
          <FieldError error={errors.motherFirst} />
        </div>
        <div className="form-group">
          <label>Middle Name (Optional)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              ref={el => { registerFieldRef("motherMiddle")(el); motherMiddleRef.current = el; }}
              value={form.motherMiddle}
              onChange={(e) => setForm((prev) => ({ ...prev, motherMiddle: e.target.value }))}
            />
            <button type="button" className="enye-insert-btn" title="Insert Ñ" onClick={() => insertAtCursor(motherMiddleRef.current, 'Ñ')}>Ñ</button>
            <button type="button" className="enye-insert-btn" title="Insert ñ" onClick={() => insertAtCursor(motherMiddleRef.current, 'ñ')}>ñ</button>
          </div>
          <FieldError error={errors.motherMiddle} />
        </div>
        <div className="form-group">
          <label>Last Name</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              ref={el => { registerFieldRef("motherLast")(el); motherLastRef.current = el; }}
              value={form.motherLast}
              onChange={(e) => setForm((prev) => ({ ...prev, motherLast: e.target.value }))}
            />
            <button type="button" className="enye-insert-btn" title="Insert Ñ" onClick={() => insertAtCursor(motherLastRef.current, 'Ñ')}>Ñ</button>
            <button type="button" className="enye-insert-btn" title="Insert ñ" onClick={() => insertAtCursor(motherLastRef.current, 'ñ')}>ñ</button>
          </div>
          <FieldError error={errors.motherLast} />
        </div>
        <div className="form-group">
          <label>Mobile Number {form.motherContact.length}/11</label>
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
          {/* <div className="field-counter"></div> */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              ref={el => { registerFieldRef("fatherFirst")(el); fatherFirstRef.current = el; }}
              value={form.fatherFirst}
              onChange={(e) => setForm((prev) => ({ ...prev, fatherFirst: e.target.value }))}
            />
            <button type="button" className="enye-insert-btn" title="Insert Ñ" onClick={() => insertAtCursor(fatherFirstRef.current, 'Ñ')}>Ñ</button>
            <button type="button" className="enye-insert-btn" title="Insert ñ" onClick={() => insertAtCursor(fatherFirstRef.current, 'ñ')}>ñ</button>
          </div>
          <FieldError error={errors.fatherFirst} />
        </div>
        <div className="form-group">
          <label>Middle Name (Optional)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              ref={el => { registerFieldRef("fatherMiddle")(el); fatherMiddleRef.current = el; }}
              value={form.fatherMiddle}
              onChange={(e) => setForm((prev) => ({ ...prev, fatherMiddle: e.target.value }))}
            />
            <button type="button" className="enye-insert-btn" title="Insert Ñ" onClick={() => insertAtCursor(fatherMiddleRef.current, 'Ñ')}>Ñ</button>
            <button type="button" className="enye-insert-btn" title="Insert ñ" onClick={() => insertAtCursor(fatherMiddleRef.current, 'ñ')}>ñ</button>
          </div>
          <FieldError error={errors.fatherMiddle} />
        </div>
        <div className="form-group">
          <label>Last Name</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              ref={el => { registerFieldRef("fatherLast")(el); fatherLastRef.current = el; }}
              value={form.fatherLast}
              onChange={(e) => setForm((prev) => ({ ...prev, fatherLast: e.target.value }))}
            />
            <button type="button" className="enye-insert-btn" title="Insert Ñ" onClick={() => insertAtCursor(fatherLastRef.current, 'Ñ')}>Ñ</button>
            <button type="button" className="enye-insert-btn" title="Insert ñ" onClick={() => insertAtCursor(fatherLastRef.current, 'ñ')}>ñ</button>
          </div>
          <FieldError error={errors.fatherLast} />
        </div>
        <div className="form-group">
          <label>Mobile Number {form.fatherContact.length}/11</label>
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
          {/* <div className="field-counter">{form.fatherContact.length}/11</div> */}
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

      <p className="parent-section-label">Guardian (if applicable) <span style={{fontSize: '0.85em', color: '#666'}}>Optional</span></p>
      <div className="form-grid">
        <div className="form-group">
          <label>First Name</label>
          <input
            ref={registerFieldRef("guardianFirst")}
            value={form.guardianFirst}
            onChange={(e) => setForm((prev) => ({ ...prev, guardianFirst: e.target.value }))}
          />
          <FieldError error={errors.guardianFirst} />
        </div>
        <div className="form-group">
          <label>Middle Name (Optional)</label>
          <input
            ref={registerFieldRef("guardianMiddle")}
            value={form.guardianMiddle}
            onChange={(e) => setForm((prev) => ({ ...prev, guardianMiddle: e.target.value }))}
          />
          <FieldError error={errors.guardianMiddle} />
        </div>
        <div className="form-group">
          <label>Last Name</label>
          <input
            ref={registerFieldRef("guardianLast")}
            value={form.guardianLast}
            onChange={(e) => setForm((prev) => ({ ...prev, guardianLast: e.target.value }))}
          />
          <FieldError error={errors.guardianLast} />
        </div>
        <div className="form-group">
          <label>Mobile Number {form.guardianContact.length}/11</label>
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
          {/* <div className="field-counter">{form.guardianContact.length}/11</div> */}
          <FieldError error={errors.guardianContact} />
        </div>
        <div className="form-group">
          <label>Relationship to Student</label>
          <input
            ref={registerFieldRef("guardianRelationship")}
            value={form.guardianRelationship}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                guardianRelationship: e.target.value,
              }))
            }
          />
          <FieldError error={errors.guardianRelationship} />
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