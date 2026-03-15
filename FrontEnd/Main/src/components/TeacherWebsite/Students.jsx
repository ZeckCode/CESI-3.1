import React, { useMemo, useState, useEffect } from "react";
import {
  Search,
  Users,
  User,
  Mail,
  Phone,
  Calendar,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";
import "../TeacherWebsiteCSS/Students.css";
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

const Students = () => {
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState("");
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedStudentId, setExpandedStudentId] = useState(null);
  const [schoolYear, setSchoolYear] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [secRes, syRes] = await Promise.all([
          apiFetch(`${API}/api/attendance/my-sections/`),
          apiFetch(`${API}/api/classmanagement/school-years/active/`),
        ]);

        if (secRes.ok) {
          const data = await secRes.json();
          const nextSections = Array.isArray(data) ? data : [];
          setSections(nextSections);

          if (nextSections.length > 0) {
            setSelectedSection(String(nextSections[0].id));
          }
        } else {
          setSections([]);
        }

        if (syRes.ok) {
          const syData = await syRes.json();
          setSchoolYear(syData);
        }
      } catch (e) {
        console.error("Failed to load sections:", e);
        setSections([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedSection) {
      setStudents([]);
      return;
    }

    (async () => {
      setLoadingStudents(true);
      try {
        const res = await apiFetch(
          `${API}/api/attendance/records/section_students/?section=${selectedSection}`
        );
        if (res.ok) {
          const data = await res.json();
          setStudents(Array.isArray(data) ? data : []);
        } else {
          setStudents([]);
        }
      } catch (e) {
        console.error("Failed to load students:", e);
        setStudents([]);
      } finally {
        setLoadingStudents(false);
        setExpandedStudentId(null);
      }
    })();
  }, [selectedSection]);

  const filteredStudents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return students;

    return students.filter((s) => {
      const fullName = (s.name || `${s.first_name || ""} ${s.last_name || ""}`).toLowerCase();
      const lrn = (s.lrn || "").toLowerCase();
      const email = (s.email || "").toLowerCase();
      return fullName.includes(term) || lrn.includes(term) || email.includes(term);
    });
  }, [students, searchTerm]);

  const toggleStudent = (id) => {
    setExpandedStudentId((prev) => (prev === id ? null : id));
  };

  const currentSectionName = useMemo(() => {
    const sec = sections.find((s) => String(s.id) === String(selectedSection));
    if (!sec) return "—";
    return `${GRADE_FULL_LABEL(getGradeSource(sec))} - ${sec.name}`;
  }, [sections, selectedSection]);

  const stats = useMemo(() => {
    const male = filteredStudents.filter((s) => s.gender?.toLowerCase() === "male").length;
    const female = filteredStudents.filter(
      (s) => s.gender?.toLowerCase() === "female" || s.gender?.toLowerCase() === "f"
    ).length;

    return {
      total: filteredStudents.length,
      male,
      female,
    };
  }, [filteredStudents]);

  return (
    <div className="sr">
      <header className="sr__header">
        <div className="sr__headerLeft">
          <p className="sr__subtitle">
            {schoolYear && (
              <span className="sr__syTag">
                <Calendar size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
                S.Y. {schoolYear.name || `${schoolYear.start_year}-${schoolYear.end_year}`}
              </span>
            )}
          </p>
        </div>

        <div className="sr__headerRight">
          <div className="srSearch">
            <Search size={16} className="srSearch__icon" />
            <input
              type="text"
              className="srSearch__input"
              placeholder="Search name or LRN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="sr__select"
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            disabled={loading}
          >
            {loading ? (
              <option value="">Loading...</option>
            ) : sections.length === 0 ? (
              <option value="">No sections assigned</option>
            ) : (
              sections.map((sec) => (
                <option key={sec.id} value={String(sec.id)}>
                  {GRADE_FULL_LABEL(getGradeSource(sec))} - {sec.name}
                </option>
              ))
            )}
          </select>
        </div>
      </header>

      <section className="sr__stats">
        <div className="srStat">
          <div className="srStat__icon srStat__icon--primary">
            <Users size={20} />
          </div>
          <div>
            <div className="srStat__label">Total Students</div>
            <div className="srStat__value">{stats.total}</div>
          </div>
        </div>

        <div className="srStat">
          <div className="srStat__icon srStat__icon--info">
            <User size={20} />
          </div>
          <div>
            <div className="srStat__label">Male</div>
            <div className="srStat__value">{stats.male}</div>
          </div>
        </div>

        <div className="srStat">
          <div className="srStat__icon srStat__icon--pink">
            <User size={20} />
          </div>
          <div>
            <div className="srStat__label">Female</div>
            <div className="srStat__value">{stats.female}</div>
          </div>
        </div>

        <div className="srStat">
          <div className="srStat__icon srStat__icon--success">
            <FileText size={20} />
          </div>
          <div>
            <div className="srStat__label">Section</div>
            <div className="srStat__value srStat__value--small">{currentSectionName}</div>
          </div>
        </div>
      </section>

      {loadingStudents && <div className="sr__loading">Loading students...</div>}

      {!loadingStudents && (
        <section className="sr__card">
          <div className="sr__tableWrap">
            <table className="srTable">
              <thead>
                <tr>
                  <th className="srTh srTh--left">Student Name</th>
                  <th className="srTh">LRN</th>
                  <th className="srTh">Gender</th>
                  <th className="srTh">Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td className="srTd sr__empty" colSpan={4}>
                      {selectedSection ? "No students found." : "Select a section to view students."}
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student) => {
                    const isOpen = expandedStudentId === student.id;
                    const firstName = student.first_name || "";
                    const lastName = student.last_name || "";
                    const fullName =
                      student.name || `${firstName} ${lastName}`.trim() || "Unknown Student";
                    const initial = firstName.charAt(0) || lastName.charAt(0) || "S";
                    const email = student.email || "—";
                    const lrn = student.lrn || "—";
                    const gender = student.gender || "—";

                    return (
                      <React.Fragment key={student.id}>
                        <tr className="srTr">
                          <td className="srTd srTd--left">
                            <div className="srRow">
                              <div className="srAvatar" aria-hidden="true">
                                {initial.toUpperCase()}
                              </div>

                              <div className="srMain">
                                <div className="srName">{fullName}</div>
                                <div className="srEmail">
                                  <Mail size={12} />
                                  {email}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="srTd srId">{lrn}</td>
                          <td className="srTd">{gender}</td>

                          <td className="srTd">
                            <button
                              type="button"
                              className={`srBtn ${isOpen ? "srBtn--dark" : "srBtn--outline"}`}
                              onClick={() => toggleStudent(student.id)}
                            >
                              {isOpen ? (
                                <>
                                  <ChevronUp size={14} />
                                  Hide
                                </>
                              ) : (
                                <>
                                  <ChevronDown size={14} />
                                  View
                                </>
                              )}
                            </button>
                          </td>
                        </tr>

                        {isOpen && (
                          <tr className="srDetailRow">
                            <td colSpan={4} className="srDetailCell">
                              <div className="srDetail">
                                <div className="srDetail__grid">
                                  <div className="srField">
                                    <div className="srLabel">Grade Level</div>
                                    <div className="srValue">
                                      {GRADE_FULL_LABEL(getGradeSource(student))}
                                    </div>
                                  </div>

                                  <div className="srField">
                                    <div className="srLabel">Guardian Name</div>
                                    <div className="srValue">{student.guardian_name || "—"}</div>
                                  </div>

                                  <div className="srField">
                                    <div className="srLabel">Guardian Contact</div>
                                    <div className="srValue">
                                      <Phone size={12} />
                                      {student.guardian_contact || "—"}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};

export default Students;