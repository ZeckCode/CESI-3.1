import React, { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import Header from "../AdminWebsite/Header";

import Dashboard from "./Dashboard";
import Profile from "./Profile";
import Ledgers from "./Ledgers";
import Grades from "./Grades";
import AcademicHistory from "./AcademicHistory";
import Schedule from "./Schedule";
import Attendance from "./Attendance";
import Message from "./Message";
import StudentReminders from "./StudentReminders";
import StudentEnrollment from "./StudentEnrollment";
import { getToken } from "../Auth/auth";
import "../AdminWebsiteCSS/AdminDashboard.css";
import "../StudentWebsiteCSS/StudentPortal.css";

const API_BASE = "";

const authHeaders = (extra = {}) => {
  const token = getToken();
  return {
    ...(token ? { Authorization: `Token ${token}` } : {}),
    ...extra,
  };
};

const computeEnrollmentWindow = (settings) => {
  const autoOpen = () => {
    const today = new Date();
    const year = today.getFullYear();
    const startYear = today.getMonth() >= 5 ? year : year - 1;
    return new Date(startYear, 5, 1); // June 1
  };

  const openDate = settings?.open_date
    ? new Date(settings.open_date + "T00:00:00")
    : autoOpen();

  const days = Math.max(1, parseInt(settings?.window_days ?? 7, 10));
  const closeDate = new Date(openDate);
  closeDate.setDate(openDate.getDate() + days - 1);
  closeDate.setHours(23, 59, 59, 999);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isOpen = today >= openDate && today <= closeDate;

  return {
    isOpen,
    openDate,
    closeDate,
    academicYear: settings?.academic_year || "",
  };
};

export default function StudentMain() {
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [unreadReminders, setUnreadReminders] = useState(0);

  const [enrollmentOpen, setEnrollmentOpen] = useState(false);
  const [enrollmentWindow, setEnrollmentWindow] = useState(null);

  const handleMenuClick = (menuId) => {
    if (menuId === "enrollment" && !enrollmentOpen) {
      setActiveMenu("dashboard");
      return;
    }
    setActiveMenu(menuId);
  };

  const handleToggleSidebar = () => setSidebarCollapsed((v) => !v);

  useEffect(() => {
    let isMounted = true;
    let pollInterval = null;

    const loadUnreadReminders = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/reminders/`, {
          credentials: "include",
          headers: authHeaders(),
        });

        if (!res.ok) throw new Error("Failed to load reminders");

        const data = await res.json();
        const reminders = Array.isArray(data) ? data : [];

        if (isMounted) {
          setUnreadReminders(reminders.filter((r) => !r.is_read).length);
        }
      } catch (err) {
        console.error("Error loading unread reminders:", err);
        if (isMounted) {
          setUnreadReminders(0);
        }
      }
    };

    loadUnreadReminders();
    pollInterval = setInterval(loadUnreadReminders, 30000);

    return () => {
      isMounted = false;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadEnrollmentSettings = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/enrollment-settings/`);
        const data = await res.json().catch(() => null);

        if (!isMounted) return;

        const windowInfo = computeEnrollmentWindow(data);
        setEnrollmentWindow(windowInfo);
        setEnrollmentOpen(windowInfo.isOpen);
      } catch (err) {
        console.error("Failed to load enrollment settings:", err);
        if (isMounted) {
          setEnrollmentWindow(null);
          setEnrollmentOpen(false);
        }
      }
    };

    loadEnrollmentSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (activeMenu === "enrollment" && !enrollmentOpen) {
      setActiveMenu("dashboard");
    }
  }, [activeMenu, enrollmentOpen]);

  const renderContent = () => {
    switch (activeMenu) {
      case "dashboard":
        return <Dashboard />;
      case "profile":
        return <Profile />;
      case "ledgers":
        return <Ledgers />;
      case "grades":
        return <Grades />;
      case "academic-history":
        return <AcademicHistory />;
      case "schedule":
        return <Schedule />;
      case "attendance":
        return <Attendance />;
      case "messages":
        return <Message />;
      case "reminders":
        return <StudentReminders />;
      case "enrollment":
        return enrollmentOpen ? (
          <StudentEnrollment enrollmentWindow={enrollmentWindow} />
        ) : (
          <Dashboard />
        );
      default:
        return <Dashboard />;
    }
  };

  const getPageTitle = () => {
    const titles = {
      dashboard: "Dashboard",
      profile: "Student Info",
      ledgers: "Ledger",
      grades: "Grades",
      "academic-history": "Academic History",
      schedule: "Schedule",
      attendance: "Attendance",
      messages: "Messages",
      reminders: "Notifications",
      enrollment: "Enrollment",
    };
    return titles[activeMenu] || "Dashboard";
  };

  const getPageSubtitle = () => {
    const subtitles = {
      dashboard: "Welcome back! Here's your overview.",
      profile: "View student profile and information.",
      ledgers: "View tuition and payment ledger.",
      grades: "View student grades and records.",
      "academic-history": "View your complete academic history.",
      schedule: "View your class schedule.",
      attendance: "View attendance records.",
      messages: "View and send messages.",
      reminders: "View payment reminders and important updates.",
      enrollment: enrollmentOpen
        ? "The Enrollment Period is Open."
        : "Enrollment is currently unavailable.",
    };
    return subtitles[activeMenu] || "Welcome back!";
  };

  return (
    <div className="admin-app-container student-portal">
      <Sidebar
        activeMenu={activeMenu}
        onMenuClick={handleMenuClick}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        enrollmentOpen={enrollmentOpen}
      />

      <main className={`admin-main ${sidebarCollapsed ? "collapsed" : ""}`}>
        <Header
          title={getPageTitle()}
          subtitle={getPageSubtitle()}
          onToggleCollapse={handleToggleSidebar}
          sidebarCollapsed={sidebarCollapsed}
          showRemindersBell={true}
          onOpenReminders={() => setActiveMenu("reminders")}
          unreadReminders={unreadReminders}
        />

        {renderContent()}
      </main>
    </div>
  );
}