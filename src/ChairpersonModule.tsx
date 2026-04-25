import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db, signOutUser, adminCreateUserAuth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, serverTimestamp, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import * as XLSX from "xlsx";
import emailjs from "@emailjs/browser";
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
  Loader2,
  Info,
  Download,
  FileSpreadsheet,
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle
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
  isFirstLogin?: boolean;
  createdAt?: any;
  lastLogin?: any;
}

const ChairpersonModule: React.FC = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("Chairperson");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // DB State
  const [usersList, setUsersList] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Tab State
  const [activeTab, setActiveTab] = useState<"Students" | "Advisers">("Students");

  // Modals
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  
  const [showImportResult, setShowImportResult] = useState(false);
  const [importSummary, setImportSummary] = useState({ success: 0, failed: 0 });
  
  // Notification Modal State
  const [showNotification, setShowNotification] = useState(false);
  const [notificationData, setNotificationData] = useState<{
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  }>({
    type: 'success',
    title: '',
    message: ''
  });

  // --- NEW: IMPORT STATE ---
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
    if (!editingUserId) {
      const cleanName = userForm.lastName.replace(/\s+/g, '').toUpperCase();
      const cleanId = userForm.plvId.trim();
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
    setUserForm({ 
      role: activeTab === "Students" ? "Student" : "Adviser", 
      plvId: "", 
      firstName: "", 
      lastName: "", 
      email: "", 
      section: "", 
      password: "" 
    });
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
        password: userForm.password,
        isFirstLogin: true 
      };

      if (editingUserId) {
        await updateDoc(doc(db, "users", editingUserId), userData);
        setUsersList(prev => prev.map(u => u.id === editingUserId ? { ...u, ...userData } : u));
        setNotificationData({
          type: 'success',
          title: 'Profile Updated',
          message: 'User database profile updated successfully!'
        });
        setShowNotification(true);
      } else {
        const newAuthUid = await adminCreateUserAuth(userForm.email, userForm.password);
        
        await setDoc(doc(db, "users", newAuthUid), {
          ...userData,
          createdAt: serverTimestamp()
        });

        let emailSent = true;
        try {
          await emailjs.send(
            "service_u09o2ne",
            "template_fx69don",
            {
              to_email: userForm.email,
              to_name: userForm.firstName,
              password: userForm.password,
              role: userForm.role
            },
            "Iw4MKLYpB4TPgpXLn"
          );
        } catch (emailErr) {
          console.error("Failed to send welcome email:", emailErr);
          emailSent = false;
        }

        setUsersList(prev => [...prev, { id: newAuthUid, ...userData }]);
        
        if (emailSent) {
          setNotificationData({
            type: 'success',
            title: 'Account Created',
            message: 'Account created! A welcome email has been sent to the user.'
          });
        } else {
          setNotificationData({
            type: 'warning',
            title: 'Account Created',
            message: 'Account created, but the welcome email failed to send.'
          });
        }
        setShowNotification(true);
      }

      setIsAddUserModalOpen(false);
      resetForm();
    } catch (error: any) {
      console.error("Error saving user:", error);
      if (error.code === 'auth/email-already-in-use') {
        setNotificationData({
          type: 'error',
          title: 'Email Already Registered',
          message: 'That email is already registered in the system.'
        });
      } else {
        setNotificationData({
          type: 'error',
          title: 'Error',
          message: error.message || 'Failed to save user data.'
        });
      }
      setShowNotification(true);
    } finally {
      setIsSaving(false);
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Student Number", "First Name", "Last Name", "Email", "Section"]
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Student_Accounts_Template.xlsx");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const processImport = async () => {
    if (!selectedFile) return;
    setIsImporting(true);
    setImportProgress("Reading file...");

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawJsonData = XLSX.utils.sheet_to_json<any>(worksheet);
          
          if (rawJsonData.length === 0) {
            setIsImporting(false);
            setNotificationData({
              type: 'error',
              title: 'Empty File',
              message: 'The uploaded file contains no data.'
            });
            setShowNotification(true);
            return;
          }

          const jsonData = rawJsonData.map(row => {
            const normalizedRow: any = {};
            for (const key in row) {
              const cleanKey = key.toLowerCase().replace(/[\s_.-]+/g, '');
              normalizedRow[cleanKey] = row[key];
            }
            return normalizedRow;
          });

          let successCount = 0;
          let errorCount = 0;

          for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i];
            setImportProgress(`Creating account ${i + 1} of ${jsonData.length}...`);

            const idNumber = (row["idnumber"] || row["studentnumber"] || row["studentnum"])?.toString().trim() || "";
            const firstName = (row["firstname"])?.toString().trim() || "";
            const lastName = (row["lastname"])?.toString().trim() || "";
            const email = (row["email"] || row["emailaddress"])?.toString().trim() || "";
            const section = (row["section"] || row["block"])?.toString().trim() || "";

            if (!idNumber && !email) continue;

            const cleanName = lastName.replace(/\s+/g, '').toUpperCase();
            const suffix = idNumber.length >= 4 ? idNumber.slice(-4) : "0000";
            const generatedPassword = `${cleanName}-${suffix}`;

            const userData = {
              firstName,
              lastName,
              email,
              role: "Student", 
              studentId: idNumber,
              section,
              password: generatedPassword,
              isFirstLogin: true
            };

            try {
              const newAuthUid = await adminCreateUserAuth(email, generatedPassword);
              await setDoc(doc(db, "users", newAuthUid), {
                ...userData,
                createdAt: serverTimestamp()
              });
              setUsersList(prev => [...prev, { id: newAuthUid, ...userData }]);
              successCount++;
            } catch (err: any) {
              console.error(`Failed to import user ${email}:`, err);
              errorCount++;
            }
          }

          setImportSummary({ success: successCount, failed: errorCount });
          setImportProgress("");
          setIsImporting(false);
          setSelectedFile(null);
          setIsImportModalOpen(false);
          setShowImportResult(true);

        } catch (err) {
          console.error("Error processing Excel/CSV data:", err);
          setIsImporting(false);
          setNotificationData({
            type: 'error',
            title: 'Formatting Error',
            message: 'Error processing the file. Please ensure it matches the template format.'
          });
          setShowNotification(true);
        }
      };
      reader.readAsArrayBuffer(selectedFile);
    } catch (error) {
      console.error("File reading error:", error);
      setIsImporting(false);
      setNotificationData({
        type: 'error',
        title: 'Upload Error',
        message: 'Could not read the uploaded file.'
      });
      setShowNotification(true);
    }
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    try {
      await deleteDoc(doc(db, "users", userToDelete));
      setUsersList(prev => prev.filter(u => u.id !== userToDelete));
      setUserToDelete(null);
      setNotificationData({
        type: 'success',
        title: 'Account Deleted',
        message: 'The user account has been successfully removed.'
      });
      setShowNotification(true);
    } catch (error) {
      console.error("Error deleting user:", error);
      setNotificationData({
        type: 'error',
        title: 'Deletion Failed',
        message: 'Failed to delete the user account.'
      });
      setShowNotification(true);
    }
  };

  const handleLogout = async () => {
    try { await signOutUser(); localStorage.clear(); sessionStorage.clear(); } catch (e) {}
    navigate("/");
  };

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  // --- DYNAMIC METRICS CALCULATION ---
  const totalStudents = usersList.filter(u => u.role === "Student" || !u.role).length;
  const totalAdvisers = usersList.filter(u => u.role === "Adviser").length;

  const uniqueSections = new Set(
    usersList
      .map(u => u.section?.trim())
      .filter(section => section && section !== "")
  );
  const totalSections = uniqueSections.size;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Helper Function for Active Status
  const isUserActive = (user: UserData) => {
    const dateToUse = user.lastLogin || user.createdAt;
    if (!dateToUse) return false; 
    const loginDate = dateToUse.toDate ? dateToUse.toDate() : new Date(dateToUse);
    return loginDate >= sevenDaysAgo;
  };

  const activeStudentsCount = usersList.filter(u => {
    if (u.role === "Adviser") return false;
    return isUserActive(u);
  }).length;

  const filteredUsers = usersList
    .filter(u => {
      const matchesTab = activeTab === "Students" 
        ? (u.role === "Student" || !u.role) 
        : u.role === "Adviser";

      if (!matchesTab) return false;

      const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
      return fullName.includes(searchTerm.toLowerCase()) || 
             u.studentId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
             u.email?.toLowerCase().includes(searchTerm.toLowerCase());
    })
    .sort((a, b) => {
      const sectionA = (a.section || "").toLowerCase();
      const sectionB = (b.section || "").toLowerCase();
      if (sectionA < sectionB) return -1;
      if (sectionA > sectionB) return 1;
      const idA = (a.studentId || "").toLowerCase();
      const idB = (b.studentId || "").toLowerCase();
      if (idA < idB) return -1;
      if (idA > idB) return 1;
      return 0;
    });

  return (
    <div className="flex min-h-screen bg-gray-50/30 overflow-hidden">
      {/* ADMIN SIDEBAR */}
      <aside className={`hidden lg:flex w-72 bg-[#122244] text-white flex-col fixed inset-y-0 shadow-xl z-20 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center gap-3 border-b border-white/10">
          <img src="/dashboard logo.png" alt="FeasiFy" className="w-70 h-20 object-contain" />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 border-l-4 border-l-blue-500">
              <p className="text-sm font-semibold text-gray-500 mb-2">Total Students</p>
              <p className="text-3xl font-bold text-[#3d2c23]">{totalStudents}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 border-l-4 border-l-green-500">
              <p className="text-sm font-semibold text-gray-500 mb-2">Total Advisers</p>
              <p className="text-3xl font-bold text-[#3d2c23]">{totalAdvisers}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 border-l-4 border-l-purple-500">
              <p className="text-sm font-semibold text-gray-500 mb-2">Total Sections</p>
              <p className="text-3xl font-bold text-[#3d2c23]">{totalSections}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 border-l-4 border-l-orange-500">
              <p className="text-sm font-semibold text-gray-500 mb-2">Active Students (7d)</p>
              <p className="text-3xl font-bold text-[#3d2c23]">{activeStudentsCount}</p>
            </div>
          </div>

          {/* Search and Action Buttons */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder={`Search ${activeTab.toLowerCase()}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a654]/50 shadow-sm"
              />
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              <button 
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#4285F4] text-[#4285F4] text-sm font-semibold rounded-lg hover:bg-blue-50 transition-colors shadow-sm"
              >
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

          {/* Table and Tabs Card */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            
            {/* TABS NAVIGATION */}
            <div className="flex border-b border-gray-100 px-6 pt-2 bg-gray-50/30">
              <button
                onClick={() => setActiveTab("Students")}
                className={`pb-4 pt-2 px-4 text-sm font-bold border-b-2 transition-colors ${
                  activeTab === "Students"
                    ? "border-[#c9a654] text-[#c9a654]"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200"
                }`}
              >
                Students ({totalStudents})
              </button>
              <button
                onClick={() => setActiveTab("Advisers")}
                className={`pb-4 pt-2 px-4 text-sm font-bold border-b-2 transition-colors ${
                  activeTab === "Advisers"
                    ? "border-[#c9a654] text-[#c9a654]"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200"
                }`}
              >
                Faculty Advisers ({totalAdvisers})
              </button>
            </div>

            {/* Data Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50/50 text-gray-500 font-semibold uppercase text-[11px] tracking-wider border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4">ID Number</th>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Section</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {isLoading ? (
                    <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading {activeTab.toLowerCase()}...</td></tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                     <td colSpan={7} className="text-center py-12">
                        <div className="flex flex-col items-center justify-center text-gray-400">
                          <Users className="w-8 h-8 mb-2 opacity-20" />
                          <p>No {activeTab.toLowerCase()} found.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900">{user.studentId || "—"}</td>
                        <td className="px-6 py-4 font-bold text-[#122244]">{`${user.firstName || ''} ${user.lastName || ''}`}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase ${user.role === 'Adviser' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                            {user.role || 'Student'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-600">{user.section || "—"}</td>
                        <td className="px-6 py-4 text-gray-600">{user.email || "—"}</td>
                        <td className="px-6 py-4 font-bold">
                          <span className={isUserActive(user) ? "text-green-600" : "text-red-500"}>
                            {isUserActive(user) ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => handleEditClick(user)} className="text-[#4285F4] font-semibold hover:underline mr-4">Edit</button>
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

      {/* --- NEW: IMPORT ACCOUNTS MODAL --- */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-[#3d2c23]">Create Multiple Accounts</h2>
              <button 
                onClick={() => !isImporting && setIsImportModalOpen(false)} 
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-md hover:bg-gray-100 disabled:opacity-50"
                disabled={isImporting}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8">
              <div className="flex items-center justify-between bg-[#f0f4ff] border border-[#d6e4ff] rounded-xl p-4 mb-8">
                <div className="flex items-center gap-3 text-[#2f54eb]">
                  <Info className="w-5 h-5" />
                  <span className="text-sm font-semibold">Please use the required format.</span>
                </div>
                <button 
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 text-sm font-bold text-[#2f54eb] hover:underline"
                >
                  <Download className="w-4 h-4" /> Download Template Here
                </button>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-2xl bg-gray-50/50 hover:bg-gray-50 transition-colors p-12 text-center relative">
                <input 
                  type="file" 
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  disabled={isImporting}
                />
                
                <div className="flex flex-col items-center justify-center">
                  <div className="w-16 h-16 bg-[#f0f4ff] rounded-2xl flex items-center justify-center mb-4 text-[#2f54eb]">
                    <FileSpreadsheet className="w-8 h-8" />
                  </div>
                  
                  {selectedFile ? (
                    <div className="mb-6">
                      <p className="text-lg font-bold text-gray-800">{selectedFile.name}</p>
                      <p className="text-sm text-gray-500 mt-1">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-lg font-semibold text-gray-700 mb-2">Drag and drop your CSV/Excel file here</p>
                      <p className="text-sm text-gray-500 mb-6">or</p>
                    </>
                  )}
                  
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImporting}
                    className="px-6 py-2.5 bg-white border border-[#2f54eb] text-[#2f54eb] text-sm font-bold rounded-lg shadow-sm hover:bg-[#f0f4ff] transition-colors disabled:opacity-50"
                  >
                    {selectedFile ? "Change File" : "Browse Files"}
                  </button>
                </div>
              </div>

              {isImporting && (
                <div className="mt-6 flex items-center justify-center gap-3 text-sm font-bold text-[#c9a654]">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {importProgress}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
              <button 
                onClick={() => setIsImportModalOpen(false)} 
                disabled={isImporting}
                className="px-6 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={processImport}
                disabled={!selectedFile || isImporting}
                className="px-6 py-2.5 text-sm font-bold text-white bg-[#4285F4] hover:bg-blue-600 rounded-lg shadow-md transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isImporting ? "Processing..." : "Upload & Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add/Edit User */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-[#122244]">
                {editingUserId ? "Edit Account" : `Add New ${userForm.role}`}
              </h2>
              <button onClick={() => setIsAddUserModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-md hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-bold text-gray-700 block mb-1">Role</label>
                <select 
                  value={userForm.role}
                  onChange={(e) => setUserForm({...userForm, role: e.target.value})}
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#c9a654]/50 outline-none transition-shadow"
                >
                  <option value="Student">Student</option>
                  <option value="Adviser">Faculty Adviser</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700 block mb-1">
                  {userForm.role === "Student" ? "Student ID Number" : "Faculty ID Number"}
                </label>
                <input 
                  type="text" 
                  required
                  value={userForm.plvId}
                  onChange={(e) => setUserForm({...userForm, plvId: e.target.value})}
                  placeholder={userForm.role === "Student" ? "e.g. 23-xxxx" : "e.g. Fxx-xxxx"} 
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#c9a654]/50 outline-none transition-shadow"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-sm font-bold text-gray-700 block mb-1">First Name</label>
                  <input type="text" required value={userForm.firstName} onChange={(e) => setUserForm({...userForm, firstName: e.target.value})} placeholder="Juan" className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#c9a654]/50 outline-none transition-shadow" />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-bold text-gray-700 block mb-1">Last Name</label>
                  <input type="text" required value={userForm.lastName} onChange={(e) => setUserForm({...userForm, lastName: e.target.value})} placeholder="Dela Cruz" className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#c9a654]/50 outline-none transition-shadow" />
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700 block mb-1">Email Address</label>
                <input type="email" required value={userForm.email} onChange={(e) => setUserForm({...userForm, email: e.target.value})} placeholder="name@plv.edu.ph" className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#c9a654]/50 outline-none transition-shadow" />
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700 block mb-1">
                  {userForm.role === "Student" ? "Block / Section" : "Advisory Section(s)"}
                </label>
                <input 
                  type="text" 
                  value={userForm.section} 
                  onChange={(e) => setUserForm({...userForm, section: e.target.value})} 
                  placeholder="e.g. FM 3-1" 
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#c9a654]/50 outline-none transition-shadow" 
                />
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700 block mb-1">System Password</label>
                <input 
                  type="text" 
                  required
                  value={userForm.password}
                  onChange={(e) => setUserForm({...userForm, password: e.target.value})}
                  placeholder="Auto-generated or enter manually" 
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#c9a654]/50 outline-none font-mono text-gray-600 transition-shadow" 
                />
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                <button type="button" onClick={() => setIsAddUserModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
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
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Account</h3>
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to permanently delete this user? This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setUserToDelete(null)} className="px-4 py-2.5 text-sm font-bold text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
              <button onClick={confirmDelete} className="px-4 py-2.5 text-sm font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-md transition-colors">Confirm Delete</button>
            </div>
          </div>
        </div>
      )}
      
      {/* CUSTOM IMPORT RESULT MODAL */}
      {showImportResult && (
        <div className="fixed inset-0 bg-[#122244]/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-300">
            <div className="flex flex-col items-center text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 ${importSummary.failed === 0 ? 'bg-green-100' : 'bg-orange-100'}`}>
                {importSummary.failed === 0 ? (
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                ) : (
                  <AlertTriangle className="w-10 h-10 text-orange-500" />
                )}
              </div>

              <h3 className="text-xl font-bold text-[#122244] mb-2">Import Complete</h3>
              <p className="text-sm text-gray-500 mb-6 px-4">
                The student list has been processed. Here is the summary:
              </p>

              <div className="grid grid-cols-2 gap-4 w-full mb-8">
                <div className="bg-green-50/50 border border-green-100 rounded-xl p-4">
                  <p className="text-2xl font-bold text-green-600">{importSummary.success}</p>
                  <p className="text-[10px] font-bold text-green-700 uppercase tracking-widest">Successful</p>
                </div>
                <div className="bg-red-50/50 border border-red-100 rounded-xl p-4">
                  <p className="text-2xl font-bold text-red-600">{importSummary.failed}</p>
                  <p className="text-[10px] font-bold text-red-700 uppercase tracking-widest">Failed/Skipped</p>
                </div>
              </div>

              <button 
                onClick={() => setShowImportResult(false)}
                className="w-full py-3 bg-[#c9a654] text-white font-bold rounded-lg hover:bg-[#b59545] shadow-md transition-all active:scale-[0.98]"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Logout</h3>
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to log out of your Chairperson session?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowLogoutConfirm(false)} className="px-4 py-2.5 text-sm font-bold text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
              <button onClick={handleLogout} className="px-4 py-2.5 text-sm font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-md transition-colors">Logout</button>
            </div>
          </div>
        </div>
      )}

      {/* NOTIFICATION MODAL */}
      {showNotification && (
        <div className="fixed inset-0 bg-[#122244]/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-300">
            <div className="flex flex-col items-center text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 ${
                notificationData.type === 'success' ? 'bg-green-100' :
                notificationData.type === 'error' ? 'bg-red-100' :
                notificationData.type === 'warning' ? 'bg-orange-100' :
                'bg-blue-100'
              }`}>
                {notificationData.type === 'success' && <CheckCircle2 className="w-10 h-10 text-green-600" />}
                {notificationData.type === 'error' && <AlertCircle className="w-10 h-10 text-red-600" />}
                {notificationData.type === 'warning' && <AlertTriangle className="w-10 h-10 text-orange-500" />}
                {notificationData.type === 'info' && <Info className="w-10 h-10 text-blue-600" />}
              </div>

              <h3 className="text-xl font-bold text-[#122244] mb-2">{notificationData.title}</h3>
              <p className="text-sm text-gray-600 mb-6 px-4">
                {notificationData.message}
              </p>

              <button 
                onClick={() => setShowNotification(false)}
                className="w-full py-3 bg-[#c9a654] text-white font-bold rounded-lg hover:bg-[#b59545] shadow-md transition-all active:scale-[0.98]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChairpersonModule;