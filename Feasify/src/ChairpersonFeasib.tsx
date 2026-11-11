import React, { useEffect, useState } from "react";
import Skeleton from "react-loading-skeleton";
import { useNavigate } from "react-router-dom";
import { auth, db, signOutUser } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  Users,
  FileText,
  Settings,
  ShieldAlert,
  Search,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Bell,
  Store,
  Eye
} from "lucide-react";
import ScrollToTopButton from "./components/ScrollToTopButton";
import CustomDropdown from "./components/CustomDropdown";
import MobileBurgerButton from "./components/MobileBurgerButton";
import SidebarCloseButton from "./components/SidebarCloseButton";
import ActiveBusinessDetailView from "./components/ActiveBusinessDetailView";
import {
  DEFAULT_PAGE_SIZE,
  paginateItems,
  TablePagination
} from "./components/TablePagination";
import {
  subscribeChairpersonFeasibilityData,
  subscribeChairpersonHeaderState,
  type ChairpersonProposalItem
} from "./services/chairpersonFeasibilityService";

const getCardInitials = (name: string): string => {
  const clean = (name || "").trim();
  if (!clean) return "BZ";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
};

const ActiveBusinessKioskCard: React.FC<{
  project: ChairpersonProposalItem;
  onSelect: () => void;
}> = ({ project, onSelect }) => {
  const rawLogo = project.businessLogo || project.companyLogo || "";
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setLogoError(false);
  }, [rawLogo]);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group text-center w-full bg-white rounded-2xl border border-gray-200/80 shadow-sm hover:shadow-xl hover:border-[#c9a654]/70 focus:outline-none focus:ring-2 focus:ring-[#c9a654] focus:ring-offset-2 transition-all duration-300 overflow-hidden flex flex-col cursor-pointer"
    >
      {/* Edge-to-Edge Business Logo Visual Container */}
      <div className="relative h-56 sm:h-60 w-full bg-gray-100 overflow-hidden shrink-0">
        {rawLogo && !logoError ? (
          <img
            src={rawLogo}
            alt={project.businessName}
            onError={() => setLogoError(true)}
            className="w-full h-full object-cover group-hover:blur-sm group-focus-visible:blur-sm group-hover:scale-105 group-focus-visible:scale-105 transition-all duration-300"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#122244] via-[#1a2f55] to-[#233d70] flex items-center justify-center relative group-hover:blur-sm group-focus-visible:blur-sm group-hover:scale-105 group-focus-visible:scale-105 transition-all duration-300">
            <Store className="w-28 h-28 text-white/[0.06] absolute -right-4 -bottom-4 pointer-events-none select-none" />
            <span className="text-3xl sm:text-4xl font-black text-[#c9a654] tracking-wider">
              {getCardInitials(project.businessName)}
            </span>
          </div>
        )}

        {/* Hover / Focus Blur Scrim + Centered Open Pill */}
        <div
          aria-hidden="true"
          className="absolute inset-0 z-10 bg-[#122244]/40 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-all duration-300 pointer-events-none"
        >
          <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#c9a654] text-[#122244] font-extrabold text-sm shadow-xl border border-white/40 transform scale-90 group-hover:scale-100 group-focus-visible:scale-100 transition-transform duration-300">
            <Eye className="w-4 h-4" />
            Open
          </span>
        </div>

        {/* Section Pill (Top Left Only) */}
        <span className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded-full bg-[#122244]/85 backdrop-blur-md border border-white/25 text-white text-[11px] font-bold uppercase tracking-wider shadow-sm max-w-[75%] truncate">
          {project.section || "Unknown"}
        </span>
      </div>

      {/* Bottom Plaque: Business Name Only */}
      <div className="px-4 py-4 bg-white border-t border-gray-100 w-full flex-1 flex items-center justify-center text-center">
        <h3
          className="text-base sm:text-lg font-extrabold text-[#122244] leading-snug line-clamp-2 group-hover:text-[#c9a654] transition-colors"
          title={project.businessName}
        >
          {project.businessName || "Untitled Business"}
        </h3>
      </div>
    </button>
  );
};

const STATUS_FILTER_OPTIONS = [
  "All Statuses",
  "Active Business",
  "Approved Proposal",
  "In Revision",
  "Rejected Proposal",
  "Pending Review",
  "Draft"
] as const;

const WORKFLOW_STATUS_BADGE_CLASSES: Record<string, string> = {
  "Active Business": "bg-blue-50 text-blue-700 border border-blue-200",
  "Approved Proposal": "bg-emerald-50 text-emerald-700 border border-emerald-200",
  "In Revision": "bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-400/30",
  "Rejected Proposal": "bg-red-50 text-red-700 border border-red-200",
  "Pending Review": "bg-yellow-50 text-yellow-700 border border-yellow-300",
  Draft: "bg-gray-100 text-gray-500 border border-gray-200"
};

