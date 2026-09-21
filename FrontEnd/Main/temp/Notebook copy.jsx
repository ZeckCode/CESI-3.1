import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DOMPurify from "dompurify";
import "../IndexWebsiteCSS/Notebook.css";
import "../IndexWebsiteCSS/AnnouncementCard.css";
import OrganizationalChart from "../AdminWebsite/OrganizationalChart";
import { apiFetch } from "../api/apiFetch";
import { API_BASE_URL } from "../../config/api";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

// Fix for default marker icons in Leaflet with React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const API_BASE = ""; // keep for backwards-compat; prefer toAbsUrl below

function toAbsUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = String(API_BASE_URL || "").replace(/\/api\/?$/i, "").replace(/\/$/, "");
  const p = String(path).replace(/^\/+/, "");
  return `${base}/${p}`.replace(/([^:]\/)\/+/, "$1");
}

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

  const tabIcons = {
    announcements: "📢",
    "school-info": "🏫",
    "mission-vision": "🎯",
    contact: "📞",
  };

  const quickLinks = [
    {
      key: "facebook",
      href: "https://www.facebook.com/cesicaloocan",
      icon: "🔔",
      label: "Facebook",
    },
    {
      key: "calendar",
      href: "../../../public/CESI-CAL-SY2526.pdf",
      icon: "📅",
      label: "School Calendar",
    },
    {
      key: "fees",
      href: "../../../public/CESI-TF-SY2425.pdf",
      icon: "📚",
      label: "Tuition Fees",
    },
  ];

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

  // local helper used by components below

  function getFirstImagePath(a) {
    const firstImage = a?.media?.find((m) =>
      /\.(jpg|jpeg|png|gif|webp)$/i.test(m?.file || m?.file_url || "")
    );
    return firstImage?.file || firstImage?.file_url || null;
  }

  // Simple staff-only list for the notebook (masked usernames + subject labels)
  const StaffList = () => {
    const [staff, setStaff] = useState([]);
    const [loadingStaff, setLoadingStaff] = useState(true);
    const [staffError, setStaffError] = useState("");

    useEffect(() => {
      let mounted = true;
      (async () => {
        try {
          setLoadingStaff(true);
          setStaffError("");
          const [teachersRes, adminsRes] = await Promise.all([
            apiFetch('/api/accounts/users/?role=TEACHER'),
            apiFetch('/api/accounts/users/?role=ADMIN'),
          ]);

          const teachers = teachersRes && teachersRes.ok ? await teachersRes.json() : [];
          const admins = adminsRes && adminsRes.ok ? await adminsRes.json() : [];

          if (!mounted) return;
          setStaff([...(Array.isArray(admins) ? admins : []), ...(Array.isArray(teachers) ? teachers : [])]);
        } catch (err) {
          console.error('Failed loading staff:', err);
          if (mounted) setStaffError('Failed to load staff.');
        } finally {
          if (mounted) setLoadingStaff(false);
        }
      })();
      return () => { mounted = false; };
    }, []);

    const maskUsername = (u) => {
      if (!u) return '';
      if (u.length <= 1) return '*';
      return `${u[0]}****`;
    };

    if (loadingStaff) return <div>Loading staff...</div>;
    if (staffError) return <div>{staffError}</div>;
    if (!staff || staff.length === 0) return <div>No staff members found.</div>;

    return (
      <div className="staff-list">
        {staff.map((u) => (
          <div key={u.id} className="staff-item">
            <div className="staff-name">{maskUsername(u.username || (u.first_name || ''))}</div>
            <div className="staff-role-label">
              {u.role === 'TEACHER'
                ? (u.teacher_profile?.subject?.name ? `${u.teacher_profile.subject.name} teacher` : 'Teacher')
                : 'Administrator'}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Free Map Component using OpenStreetMap
  const FreeMap = ({ address }) => {
    const [coordinates, setCoordinates] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
      if (!address) {
        setLoading(false);
        return;
      }

      // Using Nominatim (OpenStreetMap's free geocoding service)
      const geocodeAddress = async () => {
        try {
          setLoading(true);
          const encodedAddress = encodeURIComponent(address);
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`
          );
          const data = await response.json();
          
          if (data && data.length > 0) {
            setCoordinates({
              lat: parseFloat(data[0].lat),
              lng: parseFloat(data[0].lon),
            });
          } else {
            setError("Location not found");
          }
        } catch (err) {
          setError("Error loading map");
          console.error("Geocoding error:", err);
        } finally {
          setLoading(false);
        }
      };

      geocodeAddress();
    }, [address]);

    if (loading) return <p>Loading map...</p>;
    if (error) return <p style={{ color: "red" }}>{error}</p>;
    if (!coordinates) return <p>No location available</p>;

    return (
      <div className="free-map-container">
        <MapContainer
          center={[coordinates.lat, coordinates.lng]}
          zoom={15}
          style={{ height: "400px", width: "100%", borderRadius: "8px" }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={[coordinates.lat, coordinates.lng]}>
            <Popup>
              {address}
            </Popup>
          </Marker>
        </MapContainer>
      </div>
    );
  };

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

    // "enrollment-form": {
    //   title: "Enrollment Form",
    //   content: null,
    // },

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

          {/* Free Map Section */}
          <h3>📍 Location Map</h3>
          <FreeMap address={(cmsData.contact && cmsData.contact.address) || "#47 P. Zamora St. Caloocan City, Metro Manila"} />
          
              <h3>💬 Social Media</h3>
              <p>Facebook: <a href={(cmsData.contact && cmsData.contact.facebook_link) ? cmsData.contact.facebook_link : "https://facebook.com/cesicaloocan"} target="_blank" rel="noopener noreferrer">@cesicaloocan</a></p>
            </>
          ),
        },

      };

  return (
    <div className="index-book-container">
      <div className="index-book-header">
        <div className="index-book-manual-tag">CESI Student Manual</div>
        <button className="index-book-close-btn" onClick={onClose} aria-label="Close Book">
          <span className="index-book-close-icon">✕</span>
          <span className="index-book-close-text">Close Book</span>
        </button>
      </div>

      <div className="index-book-content">
        {/* Left Sidebar / Bookmarks + Quick Links */}
        <div className="index-book-bookmarks-left">
          <div className="index-book-bookmark-tabs">
            {Object.keys(content).map((tab) => (
              <button
                key={tab}
                className={`index-book-bookmark-btn ${activeTab === tab ? "active" : ""}`}
                onClick={() => setActiveTab(tab)}
                title={content[tab].title}
              >
                <span className="index-book-tab-icon" aria-hidden="true">{tabIcons[tab] || "📘"}</span>
                <span className="index-book-bookmark-tab-label">{content[tab].title}</span>
              </button>
            ))}
          </div>
          <button
            className="index-book-mobile-close-btn"
            onClick={onClose}
            aria-label="Close Book"
            title="Close Book"
          >
            ✕
          </button>
        </div>

        {/* Right Page / Main Content */}
        <div className="index-book-pages">
          <div className="index-book-page-left">
            <div className="index-book-page-content">
              <h2>{content[activeTab].title}</h2>

              {activeTab === "enrollment-form" ? (
                <div>
                  {/* <p>Click the button below to fill out the enrollment form:</p>
                  <button
                    className="apply-btn"
                    onClick={() => {
                      openEnrollment();
                      onClose();
                    }}
                  >
                    Enroll Now
                  </button> */}
                </div>
              ) : (
                content[activeTab].content
              )}
            </div>
              
            <div className="index-book-page-footer">
              <div className="index-book-page-number">CESI Elementary</div>
              <div className="index-book-page-date">Student Edition</div>
            </div>
          </div>
        </div>
      </div>

      <div className="index-book-subbookmarks">
        <h4>🔗 Quick Links</h4>
        <div className="index-book-quick-links-btns">
          {quickLinks.map((link) => (
            <a
              key={link.key}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="index-book-link-btn"
              title={link.label}
            >
              <span className="index-book-link-icon" aria-hidden="true">{link.icon}</span>
              <span className="index-book-link-text">{link.label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Notebook;