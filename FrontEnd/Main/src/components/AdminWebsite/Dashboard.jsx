import React, { useEffect, useState } from "react";
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
} from "recharts";
import {
  Users,
  Calendar,
  DollarSign,
  Bell,
  ClipboardCheck,
  Clock,
  ChevronDown,
  User,
  CheckCircle,
  XCircle,
  AlertCircle,
  Key,
} from "lucide-react";
import { apiFetch } from "../api/apiFetch";
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
  const [attendanceToday, setAttendanceToday] = useState([]);
  const [subjectDistribution, setSubjectDistribution] = useState([]);
  const [pendingApplications, setPendingApplications] = useState([]);

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

  const getEnrollmentGrade = (e) => {
    return (
      e.grade_level_label ||
      e.grade_level_display ||
      e.grade_level_name ||
      e.grade_level ||
      e.level ||
      e.student_grade_level ||
      "Unknown"
    );
  };

  const getTransactionStatus = (t) =>
    String(t.status || "").trim().toUpperCase();

  const getTransactionDate = (t) => t.date_created || t.due_date || null;

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
        ]);

      const enrollments = safeArray(enrollRes);
      const transactions = safeArray(financeRes);
      const attendRecords = safeArray(attendRes);
      const passwordResetList = safeArray(passwordResetRes);
      const anns = safeArray(annRes);
      const subjects = safeArray(subjectRes);
      const sections = safeArray(sectionRes);

      // ─────────────────────────
      // Enrollment stats
      // keep old working behavior
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
        (sum, t) => sum + parseAmount(t.amount),
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
          userName: r.user?.username || r.user?.first_name || "Unknown User",
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
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (val) => `₱${Number(val || 0).toLocaleString()}`;

  if (loading) {
    return (
      <main className="dashboard-main">
        <div className="dash-loading">
          <div className="dash-spinner" />
          <p>Loading dashboard...</p>
        </div>
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
          </div>
        </div>

        <div className="dash-stat-md dash-stat-md--green">
          <div className="dash-stat-icon dash-stat-icon--green">
            <DollarSign size={22} />
          </div>
          <div className="dash-stat-info">
            <span className="dash-stat-value">
              {formatCurrency(stats.totalRevenue)}
            </span>
            <span className="dash-stat-label">Total Collected</span>
          </div>
        </div>

        <div className="dash-stat-md dash-stat-md--teal">
          <div className="dash-stat-icon dash-stat-icon--teal">
            <AlertCircle size={22} />
          </div>
          <div className="dash-stat-info">
            <span className="dash-stat-value">{stats.overduePayments}</span>
            <span className="dash-stat-label">Overdue Payments</span>
          </div>
        </div>

        <div className="dash-stat-md dash-stat-md--amber">
          <div className="dash-stat-icon dash-stat-icon--amber">
            <Clock size={22} />
          </div>
          <div className="dash-stat-info">
            <span className="dash-stat-value">{stats.pendingEnrollments}</span>
            <span className="dash-stat-label">Pending Applications</span>
          </div>
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
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="dash-row dash-row--3col">
        <div className="dash-card">
          <h3 className="dash-card-title">Weekly Attendance</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={attendanceTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "none",
                  boxShadow: "0 4px 12px rgba(0,0,0,.1)",
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="present"
                stroke="#6366f1"
                strokeWidth={2.5}
                dot={{ r: 4 }}
                name="Present"
              />
              <Line
                type="monotone"
                dataKey="absent"
                stroke="#f87171"
                strokeWidth={2.5}
                dot={{ r: 4 }}
                name="Absent"
              />
            </LineChart>
          </ResponsiveContainer>
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
                  {req.userName || "User"}
                </span>
                <span className="dash-list-sub">
                  {req.email}
                </span>
              </div>
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
      )}    </main>
  );
};

export default Dashboard;