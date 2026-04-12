import React, { useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import Dashboard from "./Dashboard";
import EnrollmentManagement from "./EnrollmentManagement";
import TransactionHistory from "./TransactionHistory";
import PaymentReminders from "./PaymentReminders";
import AdminProofOfPayment from "./AdminProofOfPayment";
import Reports from "./Reports";
import UserManagement from "./UserManagement";
import ClassManagement from "./ClassManagement";
import Subjects from "./Subjects";
import AssignTeachers from "./AssignTeachers";
import GradesRecords from "./GradesRecords";
import CMSModule from "./CMSModule";
import TuitionManagement from "./TuitionManagement";
import AdminPasswordResetRequests from "./AdminPasswordResetRequests";
import Messages from "./Messages";
import OrganizationalChart from "./OrganizationalChart";
import AdminProfile from "./AdminProfile";
import "../AdminWebsiteCSS/AdminDashboard.css";
import "../AdminWebsiteCSS/ResponsiveUtils.css";

function AdminDashboard() {
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarHoverExpanded, setSidebarHoverExpanded] = useState(false);

  const handleMenuClick = (menuId) => setActiveMenu(menuId);
  const handleToggleSidebar = () => setSidebarCollapsed((v) => !v);
  const handleSidebarHoverChange = (isHoverExpanded) => setSidebarHoverExpanded(isHoverExpanded);
  const isSidebarExpandedByHover = sidebarCollapsed && sidebarHoverExpanded;
  const isSidebarVisuallyCollapsed = sidebarCollapsed && !sidebarHoverExpanded;

  const renderContent = () => {
    switch (activeMenu) {
      case "dashboard":
        return <Dashboard onNavigateToEnrollment={() => setActiveMenu("enrollment")} />;
      case "enrollment":
        return <EnrollmentManagement />;
      case "transaction-history":
        return <TransactionHistory />;
      case "payment-reminders":
        return <PaymentReminders />;
      case "proof-of-payment":
        return <AdminProofOfPayment />;
      case "generate-reports":
        return <Reports />;
      case "users":
        return <UserManagement />;
      case "org-chart":
        return <OrganizationalChart />;
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
      case "messages":
        return <Messages />;
      case "admin-profile":
        return <AdminProfile />;
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
      "org-chart": "Organizational Chart",
      classes: "Classes",
      subjects: "Subjects",
      "assign-teachers": "Assign Teachers",
      grades: "Grades & Records",
      cms: "CMS Module",
      reports: "Reports",
      tuition_management: "Tuition Management",
      "transaction-history": "Transaction History",
      "payment-reminders": "Payment Reminders",
      "proof-of-payment": "Proof of Payment",
      tuition: "Tuition Management",
      notifications: "SMS & Email",
      "password-reset-requests": "Password Reset Requests",
      messages: "Message Moderation",
      "admin-profile": "Admin Profile",
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
      "proof-of-payment": "Review and manage student proof of payment submissions.",
      grades: "View and manage student grades and attendance records.",
      users: "Manage system users and access permissions.",
      "org-chart": "View the school's administrative structure and staff hierarchy.",
      classes: "Organize and manage class sections.",
      subjects: "Configure subject offerings.",
      "assign-teachers": "Assign teachers to classes and subjects.",
      cms: "Manage website content and announcements.",
      reports: "Generate and view system reports.",
      "password-reset-requests": "Review password reset requests and send reset links.",
      messages: "Manage profanity filters, flagged messages, chat requests, and message reports.",
      "admin-profile": "Update your admin account details and permissions label.",
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
        isHoverExpanded={sidebarHoverExpanded}
        onHoverChange={handleSidebarHoverChange}
      />

      <main className={`admin-main ${isSidebarVisuallyCollapsed ? "collapsed" : ""}`}>
        <Header
          title={getPageTitle()}
          subtitle={getPageSubtitle()}
          onToggleCollapse={handleToggleSidebar}
          sidebarCollapsed={isSidebarExpandedByHover ? false : sidebarCollapsed}
          showRemindersBell={false}
          unreadReminders={0}
        />

        {renderContent()}
      </main>
    </div>
  );
}
// AdminDashboard.jsx
export default AdminDashboard; 