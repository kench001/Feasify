import React, { useEffect, useState } from "react";
import Skeleton from "react-loading-skeleton";
import { useNavigate } from "react-router-dom";
import { auth, db, signOutUser } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where, onSnapshot } from "firebase/firestore";
import {
  Users,
  FileText,
  User,
  Settings,
  ShieldAlert,
  Search,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Bell,
  Clock
} from "lucide-react";
import ScrollToTopButton from "./components/ScrollToTopButton";
import CustomDropdown from "./components/CustomDropdown";
import MobileBurgerButton from "./components/MobileBurgerButton";
import SidebarCloseButton from "./components/SidebarCloseButton";

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

  useEffect(() => {
    let unsubProjects: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (unsubProjects) { unsubProjects(); unsubProjects = undefined; }
      if (!u || u.email !== "chairperson@gmail.com") {
        navigate("/"); 
      } else {
        unsubProjects = setupProjectsListener();
      }
    });

    return () => {
      unsubAuth();
      if (unsubProjects) unsubProjects();
    };
  }, [navigate]);

  const setupProjectsListener = (): (() => void) => {
    setIsLoading(true);
    let unsubProposals: (() => void) | undefined;

    // Fetch adviser mapping once (advisers change rarely)
    getDocs(query(collection(db, "users"), where("role", "==", "Adviser")))
      .then(() => {}) // pre-warm, actual use is inside snapshot
      .catch(console.error);

    const buildProjectList = (groupDocs: any[], proposalsByGroup: Record<string, any>, adviserBySection: Record<string, string>) => {
      const projList = groupDocs.map((gDoc: any) => {
        const data = gDoc.data ? gDoc.data() : gDoc;
        const id = gDoc.id;
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now());
        const sectionKey = data.section || "";
        const associatedProposal = proposalsByGroup[id];
        return {
          id,
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
      setIsLoading(false);
    };

    // Keep a shared reference to latest data for cross-listener rebuilds
    let latestGroupDocs: any[] = [];
    let latestAdviserBySection: Record<string, string> = {};
    let latestProposalsByGroup: Record<string, any> = {};

    // Listen for group changes (real-time)
    const unsubGroups = onSnapshot(collection(db, "groups"), async (groupSnap) => {
      latestGroupDocs = groupSnap.docs;

      // Re-fetch adviser mapping on group changes (lightweight one-time)
      try {
        const advSnap = await getDocs(query(collection(db, "users"), where("role", "==", "Adviser")));
        latestAdviserBySection = {};
        advSnap.docs.forEach(d => {
          const data = d.data() as any;
          const adviserName = `${data.firstName || ""} ${data.lastName || ""}`.trim() || data.email || "Adviser";
          const sectionValue = data.section;
          if (typeof sectionValue === "string") {
            sectionValue.split(",").map((s: string) => s.trim()).filter(Boolean).forEach((section: string) => {
              latestAdviserBySection[section] = adviserName;
            });
          } else if (Array.isArray(sectionValue)) {
            sectionValue.forEach((section: string) => {
              latestAdviserBySection[section] = adviserName;
            });
          }
        });
      } catch (e) { console.error(e); }

      // Set up or refresh the proposals listener when group list changes
      if (unsubProposals) { unsubProposals(); }
      unsubProposals = onSnapshot(collection(db, "proposals"), (propSnap) => {
        latestProposalsByGroup = {};
        propSnap.docs.forEach(d => {
          const data = d.data() as any;
          if (data.groupId) {
            latestProposalsByGroup[data.groupId] = data;
          }
        });
        buildProjectList(latestGroupDocs, latestProposalsByGroup, latestAdviserBySection);
      }, (err) => console.error("Proposals listener error:", err));

    }, (err) => {
      console.error("Groups listener error:", err);
      setIsLoading(false);
    });

    return () => {
      unsubGroups();
      if (unsubProposals) unsubProposals();
    };
  };

  // Keep fetchAllProjects as manual fallback
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

  // Dynamic Dropdown Options
  const uniqueSections = ["All Sections", ...Array.from(new Set(projects.map(p => p.section).filter(Boolean)))];
  const uniqueAdvisers = ["All Advisers", ...Array.from(new Set(projects.map(p => p.adviserName).filter(Boolean)))];

// Filtering Logic
  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.section?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.adviserName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSection = selectedSection === "All Sections" || p.section === selectedSection;
    const matchesAdviser = selectedAdviser === "All Advisers" || p.adviserName === selectedAdviser;
    
    // Check if the status is Active Business
    const isActiveBusiness = p.status === "Active Business";

    // Return true only if it matches all filters AND is an Active Business
    return matchesSearch && matchesSection && matchesAdviser && isActiveBusiness;
  });
  // KPI Calculations
  const activeBusinessCount = projects.filter(p => p.status === "Active Business").length;
  const positiveFeasibilityCount = projects.filter(p => p.aiStatus === "FEASIBLE" || p.status === "Feasible").length;
  const negativeFeasibilityCount = projects.filter(p => p.aiStatus === "NOT_FEASIBLE" || p.status === "Not Feasible").length;

  return (
    <div className="flex min-h-screen bg-gray-50/30">
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[50] lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      {/* ADMIN SIDEBAR */}
      <aside
        className={`flex flex-col fixed inset-y-0 z-[60] bg-[#122244] text-white shadow-xl transition-[width,transform] duration-300 ease-in-out group overflow-x-hidden ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } w-64 lg:w-16 lg:hover:w-64`}
      >
        {/* Logo Section */}
        <div className="h-16 flex items-center justify-between lg:justify-center px-4 lg:px-3 border-b border-white/10 shrink-0 overflow-hidden">
          {/* Logo.png when sidebar is folded (default) inside circular border with shadow effect */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-b from-white/15 to-white/5 border border-white/20 shadow-[0_4px_12px_rgba(0,0,0,0.35)] flex items-center justify-center overflow-hidden hidden lg:flex lg:group-hover:hidden shrink-0 select-none pointer-events-none">
            <img
              src="/Logo.png"
              alt="FeasiFy"
              className="w-full h-full object-contain scale-[1.35]"
              style={{ transform: "scale(1.35)" }}
            />
          </div>
          {/* dashboard logo when sidebar is hovered or on mobile */}
          <img
            src="/dashboard logo.png"
            alt="FeasiFy"
            className="h-10.5 w-auto max-h-[42px] max-w-[200px] object-contain select-none pointer-events-none block lg:hidden lg:group-hover:block shrink-0"
          />
          <SidebarCloseButton onClick={() => setIsSidebarOpen(false)} />
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto overflow-x-hidden">
          <button
            onClick={() => { setIsSidebarOpen(false); navigate('/admin/users'); }}
            title="User Accounts Management"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-200 hover:text-white hover:bg-white/10 transition-colors group"
          >
            <Users className="w-5 h-5 shrink-0 text-[#c9a654] group-hover:text-[#f0c242] transition-colors" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              User Accounts Management
            </span>
          </button>
          <button
            title="Business Feasibility Management"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-bold bg-[#c9a654] text-[#122244] transition-all shadow-md"
          >
            <FileText className="w-5 h-5 shrink-0 text-[#122244]" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              Business Feasibility Management
            </span>
          </button>
          <button
            onClick={() => { setIsSidebarOpen(false); navigate('/admin/chairpersonsettings'); }}
            title="Settings"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-200 hover:text-white hover:bg-white/10 transition-colors group"
          >
            <Settings className="w-5 h-5 shrink-0 text-[#c9a654] group-hover:text-[#f0c242] transition-colors" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              Settings
            </span>
          </button>
        </nav>

        {/* Bottom Logout Button */}
        <div className="p-3 border-t border-white/10 shrink-0">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            title="Logout"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
          >
            <ShieldAlert className="w-5 h-5 shrink-0 text-red-400" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              Logout
            </span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className={`flex-1 transition-all duration-300 ease-in-out min-h-screen ${isSidebarOpen ? 'lg:ml-16' : 'ml-0'}`}>
        <div className="bg-white border-b border-gray-100 shadow-[0_3px_10px_rgba(0,0,0,0.06)] px-4 sm:px-6 py-3 flex items-center justify-between text-sm text-gray-500 sticky top-0 z-30">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <MobileBurgerButton onClick={() => setIsSidebarOpen(!isSidebarOpen)} />
            <span
              className="font-semibold text-gray-900 hover:text-[#c9a654] cursor-pointer transition-colors shrink-0"
              onClick={() => navigate("/admin/users")}
            >
              FeasiFy
            </span>
            <span className="text-gray-400 shrink-0">›</span>
            <span className="font-semibold text-gray-900 truncate">Feasibility Projects</span>
            <span className="text-gray-300 hidden sm:inline shrink-0">|</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#122244] text-white shadow-xs tracking-wide whitespace-nowrap hidden sm:inline-block shrink-0">
              Chairperson Portal
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/admin/chairpersonnotification")}
              className="p-2 text-gray-500 hover:text-[#122244] hover:bg-gray-100 rounded-lg transition-all relative"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse ring-2 ring-white"></span>
              )}
            </button>
            <div className="h-6 w-px bg-gray-200"></div>
            <div
              onClick={() => navigate("/admin/chairpersonsetting")}
              className="flex items-center gap-3 cursor-pointer hover:opacity-85 transition-opacity"
            >
              <div className="w-9 h-9 rounded-full bg-[#c9a654] text-white flex items-center justify-center font-bold text-sm shadow-xs flex-shrink-0">
                {getInitials(userName)}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-gray-900 leading-tight">
                  {userName || "Chairperson"}
                </p>
                <p className="text-[10px] text-gray-400 font-medium">FM Chairperson</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 md:p-8 max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[#3d2c23]">Business Feasibility Management</h1>
            <p className="text-sm text-gray-500 mt-2 italic">Oversee and track all business feasibility study projects.</p>
          </div>

          {/* Stats Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {isLoading ? (
              Array.from({length: 4}).map((_, i) => (
                 <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 border-l-4 border-gray-200">
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
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 border-l-4 border-l-[#c9a654]">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Studies</p>
                  <p className="text-3xl font-extrabold text-[#122244]">{projects.length}</p>
                </div>
                <FileText className="w-8 h-8 text-gray-200" />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 border-l-4 border-l-blue-500">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Active Business</p>
                  <p className="text-3xl font-extrabold text-[#122244]">{activeBusinessCount}</p>
                </div>
                <Briefcase className="w-8 h-8 text-blue-100" />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 border-l-4 border-l-green-500">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Positive Feasibility</p>
                  <p className="text-3xl font-extrabold text-green-600">{positiveFeasibilityCount}</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-green-100" />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 border-l-4 border-l-red-500">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Negative Feasibility</p>
                  <p className="text-3xl font-extrabold text-red-600">{negativeFeasibilityCount}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-red-100" />
              </div>
            </div>
              </>
            )}
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
            
            <div className="flex flex-wrap items-center gap-4 w-full md:w-auto text-sm">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-gray-500 font-semibold whitespace-nowrap">Section:</span>
                <CustomDropdown 
                  value={selectedSection}
                  onChange={(val) => setSelectedSection(val)}
                  options={uniqueSections.map((sec) => ({ value: sec, label: sec }))}
                  className="w-full sm:w-44"
                  buttonClassName="py-2 text-xs font-semibold"
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-gray-500 font-semibold whitespace-nowrap">Adviser:</span>
                <CustomDropdown 
                  value={selectedAdviser}
                  onChange={(val) => setSelectedAdviser(val)}
                  options={uniqueAdvisers.map((adv) => ({ value: adv, label: adv }))}
                  className="w-full sm:w-48"
                  buttonClassName="py-2 text-xs font-semibold"
                />
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
                    <tr><td colSpan={5} className="p-8 text-center text-gray-400">No projects found matching your filters.</td></tr>
                  ) : (
                    filteredProjects.map((project, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-5 font-bold text-[#122244]">{project.name || "Untitled"}</td>
                        <td className="px-6 py-5 font-semibold text-gray-700">{project.section || "N/A"}</td>
                        <td className="px-6 py-5 text-gray-800">{project.leaderName || "Unknown"}</td>
                        <td className="px-6 py-5">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                            project.status === 'Feasible' || project.aiStatus === 'FEASIBLE' ? 'bg-green-50 text-green-600' : 
                            project.status === 'Not Feasible' || project.aiStatus === 'NOT_FEASIBLE' ? 'bg-red-50 text-red-600' : 
                            project.status === 'Active Business' ? 'bg-blue-50 text-blue-600' :
                            'bg-gray-100 text-gray-600'
                          }`}>
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
      {/* Scroll to Top */}
      <ScrollToTopButton />
    </div>
  );
};

export default ChairpersonFeasib;