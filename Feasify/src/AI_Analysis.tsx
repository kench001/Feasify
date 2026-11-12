


import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, db, signOutUser } from "./firebase";
import { AIAnalysisLoading } from "./AIAnalysisLoading";
import AIAdvisoryModal from "./components/AIAdvisoryModal";
import ScrollToTopButton from "./components/ScrollToTopButton";
import MobileBurgerButton from "./components/MobileBurgerButton";
import SidebarCloseButton from "./components/SidebarCloseButton";
import FeasibilityAnalysisReport from "./components/FeasibilityAnalysisReport";
import AIAdvisoryDisclaimerBanner from "./components/AIAdvisoryDisclaimerBanner";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import {
  LayoutDashboard,
  Folder,
  FileEdit,
  Zap,
  BarChart3,
  MessageCircle,
  Settings,
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Bell,
} from "lucide-react";
import {
  cleanUserFacingText,
  calculateLocalAudit,
} from "./utils/feasibilityAudit";
import {
  extractActiveFinancialData,
  resolveProposalMonthAndDraft,
  computeFinancialInputSignature,
  detectAnalysisStaleness,
  resolveSyncedAIAnalysis,
  type ResolvedAIAnalysisData,
  type ExtractedFinancialData,
} from "./utils/aiAnalysisHelpers";

