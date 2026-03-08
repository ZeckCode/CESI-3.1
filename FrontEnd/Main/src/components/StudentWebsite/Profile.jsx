import React, { useEffect, useMemo, useState, useRef } from "react";
import { Camera, Edit3, X, Check, User } from "lucide-react";
import "../StudentWebsiteCSS/Profile.css";
import { apiFetch } from "../api/apiFetch";

const API_BASE = "";

const gradeLabelFromProfile = (raw) => {
  if (raw == null) return "—";
  const v = String(raw).trim();

  const pretty = new Set(["Pre-Kinder", "Kinder", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6"]);
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

const Profile = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const fileInputRef = useRef(null);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`${API_BASE}/api/accounts/me/detail/`);
      let json;
      if (res?.ok !== undefined) {
        json = await res.json();
      } else {
        json = res;
      }
      setData(json);
      // Initialize edit form
      const p = json.profile || {};
      setEditForm({
        student_first_name: p.student_first_name || "",
        student_middle_name: p.student_middle_name || "",
        student_last_name: p.student_last_name || "",
        parent_first_name: p.parent_first_name || "",
        parent_middle_name: p.parent_middle_name || "",
        parent_last_name: p.parent_last_name || "",
        contact_number: p.contact_number || "",
        address: p.address || "",
        lrn: p.lrn || "",
        student_number: p.student_number || "",
        payment_mode: p.payment_mode || "",
      });
    } catch (e) {
      console.error("Failed to load profile:", e);
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

    const studentName = [p.student_first_name, p.student_middle_name, p.student_last_name]
      .filter(Boolean)
      .join(" ")
      .toUpperCase();

    const parentName = [p.parent_first_name, p.parent_middle_name, p.parent_last_name]
      .filter(Boolean)
      .join(" ");

    const grade = gradeLabelFromProfile(p.grade_level);
    const section = p.section?.name ? p.section.name : "—";

    return {
      name: studentName || (u.username ? String(u.username).toUpperCase() : "—"),
      lrn: p.lrn || "—",
      student_number: p.student_number || "—",
      grade_display: `${grade} - ${section}`,
      email: u.email || "—",
      address: p.address || "—",
      guardian: parentName || "—",
      contact: p.contact_number || "—",
      payment_mode: p.payment_mode || "—",
      status: u.status || "—",
      avatar_url: p.avatar_url || null,
      schoolYear: "2025-2026",
    };
  }, [data]);

  const handleAvatarClick = () => {
    if (isEditing && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      
      // Add all text fields
      Object.entries(editForm).forEach(([key, value]) => {
        formData.append(key, value);
      });
      
      // Add avatar if changed
      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }
      
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/accounts/me/update/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Token ${token}`,
        },
        body: formData,
      });
      
      if (res.ok) {
        await loadProfile();
        setIsEditing(false);
        setAvatarFile(null);
        setAvatarPreview(null);
      } else {
        console.error("Failed to save profile");
      }
    } catch (e) {
      console.error("Error saving profile:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setAvatarFile(null);
    setAvatarPreview(null);
    // Reset form to original data
    const p = data?.profile || {};
    setEditForm({
      student_first_name: p.student_first_name || "",
      student_middle_name: p.student_middle_name || "",
      student_last_name: p.student_last_name || "",
      parent_first_name: p.parent_first_name || "",
      parent_middle_name: p.parent_middle_name || "",
      parent_last_name: p.parent_last_name || "",
      contact_number: p.contact_number || "",
      address: p.address || "",
      lrn: p.lrn || "",
      student_number: p.student_number || "",
      payment_mode: p.payment_mode || "",
    });
  };

  if (loading) return <div className="profile-content"><div className="loading-spinner">Loading profile...</div></div>;
  if (!data) return <div className="profile-content"><div className="error-message">Profile not found.</div></div>;

  if (data.role !== "PARENT_STUDENT") {
    return <div className="profile-content"><div className="error-message">Forbidden: not a student account.</div></div>;
  }

  const displayAvatar = avatarPreview || studentData.avatar_url;

  return (
    <div className="profile-content">
      <header className="profile-header-flex">
        <h2 className="title-text">Student Profile</h2>
        <div className="header-actions">
          {isEditing ? (
            <>
              <button type="button" className="btn-cancel" onClick={handleCancel} disabled={saving}>
                <X size={16} /> Cancel
              </button>
              <button type="button" className="btn-save" onClick={handleSave} disabled={saving}>
                <Check size={16} /> {saving ? "Saving..." : "Save Changes"}
              </button>
            </>
          ) : (
            <button type="button" className="edit-profile-btn" onClick={() => setIsEditing(true)}>
              <Edit3 size={16} /> Edit Profile
            </button>
          )}
        </div>
      </header>

      <div className="profile-hero-card">
        <div className="hero-main-info">
          <div className={`hero-avatar ${isEditing ? 'editable' : ''}`} onClick={handleAvatarClick}>
            {displayAvatar ? (
              <img src={displayAvatar} alt="Avatar" />
            ) : (
              <div className="avatar-placeholder">
                <User size={48} />
              </div>
            )}
            {isEditing && (
              <div className="avatar-overlay">
                <Camera size={24} />
                <span>Change Photo</span>
              </div>
            )}
            <span className={`status-badge ${studentData.status.toLowerCase()}`}>{studentData.status}</span>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            style={{ display: 'none' }}
          />

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
                <EditRow label="First Name" value={editForm.student_first_name} onChange={(v) => handleEditChange("student_first_name", v)} />
                <EditRow label="Middle Name" value={editForm.student_middle_name} onChange={(v) => handleEditChange("student_middle_name", v)} />
                <EditRow label="Last Name" value={editForm.student_last_name} onChange={(v) => handleEditChange("student_last_name", v)} />
                <EditRow label="LRN" value={editForm.lrn} onChange={(v) => handleEditChange("lrn", v)} />
                <EditRow label="Student Number" value={editForm.student_number} onChange={(v) => handleEditChange("student_number", v)} />
                <EditRow label="Payment Mode" value={editForm.payment_mode} onChange={(v) => handleEditChange("payment_mode", v)} />
                <EditRow label="Address" value={editForm.address} onChange={(v) => handleEditChange("address", v)} textarea isLast />
              </>
            ) : (
              <>
                <InfoRow label="Full Name" value={studentData.name} />
                <InfoRow label="LRN" value={studentData.lrn} />
                <InfoRow label="Student Number" value={studentData.student_number} />
                <InfoRow label="Payment Mode" value={studentData.payment_mode} />
                <InfoRow label="Email" value={studentData.email} />
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
                <EditRow label="Guardian First Name" value={editForm.parent_first_name} onChange={(v) => handleEditChange("parent_first_name", v)} />
                <EditRow label="Guardian Middle Name" value={editForm.parent_middle_name} onChange={(v) => handleEditChange("parent_middle_name", v)} />
                <EditRow label="Guardian Last Name" value={editForm.parent_last_name} onChange={(v) => handleEditChange("parent_last_name", v)} />
                <EditRow label="Contact Number" value={editForm.contact_number} onChange={(v) => handleEditChange("contact_number", v)} isLast />
              </>
            ) : (
              <>
                <InfoRow label="Guardian Name" value={studentData.guardian} />
                <InfoRow label="Contact Number" value={studentData.contact} />
                <InfoRow label="Emergency Address" value={studentData.address} isLast />
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
    <span className="entry-value">{value}</span>
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
