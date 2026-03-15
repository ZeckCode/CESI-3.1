import React, { useState, useEffect } from "react";
import { GRADE_AGE_RULES } from "../../config/EnrollmentConfig.js";
import "../IndexWebsiteCSS/EnrollmentForm.css";

const API_BASE = "http://127.0.0.1:8000";

/* ─────────────────────────────────────────────
   COMPUTE ENROLLMENT WINDOW FROM BACKEND DATA
   (mirrors the admin-side logic exactly)
───────────────────────────────────────────── */
const computeEnrollmentWindow = (settings) => {
  const autoOpen = () => {
    const today = new Date();
    const year = today.getFullYear();
    const startYear = today.getMonth() >= 5 ? year : year - 1;
    return new Date(startYear, 5, 1); // June 1
  };

  const openDate = settings?.open_date
    ? new Date(settings.open_date + "T00:00:00")
    : autoOpen();

  const days = Math.max(1, parseInt(settings?.window_days ?? 7, 10));
  const closeDate = new Date(openDate);
  closeDate.setDate(openDate.getDate() + days - 1);
  closeDate.setHours(23, 59, 59, 999);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOpen = today >= openDate && today <= closeDate;
  const daysLeft = isOpen ? Math.ceil((closeDate - today) / 86_400_000) : 0;

  const autoAY = () => {
    const y = openDate.getFullYear();
    return `${y}-${y + 1}`;
  };
  const academicYear = settings?.academic_year || autoAY();

  const nextOpenDate = new Date(closeDate.getFullYear() + 1, 5, 1);

  return { isOpen, openDate, closeDate, daysLeft, academicYear, nextOpenDate };
};

const fmtDate = (date) =>
  date instanceof Date
    ? date.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })
    : "—";

const formatMoney = (value) => Number(value || 0).toLocaleString();

/* ─────────────────────────────────────────────
   ENROLLMENT CLOSED SCREEN
───────────────────────────────────────────── */
const EnrollmentClosed = ({ window_, onClose }) => (
  <div className="enrollment-container1">
    <div className="enrollment-closed">
      <div className="enrollment-closed__icon">🔒</div>
      <h2 className="enrollment-closed__title">Enrollment is Currently Closed</h2>
      <p className="enrollment-closed__subtitle">
        We are not accepting enrollment submissions at this time.
      </p>
      <div className="enrollment-closed__info">
        <div className="enrollment-closed__info-row">
          <span>📅 Last enrollment period</span>
          <strong>{fmtDate(window_.openDate)} – {fmtDate(window_.closeDate)}</strong>
        </div>
        <div className="enrollment-closed__info-row">
          <span>🗓 Next enrollment opens</span>
          <strong>{fmtDate(window_.nextOpenDate)}</strong>
        </div>
      </div>
      <p className="enrollment-closed__note">
        For concerns or late enrollment requests, please contact the school office directly.
      </p>
      {onClose && (
        <button className="enrollment-closed__btn" onClick={onClose}>Back to Home</button>
      )}
    </div>
  </div>
);

