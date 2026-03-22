import React, { useState } from "react";
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
import "../AdminWebsiteCSS/AdminDashboard.css";
import "../StudentWebsiteCSS/StudentPortal.css";

export default function StudentMain() {
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
      case "academic-history": return <AcademicHistory />;
      case "schedule": return <Schedule />;
      case "attendance": return <Attendance />;
      case "messages": return <Message />;
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
