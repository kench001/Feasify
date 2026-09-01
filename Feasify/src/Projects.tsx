import React, { useEffect, useRef, useState } from "react";
import companyNamesData from "./data/companyNames.json";
import Skeleton from "react-loading-skeleton";
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
  Plus,
  Trash2,
  Calculator,
  TrendingUp,
  Package,
  Info,
  Upload,
  Image as ImageIcon,
  ArrowUp,
} from "lucide-react";
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

interface DropdownOption {
  value: string;
  label: string;
}

const CustomDropdown: React.FC<{
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}> = ({
  value,
  options,
  onChange,
  placeholder = "Select category...",
  disabled = false,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen]);

  return (
    <div className={`relative w-full ${className}`} ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between px-4 py-3 bg-gray-50 border ${
          isOpen
            ? "border-[#c9a654] ring-2 ring-[#c9a654]/20 bg-white"
            : "border-gray-200 hover:border-gray-300"
        } rounded-lg text-sm font-medium transition-all text-[#122244] text-left outline-none cursor-pointer disabled:cursor-not-allowed disabled:bg-gray-100/70`}
      >
        <span className={selectedOption && selectedOption.value ? "text-[#122244] font-medium" : "text-gray-400"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-[#c9a654]" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full bg-white border border-gray-100 rounded-xl shadow-xl p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 duration-150 max-h-60 overflow-y-auto">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <div
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-between cursor-pointer ${
                  isSelected
                    ? "bg-amber-50/80 text-[#c9a654] font-bold"
                    : "text-[#122244] hover:bg-gray-50 hover:text-[#c9a654]"
                }`}
              >
                <span>{option.label}</span>
                {isSelected && <Check className="w-4 h-4 text-[#c9a654]" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
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

export interface IngredientItem {
  id: string;
  name: string;
  price: number | string;
}

export interface ProductCostingItem {
  id: string;
  name: string;
  quantityYield: string;
  ingredients: IngredientItem[];
  markupPercentage: string;
  sellingPrice?: string;
  productionCost?: string;
  unitCost?: string;
}

export interface EquipmentItem {
  id: string;
  name: string;
  quantity: number | string;
  unitPrice: number | string;
  total: number;
}

export interface FinancialProposalData {
  products?: ProductCostingItem[];
  equipmentList?: EquipmentItem[];
  isCapitalBorrowed?: boolean;
  interestRate?: string;
  // Legacy fields for backward compatibility
  productionCost?: string;
  quantityYield?: string;
  unitCost?: string;
  markupPercentage?: string;
  markupAmount?: string;
  computedSellingPrice?: string;
  sellingPrice?: string;
  monthlySales?: string;
  variableCost?: string;
  fixedCosts?: string;
  startupCapital?: string;
  operatingDays?: string;
  competitorCount?: number;
  marketDemand?: string;
  opexList?: { id: string; name: string; amount: number }[];
}

export const normalizeProposalProducts = (fin?: FinancialProposalData, fallbackName?: string): ProductCostingItem[] => {
  if (fin?.products && fin.products.length > 0) {
    return fin.products.map((p, idx) => ({
      id: p.id || `prod-${idx + 1}`,
      name: p.name !== undefined ? p.name : "",
      quantityYield: p.quantityYield !== undefined ? String(p.quantityYield) : "",
      ingredients: p.ingredients || [],
      markupPercentage: p.markupPercentage !== undefined ? String(p.markupPercentage) : "100",
      sellingPrice: p.sellingPrice !== undefined ? String(p.sellingPrice) : "",
    }));
  }
  const pCost = Number(fin?.productionCost) || 0;
  const qYield = fin?.quantityYield !== undefined ? String(fin.quantityYield) : "";
  const sPrice = fin?.sellingPrice !== undefined ? String(fin.sellingPrice) : "";
  const mPct = fin?.markupPercentage !== undefined ? String(fin.markupPercentage) : "100";
  
  return [{
    id: "prod-1",
    name: (fallbackName && fallbackName !== "Product 1") ? fallbackName : "",
    quantityYield: qYield,
    ingredients: pCost > 0 ? [{
      id: "ing-1",
      name: "Direct Production / Materials",
      price: pCost,
    }] : [],
    markupPercentage: mPct,
    sellingPrice: sPrice,
  }];
};

export const computeProductMetrics = (product: ProductCostingItem) => {
  const ingredients = product.ingredients || [];
  const totalIngredientCost = ingredients.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  const totalBatchCost = totalIngredientCost > 0 
    ? totalIngredientCost 
    : (Number(product.productionCost) || 0);
  
  const batchYield = Number(product.quantityYield) || 0;
  const unitCost = batchYield > 0 ? totalBatchCost / batchYield : 0;
  
  const markupPct = Number(product.markupPercentage) || 0;
  const markupAmount = unitCost * (markupPct / 100);
  const computedBasePrice = unitCost + markupAmount;
  
  const sellingPrice = (product.sellingPrice !== undefined && product.sellingPrice !== "" && !isNaN(Number(product.sellingPrice)))
    ? Number(product.sellingPrice)
    : (computedBasePrice > 0 ? Number(computedBasePrice.toFixed(2)) : 0);
  
  const revenue = sellingPrice * batchYield;
  const grossProfit = revenue - totalBatchCost;
  
  return {
    totalBatchCost,
    batchYield,
    unitCost,
    markupPct,
    markupAmount,
    computedBasePrice,
    sellingPrice,
    revenue,
    grossProfit,
  };
};

interface ProposalData {
  id?: string;
  groupId: string;
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
  status: "Draft" | "Pending" | "Approved" | "Rejected" | "Revision";
  adviserFeedback?: string;
  feedbackHistory?: FeedbackItem[]; // Added to read adviser feedback
  financialData?: FinancialProposalData;
  createdAt?: any;
}

const initialProposalState: ProposalData = {
  groupId: "",
  businessType: "",
  businessName: "",
  businessLogo: "",
  totalCapital: "",
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

const Projects: React.FC = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [userUid, setUserUid] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [unreadNotificationCount, _setUnreadNotificationCount] = useState(0);

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

  // DTI company names list
  const dtiCompanies: string[] = (companyNamesData as any).companies.map((c: any) => c.name as string);

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

  const [copyrightDB, setCopyrightDB] = useState<CopyrightDB | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

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

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      // Clean up previous listeners when auth state changes
      if (unsubGroup) { unsubGroup(); unsubGroup = undefined; }
      if (unsubProposals) { unsubProposals(); unsubProposals = undefined; }

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
    });

    return () => {
      unsubAuth();
      if (unsubGroup) unsubGroup();
      if (unsubProposals) unsubProposals();
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
      if (group.memberIds.length > 0) {
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
          setAdviserData(d.data());
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
    } catch (e) {}
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
    if (!trimmedName) {
      errors.companyName = "Company name is required.";
    } else {
      // Block names that exactly match a DTI-registered entry (case-insensitive)
      const isDtiRegistered = dtiCompanies.some(
        (n) => n.toLowerCase() === trimmedName.toLowerCase()
      );
      if (isDtiRegistered) {
        errors.companyName = "This business name is already registered in the DTI list. Please enter a unique company name.";
      }
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

    // Preserve user entered total capital
    let newTotalCapital = customProposal.totalCapital;
    if (fieldUpdates.startupCapital !== undefined) {
      newTotalCapital = String(fieldUpdates.startupCapital);
      updatedFin.startupCapital = newTotalCapital;
    } else if (customProposal.totalCapital) {
      updatedFin.startupCapital = customProposal.totalCapital;
    }

    const updatedProposal: ProposalData = {
      ...customProposal,
      totalCapital: newTotalCapital,
      financialData: updatedFin,
    };

    setCurrentProposal(updatedProposal);
    handleAutoSave(updatedProposal);
  };

  // Product costing handlers
  const handleAddProduct = () => {
    const products = normalizeProposalProducts(currentProposal.financialData, currentProposal.businessName);
    const newProduct: ProductCostingItem = {
      id: "prod-" + Date.now(),
      name: "",
      quantityYield: "",
      ingredients: [],
      markupPercentage: "100",
      sellingPrice: "",
    };
    updateFinancialData({ products: [...products, newProduct] });
  };

  const handleRemoveProduct = (index: number) => {
    const products = normalizeProposalProducts(currentProposal.financialData, currentProposal.businessName);
    if (products.length <= 1) return;
    const nextProducts = products.filter((_, i) => i !== index);
    updateFinancialData({ products: nextProducts });
  };

  const handleUpdateProduct = (index: number, updates: Partial<ProductCostingItem>) => {
    const products = normalizeProposalProducts(currentProposal.financialData, currentProposal.businessName);
    const nextProducts = [...products];
    nextProducts[index] = { ...nextProducts[index], ...updates };
    updateFinancialData({ products: nextProducts });
  };

  const handleAddIngredient = (productIndex: number) => {
    const products = normalizeProposalProducts(currentProposal.financialData, currentProposal.businessName);
    const nextProducts = [...products];
    const currentProd = nextProducts[productIndex];
    const newIng: IngredientItem = {
      id: "ing-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      name: "",
      price: "",
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

    setIsSaving(true);
    setSaveStatus("Saving...");
    try {
      const proposalData = {
        ...dataToSave,
        groupId: userGroup.id,
        status: dataToSave.status || "Draft",
      };
      
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
        setCurrentProposal(prev => ({ ...prev, id: docRef.id }));
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
    if (!userGroup) return;

    // Capital & Copyright Validation
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

    // Validation for Pending status (Submit to Adviser)
    if (status === "Pending") {
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
        const value = currentProposal[field];
        return !value || (typeof value === "string" && value.trim() === "");
      });

      if (missingFields.length > 0) {
        setToastTitle("Incomplete Proposal");
        setToastMessage("Please fill in all required fields before submitting to the adviser.");
        setShowToast(true);
        setTimeout(() => setShowToast(false), 4000);
        return;
      }

      setIsSubmitting(true);
    } else {
      setIsSaving(true);
    }

    try {
      const proposalData = {
        ...currentProposal,
        groupId: userGroup.id,
        status,
        originalProposalFinancials: currentProposal.originalProposalFinancials || currentProposal.financialData || null,
      };
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
      }
      await fetchProposals(userGroup.id);
      setActiveView("dashboard");
      setCurrentProposal(initialProposalState);
    } catch (error) {
      console.error(error);
      setToastTitle("Error");
      setToastMessage("Failed to save proposal.");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
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
      setToastTitle("Required Fields");
      setToastMessage("Please fill in all required fields.");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
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
        tagline: editBasicData.tagline,
        missionStatement: editBasicData.missionStatement,
        visionStatement: editBasicData.visionStatement,
        targetMarket: editBasicData.targetMarket,
        productDescription: editBasicData.productDescription,
        priceRanges: editBasicData.priceRanges,
        proposedLocation: editBasicData.proposedLocation,
        promotionalStrategy: editBasicData.promotionalStrategy,
        otherDetails: editBasicData.otherDetails,
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
    } catch (error) {
      console.error("Error updating info:", error);
      setToastTitle("Error");
      setToastMessage("Failed to update information.");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
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
          <button
            onClick={() => navigate("/dashboard")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"
          >
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold bg-[#c9a654] text-white transition-all shadow-md">
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
      <div className="p-4 border-t border-white/10 bg-black/20 flex items-center gap-3">
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
        <main className={`flex-1 transition-all duration-300 ${isSidebarOpen ? "lg:ml-64" : "ml-0"}`}>
          <div className="bg-white border-b border-gray-100 p-4 flex items-center gap-2 text-sm text-gray-500">
            <SidebarIcon className="w-4 h-4 cursor-pointer text-gray-300" />
            <span className="mx-2">|</span> FeasiFy <span>›</span>{" "}
            <span className="font-semibold text-gray-900">Projects</span>
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
               {Array.from({length: cachedCount}).map((_, i) => (
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
        className={`flex-1 transition-all duration-300 ${isSidebarOpen ? "lg:ml-64" : "ml-0"}`}
      >
        <div className="bg-white border-b border-gray-100 p-4 flex items-center gap-2 text-sm text-gray-500">
          <SidebarIcon
            className="w-4 h-4 cursor-pointer hover:text-gray-800 transition-colors"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          />
          <span className="mx-2">|</span> FeasiFy <span>›</span>{" "}
          <span className="font-semibold text-gray-900">Projects</span>
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
                    <Users className="w-4 h-4" /> {userGroup.memberIds.length + 1}{" "}
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

                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-[#122244]">
                    Business Proposals
                  </h2>
                  <div className="relative group">
                    <button
                      onClick={() => {
                        setCurrentProposal(initialProposalState);
                        setIsEditingMode(true);
                        setSaveStatus("All changes saved");
                        setActiveView("form");
                      }}
                      disabled={!!activeBusiness}
                      className={`flex items-center gap-2 px-5 py-2.5 font-bold rounded-lg shadow-md transition-all text-sm ${
                        activeBusiness 
                          ? "bg-gray-400 cursor-not-allowed opacity-70 text-white" 
                          : "bg-[#c9a654] text-white hover:bg-[#b59545]"
                      }`}
                    >
                      + New Proposal
                    </button>
                    {activeBusiness && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 px-3 py-1.5 bg-[#122244] text-white text-[11px] font-bold rounded-lg opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 transition-all duration-150 pointer-events-none whitespace-nowrap shadow-xl z-50 flex flex-col items-center border border-white/10">
                        Already has Approved Business
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
                    {filteredProposals.map((proposal) => {
                      let isApproved = proposal.status === "Approved";
                      let isRejected = proposal.status === "Rejected";
                      let isRevision = proposal.status === "Revision";

                      return (
                        <div
                          key={proposal.id}
                          className={`bg-white rounded-xl border-2 p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
                            isApproved ? "border-green-400" : 
                            isRejected ? "border-red-300" : 
                            isRevision ? "border-orange-300" : "border-gray-200"
                          }`}
                        >
                          <div className="flex gap-4 items-center w-full sm:w-auto">
                            <div
                              className={`w-12 h-12 rounded-xl flex flex-shrink-0 items-center justify-center font-bold text-sm overflow-hidden border shadow-2xs ${
                                proposal.businessLogo
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
                                <h3 className="font-bold text-[#122244] text-base truncate max-w-[280px]">
                                  {proposal.businessName || "Untitled Proposal"}
                                </h3>
                                <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                                  proposal.status === 'Approved' ? 'bg-green-100 text-green-700' :
                                  proposal.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                                  proposal.status === 'Revision' ? 'bg-orange-100 text-orange-700' :
                                  proposal.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-gray-100 text-gray-600'
                                }`}>
                                  {proposal.status === 'Revision' ? 'Needs Revision' : proposal.status}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider truncate">
                                {proposal.businessType || "No Category Selected"}
                              </p>
                              {proposal.createdAt && (
                                <div className="flex items-center text-gray-400 mt-1.5 gap-1.5 text-xs font-medium">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>
                                    Submitted: {formatDateTime(proposal.createdAt)}
                                  </span>
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
                              <button
                                onClick={() => {
                                  setCurrentProposal(proposal);
                                  setShowLockInModal(true);
                                }}
                                disabled={!!activeBusiness}
                                className={`px-5 py-2.5 text-white font-bold text-sm rounded-lg w-full sm:w-auto transition-all ${
                                  activeBusiness 
                                    ? "bg-gray-400 cursor-not-allowed opacity-70" 
                                    : "bg-green-600 hover:bg-green-700 shadow-md"
                                }`}
                                title={activeBusiness ? "Another business is already setup" : ""}
                              >
                                Setup Approved Business
                              </button>
                            )
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setCurrentProposal(proposal);
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
                                      setIsEditingMode(true);
                                      setSaveStatus("All changes saved");
                                      setActiveView("form");
                                    }}
                                    disabled={proposal.status === 'Pending'}
                                    className={`px-5 py-2 font-bold text-sm rounded-lg flex items-center gap-2 transition-all ${
                                      proposal.status === 'Pending'
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
                      <div className="flex items-center gap-2 px-4">
                        <span
                          className={`text-xs font-bold flex items-center gap-1.5 ${isSaving ? "text-gray-400 animate-pulse" : "text-green-600"}`}
                        >
                          {isSaving ? <Save size={14} /> : <CheckCircle2 size={14} />} {saveStatus}
                        </span>
                      </div>
                    )}
                    {isEditingMode && (
                      <button
                        onClick={() => handleSaveProposal("Pending")}
                        disabled={
                          isSubmitting ||
                          checkBusinessName(currentProposal.businessName, copyrightDB || undefined).isCopyrighted ||
                          checkTagline(currentProposal.tagline, copyrightDB || undefined).isCopyrighted ||
                          checkTotalCapital(currentProposal.totalCapital).isNegative
                        }
                        className={`flex-1 sm:flex-none px-5 py-2.5 bg-[#c9a654] text-white font-bold text-sm rounded-lg hover:bg-[#b59545] shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 ${
                          isSubmitting ? "opacity-80 cursor-not-allowed" : ""
                        }`}
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
                      <div className={`p-6 rounded-xl border-2 flex flex-col gap-4 mb-8 ${
                        currentProposal.status === 'Rejected' ? 'bg-red-50 border-red-200' :
                        currentProposal.status === 'Approved' ? 'bg-green-50 border-green-200' :
                        'bg-blue-50 border-blue-200'
                      }`}>
                        <div className="flex justify-between items-center mb-4">
                          <h4 className={`text-xs font-extrabold uppercase tracking-widest flex items-center gap-2 ${
                            currentProposal.status === 'Rejected' ? 'text-red-700' :
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
                                <span className="text-[10px] text-gray-500 font-medium">{new Date(item.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
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
                        <div>
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
                                  className="w-full px-4 py-2.5 bg-white border border-[#c9a654]/40 focus:border-[#c9a654] focus:ring-2 focus:ring-[#c9a654]/20 rounded-lg outline-none text-sm font-medium transition-all shadow-sm"
                                />
                              </div>
                            )}
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                            Business Name <span className="text-red-500">*</span>
                          </label>
                          {(() => {
                            const check = checkBusinessName(currentProposal.businessName, copyrightDB || undefined);
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
                                  className={`w-full px-4 py-3 bg-gray-50 border ${
                                    check.isCopyrighted ? "border-red-500 bg-red-50/20" : "border-gray-200"
                                  } rounded-lg outline-none text-sm font-medium transition-colors`}
                                />
                                {check.isCopyrighted && (
                                  <p className="text-red-500 text-xs font-semibold mt-1.5 flex items-start gap-1">
                                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                    <span>{check.errorMessage}</span>
                                  </p>
                                )}
                              </>
                            );
                          })()}
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
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                            Total Capital (₱) <span className="text-red-500">*</span>
                          </label>
                          {(() => {
                            const check = checkTotalCapital(currentProposal.totalCapital);
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
                                  className={`w-full px-4 py-3 bg-gray-50 border ${
                                    check.isNegative ? "border-red-500 bg-red-50/20" : "border-gray-200"
                                  } rounded-lg outline-none text-sm font-medium transition-colors`}
                                />
                                {check.isNegative && (
                                  <p className="text-red-500 text-xs font-semibold mt-1.5 flex items-start gap-1">
                                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                    <span>{check.errorMessage}</span>
                                  </p>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                            Tagline <span className="text-red-500">*</span>
                          </label>
                          {(() => {
                            const check = checkTagline(currentProposal.tagline, copyrightDB || undefined);
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
                                  className={`w-full px-4 py-3 bg-gray-50 border ${
                                    check.isCopyrighted ? "border-red-500 bg-red-50/20" : "border-gray-200"
                                  } rounded-lg outline-none text-sm font-medium transition-colors`}
                                />
                                {check.isCopyrighted && (
                                  <p className="text-red-500 text-xs font-semibold mt-1.5 flex items-start gap-1">
                                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                    <span>{check.errorMessage}</span>
                                  </p>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                      <div>
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
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm resize-none font-medium"
                        />
                      </div>
                    </section>

                    <section>
                      <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 mb-6">
                        <Star className="w-5 h-5 text-purple-500 fill-current" />{" "}
                        MISSION & VISION
                      </h3>
                      <div className="space-y-6">
                        <div>
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
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm resize-none font-medium"
                          />
                        </div>
                        <div>
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
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm resize-none font-medium"
                          />
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
                        <div>
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
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm resize-none font-medium"
                          />
                        </div>
                        <div>
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
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm resize-none font-medium"
                          />
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
                      <div className="bg-gradient-to-r from-[#122244] via-[#1a3060] to-[#122244] p-5 sm:p-6 rounded-2xl border border-amber-300/30 text-white shadow-md relative overflow-hidden">
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
                      </div>

                      {/* SECTION 1: PRODUCT COSTING & YIELD (BATCH / PRODUCTION MODEL) */}
                      <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#122244] text-white text-[11px] font-bold flex items-center justify-center">1</span>
                            <h4 className="font-bold text-xs uppercase tracking-wider text-[#122244]">
                              Product Costing & Yield (Batch / Production Model)
                            </h4>
                          </div>
                          {isEditingMode && (
                            <button
                              type="button"
                              onClick={handleAddProduct}
                              className="self-start sm:self-auto flex items-center gap-1.5 text-xs font-bold text-[#c9a654] hover:text-[#b59545] bg-amber-50 px-3 py-1 rounded-lg border border-amber-200 hover:bg-amber-100 transition-colors"
                            >
                              <Plus size={13} /> Add Product
                            </button>
                          )}
                        </div>

                        {/* PRODUCTS LIST */}
                        <div className="space-y-6">
                          {productsList.map((product, prodIdx) => {
                            const metrics = computeProductMetrics(product);
                            const ingredients = product.ingredients || [];

                            return (
                              <div
                                key={product.id || prodIdx}
                                className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 space-y-5 shadow-sm relative"
                              >
                                {/* Product Header */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                                  <div className="flex items-center gap-3 flex-1">
                                    <span className="px-2.5 py-1 bg-[#122244] text-white text-[11px] font-black rounded-lg uppercase tracking-wider">
                                      Product #{prodIdx + 1}
                                    </span>
                                    <div className="flex-1 max-w-md">
                                      <input
                                        disabled={!isEditingMode}
                                        type="text"
                                        placeholder={`Product ${prodIdx + 1}`}
                                        value={product.name || ""}
                                        onChange={(e) => handleUpdateProduct(prodIdx, { name: e.target.value })}
                                        className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-extrabold text-[#122244] focus:bg-white focus:border-[#c9a654] outline-none"
                                      />
                                    </div>
                                  </div>
                                  {isEditingMode && productsList.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveProduct(prodIdx)}
                                      className="self-end sm:self-auto flex items-center gap-1 text-xs text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg transition-colors font-semibold"
                                    >
                                      <Trash2 size={13} /> Remove Product
                                    </button>
                                  )}
                                </div>

                                {/* Product Yield & Ingredients */}
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                                  {/* Yield Input & Calculation */}
                                  <div className="lg:col-span-4 space-y-4">
                                    <div>
                                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                                        Batch Quantity Yield (Units) <span className="text-red-500">*</span>
                                      </label>
                                      <input
                                        disabled={!isEditingMode}
                                        type="number"
                                        placeholder="e.g. 12"
                                        value={product.quantityYield}
                                        onChange={(e) => handleUpdateProduct(prodIdx, { quantityYield: e.target.value })}
                                        className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold text-[#122244] focus:bg-white focus:border-[#c9a654] outline-none"
                                      />
                                      <p className="text-[9px] text-gray-400 mt-1 italic">
                                        Total finished items produced from this batch
                                      </p>
                                    </div>

                                    {/* Total Batch Cost & Unit Cost Preview */}
                                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200/80 space-y-2">
                                      <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500 font-medium">Total Batch Cost:</span>
                                        <span className="font-extrabold text-[#122244]">
                                          ₱{metrics.totalBatchCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                      </div>
                                      <div className="flex justify-between items-center text-xs pt-1.5 border-t border-gray-200/60">
                                        <span className="text-gray-500 font-medium">Yield:</span>
                                        <span className="font-bold text-gray-800">{metrics.batchYield || 0} units</span>
                                      </div>
                                      <div className="flex justify-between items-center text-xs pt-1.5 border-t border-gray-200/60">
                                        <span className="text-[#122244] font-bold">Computed Unit Cost (COGS):</span>
                                        <span className="font-black text-[#122244] text-sm">
                                          ₱{metrics.unitCost.toFixed(2)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Ingredient List */}
                                  <div className="lg:col-span-8 space-y-3">
                                    <div className="flex justify-between items-center">
                                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                        Ingredient List & Costs
                                      </label>
                                      {isEditingMode && (
                                        <button
                                          type="button"
                                          onClick={() => handleAddIngredient(prodIdx)}
                                          className="flex items-center gap-1 text-[11px] font-bold text-[#c9a654] hover:text-[#b59545] bg-amber-50 px-2.5 py-0.5 rounded border border-amber-200/70 hover:bg-amber-100 transition-colors"
                                        >
                                          <Plus size={12} /> Add Ingredient
                                        </button>
                                      )}
                                    </div>

                                    {ingredients.length === 0 ? (
                                      <div className="p-4 bg-gray-50/70 rounded-xl border border-dashed border-gray-200 text-center space-y-1.5">
                                        <p className="text-xs text-gray-400 italic">No ingredients listed yet for this product.</p>
                                        {isEditingMode && (
                                          <button
                                            type="button"
                                            onClick={() => handleAddIngredient(prodIdx)}
                                            className="text-xs font-bold text-[#c9a654] hover:underline"
                                          >
                                            + Add your first ingredient
                                          </button>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                        {ingredients.map((ing, ingIdx) => (
                                          <div
                                            key={ing.id || ingIdx}
                                            className="flex gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-100 text-xs"
                                          >
                                            <input
                                              disabled={!isEditingMode}
                                              type="text"
                                              placeholder="Ingredient Name (e.g. Flour, Spinach)"
                                              value={ing.name}
                                              onChange={(e) => handleUpdateIngredient(prodIdx, ingIdx, { name: e.target.value })}
                                              className="flex-1 px-2.5 py-1.5 bg-white border border-gray-200 rounded text-xs font-medium text-gray-800 focus:border-[#c9a654] outline-none"
                                            />
                                            <div className="w-28 relative">
                                              <span className="absolute left-2 top-1.5 text-xs text-gray-400">₱</span>
                                              <input
                                                disabled={!isEditingMode}
                                                type="number"
                                                placeholder="0.00"
                                                value={ing.price !== undefined ? ing.price : ""}
                                                onChange={(e) => handleUpdateIngredient(prodIdx, ingIdx, { price: e.target.value === "" ? "" : Number(e.target.value) })}
                                                className="w-full pl-5 pr-2 py-1.5 bg-white border border-gray-200 rounded text-xs font-bold text-gray-800 focus:border-[#c9a654] outline-none text-right"
                                              />
                                            </div>
                                            {isEditingMode && (
                                              <button
                                                type="button"
                                                onClick={() => handleRemoveIngredient(prodIdx, ingIdx)}
                                                className="p-1 text-gray-400 hover:text-red-500 rounded"
                                                title="Remove ingredient"
                                              >
                                                <Trash2 size={13} />
                                              </button>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* SECTION 2: MARK-UP STRATEGY & TARGET SELLING PRICE (PER PRODUCT) */}
                                <div className="pt-4 border-t border-gray-100 space-y-3">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="w-4 h-4 rounded-full bg-[#c9a654] text-white text-[10px] font-bold flex items-center justify-center">2</span>
                                      <h5 className="font-bold text-xs uppercase tracking-wider text-[#122244]">
                                        Mark-up Strategy & Target Selling Price
                                      </h5>
                                    </div>
                                    {isEditingMode && (
                                      <div className="flex gap-1.5 items-center">
                                        <span className="text-[10px] text-gray-400 font-bold uppercase">Presets:</span>
                                        {["50", "100", "120"].map((pct) => (
                                          <button
                                            key={pct}
                                            type="button"
                                            onClick={() => {
                                              const mPct = Number(pct);
                                              const compBase = metrics.unitCost + (metrics.unitCost * (mPct / 100));
                                              handleUpdateProduct(prodIdx, {
                                                markupPercentage: pct,
                                                sellingPrice: compBase > 0 ? String(Math.round(compBase)) : ""
                                              });
                                            }}
                                            className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-colors ${
                                              String(product.markupPercentage) === pct
                                                ? "bg-[#c9a654] text-white border-[#c9a654]"
                                                : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                                            }`}
                                          >
                                            {pct}%
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                                        Mark-up Percentage (%)
                                      </label>
                                      <input
                                        disabled={!isEditingMode}
                                        type="number"
                                        placeholder="e.g. 100"
                                        value={product.markupPercentage}
                                        onChange={(e) => {
                                          const newPct = e.target.value;
                                          const mPct = Number(newPct) || 0;
                                          const compBase = metrics.unitCost + (metrics.unitCost * (mPct / 100));
                                          handleUpdateProduct(prodIdx, {
                                            markupPercentage: newPct,
                                            sellingPrice: compBase > 0 ? String(Math.round(compBase)) : (product.sellingPrice || "")
                                          });
                                        }}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-[#122244] focus:bg-white focus:border-[#c9a654] outline-none"
                                      />
                                      <div className="mt-1.5 px-2.5 py-1 bg-amber-50 rounded-lg border border-amber-200/80 flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-[#b59545] uppercase tracking-wider">Markup Amount</span>
                                        <span className="text-xs font-black text-[#122244]">+₱{metrics.markupAmount.toFixed(2)}</span>
                                      </div>
                                    </div>

                                    <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-200/80 flex flex-col justify-center">
                                      <span className="text-[10px] font-bold text-[#b59545] uppercase">Computed Base Price</span>
                                      <p className="text-lg font-black text-[#c9a654] mt-0.5">₱{metrics.computedBasePrice.toFixed(2)}</p>
                                      <span className="text-[9px] text-gray-500">Unit Cost + Mark-up</span>
                                    </div>

                                    <div>
                                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                                        Final / Target Selling Price (₱) <span className="text-[#c9a654] font-black">*</span>
                                      </label>
                                      <input
                                        disabled={!isEditingMode}
                                        type="number"
                                        placeholder={metrics.computedBasePrice > 0 ? String(Math.round(metrics.computedBasePrice)) : "0"}
                                        value={product.sellingPrice !== undefined ? product.sellingPrice : ""}
                                        onChange={(e) => handleUpdateProduct(prodIdx, { sellingPrice: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border-2 border-[#c9a654] rounded-lg text-xs font-black text-[#122244] focus:ring-2 focus:ring-[#c9a654]/20 outline-none"
                                      />
                                      <p className="text-[9px] text-gray-400 mt-1 italic">
                                        Psychological rounding allowed (e.g. ₱89.06 → ₱89.00)
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {/* DYNAMIC SUMMARY CARDS (PER PRODUCT) */}
                                <div className="pt-3 border-t border-gray-100">
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
                                    Product Economics Summary ({product.name || `Product #${prodIdx + 1}`})
                                  </span>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[#122244]">
                                    {/* Unit Cost (COGS) */}
                                    <div className="bg-gray-50/90 p-3 rounded-xl border border-gray-200">
                                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Unit Cost (COGS)</span>
                                      <p className="text-base font-black text-[#122244] mt-0.5">₱{metrics.unitCost.toFixed(2)}</p>
                                      <p className="text-[9px] text-gray-400 font-medium mt-0.5 truncate">Total Cost / Yield</p>
                                    </div>

                                    {/* Target Price */}
                                    <div className="bg-amber-50/40 p-3 rounded-xl border border-amber-200">
                                      <span className="text-[10px] font-bold text-[#b59545] uppercase tracking-wider block">Target Price</span>
                                      <p className="text-base font-black text-[#c9a654] mt-0.5">₱{metrics.sellingPrice.toFixed(2)}</p>
                                      <p className="text-[9px] text-gray-500 font-semibold mt-0.5">+{metrics.markupPct}% Mark-up</p>
                                    </div>

                                    {/* Revenue */}
                                    <div className="bg-green-50/40 p-3 rounded-xl border border-green-200">
                                      <span className="text-[10px] font-bold text-green-700 uppercase tracking-wider block">Revenue</span>
                                      <p className="text-base font-black text-green-700 mt-0.5">
                                        ₱{metrics.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </p>
                                      <p className="text-[9px] text-green-600 font-medium mt-0.5">Selling Price × Quantity</p>
                                    </div>

                                    {/* Gross Profit */}
                                    <div className="bg-purple-50/40 p-3 rounded-xl border border-purple-200">
                                      <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">Gross Profit</span>
                                      <p className={`text-base font-black mt-0.5 ${metrics.grossProfit >= 0 ? "text-purple-700" : "text-red-500"}`}>
                                        ₱{metrics.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </p>
                                      <p className="text-[9px] text-purple-600 font-medium mt-0.5">Revenue - Total Cost</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* SECTION 2: STARTUP EQUIPMENT & ASSETS BREAKDOWN (CAPEX) */}
                      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 space-y-4 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#122244] text-white text-[11px] font-bold flex items-center justify-center">2</span>
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
                                      onChange={(e) => handleUpdateEquipmentItem(idx, { quantity: e.target.value === "" ? "" : Number(e.target.value) })}
                                      className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-[#122244] text-center focus:border-[#c9a654] outline-none"
                                    />
                                  </td>
                                  <td className="p-3">
                                    <div className="relative">
                                      <span className="absolute left-2.5 top-1.5 text-xs text-gray-400">₱</span>
                                      <input
                                        disabled={!isEditingMode}
                                        type="number"
                                        placeholder="0.00"
                                        value={item.unitPrice !== undefined ? item.unitPrice : ""}
                                        onChange={(e) => handleUpdateEquipmentItem(idx, { unitPrice: e.target.value === "" ? "" : Number(e.target.value) })}
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
                                  placeholder="e.g. 5 for 5%"
                                  value={fin.interestRate || ""}
                                  onChange={(e) => updateFinancialData({ interestRate: e.target.value })}
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
                        <div>
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
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm resize-none font-medium"
                          />
                        </div>
                        <div>
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
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm resize-none font-medium"
                          />
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
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                          Tagline
                        </p>
                        <p className="text-gray-800 font-bold text-lg">
                          {activeBusiness.tagline || "None Provided"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">
                          Mission Statement
                        </p>
                        <p className="text-gray-600 text-sm leading-relaxed">
                          {activeBusiness.missionStatement || "None Provided"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">
                          Vision Statement
                        </p>
                        <p className="text-gray-600 text-sm leading-relaxed">
                          {activeBusiness.visionStatement || "None Provided"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">
                          Target Market
                        </p>
                        <p className="text-gray-600 text-sm leading-relaxed">
                          {activeBusiness.targetMarket || "None Provided"}
                        </p>
                      </div>

                      <div className="h-px bg-gray-100 my-4"></div>

                      <div>
                        <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">
                          Product Description
                        </p>
                        <p className="text-gray-600 text-sm leading-relaxed">
                          {activeBusiness.productDescription || "None Provided"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest mb-1">
                          Specific Pricing
                        </p>
                        <p className="text-gray-600 text-sm leading-relaxed">
                          {activeBusiness.priceRanges || "None Provided"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-1">
                          Location
                        </p>
                        <p className="text-gray-800 font-medium">
                          {activeBusiness.proposedLocation || "None Provided"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-purple-500 uppercase tracking-widest mb-1">
                          Promotional Strategy
                        </p>
                        <p className="text-gray-600 text-sm leading-relaxed">
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
                                <span className="text-xs font-bold text-[#122244] uppercase tracking-wider">Product Costing & Yield Profiles</span>
                              </div>
                              {products.map((prod, pIdx) => {
                                const metrics = computeProductMetrics(prod);
                                const ingredients = prod.ingredients || [];

                                return (
                                  <div key={prod.id || pIdx} className="bg-gray-50/70 p-4 rounded-xl border border-gray-100 space-y-3 text-xs">
                                    <div className="flex justify-between items-center border-b border-gray-200/60 pb-2">
                                      <span className="font-extrabold text-sm text-[#122244]">
                                        {prod.name || `Product #${pIdx + 1}`}
                                      </span>
                                      <span className="text-[11px] font-bold text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200">
                                        Yield: {metrics.batchYield || 0} units
                                      </span>
                                    </div>

                                    {/* Per-Product Summary Cards */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                                      <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                                        <span className="text-[9px] text-gray-400 font-bold uppercase block">Unit Cost (COGS)</span>
                                        <span className="font-extrabold text-[#122244] text-sm">₱{metrics.unitCost.toFixed(2)}</span>
                                      </div>
                                      <div className="bg-amber-50/50 p-2.5 rounded-lg border border-amber-200">
                                        <span className="text-[9px] text-[#b59545] font-bold uppercase block">Target Price</span>
                                        <span className="font-extrabold text-[#c9a654] text-sm">₱{metrics.sellingPrice.toFixed(2)}</span>
                                      </div>
                                      <div className="bg-green-50/50 p-2.5 rounded-lg border border-green-200">
                                        <span className="text-[9px] text-green-700 font-bold uppercase block">Revenue</span>
                                        <span className="font-extrabold text-green-700 text-sm">
                                          ₱{metrics.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                      </div>
                                      <div className="bg-purple-50/50 p-2.5 rounded-lg border border-purple-200">
                                        <span className="text-[9px] text-purple-700 font-bold uppercase block">Gross Profit</span>
                                        <span className={`font-extrabold text-sm ${metrics.grossProfit >= 0 ? "text-purple-700" : "text-red-500"}`}>
                                          ₱{metrics.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Ingredients list if present */}
                                    {ingredients.length > 0 && (
                                      <div className="space-y-1.5 pt-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Ingredients Breakdown:</span>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-28 overflow-y-auto pr-1">
                                          {ingredients.map((ing, iIdx) => (
                                            <div key={iIdx} className="flex justify-between text-xs bg-white px-2.5 py-1 rounded border border-gray-100">
                                              <span className="text-gray-700 truncate">{ing.name || 'Ingredient'}</span>
                                              <span className="font-semibold text-gray-900 ml-2">₱{Number(ing.price || 0).toFixed(2)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
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
                        {(userGroup?.memberIds.length || 0) + 1} Members Total
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

                        {groupMembersData.map((member) => (
                          <div key={member.id} className="flex items-center gap-3 p-2">
                            <div className="w-10 h-10 bg-green-500 rounded-full text-white flex items-center justify-center font-bold text-sm shadow-sm">
                              {getInitials(member.firstName)}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900">
                                {member.firstName} {member.lastName}
                              </p>
                              <p className="text-[10px] text-gray-500">{member.studentId}</p>
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
                              <span className="text-[10px] text-gray-400 font-medium">{new Date(item.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
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
      {showSetupModal && (() => {
        const nameSuggestions = companyNameQuery.trim().length >= 1
          ? dtiCompanies.filter((n) =>
              n.toLowerCase().includes(companyNameQuery.trim().toLowerCase())
            ).slice(0, 8)
          : [];

        return (
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

                    {/* Company Name with autocomplete */}
                    <div ref={companyNameRef} className="relative">
                      <label className="block text-xs font-bold text-[#122244] uppercase tracking-wider mb-1.5">
                        Company Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={companyNameQuery}
                        onChange={(e) => {
                          setCompanyNameQuery(e.target.value);
                          setSetupCompanyName(e.target.value);
                          setShowNameSuggestions(true);
                          if (setupErrors.companyName) setSetupErrors(prev => ({ ...prev, companyName: "" }));
                        }}
                        onFocus={() => setShowNameSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowNameSuggestions(false), 150)}
                        placeholder="Type to search or enter a unique business name..."
                        className={`w-full px-4 py-3 bg-gray-50 border ${
                          setupErrors.companyName
                            ? "border-red-400 bg-red-50/20"
                            : (!setupErrors.companyName && companyNameQuery.trim().length > 0 && dtiCompanies.some(n => n.toLowerCase() === companyNameQuery.trim().toLowerCase()))
                              ? "border-amber-400 bg-amber-50/20"
                              : "border-gray-200"
                        } rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c9a654]/50 focus:border-[#c9a654] transition-all`}
                      />
                      {/* Submit-time error */}
                      {setupErrors.companyName && (
                        <p className="text-red-500 text-[11px] font-semibold mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />{setupErrors.companyName}
                        </p>
                      )}
                      {/* Real-time duplicate warning (live, before submit) */}
                      {!setupErrors.companyName && companyNameQuery.trim().length > 0 &&
                        dtiCompanies.some(n => n.toLowerCase() === companyNameQuery.trim().toLowerCase()) && (
                        <p className="text-amber-600 text-[11px] font-semibold mt-1.5 flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          This business name is already registered in the DTI list. You cannot use this name — please enter a unique one.
                        </p>
                      )}
                      {/* Suggestions dropdown */}
                      {showNameSuggestions && nameSuggestions.length > 0 && (
                        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden">
                          {nameSuggestions.map((name) => (
                            <button
                              key={name}
                              type="button"
                              onMouseDown={() => {
                                setSetupCompanyName(name);
                                setCompanyNameQuery(name);
                                setShowNameSuggestions(false);
                                if (setupErrors.companyName) setSetupErrors(prev => ({ ...prev, companyName: "" }));
                              }}
                              className="w-full text-left px-4 py-2.5 text-sm text-[#122244] hover:bg-amber-50 hover:text-[#c9a654] font-medium transition-colors"
                            >
                              {name}
                            </button>
                          ))}
                          <div className="px-4 py-2 text-[10px] text-gray-400 border-t border-gray-50 italic">
                            Data reference: DTI Business Name Registration System
                          </div>
                        </div>
                      )}
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
                        className={`w-full px-4 py-3 bg-gray-50 border ${
                          setupErrors.mission ? "border-red-400 bg-red-50/20" : "border-gray-200"
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
                        className={`w-full px-4 py-3 bg-gray-50 border ${
                          setupErrors.vision ? "border-red-400 bg-red-50/20" : "border-gray-200"
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
                          className={`flex-1 px-3 py-2.5 bg-gray-50 border ${
                            setupErrors.objectives && obj.trim() === "" ? "border-red-300" : "border-gray-200"
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
        );
      })()}

      {/* ROSTER MODAL */}
      {showRosterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 flex flex-col animate-in zoom-in-95 duration-200 text-[#122244]">
            <div className="flex justify-between items-start mb-6 border-b pb-4">
              <div>
                <h2 className="text-2xl font-extrabold">Project Roster</h2>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">
                  Group {userGroup?.id.slice(-1) || "1"} Team Members
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

      {/* LOCK-IN MODAL */}
      {showLockInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm text-[#122244]">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-8 text-center">
            <Zap className="w-16 h-16 text-blue-500 mx-auto mb-6" />
            <h2 className="text-2xl font-extrabold mb-2">
              Set as Active Business?
            </h2>
            <p className="text-sm text-gray-500 mb-8">
              Lock in{" "}
              <span className="font-bold text-[#122244]">
                {currentProposal.businessName}
              </span>{" "}
              as official business?
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowLockInModal(false)}
                className="px-5 py-2.5 text-sm font-bold text-gray-600 border border-gray-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleLockInBusiness}
                className="px-5 py-2.5 text-sm font-bold text-white bg-green-600 rounded-lg shadow-md transition-colors"
              >
                Proceed
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
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                    Business Name <span className="text-red-500">*</span>
                  </label>
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
                          className={`w-full px-4 py-2 bg-gray-50 border ${
                            check.isCopyrighted ? "border-red-500 bg-red-50/20" : "border-gray-200"
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
                          className={`w-full px-4 py-2 bg-gray-50 border ${
                            check.isNegative ? "border-red-500 bg-red-50/20" : "border-gray-200"
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
                          className={`w-full px-4 py-2 bg-gray-50 border ${
                            check.isCopyrighted ? "border-red-500 bg-red-50/20" : "border-gray-200"
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
      {showToast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 bg-white border-b-4 border-[#c9a654] shadow-2xl p-5 rounded-xl z-[100] animate-in slide-in-from-top-5 fade-in duration-300 flex items-center gap-4 w-11/12 max-w-lg">
          <AlertCircle className="w-7 h-7 text-[#c9a654] shrink-0" />
          <div className="flex-1">
            <h4 className="font-bold text-gray-900 text-base">
              {toastTitle}
            </h4>
            <p className="text-gray-600 text-sm mt-1">
              {toastMessage}
            </p>
          </div>
          <button
            onClick={() => setShowToast(false)}
            className="text-gray-400 hover:text-gray-600 self-start mt-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
      {/* SCROLL TO TOP BUTTON (BOTTOM RIGHT) */}
      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-40 p-3.5 bg-[#122244] hover:bg-[#1a3264] text-[#c9a654] hover:text-white rounded-full shadow-2xl border-2 border-[#c9a654]/40 hover:border-[#c9a654] transition-all duration-300 transform hover:scale-110 active:scale-95 flex items-center justify-center group animate-in fade-in zoom-in-75 cursor-pointer"
          title="Scroll to Top"
          aria-label="Scroll to top"
        >
          <ArrowUp className="w-5 h-5 transition-transform group-hover:-translate-y-0.5" />
        </button>
      )}
    </div>
  );
};

export default Projects;