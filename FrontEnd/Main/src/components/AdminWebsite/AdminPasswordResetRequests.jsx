import React, { useEffect, useState } from "react";
import { Mail, Send, RefreshCw, ShieldCheck } from "lucide-react";
import { apiFetch } from "../api/apiFetch";
import "../AdminWebsiteCSS/AdminPasswordResetRequests.css";

export default function AdminPasswordResetRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState(null);
  const [error, setError] = useState("");

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await apiFetch("/api/accounts/admin/password-reset-requests/");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to load requests.");
      }

      setRequests(data);
    } catch (err) {
      setError(err.message || "Something went wrong.");
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

      const res = await apiFetch(`/api/accounts/admin/password-reset-requests/${id}/send-link/`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to send reset link.");
      }

      await fetchRequests();
      alert(data.detail || "Reset link sent.");
    } catch (err) {
      alert(err.message || "Something went wrong.");
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="reset-requests-page">
      <div className="reset-requests-header">
        <div>
          <h2><ShieldCheck size={24} /> Password Reset Requests</h2>
          <p>Review user requests and send reset links.</p>
        </div>
        <button className="refresh-btn" onClick={fetchRequests}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="reset-empty">Loading requests...</div>
      ) : error ? (
        <div className="reset-error">{error}</div>
      ) : requests.length === 0 ? (
        <div className="reset-empty">No password reset requests found.</div>
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
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((item) => (
                <tr key={item.id}>
                  <td>{item.user_name}</td>
                  <td>{item.email}</td>
                  <td>{item.message || "—"}</td>
                  <td>
                    <span className={`status-badge ${item.status.toLowerCase()}`}>
                      {item.status}
                    </span>
                  </td>
                  <td>{new Date(item.requested_at).toLocaleString()}</td>
                  <td>
                    <button
                      className="send-link-btn"
                      onClick={() => handleSendLink(item.id)}
                      disabled={sendingId === item.id || item.status === "COMPLETED"}
                    >
                      <Send size={14} />
                      {sendingId === item.id ? "Sending..." : "Send Link"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}