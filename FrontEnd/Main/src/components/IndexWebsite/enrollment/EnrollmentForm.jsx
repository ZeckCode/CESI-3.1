import React, { useEffect, useMemo, useRef, useState } from "react";
// import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../api/apiFetch";
import { STEP_KEYS } from "./constants";
import {
  fmtDate,
  buildAddress,
  buildName,
  normalizePHMobile,
  computeEnrollmentWindow,
} from "./helpers";
import {
  validateAcademicStep,
  validateStudentStep,
  validateFamilyStep,
  validateDocumentsStep,
  validatePaymentStep,
  validateAgeForGrade,
} from "./validators";
import EnrollmentClosed from "./EnrollmentClosed";
import EnrollmentStepper from "./EnrollmentStepper";
import StepPrivacy from "./steps/StepPrivacy";
import StepInstructions from "./steps/StepInstructions";
import StepAcademic from "./steps/StepAcademic";
import StepStudent from "./steps/StepStudent";
import StepFamily from "./steps/StepFamily";
import StepDocuments from "./steps/StepDocuments";
import StepPayment from "./steps/StepPayment";
import "../../IndexWebsiteCSS/enrollment/EnrollmentForm.css";

const EnrollmentForm = ({ onClose }) => {
  const navigate = useNavigate();
  const fieldRefs = useRef({});

  const [currentStep, setCurrentStep] = useState(STEP_KEYS.PRIVACY);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    studentType: "",
    educationLevel: "",
    gradeLevel: "",
    paymentMode: "",
    paymentMethod: "",

    lrn: "",
    lastName: "",
    firstName: "",
    middleName: "",
    birthDate: "",
    gender: "",

    email: "",
    religion: "",
    mobile: "",
    parentFacebook: "",

    street: "",
    barangay: "",
    city: "",
    province: "",
    region: "",

    fatherFirst: "",
    fatherMiddle: "",
    fatherLast: "",
    fatherContact: "",
    fatherOccupation: "",

    motherFirst: "",
    motherMiddle: "",
    motherLast: "",
    motherContact: "",
    motherOccupation: "",

    guardianFirst: "",
    guardianMiddle: "",
    guardianLast: "",
    guardianContact: "",
    guardianRelationship: "",

    website: "",
  });

  const [files, setFiles] = useState({
    studentPhotoFile: null,
    paymentProofFile: null,
    form137File: null,
    sf10File: null,
    birthCertificateFile: null,
    goodMoralFile: null,
    reportCardFile: null,
    otherDocumentFile: null,
  });

  const [settings, setSettings] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(true);

  const [tuition, setTuition] = useState(null);
  const [tuitionLoading, setTuitionLoading] = useState(false);
  const [tuitionError, setTuitionError] = useState("");

  useEffect(() => {
    apiFetch("/api/enrollment-settings/")
      .then((r) => r.json())
      .catch(() => null)
      .then((data) => {
        setSettings(data);
        setSettingsLoading(false);
      });
  }, []);

  const window_ = computeEnrollmentWindow(settings);
  const { isOpen, closeDate, daysLeft, academicYear } = window_;

  const registerFieldRef = (name) => (node) => {
    if (node) fieldRefs.current[name] = node;
  };

  const focusFieldError = (fieldName) => {
    const node = fieldRefs.current[fieldName];
    if (node?.scrollIntoView) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => node.focus?.(), 200);
    }
  };

  const gradeOptions = useMemo(() => {
    if (form.educationLevel === "preschool") {
      return [
        { value: "prek", label: "Pre-Kinder" },
        { value: "kinder", label: "Kinder" },
      ];
    }

    if (form.educationLevel === "elementary") {
      return [
        { value: "grade1", label: "Grade 1" },
        { value: "grade2", label: "Grade 2" },
        { value: "grade3", label: "Grade 3" },
        { value: "grade4", label: "Grade 4" },
        { value: "grade5", label: "Grade 5" },
        { value: "grade6", label: "Grade 6" },
      ];
    }

    return [];
  }, [form.educationLevel]);

  const tuitionKey = useMemo(() => {
    switch (form.gradeLevel) {
      case "prek":
      case "kinder":
      case "grade1":
      case "grade2":
      case "grade3":
      case "grade4":
      case "grade5":
      case "grade6":
        return form.gradeLevel;
      default:
        return null;
    }
  }, [form.gradeLevel]);

  useEffect(() => {
    if (!tuitionKey || form.studentType !== "new") {
      setTuition(null);
      setTuitionLoading(false);
      setTuitionError("");
      return;
    }

    let isMounted = true;
    setTuitionLoading(true);
    setTuitionError("");

    apiFetch(`/api/finance/tuition-configs/by-grade/${tuitionKey}/`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.detail || "Failed to load tuition config.");
        }
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        setTuition(data);
      })
      .catch((err) => {
        if (!isMounted) return;
        setTuition(null);
        setTuitionError(err.message || "Unable to load tuition breakdown.");
      })
      .finally(() => {
        if (!isMounted) return;
        setTuitionLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [tuitionKey, form.studentType]);

  const ageValidation = useMemo(() => {
    return validateAgeForGrade(form.birthDate, form.gradeLevel);
  }, [form.birthDate, form.gradeLevel]);

  const validateCurrentStep = () => {
    let stepErrors = {};

    if (currentStep === STEP_KEYS.ACADEMIC) {
      stepErrors = validateAcademicStep(form);
    } else if (currentStep === STEP_KEYS.STUDENT) {
      stepErrors = validateStudentStep(form);
    } else if (currentStep === STEP_KEYS.FAMILY) {
      stepErrors = validateFamilyStep(form);
    } else if (currentStep === STEP_KEYS.DOCUMENTS) {
      stepErrors = validateDocumentsStep(files);
    } else if (currentStep === STEP_KEYS.PAYMENT) {
      stepErrors = validatePaymentStep({
        paymentMode: form.paymentMode,
        paymentMethod: form.paymentMethod,
        paymentProofFile: files.paymentProofFile,
      });
    }

    setErrors(stepErrors);

    const firstKey = Object.keys(stepErrors)[0];
    if (firstKey) focusFieldError(firstKey);

    return Object.keys(stepErrors).length === 0;
  };

  const nextStep = () => {
    if (currentStep === STEP_KEYS.PRIVACY || currentStep === STEP_KEYS.INSTRUCTIONS) {
      setCurrentStep((prev) => prev + 1);
      return;
    }

    if (currentStep === STEP_KEYS.ACADEMIC && form.studentType === "old") {
      navigate("/login", {
        state: { from: { pathname: "/student/reenrollment" } },
      });
      return;
    }

    if (validateCurrentStep()) {
      setCurrentStep((prev) => Math.min(prev + 1, STEP_KEYS.PAYMENT));
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, STEP_KEYS.PRIVACY));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");

    if (form.studentType !== "new") return;

    if (!validateCurrentStep()) return;

    const liveSettings = await apiFetch("/api/enrollment-settings/")
      .then((r) => r.json())
      .catch(() => null);

    const liveWindow = computeEnrollmentWindow(liveSettings);

    if (!liveWindow.isOpen) {
      setSubmitError("Enrollment has already closed.");
      return;
    }

    if (form.website && form.website.trim()) {
      setSubmitError("Invalid submission.");
      return;
    }

    const normalizedMobile = normalizePHMobile(form.mobile);
    if (!normalizedMobile) {
      setErrors((prev) => ({
        ...prev,
        mobile: "Enter a valid PH mobile number (09XXXXXXXXX).",
      }));
      setCurrentStep(STEP_KEYS.STUDENT);
      focusFieldError("mobile");
      return;
    }

    const formData = new FormData();
    formData.append("student_type", form.studentType);
    formData.append("education_level", form.educationLevel);
    formData.append("grade_level", form.gradeLevel);
    formData.append("academic_year", academicYear);
    formData.append("website", form.website);
    formData.append("lrn", form.lrn);
    formData.append("last_name", form.lastName);
    formData.append("first_name", form.firstName);
    formData.append("middle_name", form.middleName);
    formData.append("birth_date", form.birthDate || "");
    formData.append("gender", form.gender);
    formData.append("email", form.email);
    formData.append(
      "address",
      buildAddress({
        street: form.street,
        barangay: form.barangay,
        city: form.city,
        province: form.province,
        region: form.region,
      })
    );
    formData.append("religion", form.religion);
    formData.append("mobile_number", normalizedMobile);
    formData.append("parent_facebook", form.parentFacebook);
    formData.append("payment_mode", form.paymentMode);
    formData.append("payment_method", form.paymentMethod);
    formData.append("remarks", "");

    formData.append(
      "parent_info.father_name",
      buildName(form.fatherFirst, form.fatherMiddle, form.fatherLast)
    );
    formData.append(
      "parent_info.father_contact",
      form.fatherContact ? normalizePHMobile(form.fatherContact) || form.fatherContact : ""
    );
    formData.append("parent_info.father_occupation", form.fatherOccupation);

    formData.append(
      "parent_info.mother_name",
      buildName(form.motherFirst, form.motherMiddle, form.motherLast)
    );
    formData.append(
      "parent_info.mother_contact",
      form.motherContact ? normalizePHMobile(form.motherContact) || form.motherContact : ""
    );
    formData.append("parent_info.mother_occupation", form.motherOccupation);

    formData.append(
      "parent_info.guardian_name",
      buildName(form.guardianFirst, form.guardianMiddle, form.guardianLast)
    );
    formData.append(
      "parent_info.guardian_contact",
      form.guardianContact ? normalizePHMobile(form.guardianContact) || form.guardianContact : ""
    );
    formData.append("parent_info.guardian_relationship", form.guardianRelationship);

    if (files.studentPhotoFile) formData.append("student_photo", files.studentPhotoFile);
    if (files.paymentProofFile) formData.append("payment_proof_file", files.paymentProofFile);
    if (files.form137File) formData.append("form_137_file", files.form137File);
    if (files.sf10File) formData.append("sf10_file", files.sf10File);
    if (files.birthCertificateFile) {
      formData.append("birth_certificate_file", files.birthCertificateFile);
    }
    if (files.goodMoralFile) formData.append("good_moral_file", files.goodMoralFile);
    if (files.reportCardFile) formData.append("report_card_file", files.reportCardFile);
    if (files.otherDocumentFile) {
      formData.append("other_document_file", files.otherDocumentFile);
    }

    try {
      setIsSubmitting(true);

      const response = await apiFetch("/api/enrollments/", {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setSubmitError("Please review the form and try again.");

        if (data && typeof data === "object") {
          setErrors(data);
          const firstKey = Object.keys(data)[0];
          if (firstKey) focusFieldError(firstKey);
        }
        return;
      }

      alert("Enrollment submitted successfully!");
      if (onClose) onClose();
    } catch (err) {
      setSubmitError("Network error. Check if backend is running.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (settingsLoading) {
    return (
      <div className="enrollment-container">
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#6b7280" }}>
          Loading enrollment info...
        </div>
      </div>
    );
  }

  if (!isOpen) {
    return <EnrollmentClosed window_={window_} onClose={onClose} />;
  }

  return (
    <div className="enrollment-container">
      <h2>Enrollment Form</h2>

      <div
        className={`enrollment-window-notice ${
          daysLeft === 1 ? "enrollment-window-notice--urgent" : ""
        }`}
      >
        <span>
          Enrollment is open until <strong>{fmtDate(closeDate)}</strong>.{" "}
          {daysLeft === 1
            ? "⚠️ Last day today! Submit before midnight."
            : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining.`}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="enrollment-form">
        <div style={{ display: "none" }}>
          <input
            type="text"
            name="website"
            autoComplete="off"
            value={form.website}
            onChange={(e) => setForm((prev) => ({ ...prev, website: e.target.value }))}
          />
        </div>

        {submitError && <div className="submit-error">{submitError}</div>}

        <EnrollmentStepper currentStep={currentStep} />

        {currentStep === STEP_KEYS.PRIVACY && (
          <StepPrivacy onNext={nextStep} />
        )}

        {currentStep === STEP_KEYS.INSTRUCTIONS && (
          <StepInstructions onNext={nextStep} onBack={prevStep} />
        )}

        {currentStep === STEP_KEYS.ACADEMIC && (
          <StepAcademic
            form={form}
            setForm={setForm}
            errors={errors}
            registerFieldRef={registerFieldRef}
            gradeOptions={gradeOptions}
          />
        )}

        {currentStep === STEP_KEYS.STUDENT && (
       <StepStudent
          form={form}
          setForm={setForm}
          errors={errors}
          registerFieldRef={registerFieldRef}
          ageValidation={ageValidation}
          maxBirthDate={new Date(Date.now() - 86400000).toISOString().split("T")[0]}
          onNext={nextStep}
          onBack={prevStep}
        />
        )}

        {currentStep === STEP_KEYS.FAMILY && (
          <StepFamily
            form={form}
            setForm={setForm}
            errors={errors}
            registerFieldRef={registerFieldRef}
            onNext={nextStep}
            onBack={prevStep}
          />
        )}

        {currentStep === STEP_KEYS.DOCUMENTS && (
          <StepDocuments
            files={files}
            setFiles={setFiles}
            errors={errors}
            registerFieldRef={registerFieldRef}
          />
        )}

        {currentStep === STEP_KEYS.PAYMENT && (
          <StepPayment
            form={form}
            setForm={setForm}
            files={files}
            setFiles={setFiles}
            errors={errors}
            registerFieldRef={registerFieldRef}
            tuition={tuition}
            tuitionLoading={tuitionLoading}
            tuitionError={tuitionError}
            studentType={form.studentType}
          />
        )}

        {currentStep === STEP_KEYS.ACADEMIC && (
          <div className="form-actions">
            <button type="button" className="secondary" onClick={prevStep}>
              Back
            </button>
            <button type="button" onClick={nextStep}>
              Next
            </button>
          </div>
        )}

        {currentStep === STEP_KEYS.DOCUMENTS && (
          <div className="form-actions">
            <button type="button" className="secondary" onClick={prevStep}>
              Back
            </button>
            <button type="button" onClick={nextStep}>
              Next
            </button>
          </div>
        )}

        {currentStep === STEP_KEYS.PAYMENT && (
          <div className="form-actions">
            <button type="button" className="secondary" onClick={prevStep}>
              Back
            </button>
            <button type="submit" disabled={isSubmitting || tuitionLoading}>
              {isSubmitting ? "Submitting..." : "Submit Enrollment"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default EnrollmentForm;