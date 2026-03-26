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
  const [studentName, setStudentName] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [gradesRes, syRes, profileRes] = await Promise.all([
          apiFetch("/api/grades/my-grades/"),
          apiFetch("/api/classmanagement/school-years/active/"),
          apiFetch("/api/accounts/profile/"),
        ]);
        if (gradesRes.ok) {
          setGrades(await gradesRes.json());
        }
        if (syRes.ok) {
          const syData = await syRes.json();
          setSchoolYear(syData.name || "");
        }
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          const name = profileData.user?.get_full_name || profileData.user?.username || "";
          setStudentName(name);
        }
      } catch (e) {
        console.error(e);
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

  const validFinals = grades.filter((g) => g.final_grade !== null);
  const gwa = validFinals.length
    ? (validFinals.reduce((s, g) => s + g.final_grade, 0) / validFinals.length).toFixed(2)
    : null;
  
  const passedSubjects = validFinals.filter(g => g.final_grade >= 75).length;
  const pendingSubjects = grades.filter(g => g.final_grade === null).length;

  const getGradeColor = (grade) => {
    if (grade === null) return 'sg-grade-pending';
    if (grade >= 90) return 'sg-grade-excellent';
    if (grade >= 80) return 'sg-grade-good';
    if (grade >= 75) return 'sg-grade-fair';
    return 'sg-grade-needs-improvement';
  };

  const getQuarterGradeDisplay = (grade, quarter) => {
    if (grade !== null) return grade.toFixed(1);
    return getCurrentQuarter() === quarter ? 'Pending' : '—';
  };

  const getSubjectStatusBadge = (subject) => {
    const currentQuarter = getCurrentQuarter();
    const currentQuarterGrade = subject[`q${currentQuarter}`];
    if (currentQuarterGrade === null) return { status: 'pending', label: 'Pending' };
    if (subject.final_grade !== null) {
      return subject.final_grade >= 75 
        ? { status: 'passed', label: 'Passed' }
        : { status: 'failed', label: 'Failed' };
    }
    return null;
  };

  const handleExport = () => {
    window.print();
  };

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
    </main>
  );
};

export default Grades;