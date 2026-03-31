import React from "react";
import FieldError from "../FieldError";

const StepAcademic = ({
  form,
  setForm,
  errors,
  registerFieldRef,
  gradeOptions,
}) => {
  const lrnRequired = [
    "kinder",
    "grade1",
    "grade2",
    "grade3",
    "grade4",
    "grade5",
    "grade6",
  ].includes(form.gradeLevel);

  return (
    <>
      <h3>🎓 Academic Information</h3>

      <div className="form-grid">
        <div className="form-group">
          <label>
            Student Type <span className="required">*</span>
          </label>
          <select
            ref={registerFieldRef("studentType")}
            value={form.studentType}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                studentType: e.target.value,
                educationLevel: "",
                gradeLevel: "",
                lrn: "",
              }))
            }
          >
            <option value="">Select</option>
            <option value="new">New / Transferee</option>
            <option value="old">Old Student</option>
          </select>
          <FieldError error={errors.studentType} />
        </div>

        {form.studentType === "new" && (
          <>
           <div className="form-group">
              <label>
                Education Level <span className="required">*</span>
              </label>
              <select
                ref={registerFieldRef("educationLevel")}
                value={form.educationLevel}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    educationLevel: e.target.value,
                    gradeLevel: "",
                  }))
                }
              >
                <option value="">Select</option>
                <option value="preschool">Preschool</option>
                <option value="elementary">Elementary</option>
              </select>
              <FieldError error={errors.educationLevel} />
            </div>

            <div className="form-group">
              <label>
                LRN {lrnRequired && <span className="required">*</span>}
                {form.lrn.length}/12
              </label>
              {/* <div className="field-counter"></div> */}
              <input
                ref={registerFieldRef("lrn")}
                value={form.lrn}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    lrn: e.target.value.replace(/\D/g, "").slice(0, 12),
                  }))
                }
                placeholder={
                  lrnRequired
                    ? "12 digits (required)"
                    : "Pre-Kinder students may leave blank"
                }
                maxLength={12}
                inputMode="numeric"
              />
              
              <FieldError error={errors.lrn} />
            </div>

           

            <div className="form-group">
              <label>
                Grade Level <span className="required">*</span>
              </label>
              <select
                ref={registerFieldRef("gradeLevel")}
                value={form.gradeLevel}
                disabled={!form.educationLevel}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    gradeLevel: e.target.value,
                  }))
                }
              >
                <option value="">Select</option>
                {gradeOptions.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
              <FieldError error={errors.gradeLevel} />
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default StepAcademic;