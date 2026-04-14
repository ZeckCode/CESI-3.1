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
import { generateTeacherMetricsInsight, getTeacherMetricColor } from "../../utils/roleInsights";
import Toast from "../Global/Toast";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);
ChartJS.defaults.set({ responsive: true, maintainAspectRatio: false });

const API = "";
const QUARTERS = [1, 2, 3, 4];

const getCurrentSchoolQuarter = () => {
  const month = new Date().getMonth() + 1;
  if (month >= 6 && month <= 8) return 1;
  if (month >= 9 && month <= 11) return 2;
  if (month === 12 || month <= 2) return 3;
  return 4;
};

const normalizeGradeCode = (value) => {
  if (value === null || value === undefined) return "";

  const v = String(value).trim().toLowerCase();

  const map = {
    "0": "kinder",
    "1": "grade1",
    "2": "grade2",
    "3": "grade3",
    "4": "grade4",
    "5": "grade5",
    "6": "grade6",
    "kinder": "kinder",
    "grade1": "grade1",
    "grade2": "grade2",
    "grade3": "grade3",
    "grade4": "grade4",
    "grade5": "grade5",
    "grade6": "grade6",
    "grade 1": "grade1",
    "grade 2": "grade2",
    "grade 3": "grade3",
    "grade 4": "grade4",
    "grade 5": "grade5",
    "grade 6": "grade6",
    "prek": "prek",
    "pre-kinder": "prek",
  };

  return map[v] || "";
};

const GRADE_LABEL = (level) => {
  const code = normalizeGradeCode(level);

  const shortLabels = {
    prek: "PK",
    kinder: "K",
    grade1: "G1",
    grade2: "G2",
    grade3: "G3",
    grade4: "G4",
    grade5: "G5",
    grade6: "G6",
  };

  return shortLabels[code] || String(level || "—");
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

  return fullLabels[code] || String(level || "—");
};

const getPerformanceKey = (row) => {
  if (!row) return "";

  const studentNumber = String(row.student_number || "").trim();
  if (studentNumber) return `num:${studentNumber.toLowerCase()}`;

  const idValue = row.student_id != null ? String(row.student_id).trim() : "";
  if (idValue) return `id:${idValue}`;

  const nameValue = String(row.student_name || "").trim();
  return nameValue ? `name:${nameValue.toLowerCase()}` : "";
};

const getPeakBand = (dist) => {
  const entries = Object.entries(dist || {});
  if (entries.length === 0) return null;

  let best = entries[0];
  for (let i = 1; i < entries.length; i += 1) {
    if (entries[i][1] > best[1]) best = entries[i];
  }

  return best[1] > 0 ? { label: best[0], count: best[1] } : null;
};

