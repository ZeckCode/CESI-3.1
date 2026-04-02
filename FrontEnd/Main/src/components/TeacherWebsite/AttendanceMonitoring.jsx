import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Save, Users, Calendar, CheckCircle, XCircle, Clock, BookOpen, History, Printer, Download } from "lucide-react";
import "../TeacherWebsiteCSS/AttendanceMonitoring.css";
import { apiFetch } from "../api/apiFetch";

const API = "";

const getStudentId = (student) =>
  student?.id ?? student?.student_id ?? student?.user_id ?? null;

const getStudentNumber = (student) =>
  String(student?.student_number || student?.lrn || "").trim();

const getStudentKey = (student) => {
  if (!student) return "";

  const studentNumber = getStudentNumber(student);
  if (studentNumber) return `num:${studentNumber.toLowerCase()}`;

  const username = String(student.username || "").trim();
  if (username) return `user:${username.toLowerCase()}`;

  const idValue = getStudentId(student);
  return idValue != null ? `id:${String(idValue).trim()}` : "";
};

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
  const [existingRecordsByStudent, setExistingRecordsByStudent] = useState({});
  const [existingRecordCount, setExistingRecordCount] = useState(0);

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

  useEffect(() => {
    if (!selectedSection || filteredSchedules.length === 0) {
      setSelectedSchedule("");
      return;
    }

    const hasCurrent = filteredSchedules.some((s) => String(s.id) === selectedSchedule);
    if (!hasCurrent) {
      setSelectedSchedule(String(filteredSchedules[0].id));
    }
  }, [filteredSchedules, selectedSection, selectedSchedule]);

  const fetchStudentsAndAttendance = useCallback(async () => {
    if (!selectedSection || !selectedSchedule) return;

    setLoading(true);
    try {
      const studentsRes = await apiFetch(
        `${API}/api/attendance/records/section_students/?section=${selectedSection}`
      );

      if (studentsRes.ok) {
        const studentsData = await studentsRes.json();
        const studentsArray = Array.isArray(studentsData) ? studentsData : [];
        const uniqueStudents = Object.values(
          studentsArray.reduce((acc, student) => {
            const key = getStudentKey(student);
            if (!key) return acc;
            if (!acc[key]) {
              acc[key] = student;
            } else {
              acc[key] = { ...acc[key], ...student };
            }
            return acc;
          }, {})
        );

        setStudents(uniqueStudents);

        const initialAttendance = {};
        const initialNotes = {};
        const idToKey = new Map();
        const numberToKey = new Map();
        uniqueStudents.forEach((s) => {
          const key = getStudentKey(s);
          const idValue = getStudentId(s);
          const studentNumber = getStudentNumber(s);
          if (!key) return;
          initialAttendance[key] = "PRESENT";
          initialNotes[key] = "";
          if (idValue != null) {
            idToKey.set(String(idValue), key);
          }
          if (studentNumber) {
            numberToKey.set(studentNumber.toLowerCase(), key);
          }
        });

        let url = `${API}/api/attendance/records/?section=${selectedSection}&date=${selectedDate}`;
        url += `&schedule=${selectedSchedule}&include_unlinked=1`;

        const attendanceRes = await apiFetch(url);
        if (attendanceRes.ok) {
          const existingData = await attendanceRes.json();
          const existingRecords = Array.isArray(existingData)
            ? existingData
            : Array.isArray(existingData?.results)
            ? existingData.results
            : [];
          const recordMap = {};

          existingRecords.forEach((rec) => {
            const studentIdRaw = rec?.student_id ?? rec?.student?.id ?? rec?.student;
            const studentId = studentIdRaw != null ? String(studentIdRaw) : null;
            const recStudentNumber = String(rec?.student_number || "").trim().toLowerCase();

            const key =
              (recStudentNumber && numberToKey.get(recStudentNumber)) ||
              idToKey.get(studentId || String(rec.student || ""));
            if (key && rec?.id != null) {
              recordMap[key] = rec.id;
            }
            if (key && Object.prototype.hasOwnProperty.call(initialAttendance, key)) {
              initialAttendance[key] = rec.status;
              initialNotes[key] = rec.notes || "";
            }
          });

          setExistingRecordsByStudent(recordMap);
          setExistingRecordCount(existingRecords.length);
        } else {
          setExistingRecordsByStudent({});
          setExistingRecordCount(0);
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

  const loadExistingRecords = useCallback(async () => {
    if (!selectedSection || !selectedSchedule) {
      return { existingRecords: [], recordMap: {} };
    }

    const idToKey = new Map();
    const numberToKey = new Map();
    students.forEach((student) => {
      const key = getStudentKey(student);
      if (!key) return;

      const idValue = getStudentId(student);
      const studentNumber = getStudentNumber(student);
      if (idValue != null) {
        idToKey.set(String(idValue), key);
      }
      if (studentNumber) {
        numberToKey.set(studentNumber.toLowerCase(), key);
      }
    });

    let url = `${API}/api/attendance/records/?section=${selectedSection}&date=${selectedDate}`;
    url += `&schedule=${selectedSchedule}&include_unlinked=1`;

    try {
      const res = await apiFetch(url);
      if (!res.ok) return { existingRecords: [], recordMap: {} };

      const existingData = await res.json();
      const existingRecords = Array.isArray(existingData)
        ? existingData
        : Array.isArray(existingData?.results)
        ? existingData.results
        : [];
      const recordMap = {};

      existingRecords.forEach((rec) => {
        const studentIdRaw = rec?.student_id ?? rec?.student?.id ?? rec?.student;
        const studentId = studentIdRaw != null ? String(studentIdRaw) : null;
        const recStudentNumber = String(rec?.student_number || "").trim().toLowerCase();

        const key =
          (recStudentNumber && numberToKey.get(recStudentNumber)) ||
          idToKey.get(studentId || String(rec.student || ""));
        if (key && rec?.id != null) {
          recordMap[key] = rec.id;
        }
      });

      return { existingRecords, recordMap };
    } catch (e) {
      console.error("Failed to refresh attendance records:", e);
      return { existingRecords: [], recordMap: {} };
    }
  }, [selectedSection, selectedSchedule, selectedDate, students]);

  useEffect(() => {
    if (!showHistory) return;
    fetchHistory();
  }, [showHistory, fetchHistory]);

  const updateStatus = (studentKey, newStatus) => {
    if (!studentKey) return;
    console.debug("updateStatus", studentKey, newStatus);
    setAttendance((prev) => ({ ...prev, [studentKey]: newStatus }));
  };

  const handleSave = async (updateOnly = false) => {
    const isUpdateOnly = updateOnly === true;
    if (loading) {
      setMessage({ type: "error", text: "Please wait for attendance data to finish loading." });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    if (!selectedSection || !selectedSchedule || students.length === 0) {
      setMessage({ type: "error", text: "Please select a subject schedule before saving attendance." });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    if (!isUpdateOnly && existingRecordCount > 0) {
      const proceed = window.confirm(
        "Attendance is already saved for this date. Saving again will overwrite existing statuses. Continue?"
      );
      if (!proceed) {
        setMessage({
          type: "error",
          text: "Save cancelled. Use History > Edit to update existing records.",
        });
        setTimeout(() => setMessage(null), 3000);
        return;
      }
    }

    setSaving(true);
    setMessage(null);

    try {
      const records = students
        .map((s) => {
          const studentId = getStudentId(s);
          const studentNumber = getStudentNumber(s);
          const studentKey = getStudentKey(s);
          if (!studentKey) return null;

          const baseRecord = {
            student_key: studentKey,
            status: attendance[studentKey] || "PRESENT",
            notes: notes[studentKey] || "",
          };

          if (studentNumber) {
            return {
              ...baseRecord,
              student_number: studentNumber,
            };
          }

          if (studentId != null) {
            return {
              ...baseRecord,
              student_id: studentId,
            };
          }

          return null;
        })
        .filter(Boolean);

      const recordsPayload = records.map(({ student_key, ...payload }) => payload);

      const body = {
        section: parseInt(selectedSection, 10),
        date: selectedDate,
        records: recordsPayload,
        schedule: parseInt(selectedSchedule, 10),
      };

      console.debug("handleSave", { isUpdateOnly, body, existingRecordCount });

      if (isUpdateOnly) {
        const { existingRecords, recordMap } = await loadExistingRecords();
        setExistingRecordsByStudent(recordMap);
        setExistingRecordCount(existingRecords.length);

        if (existingRecords.length === 0) {
          setMessage({
            type: "error",
            text: "No saved records found for this date. Use Save Attendance to create records first.",
          });
          return;
        }

        let updates = records
          .filter((record) => recordMap[record.student_key])
          .map(({ student_key, ...payload }) => payload);

        let skippedCount = records.length - updates.length;

        // Matching can fail if key shapes changed (e.g. student_number migration)
        // while records still exist in backend. In that case, apply a safe upsert
        // update payload instead of blocking with a false negative.
        if (updates.length === 0 && existingRecords.length > 0) {
          updates = records.map(({ student_key, ...payload }) => payload);
          skippedCount = 0;
        }

        if (updates.length === 0) {
          setMessage({
            type: "error",
            text: "No matching records to update for this date.",
          });
          return;
        }

        const res = await apiFetch(`${API}/api/attendance/records/bulk_upsert/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...body,
            records: updates,
          }),
        });

        if (res.ok) {
          const result = await res.json();
          console.debug("bulk_upsert update result", result);
          const created = Number(result?.created || 0);
          const updated = Number(result?.updated || updates.length);
          const createdNote = created > 0 ? ` (${created} new record${created === 1 ? "" : "s"} added)` : "";
          const skippedNote = skippedCount > 0 ? `, ${skippedCount} skipped` : "";
          setMessage({
            type: "success",
            text: `Attendance updated: ${updated} updated${skippedNote}${createdNote}`,
          });
          setExistingRecordCount(created + updated);
          await fetchStudentsAndAttendance();
          if (showHistory) fetchHistory();
        } else {
          const err = await res.json().catch(() => ({}));
          const detail = err?.detail || err?.error || "Failed to update attendance";
          if (res.status === 401) {
            setMessage({
              type: "error",
              text: "Session expired or missing. Please log in again, then retry update.",
            });
          } else {
            setMessage({ type: "error", text: detail });
          }
        }
      } else {
        const res = await apiFetch(`${API}/api/attendance/records/bulk_upsert/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const result = await res.json();
          console.debug("bulk_upsert save result", result);
          const created = Number(result?.created || 0);
          const updated = Number(result?.updated || 0);
          setMessage({ type: "success", text: result.message || "Attendance saved successfully!" });
          setExistingRecordCount(created + updated);
          await fetchStudentsAndAttendance();
          if (showHistory) fetchHistory();
        } else {
          const err = await res.json().catch(() => ({}));
          const detail = err?.detail || err?.error || "Failed to save attendance";
          if (res.status === 401) {
            setMessage({
              type: "error",
              text: "Session expired or missing. Please log in again, then retry save.",
            });
          } else {
            setMessage({ type: "error", text: detail });
          }
        }
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

  const handlePrintAttendance = () => {
    const printWindow = window.open("", "", "width=1000,height=800");
    
    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const attendanceTableHTML = students
      .map((student, idx) => {
        const studentKey = getStudentKey(student);
        const status = attendance[studentKey] || "PRESENT";
        const statusColor = {
          PRESENT: "#047857",
          ABSENT: "#dc2626",
          LATE: "#f59e0b",
          EXCUSED: "#0891b2",
        }[status] || "#6b7280";

        return `
          <tr>
            <td>${idx + 1}</td>
            <td>${student.name}</td>
            <td>${student.username}</td>
            <td style="text-align: center;">
              <span style="display: inline-block; background: ${statusColor}; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                ${status}
              </span>
            </td>
            <td>${notes[studentKey] || "-"}</td>
          </tr>
        `;
      })
      .join("");

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Attendance Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: white;
      color: #1f2937;
      line-height: 1.6;
    }

    .print-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px;
    }

    .print-header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 2px solid #1f2937;
      padding-bottom: 20px;
    }

    .print-header h1 {
      font-size: 28px;
      font-weight: 800;
      margin-bottom: 8px;
      letter-spacing: -0.5px;
    }

    .print-header .metadata {
      display: flex;
      justify-content: center;
      gap: 30px;
      font-size: 13px;
      color: #6b7280;
      margin-top: 12px;
      flex-wrap: wrap;
    }

    .metadata-item {
      display: flex;
      gap: 4px;
      align-items: center;
    }

    .metadata-label {
      font-weight: 600;
      color: #1f2937;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 15px;
      margin-bottom: 30px;
    }

    .stat-card {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      background: #f3f4f6;
      text-align: center;
    }

    .stat-card .label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #6b7280;
      margin-bottom: 4px;
    }

    .stat-card .value {
      font-size: 20px;
      font-weight: 700;
      color: #1f2937;
    }

    .section-title {
      font-size: 14px;
      font-weight: 700;
      margin: 20px 0 12px 0;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #1f2937;
      border-bottom: 2px solid #5ba3c7;
      padding-bottom: 8px;
    }

    .table-wrapper {
      margin-bottom: 30px;
      overflow: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
    }

    th {
      background: #1f2937;
      color: white;
      padding: 12px 14px;
      text-align: left;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    td {
      padding: 10px 14px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
      font-size: 13px;
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:nth-child(even) {
      background: #f9fafb;
    }

    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 12px;
    }

    @media print {
      body {
        background: white;
      }
      .print-container {
        padding: 20px;
      }
      .stats-grid {
        page-break-inside: avoid;
      }
      .table-wrapper {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="print-container">
    <div class="print-header">
      <h1>ATTENDANCE REPORT</h1>
      <div class="metadata">
        <div class="metadata-item">
          <span class="metadata-label">Section:</span>
          <span>${currentSectionLabel || "N/A"}</span>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Subject:</span>
          <span>${currentSchedule?.subject?.name || currentSchedule?.subject_name || "N/A"}</span>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Date:</span>
          <span>${selectedDate}</span>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Generated:</span>
          <span>${currentDate}</span>
        </div>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="label">Total Students</div>
        <div class="value">${counts.total}</div>
      </div>
      <div class="stat-card">
        <div class="label">Present</div>
        <div class="value" style="color: #047857;">${counts.present}</div>
      </div>
      <div class="stat-card">
        <div class="label">Absent</div>
        <div class="value" style="color: #dc2626;">${counts.absent}</div>
      </div>
      <div class="stat-card">
        <div class="label">Late</div>
        <div class="value" style="color: #f59e0b;">${counts.late}</div>
      </div>
      <div class="stat-card">
        <div class="label">Excused</div>
        <div class="value" style="color: #0891b2;">${counts.excused}</div>
      </div>
    </div>

    <div class="section-title">ATTENDANCE DETAILS</div>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Student Name</th>
            <th>Student ID</th>
            <th>Status</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${attendanceTableHTML || "<tr><td colspan='5' style='text-align: center; color: #6b7280;'>No students recorded</td></tr>"}
        </tbody>
      </table>
    </div>

    <div class="footer">
      <p>This attendance report is confidential and for official use only.</p>
    </div>
  </div>
</body>
</html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
    }, 250);
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
                    {!selectedSection
                      ? "Please select a section."
                      : !selectedSchedule
                      ? "Please select a subject schedule."
                      : "No students enrolled in this section."}
                  </td>
                </tr>
              ) : (
                students.map((student, idx) => {
                  const studentKey = getStudentKey(student);
                  const statusValue = attendance[studentKey] || "PRESENT";
                  return (
                    <tr className="am__tr" key={studentKey || student.id || idx}>
                      <td className="am__td am__td--left am__td--num">{idx + 1}</td>
                      <td className="am__td am__td--left">
                        <div className="am__name">{student.name}</div>
                        <div className="am__id">{student.username}</div>
                      </td>

                      <td className="am__td">
                        <span
                          className={`am__badge am__badge--${statusValue?.toLowerCase()}`}
                        >
                          {statusValue}
                        </span>
                      </td>

                      <td className="am__td">
                        <div className="am__toggle">
                          <button
                            type="button"
                            onClick={() => updateStatus(studentKey, "PRESENT")}
                            className={`am__toggleBtn ${
                              statusValue === "PRESENT" ? "am__toggleBtn--present" : "am__toggleBtn--idle"
                            }`}
                            title="Present"
                          >
                            P
                          </button>
                          <button
                            type="button"
                            onClick={() => updateStatus(studentKey, "ABSENT")}
                            className={`am__toggleBtn ${
                              statusValue === "ABSENT" ? "am__toggleBtn--absent" : "am__toggleBtn--idle"
                            }`}
                            title="Absent"
                          >
                            A
                          </button>
                          <button
                            type="button"
                            onClick={() => updateStatus(studentKey, "LATE")}
                            className={`am__toggleBtn ${
                              statusValue === "LATE" ? "am__toggleBtn--late" : "am__toggleBtn--idle"
                            }`}
                            title="Late"
                          >
                            L
                          </button>
                          <button
                            type="button"
                            onClick={() => updateStatus(studentKey, "EXCUSED")}
                            className={`am__toggleBtn ${
                              statusValue === "EXCUSED" ? "am__toggleBtn--excused" : "am__toggleBtn--idle"
                            }`}
                            title="Excused"
                          >
                            E
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
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
         
          <p className="am__title">
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
            onChange={(e) => setSelectedSection(e.target.value)}
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
              <option value="">Select Subject</option>
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
            className="am__saveBtn am__saveBtn--ghost"
            type="button"
            onClick={handlePrintAttendance}
            disabled={!selectedSection || students.length === 0}
            title="Print attendance report"
          >
            <Printer size={16} />
            Print
          </button>

          <button
            className="am__saveBtn"
            type="button"
            onClick={() => handleSave(false)}
            disabled={loading || saving || !selectedSection || !selectedSchedule || students.length === 0}
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
                  onClick={() => handleSave(true)}
                  disabled={loading || saving || !selectedSection || students.length === 0}
                >
                  <Save size={16} />
                  {saving ? "Saving..." : "Update Attendance"}
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