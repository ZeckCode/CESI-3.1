import React, { useEffect, useMemo, useState, useRef } from "react";
import { Camera, Edit3, X, Check, User } from "lucide-react";
import "../StudentWebsiteCSS/Profile.css";
import { getToken } from "../Auth/auth";

const API_BASE = "";

const PROFILE_ENDPOINTS = [
  "/api/accounts/me-detail/",
  "/api/accounts/me/detail/",
];

const UPDATE_ENDPOINTS = [
  "/api/accounts/update-profile/",
  "/api/accounts/me/update/",
];

const gradeLabelFromProfile = (raw) => {
  if (raw == null) return "—";
  const v = String(raw).trim();

  const pretty = new Set([
    "Pre-Kinder",
    "Kinder",
    "Grade 1",
    "Grade 2",
    "Grade 3",
    "Grade 4",
    "Grade 5",
    "Grade 6",
  ]);
  if (pretty.has(v)) return v;

  if (/^\d+$/.test(v)) return `Grade ${v}`;

  const map = {
    prek: "Pre-Kinder",
    kinder: "Kinder",
    grade1: "Grade 1",
    grade2: "Grade 2",
    grade3: "Grade 3",
    grade4: "Grade 4",
    grade5: "Grade 5",
    grade6: "Grade 6",
  };
  return map[v.toLowerCase()] || v;
};

const formatFullName = (...parts) =>
  parts
    .filter(Boolean)
    .map((p) => String(p).trim())
    .filter(Boolean)
    .join(" ");

// Format enrollment status for display
const formatEnrollmentStatus = (status) => {
  const statusMap = {
    "PENDING": "Pending",
    "ACTIVE": "Active",
    "COMPLETED": "Completed",
    "DROPPED": "Dropped",
  };
  return statusMap[String(status).toUpperCase()] || status || "—";
};

