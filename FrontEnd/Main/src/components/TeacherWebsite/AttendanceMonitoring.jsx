import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Save, Users, Calendar, CheckCircle, XCircle, Clock, BookOpen, History } from "lucide-react";
import "../TeacherWebsiteCSS/AttendanceMonitoring.css";
import { apiFetch } from "../api/apiFetch";

const API = "";

const getGradeSource = (obj) =>
  obj?.grade_level ??
  obj?.grade ??
  obj?.grade_code ??
  obj?.gradeLevel ??
  obj?.grade_level_display ??
  "";

const normalizeGradeCode = (value) => {
  if (value === null || value === undefined) return "";

  let v = String(value).trim().toLowerCase();
  v = v.replace(/_/g, " ").replace(/\s+/g, " ").trim();

  if (v.startsWith("grade ")) {
    const rest = v.slice(6).trim();

    if (rest === "kinder") return "kinder";
    if (rest === "pre-kinder" || rest === "prek" || rest === "pre kinder") return "prek";
    if (/^\d$/.test(rest)) return `grade${rest}`;
    if (/^grade\s*\d$/.test(rest)) return rest.replace(/\s+/g, "");
    if (/^grade\d$/.test(rest)) return rest;
  }

  if (/^g\s*\d$/.test(v)) {
    return `grade${v.replace(/[^\d]/g, "")}`;
  }

  if (/^grade\s*\d$/.test(v)) {
    return v.replace(/\s+/g, "");
  }

  const map = {
    "0": "kinder",
    "1": "grade1",
    "2": "grade2",
    "3": "grade3",
    "4": "grade4",
    "5": "grade5",
    "6": "grade6",
    kinder: "kinder",
    grade1: "grade1",
    grade2: "grade2",
    grade3: "grade3",
    grade4: "grade4",
    grade5: "grade5",
    grade6: "grade6",
    "grade 1": "grade1",
    "grade 2": "grade2",
    "grade 3": "grade3",
    "grade 4": "grade4",
    "grade 5": "grade5",
    "grade 6": "grade6",
    prek: "prek",
    "pre-kinder": "prek",
    "pre kinder": "prek",
  };

  return map[v] || "";
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

  return fullLabels[code] || "—";
};

