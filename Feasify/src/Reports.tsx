import React, { useEffect, useState, useRef } from "react";
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
} from "lucide-react";

import domtoimage from "dom-to-image";
import { jsPDF } from "jspdf";

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
          .map((doc) => ({
            id: doc.id,
            name: doc.data().businessName || doc.data().title || "Untitled Proposal",
            financialData: doc.data().financialData || null,
            aiAnalysis: doc.data().aiAnalysis || null,
            parentGroupId: userGroupId,
          }));

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
  const getInitials = (name: string) =>
    name ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "U";

  return (
    <div className="flex min-h-screen bg-gray-50/50 overflow-hidden print:overflow-visible print:block">
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
        <div className="h-16 flex items-center justify-center px-2 border-b border-white/10 shrink-0 overflow-hidden">
          {/* FeasifyEmblemLogo when sidebar is folded */}
          <img
            src="/FeasifyEmblemLogo.png"
            alt="FeasiFy"
            onClick={() => navigate("/dashboard")}
            className="h-11 w-auto max-h-[46px] max-w-[48px] object-contain cursor-pointer transition-transform hover:scale-105 hidden lg:block lg:group-hover:hidden shrink-0"
          />
          {/* FeasifyFullLogo when sidebar is hovered or on mobile */}
          <img
            src="/FeasifyFullLogo.png"
            alt="FeasiFy"
            onClick={() => navigate("/dashboard")}
            className="h-12 w-auto max-h-[48px] max-w-[210px] object-contain cursor-pointer transition-transform hover:scale-105 block lg:hidden lg:group-hover:block shrink-0"
          />
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto overflow-x-hidden">
          <button
            onClick={() => navigate("/dashboard")}
            title="Dashboard"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <LayoutDashboard className="w-5 h-5 shrink-0" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              Dashboard
            </span>
          </button>
          <button
            onClick={() => navigate("/projects")}
            title="Business Proposal"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Folder className="w-5 h-5 shrink-0" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              Business Proposal
            </span>
          </button>
          <button
            onClick={() => navigate("/financial-input")}
            title="Financial Input"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <FileEdit className="w-5 h-5 shrink-0" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              Financial Input
            </span>
          </button>
          <button
            onClick={() => navigate("/ai-analysis")}
            title="AI Feasibility Analysis"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Zap className="w-5 h-5 shrink-0" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              AI Feasibility Analysis
            </span>
          </button>
          <button
            title="Reports"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-bold bg-[#c9a654] text-white transition-all shadow-md"
          >
            <BarChart3 className="w-5 h-5 shrink-0" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              Reports
            </span>
          </button>
          <button
            onClick={() => navigate("/messages")}
            title="Message"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <MessageCircle className="w-5 h-5 shrink-0" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              Message
            </span>
          </button>
          <button
            onClick={() => navigate("/settings")}
            title="Settings"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Settings className="w-5 h-5 shrink-0" />
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
        <div className="bg-white border-b border-gray-200/80 shadow-[0_3px_10px_rgba(0,0,0,0.06)] px-6 py-3.5 flex items-center justify-between text-sm text-gray-500 sticky top-0 z-20 print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">Reports</span>
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
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Initial Capital</p>
                  <p className="text-xl font-bold text-gray-900">₱ {(selectedProject.financialData?.startupCapital || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Financial Health</p>
                  <p className="text-xl font-bold text-gray-900">{selectedProject.aiAnalysis.metrics?.financial || 0}%</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Risk Level</p>
                  <p className="text-xl font-bold text-gray-900">{selectedProject.aiAnalysis.metrics?.risk || 0}%</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Market Viability</p>
                  <p className="text-xl font-bold text-gray-900">{selectedProject.aiAnalysis.metrics?.market || 0}%</p>
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