import React, { useState, useEffect, useRef } from "react";
import "../StudentWebsiteCSS/Message.css";
import {
  listChats,
  getChatDetail,
  updateChat,
  createClassChat,
  createProjectChat,
  searchUsers,
  sendMessage,
  listChatRequests,
  respondToChatRequest,
  addMemberToChat,
  removeMemberFromChat,
  deleteChat,
  createMessageReport,
  createChatRequest,
} from "../api/messaging";
import { getSchoolYear } from "../api/announcements";
import { getToken } from "../Auth/auth";

const StudentMessage = () => {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [schoolYear, setSchoolYear] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const scrollRef = useRef(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatType, setNewChatType] = useState("individual");
  const [newChatName, setNewChatName] = useState("");
  const [newChatTarget, setNewChatTarget] = useState("");
  const [initialMessage, setInitialMessage] = useState("");
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [newChatSection, setNewChatSection] = useState("");
  const [newChatSubject, setNewChatSubject] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [respondingToRequest, setRespondingToRequest] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [userSuggestions, setUserSuggestions] = useState([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [selectedUserText, setSelectedUserText] = useState("");
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showGroupActionsModal, setShowGroupActionsModal] = useState(false);
  const [groupActionView, setGroupActionView] = useState("menu");
  
  // Chat editing and member management
  const [editingChatName, setEditingChatName] = useState(false);
  const [newChatNameValue, setNewChatNameValue] = useState("");
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const [memberToAdd, setMemberToAdd] = useState("");
  const [memberSuggestions, setMemberSuggestions] = useState([]);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  
  // Chat request modal
  const [selectedChatRequest, setSelectedChatRequest] = useState(null);
  const [expandedRequestMessage, setExpandedRequestMessage] = useState(false);
  
  // Message context menu and reporting
  const [messageContextMenu, setMessageContextMenu] = useState(null);
  const [reportingMessageId, setReportingMessageId] = useState(null);
  const [reportReason, setReportReason] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // Fetch current user
      const token = getToken();
      let currentUserData = null;
      if (token) {
        const userRes = await fetch("/api/accounts/me/detail/", {
          headers: { Authorization: `Token ${token}` },
        });
        if (userRes.ok) {
          currentUserData = await userRes.json();
          setCurrentUser(currentUserData);
        }
      }

      // Load lightweight dropdown options used by parent/student class chat creation.
      const [sectionsRes, subjectsRes] = await Promise.all([
        fetch("/api/accounts/sections/", {
          headers: { Authorization: `Token ${token}` },
        }),
        fetch("/api/accounts/subjects/", {
          headers: { Authorization: `Token ${token}` },
        }),
      ]);

      if (sectionsRes.ok) {
        const data = await sectionsRes.json();
        setSections(Array.isArray(data) ? data : data.results || []);
      }
      if (subjectsRes.ok) {
        const data = await subjectsRes.json();
        setSubjects(Array.isArray(data) ? data : data.results || []);
      }

      // Fetch school year
      const sy = await getSchoolYear();
      setSchoolYear(sy);

      // Fetch chats
      const chatsData = await listChats();
      setChats(chatsData || []);

      // Fetch pending chat requests
      const requestsData = await listChatRequests('PENDING');
      const requestList = requestsData.results || requestsData || [];
      const incomingOnly = currentUserData
        ? requestList.filter((req) => req.recipient?.id === currentUserData.id)
        : requestList;
      setPendingRequests(incomingOnly);

      setError("");
    } catch (err) {
      setError("Failed to load data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadChatDetail = async (chatId) => {
    try {
      const chatData = await getChatDetail(chatId);
      setSelectedChat(chatData);
      setMessages(chatData.messages || []);
      setError("");
    } catch (err) {
      setError("Failed to load chat");
    }
  };

  const handleSelectChat = (chat) => {
    loadChatDetail(chat.id);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!input.trim() && !image) || !selectedChat) return;

    setIsSending(true);
    try {
      const messageData = await sendMessage(selectedChat.id, input, image);
      setMessages((prev) => [...prev, messageData]);
      setInput("");
      setImage(null);
      setError("");
    } catch (err) {
      setError("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleCreateNewChat = async (e) => {
    e.preventDefault();
    if (!schoolYear) {
      setError("Could not determine school year");
      return;
    }

    // Validate input
    if (newChatType === "individual" && !selectedUserId) {
      setError("Please select a user");
      return;
    }
    if (newChatType === "project" && !newChatName) {
      setError("Please enter a group name");
      return;
    }
    if (newChatType === "class" && (!newChatSection || !newChatSubject)) {
      setError("Please select both section and subject");
      return;
    }

    try {
      let chatData = null;
      if (newChatType === "individual") {
        await createChatRequest(selectedUserId, initialMessage || "");
      } else if (newChatType === "class") {
        chatData = await createClassChat(newChatSection, newChatSubject, schoolYear.name);
      } else {
        chatData = await createProjectChat(newChatName, schoolYear.name);
      }

      const refreshedChats = await listChats();
      setChats(refreshedChats || []);
      setShowNewChat(false);
      setNewChatType("individual");
      setNewChatName("");
      setNewChatTarget("");
      setSelectedUserId(null);
      setInitialMessage("");
      setNewChatSection("");
      setNewChatSubject("");
      setSelectedUserText("");
      setError("");
      if (chatData?.id) {
        handleSelectChat(chatData);
      }
    } catch (err) {
      setError("Failed to create chat: " + (err.message || "Unknown error"));
      console.error(err);
    }
  };

  const handleUserSearch = async (query) => {
    setSelectedUserText(query);
    setSelectedUserId(null);
    if (query.length < 2) {
      setUserSuggestions([]);
      setShowUserDropdown(false);
      return;
    }

    try {
      const data = await searchUsers(query);
      setUserSuggestions(data || []);
      setShowUserDropdown(true);
    } catch (err) {
      console.error("Search failed:", err);
    }
  };

  const handleSelectUser = (user) => {
    setSelectedUserId(user.id);
    setSelectedUserText(getUserDisplayName(user));
    setUserSuggestions([]);
    setShowUserDropdown(false);
  };

  const handleRespondToRequest = async (requestId, action) => {
    setRespondingToRequest(requestId);
    try {
      await respondToChatRequest(requestId, action);
      setPendingRequests((prev) =>
        prev.filter((req) => req.id !== requestId)
      );
      if (action === 'accept') {
        const chatsData = await listChats();
        setChats(chatsData || []);
      }
      setError("");
    } catch (err) {
      setError(`Failed to ${action} request`);
      console.error(err);
    } finally {
      setRespondingToRequest(null);
    }
  };

  // Chat editing and member management handlers
  const handleEditChatName = async () => {
    if (!selectedChat || !newChatNameValue.trim()) {
      setError("Please enter a chat name");
      return;
    }
    
    try {
      await updateChat(selectedChat.id, { name: newChatNameValue });
      setSelectedChat((prev) => ({ ...prev, name: newChatNameValue }));
      setChats((prev) =>
        prev.map((c) => (c.id === selectedChat.id ? { ...c, name: newChatNameValue } : c))
      );
      setEditingChatName(false);
      setShowEditModal(false);
      setNewChatNameValue("");
      setError("");
    } catch (err) {
      setError("Failed to update chat name: " + err.message);
      console.error(err);
    }
  };

  const handleDeleteConversation = async () => {
    if (!selectedChat) return;
    if (!window.confirm("Delete this conversation? This hides it for all members.")) return;

    try {
      await deleteChat(selectedChat.id);
      setChats((prev) => prev.filter((c) => c.id !== selectedChat.id));
      setSelectedChat(null);
      setMessages([]);
      setShowAddMemberForm(false);
      setShowGroupActionsModal(false);
      setShowEditModal(false);
      setError("");
    } catch (err) {
      setError("Failed to delete conversation: " + err.message);
    }
  };

  const handleMemberSearch = async (query) => {
    setMemberToAdd(query);
    if (query.length < 2) {
      setMemberSuggestions([]);
      setShowMemberDropdown(false);
      return;
    }

    try {
      const data = await searchUsers(query);
      const existingIds = selectedChat.members?.map((m) => m.user.id) || [];
      const filtered = (data || []).filter((u) => !existingIds.includes(u.id));
      setMemberSuggestions(filtered);
      setShowMemberDropdown(true);
    } catch (err) {
      console.error("Search failed:", err);
    }
  };

  const handleAddMember = async (user) => {
    if (!selectedChat) return;
    
    try {
      await addMemberToChat(selectedChat.id, user.id);
      // Reload chat detail to get updated members
      const chatData = await getChatDetail(selectedChat.id);
      setSelectedChat(chatData);
      setMemberToAdd("");
      setMemberSuggestions([]);
      setShowMemberDropdown(false);
      setShowAddMemberForm(false);
      setError("");
    } catch (err) {
      setError("Failed to add member: " + err.message);
      console.error(err);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!selectedChat) return;
    
    try {
      await removeMemberFromChat(selectedChat.id, userId);
      // Reload chat detail to get updated members
      const chatData = await getChatDetail(selectedChat.id);
      setSelectedChat(chatData);
      setError("");
    } catch (err) {
      setError("Failed to remove member: " + err.message);
      console.error(err);
    }
  };

  const handleReportMessage = (messageId) => {
    setReportingMessageId(messageId);
    setReportReason("");
    setReportDescription("");
    setMessageContextMenu(null);
  };

  const handleSubmitReport = async () => {
    if (!reportingMessageId || !reportReason) {
      setError("Please select a reason");
      return;
    }

    setReportSubmitting(true);
    try {
      await createMessageReport(reportingMessageId, reportReason, reportDescription);
      setError("");
      setReportingMessageId(null);
    } catch (err) {
      if (err.message?.includes("unique")) {
        setError("You've already reported this message");
      } else {
        setError("Failed to report message: " + err.message);
      }
    } finally {
      setReportSubmitting(false);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const getUserDisplayName = (user) => {
    if (!user) return "User";
    const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim();
    return user.display_name || fullName || user.username || "User";
  };

  const getChatDisplayName = (chat) => {
    if (chat.chat_type === "INDIVIDUAL") {
      if (chat.other_participant) {
        return getUserDisplayName(chat.other_participant);
      }

      const otherUser =
        chat.participant_two?.id === currentUser?.id
          ? chat.creator
          : chat.participant_two || chat.creator;

      const fallbackName = getUserDisplayName(otherUser);
      if (fallbackName && fallbackName.trim().toLowerCase() !== "user") {
        return fallbackName;
      }

      return chat.creator_name || chat.name || "User";
    }
    if (chat.chat_type === "GROUP_CLASS") {
      return `${chat.section_name} - ${chat.subject_name}`;
    }
    return chat.name || "Group";
  };

  const getRequestSenderDisplayName = (chatRequest) => {
    if (!chatRequest) return "User";

    const directRequesterName = getUserDisplayName(chatRequest.requester);
    if (directRequesterName && directRequesterName.trim().toLowerCase() !== "user") {
      return directRequesterName;
    }

    const chat = chatRequest.chat;
    if (chat) {
      const otherUser =
        chat.participant_two?.id === currentUser?.id
          ? chat.creator
          : chat.participant_two || chat.creator;
      const fromChat = getUserDisplayName(otherUser);
      if (fromChat && fromChat.trim().toLowerCase() !== "user") {
        return fromChat;
      }
    }

    if (chatRequest.requester?.username) return chatRequest.requester.username;
    if (chatRequest.requester?.id) return `User #${chatRequest.requester.id}`;
    return "User";
  };

  const filteredChats = chats.filter((chat) =>
    getChatDisplayName(chat).toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredGroupChats = filteredChats.filter((chat) => chat.chat_type !== "INDIVIDUAL");
  const filteredDirectChats = filteredChats.filter((chat) => chat.chat_type === "INDIVIDUAL");

  if (loading) {
    return (
      <div className="msg">
        <div style={{ textAlign: "center", padding: "20px" }}>Loading...</div>
      </div>
    );
  }

  return (
    <div className="msg">
      {/* Top bar */}
      <div className="msg__top">
        <h2 hidden className="msg__title">Messages</h2>
        <button
          className="msg__newBtn"
          type="button"
          onClick={() => setShowNewChat(!showNewChat)}
        >
          <span className="msg__icon" aria-hidden="true">➕</span>
          New Chat
        </button>
      </div>

      {/* Chat Request Notification Badge */}
      {pendingRequests.length > 0 && (
        <div style={{
          padding: "12px 20px",
          backgroundColor: "#fff3cd",
          borderBottom: "1px solid #ffc107",
          textAlign: "center",
          fontWeight: "bold",
          cursor: "pointer",
          transition: "all 0.2s"
        }}
        onClick={() => {
          setSelectedChatRequest(pendingRequests[0]);
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#ffe082"}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#fff3cd"}
        >
          📨 {pendingRequests.length} chat request{pendingRequests.length !== 1 ? 's' : ''} - Click to view
        </div>
      )}

      <div className="msg__shell">
        {/* LEFT: chat list */}
        <aside className="msg__listPane">
          <div className="msg__searchBar">
            <span className="msg__searchIcon" aria-hidden="true">🔎</span>
            <input
              className="msg__searchInput"
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {showNewChat && (
            <div style={{position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2100}}>
              <div style={{width: "100%", maxWidth: "460px", background: "#fff", borderRadius: "10px", padding: "16px"}}>
                <h3 style={{marginTop: 0, marginBottom: "12px"}}>Create New Chat</h3>
                <select
                  value={newChatType}
                  onChange={(e) => setNewChatType(e.target.value)}
                  style={{width: "100%", padding: "8px", marginBottom: "10px"}}
                >
                  <option value="individual">Individual DM</option>
                  <option value="class">Class Group</option>
                  <option value="project">Project Group</option>
                </select>

                {newChatType === "individual" && (
                  <div style={{position: "relative", marginBottom: "10px"}}>
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={selectedUserText}
                      onChange={(e) => {
                        handleUserSearch(e.target.value);
                      }}
                      onFocus={() => selectedUserText.length >= 2 && setShowUserDropdown(true)}
                      style={{width: "100%", padding: "8px", marginBottom: "10px"}}
                    />
                    {showUserDropdown && userSuggestions.length > 0 && (
                      <div style={{position: "absolute", top: "100%", left: 0, right: 0, backgroundColor: "white", border: "1px solid #ccc", maxHeight: "150px", overflowY: "auto", zIndex: 1000}}>
                        {userSuggestions.map((user) => (
                          <div
                            key={user.id}
                            onClick={() => handleSelectUser(user)}
                            style={{padding: "8px", borderBottom: "1px solid #eee", cursor: "pointer", backgroundColor: "#f9f9f9"}}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e8e8e8")}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f9f9f9")}
                          >
                            {getUserDisplayName(user)}
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedUserId && (
                      <textarea
                        placeholder="Initial message (optional)..."
                        value={initialMessage}
                        onChange={(e) => setInitialMessage(e.target.value)}
                        style={{width: "100%", padding: "8px", marginTop: "8px", minHeight: "60px", fontFamily: "inherit"}}
                      />
                    )}
                  </div>
                )}

                {newChatType === "class" && (
                  <>
                    <select
                      value={newChatSection}
                      onChange={(e) => setNewChatSection(e.target.value)}
                      style={{width: "100%", padding: "8px", marginBottom: "10px"}}
                    >
                      <option value="">Select section</option>
                      {sections.map((section) => (
                        <option key={section.id} value={section.id}>
                          {section.name} {section.grade_level ? `- ${section.grade_level}` : ""}
                        </option>
                      ))}
                    </select>
                    <select
                      value={newChatSubject}
                      onChange={(e) => setNewChatSubject(e.target.value)}
                      style={{width: "100%", padding: "8px", marginBottom: "10px"}}
                    >
                      <option value="">Select subject</option>
                      {subjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>{subject.name}</option>
                      ))}
                    </select>
                  </>
                )}

                {newChatType === "project" && (
                  <input
                    type="text"
                    placeholder="Group name..."
                    value={newChatName}
                    onChange={(e) => setNewChatName(e.target.value)}
                    style={{width: "100%", padding: "8px", marginBottom: "10px"}}
                  />
                )}

                <div style={{display: "flex", justifyContent: "flex-end", gap: "8px"}}>
                  <button onClick={() => setShowNewChat(false)} style={{padding: "8px 12px", border: "1px solid #ccc", background: "#fff"}}>Cancel</button>
                  <button
                    onClick={handleCreateNewChat}
                    style={{padding: "8px 12px", backgroundColor: "#24148a", color: "white", border: "none", cursor: "pointer"}}
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="msg__scroll">
            {filteredChats.length === 0 ? (
              <div style={{padding: "20px", textAlign: "center", color: "#999"}}>No chats yet</div>
            ) : (
              <>
                {filteredGroupChats.length > 0 && (
                  <div style={{padding: "10px 12px 6px", fontSize: "11px", fontWeight: "700", color: "#666", textTransform: "uppercase", letterSpacing: "0.06em"}}>
                    Group Chats
                  </div>
                )}
                {filteredGroupChats.map((chat) => (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => handleSelectChat(chat)}
                    className={"msgItem " + (selectedChat?.id === chat.id ? "msgItem--active" : "")}
                  >
                    <div className="msgItem__avatar msgItem__avatar--user" aria-hidden="true">
                      {getChatDisplayName(chat).charAt(0)}
                    </div>

                    <div className="msgItem__main">
                      <div className="msgItem__row">
                        <div className="msgItem__name" title={getChatDisplayName(chat)}>
                          {getChatDisplayName(chat)}
                        </div>
                        {chat.last_message && (
                          <div className="msgItem__time">{formatTime(chat.last_message.created_at)}</div>
                        )}
                      </div>
                      {chat.last_message && (
                        <div className="msgItem__preview" title={chat.last_message.preview}>
                          {chat.last_message.preview}
                        </div>
                      )}
                    </div>
                  </button>
                ))}

                {filteredDirectChats.length > 0 && (
                  <div style={{padding: "12px 12px 6px", fontSize: "11px", fontWeight: "700", color: "#666", textTransform: "uppercase", letterSpacing: "0.06em"}}>
                    Direct Messages
                  </div>
                )}
                {filteredDirectChats.map((chat) => (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => handleSelectChat(chat)}
                    className={"msgItem " + (selectedChat?.id === chat.id ? "msgItem--active" : "")}
                  >
                    <div className="msgItem__avatar msgItem__avatar--user" aria-hidden="true">
                      {getChatDisplayName(chat).charAt(0)}
                    </div>

                    <div className="msgItem__main">
                      <div className="msgItem__row">
                        <div className="msgItem__name" title={getChatDisplayName(chat)}>
                          {getChatDisplayName(chat)}
                        </div>
                        {chat.last_message && (
                          <div className="msgItem__time">{formatTime(chat.last_message.created_at)}</div>
                        )}
                      </div>
                      {chat.last_message && (
                        <div className="msgItem__preview" title={chat.last_message.preview}>
                          {chat.last_message.preview}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </aside>

        {/* RIGHT: chat window */}
        <section className="msg__chatPane">
          {selectedChat ? (
            <>
              {/* chat header */}
              <div className="chatHead">
                <div className="chatHead__left">
                  <div className="chatHead__avatar chatHead__avatar--user" aria-hidden="true">
                    {getChatDisplayName(selectedChat).charAt(0)}
                  </div>

                  <div className="chatHead__meta">
                    <div style={{display: "flex", alignItems: "center", gap: "10px"}}>
                      <div className="chatHead__name">{getChatDisplayName(selectedChat)}</div>
                      {selectedChat.chat_type !== "INDIVIDUAL" && selectedChat.creator?.id === currentUser?.id && (
                        <button
                          onClick={() => {
                            setShowGroupActionsModal(true);
                            setGroupActionView("menu");
                          }}
                          style={{background: "none", border: "none", cursor: "pointer", fontSize: "14px"}}
                        >
                          ⋯
                        </button>
                      )}
                    </div>
                    <div className="chatHead__status">🔐 Encrypted</div>
                    {selectedChat.chat_type !== "INDIVIDUAL" && selectedChat.members && (
                      <div style={{fontSize: "12px", color: "#666", marginTop: "5px"}}>
                        {selectedChat.members.length} member{selectedChat.members.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
                
                {selectedChat.chat_type !== "INDIVIDUAL" && <div />}
              </div>

              {/* Add member form */}
              {showAddMemberForm && false && selectedChat.chat_type !== "INDIVIDUAL" && selectedChat.creator?.id === currentUser?.id && (
                <div style={{padding: "10px", borderBottom: "1px solid #eee", backgroundColor: "#f9f9f9"}}>
                  <div style={{position: "relative", marginBottom: "5px"}}>
                    <input
                      type="text"
                      placeholder="Search and add member..."
                      value={memberToAdd}
                      onChange={(e) => handleMemberSearch(e.target.value)}
                      style={{width: "100%", padding: "5px", borderRadius: "4px", border: "1px solid #ccc"}}
                    />
                    {showMemberDropdown && memberSuggestions.length > 0 && (
                      <div style={{position: "absolute", top: "100%", left: 0, right: 0, backgroundColor: "white", border: "1px solid #ccc", maxHeight: "150px", overflowY: "auto", zIndex: 1000}}>
                        {memberSuggestions.map((user) => (
                          <div
                            key={user.id}
                            onClick={() => handleAddMember(user)}
                            style={{padding: "8px", borderBottom: "1px solid #eee", cursor: "pointer", backgroundColor: "#f9f9f9", display: "flex", justifyContent: "space-between", alignItems: "center"}}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#e8e8e8"}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#f9f9f9"}
                          >
                            <span>{getUserDisplayName(user)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedChat.members && selectedChat.members.length > 0 && (
                    <div style={{marginTop: "10px"}}>
                      <div style={{fontSize: "12px", fontWeight: "bold", marginBottom: "5px"}}>Current members:</div>
                      <div style={{display: "flex", flexWrap: "wrap", gap: "5px"}}>
                        {selectedChat.members.map((member) => (
                          <div key={member.id} style={{display: "flex", alignItems: "center", gap: "5px", backgroundColor: "#24148a", color: "white", padding: "5px 10px", borderRadius: "4px", fontSize: "12px"}}>
                            {getUserDisplayName(member.user)} {member.is_admin && "(admin)"}
                            {selectedChat.creator?.id === currentUser?.id && member.user.id !== currentUser?.id && (
                              <button onClick={() => handleRemoveMember(member.user.id)} style={{background: "none", border: "none", color: "white", cursor: "pointer", fontSize: "12px"}}>✕</button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* chat body */}
              <div className="chatBody" ref={scrollRef}>
                {messages.length === 0 ? (
                  <div style={{textAlign: "center", padding: "40px", color: "#999"}}>
                    Start the conversation!
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={
                        msg.sender.id === currentUser?.id
                          ? "bubbleWrap bubbleWrap--right"
                          : "bubbleWrap bubbleWrap--left"
                      }
                      style={{position: "relative"}}
                    >
                      {msg.sender.id !== currentUser?.id && (
                        <div className="bubbleMeta">{getUserDisplayName(msg.sender)}</div>
                      )}
                      <div style={{display: "flex", alignItems: "flex-start", gap: "5px"}}>
                        <div
                          className={
                            msg.sender.id === currentUser?.id
                              ? "bubble bubble--sent"
                              : "bubble bubble--recv"
                          }
                        >
                          {msg.content}
                        </div>
                        <div style={{position: "relative"}}>
                          <button
                            onClick={() => setMessageContextMenu(messageContextMenu === msg.id ? null : msg.id)}
                            style={{background: "none", border: "none", cursor: "pointer", fontSize: "16px", padding: "0", marginTop: "2px"}}
                            title="More options"
                          >
                            ⋯
                          </button>
                          {messageContextMenu === msg.id && (
                            <div style={{position: "absolute", top: "20px", right: 0, backgroundColor: "white", border: "1px solid #ccc", borderRadius: "4px", minWidth: "130px", zIndex: 1000, boxShadow: "0 2px 8px rgba(0,0,0,0.15)"}}>
                              <button
                                onClick={() => {
                                  handleReportMessage(msg.id);
                                }}
                                style={{width: "100%", padding: "8px 12px", border: "none", backgroundColor: "transparent", cursor: "pointer", textAlign: "left", fontSize: "14px", borderRadius: "4px"}}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f0f0f0"}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                              >
                                🚩 Report
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div
                        className={
                          msg.sender.id === currentUser?.id
                            ? "bubbleTime bubbleTime--right"
                            : "bubbleTime"
                        }
                      >
                        {formatTime(msg.created_at)}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* input */}
              <div className="chatInput">
                <input
                  className="chatInput__field"
                  type="text"
                  placeholder="Type a message..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage(e)}
                />
                <button
                  className="chatInput__send"
                  type="button"
                  aria-label="Send"
                  onClick={handleSendMessage}
                  disabled={isSending}
                >
                  ✈️
                </button>
              </div>

              {showEditModal && selectedChat?.chat_type !== "INDIVIDUAL" && (
                <div style={{position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2100}}>
                  <div style={{width: "100%", maxWidth: "420px", background: "#fff", borderRadius: "10px", padding: "16px"}}>
                    <h3 style={{marginTop: 0}}>Edit Group Chat Name</h3>
                    <input
                      type="text"
                      value={newChatNameValue}
                      onChange={(e) => setNewChatNameValue(e.target.value)}
                      style={{width: "100%", padding: "8px", marginBottom: "12px"}}
                    />
                    <div style={{display: "flex", justifyContent: "flex-end", gap: "8px"}}>
                      <button onClick={() => { setShowEditModal(false); setEditingChatName(false); }} style={{padding: "8px 12px", border: "1px solid #ccc", background: "#fff"}}>Cancel</button>
                      <button onClick={handleEditChatName} style={{padding: "8px 12px", backgroundColor: "#24148a", color: "white", border: "none"}}>Save</button>
                    </div>
                  </div>
                </div>
              )}

              {showGroupActionsModal && selectedChat?.chat_type !== "INDIVIDUAL" && selectedChat.creator?.id === currentUser?.id && (
                <div style={{position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2200}}>
                  <div style={{width: "100%", maxWidth: "460px", background: "#fff", borderRadius: "10px", padding: "16px"}}>
                    {groupActionView === "menu" && (
                      <>
                        <h3 style={{marginTop: 0}}>Group Chat Actions</h3>
                        <div style={{display: "grid", gap: "8px"}}>
                          <button
                            onClick={() => {
                              setEditingChatName(true);
                              setNewChatNameValue(selectedChat.name || "");
                              setShowEditModal(true);
                              setShowGroupActionsModal(false);
                            }}
                            style={{padding: "10px", border: "1px solid #ddd", background: "#fff", textAlign: "left"}}
                          >
                            Edit Group Name
                          </button>
                          <button
                            onClick={() => setGroupActionView("members")}
                            style={{padding: "10px", border: "1px solid #ddd", background: "#fff", textAlign: "left"}}
                          >
                            Add/Remove Members
                          </button>
                          <button
                            onClick={handleDeleteConversation}
                            style={{padding: "10px", border: "1px solid #e3b0b0", color: "#8a1414", background: "#fff", textAlign: "left"}}
                          >
                            Delete Conversation
                          </button>
                        </div>
                        <div style={{display: "flex", justifyContent: "flex-end", marginTop: "12px"}}>
                          <button onClick={() => setShowGroupActionsModal(false)} style={{padding: "8px 12px", border: "1px solid #ccc", background: "#fff"}}>Close</button>
                        </div>
                      </>
                    )}

                    {groupActionView === "members" && (
                      <>
                        <h3 style={{marginTop: 0}}>Manage Members</h3>
                        <div style={{position: "relative", marginBottom: "8px"}}>
                          <input
                            type="text"
                            placeholder="Search and add member..."
                            value={memberToAdd}
                            onChange={(e) => handleMemberSearch(e.target.value)}
                            style={{width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc"}}
                          />
                          {showMemberDropdown && memberSuggestions.length > 0 && (
                            <div style={{position: "absolute", top: "100%", left: 0, right: 0, backgroundColor: "white", border: "1px solid #ccc", maxHeight: "150px", overflowY: "auto", zIndex: 1000}}>
                              {memberSuggestions.map((user) => (
                                <div
                                  key={user.id}
                                  onClick={() => handleAddMember(user)}
                                  style={{padding: "8px", borderBottom: "1px solid #eee", cursor: "pointer", backgroundColor: "#f9f9f9"}}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e8e8e8")}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f9f9f9")}
                                >
                                  {getUserDisplayName(user)}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {selectedChat.members && selectedChat.members.length > 0 && (
                          <div style={{marginTop: "10px", maxHeight: "180px", overflowY: "auto"}}>
                            <div style={{fontSize: "12px", fontWeight: "bold", marginBottom: "6px"}}>Current members:</div>
                            <div style={{display: "flex", flexWrap: "wrap", gap: "6px"}}>
                              {selectedChat.members.map((member) => (
                                <div key={member.id} style={{display: "flex", alignItems: "center", gap: "5px", backgroundColor: "#24148a", color: "white", padding: "5px 10px", borderRadius: "4px", fontSize: "12px"}}>
                                  {getUserDisplayName(member.user)} {member.is_admin && "(admin)"}
                                  {member.user.id !== currentUser?.id && (
                                    <button onClick={() => handleRemoveMember(member.user.id)} style={{background: "none", border: "none", color: "white", cursor: "pointer", fontSize: "12px"}}>✕</button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div style={{display: "flex", justifyContent: "space-between", marginTop: "12px"}}>
                          <button onClick={() => setGroupActionView("menu")} style={{padding: "8px 12px", border: "1px solid #ccc", background: "#fff"}}>Back</button>
                          <button onClick={() => setShowGroupActionsModal(false)} style={{padding: "8px 12px", border: "1px solid #ccc", background: "#fff"}}>Close</button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
              
              {/* Report message modal */}
              {reportingMessageId && (
                <div style={{position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000}}>
                  <div style={{backgroundColor: "white", borderRadius: "8px", padding: "20px", maxWidth: "400px", width: "90%", boxShadow: "0 4px 16px rgba(0,0,0,0.2)"}}>
                    <h3 style={{marginTop: 0}}>Report Message</h3>
                    <div style={{marginBottom: "15px"}}>
                      <label style={{display: "block", marginBottom: "8px", fontWeight: "bold"}}>Reason for report:</label>
                      <select
                        value={reportReason}
                        onChange={(e) => setReportReason(e.target.value)}
                        style={{width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px"}}
                      >
                        <option value="">Select a reason...</option>
                        <option value="INAPPROPRIATE">Inappropriate Content</option>
                        <option value="HARASSMENT">Harassment/Bullying</option>
                        <option value="SPAM">Spam</option>
                        <option value="PROFANITY">Profanity</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                    <div style={{marginBottom: "15px"}}>
                      <label style={{display: "block", marginBottom: "8px", fontWeight: "bold"}}>Additional details (optional):</label>
                      <textarea
                        value={reportDescription}
                        onChange={(e) => setReportDescription(e.target.value)}
                        style={{width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px", minHeight: "80px", fontFamily: "Arial, sans-serif"}}
                        placeholder="Provide more context about why you're reporting this message..."
                      />
                    </div>
                    {error && <div style={{color: "red", marginBottom: "10px", fontSize: "14px"}}>{error}</div>}
                    <div style={{display: "flex", gap: "10px", justifyContent: "flex-end"}}>
                      <button
                        onClick={() => setReportingMessageId(null)}
                        style={{padding: "8px 16px", border: "1px solid #ccc", backgroundColor: "white", borderRadius: "4px", cursor: "pointer"}}
                        disabled={reportSubmitting}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSubmitReport}
                        style={{padding: "8px 16px", backgroundColor: "#24148a", color: "white", border: "none", borderRadius: "4px", cursor: "pointer"}}
                        disabled={reportSubmitting || !reportReason}
                      >
                        {reportSubmitting ? "Submitting..." : "Submit Report"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#999"}}>
              Select a chat to start messaging
            </div>
          )}
        </section>
      </div>

      {/* Chat Request Modal - MOVED OUTSIDE msg__shell to avoid clipping */}
      {selectedChatRequest && (
        <>
          <div style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.75)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }} onClick={() => {
            setSelectedChatRequest(null);
          }}>
            {/* Modal Content */}
          </div>
          <div style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 10000,
            pointerEvents: "none",
          }}>
            <div style={{
              width: "100%",
              maxWidth: "500px",
              background: "#fff",
              borderRadius: "10px",
              padding: "20px",
              maxHeight: "80vh",
              overflowY: "auto",
              boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
              pointerEvents: "auto",
            }}>
              <div style={{ marginBottom: "15px" }}>
                <h3 style={{ marginTop: 0 }}>Chat Request</h3>
                <p style={{ fontSize: "16px", marginBottom: "0" }}>
                  <strong>{getRequestSenderDisplayName(selectedChatRequest)}</strong> wants to start a conversation with you
                </p>
                <p style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
                  {selectedChatRequest?.created_at ? new Date(selectedChatRequest.created_at).toLocaleString() : ""}
                </p>
              </div>

              <div style={{
                backgroundColor: "#f9f9f9",
                padding: "15px",
                borderRadius: "6px",
                marginBottom: "15px",
                border: "1px solid #eee",
              }}>
                <p style={{ marginTop: 0, marginBottom: "8px", fontSize: "12px", color: "#666", fontWeight: "bold" }}>Initial Message:</p>
                <p style={{
                  margin: 0,
                  fontSize: "14px",
                  lineHeight: "1.5",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  maxHeight: expandedRequestMessage ? "none" : "80px",
                  overflow: expandedRequestMessage ? "visible" : "hidden",
                  textOverflow: expandedRequestMessage ? "clip" : "ellipsis",
                }}>
                  {selectedChatRequest?.first_message || ""}
                </p>
                {selectedChatRequest?.first_message && selectedChatRequest.first_message.length > 150 && (
                  <button
                    onClick={() => setExpandedRequestMessage(!expandedRequestMessage)}
                    style={{
                      marginTop: "8px",
                      padding: "4px 8px",
                      fontSize: "12px",
                      backgroundColor: "transparent",
                      color: "#0056b3",
                      border: "none",
                      cursor: "pointer",
                      fontWeight: "500",
                    }}
                  >
                    {expandedRequestMessage ? "Show less" : "Show more"}
                  </button>
                )}
              </div>

              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
                marginBottom: "10px",
              }}>
                <button
                  onClick={() => {
                    handleRespondToRequest(selectedChatRequest.id, 'accept');
                    setSelectedChatRequest(null);
                    setExpandedRequestMessage(false);
                  }}
                  disabled={respondingToRequest === selectedChatRequest.id}
                  style={{
                    padding: "10px",
                    backgroundColor: "#28a745",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: "bold",
                    fontSize: "14px",
                  }}
                >
                  ✓ Accept
                </button>
                <button
                  onClick={() => {
                    handleRespondToRequest(selectedChatRequest.id, 'decline');
                    setSelectedChatRequest(null);
                    setExpandedRequestMessage(false);
                  }}
                  disabled={respondingToRequest === selectedChatRequest.id}
                  style={{
                    padding: "10px",
                    backgroundColor: "#dc3545",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: "bold",
                    fontSize: "14px",
                  }}
                >
                  ✕ Decline
                </button>
              </div>

              {pendingRequests.length > 1 && (
                <div style={{
                  display: "flex",
                  gap: "8px",
                  marginBottom: "10px",
                  justifyContent: "center",
                }}>
                  {pendingRequests.map((req) => (
                    <button
                      key={req.id}
                      onClick={() => {
                        setSelectedChatRequest(req);
                        setExpandedRequestMessage(false);
                      }}
                      style={{
                        padding: "6px 12px",
                        fontSize: "12px",
                        backgroundColor: selectedChatRequest.id === req.id ? "#24148a" : "#e9ecef",
                        color: selectedChatRequest.id === req.id ? "white" : "#333",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontWeight: selectedChatRequest.id === req.id ? "bold" : "normal",
                      }}
                    >
                      {getRequestSenderDisplayName(req)}
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={() => {
                  setSelectedChatRequest(null);
                  setExpandedRequestMessage(false);
                }}
                style={{
                  width: "100%",
                  padding: "10px",
                  backgroundColor: "#f0f0f0",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}

      {/* Report message modal */}
      {reportingMessageId && (
        <div style={{position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000}}>
          <div style={{backgroundColor: "white", borderRadius: "8px", padding: "20px", maxWidth: "400px", width: "90%", boxShadow: "0 4px 16px rgba(0,0,0,0.2)"}}>
            <h3 style={{marginTop: 0}}>Report Message</h3>
            <div style={{marginBottom: "15px"}}>
              <label style={{display: "block", marginBottom: "8px", fontWeight: "bold"}}>Reason for report:</label>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                style={{width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px"}}
              >
                <option value="">Select a reason...</option>
                <option value="INAPPROPRIATE">Inappropriate Content</option>
                <option value="HARASSMENT">Harassment/Bullying</option>
                <option value="SPAM">Spam</option>
                <option value="PROFANITY">Profanity</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div style={{marginBottom: "15px"}}>
              <label style={{display: "block", marginBottom: "8px", fontWeight: "bold"}}>Additional details (optional):</label>
              <textarea
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                style={{width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px", minHeight: "80px", fontFamily: "Arial, sans-serif"}}
                placeholder="Provide more context about why you're reporting this message..."
              />
            </div>
            {error && <div style={{color: "red", marginBottom: "10px", fontSize: "14px"}}>{error}</div>}
            <div style={{display: "flex", gap: "10px", justifyContent: "flex-end"}}>
              <button
                onClick={() => setReportingMessageId(null)}
                style={{padding: "8px 16px", border: "1px solid #ccc", backgroundColor: "white", borderRadius: "4px", cursor: "pointer"}}
                disabled={reportSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReport}
                style={{padding: "8px 16px", backgroundColor: "#24148a", color: "white", border: "none", borderRadius: "4px", cursor: "pointer"}}
                disabled={reportSubmitting || !reportReason}
              >
                {reportSubmitting ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentMessage;
