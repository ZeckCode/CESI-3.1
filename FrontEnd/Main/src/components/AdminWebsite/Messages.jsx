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
} from "../api/messaging";
import { getToken } from "../Auth/auth";

const AdminMessages = () => {
  const [activeTab, setActiveTab] = useState("profanity");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
  const [selectedReportModal, setSelectedReportModal] = useState(null);
  const [reportAdminNotes, setReportAdminNotes] = useState("");
  const [reportActionSubmitting, setReportActionSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [wordsRes, flagsRes, restrictionsRes, reportsRes] =
        await Promise.all([
          listProfanityWords(),
          listFlaggedMessages(),
          listChatRestrictions(),
          listMessageReports('PENDING'),
        ]);

      setProfanityWords(wordsRes || []);
      setFlaggedMessages(flagsRes || []);
      setRestrictions(restrictionsRes || []);
      setMessageReports(reportsRes.results || reportsRes || []);
      setError("");
    } catch (err) {
      setError("Failed to load data");
      console.error(err);
    } finally {
      setLoading(false);
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
        options.restriction_type = flagRestrictionType;
        if (flagRestrictionType === "TEMP_MUTE") {
          options.duration_hours = flagRestrictionDuration;
        }
        options.admin_notes = flagAdminNotes;
      }

      await takeFlagAction(selectedFlagModal.id, action, options);
      setFlaggedMessages((prev) =>
        prev.filter((f) => f.id !== selectedFlagModal.id)
      );
      setSelectedFlagModal(null);
      setFlagAdminNotes("");
      setFlagRestrictionDuration(24);
      setFlagRestrictionType("TEMP_MUTE");
    } catch (err) {
      setError("Failed to take action on flag");
    } finally {
      setFlagActionSubmitting(false);
    }
  };

  // Restriction Management
  const handleLiftRestriction = async (id) => {
    if (!window.confirm("Lift this restriction?")) return;

    try {
      await liftRestriction(id);
      setRestrictions((prev) => prev.filter((r) => r.id !== id));
      setSelectedRestrictionModal(null);
    } catch (err) {
      setError("Failed to lift restriction");
    }
  };

  // Message Report Management
  const handleReviewReport = async (action) => {
    if (!selectedReportModal) return;

    setReportActionSubmitting(true);
    try {
      await reviewMessageReport(selectedReportModal.id, action, reportAdminNotes);
      setMessageReports((prev) =>
        prev.filter((r) => r.id !== selectedReportModal.id)
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

  const pendingFlags = flaggedMessages.filter(
    (f) => f.status === "PENDING"
  );

  const activeMessageReports = messageReports.filter(
    (r) => r.message && !r.message.is_deleted
  );

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "20px" }}>Loading...</div>
    );
  }

  return (
    <div className="admin-messages-layout">
      {/* Tab Navigation */}
      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === "profanity" ? "active" : ""}`}
          onClick={() => setActiveTab("profanity")}
        >
          🚫 Profanity Words ({profanityWords.length})
        </button>
        <button
          className={`admin-tab ${activeTab === "flags" ? "active" : ""}`}
          onClick={() => setActiveTab("flags")}
        >
          ⚠️ Flagged Messages ({pendingFlags.length})
        </button>
        <button
          className={`admin-tab ${activeTab === "restrictions" ? "active" : ""}`}
          onClick={() => setActiveTab("restrictions")}
        >
          🔒 Restrictions ({restrictions.length})
        </button>
        <button
          className={`admin-tab ${activeTab === "reports" ? "active" : ""}`}
          onClick={() => setActiveTab("reports")}
        >
          🚩 Message Reports ({activeMessageReports.length})
        </button>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <div style={{ display: "flex", gap: "20px", padding: "20px", flex: 1 }}>
        {/* PROFANITY TAB */}
        {activeTab === "profanity" && (
          <>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: "20px" }}>
                <h3 style={{ marginTop: 0 }}>Add Profanity Word</h3>
                <form onSubmit={handleAddProfanityWord} style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    placeholder="Word to block..."
                    value={newWord}
                    onChange={(e) => setNewWord(e.target.value)}
                    style={{ flex: 1, padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
                  />
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    style={{ padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
                  >
                    <option value="SWEAR">Swear</option>
                    <option value="INSULT">Insult</option>
                    <option value="HARASSMENT">Harassment</option>
                    <option value="INAPPROPRIATE">Inappropriate</option>
                  </select>
                  <button
                    type="submit"
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "#24148a",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Add
                  </button>
                </form>
              </div>

              <h3>Words ({filteredProfanityWords.length})</h3>
              <div style={{ marginBottom: "10px" }}>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  style={{ padding: "8px", border: "1px solid #ccc", borderRadius: "4px", width: "100%" }}
                >
                  <option value="">All Categories</option>
                  <option value="SWEAR">Swear</option>
                  <option value="INSULT">Insult</option>
                  <option value="HARASSMENT">Harassment</option>
                  <option value="INAPPROPRIATE">Inappropriate</option>
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "600px", overflowY: "auto" }}>
                {filteredProfanityWords.length === 0 ? (
                  <p style={{ color: "#999" }}>No words</p>
                ) : (
                  filteredProfanityWords.map((word) => (
                    <div
                      key={word.id}
                      onClick={() => setSelectedWordModal(word)}
                      style={{
                        padding: "10px",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        cursor: "pointer",
                        backgroundColor: selectedWordModal?.id === word.id ? "#e8e8ff" : "#f9f9f9",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e8e8e8")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = selectedWordModal?.id === word.id ? "#e8e8ff" : "#f9f9f9")}
                    >
                      <div style={{ fontWeight: "bold" }}>{word.word}</div>
                      <div style={{ fontSize: "12px", color: "#666" }}>
                        {word.category} • {word.is_active ? "🟢 Active" : "🔴 Inactive"}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Word Detail Modal */}
            {selectedWordModal && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  backgroundColor: "rgba(0,0,0,0.45)",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  zIndex: 2100,
                }}
              >
                <div
                  style={{
                    width: "100%",
                    maxWidth: "400px",
                    background: "#fff",
                    borderRadius: "10px",
                    padding: "20px",
                  }}
                >
                  <h3 style={{ marginTop: 0 }}>Profanity Word Details</h3>
                  <p>
                    <strong>Word:</strong> {selectedWordModal.word}
                  </p>
                  <p>
                    <strong>Category:</strong> {selectedWordModal.category}
                  </p>
                  <p>
                    <strong>Status:</strong> {selectedWordModal.is_active ? "🟢 Active" : "🔴 Inactive"}
                  </p>
                  <div style={{ display: "flex", gap: "8px", marginTop: "20px" }}>
                    <button
                      onClick={() => handleToggleProfanityWord(selectedWordModal)}
                      style={{
                        flex: 1,
                        padding: "8px",
                        backgroundColor: selectedWordModal.is_active ? "#ffcc00" : "#28a745",
                        color: selectedWordModal.is_active ? "#000" : "#fff",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      {selectedWordModal.is_active ? "Disable" : "Enable"}
                    </button>
                    <button
                      onClick={() => handleDeleteProfanityWord(selectedWordModal.id)}
                      style={{
                        flex: 1,
                        padding: "8px",
                        backgroundColor: "#dc3545",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setSelectedWordModal(null)}
                      style={{
                        flex: 1,
                        padding: "8px",
                        backgroundColor: "#ccc",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      Close
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
            <div style={{ flex: 1 }}>
              <h3 style={{ marginTop: 0 }}>Pending Flags ({pendingFlags.length})</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "600px", overflowY: "auto" }}>
                {pendingFlags.length === 0 ? (
                  <p style={{ color: "#999" }}>No pending flags</p>
                ) : (
                  pendingFlags.map((flag) => (
                    <div
                      key={flag.id}
                      onClick={() => setSelectedFlagModal(flag)}
                      style={{
                        padding: "10px",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        cursor: "pointer",
                        backgroundColor: selectedFlagModal?.id === flag.id ? "#fff3cd" : "#f9f9f9",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f5e6cc")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = selectedFlagModal?.id === flag.id ? "#fff3cd" : "#f9f9f9")}
                    >
                      <div style={{ fontWeight: "bold" }}>{getUserDisplayName(flag.message.sender)}</div>
                      <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>
                        {new Date(flag.created_at).toLocaleDateString()}
                      </div>
                      <div style={{ fontSize: "13px", marginBottom: "5px" }}>
                        "{flag.message.content.substring(0, 60)}..."
                      </div>
                      <div style={{ fontSize: "12px", color: "#8a1414" }}>
                        🚫 {flag.flagged_words}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Flag Detail Modal */}
            {selectedFlagModal && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  backgroundColor: "rgba(0,0,0,0.45)",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  zIndex: 2100,
                }}
              >
                <div
                  style={{
                    width: "100%",
                    maxWidth: "500px",
                    background: "#fff",
                    borderRadius: "10px",
                    padding: "20px",
                    maxHeight: "80vh",
                    overflowY: "auto",
                  }}
                >
                  <h3 style={{ marginTop: 0 }}>Flagged Message Details</h3>
                  <p>
                    <strong>Sender:</strong> {getUserDisplayName(selectedFlagModal.message.sender)}
                  </p>
                  <p>
                    <strong>Chat:</strong> {selectedFlagModal.chat.name}
                  </p>
                  <p>
                    <strong>Message:</strong> {selectedFlagModal.message.content}
                  </p>
                  <p>
                    <strong>Flagged Words:</strong> {selectedFlagModal.flagged_words}
                  </p>

                  <h4 style={{ marginTop: "20px" }}>Take Action</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "15px" }}>
                    <button
                      onClick={() => handleTakeFlagAction("approve")}
                      disabled={flagActionSubmitting}
                      style={{
                        padding: "8px",
                        backgroundColor: "#28a745",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => handleTakeFlagAction("dismiss")}
                      disabled={flagActionSubmitting}
                      style={{
                        padding: "8px",
                        backgroundColor: "#6c757d",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      ✕ Dismiss
                    </button>
                    <button
                      onClick={() => handleTakeFlagAction("delete")}
                      disabled={flagActionSubmitting}
                      style={{
                        padding: "8px",
                        backgroundColor: "#dc3545",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        gridColumn: "1 / -1",
                      }}
                    >
                      🗑️ Delete Message
                    </button>
                  </div>

                  <div style={{ borderTop: "1px solid #ddd", paddingTop: "15px" }}>
                    <h5 style={{ marginTop: 0 }}>Restrict User</h5>
                    <div style={{ marginBottom: "10px" }}>
                      <select
                        value={flagRestrictionType}
                        onChange={(e) => setFlagRestrictionType(e.target.value)}
                        disabled={flagActionSubmitting}
                        style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
                      >
                        <option value="TEMP_MUTE">Temporary Mute</option>
                        <option value="PERMANENT_REMOVE">Permanent Remove</option>
                      </select>
                    </div>
                    {flagRestrictionType === "TEMP_MUTE" && (
                      <div style={{ marginBottom: "10px" }}>
                        <input
                          type="number"
                          min="1"
                          max="168"
                          value={flagRestrictionDuration}
                          onChange={(e) => setFlagRestrictionDuration(parseInt(e.target.value))}
                          disabled={flagActionSubmitting}
                          placeholder="Duration (hours)"
                          style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
                        />
                      </div>
                    )}
                    <div style={{ marginBottom: "10px" }}>
                      <textarea
                        value={flagAdminNotes}
                        onChange={(e) => setFlagAdminNotes(e.target.value)}
                        disabled={flagActionSubmitting}
                        placeholder="Admin notes..."
                        style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px", minHeight: "60px", fontFamily: "Arial" }}
                      />
                    </div>
                    <button
                      onClick={() => handleTakeFlagAction("restrict")}
                      disabled={flagActionSubmitting}
                      style={{
                        width: "100%",
                        padding: "8px",
                        backgroundColor: "#0056b3",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      🔒 Apply Restriction
                    </button>
                  </div>

                  <button
                    onClick={() => setSelectedFlagModal(null)}
                    disabled={flagActionSubmitting}
                    style={{
                      width: "100%",
                      padding: "8px",
                      marginTop: "15px",
                      backgroundColor: "#ccc",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* RESTRICTIONS TAB */}
        {activeTab === "restrictions" && (
          <>
            <div style={{ flex: 1 }}>
              <h3 style={{ marginTop: 0 }}>Active Restrictions ({restrictions.length})</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "600px", overflowY: "auto" }}>
                {restrictions.length === 0 ? (
                  <p style={{ color: "#999" }}>No active restrictions</p>
                ) : (
                  restrictions.map((restriction) => (
                    <div
                      key={restriction.id}
                      onClick={() => setSelectedRestrictionModal(restriction)}
                      style={{
                        padding: "10px",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        cursor: "pointer",
                        backgroundColor: selectedRestrictionModal?.id === restriction.id ? "#e8f0ff" : "#f9f9f9",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e8e8e8")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = selectedRestrictionModal?.id === restriction.id ? "#e8f0ff" : "#f9f9f9")}
                    >
                      <div style={{ fontWeight: "bold" }}>{getUserDisplayName(restriction.user)}</div>
                      <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>
                        {restriction.restriction_type === "TEMP_MUTE" ? "⏱️ Temp Mute" : "🔒 Permanent"}
                      </div>
                      <div style={{ fontSize: "12px", color: "#666" }}>
                        {restriction.chat.name}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Restriction Detail Modal */}
            {selectedRestrictionModal && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  backgroundColor: "rgba(0,0,0,0.45)",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  zIndex: 2100,
                }}
              >
                <div
                  style={{
                    width: "100%",
                    maxWidth: "400px",
                    background: "#fff",
                    borderRadius: "10px",
                    padding: "20px",
                  }}
                >
                  <h3 style={{ marginTop: 0 }}>Restriction Details</h3>
                  <p>
                    <strong>User:</strong> {getUserDisplayName(selectedRestrictionModal.user)}
                  </p>
                  <p>
                    <strong>Type:</strong> {selectedRestrictionModal.restriction_type === "TEMP_MUTE" ? "⏱️ Temporary Mute" : "🔒 Permanent Remove"}
                  </p>
                  <p>
                    <strong>Chat:</strong> {selectedRestrictionModal.chat.name}
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
                  <div style={{ display: "flex", gap: "8px", marginTop: "20px" }}>
                    <button
                      onClick={() => handleLiftRestriction(selectedRestrictionModal.id)}
                      style={{
                        flex: 1,
                        padding: "8px",
                        backgroundColor: "#28a745",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      Lift Restriction
                    </button>
                    <button
                      onClick={() => setSelectedRestrictionModal(null)}
                      style={{
                        flex: 1,
                        padding: "8px",
                        backgroundColor: "#ccc",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      Close
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
            <div style={{ flex: 1 }}>
              <h3 style={{ marginTop: 0 }}>Pending Reports ({activeMessageReports.length})</h3>
              <p style={{ fontSize: "12px", color: "#666", marginBottom: "15px" }}>
                Approve = reviewed/no action • Dismiss = invalid report • Delete = enforce
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "600px", overflowY: "auto" }}>
                {activeMessageReports.length === 0 ? (
                  <p style={{ color: "#999" }}>No pending reports</p>
                ) : (
                  activeMessageReports.map((report) => (
                    <div
                      key={report.id}
                      onClick={() => setSelectedReportModal(report)}
                      style={{
                        padding: "10px",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        cursor: "pointer",
                        backgroundColor: selectedReportModal?.id === report.id ? "#fff3cd" : "#f9f9f9",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f5e6cc")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = selectedReportModal?.id === report.id ? "#fff3cd" : "#f9f9f9")}
                    >
                      <div style={{ fontWeight: "bold", color: "#d9534f" }}>{report.reason}</div>
                      <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>
                        By {getUserDisplayName(report.reporter)} • {new Date(report.created_at).toLocaleDateString()}
                      </div>
                      <div style={{ fontSize: "13px" }}>
                        "{report.message.content.substring(0, 60)}..."
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Report Detail Modal */}
            {selectedReportModal && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  backgroundColor: "rgba(0,0,0,0.45)",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  zIndex: 2100,
                }}
              >
                <div
                  style={{
                    width: "100%",
                    maxWidth: "500px",
                    background: "#fff",
                    borderRadius: "10px",
                    padding: "20px",
                    maxHeight: "80vh",
                    overflowY: "auto",
                  }}
                >
                  <h3 style={{ marginTop: 0 }}>Report Details</h3>
                  <p>
                    <strong>Reason:</strong> {selectedReportModal.reason}
                  </p>
                  <p>
                    <strong>Reported by:</strong> {getUserDisplayName(selectedReportModal.reporter)}
                  </p>
                  <p>
                    <strong>Message Author:</strong> {getUserDisplayName(selectedReportModal.message.sender)}
                  </p>
                  <p>
                    <strong>Message:</strong> {selectedReportModal.message.content}
                  </p>
                  {selectedReportModal.description && (
                    <p>
                      <strong>Details:</strong> {selectedReportModal.description}
                    </p>
                  )}

                  <div style={{ borderTop: "1px solid #ddd", paddingTop: "15px", marginTop: "15px" }}>
                    <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>Admin Notes:</label>
                    <textarea
                      value={reportAdminNotes}
                      onChange={(e) => setReportAdminNotes(e.target.value)}
                      disabled={reportActionSubmitting}
                      placeholder="Add notes for the record..."
                      style={{
                        width: "100%",
                        padding: "8px",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        minHeight: "80px",
                        fontFamily: "Arial",
                        marginBottom: "15px",
                      }}
                    />

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "10px" }}>
                      <button
                        onClick={() => handleReviewReport("approve")}
                        disabled={reportActionSubmitting}
                        style={{
                          padding: "8px",
                          backgroundColor: "#28a745",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => handleReviewReport("dismiss")}
                        disabled={reportActionSubmitting}
                        style={{
                          padding: "8px",
                          backgroundColor: "#6c757d",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        ✕ Dismiss
                      </button>
                      <button
                        onClick={() => handleReviewReport("delete")}
                        disabled={reportActionSubmitting}
                        style={{
                          padding: "8px",
                          backgroundColor: "#dc3545",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          gridColumn: "1 / -1",
                        }}
                      >
                        🗑️ Delete Message
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedReportModal(null)}
                    disabled={reportActionSubmitting}
                    style={{
                      width: "100%",
                      padding: "8px",
                      backgroundColor: "#ccc",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminMessages;
