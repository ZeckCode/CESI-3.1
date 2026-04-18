import React, { useState, useEffect, useMemo } from "react";
import { 
  FileText, Download, BookOpen, Award, TrendingUp, CheckCircle, AlertCircle, Info
} from 'lucide-react';
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import "../StudentWebsiteCSS/Grades.css";
import { apiFetch } from "../api/apiFetch";
import PreviewModal from "../PreviewModal";
import Toast from "../Global/Toast";

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const parseResponseJson = async (response) => {
  if (!response) return null;
  const contentType = response.headers?.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) return null;

  try {
    return await response.json();
  } catch {
    return null;
  }
};

const getApiErrorMessage = (payload, fallback) => {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload;
  if (typeof payload.detail === "string") return payload.detail;
  if (typeof payload.error === "string") return payload.error;

  try {
    return JSON.stringify(payload);
  } catch {
    return fallback;
  }
};

const Grades = () => {
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [schoolYear, setSchoolYear] = useState("");
  const [studentName, setStudentName] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const [activeTooltip, setActiveTooltip] = useState(null);
  const [toasts, setToasts] = useState([]);

  const [schedules, setSchedules] = useState([]);

  const dismissToast = (toastId) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== toastId));
  };

  const pushToast = (title, message, type = "warning") => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4500);
  };

  useEffect(() => {
    (async () => {
      try {
        const [gradesRes, syRes, schedulesRes] = await Promise.all([
          apiFetch("/api/grades/my-grades/"),
          apiFetch("/api/classmanagement/school-years/active/"),
          apiFetch("/api/classmanagement/schedules/my/"),
        ]);
        if (!gradesRes.ok) {
          const errPayload = await parseResponseJson(gradesRes);
          throw new Error(getApiErrorMessage(errPayload, "Failed to load grades."));
        }

        const gradesData = await parseResponseJson(gradesRes);
        console.log("Grades API response:", gradesData);
        setGrades(Array.isArray(gradesData) ? gradesData : []);

        if (syRes.ok) {
          const syData = await parseResponseJson(syRes);
          setSchoolYear(syData.name || "");
        }
        if (schedulesRes.ok) {
          const schData = await parseResponseJson(schedulesRes);
          console.log("Schedules API response:", schData);
          setSchedules(Array.isArray(schData) ? schData : []);
        }
      } catch (e) {
        console.error("Error fetching data:", e);
        pushToast("Load Failed", e.message || "Failed to load grades data.", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const getCurrentQuarter = () => {
    const month = new Date().getMonth() + 1;
    if (month <= 3) return 1;
    if (month <= 6) return 2;
    if (month <= 9) return 3;
    return 4;
  };

  const currentQuarter = getCurrentQuarter();

  const validFinals = grades.filter((g) => g.final_grade !== null);
  const gwa = validFinals.length
    ? (validFinals.reduce((s, g) => s + g.final_grade, 0) / validFinals.length).toFixed(2)
    : null;
  
  const passedSubjects = validFinals.filter(g => g.final_grade >= 75).length;
  const pendingSubjects = grades.filter(g => g.final_grade === null).length;

  const gradeInsights = useMemo(() => {
    const scoredSubjects = grades
      .map((g) => {
        const final = toNumberOrNull(g.final_grade);
        const quarter = toNumberOrNull(g[`q${currentQuarter}`]);
        const score = final ?? quarter;
        return {
          subject: g.subject_name || g.subject_code || "Subject",
          score,
          source: final !== null ? "Final grade" : `Q${currentQuarter}`,
        };
      })
      .filter((g) => g.score !== null);

    const quarterAverages = [1, 2, 3, 4].map((q) => {
      const vals = grades
        .map((g) => toNumberOrNull(g[`q${q}`]))
        .filter((v) => v !== null);
      if (vals.length === 0) return null;
      return vals.reduce((sum, v) => sum + v, 0) / vals.length;
    });

    const completedSlots = grades.reduce(
      (acc, g) =>
        acc + [1, 2, 3, 4].reduce((inner, q) => inner + (toNumberOrNull(g[`q${q}`]) !== null ? 1 : 0), 0),
      0
    );
    const totalSlots = grades.length * 4;
    const completionRate = totalSlots > 0 ? (completedSlots / totalSlots) * 100 : 0;

    if (scoredSubjects.length === 0) {
      return {
        summary: "No graded subjects yet. Insights will appear as teachers post scores.",
        strongest: null,
        focus: null,
        passRate: 0,
        trendDelta: null,
        trendLabel: "Trend unavailable yet.",
        quarterAverages,
        completionRate,
      };
    }

    const sorted = [...scoredSubjects].sort((a, b) => b.score - a.score);
    const strongest = sorted[0];
    const focus = sorted[sorted.length - 1];
    const passRate = (scoredSubjects.filter((s) => s.score >= 75).length / scoredSubjects.length) * 100;

    const firstAvg = quarterAverages.find((v) => v !== null);
    const lastAvg = [...quarterAverages].reverse().find((v) => v !== null);
    const trendDelta =
      firstAvg !== undefined && firstAvg !== null && lastAvg !== undefined && lastAvg !== null
        ? Number((lastAvg - firstAvg).toFixed(2))
        : null;

    let trendLabel = "Trend unavailable yet.";
    if (trendDelta !== null) {
      if (trendDelta > 1.5) trendLabel = `Improving trend (+${trendDelta.toFixed(2)} pts).`;
      else if (trendDelta < -1.5) trendLabel = `Downward trend (${trendDelta.toFixed(2)} pts).`;
      else trendLabel = "Stable quarter performance.";
    }

    const summary =
      passRate >= 90
        ? "Excellent overall standing across evaluated subjects."
        : passRate >= 75
        ? "Good standing with a few subjects to strengthen."
        : "Several subjects need immediate attention to raise passing rate.";

    return {
      summary,
      strongest,
      focus,
      passRate,
      trendDelta,
      trendLabel,
      quarterAverages,
      completionRate,
    };
  }, [grades, currentQuarter]);

  const getGradeColor = (grade) => {
    if (grade === null) return 'sg-grade-pending';
    if (grade >= 90) return 'sg-grade-excellent';
    if (grade >= 80) return 'sg-grade-good';
    if (grade >= 75) return 'sg-grade-fair';
    return 'sg-grade-needs-improvement';
  };

  const getQuarterGradeDisplay = (grade, quarter) => {
    if (grade !== null) return grade.toFixed(1);
    return currentQuarter === quarter ? 'Pending' : '—';
  };

  const getSubjectStatusBadge = (subject) => {
    const currentQuarterGrade = subject[`q${currentQuarter}`];
    if (currentQuarterGrade === null) return { status: 'pending', label: 'Pending' };
    if (subject.final_grade !== null) {
      return subject.final_grade >= 75 
        ? { status: 'passed', label: 'Passed' }
        : { status: 'failed', label: 'Failed' };
    }
    return null;
  };

  const getTeacherForSubject = (subjectName) => {
    console.log("Looking for subject:", subjectName);
    console.log("Available schedules:", schedules);
    
    const schedule = schedules.find(
      (s) => s.subject_name === subjectName
    );
    
    console.log("Found schedule:", schedule);
    
    if (schedule?.teacher_name) {
      return schedule.teacher_name;
    }
    return null;
  };

  const handleExport = () => {
    const exportData = grades.map((g) => {
      const subjectName = g.subject_name || g.subject;
      const teacherFromSchedule = getTeacherForSubject(subjectName);
      return {
        'Subject': subjectName || '—',
        'Quarter 1': g.q1 ?? g.q1_grade ?? g.quarter_1 ?? '—',
        'Quarter 2': g.q2 ?? g.q2_grade ?? g.quarter_2 ?? '—',
        'Quarter 3': g.q3 ?? g.q3_grade ?? g.quarter_3 ?? '—',
        'Quarter 4': g.q4 ?? g.q4_grade ?? g.quarter_4 ?? '—',
        'Final Grade': g.final_grade ?? '—',
        'Remarks': g.remarks || g.status || '—',
        'Teacher': teacherFromSchedule || '—',
      };
    });

    setPreviewData(exportData);
    setShowPreview(true);
  };

  const handleDownloadGradesExcel = async () => {
    try {
      const exportData = grades.map((g) => {
        const subjectName = g.subject_name || g.subject;
        const teacherFromSchedule = getTeacherForSubject(subjectName);
        return {
          'Subject': subjectName || '—',
          'Quarter 1': g.q1 ?? g.q1_grade ?? g.quarter_1 ?? '—',
          'Quarter 2': g.q2 ?? g.q2_grade ?? g.quarter_2 ?? '—',
          'Quarter 3': g.q3 ?? g.q3_grade ?? g.quarter_3 ?? '—',
          'Quarter 4': g.q4 ?? g.q4_grade ?? g.quarter_4 ?? '—',
          'Final Grade': g.final_grade ?? '—',
          'Remarks': g.remarks || g.status || '—',
          'Teacher': teacherFromSchedule || '—',
        };
      });

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Grade Report");

      const headers = ['Subject', 'Quarter 1', 'Quarter 2', 'Quarter 3', 'Quarter 4', 'Final Grade', 'Remarks', 'Teacher'];

      // Add header row
      const headerRow = worksheet.addRow(headers);
      headerRow.eachCell((cell, colNumber) => {
        if (colNumber <= 8) {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
          cell.alignment = { horizontal: 'center', vertical: 'center' };
        }
      });

      // Add data rows
      exportData.forEach((row) => {
        const dataRow = worksheet.addRow([
          row['Subject'],
          row['Quarter 1'],
          row['Quarter 2'],
          row['Quarter 3'],
          row['Quarter 4'],
          row['Final Grade'],
          row['Remarks'],
          row['Teacher'],
        ]);

        // Set alignment for all cells in the row
        dataRow.eachCell((cell, colNumber) => {
          // Left-align Teacher (column 8) only
          if (colNumber === 8) {
            cell.alignment = { horizontal: 'left', vertical: 'center' };
          } else {
            cell.alignment = { horizontal: 'center', vertical: 'center' };
          }
        });
      });

      // Set column widths
      worksheet.columns = [
        { width: 20 },
        { width: 12 },
        { width: 12 },
        { width: 12 },
        { width: 12 },
        { width: 12 },
        { width: 12 },
        { width: 15 },
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Grade-Report-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      pushToast("Download Complete", "Grade report downloaded successfully.", "success");
    } catch (err) {
      console.error("Error downloading grades Excel:", err);
      pushToast("Download Failed", "Failed to download grade report. Please try again.", "error");
    }
  };

  const handleDownloadGradesPDF = async () => {
    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      const timestamp = new Date().toISOString().slice(0, 10);
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const usableWidth = pageWidth - 2 * margin;

      // Add title
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Grade Report', margin, 15);

      // Add underline
      doc.setDrawColor(37, 99, 235);
      doc.setLineWidth(1);
      doc.line(margin, 18, pageWidth - margin, 18);

      // Add timestamp
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 24);

      const headers = ['SUBJECT', 'QUARTER 1', 'QUARTER 2', 'QUARTER 3', 'QUARTER 4', 'FINAL', 'REMARKS', 'TEACHER'];
      const keys = ['Subject', 'Quarter 1', 'Quarter 2', 'Quarter 3', 'Quarter 4', 'Final Grade', 'Remarks', 'Teacher'];

      const exportData = grades.map((g) => {
        const subjectName = g.subject_name || g.subject;
        const teacherFromSchedule = getTeacherForSubject(subjectName);
        return {
          'Subject': subjectName || '—',
          'Quarter 1': g.q1 ?? g.q1_grade ?? g.quarter_1 ?? '—',
          'Quarter 2': g.q2 ?? g.q2_grade ?? g.quarter_2 ?? '—',
          'Quarter 3': g.q3 ?? g.q3_grade ?? g.quarter_3 ?? '—',
          'Quarter 4': g.q4 ?? g.q4_grade ?? g.quarter_4 ?? '—',
          'Final Grade': g.final_grade ?? '—',
          'Remarks': g.remarks || g.status || '—',
          'Teacher': teacherFromSchedule || '—',
        };
      });

      const rows = exportData.map(row => keys.map(key => row[key]));

      // Column widths
      const subjectWidth = usableWidth * 0.22;
      const otherColWidth = (usableWidth - subjectWidth) / 7;

      const getColWidth = (idx) => {
        return idx === 0 ? subjectWidth : otherColWidth;
      };

      const headerRowHeight = 10;
      const rowHeight = 9;
      let yPos = 30;

      // Draw header
      let xPos = margin;
      doc.setFillColor(37, 99, 235);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);

      // Fill header cells and draw borders
      headers.forEach((header, idx) => {
        const colW = getColWidth(idx);
        doc.rect(xPos, yPos, colW, headerRowHeight, 'F');
        doc.rect(xPos, yPos, colW, headerRowHeight);
        xPos += colW;
      });

      // Draw header text
      xPos = margin;
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(7.5);

      headers.forEach((header, idx) => {
        const colW = getColWidth(idx);
        doc.text(header, xPos + colW / 2, yPos + 6, { align: 'center' });
        xPos += colW;
      });

      yPos += headerRowHeight;

      // Draw data rows
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');
      doc.setFontSize(8.5);
      doc.setDrawColor(150, 150, 150);
      doc.setLineWidth(0.2);

      rows.forEach((row, rowIdx) => {
        if (yPos + rowHeight > pageHeight - 10) {
          doc.addPage();
          yPos = margin;

          // Redraw header on new page
          xPos = margin;
          doc.setFillColor(37, 99, 235);
          doc.setLineWidth(0.3);
          headers.forEach((header, idx) => {
            const colW = getColWidth(idx);
            doc.rect(xPos, yPos, colW, headerRowHeight, 'F');
            doc.rect(xPos, yPos, colW, headerRowHeight);
            xPos += colW;
          });

          xPos = margin;
          doc.setTextColor(255, 255, 255);
          doc.setFont(undefined, 'bold');
          doc.setFontSize(7.5);
          headers.forEach((header, idx) => {
            const colW = getColWidth(idx);
            doc.text(header, xPos + colW / 2, yPos + 6, { align: 'center' });
            xPos += colW;
          });

          yPos += headerRowHeight;
          doc.setTextColor(0, 0, 0);
          doc.setFont(undefined, 'normal');
          doc.setFontSize(8.5);
          doc.setDrawColor(150, 150, 150);
          doc.setLineWidth(0.2);
        }

        const isEvenRow = rowIdx % 2 === 0;
        const bgColor = isEvenRow ? [245, 245, 245] : [255, 255, 255];

        xPos = margin;

        row.forEach((cell, colIdx) => {
          const colW = getColWidth(colIdx);
          doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
          doc.rect(xPos, yPos, colW, rowHeight, 'F');
          doc.setDrawColor(150, 150, 150);
          doc.rect(xPos, yPos, colW, rowHeight);
          doc.setTextColor(0, 0, 0);

          // Center-align all except Teacher (column 7 = left-align)
          const align = colIdx === 7 ? 'left' : 'center';
          const textX = align === 'center' ? xPos + colW / 2 : xPos + 1;

          doc.text(
            String(cell),
            textX,
            yPos + 4.5,
            { align: align, maxWidth: colW - 2 }
          );
          xPos += colW;
        });

        yPos += rowHeight;
      });

      doc.save(`Grade-Report_${timestamp}.pdf`);
      pushToast("Download Complete", "PDF downloaded successfully.", "success");
    } catch (err) {
      console.error('Error downloading PDF:', err);
      pushToast("Download Failed", "Failed to download PDF. Please try again.", "error");
    }
  };

  if (loading) {
    return (
      <main className="student-grades-main">
        <section className="sg-section sg-no-print">
          <div className="sg-stats-grid">
            {[...Array(4)].map((_, idx) => (
              <div key={idx} className="sg-stat-card sgSkel__statCard">
                <div className="sg-stat-header">
                  <div className="sgSkel shimmer sgSkel__line sgSkel__line--statLabel" />
                  <div className="sgSkel shimmer sgSkel__icon" />
                </div>
                <div className="sgSkel shimmer sgSkel__line sgSkel__line--statValue" />
                <div className="sgSkel shimmer sgSkel__line sgSkel__line--statChange" />
              </div>
            ))}
          </div>
        </section>

        <section className="sg-section sg-no-print">
          <div className="sg-insights-panel">
            <div className="sg-insights-header">
              <div className="sgSkel shimmer sgSkel__line sgSkel__line--title" />
              <div className="sgSkel shimmer sgSkel__line sgSkel__line--subtitle" />
            </div>

            <div className="sg-insights-grid">
              {[...Array(3)].map((_, idx) => (
                <article key={idx} className="sg-insight-card">
                  <div className="sgSkel shimmer sgSkel__line sgSkel__line--insightLabel" />
                  <div className="sgSkel shimmer sgSkel__line sgSkel__line--insightValue" />
                  <div className="sgSkel shimmer sgSkel__line sgSkel__line--insightNote" />
                </article>
              ))}
            </div>

            <div className="sg-quarter-strip">
              {[...Array(5)].map((_, idx) => (
                <span key={idx} className="sg-quarter-pill sgSkel__quarterPill">
                  <span className="sgSkel shimmer sgSkel__line sgSkel__line--quarter" />
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="sg-section sg-print-area">
          <div className="sg-section-header">
            <div>
              <div className="sgSkel shimmer sgSkel__line sgSkel__line--sectionTitle" />
              <div className="sgSkel shimmer sgSkel__line sgSkel__line--sectionSub" />
            </div>
            <div className="sg-header-actions sg-no-print">
              <div className="sgSkel shimmer sgSkel__btn" />
            </div>
          </div>

          <div className="sg-table-container sgSkel__tableContainer">
            <div className="sgSkel__tableHead">
              {[...Array(7)].map((_, idx) => (
                <div key={idx} className="sgSkel shimmer sgSkel__line sgSkel__line--th" />
              ))}
            </div>
            {[...Array(5)].map((_, rowIdx) => (
              <div key={rowIdx} className="sgSkel__tableRow">
                {[...Array(7)].map((_, colIdx) => (
                  <div key={colIdx} className="sgSkel shimmer sgSkel__line sgSkel__line--td" />
                ))}
              </div>
            ))}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="student-grades-main">
      {/* Stats Overview - HIDDEN ON PRINT */}
      <section className="sg-section sg-no-print">
        <div className="sg-stats-grid">
          <div className="sg-stat-card sg-stat-blue">
            <div className="sg-stat-header">
              <span className="sg-stat-label">Total Subjects</span>
              <BookOpen size={24} className="sg-stat-icon" />
            </div>
            <div className="sg-stat-value">{grades.length}</div>
            <div className="sg-stat-change">Enrolled this year</div>
          </div>

          <div className="sg-stat-card sg-stat-green">
            <div className="sg-stat-header">
              <span className="sg-stat-label">Passed</span>
              <CheckCircle size={24} className="sg-stat-icon" />
            </div>
            <div className="sg-stat-value">{passedSubjects}</div>
            <div className="sg-stat-change positive">
              {validFinals.length > 0 
                ? `${((passedSubjects / validFinals.length) * 100).toFixed(0)}% passing rate`
                : 'No grades yet'}
            </div>
          </div>

          <div className="sg-stat-card sg-stat-yellow">
            <div className="sg-stat-header">
              <span className="sg-stat-label">Pending</span>
              <AlertCircle size={24} className="sg-stat-icon" />
            </div>
            <div className="sg-stat-value">{pendingSubjects}</div>
            <div className="sg-stat-change">Awaiting grades</div>
          </div>

          <div className="sg-stat-card sg-stat-purple">
            <div className="sg-stat-header">
              <span className="sg-stat-label">GWA</span>
              <Award size={24} className="sg-stat-icon" />
            </div>
            <div className="sg-stat-value">{gwa ?? '—'}</div>
            <div className={`sg-stat-change ${gwa && parseFloat(gwa) >= 85 ? 'positive' : ''}`}>
              {gwa && parseFloat(gwa) >= 85 ? 'Excellent standing' : 'General Weighted Average'}
            </div>
          </div>
        </div>
      </section>

      <section className="sg-section sg-no-print">
        <div className="sg-insights-panel">
          <div className="sg-insights-header">
            <h3>Performance Insights</h3>
            <span>Descriptive analysis based on posted grades</span>
          </div>

          <div className="sg-insights-grid">
            <article className="sg-insight-card">
              <div className="sg-insight-header">
                <p className="sg-insight-label">Academic Snapshot</p>
                <button 
                  className="sg-info-btn"
                  onClick={() => setActiveTooltip(activeTooltip === 'snapshot' ? null : 'snapshot')}
                  title="Learn more about Academic Snapshot"
                >
                  <Info size={16} />
                </button>
              </div>
              {activeTooltip === 'snapshot' && (
                <div className="sg-tooltip">
                  <p>This percentage shows the overall passing rate across all your graded subjects (grade 75 or higher is passing).</p>
                </div>
              )}
              <p className="sg-insight-value">{gradeInsights.passRate.toFixed(1)}%</p>
              <p className="sg-insight-note">{gradeInsights.summary}</p>
            </article>

            <article className="sg-insight-card">
              <div className="sg-insight-header">
                <p className="sg-insight-label">Strongest Subject</p>
                <button 
                  className="sg-info-btn"
                  onClick={() => setActiveTooltip(activeTooltip === 'strongest' ? null : 'strongest')}
                  title="Learn more about Strongest Subject"
                >
                  <Info size={16} />
                </button>
              </div>
              {activeTooltip === 'strongest' && (
                <div className="sg-tooltip">
                  <p>Your highest-scoring subject based on posted grades. This is where you're excelling and should maintain your momentum.</p>
                </div>
              )}
              <p className="sg-insight-value">
                {gradeInsights.strongest ? gradeInsights.strongest.subject : '—'}
              </p>
              <p className="sg-insight-note">
                {gradeInsights.strongest
                  ? `${gradeInsights.strongest.score.toFixed(1)} (${gradeInsights.strongest.source})`
                  : 'Waiting for graded entries.'}
              </p>
            </article>

            <article className="sg-insight-card">
              <div className="sg-insight-header">
                <p className="sg-insight-label">Needs Focus</p>
                <button 
                  className="sg-info-btn"
                  onClick={() => setActiveTooltip(activeTooltip === 'focus' ? null : 'focus')}
                  title="Learn more about Needs Focus"
                >
                  <Info size={16} />
                </button>
              </div>
              {activeTooltip === 'focus' && (
                <div className="sg-tooltip">
                  <p>Your lowest-scoring subject that may need extra attention. Consider reaching out to your teacher for additional help or study sessions.</p>
                </div>
              )}
              <p className="sg-insight-value">
                {gradeInsights.focus ? gradeInsights.focus.subject : '—'}
              </p>
              <p className="sg-insight-note">
                {gradeInsights.focus
                  ? `${gradeInsights.focus.score.toFixed(1)} (${gradeInsights.focus.source}). ${gradeInsights.trendLabel}`
                  : 'Trend unavailable yet.'}
              </p>
            </article>
          </div>

          <div className="sg-quarter-strip">
            {[1, 2, 3, 4].map((q, idx) => (
              <span key={q} className="sg-quarter-pill">
                Q{q}: {gradeInsights.quarterAverages[idx] !== null ? gradeInsights.quarterAverages[idx].toFixed(1) : '—'}
              </span>
            ))}
            <span className="sg-quarter-pill sg-quarter-pill--accent">
              Quarter Completion: {gradeInsights.completionRate.toFixed(0)}%
            </span>
          </div>
        </div>
      </section>

      {/* Main Content - PRINT AREA */}
      <section className="sg-section sg-print-area">
        <div className="sg-section-header">
          <div>
            <h2 className="sg-section-title">{studentName ? `${studentName} Grades` : "Grades"}</h2>
            <p className="sg-section-subtitle">S.Y. {schoolYear || "—"}</p>
          </div>
          <div className="sg-header-actions sg-no-print">
            <button className="sg-btn-primary" onClick={handleExport}>
              <Download size={18} />
              Export Report
            </button>
          </div>
        </div>

        <div className="sg-table-container">
          {loading ? (
            <div className="sg-loading">Loading grades…</div>
          ) : grades.length === 0 ? (
            <div className="sg-loading">No grades available yet.</div>
          ) : (
            <table className="sg-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>1st Qtr</th>
                  <th>2nd Qtr</th>
                  <th>3rd Qtr</th>
                  <th>4th Qtr</th>
                  <th>Final</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {grades.map((subj, idx) => (
                  <tr key={idx}>
                    <td data-label="Subject">
                      <div className="sg-subject-info">
                        <span className="sg-subject-name">{subj.subject_name}</span>
                        <span className="sg-subject-code">{subj.subject_code}</span>
                      </div>
                    </td>
                    <td data-label="1st Quarter">
                      <span className={`sg-grade ${getGradeColor(subj.q1)}`}>
                        {getQuarterGradeDisplay(subj.q1, 1)}
                      </span>
                    </td>
                    <td data-label="2nd Quarter">
                      <span className={`sg-grade ${getGradeColor(subj.q2)}`}>
                        {getQuarterGradeDisplay(subj.q2, 2)}
                      </span>
                    </td>
                    <td data-label="3rd Quarter">
                      <span className={`sg-grade ${getGradeColor(subj.q3)}`}>
                        {getQuarterGradeDisplay(subj.q3, 3)}
                      </span>
                    </td>
                    <td data-label="4th Quarter">
                      <span className={`sg-grade ${getGradeColor(subj.q4)}`}>
                        {getQuarterGradeDisplay(subj.q4, 4)}
                      </span>
                    </td>
                    <td data-label="Final Grade">
                      <span className={`sg-final-grade ${getGradeColor(subj.final_grade)}`}>
                        {subj.final_grade !== null ? subj.final_grade.toFixed(1) : '—'}
                      </span>
                    </td>
                    <td data-label="Remarks">
                      {(() => {
                        const statusBadge = getSubjectStatusBadge(subj);
                        if (statusBadge) {
                          return (
                            <span className={`sg-status-badge sg-status-${statusBadge.status}`}>
                              {statusBadge.label}
                            </span>
                          );
                        }
                        return <span className="sg-text-muted">—</span>;
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <PreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        title={`Grade Report - ${studentName}`}
        data={previewData}
        columns={[
          { key: 'Subject', label: 'SUBJECT', align: 'center' },
          { key: 'Quarter 1', label: 'QUARTER 1' },
          { key: 'Quarter 2', label: 'QUARTER 2' },
          { key: 'Quarter 3', label: 'QUARTER 3' },
          { key: 'Quarter 4', label: 'QUARTER 4' },
          { key: 'Final Grade', label: 'FINAL GRADE' },
          { key: 'Remarks', label: 'REMARKS' },
          { key: 'Teacher', label: 'TEACHER' },
        ]}
        filename="Grades"
        onDownloadExcel={handleDownloadGradesExcel}
        onDownloadPDF={handleDownloadGradesPDF}
      />
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </main>
  );
};

export default Grades;