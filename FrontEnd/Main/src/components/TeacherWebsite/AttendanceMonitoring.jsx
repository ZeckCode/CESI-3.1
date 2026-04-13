import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Save, Users, Calendar, CheckCircle, XCircle, Clock, BookOpen, History, Printer, Download } from "lucide-react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import "../TeacherWebsiteCSS/AttendanceMonitoring.css";
import { apiFetch } from "../api/apiFetch";
import PreviewModal from "../PreviewModal";

const API = "";

const getStudentId = (student) =>
  student?.id ?? student?.student_id ?? student?.user_id ?? null;

const getStudentNumber = (student) =>
  String(student?.student_number || student?.lrn || "").trim();

const getScheduleSubjectId = (schedule) => {
  const raw = schedule?.subject?.id ?? schedule?.subject_id ?? schedule?.subject;
  if (raw === null || raw === undefined || raw === "") return null;

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const getScheduleSubjectName = (schedule) => {
  const name = schedule?.subject?.name || schedule?.subject_name;
  return String(name || "").trim() || "Unknown Subject";
};

const formatStudentName = (student) => {
  const name = student?.name || "N/A";
  const parts = name.trim().split(/\s+/);
  
  if (parts.length === 0) return "N/A";
  if (parts.length === 1) return parts[0]; // Single name, return as-is
  
  // Multiple parts: treat last part as surname, rest as first/middle names
  const surname = parts[parts.length - 1];
  const firstNames = parts.slice(0, -1).join(" ");
  
  return `${surname}, ${firstNames}`;
};

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
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
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
  const [attendancePreviewOpen, setAttendancePreviewOpen] = useState(false);
  const [attendancePreviewData, setAttendancePreviewData] = useState([]);
  const [monthlyPreviewContent, setMonthlyPreviewContent] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [sectionsRes, schedulesRes] = await Promise.all([
          apiFetch(`${API}/api/attendance/my-sections/`),
          apiFetch(`${API}/api/classmanagement/schedules/my/?include_free_period=0`),
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
    return schedules.filter((s) => {
      const isSectionMatch = String(s.section?.id || s.section) === selectedSection;
      const subjectId = getScheduleSubjectId(s);
      return isSectionMatch && subjectId !== null;
    });
  }, [schedules, selectedSection]);

  const uniqueSchedules = useMemo(() => {
    const subjectMap = new Map();
    filteredSchedules.forEach((sched) => {
      const subjectId = getScheduleSubjectId(sched);
      if (subjectId === null) return;

      if (!subjectMap.has(subjectId)) {
        subjectMap.set(subjectId, sched);
      }
    });
    return Array.from(subjectMap.values());
  }, [filteredSchedules]);

  useEffect(() => {
    if (!selectedSection || uniqueSchedules.length === 0) {
      setSelectedSchedule("");
      return;
    }

    const hasCurrent = uniqueSchedules.some((s) => String(s.id) === selectedSchedule);
    if (!hasCurrent) {
      setSelectedSchedule(String(uniqueSchedules[0].id));
    }
  }, [uniqueSchedules, selectedSection, selectedSchedule]);

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
          initialAttendance[key] = "";
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

    // Validate that selected date is not in the future
    const today = new Date();
    const selectedDateObj = new Date(selectedDate + "T00:00:00");
    if (selectedDateObj > today) {
      setMessage({ type: "error", text: "Cannot save attendance for future dates." });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    if (!selectedSection || !selectedSchedule || students.length === 0) {
      setMessage({ type: "error", text: "Please select a subject schedule before saving attendance." });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    if (counts.unmarked > 0) {
      setMessage({
        type: "error",
        text: `Please mark attendance for all students before saving. (${counts.unmarked} unmarked)`,
      });
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
            status: attendance[studentKey],
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

      console.debug("=== ATTENDANCE SAVE ===");
      console.debug("Selected Date (string):", selectedDate);
      const [savYr, savMo, savDy] = selectedDate.split("-");
      console.debug(`Parsed as: Year=${savYr}, Month=${savMo}, Day=${savDy}`);
      console.debug("Sending body:", body);

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

        const skippedCount = records.length - updates.length;

        if (updates.length === 0) {
          setMessage({
            type: "error",
            text: "No matching records to update for this date.",
          });
          return;
        }

        const res = await apiFetch(`${API}/api/attendance/records/bulk_update/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...body,
            records: updates,
          }),
        });

        if (res.ok) {
          const result = await res.json();
          console.debug("bulk_update result", result);
          const updated = Number(result?.updated || updates.length);
          const skipped = Number(result?.skipped ?? skippedCount);
          const skippedNote = skipped > 0 ? `, ${skipped} skipped` : "";
          setMessage({
            type: "success",
            text: `Attendance updated: ${updated} updated${skippedNote}`,
          });
          setExistingRecordCount(existingRecords.length);
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
      unmarked: values.filter((s) => !s).length,
      total: values.length,
    };
  }, [attendance]);

  const hasUnmarked = counts.unmarked > 0;

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
    try {
      // Parse date string without timezone conversion
      const [yearStr, monthStr, dayStr] = selectedDate.split("-");
      const month = parseInt(monthStr, 10) - 1; // Convert to 0-indexed
      const year = parseInt(yearStr, 10);
      
      const monthYear = new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" });
      
      // Get number of days in the month
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      // Filter to only weekdays (Monday-Friday), exclude Saturday (6) and Sunday (0)
      const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1).filter((day) => {
        const dayOfWeek = new Date(year, month, day).getDay();
        return dayOfWeek !== 0 && dayOfWeek !== 6; // Exclude Sunday (0) and Saturday (6)
      });
      
      // Fetch all historical records for this section to calculate totals
      (async () => {
        try {
          let historyUrl = `${API}/api/attendance/records/?section=${selectedSection}`;
          if (selectedSchedule) historyUrl += `&schedule=${selectedSchedule}`;
          
          const historyRes = await apiFetch(historyUrl);
          let allHistoricalRecords = [];
          
          if (historyRes.ok) {
            const historyData = await historyRes.json();
            allHistoricalRecords = Array.isArray(historyData) ? historyData : 
                                   Array.isArray(historyData?.results) ? historyData.results : [];
          }
          
          // Build a map of all records by student key for calculating totals
          const recordsByStudentKey = {};
          const attendanceByDay = {}; // Map attendance by student and day
          const idToKey = new Map();
          const numberToKey = new Map();
          
          students.forEach((s) => {
            const key = getStudentKey(s);
            if (!key) return;
            recordsByStudentKey[key] = [];
            attendanceByDay[key] = {}; // Initialize day map for each student
            
            const idValue = getStudentId(s);
            const studentNumber = getStudentNumber(s);
            if (idValue != null) {
              idToKey.set(String(idValue), key);
            }
            if (studentNumber) {
              numberToKey.set(studentNumber.toLowerCase(), key);
            }
          });
          
          // Assign records to students and build day map
          allHistoricalRecords.forEach((rec) => {
            const studentIdRaw = rec?.student_id ?? rec?.student?.id ?? rec?.student;
            const studentId = studentIdRaw != null ? String(studentIdRaw) : null;
            const recStudentNumber = String(rec?.student_number || "").trim().toLowerCase();
            
            const key = (recStudentNumber && numberToKey.get(recStudentNumber)) ||
                       idToKey.get(studentId || String(rec.student || ""));
            
            if (key && recordsByStudentKey[key]) {
              recordsByStudentKey[key].push(rec);
              
              // Extract day from record's date and map to attendance (parse string directly to avoid timezone issues)
              if (rec?.date) {
                // Parse date string "YYYY-MM-DD" directly without timezone conversion
                const [recYearStr, recMonthStr, recDayStr] = rec.date.split("-");
                const recYear = parseInt(recYearStr, 10);
                const recMonth = parseInt(recMonthStr, 10) - 1; // Convert to 0-indexed
                const recDay = parseInt(recDayStr, 10);
                
                console.debug(`Record date from backend: "${rec.date}" → Day=${recDay}, Month=${recMonth}, Year=${recYear}`);
                
                // Only include records from the same month/year as selectedDate
                if (recMonth === month && recYear === year) {
                  const statusLetter = rec.status?.charAt(0) || "";
                  attendanceByDay[key][recDay] = statusLetter;
                  console.debug(`Added attendance for student ${key}: Day ${recDay} = ${statusLetter}`);
                }
              }
            }
          });
          
          // Build custom preview component
          const customPreviewContent = (
            <div className="monthly-attendance-grid" style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
              <div style={{ marginBottom: "20px" }}>
                <h3 style={{ margin: "0 0 10px 0", fontSize: "18px" }}>MONTH OF: <span style={{ borderBottom: "1px solid #000", marginLeft: "10px", paddingBottom: "5px", display: "inline-block", minWidth: "200px" }}>{monthYear}</span></h3>
              </div>
              
              <div style={{ overflowX: "auto" }}>
                <table style={{ 
                  borderCollapse: "collapse", 
                  width: "100%",
                  border: "1px solid #000"
                }}>
                  <thead>
                    <tr>
                      <th style={{ 
                        backgroundColor: "#FFA500", 
                        padding: "8px", 
                        border: "1px solid #000",
                        fontWeight: "bold",
                        textAlign: "left",
                        minWidth: "150px"
                      }}>STUDENT NAME</th>
                      {daysArray.map((day) => {
                        const dayOfWeek = new Date(year, month, day).getDay();
                        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                        return (
                          <th key={day} style={{
                            backgroundColor: "#FFA500",
                            padding: "4px 3px",
                            border: "1px solid #000",
                            fontWeight: "bold",
                            textAlign: "center",
                            fontSize: "11px",
                            minWidth: "50px"
                          }}>
                            <div style={{ fontSize: "10px" }}>{dayNames[dayOfWeek].slice(0, 3)}</div>
                            <div style={{ fontSize: "12px", fontWeight: "bold" }}>{day}</div>
                          </th>
                        );
                      })}
                      <th style={{
                        backgroundColor: "#FFA500",
                        padding: "8px",
                        border: "1px solid #000",
                        fontWeight: "bold",
                        textAlign: "center",
                        fontSize: "12px",
                        minWidth: "80px"
                      }}>TOTAL ABSENT</th>
                      <th style={{
                        backgroundColor: "#FFA500",
                        padding: "8px",
                        border: "1px solid #000",
                        fontWeight: "bold",
                        textAlign: "center",
                        fontSize: "12px",
                        minWidth: "80px"
                      }}>TOTAL LATE</th>
                      <th style={{
                        backgroundColor: "#FFA500",
                        padding: "8px",
                        border: "1px solid #000",
                        fontWeight: "bold",
                        textAlign: "center",
                        fontSize: "12px",
                        minWidth: "80px"
                      }}>TOTAL PRESENT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student, idx) => {
                      const studentKey = getStudentKey(student);
                      
                      // Count absences, late, and presences from ONLY the current month
                      let totalAbsent = 0;
                      let totalLate = 0;
                      let totalPresent = 0;
                      const studentDayAttendance = attendanceByDay[studentKey] || {};
                      
                      // Count only from the current month's days
                      daysArray.forEach((day) => {
                        const status = studentDayAttendance[day];
                        if (status === "A") totalAbsent++;
                        if (status === "L") totalLate++;
                        if (status === "P" || status === "L") totalPresent++;
                      });
                      
                      return (
                        <tr key={studentKey || idx} style={{ backgroundColor: idx % 2 === 0 ? "#E8E8E8" : "#FFFFFF" }}>
                          <td style={{
                            padding: "8px",
                            border: "1px solid #000",
                            fontSize: "13px",
                            fontWeight: "500"
                          }}>
                            {formatStudentName(student)}
                          </td>
                          {daysArray.map((day) => {
                            const dayStatus = attendanceByDay[studentKey]?.[day] || "";
                            return (
                              <td key={day} style={{
                                padding: "6px 3px",
                                border: "1px solid #000",
                                textAlign: "center",
                                fontSize: "12px",
                                height: "25px",
                                fontWeight: dayStatus ? "bold" : "normal",
                                color: dayStatus === "A" ? "#d32f2f" : dayStatus === "P" ? "#388e3c" : "#000"
                              }}>
                                {dayStatus}
                              </td>
                            );
                          })}
                          <td style={{
                            padding: "8px",
                            border: "1px solid #000",
                            textAlign: "center",
                            fontSize: "13px",
                            fontWeight: "500"
                          }}>
                            {totalAbsent}
                          </td>
                          <td style={{
                            padding: "8px",
                            border: "1px solid #000",
                            textAlign: "center",
                            fontSize: "13px",
                            fontWeight: "500"
                          }}>
                            {totalLate}
                          </td>
                          <td style={{
                            padding: "8px",
                            border: "1px solid #000",
                            textAlign: "center",
                            fontSize: "13px",
                            fontWeight: "500"
                          }}>
                            {totalPresent}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              <div style={{ marginTop: "20px", fontSize: "12px" }}>
                <p><strong>Legend:</strong> P = Present | A = Absent | L = Late | E = Excused</p>
              </div>
            </div>
          );
          
          setAttendancePreviewData([]);
          setMonthlyPreviewContent(customPreviewContent);
          setAttendancePreviewOpen(true);
        } catch (err) {
          console.error("Error fetching historical records:", err);
          setMessage({ type: "error", text: "Failed to load attendance history for preview." });
        }
      })();
    } catch (err) {
      console.error("Error preparing attendance preview:", err);
      setMessage({ type: "error", text: "Failed to prepare attendance preview." });
    }
  };

  const handleDownloadAttendanceExcel = async () => {
    try {
      const [yearStr, monthStr] = selectedDate.split("-");
      const month = parseInt(monthStr, 10) - 1;
      const year = parseInt(yearStr, 10);
      const monthYear = new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" });
      
      // Get number of days in the month and filter weekdays
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1).filter((day) => {
        const dayOfWeek = new Date(year, month, day).getDay();
        return dayOfWeek !== 0 && dayOfWeek !== 6;
      });
      
      // Fetch historical records
      let historyUrl = `${API}/api/attendance/records/?section=${selectedSection}`;
      if (selectedSchedule) historyUrl += `&schedule=${selectedSchedule}`;
      
      const historyRes = await apiFetch(historyUrl);
      let allHistoricalRecords = [];
      
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        allHistoricalRecords = Array.isArray(historyData) ? historyData : 
                               Array.isArray(historyData?.results) ? historyData.results : [];
      }
      
      // Build attendance map by student and day
      const attendanceByDay = {};
      const idToKey = new Map();
      const numberToKey = new Map();
      
      students.forEach((s) => {
        const key = getStudentKey(s);
        if (!key) return;
        attendanceByDay[key] = {};
        
        const idValue = getStudentId(s);
        const studentNumber = getStudentNumber(s);
        if (idValue != null) {
          idToKey.set(String(idValue), key);
        }
        if (studentNumber) {
          numberToKey.set(studentNumber.toLowerCase(), key);
        }
      });
      
      // Populate attendance from records
      allHistoricalRecords.forEach((rec) => {
        const studentIdRaw = rec?.student_id ?? rec?.student?.id ?? rec?.student;
        const studentId = studentIdRaw != null ? String(studentIdRaw) : null;
        const recStudentNumber = String(rec?.student_number || "").trim().toLowerCase();
        
        const key = (recStudentNumber && numberToKey.get(recStudentNumber)) ||
                   idToKey.get(studentId || String(rec.student || ""));
        
        if (key && rec?.date) {
          const [recYearStr, recMonthStr, recDayStr] = rec.date.split("-");
          const recYear = parseInt(recYearStr, 10);
          const recMonth = parseInt(recMonthStr, 10) - 1;
          const recDay = parseInt(recDayStr, 10);
          
          if (recMonth === month && recYear === year) {
            const statusLetter = rec.status?.charAt(0) || "";
            attendanceByDay[key][recDay] = statusLetter;
          }
        }
      });
      
      // Create workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(monthYear);
      
      // Define header style
      const headerStyle = {
        fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFA500" } },
        font: { bold: true, color: { argb: "FF000000" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" }
        }
      };
      
      // Data cell styles
      const leftAlignStyle = {
        alignment: { horizontal: "left", vertical: "center" },
        border: {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" }
        }
      };
      
      const centerAlignStyle = {
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" }
        }
      };
      
      const lightGrayStyle = {
        ...centerAlignStyle,
        fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E8E8" } }
      };
      
      const lightGrayLeftStyle = {
        ...leftAlignStyle,
        fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E8E8" } }
      };
      
      // Add header row
      const headers = ["STUDENT NAME"];
      daysArray.forEach((day) => {
        const dayOfWeek = new Date(year, month, day).getDay();
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const dayName = dayNames[dayOfWeek].slice(0, 3);
        headers.push(`${dayName} ${day}`);
      });
      headers.push("TOTAL ABSENT", "TOTAL LATE", "TOTAL PRESENT");
      
      const headerRow = worksheet.addRow(headers);
      headerRow.height = 25;
      headerRow.eachCell((cell) => {
        cell.style = headerStyle;
      });
      
      // Add data rows
      students.forEach((student, studentIdx) => {
        const studentKey = getStudentKey(student);
        const rowData = [formatStudentName(student)];
        
        // Add attendance for each day
        daysArray.forEach((day) => {
          rowData.push(attendanceByDay[studentKey]?.[day] || "");
        });
        
        // Calculate totals
        let totalAbsent = 0;
        let totalLate = 0;
        let totalPresent = 0;
        daysArray.forEach((day) => {
          const status = attendanceByDay[studentKey]?.[day];
          if (status === "A") totalAbsent++;
          if (status === "L") totalLate++;
          if (status === "P" || status === "L") totalPresent++;
        });
        
        rowData.push(totalAbsent, totalLate, totalPresent);
        
        const dataRow = worksheet.addRow(rowData);
        dataRow.height = 18;
        
        // Apply styles based on row index (alternating colors)
        const isEvenRow = studentIdx % 2 === 0;
        const nameStyle = isEvenRow ? lightGrayLeftStyle : leftAlignStyle;
        const dataStyle = isEvenRow ? lightGrayStyle : centerAlignStyle;
        
        // First cell (name) - left aligned
        dataRow.getCell(1).style = nameStyle;
        
        // Day cells and totals - center aligned
        for (let i = 2; i <= dataRow.cellCount; i++) {
          dataRow.getCell(i).style = dataStyle;
        }
      });
      
      // Set column widths
      worksheet.getColumn(1).width = 25; // STUDENT NAME
      daysArray.forEach((_, idx) => {
        worksheet.getColumn(idx + 2).width = 12; // Day columns
      });
      worksheet.getColumn(daysArray.length + 2).width = 14; // TOTAL ABSENT
      worksheet.getColumn(daysArray.length + 3).width = 12; // TOTAL LATE
      worksheet.getColumn(daysArray.length + 4).width = 14; // TOTAL PRESENT
      
      // Generate file
      const timestamp = new Date().toISOString().slice(0, 10);
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Monthly-Attendance-${currentSection?.name || "N/A"}_${timestamp}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);

      alert('✓ Attendance report downloaded successfully!');
    } catch (err) {
      console.error("Error downloading attendance Excel:", err);
      alert('Failed to download attendance report. Please try again.');
      throw err;
    }
  };

  const handleDownloadAttendancePDF = async () => {
    try {
      const [yearStr, monthStr] = selectedDate.split("-");
      const month = parseInt(monthStr, 10) - 1;
      const year = parseInt(yearStr, 10);
      const monthYear = new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" });
      
      // Get number of days in the month and filter weekdays
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1).filter((day) => {
        const dayOfWeek = new Date(year, month, day).getDay();
        return dayOfWeek !== 0 && dayOfWeek !== 6;
      });
      
      // Fetch historical records
      let historyUrl = `${API}/api/attendance/records/?section=${selectedSection}`;
      if (selectedSchedule) historyUrl += `&schedule=${selectedSchedule}`;
      
      const historyRes = await apiFetch(historyUrl);
      let allHistoricalRecords = [];
      
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        allHistoricalRecords = Array.isArray(historyData) ? historyData : 
                               Array.isArray(historyData?.results) ? historyData.results : [];
      }
      
      // Build attendance map by student and day
      const attendanceByDay = {};
      const idToKey = new Map();
      const numberToKey = new Map();
      
      students.forEach((s) => {
        const key = getStudentKey(s);
        if (!key) return;
        attendanceByDay[key] = {};
        
        const idValue = getStudentId(s);
        const studentNumber = getStudentNumber(s);
        if (idValue != null) {
          idToKey.set(String(idValue), key);
        }
        if (studentNumber) {
          numberToKey.set(studentNumber.toLowerCase(), key);
        }
      });
      
      // Populate attendance from records
      allHistoricalRecords.forEach((rec) => {
        const studentIdRaw = rec?.student_id ?? rec?.student?.id ?? rec?.student;
        const studentId = studentIdRaw != null ? String(studentIdRaw) : null;
        const recStudentNumber = String(rec?.student_number || "").trim().toLowerCase();
        
        const key = (recStudentNumber && numberToKey.get(recStudentNumber)) ||
                   idToKey.get(studentId || String(rec.student || ""));
        
        if (key && rec?.date) {
          const [recYearStr, recMonthStr, recDayStr] = rec.date.split("-");
          const recYear = parseInt(recYearStr, 10);
          const recMonth = parseInt(recMonthStr, 10) - 1;
          const recDay = parseInt(recDayStr, 10);
          
          if (recMonth === month && recYear === year) {
            const statusLetter = rec.status?.charAt(0) || "";
            attendanceByDay[key][recDay] = statusLetter;
          }
        }
      });
      
      // Create PDF document in landscape orientation
      const pdf = new jsPDF("l", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPosition = margin;
      
      // Add title and month
      pdf.setFontSize(16);
      pdf.setFont(undefined, "bold");
      pdf.text("Monthly Attendance Report", margin, yPosition);
      yPosition += 10;
      
      pdf.setFontSize(11);
      pdf.setFont(undefined, "normal");
      pdf.text(`Month: ${monthYear}`, margin, yPosition);
      pdf.text(`Section: ${currentSection?.name || "N/A"}`, margin, yPosition + 6);
      yPosition += 16;
      
      // Add legend
      pdf.setFontSize(9);
      pdf.text("P = Present | A = Absent | L = Late | E = Excused", margin, yPosition);
      yPosition += 8;
      
      // Table dimensions
      const firstColWidth = 35;
      const dayColWidth = 8;
      const totalsColWidth = 18;
      
      const headerHeight = 14;
      const rowHeight = 8;
      
      // Draw header row
      const headerY = yPosition;
      
      // First, draw all rectangles
      pdf.setFillColor(41, 128, 185);
      pdf.setDrawColor(25, 100, 155);
      pdf.setLineWidth(0.5);
      
      let xPos = margin;
      
      // Fill and border all header cells
      pdf.rect(xPos, headerY, firstColWidth, headerHeight, "F");
      pdf.rect(xPos, headerY, firstColWidth, headerHeight);
      xPos += firstColWidth;
      
      daysArray.forEach(() => {
        pdf.rect(xPos, headerY, dayColWidth, headerHeight, "F");
        pdf.rect(xPos, headerY, dayColWidth, headerHeight);
        xPos += dayColWidth;
      });
      
      // Three totals columns: ABS, LATE, PRS
      pdf.rect(xPos, headerY, totalsColWidth, headerHeight, "F");
      pdf.rect(xPos, headerY, totalsColWidth, headerHeight);
      xPos += totalsColWidth;
      
      pdf.rect(xPos, headerY, totalsColWidth, headerHeight, "F");
      pdf.rect(xPos, headerY, totalsColWidth, headerHeight);
      xPos += totalsColWidth;
      
      pdf.rect(xPos, headerY, totalsColWidth, headerHeight, "F");
      pdf.rect(xPos, headerY, totalsColWidth, headerHeight);
      
      // Now draw all text
      pdf.setTextColor(255, 255, 255);
      pdf.setFont(undefined, "bold");
      pdf.setFontSize(8);
      
      xPos = margin;
      pdf.text("STUDENT NAME", xPos + firstColWidth / 2, headerY + 8, {align: 'center'});
      xPos += firstColWidth;
      
      daysArray.forEach((day) => {
        const dayOfWeek = new Date(year, month, day).getDay();
        const dayNames = ["S", "M", "T", "W", "T", "F", "S"];
        const dayLetter = dayNames[dayOfWeek];
        
        // Draw day letter and number
        pdf.text(dayLetter, xPos + 2.5, headerY + 4);
        pdf.text(String(day), xPos + 2.5, headerY + 10);
        xPos += dayColWidth;
      });
      
      pdf.text("ABSENT", xPos + totalsColWidth / 2, headerY + 8, {align: 'center'});
      xPos += totalsColWidth;
      
      pdf.text("LATE", xPos + totalsColWidth / 2, headerY + 8, {align: 'center'});
      xPos += totalsColWidth;
      
      pdf.text("PRESENT", xPos + totalsColWidth / 2, headerY + 8, {align: 'center'});
      
      yPosition += headerHeight;
      
      // Draw data rows
      pdf.setTextColor(0, 0, 0);
      pdf.setFont(undefined, "normal");
      
      students.forEach((student, studentIdx) => {
        // Check for page break
        if (yPosition + rowHeight > pageHeight - 10) {
          pdf.addPage();
          yPosition = margin;
          
          // Redraw header on new page - Draw all rectangles first
          pdf.setFillColor(41, 128, 185);
          pdf.setDrawColor(25, 100, 155);
          pdf.setLineWidth(0.5);
          
          let headerXPos = margin;
          
          // Fill and border all header cells
          pdf.rect(headerXPos, yPosition, firstColWidth, headerHeight, "F");
          pdf.rect(headerXPos, yPosition, firstColWidth, headerHeight);
          headerXPos += firstColWidth;
          
          daysArray.forEach(() => {
            pdf.rect(headerXPos, yPosition, dayColWidth, headerHeight, "F");
            pdf.rect(headerXPos, yPosition, dayColWidth, headerHeight);
            headerXPos += dayColWidth;
          });
          
          pdf.rect(headerXPos, yPosition, totalsColWidth, headerHeight, "F");
          pdf.rect(headerXPos, yPosition, totalsColWidth, headerHeight);
          headerXPos += totalsColWidth;
          
          pdf.rect(headerXPos, yPosition, totalsColWidth, headerHeight, "F");
          pdf.rect(headerXPos, yPosition, totalsColWidth, headerHeight);
          headerXPos += totalsColWidth;
          
          pdf.rect(headerXPos, yPosition, totalsColWidth, headerHeight, "F");
          pdf.rect(headerXPos, yPosition, totalsColWidth, headerHeight);
          
          // Now draw all text
          pdf.setTextColor(255, 255, 255);
          pdf.setFont(undefined, "bold");
          pdf.setFontSize(8);
          
          headerXPos = margin;
          pdf.text("STUDENT NAME", headerXPos + firstColWidth / 2, yPosition + 8, {align: 'center'});
          headerXPos += firstColWidth;
          
          daysArray.forEach((day) => {
            const dayOfWeek = new Date(year, month, day).getDay();
            const dayNames = ["S", "M", "T", "W", "T", "F", "S"];
            const dayLetter = dayNames[dayOfWeek];
            
            pdf.text(dayLetter, headerXPos + 2.5, yPosition + 4);
            pdf.text(String(day), headerXPos + 2.5, yPosition + 10);
            headerXPos += dayColWidth;
          });
          
          pdf.text("ABSENT", headerXPos + totalsColWidth / 2, yPosition + 8, {align: 'center'});
          headerXPos += totalsColWidth;
          
          pdf.text("LATE", headerXPos + totalsColWidth / 2, yPosition + 8, {align: 'center'});
          headerXPos += totalsColWidth;
          
          pdf.text("PRESENT", headerXPos + totalsColWidth / 2, yPosition + 8, {align: 'center'});
          
          yPosition += headerHeight;
          
          pdf.setTextColor(0, 0, 0);
          pdf.setFont(undefined, "normal");
        }
        
        const studentKey = getStudentKey(student);
        const rowBgColor = studentIdx % 2 === 0 ? [245, 245, 245] : [255, 255, 255];
        
        // Draw row background
        let xPos = margin;
        pdf.setFillColor(rowBgColor[0], rowBgColor[1], rowBgColor[2]);
        pdf.rect(xPos, yPosition, firstColWidth + (dayColWidth * daysArray.length) + (totalsColWidth * 3), rowHeight, "F");
        
        // Draw borders
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.3);
        pdf.setTextColor(0, 0, 0);
        pdf.setFont(undefined, "normal");
        pdf.setFontSize(7);
        
        // Student name cell
        pdf.rect(xPos, yPosition, firstColWidth, rowHeight);
        pdf.text(formatStudentName(student).substring(0, 20), xPos + 2, yPosition + 5);
        xPos += firstColWidth;
        
        // Day cells with color coding
        daysArray.forEach((day) => {
          const status = attendanceByDay[studentKey]?.[day] || "";
          
          if (status === "P") {
            pdf.setFillColor(36, 161, 72);
            pdf.rect(xPos, yPosition, dayColWidth, rowHeight, "F");
            pdf.setTextColor(255, 255, 255);
            pdf.setFont(undefined, "bold");
          } else if (status === "A") {
            pdf.setFillColor(198, 40, 40);
            pdf.rect(xPos, yPosition, dayColWidth, rowHeight, "F");
            pdf.setTextColor(255, 255, 255);
            pdf.setFont(undefined, "bold");
          } else {
            pdf.setTextColor(0, 0, 0);
            pdf.setFont(undefined, "normal");
          }
          
          pdf.text(status, xPos + dayColWidth / 2, yPosition + 5, {align: 'center'});
          pdf.setTextColor(0, 0, 0);
          pdf.setFont(undefined, "normal");
          pdf.setDrawColor(200, 200, 200);
          pdf.setLineWidth(0.3);
          pdf.rect(xPos, yPosition, dayColWidth, rowHeight);
          xPos += dayColWidth;
        });
        
        // Totals
        let totalAbsent = 0;
        let totalLate = 0;
        let totalPresent = 0;
        daysArray.forEach((day) => {
          const status = attendanceByDay[studentKey]?.[day];
          if (status === "A") totalAbsent++;
          if (status === "L") totalLate++;
          if (status === "P" || status === "L") totalPresent++;
        });
        
        pdf.rect(xPos, yPosition, totalsColWidth, rowHeight);
        pdf.text(String(totalAbsent), xPos + totalsColWidth / 2, yPosition + 5, {align: 'center'});
        xPos += totalsColWidth;
        
        pdf.rect(xPos, yPosition, totalsColWidth, rowHeight);
        pdf.text(String(totalLate), xPos + totalsColWidth / 2, yPosition + 5, {align: 'center'});
        xPos += totalsColWidth;
        
        pdf.rect(xPos, yPosition, totalsColWidth, rowHeight);
        pdf.text(String(totalPresent), xPos + totalsColWidth / 2, yPosition + 5, {align: 'center'});
        
        yPosition += rowHeight;
      });
      
      // Add footer on all pages
      const pageCount = pdf.internal.getNumberOfPages();
      const timestamp = new Date().toISOString().slice(0, 10);
      
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(100, 100, 100);
        pdf.text(
          `Generated: ${new Date().toLocaleDateString()}`,
          margin,
          pageHeight - 5
        );
        pdf.text(
          `Page ${i} of ${pageCount}`,
          pageWidth - margin - 20,
          pageHeight - 5
        );
      }
      
      // Save PDF
      pdf.save(`Monthly-Attendance-${currentSection?.name || "N/A"}_${timestamp}.pdf`);

      alert('✓ PDF report downloaded successfully!');
    } catch (err) {
      console.error("Error downloading attendance PDF:", err);
      alert("Failed to download PDF file. Please try again.");
      throw err;
    }
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
                  const statusValue = attendance[studentKey] || "";
                  const statusLabel = statusValue || "UNMARKED";
                  const statusClass = statusValue ? statusValue.toLowerCase() : "unmarked";
                  return (
                    <tr className="am__tr" key={studentKey || student.id || idx}>
                      <td className="am__td am__td--left am__td--num">{idx + 1}</td>
                      <td className="am__td am__td--left">
                        <div className="am__name">{formatStudentName(student)}</div>
                        <div className="am__id">{student.username}</div>
                      </td>

                      <td className="am__td">
                        <span
                          className={`am__badge am__badge--${statusClass}`}
                        >
                          {statusLabel}
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
                  {getScheduleSubjectName(currentSchedule)}
                </span>
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
              max={(() => {
                const today = new Date();
                const yr = today.getFullYear();
                const mo = String(today.getMonth() + 1).padStart(2, "0");
                const dy = String(today.getDate()).padStart(2, "0");
                return `${yr}-${mo}-${dy}`;
              })()}
              onChange={(e) => {
                const selected = e.target.value;
                const today = new Date();
                const selectedDate = new Date(selected + "T00:00:00");
                
                // Check if selected date is in the future
                if (selectedDate > today) {
                  setMessage({
                    type: "error",
                    text: "Cannot set attendance for future dates. Please select today or an earlier date.",
                  });
                  setTimeout(() => setMessage(null), 3000);
                  return;
                }
                setSelectedDate(selected);
              }}
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

          {uniqueSchedules.length > 0 && (
            <select
              className="am__select am__select--schedule"
              value={selectedSchedule}
              onChange={(e) => setSelectedSchedule(e.target.value)}
            >
              <option value="">Select Subject</option>
              {uniqueSchedules.map((sched) => (
                <option key={sched.id} value={sched.id}>
                  {getScheduleSubjectName(sched)}
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
            disabled={loading || saving || !selectedSection || !selectedSchedule || students.length === 0 || hasUnmarked}
            title={hasUnmarked ? "Mark all students to enable saving." : ""}
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
                  disabled={loading || saving || !selectedSection || students.length === 0 || hasUnmarked}
                  title={hasUnmarked ? "Mark all students to enable saving." : ""}
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

      <PreviewModal
        isOpen={attendancePreviewOpen}
        onClose={() => setAttendancePreviewOpen(false)}
        title={`Monthly Attendance Report - ${currentSectionLabel || "N/A"}`}
        data={attendancePreviewData}
        customPreview={monthlyPreviewContent}
        filename={`Monthly-Attendance-${currentSection?.name || "N/A"}`}
        onDownloadExcel={handleDownloadAttendanceExcel}
        onDownloadPDF={handleDownloadAttendancePDF}
      />
    </div>
  );
};

export default AttendanceMonitoring;