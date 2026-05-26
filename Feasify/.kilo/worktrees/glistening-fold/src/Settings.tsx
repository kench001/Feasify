import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db, signOutUser } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc, query, collection, where, getDocs } from "firebase/firestore";
import {
  LayoutDashboard,
  Folder,
  FileEdit,
  Zap,
  BarChart3,
  MessageCircle,
  User,
  Settings as SettingsIcon,
  ShieldAlert,
  Sidebar as SidebarIcon,
  Bell,
  Lock,
  Moon,
  Globe
} from "lucide-react";

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  // Dummy toggles for UI
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          if (snap.exists()) {
            const data = snap.data() as any;
            setUserName([data.firstName, data.lastName].filter(Boolean).join(" ") || u.displayName || "");
          }
        } catch (e) {}
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
  const handleLogout = async () => {
    try { await signOutUser(); localStorage.clear(); sessionStorage.clear(); } catch (e) {}
    navigate("/");
  };

  const getInitials = (name: string) => name ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "U";

  return (
    <div className="flex min-h-screen bg-gray-50/50 overflow-hidden">
      {/* NEW SIDEBAR */}
      <aside className={`hidden lg:flex w-64 bg-[#122244] text-white flex-col fixed inset-y-0 shadow-xl z-20 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
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
              <button onClick={() => navigate('/projects')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all">
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
              <button onClick={() => navigate('/messages')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all">
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
              <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold bg-[#c9a654] text-white transition-all shadow-md">
                <SettingsIcon className="w-4 h-4" /> Settings
              </button>
              <button onClick={() => setShowLogoutConfirm(true)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all">
                <ShieldAlert className="w-4 h-4" /> Logout
              </button>
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-white/10 bg-black/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#c9a654] flex items-center justify-center font-bold text-sm">
              {getInitials(userName)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-white">{userName || "User"}</p>
              <p className="text-[10px] text-gray-400 truncate">Student</p>
            </div>
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
      <main className={`flex-1 transition-all duration-300 ease-in-out min-h-screen flex flex-col ${isSidebarOpen ? 'lg:ml-64' : 'ml-0'}`}>
        <div className="bg-white border-b border-gray-100 p-4 flex items-center gap-2 text-sm text-gray-500">
          <SidebarIcon className="w-4 h-4 cursor-pointer hover:text-gray-800 transition-colors" onClick={() => setIsSidebarOpen(!isSidebarOpen)} />
          <span className="mx-2">|</span>
          <span className="cursor-pointer hover:text-[#c9a654] transition-colors" onClick={() => navigate('/dashboard')}>FeasiFy</span>
          <span>›</span>
          <span className="font-semibold text-gray-900">Settings</span>
        </div>

        <div className="p-6 md:p-8 max-w-4xl mx-auto w-full">
          <h1 className="text-3xl font-extrabold text-[#3d2c23] mb-8">Settings</h1>

          <div className="space-y-6">
            {/* Preferences */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                <h3 className="font-bold text-[#122244]">Preferences</h3>
              </div>
              <div className="divide-y divide-gray-100">
                <div className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bell className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-bold text-gray-900">Email Notifications</p>
                      <p className="text-xs text-gray-500">Receive alerts when your adviser posts a message.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${notificationsEnabled ? 'bg-[#c9a654]' : 'bg-gray-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${notificationsEnabled ? 'left-7' : 'left-1'}`}></div>
                  </button>
                </div>
                <div className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Moon className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-bold text-gray-900">Dark Mode</p>
                      <p className="text-xs text-gray-500">Toggle dark appearance for the application.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setDarkModeEnabled(!darkModeEnabled)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${darkModeEnabled ? 'bg-[#122244]' : 'bg-gray-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${darkModeEnabled ? 'left-7' : 'left-1'}`}></div>
                  </button>
                </div>
                <div className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-bold text-gray-900">Language</p>
                      <p className="text-xs text-gray-500">English (US)</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Security */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                <h3 className="font-bold text-[#122244]">Security</h3>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between border-b border-gray-100 pb-5 mb-5">
                  <div className="flex items-center gap-3">
                    <Lock className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-bold text-gray-900">Password</p>
                      <p className="text-xs text-gray-500">Last changed: Never</p>
                    </div>
                  </div>
                  <button className="px-4 py-2 border border-gray-200 text-gray-700 font-bold text-sm rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
                    Change Password
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* LOGOUT CONFIRMATION */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowLogoutConfirm(false)} />
          <div className="bg-white rounded-2xl p-6 z-10 w-11/12 max-w-md shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-[#122244] mb-2">Confirm logout</h3>
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to log out?</p>
            <div className="flex justify-end gap-3">
              <button className="px-5 py-2.5 rounded-lg border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50" onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
              <button className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-md" onClick={() => { setShowLogoutConfirm(false); handleLogout(); }}>
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;