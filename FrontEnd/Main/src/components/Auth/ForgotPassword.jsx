import React, { useState, useCallback } from "react";
import { Mail, Send, ShieldAlert, User } from "lucide-react";
import { apiFetch } from "../api/apiFetch";
import Toast from "../Global/Toast";
import "../AuthCSS/Auth.css";

export default function ForgotPassword() {
  const [form, setForm] = useState({
    username: "",
    email: "",
    message: "",
  });
  const [verificationCode, setVerificationCode] = useState("");
  const [step, setStep] = useState("request");
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

  const handleSendCode = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await apiFetch("/api/accounts/password-reset-request/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: form.username,
          email: form.email,
          message: form.message,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Unable to send verification code.");
      }

      addToast("Code Sent", data.detail || "Verification code sent to your email.", "success");
      setStep("verify");
    } catch (err) {
      addToast("Error", err.message || "Something went wrong.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await apiFetch("/api/accounts/password-reset-request/verify-code/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: form.username,
          email: form.email,
          message: form.message,
          code: verificationCode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Verification failed.");
      }

      addToast("Success", data.detail || "Request submitted successfully.", "success");

      setForm({
        username: "",
        email: "",
        message: "",
      });
      setVerificationCode("");
      setStep("request");
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
          <p>
            {step === "request"
              ? "Enter username and email to receive a verification code."
              : "Enter the code sent to your email to submit your reset request."}
          </p>
        </div>

        <form onSubmit={step === "request" ? handleSendCode : handleVerifyAndSubmit} className="auth-form">
          <label>Username</label>
          <div className="auth-input-wrap">
            <User size={18} />
            <input
              type="text"
              name="username"
              placeholder="Enter your account username"
              value={form.username}
              onChange={handleChange}
              required
              disabled={step === "verify"}
            />
          </div>
          <small style={{ color: "#64748b", marginTop: "-8px", display: "block" }}>
            Use the exact username linked to this email so we can find the correct student account.
          </small>

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
              disabled={step === "verify"}
            />
          </div>

          <label>Message to Admin (optional)</label>
          <textarea
            name="message"
            rows="4"
            placeholder="Example: I forgot my password and cannot access my account."
            value={form.message}
            onChange={handleChange}
            disabled={step === "verify"}
          />

          {step === "verify" && (
            <>
              <label>Verification Code</label>
              <div className="auth-input-wrap">
                <ShieldAlert size={18} />
                <input
                  type="text"
                  name="verification_code"
                  placeholder="Enter 6-digit code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                />
              </div>
            </>
          )}

          <button type="submit" className="auth-btn primary" disabled={loading}>
            <Send size={18} />
            {loading ? "Processing..." : step === "request" ? "Send Verification Code" : "Verify & Submit Request"}
          </button>

          {step === "verify" && (
            <button
              type="button"
              className="auth-btn"
              onClick={() => setStep("request")}
              disabled={loading}
              style={{ marginTop: "8px" }}
            >
              Edit Username/Email
            </button>
          )}
        </form>
      </div>
      <Toast toasts={toasts} dismissToast={dismissToast} />
    </div>
  );
}