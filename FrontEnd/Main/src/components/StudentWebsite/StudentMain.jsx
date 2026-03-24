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

export default function StudentMain() {
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [unreadReminders, setUnreadReminders] = useState(0);

  const handleMenuClick = (menuId) => setActiveMenu(menuId);
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
        
        // Only update state if component is still mounted to prevent duplication
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

    // Load reminders immediately on mount
    loadUnreadReminders();

    // Then poll for updates every 30 seconds
    pollInterval = setInterval(loadUnreadReminders, 30000);

    // Cleanup function to prevent memory leaks and duplicate listeners
    return () => {
      isMounted = false;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, []);

  const renderContent = () => {
    switch (activeMenu) {
      case "dashboard": return <Dashboard />;
      case "profile": return <Profile />;
      case "ledgers": return <Ledgers />;
      case "grades": return <Grades />;
      case "academic-history": return <AcademicHistory />;
      case "schedule": return <Schedule />;
      case "attendance": return <Attendance />;
      case "messages": return <Message />;
      case "reminders": return <StudentReminders />;
      default: return <Dashboard />;
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