import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import "../TeacherWebsiteCSS/SPerformance.css";
import { apiFetch } from "../api/apiFetch";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const API = "";
const QUARTERS = [1, 2, 3, 4];

const GRADE_LABEL = (level) => {
  if (level === 0 || level === "0" || level === "kinder") return "K";
  return `G${level}`;
};

const SPerformance = () => {
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState("");
  const [quarter, setQuarter] = useState(1);
  const [teacherSubject, setTeacherSubject] = useState(null);
  const [performanceData, setPerformanceData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);

  // ── Load teacher + sections on mount ──
  useEffect(() => {
    (async () => {
      try {
        const [tiRes, secRes] = await Promise.all([
          apiFetch(`${API}/api/grades/teacher-info/`),
          apiFetch(`${API}/api/grades/my-sections/`),
        ]);
        if (tiRes.ok) setTeacherSubject(await tiRes.json());
        if (secRes.ok) {
          const secs = await secRes.json();
          setSections(Array.isArray(secs) ? secs : []);
          if (secs.length > 0) setSelectedSection(String(secs[0].id));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setInitLoading(false);
      }
    })();
  }, []);

  // ── Fetch performance data when section/quarter changes ──
  const fetchPerformance = useCallback(async () => {
    if (!selectedSection) { setPerformanceData([]); return; }
    setLoading(true);
    try {
      const res = await apiFetch(
        `${API}/api/grades/section-performance/?section=${selectedSection}&quarter=${quarter}`
      );
      if (res.ok) setPerformanceData(await res.json());
      else setPerformanceData([]);
    } catch (e) {
      console.error(e);
      setPerformanceData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedSection, quarter]);

  useEffect(() => { fetchPerformance(); }, [fetchPerformance]);

  // ── Derived stats ──
  const stats = useMemo(() => {
    const graded = performanceData.filter((s) => s.quarter_grade !== null);
    const total = performanceData.length;
    const gradedCount = graded.length;
    const classAvg = gradedCount
      ? graded.reduce((sum, s) => sum + s.quarter_grade, 0) / gradedCount
      : null;
    const topGrade = gradedCount ? Math.max(...graded.map((s) => s.quarter_grade)) : null;
    const passed = graded.filter((s) => s.quarter_grade >= 75).length;
    const failed = graded.filter((s) => s.quarter_grade < 75).length;
    const atRiskList = performanceData
      .filter((s) => s.quarter_grade === null || s.quarter_grade < 75)
      .map((s) => ({
        ...s,
        issue:
          s.quarter_grade === null
            ? "No grades encoded yet"
            : s.attendance_pct !== null && s.attendance_pct < 75
            ? "Low Attendance"
            : s.activity_avg === null && s.quiz_avg === null && s.exam_avg === null
            ? "No scores recorded"
            : "Low Grade",
      }));
    const topList = [...graded]
      .sort((a, b) => b.quarter_grade - a.quarter_grade)
      .slice(0, 5);

    // Grade distribution buckets (only students at or above passing grade 75)
    const dist = { "75-80": 0, "81-85": 0, "86-90": 0, "91-95": 0, "96-100": 0 };
    graded.forEach(({ quarter_grade: g }) => {
      if (g < 75) return; // below passing threshold — not counted in the distribution
      if (g <= 80) dist["75-80"]++;
      else if (g <= 85) dist["81-85"]++;
      else if (g <= 90) dist["86-90"]++;
      else if (g <= 95) dist["91-95"]++;
      else dist["96-100"]++;
    });

    return { total, classAvg, topGrade, passed, failed, atRiskList, topList, dist };
  }, [performanceData]);

  const barData = {
    labels: Object.keys(stats.dist),
    datasets: [{
      label: "Students",
      data: Object.values(stats.dist),
      backgroundColor: "#2563eb",
      borderRadius: 6,
    }],
  };

  const doughnutData = {
    labels: ["Passed", "Failed / No Grade"],
    datasets: [{
      data: [stats.passed, stats.total - stats.passed],
      backgroundColor: ["#198754", "#dc3545"],
      borderWidth: 0,
      hoverOffset: 10,
    }],
  };

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } },
    },
  };

  const currentSection = sections.find((s) => String(s.id) === selectedSection);

  if (initLoading) {
    return <div className="sp"><div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading performance data...</div></div>;
  }

  return (
    <div className="sp">
      {/* Header */}
      <header className="sp__header">
        <div className="sp__headerLeft">
          <h2 className="sp__title">Student Performance</h2>
          <p className="sp__subtitle">
            Analysis Dashboard
            {currentSection
              ? ` • ${GRADE_LABEL(currentSection.grade_level)} - ${currentSection.name}`
              : ""}
          </p>
        </div>

        <div className="sp__headerControls">
          {/* Section selector */}
          <select
            className="sp__select"
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
          >
            {sections.length === 0 && (
              <option value="">No sections assigned</option>
            )}
            {sections.map((sec) => (
              <option key={sec.id} value={String(sec.id)}>
                {GRADE_LABEL(sec.grade_level)} - {sec.name}
              </option>
            ))}
          </select>

          {/* Quarter tabs */}
          <div className="sp__quarterTabs">
            {QUARTERS.map((q) => (
              <button
                key={q}
                type="button"
                className={"sp__qTab " + (quarter === q ? "sp__qTab--active" : "")}
                onClick={() => setQuarter(q)}
              >
                Q{q}
              </button>
            ))}
          </div>
        </div>
      </header>

      {loading && (
        <div className="sp__loadingBar">
          <div className="sp__loadingBar__fill" />
        </div>
      )}

      {/* Top Cards */}
      <section className="sp__cards">
        <div className="spCard spCard--primary">
          <div className="spCard__icon" aria-hidden="true">🧮</div>
          <div>
            <div className="spCard__label">CLASS AVERAGE</div>
            <div className="spCard__value">
              {stats.classAvg !== null ? `${stats.classAvg.toFixed(1)}%` : "—"}
            </div>
          </div>
        </div>

        <div className="spCard spCard--success">
          <div className="spCard__icon" aria-hidden="true">🏆</div>
          <div>
            <div className="spCard__label">TOP GRADE</div>
            <div className="spCard__value">
              {stats.topGrade !== null ? `${stats.topGrade.toFixed(1)}%` : "—"}
            </div>
          </div>
        </div>

        <div className="spCard spCard--danger">
          <div className="spCard__icon" aria-hidden="true">⚠️</div>
          <div>
            <div className="spCard__label">AT RISK</div>
            <div className="spCard__value">
              {stats.atRiskList.length}{" "}
              <span className="spCard__valueSub">
                {stats.atRiskList.length === 1 ? "Student" : "Students"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Charts */}
      <section className="sp__charts">
        <div className="spPanel">
          <div className="spPanel__title">Grade Distribution Frequency</div>
          <div className="spPanel__chart">
            {stats.classAvg !== null ? (
              <Bar data={barData} options={commonOptions} />
            ) : (
              <div className="sp__empty">No grade data yet for this quarter.</div>
            )}
          </div>
        </div>

        <div className="spPanel">
          <div className="spPanel__title">Passing Rate Status</div>
          <div className="spPanel__chart">
            {stats.total > 0 ? (
              <Doughnut data={doughnutData} options={commonOptions} />
            ) : (
              <div className="sp__empty">No students in this section.</div>
            )}
          </div>
        </div>
      </section>

      {/* Ranking table */}
      <section className="spBlock">
        <div className="spBlock__head spBlock__head--dark">
          <h6 className="spBlock__headTitle">Ranking Top Performers</h6>
          <span className="spPill spPill--primary">Top 5 Students</span>
        </div>

        <div className="spTableWrap">
          {stats.topList.length === 0 ? (
            <div className="sp__empty sp__empty--padded">No graded students yet.</div>
          ) : (
            <table className="spTable">
              <thead>
                <tr>
                  <th className="spTh">RANK</th>
                  <th className="spTh spTh--left">STUDENT NAME</th>
                  <th className="spTh">GRADE</th>
                  <th className="spTh">REMARKS</th>
                </tr>
              </thead>
              <tbody>
                {stats.topList.map((s, idx) => {
                  const rank = idx + 1;
                  const g = s.quarter_grade;
                  const remarks =
                    g >= 90 ? "With High Honors" : g >= 85 ? "With Honors" : "Passed";
                  const remarksCls =
                    g >= 90
                      ? "spPill--success"
                      : g >= 85
                      ? "spPill--success"
                      : "spPill--info";
                  return (
                    <tr className="spTr" key={s.student_id}>
                      <td className="spTd">
                        <span className={"rankDot " + (rank === 1 ? "rankDot--gold" : "rankDot--muted")}>
                          {rank}
                        </span>
                      </td>
                      <td className="spTd spTd--left spName">{s.student_name}</td>
                      <td className="spTd spGwa">{g.toFixed(1)}%</td>
                      <td className="spTd">
                        <span className={"spPill " + remarksCls}>{remarks}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* At-Risk table */}
      <section className="spBlock spBlock--mb">
        <div className="spBlock__head spBlock__head--danger">
          <h6 className="spBlock__headTitle">Students At Risk / Underperforming</h6>
          <span className="spPill spPill--lightDanger">Action Required</span>
        </div>

        <div className="spTableWrap">
          {stats.atRiskList.length === 0 ? (
            <div className="sp__empty sp__empty--padded">
              {stats.total === 0
                ? "No students enrolled in this section."
                : "No students at risk this quarter."}
            </div>
          ) : (
            <table className="spTable">
              <thead>
                <tr>
                  <th className="spTh spTh--left">STUDENT NAME</th>
                  <th className="spTh">GRADE</th>
                  <th className="spTh">ATTENDANCE</th>
                  <th className="spTh">PRIMARY ISSUE</th>
                </tr>
              </thead>
              <tbody>
                {stats.atRiskList.map((s) => {
                  const attPct = s.attendance_pct !== null ? s.attendance_pct : null;
                  const attDisplay = attPct !== null ? `${attPct.toFixed(0)}%` : "N/A";
                  const barWidth = attPct !== null ? Math.min(attPct, 100) : 0;
                  return (
                    <tr className="spTr" key={s.student_id}>
                      <td className="spTd spTd--left spRiskName">{s.student_name}</td>
                      <td className="spTd spDark">
                        {s.quarter_grade !== null ? `${s.quarter_grade.toFixed(1)}%` : "—"}
                      </td>
                      <td className="spTd">
                        <div className="spProg">
                          <div
                            className={
                              "spProg__bar " +
                              (attPct !== null && attPct < 75
                                ? "spProg__bar--danger"
                                : "spProg__bar--warn")
                            }
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <div className="spTiny">{attDisplay} Attendance</div>
                      </td>
                      <td className="spTd">
                        <span className="spPill spPill--dangerSoft">{s.issue}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
};

export default SPerformance;
