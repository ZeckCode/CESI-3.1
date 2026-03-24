import React, { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Lock, CheckCircle, AlertCircle, Check, X } from "lucide-react";
import { apiFetch } from "../api/apiFetch";
import "../AuthCSS/Auth.css";

// Password validation rules
const PASSWORD_RULES = {
  minLength: { pattern: /.{8,}/, label: "At least 8 characters", id: "length" },
  uppercase: { pattern: /[A-Z]/, label: "One uppercase letter (A-Z)", id: "upper" },
  lowercase: { pattern: /[a-z]/, label: "One lowercase letter (a-z)", id: "lower" },
  number: { pattern: /\d/, label: "One number (0-9)", id: "number" },
  special: { pattern: /[@$!%*?&._-]/, label: "One special character (@$!%*?&._-)", id: "special" },
};

function getPasswordStrength(password) {
  const rules = Object.values(PASSWORD_RULES);
  const passedCount = rules.filter(rule => rule.pattern.test(password)).length;
  
  if (passedCount < 2) return { level: 0, label: "Weak", color: "#ef4444" };
  if (passedCount < 4) return { level: 1, label: "Fair", color: "#f59e0b" };
  if (passedCount < 5) return { level: 2, label: "Good", color: "#3b82f6" };
  return { level: 3, label: "Strong", color: "#10b981" };
}

function validateRule(password, ruleId) {
  return PASSWORD_RULES[ruleId]?.pattern.test(password) || false;
}

export default function ResetPassword() {
  const { uid, token } = useParams();
  const navigate = useNavigate();
  
  const [form, setForm] = useState({
    password: "",
    confirm_password: "",
  });
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Validation state
  const passwordStrength = useMemo(() => getPasswordStrength(form.password), [form.password]);
  const passwordsMatch = form.password && form.confirm_password && form.password === form.confirm_password;
  const passwordMismatch = form.confirm_password && form.password !== form.confirm_password;
  
  const isFormValid = useMemo(() => {
    const allRulesPassed = Object.keys(PASSWORD_RULES).every(
      ruleId => validateRule(form.password, ruleId)
    );
    return allRulesPassed && passwordsMatch;
  }, [form.password, form.confirm_password]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isFormValid) {
      setFeedback({
        type: "error",
        text: "Please fix all validation errors before submitting.",
      });
      return;
    }

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
          <p>Create a strong password to secure your account.</p>
        </div>

        {feedback.text && (
          <div className={`auth-alert ${feedback.type}`}>
            {feedback.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {/* New Password Field */}
          <div>
            <label>New Password</label>
            <div className="auth-input-wrap">
              <Lock size={18} />
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Enter new password"
                value={form.password}
                onChange={handleChange}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px",
                  display: "flex",
                  alignItems: "center",
                }}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>

            {/* Password Strength Indicator */}
            {form.password && (
              <div style={{ marginTop: "12px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: "10px",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: "4px",
                      flex: 1,
                    }}
                  >
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        style={{
                          height: "4px",
                          flex: 1,
                          borderRadius: "2px",
                          background: i <= passwordStrength.level ? passwordStrength.color : "#e5e7eb",
                          transition: "background 0.3s ease",
                        }}
                      />
                    ))}
                  </div>
                  <span style={{ fontSize: "12px", fontWeight: "600", color: passwordStrength.color }}>
                    {passwordStrength.label}
                  </span>
                </div>

                {/* Password Requirements */}
                <div
                  style={{
                    background: "#f9fbfc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    fontSize: "13px",
                  }}
                >
                  {Object.entries(PASSWORD_RULES).map(([key, rule]) => {
                    const passed = validateRule(form.password, key);
                    return (
                      <div
                        key={rule.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginBottom: key === "special" ? "0" : "6px",
                          color: passed ? "#10b981" : "#9ca3af",
                        }}
                      >
                        {passed ? (
                          <Check size={16} style={{ flexShrink: 0 }} />
                        ) : (
                          <X size={16} style={{ flexShrink: 0 }} />
                        )}
                        <span>{rule.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password Field */}
          <div>
            <label>Confirm Password</label>
            <div className="auth-input-wrap">
              <Lock size={18} />
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="confirm_password"
                placeholder="Confirm new password"
                value={form.confirm_password}
                onChange={handleChange}
                required
                style={{
                  borderColor: passwordMismatch ? "#ef4444" : undefined,
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px",
                  display: "flex",
                  alignItems: "center",
                }}
                title={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>

            {/* Password Match Indicator */}
            {form.confirm_password && (
              <div
                style={{
                  marginTop: "8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  color: passwordsMatch ? "#10b981" : "#ef4444",
                }}
              >
                {passwordsMatch ? (
                  <>
                    <Check size={16} />
                    Passwords match
                  </>
                ) : (
                  <>
                    <AlertCircle size={16} />
                    Passwords do not match
                  </>
                )}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="auth-btn primary"
            disabled={loading || !isFormValid}
            style={{
              opacity: loading || !isFormValid ? 0.6 : 1,
              cursor: loading || !isFormValid ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>
      </div>
    </div>
  );
}