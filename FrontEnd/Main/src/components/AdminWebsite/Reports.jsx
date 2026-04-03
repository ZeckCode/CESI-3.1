import React, { useState, useEffect } from 'react';
import { FileText, Download, Filter, BarChart2, Clock, CheckCircle, FileDown, X, RefreshCw } from 'lucide-react';
import StatCard, { StatsGrid } from './StatCard';
import '../AdminWebsiteCSS/ClassManagement.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { apiFetch } from '../api/apiFetch';

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
  const [currentAcademicYear, setCurrentAcademicYear] = useState('');
  const [toast, setToast] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
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
  
  const [historyStats, setHistoryStats] = useState({
    totalRecords: 0,
    uniqueStudents: 0,
    schoolYears: 0,
    averageFinal: '—'
  });
  
  // Data for tables
  const [enrollments, setEnrollments] = useState([]);
  const [sections, setSections] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [historyRecords, setHistoryRecords] = useState([]);
  
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

  // Fetch academic year
  const fetchAcademicYear = async () => {
    try {
      const res = await apiFetch('/api/enrollment-settings/');
      const data = await res.json();
      setCurrentAcademicYear(data.academic_year || getCurrentAcademicYear());
    } catch (error) {
      console.error('Error fetching academic year:', error);
      setCurrentAcademicYear(getCurrentAcademicYear());
    }
  };

  // Fetch all data
  const refreshAllData = async () => {
    setRefreshing(true);
    try {
      const enrollRes = await apiFetch('/api/enrollments/');
      const enrollData = await enrollRes.json();
      const enrollList = Array.isArray(enrollData) ? enrollData : [];
      setEnrollments(enrollList);
      
      const total = enrollList.length;
      const active = enrollList.filter(e => e.status === 'ACTIVE').length;
      const pending = enrollList.filter(e => e.status === 'PENDING').length;
      const dropped = enrollList.filter(e => e.status === 'DROPPED').length;
      setEnrollmentStats({ total, active, pending, dropped, expired: 0 });
      
      const sectionsRes = await apiFetch('/api/accounts/sections/');
      const sectionsData = await sectionsRes.json();
      const sectionsList = Array.isArray(sectionsData) ? sectionsData : [];
      setSections(sectionsList);
      
      const subjectsRes = await apiFetch('/api/accounts/subjects/');
      const subjectsData = await subjectsRes.json();
      const subjectsList = Array.isArray(subjectsData) ? subjectsData : [];
      
      const totalStudents = sectionsList.reduce((sum, s) => sum + (s.student_count || 0), 0);
      const activeSections = sectionsList.filter(s => s.student_count > 0).length;
      setClassStats({
        total_sections: sectionsList.length,
        total_students: totalStudents,
        active_sections: activeSections,
        total_subjects: subjectsList.length
      });
      
      const teachersRes = await apiFetch('/api/accounts/users/?role=TEACHER');
      const teachersData = await teachersRes.json();
      const teachersList = Array.isArray(teachersData) ? teachersData : [];
      setTeachers(teachersList);
      
      const activeTeachers = teachersList.filter(t => t.status === 'ACTIVE').length;
      setTeacherStats({
        total_teachers: teachersList.length,
        active_teachers: activeTeachers,
        total_subjects: 0,
        total_classes: 0
      });
      
      const statsRes = await apiFetch('/api/finance/transactions/stats/');
      const statsData = await statsRes.json();
      setTransactionStats({
        total_billed: statsData.total_billed || 0,
        total_collected: statsData.total_collected || 0,
        outstanding_balance: statsData.outstanding_balance || 0
      });
      
      const transRes = await apiFetch('/api/finance/transactions/');
      const transData = await transRes.json();
      setTransactions(Array.isArray(transData) ? transData : []);
      
      const today = new Date().toISOString().split('T')[0];
      const attendRes = await apiFetch(`/api/attendance/records/?date=${today}`);
      const attendData = await attendRes.json();
      const attendList = Array.isArray(attendData) ? attendData : [];
      setAttendanceRecords(attendList);
      
      const present = attendList.filter(r => r.status === 'PRESENT').length;
      const absent = attendList.filter(r => r.status === 'ABSENT').length;
      const late = attendList.filter(r => r.status === 'LATE').length;
      const excused = attendList.filter(r => r.status === 'EXCUSED').length;
      setAttendanceStats({
        total_records: attendList.length,
        present, absent, late, excused
      });
      
      try {
        const historyRes = await apiFetch('/api/grades/academic-history/');
        const historyData = await historyRes.json();
        const historyList = Array.isArray(historyData) ? historyData : [];
        setHistoryRecords(historyList);
        
        const finalGrades = historyList.map(r => Number(r.final_grade)).filter(v => !isNaN(v));
        const averageFinal = finalGrades.length ? (finalGrades.reduce((sum, v) => sum + v, 0) / finalGrades.length).toFixed(2) : '—';
        setHistoryStats({
          totalRecords: historyList.length,
          uniqueStudents: new Set(historyList.map(r => r.student)).size,
          schoolYears: new Set(historyList.map(r => r.school_year)).size,
          averageFinal: averageFinal
        });
      } catch (e) {
        console.warn('History endpoint failed:', e);
      }
      
      await fetchAcademicYear();
      showToast('Data refreshed successfully', 'success');
    } catch (error) {
      console.error('Error fetching data:', error);
      showToast('Failed to load some data', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      await refreshAllData();
      setLoading(false);
    };
    fetchAllData();
  }, []);

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
    
    // SUMMARY STATISTICS
    doc.setFontSize(12);
    doc.setTextColor(33, 37, 41);
    doc.text('Summary Statistics', 14, startY);
    
    let summaryData = [];
    
    if (report.type === 'students') {
      summaryData = [
        ['Total Enrollments', report.data.total || 0],
        ['Active/Enrolled', report.data.active || 0],
        ['Pending', report.data.pending || 0],
        ['Declined/Dropped', report.data.dropped || 0],
        ['Academic Year', report.data.academicYear || '—'],
      ];
    } 
    else if (report.type === 'classes') {
      summaryData = [
        ['Total Sections', report.data.total_sections || 0],
        ['Total Students (All Sections)', report.data.total_students || 0],
        ['Active Enrollments', report.data.active_enrollments || 0],
        ['Pending Enrollments', report.data.pending_enrollments || 0],
        ['Expired Classes', report.data.expired_classes || 0],
      ];
    }
    else if (report.type === 'financial') {
      summaryData = [
        ['Total Billed', formatCurrency(report.data.total_billed || 0)],
        ['Total Collected', formatCurrency(report.data.total_collected || 0)],
        ['Outstanding Balance', formatCurrency(report.data.outstanding_balance || 0)],
      ];
    }
    else if (report.type === 'teachers') {
      summaryData = [
        ['Total Teachers', report.data.total_teachers || 0],
        ['Active Teachers', report.data.active_teachers || 0],
      ];
    }
    else if (report.type === 'attendance') {
      summaryData = [
        ['Total Records', report.data.total_records || 0],
        ['Present', report.data.present || 0],
        ['Absent', report.data.absent || 0],
        ['Late', report.data.late || 0],
        ['Excused', report.data.excused || 0],
      ];
    }
    else if (report.type === 'history') {
      summaryData = [
        ['Total Records', report.data.totalRecords || 0],
        ['Unique Students', report.data.uniqueStudents || 0],
        ['School Years', report.data.schoolYears || 0],
        ['Average Final Grade', report.data.averageFinal || '—'],
      ];
    }
    else if (report.type === 'all') {
      summaryData = [
        ['Total Enrollments', report.data.enrollment?.total || 0],
        ['Active/Enrolled', report.data.enrollment?.active || 0],
        ['Total Sections', report.data.classes?.total_sections || 0],
        ['Total Students', report.data.classes?.total_students || 0],
        ['Total Teachers', report.data.teachers?.total_teachers || 0],
        ['Total Collected', formatCurrency(report.data.financial?.total_collected || 0)],
        ['Outstanding Balance', formatCurrency(report.data.financial?.outstanding_balance || 0)],
        ['Attendance Records', report.data.attendanceStats?.total_records || 0],
        ['History Records', report.data.history?.totalRecords || 0],
      ];
    }
    
    if (summaryData.length > 0) {
      autoTable(doc, {
        startY: startY + 5,
        head: [['Metric', 'Value']],
        body: summaryData,
        theme: 'grid',
        headStyles: { fillColor: [79, 110, 247], textColor: 255, fontSize: 10 },
        bodyStyles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
      });
      startY = doc.lastAutoTable.finalY + 15;
    }
    
    // DETAILS TABLES
    if (report.type === 'students' && report.data.enrollments?.length > 0) {
      doc.text('Enrollment Details', 14, startY);
      const tableData = report.data.enrollments.map(e => [
        `${e.first_name || ''} ${e.last_name || ''}`.trim() || e.student_name || '—',
        e.grade_level || '—',
        e.section_name || '—',
        e.enrolled_at ? new Date(e.enrolled_at).toLocaleDateString() : '—',
        e.status || '—',
        e.payment_mode || '—',
        e.parent_info?.guardian_name || e.parent_info?.mother_name || e.parent_info?.father_name || '—',
        e.mobile_number || e.telephone_number || '—'
      ]);
      autoTable(doc, {
        startY: startY + 5,
        head: [['Student Name', 'Grade', 'Section', 'Date', 'Status', 'Payment', 'Parent', 'Contact']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [79, 110, 247], textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        margin: { left: 14, right: 14 },
      });
    }
    else if (report.type === 'classes' && report.data.sections?.length > 0) {
      doc.text('Class Details', 14, startY);
      const tableData = report.data.sections.map(s => [
        s.grade_level || '—',
        s.name || '—',
        s.adviser_name || 'Unassigned',
        s.room_code || 'Unassigned',
        s.student_count || 0,
        s.pending_count || 0,
        s.student_count > 0 ? 'ONGOING' : 'EXPIRED'
      ]);
      autoTable(doc, {
        startY: startY + 5,
        head: [['Grade Level', 'Section', 'Adviser', 'Room', 'Active', 'Pending', 'Status']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [79, 110, 247], textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        margin: { left: 14, right: 14 },
      });
    }
    else if (report.type === 'financial' && report.data.transactions?.length > 0) {
      doc.text('Transaction Details', 14, startY);
      const tableData = report.data.transactions.map(t => [
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
        headStyles: { fillColor: [79, 110, 247], textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        margin: { left: 14, right: 14 },
      });
    }
    else if (report.type === 'teachers' && report.data.teachers?.length > 0) {
      doc.text('Teacher Details', 14, startY);
      const tableData = report.data.teachers.map(t => [
        t.username || '—',
        t.email || '—',
        t.teacher_profile?.employee_id || '—',
        t.teacher_profile?.subject?.name || 'Unassigned',
        t.status || '—'
      ]);
      autoTable(doc, {
        startY: startY + 5,
        head: [['Teacher Name', 'Email', 'Employee ID', 'Subject', 'Status']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [79, 110, 247], textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        margin: { left: 14, right: 14 },
      });
    }
    else if (report.type === 'attendance' && report.data.attendanceRecords?.length > 0) {
      doc.text('Attendance Record Details', 14, startY);
      const tableData = report.data.attendanceRecords.map(a => [
        a.student_name || a.student?.first_name ? `${a.student?.first_name || ''} ${a.student?.last_name || ''}`.trim() : 
          (a.first_name ? `${a.first_name} ${a.last_name || ''}`.trim() : '—'),
        a.student_number || a.student?.student_number || '—',
        a.grade_level || a.student?.grade_level || '—',
        a.section_name || a.section?.name || '—',
        a.subject_name || a.subject?.name || '—',
        a.status || '—',
        a.date || '—',
        a.marked_by_name || a.marked_by?.username || '—'
      ]);
      autoTable(doc, {
        startY: startY + 5,
        head: [['Student', 'Student #', 'Grade', 'Section', 'Subject', 'Status', 'Date', 'Marked By']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [79, 110, 247], textColor: 255, fontSize: 7 },
        bodyStyles: { fontSize: 6 },
        margin: { left: 14, right: 14 },
      });
    }
    else if (report.type === 'history' && report.data.historyRecords?.length > 0) {
      doc.text('Academic History Record Details', 14, startY);
      const tableData = report.data.historyRecords.map(h => [
        h.school_year || '—',
        h.student_name || h.student?.first_name ? `${h.student?.first_name || ''} ${h.student?.last_name || ''}`.trim() : 
          (h.first_name ? `${h.first_name} ${h.last_name || ''}`.trim() : '—'),
        h.student_number || h.student?.student_number || '—',
        h.grade_level || h.student?.grade_level || '—',
        h.section_name || h.section?.name || '—',
        h.subject_name || h.subject?.name || '—',
        h.final_grade || '—',
        h.remarks || '—'
      ]);
      autoTable(doc, {
        startY: startY + 5,
        head: [['School Year', 'Student Name', 'Student #', 'Grade', 'Section', 'Subject', 'Final Grade', 'Remarks']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [79, 110, 247], textColor: 255, fontSize: 7 },
        bodyStyles: { fontSize: 6 },
        margin: { left: 14, right: 14 },
      });
    }
    else if (report.type === 'all') {
      if (report.data.enrollments?.length > 0) {
        if (startY > 250) { doc.addPage(); startY = 20; }
        doc.text('Enrollment Details', 14, startY);
        autoTable(doc, {
          startY: startY + 5,
          head: [['Student Name', 'Grade', 'Section', 'Status']],
          body: report.data.enrollments.slice(0, 20).map(e => [
            `${e.first_name || ''} ${e.last_name || ''}`.trim() || e.student_name || '—',
            e.grade_level || '—',
            e.section_name || '—',
            e.status || '—'
          ]),
          theme: 'grid',
          headStyles: { fillColor: [79, 110, 247], textColor: 255, fontSize: 8 },
          bodyStyles: { fontSize: 7 },
          margin: { left: 14, right: 14 },
        });
        startY = doc.lastAutoTable.finalY + 15;
      }
      
      if (report.data.sections?.length > 0) {
        if (startY > 250) { doc.addPage(); startY = 20; }
        doc.text('Class Details', 14, startY);
        autoTable(doc, {
          startY: startY + 5,
          head: [['Grade', 'Section', 'Students', 'Status']],
          body: report.data.sections.map(s => [
            s.grade_level || '—',
            s.name || '—',
            s.student_count || 0,
            s.student_count > 0 ? 'ONGOING' : 'EXPIRED'
          ]),
          theme: 'grid',
          headStyles: { fillColor: [79, 110, 247], textColor: 255, fontSize: 8 },
          bodyStyles: { fontSize: 7 },
          margin: { left: 14, right: 14 },
        });
        startY = doc.lastAutoTable.finalY + 15;
      }
      
      if (report.data.attendanceRecords?.length > 0) {
        if (startY > 250) { doc.addPage(); startY = 20; }
        doc.text('Attendance Records', 14, startY);
        autoTable(doc, {
          startY: startY + 5,
          head: [['Student', 'Section', 'Subject', 'Status', 'Date']],
          body: report.data.attendanceRecords.slice(0, 20).map(a => [
            a.student_name || a.student?.first_name ? `${a.student?.first_name || ''} ${a.student?.last_name || ''}`.trim() : 
              (a.first_name ? `${a.first_name} ${a.last_name || ''}`.trim() : '—'),
            a.section_name || a.section?.name || '—',
            a.subject_name || a.subject?.name || '—',
            a.status || '—',
            a.date || '—'
          ]),
          theme: 'grid',
          headStyles: { fillColor: [79, 110, 247], textColor: 255, fontSize: 8 },
          bodyStyles: { fontSize: 7 },
          margin: { left: 14, right: 14 },
        });
        startY = doc.lastAutoTable.finalY + 15;
      }

      if (report.data.historyRecords?.length > 0) {
        if (startY > 250) { doc.addPage(); startY = 20; }
        doc.text('Academic History Records', 14, startY);
        autoTable(doc, {
          startY: startY + 5,
          head: [['Student', 'School Year', 'Subject', 'Final Grade', 'Remarks']],
          body: report.data.historyRecords.slice(0, 20).map(h => [
            h.student_name || h.student?.first_name ? `${h.student?.first_name || ''} ${h.student?.last_name || ''}`.trim() : 
              (h.first_name ? `${h.first_name} ${h.last_name || ''}`.trim() : '—'),
            h.school_year || '—',
            h.subject_name || h.subject?.name || '—',
            h.final_grade || '—',
            h.remarks || '—'
          ]),
          theme: 'grid',
          headStyles: { fillColor: [79, 110, 247], textColor: 255, fontSize: 8 },
          bodyStyles: { fontSize: 7 },
          margin: { left: 14, right: 14 },
        });
      }
    }
    
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
    if (currentAcademicYear) return `AY ${currentAcademicYear}`;
    return 'All Time';
  };

  const generateReport = () => {
    const today = new Date().toISOString().slice(0, 10);
    const period = getPeriodLabel();
    
    let data = {};
    let reportName = '';
    
    setIsGenerating(true);
    
    switch (reportType) {
      case "students":
        data = {
          total: enrollmentStats.total,
          active: enrollmentStats.active,
          pending: enrollmentStats.pending,
          dropped: enrollmentStats.dropped,
          academicYear: currentAcademicYear,
          enrollments: enrollments
        };
        reportName = `Student Enrollment Report - ${period}`;
        break;
      case "financial":
        data = {
          total_billed: transactionStats.total_billed,
          total_collected: transactionStats.total_collected,
          outstanding_balance: transactionStats.outstanding_balance,
          transactions: transactions.slice(0, 100)
        };
        reportName = `Financial Summary Report - ${period}`;
        break;
      case "classes":
        data = {
          total_sections: classStats.total_sections,
          total_students: classStats.total_students,
          active_enrollments: enrollmentStats.active,
          pending_enrollments: enrollmentStats.pending,
          expired_classes: sections.filter(s => s.student_count === 0).length,
          sections: sections.map(s => ({
            ...s,
            pending_count: enrollments.filter(e => e.section === s.id && e.status === 'PENDING').length
          }))
        };
        reportName = `Class Statistics Report - ${period}`;
        break;
      case "teachers":
        data = {
          total_teachers: teacherStats.total_teachers,
          active_teachers: teacherStats.active_teachers,
          teachers: teachers
        };
        reportName = `Teacher Performance Report - ${period}`;
        break;
      case "attendance":
        data = {
          total_records: attendanceStats.total_records,
          present: attendanceStats.present,
          absent: attendanceStats.absent,
          late: attendanceStats.late,
          excused: attendanceStats.excused,
          attendanceRecords: attendanceRecords
        };
        reportName = `Attendance Summary Report - ${period}`;
        break;
      case "history":
        data = {
          totalRecords: historyStats.totalRecords,
          uniqueStudents: historyStats.uniqueStudents,
          schoolYears: historyStats.schoolYears,
          averageFinal: historyStats.averageFinal,
          historyRecords: historyRecords
        };
        reportName = `Academic History Report - ${period}`;
        break;
      default:
        data = {
          enrollment: enrollmentStats,
          financial: transactionStats,
          classes: classStats,
          teachers: teacherStats,
          attendanceStats: attendanceStats,
          history: historyStats,
          enrollments: enrollments.slice(0, 50),
          sections: sections,
          attendanceRecords: attendanceRecords.slice(0, 50),
          historyRecords: historyRecords.slice(0, 50)
        };
        reportName = `Comprehensive System Report - ${period}`;
        break;
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
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      
      
      <div className="class-controls">
        <div className="filter-box">
          <Filter size={20} />
          <select value={reportType} onChange={(e) => setReportType(e.target.value)}>
            <option value="all">All Reports</option>
            <option value="students">Student Enrollment Reports</option>
            <option value="financial">Financial Reports</option>
            <option value="classes">Class Reports</option>
            <option value="teachers">Teacher Reports</option>
            <option value="attendance">Attendance Reports</option>
            <option value="history">Academic History Reports</option>
          </select>
        </div>
        
        <div className="filter-box">
          <Clock size={20} />
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
            <option value="all">All Time</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
        </div>
        
        <button className="btn-primary" onClick={generateReport} disabled={isGenerating}>
          <FileText size={18} />
          {isGenerating ? 'Generating...' : 'Generate Report'}
        </button>

        <button className="btn-icon" onClick={refreshAllData} title="Refresh Data" disabled={refreshing}>
              <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
        </button>
      </div>
      
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
                    <FileText size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                    <p>No reports generated yet. Click "Generate Report" to create one.</p>
                  </td>
                </tr>
              ) : (
                filteredReports.map(report => (
                  <tr key={report.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileDown size={18} style={{ color: '#4f6ef7' }} />
                        <strong>{report.name}</strong>
                      </div>
                    </td>
                    <td>{report.period}</td>
                    <td>{report.date}</td>
                    <td><span className="badge-pdf">{report.format}</span></td>
                    <td>
                      <button className="btn-edit" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => handleDownload(report)}>
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
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .toast-notification {
          position: fixed;
          top: 80px;
          right: 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 20px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 1000;
          min-width: 280px;
          max-width: 400px;
          animation: slideInRight 0.3s ease-out;
        }
        
        .toast-success {
          border-left: 4px solid #10b981;
          background: #f0fdf4;
        }
        
        .toast-success .toast-content {
          color: #065f46;
        }
        
        .toast-error {
          border-left: 4px solid #ef4444;
          background: #fef2f2;
        }
        
        .toast-error .toast-content {
          color: #991b1b;
        }
        
        .toast-content {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          font-weight: 500;
        }
        
        .toast-close {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          opacity: 0.6;
          transition: opacity 0.2s;
        }
        
        .toast-close:hover {
          opacity: 1;
        }
        
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @media print {
          .class-controls,
          .stats-grid,
          .btn-edit,
          .toast-notification,
          .header-actions {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Reports;