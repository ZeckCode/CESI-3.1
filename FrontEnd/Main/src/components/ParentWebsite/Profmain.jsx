import React, { useState } from "react";
import Sidebar from "./Sidebar";
import Header from "../AdminWebsite/Header";

import Dashboard from "./Dashboard";
import Profile from "./Profile";
import Ledgers from "./Ledgers";
import Grades from "./Grades";
import Schedule from "./Schedule";
import Attendance from "./Attendance";
import Messages from "./Messages";
import "../AdminWebsiteCSS/AdminDashboard.css";

export default function Profmain() {
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleMenuClick = (menuId) => setActiveMenu(menuId);
  const handleToggleSidebar = () => setSidebarCollapsed((v) => !v);

  const renderContent = () => {
    switch (activeMenu) {
      case "dashboard": return <Dashboard />;
      case "profile": return <Profile />;
      case "ledgers": return <Ledgers />;
      case "grades": return <Grades />;
      case "schedule": return <Schedule />;
      case "attendance": return <Attendance />;
      case "messages": return <Messages />;
      default: return <Dashboard />;
    }
  };

  const getPageTitle = () => {
    const titles = {
      dashboard: "Dashboard",
      profile: "Student Info",
      ledgers: "Ledger",
      grades: "Grades",
      schedule: "Schedule",
      attendance: "Attendance",
      messages: "Messages",
    };
    return titles[activeMenu] || "Dashboard";
  };

  const getPageSubtitle = () => {
    const subtitles = {
      dashboard: "Welcome back! Here's your overview.",
      profile: "View student profile and information.",
      ledgers: "View tuition and payment ledger.",
      grades: "View student grades and records.",
      schedule: "View class schedule.",
      attendance: "View attendance records.",
      messages: "View and send messages.",
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
        />

        {renderContent()}
      </main>
    </div>
  );
}
