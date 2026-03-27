import React, { useState, useEffect } from "react";
import "../AdminWebsiteCSS/Messages.css";
import {
  listProfanityWords,
  addProfanityWord,
  updateProfanityWord,
  deleteProfanityWord,
  listFlaggedMessages,
  takeFlagAction,
  listChatRestrictions,
  liftRestriction,
  listMessageReports,
  reviewMessageReport,
  listMessageDeletionLogs,
} from "../api/messaging";
import { getToken } from "../Auth/auth";

const AdminMessages = () => {
  const [activeTab, setActiveTab] = useState("profanity");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recordsPage, setRecordsPage] = useState(1);
  const recordsPerPage = 12;


  // Profanity Words State
  const [profanityWords, setProfanityWords] = useState([]);
  const [newWord, setNewWord] = useState("");
  const [newCategory, setNewCategory] = useState("SWEAR");
  const [filterCategory, setFilterCategory] = useState("");
  const [selectedWordModal, setSelectedWordModal] = useState(null);

  // Flagged Messages State
  const [flaggedMessages, setFlaggedMessages] = useState([]);
  const [selectedFlagModal, setSelectedFlagModal] = useState(null);
  const [flagRestrictionType, setFlagRestrictionType] = useState("TEMP_MUTE");
  const [flagRestrictionDuration, setFlagRestrictionDuration] = useState(24);
  const [flagAdminNotes, setFlagAdminNotes] = useState("");
  const [flagActionSubmitting, setFlagActionSubmitting] = useState(false);

  // Chat Restrictions State
  const [restrictions, setRestrictions] = useState([]);
  const [selectedRestrictionModal, setSelectedRestrictionModal] = useState(null);

  // Message Reports State
  const [messageReports, setMessageReports] = useState([]);
  const [deletionLogs, setDeletionLogs] = useState([]);
  const [selectedReportModal, setSelectedReportModal] = useState(null);
  const [reportAdminNotes, setReportAdminNotes] = useState("");
  const [reportActionSubmitting, setReportActionSubmitting] = useState(false);

  useEffect(() => {
    loadData();
    // Auto-refresh restrictions tab every 2 seconds when viewing it
    const interval = setInterval(() => {
      if (activeTab === 'restrictions') {
        loadRestrictions();
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [wordsRes, flagsRes, restrictionsRes, reportsRes, deletionLogsRes] =
        await Promise.all([
          listProfanityWords(),
          listFlaggedMessages(),
          listChatRestrictions(),
          listMessageReports('PENDING'),
          listMessageDeletionLogs(),
        ]);

      setProfanityWords(wordsRes || []);
      setFlaggedMessages(flagsRes || []);
      setRestrictions(restrictionsRes || []);
      setMessageReports(reportsRes.results || reportsRes || []);
      setDeletionLogs(deletionLogsRes || []);
      setError("");
    } catch (err) {
      setError("Failed to load data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadRestrictions = async () => {
    try {
      const restrictionsRes = await listChatRestrictions();
      setRestrictions(restrictionsRes || []);
    } catch (err) {
      console.error("Failed to refresh restrictions", err);
    }
  };

  const getUserDisplayName = (user) => {
    if (!user) return "User";
    const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim();
    return user.display_name || fullName || user.username || "User";
  };

  // Profanity Management
  const handleAddProfanityWord = async (e) => {
    e.preventDefault();
    if (!newWord.trim()) return;

    try {
      const word = await addProfanityWord(newWord, newCategory);
      setProfanityWords((prev) => [...prev, word]);
      setNewWord("");
      setNewCategory("SWEAR");
    } catch (err) {
      setError("Failed to add profanity word");
    }
  };

  const handleDeleteProfanityWord = async (id) => {
    if (!window.confirm("Delete this profanity word?")) return;

    try {
      await deleteProfanityWord(id);
      setProfanityWords((prev) => prev.filter((w) => w.id !== id));
      setSelectedWordModal(null);
    } catch (err) {
      setError("Failed to delete profanity word");
    }
  };

  const handleToggleProfanityWord = async (word) => {
    try {
      const updated = await updateProfanityWord(word.id, word.category, !word.is_active);
      setProfanityWords((prev) =>
        prev.map((w) => (w.id === word.id ? updated : w))
      );
    } catch (err) {
      setError("Failed to update profanity word");
    }
  };

  // Flag Management
  const handleTakeFlagAction = async (action) => {
    if (!selectedFlagModal) return;

    setFlagActionSubmitting(true);
    try {
      const options = {};
      if (action === "restrict") {
        const isPermanent = flagRestrictionType === "PERMANENT_REMOVE";
        options.is_permanent = isPermanent;
        options.restrict_duration = isPermanent ? undefined : flagRestrictionDuration;
        options.admin_notes = flagAdminNotes;
      }

      const updatedFlag = await takeFlagAction(selectedFlagModal.id, action, options);
      setFlaggedMessages((prev) =>
        prev.map((f) => (f.id === updatedFlag.id ? updatedFlag : f))
      );

      // Refresh restrictions if we just applied a restriction
      if (action === "restrict") {
        await loadRestrictions();
      }

      setSelectedFlagModal(null);
      setFlagAdminNotes("");
      setFlagRestrictionDuration(24);
      setFlagRestrictionType("TEMP_MUTE");
    } catch (err) {
      setError("Failed to take action on flag");
      console.error(err);
    } finally {
      setFlagActionSubmitting(false);
    }
  };

  // Restriction Management
  const handleLiftRestriction = async (id) => {
    if (!window.confirm("Lift this restriction?")) return;

    try {
      await liftRestriction(id);
      setRestrictions((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, expires_at: new Date().toISOString() } : r
        )
      );
      setSelectedRestrictionModal(null);
    } catch (err) {
      setError("Failed to lift restriction");
    }
  };

  const formatRestrictionTime = (expiresAt) => {
    if (!expiresAt) {
      return "Never (Permanent)";
    }
    const date = new Date(expiresAt);
    const now = new Date();
    const diffMs = date - now;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours <= 0 && diffMins <= 0) {
      return "Expired";
    }
    if (diffHours > 0) {
      return `${diffHours}h ${diffMins}m remaining`;
    }
    return `${diffMins}m remaining`;
  };

  // Message Report Management
  const handleReviewReport = async (action) => {
    if (!selectedReportModal) return;

    setReportActionSubmitting(true);
    try {
      const updatedReport = await reviewMessageReport(selectedReportModal.id, action, reportAdminNotes);
      setMessageReports((prev) =>
        prev.map((r) => (r.id === updatedReport.id ? updatedReport : r))
      );
      setSelectedReportModal(null);
      setReportAdminNotes("");
    } catch (err) {
      setError(`Failed to ${action} report`);
    } finally {
      setReportActionSubmitting(false);
    }
  };

  const filteredProfanityWords =
    filterCategory === ""
      ? profanityWords
      : profanityWords.filter((w) => w.category === filterCategory);

  const pendingFlags = flaggedMessages.filter((f) => f.status === "PENDING");
  const pendingReports = messageReports.filter((r) => r.status === "PENDING");

  const activeMessageReports = messageReports.filter(
    (r) => r.message && !r.message.is_deleted
  );

  const activeRestrictions = restrictions.filter((r) => {
    if (r.restriction_type === "PERMANENT_REMOVE") return true;
    if (r.expires_at) {
      return new Date(r.expires_at) > new Date();
    }
    return true;
  });

  const records = [
    ...flaggedMessages.map((f) => ({
      id: `flag-${f.id}`,
      type: "Flagged",
      status: f.status,
      target: getUserDisplayName(f.message?.sender),
      actor: f.reviewed_by ? getUserDisplayName(f.reviewed_by) : "(pending)",
      chat: f.chat?.name || f.chat_name || "Global",
      details: f.message?.content,
      timestamp: f.flagged_at,
    })),
    ...restrictions.map((r) => ({
      id: `restriction-${r.id}`,
      type: "Restriction",
      status: r.restriction_type,
      target: getUserDisplayName(r.user),
      actor: r.restricted_by ? getUserDisplayName(r.restricted_by) : "(auto)",
      chat: r.chat_name || r.chat?.name || "Global",
      details: r.reason || "-",
      timestamp: r.created_at,
    })),
    ...messageReports.map((r) => ({
      id: `report-${r.id}`,
      type: "Report",
      status: r.status,
      target: getUserDisplayName(r.message?.sender),
      actor: getUserDisplayName(r.reporter),
      chat: r.message?.chat?.name || r.message?.chat_name || "Unknown",
      details: r.description || r.reason || "-",
      timestamp: r.created_at,
    })),
    ...deletionLogs.map((log) => ({
      id: `deletion-${log.id}`,
      type: "Deletion",
      status: "DELETED",
      target: log.message?.sender ? getUserDisplayName(log.message.sender) : "Unknown",
      actor: log.deleted_by ? getUserDisplayName(log.deleted_by) : "Unknown",
      chat: log.message_chat_name || "Unknown",
      details: `Reason: ${log.reason}`,
      timestamp: log.created_at,
    })),
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const totalRecordPages = Math.max(1, Math.ceil(records.length / recordsPerPage));
  const paginatedRecords = records.slice((recordsPage - 1) * recordsPerPage, recordsPage * recordsPerPage);


  if (loading) {
    return (
      <div className="admin-messages-layout">
        <div style={{ padding: "48px", textAlign: "center", color: "var(--muted)" }}>
          <div style={{ fontSize: "28px", marginBottom: "12px" }}>⏳</div>
          <p>Loading moderation data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-messages-layout">
      {/* Header */}
      <div className="admin-messages-header">
        <h1>Chat Moderation</h1>
        <p>Manage profanity filters, flagged messages, restrictions, and reports</p>
      </div>

      {/* Tab Navigation */}
      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === "profanity" ? "active" : ""}`}
          onClick={() => setActiveTab("profanity")}
        >
          🚫 Profanity
        </button>
        <button
          className={`admin-tab ${activeTab === "flags" ? "active" : ""}`}
          onClick={() => setActiveTab("flags")}
        >
          ⚠️ Flagged ({pendingFlags.length})
        </button>
        <button
          className={`admin-tab ${activeTab === "restrictions" ? "active" : ""}`}
          onClick={() => setActiveTab("restrictions")}
        >
          🔒 Restrictions ({activeRestrictions.length})
        </button>
        <button
          className={`admin-tab ${activeTab === "reports" ? "active" : ""}`}
          onClick={() => setActiveTab("reports")}
        >
          🚩 Reports ({pendingReports.length})
        </button>
        <button
          className={`admin-tab ${activeTab === "records" ? "active" : ""}`}
          onClick={() => setActiveTab("records")}
        >
          🗂 Records ({records.length})
        </button>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-messages-content">
        {/* PROFANITY TAB */}
        {activeTab === "profanity" && (
          <>
            <div className="admin-messages-list">
              <div className="admin-filter-section">
                <h3 style={{ margin: "0 0 12px 0", fontSize: "15px", fontWeight: 600 }}>Add Profanity Word</h3>
                <form onSubmit={handleAddProfanityWord} style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <input
                    type="text"
                    placeholder="Word to block..."
                    value={newWord}
                    onChange={(e) => setNewWord(e.target.value)}
                    className="admin-filter-input"
                    style={{ flex: 1, minWidth: "140px" }}
                  />
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="admin-filter-select"
                    style={{ minWidth: "110px" }}
                  >
                    <option value="SWEAR">Swear</option>
                    <option value="INSULT">Insult</option>
                    <option value="HARASSMENT">Harassment</option>
                    <option value="INAPPROPRIATE">Inappropriate</option>
                  </select>
                  <button
                    type="submit"
                    className="admin-btn admin-btn--primary"
                  >
                    Add
                  </button>
                </form>
              </div>

              <div className="admin-filter-section">
                <label className="admin-filter-label">Filter by Category</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="admin-filter-select"
                >
                  <option value="">All Categories</option>
                  <option value="SWEAR">Swear</option>
                  <option value="INSULT">Insult</option>
                  <option value="HARASSMENT">Harassment</option>
                  <option value="INAPPROPRIATE">Inappropriate</option>
                </select>
              </div>

              <div className="admin-list-header">
                <h3 style={{ margin: 0 }}>Words</h3>
                <div className="admin-list-count">{filteredProfanityWords.length}</div>
              </div>

              <div className="admin-list-container">
                {filteredProfanityWords.length === 0 ? (
                  <div className="admin-list-empty">
                    <div className="admin-list-empty-icon">🔍</div>
                    <p>No words found</p>
                  </div>
                ) : (
                  filteredProfanityWords.map((word) => (
                    <div
                      key={word.id}
                      className={`admin-list-item ${selectedWordModal?.id === word.id ? "selected" : ""}`}
                      onClick={() => setSelectedWordModal(word)}
                    >
                      <div className="admin-list-item-title">{word.word}</div>
                      <div className="admin-list-item-meta">
                        {word.category} • {word.is_active ? "🟢 Active" : "🔴 Inactive"}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Word Detail Modal */}
            {selectedWordModal && (
              <div className="admin-modal-overlay" onClick={() => setSelectedWordModal(null)}>
                <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="admin-modal-header">
                    <h2 className="admin-modal-title">Word Details</h2>
                    <button
                      className="admin-modal-close"
                      onClick={() => setSelectedWordModal(null)}
                    >
                      ✕
                    </button>
                  </div>

                  <div className="admin-modal-body">
                    <div className="admin-detail-row">
                      <div className="admin-detail-label">Word</div>
                      <div className="admin-detail-value admin-detail-value--code">
                        {selectedWordModal.word}
                      </div>
                    </div>

                    <div className="admin-detail-row">
                      <div className="admin-detail-label">Category</div>
                      <div className="admin-detail-value">{selectedWordModal.category}</div>
                    </div>

                    <div className="admin-detail-row">
                      <div className="admin-detail-label">Status</div>
                      <div>
                        <span className={`admin-pill ${selectedWordModal.is_active ? "admin-pill--success" : "admin-pill--danger"}`}>
                          {selectedWordModal.is_active ? "🟢 Active" : "🔴 Inactive"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="admin-modal-footer">
                    <button
                      onClick={() => handleToggleProfanityWord(selectedWordModal)}
                      className={`admin-btn ${selectedWordModal.is_active ? "admin-btn--warning" : "admin-btn--success"}`}
                      style={{ flex: 1 }}
                    >
                      {selectedWordModal.is_active ? "Disable" : "Enable"}
                    </button>
                    <button
                      onClick={() => handleDeleteProfanityWord(selectedWordModal.id)}
                      className="admin-btn admin-btn--danger"
                      style={{ flex: 1 }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* FLAGGED MESSAGES TAB */}
        {activeTab === "flags" && (
          <>
            <div className="admin-messages-list">
              <div className="admin-list-header">
                <h3 style={{ margin: 0 }}>Pending Flags</h3>
                <div className="admin-list-count">{pendingFlags.length}</div>
              </div>

              <div className="admin-list-container">
                {pendingFlags.length === 0 ? (
                  <div className="admin-list-empty">
                    <div className="admin-list-empty-icon">✨</div>
                    <p>No pending flags</p>
                  </div>
                ) : (
                  pendingFlags.map((flag) => (
                    <div
                      key={flag.id}
                      className={`admin-list-item ${selectedFlagModal?.id === flag.id ? "selected" : ""}`}
                      onClick={() => setSelectedFlagModal(flag)}
                    >
                      <div className="admin-list-item-title">{getUserDisplayName(flag.message.sender)}</div>
                      <div className="admin-list-item-meta">
                        {new Date(flag.created_at).toLocaleDateString()}
                      </div>
                      <div className="admin-list-item-preview">
                        "{flag.message.content.substring(0, 60)}..."
                      </div>
                      <div className="admin-list-item-flag">
                        {flag.flagged_words}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Flag Detail Modal */}
            {selectedFlagModal && (
              <div className="admin-modal-overlay" onClick={() => setSelectedFlagModal(null)}>
                <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="admin-modal-header">
                    <h2 className="admin-modal-title">Flagged Message</h2>
                    <button
                      className="admin-modal-close"
                      onClick={() => setSelectedFlagModal(null)}
                    >
                      ✕
                    </button>
                  </div>

                  <div className="admin-modal-body">
                    <div className="admin-detail-row">
                      <div className="admin-detail-label">Sender</div>
                      <div className="admin-detail-value">
                        {getUserDisplayName(selectedFlagModal.message.sender)}
                      </div>
                    </div>

                    <div className="admin-detail-row">
                      <div className="admin-detail-label">Chat</div>
                      <div className="admin-detail-value">
                        {selectedFlagModal.chat?.name || selectedFlagModal.chat_name || "Global"}
                      </div>
                    </div>

                    <div className="admin-detail-row">
                      <div className="admin-detail-label">Message</div>
                      <div className="admin-detail-value">{selectedFlagModal.message.content}</div>
                    </div>

                    <div className="admin-detail-row">
                      <div className="admin-detail-label">Flagged Words</div>
                      <div className="admin-detail-value">
                        <span className="admin-pill admin-pill--danger">
                          {selectedFlagModal.flagged_words}
                        </span>
                      </div>
                    </div>

                    <hr style={{ margin: "20px 0", border: "1px solid var(--border)" }} />

                    <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", color: "var(--dark)" }}>
                      Take Action
                    </h4>

                    <div className="admin-btn-group">
                      <button
                        onClick={() => handleTakeFlagAction("dismiss")}
                        disabled={flagActionSubmitting}
                        className="admin-btn admin-btn--secondary"
                      >
                        ✕ Dismiss
                      </button>
                      <button
                        onClick={() => handleTakeFlagAction("delete")}
                        disabled={flagActionSubmitting}
                        className="admin-btn admin-btn--danger admin-btn-group full"
                      >
                        🗑️ Delete Message
                      </button>
                    </div>

                    <hr style={{ margin: "20px 0", border: "1px solid var(--border)" }} />

                    <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", color: "var(--dark)" }}>
                      Restrict User
                    </h4>

                    <div className="admin-form-group">
                      <label className="admin-detail-label">Restriction Type</label>
                      <select
                        value={flagRestrictionType}
                        onChange={(e) => setFlagRestrictionType(e.target.value)}
                        disabled={flagActionSubmitting}
                        className="admin-form-select"
                      >
                        <option value="TEMP_MUTE">Temporary Mute</option>
                        <option value="PERMANENT_REMOVE">Permanent Remove</option>
                      </select>
                    </div>

                    {flagRestrictionType === "TEMP_MUTE" && (
                      <div className="admin-form-group">
                        <label className="admin-detail-label">Duration (Hours)</label>
                        <input
                          type="number"
                          min="1"
                          max="168"
                          value={flagRestrictionDuration}
                          onChange={(e) => setFlagRestrictionDuration(parseInt(e.target.value))}
                          disabled={flagActionSubmitting}
                          placeholder="Duration (hours)"
                          className="admin-form-input"
                        />
                      </div>
                    )}

                    <div className="admin-form-group">
                      <label className="admin-detail-label">Admin Notes</label>
                      <textarea
                        value={flagAdminNotes}
                        onChange={(e) => setFlagAdminNotes(e.target.value)}
                        disabled={flagActionSubmitting}
                        placeholder="Add notes for the record..."
                        className="admin-form-textarea"
                      />
                    </div>

                    <button
                      onClick={() => handleTakeFlagAction("restrict")}
                      disabled={flagActionSubmitting}
                      className="admin-btn admin-btn--primary"
                      style={{ width: "100%" }}
                    >
                      🔒 Apply Restriction
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* RESTRICTIONS TAB */}
        {activeTab === "restrictions" && (
          <>
            <div className="admin-messages-list">
              <div className="admin-list-header">
                <h3 style={{ margin: 0 }}>Active Restrictions</h3>
                <div className="admin-list-count">{restrictions.length}</div>
              </div>

              <div className="admin-list-container">
                {activeRestrictions.length === 0 ? (
                  <div className="admin-list-empty">
                    <div className="admin-list-empty-icon">🎉</div>
                    <p>No active restrictions</p>
                  </div>
                ) : (
                  activeRestrictions.map((restriction) => (
                    <div
                      key={restriction.id}
                      className={`admin-list-item ${selectedRestrictionModal?.id === restriction.id ? "selected" : ""}`}
                      onClick={() => setSelectedRestrictionModal(restriction)}
                    >
                      <div className="admin-list-item-title">
                        {getUserDisplayName(restriction.user)}
                      </div>
                      <div className="admin-list-item-meta">
                        {restriction.restriction_type === "TEMP_MUTE"
                          ? `⏱️ ${formatRestrictionTime(restriction.expires_at)}`
                          : "🔒 Permanent Remove"}
                      </div>
                      <div className="admin-list-item-preview">
                        {restriction.chat_name || restriction.chat?.name || "Global"}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Restriction Detail Modal */}
            {selectedRestrictionModal && (
              <div className="admin-modal-overlay" onClick={() => setSelectedRestrictionModal(null)}>
                <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="admin-modal-header">
                    <h2 className="admin-modal-title">Restriction Details</h2>
                    <button
                      className="admin-modal-close"
                      onClick={() => setSelectedRestrictionModal(null)}
                    >
                      ✕
                    </button>
                  </div>

                  <div className="admin-modal-body">
                    <p>
                      <strong>User:</strong> {getUserDisplayName(selectedRestrictionModal.user)}
                    </p>
                    <p>
                      <strong>Type:</strong> {selectedRestrictionModal.restriction_type === "TEMP_MUTE" ? "⏱️ Temporary Mute" : "🔒 Permanent Remove"}
                    </p>
                    <p>
                      <strong>Chat:</strong> {selectedRestrictionModal.chat_name || selectedRestrictionModal.chat?.name || "Global"}
                    </p>
                    <p>
                      <strong>Expires:</strong>{" "}
                      {selectedRestrictionModal.expires_at
                        ? new Date(selectedRestrictionModal.expires_at).toLocaleDateString()
                        : "Never"}
                    </p>
                    {selectedRestrictionModal.admin_notes && (
                      <p>
                        <strong>Notes:</strong> {selectedRestrictionModal.admin_notes}
                      </p>
                    )}
                  </div>

                  <div className="admin-modal-footer" style={{ display: "flex", gap: "8px" }}>
 
                    <button
                      onClick={() => handleLiftRestriction(selectedRestrictionModal.id)}
                      className="admin-btn admin-btn--success"
                      style={{ flex: 1 }}
                    >
                      Lift Restriction
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* REPORTS TAB */}
        {activeTab === "reports" && (
          <>
            <div className="admin-messages-list">
              <div className="admin-list-header">
                <h3 style={{ margin: 0 }}>Pending Reports</h3>
                <div className="admin-list-count">{pendingReports.length}</div>
              </div>

              <p style={{ fontSize: "12px", color: "var(--muted)", padding: "0 12px", margin: "8px 0" }}>
                Dismiss = invalid • Delete = enforce
              </p>

              <div className="admin-list-container">
                {pendingReports.length === 0 ? (
                  <div className="admin-list-empty">
                    <div className="admin-list-empty-icon">✅</div>
                    <p>No pending reports</p>
                  </div>
                ) : (
                  pendingReports.map((report) => (
                    <div
                      key={report.id}
                      className={`admin-list-item ${selectedReportModal?.id === report.id ? "selected" : ""}`}
                      onClick={() => setSelectedReportModal(report)}
                    >
                      <div className="admin-list-item-title" style={{ color: "var(--danger)" }}>
                        {report.reason}
                      </div>
                      <div className="admin-list-item-meta">
                        By {getUserDisplayName(report.reporter)} •{" "}
                        {new Date(report.created_at).toLocaleDateString()}
                      </div>
                      <div className="admin-list-item-preview">
                        "{report.message.content.substring(0, 60)}..."
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Report Detail Modal */}
            {selectedReportModal && (
              <div className="admin-modal-overlay" onClick={() => setSelectedReportModal(null)}>
                <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="admin-modal-header">
                    <h2 className="admin-modal-title">Message Report</h2>
                    <button
                      className="admin-modal-close"
                      onClick={() => setSelectedReportModal(null)}
                    >
                      ✕
                    </button>
                  </div>

                  <div className="admin-modal-body">
                    <div className="admin-detail-row">
                      <div className="admin-detail-label">Reason</div>
                      <div>
                        <span className="admin-pill admin-pill--danger">
                          {selectedReportModal.reason}
                        </span>
                      </div>
                    </div>

                    <div className="admin-detail-row">
                      <div className="admin-detail-label">Reported By</div>
                      <div className="admin-detail-value">
                        {getUserDisplayName(selectedReportModal.reporter)}
                      </div>
                    </div>

                    <div className="admin-detail-row">
                      <div className="admin-detail-label">Message Author</div>
                      <div className="admin-detail-value">
                        {getUserDisplayName(selectedReportModal.message.sender)}
                      </div>
                    </div>

                    <div className="admin-detail-row">
                      <div className="admin-detail-label">Message Content</div>
                      <div className="admin-detail-value">
                        {selectedReportModal.message.content}
                      </div>
                    </div>

                    {selectedReportModal.description && (
                      <div className="admin-detail-row">
                        <div className="admin-detail-label">Description</div>
                        <div className="admin-detail-value">
                          {selectedReportModal.description}
                        </div>
                      </div>
                    )}

                    <hr style={{ margin: "20px 0", border: "1px solid var(--border)" }} />

                    <div className="admin-form-group">
                      <label className="admin-detail-label">Admin Notes</label>
                      <textarea
                        value={reportAdminNotes}
                        onChange={(e) => setReportAdminNotes(e.target.value)}
                        disabled={reportActionSubmitting}
                        placeholder="Add notes for the record..."
                        className="admin-form-textarea"
                      />
                    </div>

                    <div className="admin-btn-group">
                      <button
                        onClick={() => setSelectedReportModal(null)}
                        disabled={reportActionSubmitting}
                        className="admin-btn admin-btn--secondary"
                      >
                        ✕ Dismiss
                      </button>
                      <button
                        onClick={() => handleReviewReport("delete")}
                        disabled={reportActionSubmitting}
                        className="admin-btn admin-btn--danger admin-btn-group full"
                      >
                        🗑️ Delete Message
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* RECORDS TAB */}
        {activeTab === "records" && (
          <>
            <div className="admin-messages-list">
              <div className="admin-list-header">
                <h3 style={{ margin: 0 }}>Moderation Records</h3>
                <div className="admin-list-count">{records.length}</div>
              </div>

              <p style={{ fontSize: "12px", color: "var(--muted)", padding: "0 12px", margin: "8px 0" }}>
                This tab includes the full history of flags, restrictions, and reports.
              </p>

              {records.length === 0 ? (
                <div className="admin-list-empty">
                  <div className="admin-list-empty-icon">📘</div>
                  <p>No moderation records found</p>
                </div>
              ) : (
                <>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Target</th>
                        <th>Actor</th>
                        <th>Chat</th>
                        <th>Details</th>
                        <th>When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRecords.map((record) => (
                        <tr key={record.id}>
                          <td>{record.type}</td>
                          <td>{record.status}</td>
                          <td>{record.target || "--"}</td>
                          <td>{record.actor || "--"}</td>
                          <td>{record.chat || "--"}</td>
                          <td>{record.details || "--"}</td>
                          <td>{record.timestamp ? new Date(record.timestamp).toLocaleString() : "--"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {records.length > recordsPerPage && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                      <button
                        className="admin-btn admin-btn--secondary"
                        onClick={() => setRecordsPage((prev) => Math.max(1, prev - 1))}
                        disabled={recordsPage === 1}
                      >
                        ← Prev
                      </button>
                      <span style={{ fontSize: '14px', color: '#64748b' }}>
                        Page {recordsPage} of {totalRecordPages}
                      </span>
                      <button
                        className="admin-btn admin-btn--secondary"
                        onClick={() => setRecordsPage((prev) => Math.min(totalRecordPages, prev + 1))}
                        disabled={recordsPage === totalRecordPages}
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* DETAIL PANEL */}
        <div className="admin-messages-detail">
          {null}
        </div>
      </div>
    </div>
  );
};

export default AdminMessages;
