import React, { useState, useEffect, useMemo } from "react";
import { List, Calendar, BookOpen, Users, Clock, MapPin } from "lucide-react";
import "../TeacherWebsiteCSS/TeacherClassSchedule.css";
import { apiFetch } from "../api/apiFetch";

const API = "";

// Day mapping (backend uses 3-letter codes)
const DAY_MAP = {
  MON: { short: "M", full: "Monday", order: 0 },
  TUE: { short: "T", full: "Tuesday", order: 1 },
  WED: { short: "W", full: "Wednesday", order: 2 },
  THU: { short: "TH", full: "Thursday", order: 3 },
  FRI: { short: "F", full: "Friday", order: 4 },
};

const DAYS_ORDER = ["MON", "TUE", "WED", "THU", "FRI"];
const TIME_SLOTS = [
  "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00"
];

// Color palette for subjects
const SUBJECT_COLORS = [
  "#dbeafe", "#d1fae5", "#fef3c7", "#fce7f3", "#e0e7ff",
  "#cffafe", "#f3e8ff", "#fef9c3", "#dcfce7", "#ffe4e6",
];

const TeacherClassSchedule = () => {
  const [viewMode, setViewMode] = useState("table");
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [schoolYear, setSchoolYear] = useState(null);

  // Fetch schedules on mount
  useEffect(() => {
    (async () => {
      try {
        const [schedRes, syRes] = await Promise.all([
          apiFetch(`${API}/api/classmanagement/schedules/my/`),
          apiFetch(`${API}/api/classmanagement/school-years/active/`),
        ]);

        if (schedRes.ok) {
          const data = await schedRes.json();
          setSchedules(data);
        }

        if (syRes.ok) {
          const syData = await syRes.json();
          setSchoolYear(syData);
        }
      } catch (e) {
        console.error("Failed to load schedules:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Assign colors to subjects
  const subjectColorMap = useMemo(() => {
    const map = {};
    const uniqueSubjects = [...new Set(schedules.map(s => s.subject))];
    uniqueSubjects.forEach((subj, idx) => {
      map[subj] = SUBJECT_COLORS[idx % SUBJECT_COLORS.length];
    });
    return map;
  }, [schedules]);

  // Stats
  const stats = useMemo(() => {
    const uniqueSections = new Set(schedules.map(s => s.section));
    const totalHours = schedules.reduce((sum, s) => {
      if (s.start_time && s.end_time) {
        const [sh, sm] = s.start_time.split(":").map(Number);
        const [eh, em] = s.end_time.split(":").map(Number);
        return sum + (eh * 60 + em - sh * 60 - sm) / 60;
      }
      return sum;
    }, 0);

    return {
      totalClasses: schedules.length,
      totalSections: uniqueSections.size,
      totalHours: totalHours.toFixed(1),
    };
  }, [schedules]);

  // Format time for display
  const formatTime = (time) => {
    if (!time) return "";
    const [h, m] = time.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  };

  // Get class for a time slot and day (checks if class overlaps this hour)
  const getClassForSlot = (day, timeSlot) => {
    const slotHour = parseInt(timeSlot.split(":")[0]);
    
    return schedules.find((s) => {
      if (s.day_of_week !== day) return false;
      if (!s.start_time) return false;
      
      const startHour = parseInt(s.start_time.split(":")[0]);
      const endHour = s.end_time ? parseInt(s.end_time.split(":")[0]) : startHour + 1;
      
      // Check if this slot is within the class time range
      return slotHour >= startHour && slotHour < endHour;
    });
  };

  return (
    <div className="tcs">
      {/* Header */}
      <header className="tcs__header">
        <div className="tcs__headerLeft">
          <h2 className="tcs__title">Class Schedule</h2>
          <p className="tcs__subtitle">
            {schoolYear && (
              <span className="tcs__syTag">
                <Calendar size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
                S.Y. {schoolYear.name || `${schoolYear.start_year}-${schoolYear.end_year}`}
              </span>
            )}
          </p>
        </div>

        <div className="tcs__toggle" role="tablist">
          <button
            type="button"
            className={`tcs__toggleBtn ${viewMode === "table" ? "tcs__toggleBtn--active" : ""}`}
            onClick={() => setViewMode("table")}
          >
            <List size={16} /> Table
          </button>
          <button
            type="button"
            className={`tcs__toggleBtn ${viewMode === "calendar" ? "tcs__toggleBtn--active" : ""}`}
            onClick={() => setViewMode("calendar")}
          >
            <Calendar size={16} /> Timeline
          </button>
        </div>
      </header>

      {/* Stats */}
      <section className="tcs__stats">
        <div className="tcsStat">
          <div className="tcsStat__icon tcsStat__icon--primary">
            <BookOpen size={20} />
          </div>
          <div>
            <div className="tcsStat__label">Total Classes</div>
            <div className="tcsStat__value">{stats.totalClasses}</div>
          </div>
        </div>

        <div className="tcsStat">
          <div className="tcsStat__icon tcsStat__icon--success">
            <Users size={20} />
          </div>
          <div>
            <div className="tcsStat__label">Sections</div>
            <div className="tcsStat__value">{stats.totalSections}</div>
          </div>
        </div>

        <div className="tcsStat">
          <div className="tcsStat__icon tcsStat__icon--warn">
            <Clock size={20} />
          </div>
          <div>
            <div className="tcsStat__label">Hours / Week</div>
            <div className="tcsStat__value">{stats.totalHours}</div>
          </div>
        </div>
      </section>

      {/* Loading */}
      {loading && (
        <div className="tcs__loading">Loading schedule...</div>
      )}

      {/* Table View */}
      {!loading && viewMode === "table" && (
        <section className="tcsBlock">
          <div className="tcsTableWrap">
            <table className="tcsTable">
              <thead>
                <tr>
                  <th className="tcsTh">Subject</th>
                  <th className="tcsTh">Section</th>
                  <th className="tcsTh">Day</th>
                  <th className="tcsTh">Time</th>
                  <th className="tcsTh">Room</th>
                </tr>
              </thead>
              <tbody>
                {schedules.length === 0 ? (
                  <tr>
                    <td className="tcsTd tcs__empty" colSpan={5}>
                      No schedules assigned yet.
                    </td>
                  </tr>
                ) : (
                  schedules
                    .sort((a, b) => {
                      const dayA = DAY_MAP[a.day_of_week]?.order ?? 99;
                      const dayB = DAY_MAP[b.day_of_week]?.order ?? 99;
                      if (dayA !== dayB) return dayA - dayB;
                      return (a.start_time || "").localeCompare(b.start_time || "");
                    })
                    .map((sched) => (
                      <tr className="tcsTr" key={sched.id}>
                        <td className="tcsTd tcsTd--subject">
                          {sched.subject_name}
                          {sched.subject_code && (
                            <span className="tcsTd__code">{sched.subject_code}</span>
                          )}
                        </td>
                        <td className="tcsTd">
                          <span className="tcsPill">{sched.section_name}</span>
                        </td>
                        <td className="tcsTd">
                          <span className="tcsDay">{DAY_MAP[sched.day_of_week]?.full || sched.day_of_week}</span>
                        </td>
                        <td className="tcsTd">
                          {formatTime(sched.start_time)} - {formatTime(sched.end_time)}
                        </td>
                        <td className="tcsTd">
                          <span className="tcsRoom">
                            <MapPin size={14} />
                            {sched.room_code || "TBA"}
                          </span>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Calendar/Timeline View */}
      {!loading && viewMode === "calendar" && (
        <section className="tcsBlock">
          <div className="tcsTableWrap">
            <table className="calTable">
              <thead>
                <tr>
                  <th className="calTh calTh--time">Time</th>
                  {DAYS_ORDER.map((day) => (
                    <th className="calTh" key={day}>{DAY_MAP[day].full}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map((timeSlot) => (
                  <tr key={timeSlot} className="calTr">
                    <td className="calTime">{formatTime(timeSlot + ":00")}</td>
                    {DAYS_ORDER.map((day) => {
                      const sched = getClassForSlot(day, timeSlot);
                      const bgColor = sched ? subjectColorMap[sched.subject] : "transparent";
                      return (
                        <td
                          key={day}
                          className="calTd"
                          style={{ backgroundColor: bgColor }}
                        >
                          {sched && (
                            <div className="calBlock">
                              <div className="calBlock__title">
                                {sched.subject_name}
                              </div>
                              <div className="calBlock__meta">
                                {sched.section_name}
                              </div>
                              <div className="calBlock__meta">
                                {sched.room_code || "TBA"}
                              </div>
                              <div className="calBlock__time">
                                {formatTime(sched.start_time)} - {formatTime(sched.end_time)}
                              </div>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};

export default TeacherClassSchedule;
