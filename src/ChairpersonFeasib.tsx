import React, { useEffect, useState } from "react";
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
  Download,
  TrendingUp
} from "lucide-react";

interface ProjectData {
  id: string;
  name: string;
  section: string;
  leaderName: string;
  adviserName: string;
  status: string;
  date: string;
  category: string;
  memberCount: number;
}

const ChairpersonFeasib: React.FC = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("Chairperson");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

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
      const groupsSnapshot = await getDocs(collection(db, "groups"));
      const adviserSnapshot = await getDocs(query(collection(db, "users"), where("role", "==", "Adviser")));

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

      const projList = groupsSnapshot.docs.map(doc => {
        const data = doc.data() as any;
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now());
        const sectionKey = data.section || "";
        return {
          id: doc.id,
          name: data.title || "Pending Title...",
          section: sectionKey || "Unknown Section",
          leaderName: data.leaderName || "Unknown Leader",
          adviserName: adviserBySection[sectionKey] || "Unassigned",
          status: data.status || (data.isSetup ? "Feasible" : "Pending"),
          category: data.category || data.section || "General",
          memberCount: Array.isArray(data.memberIds) ? data.memberIds.length + 1 : 1,
          date: createdAt.toLocaleDateString()
        } as ProjectData;
      });
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

  const filteredProjects = projects.filter(p => 
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.section?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.adviserName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
              <button onClick={() => navigate('/admin/users')} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-all">
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
          <div className="mb-8 flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-bold text-[#3d2c23]">Business Feasibility Management</h1>
              <p className="text-sm text-gray-500 mt-2 italic">Oversee and track all business feasibility study projects.</p>
            </div>
            <button className="flex items-center gap-2 px-6 py-2.5 bg-[#249c74] text-white text-sm font-semibold rounded-lg hover:bg-[#1e8563] transition-colors shadow-sm">
              <Download className="w-4 h-4" /> Export
            </button>
          </div>

          {/* Stats Card */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 w-72 border-l-4 border-l-[#c9a654] mb-8">
            <p className="text-sm font-semibold text-gray-500 mb-2">Total Business Feasibility Studies</p>
            <p className="text-4xl font-bold text-[#3d2c23]">{projects.length}</p>
          </div>

          {/* Controls */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search company or title..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a654]/50 bg-gray-50"
              />
            </div>
            
            <div className="flex items-center gap-4 w-full md:w-auto text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 font-semibold">Section:</span>
                <select className="border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none">
                  <option>All Sections</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 font-semibold">Adviser:</span>
                <select className="border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none">
                  <option>All Advisers</option>
                </select>
              </div>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-gray-500 font-bold uppercase text-xs tracking-wider border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-5">Project/Business Name</th>
                    <th className="px-6 py-5">Section</th>
                    <th className="px-6 py-5">Leader</th>
                    <th className="px-6 py-5">Status</th>
                    <th className="px-6 py-5">Adviser</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoading ? (
                    <tr><td colSpan={5} className="p-8 text-center text-gray-400">Loading projects...</td></tr>
                  ) : filteredProjects.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-gray-400">No projects found.</td></tr>
                  ) : (
                    filteredProjects.map((project, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-5 font-bold text-[#122244]">{project.name || "Untitled"}</td>
                        <td className="px-6 py-5 font-semibold text-gray-700">{project.section || "N/A"}</td>
                        <td className="px-6 py-5 text-gray-800">{project.leaderName || "Unknown"}</td>
                        <td className="px-6 py-5">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${project.status === 'Feasible' ? 'bg-green-50 text-green-600' : project.status === 'Not Feasible' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                            {project.status || "Pending"}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-gray-800">{project.adviserName || "Unassigned"}</td>
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

export default ChairpersonFeasib;