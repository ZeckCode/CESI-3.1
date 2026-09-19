import React, { useCallback, useEffect, useState } from "react";
import {
  History,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Award,
  AlertCircle,
  CheckCircle,
  Clock,
  GraduationCap,
} from "lucide-react";
import { apiFetch } from "../api/apiFetch";
import "../StudentWebsiteCSS/AcademicHistory.css";
import Toast from "../Global/Toast";

const GRADE_LEVEL_LABELS = {
  0: "Kinder",
  1: "Grade 1",
  2: "Grade 2",
  3: "Grade 3",
  4: "Grade 4",
  5: "Grade 5",
  6: "Grade 6",
};

function gradeClass(val) {
  if (val === null || val === undefined) return "sg-grade sg-grade-pending";
  const n = parseFloat(val);
  if (n >= 90) return "sg-grade sg-grade-excellent";
  if (n >= 80) return "sg-grade sg-grade-good";
  if (n >= 75) return "sg-grade sg-grade-fair";
  return "sg-grade sg-grade-needs-improvement";
}

function remarksIcon(remarks) {
  switch ((remarks || "").toUpperCase()) {
    case "PASSED":
    case "PROMOTED":
      return <CheckCircle size={14} style={{ color: "#10b981", marginRight: 4 }} />;
    case "FAILED":
    case "RETAINED":
      return <AlertCircle size={14} style={{ color: "#ef4444", marginRight: 4 }} />;
    case "INCOMPLETE":
      return <Clock size={14} style={{ color: "#f59e0b", marginRight: 4 }} />;
    default:
      return null;
  }
}

function remarksBadgeClass(remarks) {
  switch ((remarks || "").toUpperCase()) {
    case "PASSED":
    case "PROMOTED":
      return "sg-status-badge sg-status-passed";
    case "FAILED":
    case "RETAINED":
      return "sg-status-badge sg-status-failed";
    case "INCOMPLETE":
      return "sg-status-badge sg-status-in-progress";
    default:
      return "sg-status-badge";
  }
}

