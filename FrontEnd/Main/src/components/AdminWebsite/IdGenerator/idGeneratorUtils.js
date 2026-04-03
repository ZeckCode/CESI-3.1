// Default school information - customize with your actual school data
export const DEFAULT_SCHOOL_INFO = {
  name: "Caloocan Evangelical School Inc.",
  motto: "Quality Christian Education for All",
  logo_url: "/CESI-logo.jpg",
  colors: {
    primary: "#667eea",
    secondary: "#764ba2",
    accent: "#3b82f6",
  },
  address: "#47 P. Zamora St. Caloocan City, Metro Manila",
  phone: "(02) 8-285-3702 / 0905-299-6303",
  email: "caloocanevangelicalschool@gmail.com",
  copyright: "© 2025 CESI. All rights reserved.",
};

// Function to fetch school info from backend if needed
export const fetchSchoolInfo = async () => {
  try {
    const res = await fetch("/api/school/info/");
    if (res.ok) {
      return await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch school info:", error);
  }
  return DEFAULT_SCHOOL_INFO;
};

// Grade level mapping - convert codes to display names
export const GRADE_LEVEL_MAP = {
  prek: "Preschool",
  kinder: "Kinder",
  grade1: "Grade 1",
  grade2: "Grade 2",
  grade3: "Grade 3",
  grade4: "Grade 4",
  grade5: "Grade 5",
  grade6: "Grade 6",
};

// Get display name for grade level
export const getGradeLevelDisplay = (code) => {
  return GRADE_LEVEL_MAP[code] || code || "N/A";
};

const cleanValue = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const pickFirstNonEmpty = (...values) => {
  for (const value of values) {
    const cleaned = cleanValue(value);
    if (cleaned) return cleaned;
  }
  return "";
};

// Get priority parent info from enrollment data
// Priority: Mother > Father > Guardian
export const getPriorityParent = (parentInfo, enrollment = {}) => {
  // support array payloads too
  const info = Array.isArray(parentInfo) ? parentInfo[0] || {} : parentInfo || {};

  const motherName = pickFirstNonEmpty(
    info.mother_name,
    info.mother_full_name,
    info.mother
  );
  const motherPhone = pickFirstNonEmpty(
    info.mother_contact,
    info.mother_phone,
    info.mother_contact_number
  );

  const fatherName = pickFirstNonEmpty(
    info.father_name,
    info.father_full_name,
    info.father
  );
  const fatherPhone = pickFirstNonEmpty(
    info.father_contact,
    info.father_phone,
    info.father_contact_number
  );

  const guardianName = pickFirstNonEmpty(
    info.guardian_name,
    info.guardian_full_name,
    info.guardian
  );
  const guardianPhone = pickFirstNonEmpty(
    info.guardian_contact,
    info.guardian_phone,
    info.guardian_contact_number
  );

  const fallbackName = pickFirstNonEmpty(
    info.parent_name,
    info.contact_person,
    enrollment.parent_name,
    enrollment.guardian_name,
    enrollment.mother_name,
    enrollment.father_name
  );

  const fallbackPhone = pickFirstNonEmpty(
    info.parent_phone,
    info.contact_number,
    enrollment.parent_phone,
    enrollment.guardian_contact,
    enrollment.mother_contact,
    enrollment.father_contact
  );

  if (motherName) {
    return { name: motherName, phone: motherPhone || fallbackPhone || "N/A" };
  }

  if (fatherName) {
    return { name: fatherName, phone: fatherPhone || fallbackPhone || "N/A" };
  }

  if (guardianName) {
    return { name: guardianName, phone: guardianPhone || fallbackPhone || "N/A" };
  }

  return {
    name: fallbackName || "N/A",
    phone: fallbackPhone || "N/A",
  };
};

// Format enrollment data for ID display
export const prepareIdData = (source = {}) => {
  const enrollment = source?.raw || source;
  const parentData = getPriorityParent(enrollment.parent_info);

  return {
    first_name: enrollment.first_name || "",
    last_name: enrollment.last_name || "",
    middle_name: enrollment.middle_name || "",
    grade_level: enrollment.grade_level || "",
    academic_year: enrollment.academic_year || "2025-2026",
    lrn: enrollment.lrn || "",
    birth_date: enrollment.birth_date || "",
    id_image_url: enrollment.id_image_url || "",
    section_name: enrollment.section_name || "",
    student_type: enrollment.student_type || "",
    parent_name: parentData.name,
    parent_phone: parentData.phone,
    id: enrollment.student_number || enrollment.id || "",
  };
};
