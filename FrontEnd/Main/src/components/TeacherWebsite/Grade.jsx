import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, X, Edit2, Trash2, Settings, Calendar, FileText, Printer } from "lucide-react";
import "../TeacherWebsiteCSS/Grade.css";
import { apiFetch } from "../api/apiFetch";

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

  return labels[code] || String(value || "—");
};

const QUARTERS = [1, 2, 3, 4];

const CATEGORIES = [
  { key: "ACTIVITY", label: "Activities", color: "#3b82f6" },
  { key: "QUIZ", label: "Quizzes", color: "#8b5cf6" },
  { key: "EXAM", label: "Exams", color: "#ef4444" },
];

const getStudentKey = (student) => {
  if (!student) return "";

  const studentNumber = String(student.student_number || "").trim();
  if (studentNumber) return `num:${studentNumber.toLowerCase()}`;

  const username = String(student.username || "").trim();
  if (username) return `user:${username.toLowerCase()}`;

  const idValue = student.id != null ? String(student.id).trim() : "";
  return idValue ? `id:${idValue}` : "";
};

const Grade = () => {
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState("");
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

  const currentSection =
    sections.find((s) => String(s.id) === String(selectedSection)) || null;

  const canPublish =
    !!currentSection && students.length > 0 && items.length > 0 && !isPublishing;

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
    if (!teacherSubject?.subject_id) return;

    (async () => {
      try {
        const res = await apiFetch(
          `${API}/api/grades/my-sections/?subject=${teacherSubject.subject_id}`
        );

        if (!res.ok) {
          setSections([]);
          setSelectedSection("");
          return;
        }

        const data = await res.json();
        const nextSections = Array.isArray(data) ? data : [];

        setSections(nextSections);

        if (!nextSections.length) {
          setSelectedSection("");
          return;
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
  }, [teacherSubject]);

  const fetchAll = useCallback(async () => {
    if (!teacherSubject || !selectedSection) {
      setStudents([]);
      setItems([]);
      setScores([]);
      setClassStandings([]);
      return;
    }

    const subj = Number(teacherSubject.subject_id);

    try {
      const [itemsRes, studentsRes, scoresRes, csRes, wRes] = await Promise.all([
        apiFetch(
          `${API}/api/grades/items/?subject=${subj}&grade_level=${gradeLevel}&quarter=${quarter}`
        ),
        apiFetch(`${API}/api/grades/students/section/${selectedSection}/`),
        apiFetch(
          `${API}/api/grades/scores/?subject=${subj}&grade_level=${gradeLevel}&quarter=${quarter}`
        ),
        apiFetch(`${API}/api/grades/class-standing/?subject=${subj}&quarter=${quarter}`),
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
  }, [teacherSubject, selectedSection, gradeLevel, quarter]);

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
    if (!teacherSubject || !selectedSection) return;

    const totalScore = Number(newItem.total_score);
    if (Number.isNaN(totalScore) || totalScore <= 0) {
      setError("Total score must be greater than zero.");
      return;
    }

    const catItems = itemsByCategory(category);

    const body = {
      subject: Number(teacherSubject.subject_id),
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

      const data = await res.json().catch(() => null);
      console.log("Create grade item response:", res.status, data);

      if (!res.ok) {
        alert(
          data?.detail ||
            (typeof data === "object" ? JSON.stringify(data) : data) ||
            "Failed to create grade item."
        );
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
      alert("Something went wrong while creating the grade item.");
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm("Delete this item and all its scores?")) return;

    try {
      const res = await apiFetch(`${API}/api/grades/items/${itemId}/`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(
          data?.detail ||
            (typeof data === "object" ? JSON.stringify(data) : data) ||
            "Failed to delete item."
        );
        return;
      }

      fetchAll();
    } catch (e) {
      console.error(e);
      alert("Something went wrong while deleting the item.");
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

      const data = await res.json().catch(() => null);
      console.log("Edit grade item response:", res.status, data);

      if (!res.ok) {
        alert(
          data?.detail ||
            (typeof data === "object" ? JSON.stringify(data) : data) ||
            "Failed to update grade item."
        );
        return;
      }

      setError("");
      setEditItem(null);
      fetchAll();
    } catch (e) {
      console.error("Edit grade item error:", e);
      alert("Something went wrong while updating the grade item.");
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

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        alert(
          data?.detail ||
            (typeof data === "object" ? JSON.stringify(data) : data) ||
            "Failed to save score."
        );
        return;
      }

      setError("");
      setScoreModal(null);
      setScoreValue("");
      fetchAll();
    } catch (e) {
      console.error(e);
      alert("Something went wrong while saving the score.");
    }
  };

  const handleSaveCS = async () => {
    if (!csModal || !teacherSubject) return;

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
          subject: Number(teacherSubject.subject_id),
          quarter: Number(quarter),
          score: numericScore,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        alert(
          data?.detail ||
            (typeof data === "object" ? JSON.stringify(data) : data) ||
            "Failed to save class standing."
        );
        return;
      }

      setError("");
      setCsModal(null);
      setCsValue("");
      fetchAll();
    } catch (e) {
      console.error(e);
      alert("Something went wrong while saving class standing.");
    }
  };

  const handleSaveWeights = async () => {
    if (!teacherSubject) return;

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
    }

    try {
      const res = await apiFetch(
        `${API}/api/grades/weights/${teacherSubject.subject_id}/update/`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tempWeights),
        }
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        alert(
          data?.detail ||
            (typeof data === "object" ? JSON.stringify(data) : data) ||
            "Failed to save weights."
        );
        return;
      }

      setError("");
      setShowWeights(false);
      fetchAll();
    } catch (e) {
      console.error(e);
      alert("Something went wrong while saving weights.");
    }
  };

  const handlePublishAcademicHistory = async () => {
    if (!currentSection) {
      alert("Please select a section before publishing academic history.");
      return;
    }

    const schoolYearLabel =
      schoolYear?.name ||
      (schoolYear?.start_year && schoolYear?.end_year
        ? `${schoolYear.start_year}-${schoolYear.end_year}`
        : null);

    if (!schoolYearLabel) {
      alert("Unable to determine active school year. Please check school year settings.");
      return;
    }

    setPublishLoading(true);
    setPublishPreviewError("");

    try {
      const params = new URLSearchParams({
        section_id: String(selectedSection),
        subject_id: String(teacherSubject.subject_id),
        school_year: schoolYearLabel,
      });

      const res = await apiFetch(`${API}/api/grades/publish-history/?${params.toString()}`);
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setPublishPreviewError(data?.detail || "Unable to load publish preview.");
        setShowPublishModal(false);
      } else {
        setPublishPreviewRows(Array.isArray(data.rows) ? data.rows : []);
        setPublishCanConfirm(!!data.can_publish);
        setShowPublishModal(true);
        if (!data.can_publish) {
          setPublishPreviewError(
            `There are ${data.incomplete_count || 0} student(s) with incomplete grades (cannot publish).`
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

    const schoolYearLabel =
      schoolYear?.name ||
      (schoolYear?.start_year && schoolYear?.end_year
        ? `${schoolYear.start_year}-${schoolYear.end_year}`
        : null);

    setIsPublishing(true);

    try {
      const payload = {
        section_id: Number(selectedSection),
        subject_id: Number(teacherSubject.subject_id),
        school_year: schoolYearLabel,
      };

      const res = await apiFetch(`${API}/api/grades/publish-history/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.detail || "Failed to publish academic history. Please check logs and validate all fields.");
      } else {
        setPublishMessage(`Published: ${data.published || 0}, Updated: ${data.updated || 0}, Total: ${data.total || 0}`);
      }
    } catch (e) {
      console.error("Publish academic history error:", e);
      alert("Something went wrong when publishing academic history.");
    } finally {
      setIsPublishing(false);
      setShowPublishModal(false);
    }
  };

  const handlePrintGradeSheet = () => {
    if (!currentSection || displayStudents.length === 0) {
      alert("Please select a section with students before printing.");
      return;
    }

    if (!teacherSubject) {
      alert("Unable to determine subject information.");
      return;
    }

    try {
      // Pre-calculate category items outside the loop to improve performance
      const activityItems = itemsByCategory("ACTIVITY");
      const quizItems = itemsByCategory("QUIZ");
      const examItems = itemsByCategory("EXAM");

      const schoolYearText = schoolYear
        ? `S.Y. ${schoolYear.name || `${schoolYear.start_year}-${schoolYear.end_year}`}`
        : "N/A";

      const currentDate = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      // Build grade rows for each student
      const gradeRowsHTML = displayStudents
        .map((student) => {
          try {
            const studentKey = student.studentKey || getStudentKey(student);
            const studentId = student.id;
            const activityHTML = activityItems
              .map((item) => {
                const score = getScore(studentKey, item.id, studentId);
                return `<td style="text-align: center; font-size: 12px;">${score !== null ? `${score}/${item.total_score}` : "—"}</td>`;
              })
              .join("");

            const quizHTML = quizItems
              .map((item) => {
                const score = getScore(studentKey, item.id, studentId);
                return `<td style="text-align: center; font-size: 12px;">${score !== null ? `${score}/${item.total_score}` : "—"}</td>`;
              })
              .join("");

            const examHTML = examItems
              .map((item) => {
                const score = getScore(studentKey, item.id, studentId);
                return `<td style="text-align: center; font-size: 12px;">${score !== null ? `${score}/${item.total_score}` : "—"}</td>`;
              })
              .join("");

            const actAvg = categoryAvg(studentKey, studentId, "ACTIVITY");
            const quizAvg = categoryAvg(studentKey, studentId, "QUIZ");
            const examAvg = categoryAvg(studentKey, studentId, "EXAM");
            const cs = getCS(studentKey, studentId);
            const qg = quarterGrade(studentKey, studentId);
            
            // Ensure values are numbers
            const actAvgNum = actAvg !== null ? Number(actAvg) : null;
            const quizAvgNum = quizAvg !== null ? Number(quizAvg) : null;
            const examAvgNum = examAvg !== null ? Number(examAvg) : null;
            const csNum = cs !== null ? Number(cs) : null;
            const qgNum = qg !== null ? Number(qg) : null;
            
            const status = qgNum !== null ? (qgNum >= 75 ? "PASSED" : "FAILED") : "—";
            const statusColor = qgNum !== null ? (qgNum >= 75 ? "#047857" : "#dc2626") : "#6b7280";

            return `
              <tr>
                <td style="text-align: left; padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${student.student_name}</td>
                ${activityHTML}
                <td style="text-align: center; font-size: 12px; font-weight: 600; background: #f0f9ff;">${actAvgNum !== null ? actAvgNum.toFixed(1) : "—"}%</td>
                ${quizHTML}
                <td style="text-align: center; font-size: 12px; font-weight: 600; background: #f3f0ff;">${quizAvgNum !== null ? quizAvgNum.toFixed(1) : "—"}%</td>
                ${examHTML}
                <td style="text-align: center; font-size: 12px; font-weight: 600; background: #fef2f2;">${examAvgNum !== null ? examAvgNum.toFixed(1) : "—"}%</td>
                <td style="text-align: center; font-size: 12px; font-weight: 600; background: #f0fdf4;">${csNum !== null ? csNum.toFixed(1) : "—"}</td>
                <td style="text-align: center; font-size: 12px; font-weight: 700; background: #fffbeb;">
                  ${qgNum !== null ? qgNum.toFixed(2) : "—"}
                </td>
                <td style="text-align: center; font-size: 11px; color: white; font-weight: 600; background: ${statusColor}; padding: 4px 8px;">
                  ${status}
                </td>
              </tr>
            `;
          } catch (err) {
            console.error("Error building grade row for student:", student.student_name, err);
            return `<tr><td colspan="100" style="text-align: center; color: red;">Error: ${err.message}</td></tr>`;
          }
        })
        .join("");

      const activityHeaderHTML = activityItems
        .map((item, idx) => `<th style="font-size: 11px; padding: 8px 4px;">A${idx + 1}<br/>/${item.total_score}</th>`)
        .join("");

      const quizHeaderHTML = quizItems
        .map((item, idx) => `<th style="font-size: 11px; padding: 8px 4px;">Q${idx + 1}<br/>/${item.total_score}</th>`)
        .join("");

      const examHeaderHTML = examItems
        .map((item, idx) => `<th style="font-size: 11px; padding: 8px 4px;">E${idx + 1}<br/>/${item.total_score}</th>`)
        .join("");

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Grade Sheet</title>
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
      line-height: 1.4;
    }

    .print-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 30px;
    }

    .print-header {
      text-align: center;
      margin-bottom: 25px;
      border-bottom: 2px solid #1f2937;
      padding-bottom: 15px;
    }

    .print-header h1 {
      font-size: 26px;
      font-weight: 800;
      margin-bottom: 6px;
      letter-spacing: -0.5px;
    }

    .print-header .metadata {
      display: flex;
      justify-content: center;
      gap: 25px;
      font-size: 12px;
      color: #6b7280;
      margin-top: 10px;
      flex-wrap: wrap;
    }

    .metadata-item {
      display: flex;
      gap: 3px;
      align-items: center;
    }

    .metadata-label {
      font-weight: 600;
      color: #1f2937;
    }

    .section-title {
      font-size: 13px;
      font-weight: 700;
      margin: 20px 0 10px 0;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #1f2937;
      border-bottom: 2px solid #5ba3c7;
      padding-bottom: 6px;
    }

    .legend {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      margin-bottom: 20px;
      font-size: 11px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .legend-box {
      width: 30px;
      height: 20px;
      border-radius: 3px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 600;
      font-size: 10px;
    }

    .table-wrapper {
      margin-bottom: 30px;
      overflow: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border: 1px solid #d5d5d5;
      border-radius: 4px;
      font-size: 12px;
    }

    th {
      background: #1f2937;
      color: white;
      padding: 10px 8px;
      text-align: center;
      font-weight: 700;
      border-bottom: 1px solid #374151;
      font-size: 11px;
    }

    th.student-col {
      text-align: left;
    }

    td {
      padding: 8px 6px;
      border-bottom: 1px solid #e5e7eb;
    }

    tr:last-child td {
      border-bottom: 1px solid #d5d5d5;
    }

    .footer {
      margin-top: 25px;
      padding-top: 15px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 11px;
    }

    .breakdown-info {
      font-size: 11px;
      color: #6b7280;
      margin-bottom: 15px;
      background: #f9fafb;
      padding: 10px 12px;
      border-radius: 4px;
      border-left: 3px solid #5ba3c7;
    }

    @media print {
      body {
        background: white;
      }
      .print-container {
        padding: 20px;
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
      <h1>GRADE SHEET</h1>
      <div class="metadata">
        <div class="metadata-item">
          <span class="metadata-label">Subject:</span>
          <span>${teacherSubject?.subject_name || "N/A"}</span>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Section:</span>
          <span>${currentSection?.name || "N/A"}</span>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Quarter:</span>
          <span>${quarter}</span>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">${schoolYearText}</span>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Generated:</span>
          <span>${currentDate}</span>
        </div>
      </div>
    </div>

    <div class="section-title">Grade Category Weights</div>
    <div class="legend">
      <div class="legend-item">
        <div class="legend-box" style="background: #3b82f6;">A</div>
        <span>Activities: ${weights.activity_weight}%</span>
      </div>
      <div class="legend-item">
        <div class="legend-box" style="background: #8b5cf6;">Q</div>
        <span>Quizzes: ${weights.quiz_weight}%</span>
      </div>
      <div class="legend-item">
        <div class="legend-box" style="background: #ef4444;">E</div>
        <span>Exams: ${weights.exam_weight}%</span>
      </div>
      <div class="legend-item">
        <div class="legend-box" style="background: #10b981;">CS</div>
        <span>Class Standing: ${weights.class_standing_weight}%</span>
      </div>
    </div>

    <div class="breakdown-info">
      <strong>Grade Calculation:</strong> Category averages are calculated as (total points earned ÷ total points possible) × 100%. 
      Quarter grade is the weighted average of all categories with available grades.
    </div>

    <div class="section-title">Student Grade Breakdown</div>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th class="student-col">Student Name</th>
            ${activityHeaderHTML}
            <th style="background: #0f52ba; font-size: 11px; padding: 8px 4px;">Act Avg %</th>
            ${quizHeaderHTML}
            <th style="background: #6f42c1; font-size: 11px; padding: 8px 4px;">Quiz Avg %</th>
            ${examHeaderHTML}
            <th style="background: #dc2626; font-size: 11px; padding: 8px 4px;">Exam Avg %</th>
            <th style="background: #059669; font-size: 11px; padding: 8px 4px;">Class Standing</th>
            <th style="background: #b45309; font-size: 11px; padding: 8px 4px;">Q${quarter} Grade</th>
            <th style="font-size: 11px; padding: 8px 4px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${gradeRowsHTML}
        </tbody>
      </table>
    </div>

    <div class="footer">
      <p>This grade sheet is confidential and for official use only.</p>
      <p>For inquiries regarding grades, please consult with your teacher during office hours.</p>
    </div>
  </div>
</body>
</html>
      `;

      // Use Blob and object URL for more reliable print window opening
      try {
        const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
        const blobUrl = URL.createObjectURL(blob);
        const printWindow = window.open(blobUrl, "PRINT_GRADES", "width=1200,height=900");
        
        if (!printWindow) {
          alert("Unable to open print window. Please check if pop-ups are blocked.");
          URL.revokeObjectURL(blobUrl);
          return;
        }

        // Wait for content to fully load before printing
        setTimeout(() => {
          try {
            printWindow.print();
            // Clean up the object URL after printing
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
          } catch (err) {
            console.error("Error printing:", err);
            alert("An error occurred while printing. Please try again.");
            URL.revokeObjectURL(blobUrl);
          }
        }, 1000);
      } catch (err) {
        console.error("Error creating print preview:", err);
        alert("An error occurred while preparing the print preview. Please try again.");
      }
    } catch (err) {
      console.error("Error in handlePrintGradeSheet:", err);
      alert("An error occurred while generating the grade sheet. Please check the console for details.");
    }
  };


  const weightTotal =
    Number(tempWeights.activity_weight || 0) +
    Number(tempWeights.quiz_weight || 0) +
    Number(tempWeights.exam_weight || 0) +
    Number(tempWeights.class_standing_weight || 0);

  if (!teacherSubject) {
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
          <span className="ge__subjectTag">{teacherSubject.subject_name}</span>
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
                        <td style={{ textAlign: "center", padding: "6px", borderBottom: "1px solid #eee" }}>{row.q1 != null ? row.q1 : "—"}</td>
                        <td style={{ textAlign: "center", padding: "6px", borderBottom: "1px solid #eee" }}>{row.q2 != null ? row.q2 : "—"}</td>
                        <td style={{ textAlign: "center", padding: "6px", borderBottom: "1px solid #eee" }}>{row.q3 != null ? row.q3 : "—"}</td>
                        <td style={{ textAlign: "center", padding: "6px", borderBottom: "1px solid #eee" }}>{row.q4 != null ? row.q4 : "—"}</td>
                        <td style={{ textAlign: "center", padding: "6px", borderBottom: "1px solid #eee" }}>{row.final_grade != null ? row.final_grade : "—"}</td>
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
        <h3 className="ge__tableTitle">Student Scores — Q{quarter}</h3>
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
                              <span className="ge__scoreEmpty">—</span>
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
                        <span className="ge__scoreEmpty">—</span>
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
                        <span className="ge__scoreEmpty">—</span>
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
                        <span className="ge__scoreEmpty">—</span>
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
              <h3>Grade Weights — {teacherSubject.subject_name}</h3>
              <button className="ge__modalClose" onClick={() => { setShowWeights(false); setError(""); }}>
                <X size={18} />
              </button>
            </div>

            <div className="ge__modalBody">
              {error && <div className="ge__error">⚠️ {error}</div>}
              <p className="ge__weightNote">
                Adjust how much each category contributes to the quarter grade.
                Total must equal 100%.
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
                    min={0}
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
                  weightTotal !== 100 ? "ge__weightTotal--bad" : ""
                }`}
              >
                Total: {weightTotal}% {weightTotal !== 100 && "(must be 100%)"}
              </div>
            </div>

            <div className="ge__modalFooter">
              <button className="ge__btnCancel" onClick={() => setShowWeights(false)}>
                Cancel
              </button>
              <button
                className="ge__btnSave"
                onClick={handleSaveWeights}
                disabled={weightTotal !== 100}
              >
                Save Weights
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Grade;