const getTopIssue = (list) => {
  if (!Array.isArray(list) || list.length === 0) return null;

  const counts = list.reduce((acc, item) => {
    const key = item?.issue || "Other";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  let top = null;
  Object.entries(counts).forEach(([label, count]) => {
    if (!top || count > top.count) top = { label, count };
  });

  return top;
};

const SPerformance = () => {
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState("");
  const [quarter, setQuarter] = useState(getCurrentSchoolQuarter);
  const [teacherSubject, setTeacherSubject] = useState(null);
  const [performanceData, setPerformanceData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [sendingReminderId, setSendingReminderId] = useState(null);
  const [sendingStarKey, setSendingStarKey] = useState("");
  const [toasts, setToasts] = useState([]);
  const [isNarrow, setIsNarrow] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 640px)").matches;
  });

  const dismissToast = useCallback((toastId) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== toastId));
  }, []);

  const pushToast = useCallback((toast) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, ...toast }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4500);
  }, []);

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

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mq = window.matchMedia("(max-width: 640px)");
    const handleChange = (event) => setIsNarrow(event.matches);

    handleChange(mq);

    if (mq.addEventListener) {
      mq.addEventListener("change", handleChange);
      return () => mq.removeEventListener("change", handleChange);
    }

    mq.addListener(handleChange);
    return () => mq.removeListener(handleChange);
  }, []);

  const fetchPerformance = useCallback(async () => {
    if (!selectedSection) {
      setPerformanceData([]);
      return;
    }

    const selectedSectionMeta = sections.find((sec) => String(sec.id) === String(selectedSection));
    const subjectQuery = selectedSectionMeta?.subject_id
      ? `&subject=${encodeURIComponent(selectedSectionMeta.subject_id)}`
      : "";

    setLoading(true);
    try {
      const res = await apiFetch(
        `${API}/api/grades/section-performance/?section=${selectedSection}&quarter=${quarter}${subjectQuery}`
      );
      if (res.ok) {
        const raw = await res.json();
        const unique = Object.values(
          (Array.isArray(raw) ? raw : []).reduce((acc, item) => {
            const key = getPerformanceKey(item);
            if (!key) return acc;
            if (!acc[key]) {
              acc[key] = item;
            } else {
              // Merge existing and new row to keep full computed props in case of partial duplicates
              acc[key] = {
                ...acc[key],
                ...item,
              };
            }
            return acc;
          }, {})
        );
        if (unique.length !== (Array.isArray(raw) ? raw.length : 0)) {
          console.warn("SPerformance: removed duplicate student entries", {
            original: Array.isArray(raw) ? raw.length : 0,
            unique: unique.length,
          });
        }
        setPerformanceData(unique);
      } else setPerformanceData([]);
    } catch (e) {
      console.error(e);
      setPerformanceData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedSection, quarter, sections]);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  const sendPerformanceReminder = async (student) => {
    setSendingReminderId(student.student_id);
    try {
      const res = await apiFetch(`${API}/api/reminders/performance/send/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: student.student_id,
          student_name: student.student_name,
          section_id: selectedSection,
          quarter,
          issue: student.issue,
          quarter_grade: student.quarter_grade,
          attendance_pct: student.attendance_pct,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || "Failed to send performance reminder.");
      }

      alert(data.detail || `Performance reminder sent for ${student.student_name}.`);
    } catch (e) {
      console.error(e);
      alert(e.message || "Failed to send performance reminder.");
    } finally {
      setSendingReminderId(null);
    }
  };

  const sendStarNotification = async (student) => {
    const starKey = getPerformanceKey(student) || String(student?.student_name || "");
    if (!starKey) return;

    setSendingStarKey(starKey);
    try {
      const res = await apiFetch(`${API}/api/reminders/performance/star/send/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: student.student_id,
          student_number: student.student_number,
          student_name: student.student_name,
          section_id: selectedSection,
          quarter,
          quarter_grade: student.quarter_grade,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || "Failed to send star notification.");
      }

      pushToast({
        type: "success",
        title: "Star Sent",
        message: data.detail || `Star sent successfully to ${student.student_name || "the student"}.`,
      });
    } catch (e) {
      console.error(e);
      pushToast({
        type: "error",
        title: "Star Failed",
        message: e.message || "Failed to send star notification.",
      });
    } finally {
      setSendingStarKey("");
    }
  };

  const displayPerformance = useMemo(() => {
    const byId = {};
    const noIdRows = [];

    (performanceData || []).forEach((student) => {
      if (!student) return;

      const key = getPerformanceKey(student);
      if (!key) {
        noIdRows.push(student);
        return;
      }

      if (!byId[key]) {
        byId[key] = student;
      } else {
        byId[key] = { ...byId[key], ...student };
      }
    });

    const mergedRows = [...Object.values(byId), ...noIdRows];

    // Final fallback: collapse visually identical rows from mixed legacy sources.
    const seenVisual = new Set();
    const uniqueRows = mergedRows.filter((row) => {
      const visualKey = [
        String(row.student_name || "").trim().toLowerCase(),
        row.quarter_grade ?? "null",
        row.attendance_pct ?? "null",
        row.activity_avg ?? "null",
        row.quiz_avg ?? "null",
        row.exam_avg ?? "null",
        row.class_standing ?? "null",
      ].join("|");

      if (seenVisual.has(visualKey)) return false;
      seenVisual.add(visualKey);
      return true;
    });

    if (uniqueRows.length !== mergedRows.length) {
      console.warn("SPerformance: removed visually duplicate rows", {
        original: mergedRows.length,
        unique: uniqueRows.length,
      });
    }

    return uniqueRows;
  }, [performanceData]);

  const stats = useMemo(() => {
    const graded = displayPerformance.filter((s) => s.quarter_grade !== null);
    const total = displayPerformance.length;
    const gradedCount = graded.length;
    const classAvg = gradedCount
      ? graded.reduce((sum, s) => sum + s.quarter_grade, 0) / gradedCount
      : null;
    const topGrade = gradedCount ? Math.max(...graded.map((s) => s.quarter_grade)) : null;
    const passed = graded.filter((s) => s.quarter_grade >= 75).length;
    const failed = graded.filter((s) => s.quarter_grade < 75).length;
    const atRiskList = displayPerformance
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

    // Histogram: Grade distribution (5-point increments)
    const dist = { 
      "50-59": 0, 
      "60-69": 0, 
      "70-74": 0, 
      "75-79": 0, 
      "80-84": 0, 
      "85-89": 0, 
      "90-94": 0, 
      "95-100": 0 
    };
    graded.forEach(({ quarter_grade: g }) => {
      if (g < 50) dist["50-59"]++;
      else if (g < 60) dist["50-59"]++;
      else if (g < 70) dist["60-69"]++;
      else if (g < 75) dist["70-74"]++;
      else if (g < 80) dist["75-79"]++;
      else if (g < 85) dist["80-84"]++;
      else if (g < 90) dist["85-89"]++;
      else if (g < 95) dist["90-94"]++;
      else dist["95-100"]++;
    });

    // Stacked Bar: Pass/Near-Pass/Fail breakdown
    // Pass >= 75, Near-Pass 70-74, Fail < 70
    const passCount = graded.filter((s) => s.quarter_grade >= 75).length;
    const nearPassCount = graded.filter((s) => s.quarter_grade >= 70 && s.quarter_grade < 75).length;
    const failCount = graded.filter((s) => s.quarter_grade < 70).length;

    return { 
      total, 
      classAvg, 
      topGrade, 
      passed, 
      failed, 
      atRiskList, 
      topList, 
      dist,
      passCount,
      nearPassCount,
      failCount,
      gradedCount
    };
  }, [displayPerformance]);

  const insights = useMemo(() => {
    if (stats.total === 0) {
      return ["No students enrolled in this section yet."];
    }

    const lines = [];
    const graded = stats.gradedCount || 0;
    const missing = Math.max(stats.total - graded, 0);

    if (graded > 0) {
      lines.push(
        `Grades encoded for ${graded} of ${stats.total} students.` +
          (missing > 0 ? ` ${missing} missing grades.` : "")
      );

      const passRate = Math.round((stats.passed / graded) * 100);
      lines.push(`Pass rate is ${passRate}% (${stats.passed}/${graded} graded students).`);

      if (stats.classAvg !== null) {
        const top =
          stats.topGrade !== null ? ` Top grade is ${stats.topGrade.toFixed(1)}%.` : "";
        lines.push(`Class average is ${stats.classAvg.toFixed(1)}%.${top}`);
      }

      const peak = getPeakBand(stats.dist);
      if (peak) {
        lines.push(
          `Largest grade band is ${peak.label} with ${peak.count} student${
            peak.count === 1 ? "" : "s"
          }.`
        );
      }
    } else {
      lines.push("No graded students yet for this quarter.");
    }

    if (stats.atRiskList.length > 0) {
      const topIssue = getTopIssue(stats.atRiskList);
      lines.push(
        topIssue
          ? `At risk: ${stats.atRiskList.length} student${
              stats.atRiskList.length === 1 ? "" : "s"
            }. Most common issue is ${topIssue.label} (${topIssue.count}).`
          : `At risk: ${stats.atRiskList.length} student${
              stats.atRiskList.length === 1 ? "" : "s"
            }.`
      );
    } else {
      lines.push("No students flagged as at risk this quarter.");
    }

    return lines;
  }, [stats]);

  const chartInsights = useMemo(() => {
    if (stats.classAvg === null) {
      return { histogram: "No grade data available yet", passBreakdown: "No grade data available yet" };
    }

    // Histogram insight
    let histogramInsight = "";
    if (stats.classAvg >= 85) {
      histogramInsight = "Strong distribution - Most students performing above average";
    } else if (stats.classAvg >= 75) {
      histogramInsight = "Good distribution - Students spreading across middle range";
    } else if (stats.classAvg >= 70) {
      histogramInsight = "Developing distribution - Some students need extra support";
    } else {
      histogramInsight = "Concerning distribution - Cluster in lower grades, interventions recommended";
    }

    // Pass/Fail breakdown insight
    const passRate = Math.round((stats.passed / (stats.gradedCount || 1)) * 100);
    let passBreakdownInsight = "";
    if (passRate >= 90) {
      passBreakdownInsight = "Excellent - Nearly all students passing with minimal failures";
    } else if (passRate >= 80) {
      passBreakdownInsight = "Very good - Majority passing, few near-pass concerns";
    } else if (passRate >= 70) {
      passBreakdownInsight = "Satisfactory - Most passing but notable group at near-pass line";
    } else {
      passBreakdownInsight = "Alert - Significant near-pass and fail group, targeted help needed";
    }

    return { histogram: histogramInsight, passBreakdown: passBreakdownInsight };
  }, [stats.classAvg, stats.passed, stats.gradedCount]);

  
  const histogramData = {
    labels: Object.keys(stats.dist),
    datasets: [
      {
        label: "Students",
        data: Object.values(stats.dist),
        backgroundColor: [
          "#fca5a5", // 50-59 (lightest red)
          "#f97316", // 60-69 (orange)
          "#fbbf24", // 70-74 (amber)
          "#60a5fa", // 75-79 (light blue)
          "#4f46e5", // 80-84 (indigo)
          "#7c3aed", // 85-89 (violet)
          "#06b6d4", // 90-94 (cyan)
          "#10b981", // 95-100 (green)
        ],
        borderRadius: 8,
        borderWidth: 0,
      },
    ],
  };

  const stackedBarData = {
    labels: ["Grade Composition"],
    datasets: [
      {
        label: "Pass (75-100)",
        data: [stats.passCount],
        backgroundColor: "#10b981",
        borderRadius: 8,
      },
      {
        label: "Near-Pass (70-74)",
        data: [stats.nearPassCount],
        backgroundColor: "#f59e0b",
        borderRadius: 8,
      },
      {
        label: "Fail (Below 70)",
        data: [stats.failCount],
        backgroundColor: "#ef4444",
        borderRadius: 8,
      },
    ],
  };

  const doughnutData = {
    labels: ["Passed", "Failed / No Grade"],
    datasets: [
      {
        data: [stats.passed, stats.total - stats.passed],
        backgroundColor: ["#198754", "#dc3545"],
        borderWidth: 0,
        hoverOffset: 10,
      },
    ],
  };

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: undefined,
    plugins: {
      legend: { 
        position: "bottom", 
        labels: { 
          boxWidth: 12, 
          font: { size: 11 },
          padding: 10,
          maxWidth: 80,
        },
      },
    },
  };

  const histogramOptions = {
    ...commonOptions,
    scales: {
      x: {
        ticks: {
          autoSkip: true,
          maxRotation: 0,
          minRotation: 0,
          font: { size: isNarrow ? 10 : 11 },
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
          font: { size: isNarrow ? 10 : 11 },
        },
      },
    },
  };

  const stackedBarOptions = {
    ...commonOptions,
    indexAxis: isNarrow ? "x" : "y",
    scales: {
      x: {
        stacked: true,
        beginAtZero: true,
        ticks: { font: { size: isNarrow ? 10 : 11 } },
      },
      y: {
        stacked: true,
        ticks: { font: { size: isNarrow ? 10 : 11 } },
      },
    },
    plugins: {
      ...commonOptions.plugins,
      legend: {
        ...commonOptions.plugins.legend,
        position: isNarrow ? "bottom" : "right",
        labels: {
          ...commonOptions.plugins.legend.labels,
          font: { size: isNarrow ? 10 : 11 },
        },
      },
    },
  };

  if (initLoading) {
    return (
      <div className="sp">
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
          Loading performance data...
        </div>
      </div>
    );
  }

  return (
    <div className="sp">
      <header className="sp__header">
        <div className="sp__headerLeft">
          <h1 className="sp__title">Performance Analysis</h1>
          <p className="sp__subtitle">Track student grades, attendance, and academic progress</p>
        </div>

        <div className="sp__headerControls">
          <select
            className="sp__select"
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
          >
            {sections.length === 0 && <option value="">No sections assigned</option>}
            {sections.map((sec) => (
              <option key={sec.id} value={String(sec.id)}>
                {GRADE_LABEL(sec.grade_level)} - {sec.name}
              </option>
            ))}
          </select>

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

      <section className="sp__cards">
        <div className="spCard spCard--primary">
          <div className="spCard__icon" aria-hidden="true">📊</div>
          <div>
            <div className="spCard__label">Class Average</div>
            <div className="spCard__value">
              {stats.classAvg !== null ? `${stats.classAvg.toFixed(1)}%` : "—"}
            </div>
            {stats.classAvg !== null && (
              <div className="spCard__insight" style={{ color: getTeacherMetricColor(generateTeacherMetricsInsight('classPerformance', stats.classAvg)) }}>
                {generateTeacherMetricsInsight('classPerformance', stats.classAvg)}
              </div>
            )}
          </div>
        </div>

        <div className="spCard spCard--success">
          <div className="spCard__icon" aria-hidden="true">⭐</div>
          <div>
            <div className="spCard__label">Top Grade</div>
            <div className="spCard__value">
              {stats.topGrade !== null ? `${stats.topGrade.toFixed(1)}%` : "—"}
            </div>
            {stats.topGrade !== null && (
              <div className="spCard__insight" style={{ color: "#10b981" }}>
                Peak performance in class
              </div>
            )}
          </div>
        </div>

        <div className="spCard spCard--danger">
          <div className="spCard__icon" aria-hidden="true">⚠️</div>
          <div>
            <div className="spCard__label">At Risk</div>
            <div className="spCard__value">
              {stats.atRiskList.length}
              <span className="spCard__valueSub">
                {stats.atRiskList.length === 1 ? "Student" : "Students"}
              </span>
            </div>
            {stats.atRiskList.length >= 0 && (
              <div className="spCard__insight" style={{ color: getTeacherMetricColor(generateTeacherMetricsInsight('atRiskStudents', stats.atRiskList.length)) }}>
                {generateTeacherMetricsInsight('atRiskStudents', stats.atRiskList.length)}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="sp__charts">
        <div className="spPanel">
          <div className="spPanel__title">📊 Overall Grade Distribution (Histogram)</div>
          <div className="spPanel__chart">
            {stats.classAvg !== null ? (
              <Bar data={histogramData} options={histogramOptions} />
            ) : (
              <div className="sp__empty">No grade data yet for this quarter.</div>
            )}
          </div>
          {stats.classAvg !== null && (
            <div className="spChart__insight" style={{ fontSize: "0.85rem", fontWeight: "500", marginTop: "1rem", padding: "0.75rem", backgroundColor: "var(--primary-light)", borderLeft: "3px solid var(--primary)", borderRadius: "4px" }}>
              {chartInsights.histogram}
            </div>
          )}
        </div>

        <div className="spPanel">
          <div className="spPanel__title">📈 Pass/Near-Pass/Fail Breakdown</div>
          <div className="spPanel__chart">
            {stats.gradedCount > 0 ? (
              <Bar data={stackedBarData} options={stackedBarOptions} />
            ) : (
              <div className="sp__empty">No graded students yet.</div>
            )}
          </div>
          {stats.gradedCount > 0 && (
            <div className="spChart__insight" style={{ fontSize: "0.85rem", fontWeight: "500", marginTop: "1rem", padding: "0.75rem", backgroundColor: "var(--success-light)", borderLeft: "3px solid var(--success)", borderRadius: "4px" }}>
              {chartInsights.passBreakdown}
            </div>
          )}
        </div>
      </section>

      <section className="spBlock">
        <div className="spBlock__head spBlock__head--dark">
          <h6 className="spBlock__headTitle">🏆 Top Performers</h6>
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
                  <th className="spTh">ACTION</th>
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
                    <tr className="spTr" key={getPerformanceKey(s) || s.student_id || s.student_name}>
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
                      <td className="spTd">
                        <button
                          className="spActionBtn spActionBtn--star"
                          onClick={() => sendStarNotification(s)}
                          disabled={
                            sendingStarKey ===
                              (getPerformanceKey(s) || String(s?.student_name || "")) ||
                            (!s?.student_id && !s?.student_number)
                          }
                        >
                          {sendingStarKey ===
                          (getPerformanceKey(s) || String(s?.student_name || ""))
                            ? "Sending..."
                            : "Send Star"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="spBlock spBlock--mb">
        <div className="spBlock__head spBlock__head--danger">
          <h6 className="spBlock__headTitle">⚠️ Students Needing Support</h6>
          <span className="spPill spPill--lightDanger">Action Required</span>
        </div>

        <div className="spTableWrap">
          {displayPerformance.length === 0 ? (
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
                  <th className="spTh">ACTIONS</th>
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
                      <td className="spTd">
                        <button
                          className="spActionBtn"
                          onClick={() => sendPerformanceReminder(s)}
                          disabled={sendingReminderId === s.student_id}
                        >
                          {sendingReminderId === s.student_id ? "Sending..." : "Send Reminder"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

export default SPerformance;
