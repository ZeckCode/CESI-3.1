import React, { useState, useRef } from "react";
import { Download, X, Settings } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { getGradeLevelDisplay } from "./idGeneratorUtils";

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
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
          background: cardSide === "front" ? "white" : "white",
        }}
      >
        {cardSide === "front" ? (
          <>
            {/* FRONT SIDE - Split Blue & Yellow Design */}
            {/* Top Blue Section */}
            <div
              style={{
                background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                height: 180,
                padding: 12,
                display: "flex",
                flexDirection: "column",
                color: "white",
                alignItems: "center",
                textAlign: "center",
                position: "relative",
              }}
            >
              {settings.logo_url && (
                <img
                  src={settings.logo_url}
                  alt="School Logo"
                  style={{
                    height: 32,
                    maxWidth: 60,
                    margin: "0 auto 4px",
                    objectFit: "contain",
                    filter: "brightness(0) invert(1)",
                  }}
                />
              )}
              <div style={{ fontSize: 14, fontWeight: "bold" }}>
                {settings.schoolName}
              </div>
              <div style={{ fontSize: 9, opacity: 0.9, marginBottom: 8 }}>
                {settings.schoolMotto}
              </div>

              {/* Student Number and LRN above photo */}
              <div style={{ fontSize: 8, display: "flex", gap: 12, marginBottom: 8 }}>
                <div style={{ background: "rgba(255,255,255,0.2)", padding: "4px 8px", borderRadius: 3 }}>
                  <div style={{ fontSize: 7, opacity: 0.8, fontWeight: 600 }}>SN</div>
                  <div style={{ fontWeight: "bold", fontSize: 9 }}>
                    {studentData.id || "—"}
                  </div>
                </div>
                <div style={{ background: "rgba(255,255,255,0.2)", padding: "4px 8px", borderRadius: 3 }}>
                  <div style={{ fontSize: 7, opacity: 0.8, fontWeight: 600 }}>LRN</div>
                  <div style={{ fontWeight: "bold", fontSize: 9 }}>
                    {studentData.grade_level === "prek" ? "N/A" : (studentData.lrn || "—")}
                  </div>
                </div>
              </div>

              {/* Student Photo - Positioned to overlap */}
              <div
                style={{
                  position: "absolute",
                  bottom: -35,
                  left: "50%",
                  transform: "translateX(-50%)",
                  zIndex: 10,
                }}
              >
                {studentData.id_image_url ? (
                  <img
                    src={studentData.id_image_url}
                    alt={studentName}
                    style={{
                      width: 95,
                      height: 95,
                      borderRadius: "50%",
                      border: "4px solid white",
                      objectFit: "cover",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                    }}
                    onError={(e) => {
                      e.target.style.display = "none";
                      e.target.nextElementSibling.style.display = "flex";
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 95,
                      height: 95,
                      borderRadius: "50%",
                      border: "4px solid white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "#e0e7ff",
                      fontSize: 38,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                    }}
                  >
                    👤
                  </div>
                )}
              </div>
            </div>

            {/* Yellow Section - Student Info */}
            <div
              style={{
                background: "#fbbf24",
                flex: 1,
                padding: "55px 16px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                color: "#111",
                position: "relative",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: "bold" }}>
                  {studentName}
                </div>
                <div style={{ fontSize: 11, color: "#333" }}>
                  {getGradeLevelDisplay(studentData.grade_level)}
                </div>
              </div>

              <div style={{ fontSize: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div style={{ background: "rgba(255,255,255,0.5)", padding: 6, borderRadius: 4 }}>
                  <div style={{ opacity: 0.8, fontSize: 9, fontWeight: 600 }}>
                    STUDENT #
                  </div>
                  <div style={{ fontWeight: "bold", color: "#1d4ed8" }}>
                    {studentData.id || "N/A"}
                  </div>
                </div>
                <div style={{ background: "rgba(255,255,255,0.5)", padding: 6, borderRadius: 4 }}>
                  <div style={{ opacity: 0.8, fontSize: 9, fontWeight: 600 }}>
                    SECTION
                  </div>
                  <div style={{ fontWeight: "bold", color: "#1d4ed8" }}>
                    {settings.section}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 9, background: "rgba(255,255,255,0.5)", padding: 6, borderRadius: 4 }}>
                <div style={{ opacity: 0.8, fontSize: 8, fontWeight: 600 }}>
                  LRN
                </div>
                <div style={{ fontWeight: "bold", color: "#1d4ed8" }}>
                  {studentData.grade_level === "prek" ? "N/A" : (studentData.lrn || "N/A")}
                </div>
              </div>

              <div
                style={{
                  fontSize: 8,
                  background: "white",
                  padding: 6,
                  borderRadius: 4,
                  textAlign: "center",
                  marginTop: "auto",
                  color: "#333",
                  border: "1px solid #3b82f6",
                }}
              >
                Valid for AY {settings.acYear}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* BACK SIDE - White with Blue Lines & Yellow Accent */}
            <div
              style={{
                background: "white",
                height: "100%",
                padding: 16,
                display: "flex",
                flexDirection: "column",
                color: "#111",
                position: "relative",
                borderLeft: "5px solid #3b82f6",
              }}
            >
              {/* Yellow Accent Bar */}
              <div
                style={{
                  height: 4,
                  background: "#fbbf24",
                  marginBottom: 12,
                  borderRadius: 2,
                }}
              />

              <div
                style={{
                  textAlign: "center",
                  marginBottom: 12,
                  paddingBottom: 8,
                  borderBottom: "2px solid #3b82f6",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: "bold", color: "#1d4ed8" }}>
                  PARENT INFORMATION
                </div>
              </div>

              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Parent Info */}
                <div
                  style={{
                    padding: 8,
                    background: "#eff6ff",
                    borderRadius: 4,
                    borderLeft: "3px solid #fbbf24",
                  }}
                >
                  <div style={{ fontSize: 9, fontWeight: 600, color: "#1d4ed8", marginBottom: 4 }}>
                    PARENT/GUARDIAN
                  </div>
                  <div style={{ fontSize: 11, fontWeight: "bold" }}>
                    {settings.parentName || "—"}
                  </div>
                  <div style={{ fontSize: 9, marginTop: 2 }}>
                    📞 {settings.parentPhone || "—"}
                  </div>
                </div>

                {/* Birthday */}
                <div
                  style={{
                    padding: 8,
                    background: "#eff6ff",
                    borderRadius: 4,
                    borderLeft: "3px solid #fbbf24",
                  }}
                >
                  <div style={{ fontSize: 9, fontWeight: 600, color: "#1d4ed8", marginBottom: 4 }}>
                    BIRTHDATE
                  </div>
                  <div style={{ fontSize: 11, fontWeight: "bold" }}>
                    {studentData.birth_date
                      ? new Date(studentData.birth_date).toLocaleDateString()
                      : "—"}
                  </div>
                </div>

                {/* LRN */}
                <div
                  style={{
                    padding: 8,
                    background: "#eff6ff",
                    borderRadius: 4,
                    borderLeft: "3px solid #fbbf24",
                  }}
                >
                  <div style={{ fontSize: 9, fontWeight: 600, color: "#1d4ed8", marginBottom: 4 }}>
                    LRN
                  </div>
                  <div style={{ fontSize: 11, fontWeight: "bold" }}>
                    {studentData.lrn || "—"}
                  </div>
                </div>

                {/* School Address */}
                <div
                  style={{
                    padding: 8,
                    background: "white",
                    borderRadius: 4,
                    borderTop: "2px solid #3b82f6",
                    borderBottom: "2px solid #3b82f6",
                  }}
                >
                  <div style={{ fontSize: 9, fontWeight: 600, color: "#1d4ed8", marginBottom: 4 }}>
                    SCHOOL ADDRESS
                  </div>
                  <div style={{ fontSize: 8, lineHeight: 1.4 }}>
                    {settings.address || "—"}
                  </div>
                </div>
              </div>

              <div
                style={{
                  borderTop: "2px solid #3b82f6",
                  paddingTop: 6,
                  textAlign: "center",
                  fontSize: 7,
                  color: "#666",
                  marginTop: 8,
                }}
              >
                Please keep all information updated
              </div>
            </div>
          </>
        )}
      </div>
    );
  }
);

IdCardPreview.displayName = "IdCardPreview";
