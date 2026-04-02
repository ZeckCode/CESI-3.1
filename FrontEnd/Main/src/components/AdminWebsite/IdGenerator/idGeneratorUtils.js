// Default school information - customize with your actual school data
export const DEFAULT_SCHOOL_INFO = {
  name: "Caloocan Evangelical School Inc.",
  motto: "Quality Christian Education for All",
  logo_url: "/assets/CESI-logo.jpg",
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

// Format enrollment data for ID display
export const prepareIdData = (enrollment) => ({
  first_name: enrollment.first_name || "",
  last_name: enrollment.last_name || "",
  middle_name: enrollment.middle_name || "",
  grade_level: enrollment.grade_level || "",
  academic_year: enrollment.academic_year || "2024-2025",
  lrn: enrollment.lrn || "",
  birth_date: enrollment.birth_date || "",
  id_image_url: enrollment.id_image_url || "",
  section_name: enrollment.section_name || "",
  student_type: enrollment.student_type || "",
});
