// validators.js
import { GRADE_AGE_RULES } from "../../../config/EnrollmentConfig.js";
import { LRN_REQUIRED_GRADES } from "./constants";
import { calcAge, normalizePHMobile } from "./helpers";

export const validateAgeForGrade = (birthDate, gradeLevel) => {
  if (!birthDate || !gradeLevel) return null;

  const rule = GRADE_AGE_RULES[gradeLevel];
  if (!rule) return null;

  const bd = new Date(birthDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (bd >= today) {
    return { ok: false, msg: "Birth date must be earlier than today." };
  }

  const age = calcAge(birthDate);

  if (age < 3) {
    return { ok: false, msg: "Student must be at least 3 years old." };
  }

  if (age > 18) {
    return { ok: false, msg: "Student age exceeds the allowed school range." };
  }

  if (age < rule.min) {
    return {
      ok: false,
      msg: `Student is too young for ${rule.label}. Minimum age is ${rule.min}.`,
    };
  }

  if (age > rule.max) {
    return {
      ok: false,
      msg: `Student is too old for ${rule.label}. Maximum age is ${rule.max}.`,
    };
  }

  return {
    ok: true,
    msg: `Age ${age} is valid for ${rule.label}.`,
  };
};

export const validateAcademicStep = ({ studentType, educationLevel, gradeLevel, lrn }) => {
  const errors = {};

  if (!studentType) errors.studentType = "Please select student type.";

  if (studentType === "new") {
    if (!educationLevel) errors.educationLevel = "Please select education level.";
    if (!gradeLevel) errors.gradeLevel = "Please select grade level.";

    if (LRN_REQUIRED_GRADES.includes(gradeLevel)) {
      if (!lrn) errors.lrn = "LRN is required for this grade level.";
      else if (lrn.length !== 12) errors.lrn = "LRN must be exactly 12 digits.";
    }
  }

  return errors;
};

export const validateStudentStep = (data) => {
  const errors = {};
  const ageValidation = validateAgeForGrade(data.birthDate, data.gradeLevel);

  if (!data.lastName.trim()) errors.lastName = "Last name is required.";
  if (!data.firstName.trim()) errors.firstName = "First name is required.";
  if (!data.middleName.trim()) errors.middleName = "Middle name is required.";
  if (!data.birthDate) errors.birthDate = "Birth date is required.";
  else if (ageValidation && !ageValidation.ok) errors.birthDate = ageValidation.msg;

  if (!data.gender) errors.gender = "Please select gender.";
  if (!data.email.trim()) errors.email = "Email is required.";
  if (!data.religion) errors.religion = "Please select religion.";

  if (!data.mobile.trim()) errors.mobile = "Mobile number is required.";
  else if (!normalizePHMobile(data.mobile)) {
    errors.mobile = "Enter a valid PH mobile number (09XXXXXXXXX).";
  }

  if (!data.street.trim()) errors.street = "Street is required.";
  if (!data.barangay.trim()) errors.barangay = "Barangay is required.";
  if (!data.city.trim()) errors.city = "City / Municipality is required.";
  if (!data.province.trim()) errors.province = "Province is required.";
  if (!data.region) errors.region = "Please select region.";

  return errors;
};

export const validateFamilyStep = ({ motherContact, fatherContact, guardianContact }) => {
  const errors = {};

  if (motherContact && !normalizePHMobile(motherContact)) {
    errors.motherContact = "Enter a valid PH mobile number.";
  }

  if (fatherContact && !normalizePHMobile(fatherContact)) {
    errors.fatherContact = "Enter a valid PH mobile number.";
  }

  if (guardianContact && !normalizePHMobile(guardianContact)) {
    errors.guardianContact = "Enter a valid PH mobile number.";
  }

  return errors;
};

export const validateDocumentsStep = ({ studentPhotoFile }) => {
  const errors = {};

  if (!studentPhotoFile) {
    errors.studentPhotoFile = "Please upload a 2x2 picture.";
  }

  return errors;
};

export const validatePaymentStep = ({ paymentMode, paymentMethod, paymentProofFile }) => {
  const errors = {};

  if (!paymentMode) errors.paymentMode = "Please select payment mode.";
  if (!paymentMethod) errors.paymentMethod = "Please select payment method.";

  if (paymentMethod === "online" && !paymentProofFile) {
    errors.paymentProofFile = "Please upload proof of payment.";
  }

  return errors;
};