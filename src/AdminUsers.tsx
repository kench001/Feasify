import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db, signOutUser, adminCreateUserAuth } from "./firebase"; // <-- Updated import
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, serverTimestamp, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore"; // <-- Added setDoc
import {
  Users,
  FileText,
  User,
  Settings,
  ShieldAlert,
  Sidebar as SidebarIcon,
  Search,
  Upload,
  Plus,
  X,
  TrendingUp,
  Loader2
} from "lucide-react";

interface UserData {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  studentId?: string;
  role?: string;
  section?: string;
  password?: string;
}

const AdminUsers: React.FC = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("Chairperson");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // DB State
  const [usersList, setUsersList] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modals
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  
  // Form State
  const [isSaving, setIsSaving] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({
    role: "Student",
    plvId: "",
    firstName: "",
    lastName: "",
    email: "",
    section: "",
    password: ""
  });

  // Auto-generate Password Effect
  useEffect(() => {
    // Only auto-generate when creating a NEW user
    if (!editingUserId) {
      const cleanName = userForm.lastName.replace(/\s+/g, '').toUpperCase();
      const cleanId = userForm.plvId.trim();
      
      // Extract the last 4 characters of the ID
      const suffix = cleanId.length >= 4 ? cleanId.slice(-4) : "";
      
      if (cleanName && suffix.length === 4) {
        setUserForm(prev => ({ ...prev, password: `${cleanName}-${suffix}` }));
      }
    }
  }, [userForm.lastName, userForm.plvId, editingUserId]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u || u.email !== "chairperson@gmail.com") {
        navigate("/"); 
      } else {
        fetchAllUsers();
      }
    });
    return () => unsub();
  }, [navigate]);

  const fetchAllUsers = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      const users = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserData[];
      setUsersList(users);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setUserForm({ role: "Student", plvId: "", firstName: "", lastName: "", email: "", section: "", password: "" });
    setEditingUserId(null);
  };

  const openAddModal = () => {
    resetForm();
    setIsAddUserModalOpen(true);
  };

  const handleEditClick = (user: UserData) => {
    setEditingUserId(user.id);
    setUserForm({
      role: user.role || "Student",
      plvId: user.studentId || "",
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      section: user.section || "",
      password: user.password || "" 
    });
    setIsAddUserModalOpen(true);
  };

  // --- THE MAGIC SAVE FUNCTION ---
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const userData = {
        firstName: userForm.firstName,
        lastName: userForm.lastName,
        email: userForm.email,
        role: userForm.role,
        studentId: userForm.plvId,
        section: userForm.section,
        password: userForm.password // Storing in DB just so admin can see it later if needed
      };

      if (editingUserId) {
        // UPDATE EXISTING USER IN DATABASE ONLY
        await updateDoc(doc(db, "users", editingUserId), userData);
        setUsersList(prev => prev.map(u => u.id === editingUserId ? { ...u, ...userData } : u));
        alert("User database profile updated successfully!");
      } else {
        // CREATE NEW USER IN AUTHENTICATION AND DATABASE
        
        // 1. Create the actual login credentials secretly
        const newAuthUid = await adminCreateUserAuth(userForm.email, userForm.password);

        // 2. Save their profile to the database, binding it to that new Auth UID!
        await setDoc(doc(db, "users", newAuthUid), {
          ...userData,
          createdAt: serverTimestamp()
        });

        setUsersList(prev => [...prev, { id: newAuthUid, ...userData }]);
        alert("Account created! The user can now log in.");
      }

      setIsAddUserModalOpen(false);
      resetForm();
    } catch (error: any) {
      console.error("Error saving user:", error);
      if (error.code === 'auth/email-already-in-use') {
        alert("Error: That email is already registered in the system.");
      } else {
        alert(error.message || "Failed to save user data.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  // --- DELETE LOGIC ---
  const confirmDelete = async () => {
    if (!userToDelete) return;
    
    try {
      // Deletes from Database (Note: deleting from Firebase Auth requires a backend server, so this just removes their access/profile)
      await deleteDoc(doc(db, "users", userToDelete));
      setUsersList(prev => prev.filter(u => u.id !== userToDelete));
      setUserToDelete(null);
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Failed to delete user.");
    }
  };

  const handleLogout = async () => {
    try { await signOutUser(); localStorage.clear(); sessionStorage.clear(); } catch (e) {}
    navigate("/");
  };

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  // Dynamic Metrics
  const totalStudents = usersList.filter(u => u.role === "Student" || !u.role).length;
  const totalAdvisers = usersList.filter(u => u.role === "Adviser").length;

  const filteredUsers = usersList.filter(u => {
    const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase()) || 
           u.studentId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           u.email?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="flex min-h-screen bg-gray-50/30 overflow-hidden">
      {/* ADMIN SIDEBAR */}
      <aside className={`hidden lg:flex w-72 bg-[#122244] text-white flex-col fixed inset-y-0 shadow-xl z-20 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center gap-3 border-b border-white/10">
          <div className="bg-[#c9a654] p-2 rounded-lg">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight block leading-none">FeasiFy</span>
            <span className="text-[10px] text-gray-300">An AI-Assisted Financial Feasibility System</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-8 mt-4">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">Main Menu</p>
            <div className="space-y-2">
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold bg-[#c9a654] text-white transition-all shadow-md">
                <Users className="w-5 h-5" /> User Accounts Management
              </button>
              <button onClick={() => navigate('/admin/projects')} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-all">
                <FileText className="w-5 h-5" /> Business Feasibility Management
              </button>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">Account</p>
            <div className="space-y-1">
              <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-all">
                <User className="w-5 h-5" /> Profile
              </button>
              <button onClick={() => navigate('/admin/chairpersonsettings')} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-all">
                <Settings className="w-5 h-5" /> Settings
              </button>
              <button onClick={() => setShowLogoutConfirm(true)} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-all">
                <ShieldAlert className="w-5 h-5" /> Logout
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
              <p className="text-sm font-semibold truncate text-white">{userName}</p>
              <p className="text-[10px] text-gray-400 truncate">FM Chairperson</p>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className={`flex-1 transition-all duration-300 ease-in-out min-h-screen ${isSidebarOpen ? 'lg:ml-72' : 'ml-0'}`}>
        <div className="bg-white border-b border-gray-100 p-4 flex items-center gap-2 text-sm text-gray-500">
          <SidebarIcon className="w-4 h-4 cursor-pointer hover:text-gray-800 transition-colors" onClick={() => setIsSidebarOpen(!isSidebarOpen)} />
          <span className="mx-2">|</span>
          <span className="font-semibold text-gray-900">FeasiFy</span>
        </div>

        <div className="p-6 md:p-8 max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[#3d2c23]">User Account Management</h1>
            <p className="text-sm text-gray-500 mt-2 italic">Manage system access by adding, editing, or deleting accounts for students and faculty advisers.</p>
          </div>

          {/* Stats Cards */}
          <div className="flex gap-4 mb-8">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 w-64 border-l-4 border-l-blue-500">
              <p className="text-sm font-semibold text-gray-500 mb-2">Total Students</p>
              <p className="text-3xl font-bold text-[#3d2c23]">{totalStudents}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 w-64 border-l-4 border-l-green-500">
              <p className="text-sm font-semibold text-gray-500 mb-2">Total Advisers</p>
              <p className="text-3xl font-bold text-[#3d2c23]">{totalAdvisers}</p>
            </div>
          </div>

          {/* Table Header Controls */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search by name or ID..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a654]/50"
              />
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              <button className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
                Export
              </button>
              <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#4285F4] text-[#4285F4] text-sm font-semibold rounded-lg hover:bg-blue-50 transition-colors shadow-sm">
                <Upload className="w-4 h-4" /> Create Multiple Accounts
              </button>
              <button 
                onClick={openAddModal}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#c9a654] text-white text-sm font-semibold rounded-lg hover:bg-[#b59545] transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" /> Add User
              </button>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 font-semibold uppercase text-xs tracking-wider border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4">ID Number</th>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Section</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoading ? (
                    <tr><td colSpan={6} className="text-center py-8 text-gray-400">Loading users...</td></tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-gray-400">No users found.</td></tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900">{user.studentId || "—"}</td>
                        <td className="px-6 py-4 font-bold text-[#122244]">{`${user.firstName || ''} ${user.lastName || ''}`}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${user.role === 'Adviser' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                            {user.role || 'Student'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-600">{user.section || "—"}</td>
                        <td className="px-6 py-4 text-gray-600">{user.email || "—"}</td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => handleEditClick(user)} className="text-[#4285F4] font-semibold hover:underline mr-3">Edit</button>
                          <button onClick={() => setUserToDelete(user.id)} className="text-red-500 font-semibold hover:underline">Delete</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL: Add/Edit User */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-[#122244]">
                {editingUserId ? "Edit Account" : "Create New Account"}
              </h2>
              <button onClick={() => setIsAddUserModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-bold text-gray-700 block mb-1">Role</label>
                <select 
                  value={userForm.role}
                  onChange={(e) => setUserForm({...userForm, role: e.target.value})}
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#c9a654]/50 outline-none"
                >
                  <option value="Student">Student</option>
                  <option value="Adviser">Adviser</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700 block mb-1">
                  {userForm.role === "Student" ? "Student ID" : "Faculty ID"}
                </label>
                <input 
                  type="text" 
                  required
                  value={userForm.plvId}
                  onChange={(e) => setUserForm({...userForm, plvId: e.target.value})}
                  placeholder={userForm.role === "Student" ? "e.g. 23-xxxx" : "e.g. Fxx-xxxx"} 
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#c9a654]/50 outline-none"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-sm font-bold text-gray-700 block mb-1">First Name</label>
                  <input type="text" required value={userForm.firstName} onChange={(e) => setUserForm({...userForm, firstName: e.target.value})} placeholder="Juan" className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#c9a654]/50 outline-none" />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-bold text-gray-700 block mb-1">Last Name</label>
                  <input type="text" required value={userForm.lastName} onChange={(e) => setUserForm({...userForm, lastName: e.target.value})} placeholder="Dela Cruz" className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#c9a654]/50 outline-none" />
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700 block mb-1">PLV Email</label>
                <input type="email" required value={userForm.email} onChange={(e) => setUserForm({...userForm, email: e.target.value})} placeholder="name@plv.edu.ph" className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#c9a654]/50 outline-none" />
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700 block mb-1">
                  {userForm.role === "Student" ? "Student Section" : "Assign Advisory Section"}
                </label>
                <input 
                  type="text" 
                  value={userForm.section} 
                  onChange={(e) => setUserForm({...userForm, section: e.target.value})} 
                  placeholder="e.g. FM 3-1" 
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#c9a654]/50 outline-none" 
                />
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700 block mb-1">Password</label>
                <input 
                  type="text" 
                  required
                  value={userForm.password}
                  onChange={(e) => setUserForm({...userForm, password: e.target.value})}
                  placeholder="Auto-generated or enter manually" 
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#c9a654]/50 outline-none font-mono text-gray-700" 
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsAddUserModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-[#4285F4] hover:bg-blue-50 rounded-lg transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isSaving} className="px-5 py-2.5 text-sm font-bold text-white bg-[#c9a654] hover:bg-[#b59545] rounded-lg shadow-md transition-colors flex items-center gap-2 disabled:opacity-70">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingUserId ? "Save Changes" : <><Plus className="w-4 h-4" /> Create Account</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {userToDelete && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete User</h3>
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to permanently delete this user? This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setUserToDelete(null)} className="px-4 py-2 text-sm font-semibold text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={confirmDelete} className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-md">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Logout</h3>
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to log out of your account?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowLogoutConfirm(false)} className="px-4 py-2 text-sm font-semibold text-gray-700 border border-gray-200 rounded-lg">Cancel</button>
              <button onClick={handleLogout} className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg">Logout</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;