const AI_Analysis: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);

  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const [financials, setFinancials] = useState<ExtractedFinancialData>(() =>
    extractActiveFinancialData(null)
  );

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [resolvedAiData, setResolvedAiData] =
    useState<ResolvedAIAnalysisData | null>(null);
  const [hasNewerInputs, setHasNewerInputs] = useState(false);

  // AI Advisory Acknowledgment Modal States
  const [isAdvisoryModalOpen, setIsAdvisoryModalOpen] = useState(() => {
    try {
      return typeof window !== "undefined" && sessionStorage.getItem("ai_ack_pending") === "true";
    } catch {
      return false;
    }
  });
  const [advisoryModalKey, setAdvisoryModalKey] = useState(0);

  const handleAcknowledgeAdvisory = () => {
    try {
      sessionStorage.removeItem("ai_ack_pending");
    } catch {
      // Keep acknowledgment usable when browser storage is unavailable.
    }
    setIsAdvisoryModalOpen(false);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          if (snap.exists()) {
            const data = snap.data() as any;
            setUserName(
              [data.firstName, data.lastName].filter(Boolean).join(" ") ||
              u.displayName ||
              "",
            );
            if (data.section) {
              loadUserGroup(u.uid, data.section);
            } else {
              setIsLoading(false);
            }
          } else {
            setIsLoading(false);
          }
        } catch (err) {
          console.error(err);
          setIsLoading(false);
        }
      } else navigate("/");
    });
    return () => unsub();
  }, [navigate]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const q = query(
            collection(db, "notifications"),
            where("userId", "==", u.uid),
            where("isRead", "==", false),
          );
          const snap = await getDocs(q);
          setUnreadNotificationCount(snap.size);
        } catch (error) {
          console.error("Error fetching unread notifications:", error);
        }
      }
    });
    return () => unsub();
  }, []);

  const loadUserGroup = async (uid: string, section: string) => {
    try {
      const groupQ = query(
        collection(db, "groups"),
        where("section", "in", [section, "ALL"]),
      );
      const groupSnap = await getDocs(groupQ);
      let userGroupId = "";
      let activeProposalId = "";
      groupSnap.forEach((doc) => {
        const gData = doc.data();
        if (
          gData.leaderId === uid ||
          (gData.memberIds && gData.memberIds.includes(uid))
        ) {
          userGroupId = doc.id;
          activeProposalId = (gData.isSetup && gData.status === "Active Business") ? (gData.activeProposalId || "") : "";
        }
      });

      if (userGroupId && activeProposalId) {
        const propQ = query(
          collection(db, "proposals"),
          where("groupId", "==", userGroupId),
        );
        const propSnap = await getDocs(propQ);
        const approvedProjects = propSnap.docs
          .filter(
            (doc) =>
              doc.data().status === "Approved" ||
              doc.data().status === "APPROVED",
          )
          .map((doc) => ({
            id: doc.id,
            name: doc.data().businessName || "Untitled Proposal",
            businessName: doc.data().businessName || "Untitled Proposal",
            businessType: doc.data().businessType || "",
            totalCapital: doc.data().totalCapital || "0",
            proposalCapital: doc.data().totalCapital || doc.data().proposalCapital || "0",
            priceRanges: doc.data().priceRanges || "",
            proposedLocation: doc.data().proposedLocation || "",
            financialData: doc.data().financialData || null,
            aiAnalysis: doc.data().aiAnalysis || null,
            products: doc.data().products || doc.data().financialData?.products || [],
            rawProposalData: doc.data(),
          }));

        const activeProp = approvedProjects.find((p) => p.id === activeProposalId);
        if (activeProp) {
          setProjects([activeProp]);
        } else {
          setProjects([]);
          setSelectedProjectId("");
        }
      } else {
        setProjects([]);
        setSelectedProjectId("");
      }
    } catch (error) {
      console.error("Load failed:", error);
      setProjects([]);
      setSelectedProjectId("");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (projects.length === 0) return;
    const targetId =
      location.state?.projectId ||
      sessionStorage.getItem("lastSelectedProjectId") ||
      projects[0].id;
    const proj = projects.find((p) => p.id === targetId) || projects[0];

    if (proj) {
      setSelectedProjectId(proj.id);
      sessionStorage.setItem("lastSelectedProjectId", proj.id);
      const ctx = resolveProposalMonthAndDraft(proj);
      const activeFin = extractActiveFinancialData(proj, {
        monthIndex: ctx.monthIndex,
        draftId: ctx.draftId,
      });
      setFinancials(activeFin);

      const staleness = detectAnalysisStaleness(proj, {
        context: ctx,
        effectiveFin: activeFin,
      });
      setHasNewerInputs(staleness.hasNewerInputs);

      const isExplicitRun = Boolean(location.state?.runAnalysis);

      if (isExplicitRun) {
        console.log("⚡ [AI Analysis] Explicit 'Run Analysis' clicked. Triggering advisory modal and executing feasibility evaluation...");
        executeAnalysis(activeFin, proj.id);
        navigate(location.pathname, { replace: true, state: {} });
      } else if (proj.aiAnalysis) {
        const synced = resolveSyncedAIAnalysis(proj, {
          monthIndex: ctx.monthIndex,
          draftId: ctx.draftId,
          preferLiveOnStale: false,
        });
        setResolvedAiData(synced.aiData);
        setIsFallback(synced.isFallback);
        if (synced.isFallback) {
          console.warn(
            "🛡️ [Feasify Engine] Loaded previous analysis generated via Verified Local Mode.",
            proj.aiAnalysis._fallbackReason || "No fallback reason recorded.",
          );
        } else {
          console.log(`🤖 [Live AI] Loaded analysis generated via Gemini (${proj.aiAnalysis._model || "Cloud AI"})`);
        }
      } else {
        setResolvedAiData(null);
        setIsFallback(false);
      }
    }
  }, [location.state, projects, navigate]);

  const executeAnalysis = async (data: any, pId: string) => {
    if (!pId) return;
    try {
      sessionStorage.setItem("ai_ack_pending", "true");
    } catch {
      // The modal still opens when browser storage is unavailable.
    }
    setAdvisoryModalKey((prev) => prev + 1);
    setIsAdvisoryModalOpen(true);
    setIsAnalyzing(true);
    setAnalysisError(null);
    setIsFallback(false);
    setHasNewerInputs(false);

    const currentProj = projects.find((p) => p.id === pId);
    const ctx = resolveProposalMonthAndDraft(currentProj);
    const activeFin = extractActiveFinancialData(currentProj, {
      monthIndex: ctx.monthIndex,
      draftId: ctx.draftId,
    });
    const mergedFin = { ...activeFin, ...(data || {}) };

    const enrichedData = {
      ...currentProj?.financialData,
      ...mergedFin,
      products:
        mergedFin?.products && Array.isArray(mergedFin.products) && mergedFin.products.length > 0
          ? mergedFin.products
          : currentProj?.financialData?.products || currentProj?.products || [],
      startupCapital: mergedFin.startupCapital,
      cashInvested: mergedFin.cashInvested,
      contributorsList: mergedFin.contributorsList,
      totalCapital: mergedFin.totalCapital,
      proposalCapital: mergedFin.proposalCapital,
      equipmentList: mergedFin.equipmentList,
      opexList: mergedFin.opexList,
      fixedCosts: mergedFin.fixedCosts,
      operatingDays: mergedFin.operatingDays,
      businessName: mergedFin.businessName || currentProj?.name || "",
      businessType: mergedFin.businessType || currentProj?.businessType || "",
    };
    const inputSignature = computeFinancialInputSignature(enrichedData);

    try {
      const backendUrl = import.meta.env.VITE_API_URL || "http://localhost:10000";

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90000); // Allow backend Gemini timeout + fallback response

      const response = await fetch(`${backendUrl}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: pId,
          financialData: enrichedData,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || `Server responded with ${response.status}`);
      }

      const rawAiResult = await response.json();
      const aiResult = cleanUserFacingText(rawAiResult);

      // 2. Format Insights to include IDs (for React keys)
      const rawInsights = Array.isArray(aiResult?.insights)
        ? aiResult.insights
        : [];
      const generatedInsights = rawInsights.map((i: any, idx: number) =>
        i && typeof i === "object"
          ? { ...i, id: i.id || `ai-${idx}` }
          : {
              id: `ai-${idx}`,
              title: `Insight ${idx + 1}`,
              description: String(i ?? ""),
              type: "info" as const,
            }
      );

      if (aiResult?._fallback && aiResult?._fallbackReason) {
        console.warn(
          "🛡️ [Feasify Engine] Backend returned fallback audit:",
          aiResult._fallbackReason
        );
      }

      // 3. Save the AI's verdict back to Firebase so it persists in Reports
      const { _fallbackReason: _rawBackendFallbackReason, ...restAiResult } =
        aiResult && typeof aiResult === "object" ? aiResult : {};
      const updatedAiAnalysis = {
        ...restAiResult,
        ...(aiResult?._fallback ? { _fallbackReason: "BACKEND_FALLBACK" } : {}),
        insights: generatedInsights,
        lastRun: new Date().toISOString(),
        inputSignature,
        analyzedMonthIndex: ctx.monthIndex,
        analyzedDraftId: ctx.draftId,
        analysisType: "STUDENT_FINANCIAL_FEASIBILITY",
        sourceModule: "student-financial-input",
      };

      await updateDoc(doc(db, "proposals", pId), {
        aiAnalysis: updatedAiAnalysis
      });

      // Synchronize in-memory projects state with latest lastRun timestamp & signature
      setProjects((prev) =>
        prev.map((p) =>
          p.id === pId ? { ...p, aiAnalysis: updatedAiAnalysis } : p
        )
      );

      // 4. Update Local State to reflect the AI's audited results
      const synced = resolveSyncedAIAnalysis(
        { ...currentProj, aiAnalysis: updatedAiAnalysis },
        { monthIndex: ctx.monthIndex, draftId: ctx.draftId, preferLiveOnStale: false }
      );
      setResolvedAiData(synced.aiData);

      const isFallbackResult = aiResult?._fallback === true;
      setIsFallback(isFallbackResult);
      if (isFallbackResult) {
        console.warn(
          "🛡️ [Feasify Engine] Backend used verified local calculations (Cloud AI unavailable)."
        );
      } else {
        console.log(`🤖 [Live AI] Analysis generated successfully via Gemini (${aiResult?._model || "Cloud AI"})`);
      }

    } catch (e: any) {
      console.warn(
        "⚠️ [Live AI] Backend connection failed, engaging verified client-side financial audit engine:",
        e?.name || "REQUEST_FAILED"
      );
      try {
        const fallbackResult = calculateLocalAudit(enrichedData);
        const rawFallbackInsights = Array.isArray(fallbackResult?.insights)
          ? fallbackResult.insights
          : [];
        const fallbackInsights = rawFallbackInsights.map(
          (i: any, idx: number) => ({ ...i, id: i?.id || `local-${idx}` })
        );

        const updatedFallback = {
          ...fallbackResult,
          insights: fallbackInsights,
          lastRun: new Date().toISOString(),
          inputSignature,
          analyzedMonthIndex: ctx.monthIndex,
          analyzedDraftId: ctx.draftId,
          _fallbackReason:
            e?.name === "AbortError" ? "BACKEND_TIMEOUT" : "OFFLINE_LOCAL_AUDIT",
          analysisType: "STUDENT_FINANCIAL_FEASIBILITY",
          sourceModule: "student-financial-input",
        };

        // Save fallback audit to Firebase so reports stay populated
        await updateDoc(doc(db, "proposals", pId), {
          aiAnalysis: updatedFallback
        }).catch((err) => console.warn("Failed saving fallback to Firestore:", err));

        // Synchronize in-memory projects state with fallback timestamp & signature
        setProjects((prev) =>
          prev.map((p) =>
            p.id === pId ? { ...p, aiAnalysis: updatedFallback } : p
          )
        );

        const synced = resolveSyncedAIAnalysis(
          { ...currentProj, aiAnalysis: updatedFallback },
          { monthIndex: ctx.monthIndex, draftId: ctx.draftId, preferLiveOnStale: false }
        );
        setResolvedAiData(synced.aiData);

        setIsFallback(true);
        setAnalysisError(null);
      } catch (fallbackError: any) {
        console.error("❌ Both Live AI and Local Audit failed:", fallbackError);
        setAnalysisError(e.message || "Analysis failed. Please check your financial inputs and try again.");
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOutUser();
      localStorage.clear();
      sessionStorage.clear();
      navigate("/");
    } catch (e) {
      navigate("/");
    }
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
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
    <div className="flex min-h-screen bg-gray-50/50">
      {/* AI Advisory Acknowledgment Modal */}
      <AIAdvisoryModal
        key={advisoryModalKey}
        isOpen={isAdvisoryModalOpen}
        onAcknowledge={handleAcknowledgeAdvisory}
      />
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[50] lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
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
            title="AI Feasibility Analysis"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-bold bg-[#c9a654] text-[#122244] transition-all shadow-md"
          >
            <Zap className="w-5 h-5 shrink-0 text-[#122244]" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              AI Feasibility Analysis
            </span>
          </button>
          <button
            onClick={() => { setIsSidebarOpen(false); navigate("/reports"); }}
            title="Reports"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-200 hover:text-white hover:bg-white/10 transition-colors group"
          >
            <BarChart3 className="w-5 h-5 shrink-0 text-[#c9a654] group-hover:text-[#f0c242] transition-colors" />
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

      <main
        className="flex-1 w-full max-w-full transition-all duration-300 ease-in-out min-h-screen lg:ml-16 ml-0"
      >
        <div className="bg-white border-b border-gray-200/80 shadow-[0_3px_10px_rgba(0,0,0,0.06)] px-4 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between text-sm text-gray-500 sticky top-0 z-30">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <MobileBurgerButton onClick={() => setIsSidebarOpen(!isSidebarOpen)} />
            <span
              className="font-semibold text-gray-900 hover:text-[#c9a654] cursor-pointer transition-colors shrink-0"
              onClick={() => navigate("/dashboard")}
            >
              FeasiFy
            </span>
            <span className="text-gray-400 shrink-0">›</span>
            <span className="font-semibold text-gray-900 truncate">AI Analysis</span>
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

        {isAnalyzing ? (
          <AIAnalysisLoading projectName={selectedProject?.name} />
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <div className="w-10 h-10 border-4 border-[#122244] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-500 font-medium text-sm">Loading project analysis...</p>
          </div>
        ) : analysisError && (!resolvedAiData || resolvedAiData.score === 0) ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center bg-white rounded-2xl border border-red-100 shadow-sm p-8 sm:p-12 max-w-xl mx-auto my-8">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-red-100">
              <AlertCircle className="w-8 h-8" />
            </div>
            <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-black rounded-full uppercase tracking-wider mb-3">
              Evaluation Encountered an Issue
            </span>
            <h2 className="text-2xl font-extrabold text-[#122244] mb-3">
              Analysis Could Not Complete
            </h2>
            <p className="text-gray-500 text-sm max-w-md mx-auto mb-6 leading-relaxed">
              {analysisError}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => executeAnalysis(financials, selectedProjectId)}
                className="flex items-center gap-2 px-6 py-3 bg-[#122244] hover:bg-[#1a2f55] text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 text-[#c9a654]" /> Retry Feasibility Analysis
              </button>
            </div>
          </div>
        ) : projects.length === 0 || !selectedProjectId ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center bg-white rounded-2xl border border-gray-100 shadow-sm p-12 max-w-2xl mx-auto my-8">
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
              Please submit a business proposal, have it approved by your adviser, and have your team leader complete <strong>Company Setup</strong> in the <strong>Business Proposal</strong> module to unlock AI Feasibility Analysis.
            </p>
            <button
              onClick={() => navigate("/projects")}
              className="flex items-center gap-2 px-6 py-3 bg-[#122244] hover:bg-[#1a2f55] text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-95"
            >
              <Folder className="w-4 h-4 text-[#c9a654]" /> Go to Business Proposals
            </button>
          </div>
        ) : (
          <div className="p-6 md:p-8 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <div className="w-full sm:w-auto min-w-0">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#3d2c23]">
                  AI Analysis
                </h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <p className="text-sm text-gray-500 italic font-medium break-words">
                    Evaluation for{" "}
                    <span className="text-[#122244] font-bold">
                      {selectedProject?.name || "Selected Project"}
                    </span>
                  </p>
                  {hasNewerInputs ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      <AlertCircle className="w-3 h-3 text-amber-600" /> Financial Inputs Modified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Synced with Financial Inputs
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => executeAnalysis(financials, selectedProjectId)}
                disabled={!selectedProjectId || isAnalyzing}
                className={`w-full sm:w-auto flex justify-center items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all shadow-sm flex-shrink-0 disabled:opacity-50 ${hasNewerInputs
                    ? "bg-[#c9a654] hover:bg-[#b59545] text-white shadow-md ring-2 ring-[#c9a654]/30"
                    : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
              >
                <RotateCcw className={`w-4 h-4 ${isAnalyzing ? "animate-spin text-[#c9a654]" : ""}`} /> {isAnalyzing ? "Analyzing..." : "Re-analyze"}
              </button>
            </div>

            {/* Inputs Modified Notification Banner */}
            {hasNewerInputs && !isAnalyzing && selectedProject?.aiAnalysis && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200/80 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
                <div className="flex items-center gap-3 text-amber-900">
                  <div className="p-2 rounded-lg bg-amber-100 text-amber-700 shrink-0">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-900">
                      Financial inputs have been updated
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Your financial inputs were modified since the last analysis was generated. Click Re-analyze to update this evaluation.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => executeAnalysis(financials, selectedProjectId)}
                  disabled={isAnalyzing}
                  className="px-4 py-2 bg-[#c9a654] hover:bg-[#b59545] text-white text-xs font-bold rounded-lg shadow-sm transition-all shrink-0 flex items-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Re-analyze Now
                </button>
              </div>
            )}

            {analysisError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex flex-col gap-3">
                <div className="flex items-center gap-2 text-red-700 font-bold">
                  <AlertCircle className="w-5 h-5" />
                  <span>Analysis Failed</span>
                </div>
                <p className="text-sm text-red-600">{analysisError}</p>
                <button
                  onClick={() => executeAnalysis(financials, selectedProjectId)}
                  className="self-start px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-semibold text-sm rounded-lg transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}

            {isFallback && (
              <div className="mb-6 p-4 bg-slate-50 border border-slate-200/90 rounded-xl flex items-center gap-3.5 shadow-xs">
                <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-slate-800 font-bold">
                    Verified Feasibility Analysis Ready
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed mt-0.5">
                    All business metrics, profit projections, and feasibility evaluations are fully calculated and ready. You can click <strong>Re-analyze</strong> above anytime to refresh with online AI.
                  </p>
                </div>
              </div>
            )}

            {/* AI Advisory Disclaimer Banner */}
            <AIAdvisoryDisclaimerBanner className="mb-8" />

            <div className="mb-8 bg-white p-4 sm:p-6 rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">
                Active Project
              </label>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex-shrink-0 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-black text-lg border border-blue-100">
                  P#
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl sm:text-2xl font-extrabold text-[#122244] tracking-tight truncate">
                    {selectedProject?.name || "No Project Selected"}
                  </h2>
                  <span className="inline-block mt-1 text-[10px] font-black uppercase text-green-600 bg-green-50 px-2 py-0.5 rounded break-words">
                    Verified Approved Business
                  </span>
                </div>
              </div>
            </div>

            {!selectedProject?.aiAnalysis && !isAnalyzing ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 sm:p-12 text-center shadow-sm mb-8 max-w-2xl mx-auto animate-in fade-in duration-200">
                <div className="w-16 h-16 bg-amber-50 text-[#c9a654] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-100 shadow-inner">
                  <Zap className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-extrabold text-[#122244] mb-2">
                  Ready for AI Feasibility Analysis
                </h2>
                <p className="text-gray-500 text-sm max-w-md mx-auto mb-6 leading-relaxed">
                  Your business proposal and financial inputs are set up. Click below to run a comprehensive feasibility audit on product margins, capital adequacy, and market viability.
                </p>
                <button
                  onClick={() => executeAnalysis(financials, selectedProjectId)}
                  disabled={isAnalyzing}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#c9a654] hover:bg-[#b59545] text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Zap className="w-4 h-4 fill-white" /> {isAnalyzing ? "Analyzing..." : "Run Feasibility Analysis"}
                </button>
              </div>
            ) : (
              <div
                className={`transition-opacity duration-300 ${!selectedProjectId || isAnalyzing ? "opacity-40 pointer-events-none" : "opacity-100"}`}
              >
                {resolvedAiData && (
                  <FeasibilityAnalysisReport
                    aiData={resolvedAiData}
                    financials={financials}
                    viewerRole="student"
                  />
                )}

                <div className="flex flex-col sm:flex-row justify-end gap-3 mt-8">
                  <button
                    onClick={() =>
                      navigate("/financial-input", {
                        state: { projectId: selectedProjectId },
                      })
                    }
                    className="w-full sm:w-auto flex justify-center items-center gap-2 px-6 py-3 sm:py-2.5 bg-white border border-gray-200 rounded-xl sm:rounded-lg font-bold text-sm text-[#122244] hover:bg-gray-50 transition-all shadow-sm"
                  >
                    <FileEdit className="w-4 h-4" /> Revise Financial Data
                  </button>
                  <button
                    onClick={() =>
                      navigate("/reports", {
                        state: { projectId: selectedProjectId },
                      })
                    }
                    className="w-full sm:w-auto flex justify-center items-center gap-2 bg-[#c9a654] hover:bg-[#b59545] text-white px-6 py-3 sm:py-2.5 rounded-xl sm:rounded-lg font-bold text-sm transition-all shadow-md"
                  >
                    <BarChart3 className="w-4 h-4" /> View Full Report
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Floating Back to Top Button */}
        <ScrollToTopButton />
      </main>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowLogoutConfirm(false)}
          />
          <div className="bg-white rounded-2xl p-6 z-10 w-full max-w-sm shadow-xl text-center relative">
            <h3 className="text-lg font-bold text-[#122244] mb-6">
              Sign out of FeasiFy?
            </h3>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-5 py-2.5 rounded-lg border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-bold shadow-md"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AI_Analysis;
