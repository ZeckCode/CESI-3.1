import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, Filter, BarChart2, Clock, 
  CheckCircle, FileDown, X, Users, BookOpen, 
  TrendingUp, Calendar, AlertCircle 
} from 'lucide-react';
import './Reports.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { apiFetch } from '../api/apiFetch';
import '../AdminWebsiteCSS/ClassManagement.css';
import '../AdminWebsiteCSS/Reports.css';

// Toast Component
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`toast-notification toast-${type}`}>
      <div className="toast-content">
        {type === 'success' && <CheckCircle size={18} />}
        {type === 'error' && <X size={18} />}
        <span>{message}</span>
      </div>
      <button className="toast-close" onClick={onClose}>
        <X size={14} />
      </button>
    </div>
  );
};

// Helper functions
const getCurrentAcademicYear = () => {
  const today = new Date();
  const year = today.getFullYear();
  return today.getMonth() >= 5 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
};

const formatCurrency = (value) => `₱${Number(value || 0).toLocaleString()}`;

const Reports = () => {
  const [reportType, setReportType] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [generatedReports, setGeneratedReports] = useState([]);
  const [toast, setToast] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Data states for tables
  const [enrollments, setEnrollments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [gradeRecords, setGradeRecords] = useState([]);
  const [historyRecords, setHistoryRecords] = useState([]);
  
  // Stats states
  const [stats, setStats] = useState({
    enrollment: { total: 0, active: 0, pending: 0, dropped: 0 },
    financial: { total_billed: 0, total_collected: 0, outstanding_balance: 0 },
    class: { total_sections: 0, total_students: 0, active_sections: 0, total_subjects: 0 },
    teacher: { total_teachers: 0, active_teachers: 0 },
    attendance: { total_records: 0, present: 0, absent: 0, late: 0, excused: 0 },
    grades: { total_students: 0, graded_students: 0, pending_grades: 0, average_grade: '—' },
    history: { totalRecords: 0, uniqueStudents: 0, schoolYears: 0, averageFinal: '—' }
  });

  const now = new Date();

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  // Load saved reports from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('generatedReports');
    if (saved) {
      try {
        setGeneratedReports(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load saved reports', e);
      }
    }
  }, []);

  // Save reports to localStorage
  useEffect(() => {
    if (generatedReports.length > 0) {
      localStorage.setItem('generatedReports', JSON.stringify(generatedReports));
    }
  }, [generatedReports]);

  // Fetch all data
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      
      try {
        // Fetch enrollments
        const enrollRes = await apiFetch('/api/enrollments/');
        const enrollData = await enrollRes.json();
        const enrollList = Array.isArray(enrollData) ? enrollData : [];
        setEnrollments(enrollList);
        
        // Fetch transactions
        const transRes = await apiFetch('/api/finance/transactions/');
        const transData = await transRes.json();
        setTransactions(Array.isArray(transData) ? transData : []);
        
        // Fetch stats
        const statsRes = await apiFetch('/api/finance/transactions/stats/');
        const statsData = await statsRes.json();
        
        // Fetch sections
        const sectionsRes = await apiFetch('/api/accounts/sections/');
        const sectionsData = await sectionsRes.json();
        const sectionsList = Array.isArray(sectionsData) ? sectionsData : [];
        setSections(sectionsList);
        
        // Fetch subjects
        const subjectsRes = await apiFetch('/api/accounts/subjects/');
        const subjectsData = await subjectsRes.json();
        setSubjects(Array.isArray(subjectsData) ? subjectsData : []);
        
        // Fetch teachers
        const teachersRes = await apiFetch('/api/accounts/users/?role=TEACHER');
        const teachersData = await teachersRes.json();
        const teachersList = Array.isArray(teachersData) ? teachersData : [];
        setTeachers(teachersList);
        
        // Fetch attendance
        const today = new Date().toISOString().split('T')[0];
        const attendRes = await apiFetch(`/api/attendance/records/?date=${today}`);
        const attendData = await attendRes.json();
        const attendList = Array.isArray(attendData) ? attendData : [];
        setAttendanceRecords(attendList);
        
        // Fetch history (try-catch as it might fail)
        try {
          const historyRes = await apiFetch('/api/grades/academic-history/');
          const historyData = await historyRes.json();
          setHistoryRecords(Array.isArray(historyData) ? historyData : []);
        } catch (e) {
          console.warn('History endpoint failed:', e);
        }
        
        // Calculate stats
        const totalEnroll = enrollList.length;
        const activeEnroll = enrollList.filter(e => e.status === 'ACTIVE').length;
        const pendingEnroll = enrollList.filter(e => e.status === 'PENDING').length;
        const droppedEnroll = enrollList.filter(e => e.status === 'DROPPED').length;
        
        const totalStudents = sectionsList.reduce((sum, s) => sum + (s.student_count || 0), 0);
        const activeSections = sectionsList.filter(s => s.student_count > 0).length;
        
        const activeTeachers = teachersList.filter(t => t.status === 'ACTIVE').length;
        
        const present = attendList.filter(r => r.status === 'PRESENT').length;
        const absent = attendList.filter(r => r.status === 'ABSENT').length;
        const late = attendList.filter(r => r.status === 'LATE').length;
        const excused = attendList.filter(r => r.status === 'EXCUSED').length;
        
        setStats({
          enrollment: { total: totalEnroll, active: activeEnroll, pending: pendingEnroll, dropped: droppedEnroll },
          financial: {
            total_billed: statsData.total_billed || 0,
            total_collected: statsData.total_collected || 0,
            outstanding_balance: statsData.outstanding_balance || 0
          },
          class: {
            total_sections: sectionsList.length,
            total_students: totalStudents,
            active_sections: activeSections,
            total_subjects: subjects.length
          },
          teacher: {
            total_teachers: teachersList.length,
            active_teachers: activeTeachers
          },
          attendance: {
            total_records: attendList.length,
            present, absent, late, excused
          },
          grades: {
            total_students: 0,
            graded_students: 0,
            pending_grades: 0,
            average_grade: '—'
          },
          history: {
            totalRecords: historyRecords.length,
            uniqueStudents: new Set(historyRecords.map(r => r.student)).size,
            schoolYears: new Set(historyRecords.map(r => r.school_year)).size,
            averageFinal: historyRecords.length ? '—' : '—'
          }
        });
        
      } catch (error) {
        console.error('Error fetching data:', error);
        showToast('Failed to load some data', 'error');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAllData();
  }, []);

  // Generate PDF and open in new tab
  const openPrintView = (report) => {
    const doc = new jsPDF('landscape');
    
    doc.setFontSize(18);
    doc.setTextColor(33, 37, 41);
    doc.text(report.name, 14, 15);
    
    doc.setFontSize(10);
    doc.setTextColor(108, 117, 125);
    const currentDate = new Date().toLocaleDateString('en-PH', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    doc.text(`Generated: ${currentDate}`, 14, 22);
    doc.text(`Report Period: ${report.period || 'Current'}`, 14, 29);
    
    let startY = 38;
    
    if (report.type === 'students') {
      doc.text('Student Enrollment Report', 14, startY);
      const tableData = report.data.map(s => [
        s.student_name || '—',
        s.grade_level || '—',
        s.section_name || '—',
        s.status || '—',
        s.academic_year || '—'
      ]);
      autoTable(doc, {
        startY: startY + 5,
        head: [['Student Name', 'Grade Level', 'Section', 'Status', 'Academic Year']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [79, 110, 247], textColor: 255, fontSize: 10 },
        bodyStyles: { fontSize: 9 },
      });
    } 
    else if (report.type === 'financial') {
      doc.text('Financial Transaction Report', 14, startY);
      const tableData = report.data.map(t => [
        t.student_name || '—',
        t.transaction_date || '—',
        t.entry_type || '—',
        formatCurrency(t.debit || 0),
        formatCurrency(t.credit || 0),
        t.status || '—'
      ]);
      autoTable(doc, {
        startY: startY + 5,
        head: [['Student', 'Date', 'Type', 'Debit', 'Credit', 'Status']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [79, 110, 247], textColor: 255, fontSize: 10 },
        bodyStyles: { fontSize: 9 },
      });
    }
    else if (report.type === 'classes') {
      doc.text('Class Report', 14, startY);
      const tableData = report.data.map(s => [
        s.name || '—',
        s.grade_level || '—',
        s.student_count || 0,
        s.adviser_name || 'Unassigned',
        s.room_code || '—'
      ]);
      autoTable(doc, {
        startY: startY + 5,
        head: [['Section', 'Grade Level', 'Students', 'Adviser', 'Room']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [79, 110, 247], textColor: 255, fontSize: 10 },
        bodyStyles: { fontSize: 9 },
      });
    }
    else if (report.type === 'teachers') {
      doc.text('Teacher Report', 14, startY);
      const tableData = report.data.map(t => [
        t.username || '—',
        t.email || '—',
        t.teacher_profile?.employee_id || '—',
        t.teacher_profile?.subject?.name || 'Unassigned',
        t.status || '—'
      ]);
      autoTable(doc, {
        startY: startY + 5,
        head: [['Name', 'Email', 'Employee ID', 'Subject', 'Status']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [79, 110, 247], textColor: 255, fontSize: 10 },
        bodyStyles: { fontSize: 9 },
      });
    }
    else if (report.type === 'attendance') {
      doc.text('Attendance Report', 14, startY);
      const tableData = report.data.map(a => [
        a.student_name || '—',
        a.section_name || '—',
        a.subject_name || '—',
        a.status || '—',
        a.date || '—'
      ]);
      autoTable(doc, {
        startY: startY + 5,
        head: [['Student', 'Section', 'Subject', 'Status', 'Date']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [79, 110, 247], textColor: 255, fontSize: 10 },
        bodyStyles: { fontSize: 9 },
      });
    }
    else if (report.type === 'history') {
      doc.text('Academic History Report', 14, startY);
      const tableData = report.data.map(h => [
        h.student_name || '—',
        h.school_year || '—',
        h.subject_name || '—',
        h.final_grade || '—',
        h.remarks || '—'
      ]);
      autoTable(doc, {
        startY: startY + 5,
        head: [['Student', 'School Year', 'Subject', 'Final Grade', 'Remarks']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [79, 110, 247], textColor: 255, fontSize: 10 },
        bodyStyles: { fontSize: 9 },
      });
    }
    else {
      // Comprehensive report - summary stats only
      doc.text('System Summary', 14, startY);
      const summaryData = [
        ['Total Enrollments', stats.enrollment.total],
        ['Active Students', stats.enrollment.active],
        ['Total Sections', stats.class.total_sections],
        ['Total Teachers', stats.teacher.total_teachers],
        ['Total Collected', formatCurrency(stats.financial.total_collected)],
        ['Outstanding Balance', formatCurrency(stats.financial.outstanding_balance)],
      ];
      autoTable(doc, {
        startY: startY + 5,
        head: [['Metric', 'Value']],
        body: summaryData,
        theme: 'grid',
        headStyles: { fillColor: [79, 110, 247], textColor: 255, fontSize: 10 },
        bodyStyles: { fontSize: 9 },
      });
    }
    
    // Add page numbers
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(108, 117, 125);
      doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 10);
    }
    
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
    setTimeout(() => URL.revokeObjectURL(pdfUrl), 100);
  };

  const getPeriodLabel = () => {
    if (dateRange === 'month') return `${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`;
    if (dateRange === 'quarter') return `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`;
    if (dateRange === 'year') return `Year ${now.getFullYear()}`;
    return 'All Time';
  };

  const generateReport = () => {
    const today = new Date().toISOString().slice(0, 10);
    const period = getPeriodLabel();
    
    let data = [];
    let reportName = '';
    
    setIsGenerating(true);
    
    switch (reportType) {
      case "students":
        data = enrollments;
        reportName = `Student Enrollment Report - ${period}`;
        break;
      case "financial":
        data = transactions;
        reportName = `Financial Transaction Report - ${period}`;
        break;
      case "classes":
        data = sections;
        reportName = `Class Report - ${period}`;
        break;
      case "teachers":
        data = teachers;
        reportName = `Teacher Report - ${period}`;
        break;
      case "attendance":
        data = attendanceRecords;
        reportName = `Attendance Report - ${period}`;
        break;
      case "history":
        data = historyRecords;
        reportName = `Academic History Report - ${period}`;
        break;
      default:
        data = { enrollments, transactions, sections, teachers, attendanceRecords };
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
    
    setGeneratedReports(prev => [newReport, ...prev]);
    setIsGenerating(false);
    showToast('Report generated successfully!', 'success');
  };
  
  const handleDownload = (report) => {
    openPrintView(report);
  };
  
  const handleDeleteReport = (id) => {
    setGeneratedReports(prev => prev.filter(r => r.id !== id));
    showToast('Report deleted', 'success');
  };
  
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
  const thisMonthReports = filteredReports.filter(r => {
    const d = new Date(r.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  
  if (loading) {
    return (
      <div className="reports-container">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading reports data...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="reports-container">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="reports-header">
        <h1>Reports Module</h1>
        <p>Generate and download system reports in PDF format</p>
      </div>
      
      <div className="reports-controls">
        <div className="filter-box">
          <Filter size={18} />
          <select value={reportType} onChange={(e) => setReportType(e.target.value)}>
            <option value="all">All Reports</option>
            <option value="students">Student Enrollment</option>
            <option value="financial">Financial Transactions</option>
            <option value="classes">Classes & Sections</option>
            <option value="teachers">Teachers</option>
            <option value="attendance">Attendance</option>
            <option value="history">Academic History</option>
          </select>
        </div>
        
        <div className="filter-box">
          <Clock size={18} />
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
            <option value="all">All Time</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
        </div>
        
        <button className="btn-generate" onClick={generateReport} disabled={isGenerating}>
          <FileText size={18} />
          {isGenerating ? 'Generating...' : 'Generate Report'}
        </button>
      </div>
      
      <div className="stats-grid">
        <div className="stat-card stat-blue">
          <div className="stat-card-header">
            <span className="stat-card-label">Total Reports</span>
            <div className="stat-card-icon"><FileText size={18} /></div>
          </div>
          <div className="stat-card-value">{filteredReports.length}</div>
          <div className="stat-card-subtitle">Generated reports</div>
        </div>
        
        <div className="stat-card stat-green">
          <div className="stat-card-header">
            <span className="stat-card-label">This Month</span>
            <div className="stat-card-icon"><Calendar size={18} /></div>
          </div>
          <div className="stat-card-value">{thisMonthReports.length}</div>
          <div className="stat-card-subtitle">New reports</div>
        </div>
        
        <div className="stat-card stat-purple">
          <div className="stat-card-header">
            <span className="stat-card-label">Report Types</span>
            <div className="stat-card-icon"><BarChart2 size={18} /></div>
          </div>
          <div className="stat-card-value">{new Set(generatedReports.map(r => r.type)).size}</div>
          <div className="stat-card-subtitle">Categories</div>
        </div>
        
        <div className="stat-card stat-teal">
          <div className="stat-card-header">
            <span className="stat-card-label">PDF Format</span>
            <div className="stat-card-icon"><FileDown size={18} /></div>
          </div>
          <div className="stat-card-value">{generatedReports.filter(r => r.format === 'PDF').length}</div>
          <div className="stat-card-subtitle">All in PDF</div>
        </div>
      </div>
      
      <div className="table-container">
        <table className="reports-table">
          <thead>
            <tr>
              <th>Report Name</th>
              <th>Period</th>
              <th>Date Generated</th>
              <th>Format</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredReports.length === 0 ? (
              <tr>
                <td colSpan="5">
                  <div className="empty-state">
                    <FileText size={48} />
                    <p>No reports generated yet. Click "Generate Report" to create one.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredReports.map(report => (
                <tr key={report.id}>
                  <td>
                    <div className="report-name-cell">
                      <FileDown size={18} />
                      <strong>{report.name}</strong>
                    </div>
                  </td>
                  <td>{report.period}</td>
                  <td>{report.date}</td>
                  <td><span className="badge-pdf">{report.format}</span></td>
                  <td>
                    <button className="btn-download" onClick={() => handleDownload(report)}>
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
  );
};

export default Reports;