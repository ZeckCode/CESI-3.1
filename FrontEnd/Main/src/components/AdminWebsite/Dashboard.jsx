import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  AreaChart,
  Area,
  RadialBarChart,
  RadialBar,
  ReferenceDot,
} from "recharts";
import {
  Users,
  Calendar,
  Wallet,
  Bell,
  ClipboardCheck,
  Clock,
  ChevronDown,
  User,
  CheckCircle,
  XCircle,
  AlertCircle,
  Key,
  Send,
  Crown,
} from "lucide-react";
import { apiFetch } from "../api/apiFetch";
import { generateRevenueInsight, detectRevenueDips, generateEnrollmentInsight, generateAttendanceInsight, generatePaymentInsight, getChartInsightColor } from "../../utils/chartInsights";
import Toast from "../Global/Toast";
import "../AdminWebsiteCSS/Dashboard.css";

const COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#a78bfa",
  "#c4b5fd",
  "#818cf8",
  "#7c3aed",
  "#4f46e5",
];

const PAYMENT_COLORS = ["#10b981", "#f59e0b", "#ef4444"];

const Dashboard = ({ onNavigateToEnrollment }) => {
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    totalStudents: 0,
    totalRevenue: 0,
    activeClasses: 0,
    attendanceRate: 0,
    todayAttendanceRate: 0,
    todayPresent: 0,
    todayTotal: 0,
    totalSubjects: 0,
    pendingEnrollments: 0,
    overduePayments: 0,
  });

  const [enrollmentByLevel, setEnrollmentByLevel] = useState([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState([]);
  const [revenueMonthly, setRevenueMonthly] = useState([]);
  const [attendanceTrend, setAttendanceTrend] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [expandedAnnouncements, setExpandedAnnouncements] = useState(new Set());
  const [activeAnnouncement, setActiveAnnouncement] = useState(null);
  const [passwordResetRequests, setPasswordResetRequests] = useState([]);
  const [sendingResetId, setSendingResetId] = useState(null);
  const [attendanceToday, setAttendanceToday] = useState([]);
  const [subjectDistribution, setSubjectDistribution] = useState([]);
  const [pendingApplications, setPendingApplications] = useState([]);
  const [performanceMetrics, setPerformanceMetrics] = useState([]);
  const [selectedGradeLevel, setSelectedGradeLevel] = useState("All");
  const [expandedAnalysisSection, setExpandedAnalysisSection] = useState("");
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
    loadDashboardData();
  }, []);

  const safeArray = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.results)) return data.results;
    return [];
  };

  const parseAmount = (value) => {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  };

  const normalizeStatusLower = (value) =>
    String(value || "").trim().toLowerCase();

  const normalizeStatusUpper = (value) =>
    String(value || "").trim().toUpperCase();

  const normalizeGradeLabel = (value) => {
    const raw = String(value || "").trim().toLowerCase();

    const map = {
      prek: "Pre-Kinder",
      "pre-k": "Pre-Kinder",
      prekindergarten: "Pre-Kinder",
      pre_kinder: "Pre-Kinder",
      kinder: "Kinder",
      kindergarten: "Kinder",
      grade1: "Grade 1",
      "grade 1": "Grade 1",
      "1": "Grade 1",
      grade2: "Grade 2",
      "grade 2": "Grade 2",
      "2": "Grade 2",
      grade3: "Grade 3",
      "grade 3": "Grade 3",
      "3": "Grade 3",
      grade4: "Grade 4",
      "grade 4": "Grade 4",
      "4": "Grade 4",
      grade5: "Grade 5",
      "grade 5": "Grade 5",
      "5": "Grade 5",
      grade6: "Grade 6",
      "grade 6": "Grade 6",
      "6": "Grade 6",
    };

    return map[raw] || value || "Unknown";
  };

  const gradeDisplayMap = {
    prek: "Pre-Kinder",
    kinder: "Kinder",
    grade1: "1",
    grade2: "2",
    grade3: "3",
    grade4: "4",
    grade5: "5",
    grade6: "6",
  };

  const getEnrollmentGrade = (e) => {
    const rawGrade =
      e.grade_level_label ||
      e.grade_level_display ||
      e.grade_level_name ||
      e.grade_level ||
      e.level ||
      e.student_grade_level ||
      "Unknown";
    
    // Map grade codes to display names
    return gradeDisplayMap[rawGrade] || rawGrade;
  };

  const getTransactionStatus = (t) =>
    String(t.status || "").trim().toUpperCase();

  const getTransactionDate = (t) => t.date_created || t.due_date || null;

  const handleSendResetLink = async (resetId) => {
    try {
      setSendingResetId(resetId);
      const res = await apiFetch(
        `/api/accounts/admin/password-reset-requests/${resetId}/send-link/`,
        {
          method: "POST",
        }
      );

      if (!res.ok) {
        const data = await res.json();
        addToast("Error", data.detail || "Failed to send reset link.", "error");
        console.error("Failed to send reset link:", data.detail || "Unknown error");
      } else {
        // Refresh the dashboard data to update the display
        loadDashboardData();
        addToast("Success", "Reset link sent successfully.", "success");
      }
    } catch (err) {
      addToast("Error", err.message || "Failed to send reset link.", "error");
      console.error("Error sending reset link:", err);
    } finally {
      setSendingResetId(null);
    }
  };

  const toggleAnnouncementExpand = (id) => {
    const newExpanded = new Set(expandedAnnouncements);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedAnnouncements(newExpanded);
  };

  const getFirstImagePath = (a) => {
    const firstImage = a?.media?.find((m) =>
      /\.(jpg|jpeg|png|gif|webp)$/i.test(m?.file || m?.file_url || "")
    );
    return firstImage?.file_url || firstImage?.file || null;
  };

  const getFirstMedia = (a) => {
    return Array.isArray(a?.media) ? a.media[0] : null;
  };

  const toAbsUrl = (path) => {
    if (!path) return null;
    return path.startsWith("http") ? path : path;
  };

  async function loadDashboardData() {
    setLoading(true);

    try {
      const [
        enrollRes,
        financeRes,
        financeStatsRes,
        attendRes,
        passwordResetRes,
        annRes,
        subjectRes,
        sectionRes,
        gradesRes,
      ] = await Promise.all([
        apiFetch("/api/enrollments/")
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),

        apiFetch("/api/finance/transactions/")
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),

        apiFetch("/api/finance/transactions/stats/")
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),

        apiFetch("/api/attendance/records/")
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),

        apiFetch("/api/accounts/admin/password-reset-requests/")
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),

        apiFetch("/api/announcements/")
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),

          apiFetch("/api/accounts/subjects/")
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => []),

          apiFetch("/api/accounts/sections/")
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => []),

          apiFetch("/api/grades/")
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => []),
        ]);

      const enrollments = safeArray(enrollRes);
      const transactions = safeArray(financeRes);
      const attendRecords = safeArray(attendRes);
      const passwordResetList = safeArray(passwordResetRes);
      const anns = safeArray(annRes);
      const subjects = safeArray(subjectRes);
      const sections = safeArray(sectionRes);
      const grades = safeArray(gradesRes);

      // ─────────────────────────
      const approvedEnrollments = enrollments.filter((e) => {
        const s = normalizeStatusLower(e.status);
        return (
          s === "approved" ||
          s === "enrolled" ||
          s === "accept" ||
          s === "accepted" ||
          s === "confirmed"
        );
      });

      const pendingEnrollments = enrollments.filter((e) => {
        const s = normalizeStatusLower(e.status);
        return s === "pending";
      });

      // ─────────────────────────
      // Finance stats
      // fixed to match backend
      // ─────────────────────────
      const totalRevenueComputed = transactions.reduce(
        (sum, t) => sum + parseAmount(t.credit || 0),
        0
      );

      const totalRevenue =
        financeStatsRes?.totalRevenue ?? totalRevenueComputed;

      // Calculate overdue payments
      const overdue = transactions.filter(
        (t) => getTransactionStatus(t) === "OVERDUE"
      ).length;

      // ─────────────────────────
      // Attendance stats
      // ─────────────────────────
      const totalPresent = attendRecords.filter(
        (r) => normalizeStatusLower(r.status) === "present"
      ).length;

      const attendanceRate =
        attendRecords.length > 0
          ? Math.round((totalPresent / attendRecords.length) * 100)
          : 0;

      const todayStr = new Date().toISOString().slice(0, 10);

      const todayRecords = attendRecords.filter((r) => {
        const d = r.date || r.created_at;
        return d && String(d).slice(0, 10) === todayStr;
      });

      const todayPresent = todayRecords.filter(
        (r) => normalizeStatusLower(r.status) === "present"
      ).length;

      const todayAttendanceRate =
        todayRecords.length > 0
          ? Math.round((todayPresent / todayRecords.length) * 100)
          : 0;

      setStats({
        totalStudents: approvedEnrollments.length || enrollments.length,
        totalRevenue,
        activeClasses: sections.length,
        attendanceRate,
        todayAttendanceRate,
        todayPresent,
        todayTotal: todayRecords.length,
        totalSubjects: subjects.length,
        pendingEnrollments: pendingEnrollments.length,
        overduePayments: overdue,
      });

      // ─────────────────────────
      // Students per grade level
      // ─────────────────────────
      const gradeCounts = {};

      enrollments.forEach((e) => {
        const rawGrade = getEnrollmentGrade(e);
        const grade = normalizeGradeLabel(rawGrade);
        gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
      });

      const gradeOrder = [
        "Pre-Kinder",
        "Kinder",
        "Grade 1",
        "Grade 2",
        "Grade 3",
        "Grade 4",
        "Grade 5",
        "Grade 6",
      ];

      const enrollmentLevelData = Object.entries(gradeCounts)
        .map(([level, students]) => ({ level, students }))
        .sort((a, b) => {
          const ai = gradeOrder.indexOf(a.level);
          const bi = gradeOrder.indexOf(b.level);
          return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        });

      setEnrollmentByLevel(enrollmentLevelData);

      // ─────────────────────────
      // Payment breakdown
      // fixed to match PAID/PENDING/OVERDUE
      // ─────────────────────────
      const paid = transactions.filter(
        (t) => getTransactionStatus(t) === "PAID"
      ).length;

      const pending = transactions.filter(
        (t) => getTransactionStatus(t) === "PENDING"
      ).length;

      const payData = [
        { name: "Paid", value: paid },
        { name: "Pending", value: pending },
        { name: "Overdue", value: overdue },
      ].filter((d) => d.value > 0);

      setPaymentBreakdown(payData);

      // ─────────────────────────
      // Revenue trend by month
      // fixed to use date_created
      // ─────────────────────────
      const monthMap = {};
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];

      transactions.forEach((t) => {
        const rawDate = getTransactionDate(t);
        if (!rawDate) return;

        const d = new Date(rawDate);
        if (isNaN(d.getTime())) return;

        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
          2,
          "0"
        )}`;
        const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;

        if (!monthMap[key]) {
          monthMap[key] = {
            month: label,
            revenue: 0,
            count: 0,
          };
        }

        monthMap[key].revenue += parseAmount(t.amount);
        monthMap[key].count += 1;
      });

      const monthlyRevenueData = Object.keys(monthMap)
        .sort()
        .slice(-6)
        .map((key) => monthMap[key]);

      setRevenueMonthly(monthlyRevenueData);

      // ─────────────────────────
      // Attendance trend
      // ─────────────────────────
      const dayMap = {};
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

      attendRecords.forEach((r) => {
        const d = new Date(r.date || r.created_at);
        if (isNaN(d.getTime())) return;

        const key = d.toISOString().slice(0, 10);

        if (!dayMap[key]) {
          dayMap[key] = {
            date: key,
            present: 0,
            absent: 0,
            total: 0,
          };
        }

        dayMap[key].total += 1;

        if (normalizeStatusLower(r.status) === "present") {
          dayMap[key].present += 1;
        } else {
          dayMap[key].absent += 1;
        }
      });

      const attendanceData = Object.keys(dayMap)
        .sort()
        .slice(-7)
        .map((key) => {
          const d = new Date(key);
          return {
            day: dayNames[d.getDay()],
            present: dayMap[key].present,
            absent: dayMap[key].absent,
            rate:
              dayMap[key].total > 0
                ? Math.round((dayMap[key].present / dayMap[key].total) * 100)
                : 0,
          };
        });

      setAttendanceTrend(attendanceData);

      // ─────────────────────────
      // Subject distribution
      // ─────────────────────────
      const subjectData = subjects.slice(0, 8).map((s, i) => ({
        name: s.name || s.subject_name || `Subject ${i + 1}`,
        sections: sections.filter(
          (sec) =>
            sec.subject === s.id ||
            sec.subject_id === s.id ||
            sec.subject_name === s.name
        ).length,
        fill: COLORS[i % COLORS.length],
      }));

      setSubjectDistribution(subjectData);

      // ─────────────────────────
      // Top 10 Best Students per Grade Level
      // ─────────────────────────
      const studentsForPerf = approvedEnrollments.length > 0 ? approvedEnrollments : enrollments;
      const studentsWithScores = studentsForPerf.map((e, i) => {
        const studentName = e.student_name || `${e.first_name || ""} ${e.last_name || ""}`.trim() || `Student ${i + 1}`;
        const gradeLevel = getEnrollmentGrade(e);
        
        // Try to get grades for this student
        const studentGrades = grades.filter(
          (g) => g.student_id === e.id || g.student_name === studentName || g.student === studentName
        );
        
        let performanceScore;
        if (studentGrades.length > 0) {
          // Use actual grades from database
          const gradeValues = studentGrades.map(g => parseFloat(g.grade || g.score || 0)).filter(v => v > 0);
          if (gradeValues.length > 0) {
            performanceScore = Math.round(gradeValues.reduce((a, b) => a + b, 0) / gradeValues.length);
          } else {
            // Fallback to attendance if no valid grades
            const studentAttend = attendRecords.filter(
              (a) => a.student_id === e.id || a.student_name === studentName
            );
            if (studentAttend.length > 0) {
              const presentCount = studentAttend.filter(a => normalizeStatusLower(a.status) === "present").length;
              performanceScore = Math.round((presentCount / studentAttend.length) * 100);
            } else {
              performanceScore = [85, 92, 78, 88, 95, 72, 81, 89, 76, 84][i % 10];
            }
          }
        } else {
          // If no grades, calculate from attendance
          const studentAttend = attendRecords.filter(
            (a) => a.student_id === e.id || a.student_name === studentName
          );
          if (studentAttend.length > 0) {
            const presentCount = studentAttend.filter(a => normalizeStatusLower(a.status) === "present").length;
            performanceScore = Math.round((presentCount / studentAttend.length) * 100);
          } else {
            performanceScore = [85, 92, 78, 88, 95, 72, 81, 89, 76, 84][i % 10] || Math.round(Math.random() * 40 + 60);
          }
        }
        
        return {
          id: e.id,
          studentName,
          gradeLevel: normalizeGradeLabel(gradeLevel),
          performanceScore,
          status: performanceScore >= 80 ? "Excellent" : performanceScore >= 70 ? "Good" : performanceScore >= 60 ? "Fair" : "Needs Improvement",
        };
      });

      // Sort by grade level, then by performance score (descending)
      const topStudents = studentsWithScores.sort((a, b) => {
        const aGradeIdx = gradeOrder.indexOf(a.gradeLevel);
        const bGradeIdx = gradeOrder.indexOf(b.gradeLevel);
        if (aGradeIdx !== bGradeIdx) return (aGradeIdx === -1 ? 999 : aGradeIdx) - (bGradeIdx === -1 ? 999 : bGradeIdx);
        return b.performanceScore - a.performanceScore; // Descending score
      });

      setPerformanceMetrics(topStudents.length > 0 ? topStudents : [
        { id: 1, studentName: "Sample Student 1", gradeLevel: "Grade 1", performanceScore: 85, status: "Excellent" },
        { id: 2, studentName: "Sample Student 2", gradeLevel: "Grade 1", performanceScore: 72, status: "Good" },
        { id: 3, studentName: "Sample Student 3", gradeLevel: "Grade 2", performanceScore: 58, status: "Needs Improvement" },
      ]);

      // ─────────────────────────
      // Announcements
      // ─────────────────────────
      setAnnouncements(anns.slice(0, 10));

      // ─────────────────────────
      // Password Reset Requests (pending)
      // ─────────────────────────
      const pendingResets = passwordResetList
        .filter((r) => {
          const status = normalizeStatusUpper(r.status);
          return status === "PENDING" || status === "LINK_SENT";
        })
        .slice(0, 5)
        .map((r) => ({
          id: r.id,
          email: r.email || "Unknown",
          status: normalizeStatusUpper(r.status),
          requestedAt: r.requested_at || "",
          message: r.message || "",
          userName: r.user_name || "Unknown User",
        }));

      setPasswordResetRequests(pendingResets);

      // ─────────────────────────
      // Attendance for Today (students list)
      // ─────────────────────────
      const attendanceTodayData = todayRecords.slice(0, 10).map((r) => ({
        id: r.id,
        studentName: r.student_name || r.name || "Unknown Student",
        status: normalizeStatusLower(r.status),
        time: r.time_marked || r.created_at || "",
        grade: r.grade || r.section || "N/A",
      }));

      setAttendanceToday(attendanceTodayData);

      // ─────────────────────────
      // Pending applications list
      // ─────────────────────────
      const pendingAppsList = pendingEnrollments.map((e) => ({
        id: e.id,
        studentNumber: e.student_number || e.id,
        studentName: e.student_name || `${e.first_name || ""} ${e.last_name || ""}`.trim() || e.student || "Unknown Student",
        firstName: e.first_name,
        lastName: e.last_name,
        grade: getEnrollmentGrade(e),
        appliedDate: e.created_at || e.date_applied || "",
      }));
      
      setPendingApplications(pendingAppsList);
    } catch (err) {
      console.error("Dashboard load error:", err);
      addToast("Load Error", err.message || "Failed to load dashboard data.", "error");
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (val) => `₱${Number(val || 0).toLocaleString()}`;

  const filteredPerformanceMetrics = useMemo(
    () => {
      // Sort by performance score descending
      const sorted = [...performanceMetrics].sort(
        (a, b) => Number(b.performanceScore) - Number(a.performanceScore)
      );

      // If "All Grades" selected or not set yet, limit to 2 per grade level
      if (!selectedGradeLevel || selectedGradeLevel === "All") {
        const gradeLevelMap = {};
        const result = [];

        sorted.forEach((student) => {
          const grade = student.gradeLevel || "Unassigned";
          if (!gradeLevelMap[grade]) {
            gradeLevelMap[grade] = 0;
          }
          if (gradeLevelMap[grade] < 2) {
            result.push(student);
            gradeLevelMap[grade]++;
          }
        });

        return result;
      } else {
        // For specific grade, return top performers from that grade
        return sorted.filter((student) => student.gradeLevel === selectedGradeLevel);
      }
    },
    [performanceMetrics, selectedGradeLevel]
  );

  const analysisSections = useMemo(() => {
    const latestRevenue = revenueMonthly[revenueMonthly.length - 1];
    const previousRevenue = revenueMonthly[revenueMonthly.length - 2];

    const revenueDeltaPct =
      latestRevenue && previousRevenue && Number(previousRevenue.revenue) > 0
        ? ((latestRevenue.revenue - previousRevenue.revenue) /
            previousRevenue.revenue) *
          100
        : null;

    const paidCount = paymentBreakdown.find((item) => item.name === "Paid")?.value || 0;
    const pendingCount =
      paymentBreakdown.find((item) => item.name === "Pending")?.value || 0;
    const overdueCount =
      paymentBreakdown.find((item) => item.name === "Overdue")?.value || 0;

    const receivablesTotal = paidCount + pendingCount + overdueCount;
    const receivableRiskPct =
      receivablesTotal > 0
        ? Math.round(((pendingCount + overdueCount) / receivablesTotal) * 100)
        : null;

    const atRiskStudents = performanceMetrics.filter(
      (student) => Number(student.performanceScore) < 70
    ).length;

    const highPerformers = performanceMetrics.filter(
      (student) => Number(student.performanceScore) >= 80
    ).length;

    const enrollmentDescriptive =
      `A total of ${stats.totalStudents} students are currently enrolled. ` +
      `${stats.pendingEnrollments} pending application${stats.pendingEnrollments === 1 ? "" : "s"} ` +
      `are currently recorded in the system.`;

    const financeDescriptive =
      `The total amount collected is ${formatCurrency(stats.totalRevenue)}. ` +
      `The most recent monthly revenue recorded is ${formatCurrency(latestRevenue?.revenue || 0)}. ` +
      `There ${stats.overduePayments === 1 ? "is" : "are"} ${stats.overduePayments} overdue payment${stats.overduePayments === 1 ? "" : "s"}.`;

    const attendanceDescriptive =
      `The attendance rate for the current day is ${stats.todayAttendanceRate}%, ` +
      `with ${stats.todayPresent} out of ${stats.todayTotal} students present. ` +
      `The overall attendance rate is ${stats.attendanceRate}%.`;

    const performanceDescriptive =
      `A total of ${highPerformers} students are currently classified under the high-performance band. ` +
      `${atRiskStudents} students have recorded scores below 70.`;

    const riskDescriptive =
      receivableRiskPct === null
        ? "Financial risk exposure cannot be computed because there are no payment records yet."
        : `Financial risk exposure accounts for ${receivableRiskPct}% of all payment records.`;

    const financeInterpretation =
      revenueDeltaPct === null
        ? `The available finance data confirms total collections of ${formatCurrency(stats.totalRevenue)} and no month-over-month comparison yet due to limited trend points.`
        : `Total collections have reached ${formatCurrency(stats.totalRevenue)}. The most recent monthly revenue of ${formatCurrency(latestRevenue?.revenue || 0)} is ${Math.abs(revenueDeltaPct).toFixed(1)}% ${revenueDeltaPct >= 0 ? "higher" : "lower"} than the previous month, while overdue payments remain at ${stats.overduePayments}.`;

    const attendanceInterpretation =
      `The current attendance rate of ${stats.todayAttendanceRate}% compared with the overall rate of ${stats.attendanceRate}% ` +
      `${stats.todayAttendanceRate < stats.attendanceRate
        ? "indicates lower student presence for the day relative to the broader pattern."
        : stats.todayAttendanceRate > stats.attendanceRate
        ? "indicates higher student presence for the day relative to the broader pattern."
        : "indicates the day is aligned with the broader attendance pattern."}`;

    const performanceInterpretation =
      `With ${highPerformers} students in the high-performance band and ${atRiskStudents} students below 70, ` +
      `the data reflects a strong-performing group alongside a smaller segment that may require targeted support.`;

    const riskInterpretation =
      receivableRiskPct === null
        ? "Financial risk interpretation is currently unavailable due to missing payment records."
        : `A financial risk exposure of ${receivableRiskPct}% indicates that a substantial share of payment records is currently in pending or overdue status, which can affect revenue predictability.`;

    return [
      {
        key: "descriptive",
        title: "Descriptive Analysis",
        subtitle: "What is happening in the current dataset.",
        items: [
          { title: "Enrollment Data", body: enrollmentDescriptive },
          { title: "Financial Data", body: financeDescriptive },
          { title: "Attendance Data", body: attendanceDescriptive },
          { title: "Performance Data", body: performanceDescriptive },
          { title: "Financial Risk Data", body: riskDescriptive },
        ],
      },
      {
        key: "interpretation",
        title: "Interpretation of Results",
        subtitle: "What the current patterns indicate.",
        items: [
          {
            title: "Enrollment Interpretation",
            body: `The presence of ${stats.pendingEnrollments} pending application${stats.pendingEnrollments === 1 ? "" : "s"} alongside ${stats.totalStudents} enrolled students suggests continuous admission activity that requires timely processing.`,
          },
          { title: "Financial Interpretation", body: financeInterpretation },
          { title: "Attendance Interpretation", body: attendanceInterpretation },
          { title: "Performance Interpretation", body: performanceInterpretation },
          { title: "Financial Risk Interpretation", body: riskInterpretation },
        ],
      },
      {
        key: "recommendations",
        title: "Recommendations",
        subtitle: "What actions can be prioritized next.",
        items: [
          {
            title: "Admissions Workflow",
            body: "Set daily processing targets for pending applications and monitor turnaround time to keep enrollment flow consistent.",
          },
          {
            title: "Revenue Monitoring",
            body: "Track month-over-month revenue movement in a weekly finance review to quickly identify trend shifts and follow-up actions.",
          },
          {
            title: "Attendance Follow-up",
            body: "Trigger adviser follow-ups when daily attendance falls below the overall baseline and track recurring absence patterns by section.",
          },
          {
            title: "Academic Support",
            body: "Create an intervention list for students below 70 and pair it with periodic progress checks while sustaining enrichment for high performers.",
          },
          {
            title: "Financial Risk Reduction",
            body: "Prioritize outreach for pending and overdue accounts before due dates to reduce risk exposure and improve payment predictability.",
          },
        ],
      },
    ];
  }, [
    revenueMonthly,
    paymentBreakdown,
    performanceMetrics,
    stats.pendingEnrollments,
    stats.totalStudents,
    stats.totalRevenue,
    stats.overduePayments,
    stats.todayAttendanceRate,
    stats.todayPresent,
    stats.todayTotal,
    stats.attendanceRate,
  ]);



    const getPerformanceColorSet = (id, idx = 0) => {
    const colors = [
      { fill: "#ff6b6b", soft: "rgba(255, 107, 107, 0.18)", border: "rgba(255, 107, 107, 0.38)" },
      { fill: "#8b5cf6", soft: "rgba(139, 92, 246, 0.18)", border: "rgba(139, 92, 246, 0.38)" },
      { fill: "#3b82f6", soft: "rgba(59, 130, 246, 0.18)", border: "rgba(59, 130, 246, 0.38)" },
      { fill: "#06b6d4", soft: "rgba(6, 182, 212, 0.18)", border: "rgba(6, 182, 212, 0.38)" },
      { fill: "#10b981", soft: "rgba(16, 185, 129, 0.18)", border: "rgba(16, 185, 129, 0.38)" },
      { fill: "#f59e0b", soft: "rgba(245, 158, 11, 0.18)", border: "rgba(245, 158, 11, 0.38)" },
      { fill: "#ec4899", soft: "rgba(236, 72, 153, 0.18)", border: "rgba(236, 72, 153, 0.38)" },
      { fill: "#14b8a6", soft: "rgba(20, 184, 166, 0.18)", border: "rgba(20, 184, 166, 0.38)" },
      { fill: "#f97316", soft: "rgba(249, 115, 22, 0.18)", border: "rgba(249, 115, 22, 0.38)" },
      { fill: "#6366f1", soft: "rgba(99, 102, 241, 0.18)", border: "rgba(99, 102, 241, 0.38)" },
    ];

    const source = String(id ?? `student-${idx}`);
    const seed = source.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return colors[seed % colors.length];
  };

  const getScoreWidth = (score) => {
    const safe = Math.max(0, Math.min(100, Number(score) || 0));
    return `${safe}%`;
  };
    if (loading) {
      return (
        <main className="dashboard-main">
          <section className="dash-stat-grid">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="dash-skeleton-card">
                <div className="dash-skeleton-icon shimmer" />
                <div className="dash-skeleton-copy">
                  <div className="dash-skeleton-line dash-skeleton-line--lg shimmer" />
                  <div className="dash-skeleton-line dash-skeleton-line--sm shimmer" />
                  <div className="dash-skeleton-line dash-skeleton-line--xs shimmer" />
                </div>
              </div>
            ))}
          </section>

          <section className="dash-row dash-row--3col">
            <div className="dash-card dash-card--list">
              <div className="dash-card-head">
                <ClipboardCheck size={16} />
                <h3 className="dash-card-title" style={{ fontSize: "13px" }}>Top Students by Performance</h3>
              </div>

              <div className="dash-performance-list">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="dash-performance-skeleton shimmer" />
                ))}
              </div>
            </div>

            <div className="dash-card">
              <div className="dash-chart-skeleton shimmer" />
            </div>

            <div className="dash-card">
              <div className="dash-chart-skeleton shimmer" />
            </div>
          </section>
        </main>
      );
    }

  return (
    <main className="dashboard-main">
      <section className="dash-stat-grid">
        <div className="dash-stat-md dash-stat-md--blue">
          <div className="dash-stat-icon dash-stat-icon--blue">
            <Users size={22} />
          </div>
          <div className="dash-stat-info">
            <span className="dash-stat-value">{stats.totalStudents}</span>
            <span className="dash-stat-label">Total of Enrolled Students</span>
            <span className="dash-stat-insight">
              {stats.totalStudents === 0 ? 'No enrollments yet' : stats.totalStudents < 30 ? 'Growing enrollment' : stats.totalStudents < 100 ? 'Strong enrollment trend' : 'Excellent - Large class'}
            </span>
          </div>
        </div>

        <div className="dash-stat-md dash-stat-md--green">
          <div className="dash-stat-icon dash-stat-icon--green">
            <Wallet size={22} />
          </div>
          <div className="dash-stat-info">
            <span className="dash-stat-value">
              {formatCurrency(stats.totalRevenue)}
            </span>
            <span className="dash-stat-label">Total Collected</span>
            <span className="dash-stat-insight">
              {stats.totalRevenue === 0 ? 'No payments collected' : stats.totalRevenue < 50000 ? 'Building revenue stream' : stats.totalRevenue < 500000 ? 'Good revenue collection' : 'Excellent revenue! ✓'}
            </span>
          </div>
        </div>

        <div className="dash-stat-md dash-stat-md--teal">
          <div className="dash-stat-icon dash-stat-icon--teal">
            <AlertCircle size={22} />
          </div>
          <div className="dash-stat-info">
            <span className="dash-stat-value">{stats.overduePayments}</span>
            <span className="dash-stat-label">Overdue Payments</span>
            <span className="dash-stat-insight">
              {stats.overduePayments === 0 ? 'All payments current ✓' : stats.overduePayments < 5 ? 'Few overdue - Monitor' : stats.overduePayments < 15 ? 'Review needed!' : 'Critical - Act now!'}
            </span>
          </div>
        </div>

        <div className="dash-stat-md dash-stat-md--amber">
          <div className="dash-stat-icon dash-stat-icon--amber">
            <Clock size={22} />
          </div>
          <div className="dash-stat-info">
            <span className="dash-stat-value">{stats.pendingEnrollments}</span>
            <span className="dash-stat-label">Pending Applications</span>
            <span className="dash-stat-insight">
              {stats.pendingEnrollments === 0 ? 'All processed ✓' : stats.pendingEnrollments < 5 ? 'Light workflow' : stats.pendingEnrollments < 20 ? 'Review needed!' : 'High volume - Process now!'}
            </span>
          </div>
        </div>
      </section>

      <section className="dash-insights">
        <div className="dash-insights-head">
          <h3 className="dash-insights-title">Dashboard Analysis</h3>
          <p className="dash-insights-sub">
            Structured view of what is happening, what it means, and what can be
            prioritized next across enrollment, finance, attendance, and performance.
          </p>
        </div>

        <div className="dash-analysis-accordion">
          {analysisSections.map((section) => {
            const isOpen = expandedAnalysisSection === section.key;

            return (
              <div key={section.key} className="dash-analysis-section">
                <button
                  type="button"
                  className={`dash-analysis-header ${isOpen ? "is-open" : ""}`}
                  onClick={() => setExpandedAnalysisSection(isOpen ? "" : section.key)}
                  aria-expanded={isOpen}
                >
                  <div className="dash-analysis-header-content">
                    <h4 className="dash-insight-title">{section.title}</h4>
                    <p className="dash-insights-sub">{section.subtitle}</p>
                  </div>
                  <ChevronDown size={20} className={`dash-analysis-header-chevron ${isOpen ? "is-open" : ""}`} />
                </button>

                {isOpen && (
                  <div className="dash-analysis-body">
                    <div className="dash-analysis-items">
                      {section.items.map((item) => (
                        <div key={item.title} className="dash-analysis-detail-item">
                          <h5 className="dash-analysis-detail-title">{item.title}</h5>
                          <p className="dash-insight-text">{item.body}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="dash-row dash-row--2col">
        <div className="dash-card">
          <h3 className="dash-card-title">Students per Grade Level</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={enrollmentByLevel}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="level" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "none",
                  boxShadow: "0 4px 12px rgba(0,0,0,.1)",
                }}
              />
              <Bar
                dataKey="students"
                fill="url(#barGradient)"
                radius={[6, 6, 0, 0]}
              />
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#a78bfa" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
          <div 
            className="chart-insight" 
            style={{ color: getChartInsightColor(generateEnrollmentInsight(enrollmentByLevel)) }}
          >
            {generateEnrollmentInsight(enrollmentByLevel)}
          </div>
        </div>

        <div className="dash-card">
          <h3 className="dash-card-title">Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={revenueMonthly}>
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(v) => formatCurrency(v)}
                contentStyle={{
                  borderRadius: 8,
                  border: "none",
                  boxShadow: "0 4px 12px rgba(0,0,0,.1)",
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#10b981"
                strokeWidth={2.5}
                fill="url(#areaGradient)"
              />
              {detectRevenueDips(revenueMonthly).map((dip, idx) => (
                <ReferenceDot
                  key={`dip-${idx}`}
                  x={dip.label}
                  y={dip.value}
                  r={6}
                  fill="#ef4444"
                  stroke="#fff"
                  strokeWidth={2}
                  title={`Dip: ${dip.percentDrop}% drop`}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
          <div 
            className="chart-insight" 
            style={{ color: getChartInsightColor(generateRevenueInsight(revenueMonthly)) }}
          >
            {generateRevenueInsight(revenueMonthly)}
          </div>
        </div>
      </section>

      <section className="dash-row dash-row--3col">
        <div className="dash-card dash-card--list">
          <div className="dash-card-head">
            <ClipboardCheck size={16} />
            <h3 className="dash-card-title">Top Students by Performance</h3>
           <select
            value={selectedGradeLevel}
            onChange={(e) => setSelectedGradeLevel(e.target.value)}
            style={{
              padding: "5px 10px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              fontSize: "12px",
              fontWeight: 600,
              backgroundColor: "#fff",
              cursor: "pointer",
              marginLeft: "auto",
              height: "32px"
            }}
          >
              <option value="All">All Grades</option>
              <option value="Pre-Kinder">Pre-Kinder</option>
              <option value="Kinder">Kinder</option>
              <option value="Grade 1">Grade 1</option>
              <option value="Grade 2">Grade 2</option>
              <option value="Grade 3">Grade 3</option>
              <option value="Grade 4">Grade 4</option>
              <option value="Grade 5">Grade 5</option>
              <option value="Grade 6">Grade 6</option>
            </select>
          </div>
          {filteredPerformanceMetrics.length === 0 && (
            <div className="dash-empty-state">
              <CheckCircle size={24} className="dash-empty-icon" />
              <p className="dash-empty">No student data available</p>
              <span className="dash-empty-sub">Student performance data will appear here once enrollment data is available</span>
            </div>
          )}
          {filteredPerformanceMetrics.length > 0 && (
              <div className="dash-performance-list">
                {filteredPerformanceMetrics.slice(0, 10).map((student, idx) => {
                  const rank = idx + 1;
                  const colorSet = getPerformanceColorSet(student.id, idx);
                  const scorePercent = Number(student.performanceScore) || 0;
                  const isTopOne = rank === 1;

                  return (
                    <div
                      key={student.id || idx}
                      className={`dash-performance-item ${isTopOne ? "is-top" : ""}`}
                      title={`${student.studentName} - ${student.gradeLevel}`}
                    >
                      <div
                        className="dash-performance-track"
                        style={{
                          "--perf-fill": colorSet.fill,
                          "--perf-soft": colorSet.soft,
                          "--perf-border": colorSet.border,
                          "--perf-width": getScoreWidth(scorePercent),
                        }}
                      >
                        <div className="dash-performance-fill" />

                        <div className="dash-performance-content">
                          <div className="dash-performance-left">
                            <div className="dash-performance-rank-wrap">
                              {isTopOne && (
                                <span className="dash-performance-crown">
                                  <Crown size={13} />
                                </span>
                              )}
                              <span className="dash-performance-rank">{rank}</span>
                            </div>

                            <div className="dash-performance-text">
                              <span className="dash-performance-name">
                                {student.studentName}
                              </span>
                              <span className="dash-performance-grade">
                                {student.gradeLevel}
                              </span>
                            </div>
                          </div>

                          <div className="dash-performance-right">
                            <span className="dash-performance-score">
                              {scorePercent}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>

        <div className="dash-card dash-card--center">
          <h3 className="dash-card-title">Payment Status</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={paymentBreakdown}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={4}
                dataKey="value"
                label={({ name, percent }) =>
                  `${name} ${((percent || 0) * 100).toFixed(0)}%`
                }
              >
                {paymentBreakdown.map((_, i) => (
                  <Cell
                    key={i}
                    fill={PAYMENT_COLORS[i % PAYMENT_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "none",
                  boxShadow: "0 4px 12px rgba(0,0,0,.1)",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div 
            className="chart-insight" 
            style={{ color: getChartInsightColor(generatePaymentInsight(paymentBreakdown)) }}
          >
            {generatePaymentInsight(paymentBreakdown)}
          </div>
        </div>

        <div className="dash-card dash-card--list">
          <div className="dash-card-head">
            <Clock size={16} />
            <h3 className="dash-card-title">Pending Applications ({stats.pendingEnrollments})</h3>
          </div>
          {pendingApplications.length === 0 && (
            <div className="dash-empty-state">
              <CheckCircle size={24} className="dash-empty-icon" />
              <p className="dash-empty">No pending applications</p>
              <span className="dash-empty-sub">All applications have been processed</span>
            </div>
          )}
          {pendingApplications.length > 0 && (
            <div className="dash-pending-list">
              {pendingApplications.map((app) => (
                <div
                  key={app.id}
                  className="dash-pending-item"
                  onClick={() => onNavigateToEnrollment && onNavigateToEnrollment()}
                  style={{ cursor: "pointer" }}
                  title="Click to view application details"
                >
                  <div className="dash-pending-left">
                    <div className="dash-pending-badge">
                      <Clock size={14} />
                    </div>
                    <div className="dash-list-content">
                      <span className="dash-list-title">{app.studentName}</span>
                      <span className="dash-list-sub">Grade: {app.grade}</span>
                    </div>
                  </div>
                  <div className="dash-pending-right">
                    <span className="dash-pending-date">
                      {app.appliedDate ? new Date(app.appliedDate).toLocaleDateString() : "N/A"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="dash-row dash-row--2col">
        <div className="dash-card dash-card--list">
          <div className="dash-card-head">
            <Bell size={16} />
            <h3 className="dash-card-title">Announcements & Updates</h3>
          </div>
          {announcements.length === 0 && (
            <div className="dash-empty-state">
              <Bell size={24} className="dash-empty-icon" />
              <p className="dash-empty">No announcements yet</p>
              <span className="dash-empty-sub">Create announcements in the CMS module to display them here</span>
            </div>
          )}
          {announcements.map((a) => (
            <div key={a.id} className="dash-announcement-item">
              <div
                className="dash-announcement-header"
                onClick={() => toggleAnnouncementExpand(a.id)}
              >
                <div className="dash-announcement-header-left">
                  <div className="dash-list-dot" />
                  <div className="dash-list-content">
                    <span className="dash-list-title">{a.title}</span>
                    <span className="dash-list-sub">
                      {a.created_at
                        ? new Date(a.created_at).toLocaleDateString()
                        : ""}
                    </span>
                  </div>
                </div>
                <div className="dash-announcement-actions">
                  <button
                    className="dash-announcement-btn dash-announcement-btn--view"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveAnnouncement(a);
                    }}
                    title="View full announcement"
                  >
                    View
                  </button>
                  <ChevronDown
                    size={18}
                    className={`dash-announcement-toggle ${
                      expandedAnnouncements.has(a.id) ? "expanded" : ""
                    }`}
                    title="Click to expand announcement"
                  />
                </div>
              </div>
              {expandedAnnouncements.has(a.id) && (
                <div className="dash-announcement-content">
                  <p>{a.content || "No content provided."}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="dash-card dash-card--list">
          <div className="dash-card-head">
            <Key size={16} />
            <h3 className="dash-card-title">Password Reset Requests</h3>
          </div>
          {passwordResetRequests.length === 0 && (
            <div className="dash-empty-state">
              <Key size={24} className="dash-empty-icon" />
              <p className="dash-empty">No pending reset requests</p>
              <span className="dash-empty-sub">Users can request password resets from their account settings</span>
            </div>
          )}
          {passwordResetRequests.map((req, i) => (
            <div key={i} className="dash-list-item">
              <span className="dash-sched-time">
                {req.status || "PENDING"}
              </span>
              <div className="dash-list-content">
                <span className="dash-list-title">
                  {req.userName}
                </span>
                <span className="dash-list-sub">
                  {req.email}
                </span>
              </div>
              <button
                className="dash-send-btn"
                onClick={() => handleSendResetLink(req.id)}
                disabled={sendingResetId === req.id}
                title="Send reset link"
              >
                <Send size={16} />
                {sendingResetId === req.id ? "Sending..." : "Send"}
              </button>
            </div>
          ))}
        </div>
      </section>
      {/* Announcement Detail Modal */}
      {activeAnnouncement && (
        <div 
          className="dash-modal-overlay" 
          onClick={() => setActiveAnnouncement(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setActiveAnnouncement(null);
          }}
        >
          <div 
            className="dash-modal-content" 
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="dash-modal-close"
              onClick={() => setActiveAnnouncement(null)}
              title="Close announcement"
            >
              ✕
            </button>

            {(() => {
              const firstMedia = getFirstMedia(activeAnnouncement);
              const firstUrl = toAbsUrl(firstMedia?.file_url || firstMedia?.file);
              const isVideo = firstUrl && /\.(mp4|webm|ogg|mov)$/i.test(firstUrl);
              const imgUrl = toAbsUrl(getFirstImagePath(activeAnnouncement));

              return (
                <>
                  {firstUrl && isVideo ? (
                    <video 
                      src={firstUrl} 
                      controls 
                      className="dash-modal-media"
                    />
                  ) : (
                    imgUrl && <img 
                      src={imgUrl} 
                      alt="" 
                      className="dash-modal-media"
                    />
                  )}
                </>
              );
            })()}

            <h2 className="dash-modal-title">
              {activeAnnouncement.title || "Untitled"}
            </h2>

            <div className="dash-modal-meta">
              {activeAnnouncement.created_at
                ? new Date(activeAnnouncement.created_at).toLocaleString()
                : ""}
            </div>

            <p className="dash-modal-text">
              {activeAnnouncement.content || "No content provided."}
            </p>
          </div>
        </div>
      )}
      <Toast toasts={toasts} dismissToast={dismissToast} />
    </main>
  );
};

export default Dashboard;