function YearBlock({ yearData }) {
  const [open, setOpen] = useState(true);
  const { school_year, grade_level, section_name, records } = yearData;

  const gradeLabel = GRADE_LEVEL_LABELS[grade_level] ?? `Grade ${grade_level}`;

  // Summary stats
  const finals = records
    .map((r) => parseFloat(r.final_grade))
    .filter((v) => !isNaN(v));
  const gwa = finals.length
    ? (finals.reduce((a, b) => a + b, 0) / finals.length).toFixed(2)
    : null;
  const passed = records.filter((r) =>
    ["PASSED", "PROMOTED"].includes((r.remarks || "").toUpperCase())
  ).length;
  const failed = records.filter((r) =>
    ["FAILED", "RETAINED"].includes((r.remarks || "").toUpperCase())
  ).length;

  return (
    <div className="ah-year-block">
      <button
        className="ah-year-header"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className="ah-year-left">
          <GraduationCap size={20} className="ah-year-icon" />
          <div>
            <span className="ah-year-title">S.Y. {school_year}</span>
            <span className="ah-year-sub">
              {gradeLabel}
              {section_name ? ` — ${section_name}` : ""}
            </span>
          </div>
        </div>
        <div className="ah-year-right">
          {gwa !== null && (
            <span className="ah-year-gwa">
              GWA <strong>{gwa}</strong>
            </span>
          )}
          <span className="ah-year-counts">
            <span className="ah-count-pass">{passed} Passed</span>
            {failed > 0 && <span className="ah-count-fail">{failed} Failed</span>}
          </span>
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {open && (
        <div className="ah-year-body">
          <div className="ah-table-header-flex" style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'1rem 1.2rem 0.2rem 1.2rem',gap:'1rem',flexWrap:'wrap'}}>
            <div>
              <span className="ah-year-title">S.Y. {school_year}</span>
              <span className="ah-year-sub" style={{marginLeft:8}}>{gradeLabel}{section_name ? ` — ${section_name}` : ""}</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:'1.2rem',flexWrap:'wrap'}}>
              {gwa !== null && (
                <span className="ah-year-gwa">GWA <strong>{gwa}</strong></span>
              )}
              <span className="ah-count-pass">{passed} Passed</span>
              {failed > 0 && <span className="ah-count-fail">{failed} Failed</span>}
            </div>
          </div>
          <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '0.5rem' }}>
            <table className="sg-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Q1</th>
                  <th>Q2</th>
                  <th>Q3</th>
                  <th>Q4</th>
                  <th>Final</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => (
                  <tr key={rec.id}>
                    <td data-label="Subject">
                      <div className="sg-subject-info">
                        <span className="sg-subject-name">{rec.subject_name}</span>
                        {rec.subject_code && (
                          <span className="sg-subject-code">{rec.subject_code}</span>
                        )}
                        {rec.teacher_name && (
                          <span className="ah-teacher-name">{rec.teacher_name}</span>
                        )}
                      </div>
                    </td>
                    <td data-label="Q1">
                      <span className={gradeClass(rec.q1)}>
                        {rec.q1 ?? <span className="sg-text-muted">—</span>}
                      </span>
                    </td>
                    <td data-label="Q2">
                      <span className={gradeClass(rec.q2)}>
                        {rec.q2 ?? <span className="sg-text-muted">—</span>}
                      </span>
                    </td>
                    <td data-label="Q3">
                      <span className={gradeClass(rec.q3)}>
                        {rec.q3 ?? <span className="sg-text-muted">—</span>}
                      </span>
                    </td>
                    <td data-label="Q4">
                      <span className={gradeClass(rec.q4)}>
                        {rec.q4 ?? <span className="sg-text-muted">—</span>}
                      </span>
                    </td>
                    <td data-label="Final">
                      {rec.final_grade !== null ? (
                        <span className={`sg-final-grade ${gradeClass(rec.final_grade)}`}>
                          {rec.final_grade}
                        </span>
                      ) : (
                        <span className="sg-text-muted">—</span>
                      )}
                    </td>
                    <td data-label="Remarks">
                      {rec.remarks ? (
                        <span className={remarksBadgeClass(rec.remarks)}>
                          {remarksIcon(rec.remarks)}
                          {rec.remarks}
                        </span>
                      ) : (
                        <span className="sg-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AcademicHistory() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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

  useEffect(() => {
    apiFetch("/api/grades/my-academic-history/")
      .then((res) => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch(() => {
        const message = "Failed to load academic history. Please try again.";
        setError(message);
        addToast("Load Error", message, "error");
        setLoading(false);
      });
  }, [addToast]);

  if (loading) {
    return (
      <div className="student-grades-main">
        <div className="sg-section">
          <div className="sg-section-header">
            <div>
              <div className="ahSkel ah-shimmer ahSkel__line ahSkel__line--subtitle" />
            </div>
          </div>
        </div>

        <div className="sg-section">
          <div className="sg-stats-grid">
            {[...Array(4)].map((_, idx) => (
              <div key={idx} className="sg-stat-card ahSkel__statCard">
                <div className="sg-stat-header">
                  <div className="ahSkel ah-shimmer ahSkel__line ahSkel__line--statLabel" />
                  <div className="ahSkel ah-shimmer ahSkel__icon" />
                </div>
                <div className="ahSkel ah-shimmer ahSkel__line ahSkel__line--statValue" />
                <div className="ahSkel ah-shimmer ahSkel__line ahSkel__line--statNote" />
              </div>
            ))}
          </div>
        </div>

        <div className="sg-section">
          <div className="ah-years-list">
            {[...Array(2)].map((_, idx) => (
              <div key={idx} className="ah-year-block ahSkel__yearBlock">
                <div className="ah-year-header">
                  <div className="ah-year-left">
                    <div className="ahSkel ah-shimmer ahSkel__yearIcon" />
                    <div>
                      <div className="ahSkel ah-shimmer ahSkel__line ahSkel__line--yearTitle" />
                      <div className="ahSkel ah-shimmer ahSkel__line ahSkel__line--yearSub" />
                    </div>
                  </div>
                  <div className="ah-year-right">
                    <div className="ahSkel ah-shimmer ahSkel__pill" />
                    <div className="ahSkel ah-shimmer ahSkel__pill" />
                  </div>
                </div>
                <div className="ah-year-body ahSkel__yearBody">
                  {[...Array(4)].map((__, rowIdx) => (
                    <div key={rowIdx} className="ahSkel__row">
                      {[...Array(7)].map((___, colIdx) => (
                        <div key={colIdx} className="ahSkel ah-shimmer ahSkel__line ahSkel__line--cell" />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <Toast toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="student-grades-main">
        <div className="ah-error">
          <AlertCircle size={24} />
          <p>{error}</p>
        </div>
        <Toast toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  const { has_history, records_by_year } = data;

  // Summary across all years
  const totalSubjects = records_by_year.reduce((s, y) => s + y.records.length, 0);
  const allFinals = records_by_year.flatMap((y) =>
    y.records.map((r) => parseFloat(r.final_grade)).filter((v) => !isNaN(v))
  );
  const overallGwa = allFinals.length
    ? (allFinals.reduce((a, b) => a + b, 0) / allFinals.length).toFixed(2)
    : null;
  const totalPassed = records_by_year.reduce(
    (s, y) =>
      s +
      y.records.filter((r) =>
        ["PASSED", "PROMOTED"].includes((r.remarks || "").toUpperCase())
      ).length,
    0
  );

  return (
    <div className="student-grades-main">
      {/* Header */}
      <div className="sg-section">
        <div className="sg-section-header">
          <div>
             
            <p className="sg-section-subtitle">
              {has_history
                ? "Your complete academic records from previous school years"
                : "No prior academic history on record"}
            </p>
          </div>
        </div>
      </div>

      {/* Stats row — only when there is history */}
      {has_history && (
        <div className="sg-section">
          <div className="sg-stats-grid">
            <div className="sg-stat-card sg-stat-blue">
              <div className="sg-stat-header">
                <span className="sg-stat-label">School Years</span>
                <BookOpen size={20} className="sg-stat-icon" />
              </div>
              <div className="sg-stat-value">{records_by_year.length}</div>
              <div className="sg-stat-change">Years on record</div>
            </div>

            <div className="sg-stat-card sg-stat-green">
              <div className="sg-stat-header">
                <span className="sg-stat-label">Subjects Taken</span>
                <GraduationCap size={20} className="sg-stat-icon" />
              </div>
              <div className="sg-stat-value">{totalSubjects}</div>
              <div className="sg-stat-change">Total subjects across all years</div>
            </div>

            <div className="sg-stat-card sg-stat-purple">
              <div className="sg-stat-header">
                <span className="sg-stat-label">Overall GWA</span>
                <Award size={20} className="sg-stat-icon" />
              </div>
              <div className="sg-stat-value">{overallGwa ?? "—"}</div>
              <div className="sg-stat-change">General weighted average</div>
            </div>

            <div className="sg-stat-card sg-stat-yellow">
              <div className="sg-stat-header">
                <span className="sg-stat-label">Subjects Passed</span>
                <CheckCircle size={20} className="sg-stat-icon" />
              </div>
              <div className="sg-stat-value">{totalPassed}</div>
              <div className="sg-stat-change positive">
                {totalSubjects > 0
                  ? `${((totalPassed / totalSubjects) * 100).toFixed(0)}% pass rate`
                  : ""}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History blocks or empty state */}
      <div className="sg-section">
        {has_history ? (
          <div className="ah-years-list">
            {records_by_year.map((yearData) => (
              <YearBlock
                key={yearData.group_key || `${yearData.school_year}-${yearData.grade_level}-${yearData.section_name || ''}`}
                yearData={yearData}
              />
            ))}
          </div>
        ) : (
          <div className="ah-empty">
            <History size={56} className="ah-empty-icon" />
            <h3>No Academic History</h3>
            <p>
              This account is registered as a new student. Academic records will
              appear here once a school year is completed.
            </p>
          </div>
        )}
      </div>
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
