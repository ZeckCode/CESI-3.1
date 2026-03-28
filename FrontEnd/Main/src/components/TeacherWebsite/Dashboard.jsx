import React, { useEffect, useMemo, useState } from "react";
import "../TeacherWebsiteCSS/Dashboard.css";
import { apiFetch } from "../api/apiFetch";
import { API_BASE_URL } from "../../config/api";

function toAbsUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = String(API_BASE_URL || "").replace(/\/api\/?$/i, "").replace(/\/$/, "");
  const p = String(path).replace(/^\/+/, "");
  return `${base}/${p}`.replace(/([^:]\/)\/+/, "$1");
}

function getFirstImagePath(a) {
  const firstImage = a?.media?.find((m) =>
    /\.(jpg|jpeg|png|gif|webp)$/i.test(m?.file || m?.file_url || "")
  );
  return firstImage?.file_url || firstImage?.file || null;
}

function getFirstMedia(a) {
  return Array.isArray(a?.media) ? a.media[0] : null;
}

function TeacherAnnouncementsPanel() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [listOpen, setListOpen] = useState(false);
  const [active, setActive] = useState(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setErr("");
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

    return () => {
      mounted = false;
    };
  }, []);

  const latest = useMemo(() => announcements.slice(0, 3), [announcements]);

  return (
    <>
      <div className="tdbCard__body tdbCard__body--flush">
        {loading ? (
          <div className="tdbCard__empty">Loading announcements…</div>
        ) : err ? (
          <div className="tdbCard__empty" style={{ color: "crimson" }}>
            {err}
          </div>
        ) : announcements.length === 0 ? (
          <div className="tdbCard__empty">No announcements yet.</div>
        ) : (
          <div className="tdbAnnouncements">
            {latest.map((a) => {
              const img = toAbsUrl(getFirstImagePath(a));
              const isImg = img && /\.(jpg|jpeg|png|gif|webp)$/i.test(img);

              return (
                <div
                  key={a.id}
                  className="tdbAnnouncement"
                  onClick={() => setActive(a)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="tdbAnnouncement__top">
                    <div className="tdbAnnouncement__title">{a.title || "Untitled"}</div>
                    <div className="tdbAnnouncement__date">
                      {a.publish_date || a.created_at
                        ? new Date(a.publish_date || a.created_at).toLocaleDateString()
                        : ""}
                    </div>
                  </div>

                  <p className="tdbAnnouncement__desc">
                    {(a.content || "").slice(0, 100)}
                    {(a.content || "").length > 100 ? "…" : ""}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="tdbCard__footer">
        <button
          type="button"
          className="tdbCard__link"
          onClick={() => setListOpen(true)}
          disabled={loading || announcements.length === 0}
        >
          View All Announcements →
        </button>
      </div>

      {/* View All Modal */}
      {listOpen && (
        <div className="tdbModal__overlay" onClick={() => setListOpen(false)}>
          <div className="tdbModal" onClick={(e) => e.stopPropagation()}>
            <span className="tdbModal__close" onClick={() => setListOpen(false)}>
              ✕
            </span>

            <h3 className="tdbModal__title">All Announcements</h3>

            <div className="tdbModal__list">
              {announcements.map((a) => {
                const img = toAbsUrl(getFirstImagePath(a));

                return (
                  <button
                    key={a.id}
                    type="button"
                    className="tdbModal__item"
                    onClick={() => {
                      setListOpen(false);
                      setActive(a);
                    }}
                  >
                    <div className="tdbModal__content">
                      <div className="tdbModal__itemTitle">{a.title || "Untitled"}</div>
                      <div className="tdbModal__itemMeta">
                        {a.publish_date || a.created_at
                          ? new Date(a.publish_date || a.created_at).toLocaleDateString()
                          : ""}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {active && <TeacherAnnouncementDetailModal a={active} onClose={() => setActive(null)} />}
    </>
  );
}

function TeacherAnnouncementDetailModal({ a, onClose }) {
  const img = toAbsUrl(getFirstImagePath(a));
  const firstMedia = getFirstMedia(a);
  const firstUrl = toAbsUrl(firstMedia?.file_url || firstMedia?.file);
  const isVideo = firstUrl && /\.(mp4|webm|ogg|mov)$/i.test(firstUrl);

  return (
    <div className="tdbModal__overlay" onClick={onClose}>
      <div className="tdbModal" onClick={(e) => e.stopPropagation()}>
        <span className="tdbModal__close" onClick={onClose}>✕</span>

        {firstUrl && isVideo ? (
          <video src={firstUrl} controls className="tdbModal__media" />
        ) : (
          img && <img src={img} alt="" className="tdbModal__media" />
        )}

        <h2 className="tdbModal__title">{a.title || "Untitled"}</h2>

        <div className="tdbModal__meta">
          {a.publish_date || a.created_at
            ? new Date(a.publish_date || a.created_at).toLocaleString()
            : ""}
        </div>

        <p className="tdbModal__content">{a.content || ""}</p>
      </div>
    </div>
  );
}


// ── Helpers ──────────────────────
const FMT_TIME = (t) => {
  if (!t) return "";
  const parts = t.split(":");
  const h = parseInt(parts[0], 10);
  const m = parts[1] || "00";
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = ((h - 1 + 12) % 12) + 1;
  return `${hr}:${m} ${ampm}`;
};

const GRADE_LBL = (level) =>
  level === 0 || level === "0" ? "K" : `G${level}`;

const TODAY_CODE = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][
  new Date().getDay()
];

// ── Teacher Dashboard ─────────────
const Dashboard = () => {
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [sections, setSections] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedScheduleId, setExpandedScheduleId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [meRes, secRes, schRes] = await Promise.all([
          apiFetch("/api/accounts/me/detail/"),
          apiFetch("/api/grades/my-sections/"),
          apiFetch("/api/classmanagement/schedules/my/"),
        ]);
        if (meRes.ok) setTeacherInfo(await meRes.json());
        if (secRes.ok) {
          const s = await secRes.json();
          setSections(Array.isArray(s) ? s : []);
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

  const subjectName =
    teacherInfo?.teacher_profile?.subject?.name || "No subject assigned";
  const teacherName = teacherInfo?.username || "Teacher";

  const toggleScheduleExpand = (id) => {
    setExpandedScheduleId(expandedScheduleId === id ? null : id);
  };

  return (
    <div className="tdb">
      {/* Quick Stats */}
      <div className="tdb__stats">
        <div className="tdbStat tdbStat--primary">
          <div className="tdbStat__icon">🏫</div>
          <div className="tdbStat__content">
            <div className="tdbStat__label">Sections</div>
            <div className="tdbStat__value">{loading ? "—" : sections.length}</div>
          </div>
        </div>

        <div className="tdbStat tdbStat--success">
          <div className="tdbStat__icon">📚</div>
          <div className="tdbStat__content">
            <div className="tdbStat__label">Subject</div>
            <div className="tdbStat__value--sm">{loading ? "—" : subjectName}</div>
          </div>
        </div>

        <div className="tdbStat tdbStat--warning">
          <div className="tdbStat__icon">📅</div>
          <div className="tdbStat__content">
            <div className="tdbStat__label">Today's Classes</div>
            <div className="tdbStat__value">{loading ? "—" : todaySchedule.length}</div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="tdb__grid">
        {/* Today's Schedule Card */}
        <section className="tdbCard">
          <div className="tdbCard__header tdbCard__header--primary">
            <h2 className="tdbCard__title">📅 Today's Schedule</h2>
          </div>
          <div className="tdbCard__body">
            {loading ? (
              <div className="tdbCard__empty">Loading schedule…</div>
            ) : todaySchedule.length === 0 ? (
              <div className="tdbCard__empty">No classes scheduled today.</div>
            ) : (
              <div className="tdbScheduleList">
                {todaySchedule.map((s) => (
                  <div key={s.id} className="tdbScheduleItem">
                    <button
                      className="tdbScheduleRow"
                      onClick={() => toggleScheduleExpand(s.id)}
                      type="button"
                    >
                      <div className="tdbScheduleRow__left">
                        <div className="tdbScheduleIcon">📘</div>
                        <div className="tdbScheduleInfo">
                          <div className="tdbScheduleSubject">{s.subject_name}</div>
                          <div className="tdbScheduleMeta">
                            {GRADE_LBL(s.grade_level)} – {s.section_name}
                          </div>
                        </div>
                      </div>
                      <div className="tdbScheduleRow__right">
                        <div className="tdbScheduleTime">
                          {FMT_TIME(s.start_time)} – {FMT_TIME(s.end_time)}
                        </div>
                        <div className="tdbScheduleToggle">
                          {expandedScheduleId === s.id ? "−" : "+"}
                        </div>
                      </div>
                    </button>

                    {expandedScheduleId === s.id && (
                      <div className="tdbScheduleDetail">
                        <div className="tdbScheduleDetail__grid">
                          <div className="tdbScheduleDetail__item">
                            <div className="tdbScheduleDetail__label">Grade Level</div>
                            <div className="tdbScheduleDetail__value">
                              {GRADE_LBL(s.grade_level)}
                            </div>
                          </div>
                          <div className="tdbScheduleDetail__item">
                            <div className="tdbScheduleDetail__label">Section</div>
                            <div className="tdbScheduleDetail__value">{s.section_name}</div>
                          </div>
                          {s.room_code && (
                            <div className="tdbScheduleDetail__item">
                              <div className="tdbScheduleDetail__label">Room</div>
                              <div className="tdbScheduleDetail__value">{s.room_code}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Announcements */}
        <section className="tdbCard">
          <div className="tdbCard__header tdbCard__header--info">
            <h2 className="tdbCard__title">📣 Announcements</h2>
          </div>
          <TeacherAnnouncementsPanel />
        </section>
      </div>

      {/* ABOUT CESI */}
      <section className="tdbCard tdb__fullWidth">
        <div className="tdbCard__header tdbCard__header--primary">
          <h2 className="tdbCard__title">✨ About CESI Portal</h2>
        </div>
        <div className="tdbCard__body">
          <div className="tdbMedia">
            <div className="tdbMedia__img">
              <img src="/port.png" alt="CESI Portal" />
            </div>
            <div className="tdbMedia__content">
              <h3 className="tdbMedia__title">What is CESI Portal</h3>
              <p className="tdbMedia__text">
                The CESI Portal is your all-in-one academic command center. Designed for
                efficiency and transparency, it allows teachers to seamlessly manage grades,
                attendance, and student performance. Everything you need is organized into a
                single, user-friendly digital hub.
              </p>
              <div className="tdbChips">
                <span className="tdbChip">💻 Real-time Data</span>
                <span className="tdbChip">🏫 Class Management</span>
                <span className="tdbChip">🛡️ Secure Access</span>
                <span className="tdbChip">📱 Mobile Ready</span>
                <span className="tdbChip">🕒 24/7 Availability</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Back to School */}
      <section className="tdbCard tdb__fullWidth">
        <div className="tdbCard__header tdbCard__header--success">
          <h2 className="tdbCard__title">🎓 Back to School</h2>
        </div>
        <div className="tdbCard__body">
          <div className="tdbMedia">
            <div className="tdbMedia__img">
              <img src="/bsch.jpg" alt="Back to School" />
            </div>
            <div className="tdbMedia__content">
              <h3 className="tdbMedia__title">Welcome Back</h3>
              <p className="tdbMedia__text">
                Welcome back! Get ready for another enriching year of teaching, guiding,
                and inspiring your students.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
