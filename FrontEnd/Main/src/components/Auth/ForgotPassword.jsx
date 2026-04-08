import React, { useState, useCallback } from "react";
import { Mail, Send, ShieldAlert } from "lucide-react";
import { apiFetch } from "../api/apiFetch";
import Toast from "../Global/Toast";
import "../AuthCSS/Auth.css";

export default function ForgotPassword() {
  const [form, setForm] = useState({
    email: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState([]);

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

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

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

      addToast("Success", data.detail || "Request submitted successfully.", "success");

      setForm({
        email: "",
        message: "",
      });
    } catch (err) {
      addToast("Error", err.message || "Something went wrong.", "error");
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
      <Toast toasts={toasts} dismissToast={dismissToast} />
    </div>
  );
}