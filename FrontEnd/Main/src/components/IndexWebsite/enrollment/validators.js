import { GRADE_AGE_RULES } from "../../../config/EnrollmentConfig.js";
import { LRN_REQUIRED_GRADES } from "./constants";
import { calcAge, normalizePHMobile } from "./helpers";

const isValidEmail = (email = "") => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

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
      else if (!/^\d{12}$/.test(lrn.trim())) {
        errors.lrn = "LRN must be exactly 12 digits.";
      }
    }
  }

  return errors;
};

export const validateStudentStep = (data) => {
  const errors = {};
  const ageValidation = validateAgeForGrade(data.birthDate, data.gradeLevel);

  if (!data.lastName.trim()) errors.lastName = "Last name is required.";
  if (!data.firstName.trim()) errors.firstName = "First name is required.";
  if (!data.birthDate) errors.birthDate = "Birth date is required.";
  else if (ageValidation && !ageValidation.ok) errors.birthDate = ageValidation.msg;

  if (!data.gender) errors.gender = "Please select gender.";

  if (!data.email?.trim()) {
    errors.email = "Email is required.";
  } else if (!isValidEmail(data.email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!data.religion) errors.religion = "Please select religion.";
  else if (data.religion === "others_specify" && !data.customReligion?.trim()) {
    errors.customReligion = "Please specify your religion.";
  }

  if (!data.mobile.trim()) errors.mobile = "Mobile number is required.";
  else if (!normalizePHMobile(data.mobile)) {
    errors.mobile =
      "Enter a valid PH mobile number that starts with 09 or 639 (e.g., 09XXXXXXXXX or 639XXXXXXXXX).";
  }

  if (!data.street.trim()) errors.street = "Street is required.";
  if (!data.barangay.trim()) errors.barangay = "Barangay is required.";
  if (!data.city.trim()) errors.city = "City / Municipality is required.";
  if (!data.province.trim()) errors.province = "Province is required.";
  if (!data.region) errors.region = "Please select region.";

  return errors;
};

export const validateFamilyStep = ({
  motherFirst,
  motherMiddle,
  motherLast,
  motherContact,
  fatherFirst,
  fatherMiddle,
  fatherLast,
  fatherContact,
  guardianFirst,
  guardianMiddle,
  guardianLast,
  guardianContact,
}) => {
  const errors = {};

  const isFilled = (value) => !!value?.trim();

  const motherHasAny =
    isFilled(motherFirst) ||
    isFilled(motherMiddle) ||
    isFilled(motherLast) ||
    isFilled(motherContact);

  const fatherHasAny =
    isFilled(fatherFirst) ||
    isFilled(fatherMiddle) ||
    isFilled(fatherLast) ||
    isFilled(fatherContact);

  const guardianHasAny =
    isFilled(guardianFirst) ||
    isFilled(guardianMiddle) ||
    isFilled(guardianLast) ||
    isFilled(guardianContact);

  const motherComplete =
    isFilled(motherFirst) &&
    isFilled(motherMiddle) &&
    isFilled(motherLast) &&
    isFilled(motherContact);

  const fatherComplete =
    isFilled(fatherFirst) &&
    isFilled(fatherMiddle) &&
    isFilled(fatherLast) &&
    isFilled(fatherContact);

  const guardianComplete =
    isFilled(guardianFirst) &&
    isFilled(guardianMiddle) &&
    isFilled(guardianLast) &&
    isFilled(guardianContact);

  const hasAtLeastOneComplete = motherComplete || fatherComplete || guardianComplete;

  if (!hasAtLeastOneComplete) {
    errors.familyRequired =
      "Please complete at least one parent or guardian information block.";
  }

  if (motherHasAny && !motherComplete) {
    errors.motherFirst = !isFilled(motherFirst) ? "Mother's first name is required." : "";
    errors.motherMiddle = !isFilled(motherMiddle) ? "Mother's middle name is required." : "";
    errors.motherLast = !isFilled(motherLast) ? "Mother's last name is required." : "";
    errors.motherContact = !isFilled(motherContact)
      ? "Mother's contact number is required."
      : "";
  }

  if (fatherHasAny && !fatherComplete) {
    errors.fatherFirst = !isFilled(fatherFirst) ? "Father's first name is required." : "";
    errors.fatherMiddle = !isFilled(fatherMiddle) ? "Father's middle name is required." : "";
    errors.fatherLast = !isFilled(fatherLast) ? "Father's last name is required." : "";
    errors.fatherContact = !isFilled(fatherContact)
      ? "Father's contact number is required."
      : "";
  }

  if (guardianHasAny && !guardianComplete) {
    errors.guardianFirst = !isFilled(guardianFirst) ? "Guardian's first name is required." : "";
    errors.guardianMiddle = !isFilled(guardianMiddle) ? "Guardian's middle name is required." : "";
    errors.guardianLast = !isFilled(guardianLast) ? "Guardian's last name is required." : "";
    errors.guardianContact = !isFilled(guardianContact)
      ? "Guardian's contact number is required."
      : "";
  }

  if (isFilled(motherContact) && !normalizePHMobile(motherContact)) {
    errors.motherContact =
      "Enter a valid PH mobile number that starts with 09 or 639 (e.g., 09XXXXXXXXX or 639XXXXXXXXX).";
  }

  if (isFilled(fatherContact) && !normalizePHMobile(fatherContact)) {
    errors.fatherContact =
      "Enter a valid PH mobile number that starts with 09 or 639 (e.g., 09XXXXXXXXX or 639XXXXXXXXX).";
  }

  if (isFilled(guardianContact) && !normalizePHMobile(guardianContact)) {
    errors.guardianContact =
      "Enter a valid PH mobile number that starts with 09 or 639 (e.g., 09XXXXXXXXX or 639XXXXXXXXX).";
  }

  return errors;
};

export const validateDocumentsStep = ({ studentPhotoFile }) => {
  const errors = {};

  if (!studentPhotoFile) {
    errors.studentPhotoFile = "Please upload a 2x2 picture (JPG, JPEG, or PNG).";
  } else {
    if (studentPhotoFile.type && !["image/jpeg", "image/png"].includes(studentPhotoFile.type)) {
      errors.studentPhotoFile = "Photo must be in JPG or PNG format.";
    } else if (studentPhotoFile.size && studentPhotoFile.size > 5 * 1024 * 1024) {
      errors.studentPhotoFile = "Photo size must be less than 5MB.";
    }
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