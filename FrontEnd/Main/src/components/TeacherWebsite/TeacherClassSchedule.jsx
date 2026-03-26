import React, { useState, useEffect, useMemo, useRef } from "react";
import { List, Calendar, BookOpen, Users, Clock, MapPin, Download, Printer } from "lucide-react";
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
  const printRef = useRef(null);

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

  const handlePrint = () => {
    const printWindow = window.open("", "", "width=1000,height=800");
    const sortedSchedules = schedules.sort((a, b) => {
      const dayA = DAY_MAP[a.day_of_week]?.order ?? 99;
      const dayB = DAY_MAP[b.day_of_week]?.order ?? 99;
      if (dayA !== dayB) return dayA - dayB;
      return (a.start_time || "").localeCompare(b.start_time || "");
    });

    const schoolYearText = schoolYear
      ? `S.Y. ${schoolYear.name || `${schoolYear.start_year}-${schoolYear.end_year}`}`
      : "N/A";

    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const scheduleTableHTML = sortedSchedules
      .map(
        (sched) => `
        <tr>
          <td>${sched.subject_name || "-"} ${
          sched.subject_code ? `<span class="code-label">${sched.subject_code}</span>` : ""
        }</td>
          <td>${sectionLabel(sched)}</td>
          <td>${DAY_MAP[sched.day_of_week]?.full || sched.day_of_week}</td>
          <td>${formatTime(sched.start_time)} - ${formatTime(sched.end_time)}</td>
          <td>${sched.room_code || "TBA"}</td>
        </tr>
      `
      )
      .join("");

    const calendarTableHTML = TIME_SLOTS.map((timeSlot) => {
      const cells = DAYS_ORDER.map((day) => {
        const sched = getClassForSlot(day, timeSlot);
        if (sched) {
          return `
            <td class="cal-cell filled">
              <div class="cal-subject">${sched.subject_name || "-"}</div>
              <div class="cal-section">${sectionLabel(sched)}</div>
              <div class="cal-room">${sched.room_code || "TBA"}</div>
              <div class="cal-time">${formatTime(sched.start_time)} - ${formatTime(sched.end_time)}</div>
            </td>
          `;
        }
        return '<td class="cal-cell empty"></td>';
      }).join("");

      return `
        <tr>
          <td class="cal-time">${formatTime(timeSlot + ":00")}</td>
          ${cells}
        </tr>
      `;
    }).join("");

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Teacher Schedule</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: white;
      color: #1f2937;
      line-height: 1.6;
    }

    .print-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px;
    }

    .print-header {
      text-align: center;
      margin-bottom: 40px;
      border-bottom: 2px solid #1f2937;
      padding-bottom: 20px;
    }

    .print-header h1 {
      font-size: 28px;
      font-weight: 800;
      margin-bottom: 8px;
      letter-spacing: -0.5px;
    }

    .print-header .metadata {
      display: flex;
      justify-content: center;
      gap: 30px;
      font-size: 13px;
      color: #6b7280;
      margin-top: 12px;
    }

    .metadata-item {
      display: flex;
      gap: 4px;
      align-items: center;
    }

    .metadata-label {
      font-weight: 600;
      color: #1f2937;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 40px;
    }

    .stat-card {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      background: #f3f4f6;
    }

    .stat-card .label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #6b7280;
      margin-bottom: 6px;
    }

    .stat-card .value {
      font-size: 24px;
      font-weight: 700;
      color: #1f2937;
    }

    .section-title {
      font-size: 16px;
      font-weight: 700;
      margin: 30px 0 16px 0;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #1f2937;
      border-bottom: 2px solid #5ba3c7;
      padding-bottom: 8px;
    }

    .table-wrapper {
      margin-bottom: 40px;
      overflow: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
    }

    th {
      background: #1f2937;
      color: white;
      padding: 12px 14px;
      text-align: left;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    td {
      padding: 11px 14px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
      font-size: 13px;
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:nth-child(even) {
      background: #f9fafb;
    }

    .code-label {
      display: inline-block;
      background: #e0f2f9;
      color: #5ba3c7;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: 600;
      margin-left: 6px;
    }

    .pill {
      display: inline-block;
      background: #f0f0f0;
      border: 1px solid #d5d5d5;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
    }

    /* Calendar view styles */
    .cal-table-wrapper {
      overflow: auto;
    }

    .cal-table {
      width: 100%;
      border-collapse: collapse;
    }

    .cal-table th,
    .cal-table td {
      border: 1px solid #d5d5d5;
      padding: 8px;
      font-size: 12px;
      text-align: center;
    }

    .cal-table th {
      background: #1f2937;
      color: white;
      font-weight: 700;
      padding: 10px 8px;
    }

    .cal-time {
      background: #f3f4f6;
      font-weight: 600;
      width: 80px;
      min-width: 80px;
    }

    .cal-cell {
      height: 100px;
      vertical-align: top;
      padding: 6px;
      font-size: 11px;
    }

    .cal-cell.filled {
      background: #e0f2f9;
      border: 1px solid #5ba3c7;
    }

    .cal-cell.empty {
      background: white;
    }

    .cal-subject {
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 2px;
    }

    .cal-section {
      color: #5ba3c7;
      font-weight: 600;
      font-size: 10px;
      margin-bottom: 2px;
    }

    .cal-room {
      color: #6b7280;
      font-size: 10px;
      margin-bottom: 2px;
    }

    .cal-time-slot {
      color: #6b7280;
      font-size: 10px;
      font-weight: 500;
    }

    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 12px;
    }

    @media print {
      body {
        background: white;
      }
      .print-container {
        padding: 20px;
      }
      .stats-grid {
        page-break-inside: avoid;
      }
      .table-wrapper,
      .cal-table-wrapper {
        page-break-inside: avoid;
      }
    }

    @media screen {
      .print-container {
        background: white;
      }
    }
  </style>
</head>
<body>
  <div class="print-container">
    <div class="print-header">
      <h1>CLASS SCHEDULE</h1>
      <div class="metadata">
        <div class="metadata-item">
          <span class="metadata-label">School Year:</span>
          <span>${schoolYearText}</span>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Generated:</span>
          <span>${currentDate}</span>
        </div>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="label">Total Classes</div>
        <div class="value">${stats.totalClasses}</div>
      </div>
      <div class="stat-card">
        <div class="label">Sections</div>
        <div class="value">${stats.totalSections}</div>
      </div>
      <div class="stat-card">
        <div class="label">Hours / Week</div>
        <div class="value">${stats.totalHours}</div>
      </div>
    </div>

    <div class="section-title">TABLE VIEW</div>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Subject</th>
            <th>Section</th>
            <th>Day</th>
            <th>Time</th>
            <th>Room</th>
          </tr>
        </thead>
        <tbody>
          ${
            scheduleTableHTML ||
            "<tr><td colspan='5' style='text-align: center; color: #6b7280;'>No schedules assigned</td></tr>"
          }
        </tbody>
      </table>
    </div>

    <div class="section-title">WEEK VIEW</div>
    <div class="cal-table-wrapper">
      <table class="cal-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Monday</th>
            <th>Tuesday</th>
            <th>Wednesday</th>
            <th>Thursday</th>
            <th>Friday</th>
          </tr>
        </thead>
        <tbody>
          ${calendarTableHTML}
        </tbody>
      </table>
    </div>

    <div class="footer">
      <p>This schedule is confidential and for official use only.</p>
    </div>
  </div>
</body>
</html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handleExportPDF = () => {
    // Alternative export functionality - can be enhanced with a library like jsPDF
    handlePrint();
  };

  return (
    <div className="tcs">
      <header className="tcs__header">
        <div className="tcs__headerLeft">
          
          <p className="tcs__subtitle">
            {schoolYear && (
              <span className="tcs__syTag">
                <Calendar size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
                S.Y. {schoolYear.name || `${schoolYear.start_year}-${schoolYear.end_year}`}
              </span>
            )}
          </p>
        </div>

        <div className="tcs__headerRight">
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

          <button className="tcs__exportBtn" onClick={handlePrint} title="Print or export schedule">
            <Printer size={16} />
            <span>Print</span>
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