import React, { useState, useEffect } from "react";
import { 
  FileText, Download, BookOpen, Award, TrendingUp, CheckCircle, AlertCircle 
} from 'lucide-react';
import "../StudentWebsiteCSS/Grades.css";
import { apiFetch } from "../api/apiFetch";

const Grades = () => {
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [schoolYear, setSchoolYear] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [gradesRes, syRes] = await Promise.all([
          apiFetch("/api/grades/my-grades/"),
          apiFetch("/api/classmanagement/school-years/active/"),
        ]);
        if (gradesRes.ok) {
          setGrades(await gradesRes.json());
        }
        if (syRes.ok) {
          const syData = await syRes.json();
          setSchoolYear(syData.name || "");
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Compute stats
  const validFinals = grades.filter((g) => g.final_grade !== null);
  const gwa = validFinals.length
    ? (validFinals.reduce((s, g) => s + g.final_grade, 0) / validFinals.length).toFixed(2)
    : null;
  
  const passedSubjects = validFinals.filter(g => g.final_grade >= 75).length;
  const pendingSubjects = grades.filter(g => g.final_grade === null).length;

  // Grade color helper
  const getGradeColor = (grade) => {
    if (grade === null) return 'sg-grade-pending';
    if (grade >= 90) return 'sg-grade-excellent';
    if (grade >= 80) return 'sg-grade-good';
    if (grade >= 75) return 'sg-grade-fair';
    return 'sg-grade-needs-improvement';
  };

  const handleExport = () => {
    window.print();
  };

  return (
    <main className="student-grades-main">
      {/* Stats Overview */}
      <section className="sg-section">
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

      {/* Main Content */}
      <section className="sg-section">
        <div className="sg-section-header">
          <div>
            <h2 className="sg-section-title">Academic Report Card</h2>
            <p className="sg-section-subtitle">S.Y. {schoolYear || "—"}</p>
          </div>
          <div className="sg-header-actions">
            <button className="sg-btn-primary" onClick={handleExport}>
              <Download size={18} />
              Export Report
            </button>
          </div>
        </div>

        {/* Table */}
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
                  <th>1st Quarter</th>
                  <th>2nd Quarter</th>
                  <th>3rd Quarter</th>
                  <th>4th Quarter</th>
                  <th>Final Grade</th>
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
                        {subj.q1 !== null ? subj.q1.toFixed(1) : '—'}
                      </span>
                    </td>
                    <td data-label="2nd Quarter">
                      <span className={`sg-grade ${getGradeColor(subj.q2)}`}>
                        {subj.q2 !== null ? subj.q2.toFixed(1) : '—'}
                      </span>
                    </td>
                    <td data-label="3rd Quarter">
                      <span className={`sg-grade ${getGradeColor(subj.q3)}`}>
                        {subj.q3 !== null ? subj.q3.toFixed(1) : '—'}
                      </span>
                    </td>
                    <td data-label="4th Quarter">
                      <span className={`sg-grade ${getGradeColor(subj.q4)}`}>
                        {subj.q4 !== null ? subj.q4.toFixed(1) : '—'}
                      </span>
                    </td>
                    <td data-label="Final Grade">
                      <span className={`sg-final-grade ${getGradeColor(subj.final_grade)}`}>
                        {subj.final_grade !== null ? subj.final_grade.toFixed(1) : '—'}
                      </span>
                    </td>
                    <td data-label="Remarks">
                      {subj.remarks ? (
                        <span className={`sg-status-badge sg-status-${subj.remarks.toLowerCase()}`}>
                          {subj.remarks}
                        </span>
                      ) : (
                        <span className="sg-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  );
};

export default Grades;
