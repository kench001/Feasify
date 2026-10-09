import React, { useEffect, useRef, useState } from "react";
import Skeleton from "react-loading-skeleton";
import { OfficialNameChecker } from "./components/OfficialNameChecker";
import { LocationPickerMap } from "./components/LocationPickerMap";
import ScrollToTopButton from "./components/ScrollToTopButton";
import CustomDropdown, { type DropdownOption } from "./components/CustomDropdown";
import {
  checkDTI,
  checkSEC,
  checkName,
  OFFICIAL_SOURCES,
  type NameCheckResult
} from "./services/nameCheckerService";
import { useNavigate } from "react-router-dom";
import { auth, db, signOutUser } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  addDoc,
  serverTimestamp,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";
import { logAuditEvent } from "./services/auditLogger";
import { sendNotification, notifyAdvisersForSection } from "./services/notificationService";
import {
  LayoutDashboard,
  Folder,
  FileEdit,
  Zap,
  BarChart3,
  MessageCircle,
  User,
  Users,
  Settings,
  ShieldAlert,
  Sidebar as SidebarIcon,
  Star,
  Bell,
  Check,
  ChevronLeft,
  Pencil,
  X,
  Clock,
  MoreVertical,
  Edit,
  CheckCircle2,
  FileText,
  MapPin,
  DollarSign,
  AlertCircle,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Calculator,
  TrendingUp,
  Package,
  Info,
  Upload,
  Image as ImageIcon,
  ArrowUp,
  ShieldCheck,
  FileSpreadsheet,
  Download,
  Copy,
} from "lucide-react";
import * as XLSX from "xlsx";
import TextareaAutosize from 'react-textarea-autosize';
import {
  fetchCopyrightDB,
  checkBusinessName,
  checkTagline,
  checkTotalCapital,
  type CopyrightDB,
} from "./services/copyrightService";

interface ExpandingTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  minRows?: number;
}

const Autosize = TextareaAutosize as any;

const ExpandingTextarea: React.FC<ExpandingTextareaProps & { rows?: number }> = ({ value, minRows, rows, ...props }) => {
  const effectiveMinRows = minRows || rows || 2;
  const hasText = value && typeof value === 'string' && value.trim().length > 0;
  return (
    <Autosize
      minRows={effectiveMinRows}
      maxRows={hasText ? undefined : effectiveMinRows}
      value={value}
      {...props}
    />
  );
};


const businessTypeDropdownOptions: DropdownOption[] = [
  { value: "", label: "Select category..." },
  { value: "Food & Beverage", label: "Food & Beverage" },
  { value: "Services", label: "Services" },
  { value: "Other", label: "Other (Please specify)" },
];

interface GroupData {
  id: string;
  leaderId: string;
  leaderName: string;
  title: string;
  companyName?: string;
  companyLogo?: string;
  memberIds: string[];
  joinedMembers?: string[];
  section: string;
  isSetup?: boolean;
  status?:
  | "Drafting"
  | "Pending Review"
  | "Approved Proposal"
  | "Active Business";
  activeProposalId?: string;
  mission?: string;
  vision?: string;
  objectives?: string[];
}

// Added FeedbackItem interface
interface FeedbackItem {
  id: string;
  text: string;
  authorName: string;
  role: string;
  date: string;
}

export {
  type IngredientItem,
  type ProductCostingItem,
  type EquipmentItem,
  type FinancialProposalData,
  handlePreventNegative,
  handlePasteNonNegative,
  normalizeProposalProducts,
} from "./utils/productCosting";

import {
  type IngredientItem,
  type ProductCostingItem,
  type EquipmentItem,
  type FinancialProposalData,
  handlePreventNegative,
  handlePasteNonNegative,
  normalizeProposalProducts,
  computeProductMetrics as computeProductMetricsBase,
} from "./utils/productCosting";

export const computeProductMetrics = (product: ProductCostingItem) => computeProductMetricsBase(product, true);

interface ProposalData {
  id?: string;
  groupId: string;
  proposalNumber?: number;
  teamName?: string;
  facultyId?: string;
  businessType: string;
  businessName: string;
  businessLogo?: string;
  totalCapital: string;
  contributorsCount?: string;
  tagline: string;
  targetMarket: string;
  missionStatement: string;
  visionStatement: string;
  productDescription: string;
  priceRanges: string;
  proposedLocation: string;
  promotionalStrategy: string;
  otherDetails: string;
  status: "Draft" | "Submitted" | "Under Review" | "Revision Required" | "Approved" | "Rejected" | "Pending" | "Revision";
  adviserRemarks?: string;
  adviserFeedback?: string;
  feedbackHistory?: FeedbackItem[]; // Added to read adviser feedback
  submissionDate?: string;
  financialData?: FinancialProposalData;
  originalProposalFinancials?: any;
  createdAt?: any;
  updatedAt?: any;
}

const initialProposalState: ProposalData = {
  groupId: "",
  businessType: "",
  businessName: "",
  businessLogo: "",
  totalCapital: "",
  contributorsCount: "1",
  tagline: "",
  targetMarket: "",
  missionStatement: "",
  visionStatement: "",
  productDescription: "",
  priceRanges: "",
  proposedLocation: "",
  promotionalStrategy: "",
  otherDetails: "",
  status: "Draft",
  financialData: {
    products: [
      {
        id: "prod-1",
        name: "",
        quantityYield: "",
        ingredients: [],
        markupPercentage: "100",
        sellingPrice: "",
      },
    ],
    equipmentList: [],
    isCapitalBorrowed: false,
    interestRate: "",
  },
};
const formatDateTime = (timestamp: any) => {
  if (!timestamp) return "";
  try {
    // Check if it's a Firebase Timestamp with a toDate method, otherwise assume it's a standard Date/string
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return "";

    // en-GB locale formats to DD/MM/YYYY, HH:mm:ss natively
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  } catch (e) {
    return "";
  }
};

const formatFeedbackDate = (timestamp: any) => {
  if (!timestamp) return "";
  try {
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return typeof timestamp === "string" ? timestamp : "";
    return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return typeof timestamp === "string" ? timestamp : "";
  }
};

// Strips any undefined fields recursively to prevent Firestore 'Unsupported field value: undefined' errors
const cleanFirestoreData = (obj: any): any => {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map(cleanFirestoreData);
  }
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = cleanFirestoreData(value);
    }
  }
  return cleaned;
};

