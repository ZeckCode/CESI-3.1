export const gradeLabel = (code) =>
  (
    {
      prek: "Pre-Kinder",
      kinder: "Kindergarten",
      grade1: "Grade 1",
      grade2: "Grade 2",
      grade3: "Grade 3",
      grade4: "Grade 4",
      grade5: "Grade 5",
      grade6: "Grade 6",
    }[code] || code || ""
  );

export const statusLabel = (s) =>
  (
    {
      ACTIVE: "Active",
      PENDING: "Pending",
      DROPPED: "Dropped",
      COMPLETED: "Completed",
    }[s] || s || ""
  );

export const matchesStatusFilter = (filterStatus, statusText) => {
  if (filterStatus === "All") return true;
  return statusText === filterStatus;
};

export const GRADE_AGE_RULES = {
  prek: { min: 3, max: 5, label: "Pre-Kinder" },
  kinder: { min: 4, max: 6, label: "Kindergarten" },
  grade1: { min: 5, max: 7, label: "Grade 1" },
  grade2: { min: 6, max: 8, label: "Grade 2" },
  grade3: { min: 7, max: 9, label: "Grade 3" },
  grade4: { min: 8, max: 10, label: "Grade 4" },
  grade5: { min: 9, max: 11, label: "Grade 5" },
  grade6: { min: 10, max: 12, label: "Grade 6" },
};

export const GRADE_PROGRESSION = {
  prek: { next: "kinder", nextEdu: "preschool" },
  kinder: { next: "grade1", nextEdu: "elementary" },
  grade1: { next: "grade2", nextEdu: "elementary" },
  grade2: { next: "grade3", nextEdu: "elementary" },
  grade3: { next: "grade4", nextEdu: "elementary" },
  grade4: { next: "grade5", nextEdu: "elementary" },
  grade5: { next: "grade6", nextEdu: "elementary" },
  grade6: { next: null, nextEdu: null },
};

export const getNextGrade = (gradeCode) =>
  GRADE_PROGRESSION[gradeCode] || { next: null, nextEdu: null };

export const getCurrentAcademicYear = () => {
  const today = new Date();
  const year = today.getFullYear();
  return today.getMonth() >= 5 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
};

export const advanceAcademicYear = (academicYear) => {
  if (!academicYear) return getCurrentAcademicYear();
  const parts = String(academicYear).split("-");
  if (parts.length !== 2) return getCurrentAcademicYear();

  const end = parseInt(parts[1], 10);
  if (Number.isNaN(end)) return getCurrentAcademicYear();

  return `${end}-${end + 1}`;
};

export const validateAgeForGrade = (birthDate, gradeCode) => {
  if (!birthDate || !gradeCode) return true;

  const rule = GRADE_AGE_RULES[gradeCode];
  if (!rule) return true;

  const bd = new Date(`${birthDate}T00:00:00`);
  const today = new Date();

  let age = today.getFullYear() - bd.getFullYear();
  const m = today.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;

  if (age < rule.min) {
    return `Student is too young for ${rule.label}. Minimum age is ${rule.min} (current age: ${age}).`;
  }

  if (age > rule.max) {
    return `Student is too old for ${rule.label}. Maximum age is ${rule.max} (current age: ${age}).`;
  }

  return true;
};



export const fmtDate = (date) =>
  date instanceof Date
    ? date.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

export const computeEnrollmentWindow = (settings) => {
  const autoOpen = () => {
    const today = new Date();
    const year = today.getFullYear();
    const startYear = today.getMonth() >= 5 ? year : year - 1;
    return new Date(startYear, 5, 1);
  };

  const openDate = settings?.open_date
    ? new Date(`${settings.open_date}T00:00:00`)
    : autoOpen();

  const days = Math.max(1, parseInt(settings?.window_days ?? 7, 10));
  const closeDate = new Date(openDate);
  closeDate.setDate(openDate.getDate() + days - 1);
  closeDate.setHours(23, 59, 59, 999);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isOpen = today >= openDate && today <= closeDate;
  const daysLeft = isOpen ? Math.ceil((closeDate - today) / 86400000) : 0;

  const autoAY = () => {
    const y = openDate.getFullYear();
    return `${y}-${y + 1}`;
  };

  const academicYear = settings?.academic_year || autoAY();

  return { isOpen, openDate, closeDate, daysLeft, academicYear };
};

