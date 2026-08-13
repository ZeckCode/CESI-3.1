import React, { useEffect, useState } from "react";
import TeacherSidebar from "./TeacherSidebar";
import Header from "../AdminWebsite/Header";
import Dashboard from "./Dashboard.jsx";
import Grade from "./Grade.jsx";
import AttendanceMonitoring from "./AttendanceMonitoring.jsx";
import Messages from "./Messages.jsx";
import TeacherClassSchedule from "./TeacherClassSchedule.jsx";
import Students from "./Students.jsx";
import SPerformance from "./SPerformance.jsx";
import TeacherReminders from "./TeacherReminders.jsx";
import { apiFetch, authHeaders } from "../api/apiFetch";
import NotificationList from "../AdminWebsite/NotificationList";
import "../AdminWebsiteCSS/AdminDashboard.css";

const READ_OVERRIDES_KEY = "reminder-read-overrides:PERFORMANCE";

const normalizeReminderPayload = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return [];
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

function TeacherDashboard() {
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth <= 1024);
  const [sidebarHoverExpanded, setSidebarHoverExpanded] = useState(false);
  const [unreadReminders, setUnreadReminders] = useState(0);
  const [showNotificationList, setShowNotificationList] = useState(false);

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

  const handleMenuClick = (menuId) => setActiveMenu(menuId);
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
    let isMounted = true;
    let pollInterval = null;

    const loadUnreadReminders = async () => {
      try {
        const res = await apiFetch("/api/reminders/?type=PERFORMANCE", {
          headers: authHeaders(),
        });

        if (!res.ok) throw new Error("Failed to load reminders");

        const data = await res.json();
        const reminders = normalizeReminderPayload(data);
        const readOverrides = getReadOverrides();
        const normalizedReminders = reminders.map((r) =>
          readOverrides.has(Number(r.id)) ? { ...r, is_read: true } : r
        );
        
        // Only update state if component is still mounted to prevent duplication
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

    // Load reminders immediately on mount
    loadUnreadReminders();

    const handleReminderChange = () => {
      loadUnreadReminders();
    };

    window.addEventListener("reminders-changed", handleReminderChange);

    // Then poll for updates every 30 seconds
    pollInterval = setInterval(loadUnreadReminders, 30000);

    // Cleanup function to prevent memory leaks and duplicate listeners
    return () => {
      isMounted = false;
      window.removeEventListener("reminders-changed", handleReminderChange);
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
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
        return <Messages />;
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
        isHoverExpanded={sidebarHoverExpanded}
        onHoverChange={handleSidebarHoverChange}
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
            reminderType="PERFORMANCE"
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

export default TeacherDashboard;