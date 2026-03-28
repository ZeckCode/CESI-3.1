import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";
import { API_BASE_URL } from "../../config/api.js";
import "../AuthCSS/Login.css";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const from = location.state?.from?.pathname;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/accounts/login/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        setError(data?.message || "Invalid credentials");
        return;
      }

      login({ user: data.user, token: data.token });

      if (from) {
        navigate(from, { replace: true });
        return;
      }

      const normalizedRole = data?.user?.role?.toLowerCase();
      if (normalizedRole === "admin") navigate("/admin", { replace: true });
      else if (normalizedRole === "teacher") navigate("/teacher", { replace: true });
      else if (normalizedRole === "parent_student") navigate("/student", { replace: true });
      else navigate("/", { replace: true });

    } catch (err) {
      setError("Login failed. Please try again.");
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <h1>CESI Portal</h1>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleLogin}>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Email or Username"
          />
          <div style={{ position: "relative", width: "100%" }}>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              style={{ width: "100%", paddingRight: "40px", boxSizing: "border-box" }}
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
          <button type="submit">Login</button>
          <div style={{ textAlign: "right", marginTop: "12px" }}>
              <a href="/forgot-password" style={{ color: "red", fontWeight: 600 }}>
                Forgot Password?
              </a>
            </div>
        </form>
      </div>
    </div>
  );
}
