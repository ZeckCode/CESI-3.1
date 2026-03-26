import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DOMPurify from "dompurify";
import "../IndexWebsiteCSS/Notebook.css";
import "../IndexWebsiteCSS/AnnouncementCard.css";

const API_BASE = ""; // use Vite proxy

const Notebook = ({ onClose, openEnrollment }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("announcements");
  const [announcements, setAnnouncements] = useState([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);

  const [cmsData, setCmsData] = useState({
    school: {},
    mission: {},
    contact: {},
  });

  useEffect(() => {
    fetch(`${API_BASE}/api/announcements/`)
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.results || [];
        setAnnouncements(list);
      })
      .catch((err) => console.error("Error fetching announcements:", err));

    // Fetch CMS Content
    fetch(`${API_BASE}/api/cms/school-info/`).then(res => res.json()).then(data => setCmsData(prev => ({...prev, school: data}))).catch(() => {});
    fetch(`${API_BASE}/api/cms/mission-vision/`).then(res => res.json()).then(data => setCmsData(prev => ({...prev, mission: data}))).catch(() => {});
    fetch(`${API_BASE}/api/cms/contact-inquiry/`).then(res => res.json()).then(data => setCmsData(prev => ({...prev, contact: data}))).catch(() => {});

  }, []);

  function toAbsUrl(path) {
    if (!path) return null;
    return path.startsWith("http") ? path : `${API_BASE}${path}`;
  }

  function getFirstImagePath(a) {
    const firstImage = a?.media?.find((m) =>
      /\.(jpg|jpeg|png|gif|webp)$/i.test(m?.file || m?.file_url || "")
    );
    return firstImage?.file || firstImage?.file_url || null;
  }

  const content = {
    announcements: {
      title: "Announcements",
      content: (
        <div className="announcements-container">
          {announcements.length === 0 ? (
            <p>No announcements yet.</p>
          ) : (
            announcements.map((a) => {
              const img = getFirstImagePath(a);
              const imgUrl = toAbsUrl(img);
              return (
                <div
                  key={a.id}
                  className={`ann-card ${img ? "ann-card--row" : "ann-card--noimg"}`}
                  onClick={() => setSelectedAnnouncement(a)}
                  style={{ cursor: "pointer" }}
                >
                  {imgUrl && (
                    <div className="ann-thumb">
                      <img src={imgUrl} alt="" />
                    </div>
                  )}
                  <div className="ann-right">
                    <div className="ann-top">
                      <div className="ann-title">{a.title || "Untitled"}</div>
                      <div className="ann-meta">
                        <span hidden className="ann-role">{a.target_role || "all"}</span>
                        <span>
                          {a.publish_date || a.created_at
                            ? new Date(a.publish_date || a.created_at).toLocaleString()
                            : ""}
                        </span>
                      </div>
                    </div>
                    <p className="ann-desc">{a.content || a.description || ""}</p>
                  </div>
                </div>
              );
            })
          )}

          {selectedAnnouncement && (() => {
            const modalImg = toAbsUrl(getFirstImagePath(selectedAnnouncement));
            return (
              <div
                className="ann-modal-overlay"
                onClick={() => setSelectedAnnouncement(null)}
              >
                <div className="ann-modal" onClick={(e) => e.stopPropagation()}>
                  <span
                    className="ann-modal-close"
                    onClick={() => setSelectedAnnouncement(null)}
                  >
                    ✕
                  </span>
                  {modalImg && <img src={modalImg} alt="" className="ann-modal-image" />}
                  <h2 className="ann-modal-title">{selectedAnnouncement.title || "Untitled"}</h2>
                  <div className="ann-modal-meta">
                    {selectedAnnouncement.target_role || "all"} •{" "}
                    {selectedAnnouncement.publish_date || selectedAnnouncement.created_at
                      ? new Date(
                          selectedAnnouncement.publish_date || selectedAnnouncement.created_at
                        ).toLocaleString()
                      : ""}
                  </div>
                  <p className="ann-modal-content">
                    {selectedAnnouncement.content || selectedAnnouncement.description || ""}
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
      ),
    },

    "school-info": {
      title: "School Information",
      content: (
        <>
          <h3>{(cmsData.school && cmsData.school.school_name) ? cmsData.school.school_name : "Welcome to CESI!"}</h3>
          <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize((cmsData.school && cmsData.school.about_text) ? cmsData.school.about_text : `<p>
            Caloocan Evangelical School Inc. (CESI) is a School Ministry of
            Caloocan Evangelical Church Inc., dedicated to providing quality
            Christian education since 1982. We nurture young minds from Nursery,
            Kindergarten, and Preparatory classes up to Grade 6.
          </p>
          <p>
            🏫 <strong>Founded:</strong> February 12, 1982
            <br />
            📚 <strong>Grade Levels:</strong> Nursery, Kindergarten, Preparatory,
            Grade 1-6
            <br />
            📖 <strong>Curriculum:</strong> DepEd-recognized Enhanced K-12
            Program (Government Recognition No. E-011 S.2011 &amp; P-014 S.2011)
            <br />
            📍 <strong>Location:</strong> #47 P. Zamora St., Caloocan City
          </p>`) }} />
        </>
      ),
    },

    "mission-vision": {
      title: "Mission & Vision",
      content: (
        <>
          <h3>Our Mission</h3>
          <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize((cmsData.mission && cmsData.mission.mission_text) ? cmsData.mission.mission_text : `<p>The mission of the School...</p>`) }} />

          <h3>Our Vision</h3>
          <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize((cmsData.mission && cmsData.mission.vision_text) ? cmsData.mission.vision_text : `<p>The vision of the School...</p>`) }} />
        </>
      ),
    },

    "enrollment-form": {
      title: "Enrollment Form",
      content: null,
    },

    contact: {
      title: "Contact & Inquiry",
      content: (
        <>
          <h3>📞 Get in Touch</h3>
          <p>
            <strong>Phone:</strong> {(cmsData.contact && cmsData.contact.phone_number) ? cmsData.contact.phone_number : "(02) 8-285-3702 / 0905-299-6303"}
          </p>
          <p>
            <strong>Email:</strong> {(cmsData.contact && cmsData.contact.email) ? cmsData.contact.email : "caloocanevangelicalschool@gmail.com"}
          </p>
          <p>
            <strong>Address:</strong> {(cmsData.contact && cmsData.contact.address) ? cmsData.contact.address : "#47 P. Zamora St. Caloocan City, Metro Manila"}
          </p>

          <h3>💬 Social Media</h3>
          <p>Facebook: <a href={(cmsData.contact && cmsData.contact.facebook_link) ? cmsData.contact.facebook_link : "https://facebook.com/cesicaloocan"} target="_blank" rel="noopener noreferrer">@cesicaloocan</a></p>
        </>
      ),
    },
  };

  return (
    <div className="notebook-container">
      <div className="notebook-header">
        <h2>CESI Student Manual</h2>
        <button className="close-btn" onClick={onClose}>
          ✕ Close Book
        </button>
      </div>

      <div className="notebook-content">
        {/* Left Sidebar / Bookmarks + Quick Links */}
        <div className="bookmarks-left">
          {Object.keys(content).map((tab) => (
            <button
              key={tab}
              className={`bookmark-btn ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {content[tab].title}
            </button>
          ))}

          <hr className="sidebar-divider" />

          <div className="quick-links">
            <h4>🔗 Quick Links</h4>
            <div className="quick-links-btns">
              <a
                href="https://www.facebook.com/cesicaloocan"
                target="_blank"
                rel="noopener noreferrer"
              >
                <button className="link-btn">🔔 Facebook</button>
              </a>
              <a
                href="../../../public/CESI-CAL-SY2526.pdf"
                target="_blank"
                rel="noopener noreferrer"
              >
                <button className="link-btn">📅 School Calendar</button>
              </a>
              <a
                href="../../../public/CESI-TF-SY2425.pdf"
                target="_blank"
                rel="noopener noreferrer"
              >
                <button className="link-btn">📚 Tuition Fees</button>
              </a>
            </div>
          </div>
        </div>

        {/* Right Page / Main Content */}
        <div className="notebook-pages">
          <div className="page-left">
            <div className="page-content">
              <h2>{content[activeTab].title}</h2>

              {activeTab === "enrollment-form" ? (
                <div>
                  <p>Click the button below to fill out the enrollment form:</p>
                  <button
                    className="apply-btn"
                    onClick={() => {
                      openEnrollment();
                      onClose();
                    }}
                  >
                    Apply Now
                  </button>
                </div>
              ) : (
                content[activeTab].content
              )}
            </div>

            <div className="page-footer">
              <div className="page-number">CESI Elementary</div>
              <div className="page-date">Student Edition</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Notebook;