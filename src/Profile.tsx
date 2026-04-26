import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
} from "lucide-react";

interface Teammate {
  id: string;
  name: string;
  role: string;
  initials: string;
}

const Profile: React.FC = () => {
  const navigate = useNavigate();
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

  // Modal States
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);

  // Modal Form Data
  const [pwdData, setPwdData] = useState({ current: "", new: "", confirm: "" });
  const [newUsername, setNewUsername] = useState("");
  const [emailData, setEmailData] = useState({ newEmail: "", password: "" });

  const [isLoading, setIsLoading] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalSuccess, setModalSuccess] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
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
        } catch (e) {
          console.error(e);
        }
      } else {
        navigate("/");
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

  // --- ORIGINAL LOGIC FOR SECURITY CHANGES ---
  const handleChangeUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");
    setModalSuccess("");
    const trimmed = newUsername.trim();
    if (!trimmed || trimmed === profileData.username) return;
    setIsLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) return;
      await updateDoc(doc(db, "users", user.uid), { username: trimmed });
      setProfileData((prev) => ({ ...prev, username: trimmed }));
      setModalSuccess("Username updated successfully!");
      setTimeout(() => setShowUsernameModal(false), 1500);
    } catch (error: any) {
      setModalError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");
    setModalSuccess("");
    if (!emailData.newEmail || !emailData.password) {
      setModalError("Fill all fields");
      return;
    }
    setIsLoading(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) return;
      const cred = EmailAuthProvider.credential(user.email, emailData.password);
      await reauthenticateWithCredential(user, cred);
      await verifyBeforeUpdateEmail(user, emailData.newEmail);
      await updateDoc(doc(db, "users", user.uid), {
        email: emailData.newEmail.trim(),
      });
      setModalSuccess("Verification email sent to " + emailData.newEmail);
      setTimeout(() => setShowEmailModal(false), 2000);
    } catch (error: any) {
      setModalError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");
    setModalSuccess("");
    if (pwdData.new !== pwdData.confirm) {
      setModalError("Passwords mismatch");
      return;
    }
    setIsLoading(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) return;
      const cred = EmailAuthProvider.credential(user.email, pwdData.current);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, pwdData.new);
      setModalSuccess("Password updated!");
      setTimeout(() => setShowPasswordModal(false), 1500);
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

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

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
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-4 px-2 text-gray-400">
              Main Menu
            </p>
            <div className="space-y-1">
              <button
                onClick={() => navigate("/dashboard")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:text-white hover:bg-white/5 transition-all"
              >
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </button>
              <button
                onClick={() => navigate("/projects")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:text-white hover:bg-white/5 transition-all"
              >
                <Folder className="w-4 h-4" /> Business Proposal
              </button>
              <button
                onClick={() => navigate("/financial-input")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:text-white hover:bg-white/5 transition-all"
              >
                <FileEdit className="w-4 h-4" /> Financial Input
              </button>
              <button
                onClick={() => navigate("/ai-analysis")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:text-white hover:bg-white/5 transition-all"
              >
                <Zap className="w-4 h-4" /> AI Feasibility Analysis
              </button>
              <button
                onClick={() => navigate("/reports")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:text-white hover:bg-white/5 transition-all"
              >
                <BarChart3 className="w-4 h-4" /> Reports
              </button>
              <button
                onClick={() => navigate("/messages")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:text-white hover:bg-white/5 transition-all"
              >
                <MessageCircle className="w-4 h-4" /> Message
              </button>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-4 px-2 text-gray-400">
              Account
            </p>
            <div className="space-y-1">
              <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold bg-[#c9a654] text-white shadow-md transition-all">
                <User className="w-4 h-4" /> Profile
              </button>
              <button
                onClick={() => navigate("/settings")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"
              >
                <Settings className="w-4 h-4" /> Settings
              </button>
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"
              >
                <ShieldAlert className="w-4 h-4" /> Logout
              </button>
            </div>
          </div>
        </nav>
        <div className="p-4 border-t border-white/10 bg-black/20 flex items-center gap-3 text-white">
          <div className="w-10 h-10 rounded-full bg-[#c9a654] flex items-center justify-center font-bold text-sm">
            {getInitials(userName)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{userName}</p>
            <p className="text-[10px] text-gray-400">Student</p>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main
        className={`flex-1 transition-all duration-300 ease-in-out min-h-screen ${isSidebarOpen ? "lg:ml-64" : "ml-0"}`}
      >
        <div className="bg-white border-b border-gray-100 p-4 flex items-center gap-2 text-sm text-gray-500">
          <SidebarIcon
            className="w-4 h-4 cursor-pointer hover:text-gray-800 transition-colors"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          />
          <span className="mx-2">|</span> FeasiFy <span>›</span>{" "}
          <span className="font-semibold text-gray-900">Profile</span>
        </div>

        <div className="p-6 md:p-8 max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-[#122244]">
              Account Overview
            </h1>
            <p className="text-sm text-gray-500 font-medium">
              Manage your settings and view group members
            </p>
          </div>

          <div className="space-y-8">
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Profile Card */}
              <div className="lg:col-span-1 bg-white rounded-3xl border border-gray-100 shadow-sm p-8 flex flex-col items-center text-center">
                <div className="w-32 h-32 rounded-full bg-[#c9a654] flex items-center justify-center text-white text-5xl font-black mb-6 shadow-xl ring-4 ring-[#c9a654]/10">
                  {getInitials(userName)}
                </div>
                <h3 className="text-2xl font-black text-[#122244]">
                  {userName}
                </h3>
                <p className="text-gray-400 font-bold text-sm mb-6 flex items-center gap-1.5 uppercase tracking-tighter">
                  <ShieldCheck className="w-4 h-4 text-[#c9a654]" />{" "}
                  {profileData.roleInGroup || "Student"}
                </p>
                <div className="w-full space-y-3 pt-6 border-t border-gray-50">
                  <div className="flex justify-between items-center bg-gray-50 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest text-gray-400">
                    <span>Section</span>
                    <span className="text-[#122244]">
                      {profileData.section}
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-gray-50 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest text-gray-400">
                    <span>Group</span>
                    <span className="text-[#c9a654] truncate max-w-[140px]">
                      {profileData.groupName}
                    </span>
                  </div>
                </div>
              </div>

              {/* Account Settings */}
              <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
                <h2 className="text-xl font-black mb-8 text-[#122244]">
                  Account Settings
                </h2>
                <div className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Email Address
                      </label>
                      <div className="flex items-center justify-between px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-600">
                        <span className="truncate">{profileData.email}</span>
                        <button
                          onClick={() => setShowEmailModal(true)}
                          className="text-[#c9a654] hover:underline ml-2"
                        >
                          Change
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        User Handle
                      </label>
                      <div className="flex items-center justify-between px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-600">
                        <span className="truncate">
                          @{profileData.username}
                        </span>
                        <button
                          onClick={() => setShowUsernameModal(true)}
                          className="text-[#c9a654] hover:underline ml-2"
                        >
                          Update
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 pt-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Security
                    </label>
                    <div className="flex items-center justify-between px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-600">
                      <span>••••••••••••</span>
                      <button
                        onClick={() => setShowPasswordModal(true)}
                        className="px-4 py-1.5 bg-[#122244] text-white rounded-lg text-xs font-bold shadow-sm"
                      >
                        Reset Password
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Team Members Grid (Landscape) */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="bg-[#c9a654]/10 p-2 rounded-lg">
                  <Users className="text-[#c9a654]" />
                </div>
                <h2 className="text-xl font-black text-[#122244]">
                  Team Collaborators
                </h2>
              </div>
              {isLoadingTeammates ? (
                <div className="py-12 flex justify-center">
                  <Loader2 className="animate-spin text-[#c9a654]" />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {teamCollaborators.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100 hover:bg-white transition-all"
                    >
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-sm ${m.role === "Leader" ? "bg-purple-600" : "bg-[#122244]"}`}
                      >
                        {m.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-[#122244] truncate">
                          {m.name}
                        </p>
                        <p
                          className={`text-[9px] font-black uppercase tracking-widest ${m.role === "Leader" ? "text-purple-600" : "text-gray-400"}`}
                        >
                          {m.role}
                        </p>
                      </div>
                      {m.id === auth.currentUser?.uid && (
                        <div className="text-[8px] font-black bg-[#c9a654] text-white px-2 py-0.5 rounded-full">
                          YOU
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* --- MODALS (Original Re-authentication Logic Kept) --- */}
      {showUsernameModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4 text-[#122244]">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setShowUsernameModal(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-2xl font-black mb-6">Update Handle</h3>
            <form onSubmit={handleChangeUsername} className="space-y-4">
              {modalError && (
                <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl">
                  {modalError}
                </div>
              )}
              {modalSuccess && (
                <div className="p-3 bg-green-50 text-green-600 text-xs font-bold rounded-xl">
                  {modalSuccess}
                </div>
              )}
              <input
                type="text"
                required
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#c9a654]"
                placeholder="New username..."
              />
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-[#122244] text-white font-bold rounded-2xl shadow-lg flex justify-center items-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Save Update"
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {showEmailModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4 text-[#122244]">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setShowEmailModal(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-2xl font-black mb-6">Change Email</h3>
            <form onSubmit={handleChangeEmail} className="space-y-4">
              {modalError && (
                <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl">
                  {modalError}
                </div>
              )}
              {modalSuccess && (
                <div className="p-3 bg-green-50 text-green-600 text-xs font-bold rounded-xl">
                  {modalSuccess}
                </div>
              )}
              <input
                type="email"
                required
                value={emailData.newEmail}
                onChange={(e) =>
                  setEmailData({ ...emailData, newEmail: e.target.value })
                }
                className="w-full px-5 py-3.5 bg-gray-50 border rounded-2xl"
                placeholder="New email address"
              />
              <input
                type="password"
                required
                value={emailData.password}
                onChange={(e) =>
                  setEmailData({ ...emailData, password: e.target.value })
                }
                className="w-full px-5 py-3.5 bg-gray-50 border rounded-2xl"
                placeholder="Verify Current Password"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-[#c9a654] text-white font-bold rounded-2xl shadow-lg"
              >
                Confirm Email Change
              </button>
            </form>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4 text-[#122244]">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setShowPasswordModal(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-2xl font-black mb-6">Security Update</h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
              {modalError && (
                <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl">
                  {modalError}
                </div>
              )}
              {modalSuccess && (
                <div className="p-3 bg-green-50 text-green-600 text-xs font-bold rounded-xl">
                  {modalSuccess}
                </div>
              )}
              <input
                type="password"
                required
                value={pwdData.current}
                onChange={(e) =>
                  setPwdData({ ...pwdData, current: e.target.value })
                }
                className="w-full px-5 py-3.5 bg-gray-50 border rounded-2xl"
                placeholder="Current Password"
              />
              <input
                type="password"
                required
                value={pwdData.new}
                onChange={(e) =>
                  setPwdData({ ...pwdData, new: e.target.value })
                }
                className="w-full px-5 py-3.5 bg-gray-50 border rounded-2xl"
                placeholder="New Password"
              />
              <input
                type="password"
                required
                value={pwdData.confirm}
                onChange={(e) =>
                  setPwdData({ ...pwdData, confirm: e.target.value })
                }
                className="w-full px-5 py-3.5 bg-gray-50 border rounded-2xl"
                placeholder="Confirm New Password"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-[#122244] text-white font-bold rounded-2xl shadow-lg"
              >
                Update Password
              </button>
            </form>
          </div>
        </div>
      )}

      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl text-center">
            <h3 className="text-xl font-black text-[#122244] mb-2">
              Sign Out?
            </h3>
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
                className="flex-1 py-3 text-sm font-black bg-red-600 text-white rounded-2xl shadow-xl hover:bg-red-700"
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

export default Profile;
