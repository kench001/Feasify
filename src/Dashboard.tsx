import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, db, getUserProjects, signOutUser } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
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
  Plus,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  ArrowRight,
  CheckCircle,
  X
} from "lucide-react";

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  // Real Database State
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Welcome Toast State
  const [showWelcomeToast, setShowWelcomeToast] = useState(false);
  const [welcomeName, setWelcomeName] = useState("");

  const handleLogout = async () => {
    try { await signOutUser(); } catch (e) {}
    try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}
    navigate("/");
  };

  const loadProjects = async (uid: string) => {
    setIsLoadingStats(true);
    try {
      const fetchedProjects = await getUserProjects(uid);
      setProjects(fetchedProjects);
    } catch (error) {
      console.error("Failed to load projects for dashboard:", error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    // Check if we just logged in
    const state = location.state as any;
    if (state && state.showWelcome) {
      setWelcomeName(state.firstName || "User");
      setShowWelcomeToast(true);
      
      // Clear the state so it doesn't pop up again if they refresh
      window.history.replaceState({}, document.title);
      
      // Hide toast after 4 seconds
      setTimeout(() => {
        setShowWelcomeToast(false);
      }, 4000);
    }

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        // Load Real Projects!
        loadProjects(u.uid);

        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          if (snap.exists()) {
            const data = snap.data() as any;
            const first = data.firstName || "";
            const last = data.lastName || "";
            setUserName([first, last].filter(Boolean).join(" ") || u.displayName || "");
            setUserEmail(data.email || u.email || "");
            
            // If they refreshed and didn't trigger the login flag, just silently get the name
            if (!welcomeName && first) setWelcomeName(first); 
          } else {
            setUserName(u.displayName || (u.email ? u.email.split("@")[0] : ""));
            setUserEmail(u.email || "");
          }
        } catch (e) {
          setUserName(u.displayName || (u.email ? u.email.split("@")[0] : ""));
          setUserEmail(u.email || "");
        }
      } else {
        navigate("/");
      }
    });
    return () => unsub();
  }, [location, welcomeName, navigate]);

  // --- Dynamic Dashboard Calculations ---
  const totalProjects = projects.length;
  const feasibleProjects = projects.filter(p => p.status === "Feasible").length;
  const feasiblePercentage = totalProjects > 0 ? Math.round((feasibleProjects / totalProjects) * 100) : 0;
  const inProgressProjects = projects.filter(p => p.status === "In Progress").length;

  // Calculate Average ROI across all projects with financial data
  let totalROI = 0;
  let roiCount = 0;
  projects.forEach(p => {
    if (p.financialData && p.financialData.initialCapital > 0) {
      const exp = p.financialData.expenses || [];
      const inc = p.financialData.incomeSources || [];
      const monthlyExp = exp.reduce((sum: number, e: any) => sum + e.amount, 0);
      const dailyInc = inc.reduce((sum: number, i: any) => sum + i.amount, 0);
      const monthlyInc = dailyInc * 30;
      const netMonthly = monthlyInc - monthlyExp;
      
      const roi = (netMonthly * 12) / p.financialData.initialCapital * 100;
      totalROI += roi;
      roiCount++;
    }
  });
  const avgROI = roiCount > 0 ? (totalROI / roiCount).toFixed(1) : "0";

  // Get the newest projects first
  const recentProjects = [...projects].reverse().slice(0, 4);

  // Helper functions for dynamic UI
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Feasible": return "bg-green-100 text-green-700";
      case "In Progress": return "bg-blue-100 text-blue-700";
      case "Needs Review": return "bg-orange-100 text-orange-700";
      case "Not Feasible": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getEstimatedProgress = (project: any) => {
    if (project.aiAnalysis) return "100%"; // Fully analyzed
    if (project.financialData) return "75%"; // Financials entered, awaiting analysis
    return "25%"; // Just created
  };

  return (
    <>
      <div className="flex min-h-screen bg-gray-50/50">
        {/* SIDEBAR: Professional Dark Navigation */}
        <aside className="hidden lg:flex w-64 bg-[#0f171e] text-white flex-col fixed inset-y-0 shadow-xl z-20">
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
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${item.route === "/dashboard" ? "bg-[#249c74] text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
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
                      if (item.name === "Profile") navigate("/profile");
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
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
                {(() => {
                  const parts = userName.trim().split(/\s+/).filter(Boolean);
                  if (parts.length === 0) return "U";
                  const initials = parts.map((p) => p[0]).slice(0, 2).join("");
                  return initials.toUpperCase();
                })()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{userName || "User"}</p>
                <p className="text-xs text-gray-500 truncate">{userEmail || ""}</p>
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 lg:ml-64 p-4 md:p-8">
          {/* Header Bar */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">Overview of your feasibility studies and key metrics</p>
            </div>
            <button
              className="flex items-center gap-2 bg-[#249c74] hover:bg-[#1e8563] text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all shadow-md shadow-green-900/10"
              onClick={() => navigate("/projects", { state: { openNewProjectModal: true } })}
            >
              <Plus className="w-4 h-4" /> New Project
            </button>
          </div>

          {/* STATS GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total Projects", value: isLoadingStats ? "-" : totalProjects.toString(), sub: "Stored in database", icon: Folder, filterVal: "All Status" },
              { label: "Feasible", value: isLoadingStats ? "-" : feasibleProjects.toString(), sub: `${feasiblePercentage}% success rate`, icon: CheckCircle2, filterVal: "Feasible" },
              { label: "In Progress", value: isLoadingStats ? "-" : inProgressProjects.toString(), sub: "Active analyses", icon: Clock, filterVal: "In Progress" },
              { label: "Avg. ROI", value: isLoadingStats ? "-" : `${avgROI}%`, sub: "Across configured projects", icon: BarChart3, filterVal: "All Status" },
            ].map((stat) => (
              <div 
                key={stat.label} 
                onClick={() => navigate('/projects', { state: { filterStatus: stat.filterVal } })}
                className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all group cursor-pointer"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-gray-50 rounded-lg group-hover:bg-green-50 transition-colors">
                    <stat.icon className="w-5 h-5 text-gray-400 group-hover:text-[#249c74]" />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-[#249c74]" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs font-semibold text-gray-500 mb-1">{stat.label}</p>
                <p className="text-[10px] text-gray-400 font-medium">{stat.sub}</p>
              </div>
            ))}
          </div>

          {/* BOTTOM SECTION: RECENT PROJECTS */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-900">Recent Projects</h3>
              <button className="text-xs font-bold text-[#249c74] hover:underline flex items-center gap-1" onClick={() => navigate("/projects")}>
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            
            <div className="divide-y divide-gray-50">
              {isLoadingStats ? (
                <div className="p-8 flex justify-center text-gray-400 text-sm">Loading recent projects...</div>
              ) : recentProjects.length === 0 ? (
                <div className="p-8 flex flex-col items-center justify-center text-center">
                  <p className="text-gray-500 text-sm mb-2">No projects found in database.</p>
                  <button onClick={() => navigate("/projects", { state: { openNewProjectModal: true } })} className="text-[#249c74] text-sm font-semibold hover:underline">
                    Create your first project
                  </button>
                </div>
              ) : (
                recentProjects.map((project) => (
                  <div 
                    key={project.id} 
                    className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors cursor-pointer" 
                    onClick={() => navigate('/financial-input', { state: { projectId: project.id } })}
                  >
                    <div className="flex items-center gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-gray-900">{project.name}</p>
                        <p className="text-[10px] text-gray-400">Created: {project.date}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusColor(project.status)}`}>
                        {project.status}
                      </span>
                    </div>
                    <div className="w-full md:w-48 flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#249c74] transition-all duration-1000" style={{ width: getEstimatedProgress(project) }} />
                      </div>
                      <span className="text-[10px] font-bold text-gray-500">{getEstimatedProgress(project)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>

        {/* WELCOME TOAST NOTIFICATION - UPDATED TO TOP CENTER */}
        {showWelcomeToast && (
          <div className="fixed top-8 left-1/2 -translate-x-1/2 bg-white border-b-4 border-[#249c74] shadow-2xl p-5 rounded-xl z-50 animate-in slide-in-from-top-5 fade-in duration-300 flex items-center gap-4 w-11/12 max-w-lg">
            <CheckCircle className="w-7 h-7 text-[#249c74] shrink-0" />
            <div className="flex-1">
              <h4 className="font-bold text-gray-900 text-base">Login Successful</h4>
              <p className="text-gray-600 text-sm mt-1">Welcome <span className="font-bold text-gray-900">{welcomeName}</span> to FeasiFy!</p>
            </div>
            <button onClick={() => setShowWelcomeToast(false)} className="text-gray-400 hover:text-gray-600 self-start mt-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* LOGOUT CONFIRMATION */}
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowLogoutConfirm(false)} />
            <div className="bg-white rounded-lg p-6 z-10 w-11/12 max-w-md shadow-xl animate-in fade-in zoom-in-95 duration-200">
              <h3 className="text-lg font-bold mb-2">Confirm logout</h3>
              <p className="text-sm text-gray-600 mb-6">Are you sure you want to log out?</p>
              <div className="flex justify-end gap-3">
                <button className="px-4 py-2 rounded-lg border text-sm font-semibold" onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
                <button className="px-4 py-2 rounded-lg bg-[#249c74] hover:bg-[#1e8563] text-white text-sm font-semibold shadow-md" onClick={() => { setShowLogoutConfirm(false); handleLogout(); }}>
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Dashboard;