const Projects: React.FC = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [userUid, setUserUid] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const [userGroup, setUserGroup] = useState<GroupData | null>(null);
  const [isLeader, setIsLeader] = useState(false);
  const [_isMember, setIsMember] = useState(false);
  const [_hasJoined, setHasJoined] = useState(false);
  const [_isLoading, setIsLoading] = useState(true);

  const [_leaderData, setLeaderData] = useState<any>(null);
  const [groupMembersData, setGroupMembersData] = useState<any[]>([]);
  const [adviserData, setAdviserData] = useState<any>(null);

  const [proposals, setProposals] = useState<ProposalData[]>([]);
  const [currentProposal, setCurrentProposal] =
    useState<ProposalData>(initialProposalState);

  const [activeView, setActiveView] = useState<string>("loading");
  const [dashboardTab, setDashboardTab] = useState<
    "All Proposals" | "Drafts" | "Pending" | "Approved" | "Rejected" | "Revision"
  >("All Proposals");

  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupCompanyName, setSetupCompanyName] = useState("");
  const [setupLogoFile, setSetupLogoFile] = useState<File | null>(null);
  const [setupLogoPreview, setSetupLogoPreview] = useState("");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [setupMission, setSetupMission] = useState("");
  const [setupVision, setSetupVision] = useState("");
  const [setupObjectives, setSetupObjectives] = useState<string[]>([""]
  );
  const [setupErrors, setSetupErrors] = useState<Record<string, string>>({});
  const [companyNameQuery, setCompanyNameQuery] = useState("");
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const companyNameRef = useRef<HTMLDivElement>(null);

  // Official Government Name Verification state (DTI & SEC)
  const [setupDtiResult, setSetupDtiResult] = useState<NameCheckResult | null>(null);
  const [setupSecResult, setSetupSecResult] = useState<NameCheckResult | null>(null);

  const [showRosterModal, setShowRosterModal] = useState(false);
  const [showLockInModal, setShowLockInModal] = useState(false);
  const [showEditBasicModal, setShowEditBasicModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [proposalToDelete, setProposalToDelete] = useState<ProposalData | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("All changes saved");
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [showAllFeedback, setShowAllFeedback] = useState(false);

  const [editBasicData, setEditBasicData] =
    useState<ProposalData>(initialProposalState);

  const [showToast, setShowToast] = useState(false);
  const [toastTitle, setToastTitle] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  const [showSubmissionFailureModal, setShowSubmissionFailureModal] = useState(false);
  const [submissionFailureReasons, setSubmissionFailureReasons] = useState<{
    type: "missing" | "copyright" | "capital" | "quota" | "error";
    title: string;
    description: string;
    items?: string[];
  }[]>([]);
  const [highlightMissingFields, setHighlightMissingFields] = useState(false);

  const [copyrightDB, setCopyrightDB] = useState<CopyrightDB | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});
  const excelFileInputRef = useRef<HTMLInputElement>(null);
  const [excelImportFeedback, setExcelImportFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const toggleProductExpand = (key: string) => {
    setExpandedProducts((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleAllProducts = (expand: boolean) => {
    if (!expand) {
      setExpandedProducts({});
    } else {
      const products = normalizeProposalProducts(currentProposal.financialData, currentProposal.businessName);
      const allExp: Record<string, boolean> = {};
      products.forEach((p, idx) => {
        allExp[p.id || String(idx)] = true;
      });
      setExpandedProducts(allExp);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 150 || document.documentElement.scrollTop > 150) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.documentElement.scrollTo({ top: 0, behavior: "smooth" });
    document.body.scrollTo({ top: 0, behavior: "smooth" });
    const mains = document.querySelectorAll("main");
    mains.forEach((m) => m.scrollTo({ top: 0, behavior: "smooth" }));
  };
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchCopyrightDB().then((dbData) => {
      setCopyrightDB(dbData);
    });
  }, []);

  useEffect(() => {
    let unsubGroup: (() => void) | undefined;
    let unsubProposals: (() => void) | undefined;
    let unsubNotif: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      // Clean up previous listeners when auth state changes
      if (unsubGroup) { unsubGroup(); unsubGroup = undefined; }
      if (unsubProposals) { unsubProposals(); unsubProposals = undefined; }
      if (unsubNotif) { unsubNotif(); unsubNotif = undefined; }

      if (!u) {
        navigate("/");
        return;
      }
      setUserUid(u.uid);
      try {
        const userDoc = await getDoc(doc(db, "users", u.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserName(`${data.firstName} ${data.lastName}`);
          if (data.section) {
            const listeners = setupGroupListener(u.uid, data.section);
            unsubGroup = listeners.unsubGroup;
            unsubProposals = listeners.unsubProposals;
          } else {
            setIsLoading(false);
            setActiveView("no-group");
          }
        }
      } catch (error) {
        console.error(error);
        setIsLoading(false);
        setActiveView("no-group");
      }

      // Real-time unread notification count
      const notifQ = query(
        collection(db, "notifications"),
        where("userId", "==", u.uid),
        where("isRead", "==", false)
      );
      unsubNotif = onSnapshot(notifQ, (snap) => {
        setUnreadNotificationCount(snap.size);
      }, (err) => console.error("Notification badge error:", err));
    });

    return () => {
      unsubAuth();
      if (unsubGroup) unsubGroup();
      if (unsubProposals) unsubProposals();
      if (unsubNotif) unsubNotif();
    };
  }, [navigate]);

  // --- REAL-TIME LISTENER SETUP ---
  // Returns unsubscribe functions for both the group and proposals listeners
  const setupGroupListener = (uid: string, section: string): { unsubGroup: () => void; unsubProposals: () => void } => {
    let activeProposalsUnsub: (() => void) | undefined;
    let currentListenedGroupId: string | null = null;

    const q = query(collection(db, "groups"), where("section", "==", section));

    const groupUnsub = onSnapshot(q, async (querySnapshot) => {
      let foundGroup: GroupData | null = null;
      let leader = false;
      let member = false;

      querySnapshot.forEach((document) => {
        const data = document.data() as GroupData;
        if (data.leaderId === uid) {
          foundGroup = { ...data, id: document.id };
          leader = true;
        } else if (data.memberIds && data.memberIds.includes(uid)) {
          foundGroup = { ...data, id: document.id };
          member = true;
        }
      });

      if (!foundGroup) {
        setIsLoading(false);
        setActiveView("no-group");
        if (activeProposalsUnsub) { activeProposalsUnsub(); activeProposalsUnsub = undefined; currentListenedGroupId = null; }
        return;
      }

      const g = foundGroup as GroupData;
      setUserGroup(g);
      setIsLeader(leader);
      setIsMember(member);
      if (member && g.joinedMembers && g.joinedMembers.includes(uid))
        setHasJoined(true);

      const rawCompName = (g.companyName && g.companyName !== "Pending Business Name" && g.companyName !== "Pending Company Name")
        ? g.companyName
        : (g.title && g.title !== "Pending Business Name" && g.title !== "Pending Company Name" && g.title !== "Feasibility Project" ? g.title : "");
      setSetupCompanyName(rawCompName);
      setCompanyNameQuery(rawCompName);
      setSetupLogoPreview(g.companyLogo || "");
      setSetupMission(g.mission || "");
      setSetupVision(g.vision || "");
      setSetupObjectives(g.objectives && g.objectives.length > 0 ? g.objectives : [""]);

      // --- VIEW TRANSITIONS: driven by GROUP state changes only ---
      // This fires when the group document changes (isSetup, joinedMembers, activeProposalId).
      // It does NOT fire when proposals change, so typing in a form never triggers a view reset.
      if (leader && !g.isSetup) {
        setActiveView("leader-setup");
      } else if (member && (!g.joinedMembers || !g.joinedMembers.includes(uid))) {
        setActiveView("member-join");
      } else if (g.activeProposalId) {
        sessionStorage.setItem("lastSelectedProjectId", g.activeProposalId);
        setActiveView("active-business");
      } else {
        // No special group state — only reset view if currently in a stale/invalid state.
        // Preserve "dashboard" and any user-navigated position so open forms stay open.
        setActiveView(prev => {
          if (prev === "loading" || prev === "no-group" || prev === "leader-setup" || prev === "member-join" || prev === "active-business") {
            return "dashboard";
          }
          return prev; // Keep current view — user may be filling out a form
        });
      }

      // --- PROPOSALS LISTENER: data-only, never touches activeView ---
      // Only subscribe when the group ID actually changes to avoid re-firing on every group update.
      if (g.id !== currentListenedGroupId) {
        currentListenedGroupId = g.id;
        if (activeProposalsUnsub) { activeProposalsUnsub(); }

        // Fetch member details once when first attaching to this group
        fetchGroupDetails(g).catch(console.error);

        const propQ = query(collection(db, "proposals"), where("groupId", "==", g.id));
        activeProposalsUnsub = onSnapshot(propQ, (propSnap) => {
          const fetchedProposals: ProposalData[] = propSnap.docs.map((d) => {
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

          // DATA ONLY — never call setActiveView here.
          // View transitions are handled entirely by the group listener above.
          setProposals(fetchedProposals);
          sessionStorage.setItem('projectsProposalCount', fetchedProposals.length.toString());
          setIsLoading(false);
        }, (err) => {
          console.error("Proposals listener error:", err);
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }

    }, (err) => {
      console.error("Group listener error:", err);
      setIsLoading(false);
      setActiveView("no-group");
    });

    return {
      unsubGroup: () => {
        groupUnsub();
        if (activeProposalsUnsub) activeProposalsUnsub();
      },
      unsubProposals: () => {
        if (activeProposalsUnsub) activeProposalsUnsub();
      }
    };
  };


  // Keep fetchUserGroup as a one-time helper for direct calls (e.g., after setup)
  const fetchUserGroup = async (uid: string, section: string) => {
    try {
      const q = query(
        collection(db, "groups"),
        where("section", "==", section),
      );
      const querySnapshot = await getDocs(q);
      let foundGroup: GroupData | null = null;
      let leader = false;
      let member = false;

      querySnapshot.forEach((document) => {
        const data = document.data() as GroupData;
        if (data.leaderId === uid) {
          foundGroup = { ...data, id: document.id };
          leader = true;
        } else if (data.memberIds && data.memberIds.includes(uid)) {
          foundGroup = { ...data, id: document.id };
          member = true;
        }
      });

      if (foundGroup) {
        const g = foundGroup as GroupData;
        setUserGroup(g);
        setIsLeader(leader);
        setIsMember(member);
        if (member && g.joinedMembers && g.joinedMembers.includes(uid))
          setHasJoined(true);

        const rawCompName = (g.companyName && g.companyName !== "Pending Business Name" && g.companyName !== "Pending Company Name")
          ? g.companyName
          : (g.title && g.title !== "Pending Business Name" && g.title !== "Pending Company Name" && g.title !== "Feasibility Project" ? g.title : "");
        setSetupCompanyName(rawCompName);
        setCompanyNameQuery(rawCompName);
        setSetupLogoPreview(g.companyLogo || "");
        setSetupMission(g.mission || "");
        setSetupVision(g.vision || "");
        setSetupObjectives(g.objectives && g.objectives.length > 0 ? g.objectives : [""]);

        await fetchGroupDetails(g);
        const fetchedProposals = await fetchProposals(g.id);

        if (leader && !g.isSetup) {
          setActiveView("leader-setup");
        } else if (
          member &&
          (!g.joinedMembers || !g.joinedMembers.includes(uid))
        ) {
          setActiveView("member-join");
        } else if (g.activeProposalId && fetchedProposals.some(p => p.id === g.activeProposalId)) {
          sessionStorage.setItem("lastSelectedProjectId", g.activeProposalId);
          setActiveView("active-business");
        } else {
          // Self-healing: Clear dead references or mismatched titles
          const activePropExists = g.activeProposalId && fetchedProposals.some(p => p.id === g.activeProposalId);
          let needsFix = false;
          const fixData: any = {};

          if (g.activeProposalId && !activePropExists) {
            fixData.activeProposalId = "";
            fixData.status = "Drafting";
            fixData.title = "Feasibility Project";
            needsFix = true;
          } else if (!g.activeProposalId && g.title && g.title !== "Feasibility Project") {
            // Check if the title belongs to an existing proposal
            const titleMatchesExisting = fetchedProposals.some(p => p.businessName === g.title);
            if (!titleMatchesExisting) {
              fixData.title = "Feasibility Project";
              fixData.status = "Drafting";
              needsFix = true;
            }
          }

          if (needsFix && leader) {
            await updateDoc(doc(db, "groups", g.id), fixData);
            setUserGroup(prev => prev ? { ...prev, ...fixData } : null);
          }
          setActiveView("dashboard");
        }
      } else {
        setIsLoading(false);
        setActiveView("no-group");
      }
    } catch (error) {
      console.error(error);
      setIsLoading(false);
      setActiveView("no-group");
    }
  };

  const fetchGroupDetails = async (group: GroupData) => {
    try {
      const leaderSnap = await getDoc(doc(db, "users", group.leaderId));
      if (leaderSnap.exists()) setLeaderData(leaderSnap.data());
      if (group.memberIds && Array.isArray(group.memberIds) && group.memberIds.length > 0) {
        const memberPromises = group.memberIds.map((id) =>
          getDoc(doc(db, "users", id)),
        );
        const memberSnaps = await Promise.all(memberPromises);
        setGroupMembersData(
          memberSnaps
            .filter((s) => s.exists())
            .map((s) => ({ id: s.id, ...s.data() })),
        );
      }
      const advQ = query(
        collection(db, "users"),
        where("role", "==", "Adviser"),
      );
      const advSnaps = await getDocs(advQ);
      advSnaps.forEach((d) => {
        if (d.data().section && d.data().section.includes(group.section))
          setAdviserData({ id: d.id, ...d.data() });
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProposals = async (groupId: string): Promise<ProposalData[]> => {
    try {
      const q = query(
        collection(db, "proposals"),
        where("groupId", "==", groupId),
      );
      const snap = await getDocs(q);
      const fetchedProposals = snap.docs.map((d) => {
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
      setProposals(fetchedProposals);
      sessionStorage.setItem('projectsProposalCount', fetchedProposals.length.toString());
      return fetchedProposals;
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  const handleLogout = async () => {
    try {
      await signOutUser();
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) { }
    navigate("/");
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

  const handleJoinGroup = async () => {
    if (!userGroup || !userUid) return;
    try {
      await updateDoc(doc(db, "groups", userGroup.id), {
        joinedMembers: arrayUnion(userUid),
      });
      setHasJoined(true);
      setActiveView("dashboard");
    } catch (error) {
      console.error(error);
    }
  };

  const compressImage = (file: File, maxDim = 280, quality = 0.85): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL("image/jpeg", quality);
            resolve(dataUrl);
          } else {
            resolve(event.target?.result as string);
          }
        };
        img.onerror = () => {
          resolve(event.target?.result as string);
        };
      };
      reader.onerror = () => resolve("");
    });
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      alert("Image size should be less than 8MB.");
      return;
    }
    setSetupLogoFile(file);
    try {
      const compressed = await compressImage(file);
      setSetupLogoPreview(compressed);
    } catch (err) {
      console.error("Compression failed:", err);
      const reader = new FileReader();
      reader.onload = () => {
        setSetupLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFinishTeamSetup = async () => {
    if (!userGroup) return;

    // Validation
    const errors: Record<string, string> = {};
    const trimmedName = setupCompanyName.trim();
    const trademarkCheck = checkBusinessName(trimmedName, copyrightDB || undefined);
    if (!trimmedName) {
      errors.companyName = "Company name is required.";
    } else if (trademarkCheck.isCopyrighted) {
      errors.companyName =
        trademarkCheck.errorMessage ||
        `"${trimmedName}" is a protected trademark or well-known brand. Please choose an original proposed name.`;
    } else if (
      (setupDtiResult?.status === "FOUND" && setupDtiResult.matchType === "exact") ||
      (setupSecResult?.status === "FOUND" && setupSecResult.matchType === "exact")
    ) {
      errors.companyName = `An exact match for "${trimmedName}" was found in official records (${setupDtiResult?.status === "FOUND" ? "DTI" : "SEC"
        }). Please verify or select a unique proposed name.`;
    }
    if (!setupMission.trim()) errors.mission = "Mission statement is required.";
    if (!setupVision.trim()) errors.vision = "Vision statement is required.";
    const validObjectives = setupObjectives.map((o) => o.trim()).filter(Boolean);
    if (validObjectives.length === 0) errors.objectives = "At least one company objective is required.";
    if (Object.keys(errors).length > 0) {
      setSetupErrors(errors);
      return;
    }
    setSetupErrors({});

    setIsUploadingLogo(true);
    try {
      let finalLogoUrl = setupLogoPreview;
      if (setupLogoFile && !finalLogoUrl) {
        finalLogoUrl = await compressImage(setupLogoFile);
      }

      const finalCompanyName = setupCompanyName.trim() || userGroup.title || "Feasibility Project";

      await updateDoc(doc(db, "groups", userGroup.id), {
        companyName: finalCompanyName,
        title: finalCompanyName,
        companyLogo: finalLogoUrl || "",
        isSetup: true,
        status: "Drafting",
        mission: setupMission.trim(),
        vision: setupVision.trim(),
        objectives: validObjectives,
      });

      // Audit Log
      logAuditEvent({
        userId: userUid || auth.currentUser?.uid || "",
        userName: userName,
        userRole: "Student Leader",
        action: "UPDATE",
        sectionCode: userGroup.section || "Unassigned",
        description: `Updated Team/Company setup for "${finalCompanyName}"`,
        recordId: userGroup.id,
        newValue: { companyName: finalCompanyName, mission: setupMission.trim(), vision: setupVision.trim() }
      });

      setUserGroup((prev) =>
        prev
          ? {
            ...prev,
            companyName: finalCompanyName,
            title: finalCompanyName,
            companyLogo: finalLogoUrl || "",
            isSetup: true,
            status: "Drafting",
            mission: setupMission.trim(),
            vision: setupVision.trim(),
            objectives: validObjectives,
          }
          : null,
      );
      setShowSetupModal(false);
      setActiveView("dashboard");
    } catch (error) {
      console.error(error);
      alert("Failed to finish team setup. Please try again.");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const updateFinancialData = (fieldUpdates: Partial<FinancialProposalData>, customProposal = currentProposal) => {
    const existingFin = customProposal.financialData || {};
    const updatedFin: FinancialProposalData = { ...existingFin, ...fieldUpdates };

    // Normalize and sync products
    const products = normalizeProposalProducts(updatedFin, customProposal.businessName);
    if (products.length > 0) {
      const firstProduct = products[0];
      const firstMetrics = computeProductMetrics(firstProduct);
      updatedFin.products = products;
      updatedFin.productionCost = String(firstMetrics.totalBatchCost);
      updatedFin.quantityYield = String(firstProduct.quantityYield || "");
      updatedFin.unitCost = firstMetrics.unitCost > 0 ? String(Number(firstMetrics.unitCost.toFixed(2))) : "";
      updatedFin.variableCost = updatedFin.unitCost;
      updatedFin.markupPercentage = String(firstProduct.markupPercentage || "100");
      updatedFin.markupAmount = firstMetrics.markupAmount > 0 ? String(Number(firstMetrics.markupAmount.toFixed(2))) : "";
      updatedFin.computedSellingPrice = firstMetrics.computedBasePrice > 0 ? String(Number(firstMetrics.computedBasePrice.toFixed(2))) : "";
      updatedFin.sellingPrice = String(firstProduct.sellingPrice || "");
    }

    // Preserve user entered total capital & contributors count
    let newTotalCapital = customProposal.totalCapital;
    if (fieldUpdates.startupCapital !== undefined) {
      newTotalCapital = String(fieldUpdates.startupCapital);
      updatedFin.startupCapital = newTotalCapital;
    } else if (customProposal.totalCapital) {
      updatedFin.startupCapital = customProposal.totalCapital;
    }

    let newContributorsCount = customProposal.contributorsCount || "1";
    if (fieldUpdates.contributorsCount !== undefined) {
      newContributorsCount = String(fieldUpdates.contributorsCount);
      updatedFin.contributorsCount = newContributorsCount;
    } else if (customProposal.contributorsCount) {
      updatedFin.contributorsCount = customProposal.contributorsCount;
    }

    const updatedProposal: ProposalData = {
      ...customProposal,
      totalCapital: newTotalCapital,
      contributorsCount: newContributorsCount,
      financialData: updatedFin,
    };

    setCurrentProposal(updatedProposal);
    handleAutoSave(updatedProposal);
  };

  // Product costing handlers
  const handleAddProduct = () => {
    const products = normalizeProposalProducts(currentProposal.financialData, currentProposal.businessName);
    const newId = "prod-" + Date.now();
    const newProduct: ProductCostingItem = {
      id: newId,
      name: "",
      quantityYield: "",
      batchesPerMonth: "1",
      unitsSold: "",
      ingredients: [],
      markupPercentage: "100",
      sellingPrice: "",
      applyVat: true,
      vatRate: 12,
    };
    setExpandedProducts((prev) => ({ ...prev, [newId]: true }));
    updateFinancialData({ products: [...products, newProduct] });
  };

  const handleRemoveProduct = (index: number) => {
    const products = normalizeProposalProducts(currentProposal.financialData, currentProposal.businessName);
    if (products.length <= 1) return;
    const nextProducts = products.filter((_, i) => i !== index);
    updateFinancialData({ products: nextProducts });
  };

  const handleDuplicateProduct = (index: number) => {
    const products = normalizeProposalProducts(currentProposal.financialData, currentProposal.businessName);
    const sourceProd = products[index];
    if (!sourceProd) return;

    const newId = "prod-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6);
    const duplicatedIngredients = (sourceProd.ingredients || []).map((ing) => ({
      ...ing,
      id: "ing-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
    }));

    const duplicatedProduct: ProductCostingItem = {
      ...sourceProd,
      id: newId,
      name: sourceProd.name ? `${sourceProd.name} (Copy)` : "Product (Copy)",
      ingredients: duplicatedIngredients,
    };

    const nextProducts = [...products];
    nextProducts.splice(index + 1, 0, duplicatedProduct);

    setExpandedProducts((prev) => ({ ...prev, [newId]: true }));
    updateFinancialData({ products: nextProducts });
  };

  const handleUpdateProduct = (index: number, updates: Partial<ProductCostingItem>) => {
    const products = normalizeProposalProducts(currentProposal.financialData, currentProposal.businessName);
    const nextProducts = [...products];
    nextProducts[index] = { ...nextProducts[index], ...updates };
    updateFinancialData({ products: nextProducts });
  };

  const handleAddIngredient = (productIndex: number, category: "ingredient" | "labor" | "miscellaneous" = "ingredient") => {
    const products = normalizeProposalProducts(currentProposal.financialData, currentProposal.businessName);
    const nextProducts = [...products];
    const currentProd = nextProducts[productIndex];
    const newIng: IngredientItem = {
      id: "ing-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      name: "",
      price: "",
      category,
    };
    nextProducts[productIndex] = {
      ...currentProd,
      ingredients: [...(currentProd.ingredients || []), newIng],
    };
    updateFinancialData({ products: nextProducts });
  };

  const handleUpdateIngredient = (productIndex: number, ingredientIndex: number, updates: Partial<IngredientItem>) => {
    const products = normalizeProposalProducts(currentProposal.financialData, currentProposal.businessName);
    const nextProducts = [...products];
    const currentProd = nextProducts[productIndex];
    const nextIngredients = [...(currentProd.ingredients || [])];
    nextIngredients[ingredientIndex] = { ...nextIngredients[ingredientIndex], ...updates };
    nextProducts[productIndex] = {
      ...currentProd,
      ingredients: nextIngredients,
    };
    updateFinancialData({ products: nextProducts });
  };

  const handleRemoveIngredient = (productIndex: number, ingredientIndex: number) => {
    const products = normalizeProposalProducts(currentProposal.financialData, currentProposal.businessName);
    const nextProducts = [...products];
    const currentProd = nextProducts[productIndex];
    const nextIngredients = (currentProd.ingredients || []).filter((_, i) => i !== ingredientIndex);
    nextProducts[productIndex] = {
      ...currentProd,
      ingredients: nextIngredients,
    };
    updateFinancialData({ products: nextProducts });
  };

  // Excel Costing & Mark-up Template Generator
  const handleDownloadCostingTemplate = () => {
    const headers = [
      "Product Name",
      "Units per Batch",
      "Batches / Month",
      "Cost Item / Ingredient",
      "Category (Material / Labor / Misc)",
      "Cost per Batch (₱)",
      "Mark-up %",
      "Apply 12% VAT (Yes/No)",
      "Target Selling Price (₱)",
    ];

    const sampleRows = [
      // Product 1
      ["Signature Cold Brew Coffee (500ml)", 50, 4, "Arabica Dark Roast Coffee Beans (1kg)", "Material", 450, 100, "Yes", ""],
      ["", "", "", "Purified Water & Brewing Filter", "Material", 60, "", "", ""],
      ["", "", "", "500ml Glass Bottles & Caps (50 pcs)", "Misc", 400, "", "", ""],
      ["", "", "", "Custom Waterproof Vinyl Labels (50 pcs)", "Misc", 150, "", "", ""],
      ["", "", "", "Barista Cold Brewing & Bottling Labor", "Labor", 250, "", "", ""],
      // Product 2
      ["Caramel Macchiato (16oz)", 40, 4, "Espresso Roast Coffee Beans", "Material", 380, 80, "Yes", ""],
      ["", "", "", "Fresh Full Cream Milk (5L)", "Material", 420, "", "", ""],
      ["", "", "", "Artisan Caramel Sauce / Syrup", "Material", 200, "", "", ""],
      ["", "", "", "16oz Cups, Dome Lids & Straws (40 pcs)", "Misc", 200, "", "", ""],
      ["", "", "", "Barista Preparation Labor", "Labor", 200, "", "", ""]
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);

    ws["!cols"] = [
      { wch: 36 }, // Product Name
      { wch: 16 }, // Units per Batch
      { wch: 16 }, // Batches / Month
      { wch: 42 }, // Cost Item / Ingredient
      { wch: 34 }, // Category
      { wch: 20 }, // Cost per Batch (₱)
      { wch: 14 }, // Mark-up %
      { wch: 22 }, // Apply 12% VAT
      { wch: 24 }, // Target Selling Price
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Product Costing & Markup");
    XLSX.writeFile(wb, "Product_Costing_and_Markup_Template.xlsx");
  };

  // Excel Costing & Mark-up File Parser & Importer
  const handleImportCostingExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so the same file can be re-imported if edited
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          throw new Error("No worksheets found in the uploaded workbook.");
        }
        const worksheet = workbook.Sheets[firstSheetName];
        const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false, defval: "" });

        if (!rawRows || rawRows.length === 0) {
          throw new Error("The uploaded Excel file is empty.");
        }

        // Detect header row and column mappings
        let headerRowIndex = -1;
        let colMap: Record<string, number> = {};

        for (let r = 0; r < Math.min(10, rawRows.length); r++) {
          const row = rawRows[r].map((cell: any) => String(cell || "").trim().toLowerCase());
          const hasProduct = row.some((c: string) => c.includes("product") || c === "name");
          const hasCostOrIngredient = row.some((c: string) =>
            c.includes("ingredient") || c.includes("cost") || c.includes("yield") ||
            c.includes("batch") || c.includes("markup") || c.includes("mark-up") ||
            c.includes("vat") || c.includes("price") || c.includes("category") || c.includes("item")
          );

          if (hasProduct || hasCostOrIngredient) {
            headerRowIndex = r;
            row.forEach((rawName: string, colIdx: number) => {
              const colName = rawName.trim().toLowerCase();
              if (!colName) return;

              // 1. Category (MUST check before material/labor/misc/ingredient)
              if (colName.includes("category") || colName.includes("cost type") || colName === "type") {
                colMap["category"] = colIdx;
              }
              // 2. Product Name
              else if (colName.includes("product") || colName === "product name" || colName === "name") {
                colMap["product"] = colIdx;
              }
              // 3. Batches per Month (batches / month, batches/mo, frequency)
              else if (colName.includes("batch") && (colName.includes("mo") || colName.includes("month") || colName.includes("freq") || colName.includes("/"))) {
                colMap["batches"] = colIdx;
              }
              // 4. Units per batch / Yield (yield, units per batch, pcs, qty yield)
              else if (colName.includes("yield") || colName.includes("units per batch") || colName.includes("unit per batch") || colName.includes("units/batch") || colName.includes("batch yield") || colName === "pcs" || colName === "units") {
                colMap["yield"] = colIdx;
              }
              // 5. Target Selling Price (must check before general price/cost)
              else if (colName.includes("selling") || colName.includes("srp") || colName.includes("target price") || colName.includes("target selling")) {
                colMap["sellingPrice"] = colIdx;
              }
              // 6. Cost per Batch (₱) / Price / Amount
              else if (colName.includes("cost per batch") || colName.includes("cost/batch") || colName.includes("batch cost") || (colName.includes("cost") && !colName.includes("item")) || colName === "price" || colName === "amount") {
                colMap["cost"] = colIdx;
              }
              // 7. Cost Item / Ingredient Name
              else if (colName.includes("ingredient") || colName.includes("cost item") || colName.includes("item name") || colName.includes("direct cost") || colName.includes("material") || colName.includes("recipe") || colName.includes("desc") || colName === "item") {
                colMap["ingredient"] = colIdx;
              }
              // 8. Markup %
              else if (colName.includes("markup") || colName.includes("mark-up") || colName.includes("margin") || colName.includes("%")) {
                colMap["markup"] = colIdx;
              }
              // 9. VAT
              else if (colName.includes("vat") || colName.includes("tax")) {
                colMap["vat"] = colIdx;
              }
            });
            break;
          }
        }

        if (headerRowIndex === -1) {
          headerRowIndex = 0;
          colMap = {
            product: 0,
            yield: 1,
            batches: 2,
            ingredient: 3,
            category: 4,
            cost: 5,
            markup: 6,
            vat: 7,
            sellingPrice: 8,
          };
        }

        const parsedProducts: ProductCostingItem[] = [];
        let currentProduct: ProductCostingItem | null = null;
        let totalCostItemsCount = 0;

        for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
          const row = rawRows[r];
          if (!row || row.every((c: any) => c === "" || c === null || c === undefined)) {
            continue;
          }

          const rawProductName = colMap.product !== undefined ? String(row[colMap.product] || "").trim() : "";
          const rawYield = colMap.yield !== undefined ? String(row[colMap.yield] || "").trim() : "";
          const rawBatches = colMap.batches !== undefined ? String(row[colMap.batches] || "").trim() : "";
          const rawIngredientName = colMap.ingredient !== undefined ? String(row[colMap.ingredient] || "").trim() : "";
          const rawCategory = colMap.category !== undefined ? String(row[colMap.category] || "").trim().toLowerCase() : "";
          const rawCost = colMap.cost !== undefined ? String(row[colMap.cost] || "").trim().replace(/[₱,$\s]/g, "") : "";
          const rawMarkup = colMap.markup !== undefined ? String(row[colMap.markup] || "").trim().replace(/%/g, "") : "";
          const rawVat = colMap.vat !== undefined ? String(row[colMap.vat] || "").trim().toLowerCase() : "";
          const rawSellingPrice = colMap.sellingPrice !== undefined ? String(row[colMap.sellingPrice] || "").trim().replace(/[₱,$\s]/g, "") : "";

          // If product name is provided and different from current product, create new product
          if (rawProductName && (!currentProduct || currentProduct.name.toLowerCase() !== rawProductName.toLowerCase())) {
            let parsedVat = true;
            if (rawVat) {
              if (rawVat === "no" || rawVat === "n" || rawVat === "false" || rawVat === "0" || rawVat === "exempt" || rawVat.includes("non")) {
                parsedVat = false;
              }
            }

            let parsedMarkup = "100";
            if (rawMarkup !== "") {
              const numMarkup = Number(rawMarkup);
              if (!isNaN(numMarkup)) {
                if (numMarkup > 0 && numMarkup <= 1) {
                  parsedMarkup = String(Math.round(numMarkup * 100));
                } else {
                  parsedMarkup = String(numMarkup);
                }
              }
            }

            const newProdId = "prod-" + Date.now() + "-" + parsedProducts.length;
            currentProduct = {
              id: newProdId,
              name: rawProductName,
              quantityYield: rawYield !== "" && !isNaN(Number(rawYield)) ? String(Math.max(0, Number(rawYield))) : (rawYield || "50"),
              batchesPerMonth: rawBatches !== "" && !isNaN(Number(rawBatches)) && Number(rawBatches) > 0 ? String(Number(rawBatches)) : "1",
              markupPercentage: parsedMarkup,
              sellingPrice: rawSellingPrice !== "" && !isNaN(Number(rawSellingPrice)) ? String(Number(rawSellingPrice)) : "",
              applyVat: parsedVat,
              vatRate: 12,
              ingredients: [],
            };
            parsedProducts.push(currentProduct);
          }

          // If no product initialized yet, create initial product
          if (!currentProduct) {
            const newProdId = "prod-" + Date.now() + "-0";
            currentProduct = {
              id: newProdId,
              name: currentProposal.businessName || "Product 1",
              quantityYield: rawYield || "50",
              batchesPerMonth: rawBatches || "1",
              markupPercentage: "100",
              sellingPrice: "",
              applyVat: true,
              vatRate: 12,
              ingredients: [],
            };
            parsedProducts.push(currentProduct);
          }

          // Backfill product metadata if row has values and product has defaults
          if (rawYield && !currentProduct.quantityYield) {
            currentProduct.quantityYield = rawYield;
          }
          if (rawBatches && currentProduct.batchesPerMonth === "1") {
            currentProduct.batchesPerMonth = rawBatches;
          }
          if (rawMarkup && currentProduct.markupPercentage === "100") {
            const numMarkup = Number(rawMarkup);
            if (!isNaN(numMarkup)) {
              currentProduct.markupPercentage = (numMarkup > 0 && numMarkup <= 1) ? String(Math.round(numMarkup * 100)) : String(numMarkup);
            }
          }
          if (rawSellingPrice && !currentProduct.sellingPrice) {
            currentProduct.sellingPrice = rawSellingPrice;
          }
          if (rawVat) {
            if (rawVat === "no" || rawVat === "n" || rawVat === "false" || rawVat === "0" || rawVat === "exempt" || rawVat.includes("non")) {
              currentProduct.applyVat = false;
            } else {
              currentProduct.applyVat = true;
            }
          }

          // Add ingredient / direct cost item if present
          const costVal = Number(rawCost);
          if (rawIngredientName || (!isNaN(costVal) && costVal > 0)) {
            let cat: "ingredient" | "labor" | "miscellaneous" = "ingredient";
            const catLower = rawCategory.toLowerCase();
            if (catLower.includes("labor") || catLower.includes("worker") || catLower.includes("salary") || catLower.includes("staff")) {
              cat = "labor";
            } else if (catLower.includes("misc") || catLower.includes("overhead") || catLower.includes("pack") || catLower.includes("util") || catLower.includes("cup") || catLower.includes("bottle") || catLower.includes("sticker") || catLower.includes("label") || catLower.includes("box") || catLower.includes("pouch")) {
              cat = "miscellaneous";
            } else {
              cat = "ingredient";
            }

            currentProduct.ingredients.push({
              id: "ing-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
              name: rawIngredientName || "Direct Material / Cost Item",
              price: !isNaN(costVal) && costVal > 0 ? costVal : (rawCost || ""),
              category: cat,
            });
            totalCostItemsCount++;
          }
        }

        if (parsedProducts.length === 0) {
          throw new Error("No product costing data could be extracted. Please check the Excel column format.");
        }

        // Automatically assign suggested selling price if not provided in Excel
        parsedProducts.forEach((prod) => {
          const metrics = computeProductMetrics(prod);
          if (!prod.sellingPrice && metrics.suggestedSellingPrice > 0) {
            prod.sellingPrice = String(Math.round(prod.applyVat !== false ? metrics.computedVatInclusivePrice : metrics.computedBasePrice));
          }
        });

        // Expand all imported products for immediate review
        const nextExpanded: Record<string, boolean> = {};
        parsedProducts.forEach((p, idx) => {
          nextExpanded[p.id || String(idx)] = true;
        });
        setExpandedProducts(nextExpanded);

        // Update financial data in Firestore / state
        updateFinancialData({ products: parsedProducts });

        setExcelImportFeedback({
          type: "success",
          message: `Successfully imported ${parsedProducts.length} product${parsedProducts.length > 1 ? "s" : ""} with ${totalCostItemsCount} direct cost & recipe items from "${file.name}".`,
        });
      } catch (err: any) {
        console.error("Excel import error:", err);
        setExcelImportFeedback({
          type: "error",
          message: err?.message || "Failed to import Excel file. Please ensure it follows the recommended template structure.",
        });
      }
    };

    reader.onerror = () => {
      setExcelImportFeedback({
        type: "error",
        message: "Failed to read the file. Please check file permissions and try again.",
      });
    };

    reader.readAsArrayBuffer(file);
  };

  // Equipment (CapEx) handlers
  const handleAddEquipmentItem = () => {
    const eqList = currentProposal.financialData?.equipmentList || [];
    const newItem: EquipmentItem = {
      id: "eq-" + Date.now(),
      name: "",
      quantity: 1,
      unitPrice: 0,
      total: 0,
    };
    updateFinancialData({ equipmentList: [...eqList, newItem] });
  };

  const handleUpdateEquipmentItem = (index: number, updates: Partial<EquipmentItem>) => {
    const eqList = currentProposal.financialData?.equipmentList || [];
    const nextList = [...eqList];
    const item = { ...nextList[index], ...updates };
    const q = Number(item.quantity) || 0;
    const p = Number(item.unitPrice) || 0;
    item.total = q * p;
    nextList[index] = item;
    updateFinancialData({ equipmentList: nextList });
  };

  const handleRemoveEquipmentItem = (index: number) => {
    const eqList = currentProposal.financialData?.equipmentList || [];
    const nextList = eqList.filter((_, i) => i !== index);
    updateFinancialData({ equipmentList: nextList });
  };

  const handleAutoSave = async (dataToSave = currentProposal) => {
    if (!userGroup) return;
    // Only auto-save if we are in editing mode
    if (!isEditingMode) return;

    // Don't auto-save if business name and type are both empty (avoiding empty drafts)
    if (!dataToSave.businessName && !dataToSave.businessType) return;

    // Don't auto-save invalid data (negative capital or copyrighted name/tagline)
    if (checkTotalCapital(dataToSave.totalCapital).isNegative) return;
    if (checkBusinessName(dataToSave.businessName, copyrightDB || undefined).isCopyrighted) return;
    if (checkTagline(dataToSave.tagline, copyrightDB || undefined).isCopyrighted) return;

    // Enforce 3 proposals maximum on auto-save
    if (!dataToSave.id && proposals.length >= 3) return;

    setIsSaving(true);
    setSaveStatus("Saving...");
    try {
      const assignedProposalNumber = dataToSave.proposalNumber || (proposals.length + 1);
      const proposalData = cleanFirestoreData({
        ...dataToSave,
        proposalNumber: assignedProposalNumber,
        teamName: userGroup.companyName || userGroup.title || "",
        groupId: userGroup.id,
        status: dataToSave.status || "Draft",
      });

      if (dataToSave.id) {
        await updateDoc(doc(db, "proposals", dataToSave.id), {
          ...proposalData,
          updatedAt: serverTimestamp(),
        });
      } else {
        const docRef = await addDoc(collection(db, "proposals"), {
          ...proposalData,
          createdAt: serverTimestamp(),
        });
        setCurrentProposal(prev => ({ ...prev, id: docRef.id, proposalNumber: assignedProposalNumber }));
        // Refresh local proposals list to include the new ID
        fetchProposals(userGroup.id);
      }
      setSaveStatus("All changes saved");
    } catch (error) {
      console.error(error);
      setSaveStatus("Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProposal = async (status: "Draft" | "Pending") => {
    if (!userGroup) {
      setToastTitle("Submission Failed");
      setToastMessage("Team information not found. Please ensure you are logged into an active student team.");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 5000);
      return;
    }

    if (status === "Draft") {
      // Enforce 3-proposal limit for new draft proposals
      if (!currentProposal.id && proposals.length >= 3) {
        setToastTitle("Proposal Limit Reached");
        setToastMessage("Maximum of 3 proposals reached. Each team can submit at most 3 proposals.");
        setShowToast(true);
        setTimeout(() => setShowToast(false), 4000);
        return;
      }

      // Capital & Copyright Validation for drafts
      const capitalVal = checkTotalCapital(currentProposal.totalCapital);
      if (capitalVal.isNegative) {
        setToastTitle("Invalid Capital Amount");
        setToastMessage(capitalVal.errorMessage || "Total capital cannot be negative.");
        setShowToast(true);
        setTimeout(() => setShowToast(false), 4000);
        return;
      }

      const nameVal = checkBusinessName(currentProposal.businessName, copyrightDB || undefined);
      if (nameVal.isCopyrighted) {
        setToastTitle("Copyright Warning");
        setToastMessage(nameVal.errorMessage || "Business name matches a copyrighted name.");
        setShowToast(true);
        setTimeout(() => setShowToast(false), 4000);
        return;
      }

      const taglineVal = checkTagline(currentProposal.tagline, copyrightDB || undefined);
      if (taglineVal.isCopyrighted) {
        setToastTitle("Copyright Warning");
        setToastMessage(taglineVal.errorMessage || "Tagline matches a copyrighted tagline.");
        setShowToast(true);
        setTimeout(() => setShowToast(false), 4000);
        return;
      }

      setIsSaving(true);
    } else {
      // status === "Pending" (Submit to Adviser)
      const reasons: {
        type: "missing" | "copyright" | "capital" | "quota" | "error";
        title: string;
        description: string;
        items?: string[];
      }[] = [];

      // 1. Quota Check
      if (!currentProposal.id && proposals.length >= 3) {
        reasons.push({
          type: "quota",
          title: "Proposal Limit Reached (Max 3 Allowed)",
          description: "Your team already has 3 proposals on file. Each team can submit at most 3 proposals. Please delete an existing proposal before creating or submitting a new one.",
        });
      }

      // 2. Required Fields Check
      const missingLabels: string[] = [];

      const requiredFieldConfigs: { key: keyof ProposalData; label: string }[] = [
        { key: "businessType", label: "Business Type" },
        { key: "businessName", label: "Business / Company Name" },
        { key: "totalCapital", label: "Total Capital" },
        { key: "tagline", label: "Tagline" },
        { key: "targetMarket", label: "Target Market" },
        { key: "missionStatement", label: "Mission Statement" },
        { key: "visionStatement", label: "Vision Statement" },
        { key: "productDescription", label: "Product Description" },
        { key: "priceRanges", label: "Price Ranges" },
        { key: "proposedLocation", label: "Proposed Location" },
        { key: "promotionalStrategy", label: "Promotional Strategy" },
      ];

      requiredFieldConfigs.forEach(({ key, label }) => {
        const val = currentProposal[key];
        const isEmpty = !val || (typeof val === "string" && val.trim() === "");
        if (isEmpty) {
          missingLabels.push(label);
        } else if (key === "businessType" && val === "Other") {
          // If 'Other' was selected without specifying a custom business type
          missingLabels.push("Business Type (Specify Custom Type)");
        }
      });

      if (missingLabels.length > 0) {
        reasons.push({
          type: "missing",
          title: `Incomplete Fields (${missingLabels.length} Missing)`,
          description: "All required sections of the proposal must be filled out before submitting to your adviser for review.",
          items: missingLabels,
        });
      }

      // 3. Capital Validation
      const capitalVal = checkTotalCapital(currentProposal.totalCapital);
      if (capitalVal.isNegative) {
        reasons.push({
          type: "capital",
          title: "Invalid Capital Amount",
          description: capitalVal.errorMessage || "Total capital cannot be negative. Please enter a valid non-negative amount.",
        });
      }

      // 4. Business Name Conflict / Copyright Check
      const nameVal = checkBusinessName(currentProposal.businessName, copyrightDB || undefined);
      if (nameVal.isCopyrighted) {
        reasons.push({
          type: "copyright",
          title: "Business Name Trademark / Brand Conflict",
          description: nameVal.errorMessage || `The proposed name "${currentProposal.businessName}" matches a protected brand or registered entity. Please choose an original name.`,
        });
      }

      // 5. Tagline Conflict / Copyright Check
      const taglineVal = checkTagline(currentProposal.tagline, copyrightDB || undefined);
      if (taglineVal.isCopyrighted) {
        reasons.push({
          type: "copyright",
          title: "Tagline Trademark / Brand Conflict",
          description: taglineVal.errorMessage || `The proposed tagline "${currentProposal.tagline}" matches a protected slogan. Please create an original tagline.`,
        });
      }

      // If any validation reasons exist, show them clearly!
      if (reasons.length > 0) {
        setHighlightMissingFields(true);
        setSubmissionFailureReasons(reasons);
        setShowSubmissionFailureModal(true);

        const summaryText = reasons
          .map((r) => r.type === "missing" ? `${r.title}: ${r.items?.join(", ")}` : `${r.title}: ${r.description}`)
          .join(" • ");

        setToastTitle("Proposal Submission Failed");
        setToastMessage(`Cannot submit proposal:\n${summaryText}`);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 7000);
        return;
      }

      setIsSubmitting(true);
    }

    // Optional server validation of proposal limit
    try {
      const backendUrl = (import.meta as any).env?.VITE_API_URL || "http://localhost:10000";
      const limitRes = await fetch(`${backendUrl}/api/teams/${userGroup.id}/proposals/count`);
      if (limitRes.ok) {
        const limitData = await limitRes.json();
        if (!currentProposal.id && !limitData.allowed) {
          const quotaReason = {
            type: "quota" as const,
            title: "Proposal Limit Reached (Server Verified)",
            description: "Server verification confirmed that your team has reached the maximum of 3 proposals. Further submissions are blocked.",
          };
          setSubmissionFailureReasons([quotaReason]);
          setShowSubmissionFailureModal(true);
          setToastTitle("Proposal Submission Failed");
          setToastMessage(quotaReason.description);
          setShowToast(true);
          setTimeout(() => setShowToast(false), 7000);
          setIsSubmitting(false);
          setIsSaving(false);
          return;
        }
      }
    } catch {
      // If backend network call fails, proceed with client limit check
    }

    try {
      const assignedProposalNumber = currentProposal.proposalNumber || (proposals.length + 1);
      const nowIso = new Date().toISOString();
      const resolvedFacultyId = adviserData?.id || adviserData?.facultyId || userGroup?.facultyId || currentProposal?.facultyId || "";
      const proposalData = cleanFirestoreData({
        ...currentProposal,
        proposalNumber: assignedProposalNumber,
        teamName: userGroup.companyName || userGroup.title || "",
        facultyId: resolvedFacultyId || "",
        groupId: userGroup.id,
        status: status === "Pending" ? "Submitted" : status,
        submissionDate: currentProposal.submissionDate || nowIso,
        adviserRemarks: currentProposal.adviserRemarks || "",
        originalProposalFinancials: currentProposal.originalProposalFinancials || currentProposal.financialData || null,
      });
      if (currentProposal.id) {
        await updateDoc(doc(db, "proposals", currentProposal.id), {
          ...proposalData,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "proposals"), {
          ...proposalData,
          createdAt: serverTimestamp(),
        });
      }
      if (status === "Pending") {
        await updateDoc(doc(db, "groups", userGroup.id), {
          status: "Pending Review",
        });
        setUserGroup((prev) =>
          prev ? { ...prev, status: "Pending Review" } : null,
        );

        // Send Notification to Adviser (New vs Revised Proposal)
        try {
          const isExistingProposal = Boolean(currentProposal.id);
          const wasRevision = currentProposal.status === "Revision Required" || currentProposal.status === "Revision" || currentProposal.status === "Pending";
          const isRevision = isExistingProposal && (wasRevision || proposals.some(p => p.id === currentProposal.id));

          const notifTitle = isRevision ? "Proposal Revised & Resubmitted 🔄" : "New Proposal Submitted 📋";
          const notifMessage = isRevision
            ? `Team "${userGroup.companyName || userGroup.title}" has revised and resubmitted proposal "${proposalData.businessName}" for your review.`
            : `Team "${userGroup.companyName || userGroup.title}" submitted new proposal "${proposalData.businessName}" for your review.`;

          if (userGroup.section) {
            await notifyAdvisersForSection(userGroup.section, {
              title: notifTitle,
              message: notifMessage,
              type: "proposal",
              link: "/adviser/dashboard",
              senderName: userName
            });
          } else if (resolvedFacultyId) {
            await sendNotification({
              userId: resolvedFacultyId,
              title: notifTitle,
              message: notifMessage,
              type: "proposal",
              link: "/adviser/dashboard",
              senderName: userName
            });
          }
        } catch (notifErr) {
          console.error("Adviser notification query failed:", notifErr);
        }
      }
      await fetchProposals(userGroup.id);
      setActiveView("dashboard");
      setCurrentProposal(initialProposalState);
      setHighlightMissingFields(false);
      setShowSubmissionFailureModal(false);
      setSubmissionFailureReasons([]);
      setToastTitle("Proposal Submitted");
      setToastMessage("Your proposal has been successfully submitted to your adviser for review!");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 5000);
    } catch (error: any) {
      console.error(error);
      const dbErrorReason = {
        type: "error" as const,
        title: "Database Save Failed",
        description: error?.message || "Failed to save proposal to the database. Please check your internet connection or team permissions.",
      };
      setSubmissionFailureReasons([dbErrorReason]);
      setShowSubmissionFailureModal(true);
      setToastTitle("Proposal Submission Failed");
      setToastMessage(`Failed to save proposal.\nReason: ${error?.message || "Database connection error."}`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 7000);
    } finally {
      setIsSaving(false);
      setIsSubmitting(false);
    }
  };

  const handleDeleteProposal = async (proposalId: string) => {
    try {
      await deleteDoc(doc(db, "proposals", proposalId));

      // If the deleted proposal was the active business, clear it from the group
      if (userGroup && userGroup.activeProposalId === proposalId) {
        await updateDoc(doc(db, "groups", userGroup.id), {
          activeProposalId: "",
          status: "Drafting",
          title: "Feasibility Project"
        });

        setUserGroup(prev => prev ? {
          ...prev,
          activeProposalId: "",
          status: "Drafting",
          title: "Feasibility Project"
        } : null);
      }

      setProposals((prev) => prev.filter((p) => p.id !== proposalId));
      setOpenDropdownId(null);
    } catch (error) {
      console.error(error);
    }
  };

  const handleLockInBusiness = async () => {
    if (!userGroup || !currentProposal.id) return;
    try {
      await updateDoc(doc(db, "groups", userGroup.id), {
        status: "Active Business",
        activeProposalId: currentProposal.id,
        businessName: currentProposal.businessName,
        businessLogo: currentProposal.businessLogo || "",
        title: currentProposal.businessName,
      });

      sessionStorage.setItem("lastSelectedProjectId", currentProposal.id);

      setUserGroup((prev) =>
        prev
          ? {
            ...prev,
            status: "Active Business",
            activeProposalId: currentProposal.id,
            businessName: currentProposal.businessName,
            businessLogo: currentProposal.businessLogo || "",
            title: currentProposal.businessName,
          }
          : null,
      );

      // Notify Adviser of Business Activation
      try {
        let targetFacultyId = adviserData?.id || adviserData?.facultyId || userGroup?.facultyId || "";
        if (!targetFacultyId && userGroup.section) {
          const advQ = query(collection(db, "users"), where("role", "==", "Adviser"));
          const advSnap = await getDocs(advQ);
          advSnap.forEach((d) => {
            const advData = d.data();
            if (advData.section && advData.section.split(",").map((s: string) => s.trim()).includes(userGroup.section)) {
              targetFacultyId = d.id;
            }
          });
        }
        if (targetFacultyId) {
          sendNotification({
            userId: targetFacultyId,
            title: "Business Activated",
            message: `Team "${userGroup.companyName || userGroup.title}" has officially activated their business "${currentProposal.businessName}".`,
            type: "group",
            link: "/adviser/dashboard",
            senderName: userName
          }).catch(err => console.error("Adviser activation notification failed:", err));
        }
      } catch (notifErr) {
        console.error("Adviser activation notification query failed:", notifErr);
      }

      setShowLockInModal(false);
      setActiveView("active-business");
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdateBasicInfo = async () => {
    if (!userGroup || !userGroup.activeProposalId) return;

    // Capital & Copyright Validation
    const capitalVal = checkTotalCapital(editBasicData.totalCapital);
    if (capitalVal.isNegative) {
      setToastTitle("Invalid Capital Amount");
      setToastMessage(capitalVal.errorMessage || "Total capital cannot be negative.");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
      return;
    }

    const nameVal = checkBusinessName(editBasicData.businessName, copyrightDB || undefined);
    if (nameVal.isCopyrighted) {
      setToastTitle("Copyright Warning");
      setToastMessage(nameVal.errorMessage || "Business name matches a copyrighted name.");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
      return;
    }

    const taglineVal = checkTagline(editBasicData.tagline, copyrightDB || undefined);
    if (taglineVal.isCopyrighted) {
      setToastTitle("Copyright Warning");
      setToastMessage(taglineVal.errorMessage || "Tagline matches a copyrighted tagline.");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
      return;
    }

    // Validation
    const requiredFields: (keyof ProposalData)[] = [
      "businessType",
      "businessName",
      "totalCapital",
      "tagline",
      "targetMarket",
      "missionStatement",
      "visionStatement",
      "productDescription",
      "priceRanges",
      "proposedLocation",
      "promotionalStrategy",
    ];

    const missingFields = requiredFields.filter((field) => {
      const value = editBasicData[field];
      return !value || (typeof value === "string" && value.trim() === "");
    });

    if (missingFields.length > 0) {
      const fieldLabels: Record<string, string> = {
        businessType: "Business Type",
        businessName: "Business / Company Name",
        totalCapital: "Total Capital",
        tagline: "Tagline",
        targetMarket: "Target Market",
        missionStatement: "Mission Statement",
        visionStatement: "Vision Statement",
        productDescription: "Product Description",
        priceRanges: "Price Ranges",
        proposedLocation: "Proposed Location",
        promotionalStrategy: "Promotional Strategy",
      };
      const missingLabels = missingFields.map((f) => fieldLabels[f] || f);
      setToastTitle("Incomplete Information");
      setToastMessage(`Please fill in all required fields: ${missingLabels.join(", ")}.`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 5000);
      return;
    }

    setIsSaving(true);
    try {
      await updateDoc(doc(db, "groups", userGroup.id), {
        title: editBasicData.businessName,
        businessName: editBasicData.businessName,
        businessLogo: editBasicData.businessLogo || "",
      });

      const proposalRef = doc(db, "proposals", userGroup.activeProposalId);
      await updateDoc(proposalRef, {
        businessName: editBasicData.businessName,
        businessLogo: editBasicData.businessLogo || "",
        businessType: editBasicData.businessType,
        totalCapital: editBasicData.totalCapital,
        contributorsCount: editBasicData.contributorsCount || "1",
        tagline: editBasicData.tagline,
        missionStatement: editBasicData.missionStatement,
        visionStatement: editBasicData.visionStatement,
        targetMarket: editBasicData.targetMarket,
        productDescription: editBasicData.productDescription,
        priceRanges: editBasicData.priceRanges,
        proposedLocation: editBasicData.proposedLocation,
        promotionalStrategy: editBasicData.promotionalStrategy,
        otherDetails: editBasicData.otherDetails,
        updatedAt: serverTimestamp(),
      });

      setUserGroup((prev) =>
        prev ? {
          ...prev,
          title: editBasicData.businessName,
          businessName: editBasicData.businessName,
          businessLogo: editBasicData.businessLogo || "",
        } : null,
      );
      setProposals((prev) =>
        prev.map((p) =>
          p.id === userGroup.activeProposalId
            ? { ...editBasicData, id: p.id }
            : p,
        ),
      );

      setShowEditBasicModal(false);
    } catch (error: any) {
      console.error("Error updating info:", error);
      setToastTitle("Update Failed");
      setToastMessage(`Failed to update proposal information. Reason: ${error?.message || "Database connection error."}`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const renderSidebar = () => (
    <>
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[50] lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <aside
        className={`flex flex-col fixed inset-y-0 z-[60] bg-[#122244] text-white shadow-xl transition-[width,transform] duration-300 ease-in-out group overflow-x-hidden ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          } w-64 lg:w-16 lg:hover:w-64`}
      >
        {/* Logo Section */}
        <div className="h-16 flex items-center justify-center px-3 border-b border-white/10 shrink-0 overflow-hidden">
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
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto overflow-x-hidden">
          <button
            onClick={() => navigate("/dashboard")}
            title="Dashboard"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-200 hover:text-white hover:bg-white/10 transition-colors group"
          >
            <LayoutDashboard className="w-5 h-5 shrink-0 text-[#c9a654] group-hover:text-[#f0c242] transition-colors" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              Dashboard
            </span>
          </button>
          <button
            title="Business Proposal"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-bold bg-[#c9a654] text-[#122244] transition-all shadow-md"
          >
            <Folder className="w-5 h-5 shrink-0 text-[#122244]" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              Business Proposal
            </span>
          </button>
          <button
            onClick={() => navigate("/financial-input")}
            title="Financial Input"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-200 hover:text-white hover:bg-white/10 transition-colors group"
          >
            <FileEdit className="w-5 h-5 shrink-0 text-[#c9a654] group-hover:text-[#f0c242] transition-colors" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              Financial Input
            </span>
          </button>
          <button
            onClick={() => navigate("/ai-analysis")}
            title="AI Feasibility Analysis"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-200 hover:text-white hover:bg-white/10 transition-colors group"
          >
            <Zap className="w-5 h-5 shrink-0 text-[#c9a654] group-hover:text-[#f0c242] transition-colors" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              AI Feasibility Analysis
            </span>
          </button>
          <button
            onClick={() => navigate("/reports")}
            title="Reports"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-200 hover:text-white hover:bg-white/10 transition-colors group"
          >
            <BarChart3 className="w-5 h-5 shrink-0 text-[#c9a654] group-hover:text-[#f0c242] transition-colors" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              Reports
            </span>
          </button>
          <button
            onClick={() => navigate("/messages")}
            title="Message"
            className="w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-medium text-gray-200 hover:text-white hover:bg-white/10 transition-colors group"
          >
            <MessageCircle className="w-5 h-5 shrink-0 text-[#c9a654] group-hover:text-[#f0c242] transition-colors" />
            <span className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 delay-75 truncate whitespace-nowrap">
              Message
            </span>
          </button>
          <button
            onClick={() => navigate("/settings")}
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
    </>
  );

  const filteredProposals =
    dashboardTab === "All Proposals"
      ? proposals
      : proposals.filter(
        (p) =>
          p.status === (dashboardTab === "Drafts" ? "Draft" : dashboardTab),
      );

  if (activeView === "loading") {
    const cachedCount = parseInt(sessionStorage.getItem('projectsProposalCount') || '3', 10) || 3;
    return (
      <div className="flex min-h-screen bg-gray-50/50">
        {renderSidebar()}
        <main className={`flex-1 transition-all duration-300 ${isSidebarOpen ? "lg:ml-16" : "ml-0"}`}>
          <div className="bg-white border-b border-gray-200/80 shadow-[0_3px_10px_rgba(0,0,0,0.06)] px-6 py-3.5 flex items-center justify-between text-sm text-gray-500 sticky top-0 z-20">
            <div className="flex items-center gap-2.5">
              <span
                className="font-semibold text-gray-900 hover:text-[#c9a654] cursor-pointer transition-colors"
                onClick={() => navigate("/dashboard")}
              >
                FeasiFy
              </span>
              <span className="text-gray-400">›</span>
              <span className="font-semibold text-gray-900">Business Proposal</span>
              <span className="text-gray-300">|</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#122244] text-white shadow-xs tracking-wide">
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
          <div className="p-6 md:p-8 max-w-6xl mx-auto">
            <Skeleton width={250} height={36} className="mb-2" />
            <div className="bg-[#122244] rounded-xl mb-6 flex items-center p-6 gap-6">
              <Skeleton width={80} height={80} borderRadius={16} highlightColor="#2a3c5a" baseColor="#1a2942" />
              <div>
                <Skeleton width={120} height={16} className="mb-2" highlightColor="#2a3c5a" baseColor="#1a2942" />
                <Skeleton width={200} height={24} className="mb-1" highlightColor="#2a3c5a" baseColor="#1a2942" />
                <Skeleton width={150} height={12} highlightColor="#2a3c5a" baseColor="#1a2942" />
              </div>
            </div>
            <div className="flex justify-between items-center mb-6">
              <Skeleton width={200} height={28} />
              <Skeleton width={120} height={36} borderRadius={8} />
            </div>
            <div className="flex space-x-6 border-b border-gray-200 mb-6">
              <Skeleton width={400} height={24} />
            </div>
            <div className="space-y-4">
              {Array.from({ length: cachedCount }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border-2 border-gray-200 p-5 flex items-center justify-between">
                  <div className="flex gap-4 items-center">
                    <Skeleton width={48} height={48} borderRadius={8} />
                    <div>
                      <Skeleton width={180} height={20} className="mb-1" />
                      <Skeleton width={100} height={12} />
                    </div>
                  </div>
                  <Skeleton width={150} height={36} borderRadius={8} />
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  const activeBusiness = proposals.find(
    (p) => p.id === userGroup?.activeProposalId,
  );

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      {renderSidebar()}

      <main
        className={`flex-1 transition-all duration-300 ${isSidebarOpen ? "lg:ml-16" : "ml-0"}`}
      >
        <div className="bg-white border-b border-gray-200/80 shadow-[0_3px_10px_rgba(0,0,0,0.06)] px-6 py-3.5 flex items-center justify-between text-sm text-gray-500 sticky top-0 z-20">
          <div className="flex items-center gap-2.5">
            <span
              className="font-semibold text-gray-900 hover:text-[#c9a654] cursor-pointer transition-colors"
              onClick={() => navigate("/dashboard")}
            >
              FeasiFy
            </span>
            <span className="text-gray-400">›</span>
            <span className="font-semibold text-gray-900">Business Proposal</span>
            <span className="text-gray-300">|</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#122244] text-white shadow-xs tracking-wide">
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

        <div className="p-6 md:p-8 max-w-6xl mx-auto">
          {activeView === "no-group" && (
            <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-gray-400" />
              </div>
              <h2 className="text-xl font-bold text-[#122244]">
                Not Assigned Yet
              </h2>
              <p className="text-gray-500 mt-2 max-w-md">
                Your adviser has not assigned you to a feasibility group yet.
              </p>
            </div>
          )}

          {activeView === "leader-setup" && (
            <div>
              <h1 className="text-3xl font-extrabold text-[#3d2c23] mb-1">
                Company Name
              </h1>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 flex flex-col items-center text-center min-h-[400px] justify-center border-dashed">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                  <Star className="w-8 h-8 text-blue-500" />
                </div>
                <h2 className="text-2xl font-bold text-[#122244] mb-2">
                  You're assigned as Group Leader!
                </h2>
                <button
                  onClick={() => {
                    const rawCompName = (userGroup?.companyName && userGroup.companyName !== "Pending Business Name" && userGroup.companyName !== "Pending Company Name")
                      ? userGroup.companyName
                      : (userGroup?.title && userGroup.title !== "Pending Business Name" && userGroup.title !== "Pending Company Name" && userGroup.title !== "Feasibility Project" ? userGroup.title : "");
                    setSetupCompanyName(rawCompName);
                    setCompanyNameQuery(rawCompName);
                    setSetupLogoPreview(userGroup?.companyLogo || "");
                    setSetupLogoFile(null);
                    setSetupMission(userGroup?.mission || "");
                    setSetupVision(userGroup?.vision || "");
                    setSetupObjectives(userGroup?.objectives && userGroup.objectives.length > 0 ? userGroup.objectives : [""]);
                    setSetupErrors({});
                    setShowSetupModal(true);
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-[#c9a654] text-white font-bold rounded-lg hover:bg-[#b59545] shadow-md transition-all"
                >
                  <Star className="w-4 h-4 fill-current" /> Set up team
                </button>
              </div>
            </div>
          )}

          {activeView === "member-join" && (
            <div>
              <h1 className="text-3xl font-extrabold text-[#3d2c23] mb-1">
                Company Name
              </h1>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 flex flex-col items-center text-center min-h-[400px] justify-center">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-6 border border-blue-100">
                  <Bell className="w-8 h-8 text-blue-500" />
                </div>
                <h2 className="text-2xl font-bold text-[#122244] mb-2">
                  You're added to a group!
                </h2>
                <button
                  onClick={handleJoinGroup}
                  className="flex items-center gap-2 px-8 py-3 bg-[#c9a654] text-white font-bold rounded-lg hover:bg-[#b59545] shadow-md transition-all"
                >
                  <Check className="w-5 h-5" /> Join Workspace
                </button>
              </div>
            </div>
          )}

          {activeView === "dashboard" && userGroup && (() => {
            const currentCompanyName = (userGroup.companyName && userGroup.companyName !== "Pending Business Name" && userGroup.companyName !== "Pending Company Name")
              ? userGroup.companyName
              : (userGroup.title && userGroup.title !== "Pending Business Name" && userGroup.title !== "Pending Company Name" && userGroup.title !== "Feasibility Project"
                ? userGroup.title
                : "Pending Company Name");

            return (
              <div>
                <h1 className="text-3xl font-extrabold text-[#3d2c23] mb-1">
                  Company Name
                </h1>
                <div className="bg-[#122244] rounded-xl shadow-md overflow-hidden mb-6 flex flex-col md:flex-row items-center justify-between p-6 text-white relative">
                  <div className="flex items-center gap-6 z-10 w-full md:w-auto">
                    <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 shadow-inner flex-shrink-0 overflow-hidden">
                      {userGroup.companyLogo ? (
                        <img
                          src={userGroup.companyLogo}
                          alt="Company Logo"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl font-bold text-white tracking-widest">
                          {getInitials(currentCompanyName)}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest bg-[#4285F4] px-2 py-1 rounded">
                          PROPOSAL PHASE
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 text-gray-300">
                          <User className="w-3 h-3" /> SECTION:{" "}
                          {userGroup.section}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold mb-1">
                          {currentCompanyName}
                        </h1>
                        {isLeader && (
                          <button
                            onClick={() => {
                              const cn = currentCompanyName !== "Pending Company Name" ? currentCompanyName : "";
                              setSetupCompanyName(cn);
                              setCompanyNameQuery(cn);
                              setSetupLogoPreview(userGroup.companyLogo || "");
                              setSetupLogoFile(null);
                              setSetupMission(userGroup.mission || "");
                              setSetupVision(userGroup.vision || "");
                              setSetupObjectives(userGroup.objectives && userGroup.objectives.length > 0 ? userGroup.objectives : [""]);
                              setSetupErrors({});
                              setShowSetupModal(true);
                            }}
                            className="p-1 text-gray-300 hover:text-white hover:bg-white/10 rounded transition-colors"
                            title="Edit Team Info"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">
                        + Adviser: Prof.{" "}
                        {adviserData ? adviserData.lastName : "Cruz"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowRosterModal(true)}
                    className="mt-6 md:mt-0 flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 hover:bg-white/20 rounded-lg text-sm font-bold transition-all z-10"
                  >
                    <Users className="w-4 h-4" /> {(userGroup?.memberIds?.length || 0) + 1}{" "}
                    Members{" "}
                    <span className="text-[10px] uppercase ml-1">View Team</span>
                  </button>
                </div>

                {/* Mission / Vision / Objectives card */}
                {(userGroup.mission || userGroup.vision || (userGroup.objectives && userGroup.objectives.length > 0)) && (
                  <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {userGroup.mission && (
                      <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#c9a654] mb-1">Mission</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{userGroup.mission}</p>
                      </div>
                    )}
                    {userGroup.vision && (
                      <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#122244] mb-1">Vision</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{userGroup.vision}</p>
                      </div>
                    )}
                    {userGroup.objectives && userGroup.objectives.length > 0 && (
                      <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-widest text-green-600 mb-2">Objectives</p>
                        <ol className="list-decimal list-inside space-y-1">
                          {userGroup.objectives.map((obj, idx) => (
                            <li key={idx} className="text-sm text-gray-700 leading-snug">{obj}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                )}

                {userGroup.status === "Active Business" && activeBusiness && (
                  <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3 text-green-700">
                      <CheckCircle2 size={20} />
                      <p className="text-sm font-bold">
                        Currently Active:{" "}
                        <span className="underline">
                          {activeBusiness.businessName}
                        </span>
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveView("active-business")}
                      className="text-xs font-black uppercase text-green-800 hover:underline"
                    >
                      View Active Details
                    </button>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-bold text-[#122244]">
                      Business Proposals
                    </h2>
                    <span className={`px-3 py-1 text-xs font-black rounded-full border ${proposals.length >= 3
                      ? "bg-amber-50 text-amber-800 border-amber-300"
                      : "bg-blue-50 text-[#4285F4] border-blue-200"
                      }`}>
                      Proposals: {proposals.length} / 3
                    </span>
                    {proposals.length >= 3 && (
                      <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-md">
                        Maximum of 3 proposals reached.
                      </span>
                    )}
                  </div>
                  <div className="relative group">
                    <button
                      onClick={() => {
                        if (proposals.length >= 3) {
                          setToastTitle("Proposal Limit Reached");
                          setToastMessage("Maximum of 3 proposals reached. Each team can submit at most 3 proposals.");
                          setShowToast(true);
                          setTimeout(() => setShowToast(false), 4000);
                          return;
                        }
                        setCurrentProposal(initialProposalState);
                        setHighlightMissingFields(false);
                        setShowSubmissionFailureModal(false);
                        setSubmissionFailureReasons([]);
                        setIsEditingMode(true);
                        setSaveStatus("All changes saved");
                        setActiveView("form");
                      }}
                      disabled={!!activeBusiness || proposals.length >= 3}
                      className={`flex items-center gap-2 px-5 py-2.5 font-bold rounded-lg shadow-md transition-all text-sm ${activeBusiness || proposals.length >= 3
                        ? "bg-gray-400 cursor-not-allowed opacity-70 text-white"
                        : "bg-[#c9a654] text-white hover:bg-[#b59545]"
                        }`}
                    >
                      + New Proposal
                    </button>
                    {(activeBusiness || proposals.length >= 3) && (
                      <div className="absolute bottom-full right-0 sm:left-1/2 sm:-translate-x-1/2 mb-2.5 px-3 py-1.5 bg-[#122244] text-white text-[11px] font-bold rounded-lg opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 transition-all duration-150 pointer-events-none whitespace-nowrap shadow-xl z-50 flex flex-col items-center border border-white/10">
                        {activeBusiness ? "Already has Approved Business" : "Maximum of 3 proposals reached."}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-[#122244]"></div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex space-x-6 border-b border-gray-200 mb-6">
                  {[
                    "All Proposals",
                    "Drafts",
                    "Pending",
                    "Approved",
                    "Rejected",
                    "Revision"
                  ].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setDashboardTab(tab as any)}
                      className={`pb-3 text-sm font-bold transition-colors border-b-2 ${dashboardTab === tab ? "border-[#4285F4] text-[#4285F4]" : "border-transparent text-gray-500 hover:text-gray-800"}`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {proposals.length === 0 ? (
                  <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 py-20 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4 border border-gray-100">
                      <FileText className="w-8 h-8 text-gray-300" />
                    </div>
                    <h3 className="text-lg font-bold text-[#122244]">
                      No proposals yet
                    </h3>
                  </div>
                ) : filteredProposals.length === 0 ? (
                  <p className="text-center text-gray-500 py-12">
                    No proposals found for this filter.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {filteredProposals.map((proposal, idx) => {
                      let isApproved = proposal.status === "Approved";
                      let isRejected = proposal.status === "Rejected";
                      let isRevision = proposal.status === "Revision" || proposal.status === "Revision Required";

                      return (
                        <div
                          key={proposal.id}
                          className={`bg-white rounded-xl border-2 p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isApproved ? "border-green-400" :
                            isRejected ? "border-red-300" :
                              isRevision ? "border-orange-300" : "border-gray-200"
                            }`}
                        >
                          <div className="flex gap-4 items-center w-full sm:w-auto flex-1">
                            <div
                              className={`w-12 h-12 rounded-xl flex flex-shrink-0 items-center justify-center font-bold text-sm overflow-hidden border shadow-2xs ${proposal.businessLogo
                                ? "border-gray-200 bg-white"
                                : isApproved
                                  ? "bg-green-50 border-green-200 text-green-600"
                                  : isRejected
                                    ? "bg-red-50 border-red-200 text-red-600"
                                    : isRevision
                                      ? "bg-orange-50 border-orange-200 text-orange-600"
                                      : "bg-blue-50 border-blue-100 text-[#4285F4]"
                                }`}
                            >
                              {proposal.businessLogo ? (
                                <img src={proposal.businessLogo} alt="Logo" className="w-full h-full object-cover" />
                              ) : (
                                getInitials(proposal.businessName || proposal.businessType || "Draft")
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                                <span className="px-2 py-0.5 bg-[#122244] text-white text-[10px] font-black rounded uppercase tracking-wider">
                                  Proposal {proposal.proposalNumber || idx + 1}
                                </span>
                                <h3 className="font-bold text-[#122244] text-base truncate max-w-[280px]">
                                  {proposal.businessName || "Untitled Proposal"}
                                </h3>
                                <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${proposal.status === 'Approved' ? 'bg-green-100 text-green-700' :
                                  proposal.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                                    proposal.status === 'Revision' || proposal.status === 'Revision Required' ? 'bg-orange-100 text-orange-700' :
                                      proposal.status === 'Pending' || proposal.status === 'Submitted' ? 'bg-yellow-100 text-yellow-700' :
                                        proposal.status === 'Under Review' ? 'bg-blue-100 text-blue-700' :
                                          'bg-gray-100 text-gray-600'
                                  }`}>
                                  {proposal.status === 'Revision' ? 'Needs Revision' : proposal.status}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider truncate">
                                {proposal.businessType || "No Category Selected"}
                              </p>
                              {(proposal.createdAt || proposal.submissionDate) && (
                                <div className="flex items-center text-gray-400 mt-1.5 gap-1.5 text-xs font-medium">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>
                                    Submitted: {formatDateTime(proposal.createdAt || proposal.submissionDate)}
                                  </span>
                                </div>
                              )}
                              {proposal.adviserRemarks && (
                                <div className="mt-2 text-xs text-blue-900 bg-blue-50/80 border border-blue-100 rounded-lg p-2 flex items-start gap-1.5">
                                  <span className="font-bold uppercase tracking-wider text-[10px] text-blue-600 flex-shrink-0">Remarks:</span>
                                  <span className="line-clamp-2">{proposal.adviserRemarks}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            {isApproved ? (
                              userGroup?.activeProposalId === proposal.id ? (
                                <button
                                  onClick={() => setActiveView("active-business")}
                                  className="px-5 py-2.5 bg-blue-600 text-white font-bold text-sm rounded-lg hover:bg-blue-700 w-full sm:w-auto flex items-center justify-center gap-2 transition-all shadow-sm"
                                >
                                  <FileText className="w-4 h-4" /> View Details
                                </button>
                              ) : (
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                  <button
                                    onClick={() => {
                                      setCurrentProposal(proposal);
                                      setHighlightMissingFields(false);
                                      setShowSubmissionFailureModal(false);
                                      setSubmissionFailureReasons([]);
                                      setIsEditingMode(false);
                                      setActiveView("form");
                                    }}
                                    className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm rounded-lg flex items-center gap-1.5 transition-colors"
                                  >
                                    <FileText className="w-4 h-4" /> View
                                  </button>
                                  <button
                                    onClick={() => {
                                      setCurrentProposal(proposal);
                                      setShowLockInModal(true);
                                    }}
                                    disabled={!!activeBusiness}
                                    className={`px-5 py-2.5 text-white font-bold text-sm rounded-lg w-full sm:w-auto flex items-center justify-center gap-1.5 transition-all ${activeBusiness
                                      ? "bg-gray-400 cursor-not-allowed opacity-70"
                                      : "bg-green-600 hover:bg-green-700 shadow-md"
                                      }`}
                                    title={activeBusiness ? "Another business is already setup" : "Activate this approved proposal as the official business"}
                                  >
                                    <Zap className="w-4 h-4" /> Activate Business
                                  </button>
                                </div>
                              )
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setCurrentProposal(proposal);
                                    setHighlightMissingFields(false);
                                    setShowSubmissionFailureModal(false);
                                    setSubmissionFailureReasons([]);
                                    setIsEditingMode(false);
                                    setActiveView("form");
                                  }}
                                  className="px-5 py-2 bg-blue-50 text-[#4285F4] font-bold text-sm rounded-lg hover:bg-blue-100 flex items-center gap-2"
                                >
                                  <FileText className="w-4 h-4" /> Open
                                </button>
                                {!isRejected && (
                                  <div className="relative group">
                                    <button
                                      onClick={() => {
                                        setCurrentProposal(proposal);
                                        setHighlightMissingFields(false);
                                        setShowSubmissionFailureModal(false);
                                        setSubmissionFailureReasons([]);
                                        setIsEditingMode(true);
                                        setSaveStatus("All changes saved");
                                        setActiveView("form");
                                      }}
                                      disabled={proposal.status === 'Pending'}
                                      className={`px-5 py-2 font-bold text-sm rounded-lg flex items-center gap-2 transition-all ${proposal.status === 'Pending'
                                        ? "bg-gray-100 text-gray-400 cursor-not-allowed opacity-70"
                                        : "bg-blue-50 text-[#4285F4] hover:bg-blue-100"
                                        }`}
                                    >
                                      <Edit className="w-4 h-4" /> Edit
                                    </button>
                                    {proposal.status === 'Pending' && (
                                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 px-3 py-1.5 bg-[#122244] text-white text-[11px] font-bold rounded-lg opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 transition-all duration-150 pointer-events-none whitespace-nowrap shadow-xl z-50 flex flex-col items-center border border-white/10">
                                        Wait for Revision
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-[#122244]"></div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                            <div className="relative">
                              <button
                                onClick={() =>
                                  setOpenDropdownId(
                                    openDropdownId === proposal.id
                                      ? null
                                      : proposal.id || null,
                                  )
                                }
                                className="p-2 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              {openDropdownId === proposal.id && (
                                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-lg shadow-xl z-10 py-1">
                                  <button
                                    onClick={() => {
                                      setProposalToDelete(proposal);
                                      setShowDeleteConfirmModal(true);
                                      setOpenDropdownId(null);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {activeView === "form" && (() => {
            const fin = currentProposal.financialData || {};
            const productsList = normalizeProposalProducts(fin, currentProposal.businessName);
            const finEquipmentList = fin.equipmentList || [];
            const calculatedEquipmentTotal = finEquipmentList.reduce(
              (sum, item) => sum + (Number(item.total) || ((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))),
              0
            );

            const monthlyLoanInterest = fin.isCapitalBorrowed && Number(fin.interestRate) > 0
              ? (calculatedEquipmentTotal * (Number(fin.interestRate) / 100)) / 12
              : 0;

            return (
              <div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setActiveView("dashboard")}
                      className="flex items-center gap-2 text-sm font-bold text-[#4285F4] hover:text-blue-700"
                    >
                      <ChevronLeft className="w-4 h-4" /> Back to Proposals
                    </button>
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto items-center">
                    {isEditingMode && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-100 shadow-2xs">
                        <span
                          className={`text-xs font-bold flex items-center gap-1.5 ${isSaving ? "text-gray-400 animate-pulse" : "text-green-600"}`}
                        >
                          {isSaving ? <Save size={14} /> : <CheckCircle2 size={14} />} {saveStatus}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-8 border-b border-gray-100 text-center bg-gray-50/50">
                    <h2 className="text-3xl font-extrabold text-[#122244] mb-2">
                      {currentProposal.businessName || "New Business Proposal"}
                    </h2>
                    <div className="w-full max-w-lg mx-auto h-px bg-blue-600 mb-2"></div>
                  </div>

                  <div className="p-8 space-y-10 max-w-4xl mx-auto text-[#122244]">

                    {/* === ADVISER FEEDBACK BANNER IN FORM VIEW === */}
                    {currentProposal.feedbackHistory && currentProposal.feedbackHistory.length > 0 && (
                      <div className={`p-6 rounded-xl border-2 flex flex-col gap-4 mb-8 ${currentProposal.status === 'Rejected' ? 'bg-red-50 border-red-200' :
                        currentProposal.status === 'Approved' ? 'bg-green-50 border-green-200' :
                          'bg-blue-50 border-blue-200'
                        }`}>
                        <div className="flex justify-between items-center mb-4">
                          <h4 className={`text-xs font-extrabold uppercase tracking-widest flex items-center gap-2 ${currentProposal.status === 'Rejected' ? 'text-red-700' :
                            currentProposal.status === 'Approved' ? 'text-green-700' :
                              'text-blue-700'
                            }`}>
                            <MessageCircle className="w-4 h-4" /> Adviser Feedback {currentProposal.feedbackHistory.length > 1 && !showAllFeedback ? "(Latest)" : "History"}
                          </h4>
                          {currentProposal.feedbackHistory.length > 1 && (
                            <button
                              onClick={() => setShowAllFeedback(!showAllFeedback)}
                              className="text-xs font-bold text-blue-600 hover:text-blue-800 underline transition-colors"
                            >
                              {showAllFeedback ? "Show Less" : "View All History"}
                            </button>
                          )}
                        </div>
                        <div className="space-y-3">
                          {(showAllFeedback ? currentProposal.feedbackHistory : currentProposal.feedbackHistory.slice(-1)).map(item => (
                            <div key={item.id} className="bg-white/60 p-4 rounded-lg border border-white/50 shadow-sm">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-sm text-[#122244]">{item.authorName}</span>
                                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-black rounded uppercase tracking-wider">{item.role}</span>
                                </div>
                                <span className="text-[10px] text-gray-500 font-medium">{formatFeedbackDate(item.date)}</span>
                              </div>
                              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{item.text}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <section>
                      <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 mb-6">
                        <FileText className="w-5 h-5 text-blue-500" /> BUSINESS
                        OVERVIEW
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className={highlightMissingFields && (!currentProposal.businessType || currentProposal.businessType === "Other") ? "field-has-error" : ""}>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                            Business Type <span className="text-red-500">*</span>
                          </label>
                          <CustomDropdown
                            disabled={!isEditingMode}
                            value={
                              !currentProposal.businessType
                                ? ""
                                : ["Food & Beverage", "Services"].includes(currentProposal.businessType)
                                  ? currentProposal.businessType
                                  : "Other"
                            }
                            options={businessTypeDropdownOptions}
                            onChange={(newValue) => {
                              const updatedProposal = { ...currentProposal, businessType: newValue };
                              setCurrentProposal(updatedProposal);
                              handleAutoSave(updatedProposal);
                            }}
                          />
                          {currentProposal.businessType &&
                            !["Food & Beverage", "Services", ""].includes(currentProposal.businessType) && (
                              <div className="mt-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
                                <label className="text-[10px] font-bold text-[#c9a654] uppercase tracking-wider block mb-1">
                                  Please specify business type <span className="text-red-500">*</span>
                                </label>
                                <input
                                  disabled={!isEditingMode}
                                  type="text"
                                  value={currentProposal.businessType === "Other" ? "" : currentProposal.businessType}
                                  placeholder="e.g. Technology, Agriculture, Manufacturing..."
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const updatedProposal = {
                                      ...currentProposal,
                                      businessType: val || "Other",
                                    };
                                    setCurrentProposal(updatedProposal);
                                  }}
                                  onBlur={() => handleAutoSave()}
                                  className={`w-full px-4 py-2.5 bg-white border ${highlightMissingFields && currentProposal.businessType === "Other"
                                    ? "border-red-500 ring-1 ring-red-500/20"
                                    : "border-[#c9a654]/40 focus:border-[#c9a654]"
                                    } rounded-lg outline-none text-sm font-medium transition-all shadow-sm`}
                                />
                              </div>
                            )}
                          {highlightMissingFields && (!currentProposal.businessType || currentProposal.businessType === "Other") && (
                            <p className="text-red-500 text-xs font-semibold mt-1.5 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>{currentProposal.businessType === "Other" ? "Please specify your custom business type." : "Business Type is required before submitting."}</span>
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                            Business Logo <span className="text-gray-400 font-normal normal-case">(Optional)</span>
                          </label>
                          <div className="flex items-center gap-3 p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                            <div className="w-12 h-12 rounded-lg border border-gray-200 bg-white flex items-center justify-center overflow-hidden flex-shrink-0 relative group shadow-2xs">
                              {currentProposal.businessLogo ? (
                                <>
                                  <img src={currentProposal.businessLogo} alt="Business Logo" className="w-full h-full object-cover" />
                                  {isEditingMode && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = { ...currentProposal, businessLogo: "" };
                                        setCurrentProposal(updated);
                                        handleAutoSave(updated);
                                      }}
                                      className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                      title="Remove Logo"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </>
                              ) : (
                                <ImageIcon className="w-5 h-5 text-gray-400" />
                              )}
                            </div>
                            {isEditingMode && (
                              <div className="flex-1">
                                <input
                                  type="file"
                                  id="business-logo-input"
                                  accept="image/*"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const compressed = await compressImage(file);
                                    const updated = { ...currentProposal, businessLogo: compressed };
                                    setCurrentProposal(updated);
                                    handleAutoSave(updated);
                                  }}
                                  className="hidden"
                                />
                                <label
                                  htmlFor="business-logo-input"
                                  className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 transition-all shadow-xs"
                                >
                                  <Upload className="w-3.5 h-3.5 text-[#c9a654]" />
                                  {currentProposal.businessLogo ? "Change Logo" : "Upload Logo"}
                                </label>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className={`mb-6 ${highlightMissingFields && !currentProposal.businessName?.trim() ? "field-has-error" : ""}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                            Business Name <span className="text-red-500">*</span>
                          </label>
                          <span className="text-[10px] font-semibold text-gray-500">
                            Official Verification: DTI & SEC
                          </span>
                        </div>
                        {(() => {
                          const check = checkBusinessName(currentProposal.businessName, copyrightDB || undefined);
                          const isMissing = highlightMissingFields && !currentProposal.businessName?.trim();
                          return (
                            <>
                              <input
                                disabled={!isEditingMode}
                                type="text"
                                value={currentProposal.businessName}
                                onChange={(e) =>
                                  setCurrentProposal({
                                    ...currentProposal,
                                    businessName: e.target.value,
                                  })
                                }
                                onBlur={() => handleAutoSave()}
                                placeholder="e.g. EggSarap"
                                className={`w-full px-4 py-3 bg-gray-50 border ${check.isCopyrighted || isMissing ? "border-red-500 bg-red-50/20" : "border-gray-200"
                                  } rounded-lg outline-none text-sm font-medium transition-colors`}
                              />
                              {check.isCopyrighted && (
                                <p className="text-red-500 text-xs font-semibold mt-1.5 flex items-start gap-1">
                                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                  <span>{check.errorMessage}</span>
                                </p>
                              )}
                              {!check.isCopyrighted && isMissing && (
                                <p className="text-red-500 text-xs font-semibold mt-1.5 flex items-start gap-1">
                                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                  <span>Business Name is required before submitting.</span>
                                </p>
                              )}
                            </>
                          );
                        })()}

                        {/* Official DTI & SEC Name Checker Integration */}
                        <div className="mt-3">
                          <OfficialNameChecker
                            currentName={currentProposal.businessName}
                          />
                        </div>
                      </div>

                      <div className={`mb-6 ${highlightMissingFields && !currentProposal.totalCapital?.trim() ? "field-has-error" : ""}`}>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                          Total Capital (₱) <span className="text-red-500">*</span>
                        </label>
                        {(() => {
                          const check = checkTotalCapital(currentProposal.totalCapital);
                          const isMissing = highlightMissingFields && !currentProposal.totalCapital?.trim();
                          return (
                            <>
                              <input
                                disabled={!isEditingMode}
                                type="text"
                                inputMode="decimal"
                                value={currentProposal.totalCapital}
                                onKeyDown={(e) => {
                                  if (
                                    !/[0-9]/.test(e.key) &&
                                    e.key !== "Backspace" &&
                                    e.key !== "Delete" &&
                                    e.key !== "Tab" &&
                                    e.key !== "ArrowLeft" &&
                                    e.key !== "ArrowRight" &&
                                    e.key !== "Home" &&
                                    e.key !== "End" &&
                                    !(e.key === "." && !(currentProposal.totalCapital || "").includes(".")) &&
                                    !e.ctrlKey &&
                                    !e.metaKey
                                  ) {
                                    e.preventDefault();
                                  }
                                }}
                                onChange={(e) => {
                                  let val = e.target.value.replace(/[^0-9.]/g, "");
                                  const parts = val.split(".");
                                  if (parts.length > 2) {
                                    val = parts[0] + "." + parts.slice(1).join("");
                                  }
                                  updateFinancialData({ startupCapital: val });
                                }}
                                onBlur={() => handleAutoSave()}
                                placeholder="0.00"
                                className={`w-full px-4 py-3 bg-gray-50 border ${check.isNegative || isMissing ? "border-red-500 bg-red-50/20" : "border-gray-200"
                                  } rounded-lg outline-none text-sm font-medium transition-colors`}
                              />
                              {check.isNegative && (
                                <p className="text-red-500 text-xs font-semibold mt-1.5 flex items-start gap-1">
                                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                  <span>{check.errorMessage}</span>
                                </p>
                              )}
                              {!check.isNegative && isMissing && (
                                <p className="text-red-500 text-xs font-semibold mt-1.5 flex items-start gap-1">
                                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                  <span>Total Capital is required before submitting.</span>
                                </p>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      <div className={highlightMissingFields && !currentProposal.tagline?.trim() ? "field-has-error" : ""}>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                          Tagline <span className="text-red-500">*</span>
                        </label>
                        {(() => {
                          const check = checkTagline(currentProposal.tagline, copyrightDB || undefined);
                          const isMissing = highlightMissingFields && !currentProposal.tagline?.trim();
                          return (
                            <>
                              <input
                                disabled={!isEditingMode}
                                type="text"
                                value={currentProposal.tagline}
                                onChange={(e) =>
                                  setCurrentProposal({
                                    ...currentProposal,
                                    tagline: e.target.value,
                                  })
                                }
                                onBlur={() => handleAutoSave()}
                                className={`w-full px-4 py-3 bg-gray-50 border ${check.isCopyrighted || isMissing ? "border-red-500 bg-red-50/20" : "border-gray-200"
                                  } rounded-lg outline-none text-sm font-medium transition-colors`}
                              />
                              {check.isCopyrighted && (
                                <p className="text-red-500 text-xs font-semibold mt-1.5 flex items-start gap-1">
                                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                  <span>{check.errorMessage}</span>
                                </p>
                              )}
                              {!check.isCopyrighted && isMissing && (
                                <p className="text-red-500 text-xs font-semibold mt-1.5 flex items-start gap-1">
                                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                  <span>Tagline is required before submitting.</span>
                                </p>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      <div className={highlightMissingFields && !currentProposal.targetMarket?.trim() ? "field-has-error" : ""}>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                          Target Market <span className="text-red-500">*</span>
                        </label>
                        <ExpandingTextarea
                          disabled={!isEditingMode}
                          rows={3}
                          placeholder="Who are your customers?"
                          value={currentProposal.targetMarket}
                          onChange={(e) =>
                            setCurrentProposal({
                              ...currentProposal,
                              targetMarket: e.target.value,
                            })
                          }
                          onBlur={() => handleAutoSave()}
                          className={`w-full px-4 py-3 bg-gray-50 border ${highlightMissingFields && !currentProposal.targetMarket?.trim() ? "border-red-500 bg-red-50/20" : "border-gray-200"
                            } rounded-lg outline-none text-sm resize-none font-medium`}
                        />
                        {highlightMissingFields && !currentProposal.targetMarket?.trim() && (
                          <p className="text-red-500 text-xs font-semibold mt-1.5 flex items-start gap-1">
                            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span>Target Market is required before submitting.</span>
                          </p>
                        )}
                      </div>
                    </section>

                    <section>
                      <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 mb-6">
                        <Star className="w-5 h-5 text-purple-500 fill-current" />{" "}
                        MISSION & VISION
                      </h3>
                      <div className="space-y-6">
                        <div className={highlightMissingFields && !currentProposal.missionStatement?.trim() ? "field-has-error" : ""}>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                            Mission Statement <span className="text-red-500">*</span>
                          </label>
                          <ExpandingTextarea
                            disabled={!isEditingMode}
                            rows={2}
                            value={currentProposal.missionStatement}
                            onChange={(e) =>
                              setCurrentProposal({
                                ...currentProposal,
                                missionStatement: e.target.value,
                              })
                            }
                            onBlur={() => handleAutoSave()}
                            className={`w-full px-4 py-3 bg-gray-50 border ${highlightMissingFields && !currentProposal.missionStatement?.trim() ? "border-red-500 bg-red-50/20" : "border-gray-200"
                              } rounded-lg outline-none text-sm resize-none font-medium`}
                          />
                          {highlightMissingFields && !currentProposal.missionStatement?.trim() && (
                            <p className="text-red-500 text-xs font-semibold mt-1.5 flex items-start gap-1">
                              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                              <span>Mission Statement is required before submitting.</span>
                            </p>
                          )}
                        </div>
                        <div className={highlightMissingFields && !currentProposal.visionStatement?.trim() ? "field-has-error" : ""}>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                            Vision Statement <span className="text-red-500">*</span>
                          </label>
                          <ExpandingTextarea
                            disabled={!isEditingMode}
                            rows={2}
                            value={currentProposal.visionStatement}
                            onChange={(e) =>
                              setCurrentProposal({
                                ...currentProposal,
                                visionStatement: e.target.value,
                              })
                            }
                            onBlur={() => handleAutoSave()}
                            className={`w-full px-4 py-3 bg-gray-50 border ${highlightMissingFields && !currentProposal.visionStatement?.trim() ? "border-red-500 bg-red-50/20" : "border-gray-200"
                              } rounded-lg outline-none text-sm resize-none font-medium`}
                          />
                          {highlightMissingFields && !currentProposal.visionStatement?.trim() && (
                            <p className="text-red-500 text-xs font-semibold mt-1.5 flex items-start gap-1">
                              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                              <span>Vision Statement is required before submitting.</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </section>

                    <section>
                      <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 mb-6">
                        <div className="p-1.5 bg-green-50 rounded-lg">
                          <DollarSign className="w-4 h-4 text-green-600" />
                        </div>{" "}
                        PRODUCT & PRICING
                      </h3>
                      <div className="space-y-6">
                        <div className={highlightMissingFields && !currentProposal.productDescription?.trim() ? "field-has-error" : ""}>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                            Product Description <span className="text-red-500">*</span>
                          </label>
                          <ExpandingTextarea
                            disabled={!isEditingMode}
                            rows={3}
                            placeholder="Describe exactly what you are selling."
                            value={currentProposal.productDescription}
                            onChange={(e) =>
                              setCurrentProposal({
                                ...currentProposal,
                                productDescription: e.target.value,
                              })
                            }
                            onBlur={() => handleAutoSave()}
                            className={`w-full px-4 py-3 bg-gray-50 border ${highlightMissingFields && !currentProposal.productDescription?.trim() ? "border-red-500 bg-red-50/20" : "border-gray-200"
                              } rounded-lg outline-none text-sm resize-none font-medium`}
                          />
                          {highlightMissingFields && !currentProposal.productDescription?.trim() && (
                            <p className="text-red-500 text-xs font-semibold mt-1.5 flex items-start gap-1">
                              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                              <span>Product Description is required before submitting.</span>
                            </p>
                          )}
                        </div>
                        <div className={highlightMissingFields && !currentProposal.priceRanges?.trim() ? "field-has-error" : ""}>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                            Price Ranges <span className="text-red-500">*</span>
                          </label>
                          <ExpandingTextarea
                            disabled={!isEditingMode}
                            rows={2}
                            placeholder="List price ranges: e.g., Budget (₱40-60), Mid-range (₱60-100), Premium (₱100+)"
                            value={currentProposal.priceRanges}
                            onChange={(e) =>
                              setCurrentProposal({
                                ...currentProposal,
                                priceRanges: e.target.value,
                              })
                            }
                            onBlur={() => handleAutoSave()}
                            className={`w-full px-4 py-3 bg-gray-50 border ${highlightMissingFields && !currentProposal.priceRanges?.trim() ? "border-red-500 bg-red-50/20" : "border-gray-200"
                              } rounded-lg outline-none text-sm resize-none font-medium`}
                          />
                          {highlightMissingFields && !currentProposal.priceRanges?.trim() && (
                            <p className="text-red-500 text-xs font-semibold mt-1.5 flex items-start gap-1">
                              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                              <span>Price Ranges is required before submitting.</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </section>

                    {/* === FINANCIAL PROPOSAL & COSTING (FEASIBILITY INPUTS) === */}
                    <section className="bg-gradient-to-br from-amber-50/40 to-blue-50/20 p-6 sm:p-8 rounded-2xl border-2 border-amber-200/70 shadow-sm space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 pb-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 bg-amber-100 text-[#c9a654] rounded-xl flex items-center justify-center shadow-inner">
                            <Calculator className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#122244]">
                              Financial Proposal & Unit Costing
                            </h3>
                            <p className="text-xs text-gray-500 font-medium">
                              Costing, markup strategy & initial capital estimation based on FeasiFy guide
                            </p>
                          </div>
                        </div>
                        <span className="self-start sm:self-auto px-2.5 py-1 bg-amber-100 text-[#b59545] text-[10px] font-black rounded-full uppercase tracking-wider">
                          RA 9178 & BMBE Framework
                        </span>
                      </div>

                      {/* TOTAL CAPITAL HERO CARD */}
                      <div className="bg-gradient-to-r from-[#122244] via-[#1a3060] to-[#122244] p-5 sm:p-6 rounded-2xl border border-amber-300/30 text-white shadow-md relative overflow-hidden space-y-4">
                        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-36 h-36 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                          <div className="space-y-1">
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
                          <div className="text-left sm:text-right bg-white/5 border border-white/10 px-5 py-3 rounded-xl backdrop-blur-sm">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-200/80 block">
                              Total Capital Amount
                            </span>
                            <span className="text-2xl sm:text-3xl font-black text-[#f3d98b] tracking-tight">
                              ₱{(Number(String(currentProposal.totalCapital || "").replace(/,/g, "")) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                        {/* Contributor Count & Allocation Strip */}
                        <div className="pt-3 border-t border-[#c9a654]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10 bg-gradient-to-r from-[#c9a654]/25 via-[#c9a654]/15 to-[#c9a654]/25 p-4 rounded-xl border border-[#c9a654]/50 shadow-sm backdrop-blur-sm">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-[#c9a654] text-[#122244] flex items-center justify-center font-bold shrink-0 shadow-sm">
                              <Users className="w-5 h-5" />
                            </div>
                            <div>
                              <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#fce8a6] block drop-shadow-xs">
                                How many contributors / investors?
                              </label>
                              <p className="text-[10px] text-[#edd59b] font-medium mt-0.5">
                                Number of partners sharing the initial startup capital
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 self-end sm:self-auto">
                            <div className="flex items-center gap-2 bg-[#122244]/85 px-3 py-1.5 rounded-lg border border-[#c9a654]/60 shadow-inner">
                              <span className="text-xs text-[#edd59b] font-bold">Contributors:</span>
                              <input
                                disabled={!isEditingMode}
                                type="number"
                                min="1"
                                max="50"
                                value={currentProposal.contributorsCount || "1"}
                                onKeyDown={handlePreventNegative}
                                onPaste={handlePasteNonNegative}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateFinancialData({ contributorsCount: val });
                                }}
                                onBlur={() => handleAutoSave()}
                                placeholder="1"
                                className="w-16 px-2 py-1 bg-white text-[#122244] font-black text-center text-xs rounded border-2 border-[#c9a654] outline-none focus:ring-2 focus:ring-[#c9a654]/30 disabled:bg-gray-100 disabled:text-gray-600"
                              />
                            </div>
                            {(() => {
                              const numContrib = Math.max(1, Number(currentProposal.contributorsCount) || 1);
                              const totalCap = Number(String(currentProposal.totalCapital || "").replace(/,/g, "")) || 0;
                              const share = totalCap > 0 ? (totalCap / numContrib) : 0;
                              return (
                                <div className="text-right bg-[#122244]/85 px-3.5 py-1.5 rounded-lg border border-[#c9a654]/60 shadow-inner">
                                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#edd59b] block">
                                    Est. Share / Contributor
                                  </span>
                                  <span className="text-sm font-black text-[#ffe89c]">
                                    ₱{share.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* SECTION 1: PROPOSED PRODUCTS */}
                      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 space-y-5 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-[#122244] text-white text-[11px] font-bold flex items-center justify-center shrink-0">1</span>
                            <div>
                              <h4 className="font-bold text-xs uppercase tracking-wider text-[#122244]">
                                Proposed Products
                              </h4>
                              <p className="text-[10px] text-gray-500 font-medium">
                                List the product(s) or service offering(s) your business will produce and offer.
                              </p>
                            </div>
                          </div>
                          {isEditingMode && (
                            <button
                              type="button"
                              onClick={handleAddProduct}
                              className="flex items-center gap-1.5 text-xs font-bold text-[#c9a654] hover:text-[#b59545] bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 hover:bg-amber-100 transition-colors shadow-2xs self-start sm:self-auto"
                            >
                              <Plus size={13} /> Add Product
                            </button>
                          )}
                        </div>

                        {/* PRODUCTS LIST */}
                        <div className="space-y-3">
                          {productsList.map((product, prodIdx) => {
                            const productKey = product.id || String(prodIdx);

                            return (
                              <div
                                key={productKey}
                                className="flex items-center gap-3 p-3 sm:p-3.5 bg-gray-50/80 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors"
                              >
                                <span className="px-3 py-1.5 bg-[#122244] text-white text-[11px] font-black rounded-lg uppercase tracking-wider shadow-2xs shrink-0">
                                  Product #{prodIdx + 1}
                                </span>
                                <div className="flex-1">
                                  <input
                                    disabled={!isEditingMode}
                                    type="text"
                                    placeholder={`Enter Product #${prodIdx + 1} Name`}
                                    value={product.name || ""}
                                    onChange={(e) => handleUpdateProduct(prodIdx, { name: e.target.value })}
                                    className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-[#122244] focus:border-[#c9a654] focus:ring-1 focus:ring-[#c9a654]/30 outline-none disabled:bg-gray-100 disabled:text-gray-600"
                                  />
                                </div>
                                {isEditingMode && productsList.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveProduct(prodIdx)}
                                    className="flex items-center justify-center p-2 text-gray-400 hover:text-red-500 bg-white hover:bg-red-50 border border-gray-200 rounded-lg transition-colors shrink-0"
                                    title="Remove Product"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* SECTION 2: STARTUP EQUIPMENT & ASSETS BREAKDOWN (CAPEX) */}
                      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 space-y-4 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-xs uppercase tracking-wider text-[#122244]">
                              Startup Equipment & Assets Breakdown (CapEx)
                            </h4>
                          </div>
                        </div>

                        {/* CapEx Table */}
                        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-gray-50/80 border-b border-gray-200 text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                              <tr>
                                <th className="py-3 px-4 min-w-[200px]">Item / Asset name</th>
                                <th className="py-3 px-3 w-28 text-center">QTY</th>
                                <th className="py-3 px-3 w-36 text-right">UNIT PRICE</th>
                                <th className="py-3 px-4 w-36 text-right">TOTAL</th>
                                {isEditingMode && <th className="py-3 px-3 w-12 text-center"></th>}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {finEquipmentList.map((item, idx) => (
                                <tr key={item.id || idx} className="hover:bg-gray-50/50 transition-colors">
                                  <td className="p-3">
                                    <input
                                      disabled={!isEditingMode}
                                      type="text"
                                      placeholder="e.g. Machinery / Equipment / Tool"
                                      value={item.name}
                                      onChange={(e) => handleUpdateEquipmentItem(idx, { name: e.target.value })}
                                      className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-[#122244] focus:border-[#c9a654] outline-none"
                                    />
                                  </td>
                                  <td className="p-3">
                                    <input
                                      disabled={!isEditingMode}
                                      type="number"
                                      min="1"
                                      placeholder="1"
                                      value={item.quantity !== undefined ? item.quantity : ""}
                                      onKeyDown={handlePreventNegative}
                                      onPaste={handlePasteNonNegative}
                                      onChange={(e) => handleUpdateEquipmentItem(idx, { quantity: e.target.value === "" ? "" : Math.max(1, Number(e.target.value)) })}
                                      className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-[#122244] text-center focus:border-[#c9a654] outline-none"
                                    />
                                  </td>
                                  <td className="p-3">
                                    <div className="relative">
                                      <span className="absolute left-2.5 top-1.5 text-xs text-gray-400">₱</span>
                                      <input
                                        disabled={!isEditingMode}
                                        type="number"
                                        min="0"
                                        placeholder="0.00"
                                        value={item.unitPrice !== undefined ? item.unitPrice : ""}
                                        onKeyDown={handlePreventNegative}
                                        onPaste={handlePasteNonNegative}
                                        onChange={(e) => handleUpdateEquipmentItem(idx, { unitPrice: e.target.value === "" ? "" : Math.max(0, Number(e.target.value)) })}
                                        className="w-full pl-6 pr-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-[#122244] text-right focus:border-[#c9a654] outline-none"
                                      />
                                    </div>
                                  </td>
                                  <td className="p-3 text-right font-black text-xs text-[#122244]">
                                    ₱{(Number(item.total) || ((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  {isEditingMode && (
                                    <td className="p-3 text-center">
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveEquipmentItem(idx)}
                                        className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                                        title="Delete item"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              ))}
                              {finEquipmentList.length === 0 && (
                                <tr>
                                  <td colSpan={isEditingMode ? 5 : 4} className="py-8 text-center text-gray-400 text-xs italic">
                                    No equipment or assets added yet. Click "+ Add Item" to itemize your startup capital.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                          <div className="p-3.5 bg-gray-50/90 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-3">
                            {isEditingMode ? (
                              <button
                                type="button"
                                onClick={handleAddEquipmentItem}
                                className="flex items-center gap-1.5 text-xs font-bold text-[#c9a654] hover:text-[#b59545] bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200/80 hover:bg-amber-100 transition-colors"
                              >
                                <Plus size={14} /> Add Item
                              </button>
                            ) : <div />}
                            <div className="flex items-center gap-2 text-right">
                              <span className="text-xs font-extrabold uppercase tracking-wider text-gray-500">Total:</span>
                              <span className="text-base font-black text-[#122244]">
                                ₱{calculatedEquipmentTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Financing Options */}
                        <div className="bg-amber-50/40 p-4 rounded-xl border border-amber-200/70 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-bold text-[#122244]">Is startup capital borrowed / loaned?</p>
                              <p className="text-[10px] text-gray-500">Enable if the proposal relies on borrowed funds with interest</p>
                            </div>
                            <input
                              disabled={!isEditingMode}
                              type="checkbox"
                              checked={fin.isCapitalBorrowed || false}
                              onChange={(e) => updateFinancialData({ isCapitalBorrowed: e.target.checked })}
                              className="w-4 h-4 accent-[#c9a654] cursor-pointer rounded"
                            />
                          </div>

                          {fin.isCapitalBorrowed && (
                            <div className="pt-3 border-t border-amber-200/60 flex flex-col sm:flex-row sm:items-center gap-4">
                              <div className="flex-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                                  Annual Loan Interest Rate (%)
                                </label>
                                <input
                                  disabled={!isEditingMode}
                                  type="number"
                                  min="0"
                                  placeholder="e.g. 5 for 5%"
                                  value={fin.interestRate || ""}
                                  onKeyDown={handlePreventNegative}
                                  onPaste={handlePasteNonNegative}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === "" || Number(val) >= 0) {
                                      updateFinancialData({ interestRate: val });
                                    }
                                  }}
                                  className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-[#122244] focus:border-[#c9a654] outline-none"
                                />
                              </div>
                              <div className="bg-white/80 px-4 py-2 rounded-lg border border-amber-200 text-xs">
                                <span className="text-[10px] font-bold text-gray-400 uppercase block">Monthly Loan Interest</span>
                                <span className="font-extrabold text-[#122244]">₱{monthlyLoanInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </section>

                    <section>
                      <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 mb-6">
                        <div className="p-1.5 bg-orange-50 rounded-lg">
                          <MapPin className="w-4 h-4 text-orange-600" />
                        </div>{" "}
                        PLACE AND PROMOTION
                      </h3>
                      <div className="space-y-6">
                        <div className={highlightMissingFields && !currentProposal.proposedLocation?.trim() ? "field-has-error" : ""}>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                            Proposed Location <span className="text-red-500">*</span>
                          </label>
                          <ExpandingTextarea
                            disabled={!isEditingMode}
                            rows={2}
                            placeholder="Where will you operate?"
                            value={currentProposal.proposedLocation}
                            onChange={(e) =>
                              setCurrentProposal({
                                ...currentProposal,
                                proposedLocation: e.target.value,
                              })
                            }
                            onBlur={() => handleAutoSave()}
                            className={`w-full px-4 py-3 bg-gray-50 border ${highlightMissingFields && !currentProposal.proposedLocation?.trim() ? "border-red-500 bg-red-50/20" : "border-gray-200"
                              } rounded-lg outline-none text-sm resize-none font-medium`}
                          />
                          {highlightMissingFields && !currentProposal.proposedLocation?.trim() && (
                            <p className="text-red-500 text-xs font-semibold mt-1.5 flex items-start gap-1">
                              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                              <span>Proposed Location is required before submitting.</span>
                            </p>
                          )}

                          {/* Interactive Map Picker */}
                          <div className="mt-3">
                            <LocationPickerMap
                              value={currentProposal.proposedLocation || ""}
                              disabled={!isEditingMode}
                              onChange={(newAddress) => {
                                const updated = {
                                  ...currentProposal,
                                  proposedLocation: newAddress,
                                };
                                setCurrentProposal(updated);
                                handleAutoSave(updated);
                              }}
                            />
                          </div>
                        </div>
                        <div className={highlightMissingFields && !currentProposal.promotionalStrategy?.trim() ? "field-has-error" : ""}>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                            Promotional Strategy <span className="text-red-500">*</span>
                          </label>
                          <ExpandingTextarea
                            disabled={!isEditingMode}
                            rows={2}
                            placeholder="How will you attract customers?"
                            value={currentProposal.promotionalStrategy}
                            onChange={(e) =>
                              setCurrentProposal({
                                ...currentProposal,
                                promotionalStrategy: e.target.value,
                              })
                            }
                            onBlur={() => handleAutoSave()}
                            className={`w-full px-4 py-3 bg-gray-50 border ${highlightMissingFields && !currentProposal.promotionalStrategy?.trim() ? "border-red-500 bg-red-50/20" : "border-gray-200"
                              } rounded-lg outline-none text-sm resize-none font-medium`}
                          />
                          {highlightMissingFields && !currentProposal.promotionalStrategy?.trim() && (
                            <p className="text-red-500 text-xs font-semibold mt-1.5 flex items-start gap-1">
                              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                              <span>Promotional Strategy is required before submitting.</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </section>

                    <section>
                      <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 mb-6">
                        <div className="p-1.5 bg-gray-100 rounded-lg">
                          <MoreVertical className="w-4 h-4 text-gray-600" />
                        </div>{" "}
                        ADDITIONAL DETAILS
                      </h3>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                          Other Relevant Information (Optional)
                        </label>
                        <ExpandingTextarea
                          disabled={!isEditingMode}
                          rows={4}
                          value={currentProposal.otherDetails}
                          onChange={(e) =>
                            setCurrentProposal({
                              ...currentProposal,
                              otherDetails: e.target.value,
                            })
                          }
                          onBlur={() => handleAutoSave()}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm resize-none font-medium"
                        />
                      </div>
                    </section>

                    {/* === BOTTOM SUBMIT & ACTION BAR === */}
                    {isEditingMode && (
                      <div className="pt-8 border-t-2 border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            onClick={() => setActiveView("dashboard")}
                            className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-800 transition-colors"
                          >
                            <ChevronLeft className="w-4 h-4" /> Back to Proposals
                          </button>
                          <div className="flex items-center gap-2 px-3 border-l border-gray-200">
                            <span
                              className={`text-xs font-bold flex items-center gap-1.5 ${isSaving ? "text-gray-400 animate-pulse" : "text-green-600"}`}
                            >
                              {isSaving ? <Save size={14} /> : <CheckCircle2 size={14} />} {saveStatus}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSaveProposal("Pending")}
                          disabled={isSubmitting}
                          className={`w-full sm:w-auto px-8 py-3 bg-[#c9a654] text-white font-bold text-sm rounded-lg hover:bg-[#b59545] shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 ${isSubmitting ? "opacity-80 cursor-not-allowed" : "cursor-pointer"
                            }`}
                          title={isSubmitting ? "Submitting..." : "Submit proposal to adviser for review"}
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-white" />
                              <span>Submitting to Adviser...</span>
                            </>
                          ) : (
                            "Submit to Adviser"
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {activeView === "active-business" && (
            !activeBusiness ? (
              <div className="flex flex-col items-center justify-center min-h-[50vh] text-center bg-white rounded-2xl border border-gray-100 shadow-sm p-12">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-xl font-bold text-[#122244]">Project Not Found</h2>
                <p className="text-gray-500 mt-2 mb-6 max-w-md">
                  The project you were working on seems to have been deleted or moved.
                </p>
                <button
                  onClick={() => setActiveView("dashboard")}
                  className="px-6 py-2.5 bg-[#122244] text-white font-bold rounded-lg hover:bg-[#1a2f55] shadow-md transition-all"
                >
                  Return to Proposals
                </button>
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <button
                    onClick={() => setActiveView("dashboard")}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 font-bold text-sm rounded-lg hover:bg-gray-50 shadow-sm transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" /> Back to Proposals List
                  </button>
                  <button
                    onClick={() => navigate("/financial-input")}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#c9a654] text-white font-bold text-sm rounded-lg hover:bg-[#b59545] shadow-md transition-all"
                  >
                    <FileEdit className="w-4 h-4" /> Proceed to Financial Input
                  </button>
                </div>

                <div className="bg-[#122244] rounded-2xl shadow-xl overflow-hidden mb-6 flex flex-col md:flex-row items-center justify-between p-8 text-white relative">
                  <div className="flex items-center gap-6 z-10 w-full md:w-auto">
                    <div className="w-24 h-24 bg-[#1a2f55] rounded-2xl flex items-center justify-center font-extrabold text-4xl border border-white/10 shadow-inner flex-shrink-0 text-[#c9a654] overflow-hidden">
                      {activeBusiness.businessLogo ? (
                        <img src={activeBusiness.businessLogo} alt="Business Logo" className="w-full h-full object-cover" />
                      ) : (
                        getInitials(activeBusiness.businessName)
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-widest bg-green-500/20 text-green-400 px-2 py-1 rounded border border-green-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> APPROVED BUSINESS PROPOSAL
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 text-gray-300">
                          <User className="w-3 h-3" /> SECTION: {userGroup?.section}
                        </span>
                      </div>
                      <h1 className="text-4xl font-extrabold mb-1 tracking-tight">
                        {activeBusiness.businessName}
                      </h1>
                      <p className="text-sm text-gray-300 font-medium">
                        {activeBusiness.businessType} • Adviser: Prof. {adviserData ? adviserData.lastName : "Cruz"}
                      </p>
                    </div>
                  </div>
                  {isLeader && (
                    <button
                      onClick={() => {
                        setEditBasicData({ ...activeBusiness });
                        setShowEditBasicModal(true);
                      }}
                      className="mt-6 md:mt-0 flex items-center gap-2 px-6 py-3 border border-white/20 hover:bg-white/10 rounded-xl text-sm font-bold transition-all z-10"
                    >
                      <Pencil className="w-4 h-4" /> Edit Basic Info
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-6 text-[#122244]">
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
                      <div className="flex justify-between items-start mb-8 border-b border-gray-100 pb-6">
                        <div className="flex items-center gap-3">
                          <div className="bg-blue-50 p-2.5 rounded-full border border-blue-100">
                            <FileText className="w-6 h-6 text-blue-500" />
                          </div>
                          <div>
                            <h3 className="text-xl font-extrabold text-[#122244]">
                              Complete Project Overview
                            </h3>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                              Approved Business Charter
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-xl p-6 mb-8 flex divide-x divide-gray-200 text-center border border-gray-100">
                        <div className="flex-1 pr-6">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">
                            Total Capital
                          </p>
                          <p className="text-2xl font-bold text-green-600">
                            ₱{activeBusiness.totalCapital || "0"}
                          </p>
                        </div>
                        <div className="flex-1 pl-6">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">
                            Business Type
                          </p>
                          <p className="text-xl font-bold text-[#122244]">
                            {activeBusiness.businessType || "Uncategorized"}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div>
                          <p className="text-[10px] font-bold text-black uppercase tracking-widest mb-1">
                            Tagline
                          </p>
                          <p className="text-black font-bold text-lg">
                            {activeBusiness.tagline || "None Provided"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-black uppercase tracking-widest mb-1">
                            Mission Statement
                          </p>
                          <p className="text-black text-sm leading-relaxed">
                            {activeBusiness.missionStatement || "None Provided"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-black uppercase tracking-widest mb-1">
                            Vision Statement
                          </p>
                          <p className="text-black text-sm leading-relaxed">
                            {activeBusiness.visionStatement || "None Provided"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-black uppercase tracking-widest mb-1">
                            Target Market
                          </p>
                          <p className="text-black text-sm leading-relaxed">
                            {activeBusiness.targetMarket || "None Provided"}
                          </p>
                        </div>

                        <div className="h-px bg-gray-100 my-4"></div>

                        <div>
                          <p className="text-[10px] font-bold text-black uppercase tracking-widest mb-1">
                            Product Description
                          </p>
                          <p className="text-black text-sm leading-relaxed">
                            {activeBusiness.productDescription || "None Provided"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-black uppercase tracking-widest mb-1">
                            Specific Pricing
                          </p>
                          <p className="text-black text-sm leading-relaxed">
                            {activeBusiness.priceRanges || "None Provided"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-black uppercase tracking-widest mb-1">
                            Location
                          </p>
                          <p className="text-black font-medium">
                            {activeBusiness.proposedLocation || "None Provided"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-black uppercase tracking-widest mb-1">
                            Promotional Strategy
                          </p>
                          <p className="text-black text-sm leading-relaxed">
                            {activeBusiness.promotionalStrategy ||
                              "None Provided"}
                          </p>
                        </div>

                        {(() => {
                          const proposalFin = activeBusiness.originalProposalFinancials || activeBusiness.financialData;
                          if (!proposalFin) return null;

                          const products = normalizeProposalProducts(proposalFin, activeBusiness.businessName);
                          const equipmentList = proposalFin.equipmentList || [];
                          const calculatedEquipmentTotal = equipmentList.reduce(
                            (s: number, e: any) => s + (Number(e.total) || ((Number(e.quantity) || 0) * (Number(e.unitPrice) || 0))),
                            0
                          );

                          return (
                            <div className="space-y-6 pt-4 border-t border-gray-100">
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] font-bold text-[#c9a654] uppercase tracking-widest flex items-center gap-1.5">
                                  <Calculator className="w-3.5 h-3.5" /> Original Financial Proposal Inputs (Approved Charter)
                                </p>
                                <span className="text-[9px] font-black uppercase bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200">
                                  Proposal Record
                                </span>
                              </div>

                              {/* Products Breakdown */}
                              <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-full bg-[#122244] text-white text-[11px] font-bold flex items-center justify-center">1</span>
                                  <span className="text-xs font-bold text-[#122244] uppercase tracking-wider">Proposed Products ({products.length} {products.length === 1 ? 'Product' : 'Products'})</span>
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

                              {/* Equipment CapEx (if present) */}
                              {equipmentList.length > 0 && (
                                <div className="space-y-2 pt-2">
                                  <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                      <span className="w-5 h-5 rounded-full bg-[#122244] text-white text-[11px] font-bold flex items-center justify-center">2</span>
                                      <span className="text-xs font-bold text-[#122244] uppercase tracking-wider">Startup Equipment & Assets Breakdown (CapEx)</span>
                                    </div>
                                    <span className="text-xs font-bold text-[#122244]">
                                      Total: ₱{calculatedEquipmentTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                  <div className="border border-gray-100 rounded-lg overflow-hidden bg-white">
                                    <table className="w-full text-left text-xs">
                                      <thead className="bg-gray-50 border-b border-gray-100 text-[9px] uppercase text-gray-400 font-bold">
                                        <tr>
                                          <th className="p-2">Item / Asset name</th>
                                          <th className="p-2 text-center w-12">QTY</th>
                                          <th className="p-2 text-right w-20">UNIT PRICE</th>
                                          <th className="p-2 text-right w-24">TOTAL</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-50">
                                        {equipmentList.map((eq: any, idx: number) => (
                                          <tr key={idx}>
                                            <td className="p-2 text-gray-800 font-medium">{eq.name || '-'}</td>
                                            <td className="p-2 text-center text-gray-600">{eq.quantity || 1}</td>
                                            <td className="p-2 text-right text-gray-600">₱{Number(eq.unitPrice || 0).toLocaleString()}</td>
                                            <td className="p-2 text-right font-bold text-[#122244]">₱{(Number(eq.total) || ((Number(eq.quantity) || 0) * (Number(eq.unitPrice) || 0))).toLocaleString()}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {proposalFin.isCapitalBorrowed && (
                                <div className="flex justify-between items-center text-xs text-amber-800 bg-amber-50 p-3 rounded-lg border border-amber-200/70">
                                  <span className="font-semibold">Startup Capital Loan Financing:</span>
                                  <span className="font-black">{proposalFin.interestRate || '0'}% Annual Interest Rate</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-1">
                    <div className="space-y-6 sticky top-24">
                      {/* PROJECT ROSTER */}
                      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-[#122244]">
                        <h3 className="text-xs font-extrabold text-[#122244] uppercase tracking-widest mb-1">
                          Project Roster
                        </h3>
                        <p className="text-xs text-gray-500 mb-6">
                          {(userGroup?.memberIds?.length || 0) + 1} Members Total
                        </p>

                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-[#122244] rounded-lg text-white flex items-center justify-center font-bold text-sm shadow-sm">
                                {getInitials(adviserData ? `${adviserData.firstName} ${adviserData.lastName}` : "Adviser")}
                              </div>
                              <div>
                                <p className="font-bold text-[#122244] text-sm">Prof. {adviserData ? adviserData.lastName : "Cruz"}</p>
                                <p className="text-[10px] text-blue-600">Faculty</p>
                              </div>
                            </div>
                            <span className="text-[9px] font-black uppercase text-blue-600 bg-blue-100 px-2 py-1 rounded">Adviser</span>
                          </div>

                          <div className="flex items-center gap-3 p-2">
                            <div className="w-10 h-10 bg-purple-600 rounded-full text-white flex items-center justify-center font-bold text-sm shadow-sm">
                              {getInitials(userGroup?.leaderName || "")}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-bold text-gray-900">{userGroup?.leaderName}</p>
                                <span className="text-[9px] font-bold uppercase text-[#c9a654] bg-[#c9a654]/10 px-1.5 py-0.5 rounded">Leader</span>
                              </div>
                            </div>
                          </div>

                          {(groupMembersData || []).map((member) => (
                            <div key={member.id} className="flex items-center gap-3 p-2">
                              <div className="w-10 h-10 bg-green-500 rounded-full text-white flex items-center justify-center font-bold text-sm shadow-sm">
                                {getInitials(member.firstName || member.name || "")}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-gray-900">
                                  {member.firstName || ""} {member.lastName || ""}
                                </p>
                                <p className="text-[10px] text-gray-500">{member.studentId || ""}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* === ADVISER FEEDBACK CARD IN ACTIVE BUSINESS VIEW === */}
                      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-xs font-extrabold text-[#122244] uppercase tracking-widest flex items-center gap-2">
                            <MessageCircle className="w-4 h-4 text-blue-500" /> ADVISER FEEDBACK
                          </h3>
                          {activeBusiness.feedbackHistory && activeBusiness.feedbackHistory.length > 1 && (
                            <button
                              onClick={() => setShowAllFeedback(!showAllFeedback)}
                              className="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline transition-colors"
                            >
                              {showAllFeedback ? "Show Less" : "View All History"}
                            </button>
                          )}
                        </div>
                        <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                          {!activeBusiness.feedbackHistory || activeBusiness.feedbackHistory.length === 0 ? (
                            <div className="text-center py-6 text-gray-400">
                              <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                              <p className="text-xs italic">No feedback provided yet.</p>
                            </div>
                          ) : (
                            (showAllFeedback ? activeBusiness.feedbackHistory : activeBusiness.feedbackHistory.slice(-1)).map(item => (
                              <div key={item.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm border-l-4 border-l-blue-500 flex flex-col gap-2">
                                <div className="flex justify-between items-start">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm text-[#122244]">{item.authorName}</span>
                                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-black rounded uppercase tracking-wider">{item.role}</span>
                                  </div>
                                </div>
                                <span className="text-[10px] text-gray-400 font-medium">{formatFeedbackDate(item.date)}</span>
                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{item.text}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      </main>

      {/* SETUP MODAL */}
      {showSetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex justify-between items-start text-center relative text-[#122244]">
              <div className="w-full">
                <h2 className="text-2xl font-extrabold">Team Setup</h2>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mt-1">
                  {userGroup?.isSetup ? "Edit team & company information" : "Name your company, upload logo & review assigned members"}
                </p>
              </div>
              <button
                onClick={() => setShowSetupModal(false)}
                className="absolute top-6 right-6 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-7 flex-1 custom-scrollbar">

              {/* ─── SECTION: Team Information ─── */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#c9a654] mb-3 pb-1 border-b border-gray-100">Team Information</p>
                <div className="space-y-4">

                  {/* Company Name with live DTI & SEC Checker */}
                  <div ref={companyNameRef} className="space-y-3">
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <label className="block text-xs font-bold text-[#122244] uppercase tracking-wider">
                        Company Name <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-gray-600 bg-gray-100 px-2.5 py-0.5 rounded-full border border-gray-200">
                        <span className="text-gray-500 font-semibold">Official Registries:</span>
                        <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">DTI BNRS</span>
                        <span className="text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">SEC eSPARC</span>
                      </div>
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        value={companyNameQuery}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCompanyNameQuery(val);
                          setSetupCompanyName(val);
                          if (setupErrors.companyName) setSetupErrors(prev => ({ ...prev, companyName: "" }));
                        }}
                        placeholder="Enter proposed company or business name..."
                        className={`w-full px-4 py-3 bg-gray-50 border ${setupErrors.companyName
                          ? "border-red-400 bg-red-50/20"
                          : "border-gray-200"
                          } rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c9a654]/50 focus:border-[#c9a654] transition-all`}
                      />
                    </div>

                    {/* Submit-time error */}
                    {setupErrors.companyName && (
                      <p className="text-red-500 text-[11px] font-semibold mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 flex-shrink-0" />{setupErrors.companyName}
                      </p>
                    )}

                    {/* Official Live Name Verification Widget */}
                    <OfficialNameChecker
                      currentName={companyNameQuery}
                      onCheckComplete={(provider, res) => {
                        if (provider === "DTI") setSetupDtiResult(res);
                        if (provider === "SEC") setSetupSecResult(res);
                      }}
                    />
                  </div>

                  {/* Company Logo */}
                  <div>
                    <label className="block text-xs font-bold text-[#122244] uppercase tracking-wider mb-1.5">
                      Company Logo <span className="text-gray-400 font-normal normal-case">(Optional)</span>
                    </label>
                    <div className="flex items-center gap-4 p-4 border border-gray-100 rounded-xl bg-gray-50/50">
                      <div className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 bg-white flex items-center justify-center overflow-hidden flex-shrink-0 relative group shadow-xs">
                        {setupLogoPreview ? (
                          <>
                            <img src={setupLogoPreview} alt="Logo Preview" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => { setSetupLogoPreview(""); setSetupLogoFile(null); }}
                              className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Remove Logo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <ImageIcon className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <input
                          type="file"
                          id="logo-file-input"
                          accept="image/*"
                          onChange={handleLogoFileChange}
                          className="hidden"
                        />
                        <label
                          htmlFor="logo-file-input"
                          className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-xs"
                        >
                          <Upload className="w-4 h-4 text-[#c9a654]" />
                          {setupLogoPreview ? "Change Logo" : "Upload Logo Image"}
                        </label>
                        <p className="text-[11px] text-gray-400 mt-1">PNG, JPG, or SVG up to 5MB.</p>
                      </div>
                    </div>
                  </div>

                  {/* Members Review */}
                  <div>
                    <label className="block text-xs font-bold text-[#122244] uppercase tracking-wider mb-2">
                      Assigned Team Members ({groupMembersData.length + 1})
                    </label>
                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                      <div className="flex items-center gap-3 p-3 border border-yellow-100 rounded-xl bg-yellow-50/40">
                        <div className="w-9 h-9 bg-[#c9a654] rounded-full text-white flex items-center justify-center font-bold text-xs shadow-xs">
                          {getInitials(userName)}
                        </div>
                        <div>
                          <p className="font-bold text-[#122244] text-sm">{userName}</p>
                          <p className="text-[10px] font-black uppercase text-[#c9a654] tracking-wider">Team Leader</p>
                        </div>
                      </div>
                      {groupMembersData.length > 0 ? (
                        groupMembersData.map((member) => (
                          <div key={member.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl bg-gray-50/50">
                            <div className="w-9 h-9 bg-green-500 rounded-full text-white flex items-center justify-center font-bold text-xs shadow-xs">
                              {getInitials(`${member.firstName} ${member.lastName}`)}
                            </div>
                            <div>
                              <p className="font-bold text-[#122244] text-sm">{member.firstName} {member.lastName}</p>
                              <p className="text-[10px] font-black uppercase text-green-600 tracking-wider">Team Member</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-3">
                          <p className="text-gray-400 text-xs italic">No other members assigned yet.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ─── SECTION: Mission & Vision ─── */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#122244] mb-3 pb-1 border-b border-gray-100">Mission &amp; Vision</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#122244] uppercase tracking-wider mb-1.5">
                      Company Mission <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={setupMission}
                      onChange={(e) => {
                        setSetupMission(e.target.value);
                        if (setupErrors.mission) setSetupErrors(prev => ({ ...prev, mission: "" }));
                      }}
                      placeholder="What is your company's mission? (e.g., To provide quality products and services to every customer.)"
                      className={`w-full px-4 py-3 bg-gray-50 border ${setupErrors.mission ? "border-red-400 bg-red-50/20" : "border-gray-200"
                        } rounded-xl text-sm text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c9a654]/50 focus:border-[#c9a654] transition-all resize-none leading-relaxed`}
                    />
                    {setupErrors.mission && (
                      <p className="text-red-500 text-[11px] font-semibold mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />{setupErrors.mission}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#122244] uppercase tracking-wider mb-1.5">
                      Company Vision <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={setupVision}
                      onChange={(e) => {
                        setSetupVision(e.target.value);
                        if (setupErrors.vision) setSetupErrors(prev => ({ ...prev, vision: "" }));
                      }}
                      placeholder="What is your company's vision? (e.g., To be the most trusted business in the region.)"
                      className={`w-full px-4 py-3 bg-gray-50 border ${setupErrors.vision ? "border-red-400 bg-red-50/20" : "border-gray-200"
                        } rounded-xl text-sm text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c9a654]/50 focus:border-[#c9a654] transition-all resize-none leading-relaxed`}
                    />
                    {setupErrors.vision && (
                      <p className="text-red-500 text-[11px] font-semibold mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />{setupErrors.vision}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* ─── SECTION: Company Objectives ─── */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-green-600 mb-3 pb-1 border-b border-gray-100">Company Objectives</p>
                <div className="space-y-2">
                  {setupObjectives.map((obj, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="mt-3 text-xs font-bold text-gray-400 w-5 flex-shrink-0">{idx + 1}.</span>
                      <input
                        type="text"
                        value={obj}
                        onChange={(e) => {
                          const updated = [...setupObjectives];
                          updated[idx] = e.target.value;
                          setSetupObjectives(updated);
                          if (setupErrors.objectives) setSetupErrors(prev => ({ ...prev, objectives: "" }));
                        }}
                        placeholder={`Objective ${idx + 1}...`}
                        className={`flex-1 px-3 py-2.5 bg-gray-50 border ${setupErrors.objectives && obj.trim() === "" ? "border-red-300" : "border-gray-200"
                          } rounded-xl text-sm text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-400/30 focus:border-green-400 transition-all`}
                      />
                      {setupObjectives.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = setupObjectives.filter((_, i) => i !== idx);
                            setSetupObjectives(updated);
                          }}
                          className="mt-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                          title="Remove objective"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {setupErrors.objectives && (
                    <p className="text-red-500 text-[11px] font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />{setupErrors.objectives}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => setSetupObjectives([...setupObjectives, ""])}
                    className="mt-2 flex items-center gap-2 px-4 py-2 border border-dashed border-green-400 text-green-600 rounded-xl text-xs font-bold hover:bg-green-50 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Objective
                  </button>
                </div>
              </div>

            </div>{/* end scrollable body */}

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 rounded-b-2xl">
              <button
                onClick={handleFinishTeamSetup}
                disabled={isUploadingLogo}
                className="px-8 py-3 text-sm font-bold text-white bg-[#c9a654] rounded-xl shadow-md hover:bg-[#b59545] transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isUploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {userGroup?.isSetup ? "Save Changes" : "Finish Setup"}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ROSTER MODAL */}
      {showRosterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 flex flex-col animate-in zoom-in-95 duration-200 text-[#122244]">
            <div className="flex justify-between items-start mb-6 border-b pb-4">
              <div>
                <h2 className="text-2xl font-extrabold">Project Roster</h2>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">
                  Group {userGroup?.id ? userGroup.id.slice(-1) : "1"} Team Members
                </p>
              </div>
              <button
                onClick={() => setShowRosterModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {adviserData && (
                <div className="flex items-center gap-4 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                  <div className="w-12 h-12 bg-[#122244] rounded-lg text-white flex items-center justify-center font-bold text-lg shadow-sm">
                    {getInitials(
                      `${adviserData.firstName} ${adviserData.lastName}`,
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-[#122244] text-sm">
                      Prof. {adviserData.firstName} {adviserData.lastName}
                    </p>
                    <p className="text-[10px] font-black uppercase text-blue-600 tracking-tighter">
                      Academic Adviser
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                <div className="w-12 h-12 bg-purple-600 rounded-full text-white flex items-center justify-center font-bold text-lg shadow-sm">
                  {getInitials(userGroup?.leaderName || "")}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900 text-sm">
                    {userGroup?.leaderName}
                  </p>
                  <p className="text-[10px] font-black uppercase text-purple-600 tracking-tighter">
                    Group Leader
                  </p>
                </div>
                <Star className="w-4 h-4 text-purple-600 fill-current opacity-20" />
              </div>

              {groupMembersData.length > 0 ? (
                groupMembersData.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-4 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-12 h-12 bg-green-500 rounded-full text-white flex items-center justify-center font-bold text-lg shadow-sm">
                      {getInitials(`${member.firstName} ${member.lastName}`)}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm">
                        {member.firstName} {member.lastName}
                      </p>
                      <p className="text-[10px] font-black uppercase text-green-600 tracking-tighter">
                        Team Member
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center py-4 text-gray-400 text-xs italic">
                  No other members added yet.
                </p>
              )}
            </div>

            <button
              onClick={() => setShowRosterModal(false)}
              className="mt-6 w-full py-3 bg-[#122244] text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all"
            >
              Close Team View
            </button>
          </div>
        </div>
      )}

      {/* LOCK-IN / ACTIVATE BUSINESS MODAL */}
      {showLockInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm text-[#122244]">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-8 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Zap className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-extrabold mb-2">
              Activate Business?
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Are you sure you want to activate{" "}
              <span className="font-bold text-[#122244]">
                "{currentProposal.businessName}"
              </span>{" "}
              as your group's official active business?
            </p>
            <div className="p-3 bg-green-50/80 border border-green-200 rounded-lg text-left text-xs text-green-900 mb-6 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                What happens next:
              </p>
              <ul className="list-disc pl-4 text-[11px] text-green-800 space-y-0.5">
                <li>Locks in this proposal as your active feasibility workspace.</li>
                <li>Unlocks complete financial inputs and AI feasibility analysis.</li>
              </ul>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowLockInModal(false)}
                className="px-5 py-2.5 text-sm font-bold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLockInBusiness}
                className="px-5 py-2.5 text-sm font-bold text-white bg-green-600 rounded-lg shadow-md hover:bg-green-700 transition-colors flex items-center gap-1.5"
              >
                <Zap className="w-4 h-4" /> Activate Business
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteConfirmModal && proposalToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm text-[#122244]">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-8 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShieldAlert className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-extrabold mb-2 text-red-600">
              Delete Proposal?
            </h2>
            <p className="text-sm text-gray-500 mb-2">
              Are you sure you want to delete <span className="font-bold text-[#122244]">"{proposalToDelete.businessName}"</span>?
            </p>
            <div className="bg-red-50 p-3 rounded-lg mb-8">
              <p className="text-[11px] font-bold text-red-700 uppercase tracking-tight">
                This action is permanent and cannot be undone. All data associated with this proposal will be lost forever.
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  setShowDeleteConfirmModal(false);
                  setProposalToDelete(null);
                }}
                className="px-5 py-2.5 text-sm font-bold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (proposalToDelete.id) {
                    handleDeleteProposal(proposalToDelete.id);
                  }
                  setShowDeleteConfirmModal(false);
                  setProposalToDelete(null);
                }}
                className="px-6 py-2.5 text-sm font-bold text-white bg-red-600 rounded-lg shadow-md hover:bg-red-700 transition-colors"
              >
                Yes, Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT BASIC INFO MODAL (EXTENDED) */}
      {showEditBasicModal && activeBusiness && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-2xl text-[#122244]">
              <div>
                <h2 className="text-xl font-bold">Update Business Details</h2>
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">
                  Active Workspace: {activeBusiness.businessName}
                </p>
              </div>
              <button
                onClick={() => setShowEditBasicModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8 text-[#122244]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-tighter mb-2">
                    Basic Overview
                  </h4>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase block">
                      Business / Company Name <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[9px] font-semibold text-gray-500">
                      Official DTI & SEC Check
                    </span>
                  </div>
                  {(() => {
                    const check = checkBusinessName(editBasicData.businessName, copyrightDB || undefined);
                    return (
                      <>
                        <input
                          type="text"
                          value={editBasicData.businessName}
                          onChange={(e) =>
                            setEditBasicData({
                              ...editBasicData,
                              businessName: e.target.value,
                            })
                          }
                          className={`w-full px-4 py-2 bg-gray-50 border ${check.isCopyrighted ? "border-red-500 bg-red-50/20" : "border-gray-200"
                            } rounded-lg outline-none text-sm font-medium`}
                        />
                        {check.isCopyrighted && (
                          <p className="text-red-500 text-[10px] font-semibold mt-1 flex items-start gap-1">
                            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span>{check.errorMessage}</span>
                          </p>
                        )}
                      </>
                    );
                  })()}

                  <div className="mt-2">
                    <OfficialNameChecker
                      currentName={editBasicData.businessName}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                    Business Logo <span className="text-gray-400 font-normal normal-case">(Optional)</span>
                  </label>
                  <div className="flex items-center gap-3 p-2 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="w-10 h-10 rounded-lg border border-gray-200 bg-white flex items-center justify-center overflow-hidden flex-shrink-0 relative group shadow-2xs">
                      {editBasicData.businessLogo ? (
                        <>
                          <img src={editBasicData.businessLogo} alt="Logo" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setEditBasicData({ ...editBasicData, businessLogo: "" })}
                            className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Remove Logo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <ImageIcon className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <input
                        type="file"
                        id="edit-business-logo-input"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const compressed = await compressImage(file);
                          setEditBasicData({ ...editBasicData, businessLogo: compressed });
                        }}
                        className="hidden"
                      />
                      <label
                        htmlFor="edit-business-logo-input"
                        className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 transition-all shadow-xs"
                      >
                        <Upload className="w-3 h-3 text-[#c9a654]" />
                        {editBasicData.businessLogo ? "Change" : "Upload"}
                      </label>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                    Business Type <span className="text-red-500">*</span>
                  </label>
                  <CustomDropdown
                    value={
                      !editBasicData.businessType
                        ? ""
                        : ["Food & Beverage", "Services"].includes(editBasicData.businessType)
                          ? editBasicData.businessType
                          : "Other"
                    }
                    options={businessTypeDropdownOptions}
                    onChange={(newValue) =>
                      setEditBasicData({
                        ...editBasicData,
                        businessType: newValue,
                      })
                    }
                  />
                  {editBasicData.businessType &&
                    !["Food & Beverage", "Services", ""].includes(editBasicData.businessType) && (
                      <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                        <label className="text-[10px] font-bold text-[#c9a654] uppercase tracking-wider block mb-1">
                          Please specify business type <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={editBasicData.businessType === "Other" ? "" : editBasicData.businessType}
                          placeholder="e.g. Technology, Agriculture, Manufacturing..."
                          onChange={(e) =>
                            setEditBasicData({
                              ...editBasicData,
                              businessType: e.target.value || "Other",
                            })
                          }
                          className="w-full px-4 py-2 bg-white border border-[#c9a654]/40 focus:border-[#c9a654] focus:ring-2 focus:ring-[#c9a654]/20 rounded-lg text-sm font-medium transition-all shadow-sm outline-none"
                        />
                      </div>
                    )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                      Total Capital <span className="text-red-500">*</span>
                    </label>
                    {(() => {
                      const check = checkTotalCapital(editBasicData.totalCapital);
                      return (
                        <>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editBasicData.totalCapital}
                            onKeyDown={(e) => {
                              if (
                                !/[0-9]/.test(e.key) &&
                                e.key !== "Backspace" &&
                                e.key !== "Delete" &&
                                e.key !== "Tab" &&
                                e.key !== "ArrowLeft" &&
                                e.key !== "ArrowRight" &&
                                e.key !== "Home" &&
                                e.key !== "End" &&
                                !(e.key === "." && !(editBasicData.totalCapital || "").includes(".")) &&
                                !e.ctrlKey &&
                                !e.metaKey
                              ) {
                                e.preventDefault();
                              }
                            }}
                            onChange={(e) => {
                              let val = e.target.value.replace(/[^0-9.]/g, "");
                              const parts = val.split(".");
                              if (parts.length > 2) {
                                val = parts[0] + "." + parts.slice(1).join("");
                              }
                              setEditBasicData({
                                ...editBasicData,
                                totalCapital: val,
                              });
                            }}
                            placeholder="0.00"
                            className={`w-full px-4 py-2 bg-gray-50 border ${check.isNegative ? "border-red-500 bg-red-50/20" : "border-gray-200"
                              } rounded-lg text-sm font-medium transition-colors outline-none`}
                          />
                          {check.isNegative && (
                            <p className="text-red-500 text-xs font-semibold mt-1 flex items-start gap-1">
                              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                              <span>{check.errorMessage}</span>
                            </p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                      Contributors Count
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={editBasicData.contributorsCount || "1"}
                      onKeyDown={handlePreventNegative}
                      onPaste={handlePasteNonNegative}
                      onChange={(e) => {
                        setEditBasicData({
                          ...editBasicData,
                          contributorsCount: e.target.value,
                        });
                      }}
                      placeholder="1"
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium transition-colors outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                    Tagline <span className="text-red-500">*</span>
                  </label>
                  {(() => {
                    const check = checkTagline(editBasicData.tagline, copyrightDB || undefined);
                    return (
                      <>
                        <input
                          type="text"
                          value={editBasicData.tagline}
                          onChange={(e) =>
                            setEditBasicData({
                              ...editBasicData,
                              tagline: e.target.value,
                            })
                          }
                          className={`w-full px-4 py-2 bg-gray-50 border ${check.isCopyrighted ? "border-red-500 bg-red-50/20" : "border-gray-200"
                            } rounded-lg text-sm font-medium transition-colors`}
                        />
                        {check.isCopyrighted && (
                          <p className="text-red-500 text-xs font-semibold mt-1 flex items-start gap-1">
                            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span>{check.errorMessage}</span>
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-purple-600 uppercase tracking-tighter">
                  Mission & Vision
                </h4>
                <ExpandingTextarea
                  rows={2}
                  placeholder="Mission Statement *"
                  value={editBasicData.missionStatement}
                  onChange={(e) =>
                    setEditBasicData({
                      ...editBasicData,
                      missionStatement: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 bg-gray-50 border rounded-lg text-sm resize-none font-medium"
                />
                <ExpandingTextarea
                  rows={2}
                  placeholder="Vision Statement *"
                  value={editBasicData.visionStatement}
                  onChange={(e) =>
                    setEditBasicData({
                      ...editBasicData,
                      visionStatement: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 bg-gray-50 border rounded-lg text-sm resize-none font-medium"
                />
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-green-600 uppercase tracking-tighter">
                  Strategy & Description
                </h4>
                <ExpandingTextarea
                  rows={2}
                  placeholder="Target Market *"
                  value={editBasicData.targetMarket}
                  onChange={(e) =>
                    setEditBasicData({
                      ...editBasicData,
                      targetMarket: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 bg-gray-50 border rounded-lg text-sm resize-none font-medium"
                />
                <ExpandingTextarea
                  rows={2}
                  placeholder="Product Description *"
                  value={editBasicData.productDescription}
                  onChange={(e) =>
                    setEditBasicData({
                      ...editBasicData,
                      productDescription: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 bg-gray-50 border rounded-lg text-sm resize-none font-medium"
                />
                <ExpandingTextarea
                  rows={2}
                  placeholder="Price Ranges *"
                  value={editBasicData.priceRanges}
                  onChange={(e) =>
                    setEditBasicData({
                      ...editBasicData,
                      priceRanges: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 bg-gray-50 border rounded-lg text-sm resize-none font-medium"
                />
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-tighter">
                  Place & Promotion
                </h4>
                <ExpandingTextarea
                  rows={2}
                  placeholder="Proposed Location *"
                  value={editBasicData.proposedLocation}
                  onChange={(e) =>
                    setEditBasicData({
                      ...editBasicData,
                      proposedLocation: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 bg-gray-50 border rounded-lg text-sm resize-none font-medium"
                />
                <ExpandingTextarea
                  rows={2}
                  placeholder="Promotional Strategy *"
                  value={editBasicData.promotionalStrategy}
                  onChange={(e) =>
                    setEditBasicData({
                      ...editBasicData,
                      promotionalStrategy: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 bg-gray-50 border rounded-lg text-sm resize-none font-medium"
                />
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-gray-600 uppercase tracking-tighter">
                  Additional Details
                </h4>
                <ExpandingTextarea
                  rows={3}
                  placeholder="Other Relevant Information"
                  value={editBasicData.otherDetails}
                  onChange={(e) =>
                    setEditBasicData({
                      ...editBasicData,
                      otherDetails: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 bg-gray-50 border rounded-lg text-sm resize-none font-medium"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3 bg-gray-50/50 rounded-b-2xl">
              <button
                onClick={() => setShowEditBasicModal(false)}
                className="flex-1 px-4 py-2.5 text-gray-600 font-bold text-sm hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateBasicInfo}
                disabled={isSaving}
                className="flex-1 px-4 py-2.5 bg-[#122244] text-white font-bold text-sm rounded-lg hover:bg-[#1a2f55] shadow-md transition-all flex items-center justify-center gap-2"
              >
                {isSaving ? "Syncing..." : "Update Proposal"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOGOUT CONFIRM */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 text-[#122244]">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl text-center">
            <h3 className="text-lg font-bold mb-2">Confirm Logout</h3>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-5 py-2.5 text-sm font-bold text-gray-600 border border-gray-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="px-5 py-2.5 text-sm font-bold bg-red-600 text-white rounded-lg"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
      {/* SUBMISSION FAILURE MODAL */}
      {showSubmissionFailureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm text-[#122244]">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 sm:p-8 animate-in zoom-in-95 duration-200 border border-red-100 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-extrabold text-red-600 tracking-tight">
                  Proposal Submission Failed
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  Your proposal could not be submitted to the adviser due to the following reason{submissionFailureReasons.length > 1 ? "s" : ""}:
                </p>
              </div>
              <button
                onClick={() => setShowSubmissionFailureModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Reasons List */}
            <div className="overflow-y-auto space-y-3.5 pr-1 my-2 flex-1">
              {submissionFailureReasons.map((reason, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border text-left ${reason.type === "missing"
                    ? "bg-amber-50/70 border-amber-200 text-amber-900"
                    : reason.type === "quota"
                      ? "bg-blue-50/70 border-blue-200 text-blue-900"
                      : "bg-red-50/70 border-red-200 text-red-900"
                    }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm mb-1">
                    {reason.type === "missing" ? (
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    ) : reason.type === "quota" ? (
                      <Info className="w-4 h-4 text-blue-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    )}
                    <span>{reason.title}</span>
                  </div>
                  <p className="text-xs leading-relaxed opacity-90">
                    {reason.description}
                  </p>

                  {/* If items array exists (e.g. missing fields list), render clean chips */}
                  {reason.items && reason.items.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-amber-200/60">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800 mb-2">
                        Missing Required Field{reason.items.length > 1 ? "s" : ""}:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {reason.items.map((item, itemIdx) => (
                          <span
                            key={itemIdx}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-white border border-amber-300 text-amber-900 shadow-2xs"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="pt-4 mt-2 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowSubmissionFailureModal(false);
                  setTimeout(() => {
                    const firstMissing = document.querySelector(".field-has-error");
                    if (firstMissing) {
                      firstMissing.scrollIntoView({ behavior: "smooth", block: "center" });
                      const input = firstMissing.querySelector("input, textarea, select") as HTMLElement | null;
                      if (input) input.focus();
                    }
                  }, 150);
                }}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#c9a654] hover:bg-[#b59545] text-white font-bold text-sm rounded-lg shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Review & Complete Proposal</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {showToast && (
        <div className={`fixed top-8 left-1/2 -translate-x-1/2 bg-white border-b-4 ${toastTitle.toLowerCase().includes("fail") || toastTitle.toLowerCase().includes("error") || toastTitle.toLowerCase().includes("invalid") || toastTitle.toLowerCase().includes("conflict")
          ? "border-red-500"
          : "border-[#c9a654]"
          } shadow-2xl p-5 rounded-xl z-[100] animate-in slide-in-from-top-5 fade-in duration-300 flex items-start gap-4 w-11/12 max-w-lg`}>
          <AlertCircle className={`w-7 h-7 shrink-0 ${toastTitle.toLowerCase().includes("fail") || toastTitle.toLowerCase().includes("error") || toastTitle.toLowerCase().includes("invalid") || toastTitle.toLowerCase().includes("conflict")
            ? "text-red-500"
            : "text-[#c9a654]"
            }`} />
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-gray-900 text-base">
              {toastTitle}
            </h4>
            <p className="text-gray-600 text-sm mt-1 whitespace-pre-line break-words">
              {toastMessage}
            </p>
          </div>
          <button
            onClick={() => setShowToast(false)}
            className="text-gray-400 hover:text-gray-600 self-start mt-1 p-1"
            aria-label="Dismiss notification"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
      {/* SCROLL TO TOP BUTTON (BOTTOM RIGHT) */}
      <ScrollToTopButton />
    </div>
  );
};

export default Projects;