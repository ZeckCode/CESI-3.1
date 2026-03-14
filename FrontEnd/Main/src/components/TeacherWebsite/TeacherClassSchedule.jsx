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
  "13:00", "14:00", "15:00", "16:00", "17:00",
];

// Color palette for subjects
const SUBJECT_COLORS = [
  "#dbeafe", "#d1fae5", "#fef3c7", "#fce7f3", "#e0e7ff",
  "#cffafe", "#f3e8ff", "#fef9c3", "#dcfce7", "#ffe4e6",
];

const getGradeSource = (obj) =>
  obj?.grade_level ??
  obj?.grade ??
  obj?.grade_code ??
  obj?.gradeLevel ??
  obj?.grade_level_display ??
  "";

const normalizeGradeCode = (value) => {
  if (value === null || value === undefined) return "";

  let v = String(value).trim().toLowerCase();
  v = v.replace(/_/g, " ").replace(/\s+/g, " ").trim();

  if (v.startsWith("grade ")) {
    const rest = v.slice(6).trim();

    if (rest === "kinder") return "kinder";
    if (rest === "pre-kinder" || rest === "prek" || rest === "pre kinder") return "prek";
    if (/^\d$/.test(rest)) return `grade${rest}`;
    if (/^grade\s*\d$/.test(rest)) return rest.replace(/\s+/g, "");
    if (/^grade\d$/.test(rest)) return rest;
  }

  if (/^g\s*\d$/.test(v)) {
    return `grade${v.replace(/[^\d]/g, "")}`;
  }

  if (/^grade\s*\d$/.test(v)) {
    return v.replace(/\s+/g, "");
  }

  const map = {
    "0": "kinder",
    "1": "grade1",
    "2": "grade2",
    "3": "grade3",
    "4": "grade4",
    "5": "grade5",
    "6": "grade6",
    kinder: "kinder",
    grade1: "grade1",
    grade2: "grade2",
    grade3: "grade3",
    grade4: "grade4",
    grade5: "grade5",
    grade6: "grade6",
    "grade 1": "grade1",
    "grade 2": "grade2",
    "grade 3": "grade3",
    "grade 4": "grade4",
    "grade 5": "grade5",
    "grade 6": "grade6",
    prek: "prek",
    "pre-kinder": "prek",
    "pre kinder": "prek",
  };

  return map[v] || "";
};

const GRADE_FULL_LABEL = (level) => {
  const code = normalizeGradeCode(level);

  const fullLabels = {
    prek: "Pre-Kinder",
    kinder: "Kinder",
    grade1: "Grade 1",
    grade2: "Grade 2",
    grade3: "Grade 3",
    grade4: "Grade 4",
    grade5: "Grade 5",
    grade6: "Grade 6",
  };

  return fullLabels[code] || "—";
};

const TeacherClassSchedule = () => {
  const [viewMode, setViewMode] = useState("table");
  const [schedules, setSchedules] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [schoolYear, setSchoolYear] = useState(null);

  // Fetch schedules + sections on mount
  useEffect(() => {
    (async () => {
      try {
        const [schedRes, secRes, syRes] = await Promise.all([
          apiFetch(`${API}/api/classmanagement/schedules/my/`),
          apiFetch(`${API}/api/attendance/my-sections/`),
          apiFetch(`${API}/api/classmanagement/school-years/active/`),
        ]);

        if (schedRes.ok) {
          const data = await schedRes.json();
          setSchedules(Array.isArray(data) ? data : []);
        }

        if (secRes.ok) {
          const secData = await secRes.json();
          setSections(Array.isArray(secData) ? secData : []);
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

  const sectionMap = useMemo(() => {
    const map = {};
    sections.forEach((sec) => {
      map[String(sec.id)] = sec;
    });
    return map;
  }, [sections]);

  // Assign colors to subjects
  const subjectColorMap = useMemo(() => {
    const map = {};
    const uniqueSubjects = [...new Set(schedules.map((s) => s.subject))];
    uniqueSubjects.forEach((subj, idx) => {
      map[subj] = SUBJECT_COLORS[idx % SUBJECT_COLORS.length];
    });
    return map;
  }, [schedules]);

  // Stats
  const stats = useMemo(() => {
    const uniqueSections = new Set(schedules.map((s) => s.section));
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

  const formatTime = (time) => {
    if (!time) return "";
    const [h, m] = time.split(":");
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  };

  const getSectionDetails = (sched) => {
    const sectionId = String(sched.section?.id ?? sched.section ?? "");
    const fromSectionList = sectionMap[sectionId];

    const sectionName =
      fromSectionList?.name ||
      sched.section_name ||
      sched.section?.name ||
      "—";

    const gradeValue =
      getGradeSource(fromSectionList) ||
      getGradeSource(sched.section) ||
      getGradeSource(sched);

    return {
      sectionName,
      gradeLabel: GRADE_FULL_LABEL(gradeValue),
    };
  };

  const sectionLabel = (sched) => {
    const { sectionName, gradeLabel } = getSectionDetails(sched);
    return `${gradeLabel} - ${sectionName}`;
  };

  const getClassForSlot = (day, timeSlot) => {
    const slotHour = parseInt(timeSlot.split(":")[0], 10);

    return schedules.find((s) => {
      if (s.day_of_week !== day) return false;
      if (!s.start_time) return false;

      const startHour = parseInt(s.start_time.split(":")[0], 10);
      const endHour = s.end_time ? parseInt(s.end_time.split(":")[0], 10) : startHour + 1;

      return slotHour >= startHour && slotHour < endHour;
    });
  };

  return (
    <div className="tcs">
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

      {loading && <div className="tcs__loading">Loading schedule...</div>}

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
                          <span className="tcsPill">{sectionLabel(sched)}</span>
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
                                {sectionLabel(sched)}
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