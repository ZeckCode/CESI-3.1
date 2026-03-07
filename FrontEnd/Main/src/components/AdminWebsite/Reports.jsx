import React, { useState } from 'react';
import { FileText, Download, Filter, BarChart2, Clock, CheckCircle } from 'lucide-react';
import StatCard, { StatsGrid } from './StatCard';
import '../AdminWebsiteCSS/ClassManagement.css'; // Reusing similar styles

const Reports = () => {
  const [reportType, setReportType] = useState('all');
  const [dateRange, setDateRange] = useState('all');

  const reports = [
    { id: 1, name: 'Student Enrollment Report', type: 'students', date: '2026-01-16', format: 'PDF' },
    { id: 2, name: 'Financial Summary', type: 'financial', date: '2026-01-16', format: 'Excel' },
    { id: 3, name: 'Class Statistics', type: 'classes', date: '2026-01-15', format: 'PDF' },
    { id: 4, name: 'Teacher Performance', type: 'teachers', date: '2026-01-14', format: 'Excel' },
    { id: 5, name: 'Attendance Summary', type: 'attendance', date: '2026-01-13', format: 'PDF' },
  ];

  const now = new Date();
  const filteredReports = reports.filter((r) => {
    if (reportType !== 'all' && r.type !== reportType) return false;
    if (dateRange !== 'all') {
      const d = new Date(r.date);
      if (dateRange === 'month') {
        if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
      } else if (dateRange === 'quarter') {
        const qNow = Math.floor(now.getMonth() / 3);
        const qD = Math.floor(d.getMonth() / 3);
        if (qD !== qNow || d.getFullYear() !== now.getFullYear()) return false;
      } else if (dateRange === 'year') {
        if (d.getFullYear() !== now.getFullYear()) return false;
      }
    }
    return true;
  });

  return (
    <div className="class-management">
      {/* Filters */}
      <div className="class-controls">
        <div className="filter-box">
          <Filter size={20} />
          <select value={reportType} onChange={(e) => setReportType(e.target.value)}>
            <option value="all">All Reports</option>
            <option value="students">Student Reports</option>
            <option value="financial">Financial Reports</option>
            <option value="classes">Class Reports</option>
            <option value="teachers">Teacher Reports</option>
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
      </div>

      {/* Statistics */}
      <StatsGrid>
        <StatCard label="Total Reports" value={filteredReports.length} icon={<FileText size={20} />} color="blue" />
        <StatCard label="This Month" value={reports.filter(r => { const d = new Date(r.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length} icon={<BarChart2 size={20} />} color="green" />
        <StatCard label="Pending" value={2} icon={<Clock size={20} />} color="yellow" />
        <StatCard label="Generated Today" value={reports.filter(r => r.date === now.toISOString().slice(0, 10)).length} icon={<CheckCircle size={20} />} color="purple" />
      </StatsGrid>

      {/* Reports Table */}
      <div className="classes-container">
        <div className="teacher-assignment-table">
          <table className="assignments-table">
            <thead>
              <tr>
                <th>Report Name</th>
                <th>Date Generated</th>
                <th>Format</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map(report => (
                <tr key={report.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={18} />
                      <strong>{report.name}</strong>
                    </div>
                  </td>
                  <td>{report.date}</td>
                  <td><span className="badge">{report.format}</span></td>
                  <td>
                    <button className="btn-edit" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Download size={14} />
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Developer Notes */}
      <div className="note">
        📌 <strong>Development Notes:</strong> 
        <ul>
          <li>Connect to backend API for real report generation</li>
          <li>Implement PDF export functionality</li>
          <li>Add Excel export with multiple sheets</li>
          <li>Create scheduled report generation</li>
          <li>Add email delivery options for reports</li>
        </ul>
      </div>
    </div>
  );
};

export default Reports;
