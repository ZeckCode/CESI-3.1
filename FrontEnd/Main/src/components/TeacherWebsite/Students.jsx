import React, { useMemo, useState, useEffect } from "react";
import { Search, Users, User, Mail, Phone, Calendar, ChevronDown, ChevronUp, FileText } from "lucide-react";
import "../TeacherWebsiteCSS/Students.css";
import { apiFetch } from "../api/apiFetch";

const API = "";

const Students = () => {
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState("");
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedStudentId, setExpandedStudentId] = useState(null);
  const [schoolYear, setSchoolYear] = useState(null);

  // Fetch sections on mount
  useEffect(() => {
    (async () => {
      try {
        const [secRes, syRes] = await Promise.all([
          apiFetch(`${API}/api/attendance/my-sections/`),
          apiFetch(`${API}/api/classmanagement/school-years/active/`),
        ]);

        if (secRes.ok) {
          const data = await secRes.json();
          setSections(data);
          if (data.length > 0) {
            setSelectedSection(String(data[0].id));
          }
        }

        if (syRes.ok) {
          const syData = await syRes.json();
          setSchoolYear(syData);
        }
      } catch (e) {
        console.error("Failed to load sections:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Fetch students when section changes
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
          setStudents(data);
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

  // Filter students by search term
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

  // Get current section name
  const currentSectionName = useMemo(() => {
    const sec = sections.find((s) => String(s.id) === String(selectedSection));
    return sec?.name || "—";
  }, [sections, selectedSection]);

  // Stats
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
      {/* Header */}
      <header className="sr__header">
        <div className="sr__headerLeft">
          <h2 className="sr__title">Students Roster</h2>
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
              <option>Loading...</option>
            ) : sections.length === 0 ? (
              <option>No sections assigned</option>
            ) : (
              sections.map((sec) => {
                const gradeLabel =
                  sec.grade_level === 0 || sec.grade_level === "0" || sec.grade_level === "kinder"
                    ? "K"
                    : `${sec.grade_level}`;
                return (
                  <option key={sec.id} value={sec.id}>
                    {gradeLabel} - {sec.name}
                  </option>
                );
              })
            )}
          </select>
        </div>
      </header>

      {/* Stats */}
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

      {/* Loading */}
      {loadingStudents && (
        <div className="sr__loading">Loading students...</div>
      )}

      {/* Table */}
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
                    const fullName = student.name || `${firstName} ${lastName}`.trim() || "Unknown Student";
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
                                    <div className="srValue">{student.grade_level || "—"}</div>
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
