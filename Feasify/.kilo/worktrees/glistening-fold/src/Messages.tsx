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
  getDocs, 
  addDoc, 
  serverTimestamp, 
  onSnapshot, 
  orderBy 
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
  Users,
  X,
  Bell
} from "lucide-react";

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderInitials: string;
  time: string;
  content: string;
  role?: string;
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
  
  const [userName, setUserName] = useState("");
  const [userUid, setUserUid] = useState("");
  const [userRole, setUserRole] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const [groupId, setGroupId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [newMessage, setNewMessage] = useState("");

  // 1. Initial User & Group Load
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUserUid(u.uid);
        const userDoc = await getDoc(doc(db, "users", u.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserName(`${data.firstName} ${data.lastName}`);
          setUserRole(data.role || "Student");
          if (data.section) fetchUserGroup(u.uid, data.section);
        }
      } else {
        navigate("/");
      }
    });
    return () => unsub();
  }, [navigate]);

  // Fetch unread notifications count
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const q = query(collection(db, "notifications"), where("userId", "==", u.uid), where("isRead", "==", false));
          const snap = await getDocs(q);
          setUnreadNotificationCount(snap.size);
        } catch (error) {
          console.error("Error fetching unread notifications:", error);
        }
      }
    });
    return () => unsub();
  }, []);

  const fetchUserGroup = async (uid: string, section: string) => {
    try {
      const q = query(collection(db, "groups"), where("section", "==", section));
      const snap = await getDocs(q);
      let foundGroupId = "";
      let memberIds: string[] = [];
      let leaderId = "";

      snap.forEach((d) => {
        const data = d.data();
        const groupMemberIds = Array.isArray(data.memberIds) ? data.memberIds : [];
        if (data.leaderId === uid || groupMemberIds.includes(uid)) {
          foundGroupId = d.id;
          setGroupId(d.id);
          memberIds = groupMemberIds;
          leaderId = data.leaderId;
        }
      });

      if (!foundGroupId) {
        const leaderQuery = query(collection(db, "groups"), where("leaderId", "==", uid));
        const memberQuery = query(collection(db, "groups"), where("memberIds", "array-contains", uid));
        const [leaderSnap, memberSnap] = await Promise.all([getDocs(leaderQuery), getDocs(memberQuery)]);
        const fallback = leaderSnap.docs.concat(memberSnap.docs)[0];
        if (fallback) {
          const data = fallback.data();
          foundGroupId = fallback.id;
          setGroupId(fallback.id);
          memberIds = Array.isArray(data.memberIds) ? data.memberIds : [];
          leaderId = data.leaderId || uid;
        }
      }

      if (foundGroupId) {
        const allMemberIds = Array.from(new Set([leaderId, ...memberIds].filter(Boolean)));
        const memberPromises = allMemberIds.map(id => getDoc(doc(db, "users", id)));
        const memberSnaps = await Promise.all(memberPromises);
        
        const roster = memberSnaps.map(s => {
          const d = s.data();
          const fullName = `${d?.firstName || ""} ${d?.lastName || ""}`.trim();
          return {
            id: s.id,
            name: fullName || "User",
            initials: fullName ? fullName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "U",
            role: s.id === leaderId ? "Leader" : "Member"
          };
        });
        setGroupMembers(roster);
      }
    } catch (e) {
      console.error("Error loading roster:", e);
    }
  };

  // 2. REAL-TIME LISTENER (FIXED)
  useEffect(() => {
    if (!groupId) return;

    // Use includeMetadataChanges: true to catch local sends before server confirms
    const msgQuery = query(
      collection(db, "messages"),
      where("groupId", "==", groupId),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(msgQuery, (snapshot) => {
      const msgs = snapshot.docs.map(d => {
        const data = d.data();
        // Fallback for null timestamp when sending
        const displayTime = data.createdAt?.toDate() 
          ? data.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : "Sending...";

        return {
          id: d.id,
          senderId: data.senderId,
          senderName: data.senderName,
          senderInitials: data.senderInitials,
          content: data.content,
          role: data.role,
          time: displayTime
        } as Message;
      });
      
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [groupId]);

  // 3. AUTO-SCROLL LOGIC
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !groupId) return;

    const msgToSend = newMessage;
    setNewMessage(""); // Clear input immediately

    try {
      await addDoc(collection(db, "messages"), {
        groupId,
        senderId: userUid,
        senderName: userName,
        senderInitials: userName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2),
        content: msgToSend,
        role: userRole === "Leader" ? "Leader" : "Member",
        createdAt: serverTimestamp()
      });
    } catch (e) { 
      console.error("Firebase write error:", e);
      alert("Message failed to send. Check your internet or Firebase permissions.");
    }
  };

  const handleLogout = async () => {
    try { await signOutUser(); } catch (e) {}
    navigate("/");
  };

  const getInitials = (name: string) => name ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "U";

  return (
    <div className="flex min-h-screen bg-gray-50/50 overflow-hidden">
      {/* SIDEBAR */}
      <aside className={`hidden lg:flex w-64 bg-[#122244] text-white flex-col fixed inset-y-0 shadow-xl z-20 transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center gap-3 border-b border-white/10">
          <img src="/dashboard logo.png" alt="FeasiFy" className="w-70 h-20 object-contain" />
          </div>
       <nav className="flex-1 p-4 space-y-8 mt-4">
               <div>
                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">Main Menu</p>
                 <div className="space-y-1">
                   <button onClick={() => navigate('/dashboard')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all">
                     <LayoutDashboard className="w-4 h-4" /> Dashboard
                   </button>
                   <button onClick={() => navigate('/Projects')}className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all">
                     <Folder className="w-4 h-4" /> Business Proposal
                   </button>
                   <button onClick={() => navigate('/financial-input')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all">
                     <FileEdit className="w-4 h-4" /> Financial Input
                   </button>
                   <button onClick={() => navigate('/ai-analysis')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all">
                     <Zap className="w-4 h-4" /> AI Feasibility Analysis
                   </button>
                   <button onClick={() => navigate('/reports')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all">
                     <BarChart3 className="w-4 h-4" /> Reports
                   </button>
                   <button onClick={() => navigate('/messages')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold bg-[#c9a654] text-white transition-all shadow-md">
                     <MessageCircle className="w-4 h-4" /> Message
                   </button>
                 </div>
               </div>
       
               <div>
                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">Account</p>
                 <div className="space-y-1">
                   <button onClick={() => navigate('/profile')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all">
                     <User className="w-4 h-4" /> Profile
                   </button>
                   <button onClick={() => navigate('/settings')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all">
                     <Settings className="w-4 h-4" /> Settings
                   </button>
                   <button onClick={() => setShowLogoutConfirm(true)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all">
                     <ShieldAlert className="w-4 h-4" /> Logout
                   </button>
                 </div>
               </div>
             </nav>
        <div className="p-4 border-t border-white/10 bg-black/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#c9a654] flex items-center justify-center font-bold text-sm">{getInitials(userName)}</div>
            <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate text-white">{userName}</p><p className="text-[10px] text-gray-400 truncate">Student</p></div>
            <button
              onClick={() => navigate('/notifications')}
              className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-all relative flex-shrink-0"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full"></span>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className={`flex-1 flex flex-col transition-all duration-300 ease-in-out min-h-screen ${isSidebarOpen ? 'lg:ml-64' : 'ml-0'}`}>
        <div className="bg-white border-b border-gray-100 p-4 flex items-center gap-2 text-sm text-gray-500">
          <SidebarIcon className="w-4 h-4 cursor-pointer hover:text-gray-800 transition-colors" onClick={() => setIsSidebarOpen(!isSidebarOpen)} />
          <span className="mx-2">|</span> FeasiFy <span>›</span> <span className="font-semibold text-gray-900">Messages</span>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Chat Window Area */}
          <div className="flex-1 flex flex-col bg-white">
            <div className="p-6 border-b border-gray-100 bg-gray-50/30">
              <h1 className="text-2xl font-extrabold text-[#122244]">Group Chat</h1>
              <p className="text-xs text-gray-500 font-medium italic">Communicate with your team in real-time</p>
            </div>

            {/* MESSAGE LIST */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/30">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-60">
                   <MessageCircle className="w-12 h-12 mb-2" />
                   <p className="text-sm font-medium italic">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.senderId === userUid;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex gap-3 max-w-[75%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-sm flex-shrink-0 ${isMe ? 'bg-[#c9a654]' : 'bg-[#122244]'}`}>
                          {msg.senderInitials}
                        </div>
                        <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[11px] font-extrabold text-gray-900">{msg.senderName}</span>
                            {msg.role === 'Leader' && <span className="text-[8px] bg-yellow-100 text-yellow-700 px-1.5 rounded font-bold uppercase tracking-widest">Leader</span>}
                          </div>
                          <div className={`p-4 rounded-2xl shadow-sm text-sm leading-relaxed ${isMe ? 'bg-[#122244] text-white rounded-tr-none' : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'}`}>
                            {msg.content}
                          </div>
                          <span className="text-[9px] text-gray-400 font-bold mt-1 uppercase tracking-tighter">{msg.time}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* MESSAGE INPUT */}
            <div className="p-4 bg-white border-t border-gray-100">
              <form onSubmit={handleSendMessage} className="flex gap-3 max-w-5xl mx-auto">
                <input
                  type="text"
                  placeholder="Type a message to group..."
                  className="flex-1 px-5 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a654]/50 focus:bg-white transition-all font-medium"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <button 
                  type="submit"
                  disabled={!newMessage.trim() || !groupId}
                  className="bg-[#122244] hover:bg-[#1a3263] text-white p-3.5 rounded-xl shadow-md shadow-blue-900/10 transition-all disabled:opacity-50"
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          </div>

          {/* RIGHT ROSTER PANEL */}
          <div className="w-80 bg-white border-l border-gray-100 hidden xl:flex flex-col">
            <div className="p-6 border-b border-gray-100 bg-gray-50/30">
              <h3 className="font-extrabold text-[#122244] tracking-tight text-lg">Group Roster</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Project Members</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {groupMembers.map((member) => (
                <div key={member.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm ${member.role === 'Leader' ? 'bg-purple-600' : 'bg-green-600'}`}>
                    {member.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{member.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                      <span className={`text-[9px] font-extrabold uppercase tracking-widest ${member.role === 'Leader' ? 'text-purple-600' : 'text-blue-600'}`}>
                        {member.role}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* LOGOUT CONFIRMATION */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowLogoutConfirm(false)} />
          <div className="bg-white rounded-2xl p-6 z-10 w-11/12 max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-[#122244] mb-2 text-center">Sign Out?</h3>
            <p className="text-sm text-gray-600 mb-6 text-center italic">Are you sure you want to log out of your session?</p>
            <div className="flex gap-3">
              <button className="flex-1 px-5 py-2.5 rounded-lg border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50" onClick={() => setShowLogoutConfirm(false)}>Stay</button>
              <button className="flex-1 px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-md shadow-red-900/10 transition-colors" onClick={handleLogout}>Logout</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Messages;