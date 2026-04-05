import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db, signOutUser } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs, updateDoc, orderBy } from "firebase/firestore";
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
  Sidebar as SidebarIcon,
  Bell,
  Check,
  CheckCircle2,
  Users,
  MessageSquare,
  Clock,
  Trash2,
  MoreVertical
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

const Notifications: React.FC = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'unread' | 'read'>('unread');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
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
      case 'feedback': return <div className="p-2 bg-blue-50 rounded-full"><MessageSquare className="w-5 h-5 text-blue-500" /></div>;
      case 'message': return <div className="p-2 bg-purple-50 rounded-full"><MessageCircle className="w-5 h-5 text-purple-500" /></div>;
      case 'group': return <div className="p-2 bg-green-50 rounded-full"><Users className="w-5 h-5 text-green-500" /></div>;
      default: return <div className="p-2 bg-gray-50 rounded-full"><Bell className="w-5 h-5 text-gray-500" /></div>;
    }
  };

  const getInitials = (name: string) => name ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "U";

  const filteredNotifications = notifications.filter(n => activeTab === 'unread' ? !n.isRead : n.isRead);

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      {/* SIDEBAR */}
      <aside className={`hidden lg:flex w-64 bg-[#122244] text-white flex-col fixed inset-y-0 shadow-xl z-20 transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center gap-3 border-b border-white/10">
          <div className="bg-white p-1.5 rounded-md"><BarChart3 className="w-6 h-6 text-[#122244]" /></div>
          <div><span className="text-xl font-bold tracking-tight block leading-none">FeasiFy</span><span className="text-[8px] text-gray-400 uppercase tracking-widest mt-1 block font-bold">FM System</span></div>
        </div>
        <nav className="flex-1 p-4 space-y-1 mt-4">
          <button onClick={() => navigate('/dashboard')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"><LayoutDashboard className="w-4 h-4" /> Dashboard</button>
          <button onClick={() => navigate('/projects')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"><Folder className="w-4 h-4" /> Business Proposal</button>
          <button onClick={() => navigate('/financial-input')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"><FileEdit className="w-4 h-4" /> Financial Input</button>
          <button onClick={() => navigate('/ai-analysis')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"><Zap className="w-4 h-4" /> AI Analysis</button>
          <button onClick={() => navigate('/reports')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"><BarChart3 className="w-4 h-4" /> Reports</button>
          <button onClick={() => navigate('/messages')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"><MessageCircle className="w-4 h-4" /> Message</button>
          <div className="pt-8"><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">Account</p></div>
          <button onClick={() => navigate('/profile')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"><User className="w-4 h-4" /> Profile</button>
          <button onClick={() => setShowLogoutConfirm(true)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"><ShieldAlert className="w-4 h-4" /> Logout</button>
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
              {notifications.some(n => !n.isRead) && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full"></span>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className={`flex-1 transition-all duration-300 ease-in-out min-h-screen ${isSidebarOpen ? 'lg:ml-64' : 'ml-0'}`}>
        <div className="bg-white border-b border-gray-100 p-4 flex items-center gap-2 text-sm text-gray-500">
          <SidebarIcon className="w-4 h-4 cursor-pointer hover:text-gray-800 transition-colors" onClick={() => setIsSidebarOpen(!isSidebarOpen)} />
          <span className="mx-2">|</span><span className="cursor-pointer hover:text-[#c9a654]" onClick={()=>navigate('/dashboard')}>FeasiFy</span><span>›</span><span className="font-semibold text-gray-900">Notifications</span>
        </div>

        <div className="p-6 md:p-8 max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-[#3d2c23]">Notification</h1>
              <p className="text-sm text-gray-500 mt-1 italic">Click here to review the details.</p>
            </div>
            
            <div className="flex bg-gray-200/50 p-1 rounded-xl">
              <button 
                onClick={() => setActiveTab('unread')}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'unread' ? 'bg-white text-[#122244] shadow-sm' : 'text-gray-500'}`}
              >
                Unread
              </button>
              <button 
                onClick={() => setActiveTab('read')}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'read' ? 'bg-white text-[#122244] shadow-sm' : 'text-gray-500'}`}
              >
                Read
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
              <div className="flex items-center gap-3 px-2">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-gray-300 text-[#c9a654] focus:ring-[#c9a654]" 
                  checked={filteredNotifications.length > 0 && selectedIds.length === filteredNotifications.length}
                  onChange={handleSelectAll}
                />
                <span className="text-sm font-bold text-gray-700">Select All</span>
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
            <div className="divide-y divide-gray-50">
              {filteredNotifications.length === 0 ? (
                <div className="py-20 text-center">
                  <Bell className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 font-medium italic">No {activeTab} notifications at this time.</p>
                </div>
              ) : (
                <>
                  <div className="px-6 py-3 bg-gray-50/50 text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">Today</div>
                  {filteredNotifications.map((notif) => (
                    <div 
                      key={notif.id} 
                      className={`p-6 flex items-start gap-4 transition-colors hover:bg-gray-50/80 cursor-pointer ${selectedIds.includes(notif.id) ? 'bg-blue-50/30' : ''}`}
                      onClick={() => handleToggleSelect(notif.id)}
                    >
                      <input 
                        type="checkbox" 
                        className="mt-3 w-4 h-4 rounded border-gray-300 text-[#c9a654] focus:ring-[#c9a654]" 
                        checked={selectedIds.includes(notif.id)}
                        onChange={() => {}} // Handled by div click
                      />
                      <div className="flex-shrink-0 mt-1">
                        {getIcon(notif.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <h3 className="font-bold text-[#122244] text-sm">{notif.title}</h3>
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{notif.timestamp}</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1 leading-relaxed">{notif.message}</p>
                      </div>
                      <button className="p-1 hover:bg-gray-200 rounded transition-colors self-center">
                        <MoreVertical className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
      
      {/* (Logout Modal logic stays same as your other files) */}
    </div>
  );
};

export default Notifications;