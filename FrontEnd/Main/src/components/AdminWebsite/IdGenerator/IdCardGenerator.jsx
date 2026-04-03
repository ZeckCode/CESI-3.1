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

  const requiredFields = {
    firstName: studentData.first_name,
    lastName: studentData.last_name,
    gradeLevel: studentData.grade_level,
    section: cardSettings.section,
    lrn: studentData.grade_level === "prek" ? "N/A" : studentData.lrn,
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
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: null,
      });

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
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: null,
      });

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

  const studentName = `${studentData.first_name || ""} ${
    studentData.last_name || ""
  }`.trim();

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
      <div className="modal-content" style={{ maxWidth: 920, width: "95vw" }}>
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
          <div
            style={{
              flex: "0 0 280px",
              padding: 16,
              background: "#f8fafc",
              borderRadius: 10,
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
                  style={inputStyle}
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
                  style={inputStyle}
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
                  style={inputStyle}
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
                  style={inputStyle}
                />
              </div>
            </div>

            {cardSide === "back" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div className="form-group">
                  <label style={{ fontSize: 12, fontWeight: 600 }}>
                    Parent/Guardian Name
                  </label>
                  <input
                    type="text"
                    value={cardSettings.parentName}
                    onChange={(e) =>
                      setCardSettings({
                        ...cardSettings,
                        parentName: e.target.value,
                      })
                    }
                    style={inputStyle}
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontSize: 12, fontWeight: 600 }}>
                    Parent Phone
                  </label>
                  <input
                    type="text"
                    value={cardSettings.parentPhone}
                    onChange={(e) =>
                      setCardSettings({
                        ...cardSettings,
                        parentPhone: e.target.value,
                      })
                    }
                    style={inputStyle}
                  />
                </div>
              </div>
            )}

            <div
              style={{
                marginTop: 20,
                display: "flex",
                gap: 8,
                borderBottom: "2px solid #e2e8f0",
                paddingBottom: 0,
              }}
            >
              <button
                onClick={() => setCardSide("front")}
                style={{
                  ...tabBtnStyle,
                  color: cardSide === "front" ? "#2563eb" : "#94a3b8",
                  borderBottom:
                    cardSide === "front" ? "3px solid #2563eb" : "none",
                }}
              >
                📇 Front Side
              </button>
              <button
                onClick={() => setCardSide("back")}
                style={{
                  ...tabBtnStyle,
                  color: cardSide === "back" ? "#2563eb" : "#94a3b8",
                  borderBottom:
                    cardSide === "back" ? "3px solid #2563eb" : "none",
                }}
              >
                📋 Back Side
              </button>
            </div>

            <div
              style={{
                marginTop: 16,
                paddingTop: 16,
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#475569",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div>
                  <strong>Student:</strong> {studentName}
                </div>
                <div>
                  <strong>Grade:</strong>{" "}
                  {getGradeLevelDisplay(studentData.grade_level) || "N/A"}
                </div>
                <div>
                  <strong>Age:</strong> {studentAge} years old
                </div>
                <div>
                  <strong>LRN:</strong>{" "}
                  {studentData.grade_level === "prek"
                    ? "N/A"
                    : studentData.lrn || "N/A"}
                </div>
              </div>
            </div>
          </div>

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

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                width: "100%",
              }}
            >
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
                  <div
                    style={{
                      marginTop: 4,
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    {missingFields.map((f) => (
                      <div key={f}>
                        • {f.replace(/([A-Z])/g, " $1").trim()}
                      </div>
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
                    cursor:
                      canDownload && !isDownloading
                        ? "pointer"
                        : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontWeight: 500,
                    fontSize: 13,
                    opacity: isDownloading || !canDownload ? 0.6 : 1,
                  }}
                >
                  <Download size={14} />{" "}
                  {isDownloading ? "Downloading..." : "Download PDF"}
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
                    cursor:
                      canDownload && !isDownloading
                        ? "pointer"
                        : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontWeight: 500,
                    fontSize: 13,
                    opacity: isDownloading || !canDownload ? 0.6 : 1,
                  }}
                >
                  <Download size={14} />{" "}
                  {isDownloading ? "Downloading..." : "Download PNG"}
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
    const lrnValue =
      studentData.grade_level === "prek" ? "N/A" : studentData.lrn || "—";

    const birthDateValue = studentData.birth_date
      ? new Date(studentData.birth_date).toLocaleDateString("en-PH", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "—";

    return (
      <div
        ref={ref}
        style={{
          width: 350,
          height: 550,
          borderRadius: 14,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          fontFamily: "'Poppins', 'Inter', 'Arial', sans-serif",
          boxShadow: "0 12px 36px rgba(0,0,0,0.24)",
          position: "relative",
          overflow: "hidden",
          background: "#fff",
        }}
      >
        {cardSide === "front" ? (
          <>
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

            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(to bottom, rgba(255,255,255,0.00), rgba(255,255,255,0.06) 40%, rgba(255,255,255,0.10) 100%)",
                zIndex: 1,
                pointerEvents: "none",
              }}
            />

            <div
              style={{
                position: "absolute",
                top: 149,
                left: "50%",
                transform: "translateX(-50%)",
                width: 112,
                height: 112,
                borderRadius: "50%",
                overflow: "hidden",
                border: "3px solid #d8c31f",
                background: "#ffffff",
                zIndex: 3,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 8px 18px rgba(0,0,0,0.18)",
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
                    objectPosition: "center top",
                  }}
                />
              ) : (
                <div
                  style={{
                    fontSize: 38,
                    color: "#94a3b8",
                  }}
                >
                  👤
                </div>
              )}
            </div>

            <div
              style={{
                position: "absolute",
                top: 302,
                left: 30,
                right: 30,
                textAlign: "center",
                zIndex: 3,
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  color: "#0f172a",
                  lineHeight: 1.15,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  textShadow: "0 2px 6px rgba(255,255,255,0.96)",
                  wordBreak: "break-word",
                }}
              >
                {studentName || "—"}
              </div>
            </div>

            <div
              style={{
                position: "absolute",
                top: 340,
                left: 34,
                right: 34,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                zIndex: 3,
                textAlign: "center",
              }}
            >
              <div>
                <div style={frontLabelStyle}>STUDENT NO.</div>
                <div style={frontValueBlueStyle}>{studentData.id || "—"}</div>
              </div>

              <div>
                <div style={frontLabelStyle}>LRN</div>
                <div style={frontValueBlueStyle}>{lrnValue}</div>
              </div>
            </div>

            <div
              style={{
                position: "absolute",
                top: 382,
                left: 48,
                right: 48,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                zIndex: 3,
                textAlign: "center",
              }}
            >
              <div>
                <div style={frontLabelStyle}>GRADE</div>
                <div style={frontValueGoldStyle}>
                  {getGradeLevelDisplay(studentData.grade_level) || "N/A"}
                </div>
              </div>

              <div>
                <div style={frontLabelStyle}>SECTION</div>
                <div style={frontValueGoldStyle}>{settings.section || "N/A"}</div>
              </div>
            </div>

            <div
              style={{
                position: "absolute",
                bottom: 20,
                left: 0,
                right: 0,
                textAlign: "center",
                zIndex: 3,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: "#111827",
                  letterSpacing: 0.5,
                  textShadow: "0 2px 6px rgba(255,255,255,0.96)",
                }}
              >
                School Year {settings.acYear}
              </span>
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
                height: "100%",
                padding: 18,
                display: "flex",
                flexDirection: "column",
                color: "#111827",
                position: "relative",
                borderLeft: "5px solid #2563eb",
              }}
            >
              <div
                style={{
                  height: 4,
                  background: "#facc15",
                  marginBottom: 12,
                  borderRadius: 999,
                }}
              />

              <div
                style={{
                  textAlign: "center",
                  marginBottom: 14,
                  paddingBottom: 10,
                  borderBottom: "2px solid #2563eb",
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: "#1d4ed8",
                    letterSpacing: 0.8,
                  }}
                >
                  STUDENT INFORMATION
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <InfoBlock
                  label="PARENT / GUARDIAN"
                  value={settings.parentName || "—"}
                  extra={settings.parentPhone ? `📞 ${settings.parentPhone}` : "📞 —"}
                />

                <InfoBlock label="BIRTHDATE" value={birthDateValue} />
                <InfoBlock label="LRN" value={lrnValue} />
                <InfoBlock label="GRADE LEVEL" value={getGradeLevelDisplay(studentData.grade_level) || "N/A"} />
                <InfoBlock label="SECTION" value={settings.section || "N/A"} />

                <div
                  style={{
                    padding: "10px 12px",
                    background: "#ffffff",
                    borderRadius: 8,
                    border: "1px solid #dbeafe",
                    boxShadow: "0 3px 10px rgba(37,99,235,0.06)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: "#2563eb",
                      marginBottom: 4,
                      letterSpacing: 0.8,
                    }}
                  >
                    SCHOOL ADDRESS
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      lineHeight: 1.5,
                      color: "#334155",
                    }}
                  >
                    {settings.address || "—"}
                  </div>
                </div>
              </div>

              <div
                style={{
                  borderTop: "2px solid #2563eb",
                  paddingTop: 8,
                  textAlign: "center",
                  fontSize: 7,
                  color: "#64748b",
                  marginTop: 10,
                  lineHeight: 1.4,
                }}
              >
                If found, please return to Caloocan Evangelical School Inc.
              </div>
            </div>
          </>
        )}
      </div>
    );
  }
);

