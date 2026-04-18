import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { List, Calendar, BookOpen, Users, Clock, MapPin, Download, Printer } from "lucide-react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import "../TeacherWebsiteCSS/TeacherClassSchedule.css";
import { apiFetch } from "../api/apiFetch";
import PreviewModal from "../PreviewModal";
import Toast from "../Global/Toast";

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

const normalizeTimeKey = (time) => {
  if (!time) return "";
  const [h = "00", m = "00", s = "00"] = String(time).split(":");
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const timeToMinutes = (time) => {
  const [h = 0, m = 0] = String(time)
    .split(":")
    .map((part) => Number(part));
  return h * 60 + m;
};

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
  const [schedulePreviewOpen, setSchedulePreviewOpen] = useState(false);
  const [schedulePreviewData, setSchedulePreviewData] = useState(null);
  const [toasts, setToasts] = useState([]);
  const printRef = useRef(null);

  const dismissToast = useCallback((toastId) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== toastId));
  }, []);

  const pushToast = useCallback((title, message, type = "warning") => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4500);
  }, []);

  // Fetch schedules + sections on mount
  useEffect(() => {
    (async () => {
      try {
        const [schedRes, secRes, syRes] = await Promise.all([
          apiFetch(`${API}/api/classmanagement/schedules/my/?include_free_period=0`),
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

  const calendarStartSlots = useMemo(() => {
    const uniqueSlots = new Set(
      schedules
        .map((sched) => normalizeTimeKey(sched.start_time))
        .filter(Boolean)
    );

    return Array.from(uniqueSlots).sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
  }, [schedules]);

  const handlePrint = () => {
    // Build grid structure: rows = time slots, columns = days
    const gridBySlot = {};

    // Group schedules by time slot
    schedules.forEach((sched) => {
      const timeKey = normalizeTimeKey(sched.start_time);
      if (!gridBySlot[timeKey]) {
        gridBySlot[timeKey] = {};
      }
      if (!gridBySlot[timeKey][sched.day_of_week]) {
        gridBySlot[timeKey][sched.day_of_week] = [];
      }
      gridBySlot[timeKey][sched.day_of_week].push(sched);
    });

    // Sort time slots
    const sortedTimeSlots = Object.keys(gridBySlot).sort(
      (a, b) => timeToMinutes(a) - timeToMinutes(b)
    );

    // Create custom preview JSX
    const customPreviewContent = (
      <div style={{ overflowX: 'auto', padding: '20px' }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          fontSize: '13px'
        }}>
          <thead>
            <tr>
              <th style={{
                background: '#1f2937',
                color: '#fff',
                padding: '12px',
                textAlign: 'center',
                fontWeight: 'bold',
                border: '1px solid #ddd',
                minWidth: '100px',
                fontSize: '12px'
              }}>
                Time
              </th>
              {DAYS_ORDER.map((day) => (
                <th key={day} style={{
                  background: '#1f2937',
                  color: '#fff',
                  padding: '12px',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  border: '1px solid #ddd',
                  minWidth: '140px',
                  fontSize: '12px'
                }}>
                  {DAY_MAP[day].full}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedTimeSlots.map((timeSlot, idx) => (
              <tr key={timeSlot} style={{ height: '80px' }}>
                <td style={{
                  background: '#f9fafb',
                  padding: '10px',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  border: '1px solid #ddd',
                  fontSize: '11px',
                  verticalAlign: 'top'
                }}>
                  {formatTime(timeSlot)} - {formatTime(
                    `${String(Math.floor((timeToMinutes(timeSlot) + 60) / 60)).padStart(2, "0")}:${String((timeToMinutes(timeSlot) + 60) % 60).padStart(2, "0")}:00`
                  )}
                </td>
                {DAYS_ORDER.map((day) => {
                  const daySchedules = gridBySlot[timeSlot][day] || [];
                  return (
                    <td key={day} style={{
                      padding: '8px',
                      border: '1px solid #ddd',
                      background: '#fafbfc',
                      fontSize: '12px',
                      verticalAlign: 'top',
                      whiteSpace: 'pre-wrap',
                      wordWrap: 'break-word',
                      textAlign: 'center'
                    }}>
                      {daySchedules.map((sched, schedIdx) => (
                        <div key={sched.id} style={{ marginBottom: schedIdx < daySchedules.length - 1 ? '10px' : 0 }}>
                          <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
                            {sched.subject_name}
                          </div>
                          <div style={{ fontSize: '11px', color: '#666', marginBottom: '2px' }}>
                            ({sectionLabel(sched)})
                          </div>
                          <div style={{ fontSize: '11px', color: '#666' }}>
                            🏛 {sched.room_code || 'TBA'}
                          </div>
                        </div>
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

    setSchedulePreviewData(customPreviewContent);
    setSchedulePreviewOpen(true);
  };

  const handleDownloadScheduleExcel = async () => {
    try {
      // Build grid structure for Excel
      const gridBySlot = {};
      schedules.forEach((sched) => {
        const timeKey = normalizeTimeKey(sched.start_time);
        if (!gridBySlot[timeKey]) {
          gridBySlot[timeKey] = {};
        }
        if (!gridBySlot[timeKey][sched.day_of_week]) {
          gridBySlot[timeKey][sched.day_of_week] = [];
        }
        gridBySlot[timeKey][sched.day_of_week].push(sched);
      });

      // Sort time slots
      const sortedTimeSlots = Object.keys(gridBySlot).sort(
        (a, b) => timeToMinutes(a) - timeToMinutes(b)
      );

      // Create workbook with ExcelJS
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Schedule');

      // Set column widths
      worksheet.columns = [
        { header: 'Time', key: 'time', width: 18 },
        { header: 'Monday', key: 'MON', width: 30 },
        { header: 'Tuesday', key: 'TUE', width: 30 },
        { header: 'Wednesday', key: 'WED', width: 30 },
        { header: 'Thursday', key: 'THU', width: 30 },
        { header: 'Friday', key: 'FRI', width: 30 },
      ];

      // Style header row
      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1f2937' }, // Dark blue
        };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } },
        };
      });
      headerRow.height = 25;

      // Add data rows
      sortedTimeSlots.forEach((timeSlot) => {
        const rowData = {
          time: `${formatTime(timeSlot)} - ${formatTime(
            `${String(Math.floor((timeToMinutes(timeSlot) + 60) / 60)).padStart(2, "0")}:${String((timeToMinutes(timeSlot) + 60) % 60).padStart(2, "0")}:00`
          )}`,
        };

        // Add schedules for each day
        DAYS_ORDER.forEach((day) => {
          const daySchedules = gridBySlot[timeSlot][day] || [];
          const dayContent = daySchedules
            .map((s) => `${s.subject_name}\n(${sectionLabel(s)})\nRoom: ${s.room_code || 'TBA'}`)
            .join('\n\n');
          rowData[day] = dayContent;
        });

        const row = worksheet.addRow(rowData);
        row.height = 60; // Taller rows for wrapped content
        
        // Style data cells
        row.eachCell((cell) => {
          cell.alignment = { 
            horizontal: 'center', 
            vertical: 'top', 
            wrapText: true 
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFdddddd' } },
            left: { style: 'thin', color: { argb: 'FFdddddd' } },
            bottom: { style: 'thin', color: { argb: 'FFdddddd' } },
            right: { style: 'thin', color: { argb: 'FFdddddd' } },
          };
          cell.font = { size: 11 };
        });
      });

      // Generate file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `Class-Schedule_${timestamp}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      pushToast("Download Complete", "Schedule downloaded successfully.", "success");
    } catch (err) {
      console.error('Error downloading Excel:', err);
      pushToast("Download Failed", "Failed to download schedule. Please try again.", "error");
    }
  };

  const handleDownloadSchedulePDF = async () => {
    try {
      // Build grid structure for PDF
      const gridBySlot = {};
      schedules.forEach((sched) => {
        const timeKey = normalizeTimeKey(sched.start_time);
        if (!gridBySlot[timeKey]) {
          gridBySlot[timeKey] = {};
        }
        if (!gridBySlot[timeKey][sched.day_of_week]) {
          gridBySlot[timeKey][sched.day_of_week] = [];
        }
        gridBySlot[timeKey][sched.day_of_week].push(sched);
      });

      // Sort time slots
      const sortedTimeSlots = Object.keys(gridBySlot).sort(
        (a, b) => timeToMinutes(a) - timeToMinutes(b)
      );

      // Create PDF in landscape
      const doc = new jsPDF('l', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 5;
      const usableWidth = pageWidth - 2 * margin;

      // Title
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(31, 41, 55);
      doc.text('Class Schedule', margin, 15);

      // Add timestamp
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(107, 114, 128);
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 22);

      let yPos = 28;

      // Table dimensions
      const timeColWidth = 27;
      const dayColWidth = (usableWidth - timeColWidth) / 5;
      const headerRowHeight = 8;
      const dataRowHeight = 18;

      const headers = ['Time', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

      // Draw header once
      let xPos = margin;
      doc.setFillColor(31, 41, 55);
      doc.setDrawColor(31, 41, 55);
      doc.setLineWidth(0.4);

      // Fill all header cells
      headers.forEach((header, idx) => {
        const colWidth = idx === 0 ? timeColWidth : dayColWidth;
        doc.rect(xPos, yPos, colWidth, headerRowHeight, 'F');
        xPos += colWidth;
      });

      // Draw header text
      xPos = margin;
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(6.5);

      headers.forEach((header, idx) => {
        const colWidth = idx === 0 ? timeColWidth : dayColWidth;
        doc.text(header, xPos + colWidth / 2, yPos + 4.5, { align: 'center' });
        xPos += colWidth;
      });

      yPos += headerRowHeight;

      // Draw data rows
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');
      doc.setFontSize(7.5);
      doc.setDrawColor(150, 150, 150);
      doc.setLineWidth(0.2);

      sortedTimeSlots.forEach((timeSlot, idx) => {
        // Check if we need a new page
        if (yPos + dataRowHeight > pageHeight - 10) {
          doc.addPage();
          yPos = margin;

          // Redraw header on new page
          xPos = margin;
          doc.setFillColor(31, 41, 55);
          doc.setLineWidth(0.4);
          headers.forEach((header, idx) => {
            const colWidth = idx === 0 ? timeColWidth : dayColWidth;
            doc.rect(xPos, yPos, colWidth, headerRowHeight, 'F');
            xPos += colWidth;
          });

          xPos = margin;
          doc.setTextColor(255, 255, 255);
          doc.setFont(undefined, 'bold');
          doc.setFontSize(6.5);
          headers.forEach((header, idx) => {
            const colWidth = idx === 0 ? timeColWidth : dayColWidth;
            doc.text(header, xPos + colWidth / 2, yPos + 4.5, { align: 'center' });
            xPos += colWidth;
          });

          yPos += headerRowHeight;

          doc.setTextColor(0, 0, 0);
          doc.setFont(undefined, 'normal');
          doc.setFontSize(7);
          doc.setDrawColor(150, 150, 150);
          doc.setLineWidth(0.2);
        }

        const timeLabel = `${formatTime(timeSlot)} - ${formatTime(
          `${String(Math.floor((timeToMinutes(timeSlot) + 60) / 60)).padStart(2, "0")}:${String((timeToMinutes(timeSlot) + 60) % 60).padStart(2, "0")}:00`
        )}`;

        const isEvenRow = idx % 2 === 0;
        const bgColor = isEvenRow ? [250, 250, 250] : [255, 255, 255];

        xPos = margin;

        // Time cell
        doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
        doc.rect(xPos, yPos, timeColWidth, dataRowHeight, 'F');
        doc.setDrawColor(200, 200, 200);
        doc.rect(xPos, yPos, timeColWidth, dataRowHeight);
        doc.setTextColor(0, 0, 0);
        doc.text(
          timeLabel,
          xPos + 1,
          yPos + 3,
          { maxWidth: timeColWidth - 2, fontSize: 7.5 }
        );
        xPos += timeColWidth;

        // Day cells
        DAYS_ORDER.forEach((day) => {
          const daySchedules = gridBySlot[timeSlot][day] || [];
          const dayContent = daySchedules
            .map((s) => `${s.subject_name}\n(${sectionLabel(s)})\nRoom: ${s.room_code || 'TBA'}`)
            .join('\n\n');

          doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
          doc.rect(xPos, yPos, dayColWidth, dataRowHeight, 'F');
          doc.setDrawColor(200, 200, 200);
          doc.rect(xPos, yPos, dayColWidth, dataRowHeight);
          doc.setTextColor(0, 0, 0);

          if (dayContent) {
            doc.text(
              dayContent,
              xPos + dayColWidth / 2,
              yPos + 2,
              { maxWidth: dayColWidth - 2, fontSize: 7.5, align: 'center' }
            );
          }

          xPos += dayColWidth;
        });

        yPos += dataRowHeight;
      });

      // Download
      const timestamp = new Date().toISOString().slice(0, 10);
      doc.save(`Class-Schedule_${timestamp}.pdf`);

      pushToast("Download Complete", "PDF downloaded successfully.", "success");
    } catch (err) {
      console.error('Error downloading PDF:', err);
      pushToast("Download Failed", "Failed to download PDF. Please try again.", "error");
    }
  };

  const handleExportPDF = () => {
    handleDownloadSchedulePDF();
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
                {calendarStartSlots.length === 0 ? (
                  <tr>
                    <td className="tcsTd tcs__empty" colSpan={DAYS_ORDER.length + 1}>
                      No schedules assigned yet.
                    </td>
                  </tr>
                ) : (
                  calendarStartSlots.map((timeSlot) => (
                    <tr key={timeSlot} className="calTr">
                      <td className="calTime">{formatTime(timeSlot)}</td>
                      {DAYS_ORDER.map((day) => {
                        const slotSchedules = schedules
                          .filter(
                            (s) => s.day_of_week === day && normalizeTimeKey(s.start_time) === timeSlot
                          )
                          .sort((a, b) => timeToMinutes(a.end_time) - timeToMinutes(b.end_time));

                        return (
                          <td key={day} className="calTd">
                            {slotSchedules.map((sched) => (
                              <div
                                key={sched.id}
                                className="calBlock"
                                style={{ backgroundColor: subjectColorMap[sched.subject] || "#ffffff" }}
                              >
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
                            ))}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <PreviewModal
        isOpen={schedulePreviewOpen}
        onClose={() => setSchedulePreviewOpen(false)}
        title="Class Schedule"
        customPreview={schedulePreviewData}
        data={[]}
        onDownloadExcel={handleDownloadScheduleExcel}
        onDownloadPDF={handleDownloadSchedulePDF}
        filename="Class-Schedule"
      />
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

export default TeacherClassSchedule;