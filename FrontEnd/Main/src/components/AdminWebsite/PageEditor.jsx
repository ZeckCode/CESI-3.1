import React, { useState, useEffect } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import DOMPurify from "dompurify";
import "../AdminWebsiteCSS/CMSModule.css";
import { apiFetch } from "../api/apiFetch";

// Basic formatting modules for React Quill
const modules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike", "blockquote"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["link"],
    ["clean"],
  ],
};

const formats = [
  "header",
  "bold",
  "italic",
  "underline",
  "strike",
  "blockquote",
  "list",
  "link",
];

export default function PageEditor({ endpoint, title, fields }) {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [endpoint]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/cms/${endpoint}/`);
      if (!res.ok) throw new Error("Failed to load data");
      const json = await res.json();
      
      // Initialize state with default empty values if null
      const initData = { ...json };
      fields.forEach(f => {
        if (!initData[f.key]) initData[f.key] = "";
      });
      setData(initData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      
      const res = await apiFetch(`/api/cms/${endpoint}/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!res.ok) throw new Error("Failed to save data");
      const json = await res.json();
      setData(json);
      setSuccess("Changes saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key, value) => {
    setData(prev => ({ ...prev, [key]: value }));
  };

  if (loading) return <div>Loading {title}...</div>;

  return (
    <div className="cms-page-editor">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3>{title}</h3>
        <button 
          onClick={() => setPreviewOpen(true)}
          style={{ padding: "8px 16px", background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: "6px", cursor: "pointer" }}
        >
          👀 Preview
        </button>
      </div>
      
      {error && <div className="cms-error" style={{ color: "red", margin: "10px 0" }}>{error}</div>}
      {success && <div className="cms-success" style={{ color: "green", margin: "10px 0" }}>{success}</div>}

      <div className="cms-form-grid" style={{ marginTop: "20px" }}>
        {fields.map((field) => (
          <div className={`cms-field cms-field-full`} key={field.key} style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>{field.label}</label>
            {field.type === "richtext" ? (
              <ReactQuill
                theme="snow"
                value={data[field.key] || ""}
                onChange={(val) => handleChange(field.key, val)}
                modules={modules}
                formats={formats}
                style={{ background: "#fff" }}
              />
            ) : field.type === "textarea" ? (
              <textarea
                value={data[field.key] || ""}
                onChange={(e) => handleChange(field.key, e.target.value)}
                style={{ width: "100%", padding: "8px" }}
                rows={4}
              />
            ) : (
              <input
                type={field.type || "text"}
                value={data[field.key] || ""}
                onChange={(e) => handleChange(field.key, e.target.value)}
                style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
              />
            )}
          </div>
        ))}

        <div className="cms-actions" style={{ marginTop: "20px" }}>
          <button 
            className="cms-publish" 
            onClick={handleSave} 
            disabled={saving}
            style={{ padding: "10px 20px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {previewOpen && (
        <div className="cms-preview-overlay" style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, 
          background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000
        }} onClick={() => setPreviewOpen(false)}>
          <div className="cms-preview-modal" style={{
            background: "#fff", width: "80%", maxWidth: "800px", maxHeight: "90vh", 
            borderRadius: "12px", overflowY: "auto", padding: "24px"
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #eee", paddingBottom: "16px", marginBottom: "16px" }}>
              <h2>Live Preview</h2>
              <button onClick={() => setPreviewOpen(false)} style={{ background: "transparent", border: "none", fontSize: "20px", cursor: "pointer" }}>✕</button>
            </div>
            
            <div className="preview-content">
              {fields.map(field => (
                <div key={field.key} style={{ marginBottom: "24px" }}>
                  <h4 style={{ color: "#666", textTransform: "uppercase", fontSize: "12px" }}>{field.label}</h4>
                  {field.type === "richtext" ? (
                    <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(data[field.key] || "") }} />
                  ) : (
                    <div>{data[field.key]}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}