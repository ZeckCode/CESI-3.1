import React, { useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";
import { API_BASE_URL } from "../../config/api.js";
import "../AuthCSS/Login.css";
import Toast from "../Global/Toast";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [toasts, setToasts] = useState([]);
  const location = useLocation();
  const { login } = useAuth();
  const from = location.state?.from?.pathname;

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
        const errorMsg = data?.message || "Invalid credentials";
        setError(errorMsg);
        addToast("Login Error", errorMsg, "error");
        return;
      }

      login({ user: data.user, token: data.token });

      const normalizedRole = data?.user?.role?.toLowerCase();
      const destination = from
        ? from
        : normalizedRole === "admin"
          ? "/admin"
          : normalizedRole === "teacher"
            ? "/teacher"
            : normalizedRole === "parent_student"
              ? "/student"
              : "/";

      // Force a full reload after login so route-scoped widgets are reinitialized cleanly.
      window.location.replace(destination);

    } catch (err) {
      setError("Login failed. Please try again.");
      addToast("Error", "Login failed. Please try again.", "error");
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <h1>CESI Portal</h1>
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
      <Toast toasts={toasts} dismissToast={dismissToast} />
    </div>
  );
}
