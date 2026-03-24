import React, { useState } from "react";
import { Mail, Send, ShieldAlert } from "lucide-react";
import { apiFetch } from "../api/apiFetch";
import "../AuthCSS/Auth.css";

export default function ForgotPassword() {
  const [form, setForm] = useState({
    email: "",
    message: "",
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
      const res = await apiFetch("/api/accounts/password-reset-request/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: form.email,
          message: form.message,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "No account found with that email.");
      }

      setFeedback({
        type: "success",
        text: data.detail || "Request submitted successfully.",
      });

      setForm({
        email: "",
        message: "",
      });
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
      <div className="auth-card forgot-card">
        <div className="auth-header">
          <div className="auth-icon">
            <ShieldAlert size={28} />
          </div>
          <h2>Forgot Password</h2>
          <p>Send a password reset request to the admin.</p>
        </div>

        {feedback.text && (
          <div className={`auth-alert ${feedback.type}`}>
            {feedback.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <label>Email Address</label>
          <div className="auth-input-wrap">
            <Mail size={18} />
            <input
              type="email"
              name="email"
              placeholder="Enter your account email"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <label>Message to Admin (optional)</label>
          <textarea
            name="message"
            rows="4"
            placeholder="Example: I forgot my password and cannot access my account."
            value={form.message}
            onChange={handleChange}
          />

          <button type="submit" className="auth-btn primary" disabled={loading}>
            <Send size={18} />
            {loading ? "Submitting..." : "Send Request"}
          </button>
        </form>
      </div>
    </div>
  );
}