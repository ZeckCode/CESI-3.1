import React, { useState, useEffect } from "react";
import { 
  Calendar, CheckCircle, XCircle, Clock, AlertCircle, 
  ChevronLeft, ChevronRight, X, List, LayoutGrid 
} from 'lucide-react';
import "../StudentWebsiteCSS/Attendance.css";
import { apiFetch } from "../api/apiFetch";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const Attendance = () => {
  const [view, setView] = useState("calendar");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_classes: 0,
    present_count: 0,
    absent_count: 0,
    late_count: 0,
    excused_count: 0,
    attendance_rate: 0,
  });
  const [calendarData, setCalendarData] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [dailyDetail, setDailyDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Calendar navigation
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  // Fetch attendance data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [statsRes, attendanceRes] = await Promise.all([
          apiFetch("/api/attendance/my-stats/"),
          apiFetch(`/api/attendance/my-attendance/?month=${currentMonth + 1}&year=${currentYear}`),
        ]);
        
        if (statsRes.ok) {
          setStats(await statsRes.json());
        }
        if (attendanceRes.ok) {
          setCalendarData(await attendanceRes.json());
        }
      } catch (err) {
        console.error("Attendance fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentMonth, currentYear]);

  // Fetch daily detail when a date is clicked
  const handleDateClick = async (dateStr) => {
    setSelectedDate(dateStr);
    setDetailLoading(true);
    try {
      const res = await apiFetch(`/api/attendance/my-attendance/?date=${dateStr}`);
      if (res.ok) {
        setDailyDetail(await res.json());
      }
    } catch (err) {
      console.error("Daily detail fetch error:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedDate(null);
    setDailyDetail(null);
  };

  // Calendar helpers
  const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();
  
  const getAttendanceForDate = (day) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return calendarData.find(d => d.date === dateStr);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "present": return "sa-status-present";
      case "late": return "sa-status-late";
      case "absent": return "sa-status-absent";
      case "partial": return "sa-status-partial";
      case "excused": return "sa-status-excused";
      default: return "";
    }
  };

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // Build calendar grid
  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentMonth, currentYear);
    const firstDay = getFirstDayOfMonth(currentMonth, currentYear);
    const cells = [];
    
    // Empty cells for days before first of month
    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`empty-${i}`} className="sa-calendar-cell sa-empty"></div>);
    }
    
    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
      const attendance = getAttendanceForDate(day);
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = 
        day === today.getDate() && 
        currentMonth === today.getMonth() && 
        currentYear === today.getFullYear();
      
      cells.push(
        <div 
          key={day} 
          className={`sa-calendar-cell ${isToday ? 'sa-today' : ''} ${attendance ? getStatusColor(attendance.overall_status) : ''} ${attendance ? 'sa-has-data' : ''}`}
          onClick={() => attendance && handleDateClick(dateStr)}
        >
          <span className="sa-day-number">{day}</span>
          {attendance && (
            <div className="sa-day-indicator">
              {attendance.overall_status === "present" && <CheckCircle size={12} />}
              {attendance.overall_status === "absent" && <XCircle size={12} />}
              {attendance.overall_status === "late" && <Clock size={12} />}
              {attendance.overall_status === "partial" && <AlertCircle size={12} />}
            </div>
          )}
        </div>
      );
    }
    
    return cells;
  };

  // Format time
  const formatTime = (time) => {
    if (!time) return "—";
    const [h, m] = time.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  };

  return (
    <main className="student-attendance-main">
      {/* Stats Overview */}
      <section className="sa-section">
        <div className="sa-stats-grid">
          <div className="sa-stat-card sa-stat-blue">
            <div className="sa-stat-header">
              <span className="sa-stat-label">Total Classes</span>
              <Calendar size={24} className="sa-stat-icon" />
            </div>
            <div className="sa-stat-value">{stats.total_classes}</div>
            <div className="sa-stat-change">This school year</div>
          </div>

          <div className="sa-stat-card sa-stat-green">
            <div className="sa-stat-header">
              <span className="sa-stat-label">Present</span>
              <CheckCircle size={24} className="sa-stat-icon" />
            </div>
            <div className="sa-stat-value">{stats.present_count}</div>
            <div className="sa-stat-change positive">On time attendance</div>
          </div>

          <div className="sa-stat-card sa-stat-yellow">
            <div className="sa-stat-header">
              <span className="sa-stat-label">Late</span>
              <Clock size={24} className="sa-stat-icon" />
            </div>
            <div className="sa-stat-value">{stats.late_count}</div>
            <div className="sa-stat-change">Arrived late</div>
          </div>

          <div className="sa-stat-card sa-stat-red">
            <div className="sa-stat-header">
              <span className="sa-stat-label">Absent</span>
              <XCircle size={24} className="sa-stat-icon" />
            </div>
            <div className="sa-stat-value">{stats.absent_count}</div>
            <div className="sa-stat-change">Days missed</div>
          </div>

          <div className="sa-stat-card sa-stat-purple">
            <div className="sa-stat-header">
              <span className="sa-stat-label">Attendance Rate</span>
              <AlertCircle size={24} className="sa-stat-icon" />
            </div>
            <div className="sa-stat-value">{stats.attendance_rate?.toFixed(1) || 0}%</div>
            <div className={`sa-stat-change ${stats.attendance_rate >= 90 ? 'positive' : ''}`}>
              {stats.attendance_rate >= 90 ? 'Excellent' : stats.attendance_rate >= 75 ? 'Good' : 'Needs improvement'}
            </div>
          </div>
        </div>
      </section>

      {/* View Toggle and Calendar Header */}
      <section className="sa-section">
        <div className="sa-section-header">
          <div>
            
            <p className="sa-section-subtitle">S.Y. {stats.school_year || '2025-2026'}</p>
          </div>
          <div className="sa-header-actions">
            <div className="sa-view-toggle">
              <button
                className={`sa-toggle-btn ${view === "calendar" ? "active" : ""}`}
                onClick={() => setView("calendar")}
              >
                <LayoutGrid size={18} />
                Calendar
              </button>
              <button
                className={`sa-toggle-btn ${view === "list" ? "active" : ""}`}
                onClick={() => setView("list")}
              >
                <List size={18} />
                List
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      {loading ? (
        <div className="sa-loading">Loading attendance data...</div>
      ) : view === "calendar" ? (
        /* CALENDAR VIEW */
        <section className="sa-section">
          <div className="sa-calendar-container">
            {/* Month Navigation */}
            <div className="sa-calendar-header">
              <button className="sa-nav-btn" onClick={prevMonth}>
                <ChevronLeft size={20} />
              </button>
              <h3 className="sa-month-title">
                {MONTHS[currentMonth]} {currentYear}
              </h3>
              <button className="sa-nav-btn" onClick={nextMonth}>
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Day Headers */}
            <div className="sa-calendar-grid">
              {DAYS.map(day => (
                <div key={day} className="sa-day-header">{day}</div>
              ))}
              {renderCalendar()}
            </div>

            {/* Legend */}
            <div className="sa-legend">
              <div className="sa-legend-item">
                <span className="sa-legend-dot sa-status-present"></span> Present
              </div>
              <div className="sa-legend-item">
                <span className="sa-legend-dot sa-status-late"></span> Late
              </div>
              <div className="sa-legend-item">
                <span className="sa-legend-dot sa-status-absent"></span> Absent
              </div>
              <div className="sa-legend-item">
                <span className="sa-legend-dot sa-status-partial"></span> Partial
              </div>
            </div>
          </div>
        </section>
      ) : (
        /* LIST VIEW */
        <section className="sa-section">
          <div className="sa-table-container">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Present</th>
                  <th>Late</th>
                  <th>Absent</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {calendarData.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="sa-empty-cell">
                      No attendance records found for this month.
                    </td>
                  </tr>
                ) : (
                  calendarData.map((record) => (
                    <tr key={record.date}>
                      <td data-label="Date">{record.date}</td>
                      <td data-label="Present">
                        <span className="sa-count-badge sa-count-present">{record.present}</span>
                      </td>
                      <td data-label="Late">
                        <span className="sa-count-badge sa-count-late">{record.late}</span>
                      </td>
                      <td data-label="Absent">
                        <span className="sa-count-badge sa-count-absent">{record.absent}</span>
                      </td>
                      <td data-label="Status">
                        <span className={`sa-status-badge sa-badge-${record.overall_status}`}>
                          {record.overall_status}
                        </span>
                      </td>
                      <td data-label="Action">
                        <button 
                          className="sa-detail-btn"
                          onClick={() => handleDateClick(record.date)}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Daily Detail Modal */}
      {selectedDate && (
        <div className="sa-modal-overlay" onClick={closeDetail}>
          <div className="sa-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sa-modal-header">
              <h3>Attendance for {selectedDate}</h3>
              <button className="sa-close-btn" onClick={closeDetail}>
                <X size={20} />
              </button>
            </div>
            <div className="sa-modal-body">
              {detailLoading ? (
                <div className="sa-loading">Loading...</div>
              ) : dailyDetail?.records?.length > 0 ? (
                <div className="sa-detail-list">
                  {dailyDetail.records.map((item, idx) => (
                    <div key={idx} className={`sa-detail-item sa-item-${item.status.toLowerCase()}`}>
                      <div className="sa-detail-subject">
                        <span className="sa-subject-name">{item.subject_name || 'General'}</span>
                        {item.subject_code && (
                          <span className="sa-subject-code">{item.subject_code}</span>
                        )}
                      </div>
                      <div className="sa-detail-info">
                        <span className={`sa-status-badge sa-badge-${item.status.toLowerCase()}`}>
                          {item.status}
                        </span>
                        {item.time_in && (
                          <span className="sa-time">
                            <Clock size={14} /> {formatTime(item.time_in)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="sa-no-data">No attendance records for this day.</div>
              )}
              {dailyDetail?.summary && (
                <div className="sa-detail-summary">
                  <div className="sa-summary-row">
                    <span>Total Classes:</span>
                    <strong>{dailyDetail.summary.total}</strong>
                  </div>
                  <div className="sa-summary-row">
                    <span>Present:</span>
                    <strong className="sa-text-present">{dailyDetail.summary.present}</strong>
                  </div>
                  <div className="sa-summary-row">
                    <span>Late:</span>
                    <strong className="sa-text-late">{dailyDetail.summary.late}</strong>
                  </div>
                  <div className="sa-summary-row">
                    <span>Absent:</span>
                    <strong className="sa-text-absent">{dailyDetail.summary.absent}</strong>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Attendance;
