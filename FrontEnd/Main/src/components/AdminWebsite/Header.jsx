import React, { useState } from 'react';
import { Menu, Bell } from 'lucide-react';
import '../AdminWebsiteCSS/Header.css';

const Header = ({
  title,
  subtitle,
  onToggleCollapse,
  sidebarCollapsed,
  showRemindersBell = false,
  onOpenReminders,
  unreadReminders = 0,
}) => {
  const [hoveredCollapseBtn, setHoveredCollapseBtn] = useState(false);

  return (
    <header className="header">
      <div className="header-left">
        <button
          className={`collapse-button ${hoveredCollapseBtn ? 'collapse-button-hover' : ''}`}
          onClick={onToggleCollapse}
          onMouseEnter={() => setHoveredCollapseBtn(true)}
          onMouseLeave={() => setHoveredCollapseBtn(false)}
          title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          <Menu size={24} />
        </button>

        <div>
          <h1 className="header-title">{title}</h1>
          {subtitle && <p className="header-subtitle">{subtitle}</p>}
        </div>
      </div>

      {showRemindersBell && (
        <div className="header-right">
          <button
            className="header-bell-button"
            onClick={onOpenReminders}
            title="Notifications"
            type="button"
          >
            <Bell size={22} />
            {unreadReminders > 0 && (
              <span className="header-bell-count">
                {unreadReminders > 99 ? "99+" : unreadReminders}
              </span>
            )}
          </button>
        </div>
      )}
    </header>
  );
};

export default Header;