export const splitFullName = (fullName = "") => {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return { first: "", middle: "", last: "" };
  if (parts.length === 1) return { first: parts[0], middle: "", last: "" };
  if (parts.length === 2) return { first: parts[0], middle: "", last: parts[1] };

  return {
    first: parts[0],
    middle: parts.slice(1, -1).join(" "),
    last: parts[parts.length - 1],
  };
};

export const buildName = (first, middle, last) =>
  [first, middle, last]
    .map((p) => String(p || "").trim())
    .filter(Boolean)
    .join(" ");

export const splitAddress = (address = "") => {
  const parts = String(address).split(",").map((p) => p.trim());

  return {
    street: parts[0] || "",
    barangay: parts[1] || "",
    city: parts[2] || "",
    province: parts[3] || "",
    region: parts[4] || "",
    zip_code: parts[5] || "",
  };
};

export const buildAddress = ({ street, barangay, city, province, region, zip_code }) =>
  [street, barangay, city, province, region, zip_code]
    .map((p) => String(p || "").trim())
    .filter(Boolean)
    .join(", ");

export const emptyForm = () => ({
  first_name: "",
  last_name: "",
  middle_name: "",
  birth_date: "",
  gender: "",
  lrn: "",
  education_level: "",
  grade_level: "",
  student_type: "",
  academic_year: "2024-2025",
  status: "PENDING",
  payment_mode: "",
  section: "",
  email: "",
  religion: "",
  telephone_number: "",
  mobile_number: "",
  parent_facebook: "",
  street: "",
  barangay: "",
  city: "",
  province: "",
  region: "",
  zip_code: "",
  remarks: "",
  parent_info: {
    father_first: "",
    father_middle: "",
    father_last: "",
    father_contact: "",
    father_occupation: "",
    mother_first: "",
    mother_middle: "",
    mother_last: "",
    mother_contact: "",
    mother_occupation: "",
    guardian_first: "",
    guardian_middle: "",
    guardian_last: "",
    guardian_contact: "",
    guardian_relationship: "",
  },
});

export const todayISO = () => new Date().toISOString().split("T")[0];

export const calcAge = (yyyyMMdd) => {
  if (!yyyyMMdd) return null;

  const bd = new Date(`${yyyyMMdd}T00:00:00`);
  const now = new Date();

  let age = now.getFullYear() - bd.getFullYear();
  const m = now.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < bd.getDate())) age--;

  return age;
};

export const validateBirthDate = (yyyyMMdd) => {
  if (!yyyyMMdd) return true;

  const bd = new Date(`${yyyyMMdd}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (bd >= today) return "Birth date must be in the past.";

  const age = calcAge(yyyyMMdd);
  if (age < 3) return "Student must be at least 3 years old.";
  if (age > 18) return "Student age exceeds allowed school range.";

  return true;
};

export const normalizePHMobile = (number) => {
  if (!number) return "";

  const cleaned = String(number).replace(/[\s\-()]/g, "");
  if (/^09\d{9}$/.test(cleaned)) return `+63${cleaned.slice(1)}`;
  if (/^\+639\d{9}$/.test(cleaned)) return cleaned;

  return null;
};

export const normalizeSectionGrade = (value) => {
  const v = String(value ?? "").trim().toLowerCase();

  if (v === "0" || v === "k" || v === "kinder" || v === "kindergarten") return "kinder";
  if (v === "prek" || v === "pre-k" || v === "pre kinder" || v === "pre-kinder") return "prek";
  if (v === "1" || v === "grade1" || v === "grade 1") return "grade1";
  if (v === "2" || v === "grade2" || v === "grade 2") return "grade2";
  if (v === "3" || v === "grade3" || v === "grade 3") return "grade3";
  if (v === "4" || v === "grade4" || v === "grade 4") return "grade4";
  if (v === "5" || v === "grade5" || v === "grade 5") return "grade5";
  if (v === "6" || v === "grade6" || v === "grade 6") return "grade6";

  return v;
};