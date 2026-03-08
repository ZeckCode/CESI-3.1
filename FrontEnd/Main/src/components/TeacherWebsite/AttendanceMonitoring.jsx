import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Save, Users, Calendar, CheckCircle, XCircle, Clock, BookOpen } from "lucide-react";
import "../TeacherWebsiteCSS/AttendanceMonitoring.css";
import { apiFetch } from "../api/apiFetch";

const API = "";

const AttendanceMonitoring = () => {
  // ── Filters ──
  const [sections, setSections] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedSchedule, setSelectedSchedule] = useState(""); // optional per-subject
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0]; // YYYY-MM-DD
  });

  // ── Data ──
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({}); // { [studentId]: status }
  const [notes, setNotes] = useState({}); // { [studentId]: note }
  
  // ── UI State ──
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // ─── Fetch teacher's sections on mount ───
  useEffect(() => {
    (async () => {
      try {
        const [sectionsRes, schedulesRes] = await Promise.all([
          apiFetch(`${API}/api/attendance/my-sections/`),
          apiFetch(`${API}/api/classmanagement/schedules/my/`),
        ]);
        
        if (sectionsRes.ok) {
          const data = await sectionsRes.json();
          setSections(data);
          if (data.length > 0) setSelectedSection(String(data[0].id));
        }
        
        if (schedulesRes.ok) {
          const schedData = await schedulesRes.json();
          setSchedules(schedData);
        }
      } catch (e) {
        console.error("Failed to load sections:", e);
      }
    })();
  }, []);

  // ─── Filter schedules by selected section ───
  const filteredSchedules = useMemo(() => {
    if (!selectedSection) return [];
    return schedules.filter((s) => String(s.section?.id || s.section) === selectedSection);
  }, [schedules, selectedSection]);

  // ─── Fetch students + existing attendance when section/date/schedule changes ───
  const fetchStudentsAndAttendance = useCallback(async () => {
    if (!selectedSection) return;
    
    setLoading(true);
    try {
      // Fetch students in section
      const studentsRes = await apiFetch(
        `${API}/api/attendance/records/section_students/?section=${selectedSection}`
      );
      
      if (studentsRes.ok) {
        const studentsData = await studentsRes.json();
        setStudents(studentsData);
        
        // Initialize all as PRESENT by default
        const initialAttendance = {};
        const initialNotes = {};
        studentsData.forEach((s) => {
          initialAttendance[s.id] = "PRESENT";
          initialNotes[s.id] = "";
        });
        
        // Fetch existing attendance for this date
        let url = `${API}/api/attendance/records/?section=${selectedSection}&date=${selectedDate}`;
        if (selectedSchedule) {
          url += `&schedule=${selectedSchedule}`;
        }
        
        const attendanceRes = await apiFetch(url);
        if (attendanceRes.ok) {
          const existingRecords = await attendanceRes.json();
          existingRecords.forEach((rec) => {
            if (initialAttendance.hasOwnProperty(rec.student)) {
              initialAttendance[rec.student] = rec.status;
              initialNotes[rec.student] = rec.notes || "";
            }
          });
        }
        
        setAttendance(initialAttendance);
        setNotes(initialNotes);
      }
    } catch (e) {
      console.error("Failed to fetch students:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedSection, selectedDate, selectedSchedule]);

  useEffect(() => {
    fetchStudentsAndAttendance();
  }, [fetchStudentsAndAttendance]);

  // ─── Update status ───
  const updateStatus = (studentId, newStatus) => {
    setAttendance((prev) => ({ ...prev, [studentId]: newStatus }));
  };

  // ─── Save Attendance ───
  const handleSave = async () => {
    if (!selectedSection || students.length === 0) return;
    
    setSaving(true);
    setMessage(null);
    
    try {
      const records = students.map((s) => ({
        student_id: s.id,
        status: attendance[s.id] || "PRESENT",
        notes: notes[s.id] || "",
      }));
      
      const body = {
        section: parseInt(selectedSection),
        date: selectedDate,
        records,
      };
      
      // Add schedule if per-subject attendance
      if (selectedSchedule) {
        body.schedule = parseInt(selectedSchedule);
      }
      
      const res = await apiFetch(`${API}/api/attendance/records/bulk_upsert/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      
      if (res.ok) {
        const result = await res.json();
        setMessage({ type: "success", text: result.message || "Attendance saved successfully!" });
      } else {
        setMessage({ type: "error", text: "Failed to save attendance" });
      }
    } catch (e) {
      console.error("Save error:", e);
      setMessage({ type: "error", text: "An error occurred while saving" });
    } finally {
      setSaving(false);
      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    }
  };

  // ─── Stats ───
  const counts = useMemo(() => {
    const values = Object.values(attendance);
    return {
      present: values.filter((s) => s === "PRESENT").length,
      absent: values.filter((s) => s === "ABSENT").length,
      late: values.filter((s) => s === "LATE").length,
      total: values.length,
    };
  }, [attendance]);

  // ─── Get current section name ───
  const currentSection = sections.find((s) => String(s.id) === selectedSection);
  const currentSchedule = schedules.find((s) => String(s.id) === selectedSchedule);

  return (
    <div className="am">
      {/* ════ Header ════ */}
      <header className="am__header">
        <div className="am__headerLeft">
          <h2 className="am__title">Attendance Monitoring</h2>
          <p className="am__subtitle">
            {currentSection && <span className="am__sectionTag">{currentSection.name}</span>}
            {currentSchedule && (
              <>
                {" · "}
                <span className="am__scheduleTag">
                  <BookOpen size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
                  {currentSchedule.subject?.name || currentSchedule.subject_name}
                </span>
              </>
            )}
          </p>
        </div>

        <div className="am__headerRight">
          {/* Date Picker */}
          <div className="am__dateWrap">
            <Calendar size={16} className="am__dateIcon" />
            <input
              type="date"
              className="am__dateInput"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          {/* Section Select */}
          <select
            className="am__select"
            value={selectedSection}
            onChange={(e) => {
              setSelectedSection(e.target.value);
              setSelectedSchedule(""); // Reset schedule when section changes
            }}
          >
            <option value="">Select Section</option>
            {sections.map((sec) => (
              <option key={sec.id} value={sec.id}>
                {sec.name}
              </option>
            ))}
          </select>

          {/* Schedule (Subject) Select - Optional */}
          {filteredSchedules.length > 0 && (
            <select
              className="am__select am__select--schedule"
              value={selectedSchedule}
              onChange={(e) => setSelectedSchedule(e.target.value)}
            >
              <option value="">All Subjects (General)</option>
              {filteredSchedules.map((sched) => (
                <option key={sched.id} value={sched.id}>
                  {sched.subject?.name || sched.subject_name} ({sched.day_of_week} {sched.start_time?.slice(0, 5)})
                </option>
              ))}
            </select>
          )}

          {/* Save Button */}
          <button
            className="am__saveBtn"
            type="button"
            onClick={handleSave}
            disabled={saving || !selectedSection || students.length === 0}
          >
            <Save size={16} />
            {saving ? "Saving..." : "Save Attendance"}
          </button>
        </div>
      </header>

      {/* ════ Message ════ */}
      {message && (
        <div className={`am__message am__message--${message.type}`}>
          {message.type === "success" ? <CheckCircle size={18} /> : <XCircle size={18} />}
          {message.text}
        </div>
      )}

      {/* ════ Stats ════ */}
      <section className="am__stats">
        <div className="stat stat--total">
          <div className="stat__icon"><Users size={20} /></div>
          <div className="stat__content">
            <div className="stat__label">TOTAL</div>
            <div className="stat__value">{counts.total}</div>
          </div>
        </div>

        <div className="stat stat--present">
          <div className="stat__icon"><CheckCircle size={20} /></div>
          <div className="stat__content">
            <div className="stat__label">PRESENT</div>
            <div className="stat__value stat__value--success">{counts.present}</div>
          </div>
        </div>

        <div className="stat stat--absent">
          <div className="stat__icon"><XCircle size={20} /></div>
          <div className="stat__content">
            <div className="stat__label">ABSENT</div>
            <div className="stat__value stat__value--danger">{counts.absent}</div>
          </div>
        </div>

        <div className="stat stat--late">
          <div className="stat__icon"><Clock size={20} /></div>
          <div className="stat__content">
            <div className="stat__label">LATE</div>
            <div className="stat__value stat__value--warn">{counts.late}</div>
          </div>
        </div>
      </section>

      {/* ════ Table ════ */}
      <section className="am__card">
        {loading ? (
          <div className="am__loading">Loading students...</div>
        ) : (
          <div className="am__tableWrap">
            <table className="am__table">
              <thead>
                <tr>
                  <th className="am__th am__th--left">#</th>
                  <th className="am__th am__th--left">Student Name</th>
                  <th className="am__th">Status</th>
                  <th className="am__th">Action</th>
                </tr>
              </thead>

              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td className="am__td am__empty" colSpan={4}>
                      {selectedSection ? "No students enrolled in this section." : "Please select a section."}
                    </td>
                  </tr>
                ) : (
                  students.map((student, idx) => (
                    <tr className="am__tr" key={student.id}>
                      <td className="am__td am__td--left am__td--num">{idx + 1}</td>
                      <td className="am__td am__td--left">
                        <div className="am__name">{student.name}</div>
                        <div className="am__id">{student.username}</div>
                      </td>

                      <td className="am__td">
                        <span
                          className={`am__badge am__badge--${attendance[student.id]?.toLowerCase()}`}
                        >
                          {attendance[student.id]}
                        </span>
                      </td>

                      <td className="am__td">
                        <div className="am__toggle">
                          <button
                            type="button"
                            onClick={() => updateStatus(student.id, "PRESENT")}
                            className={`am__toggleBtn ${
                              attendance[student.id] === "PRESENT" ? "am__toggleBtn--present" : "am__toggleBtn--idle"
                            }`}
                            title="Present"
                          >
                            P
                          </button>
                          <button
                            type="button"
                            onClick={() => updateStatus(student.id, "ABSENT")}
                            className={`am__toggleBtn ${
                              attendance[student.id] === "ABSENT" ? "am__toggleBtn--absent" : "am__toggleBtn--idle"
                            }`}
                            title="Absent"
                          >
                            A
                          </button>
                          <button
                            type="button"
                            onClick={() => updateStatus(student.id, "LATE")}
                            className={`am__toggleBtn ${
                              attendance[student.id] === "LATE" ? "am__toggleBtn--late" : "am__toggleBtn--idle"
                            }`}
                            title="Late"
                          >
                            L
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default AttendanceMonitoring;
