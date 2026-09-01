import React, { useEffect, useState } from "react";
import Skeleton from "react-loading-skeleton";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, db, signOutUser } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
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
  Plus,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sidebar as SidebarIcon,
  Bell,
  TrendingUp,
  Package,
  Scale,
  Sparkles,
} from "lucide-react";

interface Project {
  id: string;
  name: string;
  status: string;
  date: string;
  financialData: any;
  aiAnalysis: any;
  isApproved: boolean;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [showWelcomeToast, setShowWelcomeToast] = useState(false);
  const [welcomeName, setWelcomeName] = useState("");

  const handleLogout = async () => {
    try {
      await signOutUser();
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.error(e);
    }
    navigate("/");
  };



  useEffect(() => {
    let unsubscribeProjects: (() => void) | undefined;
    let unsubscribeNotifications: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      // Cleanup previous listeners
      if (unsubscribeProjects) {
        unsubscribeProjects();
        unsubscribeProjects = undefined;
      }
      if (unsubscribeNotifications) {
        unsubscribeNotifications();
        unsubscribeNotifications = undefined;
      }

      if (u) {
        if (u.email?.toLowerCase() === "chairperson@gmail.com") {
          navigate("/admin/users");
          return;
        }

        try {
          const userDoc = await getDoc(doc(db, "users", u.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            const first = data.firstName || "";
            const last = data.lastName || "";

            if (data.isFirstLogin === true) {
              navigate("/profile", {
                state: { forcePasswordChange: true, firstName: first },
              });
              return;
            }

            if (data.role === "Adviser") {
              navigate("/adviser/dashboard");
              return;
            }

            setUserName([first, last].filter(Boolean).join(" ") || u.displayName || "");
            if (!welcomeName && first) setWelcomeName(first);

            // Setup Real-time Notifications
            const notifQ = query(
              collection(db, "notifications"),
              where("userId", "==", u.uid),
              where("isRead", "==", false),
            );
            unsubscribeNotifications = onSnapshot(notifQ, (snap) => {
              setUnreadNotificationCount(snap.size);
            }, (err) => console.error("Notifications listener error:", err));

            // Setup Real-time Projects
            if (data.section) {
              unsubscribeProjects = setupProjectListener(u.uid, data.section);
            } else {
              setIsLoadingStats(false);
            }
          } else {
            setUserName(u.displayName || u.email?.split("@")[0] || "User");
            setIsLoadingStats(false);
          }
        } catch (e) {
          console.error("Dashboard auth effect error:", e);
          setIsLoadingStats(false);
        }
      } else {
        navigate("/");
      }
    });

    return () => {
      unsubAuth();
      if (unsubscribeProjects) unsubscribeProjects();
      if (unsubscribeNotifications) unsubscribeNotifications();
    };
  }, [location, welcomeName, navigate]);

  const setupProjectListener = (uid: string, section: string) => {
    setIsLoadingStats(true);
    const q = query(collection(db, "groups"), where("section", "==", section));

    let unsubscribeProposals: (() => void) | undefined;

    const groupUnsub = onSnapshot(q, (groupSnap) => {
      const myGroups = groupSnap.docs.filter((doc) => {
        const data = doc.data();
        return (
          data.leaderId === uid ||
          (data.memberIds && data.memberIds.includes(uid))
        );
      });

      if (myGroups.length === 0) {
        setProjects([]);
        setIsLoadingStats(false);
        return;
      }

      const groupIds = myGroups.map((d) => d.id);
      if (unsubscribeProposals) unsubscribeProposals();

      const propQ = query(
        collection(db, "proposals"),
        where("groupId", "in", groupIds),
      );

      unsubscribeProposals = onSnapshot(propQ, (propSnap) => {
        const allProjectsList: Project[] = [];
        const proposalsByGroup: Record<string, any[]> = {};

        propSnap.docs.forEach((d) => {
          const data = { id: d.id, ...d.data() };
          const gid = (data as any).groupId;
          if (!proposalsByGroup[gid]) proposalsByGroup[gid] = [];
          proposalsByGroup[gid].push(data);
        });

        myGroups.forEach((groupDoc) => {
          const groupData = groupDoc.data();
          const groupProps = proposalsByGroup[groupDoc.id] || [];

          const approvedProps = groupProps.filter(
            (p) => p.status === "Approved" || p.status === "APPROVED",
          );

          if (approvedProps.length > 0) {
            approvedProps.forEach((pData) => {
              allProjectsList.push({
                id: pData.id,
                name: pData.businessName || pData.title || "Untitled Project",
                status:
                  pData.aiAnalysis?.status === "FEASIBLE"
                    ? "Feasible"
                    : "In Progress",
                date: pData.createdAt?.toDate
                  ? new Date(pData.createdAt.toDate()).toLocaleDateString()
                  : "Recent",
                financialData: pData.financialData || null,
                aiAnalysis: pData.aiAnalysis || null,
                isApproved: true,
              });
            });
          } else if (groupProps.length > 0) {
            allProjectsList.push({
              id: groupDoc.id,
              name: groupData.title || "Pending Business Name",
              status: "Pending",
              date: groupData.createdAt?.toDate
                ? new Date(groupData.createdAt.toDate()).toLocaleDateString()
                : "New",
              financialData: null,
              aiAnalysis: null,
              isApproved: false,
            });
          }
        });

        setProjects(allProjectsList);
        sessionStorage.setItem("dashboardProjectCount", allProjectsList.length.toString());
        setIsLoadingStats(false);
      }, (err) => {
        console.error("Proposals listener error:", err);
        setIsLoadingStats(false);
      });
    }, (err) => {
      console.error("Groups listener error:", err);
      setIsLoadingStats(false);
    });

    return () => {
      groupUnsub();
      if (unsubscribeProposals) unsubscribeProposals();
    };
  };

  const totalProjects = projects.length;
  const totalApproved = projects.filter(p => p.isApproved).length;
  const feasibleProjects = projects.filter(
    (p) => p.status === "Feasible",
  ).length;
  const feasiblePercentage =
    totalApproved > 0
      ? Math.round((feasibleProjects / totalApproved) * 100)
      : 0;
  const inProgressProjects = projects.filter(
    (p) => p.status === "In Progress",
  ).length;

  let totalROI = 0;
  let roiCount = 0;
  projects.forEach((p) => {
    const fin = p.financialData;
    if (fin) {
      const sp = Number(fin.sellingPrice) || 0;
      const ms = Number(fin.monthlySales) || 0;
      const vc = Number(fin.variableCost) || 0;
      const fc = fin.opexList && fin.opexList.length > 0
        ? fin.opexList.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0)
        : (Number(fin.fixedCosts) || 0);
      const cap = Number(fin.cashInvested) || Number(fin.startupCapital) || 0;

      if (cap >= 1000 && sp > 0 && ms > 0) {
        const monthlyRev = sp * ms;
        const monthlyVarCost = vc * ms;
        const netMonthly = monthlyRev - monthlyVarCost - fc;
        const annualNet = netMonthly * 12;
        const roi = (annualNet / cap) * 100;
        if (!isNaN(roi) && isFinite(roi) && roi >= -100 && roi <= 1000) {
          totalROI += roi;
          roiCount++;
        }
      }
    }
  });
  const avgROI = roiCount > 0 ? (totalROI / roiCount).toFixed(1) : "0.0";

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Feasible":
        return "bg-green-100 text-green-700";
      case "In Progress":
        return "bg-blue-100 text-blue-700";
      case "Needs Review":
        return "bg-orange-100 text-orange-700";
      case "Not Feasible":
        return "bg-red-100 text-red-700";
      case "Pending":
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getEstimatedProgress = (project: any) => {
    if (project.aiAnalysis) return "100%";
    if (project.financialData && Object.keys(project.financialData).length > 0)
      return "75%";
    if (project.status === "Pending") return "10%";
    return "25%";
  };

  const getInitials = (name: string) =>
    name
      ? name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
      : "U";

  return (
    <>
      <div className="flex min-h-screen bg-gray-50/50 overflow-hidden">
        {/* Mobile Backdrop */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-[50] lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <aside
          className={`flex w-64 bg-[#122244] text-white flex-col fixed inset-y-0 shadow-xl z-[60] transition-transform duration-300 ease-in-out ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="p-6 flex items-center gap-3 border-b border-white/10">
            <img
              src="/dashboard logo.png"
              alt="FeasiFy"
              className="w-70 h-20 object-contain"
            />
          </div>

          <nav className="flex-1 p-4 space-y-4 mt-2">
            <div className="space-y-1">
              <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold bg-[#c9a654] text-white transition-all shadow-md">
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </button>
              <button
                onClick={() => navigate("/projects")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"
              >
                <Folder className="w-4 h-4" /> Business Proposal
              </button>
              <button
                onClick={() => navigate("/financial-input")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"
              >
                <FileEdit className="w-4 h-4" /> Financial Input
              </button>
              <button
                onClick={() => navigate("/ai-analysis")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"
              >
                <Zap className="w-4 h-4" /> AI Feasibility Analysis
              </button>
              <button
                onClick={() => navigate("/reports")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"
              >
                <BarChart3 className="w-4 h-4" /> Reports
              </button>
              <button
                onClick={() => navigate("/messages")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"
              >
                <MessageCircle className="w-4 h-4" /> Message
              </button>
            </div>

            <div className="pt-4 border-t border-white/10 space-y-1">
              <button
                onClick={() => navigate("/profile")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"
              >
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
          </nav>

          <div className="p-4 border-t border-white/10 bg-black/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#c9a654] flex items-center justify-center font-bold text-sm">
                {getInitials(userName)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-white">
                  {userName || "User"}
                </p>
                <p className="text-[10px] text-gray-400 truncate">Student</p>
              </div>
              <button
                onClick={() => navigate("/notifications")}
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

        <main
          className={`flex-1 transition-all duration-300 ease-in-out min-h-screen ${isSidebarOpen ? "lg:ml-64" : "ml-0"}`}
        >
          <div className="bg-white border-b border-gray-100 p-4 flex items-center gap-2 text-sm text-gray-500">
            <SidebarIcon
              className="w-4 h-4 cursor-pointer hover:text-gray-800 transition-colors"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            />
            <span className="mx-2">|</span>
            <span className="font-semibold text-gray-900">FeasiFy</span>
            <span>›</span>
            <span className="font-semibold text-gray-900">Dashboard</span>
          </div>

          <div className="p-6 md:p-8 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 border-b border-gray-200 pb-6">
              <div>
                <h1 className="text-3xl font-extrabold text-[#3d2c23]">
                  Dashboard
                </h1>
                <p className="text-sm text-gray-500 mt-1 italic">
                  Overview of your feasibility studies and key metrics
                </p>
              </div>
              <button
                className="flex items-center gap-2 bg-[#c9a654] hover:bg-[#b59545] text-white px-6 py-2.5 rounded-lg font-bold text-sm transition-all shadow-md"
                onClick={() => navigate("/projects")}
              >
                <Plus className="w-4 h-4" /> Open Workspace
              </button>
            </div>

            {/* KPI STATS ROW (NAVY BLUE THEME) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {isLoadingStats ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-[#122244] p-6 rounded-2xl border border-white/10 shadow-lg">
                    <div className="flex justify-between items-start mb-4">
                      <Skeleton width={36} height={36} borderRadius={12} baseColor="#1a2f55" highlightColor="#243f70" />
                      <Skeleton width={16} height={16} baseColor="#1a2f55" highlightColor="#243f70" />
                    </div>
                    <Skeleton width={80} height={36} className="mb-1" baseColor="#1a2f55" highlightColor="#243f70" />
                    <Skeleton width={100} height={16} className="mb-1" baseColor="#1a2f55" highlightColor="#243f70" />
                    <Skeleton width={140} height={12} baseColor="#1a2f55" highlightColor="#243f70" />
                  </div>
                ))
              ) : (
                [
                  {
                    label: "Total Approved",
                    value: totalApproved.toString(),
                    sub: "Active businesses in focus",
                    icon: Folder,
                    badge: "bg-blue-500/20 text-blue-300 border border-blue-400/30",
                  },
                  {
                    label: "Feasibility Status",
                    value: feasibleProjects > 0 ? `${feasibleProjects} Feasible` : "Under Study",
                    sub: totalApproved > 0 ? `${feasiblePercentage}% passing rate` : "Awaiting analysis",
                    icon: CheckCircle2,
                    badge: "bg-green-500/20 text-green-300 border border-green-400/30",
                  },
                  {
                    label: "In Progress",
                    value: inProgressProjects.toString(),
                    sub: "Simulations in progress",
                    icon: Clock,
                    badge: "bg-amber-500/20 text-amber-300 border border-amber-400/30",
                  },
                  {
                    label: "Avg. Estimated ROI",
                    value: `${avgROI}%`,
                    sub: "Annual return on capital",
                    icon: TrendingUp,
                    badge: "bg-[#c9a654]/20 text-[#e6c778] border border-[#c9a654]/30",
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    onClick={() => navigate("/projects")}
                    className="bg-[#122244] p-6 rounded-2xl border border-white/10 shadow-lg hover:shadow-2xl hover:border-[#c9a654]/50 transition-all group cursor-pointer relative overflow-hidden"
                  >
                    {/* Subtle glow background */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none group-hover:bg-[#c9a654]/10 transition-colors"></div>

                    <div className="flex justify-between items-start mb-3 relative z-10">
                      <div className={`p-2.5 rounded-xl ${stat.badge} transition-transform group-hover:scale-110 duration-200`}>
                        <stat.icon className="w-5 h-5" />
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-white/40 group-hover:text-[#c9a654] transition-colors" />
                    </div>
                    <p className="text-2xl md:text-3xl font-extrabold text-white tracking-tight relative z-10">
                      {stat.value}
                    </p>
                    <p className="text-[11px] font-bold text-gray-300 uppercase tracking-wider mt-1 mb-0.5 relative z-10">
                      {stat.label}
                    </p>
                    <p className="text-[10px] text-gray-400 font-medium relative z-10">
                      {stat.sub}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* APPROVED BUSINESS PROJECTS CARD */}
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden mb-8">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div>
                  <h3 className="font-extrabold text-[#122244] text-lg tracking-tight">
                    Active Business Workspace
                  </h3>
                  <p className="text-xs text-gray-400 font-medium mt-0.5">
                    Your approved venture and current financial feasibility status
                  </p>
                </div>
                <button
                  className="text-xs font-bold text-[#c9a654] hover:underline flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors"
                  onClick={() => navigate("/projects")}
                >
                  Manage Proposals <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="divide-y divide-gray-100">
                {isLoadingStats ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <Skeleton width={48} height={48} borderRadius={16} />
                        <div className="space-y-1">
                          <Skeleton width={180} height={16} />
                          <Skeleton width={120} height={12} />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Skeleton width={100} height={36} borderRadius={8} />
                        <Skeleton width={100} height={36} borderRadius={8} />
                      </div>
                    </div>
                  ))
                ) : projects.length === 0 ? (
                  <div className="p-12 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4 text-gray-300">
                      <Folder className="w-8 h-8" />
                    </div>
                    <h4 className="font-bold text-gray-800 text-base mb-1">No Active Project Found</h4>
                    <p className="text-gray-400 text-xs max-w-sm mb-6 leading-relaxed">
                      Submit your proposal and have it approved by your adviser to unlock your financial workspace.
                    </p>
                    <button
                      onClick={() => navigate("/projects")}
                      className="px-5 py-2.5 bg-[#122244] hover:bg-[#1a2f55] text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                    >
                      Draft Proposal Now
                    </button>
                  </div>
                ) : (
                  projects.map((project) => {
                    const fin = project.financialData;
                    const price = Number(fin?.sellingPrice) || 0;
                    const volume = Number(fin?.monthlySales) || 0;
                    const monthlySalesEst = price * volume;

                    return (
                      <div
                        key={project.id}
                        className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:bg-gray-50/40 transition-colors"
                      >
                        {/* Project Identity */}
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 bg-[#122244] text-[#c9a654] rounded-2xl flex items-center justify-center font-extrabold text-xl shadow-inner border border-gray-100 shrink-0">
                            {getInitials(project.name)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h4 className="text-base font-extrabold text-[#122244]">
                                {project.name}
                              </h4>
                              <span
                                className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${getStatusColor(project.status)}`}
                              >
                                {project.status}
                              </span>
                            </div>
                            <p className="text-xs text-gray-400 font-medium">
                              Approved Business Charter • Created: {project.date}
                            </p>
                          </div>
                        </div>

                        {/* Financial Snapshot Badges */}
                        <div className="flex flex-wrap items-center gap-4 text-xs">
                          {price > 0 && (
                            <div className="bg-gray-50 border border-gray-200/70 px-3.5 py-2 rounded-xl text-left">
                              <span className="text-[9px] font-bold text-gray-400 uppercase block">Selling Price</span>
                              <span className="font-extrabold text-[#122244]">₱{price.toFixed(2)}</span>
                            </div>
                          )}
                          {monthlySalesEst > 0 && (
                            <div className="bg-green-50 border border-green-200/70 px-3.5 py-2 rounded-xl text-left">
                              <span className="text-[9px] font-bold text-green-600 uppercase block">Est. Monthly Revenue</span>
                              <span className="font-extrabold text-green-800">₱{monthlySalesEst.toLocaleString()}</span>
                            </div>
                          )}

                          {/* Quick Action Navigation */}
                          <div className="flex items-center gap-2 pt-2 sm:pt-0">
                            <button
                              type="button"
                              onClick={() =>
                                navigate("/financial-input", {
                                  state: { projectId: project.id },
                                })
                              }
                              className="px-4 py-2 bg-white border border-gray-200 hover:border-[#c9a654] hover:bg-amber-50/50 text-[#122244] font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                            >
                              <Package className="w-3.5 h-3.5 text-[#c9a654]" /> Financials
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                navigate("/ai-analysis", {
                                  state: { projectId: project.id, runAnalysis: true },
                                })
                              }
                              className="px-4 py-2 bg-[#122244] hover:bg-[#1a2f55] text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                            >
                              <Zap className="w-3.5 h-3.5 text-[#c9a654]" /> AI Analysis
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* QUICK NAVIGATION TILES */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div
                onClick={() => navigate("/projects")}
                className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm hover:shadow-md hover:border-[#c9a654]/60 transition-all cursor-pointer group"
              >
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Folder className="w-6 h-6" />
                </div>
                <h4 className="font-extrabold text-base text-[#122244] mb-1 group-hover:text-[#c9a654] transition-colors">
                  Business Proposals
                </h4>
                <p className="text-xs text-gray-500 leading-relaxed mb-4">
                  Manage your business profile, view the approved charter, and review faculty adviser feedback.
                </p>
                <span className="text-xs font-bold text-blue-600 flex items-center gap-1">
                  View Charter <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>

              <div
                onClick={() => navigate("/financial-input")}
                className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm hover:shadow-md hover:border-[#c9a654]/60 transition-all cursor-pointer group"
              >
                <div className="w-12 h-12 bg-amber-50 text-[#c9a654] rounded-xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Package className="w-6 h-6" />
                </div>
                <h4 className="font-extrabold text-base text-[#122244] mb-1 group-hover:text-[#c9a654] transition-colors">
                  Financial Input & Balance Sheet
                </h4>
                <p className="text-xs text-gray-500 leading-relaxed mb-4">
                  Simulate selling prices, manage itemized OpEx and machinery, and inspect real-time balance sheets.
                </p>
                <span className="text-xs font-bold text-[#c9a654] flex items-center gap-1">
                  Open Workspace <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>

              <div
                onClick={() => navigate("/ai-analysis")}
                className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm hover:shadow-md hover:border-[#c9a654]/60 transition-all cursor-pointer group"
              >
                <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h4 className="font-extrabold text-base text-[#122244] mb-1 group-hover:text-[#c9a654] transition-colors">
                  AI Feasibility Analysis
                </h4>
                <p className="text-xs text-gray-500 leading-relaxed mb-4">
                  Generate comprehensive SWOT analysis, financial viability assessments, and market risks.
                </p>
                <span className="text-xs font-bold text-purple-600 flex items-center gap-1">
                  Run AI Feasibility <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          </div>
        </main>

        {showWelcomeToast && (
          <div className="fixed top-8 left-1/2 -translate-x-1/2 bg-white border-b-4 border-[#c9a654] shadow-2xl p-5 rounded-xl z-50 animate-in slide-in-from-top-5 fade-in duration-300 flex items-center gap-4 w-11/12 max-w-lg">
            <CheckCircle className="w-7 h-7 text-[#c9a654] shrink-0" />
            <div className="flex-1">
              <h4 className="font-bold text-gray-900 text-base">
                Login Successful
              </h4>
              <p className="text-gray-600 text-sm mt-1">
                Welcome to FeasiFy{" "}
                <span className="font-bold text-gray-900">{welcomeName}</span>!
              </p>
            </div>
            <button
              onClick={() => setShowWelcomeToast(false)}
              className="text-gray-400 hover:text-gray-600 self-start mt-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {showLogoutConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowLogoutConfirm(false)}
            />
            <div className="bg-white rounded-2xl p-6 z-10 w-11/12 max-w-sm shadow-xl animate-in fade-in zoom-in-95 duration-200">
              <h3 className="text-lg font-bold text-[#122244] mb-2 text-center">
                Sign Out?
              </h3>
              <p className="text-sm text-gray-600 mb-6 text-center italic">
                Are you sure you want to log out of your session?
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 px-5 py-2.5 rounded-lg border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50"
                >
                  Stay
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowLogoutConfirm(false);
                    handleLogout();
                  }}
                  className="flex-1 px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-md shadow-red-900/10 transition-colors"
                >
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
