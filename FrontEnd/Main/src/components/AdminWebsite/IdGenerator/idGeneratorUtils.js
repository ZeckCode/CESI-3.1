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

// Get priority parent info from enrollment data
// Priority: Mother > Father > Guardian
export const getPriorityParent = (parentInfo) => {
  if (!parentInfo) return { name: "N/A", phone: "N/A" };

  let parentName = "N/A";
  let parentPhone = "N/A";

  // Priority 1: Mother
  if (parentInfo.mother_name) {
    parentName = parentInfo.mother_name;
    parentPhone = parentInfo.mother_contact || "N/A";
  }
  // Priority 2: Father
  else if (parentInfo.father_name) {
    parentName = parentInfo.father_name;
    parentPhone = parentInfo.father_contact || "N/A";
  }
  // Priority 3: Guardian
  else if (parentInfo.guardian_name) {
    parentName = parentInfo.guardian_name;
    parentPhone = parentInfo.guardian_contact || "N/A";
  }

  return { name: parentName, phone: parentPhone };
};

// Format enrollment data for ID display
export const prepareIdData = (enrollment) => {
  // Get priority parent info
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
