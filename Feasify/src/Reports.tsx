import React, { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, db, signOutUser } from "./firebase";
import ScrollToTopButton from "./components/ScrollToTopButton";
import MobileBurgerButton from "./components/MobileBurgerButton";
import SidebarCloseButton from "./components/SidebarCloseButton";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
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
  Sidebar as SidebarIcon,
  Download,
  FileText,
  Printer,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Lightbulb,
  Bell,
  ChevronUp,
} from "lucide-react";

import domtoimage from "dom-to-image";
import { jsPDF } from "jspdf";
import { normalizeProposalProducts, computeProductMetrics } from "./utils/productCosting";

const Reports: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  const [isDownloading, setIsDownloading] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const loadUserGroup = async (uid: string, section: string) => {
    try {
      const groupQ = query(collection(db, "groups"), where("section", "==", section));
      const groupSnap = await getDocs(groupQ);

      let userGroupId = "";
      let activeProposalId = "";
      groupSnap.forEach((doc) => {
        const data = doc.data();
        if (data.leaderId === uid || (data.memberIds && data.memberIds.includes(uid))) {
          userGroupId = doc.id;
          activeProposalId = data.activeProposalId || "";
        }
      });

      if (userGroupId && activeProposalId) {
        const propQ = query(collection(db, "proposals"), where("groupId", "==", userGroupId));
        const propSnap = await getDocs(propQ);

        const approvedProjects = propSnap.docs
          .filter((doc) => doc.data().status === "Approved" || doc.data().status === "APPROVED")
          .map((doc) => {
            const pData = doc.data();
            return {
              id: doc.id,
              name: pData.businessName || pData.title || "Untitled Proposal",
              financialData: pData.financialData || null,
              aiAnalysis: pData.aiAnalysis || null,
              totalCapital: pData.totalCapital || null,
              proposalCapital: pData.totalCapital || null,
              products: pData.products || pData.financialData?.products || [],
              rawProposalData: pData,
              parentGroupId: userGroupId,
            };
          });

        const activeProp = approvedProjects.find((p) => p.id === activeProposalId);
        if (activeProp) {
          setProjects([activeProp]);
          handleProjectSelect(activeProp.id);
        } else {
          setProjects([]);
          setSelectedProjectId("");
        }
      } else {
        setProjects([]);
        setSelectedProjectId("");
      }
    } catch (error) {
      console.error("Failed to load group:", error);
      setProjects([]);
      setSelectedProjectId("");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          if (snap.exists()) {
            const data = snap.data() as any;
            setUserName([data.firstName, data.lastName].filter(Boolean).join(" ") || u.displayName || "");
            if (data.section) {
              loadUserGroup(u.uid, data.section);
            } else {
              setIsLoading(false);
            }
          } else {
            setIsLoading(false);
          }
        } catch (e) {
          setIsLoading(false);
        }
      } else {
        navigate("/");
      }
    });
    return () => unsub();
  }, [navigate]);

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

  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
    sessionStorage.setItem("lastSelectedProjectId", projectId);
  };

  const handleLogout = async () => {
    try {
      await signOutUser();
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) { }
    navigate("/");
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current || !selectedProject) return;
    setIsDownloading(true);
    try {
      const dataUrl = await domtoimage.toPng(reportRef.current, { quality: 1, bgcolor: "#ffffff" });
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const elWidth = reportRef.current.offsetWidth;
      const elHeight = reportRef.current.offsetHeight;
      const pdfHeight = (elHeight * pdfWidth) / elWidth;
      pdf.addImage(dataUrl, "PNG", 0, 10, pdfWidth, pdfHeight);
      const safeName = selectedProject.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
      pdf.save(`${safeName}_Feasibility_Report.pdf`);
    } catch (error) {
      console.error("CRITICAL PDF ERROR:", error);
      alert("Failed to generate PDF.");
    } finally {
      setIsDownloading(false);
    }
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const financialOverview = useMemo(() => {
    if (!selectedProject) {
      return {
        startupCapital: 0,
        annualRevenue: 0,
        netAnnualProfit: 0,
        paybackPeriodFormatted: "N/A",
      };
    }

    const finData = selectedProject.financialData || {};
    const activeFin =
      finData.monthlyRecords &&
      Array.isArray(finData.monthlyRecords) &&
      finData.monthlyRecords.length > 0
        ? finData.monthlyRecords[finData.monthlyRecords.length - 1]?.financials || finData
        : finData;

    const proposalProducts =
      selectedProject.products && selectedProject.products.length > 0
        ? selectedProject.products
        : activeFin.products && activeFin.products.length > 0
        ? activeFin.products
        : selectedProject.rawProposalData?.products || [];

    const prods = normalizeProposalProducts(activeFin, selectedProject.name, proposalProducts);

    let monthlyRevenue = 0;
    let totalMonthlyVariableCosts = 0;
    let safeMonthlySales = 0;
    let safeSellingPrice = 0;
    let safeVariableCost = 0;

    if (prods.length > 1) {
      monthlyRevenue = prods.reduce((sum: number, p: any) => sum + computeProductMetrics(p).revenue, 0);
      totalMonthlyVariableCosts = prods.reduce((sum: number, p: any) => sum + computeProductMetrics(p).cogsSold, 0);
      safeMonthlySales = prods.reduce((sum: number, p: any) => sum + computeProductMetrics(p).unitsSold, 0);
      safeSellingPrice = safeMonthlySales > 0 ? monthlyRevenue / safeMonthlySales : 0;
      safeVariableCost = safeMonthlySales > 0 ? totalMonthlyVariableCosts / safeMonthlySales : 0;
    } else if (prods.length === 1) {
      const m = computeProductMetrics(prods[0]);
      monthlyRevenue = m.revenue;
      totalMonthlyVariableCosts = m.cogsSold;
      safeMonthlySales = m.unitsSold;
      safeSellingPrice = m.netSellingPrice > 0 ? m.netSellingPrice : (m.sellingPrice > 0 ? m.sellingPrice : (Number(activeFin?.sellingPrice) || 0));
      safeVariableCost = m.unitCost > 0 ? m.unitCost : (Number(activeFin?.variableCost) || 0);
    } else {
      safeSellingPrice = Number(activeFin?.sellingPrice) || 0;
      safeVariableCost = Number(activeFin?.variableCost) || 0;
      safeMonthlySales = Number(activeFin?.monthlySales) || 0;
      monthlyRevenue = safeSellingPrice * safeMonthlySales;
      totalMonthlyVariableCosts = safeVariableCost * safeMonthlySales;
    }

    const safeOperatingDays = Number(activeFin?.operatingDays) || 300;
    const isCapitalBorrowed = Boolean(activeFin?.isCapitalBorrowed);
    const interestRate = Number(activeFin?.interestRate) || 0;

    const equipmentList = activeFin?.equipmentList || [];
    const equipmentTotal = equipmentList.reduce(
      (sum: number, item: any) => sum + (Number(item.total) || (Number(item.quantity) * Number(item.unitPrice)) || 0),
      0
    );

    const declaredCapital =
      Number(activeFin?.startupCapital) ||
      Number(activeFin?.cashInvested) ||
      Number(selectedProject?.totalCapital) ||
      Number(selectedProject?.proposalCapital) ||
      0;
    const safeStartupCapital = equipmentList.length > 0 && equipmentTotal > 0 ? equipmentTotal : declaredCapital;

    const opexList = activeFin?.opexList || [];
    const monthlyOpex = opexList.length > 0
      ? opexList.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0)
      : (Number(activeFin?.fixedCosts) || 0);

    const monthlyInterest = isCapitalBorrowed ? (safeStartupCapital * (interestRate / 100)) / 12 : 0;
    const annualRevenue = (monthlyRevenue / 30) * safeOperatingDays;
    const annualExpenses = ((totalMonthlyVariableCosts + monthlyOpex + monthlyInterest) / 30) * safeOperatingDays;
    const annualNetProfitPreTax = annualRevenue - annualExpenses;
    const percentageTax = annualRevenue > 0 ? annualRevenue * 0.03 : 0;
    const annualNetProfitAfterTax = annualNetProfitPreTax > 0 ? (annualNetProfitPreTax - percentageTax) : annualNetProfitPreTax;

    let paybackPeriodFormatted = "N/A";
    if (annualNetProfitAfterTax > 0 && safeStartupCapital > 0) {
      const monthlyCashInflow = annualNetProfitAfterTax / 12;
      const totalMonths = safeStartupCapital / monthlyCashInflow;
      const years = Math.floor(totalMonths / 12);
      const months = Math.floor(totalMonths % 12);
      const days = Math.round((totalMonths % 1) * 30);

      if (years > 0) {
        paybackPeriodFormatted = `${years} Year${years > 1 ? "s" : ""}${months > 0 ? ` ${months} Mo${months > 1 ? "s" : ""}` : ""}`;
      } else if (months > 0) {
        paybackPeriodFormatted = `${months} Month${months > 1 ? "s" : ""}${days > 0 ? ` ${days}d` : ""}`;
      } else {
        paybackPeriodFormatted = `${days} Days`;
      }
    } else if (annualNetProfitAfterTax <= 0) {
      paybackPeriodFormatted = "N/A (Net Deficit)";
    }

    return {
      startupCapital: safeStartupCapital,
      annualRevenue: Math.round(annualRevenue),
      netAnnualProfit: Math.round(annualNetProfitAfterTax),
      paybackPeriodFormatted,
    };
  }, [selectedProject]);

  const getInitials = (name: string) =>
    name ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "U";

  return (
    <div className="flex min-h-screen bg-gray-50/50 print:overflow-visible print:block">
      {/* Inject Print-Specific Styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          @page { margin: 10mm; size: auto; }
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          main { margin: 0 !important; padding: 0 !important; width: 100% !important; position: relative !important; left: 0 !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:border-none { border: none !important; }
          .print\\:p-0 { padding: 0 !important; }
          /* Ensure colors print in Chrome/Firefox */
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}} />

      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-[50] lg:hidden print:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar - Marked as print:hidden */}
      <aside
        className={`flex flex-col fixed inset-y-0 z-[60] bg-[#122244] text-white shadow-xl transition-[width,transform] duration-300 ease-in-out group overflow-x-hidden ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          } w-64 lg:w-16 lg:hover:w-64 print:hidden`}
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
            onClick={() => { setIsSidebarOpen(false); navigate("/dashboard"); }}
            title="Dashboard"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-200 hover:text-white hover:bg-white/10 transition-colors group"
          >
            <LayoutDashboard className="w-5 h-5 shrink-0 text-[#c9a654] group-hover:text-[#f0c242] transition-colors" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              Dashboard
            </span>
          </button>
          <button
            onClick={() => { setIsSidebarOpen(false); navigate("/projects"); }}
            title="Business Proposal"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-200 hover:text-white hover:bg-white/10 transition-colors group"
          >
            <Folder className="w-5 h-5 shrink-0 text-[#c9a654] group-hover:text-[#f0c242] transition-colors" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              Business Proposal
            </span>
          </button>
          <button
            onClick={() => { setIsSidebarOpen(false); navigate("/financial-input"); }}
            title="Financial Input"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-200 hover:text-white hover:bg-white/10 transition-colors group"
          >
            <FileEdit className="w-5 h-5 shrink-0 text-[#c9a654] group-hover:text-[#f0c242] transition-colors" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              Financial Input
            </span>
          </button>
          <button
            onClick={() => { setIsSidebarOpen(false); navigate("/ai-analysis"); }}
            title="AI Feasibility Analysis"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-200 hover:text-white hover:bg-white/10 transition-colors group"
          >
            <Zap className="w-5 h-5 shrink-0 text-[#c9a654] group-hover:text-[#f0c242] transition-colors" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              AI Feasibility Analysis
            </span>
          </button>
          <button
            title="Reports"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-bold bg-[#c9a654] text-[#122244] transition-all shadow-md"
          >
            <BarChart3 className="w-5 h-5 shrink-0 text-[#122244]" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              Reports
            </span>
          </button>
          <button
            onClick={() => { setIsSidebarOpen(false); navigate("/messages"); }}
            title="Message"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-200 hover:text-white hover:bg-white/10 transition-colors group"
          >
            <MessageCircle className="w-5 h-5 shrink-0 text-[#c9a654] group-hover:text-[#f0c242] transition-colors" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              Message
            </span>
          </button>
          <button
            onClick={() => { setIsSidebarOpen(false); navigate("/settings"); }}
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

      <main className={`flex-1 transition-all duration-300 ease-in-out min-h-screen ${isSidebarOpen ? "lg:ml-16" : "ml-0"} print:ml-0 print:p-0`}>
        <div className="bg-white border-b border-gray-200/80 shadow-[0_3px_10px_rgba(0,0,0,0.06)] px-4 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between text-sm text-gray-500 sticky top-0 z-30 print:hidden">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <MobileBurgerButton onClick={() => setIsSidebarOpen(!isSidebarOpen)} />
            <span
              className="font-semibold text-gray-900 hover:text-[#c9a654] cursor-pointer transition-colors shrink-0"
              onClick={() => navigate("/dashboard")}
            >
              FeasiFy
            </span>
            <span className="text-gray-400 shrink-0">›</span>
            <span className="font-semibold text-gray-900 truncate">Reports</span>
            <span className="text-gray-300 hidden sm:inline shrink-0">|</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#122244] text-white shadow-xs tracking-wide whitespace-nowrap hidden sm:inline-block shrink-0">
              Student Portal
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/notifications")}
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
              onClick={() => navigate("/settings")}
              className="flex items-center gap-3 cursor-pointer hover:opacity-85 transition-opacity"
            >
              <div className="w-9 h-9 rounded-full bg-[#c9a654] text-white flex items-center justify-center font-bold text-sm shadow-xs flex-shrink-0">
                {getInitials(userName)}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-gray-900 leading-tight">
                  {userName || "User"}
                </p>
                <p className="text-[10px] text-gray-400 font-medium">Student</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 md:p-8 max-w-5xl mx-auto print:p-0 print:max-w-full">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 border-b border-gray-200 pb-6 print:hidden">
            <div>
              <h1 className="text-3xl font-extrabold text-[#3d2c23]">Executive Reports</h1>
              <p className="text-sm text-gray-500 mt-1 italic">Download and print your official AI-generated feasibility study documentation.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => window.print()} disabled={!selectedProject?.aiAnalysis} className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-lg font-bold text-sm text-gray-700 hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50"><Printer className="w-4 h-4" /> Print Document</button>
              <button onClick={handleDownloadPDF} disabled={!selectedProject?.aiAnalysis || isDownloading} className="flex items-center gap-2 bg-[#c9a654] hover:bg-[#b59545] text-white px-6 py-2.5 rounded-lg font-bold text-sm transition-all shadow-md disabled:opacity-50"><Download className="w-4 h-4" /> {isDownloading ? "Generating..." : "Download PDF"}</button>
            </div>
          </div>

          <div className="mb-8 bg-white p-6 rounded-xl border border-gray-200 shadow-sm print:hidden">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Project Document Under Evaluation</label>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-black text-lg border border-blue-100">P#</div>
              <div>
                <h2 className="text-2xl font-extrabold text-[#122244] tracking-tight">{selectedProjectId && projects.length > 0 ? projects.find((p) => p.id === selectedProjectId)?.name : "No active project"}</h2>
                {selectedProjectId && <span className="inline-block mt-1 text-[10px] font-black uppercase text-green-600 bg-green-50 px-2 py-0.5 rounded">Verified Approved Business</span>}
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center min-h-[40vh]">
              <div className="w-8 h-8 border-4 border-[#122244] border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-500 font-medium text-sm">Loading reports...</p>
            </div>
          ) : !selectedProject || projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center bg-white rounded-2xl border border-gray-100 shadow-sm p-12 max-w-2xl mx-auto my-8 print:hidden">
              <div className="w-20 h-20 bg-amber-50 text-[#c9a654] rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-amber-100">
                <Folder className="w-10 h-10" />
              </div>
              <span className="px-3 py-1 bg-amber-100 text-[#b59545] text-xs font-black rounded-full uppercase tracking-wider mb-3">
                Active Business Required
              </span>
              <h2 className="text-2xl font-extrabold text-[#122244] mb-3">
                No Active Business Setup
              </h2>
              <p className="text-gray-500 text-sm max-w-md mx-auto mb-8 leading-relaxed">
                Please submit a business proposal and have it approved by your adviser, then set it as your group's active business in the <strong>Business Proposal</strong> module to unlock Feasibility Reports.
              </p>
              <button
                onClick={() => navigate("/projects")}
                className="flex items-center gap-2 px-6 py-3 bg-[#122244] hover:bg-[#1a2f55] text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-95"
              >
                <Folder className="w-4 h-4 text-[#c9a654]" /> Go to Business Proposals
              </button>
            </div>
          ) : !selectedProject.aiAnalysis ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 py-20 flex flex-col items-center justify-center text-center print:hidden">
              <FileText className="w-12 h-12 text-gray-300 mb-4" />
              <h3 className="text-xl font-bold text-[#122244]">No Report Available</h3>
              <p className="text-gray-500 mt-2 mb-6">You need to run an AI Feasibility Analysis first.</p>
              <button onClick={() => navigate("/ai-analysis")} className="bg-[#122244] text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-[#1a3263] transition-colors">Go to Analysis Module</button>
            </div>
          ) : (
            <div ref={reportRef} className="bg-white rounded-xl border border-gray-200 shadow-lg p-10 md:p-16 mb-12 print:shadow-none print:border-none print:p-0">
              <div className="border-b-2 border-[#122244] pb-8 mb-8 text-center">
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-2">Executive Summary</h2>
                <h1 className="text-4xl font-extrabold text-[#3d2c23] mb-4">{selectedProject.name}</h1>
                <p className="text-gray-600">Generated by FeasiFy AI Engine</p>
                <p className="text-sm text-gray-400 mt-1">
                  Date of Analysis: {selectedProject.aiAnalysis.lastRun ? new Date(selectedProject.aiAnalysis.lastRun).toLocaleDateString() : "Unknown"}
                </p>
              </div>

              <div className={`p-6 rounded-xl mb-10 flex items-center gap-4 ${selectedProject.aiAnalysis.status === "FEASIBLE" ? "bg-green-50 border border-green-200 text-green-900" : selectedProject.aiAnalysis.status === "NOT_FEASIBLE" ? "bg-red-50 border border-red-200 text-red-900" : "bg-orange-50 border border-orange-200 text-orange-900"}`}>
                <div className={`p-3 rounded-full bg-white shadow-sm`}>
                  {selectedProject.aiAnalysis.status === "FEASIBLE" ? <CheckCircle2 className="w-6 h-6 text-green-600" /> : <AlertCircle className="w-6 h-6 text-red-600" />}
                </div>
                <div>
                  <h3 className="font-extrabold text-lg tracking-wide uppercase">Official Verdict: {(selectedProject.aiAnalysis.status || "PENDING").replace("_", " ")}</h3>
                  <p className="text-sm font-medium opacity-80 mt-1">
                    Grade: {selectedProject.aiAnalysis.performanceGrade || "Satisfactory"} {selectedProject.aiAnalysis.performanceStatus ? `• ${selectedProject.aiAnalysis.performanceStatus}` : ""}
                  </p>
                </div>
              </div>

              <h3 className="text-xl font-bold text-[#122244] border-b border-gray-200 pb-2 mb-6">Financial Overview</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
                <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Initial Capital</p>
                  <p className="text-xl font-bold text-gray-900">₱ {financialOverview.startupCapital.toLocaleString()}</p>
                  <p className="text-[11px] text-gray-400 mt-1">Total Project Capitalization</p>
                </div>
                <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Projected Annual Sales</p>
                  <p className="text-xl font-bold text-gray-900">₱ {financialOverview.annualRevenue.toLocaleString()}</p>
                  <p className="text-[11px] text-gray-400 mt-1">Gross Annual Turnover</p>
                </div>
                <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Net Annual Profit</p>
                  <p className={`text-xl font-bold ${financialOverview.netAnnualProfit >= 0 ? "text-green-700" : "text-red-600"}`}>
                    {financialOverview.netAnnualProfit < 0 ? "-₱ " : "₱ "}
                    {Math.abs(financialOverview.netAnnualProfit).toLocaleString()}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1">After-Tax Net Income</p>
                </div>
                <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Est. Payback Period</p>
                  <p className="text-xl font-bold text-gray-900">{financialOverview.paybackPeriodFormatted}</p>
                  <p className="text-[11px] text-gray-400 mt-1">Capital Recovery Time</p>
                </div>
              </div>

              <h3 className="text-xl font-bold text-[#122244] border-b border-gray-200 pb-2 mb-6">Key Insights & Recommendations</h3>
              <div className="space-y-6">
                {(selectedProject.aiAnalysis.insights || []).map((insight: any, i: number) => (
                  <div key={i} className="flex gap-4">
                    <div className="mt-1">
                      {insight.type === "positive" ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : insight.type === "warning" ? <TrendingUp className="w-5 h-5 text-orange-500" /> : <Lightbulb className="w-5 h-5 text-blue-500" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">{insight.title}</h4>
                      <p className="text-sm text-gray-600 mt-1 leading-relaxed">{insight.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-16 pt-8 border-t border-gray-200 text-center">
                <p className="text-xs text-gray-400">This document is auto-generated by the FeasiFy System and is intended for academic evaluation purposes only.</p>
              </div>
            </div>
          )}
        </div>

        {/* Floating Back to Top Button */}
        <ScrollToTopButton />
      </main>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowLogoutConfirm(false)} />
          <div className="bg-white rounded-2xl p-6 z-10 w-11/12 max-w-md shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-[#122244] mb-2">Confirm logout</h3>
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to log out?</p>
            <div className="flex justify-end gap-3">
              <button className="px-5 py-2.5 rounded-lg border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50" onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
              <button className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-md" onClick={() => { setShowLogoutConfirm(false); handleLogout(); }}>Logout</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;