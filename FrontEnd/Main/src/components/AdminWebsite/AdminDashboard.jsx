import React, { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import Dashboard from "./Dashboard";
import EnrollmentManagement from "./EnrollmentManagement";
import TransactionHistory from "./TransactionHistory";
import PaymentReminders from "./PaymentReminders";
import Reports from "./Reports";
import UserManagement from "./UserManagement";
import ClassManagement from "./ClassManagement";
import Subjects from "./Subjects";
import AssignTeachers from "./AssignTeachers";
import GradesRecords from "./GradesRecords";
import FloatingMessages from "./FloatingMessages";
import CMSModule from "./CMSModule";
import TuitionManagement from "./TuitionManagement";
import AdminPasswordResetRequests from "./AdminPasswordResetRequests";
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

function AdminDashboard() {
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [unreadReminders, setUnreadReminders] = useState(0);

  const handleMenuClick = (menuId) => setActiveMenu(menuId);
  const handleToggleSidebar = () => setSidebarCollapsed((v) => !v);

  useEffect(() => {
    const loadUnreadReminders = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/reminders/?type=PAYMENT`, {
          credentials: "include",
          headers: authHeaders(),
        });

        if (!res.ok) throw new Error("Failed to load reminders");

        const data = await res.json();
        const reminders = Array.isArray(data) ? data : [];
        setUnreadReminders(reminders.filter((r) => !r.is_read).length);
      } catch (err) {
        console.error("Error loading unread payment reminders:", err);
        setUnreadReminders(0);
      }
    };

    loadUnreadReminders();
  }, []);

  const renderContent = () => {
    switch (activeMenu) {
      case "dashboard":
        return <Dashboard />;
      case "enrollment":
        return <EnrollmentManagement />;
      case "transaction-history":
        return <TransactionHistory />;
      case "payment-reminders":
        return <PaymentReminders />;
      case "generate-reports":
        return <Reports />;
      case "users":
        return <UserManagement />;
      case "classes":
        return <ClassManagement />;
      case "subjects":
        return <Subjects />;
      case "assign-teachers":
        return <AssignTeachers />;
      case "grades":
        return <GradesRecords />;
      case "cms":
        return <CMSModule />;
      case "reports":
        return <Reports />;
      case "tuition_management":
        return <TuitionManagement />;
      case "password-reset-requests":
        return <AdminPasswordResetRequests />;
      default:
        return <Dashboard />;
    }
  };

  const getPageTitle = () => {
    const titles = {
      dashboard: "Dashboard",
      enrollment: "Enrollment Management",
      financial: "Financial Management",
      users: "User Management",
      classes: "Classes",
      subjects: "Subjects",
      "assign-teachers": "Assign Teachers",
      grades: "Grades & Records",
      cms: "CMS Module",
      reports: "Reports",
      tuition_management: "Tuition Management",
      "transaction-history": "Transaction History",
      "payment-reminders": "Payment Reminders",
      tuition: "Tuition Management",
      notifications: "SMS & Email",
      "password-reset-requests": "Password Reset Requests",
    };
    return titles[activeMenu] || "Dashboard";
  };

  const getPageSubtitle = () => {
    const subtitles = {
      dashboard: "Welcome back! Here's what's happening today.",
      enrollment: "Manage student enrollment records and applications.",
      tuition_management: "Manage tuition fees and student billing.",
      "transaction-history": "View and manage all payment transactions.",
      "payment-reminders": "Send payment reminders to parents and guardians.",
      grades: "View and manage student grades and attendance records.",
      users: "Manage system users and access permissions.",
      classes: "Organize and manage class sections.",
      subjects: "Configure subject offerings.",
      "assign-teachers": "Assign teachers to classes and subjects.",
      cms: "Manage website content and announcements.",
      reports: "Generate and view system reports.",
      "password-reset-requests": "Review password reset requests and send reset links.",
    };
    return subtitles[activeMenu] || "Welcome back! Here's what's happening today.";
  };

  return (
    <div className="admin-app-container">
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
          onOpenReminders={() => setActiveMenu("payment-reminders")}
          unreadReminders={unreadReminders}
        />

        {renderContent()}
      </main>

      <FloatingMessages />
    </div>
  );
}

export default AdminDashboard;