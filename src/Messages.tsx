import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db, signOutUser } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  addDoc,
  serverTimestamp,
  limit,
  onSnapshot,
  getDocs,
} from "firebase/firestore";
import {
  LayoutDashboard,
  Folder,
  FileEdit,
  Zap,
  BarChart3,
  MessageCircle,
  User,
  Settings,
  ShieldAlert,
  Send,
  Sidebar as SidebarIcon,
  Loader2,
} from "lucide-react";
import { io, Socket } from "socket.io-client";

// Environment-aware URL
const SOCKET_SERVER_URL =
  import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";
const MAX_MESSAGES = 20;

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderInitials: string;
  time: string;
  content: string;
  role?: string;
  groupId: string;
  createdAt?: any;
}

interface GroupMember {
  id: string;
  name: string;
  initials: string;
  role: string;
}

const Messages: React.FC = () => {
  const navigate = useNavigate();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  const [userName, setUserName] = useState(
    localStorage.getItem("chat_user_name") || "",
  );
  const [userUid, setUserUid] = useState(
    localStorage.getItem("chat_user_uid") || "",
  );
  const [userRole, setUserRole] = useState(
    localStorage.getItem("chat_user_role") || "Student",
  );
  const [groupId, setGroupId] = useState<string>(
    localStorage.getItem("chat_group_id") || "",
  );

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // AUTH CHECK
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUserUid(u.uid);
        localStorage.setItem("chat_user_uid", u.uid);
        const userDoc = await getDoc(doc(db, "users", u.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          const name = `${data.firstName} ${data.lastName}`;
          setUserName(name);
          setUserRole(data.role || "Student");
          localStorage.setItem("chat_user_name", name);
          localStorage.setItem("chat_user_role", data.role || "Student");
          if (data.section) initializeChat(u.uid, data.section);
        }
      } else {
        localStorage.clear();
        navigate("/");
      }
    });
    return () => unsub();
  }, [navigate]);

  const initializeChat = async (uid: string, section: string) => {
    try {
      const q = query(
        collection(db, "groups"),
        where("section", "==", section),
      );
      const snap = await getDocs(q);
      let gid = "";
      let members: string[] = [];
      let leader = "";

      snap.forEach((d) => {
        const data = d.data();
        if (
          data.leaderId === uid ||
          (data.memberIds && data.memberIds.includes(uid))
        ) {
          gid = d.id;
          members = data.memberIds || [];
          leader = data.leaderId;
        }
      });

      if (gid) {
        setGroupId(gid);
        localStorage.setItem("chat_group_id", gid);
        const allIds = Array.from(
          new Set([leader, ...members].filter(Boolean)),
        );
        const snaps = await Promise.all(
          allIds.map((id) => getDoc(doc(db, "users", id))),
        );
        setGroupMembers(
          snaps.map((s) => {
            const d = s.data();
            return {
              id: s.id,
              name: `${d?.firstName} ${d?.lastName}`,
              initials: `${d?.firstName?.[0]}${d?.lastName?.[0]}`.toUpperCase(),
              role: s.id === leader ? "Leader" : "Member",
            };
          }),
        );
      }
    } catch (e) {
      console.error("Initialization Error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // SOCKET & FIRESTORE REAL-TIME SYNC
  useEffect(() => {
    if (!groupId) return;

    // 1. Firestore Listener
    const q = query(
      collection(db, "messages"),
      where("groupId", "==", groupId),
      limit(50),
    );
    const unsubscribeFirestore = onSnapshot(q, (snapshot) => {
      const rawMessages = snapshot.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Message,
      );
      const sorted = rawMessages.sort(
        (a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0),
      );
      const formatted = sorted.map((msg) => {
        let t = "Recent";
        if (msg.createdAt?.toDate) {
          t = msg.createdAt
            .toDate()
            .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        }
        return { ...msg, time: t };
      });
      setMessages(formatted.slice(-MAX_MESSAGES));
      setIsLoading(false);
    });

    // 2. Socket Initialization
    console.log("🔌 Attempting to connect to Socket:", SOCKET_SERVER_URL);
    socketRef.current = io(SOCKET_SERVER_URL, {
      auth: { token: userUid || "refresh" },
      transports: ["websocket"], // Forces WebSocket to avoid CORS polling issues seen in your console
    });

    socketRef.current.on("connect", () => {
      console.log("✅ Socket Connected! ID:", socketRef.current?.id);
      socketRef.current?.emit("join_group", groupId);
    });

    socketRef.current.on("connect_error", (err) => {
      console.error("❌ Socket Connection Error:", err.message);
    });

    socketRef.current.on("disconnect", (reason) => {
      console.warn("⚠️ Socket Disconnected:", reason);
    });

    socketRef.current.on("receive_message", (data) => {
      console.log("📨 New message received!", data);
      // Optional: You can let Firestore handle the update,
      // or manually push to the messages state if you aren't using onSnapshot.
    });
    return () => {
      unsubscribeFirestore();
      console.log("🔌 Disconnecting socket connection...");
      socketRef.current?.disconnect();
    };
  }, [groupId, userUid]);

  // Auto-scroll
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("1. Send button triggered");

    if (!newMessage.trim() || !groupId) return;

    const content = newMessage;
    const initials = userName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    // Optimistic UI: Add to local state immediately
    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      senderId: userUid,
      senderName: userName,
      senderInitials: initials,
      content,
      role: userRole,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      groupId,
    };

    setMessages((prev) => [...prev, optimistic].slice(-MAX_MESSAGES));
    setNewMessage(""); // Clear input immediately

    try {
      // Step A: Send via Socket IMMEDIATELY (Don't wait for Firestore)
      if (socketRef.current?.connected) {
        console.log("2. Emitting message to socket...");
        socketRef.current.emit("send_message", optimistic);
      } else {
        console.error(
          "❌ Socket not connected. Message might not be delivered real-time.",
        );
        socketRef.current?.connect(); // Try to reconnect
      }

      // Step B: Save to Firestore for permanent history
      console.log("3. Saving to Firestore...");
      await addDoc(collection(db, "messages"), {
        groupId,
        senderId: userUid,
        senderName: userName,
        senderInitials: initials,
        content,
        role: userRole,
        createdAt: serverTimestamp(),
      });
      console.log("4. Firebase save complete.");
    } catch (e) {
      console.error("❌ Send Message Error:", e);
    }
  };

  const handleLogout = async () => {
    await signOutUser();
    localStorage.clear();
    navigate("/");
  };

  return (
    <div className="flex h-screen bg-gray-50/50 overflow-hidden text-[#122244]">
      {/* SIDEBAR */}
      <aside
        className={`flex w-64 bg-[#122244] text-white flex-col fixed inset-y-0 shadow-xl z-20 transition-transform duration-300 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="p-6 border-b border-white/10">
          <img
            src="/dashboard logo.png"
            alt="FeasiFy"
            className="w-70 h-20 object-contain"
          />
        </div>
        <nav className="flex-1 p-4 space-y-8 mt-4 text-gray-300 overflow-y-auto">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-4 px-2 text-gray-400">
              Main Menu
            </p>
            <div className="space-y-1">
              <button
                onClick={() => navigate("/dashboard")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:text-white hover:bg-white/5 transition-all"
              >
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </button>
              <button
                onClick={() => navigate("/projects")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:text-white hover:bg-white/5 transition-all"
              >
                <Folder className="w-4 h-4" /> Business Proposal
              </button>
              <button
                onClick={() => navigate("/financial-input")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:text-white hover:bg-white/5 transition-all"
              >
                <FileEdit className="w-4 h-4" /> Financial Input
              </button>
              <button
                onClick={() => navigate("/ai-analysis")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:text-white hover:bg-white/5 transition-all"
              >
                <Zap className="w-4 h-4" /> AI Feasibility Analysis
              </button>
              <button
                onClick={() => navigate("/reports")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:text-white hover:bg-white/5 transition-all"
              >
                <BarChart3 className="w-4 h-4" /> Reports
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold bg-[#c9a654] text-white transition-all shadow-md">
                <MessageCircle className="w-4 h-4" /> Message
              </button>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-4 px-2 text-gray-400">
              Account
            </p>
            <div className="space-y-1">
              <button
                onClick={() => navigate("/profile")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:text-white hover:bg-white/5 transition-all"
              >
                <User className="w-4 h-4" /> Profile
              </button>
              <button
                onClick={() => navigate("/settings")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:text-white hover:bg-white/5 transition-all"
              >
                <Settings className="w-4 h-4" /> Settings
              </button>
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:text-white hover:bg-white/5 transition-all"
              >
                <ShieldAlert className="w-4 h-4" /> Logout
              </button>
            </div>
          </div>
        </nav>
        <div className="p-4 border-t border-white/10 bg-black/20 flex items-center gap-3 text-white">
          <div className="w-10 h-10 rounded-full bg-[#c9a654] flex items-center justify-center font-bold text-sm">
            {(userName || "U").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">
              {userName || "User"}
            </p>
            <p className="text-[10px] text-gray-400 truncate">Student</p>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main
        className={`flex-1 flex flex-col transition-all duration-300 ease-in-out h-screen ${isSidebarOpen ? "lg:ml-64" : "ml-0"}`}
      >
        <div className="bg-white border-b border-gray-100 p-4 flex items-center gap-2 text-sm text-gray-500 flex-shrink-0">
          <SidebarIcon
            className="w-4 h-4 cursor-pointer hover:text-gray-800 transition-colors"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          />
          <span className="mx-2">|</span> FeasiFy <span>›</span>{" "}
          <span className="font-semibold text-gray-900">Messages</span>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col bg-white min-w-0 h-full">
            <div className="p-6 border-b border-gray-100 bg-gray-50/30 flex-shrink-0">
              <h1 className="text-2xl font-extrabold text-[#122244]">
                Team Group Chat
              </h1>
              <p className="text-xs text-gray-500 font-medium italic underline decoration-[#c9a654]">
                Permanent History Secured
              </p>
            </div>

            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/30 scroll-smooth"
            >
              {isLoading && messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center">
                  <Loader2 className="w-8 h-8 text-[#c9a654] animate-spin mb-2" />
                  <p className="text-xs font-bold uppercase tracking-widest text-[#122244]">
                    Syncing...
                  </p>
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-40 text-[#122244]">
                  <MessageCircle size={48} />
                  <p className="text-sm italic font-medium mt-2">
                    No messages yet.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.senderId === userUid;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`flex gap-3 max-w-[75%] ${isMe ? "flex-row-reverse" : "flex-row"}`}
                      >
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-sm flex-shrink-0 ${isMe ? "bg-[#c9a654]" : "bg-[#122244]"}`}
                        >
                          {msg.senderInitials}
                        </div>
                        <div
                          className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[11px] font-extrabold text-[#122244]">
                              {msg.senderName}
                            </span>
                            {msg.role === "Leader" && (
                              <span className="text-[8px] bg-yellow-100 text-yellow-700 px-1.5 rounded font-bold uppercase tracking-widest">
                                Leader
                              </span>
                            )}
                          </div>
                          <div
                            className={`p-4 rounded-2xl shadow-sm text-sm leading-relaxed ${isMe ? "bg-[#122244] text-white rounded-tr-none" : "bg-white text-gray-800 border border-gray-100 rounded-tl-none"}`}
                          >
                            {msg.content}
                          </div>
                          <span className="text-[9px] text-gray-400 font-bold mt-1 uppercase tracking-tighter">
                            {msg.time}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 bg-white border-t border-gray-100 flex-shrink-0">
              <form
                onSubmit={handleSendMessage}
                className="flex gap-3 max-w-5xl mx-auto"
              >
                <input
                  type="text"
                  placeholder="Type your message..."
                  className="flex-1 px-5 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a654]/50 focus:bg-white transition-all font-medium text-[#122244]"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || !groupId}
                  className="bg-[#122244] hover:bg-[#1a3263] text-white p-3.5 rounded-xl shadow-md transition-all disabled:opacity-50"
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          </div>

          <div className="w-80 bg-white border-l border-gray-100 hidden xl:flex flex-col p-4 space-y-4 overflow-y-auto flex-shrink-0">
            <h3 className="font-extrabold text-[#122244] tracking-tight text-lg px-2">
              Group Roster
            </h3>
            {groupMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm ${member.role === "Leader" ? "bg-purple-600" : "bg-green-600"}`}
                >
                  {member.initials}
                </div>
                <div className="flex-1 min-w-0 text-[#122244]">
                  <p className="text-sm font-bold truncate">{member.name}</p>
                  <span
                    className={`text-[9px] font-extrabold uppercase tracking-widest ${member.role === "Leader" ? "text-purple-600" : "text-blue-600"}`}
                  >
                    {member.role}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* LOGOUT CONFIRMATION */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowLogoutConfirm(false)}
          />
          <div className="bg-white rounded-2xl p-6 z-10 w-11/12 max-w-sm shadow-xl text-center relative text-[#122244]">
            <h3 className="text-lg font-bold mb-2">Sign Out?</h3>
            <p className="text-sm text-gray-600 mb-6 italic">
              Are you sure you want to log out?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                className="flex-1 px-5 py-2.5 rounded-lg border border-gray-200 text-sm font-bold hover:bg-gray-50"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Stay
              </button>
              <button
                type="button"
                className="flex-1 px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-md transition-colors"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Messages;
