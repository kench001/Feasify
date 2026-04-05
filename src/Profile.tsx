import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db, signOutUser } from "./firebase";
import { onAuthStateChanged, EmailAuthProvider, reauthenticateWithCredential, updatePassword, verifyBeforeUpdateEmail } from "firebase/auth";
import { doc, getDoc, updateDoc, query, collection, where, getDocs } from "firebase/firestore";
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
  Bell
} from "lucide-react";

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  // Profile Data State
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    groupName: "",
  });

  // Edit Group Name State (Kept simple inline edit)
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [isSavingGroup, setIsSavingGroup] = useState(false);

  // Modal States
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);

  // Modal Form Data
  const [pwdData, setPwdData] = useState({ current: "", new: "", confirm: "" });
  const [newUsername, setNewUsername] = useState("");
  const [emailData, setEmailData] = useState({ newEmail: "", password: "" });

  // Loading & Feedback States
  const [isLoading, setIsLoading] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalSuccess, setModalSuccess] = useState("");

  const [teamCollaborators] = useState<{ id: string }[]>([]);

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
            
            setProfileData({
              firstName: first,
              lastName: last,
              username: data.username || first.toLowerCase(),
              email: u.email || data.email || "", 
              groupName: data.groupName || "",
            });
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

  // --- CHANGE USERNAME ---
  const handleChangeUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");
    setModalSuccess("");
    if (!newUsername.trim()) return;

    setIsLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("No user logged in");

      await updateDoc(doc(db, "users", user.uid), {
        username: newUsername.trim()
      });

      setProfileData(prev => ({ ...prev, username: newUsername.trim() }));
      setModalSuccess("Username updated successfully!");
      
      setTimeout(() => {
        setShowUsernameModal(false);
        setModalSuccess("");
        setNewUsername("");
      }, 1500);
    } catch (error: any) {
      setModalError(error.message || "Failed to update username.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- CHANGE EMAIL ---
  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");
    setModalSuccess("");
    
    if (!emailData.newEmail || !emailData.password) {
      setModalError("Please fill in all fields.");
      return;
    }

    setIsLoading(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error("No user logged in");

      // Re-authenticate first (Required by Firebase for sensitive actions)
      const credential = EmailAuthProvider.credential(user.email, emailData.password);
      await reauthenticateWithCredential(user, credential);

      // Send Verification Email to new address
      await verifyBeforeUpdateEmail(user, emailData.newEmail);
      
      // Update Firestore DB email so the app reflects the change
      await updateDoc(doc(db, "users", user.uid), {
        email: emailData.newEmail.trim()
      });

      setModalSuccess(`Success! A verification link was sent to ${emailData.newEmail}. Your login email will change once you click it.`);
      
      setTimeout(() => {
        setShowEmailModal(false);
        setModalSuccess("");
        setEmailData({ newEmail: "", password: "" });
        setProfileData(prev => ({ ...prev, email: emailData.newEmail }));
      }, 3500);

    } catch (error: any) {
      console.error("Error changing email:", error);
      if (error.code === 'auth/invalid-credential') {
        setModalError("Incorrect password.");
      } else if (error.code === 'auth/email-already-in-use') {
        setModalError("This email is already in use by another account.");
      } else {
        setModalError(error.message || "Failed to update email.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // --- CHANGE PASSWORD ---
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");
    setModalSuccess("");

    if (pwdData.new !== pwdData.confirm) {
      setModalError("New passwords do not match.");
      return;
    }
    if (pwdData.new.length < 8) {
      setModalError("Password must be at least 8 characters.");
      return;
    }

    setIsLoading(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error("No user logged in");

      const credential = EmailAuthProvider.credential(user.email, pwdData.current);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, pwdData.new);
      
      setModalSuccess("Password updated successfully!");
      
      setTimeout(() => {
        setShowPasswordModal(false);
        setModalSuccess("");
        setPwdData({ current: "", new: "", confirm: "" });
      }, 1500);

    } catch (error: any) {
      if (error.code === 'auth/invalid-credential') setModalError("Incorrect current password.");
      else setModalError(error.message || "Failed to update password.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- SAVE GROUP NAME ---
  const handleSaveGroup = async () => {
    setIsSavingGroup(true);
    try {
      const user = auth.currentUser;
      if (user) {
        await updateDoc(doc(db, "users", user.uid), {
          groupName: profileData.groupName
        });
        setIsEditingGroup(false);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSavingGroup(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <>
      <div className="flex min-h-screen bg-white overflow-hidden">
        {/* SIDEBAR */}
        <aside className={`hidden lg:flex w-64 bg-[#122244] text-white flex-col fixed inset-y-0 shadow-xl z-20 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-6 flex items-center gap-3 border-b border-white/10">
            <div className="bg-white p-1.5 rounded-md">
              <BarChart3 className="w-6 h-6 text-[#122244]" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight block leading-none">FeasiFy</span>
              <span className="text-[8px] text-gray-400">An AI-Assisted Financial Feasibility System</span>
            </div>
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
                <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold bg-[#c9a654] text-white transition-all shadow-md">
                  <User className="w-4 h-4" /> Profile
                </button>
                <button onClick={() => navigate('/settings')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all">
                  <Settings className="w-4 h-4" /> Settings
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
        <main className={`flex-1 transition-all duration-300 ease-in-out bg-gray-50/30 min-h-screen ${isSidebarOpen ? 'lg:ml-64' : 'ml-0'}`}>
          <div className="bg-white border-b border-gray-100 p-4 flex items-center gap-2 text-sm text-gray-500">
            <SidebarIcon className="w-4 h-4 cursor-pointer hover:text-gray-800 transition-colors" onClick={() => setIsSidebarOpen(!isSidebarOpen)} />
            <span className="mx-2">|</span>
            <span className="font-semibold text-gray-900">FeasiFy</span>
            <span>›</span>
            <span className="font-semibold text-gray-900">Profile</span>
          </div>

          <div className="p-6 md:p-8 max-w-6xl mx-auto">
            <div className="mb-8 flex justify-between items-end">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">User Profile</h1>
                <p className="text-sm text-gray-500 mt-1">Manage your personal details and account settings</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Profile & Account Settings Section */}
              <div className="grid md:grid-cols-2 gap-6">
                
                {/* Left: Profile Card */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 flex flex-col items-center justify-center text-center">
                  <div className="w-32 h-32 rounded-full bg-[#c9a654] flex items-center justify-center text-white text-5xl font-bold mb-6 shadow-md">
                    {getInitials(userName)}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">
                    {userName || "User"}
                  </h3>
                  <p className="text-gray-500 mt-1">@{profileData.username}</p>
                </div>

                {/* Right: Account Settings */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-6">Account Settings</h2>
                  
                  <div className="space-y-5">
                    {/* Username */}
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Username</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={profileData.username}
                          disabled
                          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-medium"
                        />
                        <button 
                          onClick={() => {
                            setNewUsername(profileData.username);
                            setShowUsernameModal(true);
                            setModalError(""); setModalSuccess("");
                          }}
                          className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center gap-2 shadow-sm whitespace-nowrap"
                        >
                          <UserCircle className="w-4 h-4 text-[#249c74]" /> Change Username
                        </button>
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Password</label>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value="••••••••••••"
                          disabled
                          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 tracking-widest font-medium"
                        />
                        <button 
                          onClick={() => {
                            setShowPasswordModal(true);
                            setModalError(""); setModalSuccess("");
                          }}
                          className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center gap-2 shadow-sm whitespace-nowrap"
                        >
                          <Lock className="w-4 h-4 text-orange-500" /> Change Password
                        </button>
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Email Address</label>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={profileData.email}
                          disabled
                          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-medium"
                        />
                        <button 
                          onClick={() => {
                            setShowEmailModal(true);
                            setModalError(""); setModalSuccess("");
                          }}
                          className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center gap-2 shadow-sm whitespace-nowrap"
                        >
                          <Mail className="w-4 h-4 text-blue-500" /> Change Email
                        </button>
                      </div>
                    </div>

                    {/* Group Name (Inline Edit) */}
                    <div className="pt-2 border-t border-gray-100">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Group Name</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={profileData.groupName}
                          onChange={(e) => setProfileData({...profileData, groupName: e.target.value})}
                          disabled={!isEditingGroup}
                          placeholder="No group assigned"
                          className={`flex-1 px-4 py-2.5 border rounded-lg font-medium transition-all ${isEditingGroup ? 'border-gray-300 focus:ring-2 focus:ring-[#249c74]/20 focus:border-[#249c74] bg-white text-gray-900' : 'border-gray-200 bg-gray-50 text-gray-700'}`}
                        />
                        {!isEditingGroup ? (
                          <button 
                            onClick={() => setIsEditingGroup(true)}
                            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm whitespace-nowrap"
                          >
                            Edit Group
                          </button>
                        ) : (
                          <button 
                            onClick={handleSaveGroup}
                            disabled={isSavingGroup}
                            className="px-4 py-2 bg-[#249c74] text-white rounded-lg text-sm font-semibold hover:bg-[#1e8563] shadow-md transition-all flex items-center gap-2 whitespace-nowrap disabled:opacity-70"
                          >
                            {isSavingGroup ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                          </button>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              {/* Team & Collaborators Section */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Team & Collaborators</h2>
                <div className="space-y-3">
                  {teamCollaborators.length === 0 ? (
                    <p className="text-gray-400 text-sm">No team members yet</p>
                  ) : (
                    teamCollaborators.map((member) => (
                      <div key={member.id} className="p-3 hover:bg-gray-50 rounded-lg transition-colors">
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* --- MODALS --- */}

      {/* 1. USERNAME MODAL */}
      {showUsernameModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200 relative">
            <button onClick={() => setShowUsernameModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Change Username</h3>
            <p className="text-sm text-gray-500 mb-6">Choose a new display name for your profile.</p>
            
            <form onSubmit={handleChangeUsername} className="space-y-4">
              {modalError && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{modalError}</div>}
              {modalSuccess && <div className="p-3 bg-green-50 text-green-600 text-sm rounded-lg border border-green-100">{modalSuccess}</div>}

              <div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">New Username</label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#249c74]"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowUsernameModal(false)} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-lg">Cancel</button>
                <button type="submit" disabled={isLoading} className="px-4 py-2 bg-[#249c74] text-white text-sm font-semibold rounded-lg hover:bg-[#1e8563] shadow-md flex items-center gap-2">
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Username"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. EMAIL MODAL */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200 relative">
            <button onClick={() => setShowEmailModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Change Email Address</h3>
            <p className="text-sm text-gray-500 mb-6">Enter your new email address and verify your current password.</p>
            
            <form onSubmit={handleChangeEmail} className="space-y-4">
              {modalError && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{modalError}</div>}
              {modalSuccess && <div className="p-3 bg-green-50 text-green-600 text-sm rounded-lg border border-green-100">{modalSuccess}</div>}

              <div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">New Email Address</label>
                <input
                  type="email"
                  required
                  value={emailData.newEmail}
                  onChange={(e) => setEmailData({...emailData, newEmail: e.target.value})}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#249c74]"
                />
              </div>
              
              <div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">Current Password</label>
                <input
                  type="password"
                  required
                  value={emailData.password}
                  onChange={(e) => setEmailData({...emailData, password: e.target.value})}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#249c74]"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowEmailModal(false)} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-lg">Cancel</button>
                <button type="submit" disabled={isLoading} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 shadow-md flex items-center gap-2">
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Verification"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. PASSWORD MODAL */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200 relative">
            <button onClick={() => setShowPasswordModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Change Password</h3>
            <p className="text-sm text-gray-500 mb-6">Enter your current password to verify your identity, then set a new one.</p>
            
            <form onSubmit={handleChangePassword} className="space-y-4">
              {modalError && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{modalError}</div>}
              {modalSuccess && <div className="p-3 bg-green-50 text-green-600 text-sm rounded-lg border border-green-100">{modalSuccess}</div>}

              <div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">Current Password</label>
                <input
                  type="password"
                  required
                  value={pwdData.current}
                  onChange={(e) => setPwdData({...pwdData, current: e.target.value})}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              
              <div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">New Password</label>
                <input
                  type="password"
                  required
                  value={pwdData.new}
                  onChange={(e) => setPwdData({...pwdData, new: e.target.value})}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={pwdData.confirm}
                  onChange={(e) => setPwdData({...pwdData, confirm: e.target.value})}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowPasswordModal(false)} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-lg">Cancel</button>
                <button type="submit" disabled={isLoading} className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 shadow-md flex items-center gap-2">
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Logout</h3>
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to log out of your account?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowLogoutConfirm(false)} className="px-4 py-2 text-sm font-semibold text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleLogout} className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-md">
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Profile;