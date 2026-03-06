<<<<<<< Updated upstream
<<<<<<< Updated upstream

=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
/* ============================================================
   ENROLLMENT WINDOW CONFIG
   ============================================================
   Admin: Set ENROLLMENT_OPEN_DATE to manually override the
   enrollment start date. Format: "YYYY-MM-DD"

   Leave ENROLLMENT_OPEN_DATE as null to use the auto-calculated
   default, which is June 1 of the current school year.

   The enrollment window is always 7 days from the open date.
   Example: "2025-06-01" → window is June 1–7, 2025.
   ============================================================ */

export const ENROLLMENT_OPEN_DATE = null; // ← Admin sets this: e.g. "2025-06-01"
export const ENROLLMENT_WINDOW_DAYS = 7;  // ← Duration in days (default: 1 week)


/* ============================================================
   AGE REQUIREMENTS PER GRADE (Philippine DepEd Standard)
   min and max are the allowed ages AT TIME OF ENROLLMENT
   ============================================================ */
export const GRADE_AGE_RULES = {
  prek:   { min: 3,  max: 5,  label: "Pre-Kinder"   },
  kinder: { min: 4,  max: 6,  label: "Kindergarten"  },
  grade1: { min: 5,  max: 7,  label: "Grade 1"       },
  grade2: { min: 6,  max: 8,  label: "Grade 2"       },
  grade3: { min: 7,  max: 9,  label: "Grade 3"       },
  grade4: { min: 8,  max: 10, label: "Grade 4"       },
  grade5: { min: 9,  max: 11, label: "Grade 5"       },
  grade6: { min: 10, max: 12, label: "Grade 6"       },
};


/* ============================================================
   AUTO-CALCULATED ENROLLMENT WINDOW
   (do not edit below unless you know what you're doing)
   ============================================================ */

/**
 * Returns the auto-calculated enrollment open date.
 * Default: June 1 of the current school year's start year.
 * e.g. if today is March 2026 → school year is 2025-2026 → June 1, 2025
 *      if today is August 2025 → school year is 2025-2026 → June 1, 2025
 */
const getAutoOpenDate = () => {
  const today = new Date();
  const year  = today.getFullYear();
  const month = today.getMonth(); // 0 = Jan, 5 = June

  // School year starts June → if before June, use previous year
  const startYear = month >= 5 ? year : year - 1;
  return new Date(startYear, 5, 1); // June 1
};

/**
 * Returns { isOpen, openDate, closeDate, daysLeft, nextOpenDate }
 * isOpen      — true if today is within the enrollment window
 * openDate    — Date object for window start
 * closeDate   — Date object for window end (openDate + ENROLLMENT_WINDOW_DAYS)
 * daysLeft    — days remaining in the window (0 if closed)
 * nextOpenDate — next June 1 open date (for "closed" message)
 */
export const getEnrollmentWindow = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Use admin-set date if provided, otherwise auto-calculate
  const openDate = ENROLLMENT_OPEN_DATE
    ? (() => { const d = new Date(ENROLLMENT_OPEN_DATE + "T00:00:00"); return d; })()
    : getAutoOpenDate();

  const closeDate = new Date(openDate);
  closeDate.setDate(openDate.getDate() + ENROLLMENT_WINDOW_DAYS - 1);
  closeDate.setHours(23, 59, 59, 999);

  const isOpen = today >= openDate && today <= closeDate;

  const daysLeft = isOpen
    ? Math.ceil((closeDate - today) / (1000 * 60 * 60 * 24))
    : 0;

  // Next open date: next June 1 after closeDate
  const nextYear     = closeDate.getFullYear() + 1;
  const nextOpenDate = new Date(nextYear, 5, 1);

  return { isOpen, openDate, closeDate, daysLeft, nextOpenDate };
};


/**
 * Formats a Date object to a readable string
 * e.g. "June 1, 2025"
 */
export const formatDate = (date) =>
  date.toLocaleDateString("en-PH", {
    year: "numeric", month: "long", day: "numeric",
  });