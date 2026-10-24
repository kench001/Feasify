import React, { useEffect, useState } from "react";
import { useLanguage } from "./context/LanguageContext";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import Skeleton from "react-loading-skeleton";
import MobileBurgerButton from "./components/MobileBurgerButton";
import SidebarCloseButton from "./components/SidebarCloseButton";
import { auth, db, signOutUser } from "./firebase";
import {
  onAuthStateChanged,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  query,
  collection,
  where,
  getDocs,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import {
  User,
  Settings as SettingsIcon,
  ShieldAlert,
  Bell,
  Lock,
  Moon,
  Globe,
  Clock,
  Search,
  Eye,
  EyeOff,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Users,
  ShieldCheck,
  Tag,
  Sliders,
  Cpu,
  Layers,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RotateCcw,
  Filter,
  Calendar,
} from "lucide-react";
import ScrollToTopButton from "./components/ScrollToTopButton";
import CustomDropdown from "./components/CustomDropdown";

export interface AuditRecord {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "APPROVE" | "REJECT" | "REVISION" | "SUBMIT" | "LOGIN";
  sectionCode: string;
  description: string;
  recordId?: string;
  oldValue?: any;
  newValue?: any;
  status: string;
  createdAt: any;
}

interface AdviserSettingsProps {
  defaultTab?: "profile" | "system" | "audit";
}

const AdviserSettings: React.FC<AdviserSettingsProps> = ({ defaultTab = "profile" }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Determine active tab
  const tabParam = searchParams.get("tab") as "profile" | "system" | "audit" | null;
  const [activeTab, setActiveTab] = useState<"profile" | "system" | "audit">(
    tabParam || defaultTab
  );

  useEffect(() => {
    if (tabParam && (tabParam === "profile" || tabParam === "system" || tabParam === "audit")) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (tab: "profile" | "system" | "audit") => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const [userName, setUserName] = useState("Adviser");
  const [adviserUid, setAdviserUid] = useState("");
  const [adviserSections, setAdviserSections] = useState<string[]>([]);
  const [activeSection, setActiveSection] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  // Profile Form Data
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    section: "",
  });

  // Section Configuration State (System Settings)
  const [sectionSettingsMap, setSectionSettingsMap] = useState<
    Record<string, { minMembers: number; maxMembers: number }>
  >({});
  const [minMembers, setMinMembers] = useState(8);
  const [maxMembers, setMaxMembers] = useState(10);
  const [isSavingSectionSettings, setIsSavingSectionSettings] = useState(false);
  const [sectionSettingsSuccess, setSectionSettingsSuccess] = useState("");

  // Modals & Forms
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showForcePasswordModal, setShowForcePasswordModal] = useState(false);
  const [showForcePasswordSuccess, setShowForcePasswordSuccess] = useState(false);
  const [isFirstTimePasswordChange, setIsFirstTimePasswordChange] = useState(false);

  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  const [newUsername, setNewUsername] = useState("");
  const [pwdData, setPwdData] = useState({ current: "", new: "", confirm: "" });
  const [forcePwdData, setForcePwdData] = useState({ new: "", confirm: "" });

  const [isLoading, setIsLoading] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalSuccess, setModalSuccess] = useState("");

  // System Preferences
  const { language: currentLang, setLanguage: setGlobalLanguage } = useLanguage();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [language, setLanguage] = useState<string>(currentLang);
  const [prefSaveNotice, setPrefSaveNotice] = useState("");

  useEffect(() => {
    setLanguage(currentLang);
  }, [currentLang]);

  // Initialize theme and language
  useEffect(() => {
    const savedTheme = localStorage.getItem("feasify_theme");
    const isDark = savedTheme === "dark" || document.documentElement.classList.contains("dark");
    setDarkModeEnabled(isDark);
    const savedLang = localStorage.getItem("feasify_lang") || "English (US)";
    setLanguage(savedLang);
  }, []);

  const handleToggleDarkMode = (enable: boolean) => {
    setDarkModeEnabled(enable);
    if (enable) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("feasify_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("feasify_theme", "light");
    }
  };

  const handleChangeLanguage = async (newLang: string) => {
    const normalized = (newLang === "Filipino" || newLang === "Filipino (Tagalog)") ? "Filipino" : "English";
    setLanguage(normalized);
    setGlobalLanguage(normalized);
    setPrefSaveNotice(`Language set to ${normalized}.`);
    setTimeout(() => setPrefSaveNotice(""), 3500);
    if (auth.currentUser) {
      try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
          "preferences.language": normalized,
        });
      } catch (e) {
        console.warn("Could not save language preference to Firestore", e);
      }
    }
  };

  // Audit Logs State (Adviser Scoped)
  const [logs, setLogs] = useState<AuditRecord[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [selectedSectionFilter, setSelectedSectionFilter] = useState("ALL");
  const [selectedActionFilter, setSelectedActionFilter] = useState("ALL");
  const [selectedUserFilter, setSelectedUserFilter] = useState("ALL");
  const [selectedDate, setSelectedDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditRecord | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ROWS_PER_PAGE = 10;

  // Auth & Adviser Details Fetching
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setAdviserUid(u.uid);
        try {
          const userSnap = await getDoc(doc(db, "users", u.uid));
          if (userSnap.exists()) {
            const data = userSnap.data();
            if (data.role !== "Adviser" && u.email !== "chairperson@gmail.com") {
              navigate("/adviser/dashboard");
              return;
            }

            const fullName = `${data.firstName || ""} ${data.lastName || ""}`.trim();
            setUserName(fullName || "Adviser");

            const rawSection = data.section || "Unassigned";
            const parsedSections = rawSection
              .split(",")
              .map((s: string) => s.trim())
              .filter(Boolean)
              .sort((a: string, b: string) =>
                a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
              );

            setAdviserSections(parsedSections);
            if (parsedSections.length > 0 && !activeSection) {
              setActiveSection(parsedSections[0]);
            }

            if (data.sectionSettings) {
              setSectionSettingsMap(data.sectionSettings);
            }

            if (data.preferences?.language) {
              const normalized = (data.preferences.language === "Filipino" || data.preferences.language === "Filipino (Tagalog)") ? "Filipino" : "English";
              setLanguage(normalized);
              setGlobalLanguage(normalized);
            }

            setProfileData({
              firstName: data.firstName || "",
              lastName: data.lastName || "",
              username: data.username || data.firstName?.toLowerCase() || "adviser",
              email: u.email || data.email || "",
              section: rawSection,
            });
          }
        } catch (e) {
          console.error("Adviser data fetch error:", e);
        }
      } else {
        navigate("/");
      }
    });
    return () => unsub();
  }, [navigate]);

  // Sync active section configuration
  useEffect(() => {
    if (activeSection && sectionSettingsMap[activeSection]) {
      setMinMembers(sectionSettingsMap[activeSection].minMembers ?? 8);
      setMaxMembers(sectionSettingsMap[activeSection].maxMembers ?? 10);
    } else {
      setMinMembers(8);
      setMaxMembers(10);
    }
  }, [activeSection, sectionSettingsMap]);

  // Notifications Count
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const q = query(
            collection(db, "notifications"),
            where("userId", "==", u.uid),
            where("isRead", "==", false)
          );
          const snap = await getDocs(q);
          setUnreadNotificationCount(snap.size);
        } catch (error) {
          console.error("Notifications fetch error:", error);
        }
      }
    });
    return () => unsub();
  }, []);

  // Check forced password state
  useEffect(() => {
    const state = location.state as any;
    if (state && state.forcePasswordChange) {
      setShowForcePasswordModal(true);
      setIsFirstTimePasswordChange(true);
      setActiveTab("profile");
    }
  }, [location]);

  // Real-time Firestore Query for Audit Logs restricted to adviser's assigned sections
  useEffect(() => {
    if (adviserSections.length === 0) {
      setIsLoadingLogs(false);
      setLogs([]);
      return;
    }

    setIsLoadingLogs(true);
    const targetSections =
      selectedSectionFilter === "ALL"
        ? adviserSections
        : adviserSections.filter((s) => s === selectedSectionFilter);

    if (targetSections.length === 0) {
      setLogs([]);
      setIsLoadingLogs(false);
      return;
    }

    const logsQuery = query(
      collection(db, "audit_logs"),
      where("sectionCode", "in", targetSections.slice(0, 30)),
      orderBy("createdAt", "desc"),
      limit(200)
    );

    const unsubLogs = onSnapshot(
      logsQuery,
      (snapshot) => {
        const fetchedLogs: AuditRecord[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt?.toDate
              ? data.createdAt.toDate()
              : new Date(data.createdAt || Date.now()),
          } as AuditRecord;
        });
        setLogs(fetchedLogs);
        setIsLoadingLogs(false);
      },
      (error) => {
        console.error("Adviser audit logs listener error:", error);
        setIsLoadingLogs(false);
      }
    );

    return () => unsubLogs();
  }, [adviserSections, selectedSectionFilter]);

  // Handle Save Section Settings
  const handleSaveSectionSettings = async () => {
    if (!adviserUid || !activeSection) return;
    setIsSavingSectionSettings(true);
    setSectionSettingsSuccess("");
    try {
      const updatedMap = {
        ...sectionSettingsMap,
        [activeSection]: {
          minMembers: Number(minMembers),
          maxMembers: Number(maxMembers),
        },
      };

      await updateDoc(doc(db, "users", adviserUid), {
        sectionSettings: updatedMap,
      });

      setSectionSettingsMap(updatedMap);
      setSectionSettingsSuccess(`Saved settings for section ${activeSection}!`);
      setTimeout(() => setSectionSettingsSuccess(""), 3000);
    } catch (err) {
      console.error("Failed to save section settings:", err);
    } finally {
      setIsSavingSectionSettings(false);
    }
  };

  // Handle Username Update
  const handleChangeUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");
    setModalSuccess("");
    const trimmed = newUsername.trim();
    if (!trimmed || trimmed === profileData.username) return;
    setIsLoading(true);
    try {
      const user = auth.currentUser;
      if (user) {
        await setDoc(doc(db, "users", user.uid), { username: trimmed }, { merge: true });
        setProfileData((prev) => ({ ...prev, username: trimmed }));
        setModalSuccess("Username updated successfully!");
        setTimeout(() => setShowUsernameModal(false), 1500);
      }
    } catch (error: any) {
      setModalError(error.message || "Failed to update username.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Password Change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");
    setModalSuccess("");

    if (pwdData.new !== pwdData.confirm) {
      setModalError("New passwords do not match.");
      return;
    }
    if (pwdData.new.length < 6) {
      setModalError("Password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error("No authenticated user found");

      const credential = EmailAuthProvider.credential(user.email, pwdData.current);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, pwdData.new);

      await updateDoc(doc(db, "users", user.uid), {
        password: pwdData.new,
        updatedAt: new Date(),
      });

      setModalSuccess("Password updated successfully!");
      setPwdData({ current: "", new: "", confirm: "" });
      setTimeout(() => setShowPasswordModal(false), 1500);
    } catch (err: any) {
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setModalError("Incorrect current password.");
      } else {
        setModalError(err.message || "Failed to update password.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Forced Initial Password Change
  const handleForcePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");
    if (forcePwdData.new !== forcePwdData.confirm) {
      setModalError("Passwords do not match.");
      return;
    }
    setIsLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("No user logged in");
      await updatePassword(user, forcePwdData.new);
      await updateDoc(doc(db, "users", user.uid), {
        isFirstLogin: false,
        password: forcePwdData.new,
      });
      setShowForcePasswordModal(false);
      setShowForcePasswordSuccess(true);
    } catch (error: any) {
      setModalError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

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
      : "AD";

  // Dynamic Options for Filters
  const uniqueUsers = Array.from(new Set(logs.map((l) => l.userName).filter(Boolean))).sort();
  const availableRoles = [
    "ALL",
    "Leader",
    "Member",
    "Student",
    "Adviser",
    "Chairperson",
  ];

  const handleResetFilters = () => {
    setSelectedSectionFilter("ALL");
    setSelectedActionFilter("ALL");
    setSelectedUserFilter("ALL");
    setSelectedDate("");
    setSearchTerm("");
    setCurrentPage(1);
  };

  // Filtered Logs
  const filteredLogs = logs.filter((log) => {
    if (selectedSectionFilter !== "ALL" && log.sectionCode !== selectedSectionFilter) {
      return false;
    }
    if (selectedActionFilter !== "ALL" && log.action !== selectedActionFilter) {
      return false;
    }
    if (selectedUserFilter !== "ALL" && log.userName !== selectedUserFilter) {
      return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchDesc = log.description?.toLowerCase().includes(q);
      const matchUser = log.userName?.toLowerCase().includes(q);
      const matchRole = log.userRole?.toLowerCase().includes(q);
      const matchSection = log.sectionCode?.toLowerCase().includes(q);
      const matchAction = log.action?.toLowerCase().includes(q);
      if (!matchDesc && !matchUser && !matchRole && !matchSection && !matchAction) return false;
    }
    if (selectedDate) {
      const d = new Date(log.createdAt);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const logDateString = `${year}-${month}-${day}`;
      if (logDateString !== selectedDate) return false;
    }
    return true;
  });

  // 10 Rows per page pagination
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / ROWS_PER_PAGE));
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + ROWS_PER_PAGE);

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case "CREATE":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "UPDATE":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "DELETE":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "APPROVE":
        return "bg-teal-50 text-teal-700 border-teal-200";
      case "REJECT":
        return "bg-red-50 text-red-700 border-red-200";
      case "REVISION":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "SUBMIT":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const formatDate = (dateObj: any) => {
    if (!dateObj) return "N/A";
    const d = new Date(dateObj);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="flex min-h-screen bg-gray-50/50 font-sans">
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[50] lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ADVISER SIDEBAR */}
      <aside
        className={`flex flex-col fixed inset-y-0 z-[60] bg-[#122244] text-white shadow-xl transition-[width,transform] duration-300 ease-in-out group overflow-x-hidden ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 w-64 lg:w-16 lg:hover:w-64`}
      >
        {/* Logo Section */}
        <div className="h-16 flex items-center justify-between lg:justify-center px-4 lg:px-3 border-b border-white/10 shrink-0 overflow-hidden">
          {/* Logo.png when sidebar is folded (default) inside circular border with shadow effect */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-b from-white/15 to-white/5 border border-white/20 shadow-[0_4px_12px_rgba(0,0,0,0.35)] flex items-center justify-center overflow-hidden hidden lg:flex lg:group-hover:hidden shrink-0 select-none pointer-events-none">
            <img
              src="/Logo.png"
              alt="FeasiFy"
              className="w-full h-full object-contain scale-[1.35]"
              style={{ transform: "scale(1.35)" }}
            />
          </div>
          {/* dashboard logo when sidebar is hovered or on mobile */}
          <img
            src="/dashboard logo.png"
            alt="FeasiFy"
            className="h-10.5 w-auto max-h-[42px] max-w-[200px] object-contain select-none pointer-events-none block lg:hidden lg:group-hover:block shrink-0"
          />
          <SidebarCloseButton onClick={() => setIsSidebarOpen(false)} />
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto overflow-x-hidden">
          <button
            onClick={() => { setIsSidebarOpen(false); navigate("/adviser/dashboard"); }}
            title="Groups & Proposals"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-200 hover:text-white hover:bg-white/10 transition-colors group"
          >
            <Users className="w-5 h-5 shrink-0 text-[#c9a654] group-hover:text-[#f0c242] transition-colors" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              Groups & Proposals
            </span>
          </button>
          <button
            title="Settings"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-bold bg-[#c9a654] text-[#122244] transition-all shadow-md"
          >
            <SettingsIcon className="w-5 h-5 shrink-0 text-[#122244]" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              Settings
            </span>
          </button>
          <button
            onClick={() => { setIsSidebarOpen(false); navigate("/adviser/airules"); }}
            title="AI Rules"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-200 hover:text-white hover:bg-white/10 transition-colors group"
          >
            <Cpu className="w-5 h-5 shrink-0 text-[#c9a654] group-hover:text-[#f0c242] transition-colors" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              AI Rules
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
      <main
        className="flex-1 transition-all duration-300 ease-in-out min-h-screen flex flex-col lg:ml-16 ml-0"
      >
        <div className="bg-white border-b border-gray-100 shadow-[0_3px_10px_rgba(0,0,0,0.06)] px-4 sm:px-6 py-3 flex items-center justify-between text-sm text-gray-500 sticky top-0 z-30">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <MobileBurgerButton onClick={() => setIsSidebarOpen(!isSidebarOpen)} />
            <span
              className="font-semibold text-gray-900 hover:text-[#c9a654] cursor-pointer transition-colors shrink-0"
              onClick={() => navigate("/adviser/dashboard")}
            >
              FeasiFy
            </span>
            <span className="text-gray-400 shrink-0">›</span>
            <span className="font-semibold text-gray-900 truncate">Settings</span>
            <span className="text-gray-300 hidden sm:inline shrink-0">|</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#122244] text-white shadow-xs tracking-wide whitespace-nowrap hidden sm:inline-block shrink-0">
              Faculty Portal
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/adviser/notifications")}
              className="p-2 text-gray-500 hover:text-[#122244] hover:bg-gray-100 rounded-lg transition-all relative"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse ring-2 ring-white"></span>
              )}
            </button>
            <div className="h-6 w-px bg-gray-200"></div>
            <div
              onClick={() => handleTabChange("profile")}
              className="flex items-center gap-3 cursor-pointer hover:opacity-85 transition-opacity"
            >
              <div className="w-9 h-9 rounded-full bg-[#c9a654] text-white flex items-center justify-center font-bold text-sm shadow-xs flex-shrink-0">
                {getInitials(userName)}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-gray-900 leading-tight">
                  {userName || "Adviser"}
                </p>
                <p className="text-[10px] text-gray-400 font-medium">Feasibility Adviser</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 md:p-8 max-w-6xl mx-auto w-full space-y-6">
          {/* HEADER */}
          <div>
            <h1 className="text-3xl font-extrabold text-[#122244]">Adviser Settings</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage your profile details, customize academic section settings & preferences, and view section audit logs.
            </p>
          </div>

          {/* TABS NAVIGATION */}
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-3">
            <button
              onClick={() => handleTabChange("profile")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all shadow-xs ${
                activeTab === "profile"
                  ? "bg-[#122244] text-white shadow-md shadow-[#122244]/20"
                  : "bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              <User className="w-4 h-4 text-[#c9a654]" />
              <span>Profile Settings</span>
            </button>

            <button
              onClick={() => handleTabChange("system")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all shadow-xs ${
                activeTab === "system"
                  ? "bg-[#122244] text-white shadow-md shadow-[#122244]/20"
                  : "bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              <Sliders className="w-4 h-4 text-[#c9a654]" />
              <span>System Settings</span>
            </button>

            <button
              onClick={() => handleTabChange("audit")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all shadow-xs ${
                activeTab === "audit"
                  ? "bg-[#122244] text-white shadow-md shadow-[#122244]/20"
                  : "bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              <Clock className="w-4 h-4 text-[#c9a654]" />
              <span>Audit Logs</span>
            </button>
          </div>

          {/* TAB 1: PROFILE SETTINGS */}
          {activeTab === "profile" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="grid lg:grid-cols-2 gap-6">
                {/* ADVISER PROFILE CARD */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col items-center text-center">
                  <div className="w-24 h-24 rounded-full bg-[#c9a654] flex items-center justify-center text-white text-3xl font-black mb-4 shadow-md">
                    {getInitials(userName)}
                  </div>
                  <h3 className="text-xl font-bold text-[#122244]">{userName}</h3>
                  <p className="text-gray-500 font-semibold text-sm mb-4">
                    @{profileData.username}
                  </p>
                  <div className="w-full space-y-3 pt-4 mt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center text-xs font-bold text-gray-500">
                      <span>ROLE</span>
                      <span className="text-[#c9a654]">Feasibility Adviser</span>
                    </div>
                    <div className="text-left">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                        Assigned Sections
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {adviserSections.length === 0 ? (
                          <span className="text-xs text-gray-400 italic">No assigned sections</span>
                        ) : (
                          adviserSections.map((sec) => (
                            <span
                              key={sec}
                              className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-[#122244] border border-amber-200/70"
                            >
                              <Tag className="w-3 h-3 text-[#c9a654] mr-1" />
                              {sec}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ACCOUNT DETAILS CARD */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col justify-between">
                  <div>
                    <h2 className="text-lg font-bold mb-5 text-[#122244]">Account Details</h2>
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                          Email Address
                        </label>
                        <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 mt-1">
                          <span className="truncate">{profileData.email}</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                          User Handle
                        </label>
                        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 mt-1">
                          <span className="truncate">@{profileData.username}</span>
                          <button
                            onClick={() => {
                              setNewUsername(profileData.username);
                              setShowUsernameModal(true);
                            }}
                            className="text-[#c9a654] hover:text-[#b59545] font-bold text-xs ml-2 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 rounded-md transition-colors"
                          >
                            Update
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-gray-800">Password Security</p>
                      <p className="text-[11px] text-gray-500">Regularly update your login credentials.</p>
                    </div>
                    <button
                      onClick={() => {
                        setModalError("");
                        setModalSuccess("");
                        setShowPasswordModal(true);
                      }}
                      className="px-3 py-1.5 bg-[#122244] hover:bg-[#1c3260] text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      Change Password
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SYSTEM SETTINGS */}
          {activeTab === "system" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* SECTION GROUP CONFIGURATION */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="font-bold text-[#122244] text-base flex items-center gap-2">
                      <Layers className="w-5 h-5 text-[#c9a654]" /> Section Group Rules
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Configure min & max allowed team members per group for your assigned academic sections.
                    </p>
                  </div>
                </div>

                {adviserSections.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No assigned sections available to configure.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                          Select Section
                        </label>
                        <CustomDropdown
                          value={activeSection}
                          onChange={(val) => setActiveSection(val)}
                          options={adviserSections.map((sec) => ({ value: sec, label: sec }))}
                          buttonClassName="py-2 text-xs font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                          Min Members Per Group
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={minMembers}
                          onChange={(e) => setMinMembers(Number(e.target.value))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c9a654]/50"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                          Max Members Per Group
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={maxMembers}
                          onChange={(e) => setMaxMembers(Number(e.target.value))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c9a654]/50"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      {sectionSettingsSuccess ? (
                        <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" /> {sectionSettingsSuccess}
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-400">Settings apply immediately to section students.</span>
                      )}

                      <button
                        onClick={handleSaveSectionSettings}
                        disabled={isSavingSectionSettings}
                        className="px-4 py-2 bg-[#c9a654] hover:bg-[#b59545] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isSavingSectionSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Section Settings"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Preferences */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-visible relative z-30">
                <div className="p-5 border-b border-gray-100 bg-gray-50/50 rounded-t-2xl">
                  <h3 className="font-bold text-[#122244]">System Preferences</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  <div className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Bell className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-bold text-gray-900">Email Notifications</p>
                        <p className="text-xs text-gray-500">
                          Receive alerts when student groups submit new proposal revisions.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                      className={`w-12 h-6 rounded-full transition-colors relative ${
                        notificationsEnabled ? "bg-[#c9a654]" : "bg-gray-300"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${
                          notificationsEnabled ? "left-7" : "left-1"
                        }`}
                      ></div>
                    </button>
                  </div>

                  <div className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Moon className={`w-5 h-5 transition-colors ${darkModeEnabled ? "text-[#c9a654]" : "text-gray-400"}`} />
                      <div>
                        <p className="text-sm font-bold text-gray-900">Dark Mode (Beta)</p>
                        <p className="text-xs text-gray-500">Toggle dark appearance for the application.</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleDarkMode(!darkModeEnabled)}
                      className={`w-12 h-6 rounded-full transition-all relative cursor-pointer border ${
                        darkModeEnabled
                          ? "bg-[#c9a654] border-[#c9a654] shadow-[0_0_12px_rgba(201,166,84,0.45)]"
                          : "bg-gray-300 dark:bg-gray-700 border-gray-400/40 dark:border-gray-500"
                      }`}
                      title={darkModeEnabled ? "Disable dark mode" : "Enable dark mode"}
                    >
                      <div
                        className={`w-4 h-4 bg-white rounded-full absolute top-[3px] shadow-sm transition-all ${
                          darkModeEnabled ? "left-7" : "left-1"
                        }`}
                      ></div>
                    </button>
                  </div>

                  <div className="p-5 flex items-center justify-between rounded-b-2xl">
                    <div className="flex items-center gap-3">
                      <Globe className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-bold text-gray-900">Language</p>
                        <p className="text-xs text-gray-500">Currently active language for FeasiFy.</p>
                      </div>
                    </div>
                    <div className="w-48">
                      <CustomDropdown
                        value={language}
                        onChange={(val) => handleChangeLanguage(val)}
                        options={[
                          { value: "English", label: "English" },
                          { value: "Filipino", label: "Filipino (Tagalog)" },
                        ]}
                        buttonClassName="py-1.5 text-xs font-bold"
                        direction="down"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Security Card */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden relative z-10">
                <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                  <h3 className="font-bold text-[#122244]">Security & Authentication</h3>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Lock className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-bold text-gray-900">Password</p>
                        <p className="text-xs text-gray-500">Change your adviser account password.</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setModalError("");
                        setModalSuccess("");
                        setShowPasswordModal(true);
                      }}
                      className="px-4 py-2 border border-gray-200 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-50 transition-colors shadow-xs"
                    >
                      Change Password
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AUDIT LOGS */}
          {activeTab === "audit" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* ASSIGNED SECTIONS CARD */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#c9a654]" /> Scoped Section Access
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {adviserSections.length === 0 ? (
                      <span className="text-xs text-gray-400 italic">No assigned sections</span>
                    ) : (
                      adviserSections.map((sec) => (
                        <span
                          key={sec}
                          className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-[#122244] border border-amber-200/70"
                        >
                          <Tag className="w-3 h-3 text-[#c9a654] mr-1" />
                          {sec}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <div className="text-xs text-gray-500 font-medium bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100 self-start md:self-auto flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-gray-400" /> Real-time activity sync
                </div>
              </div>

              {/* FILTERS TOOLBAR */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-[#c9a654]" />
                    <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                      Faculty Audit Trail & Activity Logs
                    </span>
                  </div>
                  <button
                    onClick={handleResetFilters}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-500 hover:text-[#122244] hover:bg-gray-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                    title="Reset all filters"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset Filters
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* SECTION FILTER */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Section
                    </label>
                    <CustomDropdown
                      value={selectedSectionFilter}
                      onChange={(val) => {
                        setSelectedSectionFilter(val);
                        setCurrentPage(1);
                      }}
                      options={[
                        { value: "ALL", label: "All Sections" },
                        ...adviserSections.map((sec) => ({ value: sec, label: sec })),
                      ]}
                      buttonClassName="py-2 text-xs font-semibold"
                    />
                  </div>

                  {/* USER / MEMBER FILTER */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Member / User
                    </label>
                    <CustomDropdown
                      value={selectedUserFilter}
                      onChange={(val) => {
                        setSelectedUserFilter(val);
                        setCurrentPage(1);
                      }}
                      options={[
                        { value: "ALL", label: "All Members" },
                        ...uniqueUsers.map((uName) => ({ value: uName, label: uName })),
                      ]}
                      buttonClassName="py-2 text-xs font-semibold"
                    />
                  </div>

                  {/* ACTION FILTER */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Action
                    </label>
                    <CustomDropdown
                      value={selectedActionFilter}
                      onChange={(val) => {
                        setSelectedActionFilter(val);
                        setCurrentPage(1);
                      }}
                      options={[
                        { value: "ALL", label: "All Actions" },
                        { value: "CREATE", label: "CREATE" },
                        { value: "UPDATE", label: "UPDATE" },
                        { value: "DELETE", label: "DELETE" },
                        { value: "APPROVE", label: "APPROVE" },
                        { value: "REJECT", label: "REJECT" },
                        { value: "REVISION", label: "REVISION" },
                        { value: "SUBMIT", label: "SUBMIT" },
                        { value: "LOGIN", label: "LOGIN" },
                      ]}
                      buttonClassName="py-2 text-xs font-semibold"
                    />
                  </div>

                  {/* SINGLE DATE FILTER */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c9a654]/50 cursor-pointer"
                    />
                  </div>
                </div>

                {/* SEARCH INPUT */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search logs across your sections by description, member name, role, action..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c9a654]/50 transition-all"
                  />
                </div>
              </div>

              {/* AUDIT LOGS TABLE */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50/70 text-gray-500 font-bold uppercase tracking-wider text-[11px] border-b border-gray-100">
                      <tr>
                        <th className="px-5 py-3.5">Date & Time</th>
                        <th className="px-5 py-3.5">Action</th>
                        <th className="px-5 py-3.5">Section</th>
                        <th className="px-5 py-3.5">Description</th>
                        <th className="px-5 py-3.5">Member / User</th>
                        <th className="px-5 py-3.5">Role</th>
                        <th className="px-5 py-3.5 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium">
                      {isLoadingLogs ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <tr key={i}>
                            <td className="px-5 py-3.5"><Skeleton width={120} /></td>
                            <td className="px-5 py-3.5"><Skeleton width={60} height={18} borderRadius={6} /></td>
                            <td className="px-5 py-3.5"><Skeleton width={50} /></td>
                            <td className="px-5 py-3.5"><Skeleton width={200} /></td>
                            <td className="px-5 py-3.5"><Skeleton width={100} /></td>
                            <td className="px-5 py-3.5"><Skeleton width={60} /></td>
                            <td className="px-5 py-3.5 text-right"><Skeleton width={40} /></td>
                          </tr>
                        ))
                      ) : filteredLogs.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-10 text-center text-gray-400">
                            <Clock className="w-7 h-7 text-gray-300 mx-auto mb-2" />
                            <p className="font-semibold text-gray-600">No activity records found</p>
                            <p className="text-[11px] text-gray-400 mt-1">
                              No log events match your selected filters.
                            </p>
                          </td>
                        </tr>
                      ) : (
                        paginatedLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-amber-50/30 transition-colors">
                            <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">
                              {formatDate(log.createdAt)}
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${getActionBadgeColor(
                                  log.action
                                )}`}
                              >
                                {log.action}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap font-bold text-[#122244]">
                              <span className="inline-block bg-gray-100 text-gray-800 px-2 py-0.5 rounded font-mono text-[10px]">
                                {log.sectionCode || "N/A"}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-gray-900 font-semibold max-w-sm truncate">
                              {log.description}
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap text-gray-700">
                              <div className="font-semibold">{log.userName || "System"}</div>
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
                                {log.userRole || "Student"}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right whitespace-nowrap">
                              <button
                                onClick={() => setSelectedLog(log)}
                                className="p-1.5 text-gray-500 hover:text-[#c9a654] hover:bg-amber-50 rounded-lg transition-colors inline-flex items-center gap-1 font-semibold text-[11px] cursor-pointer"
                                title="View details"
                              >
                                <Eye className="w-3.5 h-3.5" /> View
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 10 ROWS PER PAGE PAGINATION BAR */}
                <div className="px-5 py-3.5 bg-gray-50/70 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
                  <div className="flex items-center gap-2 font-medium">
                    <span>
                      Showing{" "}
                      <strong className="text-gray-900">
                        {filteredLogs.length === 0 ? 0 : startIndex + 1}
                      </strong>{" "}
                      to{" "}
                      <strong className="text-gray-900">
                        {Math.min(startIndex + ROWS_PER_PAGE, filteredLogs.length)}
                      </strong>{" "}
                      of <strong className="text-gray-900">{filteredLogs.length}</strong> logs (10 rows/page)
                    </span>
                    <span className="text-gray-300">|</span>
                    <span className="text-[11px] text-gray-500">Page {currentPage} of {totalPages}</span>
                  </div>

                  {/* Pagination Controls */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                      title="First Page"
                    >
                      <ChevronsLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center gap-1 cursor-pointer"
                      title="Previous Page"
                    >
                      <ChevronLeft className="w-4 h-4" /> Prev
                    </button>

                    {/* Numeric Page Buttons */}
                    <div className="flex items-center gap-1 mx-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(
                          (p) =>
                            p === 1 ||
                            p === totalPages ||
                            Math.abs(p - currentPage) <= 1
                        )
                        .map((p, idx, arr) => {
                          const showEllipsis = idx > 0 && p - arr[idx - 1] > 1;
                          return (
                            <React.Fragment key={p}>
                              {showEllipsis && (
                                <span className="px-1 text-gray-400">...</span>
                              )}
                              <button
                                onClick={() => setCurrentPage(p)}
                                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                  currentPage === p
                                    ? "bg-[#122244] text-white shadow-xs"
                                    : "border border-gray-200 text-gray-700 hover:bg-gray-100"
                                }`}
                              >
                                {p}
                              </button>
                            </React.Fragment>
                          );
                        })}
                    </div>

                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages || filteredLogs.length === 0}
                      className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center gap-1 cursor-pointer"
                      title="Next Page"
                    >
                      Next <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages || filteredLogs.length === 0}
                      className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                      title="Last Page"
                    >
                      <ChevronsRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODAL: UPDATE USERNAME */}
      {showUsernameModal && (
        <div className="fixed inset-0 bg-[#122244]/80 backdrop-blur-xs flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-[#122244] mb-4">Update User Handle</h3>
            <form onSubmit={handleChangeUsername} className="space-y-4">
              {modalError && (
                <div className="bg-red-50 text-red-600 text-xs p-3 rounded-lg flex items-center gap-2 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {modalError}
                </div>
              )}
              {modalSuccess && (
                <div className="bg-green-50 text-green-600 text-xs p-3 rounded-lg flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {modalSuccess}
                </div>
              )}
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  New User Handle
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder={`@${profileData.username}`}
                  className="w-full mt-1.5 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-[#c9a654]/50 transition-all"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowUsernameModal(false);
                    setModalError("");
                    setModalSuccess("");
                  }}
                  className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 rounded-xl bg-[#c9a654] hover:bg-[#b59545] text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CHANGE PASSWORD */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-[#122244]/80 backdrop-blur-xs flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#122244] flex items-center gap-2">
                <Lock className="w-5 h-5 text-[#c9a654]" /> Change Password
              </h3>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              {modalError && (
                <div className="bg-red-50 text-red-600 text-xs p-3 rounded-lg flex items-center gap-2 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {modalError}
                </div>
              )}
              {modalSuccess && (
                <div className="bg-green-50 text-green-600 text-xs p-3 rounded-lg flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {modalSuccess}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPwd ? "text" : "password"}
                    value={pwdData.current}
                    onChange={(e) => setPwdData({ ...pwdData, current: e.target.value })}
                    required
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 pr-10 outline-none focus:ring-2 focus:ring-[#c9a654]/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showCurrentPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPwd ? "text" : "password"}
                    value={pwdData.new}
                    onChange={(e) => setPwdData({ ...pwdData, new: e.target.value })}
                    required
                    minLength={6}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 pr-10 outline-none focus:ring-2 focus:ring-[#c9a654]/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPwd(!showNewPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPwd ? "text" : "password"}
                    value={pwdData.confirm}
                    onChange={(e) => setPwdData({ ...pwdData, confirm: e.target.value })}
                    required
                    minLength={6}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 pr-10 outline-none focus:ring-2 focus:ring-[#c9a654]/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showConfirmPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 rounded-xl bg-[#122244] hover:bg-[#1c3260] text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FORCE PASSWORD CHANGE MODAL */}
      {showForcePasswordModal && (
        <div className="fixed inset-0 bg-[#122244]/90 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600">
                <ShieldAlert className="w-8 h-8" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-center text-[#122244] mb-2">Security Update Required</h3>
            <p className="text-sm text-center text-gray-500 mb-8 font-medium">
              Please change your default password to continue.
            </p>

            <form onSubmit={handleForcePasswordChange} className="space-y-5">
              {modalError && (
                <div className="bg-red-50 text-red-600 text-sm p-4 rounded-xl flex items-center gap-2 font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {modalError}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showNewPwd ? "text" : "password"}
                    value={forcePwdData.new}
                    onChange={(e) => setForcePwdData({ ...forcePwdData, new: e.target.value })}
                    className="w-full pl-12 pr-12 py-3.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-[#c9a654]/50 transition-all"
                    placeholder="Enter new password"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPwd(!showNewPwd)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showConfirmPwd ? "text" : "password"}
                    value={forcePwdData.confirm}
                    onChange={(e) => setForcePwdData({ ...forcePwdData, confirm: e.target.value })}
                    className="w-full pl-12 pr-12 py-3.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-[#c9a654]/50 transition-all"
                    placeholder="Confirm new password"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#c9a654] hover:bg-[#b59545] text-white py-3.5 rounded-xl font-black text-sm uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-4 shadow-md"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Update Password"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* FORCE PASSWORD SUCCESS MODAL */}
      {showForcePasswordSuccess && (
        <div className="fixed inset-0 bg-[#122244]/90 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl text-center animate-in zoom-in-95 duration-200">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                <CheckCircle2 className="w-8 h-8" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-[#122244] mb-2">Password Updated!</h3>
            <p className="text-sm text-gray-500 mb-8 font-medium">
              {isFirstTimePasswordChange
                ? "Your password has been successfully set. Please log in again with your new password."
                : "Your password has been successfully secured."}
            </p>
            <button
              onClick={() => {
                setShowForcePasswordSuccess(false);
                if (isFirstTimePasswordChange) {
                  signOutUser().catch(console.error);
                  localStorage.clear();
                  sessionStorage.clear();
                  setIsFirstTimePasswordChange(false);
                  navigate("/");
                } else {
                  handleTabChange("profile");
                }
              }}
              className="w-full bg-[#122244] hover:bg-black text-white py-3.5 rounded-xl font-black text-sm uppercase tracking-wider transition-colors shadow-md"
            >
              {isFirstTimePasswordChange ? "Re-login" : "Continue"}
            </button>
          </div>
        </div>
      )}

      {/* DETAIL MODAL: AUDIT LOG */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-[#122244] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#c9a654]" />
                <h3 className="font-bold text-base">Audit Trail Entry Details</h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 text-gray-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Timestamp</span>
                  <span className="font-semibold text-gray-800">{formatDate(selectedLog.createdAt)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Section Code</span>
                  <span className="font-bold text-[#122244] bg-white border border-gray-200 px-2 py-0.5 rounded text-[11px] inline-block mt-0.5">
                    {selectedLog.sectionCode}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Action</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border mt-0.5 ${getActionBadgeColor(selectedLog.action)}`}>
                    {selectedLog.action}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">User</span>
                  <span className="font-semibold text-gray-800">{selectedLog.userName} ({selectedLog.userRole || "User"})</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Description</span>
                <p className="p-3 bg-gray-50 rounded-xl text-gray-900 font-medium border border-gray-100">
                  {selectedLog.description}
                </p>
              </div>

              {selectedLog.recordId && (
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Record ID</span>
                  <code className="block p-2 bg-gray-100 rounded-lg text-gray-700 font-mono text-[11px]">
                    {selectedLog.recordId}
                  </code>
                </div>
              )}

              {selectedLog.oldValue && (
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Previous State</span>
                  <pre className="p-3 bg-gray-900 text-gray-100 rounded-xl overflow-x-auto text-[10px] font-mono">
                    {JSON.stringify(selectedLog.oldValue, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.newValue && (
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1">New State</span>
                  <pre className="p-3 bg-gray-900 text-emerald-300 rounded-xl overflow-x-auto text-[10px] font-mono">
                    {JSON.stringify(selectedLog.newValue, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-[#122244] text-white font-semibold rounded-xl text-xs hover:bg-[#1c3260] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setShowLogoutConfirm(false)}
          />
          <div className="bg-white rounded-2xl p-6 z-10 w-11/12 max-w-sm shadow-xl animate-in fade-in zoom-in-95 duration-200 text-center">
            <h3 className="text-lg font-bold text-[#122244] mb-2">Confirm logout</h3>
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to log out of your session?</p>
            <div className="flex justify-end gap-3">
              <button
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md transition-colors"
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
      {/* Scroll to Top */}
      <ScrollToTopButton />
    </div>
  );
};

export default AdviserSettings;
