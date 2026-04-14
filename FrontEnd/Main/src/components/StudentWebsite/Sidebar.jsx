import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  UserCircle,
  BookOpenText,
  GraduationCap,
  History,
  CalendarDays,
  ClipboardCheck,
  MessageSquare,
  LogOut,
  Menu,
  X,
  Bell,
  RefreshCw,
} from "lucide-react";

import "../AdminWebsiteCSS/Sidebar.css";
import { useAuth } from "../Auth/useAuth";
import { apiFetch } from "../api/apiFetch";
import { getDisplayName } from "../../utils/userDisplayName";

function getAvatarLetter(username = "User") {
  const value = String(username || "").trim();
  return value ? value.charAt(0).toUpperCase() : "U";
}

export default function Sidebar({
  activeMenu,
  onMenuClick,
  isCollapsed,
  onToggleCollapse,
  isHoverExpanded = false,
  onHoverChange,
  enrollmentOpen = false,
}) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [currentUser, setCurrentUser] = useState(user || null);

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const sidebarRef = useRef(null);

  useEffect(() => {
    if (user) setCurrentUser(user);
  }, [user]);

  useEffect(() => {
    let mounted = true;

    const loadCurrentUser = async () => {
      try {
        const res = await apiFetch("/api/accounts/me/detail/");
        if (!res.ok) return;

        const data = await res.json();
        if (mounted && data) {
          setCurrentUser((prev) => ({ ...(prev || {}), ...data }));
        }
      } catch (error) {
        console.error("Failed to fetch current user:", error);
      }
    };

    loadCurrentUser();
    return () => {
      mounted = false;
    };
  }, []);

  const menuSections = useMemo(
    () => [
      {
        label: "OVERVIEW",
        items: [
          { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
        ],
      },
      {
        label: "STUDENT",
        items: [
          { id: "profile", label: "Student Info", icon: UserCircle },
          { id: "grades", label: "Grades", icon: GraduationCap },
          { id: "academic-history", label: "Academic History", icon: History },
          { id: "attendance", label: "Attendance", icon: ClipboardCheck },
          { id: "schedule", label: "Schedule", icon: CalendarDays },
          ...(enrollmentOpen
            ? [{ id: "enrollment", label: "Student Enrollment", icon: RefreshCw }]
            : []),
        ],
      },
      {
        label: "FINANCE",
        items: [
          { id: "ledgers", label: "Ledger", icon: BookOpenText },
          { id: "proof-of-payment", label: "Proof of Payment", icon: BookOpenText },
        ],
      },
      {
        label: "COMMUNICATION",
        items: [
          { id: "messages", label: "Messages", icon: MessageSquare },
          { id: "reminders", label: "Notifications", icon: Bell },
        ],
      },
    ],
    [enrollmentOpen]
  );

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setDrawerOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;

    const onKey = (e) => e.key === "Escape" && setDrawerOpen(false);
    const onClickOutside = (e) => {
      if (!sidebarRef.current) return;
      if (!sidebarRef.current.contains(e.target)) setDrawerOpen(false);
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [drawerOpen]);

  const handleMenuClick = (menuId) => {
    if (isCollapsed && !isMobile && !isHoverExpanded) {
      onToggleCollapse?.();
    }
    onMenuClick?.(menuId);
    if (isMobile) setDrawerOpen(false);
  };

  const handleSidebarMouseEnter = () => {
    if (!isMobile && isCollapsed) {
      onHoverChange?.(true);
    }
  };

  const handleSidebarMouseLeave = () => {
    onHoverChange?.(false);
  };

  const handleLogout = async () => {
    try {
      await apiFetch("/api/accounts/logout/", { method: "POST" });
    } catch {}

    logout();
    window.location.href = "/";
  };

  const visible = !isMobile || drawerOpen;
  const showLabels = !isCollapsed || isMobile || isHoverExpanded;
  const displayName = getDisplayName(currentUser, { preferStudentProfile: true });
  const avatarLetter = getAvatarLetter(displayName);
  const avatarUrl = currentUser?.avatar || currentUser?.profile?.avatar;
  const sidebarInlineStyle = !isMobile && isCollapsed
    ? { width: isHoverExpanded ? "var(--as-wide)" : "var(--as-narrow)" }
    : undefined;

  return (
    <>
      {isMobile && (
        <header className="as-topbar">
          <button
            type="button"
            className="as-iconbtn"
            onClick={() => setDrawerOpen((v) => !v)}
            aria-label={drawerOpen ? "Close menu" : "Open menu"}
          >
            {drawerOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="as-topbar-title">STUDENT PORTAL</div>
          <div className="as-topbar-spacer" />
        </header>
      )}

      {isMobile && drawerOpen && (
        <div className="as-backdrop" onClick={() => setDrawerOpen(false)} />
      )}

      <aside
        ref={sidebarRef}
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
        style={sidebarInlineStyle}
        className={[
          "as-sidebar",
          visible ? "as-visible" : "as-hidden",
          !isMobile && isCollapsed ? "as-collapsed" : "",
          !isMobile && isCollapsed && isHoverExpanded ? "as-hover-expanded" : "",
          isMobile ? "as-mobile" : "as-desktop",
        ].join(" ")}
      >
        <div className="as-top-section">
          {showLabels && (
            <div className="as-usercard">
              <div className="as-avatar">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                ) : (
                  avatarLetter
                )}
              </div>
              <div className="as-usermeta">
                <div className="as-userrow">
                  <div className="as-username">{displayName}</div>
                </div>
                <div className="as-usersub">
                  <div className="as-userhandle">Student Portal</div>
                </div>
              </div>
            </div>
          )}

          {isCollapsed && !isMobile && !isHoverExpanded && (
            <div className="as-usercard-collapsed">
              <div className="as-avatar">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                ) : (
                  avatarLetter
                )}
              </div>
            </div>
          )}
        </div>

        <nav className="as-nav">
          {menuSections.map((section, sIdx) => (
            <div key={section.label} className="as-section">
              {showLabels && <div className="as-section-label">{section.label}</div>}
              {!showLabels && sIdx > 0 && <div className="as-section-dot" />}

              {section.items.map((item) => {
                const active = item.id === activeMenu;

                return (
                  <div key={item.id} className="as-navblock">
                    <button
                      type="button"
                      className={`as-item ${active ? "active" : ""}`}
                      onClick={() => handleMenuClick(item.id)}
                      title={isCollapsed && !isMobile ? item.label : undefined}
                    >
                      <item.icon size={20} className="as-ico" />
                      {showLabels && <span className="as-label">{item.label}</span>}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="as-bottom">
          <button type="button" className="as-item as-logout" onClick={handleLogout}>
            <LogOut size={20} className="as-ico" />
            {showLabels && <span className="as-label">Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
