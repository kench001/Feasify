import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db, signOutUser } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, query, collection, where, getDocs } from "firebase/firestore";
import { useTheme } from "./ThemeContext";
import {
  User,
  Settings as SettingsIcon,
  ShieldAlert,
  Sidebar as SidebarIcon,
  Bell,
  Lock,
  Moon,
  Globe
} from "lucide-react";

const AdviserSettings: React.FC = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isDarkMode = theme === 'dark';
  
  const [userName, setUserName] = useState("Adviser");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Section Management State
  const [adviserSections, setAdviserSections] = useState<string[]>([]);
  const [activeSection, setActiveSection] = useState("");
  const [sectionSettingsMap, setSectionSettingsMap] = useState<Record<string, {minMembers: number, maxMembers: number}>>({});
  const [minMembers, setMinMembers] = useState(8);
  const [maxMembers, setMaxMembers] = useState(10);

  // Toggles for UI
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          if (snap.exists()) {
            const data = snap.data() as any;
            if (data.role !== "Adviser" && u.email !== "chairperson@gmail.com") {
              navigate("/adviser/dashboard");
              return;
            }
            setUserName(`${data.firstName} ${data.lastName}`);
            const rawSection = data.section || "Unassigned";
            const parsedSections = rawSection.split(",")
              .map((s: string) => s.trim())
              .filter(Boolean)
              .sort((a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
            
            // Load per-section settings from Firestore
            if (data.sectionSettings) {
              setSectionSettingsMap(data.sectionSettings);
            }

            setAdviserSections(parsedSections);
          }
        } catch (e) {}
      } else {
        navigate("/");
      }
    });
    return () => unsub();
  }, [navigate]);

  // Auto-select the first section when adviser sections load
  useEffect(() => {
    if (adviserSections.length > 0 && !activeSection) {
      const firstSection = adviserSections[0];
      setActiveSection(firstSection);
      const settings = sectionSettingsMap[firstSection];
      setMinMembers(settings?.minMembers ?? 8);
      setMaxMembers(settings?.maxMembers ?? 10);
    }
  }, [adviserSections, sectionSettingsMap]);

  // Fetch unread notifications count
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const q = query(
            collection(db, "notifications"),
            where("userId", "==", u.uid),
            where("isRead", "==", false),
          );
          const snap = await getDocs(q);
          setUnreadNotificationCount(snap.size);
        } catch (error) {
          console.error(error);
        }
      }
    });
    return () => unsub();
  }, []);

  const handleLogout = async () => {
    try {
      await signOutUser();
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {}
    navigate("/");
  };

  const getInitials = (name: string) =>
    name
      ? name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2)
      : "A";

  return (
    <div className="flex min-h-screen bg-gray-50/50 dark:bg-gray-900 overflow-hidden transition-colors duration-300">
      {/* ADVISER SIDEBAR */}
      <aside
        className={`hidden lg:flex w-64 bg-[#122244] dark:bg-gray-950 text-white flex-col fixed inset-y-0 shadow-xl z-20 transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 flex items-center gap-3 border-b border-white/10">
          <img
            src="/dashboard logo.png"
            alt="FeasiFy"
            className="w-70 h-20 object-contain"
          />
        </div>

        <nav className="flex-1 p-4 space-y-8 mt-4">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">
              Main Menu
            </p>
            <div className="space-y-1">
              <button onClick={() => navigate("/adviser/dashboard")} className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium text-white hover:bg-white/10 transition-all">
                My Sections
              </button>
              <div className="pl-4 pr-2 py-2 space-y-2">
                {adviserSections.map((sectionName) => (
                  <button
                    key={sectionName}
                    onClick={() => {
                      navigate(`/adviser/dashboard?section=${encodeURIComponent(sectionName)}`);
                    }}
                    className={`w-full text-left text-sm transition-colors ${
                      activeSection === sectionName
                        ? "text-white font-medium"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {sectionName}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">
              Account
            </p>
            <div className="space-y-1">
              <button onClick={() => navigate("/adviser/profile")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-all">
                <User className="w-4 h-4" /> Profile
              </button>
              <button onClick={() => navigate("/adviser/settings")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold bg-[#c9a654] text-white hover:bg-white/10 transition-all shadow-md">
                <SettingsIcon className="w-4 h-4" /> Settings
              </button>
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-all"
              >
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
              <p className="text-sm font-semibold truncate text-white">
                {userName}
              </p>
              <p className="text-[10px] text-gray-400 truncate">
                Feasibility Adviser
              </p>
            </div>
            <button
              onClick={() => navigate("/adviser/notifications")}
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
      <main
        className={`flex-1 transition-all duration-300 ease-in-out min-h-screen flex flex-col ${
          isSidebarOpen ? "lg:ml-64" : "ml-0"
        }`}
      >
        <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 p-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 transition-colors">
          <SidebarIcon
            className="w-4 h-4 cursor-pointer hover:text-gray-800 dark:hover:text-white transition-colors"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          />
          <span className="mx-2">|</span>
          <span
            className="cursor-pointer hover:text-[#c9a654] transition-colors"
            onClick={() => navigate("/adviser/dashboard")}
          >
            FeasiFy
          </span>
          <span>›</span>
          <span className="font-semibold text-gray-900 dark:text-white transition-colors">Settings</span>
        </div>

        <div className="p-6 md:p-8 max-w-4xl mx-auto w-full">
          <h1 className="text-3xl font-extrabold text-[#3d2c23] dark:text-white mb-8 transition-colors">
            Settings
          </h1>

          <div className="space-y-6">
            {/* Preferences */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden transition-colors">
              <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 transition-colors">
                <h3 className="font-bold text-[#122244] dark:text-white transition-colors">Preferences</h3>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700 transition-colors">
                <div className="p-5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Bell className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white transition-colors">
                        Email Notifications
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 transition-colors">
                        Receive alerts when group submissions are updated.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      notificationsEnabled ? "bg-[#c9a654]" : "bg-gray-300 dark:bg-gray-600"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${
                        notificationsEnabled ? "left-7" : "left-1"
                      }`}
                    ></div>
                  </button>
                </div>

                {/* DARK MODE TOGGLE */}
                <div className="p-5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Moon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white transition-colors">
                        Dark Mode
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 transition-colors">
                        Toggle dark appearance for the application.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={toggleTheme}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      isDarkMode ? "bg-[#c9a654]" : "bg-gray-300 dark:bg-gray-600"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${
                        isDarkMode ? "left-7" : "left-1"
                      }`}
                    ></div>
                  </button>
                </div>

                <div className="p-5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white transition-colors">Language</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 transition-colors">English (US)</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Security */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden transition-colors">
              <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 transition-colors">
                <h3 className="font-bold text-[#122244] dark:text-white transition-colors">Security</h3>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-5 mb-5 transition-colors">
                  <div className="flex items-center gap-3">
                    <Lock className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white transition-colors">Password</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 transition-colors">Last changed: Never</p>
                    </div>
                  </div>
                  <button className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm">
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm transition-colors"
            onClick={() => setShowLogoutConfirm(false)}
          />
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 z-10 w-11/12 max-w-md shadow-xl animate-in fade-in zoom-in-95 duration-200 transition-colors">
            <h3 className="text-lg font-bold text-[#122244] dark:text-white mb-2 transition-colors">
              Confirm logout
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 transition-colors">
              Are you sure you want to log out?
            </p>
            <div className="flex justify-end gap-3">
              <button
                className="px-5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-md transition-colors"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  handleLogout();
                }}
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

export default AdviserSettings;