import React, { useState, useRef } from "react";
import { Download, X, Settings } from "lucide-react";
import html2pdf from "html2pdf.js";
import html2canvas from "html2canvas";

export default function IdCardGenerator({
  isOpen,
  onClose,
  studentData,
  schoolInfo,
}) {
  const cardRef = useRef(null);
  const [cardSide, setCardSide] = useState("front"); // "front" or "back"
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
    // Parent/Guardian info
    parentName: studentData?.parent_name || "",
    parentPhone: studentData?.parent_phone || "",
  });
  const [isDownloading, setIsDownloading] = useState(false);

  if (!isOpen) return null;

  const downloadPDF = async () => {
    if (!cardRef.current) return;

    setIsDownloading(true);
    try {
      const element = cardRef.current;
      const opt = {
        margin: 5,
        filename: `${studentData.first_name}_${studentData.last_name}_ID.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { orientation: "portrait", unit: "mm", format: "a4" },
      };
      html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error("PDF download failed:", error);
      alert("Failed to download ID card");
    } finally {
      setIsDownloading(false);
    }
  };

  const downloadImage = async () => {
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
              studentAge={studentAge}
              cardSide={cardSide}
            />

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={downloadPDF}
                disabled={isDownloading}
                style={{
                  padding: "10px 16px",
                  background: "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: isDownloading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontWeight: 500,
                  fontSize: 13,
                  opacity: isDownloading ? 0.6 : 1,
                }}
              >
                <Download size={14} /> {isDownloading ? "Downloading..." : "Download PDF"}
              </button>
              <button
                onClick={downloadImage}
                disabled={isDownloading}
                style={{
                  padding: "10px 16px",
                  background: "#8b5cf6",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: isDownloading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontWeight: 500,
                  fontSize: 13,
                  opacity: isDownloading ? 0.6 : 1,
                }}
              >
                <Download size={14} /> Download PNG
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: "10px 16px",
                  background: "#e5e7eb",
                  color: "#374151",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontWeight: 500,
                  fontSize: 13,
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const IdCardPreview = React.forwardRef(
  ({ studentData, settings, studentName, studentAge, cardSide }, ref) => {
    return (
      <div
        ref={ref}
        style={{
          width: 350,
          height: 550,
          background: cardSide === "front" 
            ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            : "#1e293b",
          borderRadius: 12,
          padding: 16,
          display: "flex",
          flexDirection: "column",
          color: "white",
          fontFamily: "Arial, sans-serif",
          boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {cardSide === "front" ? (
          <>
        {/* Header with Logo */}
        <div style={{ textAlign: "center", marginBottom: 12, paddingBottom: 12, borderBottom: "2px solid rgba(255,255,255,0.3)" }}>
          {settings.logo_url && (
            <img
              src={settings.logo_url}
              alt="School Logo"
              style={{
                height: 40,
                maxWidth: 80,
                margin: "0 auto 6px",
                objectFit: "contain",
                filter: "brightness(0) invert(1)",
              }}
            />
          )}
          <div style={{ fontSize: 18, fontWeight: "bold", marginBottom: 2 }}>
            {settings.schoolName}
          </div>
          <div style={{ fontSize: 11, opacity: 0.9 }}>{settings.schoolMotto}</div>
        </div>

        {/* Student Photo Section */}
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          {studentData.id_image_url ? (
            <img
              src={studentData.id_image_url}
              alt={studentName}
              style={{
                width: 100,
                height: 100,
                borderRadius: "50%",
                border: "3px solid white",
                objectFit: "cover",
                boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
              }}
            />
          ) : (
            <div
              style={{
                width: 100,
                height: 100,
                borderRadius: "50%",
                border: "3px solid white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255,255,255,0.2)",
                fontSize: 40,
              }}
            >
              👤
            </div>
          )}
        </div>

        {/* Student Info */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: "bold" }}>{studentName}</div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>Grade {studentData.grade_level || "—"}</div>
          </div>

          <div style={{ fontSize: 11, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <div style={{ opacity: 0.8, fontSize: 10 }}>SECTION</div>
              <div style={{ fontWeight: "bold" }}>{settings.section}</div>
            </div>
            <div>
              <div style={{ opacity: 0.8, fontSize: 10 }}>AGE</div>
              <div style={{ fontWeight: "bold" }}>{studentAge} yrs</div>
            </div>
          </div>

          <div style={{ fontSize: 11 }}>
            <div style={{ opacity: 0.8, fontSize: 10 }}>LRN</div>
            <div style={{ fontWeight: "bold", letterSpacing: "1px" }}>
              {studentData.lrn || "N/A"}
            </div>
          </div>

          <div style={{ fontSize: 11 }}>
            <div style={{ opacity: 0.8, fontSize: 10 }}>ACADEMIC YEAR</div>
            <div style={{ fontWeight: "bold" }}>{settings.acYear}</div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: "2px solid rgba(255,255,255,0.3)",
            paddingTop: 8,
            textAlign: "center",
            fontSize: 8,
            opacity: 0.85,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div style={{ fontWeight: "bold" }}>Valid for AY {settings.acYear}</div>
          <div style={{ fontSize: 7, opacity: 0.9, lineHeight: 1.2 }}>
            📍 {settings.address}
          </div>
          <div style={{ fontSize: 7, opacity: 0.9 }}>📞 {settings.phone}</div>
          <div style={{ fontSize: 7, opacity: 0.9, marginBottom: 4 }}>📧 {settings.email}</div>
          <div style={{ fontSize: 7, opacity: 0.7, paddingTop: 4, borderTop: "1px solid rgba(255,255,255,0.2)" }}>
            {settings.copyright || "© 2025 CESI. All rights reserved."}
          </div>
        </div>

        {/* Decorative elements */}
        <div
          style={{
            position: "absolute",
            top: -50,
            right: -50,
            width: 150,
            height: 150,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.05)",
            pointerEvents: "none",
          }}
        />
          </>
        ) : (
          <>
        {/* BACK SIDE - Parent Info & Address */}
        <div style={{ textAlign: "center", marginBottom: 16, paddingBottom: 12, borderBottom: "2px solid rgba(255,255,255,0.3)" }}>
          <div style={{ fontSize: 16, fontWeight: "bold" }}>PARENT INFORMATION</div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, fontSize: 10 }}>
          {/* Parent Info */}
          <div>
            <div style={{ opacity: 0.7, fontSize: 9, fontWeight: 600, marginBottom: 4 }}>PARENT/GUARDIAN</div>
            <div style={{ fontWeight: "bold", fontSize: 12 }}>
              {settings.parentName || "—"}
            </div>
            <div style={{ opacity: 0.9, fontSize: 10, marginTop: 2 }}>
              📞 {settings.parentPhone || "—"}
            </div>
          </div>

          {/* School Address */}
          <div style={{ paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.2)" }}>
            <div style={{ opacity: 0.7, fontSize: 9, fontWeight: 600, marginBottom: 4 }}>SCHOOL ADDRESS</div>
            <div style={{ fontSize: 9, lineHeight: 1.4, opacity: 0.95 }}>
              {settings.address || "—"}
            </div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.2)", paddingTop: 8, textAlign: "center", fontSize: 7, opacity: 0.7 }}>
          Please keep parent contact updated
        </div>
          </>
        )}
      </div>
    );
  }
);

IdCardPreview.displayName = "IdCardPreview";
