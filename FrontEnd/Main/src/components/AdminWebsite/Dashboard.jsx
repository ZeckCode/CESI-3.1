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

const Dashboard = () => {
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
  });

  const [enrollmentByLevel, setEnrollmentByLevel] = useState([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState([]);
  const [revenueMonthly, setRevenueMonthly] = useState([]);
  const [attendanceTrend, setAttendanceTrend] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [scheduleToday, setScheduleToday] = useState([]);
  const [subjectDistribution, setSubjectDistribution] = useState([]);

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

  async function loadDashboardData() {
    setLoading(true);

    try {
      const [
        enrollRes,
        financeRes,
        financeStatsRes,
        attendRes,
        schedRes,
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

        apiFetch("/api/classmanagement/schedules/")
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
      const schedules = safeArray(schedRes);
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

      const overdue = transactions.filter(
        (t) => getTransactionStatus(t) === "OVERDUE"
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
      setAnnouncements(anns.slice(0, 5));

      // ─────────────────────────
      // Today's schedule
      // ─────────────────────────
      const dayNameToday = new Date().toLocaleDateString("en-US", {
        weekday: "long",
      });

      const shortDayMap = {
        Monday: "MON",
        Tuesday: "TUE",
        Wednesday: "WED",
        Thursday: "THU",
        Friday: "FRI",
        Saturday: "SAT",
        Sunday: "SUN",
      };

      const shortToday = shortDayMap[dayNameToday];

      const todaySched = schedules
        .filter((s) => {
          const days = s.days || s.day || s.schedule_day || "";
          if (Array.isArray(days)) {
            return days.includes(dayNameToday) || days.includes(shortToday);
          }
          const text = String(days).toUpperCase();
          return (
            text.includes(dayNameToday.toUpperCase()) ||
            text.includes(shortToday)
          );
        })
        .slice(0, 5);

      setScheduleToday(todaySched);
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
            <span className="dash-stat-label">Total Students</span>
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
            <span className="dash-stat-label">Total Revenue</span>
          </div>
        </div>

        <div className="dash-stat-md dash-stat-md--teal">
          <div className="dash-stat-icon dash-stat-icon--teal">
            <ClipboardCheck size={22} />
          </div>
          <div className="dash-stat-info">
            <span className="dash-stat-value">{stats.attendanceRate}%</span>
            <span className="dash-stat-label">Attendance Rate</span>
          </div>
        </div>

        <div className="dash-stat-md dash-stat-md--amber">
          <div className="dash-stat-icon dash-stat-icon--amber">
            <Clock size={22} />
          </div>
          <div className="dash-stat-info">
            <span className="dash-stat-value">{stats.pendingEnrollments}</span>
            <span className="dash-stat-label">Pending Enrollments</span>
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

        <div className="dash-card dash-card--center">
          <h3 className="dash-card-title">Attendance for Today</h3>
          <ResponsiveContainer width="100%" height={260}>
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="60%"
              outerRadius="90%"
              barSize={18}
              data={[
                {
                  name: "Today",
                  value: stats.todayAttendanceRate,
                  fill: "#6366f1",
                },
              ]}
              startAngle={210}
              endAngle={-30}
            >
              <RadialBar
                dataKey="value"
                cornerRadius={10}
                background={{ fill: "#f3f4f6" }}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="dash-gauge-label">{stats.todayAttendanceRate}%</div>
          <div className="dash-gauge-sub">
            {stats.todayPresent} / {stats.todayTotal} present
          </div>
        </div>
      </section>

      <section className="dash-row dash-row--2col">
        <div className="dash-card dash-card--list">
          <div className="dash-card-head">
            <Bell size={16} />
            <h3 className="dash-card-title">Announcements</h3>
          </div>
          {announcements.length === 0 && (
            <p className="dash-empty">No announcements yet.</p>
          )}
          {announcements.map((a) => (
            <div key={a.id} className="dash-list-item">
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
          ))}
        </div>

        <div className="dash-card dash-card--list">
          <div className="dash-card-head">
            <Calendar size={16} />
            <h3 className="dash-card-title">Today's Schedule</h3>
          </div>
          {scheduleToday.length === 0 && (
            <p className="dash-empty">No classes scheduled today.</p>
          )}
          {scheduleToday.map((s, i) => (
            <div key={i} className="dash-list-item">
              <span className="dash-sched-time">
                {s.start_time || s.time_start || "--"}
              </span>
              <div className="dash-list-content">
                <span className="dash-list-title">
                  {s.subject_name || s.section_name || s.title || "Class"}
                </span>
                <span className="dash-list-sub">
                  {s.room_name || s.teacher_name || ""}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
};

export default Dashboard;