function InfoBlock({ label, value, extra }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "#eff6ff",
        borderRadius: 8,
        borderLeft: "4px solid #facc15",
        boxShadow: "0 3px 10px rgba(37,99,235,0.06)",
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: "#2563eb",
          marginBottom: 4,
          letterSpacing: 0.8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#0f172a",
          lineHeight: 1.4,
        }}
      >
        {value}
      </div>
      {extra ? (
        <div
          style={{
            fontSize: 9,
            color: "#475569",
            marginTop: 3,
            lineHeight: 1.35,
          }}
        >
          {extra}
        </div>
      ) : null}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: 13,
};

const tabBtnStyle = {
  padding: "8px 16px",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
};

const frontLabelStyle = {
  fontSize: 7,
  fontWeight: 800,
  color: "#475569",
  letterSpacing: 1,
  marginBottom: 3,
  textShadow: "0 2px 6px rgba(255,255,255,0.96)",
};

const frontValueBlueStyle = {
  fontSize: 12,
  fontWeight: 800,
  color: "#1e3a8a",
  textShadow: "0 2px 6px rgba(255,255,255,0.96)",
};

const frontValueGoldStyle = {
  fontSize: 13,
  fontWeight: 900,
  color: "#78350f",
  letterSpacing: 0.3,
  textShadow: "0 2px 6px rgba(255,255,255,0.96)",
};

IdCardPreview.displayName = "IdCardPreview";