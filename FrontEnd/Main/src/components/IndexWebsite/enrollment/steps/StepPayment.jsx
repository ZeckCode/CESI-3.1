// StepPayment.jsx
import React from "react";
import FieldError from "../FieldError";
import { formatMoney, getRequiredEnrollmentPayment } from "../helpers";

const StepPayment = ({
  form,
  setForm,
  files,
  setFiles,
  errors,
  registerFieldRef,
  tuition,
  tuitionLoading,
  tuitionError,
  studentType,
}) => {
  const minimumPayment = getRequiredEnrollmentPayment(tuition, form.paymentMode, studentType);
  const isNewStudent = String(studentType || "").trim().toLowerCase() === "new";
  const assessmentFee = isNewStudent ? Number(tuition?.assessment || 0) : 0;
  const onsitePreparationAmount =
    form.paymentMode === "cash"
      ? Number(tuition?.total_cash || 0) + assessmentFee
      : Number(tuition?.initial || 0) + assessmentFee;

  const handleFileChange = (key) => (e) => {
    const file = e.target.files?.[0] || null;
    setFiles((prev) => ({
      ...prev,
      [key]: file,
    }));
  };

  return (
    <>
      <h3>💰 Payment Information</h3>

      <div className="payment-policies">
        <h4>Payment Policies</h4>
        <ul>
          <li>Please select your preferred payment mode and payment method.</li>
          <li>Onsite payments show the required amount only as a reminder.</li>
          <li>For online payments, proof of payment is required before submission.</li>
          <li>Submitted payment information is subject to school verification.</li>
          <li>Enrollment processing may be delayed if payment details are incomplete.</li>
        </ul>
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label>
            Payment Mode <span className="required">*</span>
          </label>
          <select
            ref={registerFieldRef("paymentMode")}
            value={form.paymentMode}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                paymentMode: e.target.value,
              }))
            }
          >
            <option value="">Select</option>
            <option value="cash">Cash</option>
            <option value="installment">Installment</option>
          </select>
          <FieldError error={errors.paymentMode} />
        </div>

        <div className="form-group">
          <label>
            Payment Method <span className="required">*</span>
          </label>
          <select
            ref={registerFieldRef("paymentMethod")}
            value={form.paymentMethod}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                paymentMethod: e.target.value,
              }))
            }
          >
            <option value="">Select</option>
            <option value="onsite">Onsite Payment</option>
            <option value="online">Online Payment</option>
          </select>
          <FieldError error={errors.paymentMethod} />
        </div>


        {form.paymentMethod === "online" && (
          <div className="form-group form-group--full">
            <label>
              Amount <span className="required">*</span>
            </label>
            <input
              ref={registerFieldRef("paymentAmount")}
              type="text"
              inputMode="decimal"
              pattern="^[0-9]*[.,]?[0-9]*$"
              value={form.paymentAmount}
              onChange={(e) => {
                // Only allow numbers and decimal
                const val = e.target.value.replace(/[^0-9.,]/g, "");
                setForm((prev) => ({
                  ...prev,
                  paymentAmount: val,
                }));
              }}
              placeholder={
                minimumPayment > 0
                  ? `Please pay at least ₱${formatMoney(minimumPayment)} before submitting enrollment`
                  : "Enter payment amount"
              }
              autoComplete="off"
            />
            {minimumPayment > 0 ? (
              <div className="tuition-row" style={{ marginTop: 8 }}>
                <span>
                  {form.paymentMode === "installment"
                    ? "Minimum required amount (initial payment + assessment fee)"
                    : "Minimum required amount (50% of cash total + assessment fee)"}
                </span>
                <strong>₱{formatMoney(minimumPayment)}</strong>
              </div>
            ) : null}
            {/* Show exact total for cash payment online */}
            {!tuitionLoading && tuition && form.paymentMode === "cash" && (
              <div className="tuition-row" style={{ marginTop: 8, background: '#f0f9ff', borderRadius: 6, padding: 8 }}>
                <span>
                  <b>Exact total for cash payment (tuition + assessment fee):</b>
                </span>
                <strong>
                  ₱{formatMoney(Number(tuition.total_cash || 0) + (studentType === "new" ? Number(tuition.assessment || 0) : 0))}
                </strong>
              </div>
            )}
            <FieldError error={errors.paymentAmount} />

            <label>
              Proof of Payment <span className="required">*</span>
            </label>
            <input
              ref={registerFieldRef("paymentProofFile")}
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={handleFileChange("paymentProofFile")}
            />
            {files.paymentProofFile && (
              <div className="file-name">{files.paymentProofFile.name}</div>
            )}
            <FieldError error={errors.paymentProofFile} />
          </div>
        )}

        {form.paymentMethod === "onsite" && form.paymentMode === "cash" && (
          <div className="form-group form-group--full">
            <div className="tuition-row" style={{ marginTop: 8 }}>
              <span>
                Please prepare the exact total for cash payment (tuition + assessment fee). No partial payments allowed.
              </span>
              <strong>₱{formatMoney(Number(tuition?.total_cash || 0) + assessmentFee)}</strong>
            </div>
          </div>
        )}

        {form.paymentMethod === "onsite" && form.paymentMode === "installment" && (
          <div className="form-group form-group--full">
            <div className="tuition-row" style={{ marginTop: 8 }}>
              <span>
                Please prepare the right amount of initial payment + assessment fee.
              </span>
              <strong>₱{formatMoney(onsitePreparationAmount)}</strong>
            </div>
          </div>
        )}
      </div>

      {(tuitionLoading || tuitionError || tuition) && (
        <div className="tuition-box">
          <h3>📊 Tuition Breakdown</h3>

          {tuitionLoading && (
            <div className="tuition-row">
              <span>Loading tuition configuration...</span>
            </div>
          )}

          {!tuitionLoading && tuitionError && (
            <div className="tuition-row tuition-row--error">
              <span>{tuitionError}</span>
            </div>
          )}

          {!tuitionLoading && tuition && form.paymentMode === "cash" && (
            <>
              <div className="tuition-row">
                <span>Tuition Fee (Cash)</span>
                <span>₱{formatMoney(tuition.cash)}</span>
              </div>
              <div className="tuition-row">
                <span>Miscellaneous (August)</span>
                <span>₱{formatMoney(tuition.misc_aug)}</span>
              </div>
              <div className="tuition-row">
                <span>Miscellaneous (November)</span>
                <span>₱{formatMoney(tuition.misc_nov)}</span>
              </div>

              {studentType === "new" && (
                <div className="tuition-row">
                  <span>Assessment Fee</span>
                  <span>₱{formatMoney(tuition.assessment)}</span>
                </div>
              )}

              <div className="tuition-total">
                <strong>Total (Cash)</strong>
                <strong>
                  ₱
                  {formatMoney(
                    Number(tuition.total_cash || 0) +
                      (studentType === "new" ? Number(tuition.assessment || 0) : 0)
                  )}
                </strong>
              </div>
            </>
          )}

          {!tuitionLoading && tuition && form.paymentMode === "installment" && (
            <>
              <div className="tuition-row">
                <span>Tuition Fee (Installment)</span>
                <span>₱{formatMoney(tuition.installment)}</span>
              </div>
              <div className="tuition-row">
                <span>Initial Payment</span>
                <span>₱{formatMoney(tuition.initial)}</span>
              </div>
              <div className="tuition-row">
                <span>Reservation Fee</span>
                <span>₱{formatMoney(tuition.reservation_fee)}</span>
              </div>
              <div className="tuition-row">
                <span>Monthly Payment</span>
                <span>₱{formatMoney(tuition.monthly)}</span>
              </div>
              <div className="tuition-row">
                <span>Miscellaneous (August)</span>
                <span>₱{formatMoney(tuition.misc_aug)}</span>
              </div>
              <div className="tuition-row">
                <span>Miscellaneous (November)</span>
                <span>₱{formatMoney(tuition.misc_nov)}</span>
              </div>

              {studentType === "new" && (
                <div className="tuition-row">
                  <span>Assessment Fee</span>
                  <span>₱{formatMoney(tuition.assessment)}</span>
                </div>
              )}

              <div className="tuition-total">
                <strong>Total (Installment)</strong>
                <strong>
                  ₱
                  {formatMoney(
                    Number(tuition.total_installment || 0) +
                      (studentType === "new" ? Number(tuition.assessment || 0) : 0)
                  )}
                </strong>
              </div>
            </>
          )}

          {!tuitionLoading && tuition && !form.paymentMode && (
            <div className="tuition-row">
              <span>Select a payment mode to view the breakdown.</span>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default StepPayment;