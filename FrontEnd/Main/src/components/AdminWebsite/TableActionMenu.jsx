import React, { useState, useRef, useEffect } from "react";
import { MoreVertical, Eye, Edit2, Trash2, Upload, ArrowUpCircle } from "lucide-react";

export default function TableActionMenu({
  row,
  gradeLabel,
  getNextGrade,
  onView,
  onEdit,
  onDelete,
  onIdUpload,
  onPromote,
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleView = () => {
    onView();
    setOpen(false);
  };

  const handleEdit = () => {
    onEdit();
    setOpen(false);
  };

  const handleDelete = () => {
    onDelete();
    setOpen(false);
  };

  const handleIdUpload = () => {
    onIdUpload();
    setOpen(false);
  };

  const handlePromote = () => {
    onPromote();
    setOpen(false);
  };

  const hasPromote = (row.statusCode === "ACTIVE" || row.statusCode === "COMPLETED") &&
    getNextGrade(row.raw.grade_level).next;

  return (
    <div
      ref={menuRef}
      style={{ position: "relative", display: "inline-flex", gap: "6px", alignItems: "center" }}
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
        className="action-menu-toggle"
        onClick={() => setOpen(!open)}
        title="More options"
        aria-label="More actions"
      >
        <MoreVertical size={16} />
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div className="action-menu-dropdown">
          {/* Edit */}
          <button
            className="action-menu-item"
            onClick={handleEdit}
            title="Edit enrollment"
          >
            <Edit2 size={14} />
            <span>Edit</span>
          </button>

          {/* Delete */}
          <button
            className="action-menu-item action-menu-item--danger"
            onClick={handleDelete}
            title="Delete enrollment"
          >
            <Trash2 size={14} />
            <span>Delete</span>
          </button>

          {/* Upload ID */}
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

          {/* Promote */}
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
        </div>
      )}
    </div>
  );
}
