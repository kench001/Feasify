import React, { useEffect, useState, useRef } from "react";
import Skeleton from "react-loading-skeleton";
import { useNavigate, useSearchParams } from "react-router-dom";
import "react-loading-skeleton/dist/skeleton.css";
import { auth, db, signOutUser } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where, addDoc, doc, getDoc, serverTimestamp, writeBatch, updateDoc, deleteDoc, arrayUnion, setDoc, onSnapshot } from "firebase/firestore";
import {
  Settings, ShieldAlert, Search, Users, Archive,
  CheckCircle2, AlertCircle, X, Star, FlaskConical, RefreshCw,
  MoreVertical, Trash2, Edit2, FileText, FileCheck, ChevronLeft, Clock, Loader2, MessageCircle, Target, DollarSign, Send, UserPlus, Check, Download,
  Bell, Calculator, Info,
  FileSpreadsheet, PieChart, ArrowUp, Cpu, Eye, Lock,
  Compass, Sparkles, ThumbsUp, TrendingDown, Lightbulb, Brain
} from "lucide-react";
import { normalizeProposalProducts, computeProductMetrics, type ProductCostingItem } from "./utils/productCosting";
import ActiveBusinessDetailView from "./components/ActiveBusinessDetailView";
import { type ResolvedAIAnalysisData } from "./utils/aiAnalysisHelpers";
import { logAuditEvent } from "./services/auditLogger";
import { fetchSectionExportData, generateSectionPDF } from "./services/sectionExportService";
import { sendNotification, sendBatchNotification } from "./services/notificationService";
import ScrollToTopButton from "./components/ScrollToTopButton";
import MobileBurgerButton from "./components/MobileBurgerButton";
import SidebarCloseButton from "./components/SidebarCloseButton";
import { exportProposalAnalysisPDF } from "./utils/exportProposalAnalysisPDF";
import { getOtherRelevantInformation } from "./utils/proposalDetails";
import { calculateGroupDistribution } from "./utils/groupDistribution";
import { formatDisplayDate, formatDisplayDateTime, formatProposalDate as formatStandardProposalDate } from "./utils/dateFormatter";
import ProposalExportModal from "./components/ProposalExportModal";

interface StudentData {
  id: string;
  firstName: string;
  lastName: string;
  studentId: string;
  email: string;
  section?: string;
}

interface GroupData {
  id: string;
  leaderId: string;
  leaderName: string;
  title: string;
  companyName?: string;
  companyLogo?: string;
  businessName?: string;
  businessLogo?: string;
  memberIds: string[];
  section: string;
  status?: 'Drafting' | 'Pending Review' | 'Approved Proposal' | 'Active Business';
  activeProposalId?: string;
  approvedProposalId?: string;
  isSetup?: boolean;
  reportSubmitted?: boolean;
  reportSubmissionDate?: any;
  reportStatus?: string;
  submittedReportScore?: number;
  submittedReportVerdict?: string;
  adviserRemarks?: string;
  adviserScore?: number;
}

interface FeedbackItem {
  id: string;
  text: string;
  authorName: string;
  role: string;
  date: string;
  score?: number;
}

interface ProposalData {
  id?: string;
  groupId: string;
  proposalNumber?: number;
  businessType: string;
  businessName: string;
  businessLogo?: string;
  totalCapital: string;
  tagline: string;
  targetMarket: string;
  missionStatement: string;
  visionStatement: string;
  productDescription: string;
  priceRanges: string;
  proposedLocation: string;
  promotionalStrategy: string;
  otherDetails: string;
  additionalFeasibilityDetails?: string;
  status: 'Draft' | 'Submitted' | 'Under Review' | 'Revision Required' | 'Approved' | 'Rejected' | 'Pending' | 'Revision';
  adviserRemarks?: string;
  adviserFeedback?: string;
  adviserScore?: number;
  feedbackHistory?: FeedbackItem[];
  submissionDate?: string;
  submittedData?: any;
  financialData?: any;
  originalProposalFinancials?: any;
  aiAnalysis?: any;
  adviserAiAnalysis?: any;
  reportSubmitted?: boolean;
  reportSubmissionDate?: any;
  reportStatus?: string;
  submittedReportScore?: number;
  submittedReportVerdict?: string;
  createdAt?: any;
  updatedAt?: any;
}

export const isProposalSubmitted = (p: ProposalData): boolean => {
  if (!p) return false;
  if (p.status === "Draft" || (p.status as any) === "Drafting") return false;
  // Must have either submittedData, submissionDate, or a submitted/review status
  return Boolean(
    p.submittedData ||
    p.submissionDate ||
    ["Submitted", "Pending", "Under Review", "Approved", "Approved Proposal", "APPROVED", "Revision Required", "Rejected", "Revision"].includes(p.status)
  );
};

export const isReportSubmitted = (group: GroupData, teamProps: ProposalData[] = []): boolean => {
  if (!group) return false;
  if ((group as any).reportSubmitted === true) return true;
  const activeProp = teamProps.find(p => p.id === group.activeProposalId) || teamProps.find(p => p.status === 'Approved');
  if (activeProp && (activeProp as any).reportSubmitted === true) return true;
  return teamProps.some(p => (p as any).reportSubmitted === true);
};

export const getAdviserVisibleProposal = (p: ProposalData): ProposalData => {
  if (!p) return p;
  if (p.submittedData && typeof p.submittedData === 'object') {
    return {
      ...p,
      ...p.submittedData,
      // Keep adviser remarks and history from the root document
      adviserRemarks: p.adviserRemarks || p.submittedData.adviserRemarks || "",
      adviserFeedback: p.adviserFeedback || p.submittedData.adviserFeedback || "",
      adviserScore: p.adviserScore ?? p.submittedData.adviserScore,
      feedbackHistory: p.feedbackHistory || p.submittedData.feedbackHistory || [],
      id: p.id,
      groupId: p.groupId,
      facultyId: (p as any).facultyId,
      status: p.status || p.submittedData.status,
    };
  }
  return p;
};

const getProposalStatusBadge = (status?: string) => {
  switch (status) {
    case 'Approved':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 border border-green-200"><CheckCircle2 className="w-3 h-3" /> Approved</span>;
    case 'Rejected':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200"><X className="w-3 h-3" /> Rejected</span>;
    case 'Revision Required':
    case 'Revision':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200"><Edit2 className="w-3 h-3" /> Revision Required</span>;
    case 'Under Review':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200"><Clock className="w-3 h-3" /> Under Review</span>;
    case 'Submitted':
    case 'Pending':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-800 border border-yellow-200"><Clock className="w-3 h-3" /> Submitted</span>;
    case 'Draft':
    default:
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">Draft</span>;
  }
};

const formatProposalDate = (proposal: ProposalData, includeTime = false) => {
  return formatStandardProposalDate(proposal, includeTime);
};

const AdviserDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [userName, setUserName] = useState("Adviser");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Section Management State
  const [adviserSections, setAdviserSections] = useState<string[]>([]);
  const [activeSection, setActiveSection] = useState("");

  // Data States
  const [students, setStudents] = useState<StudentData[]>([]);
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [groupProposals, setGroupProposals] = useState<ProposalData[]>([]);
  const [proposalsByGroup, setProposalsByGroup] = useState<Record<string, ProposalData[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // View & Tab States
  const [activeView, setActiveView] = useState<'dashboard' | 'group-details' | 'active-business'>('dashboard');
  const [activeDashboardTab, setActiveDashboardTab] = useState<'All Groups' | 'Pending Review' | 'Approved Proposal' | 'Drafting' | 'Active Business'>('All Groups');
  const [activeDetailTab, setActiveDetailTab] = useState<'Proposals' | 'Members'>('Proposals');
  const [selectedGroup, setSelectedGroup] = useState<GroupData | null>(null);
  const [activeProposal, setActiveProposal] = useState<ProposalData | null>(null);
  const [awaitingReportGroup, setAwaitingReportGroup] = useState<GroupData | null>(null);

  // Per-section group settings
  const [sectionSettingsMap, setSectionSettingsMap] = useState<Record<string, { minMembers: number, maxMembers: number }>>({});
  const [sectionGroupCountMap, setSectionGroupCountMap] = useState<Record<string, number>>({});
  const [minMembers, setMinMembers] = useState(8);
  const [maxMembers, setMaxMembers] = useState(10);
  const [adviserUid, setAdviserUid] = useState("");

  // Modals & Popovers
  const [showAllStudentsModal, setShowAllStudentsModal] = useState(false);
  const [showAutoGroupConfirm, setShowAutoGroupConfirm] = useState(false);
  const [showAllAssignedModal, setShowAllAssignedModal] = useState(false); // NEW MODAL STATE
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<GroupData | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Create Group Multi-Step State
  const [showCreateLeaderModal, setShowCreateLeaderModal] = useState(false);
  const [showCreateMembersModal, setShowCreateMembersModal] = useState(false);
  const [selectedLeaderId, setSelectedLeaderId] = useState<string>("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  // Change Leader State
  const [showChangeLeaderModal, setShowChangeLeaderModal] = useState(false);
  const [groupToChangeLeader, setGroupToChangeLeader] = useState<GroupData | null>(null);
  const [newLeaderId, setNewLeaderId] = useState<string>("");

  // Review & Feedback State
  const [viewingProposal, setViewingProposal] = useState<ProposalData | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackInput, setFeedbackInput] = useState("");
  const [adviserScoreInput, setAdviserScoreInput] = useState<string>("");
  const [isFeedbackExpanded, setIsFeedbackExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isSubmittingFeedbackRef = React.useRef(false);
  const [showProposalExportModal, setShowProposalExportModal] = useState(false);
  const [proposalToExport, setProposalToExport] = useState<ProposalData | null>(null);

  // Adviser Remarks & PDF Export State
  const [isRemarksSaving, setIsRemarksSaving] = useState(false);
  const [remarksSavedNotice, setRemarksSavedNotice] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [copiedAiFeedback, setCopiedAiFeedback] = useState(false);
  const [customAIRules, setCustomAIRules] = useState<any>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  // Top-center New Proposal Notification & Highlights
  const [topProposalNotification, setTopProposalNotification] = useState<{
    groupId: string;
    groupName: string;
    proposalId?: string;
    proposalName?: string;
    type?: 'proposal' | 'report';
    title?: string;
    message?: string;
  } | null>(null);
  const [highlightedProposalIds, setHighlightedProposalIds] = useState<string[]>([]);
  const knownSubmittedProposalIds = useRef<Set<string>>(new Set());
  const knownProposalStatuses = useRef<Map<string, string>>(new Map());
  const knownReportSubmittedGroupIds = useRef<Set<string>>(new Set());
  const knownReportSubmittedPropIds = useRef<Set<string>>(new Set());
  const isInitialGroupsSnapshot = useRef<boolean>(true);
  const isInitialProposalsSnapshot = useRef<boolean>(true);
  const isInitialNotifsSnapshot = useRef<boolean>(true);
  const knownNotifIds = useRef<Set<string>>(new Set());
  const notifUnsubRef = useRef<(() => void) | null>(null);

  // Auto-dismiss top proposal notification after 10 seconds
  useEffect(() => {
    if (!topProposalNotification) return;
    const timer = setTimeout(() => {
      setTopProposalNotification(null);
    }, 10000);
    return () => clearTimeout(timer);
  }, [topProposalNotification]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { navigate("/"); return; }
      try {
        setAdviserUid(u.uid);
        const userDoc = await getDoc(doc(db, "users", u.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.role !== "Adviser" && u.email !== "chairperson@gmail.com") {
            navigate("/dashboard"); return;
          }
          setUserName(`${data.firstName} ${data.lastName}`);
          const rawSection = data.section || "Unassigned";
          const parsedSections = rawSection.split(",")
            .map((s: string) => s.trim())
            .filter(Boolean)
            .sort((a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

          // Load per-section settings from Firestore
          if (data.sectionSettings) {
            setSectionSettingsMap(data.sectionSettings);
          }
          
          if (data.customAIRules) {
            setCustomAIRules(data.customAIRules);
          }

          setAdviserSections(parsedSections);

          // Live notification badge & proposal notification trigger
          const notifQ = query(
            collection(db, "notifications"),
            where("userId", "==", u.uid),
            where("isRead", "==", false)
          );
          if (notifUnsubRef.current) {
            notifUnsubRef.current();
          }
          notifUnsubRef.current = onSnapshot(notifQ, (snap) => {
            setUnreadNotificationCount(snap.size);

            snap.docChanges().forEach((change) => {
              if (change.type === "added") {
                const notifId = change.doc.id;
                const notifData = change.doc.data();

                if (!isInitialNotifsSnapshot.current && !knownNotifIds.current.has(notifId)) {
                  const isReportNotif =
                    notifData.type === "report" ||
                    notifData.metadata?.type === "report" ||
                    (typeof notifData.title === "string" && notifData.title.toLowerCase().includes("report")) ||
                    (typeof notifData.message === "string" && notifData.message.toLowerCase().includes("report"));

                  const isProposalNotif =
                    notifData.type === "proposal" ||
                    (typeof notifData.message === "string" && notifData.message.toLowerCase().includes("proposal")) ||
                    (typeof notifData.title === "string" && notifData.title.toLowerCase().includes("proposal"));

                  if (isReportNotif) {
                    const meta = notifData.metadata || {};
                    let resolvedGroupName = meta.groupName || meta.companyName || "";

                    if (!resolvedGroupName && notifData.message) {
                      const match = notifData.message.match(/Team\s+["']([^"']+)["']/i) || notifData.message.match(/Group\s+["']?([^"']+)["']?/i);
                      if (match && match[1]) {
                        resolvedGroupName = match[1];
                      }
                    }

                    const targetGroupId = meta.groupId || "";
                    const targetPropId = meta.proposalId || "";
                    const targetPropName = meta.proposalName || meta.businessName || "";

                    setTopProposalNotification({
                      groupId: targetGroupId,
                      groupName: resolvedGroupName || "A group",
                      proposalId: targetPropId,
                      proposalName: targetPropName || "Feasibility Report",
                      type: "report",
                      title: notifData.title || "Feasibility Report Submitted",
                      message: notifData.message || `Team "${resolvedGroupName}" submitted a feasibility report.`
                    });
                  } else if (isProposalNotif) {
                    const meta = notifData.metadata || {};
                    let resolvedGroupName = meta.groupName || meta.companyName || "";

                    if (!resolvedGroupName && notifData.message) {
                      const match = notifData.message.match(/Team\s+["']([^"']+)["']/i) || notifData.message.match(/Group\s+["']?([^"']+)["']?/i);
                      if (match && match[1]) {
                        resolvedGroupName = match[1];
                      }
                    }

                    const targetGroupId = meta.groupId || "";
                    const targetPropId = meta.proposalId || "";
                    const targetPropName = meta.proposalName || meta.businessName || "";

                    setTopProposalNotification({
                      groupId: targetGroupId,
                      groupName: resolvedGroupName || "A group",
                      proposalId: targetPropId,
                      proposalName: targetPropName,
                      type: "proposal"
                    });

                    if (targetPropId) {
                      setHighlightedProposalIds((prev) => Array.from(new Set([...prev, targetPropId])));
                    }
                  }
                }
                knownNotifIds.current.add(notifId);
              }
            });
            isInitialNotifsSnapshot.current = false;
          }, (err) => console.error("Adviser notif badge error:", err));
        }
      } catch (error) { console.error(error); }
    });
    return () => {
      unsub();
      if (notifUnsubRef.current) {
        notifUnsubRef.current();
        notifUnsubRef.current = null;
      }
    };
  }, [navigate]);

  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 150);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (activeProposal && proposalsByGroup[activeProposal.groupId]) {
      const updated = proposalsByGroup[activeProposal.groupId].find(p => p.id === activeProposal.id);
      if (updated && updated !== activeProposal) {
        setActiveProposal(updated);
      }
    }
  }, [proposalsByGroup]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };


  // Auto-select "ALL" (My Sections) when adviser sections load
  useEffect(() => {
    if (adviserSections.length > 0 && !activeSection) {
      const sectionParam = searchParams.get("section");
      const sectionToSelect = sectionParam || "ALL";

      setActiveSection(sectionToSelect);
      if (sectionToSelect !== "ALL") {
        const settings = sectionSettingsMap[sectionToSelect];
        setMinMembers(settings?.minMembers ?? 8);
        setMaxMembers(settings?.maxMembers ?? 10);
      }
      setupSectionListener(sectionToSelect, adviserSections);
    }
  }, [adviserSections, sectionSettingsMap, searchParams]);

  // Ref to store the current section listener cleanup function
  const sectionUnsubRef = React.useRef<(() => void) | undefined>(undefined);

  const setupSectionListener = (section: string, sectionsList = adviserSections) => {
    if (!section || section === "Unassigned") { setIsLoading(false); return; }

    // Clean up previous listener
    if (sectionUnsubRef.current) {
      sectionUnsubRef.current();
      sectionUnsubRef.current = undefined;
    }

    setIsLoading(true);
    setSearchTerm("");
    setActiveView('dashboard');

    const activeList = section === "ALL"
      ? (sectionsList.length > 0 ? sectionsList : adviserSections)
      : [section];

    if (activeList.length === 0) {
      setStudents([]);
      setGroups([]);
      setIsLoading(false);
      return;
    }

    // Fetch students (one-time — they change rarely)
    const studentQuery = section === "ALL"
      ? query(collection(db, "users"), where("role", "==", "Student"), where("section", "in", activeList.slice(0, 30)))
      : query(collection(db, "users"), where("role", "==", "Student"), where("section", "==", section));

    getDocs(studentQuery)
      .then(snap => setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() } as StudentData))))
      .catch(console.error);

    // Live listener for groups (including "ALL" to catch and auto-heal any misassigned groups)
    const querySections = Array.from(new Set([...activeList, "ALL"])).slice(0, 30);
    const groupQuery = query(collection(db, "groups"), where("section", "in", querySections));

    let unsubProposals: (() => void) | undefined;

    const unsubGroups = onSnapshot(groupQuery, (groupSnap) => {
      // Filter out orphaned "ALL" groups if viewing a specific section and the leader doesn't belong to it
      const groupDocs = groupSnap.docs.filter(d => {
        const gSec = (d.data().section || "").trim();
        if (section === "ALL" || gSec === section) return true;
        if (!gSec || gSec.toUpperCase() === "ALL") {
          const studentLeader = students.find(s => s.id === d.data().leaderId);
          return studentLeader ? studentLeader.section === section : true;
        }
        return false;
      });
      const groupIds = groupDocs.map(d => d.id);

      // Track live report submissions on groups
      const newlyReportSubmittedGroups: { id: string; name: string }[] = [];
      groupDocs.forEach(gd => {
        const gData = gd.data();
        const isRepSub = gData.reportSubmitted === true;
        if (isRepSub) {
          if (!isInitialGroupsSnapshot.current && !knownReportSubmittedGroupIds.current.has(gd.id)) {
            newlyReportSubmittedGroups.push({
              id: gd.id,
              name: gData.companyName || gData.businessName || gData.title || "A group"
            });
          }
          knownReportSubmittedGroupIds.current.add(gd.id);
        }
      });

      if (isInitialGroupsSnapshot.current) {
        isInitialGroupsSnapshot.current = false;
      } else if (newlyReportSubmittedGroups.length > 0) {
        const latestRep = newlyReportSubmittedGroups[newlyReportSubmittedGroups.length - 1];
        setTopProposalNotification({
          groupId: latestRep.id,
          groupName: latestRep.name,
          type: "report",
          title: "Feasibility Report Submitted",
          message: `Team "${latestRep.name}" has submitted their passing Feasibility Report.`
        });
      }

      // Clean up old proposals listener, set up new one
      if (unsubProposals) { unsubProposals(); }

      if (groupIds.length === 0) {
        setGroups([]);
        setSectionGroupCountMap(prev => ({ ...prev, [section]: 0 }));
        setIsLoading(false);
        return;
      }

      const propQuery = query(
        collection(db, "proposals"),
        where("groupId", "in", groupIds.slice(0, 30))
      );

      unsubProposals = onSnapshot(propQuery, (propSnap) => {
        const proposalMap: Record<string, { businessName?: string; businessLogo?: string }> = {};
        const byGroup: Record<string, ProposalData[]> = {};
        const newlySubmittedList: ProposalData[] = [];
        const newlyReportSubmittedProps: ProposalData[] = [];

        propSnap.docs.forEach(pd => {
          const pdata = { id: pd.id, ...pd.data() } as ProposalData;
          const isSub = isProposalSubmitted(pdata);
          const prevStatus = knownProposalStatuses.current.get(pd.id);

          const isRepSub = (pdata as any).reportSubmitted === true;
          if (isRepSub) {
            if (!isInitialProposalsSnapshot.current && !knownReportSubmittedPropIds.current.has(pd.id)) {
              newlyReportSubmittedProps.push(pdata);
            }
            knownReportSubmittedPropIds.current.add(pd.id);
          }

          if (isSub) {
            const isNewlyDiscovered = !knownSubmittedProposalIds.current.has(pd.id);
            const isResubmitted = Boolean(prevStatus && prevStatus !== 'Submitted' && prevStatus !== 'Pending' && (pdata.status === 'Submitted' || pdata.status === 'Pending'));

            if (!isInitialProposalsSnapshot.current && (isNewlyDiscovered || isResubmitted)) {
              newlySubmittedList.push(pdata);
            }
            knownSubmittedProposalIds.current.add(pd.id);
          }
          knownProposalStatuses.current.set(pd.id, pdata.status);

          if (isSub && (pdata.status === 'Approved' || (pdata.status as any) === 'APPROVED' || !proposalMap[pdata.groupId])) {
            const visible = getAdviserVisibleProposal(pdata);
            proposalMap[pdata.groupId] = {
              businessName: visible.businessName,
              businessLogo: visible.businessLogo,
            };
          }
          if (!byGroup[pdata.groupId]) {
            byGroup[pdata.groupId] = [];
          }
          byGroup[pdata.groupId].push(pdata);
        });

        if (isInitialProposalsSnapshot.current) {
          isInitialProposalsSnapshot.current = false;
        } else if (newlyReportSubmittedProps.length > 0) {
          const newestRep = newlyReportSubmittedProps[newlyReportSubmittedProps.length - 1];
          const matchedGroup = groupDocs.find(d => d.id === newestRep.groupId);
          const gData = matchedGroup ? matchedGroup.data() : null;
          const grpName = gData?.companyName || gData?.title || gData?.businessName || "A group";

          setTopProposalNotification({
            groupId: newestRep.groupId,
            groupName: grpName,
            proposalId: newestRep.id,
            proposalName: newestRep.businessName || "Feasibility Report",
            type: "report",
            title: "Feasibility Report Submitted",
            message: `Team "${grpName}" has submitted their passing Feasibility Report.`
          });
        } else if (newlySubmittedList.length > 0) {
          const newest = newlySubmittedList[newlySubmittedList.length - 1];
          const matchedGroup = groupDocs.find(d => d.id === newest.groupId);
          const gData = matchedGroup ? matchedGroup.data() : null;
          const grpName = gData?.companyName || gData?.title || gData?.businessName || "A group";

          setTopProposalNotification({
            groupId: newest.groupId,
            groupName: grpName,
            proposalId: newest.id,
            proposalName: newest.businessName || "Business Proposal",
            type: "proposal"
          });

          setHighlightedProposalIds(prev => Array.from(new Set([...prev, ...newlySubmittedList.map(p => p.id || "").filter(Boolean)])));
        }

        Object.keys(byGroup).forEach(gid => {
          byGroup[gid].sort((a, b) => {
            const numA = a.proposalNumber || 1;
            const numB = b.proposalNumber || 1;
            if (numA !== numB) return numA - numB;
            return (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0) - (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0);
          });
        });

        setProposalsByGroup(byGroup);

        const fetchedGroups = groupDocs.map(d => {
          const gData = d.data();
          const pInfo = proposalMap[d.id] || {};
          let sec = (gData.section || "").trim();

          // Auto-heal existing groups where section is "ALL", "All", or empty
          if (!sec || sec.toUpperCase() === "ALL") {
            const studentLeader = students.find(s => s.id === gData.leaderId);
            if (studentLeader?.section) {
              sec = studentLeader.section.trim();
              updateDoc(doc(db, "groups", d.id), { section: sec })
                .catch(err => console.error("Auto-heal group section failed:", err));
            } else if (gData.leaderId) {
              getDoc(doc(db, "users", gData.leaderId)).then(userSnap => {
                if (userSnap.exists() && userSnap.data().section) {
                  const resolvedSec = (userSnap.data().section || "").trim();
                  if (resolvedSec) {
                    updateDoc(doc(db, "groups", d.id), { section: resolvedSec })
                      .catch(err => console.error("Auto-heal group section from user doc failed:", err));
                    setGroups(prev => prev.map(g => g.id === d.id ? { ...g, section: resolvedSec } : g));
                  }
                }
              }).catch(console.error);
            }
          }

          return {
            id: d.id,
            ...gData,
            section: sec,
            businessName: gData.businessName || pInfo.businessName || "",
            businessLogo: gData.businessLogo || pInfo.businessLogo || "",
            status: gData.status || 'Drafting'
          } as GroupData;
        });
        setGroups(fetchedGroups);
        setSectionGroupCountMap(prev => ({ ...prev, [section]: fetchedGroups.length }));
        setIsLoading(false);
      }, (err) => {
        console.error("Proposals listener error:", err);
        setIsLoading(false);
      });

    }, (err) => {
      console.error("Groups listener error:", err);
      setIsLoading(false);
    });

    // Store cleanup function in ref
    sectionUnsubRef.current = () => {
      unsubGroups();
      if (unsubProposals) unsubProposals();
    };
  };

  // GroupProposals listener ref (for group-details view)
  const groupProposalsUnsubRef = React.useRef<(() => void) | undefined>(undefined);

  const fetchGroupProposals = (groupId: string) => {
    // Clean up old listener
    if (groupProposalsUnsubRef.current) {
      groupProposalsUnsubRef.current();
      groupProposalsUnsubRef.current = undefined;
    }

    const q = query(collection(db, "proposals"), where("groupId", "==", groupId));
    const unsub = onSnapshot(q, (snap) => {
      const fetched = snap.docs.map(d => {
        const data = d.data();
        if (!data.originalProposalFinancials && data.financialData) {
          updateDoc(doc(db, "proposals", d.id), {
            originalProposalFinancials: data.financialData
          }).catch(console.error);
        }
        return {
          id: d.id,
          ...data,
          originalProposalFinancials: data.originalProposalFinancials || data.financialData || null
        } as ProposalData;
      });
      fetched.sort((a, b) => {
        const numA = a.proposalNumber || 1;
        const numB = b.proposalNumber || 1;
        if (numA !== numB) return numA - numB;
        return (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0) - (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0);
      });
      setGroupProposals(fetched);
      setProposalsByGroup(prev => ({ ...prev, [groupId]: fetched }));
    }, (error) => {
      console.error("Group proposals listener error:", error);
    });
    groupProposalsUnsubRef.current = unsub;
  };

  const handleLogout = async () => {
    try { await signOutUser(); localStorage.clear(); sessionStorage.clear(); } catch (e) { }
    navigate("/");
  };

  const getInitials = (name: string) => name ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "U";

  const handleOpenGroupDetails = (group: GroupData) => {
    setSelectedGroup(group);
    setActiveView('group-details');
    setActiveDetailTab('Proposals');
    fetchGroupProposals(group.id);
  };

  const openActiveBusinessView = (proposal: ProposalData) => {
    setActiveProposal(proposal);
    setActiveView('active-business');
  };

  const handleOpenActiveBusiness = async (group: GroupData) => {
    setSelectedGroup(group);
    const teamProps = proposalsByGroup[group.id] || [];

    if (!isReportSubmitted(group, teamProps)) {
      setAwaitingReportGroup(group);
      return;
    }

    let propId = group.activeProposalId;
    if (!propId) {
      const approved = teamProps.find(p => p.status === 'Approved');
      if (approved) propId = approved.id;
    }
    if (!propId && teamProps.length > 0) {
      propId = teamProps[0].id;
    }

    if (!propId) {
      alert("No active proposal linked to this group.");
      return;
    }

    setIsLoading(true);
    try {
      const docRef = doc(db, "proposals", propId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const pData = { id: docSnap.id, ...docSnap.data() } as ProposalData;
        openActiveBusinessView(pData);
      } else {
        const fallback = teamProps.find(p => p.id === propId);
        if (fallback) {
          openActiveBusinessView(fallback);
        } else {
          alert("Could not load the active proposal details.");
        }
      }
    } catch (e) {
      console.error(e);
      const fallback = teamProps.find(p => p.id === propId);
      if (fallback) {
        openActiveBusinessView(fallback);
      } else {
        alert("Failed to fetch business details.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenProposalModal = (proposal: ProposalData, group?: GroupData) => {
    if (group) {
      setSelectedGroup(group);
    }
    if (proposal.id) {
      setHighlightedProposalIds(prev => prev.filter(id => id !== proposal.id));
    }
    const visibleProposal = getAdviserVisibleProposal(proposal);
    setViewingProposal(visibleProposal);
    setFeedbackInput(visibleProposal.adviserRemarks || visibleProposal.adviserFeedback || "");
    setIsFeedbackExpanded(true);
    setCopiedAiFeedback(false);
  };

  const handleViewHighlightedProposal = () => {
    if (!topProposalNotification) return;
    const { groupId, proposalId, type } = topProposalNotification;

    // Dismiss top banner
    setTopProposalNotification(null);

    // Return to dashboard if in sub-views
    if (activeView !== 'dashboard') {
      setActiveView('dashboard');
    }
    if (activeDashboardTab !== 'All Groups') {
      setActiveDashboardTab('All Groups');
    }

    let targetGroup = groups.find(g => g.id === groupId);
    if (!targetGroup && topProposalNotification.groupName) {
      targetGroup = groups.find(g =>
        (g.companyName && g.companyName.toLowerCase() === topProposalNotification.groupName.toLowerCase()) ||
        (g.title && g.title.toLowerCase() === topProposalNotification.groupName.toLowerCase()) ||
        (g.businessName && g.businessName.toLowerCase() === topProposalNotification.groupName.toLowerCase())
      );
    }

    if (targetGroup) {
      if (activeSection !== "ALL" && targetGroup.section && targetGroup.section !== activeSection) {
        setActiveSection("ALL");
      }

      setTimeout(() => {
        const el = document.getElementById(`group-card-${targetGroup!.id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);

      if (type === 'report') {
        handleOpenActiveBusiness(targetGroup);
        return;
      }

      const teamProps = (proposalsByGroup[targetGroup.id] || []).filter(isProposalSubmitted);
      const targetProp = proposalId
        ? teamProps.find(p => p.id === proposalId)
        : teamProps.find(p => p.status === 'Submitted' || p.status === 'Pending') || teamProps[0];

      if (targetProp) {
        handleOpenProposalModal(targetProp, targetGroup);
      } else {
        handleOpenGroupDetails(targetGroup);
      }
    }
  };

  const handleCopyAiFeedbackToRemarks = (aiFeedbackText: string) => {
    if (!aiFeedbackText) return;
    setFeedbackInput((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return aiFeedbackText.trim();
      return `${trimmed}\n\n[AI Feedback Note]:\n${aiFeedbackText.trim()}`;
    });
    setCopiedAiFeedback(true);
    setTimeout(() => setCopiedAiFeedback(false), 2500);
  };

  const handleCloseProposalModal = async () => {
    if (viewingProposal && viewingProposal.id) {
      const currentInput = feedbackInput.trim();
      const currentSaved = (viewingProposal.adviserRemarks || viewingProposal.adviserFeedback || "").trim();
      if (currentInput && currentInput !== currentSaved) {
        try {
          await updateDoc(doc(db, "proposals", viewingProposal.id), {
            adviserRemarks: currentInput,
            adviserFeedback: currentInput,
            updatedAt: serverTimestamp(),
          });
        } catch {}
      }
    }
    setViewingProposal(null);
  };

  const handleActiveBusinessExportPDF = async (proposal: ProposalData, aiData: ResolvedAIAnalysisData) => {
    if (!proposal) return;
    setIsExportingPdf(true);
    try {
      await exportProposalAnalysisPDF({
        proposal,
        aiResult: {
          overallScore: aiData.score,
          verdict: aiData.status,
          strengths: aiData.insights.filter((item) => item.type === "positive"),
          weaknesses: aiData.insights.filter((item) => item.type === "warning"),
          recommendations: aiData.insights.filter((item) => item.type === "info" || item.type === "suggestion"),
          realityCheck: aiData.explanations.market || aiData.explanations.feasibility,
          _fallback: aiData._fallback,
        },
        currentRemarks: feedbackInput,
        adviserName: userName,
        groupTitle: selectedGroup?.title || "Student Group",
        sectionCode: selectedGroup?.section || activeSection || "Unassigned",
      });
    } catch (err) {
      console.error("PDF export error:", err);
      alert("Failed to export PDF. Please try again.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportPDF = async () => {
    if (!viewingProposal) return;
    setIsExportingPdf(true);
    try {
      await exportProposalAnalysisPDF({
        proposal: viewingProposal,
        aiResult: viewingProposal.aiAnalysis || viewingProposal.adviserAiAnalysis || null,
        currentRemarks: feedbackInput,
        adviserName: userName,
        groupTitle: selectedGroup?.title || "Student Group",
        sectionCode: selectedGroup?.section || activeSection || "Unassigned",
      });
    } catch (err) {
      console.error("PDF export error:", err);
      alert("Failed to export PDF. Please try again.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Auto-save remarks when typing in the proposal review modal
  useEffect(() => {
    if (!viewingProposal || !viewingProposal.id) return;
    const currentSavedRemarks = (viewingProposal.adviserRemarks || viewingProposal.adviserFeedback || "").trim();
    const currentInput = feedbackInput.trim();
    if (currentInput === currentSavedRemarks) {
      setIsRemarksSaving(false);
      return;
    }

    setIsRemarksSaving(true);
    setRemarksSavedNotice(false);

    const timer = setTimeout(async () => {
      try {
        const updatePayload: any = {
          adviserRemarks: currentInput,
          adviserFeedback: currentInput,
          updatedAt: serverTimestamp(),
        };

        await updateDoc(doc(db, "proposals", viewingProposal.id!), updatePayload);

        try {
          const backendUrl = import.meta.env.VITE_API_URL || "http://localhost:10000";
          await fetch(`${backendUrl}/api/proposals/${viewingProposal.id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: viewingProposal.status,
              adviserRemarks: currentInput,
            })
          });
        } catch {}

        setViewingProposal((prev) => prev ? {
          ...prev,
          adviserRemarks: currentInput,
          adviserFeedback: currentInput,
        } : null);

        setGroupProposals((prev) =>
          prev.map((p) =>
            p.id === viewingProposal.id
              ? { ...p, adviserRemarks: currentInput, adviserFeedback: currentInput }
              : p
          )
        );

        if (viewingProposal.groupId) {
          setProposalsByGroup((prev) => {
            const list = prev[viewingProposal.groupId] || [];
            return {
              ...prev,
              [viewingProposal.groupId]: list.map((p) =>
                p.id === viewingProposal.id
                  ? { ...p, adviserRemarks: currentInput, adviserFeedback: currentInput }
                  : p
              ),
            };
          });
        }

        setIsRemarksSaving(false);
        setRemarksSavedNotice(true);
      } catch (err) {
        console.error("Auto-save remarks error:", err);
        setIsRemarksSaving(false);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [feedbackInput, viewingProposal?.id]);

  // --- LOGIC: MULTI-STEP CREATE GROUP ---
  const handleCreateGroup = async () => {
    if (!selectedLeaderId) return;
    setIsLoading(true);
    try {
      const leader = students.find(s => s.id === selectedLeaderId);
      if (!leader) {
        setIsLoading(false);
        return;
      }

      // Determine the right section: leader's actual section should always take precedence
      let targetSection = (leader.section || "").trim();
      if (!targetSection) {
        try {
          const leaderDoc = await getDoc(doc(db, "users", leader.id));
          if (leaderDoc.exists()) {
            targetSection = (leaderDoc.data().section || "").trim();
          }
        } catch (e) {
          console.error("Failed to fetch leader user doc for section:", e);
        }
      }
      if (!targetSection && activeSection && activeSection !== "ALL") {
        targetSection = activeSection.trim();
      }
      if (!targetSection) {
        targetSection = "Unassigned";
      }

      const docRef = await addDoc(collection(db, "groups"), {
        section: targetSection,
        leaderId: leader.id,
        leaderName: `${leader.firstName} ${leader.lastName}`,
        title: "Pending Business Name",
        memberIds: selectedMemberIds,
        status: 'Drafting',
        createdAt: serverTimestamp()
      });

      const newGroup: GroupData = {
        id: docRef.id,
        leaderId: leader.id,
        leaderName: `${leader.firstName} ${leader.lastName}`,
        title: "Pending Business Name",
        memberIds: selectedMemberIds,
        status: 'Drafting',
        section: targetSection
      };

      setGroups(prev => [...prev, newGroup]);

      // Audit Log
      logAuditEvent({
        userId: adviserUid,
        userName: userName,
        userRole: "Adviser",
        action: "CREATE",
        sectionCode: targetSection,
        description: `Created new team group in section ${targetSection} with leader ${leader.firstName} ${leader.lastName}`,
        recordId: docRef.id,
        newValue: { section: targetSection, leaderName: `${leader.firstName} ${leader.lastName}` }
      });

      // Send Notification to leader and members
      if (leader.id) {
        sendNotification({
          userId: leader.id,
          title: "You are now Team Leader! 🌟",
          message: `You have been designated as the Team Leader for your group in section ${targetSection} by adviser ${userName}.`,
          type: "group",
          link: "/projects",
          senderName: userName
        }).catch(err => console.error("Leader notification failed:", err));
      }

      const otherMembers = selectedMemberIds.filter(id => id && id !== leader.id);
      if (otherMembers.length > 0) {
        sendBatchNotification(otherMembers, {
          title: "Added to Group",
          message: `You have been added to ${leader.firstName}'s group in section ${targetSection} by adviser ${userName}.`,
          type: "group",
          link: "/projects",
          senderName: userName
        }).catch(err => console.error("Members notification failed:", err));
      }

      setShowCreateMembersModal(false);
      setSelectedLeaderId("");
      setSelectedMemberIds([]);
    } catch (error) {
      console.error(error);
      alert("Failed to create group.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportSectionPDF = async (targetSection?: string) => {
    const sectionToExport = targetSection || activeSection || "ALL";
    if (!sectionToExport || sectionToExport === "Unassigned") {
      alert("No valid section selected for export.");
      return;
    }

    setIsExportingPDF(true);
    try {
      const exportData = await fetchSectionExportData(
        sectionToExport,
        adviserSections,
        userName
      );

      if (!exportData || exportData.groups.length === 0) {
        const proceedEmpty = window.confirm(
          `Section "${sectionToExport}" currently has no registered groups. Do you still want to generate the PDF report?`
        );
        if (!proceedEmpty) {
          setIsExportingPDF(false);
          return;
        }
      }

      generateSectionPDF(exportData);

      await logAuditEvent({
        userId: auth.currentUser?.uid || "unknown",
        userName: userName || "Adviser",
        userRole: "Adviser",
        action: "EXPORT_REPORT",
        sectionCode: sectionToExport,
        description: `Exported PDF section report for ${sectionToExport} with ${exportData.groups.length} groups, ${exportData.totalStudents} students, and ${exportData.totalProposals} proposals.`,
        recordId: sectionToExport,
      });
    } catch (error) {
      console.error("Failed to export section PDF:", error);
      alert("Failed to export section PDF. Please check your connection and try again.");
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Save current min/max settings to Firestore for the active section
  const saveSectionSettings = async () => {
    if (!adviserUid || !activeSection) return;
    const updatedMap = { ...sectionSettingsMap, [activeSection]: { minMembers, maxMembers } };
    setSectionSettingsMap(updatedMap);
    try {
      await setDoc(doc(db, "users", adviserUid), { sectionSettings: updatedMap }, { merge: true });
    } catch (error) { console.error("Failed to save section settings:", error); }
  };

  const executeAutoGroup = async (_currentGroupsList: GroupData[]) => {
    setIsLoading(true);
    try {
      // Persist per-section settings before executing
      await saveSectionSettings();

      // 1. Fetch fresh groups from Firestore for the target section(s)
      const targetSections = activeSection === "ALL"
        ? (adviserSections.length > 0 ? adviserSections : [activeSection])
        : [activeSection];

      const querySections = activeSection === "ALL"
        ? Array.from(new Set([...targetSections, "ALL"])).slice(0, 30)
        : [activeSection];
      const groupsQuery = query(collection(db, "groups"), where("section", "in", querySections));
      const freshGroupsSnap = await getDocs(groupsQuery);
      const existingGroups = freshGroupsSnap.docs.map(d => ({ id: d.id, ...d.data() } as GroupData));

      // 2. Identify all students who already belong to ANY existing group (as leader or member)
      const assignedIds = new Set<string>();
      existingGroups.forEach(g => {
        if (g.leaderId) assignedIds.add(g.leaderId);
        if (Array.isArray(g.memberIds)) g.memberIds.forEach(id => { if (id) assignedIds.add(id); });
        if (Array.isArray((g as any).joinedMembers)) (g as any).joinedMembers.forEach((id: string) => { if (id) assignedIds.add(id); });
      });

      // 3. Filter students to ONLY include those who do NOT have a group yet
      const unassignedStudents = students.filter(s => !assignedIds.has(s.id));

      // 4. If no unassigned students exist, show modal and exit
      if (unassignedStudents.length === 0) {
        setShowAutoGroupConfirm(false);
        setShowAllAssignedModal(true);
        setIsLoading(false);
        return;
      }

      // 5. Group unassigned students by their section so no students are mixed across sections
      const unassignedBySection: Record<string, StudentData[]> = {};
      unassignedStudents.forEach(s => {
        const sec = s.section || (activeSection !== "ALL" ? activeSection : "Unassigned");
        if (!unassignedBySection[sec]) unassignedBySection[sec] = [];
        unassignedBySection[sec].push(s);
      });

      // 6. Pre-validation pass: Ensure EVERY section satisfies ceil(N / M) <= floor(N / m)
      // If ANY section fails, fail safely with clear error and do NOT perform any batch writes!
      const sectionPlans: Record<string, { shuffled: StudentData[]; groupSizes: number[] }> = {};
      for (const [sec, secStudents] of Object.entries(unassignedBySection)) {
        const secSettings = sectionSettingsMap[sec];
        const secMin = secSettings?.minMembers ?? minMembers;
        const secMax = secSettings?.maxMembers ?? maxMembers;

        const distResult = calculateGroupDistribution(secStudents.length, secMin, secMax);
        if (!distResult.valid) {
          setShowAutoGroupConfirm(false);
          setIsLoading(false);
          alert(
            distResult.error ||
              `Unable to generate groups for section ${sec}. The current number of students cannot be divided into groups of ${secMin} to ${secMax} members. Please adjust the group size settings.`
          );
          return;
        }

        const shuffled = [...secStudents].sort(() => 0.5 - Math.random());
        sectionPlans[sec] = { shuffled, groupSizes: distResult.groupSizes || [] };
      }

      const batch = writeBatch(db);
      const newGroupsToCreate: GroupData[] = [];

      // 7. For each section, form NEW groups strictly adhering to calculated group sizes
      for (const [sec, plan] of Object.entries(sectionPlans)) {
        let currentIndex = 0;
        for (const groupSize of plan.groupSizes) {
          const chunk = plan.shuffled.slice(currentIndex, currentIndex + groupSize);
          currentIndex += groupSize;

          if (chunk.length === 0) continue;

          const leader = chunk[0];
          const members = chunk.slice(1).map(s => s.id);

          const newGroupRef = doc(collection(db, "groups"));
          const newGroupPayload = {
            section: sec,
            leaderId: leader.id,
            leaderName: `${leader.firstName} ${leader.lastName}`,
            title: "Pending Business Name",
            memberIds: members,
            status: "Drafting",
            createdAt: serverTimestamp(),
          };

          batch.set(newGroupRef, newGroupPayload);
          newGroupsToCreate.push({
            id: newGroupRef.id,
            leaderId: leader.id,
            leaderName: `${leader.firstName} ${leader.lastName}`,
            title: "Pending Business Name",
            memberIds: members,
            status: "Drafting",
            section: sec,
          });
        }
      }

      await batch.commit();
      setGroups(prev => [...prev, ...newGroupsToCreate]);

      // Send notifications to all newly formed groups
      newGroupsToCreate.forEach(ng => {
        if (ng.leaderId) {
          sendNotification({
            userId: ng.leaderId,
            title: "You are now Team Leader! 🌟",
            message: `You have been designated as Team Leader for your group in section ${ng.section} by adviser ${userName}.`,
            type: "group",
            link: "/projects",
            senderName: userName
          }).catch(err => console.error("Auto-group leader notification failed:", err));
        }

        if (ng.memberIds && ng.memberIds.length > 0) {
          sendBatchNotification(ng.memberIds, {
            title: "Added to Group",
            message: `You have been added to ${ng.leaderName}'s group in section ${ng.section} by adviser ${userName}.`,
            type: "group",
            link: "/projects",
            senderName: userName
          }).catch(err => console.error("Auto-group members notification failed:", err));
        }
      });

      setShowAutoGroupConfirm(false);
    } catch (error) {
      console.error("Failed to auto-group:", error);
      alert("Failed to auto-group.");
    } finally {
      setIsLoading(false);
    }
  };

  const executeChangeLeader = async () => {
    if (!groupToChangeLeader || !newLeaderId) return;
    const newLeaderStudent = students.find(s => s.id === newLeaderId);
    if (!newLeaderStudent) return;
    const oldLeaderId = groupToChangeLeader.leaderId;
    let updatedMembers = groupToChangeLeader.memberIds.filter(id => id !== newLeaderId);
    updatedMembers.push(oldLeaderId);

    try {
      await updateDoc(doc(db, "groups", groupToChangeLeader.id), { leaderId: newLeaderId, leaderName: `${newLeaderStudent.firstName} ${newLeaderStudent.lastName}`, memberIds: updatedMembers });
      setGroups(prev => prev.map(g => g.id === groupToChangeLeader.id ? { ...g, leaderId: newLeaderId, leaderName: `${newLeaderStudent.firstName} ${newLeaderStudent.lastName}`, memberIds: updatedMembers } : g));
      if (selectedGroup?.id === groupToChangeLeader.id) {
        setSelectedGroup({ ...selectedGroup, leaderId: newLeaderId, leaderName: `${newLeaderStudent.firstName} ${newLeaderStudent.lastName}`, memberIds: updatedMembers });
      }

      // Send notifications for team leader change
      sendNotification({
        userId: newLeaderId,
        title: "You are now Team Leader! 🌟",
        message: `You have been designated as the new Team Leader for "${groupToChangeLeader.businessName || groupToChangeLeader.title || 'your team'}" by adviser ${userName}.`,
        type: "group",
        link: "/projects",
        senderName: userName
      }).catch(err => console.error("New leader notification failed:", err));

      const otherMembers = Array.from(new Set([oldLeaderId, ...updatedMembers].filter(id => id && id !== newLeaderId)));
      if (otherMembers.length > 0) {
        sendBatchNotification(otherMembers, {
          title: "Team Leader Updated",
          message: `${newLeaderStudent.firstName} ${newLeaderStudent.lastName} is now the Team Leader for your group.`,
          type: "group",
          link: "/projects",
          senderName: userName
        }).catch(err => console.error("Team leader update notification failed:", err));
      }

      setShowChangeLeaderModal(false); setGroupToChangeLeader(null); setNewLeaderId(""); setOpenDropdownId(null);
    } catch (error) { console.error("Failed to change leader:", error); alert("Failed to change the team leader."); }
  };

  const confirmDeleteGroup = async () => {
    if (!groupToDelete) return;
    setIsLoading(true);
    try {
      const secCode = groupToDelete.section || activeSection || "Unassigned";
      await deleteDoc(doc(db, "groups", groupToDelete.id));
      
      logAuditEvent({
        userId: adviserUid,
        userName: userName,
        userRole: "Adviser",
        action: "DELETE",
        sectionCode: secCode,
        description: `Deleted team group "${groupToDelete.title || groupToDelete.businessName || groupToDelete.id}"`,
        recordId: groupToDelete.id,
        oldValue: { title: groupToDelete.title, leaderName: groupToDelete.leaderName }
      });

      setGroups(prev => prev.filter(g => g.id !== groupToDelete.id));
      setGroupToDelete(null); setShowDeleteConfirm(false);
    } catch (error) { console.error(error); alert("Failed to delete."); }
    finally { setIsLoading(false); }
  };

  // --- LOGIC: APPROVE/REJECT/REVISE/REVIEW PROPOSAL ---
  const handleProposalAction = async (
    proposal: ProposalData,
    action: 'Approve' | 'Reject' | 'Revision' | 'Approved' | 'Rejected' | 'Revision Required' | 'Under Review' | 'Submitted' | 'Draft' | 'Save Remarks'
  ) => {
    const targetGroup = selectedGroup || groups.find(g => g.id === proposal.groupId);
    if (!targetGroup || !proposal.id) return;
    setIsSaving(true);
    try {
      let newStatus: ProposalData['status'] = proposal.status;
      if (action === 'Approve' || action === 'Approved') {
        const groupProps = proposalsByGroup[targetGroup.id] || groupProposals || [];
        const existingApproved = groupProps.find(p => (p.status === 'Approved' || (p.status as string) === 'APPROVED') && p.id !== proposal.id);
        if (existingApproved) {
          alert(`Another proposal ("${existingApproved.businessName || 'Untitled'}") is already approved for this group. Only 1 proposal can be approved per group. Please reject or revise the existing approved proposal before approving another.`);
          setIsSaving(false);
          return;
        }
        newStatus = 'Approved';
      }
      else if (action === 'Reject' || action === 'Rejected') newStatus = 'Rejected';
      else if (action === 'Revision' || action === 'Revision Required') newStatus = 'Revision Required';
      else if (action === 'Under Review') newStatus = 'Under Review';
      else if (action === 'Submitted') newStatus = 'Submitted';
      else if (action === 'Draft') newStatus = 'Draft';

      const secCode = targetGroup.section || activeSection || "Unassigned";

      let updatePayload: any = {
        status: newStatus,
        adviserRemarks: feedbackInput.trim(),
        adviserFeedback: feedbackInput.trim(),
        updatedAt: serverTimestamp()
      };

      if (feedbackInput.trim()) {
        const newFeedback: FeedbackItem = {
          id: Date.now().toString(),
          text: feedbackInput.trim(),
          authorName: userName,
          role: "Adviser",
          date: new Date().toISOString()
        };
        updatePayload.feedbackHistory = arrayUnion(newFeedback);
      }

      if (proposal.submittedData) {
        updatePayload["submittedData.status"] = newStatus;
        updatePayload["submittedData.adviserRemarks"] = feedbackInput.trim();
        updatePayload["submittedData.adviserFeedback"] = feedbackInput.trim();
      }

      await updateDoc(doc(db, "proposals", proposal.id), updatePayload);

      // Best effort backend sync for independent status, remarks, and automatic candidate benchmark evaluation
      try {
        const backendUrl = import.meta.env.VITE_API_URL || "http://localhost:10000";
        await fetch(`${backendUrl}/api/proposals/${proposal.id}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: newStatus,
            adviserRemarks: feedbackInput.trim(),
            proposalData: {
              ...proposal,
              status: newStatus,
              adviserRemarks: feedbackInput.trim()
            },
            financialData: proposal.financialData || {},
            aiAnalysis: proposal.aiAnalysis || {},
            adviserAiAnalysis: proposal.adviserAiAnalysis || proposal.aiAnalysis || {}
          })
        });

        // If Approved, also automatically evaluate as an academic benchmark exemplar
        if (newStatus === "Approved") {
          fetch(`${backendUrl}/api/exemplars/evaluate-candidate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              proposal: { ...proposal, status: "Approved" },
              financialData: proposal.financialData || {},
              aiAnalysis: proposal.aiAnalysis || {},
              adviserAiAnalysis: proposal.adviserAiAnalysis || proposal.aiAnalysis || {}
            })
          }).catch((evalErr) =>
            console.warn("Candidate benchmark evaluation non-blocking error:", evalErr)
          );
        }
      } catch (apiErr) {
        // Backend offline or non-blocking
      }

      // Audit Log
      const auditAction = action === 'Approve' || action === 'Approved' ? 'APPROVE' :
                          action === 'Reject' || action === 'Rejected' ? 'REJECT' :
                          action === 'Under Review' ? 'UNDER_REVIEW' :
                          action === 'Save Remarks' ? 'REMARKS_UPDATE' : 'REVISION';
      logAuditEvent({
        userId: adviserUid,
        userName: userName,
        userRole: "Adviser",
        action: auditAction,
        sectionCode: secCode,
        description: `${action} business proposal "${proposal.businessName || targetGroup.title}"`,
        recordId: proposal.id,
        newValue: { status: newStatus, remarks: feedbackInput || null }
      });

      let newGroupStatus = targetGroup.status;
      if (newStatus === 'Approved') {
        newGroupStatus = 'Approved Proposal';
        if (proposal.financialData && !proposal.originalProposalFinancials) {
          updatePayload.originalProposalFinancials = proposal.financialData;
        }
        const groupUpdatePayload: any = {
          status: newGroupStatus,
          businessName: proposal.businessName,
          businessLogo: proposal.businessLogo || "",
          title: proposal.businessName,
          approvedProposalId: proposal.id,
        };
        if (targetGroup.isSetup) {
          groupUpdatePayload.activeProposalId = proposal.id;
        }

        await updateDoc(doc(db, "groups", targetGroup.id), groupUpdatePayload);
        setGroups(prev => prev.map(g => g.id === targetGroup.id ? {
          ...g,
          ...groupUpdatePayload,
        } : g));
        if (selectedGroup && selectedGroup.id === targetGroup.id) {
          setSelectedGroup(prev => prev ? {
            ...prev,
            ...groupUpdatePayload,
          } : null);
        }
      }

      // Update local states for proposals
      setProposalsByGroup(prev => {
        const list = prev[targetGroup.id] || [];
        return {
          ...prev,
          [targetGroup.id]: list.map(p => p.id === proposal.id ? {
            ...p,
            status: newStatus,
            adviserRemarks: feedbackInput.trim(),
            adviserFeedback: feedbackInput.trim()
          } : p)
        };
      });

      setGroupProposals(prev => prev.map(p => p.id === proposal.id ? {
        ...p,
        status: newStatus,
        adviserRemarks: feedbackInput.trim(),
        adviserFeedback: feedbackInput.trim()
      } : p));

      if (viewingProposal && viewingProposal.id === proposal.id) {
        setViewingProposal(prev => prev ? {
          ...prev,
          status: newStatus,
          adviserRemarks: feedbackInput.trim(),
          adviserFeedback: feedbackInput.trim()
        } : null);
      }

      if (selectedGroup && selectedGroup.id === targetGroup.id) {
        await fetchGroupProposals(targetGroup.id);
      }

      // Send Notification to student team
      const studentRecipients = Array.from(new Set([targetGroup.leaderId, ...(targetGroup.memberIds || [])].filter(Boolean)));
      if (studentRecipients.length > 0) {
        let notifTitle = "Proposal Status Updated";
        let notifType: any = "feedback";
        let notifMessage = `Adviser ${userName} updated proposal "${proposal.businessName || targetGroup.title}" to ${newStatus}.`;

        if (newStatus === "Approved") {
          notifTitle = "Proposal Approved! 🎉";
          notifType = "approval";
          notifMessage = `Your business proposal "${proposal.businessName || targetGroup.title}" has been approved by ${userName}. You can now activate your business in the Business Proposal section.`;
        } else if (newStatus === "Revision Required") {
          notifTitle = "Proposal Revision Requested";
          notifType = "feedback";
          notifMessage = `Adviser ${userName} requested revisions for "${proposal.businessName || targetGroup.title}". Remarks: ${feedbackInput.trim() || 'Please check feedback.'}`;
        } else if (newStatus === "Rejected") {
          notifTitle = "Proposal Rejected";
          notifType = "feedback";
          notifMessage = `Proposal "${proposal.businessName || targetGroup.title}" was not approved by ${userName}. Remarks: ${feedbackInput.trim() || 'Please check feedback.'}`;
        } else if (action === 'Save Remarks') {
          notifTitle = "New Adviser Remarks 💬";
          notifType = "feedback";
          notifMessage = `Adviser ${userName} posted review remarks on proposal "${proposal.businessName || targetGroup.title}": "${feedbackInput.trim()}"`;
        }

        sendBatchNotification(studentRecipients, {
          title: notifTitle,
          message: notifMessage,
          type: notifType,
          link: "/projects",
          senderName: userName
        }).catch(err => console.error("Proposal notification failed:", err));
      }

      if (action !== 'Save Remarks') {
        setViewingProposal(null);
      }
    } catch (error) {
      console.error("Action failed:", error);
      alert("Failed to update proposal status.");
    } finally {
      setIsSaving(false);
    }
  };

  // --- LOGIC: SUBMIT FEEDBACK HISTORY (IDEMPOTENT & DEDUPLICATED) ---
  const handleSubmitFeedback = async () => {
    if (isSubmittingFeedbackRef.current || isSaving) return;
    const cleanText = feedbackInput.trim();
    const scoreText = adviserScoreInput.trim();
    if ((!cleanText && !scoreText) || !activeProposal?.id) return;

    let numScore: number | undefined = undefined;
    if (scoreText) {
      numScore = Number(scoreText);
      if (isNaN(numScore) || numScore < 0 || numScore > 100) {
        alert("Please enter a valid score between 0 and 100.");
        return;
      }
    }

    isSubmittingFeedbackRef.current = true;
    setIsSaving(true);

    const idempotencyKey = `fb_${activeProposal.id}_${Date.now()}`;
    const newFeedback: FeedbackItem = {
      id: idempotencyKey,
      text: cleanText,
      authorName: userName,
      role: "Adviser",
      date: new Date().toISOString(),
      score: scoreText ? numScore : undefined,
    };

    try {
      // 1. Idempotent backend sync with duplicate suppression
      const backendUrl = import.meta.env.VITE_API_URL || "http://localhost:10000";
      let resolvedFeedback = newFeedback;
      try {
        const resp = await fetch(`${backendUrl}/api/proposals/${activeProposal.id}/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: cleanText,
            authorName: userName,
            role: "Adviser",
            score: scoreText ? numScore : undefined,
            idempotencyKey,
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.feedback) resolvedFeedback = data.feedback;
          if (data.duplicateDetected) {
            setFeedbackInput("");
            setAdviserScoreInput("");
            return;
          }
        }
      } catch (apiErr) {
        // Backend offline or non-blocking, continue with Firestore direct update
      }

      // 2. Direct Firestore update
      const proposalUpdates: any = {
        feedbackHistory: arrayUnion(resolvedFeedback),
        adviserFeedback: cleanText || activeProposal.adviserFeedback || "",
        adviserRemarks: cleanText || activeProposal.adviserRemarks || "",
        updatedAt: serverTimestamp(),
      };
      if (scoreText && numScore !== undefined) {
        proposalUpdates.adviserScore = numScore;
      }
      await updateDoc(doc(db, "proposals", activeProposal.id), proposalUpdates);

      // If activeProposal.groupId, update Firestore groups/{activeProposal.groupId}
      if (activeProposal.groupId) {
        const groupUpdates: any = {
          updatedAt: serverTimestamp(),
          adviserRemarks: cleanText || "",
        };
        if (scoreText && numScore !== undefined) {
          groupUpdates.adviserScore = numScore;
        }
        await updateDoc(doc(db, "groups", activeProposal.groupId), groupUpdates).catch((err) => {
          console.warn("Could not sync adviserScore/remarks to group doc:", err);
        });
      }

      // Send notification to group members
      const targetGroup = groups.find(g => g.id === activeProposal.groupId);
      if (targetGroup) {
        const studentRecipients = Array.from(new Set([targetGroup.leaderId, ...(targetGroup.memberIds || [])].filter(Boolean)));
        if (studentRecipients.length > 0) {
          const notifTitle = scoreText ? "Business Evaluation & Score" : "New Adviser Feedback";
          const notifMessage = scoreText
            ? `${userName} evaluated your active business with a score of ${numScore}/100 and remarks: "${cleanText || 'No remarks'}"`
            : `${userName} left new feedback on "${activeProposal.businessName}": "${cleanText}"`;

          sendBatchNotification(studentRecipients, {
            title: notifTitle,
            message: notifMessage,
            type: "feedback",
            link: "/projects",
            senderName: userName
          }).catch(err => console.error("Feedback notification failed:", err));
        }
      }

      setActiveProposal(prev => {
        if (!prev) return null;
        const currentList = prev.feedbackHistory || [];
        const alreadyExists = currentList.some(
          item => item.id === resolvedFeedback.id ||
            (item.text === resolvedFeedback.text && item.authorName === resolvedFeedback.authorName &&
              Math.abs(new Date(item.date).getTime() - new Date(resolvedFeedback.date).getTime()) < 10000)
        );
        return {
          ...prev,
          feedbackHistory: alreadyExists ? currentList : [...currentList, resolvedFeedback],
          adviserFeedback: cleanText || prev.adviserFeedback || "",
          adviserRemarks: cleanText || prev.adviserRemarks || "",
          adviserScore: scoreText && numScore !== undefined ? numScore : prev?.adviserScore,
        };
      });

      setSelectedGroup(prev => {
        if (!prev) return null;
        if (prev.id !== activeProposal.groupId) return prev;
        return {
          ...prev,
          adviserScore: scoreText && numScore !== undefined ? numScore : prev.adviserScore,
          adviserRemarks: cleanText || prev.adviserRemarks,
        };
      });

      setGroups(prev => prev.map(g => {
        if (g.id !== activeProposal.groupId) return g;
        return {
          ...g,
          adviserScore: scoreText && numScore !== undefined ? numScore : g.adviserScore,
          adviserRemarks: cleanText || g.adviserRemarks,
        };
      }));

      setFeedbackInput("");
      setAdviserScoreInput("");
    } catch (error) {
      console.error("Failed to submit feedback:", error);
      alert("Failed to submit feedback.");
    } finally {
      setIsSaving(false);
      setTimeout(() => {
        isSubmittingFeedbackRef.current = false;
      }, 500);
    }
  };

  // FIXED Metrics Calculations: Guaranteed to never be negative by filtering actual students.
  const assignedIds = new Set<string>();
  groups.forEach(g => {
    if (g.leaderId) assignedIds.add(g.leaderId);
    if (Array.isArray(g.memberIds)) g.memberIds.forEach(id => assignedIds.add(id));
  });

  const sortSectionNames = (a: string, b: string) =>
    (a || "").localeCompare(b || "", undefined, { numeric: true, sensitivity: "base" });

  const groupStudentsBySection = (studentList: StudentData[]) => {
    const map: Record<string, StudentData[]> = {};
    studentList.forEach((s) => {
      const sec = (s.section || "Unassigned").trim();
      if (!map[sec]) map[sec] = [];
      map[sec].push(s);
    });
    const sortedSectionKeys = Object.keys(map).sort(sortSectionNames);
    sortedSectionKeys.forEach((sec) => {
      map[sec].sort((a, b) =>
        `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
      );
    });
    return { map, sortedSectionKeys };
  };

  const groupCardsBySection = (groupsList: GroupData[]) => {
    const map: Record<string, GroupData[]> = {};
    groupsList.forEach((g) => {
      let sec = (g.section || "").trim();
      if (!sec || sec.toUpperCase() === "ALL") {
        const studentLeader = students.find(s => s.id === g.leaderId);
        sec = (studentLeader?.section || "").trim() || sec || "Unassigned";
      }
      if (!map[sec]) map[sec] = [];
      map[sec].push(g);
    });
    const sortedSectionKeys = Object.keys(map).sort(sortSectionNames);
    return { map, sortedSectionKeys };
  };

  const filteredStudents = students.filter(s => `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) || s.studentId.includes(searchTerm) || (s.section || "").toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredGroups = activeDashboardTab === 'All Groups' ? groups : groups.filter(g => g.status === activeDashboardTab);

  // This physically counts how many fetched students do not exist inside the assigned Set
  const unassignedCount = students.filter(s => !assignedIds.has(s.id)).length;

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[50] lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      {/* ADVISER SIDEBAR */}
      <aside
        className={`flex flex-col fixed inset-y-0 z-[60] bg-[#122244] text-white shadow-xl transition-[width,transform] duration-300 ease-in-out group overflow-x-hidden ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
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

        {/* SIDEBAR NAVIGATION */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {/* Main Sections / Dashboard */}
          <button
            onClick={() => {
              setIsSidebarOpen(false);
              setActiveView('dashboard');
              setActiveSection("ALL");
              setupSectionListener("ALL");
            }}
            title={activeSection === "ALL" ? "My Sections" : `Section: ${activeSection}`}
            className={`w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeSection === "ALL" && activeView === 'dashboard'
                ? "bg-[#c9a654] text-[#122244] shadow-md"
                : activeView === 'dashboard'
                  ? "bg-[#c9a654] text-[#122244] shadow-md lg:group-hover:bg-transparent lg:group-hover:text-gray-200 lg:group-hover:shadow-none hover:bg-white/10"
                  : "text-gray-200 hover:text-white hover:bg-white/10 group"
            }`}
          >
            <Users
              className={`w-5 h-5 shrink-0 ${
                activeSection === "ALL" && activeView === 'dashboard'
                  ? "text-[#122244]"
                  : activeView === 'dashboard'
                    ? "text-[#122244] lg:group-hover:text-[#c9a654]"
                    : "text-[#c9a654] group-hover:text-[#f0c242]"
              } transition-colors`}
            />
            <div className="flex-1 flex items-center justify-between opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate">
              <span className="truncate whitespace-nowrap">My Sections</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ml-1 shrink-0 ${
                  activeSection === "ALL" && activeView === 'dashboard'
                    ? "bg-black/15 text-[#122244]"
                    : "bg-white/20 text-white"
                }`}
              >
                All
              </span>
            </div>
          </button>

          {/* Sub-sections (visible when hovered on desktop or on mobile, completely hidden when folded on desktop with zero space) */}
          {adviserSections.length > 0 && (
            <div className="block lg:hidden lg:group-hover:block pt-1 pb-1 space-y-1 transition-all duration-200">
              <div className="pl-2 pr-1 py-1 space-y-1 border-l-2 border-white/10 ml-4">
                {adviserSections.map((sectionName) => (
                  <button
                    key={sectionName}
                    onClick={() => {
                      setIsSidebarOpen(false);
                      setActiveView('dashboard');
                      setActiveSection(sectionName);
                      const s = sectionSettingsMap[sectionName];
                      setMinMembers(s?.minMembers ?? 8);
                      setMaxMembers(s?.maxMembers ?? 10);
                      setupSectionListener(sectionName);
                    }}
                    className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg transition-all truncate block ${
                      activeSection === sectionName && activeView === 'dashboard'
                        ? "bg-[#c9a654] text-[#122244] font-bold shadow-xs"
                        : "text-gray-300 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {sectionName}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Settings button */}
          <button
            onClick={() => { setIsSidebarOpen(false); navigate("/adviser/settings"); }}
            title="Settings"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-200 hover:text-white hover:bg-white/10 transition-colors group"
          >
            <Settings className="w-5 h-5 shrink-0 text-[#c9a654] group-hover:text-[#f0c242] transition-colors" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              Settings
            </span>
          </button>

          {/* AI Rules button */}
          <button
            onClick={() => { setIsSidebarOpen(false); navigate("/adviser/airules"); }}
            title="AI Rules"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-200 hover:text-white hover:bg-white/10 transition-colors group"
          >
            <Cpu className="w-5 h-5 shrink-0 text-[#c9a654] group-hover:text-[#f0c242] transition-colors" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              AI Rules
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

      {/* MAIN CONTENT AREA */}
      <main
        className="flex-1 transition-all duration-300 ease-in-out min-h-screen lg:ml-16 ml-0"
      >
        <div className="bg-white border-b border-gray-100 shadow-[0_3px_10px_rgba(0,0,0,0.06)] px-4 sm:px-6 py-3 flex items-center justify-between text-sm text-gray-500 sticky top-0 z-30">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <MobileBurgerButton onClick={() => setIsSidebarOpen(!isSidebarOpen)} />
            <span
              className="font-semibold text-gray-900 hover:text-[#c9a654] cursor-pointer transition-colors shrink-0"
              onClick={() => {
                setActiveView('dashboard');
                navigate('/adviser/dashboard');
              }}
            >
              FeasiFy
            </span>
            <span className="text-gray-400 shrink-0">›</span>
            <span
              className={`font-semibold truncate ${activeView === 'dashboard' ? 'text-gray-900' : 'text-gray-500 hover:text-[#c9a654] cursor-pointer transition-colors'}`}
              onClick={() => setActiveView('dashboard')}
            >
              My Sections
            </span>

            {(activeView === 'group-details' || activeView === 'active-business') && selectedGroup && (
              <>
                <span className="text-gray-400 shrink-0">›</span>
                <span className="font-semibold text-[#c9a654] truncate">Group {groups.findIndex(g => g.id === selectedGroup.id) + 1}</span>
              </>
            )}
            <span className="text-gray-300 hidden sm:inline shrink-0">|</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#122244] text-white shadow-xs tracking-wide whitespace-nowrap hidden sm:inline-block shrink-0">
              Faculty Portal
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/adviser/notifications")}
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
              onClick={() => navigate("/adviser/settings")}
              className="flex items-center gap-3 cursor-pointer hover:opacity-85 transition-opacity"
            >
              <div className="w-9 h-9 rounded-full bg-[#c9a654] text-white flex items-center justify-center font-bold text-sm shadow-xs flex-shrink-0">
                {getInitials(userName)}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-gray-900 leading-tight">
                  {userName || "Adviser"}
                </p>
                <p className="text-[10px] text-gray-400 font-medium">Feasibility Adviser</p>
              </div>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------------------------------------------- */}
        {/* VIEW 1: DASHBOARD                                                                                 */}
        {/* ------------------------------------------------------------------------------------------------- */}
        {activeView === 'dashboard' && (
          <div className="p-6 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-300">

            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 pb-6">
              <div>
                <h1 className="text-3xl font-extrabold text-[#122244]">
                  {activeSection === "ALL" ? "My Sections" : activeSection}
                </h1>
                <p className="text-sm text-gray-500 mt-1 italic">
                  {activeSection === "ALL"
                    ? "Manage all feasibility groups and team leaders across all your assigned sections."
                    : `Manage feasibility groups and team leaders for section ${activeSection}.`}
                </p>
              </div>

              {/* === REORDERED TOP BUTTONS === */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleExportSectionPDF(activeSection)}
                  disabled={isExportingPDF}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-[#122244] font-semibold text-sm rounded-lg hover:bg-gray-50 transition-colors bg-white shadow-sm disabled:opacity-50"
                  title={`Export ${activeSection === "ALL" ? "all sections" : `section ${activeSection}`} to PDF`}
                >
                  {isExportingPDF ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#c9a654]" />
                  ) : (
                    <Download className="w-4 h-4 text-[#c9a654]" />
                  )}
                  <span>{isExportingPDF ? "Exporting..." : "Export Section PDF"}</span>
                </button>
                <button onClick={() => setShowAllStudentsModal(true)} className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 font-semibold text-sm rounded-lg hover:bg-gray-50 transition-colors bg-white shadow-sm"><Users className="w-4 h-4" /> View All Students</button>
                <button onClick={() => setShowAutoGroupConfirm(true)} className="flex items-center gap-2 px-4 py-2 bg-[#122244] text-white font-semibold text-sm rounded-lg hover:bg-[#0a142e] transition-colors shadow-md"><Archive className="w-4 h-4" /> Auto-Group</button>
                <button onClick={() => { setShowCreateLeaderModal(true); setSelectedLeaderId(""); setSelectedMemberIds([]); }} className="flex items-center gap-2 px-4 py-2 bg-[#d4af37] text-white font-semibold text-sm rounded-lg hover:bg-[#c19b28] transition-colors shadow-md"><UserPlus className="w-4 h-4" /> Create Group</button>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm flex justify-between items-center">
                    <div className="w-2/3">
                      <Skeleton width="60%" height={12} className="mb-2" />
                      <Skeleton width="40%" height={32} />
                    </div>
                    <Skeleton circle width={40} height={40} />
                  </div>
                ))
              ) : (
                <>
                  <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm border-l-4 border-l-[#4285F4] flex justify-between items-center">
                    <div><p className="text-xs font-semibold text-gray-500 mb-1">Total Students</p><p className="text-3xl font-bold text-[#122244]">{students.length}</p></div>
                    <div className="bg-blue-50 p-2 rounded-lg"><Users className="w-5 h-5 text-[#4285F4]" /></div>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm border-l-4 border-l-[#d4af37] flex justify-between items-center">
                    <div><p className="text-xs font-semibold text-gray-500 mb-1">Total Groups</p><p className="text-3xl font-bold text-[#122244]">{groups.length}</p></div>
                    <div className="bg-yellow-50 p-2 rounded-lg"><Archive className="w-5 h-5 text-[#d4af37]" /></div>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm border-l-4 border-l-[#34A853] flex justify-between items-center">
                    <div><p className="text-xs font-semibold text-gray-500 mb-1">Leaders Assigned</p><p className="text-3xl font-bold text-[#122244]">{groups.length}</p></div>
                    <div className="bg-green-50 p-2 rounded-lg"><CheckCircle2 className="w-5 h-5 text-[#34A853]" /></div>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm border-l-4 border-l-[#EA4335] flex justify-between items-center">
                    <div><p className="text-xs font-semibold text-gray-500 mb-1">Students Unassigned</p><p className="text-3xl font-bold text-[#EA4335]">{unassignedCount}</p></div>
                    <div className="bg-red-50 p-2 rounded-lg"><AlertCircle className="w-5 h-5 text-[#EA4335]" /></div>
                  </div>
                </>
              )}
            </div>

            {/* Tabs Row (Filter Pills with High Contrast & Gold Dot) */}
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 border-b border-gray-200 pb-2">
              <div className="flex space-x-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 custom-scrollbar" role="tablist">
                {['All Groups', 'Pending Review', 'Approved Proposal', 'Drafting', 'Active Business'].map(tab => {
                  const isActive = activeDashboardTab === tab;
                  return (
                    <button
                      key={tab}
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveDashboardTab(tab as any)}
                      className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 flex items-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#122244] focus:ring-offset-2 ${
                        isActive
                          ? 'bg-[#122244] text-white shadow-md border border-[#122244]'
                          : 'bg-gray-100/90 text-gray-700 hover:bg-gray-200 hover:text-gray-900 border border-transparent'
                      }`}
                    >
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#c9a654] inline-block shrink-0 shadow-xs" aria-hidden="true" />
                      )}
                      {tab}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Groups Grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: sectionGroupCountMap[activeSection] ?? 3 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col min-h-[380px] overflow-hidden">
                    {/* Card header */}
                    <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                      <Skeleton width={70} height={16} />
                      <div className="flex gap-2">
                        <Skeleton width={50} height={24} borderRadius={999} />
                        <Skeleton width={24} height={24} borderRadius={999} />
                      </div>
                    </div>
                    {/* Avatar + name */}
                    <div className="p-4 flex flex-col items-center border-b border-gray-100">
                      <Skeleton circle width={64} height={64} className="mb-3" />
                      <Skeleton width={120} height={16} className="mb-1" />
                      <Skeleton width={80} height={12} />
                    </div>
                    {/* Members list */}
                    <div className="p-4 flex-1 space-y-2">
                      {Array.from({ length: 4 }).map((_, j) => (
                        <div key={j} className="flex items-center gap-2">
                          <Skeleton circle width={28} height={28} />
                          <Skeleton width={100} height={12} />
                        </div>
                      ))}
                    </div>
                    {/* Footer buttons */}
                    <div className="p-4 border-t border-gray-100 flex gap-2">
                      <Skeleton height={36} borderRadius={8} className="flex-1" />
                      <Skeleton height={36} borderRadius={8} className="flex-1" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 py-16 flex flex-col items-center justify-center text-center">
                <Users className="w-12 h-12 text-gray-300 mb-3" />
                <h3 className="text-lg font-bold text-gray-900">No Groups Found</h3>
              </div>
            ) : (() => {
              const renderGroupCard = (group: GroupData) => {
                const totalMembers = group.memberIds.length + 1;
                const originalIndex = groups.findIndex(g => g.id === group.id) + 1;
                const teamProps = (proposalsByGroup[group.id] || []).filter(isProposalSubmitted).map(getAdviserVisibleProposal);
                const proposalCount = teamProps.length;

                let statusBadgeColor = "bg-gray-100 text-gray-600"; let statusDotColor = "bg-gray-400";
                if (group.status === 'Pending Review') { statusBadgeColor = "bg-yellow-100 text-yellow-700"; statusDotColor = "bg-yellow-500"; }
                if (group.status === 'Approved Proposal') { statusBadgeColor = "bg-green-100 text-green-700"; statusDotColor = "bg-green-500"; }
                if (group.status === 'Active Business') { statusBadgeColor = "bg-blue-100 text-blue-700"; statusDotColor = "bg-blue-500"; }

                const teamDisplayName = group.companyName || group.title || `Group ${originalIndex}`;

                const isActivated = (group.status === 'Active Business' || Boolean(group.activeProposalId)) && Boolean(
                  (group.activeProposalId && teamProps.some(p => p.id === group.activeProposalId)) ||
                  teamProps.some(p => p.status === 'Approved') ||
                  teamProps.length > 0
                );
                const reportReady = isActivated && isReportSubmitted(group, teamProps);

                const activatedProp = isActivated
                  ? ((group.activeProposalId ? teamProps.find(p => p.id === group.activeProposalId) : null)
                      || teamProps.find(p => p.status === 'Approved')
                      || teamProps[0])
                  : null;

                const hasNewSubmission = teamProps.some(p => p.status === 'Submitted' || p.status === 'Pending' || (p.id && highlightedProposalIds.includes(p.id)));

                return (
                  <div
                    key={group.id}
                    id={`group-card-${group.id}`}
                    className={`bg-white rounded-2xl border shadow-sm flex flex-col justify-between relative hover:shadow-md transition-all overflow-hidden h-full ${
                      hasNewSubmission && !isActivated
                        ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-md'
                        : 'border-gray-200'
                    }`}
                  >
                    {/* CARD HEADER: TEAM NAME & PROPOSALS COUNTER */}
                    <div className="p-4 border-b border-gray-100 flex flex-col bg-gray-50/70 gap-2.5">
                      {/* Primary Row: Avatar, Team Name & Tags, Kebab Menu */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-11 h-11 rounded-xl bg-white border border-gray-200 shadow-xs flex items-center justify-center overflow-hidden flex-shrink-0">
                            {group.companyLogo ? (
                              <img src={group.companyLogo} alt="Team Logo" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-[#122244] text-white flex items-center justify-center font-bold text-xs tracking-wider">
                                {getInitials(teamDisplayName)}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-extrabold text-[#122244] text-sm truncate" title={teamDisplayName}>
                              {teamDisplayName}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-[10px] font-bold text-gray-500 bg-gray-200/60 px-1.5 py-0.5 rounded whitespace-nowrap">
                                Group {originalIndex}
                              </span>
                              {activeSection === "ALL" && (
                                <span className="px-1.5 py-0.5 bg-blue-50 border border-blue-200 text-[#4285F4] text-[9px] font-extrabold rounded uppercase tracking-wider whitespace-nowrap">
                                  {group.section}
                                </span>
                              )}
                              {hasNewSubmission && !isActivated && (
                                <span className="px-2 py-0.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[10px] font-black rounded-full shadow-xs flex items-center gap-1 animate-pulse whitespace-nowrap">
                                  <Sparkles className="w-3 h-3" /> New Submission
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="relative flex-shrink-0">
                          <button onClick={() => setOpenDropdownId(openDropdownId === group.id ? null : (group.id || null))} className="p-1 text-gray-400 hover:text-gray-800 rounded-md hover:bg-gray-200 transition-colors">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {openDropdownId === group.id && (
                            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-lg shadow-xl z-10 py-1">
                              {isActivated && (
                                <button onClick={() => { handleOpenGroupDetails(group); setOpenDropdownId(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                                  <Users className="w-4 h-4" /> Group Details & History
                                </button>
                              )}
                              <button onClick={() => { setGroupToChangeLeader(group); setShowChangeLeaderModal(true); setOpenDropdownId(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"><Edit2 className="w-4 h-4" /> Change Leader</button>
                              <button onClick={() => { setGroupToDelete(group); setShowDeleteConfirm(true); setOpenDropdownId(null); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"><Trash2 className="w-4 h-4" /> Delete Group</button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Status Sub-row: Dedicated space for Proposals Counter or Active Business */}
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        {isActivated ? (
                          reportReady ? (
                            <span className="px-2.5 py-1 text-xs font-black rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1 whitespace-nowrap">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Active Business (Report Submitted)
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 text-xs font-black rounded-full border bg-amber-50 text-amber-800 border-amber-200 flex items-center gap-1 whitespace-nowrap">
                              <Clock className="w-3.5 h-3.5 text-amber-600" /> Report In Progress
                            </span>
                          )
                        ) : (
                          <span className={`px-2.5 py-1 text-xs font-black rounded-full border whitespace-nowrap ${proposalCount >= 3 ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-blue-50 text-blue-800 border-blue-200'}`}>
                            Proposals: {proposalCount} / 3
                          </span>
                        )}
                      </div>
                    </div>

                    {/* CARD BODY */}
                    <div className="p-4 flex-1 flex flex-col space-y-3">
                      {/* Max reached notification (only for non-activated groups) */}
                      {!isActivated && proposalCount >= 3 && (
                        <div className="px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-1.5 text-[11px] text-amber-800 font-bold">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> Maximum of 3 proposals reached.
                        </div>
                      )}

                      {/* Team Leader & Members brief */}
                      <div className="flex items-center justify-between text-xs text-gray-600 bg-gray-50/80 p-2.5 rounded-xl border border-gray-200/70">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-6 h-6 rounded-full text-white flex items-center justify-center font-bold text-[10px] flex-shrink-0 ${group.status === 'Approved Proposal' || group.status === 'Active Business' ? 'bg-[#ff7f50]' : 'bg-[#122244]'}`}>{getInitials(group.leaderName)}</div>
                          <span className="truncate font-semibold text-gray-800 text-[11px]">{group.leaderName} (Leader)</span>
                        </div>
                        <span className="px-2 py-0.5 bg-white border border-gray-200 text-gray-600 text-[10px] font-bold rounded-full flex-shrink-0">{totalMembers} members</span>
                      </div>

                      {/* Proposals Section: ALWAYS show all proposals, highlight ONLY the active one in green */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider">
                          <span className="text-gray-500">Team Proposals</span>
                          <span className="text-gray-400 font-semibold">{proposalCount} of 3 created</span>
                        </div>

                        {[1, 2, 3].map(slotNum => {
                          const prop = teamProps.find(p => p.proposalNumber === slotNum) || (!teamProps.some(p => p.proposalNumber) ? teamProps[slotNum - 1] : undefined);
                          if (prop) {
                            const isThisPropActive = Boolean(
                              (group.activeProposalId && prop.id === group.activeProposalId) ||
                              (isActivated && activatedProp && prop.id === activatedProp.id) ||
                              (isActivated && prop.status === 'Approved')
                            );

                            const isNewSubmission = (prop.status === 'Submitted' || prop.status === 'Pending' || (prop.id && highlightedProposalIds.includes(prop.id))) && !isThisPropActive;

                            return (
                              <div
                                key={prop.id || slotNum}
                                className={`p-3 rounded-xl border transition-all ${
                                  isThisPropActive
                                    ? 'bg-emerald-50/80 border-emerald-400 ring-1 ring-emerald-500/30'
                                    : isNewSubmission
                                    ? 'bg-gradient-to-r from-amber-50/90 to-yellow-50/80 border-amber-300 ring-2 ring-amber-400/50 shadow-xs'
                                    : 'bg-gray-50/90 border-gray-200 hover:border-blue-300'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2 mb-1.5">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                      <span
                                        className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                          isThisPropActive
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : isNewSubmission
                                            ? 'bg-amber-100 text-amber-900'
                                            : 'bg-blue-100 text-blue-800'
                                        }`}
                                      >
                                        Proposal {slotNum}
                                      </span>
                                      {isThisPropActive ? (
                                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md flex items-center gap-1 border border-emerald-200">
                                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active Business
                                        </span>
                                      ) : (
                                        getProposalStatusBadge(prop.status)
                                      )}
                                      {isNewSubmission && (
                                        <span className="px-2 py-0.5 bg-amber-500 text-white text-[9px] font-black uppercase tracking-wider rounded-md flex items-center gap-1 shadow-2xs animate-pulse">
                                          <Sparkles className="w-2.5 h-2.5" /> NEW
                                        </span>
                                      )}
                                      {prop.businessType && (
                                        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 text-[10px] font-semibold rounded">
                                          {prop.businessType}
                                        </span>
                                      )}
                                    </div>
                                    <h4 className="text-xs font-bold text-[#122244] truncate" title={prop.businessName || `Proposal ${slotNum}`}>
                                      {prop.businessName || "Untitled Proposal"}
                                    </h4>
                                    <p className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-gray-400 flex-shrink-0" /> Submitted: {formatProposalDate(prop)}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => handleOpenProposalModal(prop, group)}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex-shrink-0 shadow-xs flex items-center gap-1 cursor-pointer ${
                                      isThisPropActive
                                        ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                                        : isNewSubmission
                                        ? 'bg-amber-500 hover:bg-amber-600 text-[#122244] font-black'
                                        : 'bg-[#122244] hover:bg-[#1f376b] text-white'
                                    }`}
                                    title={`Open Proposal ${slotNum}`}
                                  >
                                    <FileText className="w-3.5 h-3.5" /> Open
                                  </button>
                                </div>
                                <div className={`pt-2 border-t text-[11px] flex items-start gap-1 ${isThisPropActive ? 'border-emerald-200/70' : isNewSubmission ? 'border-amber-200/80' : 'border-gray-200/80'}`}>
                                  <span className="font-bold text-gray-600 flex-shrink-0">Remarks:</span>
                                  <span
                                    className={`line-clamp-2 ${prop.adviserRemarks || prop.adviserFeedback ? "text-gray-800 font-medium italic" : "text-gray-400 italic"}`}
                                    title={prop.adviserRemarks || prop.adviserFeedback || "No remarks yet"}
                                  >
                                    {prop.adviserRemarks || prop.adviserFeedback || "No remarks yet"}
                                  </span>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div key={slotNum} className="p-2.5 bg-gray-50/40 rounded-xl border border-dashed border-gray-200 flex items-center justify-between text-xs text-gray-400">
                              <span className="font-semibold text-[11px] text-gray-400">Proposal {slotNum}</span>
                              <span className="text-[10px] italic">Slot available (Not created)</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* CARD FOOTER */}
                    <div className="mt-auto p-3 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl flex gap-2">
                      {isActivated ? (
                        reportReady ? (
                          <button
                            onClick={() => handleOpenActiveBusiness(group)}
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors shadow-xs flex justify-center items-center gap-1.5 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-white" /> View Active Business Details
                          </button>
                        ) : (
                          <button
                            onClick={() => setAwaitingReportGroup(group)}
                            className="w-full py-2 bg-gray-50 border border-gray-200 text-gray-500 font-bold text-xs rounded-lg hover:bg-gray-100 transition-colors shadow-xs flex justify-center items-center gap-1.5 cursor-pointer"
                            title="Report submission pending by student team"
                          >
                            <Lock className="w-3.5 h-3.5 text-gray-400" /> Awaiting Student Report
                          </button>
                        )
                      ) : (
                        <button
                          onClick={() => handleOpenGroupDetails(group)}
                          className="w-full py-2 bg-white border border-gray-200 text-gray-700 font-bold text-xs rounded-lg hover:bg-gray-50 transition-colors shadow-xs flex justify-center items-center gap-1.5 cursor-pointer"
                        >
                          <Users className="w-3.5 h-3.5" /> View Group Details & History
                        </button>
                      )}
                    </div>
                  </div>
                );
              };

              if (activeSection === "ALL") {
                const { map: secGroupMap, sortedSectionKeys: secGroupKeys } = groupCardsBySection(filteredGroups);
                return (
                  <div className="space-y-10">
                    {secGroupKeys.map(secName => {
                      const secGroups = secGroupMap[secName] || [];
                      if (secGroups.length === 0) return null;
                      return (
                        <div key={secName} className="space-y-4">
                          <div className="flex items-center gap-3 border-b-2 border-gray-200/80 pb-2.5">
                            <h2 className="text-xl font-black text-[#122244] uppercase tracking-wider flex items-center gap-2.5">
                              <span className="w-3.5 h-3.5 rounded-full bg-[#c9a654]"></span>
                              Section: {secName}
                            </h2>
                            <span className="px-3 py-0.5 bg-blue-50 text-[#4285F4] text-xs font-black rounded-full border border-blue-200">
                              {secGroups.length} {secGroups.length === 1 ? "Group" : "Groups"}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {secGroups.map(group => renderGroupCard(group))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredGroups.map(group => renderGroupCard(group))}
                </div>
              );
            })()}
          </div>
        )}

        {/* ------------------------------------------------------------------------------------------------- */}
        {/* VIEW 2: GROUP DETAILS (PROPOSALS & MEMBERS)                                                       */}
        {/* ------------------------------------------------------------------------------------------------- */}
        {activeView === 'group-details' && selectedGroup && (
          <div className="p-6 md:p-8 max-w-5xl mx-auto animate-in fade-in duration-300">
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                <button onClick={() => setActiveView('dashboard')} className="flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-gray-900 border border-gray-200 px-3 py-1.5 rounded-lg bg-white shadow-sm"><ChevronLeft className="w-4 h-4" /> Back</button>
                <span className="px-3 py-1 bg-blue-50 text-[#4285F4] text-xs font-bold rounded-md uppercase tracking-wider">GROUP {groups.findIndex(g => g.id === selectedGroup.id) + 1}</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-3xl font-extrabold text-[#122244]">Business Proposals</h1>
                  <p className="text-sm text-gray-500 mt-1">{selectedGroup.memberIds.length + 1} members · {groupProposals.length} proposals created</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1.5 text-xs font-black rounded-full border ${groupProposals.length >= 3 ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-blue-50 text-blue-800 border-blue-200'}`}>
                    Proposals: {groupProposals.length} / 3
                  </span>
                  {groupProposals.length >= 3 && (
                    <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-lg">
                      Maximum of 3 proposals reached.
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex border-b border-gray-200 mb-6 gap-2" role="tablist">
              <button
                role="tab"
                aria-selected={activeDetailTab === 'Proposals'}
                onClick={() => setActiveDetailTab('Proposals')}
                className={`pb-2.5 px-4 text-xs font-bold transition-all rounded-t-lg flex items-center gap-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#122244] ${
                  activeDetailTab === 'Proposals'
                    ? 'border-b-2 border-[#122244] text-[#122244] bg-white font-extrabold shadow-xs'
                    : 'border-b-2 border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                {activeDetailTab === 'Proposals' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#c9a654]" />
                )}
                Proposals
              </button>
              <button
                role="tab"
                aria-selected={activeDetailTab === 'Members'}
                onClick={() => setActiveDetailTab('Members')}
                className={`pb-2.5 px-4 text-xs font-bold transition-all rounded-t-lg flex items-center gap-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#122244] ${
                  activeDetailTab === 'Members'
                    ? 'border-b-2 border-[#122244] text-[#122244] bg-white font-extrabold shadow-xs'
                    : 'border-b-2 border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                {activeDetailTab === 'Members' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#c9a654]" />
                )}
                Members
              </button>
            </div>

            {/* Content: PROPOSALS TAB */}
            {activeDetailTab === 'Proposals' && (() => {
              const submittedGroupProps = groupProposals.filter(isProposalSubmitted).map(getAdviserVisibleProposal);
              return (
                <div className="space-y-4">
                  {submittedGroupProps.length === 0 ? (
                    <div className="py-20 flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4 border border-gray-100"><FileText className="w-8 h-8 text-gray-300" /></div>
                      <h3 className="text-lg font-bold text-[#122244]">No proposals submitted yet</h3>
                      <p className="text-sm text-gray-500 mt-1 max-w-sm">The group is still drafting their business proposals. Submitted proposals will appear here once submitted by the students.</p>
                    </div>
                  ) : (
                    <>
                      {(selectedGroup.status === 'Approved Proposal' || selectedGroup.status === 'Active Business' || Boolean(selectedGroup.activeProposalId)) && (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                          <div className="flex items-start gap-3">
                            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                            <div>
                              <h4 className="font-bold text-green-800 text-sm">
                                {selectedGroup.status === 'Active Business' || selectedGroup.activeProposalId ? "Active Business Activated: " : "Proposal Approved: "}
                                {selectedGroup.businessName || selectedGroup.title}
                              </h4>
                              <p className="text-sm text-green-700 mt-0.5">
                                {selectedGroup.status === 'Active Business' || selectedGroup.activeProposalId
                                  ? "This business is locked in and active. You can view the full project overview, financial inputs, and AI analysis."
                                  : "This group can now proceed to financial planning."}
                              </p>
                            </div>
                          </div>
                          {isReportSubmitted(selectedGroup, submittedGroupProps.length > 0 ? submittedGroupProps : (proposalsByGroup[selectedGroup.id] || [])) ? (
                            <button
                              onClick={() => handleOpenActiveBusiness(selectedGroup)}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 shrink-0 shadow-sm"
                            >
                              <Eye className="w-4 h-4" /> View Active Business Details
                            </button>
                          ) : (
                            <button
                              onClick={() => setAwaitingReportGroup(selectedGroup)}
                              className="px-4 py-2 bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 shrink-0 shadow-sm"
                              title="Report submission pending by student team"
                            >
                              <Lock className="w-4 h-4 text-amber-600" /> Awaiting Student Report
                            </button>
                          )}
                        </div>
                      )}

                      {submittedGroupProps.map((proposal, idx) => {
                        const slotNum = proposal.proposalNumber || idx + 1;
                        return (
                          <div key={proposal.id || idx} className="bg-white rounded-2xl border-2 border-gray-200 p-5 shadow-xs hover:border-blue-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-xs font-black rounded-md uppercase tracking-wider">
                                  Proposal {slotNum}
                                </span>
                                {getProposalStatusBadge(proposal.status)}
                              </div>
                              <h3 className="font-extrabold text-[#122244] text-lg">{proposal.businessName || `Business Proposal #${slotNum}`}</h3>
                              <p className="text-sm text-gray-500 mb-1">{proposal.businessType ? `${proposal.businessType} • ` : ""}{proposal.tagline || proposal.targetMarket || "No additional description"}</p>
                              <p className="text-xs text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" /> Submitted: {formatProposalDate(proposal)}</p>

                              {/* Adviser Remarks display (single line truncated) */}
                              <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-200/80 text-xs flex items-center gap-1.5 overflow-hidden">
                                <span className="font-bold text-gray-600 shrink-0">Adviser Remarks:</span>
                                <span
                                  className={`truncate block flex-1 ${
                                    proposal.adviserRemarks || proposal.adviserFeedback
                                      ? "text-gray-800 font-medium italic"
                                      : "text-gray-400 italic"
                                  }`}
                                  title={proposal.adviserRemarks || proposal.adviserFeedback || "No remarks provided yet."}
                                >
                                  {proposal.adviserRemarks || proposal.adviserFeedback || "No remarks provided yet."}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button onClick={() => handleOpenProposalModal(proposal, selectedGroup)} className="w-full md:w-auto px-5 py-2.5 bg-[#122244] hover:bg-[#1a2f55] text-white font-bold text-sm rounded-xl transition-colors shadow-sm flex items-center justify-center gap-1.5">
                                <FileText className="w-4 h-4" /> Open Proposal
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              );
            })()}

            {/* Content: MEMBERS TAB */}
            {activeDetailTab === 'Members' && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="divide-y divide-gray-100">
                  <div className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-[#122244] text-white flex items-center justify-center font-bold text-sm">{getInitials(selectedGroup.leaderName)}</div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{selectedGroup.leaderName}</p>
                        <p className="text-xs text-gray-500">{students.find(s => s.id === selectedGroup.leaderId)?.studentId || 'ID Unknown'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3"><span className="px-3 py-1 bg-yellow-50 text-yellow-700 text-xs font-bold rounded-md uppercase tracking-wider">Leader</span></div>
                  </div>
                  {selectedGroup.memberIds.map(memberId => {
                    const member = students.find(s => s.id === memberId);
                    if (!member) return null;
                    return (
                      <div key={memberId} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-sm">{getInitials(`${member.firstName} ${member.lastName}`)}</div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{member.firstName} {member.lastName}</p>
                            <p className="text-xs text-gray-500">{member.studentId}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button onClick={() => { setGroupToChangeLeader(selectedGroup); setNewLeaderId(memberId); setShowChangeLeaderModal(true); }} className="text-xs font-bold text-[#4285F4] hover:underline opacity-0 group-hover:opacity-100 transition-opacity md:opacity-100">Make Leader</button>
                          <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-md uppercase tracking-wider">Member</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------------------------------------- */}
        {/* VIEW 3: ACTIVE BUSINESS (Read-Only Dashboard for Adviser)                                         */}
        {/* ------------------------------------------------------------------------------------------------- */}
        {activeView === 'active-business' && selectedGroup && activeProposal && (
          <ActiveBusinessDetailView
            key={activeProposal.id}
            group={selectedGroup}
            proposal={activeProposal}
            groupNumber={groups.findIndex((g) => g.id === selectedGroup.id) + 1}
            adviserName={userName}
            students={students}
            readOnlyBadgeLabel="READ-ONLY ADVISER VIEW"
            backLabel="Back"
            onBack={() => setActiveView('dashboard')}
            onOpenGroupHistory={() => {
              setActiveView('group-details');
              fetchGroupProposals(selectedGroup.id);
            }}
            canPostFeedback={true}
            feedbackInput={feedbackInput}
            onFeedbackInputChange={setFeedbackInput}
            adviserScoreInput={adviserScoreInput}
            onAdviserScoreChange={setAdviserScoreInput}
            onSubmitFeedback={handleSubmitFeedback}
            isSavingFeedback={isSaving}
          />
        )}

      </main>

      {/* ========================================================= */}
      {/* MODALS                                                    */}
      {/* ========================================================= */}

      {/* MODAL: View Proposal (Adviser Review) */}
      {viewingProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#122244]/60 backdrop-blur-sm">
          <div className="bg-white rounded-[1.5rem] w-full max-w-[95vw] 2xl:max-w-[1600px] shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col h-[95vh] border border-gray-200/50">
            {/* Modal Header */}
            <div className="px-6 py-4 md:px-8 md:py-6 border-b border-gray-100 flex justify-between items-center gap-3 bg-white rounded-t-[1.5rem] z-10 shadow-sm relative">
              <div className="flex items-center gap-4 md:gap-5 min-w-0 flex-1">
                <div className="w-12 h-12 md:w-14 md:h-14 bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-100/50 shadow-inner shrink-0">
                  <FileText className="w-6 h-6 md:w-7 md:h-7 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-1.5">
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-black rounded-lg uppercase tracking-wider">
                      Proposal {viewingProposal.proposalNumber || 1} of 3
                    </span>
                    <h2 className="text-2xl md:text-3xl font-extrabold text-[#122244] tracking-tight break-words">{viewingProposal.businessName || 'Business Proposal'}</h2>
                    {getProposalStatusBadge(viewingProposal.status)}
                  </div>
                  <p className="text-xs md:text-sm text-gray-500 font-medium flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 shrink-0" /> Submitted: {formatProposalDate(viewingProposal)}</p>
                </div>
              </div>
              <button onClick={handleCloseProposalModal} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2.5 rounded-full transition-all focus:outline-none bg-gray-50/50 shrink-0 cursor-pointer" title="Close"><X className="w-6 h-6" /></button>
            </div>

            {/* Modal Body - Split Layout */}
            <div className="flex-1 overflow-hidden bg-gray-50/50 flex flex-col lg:flex-row rounded-b-[1.5rem]">

              {/* LEFT COLUMN: Proposal Details */}
              <div className="w-full lg:w-[55%] xl:w-[60%] h-full overflow-y-auto custom-scrollbar border-r border-gray-200/80 bg-gray-50/30">
                <div className="p-6 md:p-10 space-y-10">

                  {/* Adviser Feedback Banner */}
                  {viewingProposal.feedbackHistory && viewingProposal.feedbackHistory.length > 0 && (
                    <div className="p-6 rounded-2xl border border-blue-200/60 bg-blue-50/40 flex flex-col gap-4 shadow-sm">
                      <h4 className="text-xs font-extrabold uppercase tracking-widest text-blue-700 flex items-center gap-2">
                        <MessageCircle className="w-4 h-4" /> Previous Feedback History
                      </h4>
                      <div className="space-y-4">
                        {viewingProposal.feedbackHistory.map(item => (
                          <div key={item.id} className="bg-white p-6 rounded-xl border border-blue-100/60 shadow-sm relative overflow-hidden">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400"></div>
                            <div className="flex justify-between items-start mb-3">
                              <span className="font-bold text-base text-[#122244]">{item.authorName}</span>
                              <span className="text-xs text-gray-500 font-medium">{new Date(item.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                            </div>
                            <p className="text-base text-gray-800 whitespace-pre-wrap leading-relaxed">{item.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* BUSINESS OVERVIEW */}
                  <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:border-gray-200 transition-colors">
                    <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50 flex items-center gap-3">
                      <div className="p-2 bg-blue-100/50 rounded-lg"><FileText className="w-4 h-4 text-blue-600" /></div>
                      <h3 className="text-sm font-extrabold text-[#122244] uppercase tracking-widest">Business Overview</h3>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2 min-w-0">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Business Type</label>
                        <div className="text-base font-bold text-[#122244] bg-gray-50/80 px-5 py-4 rounded-xl border border-gray-100/50 break-words">{viewingProposal.businessType || '-'}</div>
                      </div>
                      <div className="space-y-2 min-w-0">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Capital (₱)</label>
                        <div className="text-base font-bold text-green-700 bg-green-50/50 px-5 py-4 rounded-xl border border-green-100/50 tabular-nums break-words">₱ {viewingProposal.totalCapital || '-'}</div>
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tagline</label>
                        <div className="text-base text-gray-800 italic bg-gray-50/80 px-5 py-4 rounded-xl border border-gray-100/50">"{viewingProposal.tagline || '-'}"</div>
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Target Market</label>
                        <div className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap bg-gray-50/80 px-5 py-4 rounded-xl border border-gray-100/50">{viewingProposal.targetMarket || '-'}</div>
                      </div>
                    </div>
                  </section>

                  {/* MISSION & VISION */}
                  <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:border-gray-200 transition-colors">
                    <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50 flex items-center gap-3">
                      <div className="p-2 bg-purple-100/50 rounded-lg"><Star className="w-4 h-4 text-purple-600 fill-current" /></div>
                      <h3 className="text-sm font-extrabold text-[#122244] uppercase tracking-widest">Mission & Vision</h3>
                    </div>
                    <div className="p-6 space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Mission Statement</label>
                        <div className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap bg-gray-50/80 px-5 py-4 rounded-xl border border-gray-100/50">{viewingProposal.missionStatement || '-'}</div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Vision Statement</label>
                        <div className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap bg-gray-50/80 px-5 py-4 rounded-xl border border-gray-100/50">{viewingProposal.visionStatement || '-'}</div>
                      </div>
                    </div>
                  </section>

                  {/* PRODUCT & PRICING */}
                  <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:border-gray-200 transition-colors">
                    <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50 flex items-center gap-3">
                      <div className="p-2 bg-emerald-100/50 rounded-lg"><DollarSign className="w-4 h-4 text-emerald-600" /></div>
                      <h3 className="text-sm font-extrabold text-[#122244] uppercase tracking-widest">Product & Pricing</h3>
                    </div>
                    <div className="p-6 space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Product Description</label>
                        <div className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap bg-gray-50/80 px-5 py-4 rounded-xl border border-gray-100/50">{viewingProposal.productDescription || '-'}</div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Price Ranges</label>
                        <div className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap bg-gray-50/80 px-5 py-4 rounded-xl border border-gray-100/50">{viewingProposal.priceRanges || '-'}</div>
                      </div>
                    </div>
                  </section>

                  {/* PLACE & PROMOTION */}
                  <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:border-gray-200 transition-colors">
                    <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50 flex items-center gap-3">
                      <div className="p-2 bg-orange-100/50 rounded-lg"><Target className="w-4 h-4 text-orange-600" /></div>
                      <h3 className="text-sm font-extrabold text-[#122244] uppercase tracking-widest">Place & Promotion</h3>
                    </div>
                    <div className="p-6 space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Proposed Location</label>
                        <div className="text-base text-gray-800 font-medium bg-gray-50/80 px-5 py-4 rounded-xl border border-gray-100/50">{viewingProposal.proposedLocation || '-'}</div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Promotional Strategy</label>
                        <div className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap bg-gray-50/80 px-5 py-4 rounded-xl border border-gray-100/50">{viewingProposal.promotionalStrategy || '-'}</div>
                      </div>
                    </div>
                  </section>

                  {/* FINANCIAL PROPOSAL & COSTING (FEASIBILITY INPUTS) */}
                  <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:border-gray-200 transition-colors">
                    <div className="px-6 py-4 border-b border-gray-50 bg-gradient-to-r from-amber-50/60 to-blue-50/40 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 text-[#c9a654] rounded-lg">
                          <Calculator className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-extrabold text-[#122244] uppercase tracking-widest">
                            Financial Proposal & Unit Costing
                          </h3>
                          <p className="text-[11px] text-gray-500 font-medium">
                            Unit economics, markup strategy, and operational feasibility
                          </p>
                        </div>
                      </div>
                      <span className="px-3 py-1 bg-amber-100 text-[#b59545] text-[10px] font-black rounded-lg uppercase tracking-wider">
                        Feasibility Inputs
                      </span>
                    </div>

                    <div className="p-6 space-y-6">
                      {(() => {
                        const fin = viewingProposal.financialData || {};
                        const products = normalizeProposalProducts(fin, viewingProposal.businessName);
                        const equipmentList = fin.equipmentList || [];
                        const calculatedEquipmentTotal = equipmentList.reduce(
                          (sum: number, eq: any) => sum + (Number(eq.total) || ((Number(eq.quantity) || 0) * (Number(eq.unitPrice) || 0))),
                          0
                        );

                        return (
                          <div className="space-y-6">
                            {/* TOTAL CAPITAL HERO CARD */}
                            <div className="bg-gradient-to-r from-[#122244] via-[#1a3060] to-[#122244] p-5 sm:p-6 rounded-2xl border border-amber-300/30 text-white shadow-md relative overflow-hidden">
                              <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-36 h-36 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                                <div className="space-y-1 min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="px-2.5 py-0.5 bg-[#c9a654]/20 border border-[#c9a654]/40 text-[#f3d98b] text-[10px] font-black rounded-full uppercase tracking-wider">
                                      Proposal Total Capital
                                    </span>
                                  </div>
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-200">
                                    Total Capital Overview
                                  </h4>
                                  <p className="text-[11px] text-gray-300">
                                    Directly pulled from the Total Capital requirement inputted in the business proposal
                                  </p>
                                </div>
                                <div className="text-left sm:text-right bg-white/5 border border-white/10 px-4 sm:px-5 py-3 rounded-xl backdrop-blur-sm shrink-0 max-w-full overflow-hidden">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-200/80 block">
                                    Total Capital Amount
                                  </span>
                                  <span className="text-xl sm:text-2xl xl:text-3xl font-black text-[#f3d98b] tracking-tight tabular-nums whitespace-nowrap inline-block">
                                    ₱{(Number(String(viewingProposal.totalCapital || "").replace(/,/g, "")) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Section 1: Proposed Products */}
                            <div className="space-y-4">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-[#122244] text-white text-[11px] font-bold flex items-center justify-center">1</span>
                                <h4 className="font-bold text-xs uppercase tracking-wider text-[#122244]">
                                  Proposed Products ({products.length} {products.length === 1 ? 'Product' : 'Products'})
                                </h4>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {products.map((prod, pIdx) => {
                                  const metrics = computeProductMetrics(prod);
                                  const hasCosting = (prod.ingredients && prod.ingredients.length > 0) || metrics.unitCost > 0 || metrics.sellingPrice > 0;

                                  return (
                                    <div key={prod.id || pIdx} className="bg-gray-50/80 p-3.5 rounded-xl border border-gray-100 flex items-center gap-3">
                                      <span className="px-2.5 py-1 bg-[#122244] text-white text-[11px] font-bold rounded-lg uppercase shrink-0">
                                        #{pIdx + 1}
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        <span className="font-extrabold text-xs text-[#122244] block truncate">
                                          {prod.name || `Product #${pIdx + 1}`}
                                        </span>
                                        {hasCosting && metrics.sellingPrice > 0 && (
                                          <span className="text-[10px] font-semibold text-[#c9a654]">
                                            Target: ₱{metrics.sellingPrice.toFixed(2)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Section 2: Equipment / CapEx Table */}
                            {equipmentList.length > 0 && (
                              <div className="space-y-3 pt-3">
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-[#122244] text-white text-[11px] font-bold flex items-center justify-center">2</span>
                                    <h4 className="font-bold text-xs uppercase tracking-wider text-[#122244]">
                                      Startup Equipment & Assets Breakdown (CapEx)
                                    </h4>
                                  </div>
                                  <span className="text-xs font-extrabold text-[#122244] bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-200">
                                    Total: ₱{calculatedEquipmentTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </div>
                                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-gray-50 border-b border-gray-200 text-[10px] uppercase text-gray-500 font-bold">
                                      <tr>
                                        <th className="p-2.5 pl-3.5">Item / Asset name</th>
                                        <th className="p-2.5 w-16 text-center">QTY</th>
                                        <th className="p-2.5 w-24">UNIT PRICE</th>
                                        <th className="p-2.5 pr-3.5 w-28 text-right">TOTAL</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {equipmentList.map((eq: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-gray-50/50">
                                          <td className="p-2.5 pl-3.5 font-medium text-gray-800">{eq.name || '-'}</td>
                                          <td className="p-2.5 text-center text-gray-600">{eq.quantity || 1}</td>
                                          <td className="p-2.5 text-gray-600">₱{Number(eq.unitPrice || 0).toLocaleString()}</td>
                                          <td className="p-2.5 pr-3.5 text-right font-bold text-[#122244]">₱{(Number(eq.total) || ((Number(eq.quantity) || 0) * (Number(eq.unitPrice) || 0))).toLocaleString()}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {fin.isCapitalBorrowed && (
                              <div className="flex justify-between items-center text-xs text-amber-800 bg-amber-50 p-3 rounded-lg border border-amber-200/70">
                                <span className="font-semibold">Startup Capital Loan Financing:</span>
                                <span className="font-black">{fin.interestRate || '0'}% Annual Interest Rate</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </section>

                  {/* OTHER DETAILS */}
                    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:border-gray-200 transition-colors">
                      <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50 flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-lg"><Info className="w-4 h-4 text-gray-600" /></div>
                        <h3 className="text-sm font-extrabold text-[#122244] uppercase tracking-widest">Other Relevant Information</h3>
                      </div>
                      <div className="p-6">
                        <p className="text-xs text-gray-500 mb-3">For manual adviser review only. These details are not included in AI analysis.</p>
                        <div className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap break-words bg-gray-50/80 px-5 py-4 rounded-xl border border-gray-100/50">
                          {getOtherRelevantInformation(viewingProposal) || 'No other relevant information has been provided.'}
                        </div>
                      </div>
                    </section>

                    {/* AI FEASIBILITY ANALYSIS (STUDENT EVALUATION) */}
                    {(() => {
                      const studentAi = viewingProposal.aiAnalysis || viewingProposal.adviserAiAnalysis || null;

                      const studentAiScore = typeof studentAi?.score === 'number'
                        ? studentAi.score
                        : (typeof studentAi?.overallScore === 'number' ? studentAi.overallScore : 75);

                      const getRatingBadge = (score: number) => {
                        if (score >= 80) {
                          return {
                            label: "High Feasibility",
                            badgeClass: "bg-green-100 text-green-700 border-green-200"
                          };
                        }
                        if (score >= 65) {
                          return {
                            label: "Moderate Feasibility",
                            badgeClass: "bg-amber-100 text-amber-800 border-amber-200"
                          };
                        }
                        return {
                          label: "Needs Improvement",
                          badgeClass: "bg-red-100 text-red-700 border-red-200"
                        };
                      };

                      const scoreRating = getRatingBadge(studentAiScore);

                      const formatMetricVal = (val: any) => {
                        if (val === undefined || val === null || val === "") return "75%";
                        if (typeof val === "number") return `${val}%`;
                        const str = String(val).trim();
                        return str.endsWith("%") ? str : `${str}%`;
                      };

                      const metricFinancial = formatMetricVal(studentAi?.metrics?.financial ?? studentAi?.metrics?.financialViability);
                      const metricMarket = formatMetricVal(studentAi?.metrics?.market ?? studentAi?.metrics?.marketAlignment ?? studentAi?.metrics?.marketFit);
                      const metricRisk = formatMetricVal(studentAi?.metrics?.risk ?? studentAi?.metrics?.riskLevel);

                      const extractItemText = (item: any): { title: string; desc: string } => {
                        if (!item) return { title: "", desc: "" };
                        if (typeof item === "string") return { title: "", desc: item.trim() };
                        const title = (item.title || "").trim();
                        const desc = (item.description || item.text || item.desc || "").trim();
                        return { title, desc: desc || (title ? "" : String(item)) };
                      };

                      const rawStrengths = (Array.isArray(studentAi?.strengths) && studentAi.strengths.length > 0)
                        ? studentAi.strengths
                        : (Array.isArray(studentAi?.insights)
                          ? studentAi.insights.filter((i: any) => i?.type === "positive")
                          : []);

                      const rawWeaknesses = (Array.isArray(studentAi?.weaknesses) && studentAi.weaknesses.length > 0)
                        ? studentAi.weaknesses
                        : (Array.isArray(studentAi?.insights)
                          ? studentAi.insights.filter((i: any) => i?.type === "warning" || i?.type === "danger" || i?.type === "negative")
                          : []);

                      const rawRecommendations = (Array.isArray(studentAi?.recommendations) && studentAi.recommendations.length > 0)
                        ? studentAi.recommendations
                        : (Array.isArray(studentAi?.insights)
                          ? studentAi.insights.filter((i: any) => i?.type === "info" || i?.type === "suggestion")
                          : []);

                      return (
                        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:border-gray-200 transition-colors">
                          {/* Section Header */}
                          <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-yellow-100/60 rounded-lg">
                                <Sparkles className="w-4 h-4 text-[#c9a654]" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="text-sm font-extrabold text-[#122244] uppercase tracking-widest">
                                    AI Feasibility Analysis
                                  </h3>
                                  <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md bg-blue-100 text-blue-700">
                                    Student Evaluation
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  Feasibility evaluation generated by the student while drafting this proposal.
                                </p>
                              </div>
                            </div>
                            {studentAi?.lastRun && (
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Evaluated {formatProposalDate({ submissionDate: studentAi.lastRun } as any)}
                              </span>
                            )}
                          </div>

                          <div className="p-6">
                            {studentAi ? (
                              <div className="space-y-6">
                                {/* Score Banner / Metric Cards */}
                                <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-5 border border-gray-100 shadow-xs">
                                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                                    <div>
                                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        Overall Feasibility Score
                                      </p>
                                      <div className="flex items-baseline gap-2 mt-1">
                                        <span className="text-3xl font-black text-[#122244]">{studentAiScore}</span>
                                        <span className="text-sm font-semibold text-gray-400">/ 100</span>
                                      </div>
                                    </div>
                                    <span className={`px-3 py-1 text-xs font-bold rounded-full border ${scoreRating.badgeClass}`}>
                                      {scoreRating.label}
                                    </span>
                                  </div>

                                  {/* 3-metric breakdown */}
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
                                    <div className="bg-white p-3.5 rounded-lg border border-gray-100">
                                      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                                        Financial Viability
                                      </span>
                                      <span className="text-lg font-black text-[#122244] mt-1 block">
                                        {metricFinancial}
                                      </span>
                                    </div>
                                    <div className="bg-white p-3.5 rounded-lg border border-gray-100">
                                      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                                        Market Alignment
                                      </span>
                                      <span className="text-lg font-black text-[#122244] mt-1 block">
                                        {metricMarket}
                                      </span>
                                    </div>
                                    <div className="bg-white p-3.5 rounded-lg border border-gray-100">
                                      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                                        Risk Level
                                      </span>
                                      <span className="text-lg font-black text-[#122244] mt-1 block">
                                        {metricRisk}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Strengths */}
                                {rawStrengths.length > 0 && (
                                  <div className="p-5 rounded-xl border border-green-200/70 bg-green-50/40">
                                    <h4 className="text-xs font-extrabold uppercase tracking-widest text-green-800 flex items-center gap-2 mb-3">
                                      <ThumbsUp className="w-4 h-4 text-green-600" />
                                      Key Feasibility Strengths
                                    </h4>
                                    <ul className="space-y-2.5">
                                      {rawStrengths.map((item: any, idx: number) => {
                                        const { title, desc } = extractItemText(item);
                                        return (
                                          <li key={idx} className="flex items-start gap-2.5 text-xs text-green-950 leading-relaxed">
                                            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                                            <div>
                                              {title && <span className="font-bold text-green-900">{title}: </span>}
                                              <span>{desc}</span>
                                            </div>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </div>
                                )}

                                {/* Areas of Concern & Risks */}
                                {rawWeaknesses.length > 0 && (
                                  <div className="p-5 rounded-xl border border-amber-200/70 bg-amber-50/40">
                                    <h4 className="text-xs font-extrabold uppercase tracking-widest text-amber-800 flex items-center gap-2 mb-3">
                                      <TrendingDown className="w-4 h-4 text-amber-600" />
                                      Areas of Concern & Risks
                                    </h4>
                                    <ul className="space-y-2.5">
                                      {rawWeaknesses.map((item: any, idx: number) => {
                                        const { title, desc } = extractItemText(item);
                                        return (
                                          <li key={idx} className="flex items-start gap-2.5 text-xs text-amber-950 leading-relaxed">
                                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                            <div>
                                              {title && <span className="font-bold text-amber-900">{title}: </span>}
                                              <span>{desc}</span>
                                            </div>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </div>
                                )}

                                {/* Reality Check */}
                                {studentAi.realityCheck && (
                                  <div className="p-5 rounded-xl border-l-4 border-red-400 bg-red-50/40 border-t border-r border-b border-red-100">
                                    <h4 className="text-xs font-extrabold uppercase tracking-widest text-red-700 flex items-center gap-2 mb-2">
                                      <AlertCircle className="w-4 h-4 text-red-500" />
                                      Market Reality Check
                                    </h4>
                                    <p className="text-xs text-red-950 italic leading-relaxed">
                                      "{studentAi.realityCheck.trim()}"
                                    </p>
                                  </div>
                                )}

                                {/* Actionable Recommendations */}
                                {rawRecommendations.length > 0 && (
                                  <div className="p-5 rounded-xl border border-gray-100 bg-gray-50/40">
                                    <h4 className="text-xs font-extrabold uppercase tracking-widest text-[#122244] flex items-center gap-2 mb-3">
                                      <Lightbulb className="w-4 h-4 text-[#c9a654]" />
                                      Actionable Recommendations
                                    </h4>
                                    <ol className="space-y-2.5">
                                      {rawRecommendations.map((item: any, idx: number) => {
                                        const { title, desc } = extractItemText(item);
                                        return (
                                          <li key={idx} className="flex items-start gap-2.5 text-xs text-gray-800 leading-relaxed">
                                            <span className="w-5 h-5 rounded-full bg-[#122244] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                                              {idx + 1}
                                            </span>
                                            <div>
                                              {title && <span className="font-bold text-[#122244]">{title}: </span>}
                                              <span>{desc}</span>
                                            </div>
                                          </li>
                                        );
                                      })}
                                    </ol>
                                  </div>
                                )}

                                {/* AI Draft Feedback */}
                                {studentAi.draftFeedback && (
                                  <div className="p-5 rounded-xl border border-blue-100 bg-blue-50/40">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-2.5">
                                      <h4 className="text-xs font-extrabold uppercase tracking-widest text-blue-900 flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-blue-600" />
                                        AI Feedback Summary
                                      </h4>
                                      <button
                                        type="button"
                                        onClick={() => handleCopyAiFeedbackToRemarks(studentAi.draftFeedback)}
                                        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                                          copiedAiFeedback
                                            ? "bg-emerald-600 text-white border border-emerald-600"
                                            : "text-blue-700 hover:text-blue-900 bg-white hover:bg-blue-100/60 border border-blue-200"
                                        }`}
                                        title="Copy or append this AI feedback to Adviser Remarks"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                        <span>{copiedAiFeedback ? "Copied to Remarks!" : "Copy to Adviser Remarks"}</span>
                                      </button>
                                    </div>
                                    <p className="text-xs text-blue-950 leading-relaxed whitespace-pre-wrap bg-white/80 p-3.5 rounded-lg border border-blue-100/60">
                                      {studentAi.draftFeedback}
                                    </p>
                                  </div>
                                )}
                              </div>
                            ) : (
                              /* Placeholder Card */
                              <div className="p-8 text-center bg-gray-50/60 rounded-xl border border-dashed border-gray-200 flex flex-col items-center justify-center">
                                <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mb-3">
                                  <Brain className="w-6 h-6 text-gray-400" />
                                </div>
                                <h4 className="text-sm font-bold text-gray-700 mb-1">
                                  No AI Feasibility Analysis Recorded
                                </h4>
                                <p className="text-xs text-gray-500 max-w-sm">
                                  The student team has not run an AI Feasibility Analysis for this proposal draft.
                                </p>
                              </div>
                            )}
                          </div>
                        </section>
                      );
                    })()}
                </div>
              </div>

              {/* RIGHT COLUMN: Dedicated Adviser Remarks & Decision Panel */}
              <div className="w-full lg:w-[45%] xl:w-[40%] h-full bg-[#fcfcfd] flex flex-col relative z-20 shadow-[-10px_0_20px_-10px_rgba(0,0,0,0.03)] border-t lg:border-t-0 lg:border-l border-gray-200/80">

                {/* Panel Header */}
                <div className="p-5 md:p-6 border-b border-gray-200/80 bg-white flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-yellow-100/60 rounded-lg">
                        <MessageCircle className="w-4 h-4 text-[#c9a654]" />
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-[#122244] uppercase tracking-widest">
                          Adviser Remarks & Decision
                        </h3>
                        <p className="text-[11px] text-gray-500 font-medium">
                          Official feedback & proposal disposition
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleExportPDF}
                      disabled={isExportingPdf}
                      className="text-xs font-bold text-[#122244] hover:text-[#c9a654] flex items-center gap-1.5 transition-colors bg-white px-3.5 py-1.5 rounded-full border border-gray-200 shadow-sm hover:border-[#c9a654]/40 cursor-pointer disabled:opacity-50"
                      title="Export Proposal & Remarks as PDF"
                    >
                      {isExportingPdf ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#c9a654]" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-[#c9a654]" />
                      )}
                      <span>Export PDF</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full ${
                      viewingProposal.status === 'Approved' ? 'bg-green-100 text-green-800' :
                      viewingProposal.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                      viewingProposal.status === 'Revision Required' ? 'bg-amber-100 text-amber-800' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      Status: {viewingProposal.status}
                    </span>
                    {isRemarksSaving ? (
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-full flex items-center gap-1 animate-pulse border border-amber-200/60">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" /> Saving...
                      </span>
                    ) : remarksSavedNotice ? (
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full flex items-center gap-1 border border-emerald-200/60">
                        <Check className="w-2.5 h-2.5 text-emerald-600" /> Auto-saved
                      </span>
                    ) : feedbackInput.trim() ? (
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-full border border-blue-200/60">
                        Remarks Attached
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Panel Scrollable Body (Feedback History & Spacious Remarks Area) */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-6 space-y-5 flex flex-col">

                  {/* Previous Feedback History Thread */}
                  {viewingProposal.feedbackHistory && viewingProposal.feedbackHistory.length > 0 && (
                    <div className="p-4 rounded-xl border border-blue-200/70 bg-blue-50/40 flex flex-col gap-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-extrabold uppercase tracking-widest text-blue-800 flex items-center gap-1.5">
                          <MessageCircle className="w-3.5 h-3.5 text-blue-600" /> Previous Feedback History ({viewingProposal.feedbackHistory.length})
                        </h4>
                      </div>
                      <div className="space-y-2.5 max-h-44 overflow-y-auto custom-scrollbar pr-1">
                        {viewingProposal.feedbackHistory.map((item) => (
                          <div key={item.id} className="bg-white p-3 rounded-lg border border-blue-100/70 shadow-xs text-xs space-y-1">
                            <div className="flex items-center justify-between text-gray-500">
                              <span className="font-bold text-[#122244]">{item.authorName}</span>
                              <span className="text-[10px]">{formatDisplayDateTime(item.date)}</span>
                            </div>
                            <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{item.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Spacious Remarks Textarea Container */}
                  <div className="flex-1 flex flex-col space-y-2 min-h-[220px]">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-extrabold text-[#122244] uppercase tracking-wider block">
                        Adviser Remarks & Instructions
                      </label>
                      <span className="text-[10px] text-gray-400">
                        Auto-saves automatically
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Provide clear feedback, revision requirements, or approval notes for the student team.
                    </p>
                    <textarea
                      value={feedbackInput}
                      onChange={(e) => setFeedbackInput(e.target.value)}
                      placeholder="Type adviser remarks, revision feedback, requirements, or approval notes for this proposal..."
                      className="w-full flex-1 min-h-[200px] p-4 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#c9a654]/50 focus:border-[#c9a654] resize-none text-sm bg-white text-gray-900 placeholder-gray-400 transition-all shadow-inner custom-scrollbar leading-relaxed"
                    />
                  </div>
                </div>

                {/* Bottom Decision Action Buttons */}
                <div className="border-t border-gray-200 bg-white p-4 md:p-6 shadow-[0_-15px_30px_-15px_rgba(0,0,0,0.08)] z-20 mt-auto rounded-br-[1.5rem] space-y-2">
                  <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">
                    Adviser Decision
                  </p>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleProposalAction(viewingProposal, 'Revision Required')}
                      disabled={isSaving}
                      className="flex-1 min-w-[120px] py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-95 disabled:opacity-50 cursor-pointer">
                      <Edit2 className="w-3.5 h-3.5" /> Needs Revision
                    </button>
                    <button
                      type="button"
                      onClick={() => handleProposalAction(viewingProposal, 'Rejected')}
                      disabled={isSaving}
                      className="flex-1 min-w-[120px] py-2.5 px-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-95 disabled:opacity-50 cursor-pointer">
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => handleProposalAction(viewingProposal, 'Approved')}
                      disabled={isSaving}
                      className="flex-1 min-w-[120px] py-2.5 px-3 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-95 disabled:opacity-50 cursor-pointer">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* NEW MODAL: Create Group Step 1 - Assign Leader */}
      {showCreateLeaderModal && (() => {
        const unassignedCandidateStudents = students.filter(
          s => !assignedIds.has(s.id) &&
          (`${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
           s.studentId.includes(searchTerm) ||
           (s.section || "").toLowerCase().includes(searchTerm.toLowerCase()))
        );
        const { map: secMap, sortedSectionKeys } = groupStudentsBySection(unassignedCandidateStudents);

        return (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
              <div className="p-6 border-b border-gray-100 flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-[#122244]">Create Group</h2>
                  <p className="text-sm text-gray-500 mt-1">Step 1: Assign a team leader for this new group.</p>
                </div>
                <button onClick={() => { setShowCreateLeaderModal(false); setSelectedLeaderId(""); setSelectedMemberIds([]); }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search unassigned students..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a654]/50 shadow-sm"
                  />
                </div>
              </div>
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-xs font-black text-[#122244] uppercase tracking-wider">Select a Team Leader</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {sortedSectionKeys.length === 0 ? (
                  <p className="text-center py-6 text-gray-400 italic text-sm">No unassigned students match your search.</p>
                ) : (
                  sortedSectionKeys.map(secName => {
                    const secStudents = secMap[secName] || [];
                    return (
                      <div key={secName} className="space-y-2">
                        <div className="bg-gray-100 px-3 py-1.5 rounded-lg flex items-center justify-between border border-gray-200 shadow-2xs">
                          <span className="text-xs font-black text-[#122244] uppercase tracking-wider">{secName}</span>
                          <span className="text-[10px] font-bold text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200">
                            {secStudents.length} Unassigned
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {secStudents.map(student => {
                            const isSelected = selectedLeaderId === student.id;
                            return (
                              <label key={student.id} className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-colors ${isSelected ? 'border-[#c9a654] bg-yellow-50/30 shadow-sm' : 'border-gray-100 hover:bg-gray-50'}`}>
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                                    {getInitials(`${student.firstName} ${student.lastName}`)}
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-[#122244]">{`${student.firstName} ${student.lastName}`}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-xs text-gray-500">{student.studentId}</span>
                                      <span className="px-1.5 py-0.2 bg-blue-50 border border-blue-200 text-[#4285F4] text-[9px] font-bold rounded">
                                        {student.section || "No Section"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <input
                                  type="radio"
                                  name="leaderSelection"
                                  value={student.id}
                                  checked={isSelected}
                                  onChange={() => setSelectedLeaderId(student.id)}
                                  className="w-4 h-4 text-[#c9a654] focus:ring-[#c9a654]"
                                />
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 rounded-b-2xl">
                <button onClick={() => { setShowCreateLeaderModal(false); setSelectedLeaderId(""); setSelectedMemberIds([]); }} className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-lg shadow-sm hover:bg-gray-50">Cancel</button>
                <button
                  onClick={() => {
                    setShowCreateLeaderModal(false);
                    setShowCreateMembersModal(true);
                    setSearchTerm("");
                  }}
                  disabled={!selectedLeaderId}
                  className="px-5 py-2.5 bg-[#c9a654] text-white font-semibold rounded-lg shadow-md hover:bg-[#b59545] disabled:opacity-50"
                >
                  Next: Select Members
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* NEW MODAL: Create Group Step 2 - Assign Members */}
      {showCreateMembersModal && (() => {
        const selectedLeaderObj = students.find(s => s.id === selectedLeaderId);
        const leaderSection = (selectedLeaderObj?.section || "").trim();

        // Strictly show only students from the selected leader's section
        const unassignedCandidateMembers = students.filter(
          s => !assignedIds.has(s.id) &&
          s.id !== selectedLeaderId &&
          (!leaderSection || (s.section || "").trim() === leaderSection) &&
          (`${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
           s.studentId.includes(searchTerm) ||
           (s.section || "").toLowerCase().includes(searchTerm.toLowerCase()))
        );
        const { map: secMap, sortedSectionKeys } = groupStudentsBySection(unassignedCandidateMembers);

        return (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
              <div className="p-6 border-b border-gray-100 flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-[#122244]">Create Group</h2>
                  <p className="text-sm text-gray-500 mt-1">Step 2: Select members to join this group.</p>
                </div>
                <button onClick={() => { setShowCreateMembersModal(false); setSelectedLeaderId(""); setSelectedMemberIds([]); }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>

              <div className="bg-purple-50 border-b border-purple-100 p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                    {getInitials(selectedLeaderObj?.firstName + " " + selectedLeaderObj?.lastName)}
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase text-purple-600 tracking-tighter">Selected Leader</p>
                    <p className="text-sm font-bold text-[#122244]">{selectedLeaderObj?.firstName} {selectedLeaderObj?.lastName}</p>
                  </div>
                </div>
                {selectedLeaderObj?.section && (
                  <span className="px-2 py-0.5 bg-white border border-purple-200 text-purple-700 text-[10px] font-black rounded-md uppercase">
                    {selectedLeaderObj.section}
                  </span>
                )}
              </div>

              <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search unassigned students..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a654]/50 shadow-sm"
                  />
                </div>
              </div>
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-xs font-black text-[#122244] uppercase tracking-wider">Select Members of the Group</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {sortedSectionKeys.length === 0 ? (
                  <p className="text-center py-6 text-gray-400 italic text-sm">No unassigned students in {leaderSection || "this section"} match your search.</p>
                ) : (
                  sortedSectionKeys.map(secName => {
                    const secStudents = secMap[secName] || [];
                    return (
                      <div key={secName} className="space-y-2">
                        <div className="bg-gray-100 px-3 py-1.5 rounded-lg flex items-center justify-between border border-gray-200 shadow-2xs">
                          <span className="text-xs font-black text-[#122244] uppercase tracking-wider">{secName}</span>
                          <span className="text-[10px] font-bold text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200">
                            {secStudents.length} Unassigned
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {secStudents.map(student => {
                            const isSelected = selectedMemberIds.includes(student.id);
                            return (
                              <label key={student.id} onClick={(e) => {
                                e.preventDefault();
                                setSelectedMemberIds(prev => prev.includes(student.id) ? prev.filter(id => id !== student.id) : [...prev, student.id]);
                              }} className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-colors ${isSelected ? 'border-green-400 bg-green-50/30 shadow-sm' : 'border-gray-100 hover:bg-gray-50'}`}>
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                                    {getInitials(`${student.firstName} ${student.lastName}`)}
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-[#122244]">{`${student.firstName} ${student.lastName}`}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-xs text-gray-500">{student.studentId}</span>
                                      <span className="px-1.5 py-0.2 bg-blue-50 border border-blue-200 text-[#4285F4] text-[9px] font-bold rounded">
                                        {student.section || "No Section"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'}`}>
                                  {isSelected && <Check className="w-3.5 h-3.5" />}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-b-2xl">
                <p className="text-xs text-gray-500"><span className="font-bold text-[#122244]">{selectedMemberIds.length}</span> selected</p>
                <div className="flex gap-2">
                  <button onClick={() => { setShowCreateMembersModal(false); setShowCreateLeaderModal(true); }} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 font-semibold text-sm rounded-lg shadow-sm hover:bg-gray-50">Back</button>
                  <button onClick={handleCreateGroup} disabled={isLoading} className="px-5 py-2 bg-[#122244] text-white font-semibold text-sm rounded-lg shadow-md hover:bg-[#1a3263] flex items-center gap-2">
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Group"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* NEW MODAL: Feedback History & Submission */}
      {showFeedbackModal && activeProposal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-2xl">
              <h2 className="text-lg font-extrabold text-[#122244] flex items-center gap-2"><MessageCircle className="w-5 h-5 text-[#c9a654]" /> Feedback History</h2>
              <button onClick={() => setShowFeedbackModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-white">
              {!activeProposal.feedbackHistory || activeProposal.feedbackHistory.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3"><MessageCircle className="w-5 h-5 text-gray-400" /></div>
                  <h3 className="font-bold text-[#122244]">No Feedback Yet</h3>
                  <p className="text-sm text-gray-500 mt-1">Start by giving your first piece of feedback below.</p>
                </div>
              ) : (
                activeProposal.feedbackHistory.map(item => (
                  <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm border-l-4 border-l-blue-500">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#122244]">{item.authorName}</span>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-black rounded uppercase tracking-wider">{item.role}</span>
                      </div>
                      <span className="text-xs text-gray-400 font-medium">{new Date(item.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{item.text}</p>
                  </div>
                ))
              )}
            </div>

            <div className="p-6 border-t border-gray-100 bg-[#122244] rounded-b-2xl">
              <label className="text-[10px] font-bold text-gray-300 uppercase tracking-widest block mb-3">Provide feedback or advice below. This will be shared with the group.</label>
              <textarea
                value={feedbackInput}
                onChange={(e) => setFeedbackInput(e.target.value)}
                placeholder="Type your feedback here..."
                className="w-full p-4 border border-[#1a2f55] rounded-lg outline-none focus:ring-2 focus:ring-[#c9a654]/50 resize-none h-24 text-sm mb-4 bg-[#1a2f55] text-white placeholder-gray-400"
              />
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowFeedbackModal(false)} className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-bold rounded-lg shadow-sm hover:bg-gray-50">Close</button>
                <button onClick={handleSubmitFeedback} disabled={!feedbackInput.trim() || isSaving} className="flex items-center gap-2 px-6 py-2.5 bg-[#c9a654] text-white text-sm font-bold rounded-lg shadow-md hover:bg-[#b59545] disabled:opacity-50 transition-colors">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Submit Feedback
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Auto-Group Confirmation */}
      {showAutoGroupConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 p-2 rounded-full">
                  <FlaskConical className="w-6 h-6 text-blue-500" />
                </div>
                <h2 className="text-xl font-bold text-[#122244]">Run Auto-Group?</h2>
              </div>
              <button onClick={() => setShowAutoGroupConfirm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-sm font-bold text-gray-700 block mb-2">Min. Members</label>
                  <input type="number" value={minMembers} onChange={e => setMinMembers(Number(e.target.value))} className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#122244]" />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-bold text-gray-700 block mb-2">Max. Members</label>
                  <input type="number" value={maxMembers} onChange={e => setMaxMembers(Number(e.target.value))} className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#122244]" />
                </div>
              </div>
              <p className="text-gray-600 text-sm leading-relaxed">
                This will automatically shuffle and distribute all <strong>unassigned students</strong> into balanced groups of <strong>{minMembers} to {maxMembers}</strong> members per group.
              </p>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 rounded-b-2xl">
              <button onClick={() => setShowAutoGroupConfirm(false)} className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-lg shadow-sm hover:bg-gray-50">Cancel</button>
              <button onClick={() => executeAutoGroup(groups)} className="px-5 py-2.5 bg-[#122244] text-white font-semibold rounded-lg shadow-md hover:bg-[#1a3263]">Yes, Generate Groups</button>
            </div>
          </div>
        </div>
      )}

      {/* NEW MODAL: All Students Assigned Alert */}
      {showAllAssignedModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 p-2 rounded-full">
                  <CheckCircle2 className="w-6 h-6 text-blue-500" />
                </div>
                <h2 className="text-xl font-bold text-[#122244]">Already Assigned</h2>
              </div>
              <button onClick={() => setShowAllAssignedModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <p className="text-gray-600 text-sm leading-relaxed">
                All students in this section are already assigned to a group!
              </p>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end bg-gray-50/50 rounded-b-2xl">
              <button onClick={() => setShowAllAssignedModal(false)} className="px-5 py-2.5 bg-[#122244] text-white font-semibold rounded-lg shadow-md hover:bg-[#1a3263]">OK</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: View All Students */}
      {showAllStudentsModal && (() => {
        const { map: secMap, sortedSectionKeys } = groupStudentsBySection(filteredStudents);
        return (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
              <div className="p-6 border-b border-gray-100 flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-[#122244]">All Students - {activeSection === "ALL" ? "My Sections" : activeSection}</h2>
                  <p className="text-sm text-gray-500 mt-1">Complete class roster sorted by sections.</p>
                </div>
                <button onClick={() => setShowAllStudentsModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-4 border-b border-gray-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search students by name, ID, or section..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a654]/50"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {sortedSectionKeys.length === 0 ? (
                  <p className="text-center py-6 text-gray-400 italic text-sm">No students match your search.</p>
                ) : (
                  sortedSectionKeys.map(secName => {
                    const secStudents = secMap[secName] || [];
                    return (
                      <div key={secName} className="space-y-2">
                        <div className="bg-gray-100 px-3 py-1.5 rounded-lg flex items-center justify-between border border-gray-200 shadow-2xs">
                          <span className="text-xs font-black text-[#122244] uppercase tracking-wider">{secName}</span>
                          <span className="text-[10px] font-bold text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200">
                            {secStudents.length} {secStudents.length === 1 ? 'Student' : 'Students'}
                          </span>
                        </div>
                        <div className="space-y-2 pl-1">
                          {secStudents.map(student => {
                            const isLeader = groups.some(g => g.leaderId === student.id);
                            const isMember = groups.some(g => g.memberIds.includes(student.id));
                            return (
                              <div key={student.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                                    {getInitials(`${student.firstName} ${student.lastName}`)}
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-gray-900">{`${student.firstName} ${student.lastName}`}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-xs text-gray-500">{student.studentId}</span>
                                      <span className="px-1.5 py-0.2 bg-blue-50 border border-blue-200 text-[#4285F4] text-[9px] font-bold rounded">
                                        {student.section || "No Section"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                {isLeader ? (
                                  <span className="text-[10px] font-bold px-2 py-1 bg-yellow-100 text-yellow-700 rounded uppercase">Leader</span>
                                ) : isMember ? (
                                  <span className="text-[10px] font-bold px-2 py-1 bg-gray-100 text-gray-600 rounded uppercase">Member</span>
                                ) : (
                                  <span className="text-[10px] font-bold px-2 py-1 bg-red-50 text-red-500 rounded uppercase">Unassigned</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-b-2xl">
                <span className="text-sm text-gray-500">Showing <span className="font-bold text-gray-900">{filteredStudents.length}</span> students</span>
                <button onClick={() => setShowAllStudentsModal(false)} className="px-5 py-2 bg-white border border-gray-200 text-gray-700 font-semibold rounded-lg shadow-sm hover:bg-gray-50">Close</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: Change Leader */}
      {showChangeLeaderModal && groupToChangeLeader && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-[#122244]">Change Team Leader</h2>
                <p className="text-sm text-gray-500 mt-1">Select a new leader from the group's members or unassigned students.</p>
              </div>
              <button onClick={() => { setShowChangeLeaderModal(false); setGroupToChangeLeader(null); setNewLeaderId(""); }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2 mb-2">Current Members</p>
              {groupToChangeLeader.memberIds.map(memberId => {
                const student = students.find(s => s.id === memberId);
                if (!student) return null;
                const isSelected = newLeaderId === student.id;
                return (
                  <label key={student.id} className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-colors ${isSelected ? 'border-[#c9a654] bg-yellow-50/30' : 'border-gray-100 hover:bg-gray-50'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-xs">{getInitials(`${student.firstName} ${student.lastName}`)}</div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{student.firstName} {student.lastName}</p>
                        <p className="text-xs text-gray-500">{student.studentId}</p>
                      </div>
                    </div>
                    <input type="radio" name="newLeader" value={student.id} checked={isSelected} onChange={() => setNewLeaderId(student.id)} className="w-4 h-4 text-[#c9a654] focus:ring-[#c9a654]" />
                  </label>
                );
              })}

              <div className="h-px bg-gray-100 my-4"></div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2 mb-2">Unassigned Students</p>
              {students.filter(s => !assignedIds.has(s.id)).length === 0 && <p className="text-xs text-gray-500 italic px-2">No unassigned students available.</p>}
              {students.filter(s => !assignedIds.has(s.id)).map(student => {
                const isSelected = newLeaderId === student.id;
                return (
                  <label key={student.id} className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-colors ${isSelected ? 'border-[#c9a654] bg-yellow-50/30' : 'border-gray-100 hover:bg-gray-50'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-400 text-white flex items-center justify-center font-bold text-xs">{getInitials(`${student.firstName} ${student.lastName}`)}</div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{student.firstName} {student.lastName}</p>
                        <p className="text-xs text-gray-500">{student.studentId}</p>
                      </div>
                    </div>
                    <input type="radio" name="newLeader" value={student.id} checked={isSelected} onChange={() => setNewLeaderId(student.id)} className="w-4 h-4 text-[#c9a654] focus:ring-[#c9a654]" />
                  </label>
                );
              })}
            </div>

            <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 rounded-b-2xl">
              <button onClick={() => { setShowChangeLeaderModal(false); setGroupToChangeLeader(null); setNewLeaderId(""); }} className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-lg shadow-sm hover:bg-gray-50">Cancel</button>
              <button onClick={executeChangeLeader} disabled={!newLeaderId} className="px-5 py-2.5 bg-[#c9a654] text-white font-semibold rounded-lg shadow-md hover:bg-[#b59545] disabled:opacity-50">Confirm Change</button>
            </div>
          </div>
        </div>
      )}

      {/* AWAITING STUDENT REPORT MODAL */}
      {awaitingReportGroup && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-amber-200 animate-in zoom-in-95 duration-200 p-6 sm:p-7 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-4 shadow-inner">
              <Clock className="w-8 h-8 text-amber-500" />
            </div>
            <h3 className="text-xl font-extrabold text-[#122244] mb-2">
              Active Business Report Awaiting Submission
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed mb-6">
              Team &ldquo;{awaitingReportGroup.companyName || awaitingReportGroup.businessName || awaitingReportGroup.title}&rdquo; has activated their business, but has not yet submitted their passing AI Feasibility Report. Active business details will unlock once the student team submits their passing report result.
            </p>
            <div className="flex justify-center">
              <button
                onClick={() => setAwaitingReportGroup(null)}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#122244] hover:bg-[#1a3060] text-white text-sm font-bold shadow-md transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Delete Group Confirmation */}
      {showDeleteConfirm && groupToDelete && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-start">
              <div><h2 className="text-xl font-bold text-[#122244]">Delete Group?</h2></div>
              <button onClick={() => { setShowDeleteConfirm(false); setGroupToDelete(null); }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 rounded-b-2xl">
              <button onClick={() => { setShowDeleteConfirm(false); setGroupToDelete(null); }} className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-lg shadow-sm hover:bg-gray-50">Cancel</button>
              <button onClick={confirmDeleteGroup} className="px-5 py-2.5 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700">Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

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


      {/* Unified Business Proposal Section Export Modal */}
      <ProposalExportModal
        isOpen={showProposalExportModal}
        onClose={() => {
          setShowProposalExportModal(false);
          setProposalToExport(null);
        }}
        proposal={proposalToExport || activeProposal || viewingProposal || (selectedGroup ? groupProposals.find(p => p.status === 'Approved') || groupProposals[0] : null)}
        group={selectedGroup || (proposalToExport?.groupId ? groups.find(g => g.id === proposalToExport.groupId) : null)}
        adviserName={userName}
      />

      {/* Top-Center Floating Notification Banner: New Proposal Submitted */}
      {topProposalNotification && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] max-w-lg w-[92%] sm:w-auto animate-in slide-in-from-top-4 fade-in duration-300">
          {topProposalNotification.type === "report" ? (
            <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-[#122244] border border-emerald-500/40 shadow-2xl shadow-emerald-950/50 rounded-2xl px-5 py-3 flex items-center justify-between gap-4 text-white ring-1 ring-emerald-400/30">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-emerald-300 uppercase tracking-wider">
                    Feasibility Report Submitted
                  </p>
                  <p className="text-xs font-semibold text-gray-200 truncate">
                    {topProposalNotification.groupName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleViewHighlightedProposal}
                  className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-black rounded-lg transition-transform active:scale-95 shadow-md flex items-center gap-1 cursor-pointer"
                >
                  View
                </button>
                <button
                  onClick={() => setTopProposalNotification(null)}
                  className="p-1 text-emerald-300/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                  title="Dismiss"
                  aria-label="Dismiss notification"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-[#122244] border border-white/10 shadow-2xl shadow-black/40 rounded-2xl px-5 py-3 flex items-center justify-between gap-4 text-white">
              <span className="text-sm font-bold text-gray-100 whitespace-nowrap">
                New proposal submitted
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleViewHighlightedProposal}
                  className="px-3.5 py-1.5 bg-[#c9a654] hover:bg-[#b59545] text-[#122244] text-xs font-black rounded-lg transition-transform active:scale-95 shadow-md flex items-center gap-1 cursor-pointer"
                >
                  View
                </button>
                <button
                  onClick={() => setTopProposalNotification(null)}
                  className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                  title="Dismiss"
                  aria-label="Dismiss notification"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SCROLL TO TOP BUTTON (BOTTOM RIGHT) */}
      <ScrollToTopButton />
    </div>
  );
};

export default AdviserDashboard;