const ChairpersonFeasib: React.FC = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("Chairperson");
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const [projects, setProjects] = useState<ChairpersonProposalItem[]>([]);
  const [activeMainTab, setActiveMainTab] = useState<"proposals" | "active-businesses">("proposals");
  const [selectedActiveBusinessId, setSelectedActiveBusinessId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSection, setSelectedSection] = useState("All Sections");
  const [selectedAdviser, setSelectedAdviser] = useState("All Advisers");
  const [selectedStatus, setSelectedStatus] = useState("All Statuses");
  const [isLoading, setIsLoading] = useState(true);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedSection, selectedAdviser, selectedStatus, activeMainTab]);

  useEffect(() => {
    let isMounted = true;
    let authCheckToken = 0;
    let unsubProjects: (() => void) | undefined;
    let unsubHeader: (() => void) | undefined;

    const cleanupListeners = () => {
      if (unsubProjects) {
        unsubProjects();
        unsubProjects = undefined;
      }
      if (unsubHeader) {
        unsubHeader();
        unsubHeader = undefined;
      }
    };

    const startListeners = (uid: string) => {
      cleanupListeners();
      setIsLoading(true);

      unsubProjects = subscribeChairpersonFeasibilityData(
        (items) => {
          if (!isMounted) return;
          setProjects(items);
          setIsLoading(false);
        },
        () => {
          if (!isMounted) return;
          setIsLoading(false);
        }
      );

      unsubHeader = subscribeChairpersonHeaderState(uid, ({ userName: nextName, unreadCount }) => {
        if (!isMounted) return;
        setUserName(nextName);
        setUnreadNotificationCount(unreadCount);
      });
    };

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      authCheckToken += 1;
      const currentToken = authCheckToken;
      cleanupListeners();

      if (!u) {
        navigate("/");
        return;
      }
      if (u.email?.toLowerCase() === "chairperson@gmail.com") {
        startListeners(u.uid);
        return;
      }
      try {
        const userDoc = await getDoc(doc(db, "users", u.uid));
        if (!isMounted || currentToken !== authCheckToken) return;
        if (userDoc.exists() && userDoc.data().role === "Chairperson") {
          startListeners(u.uid);
        } else {
          navigate("/");
        }
      } catch {
        if (isMounted && currentToken === authCheckToken) {
          navigate("/");
        }
      }
    });

    return () => {
      isMounted = false;
      authCheckToken += 1;
      unsubAuth();
      cleanupListeners();
    };
  }, [navigate]);

  const handleLogout = async () => {
    try { await signOutUser(); localStorage.clear(); sessionStorage.clear(); } catch (e) { }
    navigate("/");
  };

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  // Dynamic Dropdown Options
  const uniqueSections = [
    "All Sections",
    ...Array.from(new Set(projects.map(p => p.section).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    )
  ];

  const sortedAdviserNames = Array.from(
    new Set(projects.flatMap(p => p.advisers).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  const hasUnassignedAdvisers = projects.some(p => p.advisers.length === 0);
  const uniqueAdvisers = [
    "All Advisers",
    ...sortedAdviserNames,
    ...(hasUnassignedAdvisers ? ["Unassigned"] : [])
  ];

  // Filtering Logic
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const matchesBaseFilters = (p: ChairpersonProposalItem) => {
    const matchesSearch =
      !normalizedSearch ||
      p.businessName.toLowerCase().includes(normalizedSearch) ||
      p.companyName.toLowerCase().includes(normalizedSearch) ||
      p.businessType.toLowerCase().includes(normalizedSearch) ||
      p.category.toLowerCase().includes(normalizedSearch) ||
      p.section.toLowerCase().includes(normalizedSearch) ||
      p.leaderName.toLowerCase().includes(normalizedSearch) ||
      p.adviserName.toLowerCase().includes(normalizedSearch) ||
      p.status.toLowerCase().includes(normalizedSearch);

    const matchesSection = selectedSection === "All Sections" || p.section === selectedSection;
    const matchesAdviser =
      selectedAdviser === "All Advisers" ||
      (selectedAdviser === "Unassigned"
        ? p.advisers.length === 0
        : p.advisers.includes(selectedAdviser));

    return matchesSearch && matchesSection && matchesAdviser;
  };

  const filteredProjects = projects.filter(p => {
    const matchesStatus = selectedStatus === "All Statuses" || p.status === selectedStatus;
    return matchesBaseFilters(p) && matchesStatus;
  });

  const { pageItems: paginatedProjects, safePage } = paginateItems(
    filteredProjects,
    currentPage,
    DEFAULT_PAGE_SIZE
  );

  const filteredActiveBusinesses = projects.filter(
    p => p.status === "Active Business" && matchesBaseFilters(p)
  );

  const selectedActiveBusiness = selectedActiveBusinessId
    ? projects.find(p => p.id === selectedActiveBusinessId && p.status === "Active Business") || null
    : null;

  const handleMainTabChange = (nextTab: "proposals" | "active-businesses") => {
    setActiveMainTab(nextTab);
    setSelectedActiveBusinessId(null);
    setCurrentPage(1);
  };

  // KPI Calculations
  const activeBusinessCount = projects.filter(p => p.status === "Active Business").length;
  const positiveFeasibilityCount = projects.filter(p => p.aiSentiment === "positive").length;
  const negativeFeasibilityCount = projects.filter(p => p.aiSentiment === "negative").length;

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
        className={`flex flex-col fixed inset-y-0 z-[60] bg-[#122244] text-white shadow-xl transition-[width,transform] duration-300 ease-in-out group overflow-x-hidden ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0 w-64 lg:w-16 lg:hover:w-64`}
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
            onClick={() => {
              setIsSidebarOpen(false);
              setSelectedActiveBusinessId(null);
            }}
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
      <main className="flex-1 transition-all duration-300 ease-in-out min-h-screen lg:ml-16 ml-0">
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
            <span
              onClick={() => {
                if (selectedActiveBusiness) {
                  setSelectedActiveBusinessId(null);
                }
              }}
              className={`font-semibold truncate ${selectedActiveBusiness
                  ? "text-gray-500 hover:text-[#c9a654] cursor-pointer transition-colors"
                  : "text-gray-900"
                }`}
            >
              Feasibility Projects
            </span>
            {selectedActiveBusiness && (
              <>
                <span className="text-gray-400 shrink-0">›</span>
                <span
                  className="font-semibold text-[#c9a654] truncate max-w-[180px] sm:max-w-xs"
                  title={selectedActiveBusiness.businessName}
                >
                  {selectedActiveBusiness.businessName}
                </span>
              </>
            )}
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
              onClick={() => navigate("/admin/chairpersonsettings")}
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

        {selectedActiveBusiness ? (
          <ActiveBusinessDetailView
            key={selectedActiveBusiness.id}
            group={selectedActiveBusiness.groupData}
            proposal={selectedActiveBusiness.proposalData}
            groupNumber={selectedActiveBusiness.groupNumber}
            rosterMembers={selectedActiveBusiness.rosterMembers}
            adviserName={selectedActiveBusiness.adviserName}
            advisers={selectedActiveBusiness.advisers}
            readOnlyBadgeLabel="READ-ONLY CHAIRPERSON VIEW"
            backLabel="Back to Active Businesses"
            onBack={() => setSelectedActiveBusinessId(null)}
            canPostFeedback={false}
          />
        ) : (
          <div className="p-6 md:p-8 max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-[#3d2c23]">Business Feasibility Management</h1>
              <p className="text-sm text-gray-500 mt-2 italic">Oversee and track all business feasibility study projects.</p>
            </div>

            {/* Stats Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
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

            {/* Primary Management Tabs */}
            <div className="flex items-center space-x-6 border-b border-gray-200 mb-6 overflow-x-auto custom-scrollbar">
              <button
                type="button"
                onClick={() => handleMainTabChange("proposals")}
                className={`pb-3 text-sm font-bold transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 cursor-pointer ${activeMainTab === "proposals"
                    ? "border-[#122244] text-[#122244]"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                  }`}
              >
                <FileText
                  className={`w-4 h-4 ${activeMainTab === "proposals" ? "text-[#c9a654]" : "text-gray-400"
                    }`}
                />
                <span>List of All Proposals</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${activeMainTab === "proposals"
                      ? "bg-[#122244] text-white"
                      : "bg-gray-100 text-gray-600"
                    }`}
                >
                  {projects.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleMainTabChange("active-businesses")}
                className={`pb-3 text-sm font-bold transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 cursor-pointer ${activeMainTab === "active-businesses"
                    ? "border-[#122244] text-[#122244]"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                  }`}
              >
                <Store
                  className={`w-4 h-4 ${activeMainTab === "active-businesses"
                      ? "text-[#c9a654]"
                      : "text-gray-400"
                    }`}
                />
                <span>Active Business</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${activeMainTab === "active-businesses"
                      ? "bg-[#c9a654] text-[#122244]"
                      : "bg-blue-50 text-blue-700 border border-blue-200"
                    }`}
                >
                  {activeBusinessCount}
                </span>
              </button>
            </div>

            {activeMainTab === "proposals" ? (
              <>
                {/* Controls */}
                <div className="flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-4 mb-6 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                  <div className="relative w-full xl:w-80 shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search business name, company, leader, or adviser..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a654]/50 bg-gray-50"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto xl:justify-end text-sm">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <span className="text-gray-500 font-semibold whitespace-nowrap">Section:</span>
                      <CustomDropdown
                        value={selectedSection}
                        onChange={(val) => setSelectedSection(val)}
                        options={uniqueSections.map((sec) => ({ value: sec, label: sec }))}
                        className="w-full sm:w-40"
                        buttonClassName="py-2 text-xs font-semibold"
                      />
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <span className="text-gray-500 font-semibold whitespace-nowrap">Adviser:</span>
                      <CustomDropdown
                        value={selectedAdviser}
                        onChange={(val) => setSelectedAdviser(val)}
                        options={uniqueAdvisers.map((adv) => ({ value: adv, label: adv }))}
                        className="w-full sm:w-44"
                        buttonClassName="py-2 text-xs font-semibold"
                      />
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <span className="text-gray-500 font-semibold whitespace-nowrap">Status:</span>
                      <CustomDropdown
                        value={selectedStatus}
                        onChange={(val) => setSelectedStatus(val)}
                        options={STATUS_FILTER_OPTIONS.map((st) => ({ value: st, label: st }))}
                        className="w-full sm:w-44"
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
                          Array.from({ length: Math.min(parseInt(sessionStorage.getItem('adminProjectCount') || '5', 10) || 5, 10) }).map((_, i) => (
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
                          paginatedProjects.map((project) => {
                            const workflowBadgeClass =
                              WORKFLOW_STATUS_BADGE_CLASSES[project.status] ||
                              "bg-gray-100 text-gray-600 border border-gray-200";
                            const showCompanySubLabel =
                              Boolean(project.companyName) &&
                              project.companyName.toLowerCase() !== project.businessName.toLowerCase();

                            return (
                              <tr key={project.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-6 py-5">
                                  <div className="font-bold text-[#122244]">
                                    {project.businessName || "Untitled"}
                                  </div>
                                  <div className="text-[11px] text-gray-400 font-medium mt-0.5">
                                    Proposal #{project.proposalNumber}
                                    {showCompanySubLabel ? ` • ${project.companyName}` : ""}
                                  </div>
                                </td>
                                <td className="px-6 py-5 font-semibold text-gray-700">{project.section || "N/A"}</td>
                                <td className="px-6 py-5 text-gray-800">{project.leaderName || "Unknown"}</td>
                                <td className="px-6 py-5">
                                  <span
                                    className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${workflowBadgeClass}`}
                                  >
                                    {project.status || "Pending Review"}
                                  </span>
                                </td>
                                <td className="px-6 py-5 text-gray-800">{project.adviserName || "Unassigned"}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Footer (Max 10 Rows / Page) */}
                  {!isLoading && (
                    <TablePagination
                      currentPage={safePage}
                      totalItems={filteredProjects.length}
                      pageSize={DEFAULT_PAGE_SIZE}
                      itemLabel="proposals"
                      onPageChange={setCurrentPage}
                    />
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Active Business Kiosk Filters Bar */}
                <div className="flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-4 mb-6 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                  <div className="relative w-full xl:w-96 shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search active business name, company, leader, or adviser..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a654]/50 bg-gray-50"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto xl:justify-end text-sm">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <span className="text-gray-500 font-semibold whitespace-nowrap">Section:</span>
                      <CustomDropdown
                        value={selectedSection}
                        onChange={(val) => setSelectedSection(val)}
                        options={uniqueSections.map((sec) => ({ value: sec, label: sec }))}
                        className="w-full sm:w-40"
                        buttonClassName="py-2 text-xs font-semibold"
                      />
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <span className="text-gray-500 font-semibold whitespace-nowrap">Adviser:</span>
                      <CustomDropdown
                        value={selectedAdviser}
                        onChange={(val) => setSelectedAdviser(val)}
                        options={uniqueAdvisers.map((adv) => ({ value: adv, label: adv }))}
                        className="w-full sm:w-44"
                        buttonClassName="py-2 text-xs font-semibold"
                      />
                    </div>
                  </div>
                </div>

                {/* Active Business Kiosk Grid */}
                {isLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {Array.from({ length: 6 }).map((_, idx) => (
                      <div
                        key={idx}
                        className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden"
                      >
                        <Skeleton height={224} />
                        <div className="px-4 py-4 flex justify-center border-t border-gray-100">
                          <Skeleton width="65%" height={22} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredActiveBusinesses.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center space-y-2 shadow-sm">
                    <Store className="w-10 h-10 text-gray-300 mx-auto" />
                    <h3 className="text-base font-bold text-[#122244]">
                      No Active Businesses Found
                    </h3>
                    <p className="text-xs text-gray-500 max-w-md mx-auto">
                      No active business charters match the current search or section/adviser filters.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {filteredActiveBusinesses.map((project) => (
                      <ActiveBusinessKioskCard
                        key={project.id}
                        project={project}
                        onSelect={() => setSelectedActiveBusinessId(project.id)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
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