import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { ChevronDown, ChevronUp, Edit3, X, Check, User, AlertCircle, Eye, EyeOff } from "lucide-react";
import "../StudentWebsiteCSS/Profile.css";
import { getToken } from "../Auth/auth";
import Toast from "../Global/Toast";

const API_BASE = "";

const PROFILE_ENDPOINTS = [
  "/api/accounts/me/detail/",
];

const UPDATE_ENDPOINTS = [
  "/api/accounts/update-profile/",
  "/api/accounts/me/update/",
];

const TRANSFER_REQUEST_ENDPOINT = "/api/accounts/me/transfer-request/";

const PASSWORD_RULES = [
  {
    pattern: /.{8,}/,
    message: "New password must be at least 8 characters.",
  },
  {
    pattern: /[A-Z]/,
    message: "New password must include at least one uppercase letter.",
  },
  {
    pattern: /[a-z]/,
    message: "New password must include at least one lowercase letter.",
  },
  {
    pattern: /\d/,
    message: "New password must include at least one number.",
  },
  {
    pattern: /[@$!%*?&._-]/,
    message: "New password must include at least one special character (@$!%*?&._-).",
  },
];

const getPasswordValidationError = (password) => {
  const failedRule = PASSWORD_RULES.find((rule) => !rule.pattern.test(password));
  return failedRule ? failedRule.message : "";
};

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

  const extractErrorMessage = (json, statusCode, endpoint) => {
    if (!json) return `Save failed (${statusCode}) at ${endpoint}`;
    if (typeof json.detail === "string" && json.detail.trim()) return json.detail;

    if (typeof json === "object") {
      for (const value of Object.values(json)) {
        if (typeof value === "string" && value.trim()) return value;
        if (Array.isArray(value) && value.length && typeof value[0] === "string") {
          return value[0];
        }
      }
    }

    return `Save failed (${statusCode}) at ${endpoint}`;
  };

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

      lastError = new Error(extractErrorMessage(json, res.status, endpoint));
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
  const [toasts, setToasts] = useState([]);
  const [editForm, setEditForm] = useState({});
  const [accountForm, setAccountForm] = useState({
    username: "",
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [accountSaving, setAccountSaving] = useState(false);
  const [showAccountPassword, setShowAccountPassword] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [requestingTransfer, setRequestingTransfer] = useState(false);
  const [accountSectionOpen, setAccountSectionOpen] = useState(false);
  const [transferSectionOpen, setTransferSectionOpen] = useState(false);
  const [transferRequestForm, setTransferRequestForm] = useState({
    transfer_reason: "",
    destination_school_name: "",
    destination_school_address: "",
    destination_school_contact: "",
    transfer_reference_number: "",
    transfer_notes: "",
  });
  const fileInputRef = useRef(null);

  const addToast = useCallback((title, message, type = "warning") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

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
      setAccountForm((prev) => ({
        ...prev,
        username: json?.username || "",
        current_password: "",
        new_password: "",
        confirm_password: "",
      }));
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

  const handleEditChange = (field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAccountChange = (field, value) => {
    setAccountForm((prev) => ({ ...prev, [field]: value }));
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
      addToast("Success", "Profile updated successfully.", "success");
    } catch (e) {
      console.error("Error saving profile:", e);
      addToast("Error", e.message || "Failed to save profile.", "error");
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

  const handleTransferRequestChange = (field, value) => {
    setTransferRequestForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleAccountPasswordVisibility = (field) => {
    setShowAccountPassword((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleSaveAccountSettings = async () => {
    const username = (accountForm.username || "").trim();
    const currentPassword = accountForm.current_password || "";
    const newPassword = accountForm.new_password || "";
    const confirmPassword = accountForm.confirm_password || "";
    const hasPasswordUpdate = currentPassword || newPassword || confirmPassword;

    if (!username) {
      addToast("Validation Error", "Username cannot be empty.", "error");
      return;
    }

    if (hasPasswordUpdate) {
      if (!currentPassword) {
        addToast("Validation Error", "Current password is required.", "error");
        return;
      }
      if (!newPassword) {
        addToast("Validation Error", "New password is required.", "error");
        return;
      }
      const passwordValidationError = getPasswordValidationError(newPassword);
      if (passwordValidationError) {
        addToast("Validation Error", passwordValidationError, "error");
        return;
      }
      if (!confirmPassword) {
        addToast("Validation Error", "Please confirm the new password.", "error");
        return;
      }
      if (newPassword !== confirmPassword) {
        addToast("Validation Error", "New password and confirmation do not match.", "error");
        return;
      }
    }

    setAccountSaving(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("username", username);

      if (hasPasswordUpdate) {
        formData.append("current_password", currentPassword);
        formData.append("new_password", newPassword);
        formData.append("confirm_password", confirmPassword);
      }

      await tryUpdateEndpoints(formData);
      await loadProfile();
      addToast("Success", "Account settings saved successfully.", "success");
      setAccountSectionOpen(false);
      setAccountForm((prev) => ({
        ...prev,
        current_password: "",
        new_password: "",
        confirm_password: "",
      }));
    } catch (e) {
      addToast("Error", e.message || "Failed to save account settings.", "error");
    } finally {
      setAccountSaving(false);
    }
  };

  const handleSubmitTransferRequest = async () => {
    const reason = (transferRequestForm.transfer_reason || "").trim();
    const destinationSchool = (transferRequestForm.destination_school_name || "").trim();

    if (!reason) {
      addToast("Validation Error", "Reason for transfer is required.", "error");
      return;
    }

    if (!destinationSchool) {
      addToast("Validation Error", "Destination school name is required.", "error");
      return;
    }

    setRequestingTransfer(true);
    setError("");
    try {
      const res = await fetchWithToken(TRANSFER_REQUEST_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(transferRequestForm),
      });

      const text = await res.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = { detail: text };
      }

      if (!res.ok) {
        throw new Error(json?.detail || `Transfer request failed (${res.status}).`);
      }

      await loadProfile();
      setTransferSectionOpen(false);
      setTransferRequestForm({
        transfer_reason: "",
        destination_school_name: "",
        destination_school_address: "",
        destination_school_contact: "",
        transfer_reference_number: "",
        transfer_notes: "",
      });
      addToast("Success", "Transfer request submitted successfully.", "success");
    } catch (e) {
      addToast("Error", e.message || "Failed to submit transfer request.", "error");
    } finally {
      setRequestingTransfer(false);
    }
  };

  const toastLayer = <Toast toasts={toasts} onDismiss={dismissToast} />;

  if (loading) {
    return (
      <div className="profile-content">
        {toastLayer}
        <div className="profile-hero-card profileSkel__card">
          <div className="hero-main-info">
            <div className="profileSkel profile-shimmer profileSkel__avatar" />
            <div className="hero-text">
              <div className="profileSkel profile-shimmer profileSkel__line profileSkel__line--name" />
              <div className="profileSkel profile-shimmer profileSkel__line profileSkel__line--lrn" />
              <div className="student-tags">
                <span className="tag-pill profileSkel__tag">
                  <span className="profileSkel profile-shimmer profileSkel__line profileSkel__line--tag" />
                </span>
                <span className="tag-pill profileSkel__tag">
                  <span className="profileSkel profile-shimmer profileSkel__line profileSkel__line--tag" />
                </span>
              </div>
            </div>
          </div>
        </div>

        <section className="details-card profileSkel__card" style={{ marginBottom: "1.5rem" }}>
          <div className="details-header">Transfer Request</div>
          <div className="details-body">
            <div className="info-entry entry-border">
              <span className="profileSkel profile-shimmer profileSkel__line profileSkel__line--entryLabel" />
              <span className="profileSkel profile-shimmer profileSkel__line profileSkel__line--entryValue" />
            </div>
            <div className="header-actions" style={{ marginTop: "12px" }}>
              <div className="profileSkel profile-shimmer profileSkel__btn" />
            </div>
          </div>
        </section>

        <div className="profile-details-grid">
          {[...Array(2)].map((_, idx) => (
            <section key={idx} className="details-card profileSkel__card">
              <div className="details-header">&nbsp;</div>
              <div className="details-body">
                {[...Array(7)].map((__, rowIdx) => (
                  <div
                    key={rowIdx}
                    className={`info-entry ${rowIdx < 6 ? "entry-border" : ""}`}
                  >
                    <span className="profileSkel profile-shimmer profileSkel__line profileSkel__line--entryLabel" />
                    <span className="profileSkel profile-shimmer profileSkel__line profileSkel__line--entryValue" />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="profile-content">
        {toastLayer}
        <div className="error-message">{error || "Profile not found."}</div>
      </div>
    );
  }

  if (data.role !== "PARENT_STUDENT") {
    return (
      <div className="profile-content">
        {toastLayer}
        <div className="error-message">Forbidden: not a student account.</div>
      </div>
    );
  }

  const displayAvatar = avatarPreview || studentData.avatar_url;
  const transferStatus = String(data?.profile?.transfer_status || "NONE").toUpperCase();

  // Helper to get status-specific message
  const getStatusMessage = () => {
    const status = String(studentData.status).toUpperCase();
    switch (status) {
      case 'DROPPED':
        return 'This enrollment has been marked as dropped. Please contact the school office for re-enrollment options.';
      case 'PENDING':
        return 'This enrollment is pending approval. Please wait for confirmation from the school.';
      case 'COMPLETED':
        return 'This enrollment period has been completed.';
      default:
        return null;
    }
  };

  const statusMessage = getStatusMessage();
  const transferPending = transferStatus === "PENDING";
  const transferApproved = transferStatus === "APPROVED";
  const canRequestTransfer = !transferPending && !transferApproved;

  return (
    <div className="profile-content">
      {toastLayer}
      {error ? <div className="error-message">{error}</div> : null}
      
      {statusMessage && (
        <div className={`status-alert status-alert-${String(studentData.status).toLowerCase()}`}>
          <AlertCircle size={20} style={{ marginRight: '12px' }} />
          <div>
            <strong>{formatEnrollmentStatus(studentData.status)} Status</strong>
            <p>{statusMessage}</p>
          </div>
        </div>
      )}

      {transferPending && (
        <div className="status-alert status-alert-pending">
          <AlertCircle size={20} style={{ marginRight: "12px" }} />
          <div>
            <strong>Transfer Request Pending</strong>
            <p>Your request is submitted and waiting for admin approval.</p>
          </div>
        </div>
      )}

      {transferApproved && (
        <div className="status-alert status-alert-completed">
          <AlertCircle size={20} style={{ marginRight: "12px" }} />
          <div>
            <strong>Transfer Approved</strong>
            <p>Your transfer request has been approved by the admin.</p>
          </div>
        </div>
      )}

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

      <section className="details-card collapsible-card" style={{ marginBottom: "1.5rem" }}>
        <div className="details-header">
          <span className="details-header-title">
            <i className="bi bi-gear-fill me-2"></i>
            Account Settings
          </span>
          <button
            type="button"
            className="section-toggle-btn"
            onClick={() => setAccountSectionOpen((prev) => !prev)}
          >
            {accountSectionOpen ? (
              <>
                <ChevronUp size={16} /> Hide
              </>
            ) : (
              <>
                <ChevronDown size={16} /> Update Settings
              </>
            )}
          </button>
        </div>
        {accountSectionOpen ? (
          <div className="details-body collapsible-body">
            <EditRow
              label="Username"
              value={accountForm.username}
              onChange={(v) => handleAccountChange("username", v)}
            />
            <EditRow
              label="Current Password"
              value={accountForm.current_password}
              onChange={(v) => handleAccountChange("current_password", v)}
              type={showAccountPassword.current ? "text" : "password"}
              showToggle
              onToggleVisibility={() => toggleAccountPasswordVisibility("current")}
              isVisible={showAccountPassword.current}
            />
            <EditRow
              label="New Password"
              value={accountForm.new_password}
              onChange={(v) => handleAccountChange("new_password", v)}
              type={showAccountPassword.next ? "text" : "password"}
              showToggle
              onToggleVisibility={() => toggleAccountPasswordVisibility("next")}
              isVisible={showAccountPassword.next}
            />
            <EditRow
              label="Confirm New Password"
              value={accountForm.confirm_password}
              onChange={(v) => handleAccountChange("confirm_password", v)}
              type={showAccountPassword.confirm ? "text" : "password"}
              showToggle
              onToggleVisibility={() => toggleAccountPasswordVisibility("confirm")}
              isVisible={showAccountPassword.confirm}
              isLast
            />
            <div className="header-actions" style={{ marginTop: "12px", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn-save"
                onClick={handleSaveAccountSettings}
                disabled={accountSaving}
              >
                <Check size={16} /> {accountSaving ? "Saving..." : "Save Account"}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="details-card collapsible-card" style={{ marginBottom: "1.5rem" }}>
        <div className="details-header">
          <span className="details-header-title">
            <i className="bi bi-send me-2"></i>
            Transfer Request
          </span>
          <button
            type="button"
            className="section-toggle-btn"
            onClick={() => setTransferSectionOpen((prev) => !prev)}
          >
            {transferSectionOpen ? (
              <>
                <ChevronUp size={16} /> Hide
              </>
            ) : (
              <>
                <ChevronDown size={16} /> Request Transfer
              </>
            )}
          </button>
        </div>
        {transferSectionOpen ? (
          <div className="details-body collapsible-body">
            <div className="transfer-status-summary">
              <div>
                <div className="entry-label">Current transfer status</div>
                <div className="entry-value">{transferStatus}</div>
                <div className="entry-label" style={{ marginTop: "6px" }}>
                  Note: Request is blocked once 2nd quarter grades exist.
                </div>
              </div>
            </div>
            {!canRequestTransfer ? (
              <div className="transfer-locked-message">
                A transfer request is already pending or approved, so this section is locked.
              </div>
            ) : (
              <>
                <EditRow
                  label="Reason for Transfer *"
                  value={transferRequestForm.transfer_reason}
                  onChange={(v) => handleTransferRequestChange("transfer_reason", v)}
                />
                <EditRow
                  label="Destination School Name *"
                  value={transferRequestForm.destination_school_name}
                  onChange={(v) => handleTransferRequestChange("destination_school_name", v)}
                />
                <EditRow
                  label="Destination School Address"
                  value={transferRequestForm.destination_school_address}
                  onChange={(v) => handleTransferRequestChange("destination_school_address", v)}
                />
                <EditRow
                  label="Destination School Contact"
                  value={transferRequestForm.destination_school_contact}
                  onChange={(v) => handleTransferRequestChange("destination_school_contact", v)}
                />
                <EditRow
                  label="Reference Number"
                  value={transferRequestForm.transfer_reference_number}
                  onChange={(v) => handleTransferRequestChange("transfer_reference_number", v)}
                />
                <EditRow
                  label="Additional Notes"
                  value={transferRequestForm.transfer_notes}
                  onChange={(v) => handleTransferRequestChange("transfer_notes", v)}
                  textarea
                  isLast
                />
                <div className="header-actions" style={{ marginTop: "12px" }}>
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={() => setTransferSectionOpen(false)}
                    disabled={requestingTransfer}
                  >
                    <X size={16} /> Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-save"
                    onClick={handleSubmitTransferRequest}
                    disabled={requestingTransfer}
                  >
                    <Check size={16} /> {requestingTransfer ? "Submitting..." : "Submit Request"}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="details-body collapsible-body">
            <div className="transfer-status-summary">
              <div>
                <div className="entry-label">Current transfer status</div>
                <div className="entry-value">{transferStatus}</div>
                <div className="entry-label" style={{ marginTop: "6px" }}>
                  Note: Request is blocked once 2nd quarter grades exist.
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

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

const EditRow = ({
  label,
  value,
  onChange,
  isLast,
  textarea,
  type = "text",
  showToggle = false,
  onToggleVisibility,
  isVisible = false,
}) => (
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
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <input
          type={type}
          className="entry-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {showToggle && (
          <button
            type="button"
            className="btn-cancel"
            onClick={onToggleVisibility}
            style={{ padding: "0.5rem 0.625rem", minWidth: "42px", justifyContent: "center" }}
            aria-label={isVisible ? "Hide password" : "Show password"}
            title={isVisible ? "Hide password" : "Show password"}
          >
            {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
    )}
  </div>
);

export default Profile;