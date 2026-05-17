import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db, signOutUser } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, query, collection, where, getDocs } from "firebase/firestore";
import {
  Users,
  FileText,
  User,
  Settings,
  ShieldAlert,
  Sidebar as SidebarIcon,
  Bell,
  Lock,
  Moon,
  Globe
} from "lucide-react";

const ChairpersonSettings: React.FC = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  // Toggles initialized from localStorage to persist states across navigation
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    const saved = localStorage.getItem("notificationsEnabled");
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [darkModeEnabled, setDarkModeEnabled] = useState(() => {
    const saved = localStorage.getItem("darkModeEnabled");
    return saved !== null ? JSON.parse(saved) : false;
  });

  // Keep localStorage in sync when notifications toggle changes
  useEffect(() => {
    localStorage.setItem("notificationsEnabled", JSON.stringify(notificationsEnabled));
  }, [notificationsEnabled]);

  // Keep localStorage and the Document Root class in sync when dark mode toggles
  useEffect(() => {
    localStorage.setItem("darkModeEnabled", JSON.stringify(darkModeEnabled));
    if (darkModeEnabled) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkModeEnabled]);

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
    <div className={`flex min-h-screen overflow-hidden transition-colors duration-200 ${darkModeEnabled ? "bg-[#0f172a] text-gray-100" : "bg-gray-50 text-gray-900"}`}>
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[50] lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      {/* ADMIN SIDEBAR */}
      <aside
        className={`flex w-72 text-white flex-col fixed inset-y-0 shadow-xl z-[60] transition-all duration-300 ease-in-out ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 ${darkModeEnabled ? "bg-[#0b1428] border-r border-gray-800" : "bg-[#122244]"}`}
      >
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
              <button onClick={() => navigate('/admin/projects')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${darkModeEnabled ? "text-gray-300 hover:text-white hover:bg-white/5" : "text-gray-300 hover:text-white hover:bg-white/10"}`}>
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
              <button onClick={() => navigate('/admin/chairpersonsettings')} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-bold bg-[#c9a654] text-white transition-all shadow-md">
                <Settings className="w-5 h-5" /> Settings
              </button>
              <button onClick={() => setShowLogoutConfirm(true)} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${darkModeEnabled ? "text-gray-300 hover:text-white hover:bg-white/5" : "text-gray-300 hover:text-white hover:bg-white/10"}`}>
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
              {unreadNotificationCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full"></span>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className={`flex-1 transition-all duration-300 ease-in-out min-h-screen flex flex-col ${isSidebarOpen ? 'lg:ml-72' : 'ml-0'}`}>
        <div className={`p-4 flex items-center gap-2 text-sm border-b transition-colors ${darkModeEnabled ? "bg-gray-800/50 border-gray-700 text-gray-400" : "bg-white border-gray-100 text-gray-500"}`}>
          <SidebarIcon className={`w-4 h-4 cursor-pointer transition-colors ${darkModeEnabled ? "hover:text-gray-200" : "hover:text-gray-800"}`} onClick={() => setIsSidebarOpen(!isSidebarOpen)} />
          <span className={`mx-2 ${darkModeEnabled ? "text-gray-700" : "text-gray-300"}`}>|</span>
          <span className={`cursor-pointer transition-colors ${darkModeEnabled ? "hover:text-[#c9a654] text-gray-300" : "hover:text-[#c9a654] text-gray-900"}`} onClick={() => navigate('/admin/users')}>FeasiFy</span>
          <span className={`mx-1 ${darkModeEnabled ? "text-gray-600" : "text-gray-400"}`}>›</span>
          <span className={`font-semibold ${darkModeEnabled ? "text-white" : "text-gray-900"}`}>Settings</span>
        </div>

        <div className="p-6 md:p-8 max-w-4xl mx-auto w-full">
          <h1 className={`text-3xl font-extrabold mb-8 transition-colors ${darkModeEnabled ? "text-white" : "text-[#122244]"}`}>Settings</h1>

          <div className="space-y-6">
            {/* Preferences */}
            <div className={`rounded-xl border shadow-sm overflow-hidden transition-colors ${darkModeEnabled ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
              <div className={`p-5 border-b ${darkModeEnabled ? "border-gray-700 bg-gray-900/30" : "border-gray-100 bg-gray-50/50"}`}>
                <h3 className={`font-bold ${darkModeEnabled ? "text-white" : "text-[#122244]"}`}>Preferences</h3>
              </div>
              <div className={`divide-y ${darkModeEnabled ? "divide-gray-700" : "divide-gray-100"}`}>
                <div className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bell className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className={`text-sm font-bold ${darkModeEnabled ? "text-white" : "text-gray-900"}`}>Email Notifications</p>
                      <p className={`text-xs ${darkModeEnabled ? "text-gray-400" : "text-gray-500"}`}>Receive alerts when your adviser posts a message.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${notificationsEnabled ? 'bg-[#c9a654]' : 'bg-gray-300 dark:bg-gray-600'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${notificationsEnabled ? 'left-7' : 'left-1'}`}></div>
                  </button>
                </div>
                <div className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Moon className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className={`text-sm font-bold ${darkModeEnabled ? "text-white" : "text-gray-900"}`}>Dark Mode</p>
                      <p className={`text-xs ${darkModeEnabled ? "text-gray-400" : "text-gray-500"}`}>Toggle dark appearance for the application.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setDarkModeEnabled(!darkModeEnabled)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${darkModeEnabled ? 'bg-[#c9a654]' : 'bg-gray-300 dark:bg-gray-600'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${darkModeEnabled ? 'left-7' : 'left-1'}`}></div>
                  </button>
                </div>
                <div className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className={`text-sm font-bold ${darkModeEnabled ? "text-white" : "text-gray-900"}`}>Language</p>
                      <p className={`text-xs ${darkModeEnabled ? "text-gray-400" : "text-gray-500"}`}>English (US)</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Security */}
            <div className={`rounded-xl border shadow-sm overflow-hidden transition-colors ${darkModeEnabled ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
              <div className={`p-5 border-b ${darkModeEnabled ? "border-gray-700 bg-gray-900/30" : "border-gray-100 bg-gray-50/50"}`}>
                <h3 className={`font-bold ${darkModeEnabled ? "text-white" : "text-[#122244]"}`}>Security</h3>
              </div>
              <div className="p-5">
                <div className={`flex items-center justify-between border-b pb-5 mb-5 ${darkModeEnabled ? "border-gray-700" : "border-gray-100"}`}>
                  <div className="flex items-center gap-3">
                    <Lock className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className={`text-sm font-bold ${darkModeEnabled ? "text-white" : "text-gray-900"}`}>Password</p>
                      <p className={`text-xs ${darkModeEnabled ? "text-gray-400" : "text-gray-500"}`}>Last changed: Never</p>
                    </div>
                  </div>
                  <button className={`px-4 py-2 border font-bold text-sm rounded-lg shadow-sm transition-colors ${darkModeEnabled ? "border-gray-600 text-gray-200 hover:bg-gray-700" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
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
          <div className={`rounded-2xl p-6 z-10 w-11/12 max-w-md shadow-xl border animate-in fade-in zoom-in-95 duration-200 ${darkModeEnabled ? "bg-gray-800 border-gray-700" : "bg-white border-transparent"}`}>
            <h3 className={`text-lg font-bold mb-2 ${darkModeEnabled ? "text-white" : "text-[#122244]"}`}>Confirm logout</h3>
            <p className={`text-sm ${darkModeEnabled ? "text-gray-400" : "text-gray-600"}`}>Are you sure you want to log out?</p>
            <div className="flex justify-end gap-3 mt-6">
              <button className={`px-5 py-2.5 rounded-lg border text-sm font-bold transition-colors ${darkModeEnabled ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`} onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
              <button className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-md transition-colors" onClick={() => { setShowLogoutConfirm(false); handleLogout(); }}>
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChairpersonSettings;