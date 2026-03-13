import React, { useEffect, useMemo, useState } from "react";
import "../TeacherWebsiteCSS/Dashboard.css";
import { apiFetch } from "../api/apiFetch";

const API_BASE = ""; // only needed if file/file_url returns /media/...

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
      <div className="card__body card__body--flush">
        {loading ? (
          <div className="list__staticItem">Loading announcements…</div>
        ) : err ? (
          <div className="list__staticItem" style={{ color: "crimson" }}>
            {err}
          </div>
        ) : announcements.length === 0 ? (
          <div className="list__staticItem">No announcements yet.</div>
        ) : (
          <div className="tann-list">
            {latest.map((a) => {
              const img = toAbsUrl(getFirstImagePath(a));
              const isImg = img && /\.(jpg|jpeg|png|gif|webp)$/i.test(img);

              return (
                <div
                  key={a.id}
                  className="tann-card tann-card--noimg"
                  onClick={() => setActive(a)}
                  style={{ cursor: "pointer" }}
                >
                  {/* {isImg && (
                    <div className="tann-thumb">
                      <img src={img} alt="" />
                    </div>
                  )} */}

                  <div className="tann-right">
                    <div className="tann-top">
                      <div className="tann-title">{a.title || "Untitled"}</div>

                      <div className="tann-meta">
                        <span hidden className="tann-role">
                          {(a.target_role || "all").replace("_", " ")}
                        </span>
                        <span>
                          {a.publish_date || a.created_at
                            ? new Date(a.publish_date || a.created_at).toLocaleString()
                            : ""}
                        </span>
                      </div>
                    </div>

                    <p className="tann-desc">
                      {(a.content || "").slice(0, 120)}
                      {(a.content || "").length > 120 ? "…" : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card__footer">
        <button
          type="button"
          className="link link--danger"
          style={{ background: "transparent", border: 0, padding: 0 }}
          onClick={() => setListOpen(true)}
          disabled={loading || announcements.length === 0}
        >
          See All Updates
        </button>
      </div>

      {/* View All Modal */}
      {listOpen && (
        <div className="tann-modal-overlay" onClick={() => setListOpen(false)}>
          <div className="tann-modal" onClick={(e) => e.stopPropagation()}>
            <span className="tann-modal-close" onClick={() => setListOpen(false)}>
              ✕
            </span>

            <h3 className="tann-modal-title">Announcements</h3>

            <div className="tann-modal-list">
              {announcements.map((a) => {
                const img = toAbsUrl(getFirstImagePath(a));
                const isImg = img && /\.(jpg|jpeg|png|gif|webp)$/i.test(img);

                return (
                  <button
                    key={a.id}
                    type="button"
                    className="tann-modal-item"
                    onClick={() => {
                      setListOpen(false);
                      setActive(a);
                    }}
                  >
                    {/* {isImg && (
                      <div className="tann-modal-thumb">
                        <img src={img} alt="" />
                      </div>
                    )} */}

                    <div className="tann-modal-right">
                      <div className="tann-modal-itemTitle">{a.title || "Untitled"}</div>
                      <div className="tann-modal-itemMeta">
                        {/* {(a.target_role || "all").replace("_", " ").toUpperCase()} •{" "} */}
                        {a.publish_date || a.created_at
                          ? new Date(a.publish_date || a.created_at).toLocaleString()
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
    <div className="tann-modal-overlay" onClick={onClose}>
      <div className="tann-modal" onClick={(e) => e.stopPropagation()}>
        <span className="tann-modal-close" onClick={onClose}>✕</span>

        {firstUrl && isVideo ? (
          <video src={firstUrl} controls className="tann-modal-image" />
        ) : (
          img && <img src={img} alt="" className="tann-modal-image" />
        )}

        <h2 className="tann-modal-title">{a.title || "Untitled"}</h2>

        <div className="tann-modal-meta">
          {/* {(a.target_role || "all").replace("_", " ").toUpperCase()} •{" "} */}
          {a.publish_date || a.created_at
            ? new Date(a.publish_date || a.created_at).toLocaleString()
            : ""}
        </div>

        <p className="tann-modal-content">{a.content || ""}</p>
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

  return (
    <div className="dash">
      <header className="dash__header">
        <div>
          <h2 className="dash__title">Dashboard</h2>
          <p className="dash__welcome">
            Welcome back, <strong>{teacherName}</strong>
          </p>
        </div>
      </header>

      {/* Stats Row */}
      <div className="dash__statsRow">
        <div className="dashStat dashStat--blue">
          <span className="dashStat__icon" aria-hidden="true">🏫</span>
          <div>
            <div className="dashStat__label">SECTIONS</div>
            <div className="dashStat__value">{loading ? "—" : sections.length}</div>
          </div>
        </div>

        <div className="dashStat dashStat--success">
          <span className="dashStat__icon" aria-hidden="true">📚</span>
          <div>
            <div className="dashStat__label">SUBJECT</div>
            <div className="dashStat__value dashStat__value--sm">
              {loading ? "—" : subjectName}
            </div>
          </div>
        </div>

        <div className="dashStat dashStat--warn">
          <span className="dashStat__icon" aria-hidden="true">📅</span>
          <div>
            <div className="dashStat__label">TODAY'S CLASSES</div>
            <div className="dashStat__value">
              {loading ? "—" : todaySchedule.length}
            </div>
          </div>
        </div>
      </div>

      {/* Main grid: today's schedule + announcements */}
      <div className="dash__grid">
        {/* Today's Schedule */}
        <section className="card">
          <div className="card__header card__header--blue">
            <h6 className="card__headerTitle">
              <span className="icon icon--header" aria-hidden="true">📅</span>
              Today's Schedule
            </h6>
          </div>

          <div className="card__body card__body--flush">
            {loading ? (
              <div className="list__staticItem">Loading schedule…</div>
            ) : todaySchedule.length === 0 ? (
              <div className="list__staticItem">No classes scheduled today.</div>
            ) : (
              <div className="list">
                {todaySchedule.map((s) => (
                  <div className="list__item" key={s.id} style={{ cursor: "default" }}>
                    <div className="list__row">
                      <div className="list__left">
                        <div className="iconBox iconBox--blue" aria-hidden="true">
                          📘
                        </div>
                        <div>
                          <div className="list__title">{s.subject_name}</div>
                          <div className="list__meta">
                            {GRADE_LBL(s.grade_level)} – {s.section_name}
                            {s.room_code ? ` · Room ${s.room_code}` : ""}
                          </div>
                        </div>
                      </div>
                      <div className="list__time list__time--primary">
                        {FMT_TIME(s.start_time)} – {FMT_TIME(s.end_time)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Announcements */}
        <section className="card">
          <div className="card__header card__header--danger">
            <h6 className="card__headerTitle">
              <span className="icon icon--header" aria-hidden="true">📣</span>
              Announcements
            </h6>
          </div>
          <TeacherAnnouncementsPanel />
        </section>
      </div>

      {/* ABOUT CESI */}
      <section className="card card--roundedLg dash__section">
        <div className="card__header card__header--blue">
          <h6 className="card__headerTitle">
            <span className="icon icon--header" aria-hidden="true">✨</span>
            ABOUT CESI
          </h6>
        </div>
        <div className="card__body">
          <div className="media">
            <div className="media__imgWrap">
              <img className="media__img" src="/port.png" alt="CESI Portal" />
            </div>
            <div className="media__content">
              <h5 className="media__title">What is CESI Portal</h5>
              <p className="media__text">
                The CESI Portal is your all-in-one academic command center. Designed for
                efficiency and transparency, it allows teachers to seamlessly manage grades,
                attendance, and student performance. Everything you need is organized into a
                single, user-friendly digital hub.
              </p>
              <div className="chips">
                <span className="chip">💻 Real-time Data</span>
                <span className="chip">🏫 Class Management</span>
                <span className="chip">🛡️ Secure Access</span>
                <span className="chip">📱 Mobile Ready</span>
                <span className="chip">🕒 24/7 Availability</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Back to School */}
      <section className="card card--roundedLg dash__section">
        <div className="card__header card__header--blue">
          <h6 className="card__headerTitle">
            <span className="icon icon--header" aria-hidden="true">✨</span>
            Back to School
          </h6>
        </div>
        <div className="card__body">
          <div className="media">
            <div className="media__imgWrap">
              <img className="media__img" src="/bsch.jpg" alt="Back to School" />
            </div>
            <div className="media__content">
              <h5 className="media__title media__title--plain">Back to School</h5>
              <p className="media__text">
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
