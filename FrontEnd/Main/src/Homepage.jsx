import { useEffect, useRef } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { apiFetch } from "./components/api/apiFetch";

import Home from "./components/IndexWebsite/Home";

import SetPassword from "./components/Auth/SetPassword";
import Login from "./components/Auth/Login";
import ForgotPassword from "./components/Auth/ForgotPassword";
import ResetPassword from "./components/Auth/ResetPassword";
import ProtectedRoute from "./components/Auth/ProtectedRoute";


import AdminDashboard from "./components/AdminWebsite/AdminDashboard";
import TeacherDashboard from "./components/TeacherWebsite/TeacherIndex";
import StudentMain from "./components/StudentWebsite/StudentMain";

import StudentReenrollment from "./components/StudentWebsite/StudentEnrollment";


import { useAuth } from "./components/Auth/useAuth";
import { getToken } from "./components/Auth/auth";

export default function Homepage() {
  const { user, loading, login } = useAuth();
  const didSessionSync = useRef(false);
  const location = useLocation();

  useEffect(() => {
    const cleanupBotpress = () => {
      if (window.botpressWebChat && typeof window.botpressWebChat.destroy === "function") {
        window.botpressWebChat.destroy();
      }

      [
        "#bp-web-widget-container",
        "#bp-web-widget",
        ".bpWebchat",
        "iframe[src*='botpress']",
        "[id^='bp-web-widget']",
      ].forEach((selector) => {
        document.querySelectorAll(selector).forEach((node) => node.remove());
      });

      document
        .querySelectorAll(
          'script[src*="cdn.botpress.cloud/webchat"], script[src*="files.bpcontent.cloud/2026/03/26/09/20260326092557-6ZV5HUUY.js"]'
        )
        .forEach((node) => node.remove());
    };

    if (location.pathname !== "/") {
      cleanupBotpress();
      return undefined;
    }

    cleanupBotpress();

    const script1 = document.createElement("script");
    script1.src = "https://cdn.botpress.cloud/webchat/v3.6/inject.js";
    script1.async = true;
    document.body.appendChild(script1);

    const script2 = document.createElement("script");
    script2.src = "https://files.bpcontent.cloud/2026/03/26/09/20260326092557-6ZV5HUUY.js";
    script2.defer = true;
    document.body.appendChild(script2);

    return () => {
      cleanupBotpress();
      if (script1.parentNode) document.body.removeChild(script1);
      if (script2.parentNode) document.body.removeChild(script2);
    };
  }, [location.pathname]);

  useEffect(() => {
    if (user || didSessionSync.current) return;

    const token = getToken();
    if (!token) {
      didSessionSync.current = true;
      return;
    }

    if (sessionStorage.getItem("cesi.justLoggedOut") === "1") {
      sessionStorage.removeItem("cesi.justLoggedOut");
      didSessionSync.current = true;
      return;
    }

    didSessionSync.current = true;

    const syncSession = async () => {
      try {
        const res = await apiFetch("/api/accounts/me/");

        if (res.ok) {
          const data = await res.json();
          login({ user: data });
        }
      } catch {
        // keep local user
      }
    };

    syncSession();
  }, [user, login]);

  if (loading) return <div>Loading...</div>;

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:uid/:token" element={<ResetPassword />} />
      <Route path="/set-password/:uidb64/:token" element={<SetPassword />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute role="ADMIN">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/teacher"
        element={
          <ProtectedRoute role="TEACHER">
            <TeacherDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/student"
        element={
          <ProtectedRoute role="PARENT_STUDENT">
            <StudentMain />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/reenrollment"
        element={
          <ProtectedRoute role="PARENT_STUDENT">
            <StudentReenrollment />
          </ProtectedRoute>
        }
      />

      <Route path="/unauthorized" element={<div>Unauthorized</div>} />
      <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
    </Routes>
  );
}