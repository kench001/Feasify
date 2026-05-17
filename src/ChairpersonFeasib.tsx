import React, { useEffect, useState } from "react";
import Skeleton from "react-loading-skeleton";
import { useNavigate } from "react-router-dom";
import { auth, db, signOutUser } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import {
  Users,
  FileText,
  User,
  Settings,
  ShieldAlert,
  Sidebar as SidebarIcon,
  Search,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Bell
} from "lucide-react";

interface ProjectData {
  id: string;
  name: string;
  section: string;
  leaderName: string;
  adviserName: string;
  status: string;
  aiStatus: string;
  date: string;
  category: string;
  memberCount: number;
}

const ChairpersonFeasib: React.FC = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("Chairperson");
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSection, setSelectedSection] = useState("All Sections");
  const [selectedAdviser, setSelectedAdviser] = useState("All Advisers");
  const [isLoading, setIsLoading] = useState(true);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  // Initialize and track theme setting dynamically from localStorage
  const [darkModeEnabled] = useState(() => {
    const saved = localStorage.getItem("darkModeEnabled");
    return saved !== null ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u || u.email !== "chairperson@gmail.com") {
        navigate("/"); 
      } else {
        fetchAllProjects();
      }
    });
    return () => unsub();
  }, [navigate]);

  const fetchAllProjects = async () => {
    setIsLoading(true);
    try {
      const [groupsSnapshot, adviserSnapshot, proposalsSnapshot] = await Promise.all([
        getDocs(collection(db, "groups")),
        getDocs(query(collection(db, "users"), where("role", "==", "Adviser"))),
        getDocs(collection(db, "proposals"))
      ]);

      const adviserBySection: Record<string, string> = {};
      adviserSnapshot.docs.forEach(doc => {
        const data = doc.data() as any;
        const adviserName = `${data.firstName || ""} ${data.lastName || ""}`.trim() || data.email || "Adviser";
        const sectionValue = data.section;
        if (typeof sectionValue === "string") {
          sectionValue.split(",").map((s: string) => s.trim()).filter(Boolean).forEach((section: string) => {
            adviserBySection[section] = adviserName;
          });
        } else if (Array.isArray(sectionValue)) {
          sectionValue.forEach((section: string) => {
            adviserBySection[section] = adviserName;
          });
        }
      });

      const proposalsByGroup: Record<string, any> = {};
      proposalsSnapshot.docs.forEach(doc => {
        const data = doc.data() as any;
        if (data.groupId) {
          proposalsByGroup[data.groupId] = data;
        }
      });

      const projList = groupsSnapshot.docs.map(doc => {
        const data = doc.data() as any;
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now());
        const sectionKey = data.section || "";
        const associatedProposal = proposalsByGroup[doc.id];
        
        return {
          id: doc.id,
          name: data.title || "Pending Title...",
          section: sectionKey || "Unknown Section",
          leaderName: data.leaderName || "Unknown Leader",
          adviserName: adviserBySection[sectionKey] || "Unassigned",
          status: data.status || (data.isSetup ? "Feasible" : "Pending"),
          aiStatus: associatedProposal?.aiAnalysis?.status || "PENDING",
          category: data.category || data.section || "General",
          memberCount: Array.isArray(data.memberIds) ? data.memberIds.length + 1 : 1,
          date: createdAt.toLocaleDateString()
        } as ProjectData;
      });
      sessionStorage.setItem('adminProjectCount', projList.length.toString());
      setProjects(projList);
    } catch (error) {
      console.error("Error fetching all projects:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try { await signOutUser(); localStorage.clear(); sessionStorage.clear(); } catch (e) {}
    navigate("/");
  };

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  const uniqueSections = ["All Sections", ...Array.from(new Set(projects.map(p => p.section).filter(Boolean)))];
  const uniqueAdvisers = ["All Advisers", ...Array.from(new Set(projects.map(p => p.adviserName).filter(Boolean)))];

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.section?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.adviserName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSection = selectedSection === "All Sections" || p.section === selectedSection;
    const matchesAdviser = selectedAdviser === "All Advisers" || p.adviserName === selectedAdviser;
    const isActiveBusiness = p.status === "Active Business";

    return matchesSearch && matchesSection && matchesAdviser && isActiveBusiness;
  });

  const activeBusinessCount = projects.filter(p => p.status === "Active Business").length;
  const positiveFeasibilityCount = projects.filter(p => p.aiStatus === "FEASIBLE" || p.status === "Feasible").length;
  const negativeFeasibilityCount = projects.filter(p => p.aiStatus === "NOT_FEASIBLE" || p.status === "Not Feasible").length;

  return (
    <div className={`flex min-h-screen overflow-hidden transition-colors duration-200 ${darkModeEnabled ? "bg-[#0f172a] text-gray-100" : "bg-gray-50 text-gray-900"}`}>
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[50] lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      {/* ADMIN SIDEBAR */}
      <aside
        className={`flex w-72 text-white flex-col fixed inset-y-0 shadow-xl z-[60] transition-all duration-300 ease-in-out border-r border-transparent dark:border-gray-800 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 ${darkModeEnabled ? "bg-[#0b1428]" : "bg-[#122244]"}`}
      >
        <div className={`p-6 flex items-center gap-3 border-b ${darkModeEnabled ? "border-gray-800" : "border-white/10"}`}>
          <img src="/dashboard logo.png" alt="FeasiFy" className="w-70 h-20 object-contain" />
        </div>

        <nav className="flex-1 p-4 space-y-8 mt-4">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">Main Menu</p>
            <div className="space-y-2">
              <button onClick={() => navigate('/admin/users')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${darkModeEnabled ? "text-gray-300 hover:text-white hover:bg-white/5" : "text-gray-300 hover:text-white hover:bg-white/10"}`}>
                <Users className="w-5 h-5" /> User Accounts Management
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold bg-[#c9a654] text-white transition-all shadow-md">
                <FileText className="w-5 h-5" /> Business Feasibility Management
              </button>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">Account</p>
            <div className="space-y-1">
              <button onClick={() => navigate('/admin/profile')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${darkModeEnabled ? "text-gray-300 hover:text-white hover:bg-white/5" : "text-gray-300 hover:text-white hover:bg-white/10"}`}>
                <User className="w-5 h-5" /> Profile
              </button>
              <button onClick={() => navigate('/admin/chairpersonsettings')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${darkModeEnabled ? "text-gray-300 hover:text-white hover:bg-white/5" : "text-gray-300 hover:text-white hover:bg-white/10"}`}>
                <Settings className="w-5 h-5" /> Settings
              </button>
              <button onClick={() => setShowLogoutConfirm(true)} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${darkModeEnabled ? "text-gray-300 hover:text-white hover:bg-white/5" : "text-gray-300 hover:text-white hover:bg-white/10"}`}>
                <ShieldAlert className="w-5 h-5" /> Logout
              </button>
            </div>
          </div>
        </nav>

        <div className={`p-4 border-t bg-black/20 ${darkModeEnabled ? "border-gray-800 bg-gray-900/50" : "border-white/10"}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#c9a654] flex items-center justify-center font-bold text-sm">
              {getInitials(userName)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-white">{userName}</p>
              <p className="text-[10px] text-gray-400 truncate">FM Chairperson</p>
            </div>
            <button
              onClick={() => navigate("/admin/chairpersonnotification")}
              className={`p-2 rounded-lg transition-all relative flex-shrink-0 ${darkModeEnabled ? "text-gray-400 hover:text-white hover:bg-white/5" : "text-gray-300 hover:text-white hover:bg-white/10"}`}
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
      <main className={`flex-1 transition-all duration-300 ease-in-out min-h-screen flex flex-col ${isSidebarOpen ? 'lg:ml-72' : 'ml-0'}`}>
        <div className={`p-4 flex items-center gap-2 text-sm border-b transition-colors ${darkModeEnabled ? "bg-gray-800/50 border-gray-700 text-gray-400" : "bg-white border-gray-100 text-gray-500"}`}>
          <SidebarIcon className={`w-4 h-4 cursor-pointer transition-colors ${darkModeEnabled ? "hover:text-gray-200" : "hover:text-gray-800"}`} onClick={() => setIsSidebarOpen(!isSidebarOpen)} />
          <span className={`mx-2 ${darkModeEnabled ? "text-gray-700" : "text-gray-300"}`}>|</span>
          <span className={`cursor-pointer transition-colors ${darkModeEnabled ? "hover:text-[#c9a654] text-gray-300" : "hover:text-[#c9a654] text-gray-900"}`} onClick={() => navigate('/admin/users')}>FeasiFy</span>
          <span className={`mx-1 ${darkModeEnabled ? "text-gray-600" : "text-gray-400"}`}>›</span>
          <span className={`font-semibold ${darkModeEnabled ? "text-white" : "text-gray-900"}`}>Business Feasibility Management</span>
        </div>

        <div className="p-6 md:p-8 max-w-7xl mx-auto w-full">
          <div className="mb-8">
            <h1 className={`text-3xl font-bold ${darkModeEnabled ? "text-white" : "text-[#3d2c23]"}`}>Business Feasibility Management</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 italic">Oversee and track all business feasibility study projects.</p>
          </div>

          {/* Stats Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {isLoading ? (
              Array.from({length: 4}).map((_, i) => (
                 <div key={i} className={`rounded-xl border shadow-sm p-5 border-l-4 ${darkModeEnabled ? "bg-gray-800 border-gray-700 border-l-gray-600" : "bg-white border-gray-100 border-l-gray-200"}`}>
                   <div className="flex justify-between items-start">
                     <div className="w-full">
                       <Skeleton width={120} height={12} className="mb-2" />
                       <Skeleton width={40} height={32} />
                     </div>
                     <Skeleton width={32} height={32} circle />
                   </div>
                 </div>
              ))
            ) : (
              <>
                <div className={`rounded-xl border shadow-sm p-5 border-l-4 border-l-[#c9a654] transition-colors ${darkModeEnabled ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Studies</p>
                      <p className={`text-3xl font-extrabold ${darkModeEnabled ? "text-white" : "text-[#122244]"}`}>{projects.length}</p>
                    </div>
                    <FileText className="w-8 h-8 text-gray-200 dark:text-gray-700" />
                  </div>
                </div>

                <div className={`rounded-xl border shadow-sm p-5 border-l-4 border-l-blue-500 transition-colors ${darkModeEnabled ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Active Business</p>
                      <p className={`text-3xl font-extrabold ${darkModeEnabled ? "text-white" : "text-[#122244]"}`}>{activeBusinessCount}</p>
                    </div>
                    <Briefcase className="w-8 h-8 text-blue-100 dark:text-blue-900/40" />
                  </div>
                </div>

                <div className={`rounded-xl border shadow-sm p-5 border-l-4 border-l-green-500 transition-colors ${darkModeEnabled ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Positive Feasibility</p>
                      <p className="text-3xl font-extrabold text-green-600 dark:text-green-500">{positiveFeasibilityCount}</p>
                    </div>
                    <CheckCircle2 className="w-8 h-8 text-green-100 dark:text-green-900/40" />
                  </div>
                </div>

                <div className={`rounded-xl border shadow-sm p-5 border-l-4 border-l-red-500 transition-colors ${darkModeEnabled ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Negative Feasibility</p>
                      <p className="text-3xl font-extrabold text-red-600 dark:text-red-500">{negativeFeasibilityCount}</p>
                    </div>
                    <AlertCircle className="w-8 h-8 text-red-100 dark:text-red-900/40" />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Controls */}
          <div className={`flex flex-col md flex-row justify-between items-start md:items-center gap-4 mb-6 p-4 rounded-xl border shadow-sm transition-colors ${darkModeEnabled ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search company or title..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a654]/50 transition-colors ${darkModeEnabled ? "bg-gray-900 border-gray-700 text-white placeholder-gray-600" : "bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400"}`}
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-4 w-full md:w-auto text-sm">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-gray-500 dark:text-gray-400 font-semibold whitespace-nowrap">Section:</span>
                <select 
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className={`w-full sm:w-auto border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#c9a654]/50 transition-colors ${darkModeEnabled ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-200 text-gray-800"}`}
                >
                  {uniqueSections.map((section, idx) => (
                    <option key={idx} value={section}>{section}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-gray-500 dark:text-gray-400 font-semibold whitespace-nowrap">Adviser:</span>
                <select 
                  value={selectedAdviser}
                  onChange={(e) => setSelectedAdviser(e.target.value)}
                  className={`w-full sm:w-auto border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#c9a654]/50 transition-colors ${darkModeEnabled ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-200 text-gray-800"}`}
                >
                  {uniqueAdvisers.map((adviser, idx) => (
                    <option key={idx} value={adviser}>{adviser}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Data Table */}
          <div className={`rounded-xl border shadow-sm overflow-hidden transition-colors ${darkModeEnabled ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className={`font-bold uppercase text-xs tracking-wider border-b ${darkModeEnabled ? "text-gray-400 border-gray-700 bg-gray-900/20" : "text-gray-500 border-gray-100 bg-transparent"}`}>
                  <tr>
                    <th className="px-6 py-5">Project/Business Name</th>
                    <th className="px-6 py-5">Section</th>
                    <th className="px-6 py-5">Leader</th>
                    <th className="px-6 py-5">Status</th>
                    <th className="px-6 py-5">Adviser</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${darkModeEnabled ? "divide-gray-700" : "divide-gray-100"}`}>
                  {isLoading ? (
                    Array.from({length: Math.min(parseInt(sessionStorage.getItem('adminProjectCount') || '5', 10) || 5, 10)}).map((_, i) => (
                      <tr key={i}>
                        <td className="px-6 py-5"><Skeleton width={150} /></td>
                        <td className="px-6 py-5"><Skeleton width={80} /></td>
                        <td className="px-6 py-5"><Skeleton width={120} /></td>
                        <td className="px-6 py-5"><Skeleton width={100} borderRadius={999} /></td>
                        <td className="px-6 py-5"><Skeleton width={120} /></td>
                      </tr>
                    ))
                  ) : filteredProjects.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-gray-400 dark:text-gray-500">No projects found matching your filters.</td></tr>
                  ) : (
                    filteredProjects.map((project, idx) => (
                      <tr key={idx} className={`transition-colors ${darkModeEnabled ? "hover:bg-gray-700/30" : "hover:bg-gray-50/50"}`}>
                        <td className={`px-6 py-5 font-bold ${darkModeEnabled ? "text-white" : "text-[#122244]"}`}>{project.name || "Untitled"}</td>
                        <td className={`px-6 py-5 font-semibold ${darkModeEnabled ? "text-gray-300" : "text-gray-700"}`}>{project.section || "N/A"}</td>
                        <td className={darkModeEnabled ? "text-gray-300" : "text-gray-800"}>{project.leaderName || "Unknown"}</td>
                        <td className="px-6 py-5">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                            project.status === 'Feasible' || project.aiStatus === 'FEASIBLE' ? (darkModeEnabled ? 'bg-green-950/40 text-green-400' : 'bg-green-50 text-green-600') : 
                            project.status === 'Not Feasible' || project.aiStatus === 'NOT_FEASIBLE' ? (darkModeEnabled ? 'bg-red-950/40 text-red-400' : 'bg-red-50 text-red-600') : 
                            project.status === 'Active Business' ? (darkModeEnabled ? 'bg-blue-950/40 text-blue-400' : 'bg-blue-50 text-blue-600') :
                            (darkModeEnabled ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600')
                          }`}>
                            {project.status || "Pending"}
                          </span>
                        </td>
                        <td className={darkModeEnabled ? "text-gray-300" : "text-gray-800"}>{project.adviserName || "Unassigned"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-xl p-6 w-full max-w-sm shadow-2xl border ${darkModeEnabled ? "bg-gray-800 border-gray-700" : "bg-white border-transparent"}`}>
            <h3 className={`text-lg font-bold mb-2 ${darkModeEnabled ? "text-white" : "text-gray-900"}`}>Confirm Logout</h3>
            <p className={`text-sm mb-6 ${darkModeEnabled ? "text-gray-400" : "text-gray-600"}`}>Are you sure you want to log out of your account?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowLogoutConfirm(false)} className={`px-4 py-2 text-sm font-semibold border rounded-lg transition-colors ${darkModeEnabled ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>Cancel</button>
              <button onClick={handleLogout} className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700">Logout</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChairpersonFeasib;