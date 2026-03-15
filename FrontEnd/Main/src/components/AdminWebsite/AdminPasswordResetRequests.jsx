import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Send, RefreshCw, ShieldCheck } from "lucide-react";
import { apiFetch } from "../api/apiFetch";
import Toast from "../Global/Toast";
import "../AdminWebsiteCSS/AdminPasswordResetRequests.css";

export default function AdminPasswordResetRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("PENDING");
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((title, message, type = "warning") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await apiFetch("/api/accounts/admin/password-reset-requests/");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to load requests.");
      }

      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg = err.message || "Something went wrong.";
      setError(msg);
      addToast("Load Failed", msg, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleSendLink = async (id) => {
    try {
      setSendingId(id);

      const res = await apiFetch(
        `/api/accounts/admin/password-reset-requests/${id}/send-link/`,
        {
          method: "POST",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to send reset link.");
      }

      await fetchRequests();
      addToast("Success", data.detail || "Reset link sent.", "success");
    } catch (err) {
      addToast("Send Failed", err.message || "Something went wrong.", "error");
    } finally {
      setSendingId(null);
    }
  };

  const counts = useMemo(() => {
    return {
      PENDING: requests.filter((item) => item.status === "PENDING").length,
      LINK_SENT: requests.filter((item) => item.status === "LINK_SENT").length,
      COMPLETED: requests.filter((item) => item.status === "COMPLETED").length,
    };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    return requests.filter((item) => item.status === activeTab);
  }, [requests, activeTab]);

  const getEmptyText = () => {
    if (activeTab === "PENDING") return "No pending requests.";
    if (activeTab === "LINK_SENT") return "No sent-link requests.";
    if (activeTab === "COMPLETED") return "No completed requests.";
    return "No requests found.";
  };

  return (
    <div className="reset-requests-page">
      <div className="reset-requests-header">
        <div>
          <h2>
            <ShieldCheck size={24} /> Password Reset Requests
          </h2>
          <p>Review user requests and track their reset status.</p>
        </div>

        <button className="refresh-btn" onClick={fetchRequests}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="reset-tabs">
        <button
          className={`reset-tab ${activeTab === "PENDING" ? "active" : ""}`}
          onClick={() => setActiveTab("PENDING")}
        >
          Pending
          <span className="reset-tab-count">{counts.PENDING}</span>
        </button>

        <button
          className={`reset-tab ${activeTab === "LINK_SENT" ? "active" : ""}`}
          onClick={() => setActiveTab("LINK_SENT")}
        >
          Sent
          <span className="reset-tab-count">{counts.LINK_SENT}</span>
        </button>

        <button
          className={`reset-tab ${activeTab === "COMPLETED" ? "active" : ""}`}
          onClick={() => setActiveTab("COMPLETED")}
        >
          Completed
          <span className="reset-tab-count">{counts.COMPLETED}</span>
        </button>
      </div>

      {loading ? (
        <div className="reset-empty">Loading requests...</div>
      ) : error && filteredRequests.length === 0 ? (
        <div className="reset-error">{error}</div>
      ) : filteredRequests.length === 0 ? (
        <div className="reset-empty">{getEmptyText()}</div>
      ) : (
        <div className="reset-table-wrap">
          <table className="reset-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Message</th>
                <th>Status</th>
                <th>Requested At</th>
                <th>Sent At</th>
                <th>Completed At</th>
                {activeTab === "PENDING" && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((item) => (
                <tr key={item.id}>
                  <td>{item.user_name}</td>
                  <td>{item.email}</td>
                  <td>{item.message || "—"}</td>
                  <td>
                   <span className={`reset-status-badge ${item.status.toLowerCase()}`}>
                      {item.status}
                    </span>
                  </td>
                  <td>{item.requested_at ? new Date(item.requested_at).toLocaleString() : "—"}</td>
                  <td>{item.sent_at ? new Date(item.sent_at).toLocaleString() : "—"}</td>
                  <td>{item.completed_at ? new Date(item.completed_at).toLocaleString() : "—"}</td>

                  {activeTab === "PENDING" && (
                    <td>
                      <button
                        className="send-link-btn"
                        onClick={() => handleSendLink(item.id)}
                        disabled={sendingId === item.id}
                      >
                        <Send size={14} />
                        {sendingId === item.id ? "Sending..." : "Send Link"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Toast toasts={toasts} dismissToast={dismissToast} />
    </div>
  );
}