async function fetchWithToken(url, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Token ${token}` } : {}),
  };

  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  return res;
}

async function tryProfileEndpoints() {
  let lastError = null;

  for (const endpoint of PROFILE_ENDPOINTS) {
    try {
      const res = await fetchWithToken(endpoint, { method: "GET" });
      const text = await res.text();

      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = { detail: text };
      }

      if (res.ok) {
        return { data: json, endpoint };
      }

      lastError = new Error(
        json?.detail || `Request failed (${res.status}) at ${endpoint}`
      );
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Unable to load profile.");
}

async function tryUpdateEndpoints(formData) {
  let lastError = null;

  for (const endpoint of UPDATE_ENDPOINTS) {
    try {
      const res = await fetchWithToken(endpoint, {
        method: "PATCH",
        body: formData,
      });

      const text = await res.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = { detail: text };
      }

      if (res.ok) {
        return { data: json, endpoint };
      }

      lastError = new Error(
        json?.detail || `Save failed (${res.status}) at ${endpoint}`
      );
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Unable to save profile.");
}

const Profile = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editForm, setEditForm] = useState({});
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const fileInputRef = useRef(null);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError("");

      const result = await tryProfileEndpoints();
      const json = result.data;

      console.log("Profile loaded from:", result.endpoint, json);

      setData(json);

      const p = json?.profile || {};
      setEditForm({
        parent_first_name: p.parent_first_name || "",
        parent_middle_name: p.parent_middle_name || "",
        parent_last_name: p.parent_last_name || "",
        contact_number: p.contact_number || "",
        address: p.address || "",
      });
    } catch (e) {
      console.error("Failed to load profile:", e);
      setError(e.message || "Failed to load profile.");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const studentData = useMemo(() => {
    const u = data || {};
    const p = u.profile || {};
    const e = u.enrollment || {};
    const pi = e.parent_info || {};

    const studentName = formatFullName(
      p.student_first_name || e.first_name,
      p.student_middle_name || e.middle_name,
      p.student_last_name || e.last_name
    );

    const guardianName =
      formatFullName(
        p.parent_first_name,
        p.parent_middle_name,
        p.parent_last_name
      ) ||
      pi.guardian_name ||
      pi.mother_name ||
      pi.father_name ||
      "—";

    const grade = gradeLabelFromProfile(p.grade_level || e.grade_level);
    const sectionName =
      p.section?.name || e.section_details?.name || e.section_name || "—";
    const sectionDisplay =
      sectionName && sectionName !== "No Section" ? sectionName : "—";

    return {
      name: studentName ? studentName.toUpperCase() : (u.username || "—").toUpperCase(),
      first_name: p.student_first_name || e.first_name || "—",
      middle_name: p.student_middle_name || e.middle_name || "—",
      last_name: p.student_last_name || e.last_name || "—",
      lrn: p.lrn || e.lrn || "—",
      student_number: p.student_number || e.student_number || "—",
      grade_display: `${grade} - ${sectionDisplay}`,
      email: u.email || e.email || "—",
      address: p.address || e.address || "—",
      guardian: guardianName,
      contact: p.contact_number || e.mobile_number || e.telephone_number || "—",
      payment_mode: p.payment_mode || e.payment_mode || "—",
      status: e.status || u.status || "—",
      avatar_url: p.avatar_url || null,
      schoolYear: e.academic_year || "—",
      birth_date: e.birth_date || "—",
      gender: e.gender || "—",
      religion: e.religion || "—",
      education_level: e.education_level || "—",
      student_type: e.student_type || "—",
      father_name: pi.father_name || "—",
      father_contact: pi.father_contact || "—",
      mother_name: pi.mother_name || "—",
      mother_contact: pi.mother_contact || "—",
      guardian_name: pi.guardian_name || "—",
      guardian_contact: pi.guardian_contact || "—",
      guardian_relationship: pi.guardian_relationship || "—",
    };
  }, [data]);

  const handleAvatarClick = () => {
    if (isEditing && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleEditChange = (field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");

    try {
      const formData = new FormData();

      Object.entries(editForm).forEach(([key, value]) => {
        formData.append(key, value ?? "");
      });

      if (avatarFile) {
        formData.append("avatar", avatarFile);
      }

      const result = await tryUpdateEndpoints(formData);
      console.log("Profile saved via:", result.endpoint);

      await loadProfile();
      setIsEditing(false);
      setAvatarFile(null);
      setAvatarPreview(null);
    } catch (e) {
      console.error("Error saving profile:", e);
      setError(e.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setAvatarFile(null);
    setAvatarPreview(null);

    const p = data?.profile || {};
    setEditForm({
      parent_first_name: p.parent_first_name || "",
      parent_middle_name: p.parent_middle_name || "",
      parent_last_name: p.parent_last_name || "",
      contact_number: p.contact_number || "",
      address: p.address || "",
    });
  };

  if (loading) {
    return (
      <div className="profile-content">
        <div className="loading-spinner">Loading profile...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="profile-content">
        <div className="error-message">{error || "Profile not found."}</div>
      </div>
    );
  }

  if (data.role !== "PARENT_STUDENT") {
    return (
      <div className="profile-content">
        <div className="error-message">Forbidden: not a student account.</div>
      </div>
    );
  }

  const displayAvatar = avatarPreview || studentData.avatar_url;

  return (
    <div className="profile-content">
      {error ? <div className="error-message">{error}</div> : null}

      <header className="profile-header-flex">
         

        <div hidden className="header-actions">
          {isEditing ? (
            <>
              <button
                type="button"
                className="btn-cancel"
                onClick={handleCancel}
                disabled={saving}
              >
                <X size={16} /> Cancel
              </button>

              <button
                type="button"
                className="btn-save"
                onClick={handleSave}
                disabled={saving}
              >
                <Check size={16} /> {saving ? "Saving..." : "Save Changes"}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="edit-profile-btn"
              onClick={() => setIsEditing(true)}
            >
              <Edit3 size={16} /> Edit Profile
            </button>
          )}
        </div>
      </header>

      <div className="profile-hero-card">
        <div className="hero-main-info">
          <div
            className={`hero-avatar ${isEditing ? "editable" : ""}`}
            onClick={handleAvatarClick}
          >
            {displayAvatar ? (
              <img src={displayAvatar} alt="Avatar" />
            ) : (
              <div className="avatar-placeholder">
                <User size={48} />
              </div>
            )}

            {/* {isEditing && (
              <div hdi className="avatar-overlay">
                <Camera size={24} />
                <span>Change Photo</span>
              </div>
            )} */}

            <span className={`status-badge ${String(studentData.status).toLowerCase()}`}>
              {formatEnrollmentStatus(studentData.status)}
            </span>
          </div>

          {/* <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            style={{ display: "none" }}
          /> */}

          <div className="hero-text">
            <h1 className="student-name">{studentData.name}</h1>
            <p className="student-lrn">
              LRN: <strong>{studentData.lrn}</strong>
            </p>
            <div className="student-tags">
              <span className="tag-pill grade">{studentData.grade_display}</span>
              <span className="tag-pill year">S.Y. {studentData.schoolYear}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="profile-details-grid">
        <section className="details-card">
          <div className="details-header">
            <i className="bi bi-person-lines-fill me-2"></i>
            Personal Information
          </div>

          <div className="details-body">
            {isEditing ? (
              <>
                <InfoRow label="Student First Name" value={studentData.first_name} />
                <InfoRow label="Student Middle Name" value={studentData.middle_name} />
                <InfoRow label="Student Last Name" value={studentData.last_name} />
                <InfoRow label="LRN" value={studentData.lrn} />
                <InfoRow label="Student Number" value={studentData.student_number} />
                <InfoRow label="Payment Mode" value={studentData.payment_mode} />
                <InfoRow label="Email" value={studentData.email} />
                <EditRow
                  label="Address"
                  value={editForm.address}
                  onChange={(v) => handleEditChange("address", v)}
                  textarea
                  isLast
                />
              </>
            ) : (
              <>
                <InfoRow label="Full Name" value={studentData.name} />
                <InfoRow label="LRN" value={studentData.lrn} />
                <InfoRow label="Student Number" value={studentData.student_number} />
                <InfoRow label="Payment Mode" value={studentData.payment_mode} />
                <InfoRow label="Email" value={studentData.email} />
                <InfoRow label="Birth Date" value={studentData.birth_date} />
                <InfoRow label="Gender" value={studentData.gender} />
                <InfoRow label="Religion" value={studentData.religion} />
                <InfoRow label="Education Level" value={studentData.education_level} />
                <InfoRow label="Student Type" value={studentData.student_type} />
                <InfoRow label="Home Address" value={studentData.address} isLast />
              </>
            )}
          </div>
        </section>

        <section className="details-card">
          <div className="details-header guardian-header">
            <i className="bi bi-people-fill me-2"></i>
            Parent / Guardian Information
          </div>

          <div className="details-body">
            {isEditing ? (
              <>
                <EditRow
                  label="Guardian First Name"
                  value={editForm.parent_first_name}
                  onChange={(v) => handleEditChange("parent_first_name", v)}
                />
                <EditRow
                  label="Guardian Middle Name"
                  value={editForm.parent_middle_name}
                  onChange={(v) => handleEditChange("parent_middle_name", v)}
                />
                <EditRow
                  label="Guardian Last Name"
                  value={editForm.parent_last_name}
                  onChange={(v) => handleEditChange("parent_last_name", v)}
                />
                <EditRow
                  label="Contact Number"
                  value={editForm.contact_number}
                  onChange={(v) => handleEditChange("contact_number", v)}
                  isLast
                />
              </>
            ) : (
              <>
                <InfoRow label="Guardian Name" value={studentData.guardian} />
                <InfoRow label="Contact Number" value={studentData.contact} />
                <InfoRow label="Father Name" value={studentData.father_name} />
                <InfoRow label="Father Contact" value={studentData.father_contact} />
                <InfoRow label="Mother Name" value={studentData.mother_name} />
                <InfoRow label="Mother Contact" value={studentData.mother_contact} />
                <InfoRow label="Guardian Name (Enrollment)" value={studentData.guardian_name} />
                <InfoRow label="Guardian Contact" value={studentData.guardian_contact} />
                <InfoRow
                  label="Guardian Relationship"
                  value={studentData.guardian_relationship}
                  isLast
                />
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

const InfoRow = ({ label, value, isLast }) => (
  <div className={`info-entry ${!isLast ? "entry-border" : ""}`}>
    <span className="entry-label">{label}</span>
    <span className="entry-value">{value || "—"}</span>
  </div>
);

const EditRow = ({ label, value, onChange, isLast, textarea }) => (
  <div className={`info-entry edit-mode ${!isLast ? "entry-border" : ""}`}>
    <span className="entry-label">{label}</span>
    {textarea ? (
      <textarea
        className="entry-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
      />
    ) : (
      <input
        type="text"
        className="entry-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    )}
  </div>
);

export default Profile;