const AttendanceMonitoring = () => {
  // ── Filters ──
  const [sections, setSections] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedSchedule, setSelectedSchedule] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  // ── Data ──
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [notes, setNotes] = useState({});

  // ── UI State ──
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRows, setHistoryRows] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [sectionsRes, schedulesRes] = await Promise.all([
          apiFetch(`${API}/api/attendance/my-sections/`),
          apiFetch(`${API}/api/classmanagement/schedules/my/`),
        ]);

        if (sectionsRes.ok) {
          const data = await sectionsRes.json();
          const nextSections = Array.isArray(data) ? data : [];
          setSections(nextSections);
          if (nextSections.length > 0) setSelectedSection(String(nextSections[0].id));
        }

        if (schedulesRes.ok) {
          const schedData = await schedulesRes.json();
          setSchedules(Array.isArray(schedData) ? schedData : []);
        }
      } catch (e) {
        console.error("Failed to load sections:", e);
      }
    })();
  }, []);

  const filteredSchedules = useMemo(() => {
    if (!selectedSection) return [];
    return schedules.filter((s) => String(s.section?.id || s.section) === selectedSection);
  }, [schedules, selectedSection]);

  const fetchStudentsAndAttendance = useCallback(async () => {
    if (!selectedSection) return;

    setLoading(true);
    try {
      const studentsRes = await apiFetch(
        `${API}/api/attendance/records/section_students/?section=${selectedSection}`
      );

      if (studentsRes.ok) {
        const studentsData = await studentsRes.json();
        setStudents(Array.isArray(studentsData) ? studentsData : []);

        const initialAttendance = {};
        const initialNotes = {};
        studentsData.forEach((s) => {
          initialAttendance[s.id] = "PRESENT";
          initialNotes[s.id] = "";
        });

        let url = `${API}/api/attendance/records/?section=${selectedSection}&date=${selectedDate}`;
        if (selectedSchedule) {
          url += `&schedule=${selectedSchedule}`;
        }

        const attendanceRes = await apiFetch(url);
        if (attendanceRes.ok) {
          const existingRecords = await attendanceRes.json();
          existingRecords.forEach((rec) => {
            if (Object.prototype.hasOwnProperty.call(initialAttendance, rec.student)) {
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

  useEffect(() => {
    if (!selectedSection) {
      setShowEditModal(false);
    }
  }, [selectedSection]);

  const fetchHistory = useCallback(async () => {
    if (!selectedSection) {
      setHistoryRows([]);
      return;
    }
    setHistoryLoading(true);
    try {
      let url = `${API}/api/attendance/records/history/?section=${selectedSection}`;
      if (selectedSchedule) url += `&schedule=${selectedSchedule}`;
      const res = await apiFetch(url);
      if (res.ok) {
        const data = await res.json();
        setHistoryRows(Array.isArray(data) ? data : []);
      } else {
        setHistoryRows([]);
      }
    } catch (e) {
      console.error("Failed to load attendance history:", e);
      setHistoryRows([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [selectedSection, selectedSchedule]);

  useEffect(() => {
    if (!showHistory) return;
    fetchHistory();
  }, [showHistory, fetchHistory]);

  const updateStatus = (studentId, newStatus) => {
    setAttendance((prev) => ({ ...prev, [studentId]: newStatus }));
  };

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
        section: parseInt(selectedSection, 10),
        date: selectedDate,
        records,
      };

      if (selectedSchedule) {
        body.schedule = parseInt(selectedSchedule, 10);
      }

      const res = await apiFetch(`${API}/api/attendance/records/bulk_upsert/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const result = await res.json();
        setMessage({ type: "success", text: result.message || "Attendance saved successfully!" });
        if (showHistory) fetchHistory();
      } else {
        setMessage({ type: "error", text: "Failed to save attendance" });
      }
    } catch (e) {
      console.error("Save error:", e);
      setMessage({ type: "error", text: "An error occurred while saving" });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const counts = useMemo(() => {
    const values = Object.values(attendance);
    return {
      present: values.filter((s) => s === "PRESENT").length,
      absent: values.filter((s) => s === "ABSENT").length,
      late: values.filter((s) => s === "LATE").length,
      excused: values.filter((s) => s === "EXCUSED").length,
      total: values.length,
    };
  }, [attendance]);

  const currentSection = sections.find((s) => String(s.id) === selectedSection);
  const currentSchedule = schedules.find((s) => String(s.id) === selectedSchedule);
  const currentSectionLabel = currentSection
    ? `${GRADE_FULL_LABEL(getGradeSource(currentSection))} - ${currentSection.name}`
    : "";
  const isTodaySelected = selectedDate === new Date().toISOString().split("T")[0];

  const openHistoryEdit = (date) => {
    setSelectedDate(date);
    setShowHistory(false);
    setShowEditModal(true);
  };

  const attendanceTable = (
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
                        <button
                          type="button"
                          onClick={() => updateStatus(student.id, "EXCUSED")}
                          className={`am__toggleBtn ${
                            attendance[student.id] === "EXCUSED" ? "am__toggleBtn--excused" : "am__toggleBtn--idle"
                          }`}
                          title="Excused"
                        >
                          E
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
  );

  return (
    <div className="am">
      <header className="am__header">
        <div className="am__headerLeft">
          <h2 className="am__title">Attendance Monitoring</h2>
          <p className="am__subtitle">
            {currentSection && <span className="am__sectionTag">{currentSectionLabel}</span>}
            {currentSchedule && (
              <>
                {" · "}
                <span className="am__scheduleTag">
                  <BookOpen size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
                  {currentSchedule.subject?.name || currentSchedule.subject_name}
                </span>
              </>
            )}
            {selectedSection && (
              <>
                {" · "}
                <span className="am__dateTag">
                  Editing: {selectedDate}{isTodaySelected ? " (Today)" : ""}
                </span>
              </>
            )}
          </p>
        </div>

        <div className="am__headerRight">
          <div className="am__dateWrap">
            <Calendar size={16} className="am__dateIcon" />
            <input
              type="date"
              className="am__dateInput"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <select
            className="am__select"
            value={selectedSection}
            onChange={(e) => {
              setSelectedSection(e.target.value);
              setSelectedSchedule("");
            }}
          >
            <option value="">Select Section</option>
            {sections.map((sec) => (
              <option key={sec.id} value={sec.id}>
                {GRADE_FULL_LABEL(getGradeSource(sec))} - {sec.name}
              </option>
            ))}
          </select>

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

          <button
            className="am__saveBtn am__saveBtn--ghost"
            type="button"
            onClick={() => setShowHistory((prev) => !prev)}
            disabled={!selectedSection}
          >
            <History size={16} />
            {showHistory ? "Hide History" : "History"}
          </button>

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

      {message && (
        <div className={`am__message am__message--${message.type}`}>
          {message.type === "success" ? <CheckCircle size={18} /> : <XCircle size={18} />}
          {message.text}
        </div>
      )}

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

        <div className="stat stat--excused">
          <div className="stat__icon"><Clock size={20} /></div>
          <div className="stat__content">
            <div className="stat__label">EXCUSED</div>
            <div className="stat__value stat__value--warn">{counts.excused}</div>
          </div>
        </div>
      </section>

      {showHistory && (
        <div className="am__modalOverlay" onClick={() => setShowHistory(false)}>
          <section className="am__card am__historyCard am__historyModal" onClick={(e) => e.stopPropagation()}>
            <div className="am__historyHeader">
              <h3>Attendance History</h3>
              <div className="am__historyHeaderActions">
                <span className="am__historyHint">Click a date to load and edit its attendance records.</span>
                <button type="button" className="am__closeBtn" onClick={() => setShowHistory(false)}>Close</button>
              </div>
            </div>
            {historyLoading ? (
              <div className="am__loading">Loading history...</div>
            ) : historyRows.length === 0 ? (
              <div className="am__loading">No saved records yet for this filter.</div>
            ) : (
              <div className="am__tableWrap am__tableWrap--history">
                <table className="am__table">
                  <thead>
                    <tr>
                      <th className="am__th am__th--left">Date</th>
                      <th className="am__th">Present</th>
                      <th className="am__th">Absent</th>
                      <th className="am__th">Late</th>
                      <th className="am__th">Excused</th>
                      <th className="am__th">Total</th>
                      <th className="am__th">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRows.map((row) => (
                      <tr key={row.date} className="am__tr">
                        <td className="am__td am__td--left">{row.date}</td>
                        <td className="am__td">{row.present}</td>
                        <td className="am__td">{row.absent}</td>
                        <td className="am__td">{row.late}</td>
                        <td className="am__td">{row.excused || 0}</td>
                        <td className="am__td">{row.total}</td>
                        <td className="am__td">
                          <button
                            type="button"
                            className="am__toggleBtn am__toggleBtn--idle"
                            onClick={() => openHistoryEdit(row.date)}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {!showEditModal && attendanceTable}

      {showEditModal && (
        <div className="am__modalOverlay" onClick={() => setShowEditModal(false)}>
          <section className="am__card am__historyModal am__editModal" onClick={(e) => e.stopPropagation()}>
            <div className="am__historyHeader">
              <h3>Edit Attendance: {selectedDate}</h3>
              <div className="am__historyHeaderActions">
                <button
                  type="button"
                  className="am__saveBtn"
                  onClick={handleSave}
                  disabled={saving || !selectedSection || students.length === 0}
                >
                  <Save size={16} />
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button type="button" className="am__closeBtn" onClick={() => setShowEditModal(false)}>
                  Close
                </button>
              </div>
            </div>
            <div className="am__editBody">{attendanceTable}</div>
          </section>
        </div>
      )}
    </div>
  );
};

export default AttendanceMonitoring;