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
import Messages from "./Messages";
import OrganizationalChart from "./OrganizationalChart";
import NotificationList from "./NotificationList";
import { apiFetch } from "../api/apiFetch";
import "../AdminWebsiteCSS/AdminDashboard.css";

function AdminDashboard() {
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [unreadReminders, setUnreadReminders] = useState(0);
  const [showNotificationList, setShowNotificationList] = useState(false);

  const handleMenuClick = (menuId) => setActiveMenu(menuId);
  const handleToggleSidebar = () => setSidebarCollapsed((v) => !v);

  useEffect(() => {
    let isMounted = true;
    let pollInterval = null;

    const loadUnreadReminders = async () => {
      try {
        const res = await apiFetch("/api/reminders/?type=PAYMENT");

        if (!res.ok) throw new Error("Failed to load reminders");

        const data = await res.json();
        const reminders = Array.isArray(data) ? data : [];
        
        // Only update state if component is still mounted to prevent duplication
        if (isMounted) {
          setUnreadReminders(reminders.filter((r) => !r.is_read).length);
        }
      } catch (err) {
        console.error("Error loading unread payment reminders:", err);
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
      case "dashboard":
        return <Dashboard onNavigateToEnrollment={() => setActiveMenu("enrollment")} />;
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
      tuition: "Tuition Management",
      notifications: "SMS & Email",
      "password-reset-requests": "Password Reset Requests",
      messages: "Message Moderation",
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
      "org-chart": "View the school's administrative structure and staff hierarchy.",
      classes: "Organize and manage class sections.",
      subjects: "Configure subject offerings.",
      "assign-teachers": "Assign teachers to classes and subjects.",
      cms: "Manage website content and announcements.",
      reports: "Generate and view system reports.",
      "password-reset-requests": "Review password reset requests and send reset links.",
      messages: "Manage profanity filters, flagged messages, chat requests, and message reports.",
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
          onOpenReminders={() => setShowNotificationList(true)}
          unreadReminders={unreadReminders}
        />

        {renderContent()}
      </main>

      <FloatingMessages />

      {showNotificationList && (
        <NotificationList
          onClose={() => setShowNotificationList(false)}
          unreadCount={unreadReminders}
          onNavigate={(menu, reminder) => {
            setActiveMenu(menu);
            setShowNotificationList(false);
          }}
        />
      )}
    </div>
  );
}

export default AdminDashboard;