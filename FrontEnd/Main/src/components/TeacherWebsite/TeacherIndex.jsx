import React, { useState } from "react";
import TeacherSidebar from "./TeacherSidebar";
import Header from "../AdminWebsite/Header";
import Dashboard from "./Dashboard.jsx";
import Grade from "./Grade.jsx";
import AttendanceMonitoring from "./AttendanceMonitoring.jsx";
import Messages from "./Messages.jsx";
import TeacherClassSchedule from "./TeacherClassSchedule.jsx";
import Students from "./Students.jsx";
import SPerformance from "./SPerformance.jsx";
import "../AdminWebsiteCSS/AdminDashboard.css";

function TeacherDashboard() {
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleMenuClick = (menuId) => setActiveMenu(menuId);
  const handleToggleSidebar = () => setSidebarCollapsed((v) => !v);

  const renderContent = () => {
    switch (activeMenu) {
      case "dashboard":
        return <Dashboard />;
      case "grade":
        return <Grade />;
      case "attendance":
        return <AttendanceMonitoring />;
      case "message":
        return <Messages />;
      case "schedule":
        return <TeacherClassSchedule />;
      case "students":
        return <Students />;
      case "performance":
        return <SPerformance />;
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
        />

        {renderContent()}
      </main>
    </div>
  );
}

export default TeacherDashboard;