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

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

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

  // 1. Initial Load & Auth Sync
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          // Fetch User Data
          const userSnap = await getDoc(doc(db, "users", u.uid));
          if (userSnap.exists()) {
            const data = userSnap.data();
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

            if (data.section) fetchTeamDetails(u.uid, data.section);
          }

          // Fetch Notifications
          const qNotify = query(
            collection(db, "notifications"),
            where("userId", "==", u.uid),
            where("isRead", "==", false),
          );
          const notifySnap = await getDocs(qNotify);
          setUnreadNotificationCount(notifySnap.size);
        } catch (e) {
          console.error("Load error:", e);
        }
      } else {
        navigate("/");
      }
    });
    return () => unsub();
  }, [navigate]);

  // 2. Check for Forced Password Change from Navigation State
  useEffect(() => {
    const state = location.state as any;
    if (state?.forcePasswordChange) {
      setShowForcePasswordModal(true);
    }
  }, [location]);

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
    if (forcePwdData.new !== forcePwdData.confirm)
      return setModalError("Passwords do not match.");
    if (forcePwdData.new.length < 8)
      return setModalError("Minimum 8 characters required.");

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
        await updateDoc(doc(db, "users", user.uid), { username: trimmed });
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

  const handleLogout = async () => {
    await signOutUser();
    localStorage.clear();
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

  return (
    <div className="flex min-h-screen bg-gray-50/50 overflow-hidden text-[#122244]">
      {/* SIDEBAR */}
      <aside
        className={`hidden lg:flex w-64 bg-[#122244] text-white flex-col fixed inset-y-0 shadow-xl z-20 transition-transform duration-300 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="p-6 border-b border-white/10">
          <img
            src="/dashboard logo.png"
            alt="FeasiFy"
            className="w-70 h-20 object-contain"
          />
        </div>
        <nav className="flex-1 p-4 space-y-8 mt-4 text-gray-300">
          <div className="space-y-1">
            <button
              onClick={() => navigate("/dashboard")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-white/5"
            >
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </button>
            <button
              onClick={() => navigate("/projects")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-white/5"
            >
              <Folder className="w-4 h-4" /> Business Proposal
            </button>
            <button
              onClick={() => navigate("/financial-input")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-white/5"
            >
              <FileEdit className="w-4 h-4" /> Financial Input
            </button>
            <button
              onClick={() => navigate("/ai-analysis")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-white/5"
            >
              <Zap className="w-4 h-4" /> AI Analysis
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold bg-[#c9a654] text-white shadow-md">
              <User className="w-4 h-4" /> Profile
            </button>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-white/5"
            >
              <ShieldAlert className="w-4 h-4" /> Logout
            </button>
          </div>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main
        className={`flex-1 transition-all duration-300 min-h-screen ${isSidebarOpen ? "lg:ml-64" : "ml-0"}`}
      >
        <div className="bg-white border-b border-gray-100 p-4 flex items-center gap-2 text-sm text-gray-500">
          <SidebarIcon
            className="w-4 h-4 cursor-pointer"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          />
          <span className="mx-2">|</span> FeasiFy <span>›</span>{" "}
          <span className="font-semibold text-gray-900">Profile</span>
        </div>

        <div className="p-6 md:p-8 max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Profile Card */}
            <div className="lg:col-span-1 bg-white rounded-3xl border border-gray-100 shadow-sm p-8 flex flex-col items-center text-center">
              <div className="w-32 h-32 rounded-full bg-[#c9a654] flex items-center justify-center text-white text-5xl font-black mb-6 shadow-xl">
                {getInitials(userName)}
              </div>
              <h3 className="text-2xl font-black text-[#122244]">{userName}</h3>
              <p className="text-gray-400 font-bold text-sm uppercase tracking-tighter">
                @{profileData.username}
              </p>
              <div className="w-full space-y-3 pt-6 mt-6 border-t border-gray-50">
                <div className="flex justify-between items-center bg-gray-50 px-4 py-2.5 rounded-xl text-xs font-bold uppercase">
                  <span>Section</span>
                  <span className="text-[#122244]">{profileData.section}</span>
                </div>
                <div className="flex justify-between items-center bg-gray-50 px-4 py-2.5 rounded-xl text-xs font-bold uppercase">
                  <span>Role</span>
                  <span className="text-[#c9a654]">
                    {profileData.roleInGroup || "Student"}
                  </span>
                </div>
              </div>
            </div>

            {/* Account Settings */}
            <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
              <h2 className="text-xl font-black mb-8">Account Settings</h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Email Address
                  </label>
                  <div className="flex items-center justify-between px-4 py-3.5 bg-gray-50 border rounded-2xl text-sm font-bold text-gray-600">
                    <span className="truncate">{profileData.email}</span>
                    <button
                      onClick={() => setShowEmailModal(true)}
                      className="text-[#c9a654] hover:underline"
                    >
                      Change
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Group Name
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={profileData.groupName}
                      onChange={(e) =>
                        setProfileData({
                          ...profileData,
                          groupName: e.target.value,
                        })
                      }
                      disabled={!isEditingGroup}
                      className={`flex-1 px-4 py-3 border rounded-xl font-bold ${isEditingGroup ? "bg-white border-[#c9a654]" : "bg-gray-50 border-gray-100"}`}
                    />
                    {!isEditingGroup ? (
                      <button
                        onClick={() => setIsEditingGroup(true)}
                        className="px-4 py-2 border rounded-xl text-sm font-bold"
                      >
                        Edit
                      </button>
                    ) : (
                      <button
                        onClick={handleSaveGroup}
                        className="px-4 py-2 bg-[#249c74] text-white rounded-xl text-sm font-bold"
                      >
                        Save
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Collaborators */}
          <div className="mt-8 bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
            <h2 className="text-xl font-black mb-8 flex items-center gap-2">
              <Users className="text-[#c9a654]" /> Team Collaborators
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {teamCollaborators.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100"
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-black ${m.role === "Leader" ? "bg-purple-600" : "bg-[#122244]"}`}
                  >
                    {m.initials}
                  </div>
                  <div>
                    <p className="text-sm font-black truncate">{m.name}</p>
                    <p className="text-[10px] uppercase font-bold text-gray-400">
                      {m.role}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* FORCED PASSWORD MODAL */}
      {showForcePasswordModal && (
        <div className="fixed inset-0 bg-[#122244]/90 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-2xl font-bold text-center text-[#122244] mb-2">
              Welcome!
            </h3>
            <p className="text-sm text-center text-gray-500 mb-8">
              Please set a new password to secure your account.
            </p>
            <form onSubmit={handleForcePasswordChange} className="space-y-5">
              {modalError && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center">
                  {modalError}
                </div>
              )}
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showForceNewPwd ? "text" : "password"}
                  required
                  value={forcePwdData.new}
                  onChange={(e) =>
                    setForcePwdData({ ...forcePwdData, new: e.target.value })
                  }
                  placeholder="New Password"
                  className="w-full pl-10 pr-10 py-3 border rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => setShowForceNewPwd(!showForceNewPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showForceNewPwd ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showForceConfirmPwd ? "text" : "password"}
                  required
                  value={forcePwdData.confirm}
                  onChange={(e) =>
                    setForcePwdData({
                      ...forcePwdData,
                      confirm: e.target.value,
                    })
                  }
                  placeholder="Confirm Password"
                  className="w-full pl-10 pr-10 py-3 border rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => setShowForceConfirmPwd(!showForceConfirmPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showForceConfirmPwd ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-[#c9a654] text-white font-bold rounded-lg"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin inline" />
                ) : (
                  "Save & Continue"
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* LOGOUT CONFIRM MODAL */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl text-center">
            <h3 className="text-xl font-black mb-2">Sign Out?</h3>
            <p className="text-sm text-gray-500 mb-8 italic">
              Are you sure you want to log out of FeasiFy?
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3 text-sm font-black text-gray-400"
              >
                Stay
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-3 text-sm font-black bg-red-600 text-white rounded-2xl shadow-xl"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* USERNAME MODAL */}
      {showUsernameModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setShowUsernameModal(false)}
              className="absolute top-4 right-4 text-gray-400"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold mb-4">Update Handle</h3>
            <form onSubmit={handleChangeUsername} className="space-y-4">
              {modalError && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">
                  {modalError}
                </div>
              )}
              {modalSuccess && (
                <div className="p-3 bg-green-50 text-green-600 text-sm rounded-lg">
                  {modalSuccess}
                </div>
              )}
              <input
                type="text"
                required
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg"
                placeholder="New handle"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-[#122244] text-white font-bold rounded-lg"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin inline" />
                ) : (
                  "Update Username"
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
