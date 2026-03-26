import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db, signOutUser } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
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
  Search,
  Send,
  Dot,
  Sidebar as SidebarIcon
} from "lucide-react";

interface Message {
  id: string;
  sender: string;
  senderInitials: string;
  avatar: string;
  time: string;
  content: string;
  role?: string;
}

interface GroupMember {
  id: string;
  name: string;
  initials: string;
  avatar: string;
  role: string;
  status?: "online" | "away";
}

const Messages: React.FC = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // MESSAGES STATE
  const [messages, setMessages] = useState<Message[]>([]);

  const [groupMembers] = useState<GroupMember[]>([]);

  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          if (snap.exists()) {
            const data = snap.data() as any;
            const first = data.firstName || "";
            const last = data.lastName || "";
            setUserName([first, last].filter(Boolean).join(" ") || u.displayName || "");
            setUserEmail(data.email || u.email || "");
          } else {
            setUserName(u.displayName || (u.email ? u.email.split("@")[0] : ""));
            setUserEmail(u.email || "");
          }
        } catch (e) {}
      } else {
        navigate("/");
      }
    });
    return () => unsub();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await signOutUser();
    } catch (e) {}
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {}
    navigate("/");
  };

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      const newMsg: Message = {
        id: (messages.length + 1).toString(),
        sender: userName,
        senderInitials: userName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2),
        avatar: "bg-cyan-500",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        content: newMessage
      };
      setMessages([...messages, newMsg]);
      setNewMessage("");
    }
  };

  return (
    <>
      <div className="flex min-h-screen bg-white overflow-hidden">
        {/* SIDEBAR: Professional Dark Navigation */}
        <aside className={`hidden lg:flex w-64 bg-[#0f171e] text-white flex-col fixed inset-y-0 shadow-xl z-20 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-6 flex items-center gap-2 border-b border-gray-800">
            <div className="bg-[#249c74] p-1.5 rounded-md">
              <Zap className="w-5 h-5 text-white fill-current" />
            </div>
            <span className="text-xl font-bold tracking-tight">FeasiFy</span>
          </div>

          <nav className="flex-1 p-4 space-y-8 mt-4">
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 px-2">Main Menu</p>
              <div className="space-y-1">
                {[
                  { name: "Dashboard", icon: LayoutDashboard, route: "/dashboard" },
                  { name: "Projects", icon: Folder, route: "/projects" },
                  { name: "Financial Input", icon: FileEdit, route: "/financial-input" },
                  { name: "AI Analysis", icon: Zap, route: "/ai-analysis" },
                  { name: "Reports", icon: BarChart3, route: "/reports" },
                  { name: "Message", icon: MessageCircle, route: "/messages" },
                ].map((item) => (
                  <button
                    key={item.name}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${item.route === "/messages" ? "bg-[#249c74] text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
                    onClick={() => item.route && navigate(item.route)}
                  >
                    <item.icon className="w-4 h-4" /> {item.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 px-2">Account</p>
              <div className="space-y-1">
                {[
                  { name: "Profile", icon: User },
                  { name: "Settings", icon: Settings },
                  { name: "Logout", icon: ShieldAlert },
                ].map((item) => (
                  <button
                    key={item.name}
                    onClick={() => {
                      if (item.name === "Logout") setShowLogoutConfirm(true);
                      if (item.name === "Profile") navigate("/profile");
                      if (item.name === "Settings") navigate("/settings");
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
                  >
                    <item.icon className="w-4 h-4" /> {item.name}
                  </button>
                ))}
              </div>
            </div>
          </nav>

          <div className="p-4 border-t border-gray-800 bg-[#0a1118]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#249c74] flex items-center justify-center font-bold">
                {(() => {
                  const parts = userName.trim().split(/\s+/).filter(Boolean);
                  if (parts.length === 0) return "U";
                  const initials = parts.map((p) => p[0]).slice(0, 2).join("");
                  return initials.toUpperCase();
                })()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{userName || "User"}</p>
                <p className="text-xs text-gray-500 truncate">{userEmail || ""}</p>
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className={`flex-1 transition-all duration-300 ease-in-out bg-gray-50/30 min-h-screen ${isSidebarOpen ? 'lg:ml-64' : 'ml-0'}`}>
          <div className="bg-white border-b border-gray-100 p-4 flex items-center gap-2 text-sm text-gray-500">
            <SidebarIcon 
              className="w-4 h-4 cursor-pointer hover:text-gray-800 transition-colors" 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
            />
            <span className="mx-2">|</span>
            <span 
              className="cursor-pointer hover:text-[#249c74] transition-colors"
              onClick={() => navigate('/dashboard')}
            >
              FeasiFy
            </span>
            <span>›</span>
            <span className="font-semibold text-gray-900">Messages</span>
          </div>

          <div className="p-6 md:p-8 max-w-7xl mx-auto">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
              <p className="text-sm text-gray-500 mt-1">Communicate with your project members</p>
            </div>

            {/* CONTENT AREA */}
            <div className="flex gap-6 mt-6 overflow-hidden h-[calc(100vh-250px)]">
              {/* LEFT SECTION - Messages */}
              <div className="flex-1 flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Search Bar */}
              <div className="p-4 border-b border-gray-200">
                <div className="relative">
                  <Search size={18} className="absolute left-3 top-3 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search messages..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Messages List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                    No messages yet
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <div key={msg.id} className={idx === 0 ? "mb-4 pb-4 border-b border-gray-200" : ""}>
                      {idx === 0 ? (
                        <div className="flex items-center gap-2 text-sm">
                          <div className={`w-10 h-10 ${msg.avatar} rounded-full flex items-center justify-center text-white font-semibold text-xs`}>
                            {msg.senderInitials}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800">{msg.sender}</p>
                            <p className="text-xs text-green-600 flex items-center gap-1">
                              <Dot size={12} className="fill-green-600" /> {msg.content}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-3">
                          <div className={`w-10 h-10 ${msg.avatar} rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0`}>
                            {msg.senderInitials}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-baseline gap-2">
                              <p className="font-semibold text-gray-800 text-sm">{msg.sender}</p>
                              {msg.role && <span className="text-xs font-bold text-orange-600">{msg.role}</span>}
                              <p className="text-xs text-gray-500">{msg.time}</p>
                            </div>
                            <p className="text-gray-700 text-sm mt-1">{msg.content}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-gray-200">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Type a message to group..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleSendMessage}
                    className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT SECTION - Group Members */}
            <div className="w-72 bg-white rounded-xl border border-gray-100 shadow-sm p-6 overflow-y-auto">
              <h2 className="text-lg font-bold text-gray-800 mb-4">GROUP MEMBERS</h2>
              <p className="text-xs text-gray-600 mb-4">Project Roster</p>
              
              <div className="space-y-3">
                {groupMembers.length === 0 ? (
                  <p className="text-sm text-gray-400">No members yet</p>
                ) : (
                  groupMembers.map((member) => (
                    <div key={member.id} className="flex items-center gap-3">
                      <div className={`w-10 h-10 ${member.avatar} rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0`}>
                        {member.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 text-sm">{member.name}</p>
                        <p className="text-xs text-gray-600">{member.role}</p>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${member.status === "online" ? "bg-green-500" : "bg-gray-400"}`}></div>
                    </div>
                  ))
                )}
              </div>
            </div>
            </div>
          </div>
        </main>

        {/* LOGOUT CONFIRMATION MODAL */}
        {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Confirm Logout</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to logout?</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
};

export default Messages;
