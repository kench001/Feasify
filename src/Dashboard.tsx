import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, db, signOutUser } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
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
  X,
  Sidebar as SidebarIcon,
  Bell
} from "lucide-react";

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  
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

  const loadUserGroup = async (uid: string, section: string) => {
    setIsLoadingStats(true);
    try {
      const q = query(collection(db, "groups"), where("section", "==", section));
      const snap = await getDocs(q);
      
      // FIX: Explicitly type myGroup as 'any' to resolve TypeScript errors
      let myGroup: any = null;
      snap.forEach(doc => {
        const data = doc.data();
        if (data.leaderId === uid || (data.memberIds && data.memberIds.includes(uid))) {
          myGroup = { id: doc.id, ...data };
        }
      });

      if (myGroup && myGroup.isSetup) {
        setProjects([{
          id: myGroup.id,
          name: myGroup.title || "Untitled Business",
          status: myGroup.status || "In Progress",
          date: myGroup.createdAt ? new Date(myGroup.createdAt.toDate()).toLocaleDateString() : new Date().toLocaleDateString(),
          financialData: myGroup.financialData,
          aiAnalysis: myGroup.aiAnalysis
        }]);
      } else {
        setProjects([]);
      }
    } catch (error) {
      console.error("Failed to load group:", error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    const state = location.state as any;
    if (state && state.showWelcome) {
      setWelcomeName(state.firstName || "User");
      setShowWelcomeToast(true);
      window.history.replaceState({}, document.title);
      setTimeout(() => setShowWelcomeToast(false), 4000);
    }

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        if (u.email?.toLowerCase() === "chairperson@gmail.com") {
          navigate("/admin/users");
          return;
        }

        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          if (snap.exists()) {
            const data = snap.data() as any;
            const first = data.firstName || "";
            const last = data.lastName || "";
            
            if (data.role === "Adviser") {
              navigate("/adviser/dashboard");
              return;
            }

            setUserName([first, last].filter(Boolean).join(" ") || u.displayName || "");
            if (!welcomeName && first) setWelcomeName(first); 

            if (data.section) {
              loadUserGroup(u.uid, data.section);
            } else {
              setIsLoadingStats(false);
            }

          } else {
            setUserName(u.displayName || (u.email ? u.email.split("@")[0] : ""));
            setIsLoadingStats(false);
          }
        } catch (e) {
          setUserName(u.displayName || (u.email ? u.email.split("@")[0] : ""));
          setIsLoadingStats(false);
        }
      } else {
        navigate("/");
      }
    });
    return () => unsub();
  }, [location, welcomeName, navigate]);

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

  const totalProjects = projects.length;
  const feasibleProjects = projects.filter(p => p.status === "Feasible").length;
  const feasiblePercentage = totalProjects > 0 ? Math.round((feasibleProjects / totalProjects) * 100) : 0;
  const inProgressProjects = projects.filter(p => p.status === "In Progress").length;

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

  const recentProjects = [...projects].reverse().slice(0, 4);

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
    if (project.aiAnalysis) return "100%"; 
    if (project.financialData) return "75%"; 
    return "25%"; 
  };

  const getInitials = (name: string) => name ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "U";

  return (
    <>
      <div className="flex min-h-screen bg-gray-50/50 overflow-hidden">
        <aside className={`hidden lg:flex w-64 bg-[#122244] text-white flex-col fixed inset-y-0 shadow-xl z-20 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-6 flex items-center gap-3 border-b border-white/10">
            <img src="/dashboard logo.png" alt="FeasiFy" className="w-70 h-20 object-contain" />
          </div>

          <nav className="flex-1 p-4 space-y-8 mt-4">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">Main Menu</p>
              <div className="space-y-1">
                <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold bg-[#c9a654] text-white transition-all shadow-md">
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
                <button onClick={() => navigate('/profile')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all">
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

        <main className={`flex-1 transition-all duration-300 ease-in-out min-h-screen ${isSidebarOpen ? 'lg:ml-64' : 'ml-0'}`}>
          <div className="bg-white border-b border-gray-100 p-4 flex items-center gap-2 text-sm text-gray-500">
            <SidebarIcon className="w-4 h-4 cursor-pointer hover:text-gray-800 transition-colors" onClick={() => setIsSidebarOpen(!isSidebarOpen)} />
            <span className="mx-2">|</span>
            <span className="font-semibold text-gray-900">FeasiFy</span>
            <span>›</span>
            <span className="font-semibold text-gray-900">Dashboard</span>
          </div>

          <div className="p-6 md:p-8 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 border-b border-gray-200 pb-6">
              <div>
                <h1 className="text-3xl font-extrabold text-[#3d2c23]">Dashboard</h1>
                <p className="text-sm text-gray-500 mt-1 italic">Overview of your feasibility studies and key metrics</p>
              </div>
              <button
                className="flex items-center gap-2 bg-[#c9a654] hover:bg-[#b59545] text-white px-6 py-2.5 rounded-lg font-bold text-sm transition-all shadow-md"
                onClick={() => navigate("/projects")}
              >
                <Plus className="w-4 h-4" /> Open Workspace
              </button>
            </div>

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
                    <div className="p-2 bg-gray-50 rounded-lg group-hover:bg-[#c9a654]/10 transition-colors">
                      <stat.icon className="w-5 h-5 text-gray-400 group-hover:text-[#c9a654]" />
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-[#c9a654]" />
                  </div>
                  <p className="text-3xl font-bold text-[#122244]">{stat.value}</p>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1 mb-1">{stat.label}</p>
                  <p className="text-[10px] text-gray-400 font-medium">{stat.sub}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                <h3 className="font-bold text-[#122244] text-lg">Recent Projects</h3>
                <button className="text-xs font-bold text-[#c9a654] hover:underline flex items-center gap-1" onClick={() => navigate("/projects")}>
                  View all <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              
              <div className="divide-y divide-gray-50">
                {isLoadingStats ? (
                  <div className="p-8 flex justify-center text-gray-400 text-sm">Loading recent projects...</div>
                ) : recentProjects.length === 0 ? (
                  <div className="p-8 flex flex-col items-center justify-center text-center">
                    <p className="text-gray-500 text-sm mb-2">No projects found in database.</p>
                    <button onClick={() => navigate("/projects")} className="text-[#c9a654] text-sm font-semibold hover:underline">
                      Go to Business Proposal workspace
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
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Created: {project.date}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusColor(project.status)}`}>
                          {project.status}
                        </span>
                      </div>
                      <div className="w-full md:w-48 flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[#c9a654] transition-all duration-1000" style={{ width: getEstimatedProgress(project) }} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-500">{getEstimatedProgress(project)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </main>

        {showWelcomeToast && (
          <div className="fixed top-8 left-1/2 -translate-x-1/2 bg-white border-b-4 border-[#c9a654] shadow-2xl p-5 rounded-xl z-50 animate-in slide-in-from-top-5 fade-in duration-300 flex items-center gap-4 w-11/12 max-w-lg">
            <CheckCircle className="w-7 h-7 text-[#c9a654] shrink-0" />
            <div className="flex-1">
              <h4 className="font-bold text-gray-900 text-base">Login Successful</h4>
              <p className="text-gray-600 text-sm mt-1">Welcome to FeasiFy <span className="font-bold text-gray-900">{welcomeName}</span>!</p>
            </div>
            <button onClick={() => setShowWelcomeToast(false)} className="text-gray-400 hover:text-gray-600 self-start mt-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {showLogoutConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowLogoutConfirm(false)} />
            <div className="bg-white rounded-2xl p-6 z-10 w-11/12 max-w-md shadow-xl animate-in fade-in zoom-in-95 duration-200">
              <h3 className="text-lg font-bold text-[#122244] mb-2">Confirm logout</h3>
              <p className="text-sm text-gray-600 mb-6">Are you sure you want to log out?</p>
              <div className="flex justify-end gap-3">
                <button className="px-5 py-2.5 rounded-lg border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50" onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
                <button className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-md" onClick={() => { setShowLogoutConfirm(false); handleLogout(); }}>
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