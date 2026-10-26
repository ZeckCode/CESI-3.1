import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, AlertCircle, Save, UserCircle2 } from "lucide-react";
import { apiFetch } from "../api/apiFetch";
import "../AdminWebsiteCSS/AdminProfile.css";

function extractErrorMessage(payload, fallback = "Failed to save profile.") {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload;
  if (typeof payload.detail === "string") return payload.detail;
  if (Array.isArray(payload.non_field_errors) && payload.non_field_errors.length) {
    return payload.non_field_errors.join(" ");
  }
  return fallback;
}

export default function AdminProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [userData, setUserData] = useState(null);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const loadProfile = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/accounts/me/detail/");
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(extractErrorMessage(payload, "Failed to load admin profile."));
      }

      setUserData(payload);
      setForm({
        first_name: payload?.first_name || "",
        last_name: payload?.last_name || "",
        username: payload?.username || "",
        email: payload?.email || "",
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
    } catch (e) {
      setError(e.message || "Failed to load admin profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const createdAtLabel = useMemo(() => {
    const raw = userData?.created_at;
    if (!raw) return "-";
    const dt = new Date(raw);
    return Number.isNaN(dt.getTime()) ? raw : dt.toLocaleString();
  }, [userData]);

  const onChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const formData = new FormData();
      formData.append("first_name", form.first_name || "");
      formData.append("last_name", form.last_name || "");
      formData.append("username", form.username || "");
      formData.append("email", form.email || "");

      const passwordFilled =
        form.current_password || form.new_password || form.confirm_password;
      if (passwordFilled) {
        formData.append("current_password", form.current_password || "");
        formData.append("new_password", form.new_password || "");
        formData.append("confirm_password", form.confirm_password || "");
      }

      const res = await apiFetch("/api/accounts/me/update/", {
        method: "PATCH",
        body: formData,
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(extractErrorMessage(payload));
      }

      setSuccess("Admin profile updated successfully.");
      await loadProfile();
    } catch (e) {
      setError(e.message || "Failed to save admin profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-profile-page">
        <div className="admin-profile-card">Loading admin profile...</div>
      </div>
    );
  }

  return (
    <div className="admin-profile-page">
      <div className="admin-profile-card">
        <div className="admin-profile-heading">
          <div className="admin-profile-icon-wrap">
            <UserCircle2 size={22} />
          </div>
          <div>
            <h2>Admin Profile</h2>
            <p>Manage your administrator account details.</p>
          </div>
        </div>

        {error && (
          <div className="admin-profile-alert error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="admin-profile-alert success">
            <CheckCircle2 size={16} />
            <span>{success}</span>
          </div>
        )}

        <div className="admin-profile-grid">
          <div className="admin-profile-field">
            <label>First Name</label>
            <input
              type="text"
              value={form.first_name}
              onChange={(e) => onChange("first_name", e.target.value)}
              placeholder="Enter first name"
            />
          </div>

          <div className="admin-profile-field">
            <label>Last Name</label>
            <input
              type="text"
              value={form.last_name}
              onChange={(e) => onChange("last_name", e.target.value)}
              placeholder="Enter last name"
            />
          </div>

          <div className="admin-profile-field">
            <label>Username</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => onChange("username", e.target.value)}
              placeholder="Enter username"
            />
          </div>

          <div className="admin-profile-field">
            <label>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => onChange("email", e.target.value)}
              placeholder="Enter email"
            />
          </div>

        </div>

        <div className="admin-profile-meta">
          <div>
            <span>Role</span>
            <strong>{userData?.role || "-"}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>{userData?.status || "-"}</strong>
          </div>
          <div>
            <span>Created</span>
            <strong>{createdAtLabel}</strong>
          </div>
        </div>

        <div className="admin-profile-password-title">
          <h3>Change Password</h3>
          <p>Leave these blank if you do not want to update the password.</p>
        </div>

        <div className="admin-profile-grid">
          <div className="admin-profile-field">
            <label>Current Password</label>
            <input
              type="password"
              value={form.current_password}
              onChange={(e) => onChange("current_password", e.target.value)}
              placeholder="Enter current password"
            />
          </div>

          <div className="admin-profile-field">
            <label>New Password</label>
            <input
              type="password"
              value={form.new_password}
              onChange={(e) => onChange("new_password", e.target.value)}
              placeholder="Enter new password"
            />
          </div>

          <div className="admin-profile-field admin-profile-field-full">
            <label>Confirm New Password</label>
            <input
              type="password"
              value={form.confirm_password}
              onChange={(e) => onChange("confirm_password", e.target.value)}
              placeholder="Re-enter new password"
            />
          </div>
        </div>

        <div className="admin-profile-actions">
          <button
            type="button"
            className="admin-profile-btn"
            onClick={handleSave}
            disabled={saving}
          >
            <Save size={16} />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
