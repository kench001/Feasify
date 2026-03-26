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
  Sidebar as SidebarIcon,
  Bell,
  Zap as Lightning
} from "lucide-react";

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"profile" | "settings">("settings");

  // Notification Settings State
  const [notifications, setNotifications] = useState({
    emailNotification: true,
    analysisComplete: true,
    weeklySummary: true
  });

  const [recentActivity] = useState<{ id: string }[]>([]);

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

  const toggleNotification = (key: keyof typeof notifications) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <div className="flex min-h-screen bg-white overflow-hidden">
        {/* SIDEBAR */}
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
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${item.route === "/settings" ? "bg-[#249c74] text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
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
                  { name: "Profile", icon: User, onClick: () => navigate("/profile") },
                  { name: "Settings", icon: Settings, onClick: () => navigate("/settings") },
                  { name: "Logout", icon: ShieldAlert, onClick: () => setShowLogoutConfirm(true) },
                ].map((item) => (
                  <button
                    key={item.name}
                    onClick={item.onClick}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${item.name === "Settings" ? "bg-[#249c74] text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
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
                {getInitials(userName || "U")}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{userName || "User"}</p>
                <p className="text-xs text-gray-500 truncate">{userEmail || ""}</p>
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT */}
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
            <span className="font-semibold text-gray-900">Settings</span>
          </div>

          <div className="p-6 md:p-8 max-w-6xl mx-auto">
            
            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b border-gray-200">
              <button
                onClick={() => setActiveTab("profile")}
                className={`px-4 py-2 font-semibold text-sm transition-colors ${
                  activeTab === "profile"
                    ? "text-gray-900 border-b-2 border-[#249c74]"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
              
              </button>
            </div>

            {/* Settings Tab Content */}
            { (
              <div className="space-y-6">
                {/* Notification Settings */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <Bell className="w-5 h-5 text-[#c9a654]" />
                    <h2 className="text-lg font-bold text-gray-900">Notification</h2>
                  </div>

                  <div className="space-y-4">
                    {/* Email Notification */}
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      <div>
                        <p className="font-semibold text-gray-800">Email notification</p>
                        <p className="text-sm text-gray-600">Receive updates about your projects via email</p>
                      </div>
                      <button
                        onClick={() => toggleNotification('emailNotification')}
                        className={`relative w-12 h-6 rounded-full transition-colors ${notifications.emailNotification ? 'bg-[#c9a654]' : 'bg-gray-300'}`}
                      >
                        <div
                          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                            notifications.emailNotification ? 'translate-x-6' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Analysis Complete Alerts */}
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      <div>
                        <p className="font-semibold text-gray-800">Analysis complete alerts</p>
                        <p className="text-sm text-gray-600">Get notified when AI analysis is ready</p>
                      </div>
                      <button
                        onClick={() => toggleNotification('analysisComplete')}
                        className={`relative w-12 h-6 rounded-full transition-colors ${notifications.analysisComplete ? 'bg-[#c9a654]' : 'bg-gray-300'}`}
                      >
                        <div
                          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                            notifications.analysisComplete ? 'translate-x-6' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Weekly Summary */}
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      <div>
                        <p className="font-semibold text-gray-800">Weekly summary</p>
                        <p className="text-sm text-gray-600">Receive a weekly digest of your activities</p>
                      </div>
                      <button
                        onClick={() => toggleNotification('weeklySummary')}
                        className={`relative w-12 h-6 rounded-full transition-colors ${notifications.weeklySummary ? 'bg-[#c9a654]' : 'bg-gray-300'}`}
                      >
                        <div
                          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                            notifications.weeklySummary ? 'translate-x-6' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <Lightning className="w-5 h-5 text-[#c9a654]" />
                    <h2 className="text-lg font-bold text-gray-900">Recent Activity</h2>
                  </div>
                  <div className="space-y-3">
                    {recentActivity.length === 0 ? (
                      <p className="text-gray-500 text-sm">No recent activity</p>
                    ) : (
                      recentActivity.map((item) => (
                        <div key={item.id} className="p-3 hover:bg-gray-50 rounded-lg transition-colors">
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            
          </div>
        </main>
      </div>

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
    </>
  );
};

export default SettingsPage;
