import { useEffect, useMemo, useState } from "react";
import "../AdminWebsiteCSS/CMSModule.css";
import Pagination from './Pagination';
import { useAuth } from "../Auth/useAuth";
import { getToken } from "../Auth/auth";

const API_BASE = "http://127.0.0.1:8000";

function toLocalDatetimeInputValue(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Auto-detect JWT vs DRF Token
function authHeader(token) {
  if (!token) return {};
  const isJwt = token.split(".").length === 3;
  return { Authorization: `${isJwt ? "Bearer" : "Token"} ${token}` };
}

function isAdmin(user) {
  if (!user) return false;
  const isStaff = user.is_staff === true || user.is_staff === 1;
  const isSuper = user.is_superuser === true || user.is_superuser === 1;
  const role = String(user.role || "").toLowerCase();
  return isStaff || isSuper || role.includes("admin");
}

// Image Modal Component
function ImageModal({ isOpen, images, currentIndex, onClose, onNext, onPrev }) {
  if (!isOpen) return null;

  const currentImage = images[currentIndex];
  const isVideo = currentImage?.file_url?.match(/\.(mp4|webm|ogg|mov)$/i) || 
                  currentImage?.file?.match(/\.(mp4|webm|ogg|mov)$/i);

  const handleDownload = async () => {
    const url = currentImage.file_url || currentImage.file;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = url.split('/').pop() || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  return (
    <div className="cms-modal-overlay" onClick={onClose}>
      <div className="cms-modal-content" onClick={(e) => e.stopPropagation()}>
        {images.length > 1 && (
          <>
            <button className="cms-modal-nav prev" onClick={onPrev}>❮</button>
            <button className="cms-modal-nav next" onClick={onNext}>❯</button>
          </>
        )}
        
        <button className="cms-modal-close" onClick={onClose}>✕</button>
        
        {isVideo ? (
          <video 
            src={currentImage.file_url || currentImage.file} 
            controls 
            className="cms-modal-image"
            autoPlay
          />
        ) : (
          <img 
            src={currentImage.file_url || currentImage.file} 
            alt="" 
            className="cms-modal-image"
          />
        )}
        
        <div className="cms-modal-counter">
          {currentIndex + 1} / {images.length}
        </div>
        
        <a 
          href="#" 
          className="cms-modal-download"
          onClick={(e) => {
            e.preventDefault();
            handleDownload();
          }}
        >
          ⬇️ Download
        </a>
      </div>
    </div>
  );
}

function MediaPreview({ media, onImageClick }) {
  if (!media?.length) return null;

  return (
    <div className="cms-media-grid">
      {media.map((m, index) => {
        const url = m.file_url || m.file;
        const name = String(m.file || "").toLowerCase();

        if (!url) return null;

        if (name.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
          return (
            <img 
              key={m.id} 
              src={url} 
              alt="" 
              className="cms-post-media"
              onClick={() => onImageClick(index)}
            />
          );
        }

        if (name.match(/\.(mp4|webm|ogg|mov)$/)) {
          return (
            <video 
              key={m.id} 
              controls 
              className="cms-post-media"
              onClick={() => onImageClick(index)}
            >
              <source src={url} />
            </video>
          );
        }

        return (
          <a key={m.id} href={url} target="_blank" rel="noreferrer">
            Open file
          </a>
        );
      })}
    </div>
  );
}


function PostDetailModal({ isOpen, post, onClose, onMediaClick }) {
  if (!isOpen || !post) return null;

  const dateStr =
    post.publish_date || post.created_at
      ? new Date(post.publish_date || post.created_at).toLocaleString()
      : "";

  return (
    <div className="cms-postmodal-overlay" onClick={onClose}>
      <div className="cms-postmodal" onClick={(e) => e.stopPropagation()}>
        <button className="cms-postmodal-close" onClick={onClose}>✕</button>

        <div className="cms-postmodal-head">
          <div className="cms-postmodal-title">{post.title || "Untitled"}</div>

          <div className="cms-postmodal-meta">
            <span className="cms-badge" data-role={post.target_role}>
              {post.target_role || "all"}
            </span>
            <span>{dateStr}</span>
          </div>
        </div>

        <div className="cms-postmodal-body">
          <p className="cms-postmodal-content">{post.content || ""}</p>

          {post?.media?.length > 0 && (
            <div className="cms-postmodal-media">
              <h4>Media</h4>
              <div className="cms-media-grid">
                {post.media.map((m, index) => {
                  const url = m.file_url || m.file;
                  const name = String(m.file || "").toLowerCase();
                  if (!url) return null;

                  if (name.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
                    return (
                      <img
                        key={m.id}
                        src={url}
                        alt=""
                        className="cms-post-media"
                        onClick={() => onMediaClick(index)}
                      />
                    );
                  }

                  if (name.match(/\.(mp4|webm|ogg|mov)$/)) {
                    return (
                      <video
                        key={m.id}
                        className="cms-post-media"
                        controls
                        onClick={() => onMediaClick(index)}
                      >
                        <source src={url} />
                      </video>
                    );
                  }

                  return (
                    <a key={m.id} href={url} target="_blank" rel="noreferrer">
                      Open file
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export default function CMSModule() {
  const { user } = useAuth();
  const canPost = useMemo(() => isAdmin(user), [user]);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [targetRole, setTargetRole] = useState("all");
  const [publishDate, setPublishDate] = useState(() =>
    toLocalDatetimeInputValue()
  );
  const [files, setFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [audienceTab, setAudienceTab] = useState("all");
  
  // New: Search/Filter state
  const [searchQuery, setSearchQuery] = useState("");
  
  // New: Edit mode state
  const [editingPostId, setEditingPostId] = useState(null);
  
  // New: Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  
  // New: Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const filteredPosts = useMemo(() => {
    const norm = (v) => String(v || "").toLowerCase();
    let result = posts;

    // Filter by audience tab
    if (audienceTab === "all") {
      result = posts;
    } else if (audienceTab === "public") {
      result = posts.filter((p) => norm(p.target_role) === "all");
    } else if (audienceTab === "teachers") {
      result = posts.filter((p) => {
        const t = norm(p.target_role);
        return t === "teachers";
      });
    } else if (audienceTab === "parent_student") {
      result = posts.filter((p) => {
        const t = norm(p.target_role);
        return t === "parent_student";
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = norm(searchQuery);
      result = result.filter((p) => 
        norm(p.title).includes(query) || norm(p.content).includes(query)
      );
    }

    return result;
  }, [posts, audienceTab, searchQuery]);

  const [cmsPage, setCmsPage] = useState(1);
  const CMS_PER_PAGE = 6;
  const cmsTotalPages = Math.ceil(filteredPosts.length / CMS_PER_PAGE);
  const paginatedPosts = filteredPosts.slice((cmsPage - 1) * CMS_PER_PAGE, cmsPage * CMS_PER_PAGE);
  useEffect(() => { setCmsPage(1); }, [audienceTab]);

  
  const [postOpen, setPostOpen] = useState(false);
  const [activePost, setActivePost] = useState(null);

    
  const openPost = (post) => {
    setActivePost(post);
    setPostOpen(true);
  };

  const closePost = () => {
    setPostOpen(false);
    setActivePost(null);
  };
  // Image modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalImages, setModalImages] = useState([]);
  const [modalCurrentIndex, setModalCurrentIndex] = useState(0);

  async function readError(res) {
    const text = await res.text().catch(() => "");
    return `HTTP ${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`;
  }

  async function load() {
    setError("");
    setLoading(true);

    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/api/announcements/`, {
        headers: authHeader(token),
      });

      if (!res.ok) throw new Error(await readError(res));

      const data = await res.json();
      setPosts(Array.isArray(data) ? data : data.results || []);
    } catch (e) {
      setError(e.message || "Failed to load announcements");
    } finally {
      setLoading(false);
    }
  }

  // Load once
  useEffect(() => {
    load();
  }, []);

  // Cleanup previews whenever they change/unmount
  useEffect(() => {
    return () => imagePreviews.forEach((u) => URL.revokeObjectURL(u));
  }, [imagePreviews]);

  // Handle keyboard navigation for modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!modalOpen) return;
      
      if (e.key === 'Escape') {
        setModalOpen(false);
      } else if (e.key === 'ArrowLeft') {
        handlePrevImage();
      } else if (e.key === 'ArrowRight') {
        handleNextImage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen, modalCurrentIndex, modalImages]);

  const handleFiles = (e) => {
    const list = Array.from(e.target.files || []);
    setFiles(list);

    // cleanup old previews
    imagePreviews.forEach((u) => URL.revokeObjectURL(u));

    // preview only images
    const previews = list
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => URL.createObjectURL(f));

    setImagePreviews(previews);
  };

  const handlePost = async () => {
    if (!canPost) {
      setError("Admins only can publish announcements.");
      return;
    }

    const token = getToken();
    if (!token) {
      setError("No token found. Your login API isn’t returning a token yet.");
      return;
    }

    if (!title.trim() || !content.trim()) {
      setError("Title and content are required.");
      return;
    }

    setError("");

    const form = new FormData();
    form.append("title", title);
    form.append("content", content);
    form.append("target_role", targetRole);
    form.append("publish_date", new Date(publishDate).toISOString());
    files.forEach((f) => form.append("files", f));

    try {
      const url = editingPostId
        ? `${API_BASE}/api/announcements/${editingPostId}/`
        : `${API_BASE}/api/announcements/`;

      const res = await fetch(url, {
        method: editingPostId ? "PUT" : "POST",
        headers: authHeader(token),
        body: form,
      });

      if (!res.ok) throw new Error(await readError(res));

      const resultPost = await res.json();

      if (editingPostId) {
        // Update existing post
        setPosts((prev) => prev.map((p) => (p.id === editingPostId ? resultPost : p)));
        setEditingPostId(null);
      } else {
        // Add new post
        setPosts((prev) => [resultPost, ...prev]);
      }

      // reset form
      setTitle("");
      setContent("");
      setTargetRole("all");
      setPublishDate(toLocalDatetimeInputValue());
      setFiles([]);

      imagePreviews.forEach((u) => URL.revokeObjectURL(u));
      setImagePreviews([]);
    } catch (e) {
      setError(e.message || "Failed to publish announcement");
    }
  };

  // Image modal functions
  const openImageModal = (images, index) => {
    setModalImages(images);
    setModalCurrentIndex(index);
    setModalOpen(true);
  };

  const handleNextImage = () => {
    setModalCurrentIndex((prev) => 
      prev === modalImages.length - 1 ? 0 : prev + 1
    );
  };

  const handlePrevImage = () => {
    setModalCurrentIndex((prev) => 
      prev === 0 ? modalImages.length - 1 : prev - 1
    );
  };

  // Handle image click from thumbnail
  const handleThumbnailClick = (post) => {
    if (post.media && post.media.length > 0) {
      openImageModal(post.media, 0);
    }
  };

  // Edit post
  const handleEditPost = (post) => {
    setTitle(post.title);
    setContent(post.content);
    setTargetRole(post.target_role);
    setPublishDate(post.publish_date ? new Date(post.publish_date).toISOString().slice(0, 16) : toLocalDatetimeInputValue());
    setEditingPostId(post.id);
    setFiles([]);
    setImagePreviews([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setEditingPostId(null);
    setTitle("");
    setContent("");
    setTargetRole("all");
    setPublishDate(toLocalDatetimeInputValue());
    setFiles([]);
    imagePreviews.forEach((u) => URL.revokeObjectURL(u));
    setImagePreviews([]);
  };

  // Delete post with confirmation
  const handleDeletePost = async (postId) => {
    const token = getToken();
    if (!token) {
      setError("No token found.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/announcements/${postId}/`, {
        method: "DELETE",
        headers: authHeader(token),
      });

      if (!res.ok) throw new Error(await readError(res));

      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setDeleteConfirm(null);
    } catch (e) {
      setError(e.message || "Failed to delete announcement");
    }
  };

  return (
    <div className="cms-container">
      <div className="cms-header">
        <div>
          <h2>CMS Module (CESI Website Control)</h2>
          {editingPostId && (
            <p style={{ margin: "8px 0 0 0", fontSize: "14px", color: "#3b82f6", fontWeight: "600" }}>
              ✏️ Editing post #{editingPostId}
            </p>
          )}
        </div>
        <button className="cms-refresh" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {!canPost && (
        <div className="cms-warning">Admins only can publish announcements.</div>
      )}

      {error && <div className="cms-error">{error}</div>}

      {canPost && (
        <div className="cms-card">
          <div className="cms-form-grid">
            <div className="cms-field">
              <label>Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Announcement title"
              />
            </div>

            <div className="cms-field">
              <label>Target role</label>
              <select
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
              >
                <option value="all">All</option>
                 <option value="parent_student">Parent / Student</option>
                <option value="teachers">Teachers</option>
              </select>
            </div>

            <div className="cms-field">
              <label>Publish date</label>
              <input
                type="datetime-local"
                value={publishDate}
                onChange={(e) => setPublishDate(e.target.value)}
              />
            </div>

            <div className="cms-field cms-field-full">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label>Content</label>
                <span style={{ fontSize: "12px", color: "#666", fontWeight: "500" }}>
                  {content.length} characters
                </span>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write announcement..."
                rows={5}
              />
            </div>

            <div className="cms-field cms-field-full">
              <label>Photos / Videos</label>
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={handleFiles}
              />
              {imagePreviews.length > 0 && (
                <div className="cms-preview-grid">
                  {imagePreviews.map((src, idx) => (
                    <img 
                      key={idx} 
                      src={src} 
                      className="preview-img" 
                      alt="" 
                      onClick={() => {
                        // For preview images, we don't have full media objects yet
                        // So just open the preview URL
                        window.open(src, '_blank');
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="cms-actions">
              {editingPostId && (
                <button
                  className="cms-publish"
                  onClick={handleCancelEdit}
                  style={{
                    background: "#94a3b8",
                    marginRight: "12px",
                  }}
                >
                  Cancel
                </button>
              )}
              <button className="cms-publish" onClick={handlePost}>
                {editingPostId ? "Update Post" : "Publish"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="cms-posts">
        <h3>Posted Announcements</h3>
        
        {/* Search Box */}
        <div style={{
          marginBottom: "20px",
          display: "flex",
          gap: "12px",
        }}>
          <input
            type="text"
            placeholder="🔍 Search announcements by title or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              padding: "12px 16px",
              border: "2px solid #e2e8f0",
              borderRadius: "12px",
              fontSize: "14px",
              outline: "none",
            }}
            onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
            onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{
                padding: "10px 16px",
                background: "#f3f4f6",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: "600",
              }}
            >
              Clear
            </button>
          )}
        </div>
         <div className="cms-tabs">
            <button
              className={`cms-tab ${audienceTab === "all" ? "active" : ""}`}
              onClick={() => setAudienceTab("all")}
              type="button"
            >
              All
            </button>

            <button
              className={`cms-tab ${audienceTab === "public" ? "active" : ""}`}
              onClick={() => setAudienceTab("public")}
              type="button"
            >
              Public
            </button>

            <button
              className={`cms-tab ${audienceTab === "teachers" ? "active" : ""}`}
              onClick={() => setAudienceTab("teachers")}
              type="button"
            >
              Teachers
            </button>

            <button
              className={`cms-tab ${audienceTab === "parent_student" ? "active" : ""}`}
              onClick={() => setAudienceTab("parent_student")}
              type="button"
            >
              Parent / Student
            </button>
          </div>

        {loading ? (
          <p>Loading…</p>
        ) : filteredPosts.length === 0 ? (
          <p>No announcements yet.</p>
        ) : (
          <>
          {paginatedPosts.map((post) => {
            const firstMedia = post?.media?.[0];
            const firstUrl = firstMedia?.file_url || firstMedia?.file || "";
            const firstName = String(firstMedia?.file || "").toLowerCase();
            const isImage = firstUrl && firstName.match(/\.(jpg|jpeg|png|gif|webp)$/);

            return (
              <div
                  key={post.id}
                  className={`cms-post ${isImage ? "cms-post--row" : "cms-post--noimg"}`}
                  onClick={() => openPost(post)}
                  style={{ cursor: "pointer" }}
                >
                {/* LEFT: reserved media box (always there) */}
                {isImage && (
                      <div
                        className="cms-post-thumb"
                        onClick={(e) => {
                          e.stopPropagation(); // prevent opening full post modal
                          post.media?.length > 0 && handleThumbnailClick(post);
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        <img src={firstUrl} alt="" />
                      </div>
                    )}

                {/* RIGHT: text */}
                <div className="cms-post-right">
                  <div className="cms-post-top">
                    <div className="cms-post-title">{post.title}</div>

                    <div className="cms-post-meta">
                      <span 
                        className="cms-badge"
                        data-role={post.target_role}
                      >
                        {post.target_role}
                      </span>
                      <span>
                        {post.publish_date ? new Date(post.publish_date).toLocaleString() : ""}
                      </span>
                      {canPost && (
                        <div style={{ display: "flex", gap: "8px", marginLeft: "auto" }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditPost(post);
                            }}
                            style={{
                              padding: "6px 12px",
                              background: "#3b82f6",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: "600",
                              cursor: "pointer",
                              transition: "background 0.2s",
                            }}
                            onMouseEnter={(e) => e.target.style.background = "#2563eb"}
                            onMouseLeave={(e) => e.target.style.background = "#3b82f6"}
                          >
                            ✎ Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm(post.id);
                            }}
                            style={{
                              padding: "6px 12px",
                              background: "#ef4444",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: "600",
                              cursor: "pointer",
                              transition: "background 0.2s",
                            }}
                            onMouseEnter={(e) => e.target.style.background = "#dc2626"}
                            onMouseLeave={(e) => e.target.style.background = "#ef4444"}
                          >
                            🗑 Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="cms-post-content">{post.content}</p>

                  {/* Optional: if you still want to show the rest of media below */}
                  {post?.media?.length > 1 && (
                    <MediaPreview 
                      media={post.media.slice(1)} 
                      onImageClick={(index) => openImageModal(post.media, index + 1)}
                    />
                  )}
                </div>
              </div>
            );
          })}
          <Pagination currentPage={cmsPage} totalPages={cmsTotalPages} onPageChange={setCmsPage} totalItems={filteredPosts.length} itemsPerPage={CMS_PER_PAGE} />
          </>
        )}
      </div>
            {/* view */}
        <PostDetailModal
          isOpen={postOpen}
          post={activePost}
          onClose={closePost}
          onMediaClick={(index) => {
            if (!activePost?.media?.length) return;
            openImageModal(activePost.media, index);
          }}
        />
      {/* Image Modal */}
      <ImageModal
        isOpen={modalOpen}
        images={modalImages}
        currentIndex={modalCurrentIndex}
        onClose={() => setModalOpen(false)}
        onNext={handleNextImage}
        onPrev={handlePrevImage}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            style={{
              background: "white",
              borderRadius: "16px",
              padding: "32px",
              maxWidth: "400px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 12px", fontSize: "20px", fontWeight: "700", color: "#1f2937" }}>
              Delete Announcement?
            </h3>
            <p style={{ margin: "0 0 24px", color: "#6b7280", fontSize: "14px", lineHeight: "1.6" }}>
              Are you sure you want to delete this announcement? This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  padding: "10px 20px",
                  background: "#f3f4f6",
                  color: "#1f2937",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeletePost(deleteConfirm)}
                style={{
                  padding: "10px 20px",
                  background: "#ef4444",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}