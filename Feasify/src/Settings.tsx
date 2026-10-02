import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import Skeleton from "react-loading-skeleton";
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
} from "lucide-react";

interface Teammate {
  id: string;
  name: string;
  role: string;
  initials: string;
}

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

interface SettingsProps {
  defaultTab?: "profile" | "system" | "audit";
}

const Settings: React.FC<SettingsProps> = ({ defaultTab = "profile" }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Determine active tab from URL param or prop
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

  const [userName, setUserName] = useState("");
  const [userUid, setUserUid] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  // Profile Data State
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    groupName: "",
    section: "",
    roleInGroup: "",
  });

  const [teamCollaborators, setTeamCollaborators] = useState<Teammate[]>([]);
  const [isLoadingTeammates, setIsLoadingTeammates] = useState(true);

  // Modals for Profile
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

  // System Settings Preferences
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [language, setLanguage] = useState("English (US)");

  // Audit Logs State (Student Scope)
  const [logs, setLogs] = useState<AuditRecord[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [selectedActionFilter, setSelectedActionFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditRecord | null>(null);

  // Auth & Profile Fetch
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUserUid(u.uid);
        try {
          const userSnap = await getDoc(doc(db, "users", u.uid));
          if (userSnap.exists()) {
            const data = userSnap.data();
            const fullName = `${data.firstName || ""} ${data.lastName || ""}`.trim();
            setUserName(fullName || u.displayName || "Student");

            setProfileData({
              firstName: data.firstName || "",
              lastName: data.lastName || "",
              username: data.username || data.firstName?.toLowerCase() || "student",
              email: u.email || data.email || "",
              groupName: "Syncing...",
              section: data.section || "Not Assigned",
              roleInGroup: "",
            });

            if (data.section) {
              fetchTeamDetails(u.uid, data.section);
            }
          }
        } catch (e) {
          console.error("Error fetching user data:", e);
        }
      } else {
        navigate("/");
      }
    });
    return () => unsub();
  }, [navigate]);

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
          console.error("Error fetching unread notifications:", error);
        }
      }
    });
    return () => unsub();
  }, []);

  // Check forced password change trigger
  useEffect(() => {
    const state = location.state as any;
    if (state && state.forcePasswordChange) {
      setShowForcePasswordModal(true);
      setIsFirstTimePasswordChange(true);
      setActiveTab("profile");
    }
  }, [location]);

  // Fetch Team Details for Student
  const fetchTeamDetails = async (uid: string, section: string) => {
    setIsLoadingTeammates(true);
    try {
      const q = query(collection(db, "groups"), where("section", "==", section));
      const snap = await getDocs(q);
      let userGroup: any = null;
      let groupRole = "Member";

      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.leaderId === uid) {
          userGroup = { id: docSnap.id, ...data };
          groupRole = "Leader";
        } else if (data.memberIds?.includes(uid)) {
          userGroup = { id: docSnap.id, ...data };
          groupRole = "Member";
        }
      });

      if (userGroup) {
        setProfileData((prev) => ({
          ...prev,
          groupName: userGroup.groupName || `Group ${userGroup.groupNumber}`,
          roleInGroup: groupRole,
        }));

        const allMemberIds = Array.from(
          new Set([userGroup.leaderId, ...(userGroup.memberIds || [])])
        );
        const memberDetails = await Promise.all(
          allMemberIds.map(async (id) => {
            const s = await getDoc(doc(db, "users", id));
            const d = s.data();
            const name = d ? `${d.firstName} ${d.lastName}`.trim() : "Unknown User";
            return {
              id,
              name,
              role: id === userGroup.leaderId ? "Leader" : "Member",
              initials: name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2),
            };
          })
        );
        setTeamCollaborators(memberDetails);
      } else {
        setProfileData((prev) => ({ ...prev, groupName: "No Group Assigned" }));
      }
    } catch (e) {
      console.error("Team fetch error:", e);
    } finally {
      setIsLoadingTeammates(false);
    }
  };

  // Real-time Audit Logs Query for Student (their own activity & section activity)
  useEffect(() => {
    if (!userUid) return;
    setIsLoadingLogs(true);

    const logsQuery = query(
      collection(db, "audit_logs"),
      orderBy("createdAt", "desc"),
      limit(100)
    );

    const unsubLogs = onSnapshot(
      logsQuery,
      (snapshot) => {
        const fetchedLogs: AuditRecord[] = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              ...data,
              createdAt: data.createdAt?.toDate
                ? data.createdAt.toDate()
                : new Date(data.createdAt || Date.now()),
            } as AuditRecord;
          })
          .filter((log) => {
            // Student sees their own activities or activities in their section
            if (log.userId === userUid) return true;
            if (profileData.section && log.sectionCode === profileData.section) return true;
            return false;
          });

        setLogs(fetchedLogs);
        setIsLoadingLogs(false);
      },
      (error) => {
        console.error("Student audit logs error:", error);
        setIsLoadingLogs(false);
      }
    );

    return () => unsubLogs();
  }, [userUid, profileData.section]);

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

  // Handle Standard Password Change
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

      // Re-authenticate user first
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
      : "U";

  // Filtered Logs
  const filteredLogs = logs.filter((log) => {
    if (selectedActionFilter !== "ALL" && log.action !== selectedActionFilter) {
      return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchDesc = log.description?.toLowerCase().includes(q);
      const matchUser = log.userName?.toLowerCase().includes(q);
      const matchSection = log.sectionCode?.toLowerCase().includes(q);
      const matchAction = log.action?.toLowerCase().includes(q);
      if (!matchDesc && !matchUser && !matchSection && !matchAction) return false;
    }
    if (startDate) {
      const start = new Date(startDate);
      if (new Date(log.createdAt) < start) return false;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (new Date(log.createdAt) > end) return false;
    }
    return true;
  });

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
    <div className="flex min-h-screen bg-gray-50/50 overflow-hidden font-sans">
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[50] lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* STUDENT SIDEBAR */}
      <aside
        className={`flex w-64 bg-[#122244] text-white flex-col fixed inset-y-0 shadow-xl z-[60] transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 flex items-center gap-3 border-b border-white/10">
          <img src="/dashboard logo.png" alt="FeasiFy" className="w-70 h-20 object-contain" />
        </div>

        <nav className="flex-1 p-4 space-y-4 mt-2">
          <div className="space-y-1">
            <button
              onClick={() => navigate("/dashboard")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"
            >
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </button>
            <button
              onClick={() => navigate("/projects")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"
            >
              <Folder className="w-4 h-4" /> Business Proposal
            </button>
            <button
              onClick={() => navigate("/financial-input")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"
            >
              <FileEdit className="w-4 h-4" /> Financial Input
            </button>
            <button
              onClick={() => navigate("/ai-analysis")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"
            >
              <Zap className="w-4 h-4" /> AI Feasibility Analysis
            </button>
            <button
              onClick={() => navigate("/reports")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"
            >
              <BarChart3 className="w-4 h-4" /> Reports
            </button>
            <button
              onClick={() => navigate("/messages")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"
            >
              <MessageCircle className="w-4 h-4" /> Message
            </button>
          </div>

          <div className="pt-4 border-t border-white/10 space-y-1">
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold bg-[#c9a654] text-white transition-all shadow-md">
              <SettingsIcon className="w-4 h-4" /> Settings
            </button>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"
            >
              <ShieldAlert className="w-4 h-4" /> Logout
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-white/10 bg-black/20">
          <div className="flex items-center gap-3">
            <div
              onClick={() => handleTabChange("profile")}
              className="w-10 h-10 rounded-full bg-[#c9a654] flex items-center justify-center font-bold text-sm cursor-pointer hover:ring-2 hover:ring-white/40 transition-all"
            >
              {getInitials(userName)}
            </div>
            <div
              className="flex-1 min-w-0 cursor-pointer"
              onClick={() => handleTabChange("profile")}
            >
              <p className="text-sm font-semibold truncate text-white">{userName || "User"}</p>
              <p className="text-[10px] text-gray-400 truncate">Student</p>
            </div>
            <button
              onClick={() => navigate("/notifications")}
              className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-all relative shrink-0"
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
        <div className="bg-white border-b border-gray-100 p-4 flex items-center gap-2 text-sm text-gray-500 sticky top-0 z-10">
          <SidebarIcon
            className="w-4 h-4 cursor-pointer hover:text-gray-800 transition-colors"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          />
          <span className="mx-2">|</span>
          <span
            className="cursor-pointer hover:text-[#c9a654] transition-colors"
            onClick={() => navigate("/dashboard")}
          >
            FeasiFy
          </span>
          <span>›</span>
          <span className="font-semibold text-gray-900">Settings</span>
        </div>

        <div className="p-6 md:p-8 max-w-6xl mx-auto w-full space-y-6">
          {/* HEADER */}
          <div>
            <h1 className="text-3xl font-extrabold text-[#122244]">Settings</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage your personal profile, customize your preferences, and view your system audit logs.
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
                {/* USER PROFILE CARD */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col items-center text-center">
                  <div className="w-24 h-24 rounded-full bg-[#c9a654] flex items-center justify-center text-white text-3xl font-black mb-4 shadow-md">
                    {getInitials(userName)}
                  </div>
                  <h3 className="text-xl font-bold text-[#122244]">{userName}</h3>
                  <p className="text-gray-500 font-semibold text-sm mb-4">
                    @{profileData.username}
                  </p>
                  <div className="w-full space-y-2 pt-4 mt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center text-xs font-bold text-gray-500">
                      <span>SECTION</span>
                      <span className="text-[#122244] bg-gray-100 px-2 py-0.5 rounded font-mono">
                        {profileData.section}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold text-gray-500">
                      <span>ROLE</span>
                      <span className="text-[#c9a654] font-semibold">
                        {profileData.roleInGroup || "Student"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold text-gray-500">
                      <span>ASSIGNED GROUP</span>
                      <span className="text-gray-800 font-semibold truncate max-w-[200px]">
                        {profileData.groupName}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ACCOUNT DETAILS CARD */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col justify-between">
                  <div>
                    <h2 className="text-lg font-bold mb-5 text-[#122244]">Account Settings</h2>
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
                      <p className="text-xs font-bold text-gray-800">Password & Security</p>
                      <p className="text-[11px] text-gray-500">Keep your login credentials protected.</p>
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

              {/* TEAM COLLABORATORS */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h2 className="text-lg font-bold text-[#122244] mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#c9a654]" /> Team Collaborators
                </h2>
                {isLoadingTeammates ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="p-4 rounded-lg bg-gray-50 border border-gray-100">
                        <Skeleton height={20} width={120} />
                        <Skeleton height={14} width={80} className="mt-2" />
                      </div>
                    ))}
                  </div>
                ) : teamCollaborators.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 bg-gray-50 rounded-xl">
                    <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-xs font-semibold text-gray-600">No team members assigned yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {teamCollaborators.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center gap-3 p-4 rounded-lg bg-gray-50 border border-gray-200 hover:bg-white transition-all"
                      >
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0 ${
                            m.role === "Leader" ? "bg-purple-600" : "bg-[#122244]"
                          }`}
                        >
                          {m.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-[#122244] truncate">{m.name}</p>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                            {m.role}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: SYSTEM SETTINGS */}
          {activeTab === "system" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Preferences */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                  <h3 className="font-bold text-[#122244]">System Preferences</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  <div className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Bell className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-bold text-gray-900">Email Notifications</p>
                        <p className="text-xs text-gray-500">
                          Receive alerts when your adviser reviews or comments on your proposals.
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
                      <Moon className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-bold text-gray-900">Dark Mode (Beta)</p>
                        <p className="text-xs text-gray-500">Toggle dark appearance for the application.</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setDarkModeEnabled(!darkModeEnabled)}
                      className={`w-12 h-6 rounded-full transition-colors relative ${
                        darkModeEnabled ? "bg-[#122244]" : "bg-gray-300"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${
                          darkModeEnabled ? "left-7" : "left-1"
                        }`}
                      ></div>
                    </button>
                  </div>

                  <div className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Globe className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-bold text-gray-900">System Language</p>
                        <p className="text-xs text-gray-500">Currently active language for FeasiFy.</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-gray-700 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">
                      {language}
                    </span>
                  </div>
                </div>
              </div>

              {/* Security Card */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                  <h3 className="font-bold text-[#122244]">Security & Authentication</h3>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Lock className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-bold text-gray-900">Account Password</p>
                        <p className="text-xs text-gray-500">Update your current account credentials.</p>
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
              {/* FILTERS TOOLBAR */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* ACTION FILTER */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Action Type
                    </label>
                    <select
                      value={selectedActionFilter}
                      onChange={(e) => setSelectedActionFilter(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c9a654]/50"
                    >
                      <option value="ALL">All Actions</option>
                      <option value="CREATE">CREATE</option>
                      <option value="UPDATE">UPDATE</option>
                      <option value="DELETE">DELETE</option>
                      <option value="SUBMIT">SUBMIT</option>
                      <option value="APPROVE">APPROVE</option>
                      <option value="REJECT">REJECT</option>
                      <option value="REVISION">REVISION</option>
                      <option value="LOGIN">LOGIN</option>
                    </select>
                  </div>

                  {/* START DATE */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                      From Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c9a654]/50"
                    />
                  </div>

                  {/* END DATE */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                      To Date
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c9a654]/50"
                    />
                  </div>
                </div>

                {/* SEARCH INPUT */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search logs by description, user name, action..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
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
                        <th className="px-5 py-3.5">Actor</th>
                        <th className="px-5 py-3.5 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium">
                      {isLoadingLogs ? (
                        Array.from({ length: 4 }).map((_, i) => (
                          <tr key={i}>
                            <td className="px-5 py-3.5"><Skeleton width={120} /></td>
                            <td className="px-5 py-3.5"><Skeleton width={60} height={18} borderRadius={6} /></td>
                            <td className="px-5 py-3.5"><Skeleton width={50} /></td>
                            <td className="px-5 py-3.5"><Skeleton width={200} /></td>
                            <td className="px-5 py-3.5"><Skeleton width={100} /></td>
                            <td className="px-5 py-3.5 text-right"><Skeleton width={40} /></td>
                          </tr>
                        ))
                      ) : filteredLogs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-10 text-center text-gray-400">
                            <Clock className="w-7 h-7 text-gray-300 mx-auto mb-2" />
                            <p className="font-semibold text-gray-600">No activity logs found</p>
                            <p className="text-[11px] text-gray-400 mt-1">Actions performed on your proposals will be logged here.</p>
                          </td>
                        </tr>
                      ) : (
                        filteredLogs.map((log) => (
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
                              <div className="font-semibold">{log.userName || "You"}</div>
                              {log.userRole && (
                                <span className="text-[10px] text-gray-400 block">{log.userRole}</span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-right whitespace-nowrap">
                              <button
                                onClick={() => setSelectedLog(log)}
                                className="p-1.5 text-gray-500 hover:text-[#c9a654] hover:bg-amber-50 rounded-lg transition-colors inline-flex items-center gap-1 font-semibold text-[11px]"
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

                <div className="px-5 py-3 bg-gray-50/50 border-t border-gray-100 text-xs text-gray-500 flex items-center justify-between">
                  <span>Showing {filteredLogs.length} activity records</span>
                  <span className="text-[11px] text-gray-400">Student Portal Activity Log</span>
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
                <h3 className="font-bold text-base">Activity Log Details</h3>
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
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Section</span>
                  <span className="font-bold text-[#122244] bg-white border border-gray-200 px-2 py-0.5 rounded text-[11px] inline-block mt-0.5">
                    {selectedLog.sectionCode || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Action</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border mt-0.5 ${getActionBadgeColor(selectedLog.action)}`}>
                    {selectedLog.action}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Actor</span>
                  <span className="font-semibold text-gray-800">{selectedLog.userName || "Student"}</span>
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
                  <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Previous Value</span>
                  <pre className="p-3 bg-gray-900 text-gray-100 rounded-xl overflow-x-auto text-[10px] font-mono">
                    {JSON.stringify(selectedLog.oldValue, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.newValue && (
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Updated Value</span>
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
    </div>
  );
};

export default Settings;