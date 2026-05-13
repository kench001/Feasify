import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, db, signOutUser } from "./firebase";
import {
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  verifyBeforeUpdateEmail,
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
} from "firebase/firestore";
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
  X,
  Lock,
  Mail,
  UserCircle,
  Loader2,
  Bell,
  Users,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
} from "lucide-react";

interface Teammate {
  id: string;
  name: string;
  role: string;
  initials: string;
}

const AdviserProfile: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [adviserSections, setAdviserSections] = useState<string[]>([]);
  const [activeSection, setActiveSection] = useState("");
  const [sectionSettingsMap, setSectionSettingsMap] = useState<Record<string, {minMembers: number, maxMembers: number}>>({});

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
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [isSavingGroup, setIsSavingGroup] = useState(false);

  // Modal States
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showForcePasswordModal, setShowForcePasswordModal] = useState(false);
  const [showForcePasswordSuccess, setShowForcePasswordSuccess] =
    useState(false);

  // Toggle Eye Icon States
  const [showForceNewPwd, setShowForceNewPwd] = useState(false);
  const [showForceConfirmPwd, setShowForceConfirmPwd] = useState(false);

  // Modal Form Data
  const [pwdData, setPwdData] = useState({ current: "", new: "", confirm: "" });
  const [forcePwdData, setForcePwdData] = useState({ new: "", confirm: "" });
  const [newUsername, setNewUsername] = useState("");
  const [emailData, setEmailData] = useState({ newEmail: "", password: "" });

  const [isLoading, setIsLoading] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalSuccess, setModalSuccess] = useState("");

  // --- 1. NOTIFICATION SYNC (MOVED OUT OF HELPER) ---
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
          console.error("Error fetching unread notifications:", error);
        }
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const state = location.state as any;
    if (state && state.forcePasswordChange) {
      setShowForcePasswordModal(true);
    }
  }, [location]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { navigate("/"); return; }
      try {
        const userDoc = await getDoc(doc(db, "users", u.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.role !== "Adviser") {
            navigate("/dashboard"); return;
          }
          
          const fullName = `${data.firstName} ${data.lastName}`;
          setUserName(fullName);

          setProfileData({
            firstName: data.firstName || "",
            lastName: data.lastName || "",
            username: data.username || data.firstName?.toLowerCase(),
            email: u.email || data.email || "",
            groupName: "Syncing...",
            section: data.section || "Not Assigned",
            roleInGroup: "",
          });

          // Load adviser sections
          const rawSection = data.section || "Unassigned";
          const parsedSections = rawSection.split(",")
            .map((s: string) => s.trim())
            .filter(Boolean)
            .sort((a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
          
          setAdviserSections(parsedSections);
          if (parsedSections.length > 0) {
            setActiveSection(parsedSections[0]);
          }

          if (data.sectionSettings) {
            setSectionSettingsMap(data.sectionSettings);
          }
        }
      } catch (e) {
        console.error(e);
      }
    });
    return () => unsub();
  }, [navigate]);

  const fetchTeamDetails = async (uid: string, section: string) => {
    setIsLoadingTeammates(true);
    try {
      const q = query(
        collection(db, "groups"),
        where("section", "==", section),
      );
      const snap = await getDocs(q);
      let userGroup: any = null;
      let groupRole = "Member";

      snap.forEach((doc) => {
        const data = doc.data();
        if (data.leaderId === uid) {
          userGroup = { id: doc.id, ...data };
          groupRole = "Leader";
        } else if (data.memberIds?.includes(uid)) {
          userGroup = { id: doc.id, ...data };
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
          new Set([userGroup.leaderId, ...(userGroup.memberIds || [])]),
        );
        const memberDetails = await Promise.all(
          allMemberIds.map(async (id) => {
            const s = await getDoc(doc(db, "users", id));
            const d = s.data();
            const name = d ? `${d.firstName} ${d.lastName}` : "Unknown User";
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
          }),
        );
        setTeamCollaborators(memberDetails);
      } else {
        setProfileData((prev) => ({ ...prev, groupName: "No Group Assigned" }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingTeammates(false);
    }
  };

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
        setModalSuccess("Username updated!");
        setTimeout(() => setShowUsernameModal(false), 1500);
      }
    } catch (error: any) {
      setModalError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOutUser();
    localStorage.clear();
    navigate("/");
  };

  const handleSaveGroup = async () => {
    setIsSavingGroup(true);
    try {
      const user = auth.currentUser;
      if (user) {
        await updateDoc(doc(db, "users", user.uid), {
          groupName: profileData.groupName,
        });
        setIsEditingGroup(false);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSavingGroup(false);
    }
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

  return (
    <div className="flex min-h-screen bg-gray-50/50 overflow-hidden text-[#122244]">
      {/* ADVISER SIDEBAR */}
      <aside className={`hidden lg:flex w-64 bg-[#122244] text-white flex-col fixed inset-y-0 shadow-xl z-20 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center gap-3 border-b border-white/10">
         <img src="/dashboard logo.png" alt="FeasiFy" className="w-70 h-20 object-contain" />
        </div>
        <nav className="flex-1 p-4 space-y-8 mt-4">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">Main Menu</p>
            <div className="space-y-1">
              <button onClick={() => navigate("/adviser/dashboard")}className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-semibold  text-gray-400 transition-all ">My Sections</button>
              <div className="pl-4 pr-2 py-2 space-y-2">
                {adviserSections.map((sectionName) => (
                  <button
                    key={sectionName}
                    onClick={() => {
                      navigate(`/adviser/dashboard?section=${encodeURIComponent(sectionName)}`);
                    }}
                    className={`w-full text-left text-sm transition-colors ${
                      activeSection === sectionName
                        ? "text-gray-400 hover:text-white"
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
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">Account</p>
            <div className="space-y-1">
              <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white bg-[#c9a654] shadow-md"><User className="w-4 h-4" /> Profile</button>
              <button onClick={() => navigate("/adviser/settings")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-all"><Settings className="w-4 h-4" /> Settings</button>
              <button onClick={() => setShowLogoutConfirm(true)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-all"><ShieldAlert className="w-4 h-4" /> Logout</button>
            </div>
          </div>
        </nav>
        <div className="p-4 border-t border-white/10 bg-black/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#c9a654] flex items-center justify-center font-bold text-sm">{getInitials(userName)}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-white">{userName}</p>
              <p className="text-[10px] text-gray-400 truncate">Feasibility Adviser</p>
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
        className={`flex-1 transition-all duration-300 min-h-screen ${isSidebarOpen ? "lg:ml-64" : "ml-0"}`}
      >
        <div className="bg-white border-b border-gray-100 p-4 flex items-center gap-2 text-sm text-gray-500">
          <SidebarIcon
            className="w-4 h-4 cursor-pointer hover:text-gray-800"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          />
          <span className="mx-2">|</span> FeasiFy <span>›</span>{" "}
          <span className="font-semibold text-gray-900">Profile</span>
        </div>

        <div className="p-6 md:p-8 max-w-7xl mx-auto">
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
                  <span className="text-[#122244]">{activeSection || profileData.section}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold text-gray-500">
                  <span>ROLE</span>
                  <span className="text-[#c9a654]">
                    Adviser
                  </span>
                </div>
              </div>
            </div>

            {/* ACCOUNT SETTINGS CARD */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-bold mb-6 text-[#122244]">
                Account Settings
              </h2>
              <div className="space-y-5">
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
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 mt-1">
                    <span className="truncate">@{profileData.username}</span>
                    <button
                      onClick={() => setShowUsernameModal(true)}
                      className="text-[#c9a654] hover:text-[#b59545] font-semibold ml-2 whitespace-nowrap"
                    >
                      Update
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          
        </div>
      </main>

      {/* ALL MODALS GO HERE */}
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
                    type={showForceNewPwd ? "text" : "password"}
                    value={forcePwdData.new}
                    onChange={(e) => setForcePwdData({ ...forcePwdData, new: e.target.value })}
                    className="w-full pl-12 pr-12 py-3.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-[#c9a654]/50 transition-all"
                    placeholder="Enter new password"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowForceNewPwd(!showForceNewPwd)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showForceNewPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showForceConfirmPwd ? "text" : "password"}
                    value={forcePwdData.confirm}
                    onChange={(e) => setForcePwdData({ ...forcePwdData, confirm: e.target.value })}
                    className="w-full pl-12 pr-12 py-3.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-[#c9a654]/50 transition-all"
                    placeholder="Confirm new password"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowForceConfirmPwd(!showForceConfirmPwd)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showForceConfirmPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#c9a654] hover:bg-[#b59545] text-white py-4 rounded-xl font-black text-sm uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Update Password"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SUCCESS MODAL FOR PASSWORD CHANGE */}
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
              Your password has been successfully secured.
            </p>
            <button
              onClick={() => {
                setShowForcePasswordSuccess(false);
                navigate("/adviser/dashboard");
              }}
              className="w-full bg-[#122244] hover:bg-black text-white py-4 rounded-xl font-black text-sm uppercase tracking-wider transition-colors"
            >
              Continue to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* USERNAME MODAL */}
      {showUsernameModal && (
        <div className="fixed inset-0 bg-[#122244]/90 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-[#122244] mb-4">Update User Handle</h3>
            <form onSubmit={handleChangeUsername} className="space-y-4">
              {modalError && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {modalError}
                </div>
              )}
              {modalSuccess && (
                <div className="bg-green-50 text-green-600 text-sm p-3 rounded-lg flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {modalSuccess}
                </div>
              )}
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">New User Handle</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder={`@${profileData.username}`}
                  className="w-full mt-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-[#c9a654]/50 transition-all"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowUsernameModal(false);
                    setNewUsername("");
                    setModalError("");
                    setModalSuccess("");
                  }}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-[#c9a654] hover:bg-[#b59545] text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LOGOUT CONFIRMATION */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 text-center">
            <div className="bg-white rounded-2xl p-6 z-10 w-11/12 max-w-sm shadow-xl animate-in fade-in zoom-in-95 duration-200">
              <h3 className="text-lg font-bold text-[#122244] mb-2 text-center">
                Sign Out?
              </h3>
              <p className="text-sm text-gray-600 mb-6 text-center italic">
                Are you sure you want to log out of your session?
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 px-5 py-2.5 rounded-lg border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50"
                >
                  Stay
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowLogoutConfirm(false);
                    handleLogout();
                  }}
                  className="flex-1 px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-md shadow-red-900/10 transition-colors"
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

export default AdviserProfile;
