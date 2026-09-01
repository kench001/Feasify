import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db, signOutUser } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc, query, collection, where, getDocs } from "firebase/firestore";
import {
  User,
  Settings as SettingsIcon,
  ShieldAlert,
  Sidebar as SidebarIcon,
  Bell,
  Cpu,
  Save,
  CheckCircle,
  Clock
} from "lucide-react";

const AdviserAIRules: React.FC = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("Adviser");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Section Management State
  const [adviserSections, setAdviserSections] = useState<string[]>([]);
  const [activeSection, setActiveSection] = useState("");
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  // Custom AI Rules State
  const [customAIRules, setCustomAIRules] = useState({
    tone: "",
    dealbreakers: "",
    focusAreas: "",
    formatting: ""
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUserId(u.uid);
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
            
            setAdviserSections(parsedSections);

            // Load Custom AI Rules
            if (data.customAIRules) {
              setCustomAIRules({
                tone: data.customAIRules.tone || "",
                dealbreakers: data.customAIRules.dealbreakers || "",
                focusAreas: data.customAIRules.focusAreas || "",
                formatting: data.customAIRules.formatting || ""
              });
            }
          }
        } catch (e) {}
      } else {
        navigate("/");
      }
    });
    return () => unsub();
  }, [navigate]);

  const handleSaveRules = async () => {
    if (!userId) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "users", userId), {
        customAIRules: customAIRules
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving AI rules:", error);
    } finally {
      setIsSaving(false);
    }
  };



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
    <div className="flex min-h-screen bg-gray-50/50 overflow-hidden">
      {/* ADVISER SIDEBAR */}
      <aside
        className={`hidden lg:flex w-64 bg-[#122244] text-white flex-col fixed inset-y-0 shadow-xl z-20 transition-transform duration-300 ease-in-out ${
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

        <nav className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-8">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">
              Main Menu
            </p>
            <div className="space-y-1">
              <button onClick={() => navigate("/adviser/dashboard")} className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-semibold bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 transition-all shadow-md">
                <span>My Sections</span>
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">All</span>
              </button>
              <div className="pl-4 pr-2 py-2 space-y-1.5">
                {adviserSections.map((sectionName) => (
                  <button
                    key={sectionName}
                    onClick={() => {
                      navigate(`/adviser/dashboard?section=${encodeURIComponent(sectionName)}`);
                    }}
                    className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-all ${
                      activeSection === sectionName
                        ? "bg-[#c9a654] text-white font-bold shadow-sm"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {sectionName}
                  </button>
                ))}
              </div>
              <button
                onClick={() => navigate("/adviser/audit-trail")}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold text-gray-300 hover:text-white hover:bg-white/10 transition-all mt-2"
              >
                <Clock className="w-4 h-4" /> Audit Trail
              </button>
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
              <button onClick={() => navigate("/adviser/settings")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-all">
                <SettingsIcon className="w-4 h-4" /> Settings
              </button>
              <button onClick={() => navigate("/adviser/airules")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold bg-[#c9a654] text-white hover:bg-white/10 transition-all shadow-md">
                <Cpu className="w-4 h-4" /> AI Rules
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
        <div className="bg-white border-b border-gray-100 p-4 flex items-center gap-2 text-sm text-gray-500">
          <SidebarIcon
            className="w-4 h-4 cursor-pointer hover:text-gray-800 transition-colors"
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
          <span className="font-semibold text-gray-900">Settings</span>
        </div>

        <div className="p-6 md:p-8 max-w-4xl mx-auto w-full">
          <h1 className="text-3xl font-extrabold text-[#3d2c23] mb-8">
            Settings
          </h1>

          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-[#122244] flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-[#c9a654]" /> Custom AI Rules
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Set specific guidelines for how the AI evaluates your students' proposals.
                  </p>
                </div>
                <button
                  onClick={handleSaveRules}
                  disabled={isSaving}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all ${
                    saveSuccess ? "bg-green-600 text-white" : "bg-[#c9a654] text-white hover:bg-[#b59545]"
                  } disabled:opacity-70`}
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : saveSuccess ? (
                    <>
                      <CheckCircle className="w-4 h-4" /> Saved!
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" /> Save Rules
                    </>
                  )}
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Tone */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-bold text-gray-900">
                      Tone & Style
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={customAIRules.tone !== ""}
                        onChange={(e) => setCustomAIRules({ ...customAIRules, tone: e.target.checked ? " " : "" })}
                        className="rounded border-gray-300 text-[#c9a654] focus:ring-[#c9a654]"
                      />
                      Override Default
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    How should the AI communicate? (e.g., Strict, encouraging, academic, constructive)
                  </p>
                  {customAIRules.tone !== "" ? (
                    <textarea
                      value={customAIRules.tone === " " ? "" : customAIRules.tone}
                      onChange={(e) => setCustomAIRules({ ...customAIRules, tone: e.target.value })}
                      className="w-full h-24 p-3 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#c9a654] resize-none"
                      placeholder="E.g., Be strict but constructive. Use an academic tone."
                      autoFocus
                    />
                  ) : (
                    <div className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 italic">
                      Default: Academic and constructive tone.
                    </div>
                  )}
                </div>

                {/* Dealbreakers */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-bold text-gray-900">
                      Dealbreakers
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={customAIRules.dealbreakers !== ""}
                        onChange={(e) => setCustomAIRules({ ...customAIRules, dealbreakers: e.target.checked ? " " : "" })}
                        className="rounded border-gray-300 text-[#c9a654] focus:ring-[#c9a654]"
                      />
                      Override Default
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    What issues should result in immediate rejection or major deductions?
                  </p>
                  {customAIRules.dealbreakers !== "" ? (
                    <textarea
                      value={customAIRules.dealbreakers === " " ? "" : customAIRules.dealbreakers}
                      onChange={(e) => setCustomAIRules({ ...customAIRules, dealbreakers: e.target.value })}
                      className="w-full h-24 p-3 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#c9a654] resize-none"
                      placeholder="E.g., Reject proposals with negative ROI or missing financial assumptions."
                      autoFocus
                    />
                  ) : (
                    <div className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 italic">
                      Default: None specific.
                    </div>
                  )}
                </div>

                {/* Focus Areas */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-bold text-gray-900">
                      Focus Areas
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={customAIRules.focusAreas !== ""}
                        onChange={(e) => setCustomAIRules({ ...customAIRules, focusAreas: e.target.checked ? " " : "" })}
                        className="rounded border-gray-300 text-[#c9a654] focus:ring-[#c9a654]"
                      />
                      Override Default
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    What specific aspects should the AI pay the most attention to?
                  </p>
                  {customAIRules.focusAreas !== "" ? (
                    <textarea
                      value={customAIRules.focusAreas === " " ? "" : customAIRules.focusAreas}
                      onChange={(e) => setCustomAIRules({ ...customAIRules, focusAreas: e.target.value })}
                      className="w-full h-24 p-3 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#c9a654] resize-none"
                      placeholder="E.g., Scrutinize the market analysis and competitor differentiation closely."
                      autoFocus
                    />
                  ) : (
                    <div className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 italic">
                      Default: General financial feasibility.
                    </div>
                  )}
                </div>

                {/* Formatting */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-bold text-gray-900">
                      Formatting
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={customAIRules.formatting !== ""}
                        onChange={(e) => setCustomAIRules({ ...customAIRules, formatting: e.target.checked ? " " : "" })}
                        className="rounded border-gray-300 text-[#c9a654] focus:ring-[#c9a654]"
                      />
                      Override Default
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    How should the AI structure its feedback output?
                  </p>
                  {customAIRules.formatting !== "" ? (
                    <textarea
                      value={customAIRules.formatting === " " ? "" : customAIRules.formatting}
                      onChange={(e) => setCustomAIRules({ ...customAIRules, formatting: e.target.value })}
                      className="w-full h-24 p-3 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#c9a654] resize-none"
                      placeholder="E.g., Use bullet points for all feedback. Keep explanations under 2 paragraphs."
                      autoFocus
                    />
                  ) : (
                    <div className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 italic">
                      Default: Follow standard output structure.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* LOGOUT CONFIRMATION */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowLogoutConfirm(false)}
          />
          <div className="bg-white rounded-2xl p-6 z-10 w-11/12 max-w-md shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-[#122244] mb-2">
              Confirm logout
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to log out?
            </p>
            <div className="flex justify-end gap-3">
              <button
                className="px-5 py-2.5 rounded-lg border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-md"
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

export default AdviserAIRules;
