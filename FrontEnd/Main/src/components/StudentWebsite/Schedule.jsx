import React, { useState, useEffect } from "react";
import { Calendar, List, Clock, MapPin, User, BookOpen } from 'lucide-react';
import "../StudentWebsiteCSS/Schedule.css";
import { apiFetch } from "../api/apiFetch";

// Day mapping for the calendar (backend uses 3-letter codes)
const DAY_MAP = {
  MON: "Mon",
  TUE: "Tue",
  WED: "Wed",
  THU: "Thu",
  FRI: "Fri",
  SAT: "Sat",
  SUN: "Sun",
};

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri"];

// Colors for subjects (cycling)
const SUBJECT_COLORS = [
  "cat-blue", "cat-green", "cat-yellow", "cat-purple", "cat-pink", "cat-orange"
];

const Schedule = () => {
  const [view, setView] = useState("calendar");
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const res = await apiFetch("/api/classmanagement/schedules/my/");
        if (!res.ok) throw new Error("Failed to load schedule");
        const data = await res.json();
        setSchedules(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Schedule fetch error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSchedule();
  }, []);

  // Transform API data
  const scheduleData = schedules.map((s, idx) => ({
    id: s.id,
    subject: s.subject_name,
    subject_code: s.subject_code,
    section: s.section_name,
    day: DAY_MAP[s.day_of_week] || s.day_of_week,
    startTime: s.start_time,
    endTime: s.end_time,
    room: s.room_code || "TBA",
    teacher: s.teacher_name,
    color: SUBJECT_COLORS[idx % SUBJECT_COLORS.length],
  }));

  // Get unique time slots for calendar view (sorted)
  const getTimeSlots = () => {
    const times = new Set();
    scheduleData.forEach(s => {
      times.add(s.startTime);
    });
    return Array.from(times).sort();
  };

  const timeSlots = getTimeSlots();

  // Format time for display
  const formatTime = (time) => {
    if (!time) return "";
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Check if schedule falls on a specific time slot
  const getSessionsForTimeSlot = (day, timeSlot) => {
    return scheduleData.filter(s => 
      s.day === day && s.startTime === timeSlot
    );
  };

  return (
    <main className="student-schedule-main">
      {/* Header with View Toggle */}
      <section className="ss-section">
        <div className="ss-section-header">
          {/* <div>
            <h2 className="ss-section-title">Weekly Schedule</h2>
            <p className="ss-section-subtitle">S.Y. 2025–2026</p>
          </div> */}
          <div className="ss-view-toggle">
            <button
              className={`ss-toggle-btn ${view === "calendar" ? "active" : ""}`}
              onClick={() => setView("calendar")}
            >
              <Calendar size={18} />
              Timeline
            </button>
            <button
              className={`ss-toggle-btn ${view === "table" ? "active" : ""}`}
              onClick={() => setView("table")}
            >
              <List size={18} />
              Table
            </button>
          </div>
        </div>
      </section>

      {/* Loading / Error */}
      {loading && (
        <div className="ss-loading">Loading schedule...</div>
      )}
      {error && (
        <div className="ss-error">{error}</div>
      )}

      {!loading && !error && (
        <section className="ss-section">
          <div className="ss-table-container">
            {view === "table" ? (
              /* TABLE VIEW */
              <table className="ss-table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Day</th>
                    <th>Time</th>
                    <th>Room</th>
                    <th>Teacher</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleData.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="ss-empty-cell">
                        No schedules found for your section.
                      </td>
                    </tr>
                  ) : (
                    scheduleData.map((row) => (
                      <tr key={row.id}>
                        <td data-label="Subject">
                          <div className="ss-subject-info">
                            <span className="ss-subject-name">{row.subject}</span>
                            <span className="ss-subject-code">{row.subject_code}</span>
                          </div>
                        </td>
                        <td data-label="Day">
                          <span className="ss-day-badge">{row.day}</span>
                        </td>
                        <td data-label="Time" className="ss-time-cell">
                          <Clock size={14} />
                          {formatTime(row.startTime)} - {formatTime(row.endTime)}
                        </td>
                        <td data-label="Room">
                          <span className="ss-room-badge">
                            <MapPin size={14} />
                            {row.room}
                          </span>
                        </td>
                        <td data-label="Teacher">
                          <span className="ss-teacher-name">
                            <User size={14} />
                            {row.teacher}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              /* CALENDAR/TIMELINE VIEW */
              <div className="ss-calendar-scroll">
                <div className="ss-calendar-grid" style={{ gridTemplateColumns: `80px repeat(${DAY_ORDER.length}, 1fr)` }}>
                  {/* Header Row */}
                  <div className="ss-time-header">
                    <Clock size={16} />
                  </div>
                  {DAY_ORDER.map((day) => (
                    <div key={day} className="ss-day-header">{day}</div>
                  ))}

                  {/* Time Slot Rows */}
                  {timeSlots.length === 0 ? (
                    <div className="ss-empty-calendar" style={{ gridColumn: '1 / -1' }}>
                      No classes scheduled.
                    </div>
                  ) : (
                    timeSlots.map((time) => (
                      <React.Fragment key={time}>
                        <div className="ss-time-cell">{formatTime(time)}</div>
                        {DAY_ORDER.map((day) => {
                          const sessions = getSessionsForTimeSlot(day, time);
                          return (
                            <div key={`${day}-${time}`} className="ss-grid-cell">
                              {sessions.map((item) => (
                                <div key={item.id} className={`ss-event-card ${item.color}`}>
                                  <div className="ss-event-subject">{item.subject}</div>
                                  <div className="ss-event-code">{item.subject_code}</div>
                                  <div className="ss-event-info">
                                    <span><MapPin size={12} /> {item.room}</span>
                                    <span>{formatTime(item.startTime)} - {formatTime(item.endTime)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
};

export default Schedule;
