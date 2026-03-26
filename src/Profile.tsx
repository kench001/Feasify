import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db, signOutUser } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
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
  Sidebar as SidebarIcon
} from "lucide-react";

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Profile Form State
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    studentId: "",
    section: "",
    username: "",
    email: "",
    groupName: "",
    password: "••••••••••"
  });

  const [teamCollaborators] = useState<{ id: string }[]>([])

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
            
            setProfileData({
              firstName: first,
              lastName: last,
              studentId: data.studentId || "",
              section: data.section || "",
              username: data.username || first.toLowerCase(),
              email: data.email || u.email || "",
              groupName: data.groupName || "",
              password: "••••••••••"
            });
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveChanges = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        await updateDoc(doc(db, "users", user.uid), {
          firstName: profileData.firstName,
          lastName: profileData.lastName,
          studentId: profileData.studentId,
          section: profileData.section,
          username: profileData.username,
          groupName: profileData.groupName,
          email: profileData.email
        });
        alert("Profile updated successfully!");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile");
    }
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
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${item.route === "/profile" ? "bg-[#249c74] text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
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
                  { name: "Profile", icon: User },
                  { name: "Settings", icon: Settings },
                  { name: "Logout", icon: ShieldAlert },
                ].map((item) => (
                  <button
                    key={item.name}
                    onClick={() => {
                      if (item.name === "Logout") setShowLogoutConfirm(true);
                      if (item.name === "Settings") navigate("/settings");
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${item.name === "Profile" ? "bg-[#249c74] text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
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
            <span className="font-semibold text-gray-900">Profile</span>
          </div>

          <div className="p-6 md:p-8 max-w-6xl mx-auto">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900">User Profile</h1>
              <p className="text-sm text-gray-500 mt-1">Manage your personal details and account settings</p>
            </div>

            <div className="space-y-6">
              {/* Profile & Account Settings Section */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Left: Profile Card */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Profile</h2>
                  <div className="flex flex-col items-center text-center">
                    <div className="w-24 h-24 rounded-full bg-[#c9a654] flex items-center justify-center text-white text-4xl font-bold mb-4">
                      {getInitials(profileData.firstName + " " + profileData.lastName)}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {profileData.firstName} {profileData.lastName}
                    </h3>
                    {profileData.studentId && (
                      <p className="text-sm text-gray-600 mt-2">Student ID: {profileData.studentId}</p>
                    )}
                    {profileData.section && (
                      <p className="text-sm text-gray-600">Section: {profileData.section}</p>
                    )}
                  </div>
                </div>

                {/* Right: Account Settings */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Account Settings</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-semibold text-gray-700">Username</label>
                      <input
                        type="text"
                        name="username"
                        value={profileData.username}
                        onChange={handleInputChange}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#249c74]/20 focus:border-[#249c74]"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700">Password</label>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={profileData.password}
                          disabled
                          className="flex-1 mt-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                        />
                        <button className="mt-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                          🔓 Change Password
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700">Email Address</label>
                      <input
                        type="email"
                        name="email"
                        value={profileData.email}
                        onChange={handleInputChange}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#249c74]/20 focus:border-[#249c74]"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700">Group Name</label>
                      <input
                        type="text"
                        name="groupName"
                        value={profileData.groupName}
                        onChange={handleInputChange}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#249c74]/20 focus:border-[#249c74]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Team & Collaborators Section */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Team & Collaborators</h2>
                <div className="space-y-3">
                  {teamCollaborators.length === 0 ? (
                    <p className="text-gray-500 text-sm">No team members yet</p>
                  ) : (
                    teamCollaborators.map((member) => (
                      <div key={member.id} className="p-3 hover:bg-gray-50 rounded-lg transition-colors">
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end">
                <button className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors">
                  Edit Profile
                </button>
                <button
                  onClick={handleSaveChanges}
                  className="px-6 py-2 bg-[#c9a654] hover:bg-[#b59545] text-white font-semibold text-sm rounded-lg transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
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

export default Profile;
