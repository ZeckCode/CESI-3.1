import React, { useState, useEffect } from 'react';
import { FileText, Download, Filter, BarChart2, Clock, CheckCircle, FileDown } from 'lucide-react';
import StatCard, { StatsGrid } from './StatCard';
import '../AdminWebsiteCSS/ClassManagement.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { apiFetch } from '../api/apiFetch';

// Helper function for academic year expiry
const getAcademicYearExpiry = (academicYear) => {
  if (!academicYear) return null;
  const parts = String(academicYear).split("-");
  if (parts.length !== 2) return null;
  const endYear = parseInt(parts[1], 10);
  if (isNaN(endYear)) return null;
  return new Date(endYear, 2, 31, 23, 59, 59);
};

const getCurrentAcademicYear = () => {
  const today = new Date();
  const year = today.getFullYear();
  return today.getMonth() >= 5 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
};

const Reports = () => {
  const [reportType, setReportType] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [generatedReports, setGeneratedReports] = useState([]);
  const [currentAcademicYear, setCurrentAcademicYear] = useState('');
  
  // Stats state
  const [enrollmentStats, setEnrollmentStats] = useState({
    total: 0,
    active: 0,
    pending: 0,
    dropped: 0,
    expired: 0
  });
  
  const [transactionStats, setTransactionStats] = useState({
    total_billed: 0,
    total_collected: 0,
    outstanding_balance: 0
  });
  
  const [classStats, setClassStats] = useState({
    total_sections: 0,
    total_students: 0,
    active_sections: 0,
    total_subjects: 0
  });
  
  const [teacherStats, setTeacherStats] = useState({
    total_teachers: 0,
    active_teachers: 0,
    total_subjects: 0,
    total_classes: 0
  });
  
  const [attendanceStats, setAttendanceStats] = useState({
    total_records: 0,
    present: 0,
    absent: 0,
    late: 0,
    excused: 0
  });
  
  const [gradeStats, setGradeStats] = useState({
    total_students: 0,
    graded_students: 0,
    pending_grades: 0,
    average_grade: '—'
  });
  
  const [historyStats, setHistoryStats] = useState({
    totalRecords: 0,
    uniqueStudents: 0,
    schoolYears: 0,
    averageFinal: '—'
  });
  
  const [loading, setLoading] = useState(true);
  
  const now = new Date();

  // -----------------------------
  // FETCH ACADEMIC YEAR
  // -----------------------------
  const fetchAcademicYear = async () => {
    try {
      const res = await apiFetch('/api/enrollment-settings/');
      const data = await res.json();
      setCurrentAcademicYear(data.academic_year || getCurrentAcademicYear());
      console.log('Academic year loaded:', data.academic_year);
    } catch (error) {
      console.error('Error fetching academic year:', error);
      setCurrentAcademicYear(getCurrentAcademicYear());
    }
  };

  // -----------------------------
  // FETCH REAL DATA FROM API
  // -----------------------------
  const fetchEnrollmentStats = async () => {
    try {
      const res = await apiFetch('/api/enrollments/');
      const enrollments = await res.json();
      const list = Array.isArray(enrollments) ? enrollments : [];
      
      const total = list.length;
      const active = list.filter(e => e.status === 'ACTIVE').length;
      const pending = list.filter(e => e.status === 'PENDING').length;
      const dropped = list.filter(e => e.status === 'DROPPED').length;
      const expired = list.filter(e => {
        const expiry = getAcademicYearExpiry(e.academic_year);
        return expiry ? new Date() > expiry : false;
      }).length;
      
      setEnrollmentStats({ total, active, pending, dropped, expired });
    } catch (error) {
      console.error('Error fetching enrollment stats:', error);
    }
  };

  const fetchTransactionStats = async () => {
    try {
      const res = await apiFetch('/api/finance/transactions/stats/');
      const data = await res.json();
      setTransactionStats({
        total_billed: data.total_billed || 0,
        total_collected: data.total_collected || 0,
        outstanding_balance: data.outstanding_balance || 0
      });
    } catch (error) {
      console.error('Error fetching transaction stats:', error);
    }
  };

  const fetchClassStats = async () => {
    try {
      const [sectionsRes, subjectsRes] = await Promise.all([
        apiFetch('/api/accounts/sections/'),
        apiFetch('/api/accounts/subjects/')
      ]);
      
      const sections = await sectionsRes.json();
      const subjects = await subjectsRes.json();
      
      const sectionsList = Array.isArray(sections) ? sections : [];
      const subjectsList = Array.isArray(subjects) ? subjects : [];
      
      const total_students = sectionsList.reduce((sum, s) => sum + (s.student_count || 0), 0);
      const active_sections = sectionsList.filter(s => s.student_count > 0).length;
      
      setClassStats({
        total_sections: sectionsList.length,
        total_students: total_students,
        active_sections: active_sections,
        total_subjects: subjectsList.length
      });
    } catch (error) {
      console.error('Error fetching class stats:', error);
    }
  };

  const fetchTeacherStats = async () => {
    try {
      const res = await apiFetch('/api/accounts/users/?role=TEACHER');
      const teachers = await res.json();
      const teachersList = Array.isArray(teachers) ? teachers : [];
      
      const active_teachers = teachersList.filter(t => t.is_active).length;
      
      setTeacherStats({
        total_teachers: teachersList.length,
        active_teachers: active_teachers,
        total_subjects: 0,
        total_classes: 0
      });
    } catch (error) {
      console.error('Error fetching teacher stats:', error);
    }
  };

  const fetchAttendanceStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await apiFetch(`/api/attendance/records/?date=${today}`);
      const records = await res.json();
      const recordsList = Array.isArray(records) ? records : [];
      
      const present = recordsList.filter(r => r.status === 'PRESENT').length;
      const absent = recordsList.filter(r => r.status === 'ABSENT').length;
      const late = recordsList.filter(r => r.status === 'LATE').length;
      const excused = recordsList.filter(r => r.status === 'EXCUSED').length;
      
      setAttendanceStats({
        total_records: recordsList.length,
        present: present,
        absent: absent,
        late: late,
        excused: excused
      });
    } catch (error) {
      console.error('Error fetching attendance stats:', error);
    }
  };

  const fetchGradeStats = async () => {
    try {
      const res = await apiFetch('/api/grades/admin-monitoring/?quarter=1');
      const data = await res.json();
      const summary = data.summary || {};
      
      setGradeStats({
        total_students: summary.total_students || 0,
        graded_students: summary.graded_students || 0,
        pending_grades: summary.pending_grades || 0,
        average_grade: summary.average_grade || '—'
      });
    } catch (error) {
      console.error('Error fetching grade stats:', error);
    }
  };

  const fetchHistoryStats = async () => {
    try {
      const res = await apiFetch('/api/grades/academic-history/');
      const history = await res.json();
      const historyList = Array.isArray(history) ? history : [];
      
      const finalGrades = historyList
        .map(r => Number(r.final_grade))
        .filter(v => !isNaN(v));
      
      const averageFinal = finalGrades.length
        ? (finalGrades.reduce((sum, v) => sum + v, 0) / finalGrades.length).toFixed(2)
        : '—';
      
      setHistoryStats({
        totalRecords: historyList.length,
        uniqueStudents: new Set(historyList.map(r => r.student)).size,
        schoolYears: new Set(historyList.map(r => r.school_year)).size,
        averageFinal: averageFinal
      });
    } catch (error) {
      console.error('Error fetching history stats:', error);
    }
  };

  // Fetch all stats on mount
  useEffect(() => {
    const fetchAllStats = async () => {
      setLoading(true);
      await Promise.all([
        fetchEnrollmentStats(),
        fetchTransactionStats(),
        fetchClassStats(),
        fetchTeacherStats(),
        fetchAttendanceStats(),
        fetchGradeStats(),
        fetchHistoryStats(),
        fetchAcademicYear()
      ]);
      setLoading(false);
    };
    
    fetchAllStats();
  }, []);

  // -----------------------------
  // PDF EXPORT FUNCTION
  // -----------------------------
  const exportReportToPDF = (report) => {
    const doc = new jsPDF('landscape');
    
    doc.setFontSize(18);
    doc.setTextColor(33, 37, 41);
    doc.text(report.name, 14, 15);
    
    doc.setFontSize(10);
    doc.setTextColor(108, 117, 125);
    const currentDate = new Date().toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    doc.text(`Generated: ${currentDate}`, 14, 22);
    doc.text(`Report Period: ${report.period || 'Current'}`, 14, 29);
    
    let statsData = [];
    let headers = ['Metric', 'Value'];
    
    if (report.type === 'students' || report.type === 'all') {
      const data = report.type === 'students' ? report.data : report.data?.enrollment;
      statsData = [
        ['Total Enrollments', data?.total || 0],
        ['Active/Enrolled', data?.active || 0],
        ['Pending', data?.pending || 0],
        ['Dropped', data?.dropped || 0],
        ['Expired', data?.expired || 0],
      ];
    } 
    else if (report.type === 'financial') {
      const data = report.data;
      statsData = [
        ['Total Billed', `₱${(data?.total_billed || 0).toLocaleString()}`],
        ['Total Collected', `₱${(data?.total_collected || 0).toLocaleString()}`],
        ['Outstanding Balance', `₱${(data?.outstanding_balance || 0).toLocaleString()}`],
        ['Collection Rate', data?.total_billed > 0 
          ? `${Math.round((data?.total_collected / data?.total_billed) * 100)}%` 
          : '—'],
      ];
    } 
    else if (report.type === 'classes') {
      const data = report.data;
      statsData = [
        ['Total Sections', data?.total_sections || 0],
        ['Total Students', data?.total_students || 0],
        ['Active Sections', data?.active_sections || 0],
        ['Subjects Offered', data?.total_subjects || 0],
      ];
    } 
    else if (report.type === 'teachers') {
      const data = report.data;
      statsData = [
        ['Total Teachers', data?.total_teachers || 0],
        ['Active Teachers', data?.active_teachers || 0],
        ['Subjects Assigned', data?.total_subjects || 0],
        ['Classes Handled', data?.total_classes || 0],
      ];
    } 
    else if (report.type === 'attendance') {
      const data = report.data;
      statsData = [
        ['Total Records', data?.total_records || 0],
        ['Present', data?.present || 0],
        ['Absent', data?.absent || 0],
        ['Late', data?.late || 0],
        ['Excused', data?.excused || 0],
      ];
    }
    else if (report.type === 'grades') {
      const data = report.data;
      statsData = [
        ['Total Students', data?.total_students || 0],
        ['Students With Grades', data?.graded_students || 0],
        ['Pending / Partial', data?.pending_grades || 0],
        ['Average Grade', data?.average_grade || '—'],
      ];
    }
    else if (report.type === 'history') {
      const data = report.data;
      statsData = [
        ['Total Records', data?.totalRecords || 0],
        ['Unique Students', data?.uniqueStudents || 0],
        ['School Years', data?.schoolYears || 0],
        ['Average Final Grade', data?.averageFinal || '—'],
      ];
    }
    
    doc.setFontSize(12);
    doc.setTextColor(33, 37, 41);
    doc.text('Report Summary', 14, 38);
    
    autoTable(doc, {
      startY: 43,
      head: [headers],
      body: statsData,
      theme: 'grid',
      headStyles: { fillColor: [79, 110, 247], textColor: 255, fontSize: 10 },
      bodyStyles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 60 }
      }
    });
    
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(108, 117, 125);
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.width - 20,
        doc.internal.pageSize.height - 10
      );
    }
    
    const filename = `${report.name.replace(/\s+/g, '_')}_${report.date}.pdf`;
    doc.save(filename);
  };

  // -----------------------------
  // GET PERIOD LABEL
  // -----------------------------
  const getPeriodLabel = () => {
    if (dateRange === 'month') {
      return `${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`;
    }
    if (dateRange === 'quarter') {
      const quarter = Math.floor(now.getMonth() / 3) + 1;
      return `Q${quarter} ${now.getFullYear()}`;
    }
    if (dateRange === 'year') {
      return `Year ${now.getFullYear()}`;
    }
    if (currentAcademicYear) {
      return `AY ${currentAcademicYear}`;
    }
    return 'All Time';
  };

  // -----------------------------
  // GENERATE REPORT
  // -----------------------------
  const generateReport = () => {
    const today = new Date().toISOString().slice(0, 10);
    const period = getPeriodLabel();

    let data = {};
    let reportName = '';

    switch (reportType) {
      case "students":
        data = enrollmentStats;
        reportName = `Student Enrollment Report - ${period}`;
        break;
      case "financial":
        data = transactionStats;
        reportName = `Financial Summary Report - ${period}`;
        break;
      case "classes":
        data = classStats;
        reportName = `Class Statistics Report - ${period}`;
        break;
      case "teachers":
        data = teacherStats;
        reportName = `Teacher Performance Report - ${period}`;
        break;
      case "attendance":
        data = attendanceStats;
        reportName = `Attendance Summary Report - ${period}`;
        break;
      case "grades":
        data = gradeStats;
        reportName = `Grade Monitoring Report - ${period}`;
        break;
      case "history":
        data = historyStats;
        reportName = `Academic History Report - ${period}`;
        break;
      default:
        data = {
          enrollment: enrollmentStats,
          financial: transactionStats,
          classes: classStats,
          teachers: teacherStats,
          attendance: attendanceStats,
          grades: gradeStats,
          history: historyStats
        };
        reportName = `Comprehensive System Report - ${period}`;
    }

    const newReport = {
      id: Date.now(),
      name: reportName,
      type: reportType,
      date: today,
      period: period,
      format: "PDF",
      data: data
    };

    setGeneratedReports((prev) => [newReport, ...prev]);
    alert("Report generated successfully! Click Download to view PDF.");
  };

  // -----------------------------
  // MONTHLY AUTO REPORT
  // -----------------------------
  useEffect(() => {
    const now = new Date();
    const lastGenerated = localStorage.getItem("lastMonthlyReport");

    if (!lastGenerated) {
      generateMonthlyReport();
      localStorage.setItem("lastMonthlyReport", now.toISOString());
    } else {
      const lastDate = new Date(lastGenerated);

      if (
        lastDate.getMonth() !== now.getMonth() ||
        lastDate.getFullYear() !== now.getFullYear()
      ) {
        generateMonthlyReport();
        localStorage.setItem("lastMonthlyReport", now.toISOString());
      }
    }
  }, [enrollmentStats, transactionStats, classStats, teacherStats, attendanceStats, gradeStats, historyStats, currentAcademicYear]);

  const generateMonthlyReport = () => {
    const today = new Date().toISOString().slice(0, 10);
    const monthName = now.toLocaleString('default', { month: 'long' });

    const monthlyReport = {
      id: Date.now(),
      name: `Monthly System Report - ${monthName} ${now.getFullYear()} (AY ${currentAcademicYear})`,
      type: "all",
      date: today,
      period: `${monthName} ${now.getFullYear()} - AY ${currentAcademicYear}`,
      format: "PDF",
      data: {
        enrollment: enrollmentStats,
        financial: transactionStats,
        classes: classStats,
        teachers: teacherStats,
        attendance: attendanceStats,
        grades: gradeStats,
        history: historyStats
      }
    };

    setGeneratedReports((prev) => [monthlyReport, ...prev]);
  };

  // -----------------------------
  // DOWNLOAD FUNCTION
  // -----------------------------
  const handleDownload = (report) => {
    exportReportToPDF(report);
  };

  // -----------------------------
  // FILTER REPORTS BY DATE RANGE
  // -----------------------------
  const getFilteredReports = () => {
    let reports = [...generatedReports];
    
    if (dateRange !== 'all') {
      reports = reports.filter(r => {
        const d = new Date(r.date);
        
        if (dateRange === 'month') {
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        } else if (dateRange === 'quarter') {
          const qNow = Math.floor(now.getMonth() / 3);
          const qD = Math.floor(d.getMonth() / 3);
          return qD === qNow && d.getFullYear() === now.getFullYear();
        } else if (dateRange === 'year') {
          return d.getFullYear() === now.getFullYear();
        }
        return true;
      });
    }
    
    if (reportType !== 'all') {
      reports = reports.filter(r => r.type === reportType);
    }
    
    return reports;
  };

  const filteredReports = getFilteredReports();

  // -----------------------------
  // UI STATS
  // -----------------------------
  const thisMonthReports = filteredReports.filter(r => {
    const d = new Date(r.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const totalReports = filteredReports.length;

  if (loading) {
    return (
      <div className="class-management">
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <div className="spinner"></div>
          <p>Loading reports data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="class-management">

      {/* FILTERS */}
      <div className="class-controls">
        <div className="filter-box">
          <Filter size={20} />
          <select value={reportType} onChange={(e) => setReportType(e.target.value)}>
            <option value="all">All Reports</option>
            <option value="students">Student Reports</option>
            <option value="financial">Financial Reports</option>
            <option value="classes">Class Reports</option>
            <option value="teachers">Teacher Reports</option>
            <option value="attendance">Attendance Reports</option>
            <option value="grades">Grade Reports</option>
            <option value="history">Academic History Reports</option>
          </select>
        </div>

        <div className="filter-box">
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
            <option value="all">All Time</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
        </div>

        <button className="btn-primary btn-generate-sm" onClick={generateReport}>
          Generate Report
        </button>
      </div>

      {/* STATS CARDS - Only report generation stats */}
      <StatsGrid>
        <StatCard 
          label="Total Reports" 
          value={totalReports} 
          icon={<FileText size={20} />} 
          color="blue" 
          subtitle="All generated reports"
        />
        <StatCard 
          label="This Month" 
          value={thisMonthReports.length} 
          icon={<BarChart2 size={20} />} 
          color="green" 
          subtitle={`${thisMonthReports.length} new reports`}
        />
        <StatCard 
          label="Report Types" 
          value={new Set(generatedReports.map(r => r.type)).size} 
          icon={<FileDown size={20} />} 
          color="purple" 
          subtitle="Different report categories"
        />
        <StatCard 
          label="PDF Reports" 
          value={generatedReports.filter(r => r.format === 'PDF').length} 
          icon={<CheckCircle size={20} />} 
          color="teal" 
          subtitle="All in PDF format"
        />
      </StatsGrid>

      {/* TABLE */}
      <div className="classes-container">
        <div className="teacher-assignment-table">
          <table className="assignments-table">
            <thead>
              <tr>
                <th>Report Name</th>
                <th>Period</th>
                <th>Date Generated</th>
                <th>Format</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredReports.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    No reports generated yet. Click "Generate Report" to create one.
                  </td>
                </tr>
              ) : (
                filteredReports.map(report => (
                  <tr key={report.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileDown size={18} />
                        <strong>{report.name}</strong>
                      </div>
                    </td>
                    <td>{report.period}</td>
                    <td>{report.date}</td>
                    <td>
                      <span className="badge-pdf">
                        {report.format}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn-edit"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => handleDownload(report)}
                      >
                        <Download size={14} />
                        Download PDF
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>

          </table>
        </div>
      </div>

      <style>{`
        .badge-pdf {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 12px;
          background: #fee2e2;
          color: #991b1b;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }
        .spinner {
          border: 3px solid #f3f3f3;
          border-top: 3px solid #4f6ef7;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }
        .btn-generate-sm {
          width: 160px;}
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

    </div>
  );
};

export default Reports;