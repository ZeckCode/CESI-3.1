import React, { useEffect, useMemo, useState } from "react";
import "../StudentWebsiteCSS/Dashboard.css";
import { apiFetch } from "../api/apiFetch";

const API_BASE = "";

function toAbsUrl(path) {
  if (!path) return null;
  return path.startsWith("http") ? path : `${API_BASE}${path}`;
}

function getFirstImagePath(a) {
  const firstImage = a?.media?.find((m) =>
    /\.(jpg|jpeg|png|gif|webp)$/i.test(m?.file || m?.file_url || "")
  );
  return firstImage?.file_url || firstImage?.file || null;
}

// ── Helpers ────────────────────────────────────────
const FMT_TIME = (t) => {
  if (!t) return "";
  const parts = t.split(":");
  const h = parseInt(parts[0], 10);
  const m = parts[1] || "00";
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = ((h - 1 + 12) % 12) + 1;
  return `${hr}:${m} ${ampm}`;
};

const TODAY_CODE = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][
  new Date().getDay()
];

// ── Announcements sub-component ────────────────────
function StudentAnnouncementsPanel() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [active, setActive] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await apiFetch("/api/announcements/");
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.results || [];
        if (mounted) setAnnouncements(list);
      } catch (e) {
        console.error(e);
        if (mounted) setErr("Failed to load announcements.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const latest = useMemo(() => announcements.slice(0, 3), [announcements]);

  return (
    <>
      <div className="card-body-padding sd__annBody">
        {loading ? (
          <p className="sd__muted">Loading announcements…</p>
        ) : err ? (
          <p className="sd__danger">{err}</p>
        ) : announcements.length === 0 ? (
          <p className="sd__muted">No announcements yet.</p>
        ) : (
          latest.map((a) => (
            <div
              key={a.id}
              className="sd__annItem"
              onClick={() => setActive(a)}
            >
              <div className="sd__annTitle">{a.title || "Untitled"}</div>
              <div className="sd__annMeta">
                {a.publish_date || a.created_at
                  ? new Date(a.publish_date || a.created_at).toLocaleString()
                  : ""}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card-footer-center">
        <button
          type="button"
          className="view-all-link"
          onClick={() => setListOpen(true)}
          disabled={loading || announcements.length === 0}
        >
          See All Updates
        </button>
      </div>

      {/* List modal */}
      {listOpen && (
        <div className="ann-modal-overlay" onClick={() => setListOpen(false)}>
          <div className="ann-modal" onClick={(e) => e.stopPropagation()}>
            <span className="ann-modal-close" onClick={() => setListOpen(false)}>✕</span>
            <h3 className="ann-modal-title">Announcements</h3>
            <div className="ann-list">
              {announcements.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="ann-list-item"
                  onClick={() => { setListOpen(false); setActive(a); }}
                >
                  <div className="ann-list-title">{a.title || "Untitled"}</div>
                  <div className="ann-list-meta">
                    {a.publish_date || a.created_at
                      ? new Date(a.publish_date || a.created_at).toLocaleString()
                      : ""}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {active && (
        <AnnouncementDetailModal a={active} onClose={() => setActive(null)} />
      )}
    </>
  );
}

// ── Main Dashboard ─────────────────────────────────
const Dashboard = () => {
  const [profile, setProfile] = useState(null);
  const [attStats, setAttStats] = useState(null);
  const [grades, setGrades] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [meRes, attRes, gradeRes, schRes] = await Promise.all([
          apiFetch("/api/accounts/me/detail/"),
          apiFetch("/api/attendance/my-stats/"),
          apiFetch("/api/grades/my-grades/"),
          apiFetch("/api/classmanagement/schedules/my/"),
        ]);
        if (meRes.ok) setProfile(await meRes.json());
        if (attRes.ok) setAttStats(await attRes.json());
        if (gradeRes.ok) {
          const g = await gradeRes.json();
          setGrades(Array.isArray(g) ? g : []);
        }
        if (schRes.ok) {
          const s = await schRes.json();
          setSchedule(Array.isArray(s) ? s : []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const todaySchedule = useMemo(
    () => schedule.filter((s) => s.day_of_week === TODAY_CODE),
    [schedule]
  );

  const gradedSubjects = useMemo(
    () => grades.filter((g) => g.final_grade !== null),
    [grades]
  );

  const avgGrade = useMemo(
    () =>
      gradedSubjects.length
        ? gradedSubjects.reduce((sum, g) => sum + g.final_grade, 0) /
          gradedSubjects.length
        : null,
    [gradedSubjects]
  );

  const studentName = profile
    ? [
        profile.profile?.student_first_name,
        profile.profile?.student_last_name,
      ]
        .filter(Boolean)
        .join(" ") || profile.username
    : "Student";

  const gradeLevel = profile?.profile?.grade_level;
  const sectionName = profile?.profile?.section?.name;
  const gradeLabelStr = gradeLevel
    ? parseInt(gradeLevel) === 0
      ? "Kinder"
      : `Grade ${gradeLevel}`
    : null;

  const attPct =
    attStats?.attendance_percentage !== undefined
      ? attStats.attendance_percentage
      : attStats?.attendance_pct ?? null;

  return (
    <div className="dashboard-content">
      <header className="content-header">
        
        <p className="sd__welcome">
          Hello, <strong>{studentName}</strong>
          {gradeLabelStr && sectionName
            ? ` · ${gradeLabelStr} – ${sectionName}`
            : ""}
        </p>
      </header>

      {/* Stats Row */}
      <div className="sd__statsRow">
        <div className="sdStat sdStat--blue">
          <span className="sdStat__icon" aria-hidden="true">📊</span>
          <div>
            <div className="sdStat__label">ATTENDANCE</div>
            <div className="sdStat__value">
              {loading
                ? "—"
                : attPct !== null
                ? `${Number(attPct).toFixed(0)}%`
                : "—"}
            </div>
          </div>
        </div>

        <div className="sdStat sdStat--success">
          <span className="sdStat__icon" aria-hidden="true">🏅</span>
          <div>
            <div className="sdStat__label">AVG GRADE</div>
            <div className="sdStat__value">
              {loading
                ? "—"
                : avgGrade !== null
                ? `${avgGrade.toFixed(1)}`
                : "—"}
            </div>
          </div>
        </div>

        <div className="sdStat sdStat--warn">
          <span className="sdStat__icon" aria-hidden="true">📅</span>
          <div>
            <div className="sdStat__label">TODAY'S CLASSES</div>
            <div className="sdStat__value">
              {loading ? "—" : todaySchedule.length}
            </div>
          </div>
        </div>
      </div>

      {/* Main grid: schedule + announcements */}
      <div className="dashboard-grid">
        {/* Today's Schedule */}
        <section className="dashboard-card">
          <div className="card-header-blue">
            <h6 className="header-title">📅 Today's Schedule</h6>
          </div>
          <div className="card-body-flush">
            {loading ? (
              <div className="sd__listItem">Loading schedule…</div>
            ) : todaySchedule.length === 0 ? (
              <div className="sd__listItem">No classes scheduled today.</div>
            ) : (
              todaySchedule.map((s) => (
                <div className="sd__listItem" key={s.id}>
                  <div className="sd__listLeft">
                    <div className="sd__iconBox" aria-hidden="true">📘</div>
                    <div>
                      <div className="sd__listTitle">{s.subject_name}</div>
                      <div className="sd__listMeta">
                        {s.teacher_name}
                        {s.room_code ? ` · Room ${s.room_code}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="sd__listTime">
                    {FMT_TIME(s.start_time)} – {FMT_TIME(s.end_time)}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Announcements */}
        <section className="dashboard-card">
          <div className="card-header-red">
            <h6 className="header-title">📣 Announcements</h6>
          </div>
          <StudentAnnouncementsPanel />
        </section>
      </div>

      {/* Grade Summary */}
      {/* <section className="dashboard-card info-card" style={{ marginTop: "1.5rem" }}>
        <div className="card-header-blue">
          <h6 className="header-title">🏅 Grade Summary</h6>
        </div>
        <div className="card-body-padding">
          {loading ? (
            <p className="sd__muted">Loading grades…</p>
          ) : grades.length === 0 ? (
            <p className="sd__muted">No grade data available yet.</p>
          ) : (
            <div className="sd__gradeScroll">
              <table className="sd__table">
                <thead>
                  <tr>
                    <th className="sd__th sd__th--left">SUBJECT</th>
                    <th className="sd__th">Q1</th>
                    <th className="sd__th">Q2</th>
                    <th className="sd__th">Q3</th>
                    <th className="sd__th">Q4</th>
                    <th className="sd__th">FINAL</th>
                    <th className="sd__th">REMARKS</th>
                  </tr>
                </thead>
                <tbody>
                  {grades.map((g) => (
                    <tr key={g.subject_id} className="sd__tr">
                      <td className="sd__td sd__td--name">{g.subject_name}</td>
                      <td className="sd__td">{g.q1 ?? "—"}</td>
                      <td className="sd__td">{g.q2 ?? "—"}</td>
                      <td className="sd__td">{g.q3 ?? "—"}</td>
                      <td className="sd__td">{g.q4 ?? "—"}</td>
                      <td className="sd__td sd__td--bold">
                        {g.final_grade ?? "—"}
                      </td>
                      <td className="sd__td">
                        {g.remarks ? (
                          <span
                            className={
                              "sd__pill " +
                              (g.remarks === "PASSED"
                                ? "sd__pill--pass"
                                : "sd__pill--fail")
                            }
                          >
                            {g.remarks}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section> */}

      {/* Info Sections */}
      <InfoSection
        title="ABOUT CESI"
        header="What is CESI Portal?"
        img="/port.png"
        tags={["Security", "Efficiency", "Accessibility"]}
        text="The CESI Portal is your all-in-one academic command center. Everything you need to manage your student life is organized into a single, user-friendly digital hub."
      />

      <InfoSection
        title="BACK TO SCHOOL"
        header="Back to School 2025-2026"
        img="/bsch.jpg"
        text="A Fresh Start Starts Now: Ready to learn, grow, and succeed together."
      />
    </div>
  );
};

/* --- Sub-Components --- */

const NotificationItem = ({ icon, title, meta, time, status }) => (
  <div className="list-item">
    <div className={`icon-circle status-${status}`}>
      <i className={`bi ${icon}`}></i>
    </div>
    <div className="item-content">
      <div className="item-main-row">
        <h6 className="item-title">{title}</h6>
        <span className={`item-time ${status === "primary" ? "active" : ""}`}>
          {time}
        </span>
      </div>
      <small className="item-meta">{meta}</small>
    </div>
  </div>
);

const AnnouncementItem = ({ title, detail, icon, type, onClick }) => (
  <div
    className="announcement-block"
    onClick={onClick}
    style={onClick ? { cursor: "pointer" } : undefined}
  >
    <h6 className={`announcement-title ${type ? `text-${type}` : ""}`}>
      {title}
    </h6>
    <p className="announcement-detail">
      {icon && <i className={`bi ${icon} me-1`}></i>} {detail}
    </p>
  </div>
);

const InfoSection = ({ title, header, img, text, tags }) => (
  <section className="dashboard-card info-card mt-4">
    <div className="card-header-blue">
      <h6 className="header-title">
        <i className="bi bi-stars me-2"></i>
        {title}
      </h6>
    </div>

    <div className="card-body-padding">
      <div className="info-layout">
        <div className="info-image-wrapper">
          <img src={img} alt={title} className="info-image" />
        </div>

        <div className="info-text-wrapper">
          <h5 className="info-header">{header}</h5>
          <p className="info-description">{text}</p>

          {tags && (
            <div className="tag-container">
              {tags.map((tag) => (
                <span key={tag} className="info-tag">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  </section>
);

function AnnouncementDetailModal({ a, onClose }) {
  const img = toAbsUrl(getFirstImagePath(a));

  return (
    <div className="ann-modal-overlay" onClick={onClose}>
      <div className="ann-modal" onClick={(e) => e.stopPropagation()}>
        <span className="ann-modal-close" onClick={onClose}>
          ✕
        </span>

        {img && <img src={img} alt="" className="ann-modal-image" />}

        <h2 className="ann-modal-title">{a.title || "Untitled"}</h2>

        <div className="ann-modal-meta">
          {(a.target_role || "").toUpperCase()} •{" "}
          {a.publish_date || a.created_at
            ? new Date(a.publish_date || a.created_at).toLocaleString()
            : ""}
        </div>

        <p className="ann-modal-content">{a.content || a.description || ""}</p>
      </div>
    </div>
  );
}

export default Dashboard;