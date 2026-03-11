import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  UserCircle,
  BookOpenText,
  GraduationCap,
  CalendarDays,
  ClipboardCheck,
  MessageSquare,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import "../AdminWebsiteCSS/Sidebar.css";
import { useAuth } from "../Auth/useAuth";
import { apiFetch } from "../api/apiFetch";

function getInitials(name = "User") {
  const parts = String(name).trim().split(/\s+/);
  const first = parts[0]?.[0] || "U";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function roleLabel(role) {
  if (!role) return "User";
  const r = String(role).toLowerCase();
  if (r.includes("admin")) return "Administrator";
  if (r.includes("teacher")) return "Teacher";
  if (r.includes("parent")) return "Student";
  return role;
}

export default function Sidebar({ activeMenu, onMenuClick, isCollapsed, onToggleCollapse }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const sidebarRef = useRef(null);

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
          { id: "attendance", label: "Attendance", icon: ClipboardCheck },
          { id: "schedule", label: "Schedule", icon: CalendarDays },
        ],
      },
      {
        label: "FINANCE",
        items: [
          { id: "ledgers", label: "Ledger", icon: BookOpenText },
        ],
      },
      {
        label: "COMMUNICATION",
        items: [
          { id: "messages", label: "Messages", icon: MessageSquare },
        ],
      },
    ],
    []
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
    if (isCollapsed && !isMobile) {
      onToggleCollapse?.();
    }
    onMenuClick?.(menuId);
    if (isMobile) setDrawerOpen(false);
  };

  const handleLogout = async () => {
    try {
      await apiFetch("/api/accounts/logout/", { method: "POST" });
    } catch {;}

    logout();
    window.location.href = "/";
  };

  const visible = !isMobile || drawerOpen;
  const showLabels = !isCollapsed || isMobile;

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

      {isMobile && drawerOpen && <div className="as-backdrop" onClick={() => setDrawerOpen(false)} />}

      <aside
        ref={sidebarRef}
        className={[
          "as-sidebar",
          visible ? "as-visible" : "as-hidden",
          !isMobile && isCollapsed ? "as-collapsed" : "",
          isMobile ? "as-mobile" : "as-desktop",
        ].join(" ")}
      >
        <div className="as-top-section">
          {user && showLabels && (
            <div className="as-usercard">
              <div className="as-avatar">{getInitials(user?.full_name || user?.username || user?.email)}</div>
              <div className="as-usermeta">
                <div className="as-userrow">
                  <div className="as-username">Student Portal</div>
                </div>
                <div className="as-usersub">
                  <div className="as-role">{roleLabel(user?.role)}</div>
                </div>
              </div>
            </div>
          )}

          {user && isCollapsed && !isMobile && (
            <div className="as-usercard-collapsed">
              <div className="as-avatar">{getInitials(user?.full_name || user?.username || user?.email)}</div>
            </div>
          )}
        </div>

        <nav className="as-nav">
          {menuSections.map((section, sIdx) => (
            <div key={section.label} className="as-section">
              {showLabels && (
                <div className="as-section-label">{section.label}</div>
              )}
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
                      {showLabels && (
                        <span className="as-label">{item.label}</span>
                      )}
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
