import React, { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../config/api.js";
import { setToken } from "./auth";
import "./SetPassword.css";

const PASSWORD_RULES = {
  minLength: {
    pattern: /.{8,}/,
    label: "At least 8 characters",
    id: "minLength",
  },
  uppercase: {
    pattern: /[A-Z]/,
    label: "One uppercase letter (A-Z)",
    id: "uppercase",
  },
  lowercase: {
    pattern: /[a-z]/,
    label: "One lowercase letter (a-z)",
    id: "lowercase",
  },
  number: {
    pattern: /\d/,
    label: "One number (0-9)",
    id: "number",
  },
  special: {
    pattern: /[@$!%*?&._-]/,
    label: "One special character (@$!%*?&._-)",
    id: "special",
  },
};

function getPasswordStrength(password) {
  const rules = Object.values(PASSWORD_RULES);
  const passedCount = rules.filter((rule) => rule.pattern.test(password)).length;

  if (passedCount < 2) return { level: 0, label: "Weak", className: "weak" };
  if (passedCount < 4) return { level: 1, label: "Fair", className: "fair" };
  if (passedCount < 5) return { level: 2, label: "Good", className: "good" };
  return { level: 3, label: "Strong", className: "strong" };
}

function validateRule(password, ruleId) {
  return PASSWORD_RULES[ruleId]?.pattern.test(password) || false;
}

function getPasswordErrors(password, password2) {
  const errors = [];

  if (!password) {
    errors.push("Password is required.");
    return errors;
  }

  const failedRules = Object.values(PASSWORD_RULES).filter(
    (rule) => !rule.pattern.test(password)
  );

  if (failedRules.length > 0) {
    errors.push("Password does not meet the required strength.");
  }

  if (!password2) {
    errors.push("Please confirm your password.");
  } else if (password !== password2) {
    errors.push("Passwords do not match.");
  }

  return errors;
}

export default function SetPassword() {
  const { uidb64, token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [touched, setTouched] = useState({
    password: false,
    password2: false,
  });

  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const passwordErrors = useMemo(
    () => getPasswordErrors(password, password2),
    [password, password2]
  );

  const allRulesPassed = Object.values(PASSWORD_RULES).every((rule) =>
    rule.pattern.test(password)
  );

  const showValidation = touched.password || touched.password2;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setTouched({ password: true, password2: true });

    if (!uidb64 || !token) {
      setMsg("Invalid password setup link.");
      return;
    }

    if (!allRulesPassed) {
      setMsg("Please complete all password requirements.");
      return;
    }

    if (password !== password2) {
      setMsg("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(
        `${API_BASE_URL}/accounts/set-password/${uidb64}/${token}/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            password,
            password2,
          }),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMsg(data?.detail || "Failed to set password.");
        return;
      }

      if (data?.token) {
        setToken(data.token);
      }

      setMsg("✅ Password set successfully! Redirecting to login...");
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      console.error(err);
      setMsg("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="setpass-container">
      <div className="setpass-card">
        <h2>Set Your Password</h2>
        <p>Create a password for your Student Portal account.</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>New Password</label>
            <div style={{ position: "relative", width: "100%" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setMsg("");
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                placeholder="Enter a strong password"
                style={{ width: "100%", paddingRight: "40px", boxSizing: "border-box" }}
                required
              />
              <span
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  cursor: "pointer",
                  fontSize: "18px",
                  userSelect: "none",
                }}
              >
                {showPassword ? "👁️" : "👁️‍🗨️"}
              </span>
            </div>

            {password && (
              <div className={`password-strength ${strength.className}`}>
                Strength: {strength.label}
              </div>
            )}

            {password && (
              <div className="password-strength-bar">
                <div
                  className={`password-strength-fill ${strength.className}`}
                  style={{ width: `${((strength.level + 1) / 4) * 100}%` }}
                />
              </div>
            )}

            <div className="password-rules">
              {Object.values(PASSWORD_RULES).map((rule) => {
                const passed = validateRule(password, rule.id);

                return (
                  <div
                    key={rule.id}
                    className={`password-rule ${passed ? "passed" : ""}`}
                  >
                    <span className="password-rule-icon">
                      {passed ? "✓" : "•"}
                    </span>
                    <span>{rule.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="form-group">
            <label>Confirm Password</label>
            <div style={{ position: "relative", width: "100%" }}>
              <input
                type={showPassword2 ? "text" : "password"}
                value={password2}
                onChange={(e) => {
                  setPassword2(e.target.value);
                  setMsg("");
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, password2: true }))}
                placeholder="Re-type password"
                style={{ width: "100%", paddingRight: "40px", boxSizing: "border-box" }}
                required
              />
              <span
                onClick={() => setShowPassword2(!showPassword2)}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  cursor: "pointer",
                  fontSize: "18px",
                  userSelect: "none",
                }}
              >
                {showPassword2 ? "👁️" : "👁️‍🗨️"}
              </span>
            </div>
          </div>

          {showValidation && passwordErrors.length > 0 && !msg && (
            <div className="form-message error">
              {passwordErrors.map((error, index) => (
                <div key={index}>{error}</div>
              ))}
            </div>
          )}

          {msg && (
            <div
              className={`form-message ${
                msg.includes("successfully") ? "success" : "error"
              }`}
            >
              {msg}
            </div>
          )}

          <button type="submit" disabled={loading} className="setpass-btn">
            {loading ? "Saving..." : "Set Password"}
          </button>
        </form>
      </div>
    </div>
  );
}