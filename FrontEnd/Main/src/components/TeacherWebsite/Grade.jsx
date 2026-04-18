import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, X, Edit2, Trash2, Settings, Calendar, FileText, Printer } from "lucide-react";
import "../TeacherWebsiteCSS/Grade.css";
import { apiFetch } from "../api/apiFetch";
import { getToken } from "../Auth/auth";
import PreviewModal from "../PreviewModal";
import ExcelJS from "exceljs";
import Toast from "../Global/Toast";

const API = "";

const normalizeGradeCode = (value) => {
  if (value === null || value === undefined) return "";

  const v = String(value).trim().toLowerCase();

  const map = {
    "-1": "prek",
    "0": "kinder",
    "1": "grade1",
    "2": "grade2",
    "3": "grade3",
    "4": "grade4",
    "5": "grade5",
    "6": "grade6",
    "prek": "prek",
    "pre-kinder": "prek",
    "pre kinder": "prek",
    "kinder": "kinder",
    "grade1": "grade1",
    "grade2": "grade2",
    "grade3": "grade3",
    "grade4": "grade4",
    "grade5": "grade5",
    "grade6": "grade6",
    "grade 1": "grade1",
    "grade 2": "grade2",
    "grade 3": "grade3",
    "grade 4": "grade4",
    "grade 5": "grade5",
    "grade 6": "grade6",
  };

  return map[v] || "";
};

const gradeCodeToNumber = (value) => {
  const code = normalizeGradeCode(value);

  const map = {
    prek: -1,
    kinder: 0,
    grade1: 1,
    grade2: 2,
    grade3: 3,
    grade4: 4,
    grade5: 5,
    grade6: 6,
  };

  return map[code] ?? 0;
};

const gradeLabel = (value) => {
  const code = normalizeGradeCode(value);

  const labels = {
    prek: "Pre-Kinder",
    kinder: "Kinder",
    grade1: "Grade 1",
    grade2: "Grade 2",
    grade3: "Grade 3",
    grade4: "Grade 4",
    grade5: "Grade 5",
    grade6: "Grade 6",
  };

  return labels[code] || String(value || "–");
};

const QUARTERS = [1, 2, 3, 4];
const MIN_WEIGHT_PERCENT = 1;

const CATEGORIES = [
  { key: "ACTIVITY", label: "Activities", color: "#3b82f6" },
  { key: "QUIZ", label: "Quizzes", color: "#8b5cf6" },
  { key: "EXAM", label: "Exams", color: "#ef4444" },
];

const getStudentKey = (student) => {
  if (!student) return "";

  const idValue = student.id != null ? String(student.id).trim() : "";
  if (idValue) return `id:${idValue}`;

  const studentNumber = String(student.student_number || "").trim();
  if (studentNumber) return `num:${studentNumber.toLowerCase()}`;

  const username = String(student.username || "").trim();
  if (username) return `user:${username.toLowerCase()}`;

  return "";
};

