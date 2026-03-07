import React, { useState } from "react";
import { Bell, Search, Filter, Send, AlertCircle, Clock, CheckCircle, DollarSign } from "lucide-react";
import "../AdminWebsiteCSS/PaymentReminders.css";

const PaymentReminders = () => {
  const [hoveredRow, setHoveredRow] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const reminders = [
    { id: 1, student: "Miguel Torres", grade: "Grade 4", balance: 20000, dueDate: "2026-01-20", status: "pending" },
    { id: 2, student: "Elena Rodriguez", grade: "Grade 2", balance: 14500, dueDate: "2026-01-18", status: "reminded" },
    { id: 3, student: "Luis Fernandez", grade: "Kindergarten", balance: 12000, dueDate: "2026-01-16", status: "pending" },
    { id: 4, student: "Mark Johnson", grade: "Grade 6", balance: 16500, dueDate: "2026-01-22", status: "pending" },
    { id: 5, student: "Maria Garcia", grade: "Grade 1", balance: 14000, dueDate: "2026-01-19", status: "reminded" },
  ];

  const filteredReminders = reminders.filter(r => {
    const matchesSearch = r.student.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         r.grade.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || r.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const totalOutstanding = reminders.reduce((sum, r) => sum + r.balance, 0);
  const pendingCount = reminders.filter(r => r.status === 'pending').length;
  const remindedCount = reminders.filter(r => r.status === 'reminded').length;

  const sendReminder = (student) => {
    alert(`Reminder sent to ${student} via SMS, Email, and Notification`);
  };

  return (
    <main className="pr-main">
      {/* Stats Overview */}
      <section className="pr-section">
        <div className="pr-stats-grid">
          <div className="pr-stat-card pr-stat-blue">
            <div className="pr-stat-header">
              <span className="pr-stat-label">Total Outstanding</span>
              <DollarSign size={24} className="pr-stat-icon" />
            </div>
            <div className="pr-stat-value">₱{totalOutstanding.toLocaleString()}</div>
            <div className="pr-stat-change">Combined balance due</div>
          </div>
          <div className="pr-stat-card pr-stat-yellow">
            <div className="pr-stat-header">
              <span className="pr-stat-label">Pending Reminders</span>
              <Clock size={24} className="pr-stat-icon" />
            </div>
            <div className="pr-stat-value">{pendingCount}</div>
            <div className="pr-stat-change">Awaiting notification</div>
          </div>
          <div className="pr-stat-card pr-stat-green">
            <div className="pr-stat-header">
              <span className="pr-stat-label">Reminders Sent</span>
              <CheckCircle size={24} className="pr-stat-icon" />
            </div>
            <div className="pr-stat-value">{remindedCount}</div>
            <div className="pr-stat-change">Already notified</div>
          </div>
        </div>
      </section>

      {/* Reminders Table */}
      <section className="pr-section">
        <div className="pr-section-header">
          <div>
            <h2 className="pr-section-title">Payment Reminders</h2>
            <p className="pr-section-subtitle">Manage overdue and upcoming payments with quick reminders</p>
          </div>
          <div className="pr-header-actions">
            <button className="pr-btn-success" onClick={() => alert("Bulk reminders sent via SMS & Email")}>
              <Bell size={18} /> Send Bulk Reminders
            </button>
          </div>
        </div>

        <div className="pr-filters-container">
          <div className="pr-search-box">
            <Search size={20} className="pr-search-icon" />
            <input
              type="text"
              placeholder="Search by student name or grade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-search-input"
            />
          </div>
          <div className="pr-filter-group">
            <Filter size={20} />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="pr-filter-select">
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="reminded">Reminded</option>
            </select>
          </div>
        </div>

        <div className="pr-table-container">
          <table className="pr-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Grade</th>
                <th>Balance</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReminders.length > 0 ? (
                filteredReminders.map((r) => (
                  <tr
                    key={r.id}
                    className={hoveredRow === r.id ? "pr-row-hover" : ""}
                    onMouseEnter={() => setHoveredRow(r.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <td className="pr-student-name">{r.student}</td>
                    <td>{r.grade}</td>
                    <td className="pr-amount">₱{r.balance.toLocaleString()}</td>
                    <td>{r.dueDate}</td>
                    <td>
                      <span className={`pr-status-badge pr-status-${r.status}`}>
                        {r.status === "pending" ? "Pending" : "Reminded"}
                      </span>
                    </td>
                    <td>
                      <button className="pr-btn-send" onClick={() => sendReminder(r.student)}>
                        <Send size={16} /> Send
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="pr-no-data">
                    <AlertCircle size={24} />
                    <p>No reminders found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
};

export default PaymentReminders;
