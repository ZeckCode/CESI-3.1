import React, { useState, useRef, useEffect } from "react";
import { Download, X, Settings } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { getGradeLevelDisplay } from "./idGeneratorUtils";
import CESI_background from "./CESI-id-background.jpg";

export default function IdCardGenerator({
  isOpen,
  onClose,
  studentData,
  schoolInfo,
}) {
  const cardRef = useRef(null);
  const [cardSide, setCardSide] = useState("front");
  const [cardSettings, setCardSettings] = useState({
    schoolName: schoolInfo?.name || "CESI School",
    schoolMotto: schoolInfo?.motto || "Excellence in Education",
    acYear: studentData?.academic_year || "2024-2025",
    section: studentData?.section_name || "N/A",
    logo_url: schoolInfo?.logo_url || "",
    address: schoolInfo?.address || "",
    phone: schoolInfo?.phone || "",
    email: schoolInfo?.email || "",
    copyright: schoolInfo?.copyright || "© 2025 CESI. All rights reserved.",
    parentName: studentData?.parent_name || "",
    parentPhone: studentData?.parent_phone || "",
  });
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    setCardSettings((prev) => ({
      ...prev,
      schoolName: schoolInfo?.name || "CESI School",
      schoolMotto: schoolInfo?.motto || "Excellence in Education",
      acYear: studentData?.academic_year || "2024-2025",
      section: studentData?.section_name || "N/A",
      logo_url: schoolInfo?.logo_url || "",
      address: schoolInfo?.address || "",
      phone: schoolInfo?.phone || "",
      email: schoolInfo?.email || "",
      copyright: schoolInfo?.copyright || "© 2025 CESI. All rights reserved.",
      parentName: studentData?.parent_name || "",
      parentPhone: studentData?.parent_phone || "",
    }));
  }, [studentData, schoolInfo]);

  if (!isOpen) return null;

  // Validation
  const requiredFields = {
    firstName: studentData.first_name,
    lastName: studentData.last_name,
    gradeLevel: studentData.grade_level,
    section: cardSettings.section,
    lrn: studentData.lrn,
    birthDate: studentData.birth_date,
    photo: studentData.id_image_url,
  };

  const missingFields = Object.keys(requiredFields).filter(
    (key) => !requiredFields[key]
  );

  const canDownload = missingFields.length === 0;

  const downloadPDF = async () => {
    if (!canDownload) {
      alert(
        `Missing fields:\n${missingFields
          .map((f) => `• ${f.replace(/([A-Z])/g, " $1").trim()}`)
          .join("\n")}`
      );
      return;
    }

    if (!cardRef.current) return;
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(cardRef.current, { scale: 2 });
      const imgData = canvas.toDataURL("image/jpeg", 0.98);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgWidth = pdfWidth - 10;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, "JPEG", 5, 5, imgWidth, imgHeight);
      pdf.save(`${studentData.first_name}_${studentData.last_name}_ID.pdf`);
    } catch (error) {
      console.error("PDF download failed:", error);
      alert("Failed to download ID card");
    } finally {
      setIsDownloading(false);
    }
  };

  const downloadImage = async () => {
    if (!canDownload) {
      alert(
        `Missing fields:\n${missingFields
          .map((f) => `• ${f.replace(/([A-Z])/g, " $1").trim()}`)
          .join("\n")}`
      );
      return;
    }

    if (!cardRef.current) return;
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(cardRef.current, { scale: 2 });
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `${studentData.first_name}_${studentData.last_name}_ID.png`;
      link.click();
    } catch (error) {
      console.error("Image download failed:", error);
      alert("Failed to download ID card");
    } finally {
      setIsDownloading(false);
    }
  };

  const studentName = `${studentData.first_name || ""} ${studentData.last_name || ""}`.trim();
  const studentAge = studentData.birth_date
    ? Math.floor(
        (new Date() - new Date(studentData.birth_date)) /
          (365.25 * 24 * 60 * 60 * 1000)
      )
    : "—";

  return (
    <div
      className="modal-overlay enrollment-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-content" style={{ maxWidth: 900, width: "95vw" }}>
        <div className="enrollment-modal-header">
          <div className="enrollment-modal-title-wrap">
            <h2>Generate Student ID Card</h2>
            <div className="enrollment-modal-subtitle">
              {studentName} — AY {cardSettings.acYear}
            </div>
          </div>
          <button
            type="button"
            className="enrollment-modal-close"
            onClick={onClose}
            disabled={isDownloading}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>
          {/* Settings Panel */}
          <div
            style={{
              flex: "0 0 280px",
              padding: 16,
              background: "#f8fafc",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              maxHeight: "70vh",
              overflow: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 16,
                paddingBottom: 12,
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <Settings size={16} />
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                Card Settings
              </h3>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="form-group">
                <label style={{ fontSize: 12, fontWeight: 600 }}>
                  School Name
                </label>
                <input
                  type="text"
                  value={cardSettings.schoolName}
                  onChange={(e) =>
                    setCardSettings({
                      ...cardSettings,
                      schoolName: e.target.value,
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                />
              </div>

              <div className="form-group">
                <label style={{ fontSize: 12, fontWeight: 600 }}>Motto</label>
                <input
                  type="text"
                  value={cardSettings.schoolMotto}
                  onChange={(e) =>
                    setCardSettings({
                      ...cardSettings,
                      schoolMotto: e.target.value,
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                />
              </div>

              <div className="form-group">
                <label style={{ fontSize: 12, fontWeight: 600 }}>
                  Academic Year
                </label>
                <input
                  type="text"
                  value={cardSettings.acYear}
                  onChange={(e) =>
                    setCardSettings({
                      ...cardSettings,
                      acYear: e.target.value,
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                />
              </div>

              <div className="form-group">
                <label style={{ fontSize: 12, fontWeight: 600 }}>Section</label>
                <input
                  type="text"
                  value={cardSettings.section}
                  onChange={(e) =>
                    setCardSettings({
                      ...cardSettings,
                      section: e.target.value,
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                />
              </div>
            </div>

            {/* Back Side Settings */}
            {cardSide === "back" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
                <div className="form-group">
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Parent/Guardian Name</label>
                  <input
                    type="text"
                    value={cardSettings.parentName}
                    onChange={(e) =>
                      setCardSettings({
                        ...cardSettings,
                        parentName: e.target.value,
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      fontSize: 13,
                    }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Parent Phone</label>
                  <input
                    type="text"
                    value={cardSettings.parentPhone}
                    onChange={(e) =>
                      setCardSettings({
                        ...cardSettings,
                        parentPhone: e.target.value,
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Card Side Tabs */}
            <div style={{ marginTop: 20, display: "flex", gap: 8, borderBottom: "2px solid #e2e8f0", paddingBottom: 0 }}>
              <button
                onClick={() => setCardSide("front")}
                style={{
                  padding: "8px 16px",
                  background: "transparent",
                  color: cardSide === "front" ? "#667eea" : "#94a3b8",
                  border: "none",
                  borderBottom: cardSide === "front" ? "3px solid #667eea" : "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                📇 Front Side
              </button>
              <button
                onClick={() => setCardSide("back")}
                style={{
                  padding: "8px 16px",
                  background: "transparent",
                  color: cardSide === "back" ? "#667eea" : "#94a3b8",
                  border: "none",
                  borderBottom: cardSide === "back" ? "3px solid #667eea" : "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                📋 Back Side
              </button>
            </div>

            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 11, color: "#475569", display: "flex", flexDirection: "column", gap: 6 }}>
                <div>
                  <strong>Student:</strong> {studentName}
                </div>
                <div>
                  <strong>Grade:</strong> {studentData.grade_level || "N/A"}
                </div>
                <div>
                  <strong>Age:</strong> {studentAge} years old
                </div>
                <div>
                  <strong>LRN:</strong> {studentData.lrn || "N/A"}
                </div>
              </div>
            </div>
          </div>

          {/* ID Card Preview */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            <IdCardPreview
              ref={cardRef}
              studentData={studentData}
              settings={cardSettings}
              studentName={studentName}
              cardSide={cardSide}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
              {!canDownload && (
                <div
                  style={{
                    padding: "10px 12px",
                    background: "#fee2e2",
                    border: "1px solid #fca5a5",
                    borderRadius: 6,
                    fontSize: 12,
                    color: "#991b1b",
                  }}
                >
                  <strong>Missing Fields:</strong>
                  <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
                    {missingFields.map((f) => (
                      <div key={f}>• {f.replace(/([A-Z])/g, " $1").trim()}</div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={downloadPDF}
                  disabled={isDownloading || !canDownload}
                  style={{
                    padding: "10px 16px",
                    background: canDownload ? "#3b82f6" : "#d1d5db",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    cursor: canDownload && !isDownloading ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontWeight: 500,
                    fontSize: 13,
                    opacity: (isDownloading || !canDownload) ? 0.6 : 1,
                  }}
                  title={!canDownload ? "Fill all required fields" : ""}
                >
                  <Download size={14} /> {isDownloading ? "Downloading..." : "Download PDF"}
                </button>
                <button
                  onClick={downloadImage}
                  disabled={isDownloading || !canDownload}
                  style={{
                    padding: "10px 16px",
                    background: canDownload ? "#fbbf24" : "#d1d5db",
                    color: canDownload ? "#000" : "#666",
                    border: "none",
                    borderRadius: 6,
                    cursor: canDownload && !isDownloading ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontWeight: 500,
                    fontSize: 13,
                    opacity: (isDownloading || !canDownload) ? 0.6 : 1,
                  }}
                  title={!canDownload ? "Fill all required fields" : ""}
                >
                  <Download size={14} /> {isDownloading ? "Downloading..." : "Download PNG"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const IdCardPreview = React.forwardRef(
  ({ studentData, settings, studentName, cardSide }, ref) => {
    // Calculate age from birth date
    const age = studentData.birth_date
      ? Math.floor((new Date() - new Date(studentData.birth_date)) / (365.25 * 24 * 60 * 60 * 1000))
      : null;

    return (
      <div
        ref={ref}
        style={{
          width: 350,
          height: 550,
          borderRadius: 12,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          fontFamily: "Arial, sans-serif",
          boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {cardSide === "front" ? (
          <>
            {/* Background Image */}
            <img
              src={CESI_background}
              alt="ID Template"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                zIndex: 0,
              }}
            />

            {/* Semi-transparent overlay to improve text readability */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.1) 100%)",
                zIndex: 1,
              }}
            />

            {/* Content Container */}
            <div
              style={{
                position: "relative",
                zIndex: 2,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                width: "100%",
                padding: "20px 16px",
              }}
            >
              {/* Student Photo - positioned lower on the image */}
              <div
                style={{
                  width: 110,
                  height: 110,
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: "3px solid #ffd700",
                  background: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                  marginBottom: 16,
                }}
              >
                {studentData.id_image_url ? (
                  <img
                    src={studentData.id_image_url}
                    alt={studentName}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div style={{ fontSize: 48, color: "#94a3b8" }}>👤</div>
                )}
              </div>

              {/* Student Name with background for readability */}
              <div
                style={{
                  backgroundColor: "rgba(0,0,0,0.6)",
                  padding: "6px 16px",
                  borderRadius: 20,
                  marginBottom: 12,
                  maxWidth: "90%",
                }}
              >
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: "#ffffff",
                    textAlign: "center",
                    letterSpacing: 0.5,
                  }}
                >
                  {studentName || "—"}
                </div>
              </div>

              {/* Info Grid - Student No & LRN */}
              <div
                style={{
                  display: "flex",
                  gap: 20,
                  justifyContent: "center",
                  marginBottom: 12,
                  width: "100%",
                }}
              >
                <div
                  style={{
                    backgroundColor: "rgba(0,0,0,0.55)",
                    padding: "6px 12px",
                    borderRadius: 8,
                    textAlign: "center",
                    flex: 1,
                  }}
                >
                  <div style={{ fontSize: 9, fontWeight: 600, color: "#ffd700", marginBottom: 2 }}>
                    STUDENT NO.
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#ffffff" }}>
                    {studentData.id || "—"}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: "rgba(0,0,0,0.55)",
                    padding: "6px 12px",
                    borderRadius: 8,
                    textAlign: "center",
                    flex: 1,
                  }}
                >
                  <div style={{ fontSize: 9, fontWeight: 600, color: "#ffd700", marginBottom: 2 }}>
                    LRN
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#ffffff" }}>
                    {studentData.grade_level === "prek" ? "N/A" : (studentData.lrn || "—")}
                  </div>
                </div>
              </div>

              {/* Grade & Section Row */}
              <div
                style={{
                  display: "flex",
                  gap: 20,
                  justifyContent: "center",
                  marginBottom: 12,
                  width: "100%",
                }}
              >
                <div
                  style={{
                    backgroundColor: "rgba(0,0,0,0.55)",
                    padding: "6px 12px",
                    borderRadius: 8,
                    textAlign: "center",
                    flex: 1,
                  }}
                >
                  <div style={{ fontSize: 9, fontWeight: 600, color: "#ffd700", marginBottom: 2 }}>
                    GRADE
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#ffffff" }}>
                    {getGradeLevelDisplay(studentData.grade_level)}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: "rgba(0,0,0,0.55)",
                    padding: "6px 12px",
                    borderRadius: 8,
                    textAlign: "center",
                    flex: 1,
                  }}
                >
                  <div style={{ fontSize: 9, fontWeight: 600, color: "#ffd700", marginBottom: 2 }}>
                    SECTION
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#ffffff" }}>
                    {settings.section || "N/A"}
                  </div>
                </div>
              </div>

              {/* Age & Birthdate Row */}
              <div
                style={{
                  display: "flex",
                  gap: 20,
                  justifyContent: "center",
                  marginBottom: 16,
                  width: "100%",
                }}
              >
                <div
                  style={{
                    backgroundColor: "rgba(0,0,0,0.55)",
                    padding: "6px 12px",
                    borderRadius: 8,
                    textAlign: "center",
                    flex: 1,
                  }}
                >
                  <div style={{ fontSize: 9, fontWeight: 600, color: "#ffd700", marginBottom: 2 }}>
                    AGE
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#ffffff" }}>
                    {age ? `${age} years` : "—"}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: "rgba(0,0,0,0.55)",
                    padding: "6px 12px",
                    borderRadius: 8,
                    textAlign: "center",
                    flex: 1,
                  }}
                >
                  <div style={{ fontSize: 9, fontWeight: 600, color: "#ffd700", marginBottom: 2 }}>
                    BIRTHDATE
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#ffffff" }}>
                    {studentData.birth_date
                      ? new Date(studentData.birth_date).toLocaleDateString()
                      : "—"}
                  </div>
                </div>
              </div>

              {/* School Year */}
              <div
                style={{
                  backgroundColor: "rgba(0,0,0,0.6)",
                  padding: "5px 12px",
                  borderRadius: 20,
                  marginTop: "auto",
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#ffd700",
                  }}
                >
                  School Year {settings.acYear}
                </span>
              </div>
            </div>
          </>
        ) : (
          // BACK SIDE - Improved layout with better visibility
          <div
            style={{
              background: "linear-gradient(135deg, #ffffff 0%, #f0f4f8 100%)",
              height: "100%",
              padding: 20,
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
            {/* Yellow Accent Bar */}
            <div
              style={{
                height: 5,
                background: "#fbbf24",
                marginBottom: 16,
                borderRadius: 3,
              }}
            />

            {/* Blue Header Bar */}
            <div
              style={{
                background: "#1d4ed8",
                padding: "8px 12px",
                borderRadius: 8,
                marginBottom: 16,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: "bold", color: "#ffffff" }}>
                STUDENT INFORMATION
              </div>
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Parent Info Card */}
              <div
                style={{
                  padding: 10,
                  background: "#eef2ff",
                  borderRadius: 10,
                  borderLeft: "4px solid #fbbf24",
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, color: "#1d4ed8", marginBottom: 6, textTransform: "uppercase" }}>
                  👪 Parent / Guardian
                </div>
                <div style={{ fontSize: 13, fontWeight: "bold", color: "#1e293b" }}>
                  {settings.parentName || "—"}
                </div>
                <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>
                  📞 {settings.parentPhone || "—"}
                </div>
              </div>

              {/* Contact Info */}
              <div
                style={{
                  padding: 10,
                  background: "#eef2ff",
                  borderRadius: 10,
                  borderLeft: "4px solid #fbbf24",
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, color: "#1d4ed8", marginBottom: 6, textTransform: "uppercase" }}>
                  📧 Contact Details
                </div>
                <div style={{ fontSize: 11, color: "#1e293b", marginBottom: 2 }}>
                  📧 {settings.email || "info@cesi.edu.ph"}
                </div>
                <div style={{ fontSize: 11, color: "#1e293b" }}>
                  📞 {settings.phone || "(02) 8285-3427"}
                </div>
              </div>

              {/* School Address */}
              <div
                style={{
                  padding: 10,
                  background: "#eef2ff",
                  borderRadius: 10,
                  borderLeft: "4px solid #fbbf24",
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, color: "#1d4ed8", marginBottom: 6, textTransform: "uppercase" }}>
                  🏫 School Address
                </div>
                <div style={{ fontSize: 11, lineHeight: 1.4, color: "#1e293b" }}>
                  {settings.address || "A47 P. Zamora St., Caloocan City, Metro Manila"}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                borderTop: "2px solid #e2e8f0",
                paddingTop: 10,
                textAlign: "center",
                fontSize: 8,
                color: "#64748b",
                marginTop: 12,
              }}
            >
              {settings.copyright || "© 2025 CESI. All rights reserved."}
            </div>
          </div>
        )}
      </div>
    );
  }
);

IdCardPreview.displayName = "IdCardPreview";