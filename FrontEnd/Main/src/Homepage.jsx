import { useEffect, useRef } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Home from "./components/IndexWebsite/Home";

import SetPassword from "./components/Auth/SetPassword";
import Login from "./components/Auth/Login";
import ForgotPassword from "./components/Auth/ForgotPassword";
import ResetPassword from "./components/Auth/ResetPassword";
import ProtectedRoute from "./components/Auth/ProtectedRoute";


import AdminDashboard from "./components/AdminWebsite/AdminDashboard";
import TeacherDashboard from "./components/TeacherWebsite/TeacherIndex";
import StudentMain from "./components/StudentWebsite/StudentMain";

import StudentReenrollment from "./components/StudentWebsite/StudentReenrollment";


import { useAuth } from "./components/Auth/useAuth";
import { getToken } from "./components/Auth/auth";

export default function Homepage() {
  const { user, loading, login } = useAuth();
  const didSessionSync = useRef(false);

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
        const res = await fetch("/api/accounts/me/", {
          credentials: "include",
        });

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