const Grade = () => {
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [quarter, setQuarter] = useState(1);
  const [teacherSubject, setTeacherSubject] = useState(null);
  const [schoolYear, setSchoolYear] = useState(null);

  const [items, setItems] = useState([]);
  const [students, setStudents] = useState([]);
  const [scores, setScores] = useState([]);
  const [classStandings, setClassStandings] = useState([]);
  const [weights, setWeights] = useState({
    activity_weight: 40,
    quiz_weight: 20,
    exam_weight: 20,
    class_standing_weight: 20,
  });

  const [showAddItem, setShowAddItem] = useState(null);
  const [newItem, setNewItem] = useState({
    title: "",
    description: "",
    date_given: "",
    due_date: "",
    total_score: 0,
  });
  const [showWeights, setShowWeights] = useState(false);
  const [tempWeights, setTempWeights] = useState({ ...weights });
  const [scoreModal, setScoreModal] = useState(null);
  const [scoreValue, setScoreValue] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState("");
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishPreviewRows, setPublishPreviewRows] = useState([]);
  const [publishCanConfirm, setPublishCanConfirm] = useState(false);
  const [publishPreviewError, setPublishPreviewError] = useState("");
  const [publishLoading, setPublishLoading] = useState(false);
  const [csModal, setCsModal] = useState(null);
  const [csValue, setCsValue] = useState("");
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [error, setError] = useState("");
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [printPreviewData, setPrintPreviewData] = useState([]);
  const [gradePreviewColumns, setGradePreviewColumns] = useState([]);
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((toastId) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== toastId));
  }, []);

  const addToast = useCallback((title, message, type = "warning") => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4500);
  }, []);

  const safeParseJson = useCallback(async (response) => {
    if (!response) return null;
    const contentType = response.headers?.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) return null;

    try {
      return await response.json();
    } catch {
      return null;
    }
  }, []);

  const getApiErrorMessage = useCallback((payload, fallback) => {
    if (!payload) return fallback;
    if (typeof payload === "string") return payload;
    if (typeof payload.detail === "string") return payload.detail;
    if (typeof payload.error === "string") return payload.error;
    if (Array.isArray(payload.non_field_errors) && payload.non_field_errors.length > 0) {
      return String(payload.non_field_errors[0]);
    }

    try {
      return JSON.stringify(payload);
    } catch {
      return fallback;
    }
  }, []);

  const currentSection =
    sections.find((s) => String(s.id) === String(selectedSection)) || null;

  const availableSubjects = useMemo(() => {
    if (!teacherSubject) return [];

    if (Array.isArray(teacherSubject.subjects) && teacherSubject.subjects.length > 0) {
      return teacherSubject.subjects;
    }

    if (teacherSubject.subject_id) {
      return [
        {
          id: teacherSubject.subject_id,
          name: teacherSubject.subject_name,
          code: teacherSubject.subject_code,
        },
      ];
    }

    return [];
  }, [teacherSubject]);

  const selectedSubject = useMemo(
    () =>
      availableSubjects.find((subject) => String(subject.id) === String(selectedSubjectId)) ||
      null,
    [availableSubjects, selectedSubjectId]
  );

  const canPublish =
    !!currentSection && !!selectedSubjectId && students.length > 0 && items.length > 0 && !isPublishing;

  const displayStudents = useMemo(() => {
    const seen = new Map();
    (students || []).forEach((student) => {
      const key = getStudentKey(student);
      if (!key) return;
      const existing = seen.get(key);
      if (existing) {
        seen.set(key, { ...existing, ...student, studentKey: key });
      } else {
        seen.set(key, { ...student, studentKey: key });
      }
    });
    return Array.from(seen.values());
  }, [students]);

  const studentIdToKey = useMemo(() => {
    const map = new Map();
    displayStudents.forEach((student) => {
      if (student?.id != null && student.studentKey) {
        map.set(String(student.id), student.studentKey);
      }
    });
    return map;
  }, [displayStudents]);

  const studentKeyToId = useMemo(() => {
    const map = new Map();
    displayStudents.forEach((student) => {
      if (student?.id != null && student.studentKey) {
        map.set(student.studentKey, student.id);
      }
    });
    return map;
  }, [displayStudents]);

  const scoresByKey = useMemo(() => {
    const map = new Map();
    (scores || []).forEach((sc) => {
      const key = studentIdToKey.get(String(sc.student));
      if (!key) return;
      map.set(`${key}|${sc.grade_item}`, Number(sc.score));
    });
    return map;
  }, [scores, studentIdToKey]);

  const scoresById = useMemo(() => {
    const map = new Map();
    (scores || []).forEach((sc) => {
      const studentId = sc.student != null ? String(sc.student) : "";
      if (!studentId) return;
      map.set(`${studentId}|${sc.grade_item}`, Number(sc.score));
    });
    return map;
  }, [scores]);

  const classStandingsByKey = useMemo(() => {
    const map = new Map();
    (classStandings || []).forEach((cs) => {
      const key = studentIdToKey.get(String(cs.student));
      if (!key) return;
      map.set(key, Number(cs.score));
    });
    return map;
  }, [classStandings, studentIdToKey]);

  const classStandingsById = useMemo(() => {
    const map = new Map();
    (classStandings || []).forEach((cs) => {
      const studentId = cs.student != null ? String(cs.student) : "";
      if (!studentId) return;
      map.set(studentId, Number(cs.score));
    });
    return map;
  }, [classStandings]);

  // IMPORTANT FIX:
  // backend expects integer grade_level, not "grade4"/"kinder"
  const gradeLevel = gradeCodeToNumber(currentSection?.grade_level);

  useEffect(() => {
    (async () => {
      try {
        const [teacherRes, syRes] = await Promise.all([
          apiFetch(`${API}/api/grades/teacher-info/`),
          apiFetch(`${API}/api/classmanagement/school-years/active/`),
        ]);

        if (teacherRes.ok) {
          const data = await teacherRes.json();
          setTeacherSubject(data);
        }

        if (syRes.ok) {
          const syData = await syRes.json();
          setSchoolYear(syData);
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  useEffect(() => {
    if (!availableSubjects.length) {
      setSelectedSubjectId("");
      return;
    }

    setSelectedSubjectId((prev) => {
      const hasPrev = availableSubjects.some((subject) => String(subject.id) === String(prev));
      return hasPrev ? String(prev) : String(availableSubjects[0].id);
    });
  }, [availableSubjects]);

  useEffect(() => {
    if (!selectedSubjectId) {
      setSections([]);
      setSelectedSection("");
      return;
    }

    (async () => {
      const fetchSectionsForSubject = async (subjectId) => {
        const schoolYearParam = schoolYear?.id
          ? `&school_year=${encodeURIComponent(schoolYear.id)}`
          : "";

        const res = await apiFetch(
          `${API}/api/grades/my-sections/?subject=${subjectId}${schoolYearParam}`
        );

        if (!res.ok) {
          return [];
        }

        const data = await res.json();
        return Array.isArray(data) ? data : [];
      };

      try {
        let subjectToUse = String(selectedSubjectId);
        let nextSections = await fetchSectionsForSubject(subjectToUse);

        if (!nextSections.length) {
          const fallbackSubject = availableSubjects.find(
            (subject) => String(subject.id) !== String(selectedSubjectId)
          );

          if (fallbackSubject) {
            const fallbackSections = await fetchSectionsForSubject(fallbackSubject.id);
            if (fallbackSections.length) {
              subjectToUse = String(fallbackSubject.id);
              nextSections = fallbackSections;
            }
          }
        }

        setSections(nextSections);

        if (!nextSections.length) {
          setSelectedSection("");
          return;
        }

        if (subjectToUse !== String(selectedSubjectId)) {
          setSelectedSubjectId(subjectToUse);
        }

        setSelectedSection((prev) => {
          const hasPrev = nextSections.some(
            (s) => String(s.id) === String(prev)
          );
          return hasPrev ? prev : String(nextSections[0].id);
        });
      } catch (e) {
        console.error(e);
        setSections([]);
        setSelectedSection("");
      }
    })();
  }, [selectedSubjectId, schoolYear?.id, availableSubjects]);

  const fetchAll = useCallback(async () => {
    if (!selectedSubjectId || !selectedSection) {
      setStudents([]);
      setItems([]);
      setScores([]);
      setClassStandings([]);
      return;
    }

    const subj = Number(selectedSubjectId);

    try {
      const schoolYearParam = schoolYear?.id
        ? `school_year=${encodeURIComponent(schoolYear.id)}&`
        : "";

      const [itemsRes, studentsRes, scoresRes, csRes, wRes] = await Promise.all([
        apiFetch(
          `${API}/api/grades/items/?${schoolYearParam}subject=${subj}&grade_level=${gradeLevel}&quarter=${quarter}`
        ),
        apiFetch(`${API}/api/grades/students/section/${selectedSection}/?${schoolYearParam}`),
        apiFetch(
          `${API}/api/grades/scores/?${schoolYearParam}subject=${subj}&grade_level=${gradeLevel}&quarter=${quarter}`
        ),
        apiFetch(`${API}/api/grades/class-standing/?${schoolYearParam}subject=${subj}&quarter=${quarter}`),
        apiFetch(`${API}/api/grades/weights/${subj}/`),
      ]);

      if (itemsRes.ok) {
        const data = await itemsRes.json();
        setItems(Array.isArray(data) ? data : []);
      } else {
        setItems([]);
      }

      if (studentsRes.ok) {
        const data = await studentsRes.json();
        const studentsArray = Array.isArray(data) ? data : [];

        const uniqueStudents = Object.values(
          studentsArray.reduce((acc, student) => {
            const key = getStudentKey(student);
            if (!key) return acc;

            if (!acc[key]) {
              acc[key] = student;
            } else {
              acc[key] = {
                ...acc[key],
                ...student,
              };
            }
            return acc;
          }, {})
        );

        if (uniqueStudents.length !== studentsArray.length) {
          console.warn("Grade.jsx: duplicate students removed", {
            original: studentsArray.length,
            unique: uniqueStudents.length,
            section: selectedSection,
            quarter,
          });
        }

        setStudents(uniqueStudents);
      } else {
        setStudents([]);
      }

      if (scoresRes.ok) {
        const data = await scoresRes.json();
        setScores(Array.isArray(data) ? data : []);
      } else {
        setScores([]);
      }

      if (csRes.ok) {
        const data = await csRes.json();
        setClassStandings(Array.isArray(data) ? data : []);
      } else {
        setClassStandings([]);
      }

      if (wRes.ok) {
        const wd = await wRes.json();
        setWeights(wd);
        setTempWeights(wd);
      }
    } catch (e) {
      console.error("fetchAll error:", e);
    }
  }, [selectedSubjectId, selectedSection, gradeLevel, quarter, schoolYear?.id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const itemsByCategory = (cat) => items.filter((i) => i.category === cat);

  const getScore = (studentKey, itemId, studentId) => {
    if (studentKey) {
      const value = scoresByKey.get(`${studentKey}|${itemId}`);
      if (value != null) return Number(value);
    }

    const idValue = studentId != null ? String(studentId) : "";
    if (!idValue) return null;
    const value = scoresById.get(`${idValue}|${itemId}`);
    return value != null ? Number(value) : null;
  };

  const getCS = (studentKey, studentId) => {
    if (studentKey) {
      const value = classStandingsByKey.get(studentKey);
      if (value != null) return Number(value);
    }

    const idValue = studentId != null ? String(studentId) : "";
    if (!idValue) return null;
    const value = classStandingsById.get(idValue);
    return value != null ? Number(value) : null;
  };

  const categoryAvg = (studentKey, studentId, cat) => {
    const catItems = itemsByCategory(cat);
    if (!catItems.length) return null;

    let totalEarned = 0;
    let totalPossible = 0;
    let hasAny = false;

    catItems.forEach((item) => {
      const s = getScore(studentKey, item.id, studentId);
      if (s !== null && s !== undefined && s !== "") {
        totalEarned += Number(s);
        totalPossible += Number(item.total_score || 0);
        hasAny = true;
      }
    });

    if (!hasAny) return null;
    return totalPossible > 0 ? (totalEarned / totalPossible) * 100 : 0;
  };

  const quarterGrade = (studentKey, studentId) => {
    const actAvg = categoryAvg(studentKey, studentId, "ACTIVITY");
    const quizAvg = categoryAvg(studentKey, studentId, "QUIZ");
    const examAvg = categoryAvg(studentKey, studentId, "EXAM");
    const cs = getCS(studentKey, studentId);

    const parts = [];
    if (actAvg !== null) parts.push({ avg: Number(actAvg), w: Number(weights.activity_weight) || 0 });
    if (quizAvg !== null) parts.push({ avg: Number(quizAvg), w: Number(weights.quiz_weight) || 0 });
    if (examAvg !== null) parts.push({ avg: Number(examAvg), w: Number(weights.exam_weight) || 0 });
    if (cs !== null) parts.push({ avg: Number(cs), w: Number(weights.class_standing_weight) || 0 });

    if (!parts.length) return null;

    const totalW = parts.reduce((s, p) => s + p.w, 0);
    if (totalW === 0) return null;

    return parts.reduce((s, p) => s + p.avg * p.w, 0) / totalW;
  };

  const handleAddItem = async (category) => {
    if (!selectedSubjectId || !selectedSection) return;

    const totalScore = Number(newItem.total_score);
    if (Number.isNaN(totalScore) || totalScore <= 0) {
      setError("Total score must be greater than zero.");
      return;
    }

    const catItems = itemsByCategory(category);

    const body = {
      subject: Number(selectedSubjectId),
      grade_level: Number(gradeLevel),
      quarter: Number(quarter),
      category: String(category).toUpperCase(),
      title:
        newItem.title?.trim() ||
        `${category.charAt(0) + category.slice(1).toLowerCase()} ${catItems.length + 1}`,
      description: newItem.description?.trim() || "",
      date_given: newItem.date_given || null,
      due_date: newItem.due_date || null,
      total_score: totalScore,
      order: Number(catItems.length),
    };

    console.log("Creating grade item payload:", body);

    try {
      const res = await apiFetch(`${API}/api/grades/items/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await safeParseJson(res);
      console.log("Create grade item response:", res.status, data);

      if (!res.ok) {
        addToast("Create Failed", getApiErrorMessage(data, "Failed to create grade item."), "error");
        return;
      }

      setError("");
      setShowAddItem(null);
      setNewItem({
        title: "",
        description: "",
        date_given: "",
        due_date: "",
        total_score: 100,
      });
      fetchAll();
    } catch (e) {
      console.error("Create grade item error:", e);
      addToast("Create Failed", "Something went wrong while creating the grade item.", "error");
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm("Delete this item and all its scores?")) return;

    try {
      const res = await apiFetch(`${API}/api/grades/items/${itemId}/`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await safeParseJson(res);
        addToast("Delete Failed", getApiErrorMessage(data, "Failed to delete item."), "error");
        return;
      }

      fetchAll();
    } catch (e) {
      console.error(e);
      addToast("Delete Failed", "Something went wrong while deleting the item.", "error");
    }
  };

  const openEditItem = (item) => {
    setEditItem(item);
    setEditForm({
      title: item.title,
      description: item.description || "",
      date_given: item.date_given || "",
      due_date: item.due_date || "",
      total_score: item.total_score,
    });
  };

  const handleEditItem = async () => {
    if (!editItem) return;

    const totalScore = Number(editForm.total_score) || 100;
    if (totalScore < 0) {
      setError("Total score cannot be negative.");
      return;
    }

    try {
      const body = {
        title: editForm.title?.trim() || editItem.title,
        description: editForm.description?.trim() || "",
        date_given: editForm.date_given || null,
        due_date: editForm.due_date || null,
        total_score: totalScore,
      };

      const res = await apiFetch(`${API}/api/grades/items/${editItem.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await safeParseJson(res);
      console.log("Edit grade item response:", res.status, data);

      if (!res.ok) {
        addToast("Update Failed", getApiErrorMessage(data, "Failed to update grade item."), "error");
        return;
      }

      setError("");
      setEditItem(null);
      fetchAll();
    } catch (e) {
      console.error("Edit grade item error:", e);
      addToast("Update Failed", "Something went wrong while updating the grade item.", "error");
    }
  };

  const handleSaveScore = async () => {
    if (!scoreModal) return;

    const numericScore = parseFloat(scoreValue);
    if (Number.isNaN(numericScore)) {
      setError("Please enter a valid score.");
      return;
    }

    if (numericScore < 0) {
      setError("Score cannot be negative.");
      return;
    }

    if (numericScore > scoreModal.item.total_score) {
      setError(`Score cannot exceed ${scoreModal.item.total_score}.`);
      return;
    }

    const studentId =
      scoreModal.student?.id != null
        ? scoreModal.student.id
        : studentKeyToId.get(scoreModal.studentKey);

    if (!studentId) {
      setError("Unable to determine the student for this score.");
      return;
    }

    try {
      const res = await apiFetch(`${API}/api/grades/scores/upsert/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student: Number(studentId),
          grade_item: Number(scoreModal.item.id),
          score: numericScore,
        }),
      });

      const data = await safeParseJson(res);
      const previewData = data || {};

      if (!res.ok) {
        addToast("Save Failed", getApiErrorMessage(data, "Failed to save score."), "error");
        return;
      }

      setError("");
      setScoreModal(null);
      setScoreValue("");
      fetchAll();
    } catch (e) {
      console.error(e);
      addToast("Save Failed", "Something went wrong while saving the score.", "error");
    }
  };

  const handleSaveCS = async () => {
    if (!csModal || !selectedSubjectId) return;

    const numericScore = parseFloat(csValue);
    if (Number.isNaN(numericScore)) {
      setError("Please enter a valid class standing.");
      return;
    }

    if (numericScore < 0) {
      setError("Class standing score cannot be negative.");
      return;
    }

    if (numericScore > 100) {
      setError("Class standing score cannot exceed 100.");
      return;
    }

    const studentId =
      csModal.student?.id != null
        ? csModal.student.id
        : studentKeyToId.get(csModal.studentKey);

    if (!studentId) {
      setError("Unable to determine the student for this class standing.");
      return;
    }

    try {
      const res = await apiFetch(`${API}/api/grades/class-standing/upsert/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student: Number(studentId),
          subject: Number(selectedSubjectId),
          quarter: Number(quarter),
          score: numericScore,
        }),
      });

      const data = await safeParseJson(res);

      if (!res.ok) {
        addToast("Save Failed", getApiErrorMessage(data, "Failed to save class standing."), "error");
        return;
      }

      setError("");
      setCsModal(null);
      setCsValue("");
      fetchAll();
    } catch (e) {
      console.error(e);
      addToast("Save Failed", "Something went wrong while saving class standing.", "error");
    }
  };

  const handleSaveWeights = async () => {
    if (!selectedSubjectId) return;

    const weights_array = [
      { key: 'activity_weight', value: Number(tempWeights.activity_weight || 0) },
      { key: 'quiz_weight', value: Number(tempWeights.quiz_weight || 0) },
      { key: 'exam_weight', value: Number(tempWeights.exam_weight || 0) },
      { key: 'class_standing_weight', value: Number(tempWeights.class_standing_weight || 0) },
    ];

    for (const w of weights_array) {
      if (w.value < 0) {
        setError(`Weight for ${w.key.replace(/_/g, ' ')} cannot be negative.`);
        return;
      }

      if (w.value < MIN_WEIGHT_PERCENT) {
        setError(
          `Weight for ${w.key.replace(/_/g, ' ')} must be at least ${MIN_WEIGHT_PERCENT}%.`
        );
        return;
      }
    }

    const totalWeight = weights_array.reduce((sum, item) => sum + item.value, 0);
    if (totalWeight !== 100) {
      setError("Total weight must equal 100%.");
      return;
    }

    try {
      const res = await apiFetch(
        `${API}/api/grades/weights/${selectedSubjectId}/update/`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tempWeights),
        }
      );

      const data = await safeParseJson(res);

      if (!res.ok) {
        addToast("Save Failed", getApiErrorMessage(data, "Failed to save weights."), "error");
        return;
      }

      setError("");
      setShowWeights(false);
      fetchAll();
    } catch (e) {
      console.error(e);
      addToast("Save Failed", "Something went wrong while saving weights.", "error");
    }
  };

  const handlePublishAcademicHistory = async () => {
    if (!currentSection) {
      addToast("Missing Selection", "Please select a section before publishing academic history.", "warning");
      return;
    }

    if (!getToken()) {
      addToast("Session Expired", "Your session has expired. Please log in again before publishing.", "error");
      return;
    }

    const schoolYearLabel =
      schoolYear?.name ||
      (schoolYear?.start_year && schoolYear?.end_year
        ? `${schoolYear.start_year}-${schoolYear.end_year}`
        : null);

    if (!schoolYearLabel) {
      addToast("School Year Missing", "Unable to determine active school year. Please check school year settings.", "error");
      return;
    }

    setPublishLoading(true);
    setPublishPreviewError("");

    try {
      const params = new URLSearchParams({
        section_id: String(selectedSection),
        subject_id: String(selectedSubjectId),
        school_year: schoolYearLabel,
      });

      const res = await apiFetch(`${API}/api/grades/publish-history/?${params.toString()}`);
      const data = await safeParseJson(res);

      if (!res.ok) {
        if (res.status === 401) {
          setPublishPreviewError("Session expired. Please log in again and retry.");
        } else if (res.status === 405) {
          setPublishPreviewError(
            "Server publish endpoint is out of date (POST/preview method mismatch). Redeploy backend API and clear build cache."
          );
        } else {
          setPublishPreviewError(getApiErrorMessage(data, "Unable to load publish preview."));
        }
        setShowPublishModal(false);
      } else {
        setPublishPreviewRows(Array.isArray(previewData.rows) ? previewData.rows : []);
        setPublishCanConfirm(!!previewData.can_publish);
        setShowPublishModal(true);
        if (!previewData.can_publish) {
          setPublishPreviewError(
            `There are ${previewData.incomplete_count || 0} student(s) with incomplete grades (cannot publish).`
          );
        }
      }
    } catch (e) {
      console.error("Publish preview error:", e);
      setPublishPreviewError("Something went wrong when preparing publish preview.");
    } finally {
      setPublishLoading(false);
    }
  };

  const confirmPublishAcademicHistory = async () => {
    if (!publishCanConfirm) {
      return;
    }

    if (!getToken()) {
      addToast("Session Expired", "Your session has expired. Please log in again before publishing.", "error");
      return;
    }

    const schoolYearLabel =
      schoolYear?.name ||
      (schoolYear?.start_year && schoolYear?.end_year
        ? `${schoolYear.start_year}-${schoolYear.end_year}`
        : null);

    setIsPublishing(true);

    try {
      const payload = {
        section_id: Number(selectedSection),
        subject_id: Number(selectedSubjectId),
        school_year: schoolYearLabel,
      };

      const res = await apiFetch(`${API}/api/grades/publish-history/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await safeParseJson(res);
      const publishData = data || {};
      if (!res.ok) {
        if (res.status === 401) {
          addToast("Session Expired", "Session expired. Please log in again and retry publish.", "error");
        } else if (res.status === 405) {
          addToast(
            "Publish Unsupported",
            "Publish method is not enabled on the deployed backend. Redeploy backend API and clear build cache.",
            "error"
          );
        } else {
          addToast(
            "Publish Failed",
            getApiErrorMessage(data, "Failed to publish academic history. Please check logs and validate all fields."),
            "error"
          );
        }
      } else {
        setPublishMessage(
          `Published: ${publishData.published || 0}, Updated: ${publishData.updated || 0}, Total: ${publishData.total || 0}, Students: ${publishData.student_count || publishData.total || 0}`
        );
        addToast("Published", "Academic history published successfully.", "success");
      }
    } catch (e) {
      console.error("Publish academic history error:", e);
      addToast("Publish Failed", "Something went wrong when publishing academic history.", "error");
    } finally {
      setIsPublishing(false);
      setShowPublishModal(false);
    }
  };

  const handlePrintGradeSheet = () => {
    if (!currentSection || displayStudents.length === 0) {
      addToast("Missing Selection", "Please select a section with students before printing.", "warning");
      return;
    }

    if (!selectedSubject) {
      addToast("Missing Subject", "Unable to determine subject information.", "warning");
      return;
    }

    try {
      // Build detailed grade breakdown by category
      const previewData = displayStudents.map((student) => {
        try {
          const studentKey = student.studentKey || getStudentKey(student);
          const studentId = student.id;
          
          const row = {
            "Student Name": student.student_name,
          };

          // Add individual items and category averages
          CATEGORIES.forEach(({ key, label }) => {
            const catItems = itemsByCategory(key);
            
            // Add individual item scores
            catItems.forEach((item, idx) => {
              const score = getScore(studentKey, item.id, studentId);
              const displayScore = score !== null ? `${score}/${item.total_score}` : "–";
              row[`${label} ${idx + 1}`] = displayScore;
            });
            
            // Add category average percentage
            const catAvgVal = categoryAvg(studentKey, studentId, key);
            const catAvgDisplay = catAvgVal !== null ? catAvgVal.toFixed(1) : "–";
            row[`${label} %`] = catAvgDisplay;
          });

          // Add Class Standing
          const cs = getCS(studentKey, studentId);
          row["Class Standing"] = cs !== null ? cs.toFixed(1) : "–";

          // Add Quarter Grade
          const qg = quarterGrade(studentKey, studentId);
          row["Quarter Grade"] = qg !== null ? qg.toFixed(2) : "–";

          // Add Status
          row["Status"] = qg !== null ? (qg >= 75 ? "PASSED" : "FAILED") : "–";

          return row;
        } catch (err) {
          console.error("Error building grade row for student:", student.student_name, err);
          return null;
        }
      }).filter(row => row !== null);

      // Build columns dynamically based on items
      const columns = [{ key: "Student Name", label: "Student Name" }];

      CATEGORIES.forEach(({ key, label }) => {
        const catItems = itemsByCategory(key);
        
        // Add individual item columns
        catItems.forEach((item, idx) => {
          columns.push({
            key: `${label} ${idx + 1}`,
            label: `${label} ${idx + 1}`
          });
        });
        
        // Add category percentage column
        columns.push({
          key: `${label} %`,
          label: `${label} %`
        });
      });

      // Add remaining columns
      columns.push(
        { key: "Class Standing", label: "Class Standing" },
        { key: "Quarter Grade", label: "Quarter Grade" },
        { key: "Status", label: "Status" }
      );

      // Set preview data and columns
      setPrintPreviewData(previewData);
      setGradePreviewColumns(columns);
      setPrintPreviewOpen(true);
    } catch (err) {
      console.error("Error in handlePrintGradeSheet:", err);
      addToast("Print Failed", "An error occurred while preparing the grade sheet.", "error");
    }
  };

  const handleDownloadGradeExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Grade Sheet');

      // Get column headers from gradePreviewColumns
      const headers = gradePreviewColumns.map(col => col.label);
      
      // Add header row
      const headerRow = worksheet.addRow(headers);
      
      // Style header row
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF2563eb' }, // Blue
        };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } },
        };
      });
      headerRow.height = 25;

      // Add data rows
      printPreviewData.forEach((rowData) => {
        const row = worksheet.addRow(headers.map(header => rowData[header] || ''));
        
        // Style data cells
        row.eachCell((cell, colNumber) => {
          const isStudentNameColumn = colNumber === 1; // First column is Student Name
          cell.alignment = { 
            horizontal: isStudentNameColumn ? 'left' : 'center', 
            vertical: 'center', 
            wrapText: true 
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFdddddd' } },
            left: { style: 'thin', color: { argb: 'FFdddddd' } },
            bottom: { style: 'thin', color: { argb: 'FFdddddd' } },
            right: { style: 'thin', color: { argb: 'FFdddddd' } },
          };
          cell.font = { size: 11 };
        });
        row.height = 20;
      });

      // Set column widths
      worksheet.columns.forEach((col) => {
        col.width = 18;
      });

      // Generate and download file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `Grade-Sheet-${selectedSubject?.name || "N/A"}-${currentSection?.name || "N/A"}_${timestamp}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      addToast("Download Complete", "Grade sheet downloaded successfully.", "success");
    } catch (err) {
      console.error('Error downloading Excel:', err);
      addToast("Download Failed", "Failed to download grade sheet. Please try again.", "error");
    }
  };

  const weightTotal =
    Number(tempWeights.activity_weight || 0) +
    Number(tempWeights.quiz_weight || 0) +
    Number(tempWeights.exam_weight || 0) +
    Number(tempWeights.class_standing_weight || 0);

  const hasMinimumWeightViolation =
    Number(tempWeights.activity_weight || 0) < MIN_WEIGHT_PERCENT ||
    Number(tempWeights.quiz_weight || 0) < MIN_WEIGHT_PERCENT ||
    Number(tempWeights.exam_weight || 0) < MIN_WEIGHT_PERCENT ||
    Number(tempWeights.class_standing_weight || 0) < MIN_WEIGHT_PERCENT;

  if (!teacherSubject || availableSubjects.length === 0) {
    return (
      <div className="ge">
        <div className="ge__empty">
          <p>No subject assigned. Please contact an administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ge">
      <header className="ge__header">
        <h1 className="ge__title">
          <span className="ge__subjectTag">{selectedSubject?.name || "No subject selected"}</span>
          <span className="ge__classTag">
            {currentSection
              ? `${gradeLabel(currentSection.grade_level)} - ${currentSection.name}`
              : "No section assigned"}
          </span>
          <span className="ge__quarterTag">Q{quarter}</span>
          {schoolYear && (
            <span className="ge__syTag">
              <Calendar size={12} style={{ verticalAlign: "middle" }} />
              S.Y. {schoolYear.name || `${schoolYear.start_year}-${schoolYear.end_year}`}
            </span>
          )}
        </h1>
      </header>

      <div className="ge__toolbar">
        <select
          className="ge__select"
          value={selectedSubjectId}
          onChange={(e) => setSelectedSubjectId(e.target.value)}
        >
          {availableSubjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.code ? `${subject.name} (${subject.code})` : subject.name}
            </option>
          ))}
        </select>

        <select
          className="ge__select"
          value={selectedSection}
          onChange={(e) => setSelectedSection(e.target.value)}
        >
          {sections.length === 0 && <option value="">No assigned sections</option>}
          {sections.map((sec) => {
            const levelLabel = gradeLabel(sec.grade_level);
            return (
              <option key={sec.id} value={sec.id}>
                {`${levelLabel} - ${sec.name}`}
              </option>
            );
          })}
        </select>

        <div className="ge__quarterTabs">
          {QUARTERS.map((q) => (
            <button
              key={q}
              className={`ge__qTab ${quarter === q ? "ge__qTab--active" : ""}`}
              onClick={() => setQuarter(q)}
            >
              Q{q}
            </button>
          ))}
        </div>

        <button
          className="ge__weightsBtn"
          onClick={() => setShowWeights(true)}
          title="Adjust weights"
        >
          <Settings size={14} /> Weights
        </button>

        <button
          className="ge__printBtn"
          onClick={handlePrintGradeSheet}
          disabled={!selectedSection || displayStudents.length === 0}
          title="Print grade sheet with breakdown"
        >
          <Printer size={14} /> Print Grade Sheet
        </button>

        <button
          className="ge__weightsBtn"
          onClick={handlePublishAcademicHistory}
          disabled={!canPublish}
          title="Publish this subject's grades to academic history"
          style={
            canPublish
              ? { backgroundColor: "#1e3a8a", color: "white", borderColor: "#1e3a8a" }
              : { opacity: 0.6, cursor: "not-allowed" }
          }
        >
          <FileText size={14} /> {isPublishing ? "Publishing..." : "Publish to History"}
        </button>
      </div>

      {publishMessage && (
        <div className="ge__publishMessage" style={{ margin: "10px 0", color: "#1f621f" }}>
          {publishMessage}
        </div>
      )}

      {showPublishModal && (
        <div className="ge__overlay" onClick={() => setShowPublishModal(false)}>
          <div className="ge__modal" onClick={(e) => e.stopPropagation()} style={{ width: "80vw", maxWidth: "900px" }}>
            <div className="ge__modalHeader">
              <h3>Publish Academic History Preview</h3>
              <button className="ge__modalClose" onClick={() => setShowPublishModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="ge__modalBody" style={{ maxHeight: "60vh", overflowY: "auto" }}>
              {publishLoading ? (
                <p>Loading preview...</p>
              ) : publishPreviewError ? (
                <p style={{ color: "#b91c1c" }}>{publishPreviewError}</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "6px" }}>Student</th>
                      <th style={{ textAlign: "center", borderBottom: "1px solid #ddd", padding: "6px" }}>Q1</th>
                      <th style={{ textAlign: "center", borderBottom: "1px solid #ddd", padding: "6px" }}>Q2</th>
                      <th style={{ textAlign: "center", borderBottom: "1px solid #ddd", padding: "6px" }}>Q3</th>
                      <th style={{ textAlign: "center", borderBottom: "1px solid #ddd", padding: "6px" }}>Q4</th>
                      <th style={{ textAlign: "center", borderBottom: "1px solid #ddd", padding: "6px" }}>Final</th>
                      <th style={{ textAlign: "center", borderBottom: "1px solid #ddd", padding: "6px" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {publishPreviewRows.map((row) => (
                      <tr key={`${row.student_id}-${row.student_name}`}>
                        <td style={{ padding: "6px", borderBottom: "1px solid #eee" }}>{row.student_name}</td>
                        <td style={{ textAlign: "center", padding: "6px", borderBottom: "1px solid #eee" }}>{row.q1 != null ? row.q1 : "–"}</td>
                        <td style={{ textAlign: "center", padding: "6px", borderBottom: "1px solid #eee" }}>{row.q2 != null ? row.q2 : "–"}</td>
                        <td style={{ textAlign: "center", padding: "6px", borderBottom: "1px solid #eee" }}>{row.q3 != null ? row.q3 : "–"}</td>
                        <td style={{ textAlign: "center", padding: "6px", borderBottom: "1px solid #eee" }}>{row.q4 != null ? row.q4 : "–"}</td>
                        <td style={{ textAlign: "center", padding: "6px", borderBottom: "1px solid #eee" }}>{row.final_grade != null ? row.final_grade : "–"}</td>
                        <td style={{ textAlign: "center", padding: "6px", borderBottom: "1px solid #eee", color: row.complete ? "#1f621f" : "#b91c1c" }}>
                          {row.complete ? "Complete" : "Incomplete"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="ge__modalFooter">
              <button className="ge__btnCancel" onClick={() => setShowPublishModal(false)}>
                Cancel
              </button>
              <button
                className="ge__btnSave"
                onClick={confirmPublishAcademicHistory}
                disabled={!publishCanConfirm || publishLoading || isPublishing}
                style={publishCanConfirm ? { backgroundColor: "#1e3a8a", color: "white" } : { opacity: 0.6 }}
              >
                Publish
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="ge__weightBar">
        <span className="ge__weightChip ge__weightChip--act">
          Activities {weights.activity_weight}%
        </span>
        <span className="ge__weightChip ge__weightChip--quiz">
          Quizzes {weights.quiz_weight}%
        </span>
        <span className="ge__weightChip ge__weightChip--exam">
          Exams {weights.exam_weight}%
        </span>
        <span className="ge__weightChip ge__weightChip--cs">
          Class Standing {weights.class_standing_weight}%
        </span>
      </div>

      <section className="ge__planner">
        {CATEGORIES.map(({ key, label, color }) => {
          const catItems = itemsByCategory(key);

          return (
            <div className="ge__catSection" key={key}>
              <div className="ge__catHeader" style={{ borderLeftColor: color }}>
                <h3 className="ge__catTitle">
                  {label} <span className="ge__catCount">{catItems.length}</span>
                </h3>
                <button
                  className="ge__addBtn"
                  onClick={() => {
                    setShowAddItem(key);
                    setNewItem({
                      title: "",
                      description: "",
                      date_given: "",
                      due_date: "",
                      total_score: 100,
                    });
                  }}
                >
                  <Plus size={16} /> Add
                </button>
              </div>

              <div className="ge__catCards">
                {catItems.length === 0 && (
                  <p className="ge__catEmpty">No {label.toLowerCase()} yet.</p>
                )}

                {catItems.map((item) => (
                  <div className="ge__itemCard" key={item.id}>
                    <div className="ge__itemTop">
                      <strong>{item.title}</strong>
                      <span className="ge__itemMax">/{item.total_score}</span>
                    </div>

                    {item.description && <p className="ge__itemDesc">{item.description}</p>}

                    <div className="ge__itemMeta">
                      {item.date_given && <span>Given: {item.date_given}</span>}
                      {item.due_date && <span>Due: {item.due_date}</span>}
                    </div>

                    <div className="ge__itemActions">
                      <button
                        className="ge__iconBtn ge__iconBtn--edit"
                        onClick={() => openEditItem(item)}
                        title="Edit"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        className="ge__iconBtn ge__iconBtn--del"
                        onClick={() => handleDeleteItem(item.id)}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <section className="ge__card">
        <h3 className="ge__tableTitle">Student Scores – Q{quarter}</h3>
        <div className="ge__tableWrap">
          <table className="ge__table">
            <thead>
              <tr>
                <th className="ge__th ge__th--left ge__th--sticky">Student Name</th>
                {CATEGORIES.map(({ key, label }) =>
                  itemsByCategory(key).map((item, idx) => {
                    const abbr = key[0] + (idx + 1);
                    return (
                      <th
                        key={item.id}
                        className="ge__th ge__th--score"
                        title={`${label}: ${item.title} (/${item.total_score})`}
                      >
                        <span className={`ge__thCat ge__thCat--${key.toLowerCase()}`}>
                          {abbr}
                        </span>
                        <span className="ge__thTitle">
                          {item.title.length > 8 ? item.title.slice(0, 8) + "…" : item.title}
                        </span>
                        <span className="ge__thMax">/{item.total_score}</span>
                      </th>
                    );
                  })
                )}
                <th className="ge__th ge__th--score">CS</th>
                <th className="ge__th">Quarter Grade</th>
                <th className="ge__th">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {displayStudents.length === 0 && (
                <tr>
                  <td className="ge__td" colSpan={items.length + 4}>
                    {selectedSection
                      ? "No students enrolled in this section."
                      : "No section selected."}
                  </td>
                </tr>
              )}

              {displayStudents.map((stu) => {
                const studentKey = stu.studentKey || getStudentKey(stu);
                const studentId = stu.id;
                const rowKey = studentKey || String(stu.id || "");
                const qg = quarterGrade(studentKey, studentId);

                return (
                  <tr className="ge__tr" key={rowKey}>
                    <td className="ge__td ge__td--left ge__td--sticky">
                      <div className="ge__name">{stu.student_name}</div>
                    </td>

                    {CATEGORIES.map(({ key }) =>
                      itemsByCategory(key).map((item) => {
                        const sc = getScore(studentKey, item.id, studentId);

                        return (
                          <td
                            key={item.id}
                            className="ge__td ge__td--clickable"
                            onClick={() => {
                              setScoreModal({ student: stu, item, studentKey });
                              setScoreValue(sc !== null ? String(sc) : "");
                            }}
                          >
                            {sc !== null ? (
                              <span className="ge__scoreVal">{sc}</span>
                            ) : (
                              <span className="ge__scoreEmpty">–</span>
                            )}
                          </td>
                        );
                      })
                    )}

                    <td
                      className="ge__td ge__td--clickable"
                      onClick={() => {
                        setCsModal({ student: stu, studentKey });
                        setCsValue(getCS(studentKey, studentId) !== null ? String(getCS(studentKey, studentId)) : "");
                      }}
                    >
                      {getCS(studentKey, studentId) !== null ? (
                        <span className="ge__scoreVal">{getCS(studentKey, studentId)}</span>
                      ) : (
                        <span className="ge__scoreEmpty">–</span>
                      )}
                    </td>

                    <td className="ge__td">
                      {qg !== null ? (
                        <span
                          className={`ge__final ${
                            qg < 75 ? "ge__final--bad" : "ge__final--good"
                          }`}
                        >
                          {qg.toFixed(1)}
                        </span>
                      ) : (
                        <span className="ge__scoreEmpty">–</span>
                      )}
                    </td>

                    <td className="ge__td">
                      {qg !== null ? (
                        <span
                          className={`ge__badge ${
                            qg >= 75 ? "ge__badge--pass" : "ge__badge--fail"
                          }`}
                        >
                          {qg >= 75 ? "PASSED" : "FAILED"}
                        </span>
                      ) : (
                        <span className="ge__scoreEmpty">–</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {showAddItem && (
        <div className="ge__overlay" onClick={() => setShowAddItem(null)}>
          <div className="ge__modal" onClick={(e) => e.stopPropagation()}>
            <div className="ge__modalHeader">
              <h3>Add {showAddItem.charAt(0) + showAddItem.slice(1).toLowerCase()}</h3>
              <button className="ge__modalClose" onClick={() => { setShowAddItem(null); setError(""); }}>
                <X size={18} />
              </button>
            </div>

            <div className="ge__modalBody">
              {error && <div className="ge__error">⚠️ {error}</div>}
              <label>Title</label>
              <input
                className="ge__input"
                placeholder={`${
                  showAddItem.charAt(0) + showAddItem.slice(1).toLowerCase()
                } ${itemsByCategory(showAddItem).length + 1}`}
                value={newItem.title}
                onChange={(e) =>
                  setNewItem((p) => ({ ...p, title: e.target.value }))
                }
              />

              <label>Description / Instructions</label>
              <textarea
                className="ge__input ge__textarea"
                rows={3}
                value={newItem.description}
                onChange={(e) =>
                  setNewItem((p) => ({ ...p, description: e.target.value }))
                }
              />

              <div className="ge__modalRow">
                <div>
                  <label>Date Given</label>
                  <input
                    type="date"
                    className="ge__input"
                    value={newItem.date_given}
                    onChange={(e) =>
                      setNewItem((p) => ({ ...p, date_given: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label>Due Date</label>
                  <input
                    type="date"
                    className="ge__input"
                    value={newItem.due_date}
                    onChange={(e) =>
                      setNewItem((p) => ({ ...p, due_date: e.target.value }))
                    }
                  />
                </div>
              </div>

              <label>Total Score</label>
              <input
                type="number"
                className="ge__input"
                value={newItem.total_score}
                onChange={(e) =>
                  setNewItem((p) => ({
                    ...p,
                    total_score: parseInt(e.target.value, 10) || 0,
                  }))
                }
              />
              {error && /score/i.test(error) && (
                <p style={{ color: "#b91c1c", marginTop: "5px", fontSize: "0.9rem" }}>
                  {error}
                </p>
              )}
            </div>

            <div className="ge__modalFooter">
              <button className="ge__btnCancel" onClick={() => setShowAddItem(null)}>
                Cancel
              </button>
              <button className="ge__btnSave" onClick={() => handleAddItem(showAddItem)}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {editItem && (
        <div className="ge__overlay" onClick={() => setEditItem(null)}>
          <div className="ge__modal" onClick={(e) => e.stopPropagation()}>
            <div className="ge__modalHeader">
              <h3>Edit {editItem.category.charAt(0) + editItem.category.slice(1).toLowerCase()}</h3>
              <button className="ge__modalClose" onClick={() => { setEditItem(null); setError(""); }}>
                <X size={18} />
              </button>
            </div>

            <div className="ge__modalBody">
              {error && <div className="ge__error">⚠️ {error}</div>}
              <label>Title</label>
              <input
                className="ge__input"
                value={editForm.title || ""}
                onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
              />

              <label>Description / Instructions</label>
              <textarea
                className="ge__input ge__textarea"
                rows={3}
                value={editForm.description || ""}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, description: e.target.value }))
                }
              />

              <div className="ge__modalRow">
                <div>
                  <label>Date Given</label>
                  <input
                    type="date"
                    className="ge__input"
                    value={editForm.date_given || ""}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, date_given: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label>Due Date</label>
                  <input
                    type="date"
                    className="ge__input"
                    value={editForm.due_date || ""}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, due_date: e.target.value }))
                    }
                  />
                </div>
              </div>

              <label>Total Score</label>
              <input
                type="number"
                className="ge__input"
                min={1}
                value={editForm.total_score || 100}
                onChange={(e) =>
                  setEditForm((p) => ({
                    ...p,
                    total_score: parseInt(e.target.value, 10) || 100,
                  }))
                }
              />
            </div>

            <div className="ge__modalFooter">
              <button className="ge__btnCancel" onClick={() => setEditItem(null)}>
                Cancel
              </button>
              <button className="ge__btnSave" onClick={handleEditItem}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {scoreModal && (
        <div className="ge__overlay" onClick={() => setScoreModal(null)}>
          <div className="ge__modal ge__modal--sm" onClick={(e) => e.stopPropagation()}>
            <div className="ge__modalHeader">
              <h3>Enter Score</h3>
              <button className="ge__modalClose" onClick={() => { setScoreModal(null); setError(""); }}>
                <X size={18} />
              </button>
            </div>

            <div className="ge__modalBody">
              {error && <div className="ge__error">⚠️ {error}</div>}
              <p className="ge__scoreInfo">
                <strong>{scoreModal.student.student_name}</strong>
                <br />
                {scoreModal.item.title}{" "}
                <span className="ge__scoreMeta">
                  (max {scoreModal.item.total_score})
                </span>
              </p>

              <input
                type="number"
                className="ge__input ge__inputScore"
                min={0}
                max={scoreModal.item.total_score}
                autoFocus
                value={scoreValue}
                onChange={(e) => setScoreValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveScore()}
              />
            </div>

            <div className="ge__modalFooter">
              <button className="ge__btnCancel" onClick={() => setScoreModal(null)}>
                Cancel
              </button>
              <button className="ge__btnSave" onClick={handleSaveScore} disabled={!scoreValue}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {csModal && (
        <div className="ge__overlay" onClick={() => setCsModal(null)}>
          <div className="ge__modal ge__modal--sm" onClick={(e) => e.stopPropagation()}>
            <div className="ge__modalHeader">
              <h3>Class Standing</h3>
              <button className="ge__modalClose" onClick={() => { setCsModal(null); setError(""); }}>
                <X size={18} />
              </button>
            </div>

            <div className="ge__modalBody">
              {error && <div className="ge__error">⚠️ {error}</div>}
              <p className="ge__scoreInfo">
                <strong>{csModal.student.student_name}</strong>
                <br />
                Q{quarter} Class Standing{" "}
                <span className="ge__scoreMeta">(out of 100)</span>
              </p>

              <input
                type="number"
                className="ge__input ge__inputScore"
                min={0}
                max={100}
                autoFocus
                value={csValue}
                onChange={(e) => setCsValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveCS()}
              />
            </div>

            <div className="ge__modalFooter">
              <button className="ge__btnCancel" onClick={() => setCsModal(null)}>
                Cancel
              </button>
              <button className="ge__btnSave" onClick={handleSaveCS} disabled={!csValue}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showWeights && (
        <div className="ge__overlay" onClick={() => setShowWeights(false)}>
          <div className="ge__modal" onClick={(e) => e.stopPropagation()}>
            <div className="ge__modalHeader">
              <h3>Grade Weights – {selectedSubject?.name || "N/A"}</h3>
              <button className="ge__modalClose" onClick={() => { setShowWeights(false); setError(""); }}>
                <X size={18} />
              </button>
            </div>

            <div className="ge__modalBody">
              {error && <div className="ge__error">⚠️ {error}</div>}
              <p className="ge__weightNote">
                Adjust how much each category contributes to the quarter grade.
                Total must equal 100%, and each category must be at least {MIN_WEIGHT_PERCENT}%.
              </p>

              {[
                { key: "activity_weight", label: "Activities", color: "#3b82f6" },
                { key: "quiz_weight", label: "Quizzes", color: "#8b5cf6" },
                { key: "exam_weight", label: "Exams", color: "#ef4444" },
                { key: "class_standing_weight", label: "Class Standing", color: "#10b981" },
              ].map(({ key, label, color }) => (
                <div className="ge__weightRow" key={key}>
                  <span className="ge__weightLabel" style={{ color }}>
                    {label}
                  </span>
                  <input
                    type="number"
                    className="ge__input ge__inputWeight"
                    min={MIN_WEIGHT_PERCENT}
                    max={100}
                    value={tempWeights[key]}
                    onChange={(e) =>
                      setTempWeights((p) => ({
                        ...p,
                        [key]: parseInt(e.target.value, 10) || 0,
                      }))
                    }
                  />
                  <span className="ge__weightPct">%</span>
                </div>
              ))}

              <div
                className={`ge__weightTotal ${
                  weightTotal !== 100 || hasMinimumWeightViolation ? "ge__weightTotal--bad" : ""
                }`}
              >
                Total: {weightTotal}% {weightTotal !== 100 && "(must be 100%)"}
                {hasMinimumWeightViolation && ` (each weight must be at least ${MIN_WEIGHT_PERCENT}%)`}
              </div>
            </div>

            <div className="ge__modalFooter">
              <button className="ge__btnCancel" onClick={() => setShowWeights(false)}>
                Cancel
              </button>
              <button
                className="ge__btnSave"
                onClick={handleSaveWeights}
                disabled={weightTotal !== 100 || hasMinimumWeightViolation}
              >
                Save Weights
              </button>
            </div>
          </div>
        </div>
      )}

      <PreviewModal
        isOpen={printPreviewOpen}
        onClose={() => setPrintPreviewOpen(false)}
        title={`Grade Sheet - ${selectedSubject?.name || "N/A"} (${currentSection?.name || "N/A"})`}
        data={printPreviewData}
        columns={gradePreviewColumns.length > 0 ? gradePreviewColumns : [
          { key: "Student Name", label: "Student Name" },
          { key: "Activity %", label: "Activity %" },
          { key: "Quiz %", label: "Quiz %" },
          { key: "Exam %", label: "Exam %" },
          { key: "Class Standing", label: "Class Standing" },
          { key: "Quarter Grade", label: "Quarter Grade" },
          { key: "Status", label: "Status" },
        ]}
        filename={`Grade-Sheet-${selectedSubject?.name || "N/A"}-${currentSection?.name || "N/A"}`}
        onDownloadExcel={handleDownloadGradeExcel}
      />
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

export default Grade;

