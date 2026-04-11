import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import { MoreVertical, Eye, Edit2, Trash2, Upload, ArrowUpCircle, CreditCard } from "lucide-react";

export default function TableActionMenu({
  row,
  gradeLabel,
  getNextGrade,
  onView,
  onEdit,
  onDelete,
  onIdUpload,
  onPromote,
  onGenerateId,
}) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const menuRef = useRef(null);
  const toggleRef = useRef(null);
  const dropdownRef = useRef(null);

  const closeMenu = () => {
    setOpen(false);
    setMenuPosition(null);
  };

  const updateMenuPosition = () => {
    const toggleEl = toggleRef.current;
    if (!toggleEl) return;

    const rect = toggleEl.getBoundingClientRect();
    const dropdownWidth = 220;
    const top = rect.bottom + 8;
    const left = Math.min(rect.right - dropdownWidth, window.innerWidth - dropdownWidth - 12);

    setMenuPosition({
      top: Math.max(8, top),
      left: Math.max(12, left),
    });
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target)
      ) {
        closeMenu();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;

    updateMenuPosition();

    const handleWindowChange = () => closeMenu();
    window.addEventListener("resize", handleWindowChange);
    window.addEventListener("scroll", handleWindowChange, true);

    return () => {
      window.removeEventListener("resize", handleWindowChange);
      window.removeEventListener("scroll", handleWindowChange, true);
    };
  }, [open]);

  const handleView = () => {
    onView();
    closeMenu();
  };

  const handleEdit = () => {
    onEdit();
    closeMenu();
  };

  const handleDelete = () => {
    onDelete();
    closeMenu();
  };

  const handleIdUpload = () => {
    onIdUpload();
    closeMenu();
  };

  const handlePromote = () => {
    onPromote();
    closeMenu();
  };

  const handleGenerateId = () => {
    if (onGenerateId) {
      onGenerateId();
      closeMenu();
    }
  };

  const hasPromote = (row.statusCode === "ACTIVE" || row.statusCode === "COMPLETED") &&
    getNextGrade(row.raw.grade_level).next;

  return (
    <div
      ref={menuRef}
      className="action-menu-container"
    >
      {/* View Button - Outside */}
      <button
        className="action-view-button"
        onClick={handleView}
        title="View details"
        aria-label="View enrollment details"
      >
        <Eye size={14} />
      </button>

      {/* Dropdown Menu Toggle */}
      <button
        ref={toggleRef}
        className={`action-menu-toggle ${open ? "active" : ""}`}
        onClick={() => {
          if (open) {
            closeMenu();
          } else {
            setOpen(true);
          }
        }}
        title="More options"
        aria-label="More actions"
      >
        <MoreVertical size={16} />
      </button>

      {open && menuPosition && ReactDOM.createPortal(
        <div
          ref={dropdownRef}
          className="action-menu-dropdown action-menu-dropdown--portal show"
          style={{ top: menuPosition.top, left: menuPosition.left }}
        >
          <button
            className="action-menu-item"
            onClick={handleEdit}
            title="Edit enrollment"
          >
            <Edit2 size={14} />
            <span>Edit</span>
          </button>

          <button
            className="action-menu-item action-menu-item--danger"
            onClick={handleDelete}
            title="Delete enrollment"
          >
            <Trash2 size={14} />
            <span>Delete</span>
          </button>

          {row.statusCode === "ACTIVE" && (
            <button
              className="action-menu-item"
              onClick={handleIdUpload}
              title="Upload ID image"
            >
              <Upload size={14} />
              <span>Upload ID</span>
            </button>
          )}

          {row.statusCode === "ACTIVE" && onGenerateId && (
            <button
              className="action-menu-item"
              onClick={handleGenerateId}
              title="Generate student ID card"
            >
              <CreditCard size={14} />
              <span>Generate ID Card</span>
            </button>
          )}

          {hasPromote && (
            <button
              className="action-menu-item"
              onClick={handlePromote}
              title={`Promote to ${gradeLabel(
                getNextGrade(row.raw.grade_level).next
              )}`}
            >
              <ArrowUpCircle size={14} />
              <span>
                Promote {gradeLabel(getNextGrade(row.raw.grade_level).next)}
              </span>
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
