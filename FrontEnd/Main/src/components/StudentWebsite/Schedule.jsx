import React, { useState, useEffect } from "react";
import { Calendar, List, Clock, MapPin, User, BookOpen, Download } from 'lucide-react';
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import "../StudentWebsiteCSS/Schedule.css";
import { apiFetch } from "../api/apiFetch";
import PreviewModal from "../PreviewModal";

// Day mapping for the calendar (backend uses 3-letter codes)
const DAY_MAP = {
  MON: "Mon",
  TUE: "Tue",
  WED: "Wed",
  THU: "Thu",
  FRI: "Fri",
  SAT: "Sat",
  SUN: "Sun",
};

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri"];

// Colors for subjects (cycling)
const SUBJECT_COLORS = [
  "cat-blue", "cat-green", "cat-yellow", "cat-purple", "cat-pink", "cat-orange"
];

const Schedule = () => {
  const [view, setView] = useState("calendar");
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState([]);

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const res = await apiFetch("/api/classmanagement/schedules/my/");
        if (!res.ok) throw new Error("Failed to load schedule");
        const data = await res.json();
        setSchedules(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Schedule fetch error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSchedule();
  }, []);

  // Transform API data
  const scheduleData = schedules.map((s, idx) => ({
    id: s.id,
    subject: s.subject_name,
    subject_code: s.subject_code,
    section: s.section_name,
    day: DAY_MAP[s.day_of_week] || s.day_of_week,
    startTime: s.start_time,
    endTime: s.end_time,
    room: s.room_code || "TBA",
    teacher: s.teacher_name,
    color: SUBJECT_COLORS[idx % SUBJECT_COLORS.length],
  }));

  // Get unique time slots for calendar view (sorted)
  const getTimeSlots = () => {
    const times = new Set();
    scheduleData.forEach(s => {
      times.add(s.startTime);
    });
    return Array.from(times).sort();
  };

  const timeSlots = getTimeSlots();

  // Format time for display
  const formatTime = (time) => {
    if (!time) return "";
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Check if schedule falls on a specific time slot
  const getSessionsForTimeSlot = (day, timeSlot) => {
    return scheduleData.filter(s => 
      s.day === day && s.startTime === timeSlot
    );
  };

  const handleExport = () => {
    // Build grid structure
    const gridBySlot = {};
    scheduleData.forEach((sched) => {
      if (!gridBySlot[sched.startTime]) {
        gridBySlot[sched.startTime] = {};
      }
      if (!gridBySlot[sched.startTime][sched.day]) {
        gridBySlot[sched.startTime][sched.day] = [];
      }
      gridBySlot[sched.startTime][sched.day].push(sched);
    });

    // Sort time slots
    const sortedTimeSlots = Object.keys(gridBySlot).sort(
      (a, b) => {
        const [aH, aM] = a.split(':').map(Number);
        const [bH, bM] = b.split(':').map(Number);
        return aH * 60 + aM - (bH * 60 + bM);
      }
    );

    // Create preview table
    const customPreviewContent = (
      <div style={{ overflowX: 'auto', width: '100%', maxHeight: '60vh', overflowY: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          backgroundColor: '#fff',
          fontSize: '13px'
        }}>
          <thead>
            <tr>
              <th style={{
                padding: '12px',
                border: '1px solid #ddd',
                background: '#1976D2',
                color: 'white',
                fontWeight: 'bold',
                textAlign: 'center',
                minWidth: '120px'
              }}>
                Time
              </th>
              {DAY_ORDER.map((day) => (
                <th key={day} style={{
                  padding: '12px',
                  border: '1px solid #ddd',
                  background: '#1976D2',
                  color: 'white',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  minWidth: '140px'
                }}>
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedTimeSlots.map((timeSlot) => {
              // Get end time from first schedule at this time slot
              let endTime = timeSlot;
              for (const day of DAY_ORDER) {
                const daySchedules = gridBySlot[timeSlot][day] || [];
                if (daySchedules.length > 0) {
                  endTime = daySchedules[0].endTime;
                  break;
                }
              }
              
              return (
              <tr key={timeSlot}>
                <td style={{
                  padding: '8px',
                  border: '1px solid #ddd',
                  background: '#f5f5f5',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  fontSize: '12px'
                }}>
                  {formatTime(timeSlot)} - {formatTime(endTime)}
                </td>
                {DAY_ORDER.map((day) => {
                  const daySchedules = gridBySlot[timeSlot][day] || [];
                  return (
                    <td key={day} style={{
                      padding: '8px',
                      border: '1px solid #ddd',
                      background: '#fafbfc',
                      fontSize: '12px',
                      verticalAlign: 'top',
                      whiteSpace: 'pre-wrap',
                      wordWrap: 'break-word',
                      textAlign: 'center'
                    }}>
                      {daySchedules.map((sched, schedIdx) => (
                        <div key={sched.id} style={{ marginBottom: schedIdx < daySchedules.length - 1 ? '10px' : 0 }}>
                          <div style={{ fontWeight: 'bold', marginBottom: '2px', color: '#1565C0' }}>
                            {sched.subject}
                          </div>
                          {sched.teacher && (
                            <div style={{ fontSize: '11px', color: '#666' }}>
                              {sched.teacher}
                            </div>
                          )}
                        </div>
                      ))}
                    </td>
                  );
                })}
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
    );

    setPreviewData(customPreviewContent);
    setShowPreview(true);
  };

  const handleDownloadScheduleExcel = async () => {
    // Build grid structure
    const gridBySlot = {};
    scheduleData.forEach((sched) => {
      if (!gridBySlot[sched.startTime]) {
        gridBySlot[sched.startTime] = {};
      }
      if (!gridBySlot[sched.startTime][sched.day]) {
        gridBySlot[sched.startTime][sched.day] = [];
      }
      gridBySlot[sched.startTime][sched.day].push(sched);
    });

    // Sort time slots
    const sortedTimeSlots = Object.keys(gridBySlot).sort(
      (a, b) => {
        const [aH, aM] = a.split(':').map(Number);
        const [bH, bM] = b.split(':').map(Number);
        return aH * 60 + aM - (bH * 60 + bM);
      }
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Schedule");

    // Add header row with days
    const headerRow = worksheet.addRow(['Time', ...DAY_ORDER]);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1976D2' } };
      cell.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
    });
    headerRow.height = 25;

    // Add data rows
    sortedTimeSlots.forEach((timeSlot) => {
      // Get end time from first schedule at this time slot
      let endTime = timeSlot;
      for (const day of DAY_ORDER) {
        const daySchedules = gridBySlot[timeSlot][day] || [];
        if (daySchedules.length > 0) {
          endTime = daySchedules[0].endTime;
          break;
        }
      }

      const rowData = [`${formatTime(timeSlot)} - ${formatTime(endTime)}`];
      
      DAY_ORDER.forEach((day) => {
        const daySchedules = gridBySlot[timeSlot][day] || [];
        const cellContent = daySchedules
          .map((sched) => sched.teacher ? `${sched.subject}\n${sched.teacher}` : sched.subject)
          .join('\n\n');
        rowData.push(cellContent || '');
      });

      const dataRow = worksheet.addRow(rowData);
      dataRow.eachCell((cell, colNumber) => {
        cell.alignment = { horizontal: 'center', vertical: 'top', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFcccccc' } },
          left: { style: 'thin', color: { argb: 'FFcccccc' } },
          bottom: { style: 'thin', color: { argb: 'FFcccccc' } },
          right: { style: 'thin', color: { argb: 'FFcccccc' } },
        };
        
        if (colNumber === 1) {
          cell.font = { bold: true, size: 11 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
        } else if (colNumber > 1) {
          cell.font = { bold: false, size: 11 };
        }
      });
      
      dataRow.height = 58;
    });

    // Set column widths
    worksheet.columns = [
      { width: 20 },
      { width: 25 },
      { width: 25 },
      { width: 25 },
      { width: 25 },
      { width: 25 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Schedule-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    alert('✓ Schedule downloaded successfully!');
  };

const handleDownloadSchedulePDF = () => {
  const pdf = new jsPDF('l', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 5;

  // Title
  pdf.setFontSize(16);
  pdf.setFont(undefined, 'bold');
  pdf.setTextColor(25, 118, 210);
  pdf.text('Class Schedule', margin, margin + 5);
  
  // Subtitle
  pdf.setFontSize(10);
  pdf.setFont(undefined, 'normal');
  pdf.setTextColor(100, 100, 100);
  pdf.text(`Generated on ${new Date().toLocaleDateString()}`, margin, margin + 11);

  // Build grid structure
  const gridBySlot = {};
  scheduleData.forEach((sched) => {
    if (!gridBySlot[sched.startTime]) {
      gridBySlot[sched.startTime] = {};
    }
    if (!gridBySlot[sched.startTime][sched.day]) {
      gridBySlot[sched.startTime][sched.day] = [];
    }
    gridBySlot[sched.startTime][sched.day].push(sched);
  });

  // Sort time slots
  const sortedTimeSlots = Object.keys(gridBySlot).sort((a, b) => {
    const [aH, aM] = a.split(':').map(Number);
    const [bH, bM] = b.split(':').map(Number);
    return aH * 60 + aM - (bH * 60 + bM);
  });

  const timeColWidth = 30;
  const colWidth = (pageWidth - 2 * margin - timeColWidth) / 5;
  const headerHeight = 10;
  const rowHeight = 15;

  let currentY = margin + 18;

  // Function to draw header
  const drawHeader = (y) => {
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'bold');
    pdf.setFillColor(25, 118, 210);
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.5);

    // Draw all rectangles first
    pdf.rect(margin, y, timeColWidth, headerHeight, 'F');
    let headerX = margin + timeColWidth;
    DAY_ORDER.forEach((day) => {
      pdf.rect(headerX, y, colWidth, headerHeight, 'F');
      headerX += colWidth;
    });

    // Draw text on top with white color
    pdf.setTextColor(255, 255, 255);
    pdf.text('Time', margin + timeColWidth / 2, y + 6.5, { align: 'center' });

    headerX = margin + timeColWidth;
    DAY_ORDER.forEach((day) => {
      pdf.text(day, headerX + colWidth / 2, y + 6.5, { align: 'center' });
      headerX += colWidth;
    });

    // Draw borders
    pdf.setDrawColor(0, 0, 0);
    pdf.rect(margin, y, timeColWidth, headerHeight, 'D');
    headerX = margin + timeColWidth;
    DAY_ORDER.forEach((day) => {
      pdf.rect(headerX, y, colWidth, headerHeight, 'D');
      headerX += colWidth;
    });
  };

  // Draw initial header
  drawHeader(currentY);
  currentY += headerHeight;

  // Draw rows
  pdf.setTextColor(0, 0, 0);
  pdf.setDrawColor(220, 220, 220);
  pdf.setLineWidth(0.1);

  sortedTimeSlots.forEach((timeSlot, idx) => {
    if (currentY + rowHeight > pageHeight - margin) {
      pdf.addPage();
      currentY = margin + 10;
      // Redraw header on new page - make sure text is white
      drawHeader(currentY);
      currentY += headerHeight;
    }

    // Get end time from first schedule at this time slot
    let endTime = timeSlot;
    for (const day of DAY_ORDER) {
      const daySchedules = gridBySlot[timeSlot][day] || [];
      if (daySchedules.length > 0) {
        endTime = daySchedules[0].endTime;
        break;
      }
    }

    // Time cell - with alternating row background
    pdf.setFillColor(idx % 2 === 0 ? 255 : 245, idx % 2 === 0 ? 255 : 245, idx % 2 === 0 ? 255 : 245);
    pdf.rect(margin, currentY, timeColWidth, rowHeight, 'FD');
    pdf.rect(margin, currentY, timeColWidth, rowHeight, 'D');
    pdf.setFont(undefined, 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(0, 0, 0);
    const timeRange = `${formatTime(timeSlot)} - ${formatTime(endTime)}`;
    const timeLines = pdf.splitTextToSize(timeRange, timeColWidth - 2);
    pdf.text(timeLines, margin + 1, currentY + 4);

    // Day cells
    let cellX = margin + timeColWidth;
    DAY_ORDER.forEach((day) => {
      pdf.setFillColor(idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 250);
      pdf.rect(cellX, currentY, colWidth, rowHeight, 'FD');
      pdf.rect(cellX, currentY, colWidth, rowHeight, 'D');
      
      const daySchedules = gridBySlot[timeSlot][day] || [];
      let cellY = currentY + 3;
      
      daySchedules.forEach((sched, schedIdx) => {
        // Subject name - bold and blue
        pdf.setFont(undefined, 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(21, 101, 192);
        const subjectLines = pdf.splitTextToSize(sched.subject, colWidth - 2);
        subjectLines.forEach((line) => {
          pdf.text(line, cellX + colWidth / 2, cellY, { align: 'center' });
          cellY += 3.5;
        });

        // Teacher name - smaller and gray
        if (sched.teacher) {
          pdf.setFont(undefined, 'normal');
          pdf.setFontSize(7);
          pdf.setTextColor(100, 100, 100);
          const teacherLines = pdf.splitTextToSize(sched.teacher, colWidth - 2);
          teacherLines.forEach((line) => {
            pdf.text(line, cellX + colWidth / 2, cellY, { align: 'center' });
            cellY += 2.8;
          });
        }
        
        // Add spacing between multiple sessions in same cell
        if (schedIdx < daySchedules.length - 1) {
          cellY += 2;
        }
      });

      cellX += colWidth;
    });

    pdf.setTextColor(0, 0, 0);
    currentY += rowHeight;
  });

  // Add footer with page number
  const pageCount = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 15, pageHeight - margin);
  }

  const pdfBlob = pdf.output('blob');
  const url = window.URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Schedule-${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);

  alert('✓ PDF schedule downloaded successfully!');
};

  return (
    <main className="student-schedule-main">
      {/* Header with View Toggle */}
      <section className="ss-section">
        <div className="ss-section-header">
          {loading ? (
            <>
              <div className="ssSkel ss-shimmer ssSkel__toggle" />
              <div className="ssSkel ss-shimmer ssSkel__export" />
            </>
          ) : (
            <>
              <div className="ss-view-toggle">
                <button
                  className={`ss-toggle-btn ${view === "calendar" ? "active" : ""}`}
                  onClick={() => setView("calendar")}
                >
                  <Calendar size={18} />
                  Timeline
                </button>
                <button
                  className={`ss-toggle-btn ${view === "table" ? "active" : ""}`}
                  onClick={() => setView("table")}
                >
                  <List size={18} />
                  Table
                </button>
              </div>
              <button
                className="ss-export-btn"
                onClick={handleExport}
              >
                <Download size={18} />
                Export
              </button>
            </>
          )}
        </div>
      </section>

      {/* Loading / Error */}
      {loading && (
        <section className="ss-section">
          <div className="ss-table-container ssSkel__tableContainer">
            <div className="ssSkel__gridHead">
              {[...Array(6)].map((_, idx) => (
                <div key={idx} className="ssSkel ss-shimmer ssSkel__line ssSkel__line--head" />
              ))}
            </div>
            {[...Array(6)].map((_, rowIdx) => (
              <div key={rowIdx} className="ssSkel__gridRow">
                {[...Array(6)].map((__, colIdx) => (
                  <div key={colIdx} className="ssSkel ss-shimmer ssSkel__line ssSkel__line--cell" />
                ))}
              </div>
            ))}
          </div>
        </section>
      )}
      {error && (
        <div className="ss-error">{error}</div>
      )}

      {!loading && !error && (
        <section className="ss-section">
          <div className="ss-table-container">
            {view === "table" ? (
              /* TABLE VIEW */
              <table className="ss-table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Day</th>
                    <th>Time</th>
                    <th>Room</th>
                    <th>Teacher</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleData.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="ss-empty-cell">
                        No schedules found for your section.
                      </td>
                    </tr>
                  ) : (
                    scheduleData.map((row) => (
                      <tr key={row.id}>
                        <td data-label="Subject">
                          <div className="ss-subject-info">
                            <span className="ss-subject-name">{row.subject}</span>
                            <span className="ss-subject-code">{row.subject_code}</span>
                          </div>
                        </td>
                        <td data-label="Day">
                          <span className="ss-day-badge">{row.day}</span>
                        </td>
                        <td data-label="Time" className="ss-time-cell">
                          <Clock size={14} />
                          {formatTime(row.startTime)} - {formatTime(row.endTime)}
                        </td>
                        <td data-label="Room">
                          <span className="ss-room-badge">
                            <MapPin size={14} />
                            {row.room}
                          </span>
                        </td>
                        <td data-label="Teacher">
                          <span className="ss-teacher-name">
                            <User size={14} />
                            {row.teacher}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              /* CALENDAR/TIMELINE VIEW */
              <div className="ss-calendar-scroll">
                <div className="ss-calendar-grid" style={{ gridTemplateColumns: `80px repeat(${DAY_ORDER.length}, 1fr)` }}>
                  {/* Header Row */}
                  <div className="ss-time-header">
                    <Clock size={16} />
                  </div>
                  {DAY_ORDER.map((day) => (
                    <div key={day} className="ss-day-header">{day}</div>
                  ))}

                  {/* Time Slot Rows */}
                  {timeSlots.length === 0 ? (
                    <div className="ss-empty-calendar" style={{ gridColumn: '1 / -1' }}>
                      No classes scheduled.
                    </div>
                  ) : (
                    timeSlots.map((time) => (
                      <React.Fragment key={time}>
                        <div className="ss-time-cell">{formatTime(time)}</div>
                        {DAY_ORDER.map((day) => {
                          const sessions = getSessionsForTimeSlot(day, time);
                          return (
                            <div key={`${day}-${time}`} className="ss-grid-cell">
                              {sessions.map((item) => (
                                <div key={item.id} className={`ss-event-card ${item.color}`}>
                                  <div className="ss-event-subject">{item.subject}</div>
                                  <div className="ss-event-code">{item.subject_code}</div>
                                  <div className="ss-event-info">
                                    <span><MapPin size={12} /> {item.room}</span>
                                    <span>{formatTime(item.startTime)} - {formatTime(item.endTime)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <PreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        title="Class Schedule"
        customPreview={previewData}
        data={[]}
        filename="Schedule"
        onDownloadExcel={handleDownloadScheduleExcel}
        onDownloadPDF={handleDownloadSchedulePDF}
      />
    </main>
  );
};

export default Schedule;
