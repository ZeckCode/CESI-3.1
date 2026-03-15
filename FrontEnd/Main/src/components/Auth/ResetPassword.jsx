import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Lock, CheckCircle } from "lucide-react";
import { apiFetch } from "../api/apiFetch";
import "../AuthCSS/Auth.css";

export default function ResetPassword() {
  const { uid, token } = useParams();
  const navigate = useNavigate();
  
  const [form, setForm] = useState({
    password: "",
    confirm_password: "",
  });
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", text: "" });

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };
  
  const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  setFeedback({ type: "", text: "" });

  try {
    const res = await apiFetch("/api/accounts/password-reset-confirm/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uid,
        token,
        password: form.password,
        confirm_password: form.confirm_password,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.detail || "Password reset failed.");
    }

    setFeedback({
      type: "success",
      text: data.detail || "Password reset successful.",
    });

    setTimeout(() => navigate("/login"), 1500);
  } catch (err) {
    setFeedback({
      type: "error",
      text: err.message || "Something went wrong.",
    });
  } finally {
    setLoading(false);
  }
};
  return (
    <div className="auth-page">
      <div className="auth-card reset-card">
        <div className="auth-header">
          <div className="auth-icon">
            <CheckCircle size={28} />
          </div>
          <h2>Reset Password</h2>
          <p>Enter your new password below.</p>
        </div>

        {feedback.text && (
          <div className={`auth-alert ${feedback.type}`}>
            {feedback.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <label>New Password</label>
          <div className="auth-input-wrap">
            <Lock size={18} />
            <input
              type="password"
              name="password"
              placeholder="Enter new password"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>

          <label>Confirm Password</label>
          <div className="auth-input-wrap">
            <Lock size={18} />
            <input
              type="password"
              name="confirm_password"
              placeholder="Confirm new password"
              value={form.confirm_password}
              onChange={handleChange}
              required
            />
          </div>

          <button type="submit" className="auth-btn primary" disabled={loading}>
            {loading ? "Resetting..." : "Reset Password"}
            
          </button>
        </form>
      </div>
    </div>
  );
}