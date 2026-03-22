import React, { useEffect, useState } from "react";
import TeacherSidebar from "./TeacherSidebar";
import Header from "../AdminWebsite/Header";
import Dashboard from "./Dashboard.jsx";
import Grade from "./Grade.jsx";
import AttendanceMonitoring from "./AttendanceMonitoring.jsx";
import Message from "./Message.jsx";
import TeacherClassSchedule from "./TeacherClassSchedule.jsx";
import Students from "./Students.jsx";
import SPerformance from "./SPerformance.jsx";
import TeacherReminders from "./TeacherReminders.jsx";
import { getToken } from "../Auth/auth";
import "../AdminWebsiteCSS/AdminDashboard.css";

const API_BASE = "";

const authHeaders = (extra = {}) => {
  const token = getToken();
  return {
    ...(token ? { Authorization: `Token ${token}` } : {}),
    ...extra,
  };
};

function TeacherDashboard() {
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [unreadReminders, setUnreadReminders] = useState(0);

  const handleMenuClick = (menuId) => setActiveMenu(menuId);
  const handleToggleSidebar = () => setSidebarCollapsed((v) => !v);

  useEffect(() => {
    const loadUnreadReminders = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/reminders/?type=PERFORMANCE`, {
          credentials: "include",
          headers: authHeaders(),
        });

        if (!res.ok) throw new Error("Failed to load reminders");

        const data = await res.json();
        const reminders = Array.isArray(data) ? data : [];
        setUnreadReminders(reminders.filter((r) => !r.is_read).length);
      } catch (err) {
        console.error("Error loading unread reminders:", err);
        setUnreadReminders(0);
      }
    };

    loadUnreadReminders();
  }, []);

  const renderContent = () => {
    switch (activeMenu) {
      case "dashboard":
        return <Dashboard />;
      case "grade":
        return <Grade />;
      case "attendance":
        return <AttendanceMonitoring />;
      case "message":
        return <Message />;
      case "schedule":
        return <TeacherClassSchedule />;
      case "students":
        return <Students />;
      case "performance":
        return <SPerformance />;
      case "reminders":
        return <TeacherReminders />;
      default:
        return <Dashboard />;
    }
  };

  const getPageTitle = () => {
    const titles = {
      dashboard: "Dashboard",
      grade: "Grade Encode",
      attendance: "Attendance",
      message: "Messages",
      schedule: "Class Schedule",
      students: "Students",
      performance: "Performance",
      reminders: "Notifications",
    };
    return titles[activeMenu] || "Dashboard";
  };

  const getPageSubtitle = () => {
    const subtitles = {
      dashboard: "Welcome back! Here's your overview.",
      grade: "Encode and manage student grades.",
      attendance: "Track and monitor student attendance.",
      message: "View and send messages.",
      schedule: "View your class schedule.",
      students: "View and manage your students.",
      performance: "Track student performance metrics.",
      reminders: "View reminders and important updates.",
    };
    return subtitles[activeMenu] || "Welcome back!";
  };

  return (
    <div className="admin-app-container">
      <TeacherSidebar
        activeMenu={activeMenu}
        onMenuClick={handleMenuClick}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
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

export default TeacherDashboard;