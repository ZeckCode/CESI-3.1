import React, { useEffect, useState } from "react";
import Sidebar from "./Sidebar"; // Match the capital 'S'
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
import ProofOfPayment from "./ProofOfPayment";
import { getToken } from "../Auth/auth";
import { apiFetch } from "../api/apiFetch";
import NotificationList from "../AdminWebsite/NotificationList";
import "../AdminWebsiteCSS/AdminDashboard.css";
import "../StudentWebsiteCSS/StudentPortal.css";

const API_BASE = "";
const READ_OVERRIDES_KEY = "reminder-read-overrides:PAYMENT";

const normalizeReminderPayload = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return [];
};

const parseResponseJson = async (response) => {
  if (!response) return null;
  const contentType = response.headers?.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) return null;

  try {
    return await response.json();
  } catch {
    return null;
  }
};

const getReadOverrides = () => {
  try {
    const raw = localStorage.getItem(READ_OVERRIDES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map((id) => Number(id)).filter(Number.isFinite) : []);
  } catch {
    return new Set();
  }
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth <= 1024);
  const [sidebarHoverExpanded, setSidebarHoverExpanded] = useState(false);
  const [unreadReminders, setUnreadReminders] = useState(0);
  const [showNotificationList, setShowNotificationList] = useState(false);

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
  const handleSidebarHoverChange = (isHoverExpanded) => setSidebarHoverExpanded(isHoverExpanded);
  const isSidebarExpandedByHover = sidebarCollapsed && sidebarHoverExpanded;
  const isSidebarVisuallyCollapsed = sidebarCollapsed && !sidebarHoverExpanded;

  useEffect(() => {
    const syncSidebarCollapsed = () => {
      setSidebarCollapsed(window.innerWidth <= 1024);
    };

    syncSidebarCollapsed();
    window.addEventListener("resize", syncSidebarCollapsed);
    return () => window.removeEventListener("resize", syncSidebarCollapsed);
  }, []);

  useEffect(() => {
    if (window.botpressWebChat && typeof window.botpressWebChat.destroy === "function") {
      window.botpressWebChat.destroy();
    }

    [
      "#bp-web-widget-container",
      "#bp-web-widget",
      ".bpWebchat",
      "iframe[src*=\"botpress\"]",
      "[id^=\"bp-web-widget\"]",
      "script[src*=\"cdn.botpress.cloud/webchat\"]",
      "script[src*=\"files.bpcontent.cloud/2026/03/26/09/20260326092557-6ZV5HUUY.js\"]",
    ].forEach((selector) => {
      document.querySelectorAll(selector).forEach((node) => node.remove());
    });
  }, []);

  useEffect(() => {
    let isMounted = true;
    let pollInterval = null;

    const loadUnreadReminders = async () => {
      const token = getToken();
      if (!token) {
        if (isMounted) {
          setUnreadReminders(0);
        }
        return;
      }

      try {
        const res = await apiFetch(`${API_BASE}/api/reminders/`);

        if (!res.ok) throw new Error("Failed to load reminders");

        const data = await res.json();
        const reminders = normalizeReminderPayload(data);
        const readOverrides = getReadOverrides();
        const normalizedReminders = reminders.map((r) =>
          readOverrides.has(Number(r.id)) ? { ...r, is_read: true } : r
        );

        if (isMounted) {
          setUnreadReminders(normalizedReminders.filter((r) => !r.is_read).length);
        }
      } catch (err) {
        console.error("Error loading unread reminders:", err);
        if (isMounted) {
          setUnreadReminders(0);
        }
      }
    };

    loadUnreadReminders();

    const handleReminderChange = () => {
      loadUnreadReminders();
    };

    window.addEventListener("reminders-changed", handleReminderChange);
    pollInterval = setInterval(loadUnreadReminders, 30000);

    return () => {
      isMounted = false;
      window.removeEventListener("reminders-changed", handleReminderChange);
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
        const data = await parseResponseJson(res);

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
      case "proof-of-payment":  
        return <ProofOfPayment />;
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
      "proof-of-payment": "Proof of Payment",
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
      "proof-of-payment": "Submit proof of payment for admin verification.",
      grades: "View student grades and records.",
      "academic-history": "View your complete academic history.",
      schedule: "View your class schedule.",
      attendance: "View attendance records.",
      messages: "View and send messages.",
      reminders: "View payment reminders and important updates.",
      enrollment: enrollmentOpen
        ? "The Enrollment Period is Open. \n\n Please review your information and submit your application."
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
        isHoverExpanded={sidebarHoverExpanded}
        onHoverChange={handleSidebarHoverChange}
        enrollmentOpen={enrollmentOpen}
      />

      <main className={`admin-main ${isSidebarVisuallyCollapsed ? "collapsed" : ""}`}>
        <Header
          title={getPageTitle()}
          subtitle={getPageSubtitle()}
          onToggleCollapse={handleToggleSidebar}
          sidebarCollapsed={isSidebarExpandedByHover ? false : sidebarCollapsed}
          showRemindersBell={true}
          onOpenReminders={() => setShowNotificationList(prev => !prev)}
          unreadReminders={unreadReminders}
        />

        {renderContent()}

        {showNotificationList && (
          <NotificationList
            onClose={() => setShowNotificationList(false)}
            unreadCount={unreadReminders}
            reminderType="PAYMENT"
            targetMenuId="reminders"
            onUnreadCountChange={setUnreadReminders}
            onNavigate={(menu) => {
              setActiveMenu(menu);
              setShowNotificationList(false);
            }}
          />
        )}
      </main>
    </div>
  );
}