/* ─────────────────────────────────────────────
   MAIN ENROLLMENT FORM
───────────────────────────────────────────── */
const EnrollmentForm = ({ onClose }) => {
  /* ── Fetch settings from backend ── */
  const [settings, setSettings] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/enrollment-settings/`)
      .then((r) => r.json())
      .catch(() => null)
      .then((data) => {
        setSettings(data);
        setSettingsLoading(false);
      });
  }, []);

  /* ── Compute window from live settings ── */
  const window_ = computeEnrollmentWindow(settings);
  const { isOpen, closeDate, daysLeft, academicYear } = window_;

  /* -------------------- BASIC STATES -------------------- */
  const [studentType, setStudentType] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [paymentMode, setPaymentMode] = useState("");

  /* -------------------- STUDENT INFO -------------------- */
  const [lrn, setLrn] = useState("");
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");

  /* -------------------- CONTACT INFO -------------------- */
  const [email, setEmail] = useState("");
  const [religion, setReligion] = useState("");
  const [telephone, setTelephone] = useState("");
  const [mobile, setMobile] = useState("");
  const [parentFacebook, setParentFacebook] = useState("");

  /* -------------------- ADDRESS -------------------- */
  const [street, setStreet] = useState("");
  const [barangay, setBarangay] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [region, setRegion] = useState("");
  const [zipCode, setZipCode] = useState("");

  /* -------------------- FATHER -------------------- */
  const [fatherFirst, setFatherFirst] = useState("");
  const [fatherMiddle, setFatherMiddle] = useState("");
  const [fatherLast, setFatherLast] = useState("");
  const [fatherContact, setFatherContact] = useState("");
  const [fatherOccupation, setFatherOccupation] = useState("");

  /* -------------------- MOTHER -------------------- */
  const [motherFirst, setMotherFirst] = useState("");
  const [motherMiddle, setMotherMiddle] = useState("");
  const [motherLast, setMotherLast] = useState("");
  const [motherContact, setMotherContact] = useState("");
  const [motherOccupation, setMotherOccupation] = useState("");

  /* -------------------- GUARDIAN -------------------- */
  const [guardianFirst, setGuardianFirst] = useState("");
  const [guardianMiddle, setGuardianMiddle] = useState("");
  const [guardianLast, setGuardianLast] = useState("");
  const [guardianContact, setGuardianContact] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState("");

  const [website, setWebsite] = useState(""); // honeypot

  /* -------------------- TUITION -------------------- */
  const [tuition, setTuition] = useState(null);
  const [tuitionLoading, setTuitionLoading] = useState(false);
  const [tuitionError, setTuitionError] = useState("");

  const getTuitionKey = (grade) => {
    switch (grade) {
      case "prek":
      case "kinder":
      case "grade1":
      case "grade2":
      case "grade3":
      case "grade4":
      case "grade5":
      case "grade6":
        return grade;
      default:
        return null;
    }
  };

  const tuitionKey = getTuitionKey(gradeLevel);

  useEffect(() => {
    if (!tuitionKey) {
      setTuition(null);
      setTuitionError("");
      setTuitionLoading(false);
      return;
    }

    let isMounted = true;
    setTuitionLoading(true);
    setTuitionError("");

    fetch(`${API_BASE}/api/finance/tuition-configs/by-grade/${tuitionKey}/`)
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
        console.error("Tuition fetch error:", err);
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
  }, [tuitionKey]);

  /* ── Loading splash ── */
  if (settingsLoading) {
    return (
      <div className="enrollment-container">
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#6b7280", fontSize: 14 }}>
          Loading enrollment info…
        </div>
      </div>
    );
  }

  /* ── Closed screen ── */
  if (!isOpen) return <EnrollmentClosed window_={window_} onClose={onClose} />;

  /* -------------------- GRADE OPTIONS -------------------- */
  const gradeOptions =
    educationLevel === "preschool"
      ? [
          { value: "prek", label: "Pre-Kinder" },
          { value: "kinder", label: "Kinder" },
        ]
      : educationLevel === "elementary"
      ? [
          { value: "grade1", label: "Grade 1" },
          { value: "grade2", label: "Grade 2" },
          { value: "grade3", label: "Grade 3" },
          { value: "grade4", label: "Grade 4" },
          { value: "grade5", label: "Grade 5" },
          { value: "grade6", label: "Grade 6" },
        ]
      : [];

  /* -------------------- HELPERS -------------------- */
  const normalizePHMobile = (number) => {
    if (!number) return null;
    const cleaned = String(number).replace(/[\s\-()]/g, "");
    if (/^09\d{9}$/.test(cleaned)) return "+63" + cleaned.slice(1);
    if (/^\+639\d{9}$/.test(cleaned)) return cleaned;
    return null;
  };

  const calcAge = (yyyyMMdd) => {
    if (!yyyyMMdd) return null;
    const bd = new Date(yyyyMMdd + "T00:00:00");
    const today = new Date();
    let age = today.getFullYear() - bd.getFullYear();
    const m = today.getMonth() - bd.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
    return age;
  };

  const validateAgeForGrade = (yyyyMMdd, gradeCode) => {
    if (!yyyyMMdd || !gradeCode) return null;
    const rule = GRADE_AGE_RULES[gradeCode];
    if (!rule) return null;
    const bd = new Date(yyyyMMdd + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (bd >= today) return { ok: false, msg: "Birth date must be in the past." };
    const age = calcAge(yyyyMMdd);
    if (age < 3) return { ok: false, msg: "Student must be at least 3 years old." };
    if (age > 18) return { ok: false, msg: "Student age exceeds the allowed school range." };
    if (age < rule.min) return { ok: false, msg: `Student is too young for ${rule.label}. Minimum age is ${rule.min} (current age: ${age}).` };
    if (age > rule.max) return { ok: false, msg: `Student is too old for ${rule.label}. Maximum age is ${rule.max} (current age: ${age}).` };
    return { ok: true, msg: `Age ${age} is valid for ${rule.label} (allowed: ${rule.min}–${rule.max} yrs).` };
  };

  const ageValidation = validateAgeForGrade(birthDate, gradeLevel);

  const buildAddress = () =>
    [street, barangay, city, province, region, zipCode]
      .map((p) => p.trim())
      .filter(Boolean)
      .join(", ");

  const buildName = (first, middle, last) =>
    [first, middle, last].map((p) => p.trim()).filter(Boolean).join(" ");

  /* -------------------- SUBMIT -------------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();

    const liveSettings = await fetch(`${API_BASE}/api/enrollment-settings/`)
      .then((r) => r.json())
      .catch(() => null);

    const liveWindow = computeEnrollmentWindow(liveSettings);
    if (!liveWindow.isOpen) {
      alert("Enrollment has closed. Please try again during the next enrollment period.");
      return;
    }

    if (website && website.trim()) {
      alert("Invalid submission.");
      return;
    }
    if (!gradeLevel) {
      alert("Please select a Grade Level.");
      return;
    }
    if (!birthDate) {
      alert("Please enter the student's Birth Date.");
      return;
    }
    if (ageValidation && !ageValidation.ok) {
      alert(ageValidation.msg);
      return;
    }

    const lrnRequiredGrades = ["kinder", "grade1", "grade2", "grade3", "grade4", "grade5", "grade6"];
    if (lrnRequiredGrades.includes(gradeLevel)) {
      if (!lrn || lrn.trim() === "") {
        alert("LRN is required for this grade level (12 digits).");
        return;
      }
      if (lrn.length !== 12) {
        alert("LRN must be exactly 12 digits.");
        return;
      }
    }

    const normalizedMobile = normalizePHMobile(mobile);
    if (!normalizedMobile) {
      alert("Invalid PH mobile number.\nUse 09XXXXXXXXX or +639XXXXXXXXX format.");
      return;
    }

    const payload = {
      student_type: studentType,
      education_level: educationLevel,
      grade_level: gradeLevel,
      academic_year: academicYear,
      website,
      lrn,
      last_name: lastName,
      first_name: firstName,
      middle_name: middleName,
      birth_date: birthDate || null,
      gender,
      email,
      address: buildAddress(),
      religion,
      telephone_number: telephone,
      mobile_number: normalizedMobile,
      parent_facebook: parentFacebook,
      payment_mode: paymentMode,
      remarks: "",
      parent_info: {
        father_name: buildName(fatherFirst, fatherMiddle, fatherLast),
        father_contact: fatherContact,
        father_occupation: fatherOccupation,
        mother_name: buildName(motherFirst, motherMiddle, motherLast),
        mother_contact: motherContact,
        mother_occupation: motherOccupation,
        guardian_name: buildName(guardianFirst, guardianMiddle, guardianLast),
        guardian_contact: guardianContact,
        guardian_relationship: guardianRelationship,
      },
    };

    try {
      const response = await fetch(`${API_BASE}/api/enrollments/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        console.error("Submission Error:", data);
        alert("Error: " + JSON.stringify(data));
        return;
      }

      await response.json();
      alert("Enrollment submitted successfully!");
      if (onClose) onClose();
    } catch (err) {
      console.error("Network error:", err);
      alert("Network error. Check if Backend is running.");
    }
  };

  const maxBirthDate = new Date().toISOString().split("T")[0];

  return (
    <div className="enrollment-container">
      <h2>Enrollment Form</h2>

      <div className={`enrollment-window-notice ${daysLeft === 1 ? "enrollment-window-notice--urgent" : ""}`}>
        <span></span>
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
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        <h3>🎓 Academic Information</h3>
        <div className="form-grid">
          <div className="form-group">
            <label>
              LRN {["kinder", "grade1", "grade2", "grade3", "grade4", "grade5", "grade6"].includes(gradeLevel) && <span className="required">*</span>}
            </label>
            <input
              value={lrn}
              onChange={(e) => setLrn(e.target.value.replace(/\D/g, ""))}
              placeholder={
                ["kinder", "grade1", "grade2", "grade3", "grade4", "grade5", "grade6"].includes(gradeLevel)
                  ? "12 digits (required)"
                  : "Pre-Kinder students may leave blank"
              }
              maxLength="12"
              inputMode="numeric"
            />
            {lrn &&
              lrn.length !== 12 &&
              ["kinder", "grade1", "grade2", "grade3", "grade4", "grade5", "grade6"].includes(gradeLevel) && (
                <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>
                  LRN must be exactly 12 digits ({lrn.length}/12)
                </div>
              )}
          </div>

          <div className="form-group">
            <label>Student Type</label>
            <select value={studentType} onChange={(e) => setStudentType(e.target.value)}>
              <option value="">Select</option>
              <option value="new">New / Transferee</option>
              <option value="old">Old Student</option>
            </select>
          </div>

          <div className="form-group">
            <label>Education Level<span className="required">*</span></label>
            <select
              value={educationLevel}
              onChange={(e) => {
                setEducationLevel(e.target.value);
                setGradeLevel("");
                setTuition(null);
                setTuitionError("");
              }}
              required
            >
              <option value="">Select</option>
              <option value="preschool">Preschool</option>
              <option value="elementary">Elementary</option>
            </select>
          </div>

          <div className="form-group">
            <label>Grade Level<span className="required">*</span></label>
            <select
              value={gradeLevel}
              disabled={!educationLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              required
            >
              <option value="">Select</option>
              {gradeOptions.map((g) => {
                const rule = GRADE_AGE_RULES[g.value];
                return (
                  <option key={g.value} value={g.value}>
                    {g.label}{rule ? ` (age ${rule.min}–${rule.max})` : ""}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <h3>👤 Student Information</h3>
        <div className="form-grid">
          <div className="form-group">
            <label>Last Name <span className="required">*</span></label>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>First Name <span className="required">*</span></label>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Middle Name <span className="required">*</span></label>
            <input value={middleName} onChange={(e) => setMiddleName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Birth Date <span className="required">*</span></label>
            <input type="date" value={birthDate} max={maxBirthDate} onChange={(e) => setBirthDate(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Gender<span className="required">*</span></label>
            <select value={gender} onChange={(e) => setGender(e.target.value)} required>
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
        </div>

        {ageValidation && (
          <div className={`age-validation-hint ${ageValidation.ok ? "age-validation-hint--ok" : "age-validation-hint--error"}`}>
            <span>{ageValidation.ok ? "✓" : "✗"}</span>
            <span>{ageValidation.msg}</span>
          </div>
        )}

        {educationLevel && (
          <details className="age-reference">
            <summary>📋 Age requirements per grade level</summary>
            <table className="age-reference__table">
              <thead>
                <tr>
                  <th>Grade</th>
                  <th>Min Age</th>
                  <th>Max Age</th>
                </tr>
              </thead>
              <tbody>
                {gradeOptions.map((g) => {
                  const rule = GRADE_AGE_RULES[g.value];
                  const age = calcAge(birthDate);
                  const isSelected = gradeLevel === g.value;
                  const inRange = age !== null && rule && age >= rule.min && age <= rule.max;
                  return (
                    <tr
                      key={g.value}
                      className={isSelected ? (inRange ? "age-ref-row--valid" : "age-ref-row--invalid") : ""}
                    >
                      <td>{g.label}</td>
                      <td>{rule?.min}</td>
                      <td>{rule?.max}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </details>
        )}

        <h3>📞 Contact Information</h3>
        <div className="form-grid">
          <div className="form-group">
            <label>Email <span className="required">*</span></label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="parent@email.com"
              required
            />
          </div>
          <div className="form-group">
            <label>Religion<span className="required">*</span></label>
            <input value={religion} onChange={(e) => setReligion(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Telephone</label>
            <input value={telephone} onChange={(e) => setTelephone(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Mobile Number <span className="required">*</span></label>
            <input
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="09XXXXXXXXX or +639XXXXXXXXX"
              required
            />
          </div>
          <div className="form-group">
            <label>Parent Facebook<span className="required">*</span></label>
            <input value={parentFacebook} onChange={(e) => setParentFacebook(e.target.value)} required />
          </div>
        </div>

        <h3>📍 Address</h3>
        <div className="form-grid">
          <div className="form-group form-group--full">
            <label>House No. / Street<span className="required">*</span></label>
            <input
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder="e.g. 123 Rizal St."
              required
            />
          </div>
          <div className="form-group">
            <label>Barangay<span className="required">*</span></label>
            <input
              value={barangay}
              onChange={(e) => setBarangay(e.target.value)}
              placeholder="e.g. Brgy. Santo Niño"
              required
            />
          </div>
          <div className="form-group">
            <label>City / Municipality<span className="required">*</span></label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Caloocan City"
              required
            />
          </div>
          <div className="form-group">
            <label>Province<span className="required">*</span></label>
            <input
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              placeholder="e.g. Metro Manila"
              required
            />
          </div>
          <div className="form-group">
            <label>Region<span className="required">*</span></label>
            <select value={region} onChange={(e) => setRegion(e.target.value)} required>
              <option value="">Select Region</option>
              <option value="NCR">NCR – National Capital Region</option>
              <option value="Region I">Region I – Ilocos Region</option>
              <option value="Region II">Region II – Cagayan Valley</option>
              <option value="Region III">Region III – Central Luzon</option>
              <option value="Region IV-A">Region IV-A – CALABARZON</option>
              <option value="Region IV-B">Region IV-B – MIMAROPA</option>
              <option value="Region V">Region V – Bicol Region</option>
              <option value="Region VI">Region VI – Western Visayas</option>
              <option value="Region VII">Region VII – Central Visayas</option>
              <option value="Region VIII">Region VIII – Eastern Visayas</option>
              <option value="Region IX">Region IX – Zamboanga Peninsula</option>
              <option value="Region X">Region X – Northern Mindanao</option>
              <option value="Region XI">Region XI – Davao Region</option>
              <option value="Region XII">Region XII – SOCCSKSARGEN</option>
              <option value="Region XIII">Region XIII – Caraga</option>
              <option value="CAR">CAR – Cordillera Administrative Region</option>
              <option value="BARMM">BARMM – Bangsamoro</option>
            </select>
          </div>
          <div className="form-group">
            <label>ZIP Code<span className="required">*</span></label>
            <input
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              placeholder="e.g. 1400"
              maxLength={4}
              inputMode="numeric"
              required
            />
          </div>
        </div>

        {buildAddress() && (
          <div className="address-preview">
            <span>📌</span>
            <span>{buildAddress()}</span>
          </div>
        )}

        <h3>👨‍👩‍👧 Parent / Guardian Information</h3>

        <p className="parent-section-label">Mother</p>
        <div className="form-grid">
          <div className="form-group">
            <label>First Name</label>
            <input value={motherFirst} onChange={(e) => setMotherFirst(e.target.value)} placeholder="First name" />
          </div>
          <div className="form-group">
            <label>Middle Name</label>
            <input value={motherMiddle} onChange={(e) => setMotherMiddle(e.target.value)} placeholder="Middle name" />
          </div>
          <div className="form-group">
            <label>Last Name</label>
            <input value={motherLast} onChange={(e) => setMotherLast(e.target.value)} placeholder="Last name" />
          </div>
          <div className="form-group">
            <label>Contact Number</label>
            <input value={motherContact} onChange={(e) => setMotherContact(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Occupation</label>
            <input value={motherOccupation} onChange={(e) => setMotherOccupation(e.target.value)} />
          </div>
        </div>

        <p className="parent-section-label">Father</p>
        <div className="form-grid">
          <div className="form-group">
            <label>First Name</label>
            <input value={fatherFirst} onChange={(e) => setFatherFirst(e.target.value)} placeholder="First name" />
          </div>
          <div className="form-group">
            <label>Middle Name</label>
            <input value={fatherMiddle} onChange={(e) => setFatherMiddle(e.target.value)} placeholder="Middle name" />
          </div>
          <div className="form-group">
            <label>Last Name</label>
            <input value={fatherLast} onChange={(e) => setFatherLast(e.target.value)} placeholder="Last name" />
          </div>
          <div className="form-group">
            <label>Contact Number</label>
            <input value={fatherContact} onChange={(e) => setFatherContact(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Occupation</label>
            <input value={fatherOccupation} onChange={(e) => setFatherOccupation(e.target.value)} />
          </div>
        </div>

        <p className="parent-section-label">
          Guardian <span style={{ fontWeight: 400, color: "#9ca3af" }}>(if applicable)</span>
        </p>
        <div className="form-grid">
          <div className="form-group">
            <label>First Name</label>
            <input value={guardianFirst} onChange={(e) => setGuardianFirst(e.target.value)} placeholder="First name" />
          </div>
          <div className="form-group">
            <label>Middle Name</label>
            <input value={guardianMiddle} onChange={(e) => setGuardianMiddle(e.target.value)} placeholder="Middle name" />
          </div>
          <div className="form-group">
            <label>Last Name</label>
            <input value={guardianLast} onChange={(e) => setGuardianLast(e.target.value)} placeholder="Last name" />
          </div>
          <div className="form-group">
            <label>Contact Number</label>
            <input value={guardianContact} onChange={(e) => setGuardianContact(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Relationship to Student</label>
            <input
              value={guardianRelationship}
              onChange={(e) => setGuardianRelationship(e.target.value)}
              placeholder="e.g. Sibling, Aunt/Uncle, Grandparent"
            />
          </div>
        </div>

        <h3>💰 Payment Information</h3>
        <div className="form-group">
          <label>Payment Mode <span className="required">*</span></label>
          <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} required>
            <option value="">Select</option>
            <option value="cash">Cash</option>
            <option value="installment">Installment</option>
          </select>
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
              <div className="tuition-row" style={{ color: "#dc2626" }}>
                <span>{tuitionError}</span>
              </div>
            )}

            {!tuitionLoading && tuition && paymentMode === "cash" && (
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
                    ₱{formatMoney(Number(tuition.total_cash || 0) + (studentType === "new" ? Number(tuition.assessment || 0) : 0))}
                  </strong>
                </div>
              </>
            )}

            {!tuitionLoading && tuition && paymentMode === "installment" && (
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
                    ₱{formatMoney(Number(tuition.total_installment || 0) + (studentType === "new" ? Number(tuition.assessment || 0) : 0))}
                  </strong>
                </div>
              </>
            )}
          </div>
        )}

        <div className="form-actions">
          <button
            type="submit"
            disabled={(ageValidation !== null && !ageValidation.ok) || tuitionLoading}
          >
            Submit Enrollment
          </button>
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
};

export default EnrollmentForm;