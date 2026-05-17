import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs, orderBy } from "firebase/firestore";
import {
  Archive,
  Folder,
  User,
  Settings,
  ShieldAlert,
  Sidebar as SidebarIcon,
  Bell,
  Check,
  Users,
  MessageSquare,
  MoreVertical,
  FileText
} from "lucide-react";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'feedback' | 'message' | 'group' | 'system';
  timestamp: string;
  isRead: boolean;
  rawTime: any;
}

const ChairpersonNotifications: React.FC = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'unread' | 'read'>('unread');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Track persistent theme value directly from settings module toggle
  const [darkModeEnabled] = useState(() => {
    const saved = localStorage.getItem("darkModeEnabled");
    return saved !== null ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists()) {
          const data = snap.data();
          setUserName(`${data.firstName} ${data.lastName}`);
          fetchNotifications(u.uid);
        }
      } else {
        navigate("/");
      }
    });
    return () => unsub();
  }, [navigate]);

  const fetchNotifications = async (uid: string) => {
    try {
      const q = query(
        collection(db, "notifications"),
        where("userId", "==", uid),
        orderBy("rawTime", "desc")
      );
      const snap = await getDocs(q);
      const data: Notification[] = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          title: d.title || "Notification",
          message: d.message || "",
          type: d.type || 'system',
          timestamp: getTimeAgo(d.rawTime),
          isRead: d.isRead || false,
          rawTime: d.rawTime
        };
      });
      setNotifications(data);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      setNotifications([]);
    }
  };

  const getTimeAgo = (timestamp: any): string => {
    if (!timestamp) return "Recently";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    const currentList = notifications.filter(n => activeTab === 'unread' ? !n.isRead : n.isRead);
    if (selectedIds.length === currentList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(currentList.map(n => n.id));
    }
  };

  const markAsRead = () => {
    setNotifications(prev => prev.map(n => selectedIds.includes(n.id) ? { ...n, isRead: true } : n));
    setSelectedIds([]);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'feedback': return <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-full"><MessageSquare className="w-5 h-5 text-blue-500 dark:text-blue-400" /></div>;
      case 'message': return <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-full"><Users className="w-5 h-5 text-purple-500 dark:text-purple-400" /></div>;
      case 'group': return <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-full"><Archive className="w-5 h-5 text-green-500 dark:text-green-400" /></div>;
      default: return <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded-full"><Bell className="w-5 h-5 text-gray-500 dark:text-gray-400" /></div>;
    }
  };

  const getInitials = (name: string) => name ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "C";

  const filteredNotifications = notifications.filter(n => activeTab === 'unread' ? !n.isRead : n.isRead);

  return (
    <div className={`flex min-h-screen overflow-hidden transition-colors duration-200 ${darkModeEnabled ? "bg-[#0f172a] text-gray-100" : "bg-gray-50 text-gray-900"}`}>
      {/* SIDEBAR */}
      <aside className={`hidden lg:flex w-72 text-white flex-col fixed inset-y-0 shadow-xl z-20 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${darkModeEnabled ? "bg-[#0b1428] border-r border-gray-800" : "bg-[#122244]"}`}>
        <div className={`p-6 flex items-center gap-3 border-b ${darkModeEnabled ? "border-gray-800" : "border-white/10"}`}>
          <img src="/dashboard logo.png" alt="FeasiFy" className="w-70 h-20 object-contain" />
        </div>

        <nav className="flex-1 p-4 space-y-8 mt-4">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">Main Menu</p>
            <div className="space-y-2">
              <button onClick={() => navigate('/admin/users')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${darkModeEnabled ? "text-gray-300 hover:text-white hover:bg-white/5" : "text-gray-300 hover:text-white hover:bg-white/10"}`}>
                <Users className="w-5 h-5" /> User Accounts Management
              </button>
              <button onClick={() => navigate('/admin/projects')} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold bg-[#c9a654] text-white transition-all shadow-md">
                <FileText className="w-5 h-5" /> Business Feasibility Management
              </button>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">Account</p>
            <div className="space-y-1">
              <button onClick={() => navigate('/admin/profile')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${darkModeEnabled ? "text-gray-300 hover:text-white hover:bg-white/5" : "text-gray-300 hover:text-white hover:bg-white/10"}`}>
                <User className="w-5 h-5" /> Profile
              </button>
              <button onClick={() => navigate('/admin/chairpersonsettings')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${darkModeEnabled ? "text-gray-300 hover:text-white hover:bg-white/5" : "text-gray-300 hover:text-white hover:bg-white/10"}`}>
                <Settings className="w-5 h-5" /> Settings
              </button>
              <button onClick={() => navigate("/")} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${darkModeEnabled ? "text-gray-300 hover:text-white hover:bg-white/5" : "text-gray-300 hover:text-white hover:bg-white/10"}`}>
                <ShieldAlert className="w-5 h-5" /> Logout
              </button>
            </div>
          </div>
        </nav>

        <div className={`p-4 border-t bg-black/20 ${darkModeEnabled ? "border-gray-800 bg-gray-900/50" : "border-white/10"}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#c9a654] flex items-center justify-center font-bold text-sm">
              {getInitials(userName)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-white">{userName}</p>
              <p className="text-[10px] text-gray-400 truncate">FM Chairperson</p>
            </div>
            <button
              onClick={() => navigate("/admin/chairpersonnotification")}
              className={`p-2 rounded-lg transition-all relative flex-shrink-0 ${darkModeEnabled ? "text-gray-400 hover:text-white hover:bg-white/5" : "text-gray-300 hover:text-white hover:bg-white/10"}`}
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {notifications.some(n => !n.isRead) && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full"></span>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className={`flex-1 transition-all duration-300 ease-in-out min-h-screen ${isSidebarOpen ? 'lg:ml-72' : 'ml-0'}`}>
        <div className={`p-4 flex items-center gap-2 text-sm border-b transition-colors ${darkModeEnabled ? "bg-gray-800/50 border-gray-700 text-gray-400" : "bg-white border-gray-100 text-gray-500"}`}>
          <SidebarIcon className={`w-4 h-4 cursor-pointer transition-colors ${darkModeEnabled ? "hover:text-gray-200" : "hover:text-gray-800"}`} onClick={() => setIsSidebarOpen(!isSidebarOpen)} />
          <span className={`mx-2 ${darkModeEnabled ? "text-gray-700" : "text-gray-300"}`}>|</span>
          <span className={`cursor-pointer transition-colors ${darkModeEnabled ? "hover:text-[#c9a654] text-gray-300" : "hover:text-[#c9a654] text-gray-900"}`} onClick={() => navigate('/admin/users')}>FeasiFy</span>
          <span className={`mx-1 ${darkModeEnabled ? "text-gray-600" : "text-gray-400"}`}>›</span>
          <span className={`font-semibold ${darkModeEnabled ? "text-white" : "text-gray-900"}`}>Notifications</span>
        </div>

        <div className="p-6 md:p-8 max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h1 className={`text-3xl font-extrabold transition-colors ${darkModeEnabled ? "text-white" : "text-[#3d2c23]"}`}>Notification</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 italic">Click here to review the details.</p>
            </div>
            
            <div className={`flex p-1 rounded-xl transition-colors ${darkModeEnabled ? "bg-gray-800" : "bg-gray-200/50"}`}>
              <button 
                onClick={() => setActiveTab('unread')}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'unread' ? 'bg-white dark:bg-gray-700 text-[#122244] dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                Unread
              </button>
              <button 
                onClick={() => setActiveTab('read')}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'read' ? 'bg-white dark:bg-gray-700 text-[#122244] dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                Read
              </button>
            </div>
          </div>

          <div className={`rounded-2xl border shadow-sm overflow-hidden transition-colors ${darkModeEnabled ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>
            {/* Toolbar */}
            <div className={`p-4 border-b flex items-center justify-between ${darkModeEnabled ? "border-gray-700 bg-gray-900/50" : "border-gray-50 bg-gray-50/30"}`}>
              <div className="flex items-center gap-3 px-2">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-[#c9a654] focus:ring-[#c9a654]" 
                  checked={filteredNotifications.length > 0 && selectedIds.length === filteredNotifications.length}
                  onChange={handleSelectAll}
                />
                <span className={`text-sm font-bold ${darkModeEnabled ? "text-gray-300" : "text-gray-700"}`}>Select All</span>
              </div>
              
              {selectedIds.length > 0 && (
                <button 
                  onClick={markAsRead}
                  className="flex items-center gap-2 px-4 py-2 bg-[#c9a654] text-white text-xs font-bold rounded-lg hover:bg-[#b59545] transition-all shadow-md"
                >
                  <Check className="w-3.5 h-3.5" /> 
                  Mark as {activeTab === 'unread' ? 'Read' : 'Unread'}
                </button>
              )}
            </div>

            {/* List */}
            <div className={`divide-y ${darkModeEnabled ? "divide-gray-700" : "divide-gray-50"}`}>
              {filteredNotifications.length === 0 ? (
                <div className="py-20 text-center">
                  <Bell className="w-12 h-12 text-gray-200 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 dark:text-gray-500 font-medium italic">No {activeTab} notifications at this time.</p>
                </div>
              ) : (
                <>
                  <div className={`px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] ${darkModeEnabled ? "bg-gray-900/30 text-blue-400" : "bg-gray-50/50 text-blue-500"}`}>Today</div>
                  {filteredNotifications.map((notif) => (
                    <div 
                      key={notif.id} 
                      className={`p-6 flex items-start gap-4 transition-colors cursor-pointer ${darkModeEnabled ? "hover:bg-gray-700/50" : "hover:bg-gray-50/80"} ${selectedIds.includes(notif.id) ? (darkModeEnabled ? 'bg-blue-900/20' : 'bg-blue-50/30') : ''}`}
                      onClick={() => handleToggleSelect(notif.id)}
                    >
                      <input 
                        type="checkbox" 
                        className="mt-3 w-4 h-4 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-[#c9a654] focus:ring-[#c9a654]" 
                        checked={selectedIds.includes(notif.id)}
                        onChange={() => {}} 
                      />
                      <div className="shrink-0 mt-1">
                        {getIcon(notif.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <h3 className={`font-bold text-sm ${darkModeEnabled ? "text-gray-100" : "text-[#122244]"}`}>{notif.title}</h3>
                          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tighter">{notif.timestamp}</span>
                        </div>
                        <p className={`text-sm mt-1 leading-relaxed ${darkModeEnabled ? "text-gray-300" : "text-gray-600"}`}>{notif.message}</p>
                      </div>
                      <button className={`p-1 rounded transition-colors self-center ${darkModeEnabled ? "hover:bg-gray-700" : "hover:bg-gray-200"}`}>
                        <MoreVertical className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ChairpersonNotifications;