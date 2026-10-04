import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db, signOutUser } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, query, where, onSnapshot } from "firebase/firestore";
import {
  LayoutDashboard,
  Folder,
  FileEdit,
  Zap,
  BarChart3,
  MessageCircle,
  Settings,
  ShieldAlert,
  Sidebar as SidebarIcon,
  Bell,
  Check,
  CheckCheck,
  Users,
  MessageSquare,
  Clock,
  Trash2,
  MoreVertical,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  Info,
  DollarSign,
  Search,
  X
} from "lucide-react";
import {
  markNotificationAsRead,
  markNotificationAsUnread,
  markMultipleNotificationsAsRead,
  markMultipleNotificationsAsUnread,
  deleteNotificationDoc,
  deleteMultipleNotificationDocs,
  markAllNotificationsAsReadForUser
} from "./services/notificationService";

interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'proposal' | 'feedback' | 'message' | 'group' | 'system' | 'approval' | 'financial';
  link?: string;
  senderName?: string;
  timestamp: string;
  isRead: boolean;
  rawTime: any;
}

const Notifications: React.FC = () => {
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [userName, setUserName] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);

  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'read'>('unread');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNotifDetail, setSelectedNotifDetail] = useState<NotificationItem | null>(null);

  useEffect(() => {
    let unsubNotifications: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (unsubNotifications) { unsubNotifications(); unsubNotifications = undefined; }
      if (u) {
        setCurrentUserId(u.uid);
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists()) {
          const data = snap.data();
          setUserName(`${data.firstName || ''} ${data.lastName || ''}`.trim() || "Student");
        }
        unsubNotifications = setupNotificationsListener(u.uid);
      } else {
        navigate("/");
      }
    });

    return () => {
      unsubAuth();
      if (unsubNotifications) unsubNotifications();
    };
  }, [navigate]);

  const setupNotificationsListener = (uid: string): (() => void) => {
    setIsLoading(true);
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const data: NotificationItem[] = snap.docs.map(d => {
        const nd = d.data();
        return {
          id: d.id,
          userId: nd.userId || uid,
          title: nd.title || "Notification",
          message: nd.message || "",
          type: nd.type || 'system',
          link: nd.link || "",
          senderName: nd.senderName || "",
          timestamp: getTimeAgo(nd.rawTime || nd.createdAt),
          isRead: nd.isRead === true,
          rawTime: nd.rawTime || nd.createdAt
        };
      });

      // Sort newest first
      data.sort((a, b) => {
        const timeA = a.rawTime?.toDate ? a.rawTime.toDate().getTime() : new Date(a.rawTime || 0).getTime();
        const timeB = b.rawTime?.toDate ? b.rawTime.toDate().getTime() : new Date(b.rawTime || 0).getTime();
        return timeB - timeA;
      });

      setNotifications(data);
      setIsLoading(false);
    }, (error) => {
      console.error("Notifications listener error:", error);
      setNotifications([]);
      setIsLoading(false);
    });
    return unsub;
  };

  const getTimeAgo = (timestamp: any): string => {
    if (!timestamp) return "Recently";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return "Recently";
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const handleToggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const filteredNotifications = notifications.filter(n => {
    const matchesTab =
      activeTab === 'all' ? true :
        activeTab === 'unread' ? !n.isRead :
          n.isRead;

    if (!matchesTab) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      n.message.toLowerCase().includes(q) ||
      (n.senderName && n.senderName.toLowerCase().includes(q))
    );
  });

  const handleSelectAll = () => {
    if (selectedIds.length === filteredNotifications.length && filteredNotifications.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredNotifications.map(n => n.id));
    }
  };

  const handleBatchMarkAsRead = async () => {
    if (selectedIds.length === 0) return;
    await markMultipleNotificationsAsRead(selectedIds);
    setSelectedIds([]);
  };

  const handleBatchMarkAsUnread = async () => {
    if (selectedIds.length === 0) return;
    await markMultipleNotificationsAsUnread(selectedIds);
    setSelectedIds([]);
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} notification(s)?`)) {
      await deleteMultipleNotificationDocs(selectedIds);
      setSelectedIds([]);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!currentUserId) return;
    await markAllNotificationsAsReadForUser(currentUserId);
    setSelectedIds([]);
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.isRead) {
      await markNotificationAsRead(notif.id);
    }
    if (notif.link) {
      navigate(notif.link);
    } else {
      setSelectedNotifDetail(notif);
    }
  };

  const handleSingleToggleRead = async (notif: NotificationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (notif.isRead) {
      await markNotificationAsUnread(notif.id);
    } else {
      await markNotificationAsRead(notif.id);
    }
  };

  const handleSingleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteNotificationDoc(id);
    setSelectedIds(prev => prev.filter(item => item !== id));
    if (selectedNotifDetail?.id === id) setSelectedNotifDetail(null);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'approval':
        return <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 flex-shrink-0"><Sparkles className="w-5 h-5" /></div>;
      case 'feedback':
        return <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 flex-shrink-0"><MessageSquare className="w-5 h-5" /></div>;
      case 'message':
        return <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl border border-purple-100 flex-shrink-0"><MessageCircle className="w-5 h-5" /></div>;
      case 'group':
        return <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 flex-shrink-0"><Users className="w-5 h-5" /></div>;
      case 'proposal':
        return <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl border border-amber-200 flex-shrink-0"><Folder className="w-5 h-5" /></div>;
      case 'financial':
        return <div className="p-2.5 bg-teal-50 text-teal-600 rounded-xl border border-teal-100 flex-shrink-0"><DollarSign className="w-5 h-5" /></div>;
      default:
        return <div className="p-2.5 bg-gray-50 text-gray-600 rounded-xl border border-gray-100 flex-shrink-0"><Bell className="w-5 h-5" /></div>;
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const readCount = notifications.filter(n => n.isRead).length;

  const getInitials = (name: string) => name ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "S";

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[50] lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`flex flex-col fixed inset-y-0 z-[60] bg-[#122244] text-white shadow-xl transition-[width,transform] duration-300 ease-in-out group overflow-x-hidden ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          } w-64 lg:w-16 lg:hover:w-64`}
      >
        {/* Logo Section */}
        <div className="h-16 flex items-center justify-center px-2 border-b border-white/10 shrink-0 overflow-hidden">
          {/* FeasifyEmblemLogo when sidebar is folded */}
          <img
            src="/FeasifyEmblemLogo.png"
            alt="FeasiFy"
            onClick={() => navigate("/dashboard")}
            className="h-11 w-auto max-h-[46px] max-w-[48px] object-contain cursor-pointer transition-transform hover:scale-105 hidden lg:block lg:group-hover:hidden shrink-0"
          />
          {/* FeasifyFullLogo when sidebar is hovered or on mobile */}
          <img
            src="/FeasifyFullLogo.png"
            alt="FeasiFy"
            onClick={() => navigate("/dashboard")}
            className="h-12 w-auto max-h-[48px] max-w-[210px] object-contain cursor-pointer transition-transform hover:scale-105 block lg:hidden lg:group-hover:block shrink-0"
          />
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto overflow-x-hidden">
          <button
            onClick={() => navigate('/dashboard')}
            title="Dashboard"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <LayoutDashboard className="w-5 h-5 shrink-0" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              Dashboard
            </span>
          </button>
          <button
            onClick={() => navigate('/projects')}
            title="Business Proposal"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Folder className="w-5 h-5 shrink-0" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              Business Proposal
            </span>
          </button>
          <button
            onClick={() => navigate('/financial-input')}
            title="Financial Input"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <FileEdit className="w-5 h-5 shrink-0" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              Financial Input
            </span>
          </button>
          <button
            onClick={() => navigate('/ai-analysis')}
            title="AI Feasibility Analysis"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Zap className="w-5 h-5 shrink-0" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              AI Feasibility Analysis
            </span>
          </button>
          <button
            onClick={() => navigate('/reports')}
            title="Reports"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <BarChart3 className="w-5 h-5 shrink-0" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              Reports
            </span>
          </button>
          <button
            onClick={() => navigate('/messages')}
            title="Message"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <MessageCircle className="w-5 h-5 shrink-0" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              Message
            </span>
          </button>
          <button
            onClick={() => navigate('/settings')}
            title="Settings"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Settings className="w-5 h-5 shrink-0" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              Settings
            </span>
          </button>
        </nav>

        {/* Bottom Logout Button */}
        <div className="p-3 border-t border-white/10 shrink-0">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            title="Logout"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
          >
            <ShieldAlert className="w-5 h-5 shrink-0 text-red-400" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              Logout
            </span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className={`flex-1 transition-all duration-300 ease-in-out min-h-screen ${isSidebarOpen ? 'lg:ml-16' : 'ml-0'}`}>
        <div className="bg-white border-b border-gray-200/80 shadow-[0_3px_10px_rgba(0,0,0,0.06)] px-6 py-3.5 flex items-center justify-between text-sm text-gray-500 sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">Notifications</span>
          </div>

          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs font-bold text-[#c9a654] hover:text-[#b59545] flex items-center gap-1.5 transition-colors cursor-pointer mr-1"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Mark all as read
              </button>
            )}
            <button
              onClick={() => navigate('/notifications')}
              className="p-2 text-gray-500 hover:text-[#122244] hover:bg-gray-100 rounded-lg transition-all relative"
              title="Notifications"
            >
              <Bell className="w-5 h-5 text-[#c9a654]" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse ring-2 ring-white"></span>
              )}
            </button>
            <div className="h-6 w-px bg-gray-200"></div>
            <div
              onClick={() => navigate('/settings')}
              className="flex items-center gap-3 cursor-pointer hover:opacity-85 transition-opacity"
            >
              <div className="w-9 h-9 rounded-full bg-[#c9a654] text-white flex items-center justify-center font-bold text-sm shadow-xs flex-shrink-0">
                {getInitials(userName)}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-gray-900 leading-tight">
                  {userName || "User"}
                </p>
                <p className="text-[10px] text-gray-400 font-medium">Student</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-extrabold text-[#3d2c23]">Notifications</h1>
                {unreadCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    {unreadCount} Unread
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">Stay updated with proposal reviews, messages, and adviser feedback.</p>
            </div>

            {/* Filter Tabs */}
            <div className="flex bg-gray-200/60 p-1 rounded-xl shadow-inner">
              <button
                onClick={() => { setActiveTab('unread'); setSelectedIds([]); }}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'unread' ? 'bg-white text-[#122244] shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Unread
                {unreadCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => { setActiveTab('all'); setSelectedIds([]); }}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'all' ? 'bg-white text-[#122244] shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                All
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                  {notifications.length}
                </span>
              </button>
              <button
                onClick={() => { setActiveTab('read'); setSelectedIds([]); }}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'read' ? 'bg-white text-[#122244] shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Read
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                  {readCount}
                </span>
              </button>
            </div>
          </div>

          {/* Search & Actions Bar */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-gray-50/40">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 text-[#c9a654] focus:ring-[#c9a654]"
                    checked={filteredNotifications.length > 0 && selectedIds.length === filteredNotifications.length}
                    onChange={handleSelectAll}
                  />
                  <span className="text-xs font-bold text-gray-700">Select All</span>
                </label>
                {selectedIds.length > 0 && (
                  <span className="text-xs text-gray-500 font-medium">
                    ({selectedIds.length} selected)
                  </span>
                )}
              </div>

              {/* Action Buttons for Selected */}
              <div className="flex items-center gap-2 flex-wrap">
                {selectedIds.length > 0 ? (
                  <>
                    <button
                      onClick={handleBatchMarkAsRead}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#c9a654] text-white text-xs font-bold rounded-lg hover:bg-[#b59545] transition-all shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" /> Mark as Read
                    </button>
                    <button
                      onClick={handleBatchMarkAsUnread}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200 transition-all border border-gray-200"
                    >
                      <Clock className="w-3.5 h-3.5" /> Mark as Unread
                    </button>
                    <button
                      onClick={handleBatchDelete}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 text-xs font-bold rounded-lg hover:bg-red-100 transition-all border border-red-200"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </>
                ) : (
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search notifications..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#c9a654] focus:border-[#c9a654]"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Notifications List */}
            <div className="divide-y divide-gray-100">
              {isLoading ? (
                <div className="py-20 text-center text-gray-400 font-medium animate-pulse">
                  Loading notifications...
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="py-20 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-100 text-[#c9a654] flex items-center justify-center mx-auto mb-3">
                    <Bell className="w-7 h-7" />
                  </div>
                  <h3 className="font-bold text-gray-800 text-base">No notifications</h3>
                  <p className="text-gray-400 text-xs mt-1">
                    {activeTab === 'unread' ? "You're all caught up! No unread notifications." : "No notifications found in this view."}
                  </p>
                </div>
              ) : (
                filteredNotifications.map((notif) => {
                  const isSelected = selectedIds.includes(notif.id);
                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`p-5 flex items-start gap-4 transition-all cursor-pointer ${notif.isRead ? 'bg-white hover:bg-gray-50/70' : 'bg-amber-50/20 hover:bg-amber-50/40 border-l-4 border-l-[#c9a654]'
                        } ${isSelected ? 'bg-blue-50/40' : ''}`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 w-4 h-4 rounded border-gray-300 text-[#c9a654] focus:ring-[#c9a654]"
                        checked={isSelected}
                        onChange={() => { }}
                        onClick={(e) => handleToggleSelect(notif.id, e)}
                      />

                      {getIcon(notif.type)}

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <h3 className={`text-sm ${notif.isRead ? 'font-semibold text-gray-800' : 'font-bold text-[#122244]'}`}>
                              {notif.title}
                            </h3>
                            {!notif.isRead && (
                              <span className="w-2 h-2 rounded-full bg-[#c9a654] flex-shrink-0" />
                            )}
                          </div>
                          <span className="text-[11px] font-semibold text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {notif.timestamp}
                          </span>
                        </div>

                        <p className={`text-xs mt-1 leading-relaxed ${notif.isRead ? 'text-gray-500' : 'text-gray-700 font-medium'}`}>
                          {notif.message}
                        </p>

                        {notif.link && (
                          <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-[#c9a654] hover:underline">
                            View details <ExternalLink className="w-3 h-3" />
                          </div>
                        )}
                      </div>

                      {/* Row actions */}
                      <div className="flex items-center gap-1 opacity-80 hover:opacity-100 flex-shrink-0">
                        <button
                          onClick={(e) => handleSingleToggleRead(notif, e)}
                          title={notif.isRead ? "Mark as unread" : "Mark as read"}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          {notif.isRead ? <Clock className="w-4 h-4" /> : <Check className="w-4 h-4 text-[#c9a654]" />}
                        </button>
                        <button
                          onClick={(e) => handleSingleDelete(notif.id, e)}
                          title="Delete notification"
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>

      {/* DETAIL MODAL */}
      {selectedNotifDetail && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                {getIcon(selectedNotifDetail.type)}
                <div>
                  <h3 className="font-bold text-gray-900 text-base">{selectedNotifDetail.title}</h3>
                  <span className="text-[11px] text-gray-400 font-medium">{selectedNotifDetail.timestamp}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedNotifDetail(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-700 leading-relaxed bg-gray-50/80 p-4 rounded-xl border border-gray-100">
              {selectedNotifDetail.message}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedNotifDetail(null)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Close
              </button>
              {selectedNotifDetail.link && (
                <button
                  onClick={() => {
                    const lnk = selectedNotifDetail.link!;
                    setSelectedNotifDetail(null);
                    navigate(lnk);
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#c9a654] hover:bg-[#b59545] rounded-lg shadow-sm transition-all flex items-center gap-1.5"
                >
                  Go to page <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Sign Out</h3>
              <p className="text-xs text-gray-500 mt-1">Are you sure you want to logout from your account?</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await signOutUser();
                  navigate('/');
                }}
                className="flex-1 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-all"
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

export default Notifications;