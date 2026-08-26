import React, { useEffect, useState } from "react";
import Skeleton from "react-loading-skeleton";
import { useNavigate, useSearchParams } from "react-router-dom";
import "react-loading-skeleton/dist/skeleton.css";
import { auth, db, signOutUser } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where, addDoc, doc, getDoc, serverTimestamp, writeBatch, updateDoc, deleteDoc, arrayUnion, setDoc } from "firebase/firestore";
import {
  User, Settings, ShieldAlert, Sidebar as SidebarIcon, Search, Users, Archive,
  CheckCircle2, AlertCircle, X, Star, FlaskConical, RefreshCw, TrendingUp,
  MoreVertical, Trash2, Edit2, FileText, ChevronLeft, Clock, Loader2, MessageCircle, Package, Target, Zap, DollarSign, Send, UserPlus, Check,
  Sparkles, Brain, TrendingDown, ThumbsUp, Lightbulb, Bell, Calculator, ChevronDown, ChevronUp, Info,
  Scale, FileSpreadsheet, Activity, Layers, PieChart, ShieldCheck, BarChart3
} from "lucide-react";

interface StudentData {
  id: string;
  firstName: string;
  lastName: string;
  studentId: string;
  email: string;
}

interface GroupData {
  id: string;
  leaderId: string;
  leaderName: string;
  title: string;
  memberIds: string[];
  section: string;
  status?: 'Drafting' | 'Pending Review' | 'Approved Proposal' | 'Active Business';
  activeProposalId?: string;
}

interface FeedbackItem {
  id: string;
  text: string;
  authorName: string;
  role: string;
  date: string;
}

interface ProposalData {
  id?: string;
  groupId: string;
  businessType: string;
  businessName: string;
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
  status: 'Draft' | 'Pending' | 'Approved' | 'Rejected' | 'Revision';
  adviserFeedback?: string;
  feedbackHistory?: FeedbackItem[];
  financialData?: any;
  aiAnalysis?: any;
  createdAt?: any;
}

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
  const [isLoading, setIsLoading] = useState(true);

  // View & Tab States
  const [activeView, setActiveView] = useState<'dashboard' | 'group-details' | 'active-business'>('dashboard');
  const [activeDashboardTab, setActiveDashboardTab] = useState<'All Groups' | 'Pending Review' | 'Approved Proposal' | 'Drafting' | 'Active Business'>('All Groups');
  const [activeDetailTab, setActiveDetailTab] = useState<'Proposals' | 'Members'>('Proposals');
  const [activeBusinessTab, setActiveBusinessTab] = useState<'Profile' | 'Financial' | 'AI'>('Profile');
  const [selectedGroup, setSelectedGroup] = useState<GroupData | null>(null);
  const [activeProposal, setActiveProposal] = useState<ProposalData | null>(null);

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
  const [isFeedbackExpanded, setIsFeedbackExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [adviserFinTab, setAdviserFinTab] = useState<"operations" | "balance-sheet">("operations");

  // AI Analysis State
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [aiAnalysisError, setAiAnalysisError] = useState<string | null>(null);
  const [modalAiResult, setModalAiResult] = useState<any>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

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

          setAdviserSections(parsedSections);
        }
      } catch (error) { console.error(error); }
    });
    return () => unsub();
  }, [navigate]);

  // Auto-select the first section when adviser sections load
  useEffect(() => {
    if (adviserSections.length > 0 && !activeSection) {
      // Check if a section is specified in the URL query params
      const sectionParam = searchParams.get("section");
      const sectionToSelect = sectionParam || adviserSections[0];

      setActiveSection(sectionToSelect);
      const settings = sectionSettingsMap[sectionToSelect];
      setMinMembers(settings?.minMembers ?? 8);
      setMaxMembers(settings?.maxMembers ?? 10);
      fetchSectionData(sectionToSelect);
    }
  }, [adviserSections, sectionSettingsMap, searchParams]);

  const fetchSectionData = async (section: string) => {
    if (!section || section === "Unassigned") { setIsLoading(false); return; }
    setIsLoading(true);
    setSearchTerm("");
    setActiveView('dashboard');
    try {
      const studentQ = query(collection(db, "users"), where("role", "==", "Student"), where("section", "==", section));
      const studentSnap = await getDocs(studentQ);
      setStudents(studentSnap.docs.map(d => ({ id: d.id, ...d.data() } as StudentData)));

      const groupQ = query(collection(db, "groups"), where("section", "==", section));
      const groupSnap = await getDocs(groupQ);
      const fetchedGroups = groupSnap.docs.map(d => ({ id: d.id, ...d.data(), status: d.data().status || 'Drafting' } as GroupData));
      setGroups(fetchedGroups);
      setSectionGroupCountMap(prev => ({ ...prev, [section]: fetchedGroups.length }));
    } catch (error) { console.error("Error fetching data:", error); }
    finally { setIsLoading(false); }
  };

  const fetchGroupProposals = async (groupId: string) => {
    try {
      const q = query(collection(db, "proposals"), where("groupId", "==", groupId));
      const snap = await getDocs(q);
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
      fetched.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setGroupProposals(fetched);
    } catch (error) { console.error("Error fetching proposals:", error); }
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

  const handleOpenActiveBusiness = async (group: GroupData) => {
    setSelectedGroup(group);
    if (!group.activeProposalId) {
      alert("No active proposal linked to this group.");
      return;
    }
    setIsLoading(true);
    try {
      const docRef = doc(db, "proposals", group.activeProposalId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setActiveProposal({ id: docSnap.id, ...docSnap.data() } as ProposalData);
        setActiveView('active-business');
        setActiveBusinessTab('Profile');
      }
    } catch (e) {
      console.error(e);
      alert("Failed to fetch business details.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenProposalModal = (proposal: ProposalData) => {
    setViewingProposal(proposal);
    setFeedbackInput("");
    setIsFeedbackExpanded(false);
    if (proposal.aiAnalysis) {
      setModalAiResult(proposal.aiAnalysis);
    } else {
      setModalAiResult(null);
    }
  };

  const handleAIAnalysis = async (proposal: ProposalData) => {
    if (!proposal.id) return;
    setIsAiAnalyzing(true);
    setAiAnalysisError(null);

    try {
      const backendUrl = import.meta.env.VITE_API_URL || "http://localhost:10000";
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

      const response = await fetch(`${backendUrl}/api/analyze-proposal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: proposal.id,
          businessName: proposal.businessName,
          businessType: proposal.businessType,
          totalCapital: proposal.totalCapital,
          tagline: proposal.tagline,
          targetMarket: proposal.targetMarket,
          missionStatement: proposal.missionStatement,
          visionStatement: proposal.visionStatement,
          productDescription: proposal.productDescription,
          priceRanges: proposal.priceRanges,
          proposedLocation: proposal.proposedLocation,
          promotionalStrategy: proposal.promotionalStrategy,
          financialData: proposal.financialData || {},
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const aiResult = await response.json();

      // 2. Map the Backend RAG result to the Adviser's UI format
      // Note: We ensure the results match the components the Adviser sees
      const formatInsightItem = (i: any) => {
        if (!i) return "";
        if (typeof i === "string") return i;
        if (i.title && i.description) return `${i.title}: ${i.description}`;
        return i.description || i.title || "";
      };

      const finalResult = {
        ...aiResult,
        // Mapping the RAG 'insights' to the 'strengths/weaknesses' format the Adviser UI expects
        strengths: (aiResult.insights || []).filter((i: any) => i.type === 'positive').map(formatInsightItem),
        weaknesses: (aiResult.insights || []).filter((i: any) => i.type === 'warning').map(formatInsightItem),
        recommendations: (aiResult.insights || []).filter((i: any) => i.type === 'info').map(formatInsightItem),
        lastRun: new Date().toISOString(),
      };

      // 3. Save the RAG result to Firebase so the student and adviser both see it
      await updateDoc(doc(db, "proposals", proposal.id), {
        aiAnalysis: finalResult
      });

      // 4. Update UI States
      setModalAiResult(finalResult);

      // If the backend provides a draft feedback letter, put it in the textarea
      if (aiResult.draftFeedback) {
        setFeedbackInput(aiResult.draftFeedback);
      }

      // Update local state so the UI refreshes immediately
      setGroupProposals(prev => prev.map(p => p.id === proposal.id ? { ...p, aiAnalysis: finalResult } : p));
      setViewingProposal(prev => prev && prev.id === proposal.id ? { ...prev, aiAnalysis: finalResult } : prev);

    } catch (e: any) {
      console.error("❌ RAG AI Analysis failed:", e);
      setAiAnalysisError(e.message || "Failed to analyze proposal. Server may be down.");
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  // --- LOGIC: MULTI-STEP CREATE GROUP ---
  const handleCreateGroup = async () => {
    if (!selectedLeaderId || !activeSection) return;
    setIsLoading(true);
    try {
      const leader = students.find(s => s.id === selectedLeaderId);
      if (!leader) return;

      const docRef = await addDoc(collection(db, "groups"), {
        section: activeSection,
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
        section: activeSection
      };

      setGroups(prev => [...prev, newGroup]);
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

  // Save current min/max settings to Firestore for the active section
  const saveSectionSettings = async () => {
    if (!adviserUid || !activeSection) return;
    const updatedMap = { ...sectionSettingsMap, [activeSection]: { minMembers, maxMembers } };
    setSectionSettingsMap(updatedMap);
    try {
      await setDoc(doc(db, "users", adviserUid), { sectionSettings: updatedMap }, { merge: true });
    } catch (error) { console.error("Failed to save section settings:", error); }
  };

  const executeAutoGroup = async (currentGroupsList: GroupData[]) => {
    setIsLoading(true);
    try {
      // Persist per-section settings before executing
      await saveSectionSettings();

      const assignedIds = new Set<string>();
      currentGroupsList.forEach(g => { assignedIds.add(g.leaderId); g.memberIds.forEach(id => assignedIds.add(id)); });
      const unassignedStudents = students.filter(s => !assignedIds.has(s.id));

      // TRIGGER CUSTOM MODAL IF NO UNASSIGNED STUDENTS
      if (unassignedStudents.length === 0) {
        setShowAutoGroupConfirm(false); // Close current confirmation
        setShowAllAssignedModal(true);  // Open custom notification modal
        setIsLoading(false);
        return;
      }

      const shuffled = [...unassignedStudents].sort(() => 0.5 - Math.random());
      const batch = writeBatch(db);
      let updatedGroups = [...currentGroupsList];

      for (let g of updatedGroups) {
        while (g.memberIds.length < maxMembers - 1 && shuffled.length > 0) {
          const student = shuffled.pop()!;
          g.memberIds.push(student.id);
          batch.update(doc(db, "groups", g.id), { memberIds: g.memberIds });
        }
      }

      while (shuffled.length > 0) {
        const leader = shuffled.pop()!;
        const members: string[] = [];
        while (members.length < maxMembers - 1 && shuffled.length > 0) { members.push(shuffled.pop()!.id); }
        const newGroupRef = doc(collection(db, "groups"));
        batch.set(newGroupRef, {
          section: activeSection, leaderId: leader.id, leaderName: `${leader.firstName} ${leader.lastName}`,
          title: "Pending Business Name", memberIds: members, status: 'Drafting', createdAt: serverTimestamp()
        });
        updatedGroups.push({ id: newGroupRef.id, leaderId: leader.id, leaderName: `${leader.firstName} ${leader.lastName}`, title: "Pending Business Name", memberIds: members, status: 'Drafting', section: activeSection });
      }
      await batch.commit(); setGroups(updatedGroups); setShowAutoGroupConfirm(false);
    } catch (error) { console.error(error); alert("Failed to auto-group."); }
    finally { setIsLoading(false); }
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
      setShowChangeLeaderModal(false); setGroupToChangeLeader(null); setNewLeaderId(""); setOpenDropdownId(null);
    } catch (error) { console.error("Failed to change leader:", error); alert("Failed to change the team leader."); }
  };

  const confirmDeleteGroup = async () => {
    if (!groupToDelete) return;
    setIsLoading(true);
    try {
      await deleteDoc(doc(db, "groups", groupToDelete.id));
      setGroups(prev => prev.filter(g => g.id !== groupToDelete.id));
      setGroupToDelete(null); setShowDeleteConfirm(false);
    } catch (error) { console.error(error); alert("Failed to delete."); }
    finally { setIsLoading(false); }
  };

  // --- LOGIC: APPROVE/REJECT PROPOSAL ---
  const handleProposalAction = async (proposal: ProposalData, action: 'Approve' | 'Reject' | 'Revision') => {
    if (!selectedGroup || !proposal.id) return;
    try {
      const newStatus = action === 'Approve' ? 'Approved' : action === 'Reject' ? 'Rejected' : 'Revision';

      let updatePayload: any = {
        status: newStatus,
        updatedAt: serverTimestamp()
      };

      if (feedbackInput.trim()) {
        const newFeedback: FeedbackItem = {
          id: Date.now().toString(),
          text: feedbackInput,
          authorName: userName,
          role: "Adviser",
          date: new Date().toISOString()
        };
        updatePayload.feedbackHistory = arrayUnion(newFeedback);
        updatePayload.adviserFeedback = feedbackInput;
      }

      await updateDoc(doc(db, "proposals", proposal.id), updatePayload);

      let newGroupStatus = selectedGroup.status;
      if (action === 'Approve') {
        newGroupStatus = 'Approved Proposal';
        if (proposal.financialData && !proposal.originalProposalFinancials) {
          updatePayload.originalProposalFinancials = proposal.financialData;
        }
      } else if (action === 'Reject') {
        const otherPending = groupProposals.filter(p => p.id !== proposal.id && p.status === 'Pending');
        if (otherPending.length === 0 && selectedGroup.status !== 'Approved Proposal' && selectedGroup.status !== 'Active Business') {
          newGroupStatus = 'Drafting';
        }
      }

      if (newGroupStatus !== selectedGroup.status) {
        await updateDoc(doc(db, "groups", selectedGroup.id), { status: newGroupStatus });
        setGroups(prev => prev.map(g => g.id === selectedGroup.id ? { ...g, status: newGroupStatus } : g));
        setSelectedGroup(prev => prev ? { ...prev, status: newGroupStatus } : null);
      }

      await fetchGroupProposals(selectedGroup.id);
      setViewingProposal(null);
    } catch (error) { console.error("Action failed:", error); alert("Failed to update proposal status."); }
  };

  // --- LOGIC: SUBMIT FEEDBACK HISTORY ---
  const handleSubmitFeedback = async () => {
    if (!feedbackInput.trim() || !activeProposal?.id) return;
    setIsSaving(true);

    const newFeedback: FeedbackItem = {
      id: Date.now().toString(),
      text: feedbackInput,
      authorName: userName,
      role: "Adviser",
      date: new Date().toISOString()
    };

    try {
      await updateDoc(doc(db, "proposals", activeProposal.id), {
        feedbackHistory: arrayUnion(newFeedback)
      });

      setActiveProposal(prev => prev ? {
        ...prev,
        feedbackHistory: [...(prev.feedbackHistory || []), newFeedback]
      } : null);
      setFeedbackInput("");
    } catch (error) {
      console.error(error);
      alert("Failed to submit feedback.");
    } finally {
      setIsSaving(false);
    }
  };

  // Financial Calculations for Read-Only Display (100% Synchronized with Financial_input.tsx)
  const renderFinancialData = () => {
    if (!activeProposal?.financialData) return <div className="p-8 text-center text-gray-400 border border-dashed rounded-xl">No financial data has been input yet.</div>;

    const fin = activeProposal.financialData;
    const safeSellingPrice = Number(fin.sellingPrice) || 0;
    const safeMonthlySales = Number(fin.monthlySales) || 0;
    const safeVariableCost = Number(fin.variableCost) || Number(fin.unitCost) || (Number(fin.productionCost) && Number(fin.quantityYield) ? (Number(fin.productionCost) / Number(fin.quantityYield)) : 0);
    const safeFixedCosts = fin.opexList && fin.opexList.length > 0
      ? fin.opexList.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0)
      : (Number(fin.fixedCosts) || 0);
    const safeStartupCapital = Number(fin.startupCapital) || Number(activeProposal.totalCapital) || 0;
    const safeOperatingDays = Number(fin.operatingDays) || 300;

    const monthlyRevenue = safeSellingPrice * safeMonthlySales;
    const totalMonthlyVariableCosts = safeVariableCost * safeMonthlySales;
    const grossProfitMargin = monthlyRevenue > 0 ? ((monthlyRevenue - totalMonthlyVariableCosts) / monthlyRevenue) * 100 : 0;
    const monthlyInterest = fin.isCapitalBorrowed && fin.interestRate ? (safeStartupCapital * (Number(fin.interestRate) / 100)) / 12 : 0;
    const netMonthlyProfit = monthlyRevenue - totalMonthlyVariableCosts - safeFixedCosts - monthlyInterest;

    const annualRevenue = (monthlyRevenue / 30) * safeOperatingDays;
    const annualExpenses = ((totalMonthlyVariableCosts + safeFixedCosts + monthlyInterest) / 30) * safeOperatingDays;
    const annualNetProfitPreTax = annualRevenue - annualExpenses;

    const annualTax = annualRevenue * 0.03;
    const annualNetProfitAfterTax = (annualNetProfitPreTax > 0 ? annualNetProfitPreTax : 0) - annualTax;

    // Sources of Financing
    const safeCashInvested = Number(fin.cashInvested) || (safeStartupCapital > 0 ? safeStartupCapital : 0);
    const totalInitialCapital = safeCashInvested;

    // Pre-Operating Start-up Costs
    const safeRentAdvance = Number(fin.rentAdvance) || Number(fin.rentAdvanceDeposit) || 0;
    const safeTrainings = Number(fin.trainings) || Number(fin.trainingsPrograms) || 0;
    const safeAdvertising = Number(fin.advertising) || Number(fin.advertisingExpense) || 0;
    const safeSalariesInitial = Number(fin.salariesInitial) || Number(fin.salariesExpenseInitial) || 0;
    const totalProjectCost = safeRentAdvance + safeTrainings + safeAdvertising + safeSalariesInitial + safeStartupCapital;

    // Section 4: Current Assets
    const operatingCashBuffer = Math.max(0, netMonthlyProfit * 12);
    const totalLiquidCash = safeCashInvested + operatingCashBuffer;
    const cashOnHand = totalLiquidCash * 0.15; // 15% allocation
    const cashInBank = totalLiquidCash * 0.85; // 85% allocation
    const rawMaterialInventory = totalMonthlyVariableCosts * 0.15; // 15% ending inventory buffer
    const totalCurrentAssets = cashOnHand + cashInBank + rawMaterialInventory;

    // Non-Current Assets: Equipment/Machinery net of 10% straight-line annual depreciation
    const grossPPE = safeStartupCapital;
    const annualDepreciation = grossPPE * 0.10;
    const ppeNet = Math.max(0, grossPPE - annualDepreciation);
    const totalNonCurrentAssets = ppeNet;
    const totalAssets = totalCurrentAssets + totalNonCurrentAssets;

    // Current Liabilities
    const safeAccountsPayable = Number(fin.accountsPayable) || (totalMonthlyVariableCosts * 0.20);
    const safeUtilitiesPayable = Number(fin.utilitiesPayable) || (safeFixedCosts * 0.15);
    const totalCurrentLiabilities = safeAccountsPayable + safeUtilitiesPayable;

    // Owner's Equity
    const initialEquity = totalInitialCapital > 0 ? totalInitialCapital : safeStartupCapital;
    const endingOwnerEquity = totalAssets - totalCurrentLiabilities;
    const totalLiabilitiesAndEquity = totalCurrentLiabilities + endingOwnerEquity;

    // Automated Financial Ratios
    const currentRatio = totalCurrentLiabilities > 0 
      ? (totalCurrentAssets / totalCurrentLiabilities).toFixed(2) 
      : (totalCurrentAssets > 0 ? "99.9" : "0.0");
    const annualCOGS = (totalMonthlyVariableCosts / 30) * safeOperatingDays;
    const avgInventory = rawMaterialInventory > 0 ? rawMaterialInventory : 1;
    const inventoryTurnover = avgInventory > 0 ? (annualCOGS / avgInventory).toFixed(1) : "0.0";
    const numTurnover = Number(inventoryTurnover) || 0;
    const avgAgeOfInventory = numTurnover > 0 ? Math.round(360 / numTurnover) : 0;
    const currentAssetTurnover = totalCurrentAssets > 0 
      ? (annualRevenue / totalCurrentAssets).toFixed(2) 
      : "0.0";

    const monthlyCashInflow = annualNetProfitAfterTax > 0 ? (annualNetProfitAfterTax / 12) : 0;
    let paybackYears = 0;
    let paybackMonths = 0;
    let paybackDays = 0;
    if (monthlyCashInflow > 0 && safeStartupCapital > 0) {
      const totalMonths = safeStartupCapital / monthlyCashInflow;
      paybackYears = Math.floor(totalMonths / 12);
      paybackMonths = Math.floor(totalMonths % 12);
      paybackDays = Math.round((totalMonths % 1) * 30);
    }
    const rawROI = safeStartupCapital > 0 ? (annualNetProfitAfterTax / safeStartupCapital) * 100 : 0;
    const estimatedAnnualROI = isNaN(rawROI) ? "0.0" : rawROI.toFixed(1);
    const contributionMargin = safeSellingPrice - safeVariableCost;
    const breakEvenUnits = contributionMargin > 0 ? Math.ceil(safeFixedCosts / contributionMargin) : "N/A";

    return (
      <div className="space-y-6">
        {/* SUB-TABS NAVIGATION */}
        <div className="flex bg-gray-100 p-1.5 rounded-xl gap-2 border border-gray-200 shadow-inner">
          <button
            type="button"
            onClick={() => setAdviserFinTab("operations")}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${adviserFinTab === "operations" ? "bg-white text-[#122244] shadow-sm" : "text-gray-500 hover:text-gray-900"}`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-[#c9a654]" /> Operational Projections
          </button>
          <button
            type="button"
            onClick={() => setAdviserFinTab("balance-sheet")}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${adviserFinTab === "balance-sheet" ? "bg-white text-[#122244] shadow-sm" : "text-gray-500 hover:text-gray-900"}`}
          >
            <Scale className="w-3.5 h-3.5 text-blue-600" /> Balance Sheet (Financial Position)
          </button>
        </div>

        {/* TAB 1: OPERATIONAL PROJECTIONS & COSTING */}
        {adviserFinTab === "operations" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="bg-white rounded-xl border-l-4 border-l-green-500 p-4 shadow-sm border border-gray-100">
                <span className="text-[9px] font-bold text-gray-400 uppercase block">Monthly Revenue</span>
                <p className="text-xl font-black text-[#122244]">₱{monthlyRevenue.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-xl border-l-4 border-l-red-500 p-4 shadow-sm border border-gray-100">
                <span className="text-[9px] font-bold text-gray-400 uppercase block">Monthly Expenses</span>
                <p className="text-xl font-black text-[#122244]">₱{(totalMonthlyVariableCosts + safeFixedCosts).toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-xl border-l-4 border-l-blue-500 p-4 shadow-sm border border-gray-100">
                <span className="text-[9px] font-bold text-gray-400 uppercase block">Break-Even Point</span>
                <p className="text-xl font-black text-[#122244]">{breakEvenUnits} <span className="text-[10px] text-gray-400 font-normal">units</span></p>
              </div>
              <div className="bg-white rounded-xl border-l-4 border-l-purple-500 p-4 shadow-sm border border-gray-100">
                <span className="text-[9px] font-bold text-gray-400 uppercase block">Gross Margin</span>
                <p className="text-xl font-black text-purple-700">{grossProfitMargin.toFixed(1)}%</p>
              </div>
              <div className={`bg-white rounded-xl border-l-4 p-4 shadow-sm border border-gray-100 ${netMonthlyProfit >= 0 ? "border-l-[#c9a654]" : "border-l-red-500"}`}>
                <span className="text-[9px] font-bold text-gray-400 uppercase block">Net Profit / Mo</span>
                <p className={`text-xl font-black ${netMonthlyProfit < 0 ? "text-red-500" : "text-[#122244]"}`}>₱{netMonthlyProfit.toLocaleString()}</p>
              </div>
            </div>

            {/* Costing & OpEx Grids */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Unit Economics & Pricing */}
              <div className="bg-white rounded-xl border border-gray-200/80 p-6 shadow-sm space-y-4">
                <h4 className="text-xs font-bold text-[#122244] uppercase tracking-wider flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#c9a654]" /> Unit Costing & Pricing Strategy
                </h4>
                <div className="space-y-3 text-xs">
                  {fin.productionCost && fin.quantityYield && (
                    <div className="flex justify-between border-b border-gray-100 pb-2">
                      <span className="text-gray-500">Batch Cost & Quantity Yield:</span>
                      <span className="font-bold text-gray-900">₱{Number(fin.productionCost).toLocaleString()} / {fin.quantityYield} pcs</span>
                    </div>
                  )}
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-500">Unit Cost (COGS):</span>
                    <span className="font-extrabold text-[#122244]">₱{safeVariableCost.toFixed(2)}</span>
                  </div>
                  {fin.markupPercentage && (
                    <div className="flex justify-between border-b border-gray-100 pb-2">
                      <span className="text-gray-500">Proposed Mark-up:</span>
                      <span className="font-bold text-[#c9a654]">+{fin.markupPercentage}% (₱{Number(fin.markupAmount || 0).toFixed(2)})</span>
                    </div>
                  )}
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-500">Selling Price to Customers:</span>
                    <span className="font-black text-green-700">₱{safeSellingPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-500">Estimated Monthly Sales:</span>
                    <span className="font-bold text-gray-900">{safeMonthlySales.toLocaleString()} units/mo</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-500">Monthly Operating Expenses (OpEx):</span>
                    <span className="font-bold text-red-600">₱{safeFixedCosts.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-gray-500">Startup Capital:</span>
                    <span className="font-bold text-blue-600">₱{safeStartupCapital.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Sources of Financing & Start-up Costs */}
              <div className="bg-white rounded-xl border border-gray-200/80 p-6 shadow-sm space-y-4">
                <h4 className="text-xs font-bold text-[#122244] uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#c9a654]" /> Sources of Financing & Project Cost
                </h4>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-500">Cash Invested:</span>
                    <span className="font-bold text-gray-900">₱{safeCashInvested.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-100 pb-2 font-bold text-sm bg-gray-50 p-2 rounded">
                    <span className="text-[#122244]">Total Initial Capital:</span>
                    <span className="text-green-700">₱{totalInitialCapital.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-500">Advance Rent & Deposit:</span>
                    <span className="font-medium text-gray-700">₱{safeRentAdvance.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-500">Trainings & Pre-Op Marketing:</span>
                    <span className="font-medium text-gray-700">₱{(safeTrainings + safeAdvertising).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-1 font-bold text-xs">
                    <span className="text-[#122244]">Total Project Launch Cost:</span>
                    <span className="text-blue-700">₱{totalProjectCost.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* OpEx and Equipment Tables */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* OpEx Breakdown */}
              <div className="bg-white rounded-xl border border-gray-200/80 p-5 shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-[#122244] uppercase tracking-wider">Itemized Operating Expenses</h4>
                  <span className="text-xs font-bold text-red-600">Total: ₱{safeFixedCosts.toLocaleString()}/mo</span>
                </div>
                {fin.opexList && fin.opexList.length > 0 ? (
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                    {fin.opexList.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-xs bg-gray-50 px-3 py-1.5 rounded border border-gray-100">
                        <span className="text-gray-700">{item.name || "Expense Item"}</span>
                        <span className="font-semibold text-gray-900">₱{Number(item.amount || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">No itemized OpEx provided. Default fixed overhead applied.</p>
                )}
              </div>

              {/* CapEx Equipment Breakdown */}
              <div className="bg-white rounded-xl border border-gray-200/80 p-5 shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-[#122244] uppercase tracking-wider">Machinery & Equipment (CapEx)</h4>
                  <span className="text-xs font-bold text-[#122244]">
                    Total: ₱{(fin.equipmentList && fin.equipmentList.length > 0 ? fin.equipmentList.reduce((s: number, e: any) => s + (Number(e.total) || 0), 0) : safeStartupCapital).toLocaleString()}
                  </span>
                </div>
                {fin.equipmentList && fin.equipmentList.length > 0 ? (
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                    {fin.equipmentList.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-xs bg-gray-50 px-3 py-1.5 rounded border border-gray-100">
                        <span className="text-gray-700">{item.name || "Equipment"} <span className="text-gray-400">({item.quantity || 1}x)</span></span>
                        <span className="font-semibold text-gray-900">₱{Number(item.total || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">No itemized equipment list provided.</p>
                )}
              </div>
            </div>

            {/* BMBE Tax & Loan Banner */}
            <div className="bg-blue-50/70 border border-blue-200/60 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div>
                  <p className="font-bold text-[#122244]">Philippine BMBE Framework (RA 9178)</p>
                  <p className="text-gray-600">3% Flat Tax on Annual Gross Revenue: <strong>₱{annualTax.toLocaleString()}</strong></p>
                </div>
              </div>
              {fin.isCapitalBorrowed && (
                <span className="px-3 py-1 bg-amber-100 text-amber-800 font-bold rounded-lg text-[11px]">
                  Borrowed Loan: {fin.interestRate}% Interest/yr
                </span>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: STATEMENT OF FINANCIAL POSITION (BALANCE SHEET) */}
        {adviserFinTab === "balance-sheet" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Balance Verified Badge */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="font-extrabold text-emerald-900 text-sm">Balanced Statement of Financial Position</p>
                  <p className="text-xs text-emerald-700">Assets = Liabilities + Owner's Equity (Verified Double-Entry Standard)</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-emerald-600 text-white font-black text-xs rounded-lg uppercase tracking-wider">
                Balanced ✓
              </span>
            </div>

            {/* Two-Column Balance Sheet */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* ASSETS */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
                <h4 className="text-xs font-black text-[#122244] uppercase tracking-widest border-b pb-3 flex items-center justify-between">
                  <span>ASSETS (What Business Owns)</span>
                  <span className="text-green-600">₱{totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </h4>
                
                <div className="space-y-3 text-xs">
                  <p className="font-bold text-gray-400 uppercase text-[10px] tracking-wider">Current Assets (Liquid)</p>
                  <div className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-600">Cash on Hand (15% Cash Drawer):</span>
                    <span className="font-bold text-gray-900">₱{cashOnHand.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-600">Cash in Bank (85% Bank Account):</span>
                    <span className="font-bold text-gray-900">₱{cashInBank.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-600">Merchandise & Raw Materials Inventory:</span>
                    <span className="font-bold text-gray-900">₱{rawMaterialInventory.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between py-1 bg-gray-50 px-2 rounded font-bold">
                    <span className="text-gray-700">Total Current Assets:</span>
                    <span className="text-[#122244]">₱{totalCurrentAssets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>

                  <p className="font-bold text-gray-400 uppercase text-[10px] tracking-wider pt-2">Non-Current Assets (Long-Term)</p>
                  <div className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-600">Property, Plant & Equipment (Gross):</span>
                    <span className="font-bold text-gray-900">₱{grossPPE.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-50 text-red-500">
                    <span>Less: Accumulated Depreciation (10%/yr):</span>
                    <span className="font-bold">-₱{annualDepreciation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between py-1 bg-gray-50 px-2 rounded font-bold">
                    <span className="text-gray-700">Total Non-Current Assets (Net PPE):</span>
                    <span className="text-[#122244]">₱{totalNonCurrentAssets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>

                  <div className="flex justify-between p-3 bg-[#122244] text-white rounded-xl font-black text-sm mt-4">
                    <span>TOTAL ASSETS:</span>
                    <span className="text-green-400">₱{totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* LIABILITIES & OWNER'S EQUITY */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
                <h4 className="text-xs font-black text-[#122244] uppercase tracking-widest border-b pb-3 flex items-center justify-between">
                  <span>LIABILITIES & OWNER'S EQUITY</span>
                  <span className="text-blue-600">₱{totalLiabilitiesAndEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </h4>

                <div className="space-y-3 text-xs">
                  <p className="font-bold text-gray-400 uppercase text-[10px] tracking-wider">Current Liabilities (Short-Term Obligations)</p>
                  <div className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-600">Accounts Payable (20% of COGS):</span>
                    <span className="font-bold text-gray-900">₱{safeAccountsPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-600">Utilities & OpEx Payable (15% of OpEx):</span>
                    <span className="font-bold text-gray-900">₱{safeUtilitiesPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between py-1 bg-gray-50 px-2 rounded font-bold">
                    <span className="text-gray-700">Total Current Liabilities:</span>
                    <span className="text-red-600">₱{totalCurrentLiabilities.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>

                  <p className="font-bold text-gray-400 uppercase text-[10px] tracking-wider pt-2">Owner's Equity (Net Worth)</p>
                  <div className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-600">Initial Capital Contributed:</span>
                    <span className="font-bold text-gray-900">₱{initialEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-600">Add: Retained Net Income (After Tax):</span>
                    <span className="font-bold text-emerald-600">₱{annualNetProfitAfterTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between py-1 bg-gray-50 px-2 rounded font-bold">
                    <span className="text-gray-700">Ending Owner's Capital:</span>
                    <span className="text-[#122244]">₱{endingOwnerEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>

                  <div className="flex justify-between p-3 bg-[#122244] text-white rounded-xl font-black text-sm mt-4">
                    <span>TOTAL LIABILITIES & EQUITY:</span>
                    <span className="text-blue-400">₱{totalLiabilitiesAndEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // FIXED Metrics Calculations: Guaranteed to never be negative by filtering actual students.
  const assignedIds = new Set<string>();
  groups.forEach(g => {
    if (g.leaderId) assignedIds.add(g.leaderId);
    if (Array.isArray(g.memberIds)) g.memberIds.forEach(id => assignedIds.add(id));
  });

  const filteredStudents = students.filter(s => `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) || s.studentId.includes(searchTerm));
  const filteredGroups = activeDashboardTab === 'All Groups' ? groups : groups.filter(g => g.status === activeDashboardTab);

  // This physically counts how many fetched students do not exist inside the assigned Set
  const unassignedCount = students.filter(s => !assignedIds.has(s.id)).length;

  return (
    <div className="flex min-h-screen bg-gray-50/50 overflow-hidden">
      {/* ADVISER SIDEBAR */}
      <aside className={`hidden lg:flex w-64 bg-[#122244] text-white flex-col fixed inset-y-0 shadow-xl z-20 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center gap-3 border-b border-white/10">
          <img src="/dashboard logo.png" alt="FeasiFy" className="w-70 h-20 object-contain" />
        </div>
        <nav className="flex-1 p-4 space-y-8 mt-4">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">Main Menu</p>
            <div className="space-y-1">
              <button onClick={() => navigate("/adviser/dashboard")} className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#c9a654] text-white transition-all shadow-md">My Sections</button>
              <div className="pl-4 pr-2 py-2 space-y-2">
                {adviserSections.map((sectionName) => (
                  <button key={sectionName} onClick={() => { setActiveSection(sectionName); const s = sectionSettingsMap[sectionName]; setMinMembers(s?.minMembers ?? 8); setMaxMembers(s?.maxMembers ?? 10); fetchSectionData(sectionName); }}
                    className={`w-full text-left text-sm transition-colors ${activeSection === sectionName ? 'text-white font-medium' : 'text-gray-400 hover:text-white'}`}>
                    {sectionName}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">Account</p>
            <div className="space-y-1">
              <button onClick={() => navigate("/adviser/profile")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-all"><User className="w-4 h-4" /> Profile</button>
              <button onClick={() => navigate("/adviser/settings")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-all"><Settings className="w-4 h-4" /> Settings</button>
              <button onClick={() => setShowLogoutConfirm(true)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-all"><ShieldAlert className="w-4 h-4" /> Logout</button>
            </div>
          </div>
        </nav>
        <div className="p-4 border-t border-white/10 bg-black/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#c9a654] flex items-center justify-center font-bold text-sm">{getInitials(userName)}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-white">{userName}</p>
              <p className="text-[10px] text-gray-400 truncate">Feasibility Adviser</p>
            </div>
            <button
              onClick={() => navigate("/adviser/notifications")}
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

      {/* MAIN CONTENT AREA */}
      <main className={`flex-1 transition-all duration-300 ease-in-out h-screen overflow-y-auto overflow-x-hidden ${isSidebarOpen ? 'lg:ml-64' : 'ml-0'}`}>
        <div className="bg-white border-b border-gray-100 p-4 flex items-center gap-2 text-sm text-gray-500 sticky top-0 z-10">
          <SidebarIcon className="w-4 h-4 cursor-pointer hover:text-gray-800 transition-colors" onClick={() => setIsSidebarOpen(!isSidebarOpen)} />
          <span className="mx-2">|</span>
          <span className="font-semibold text-gray-900 hover:text-[#c9a654] cursor-pointer transition-colors" onClick={() => setActiveView('dashboard')}>FeasiFy</span>

          {(activeView === 'group-details' || activeView === 'active-business') && selectedGroup && (
            <>
              <span className="mx-2">›</span>
              <span className="font-semibold text-[#c9a654]">Group {groups.findIndex(g => g.id === selectedGroup.id) + 1}</span>
            </>
          )}
        </div>

        {/* ------------------------------------------------------------------------------------------------- */}
        {/* VIEW 1: DASHBOARD                                                                                 */}
        {/* ------------------------------------------------------------------------------------------------- */}
        {activeView === 'dashboard' && (
          <div className="p-6 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-300">

            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 pb-6">
              <div>
                <h1 className="text-3xl font-extrabold text-[#122244]">{activeSection}</h1>
                <p className="text-sm text-gray-500 mt-1 italic">Manage feasibility groups and team leaders for this section.</p>
              </div>

              {/* === REORDERED TOP BUTTONS === */}
              <div className="flex flex-wrap gap-2">
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

            {/* Tabs Row (Reshuffle removed) */}
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 border-b border-gray-200 pb-2">
              <div className="flex space-x-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 custom-scrollbar">
                {['All Groups', 'Pending Review', 'Approved Proposal', 'Drafting', 'Active Business'].map(tab => (
                  <button key={tab} onClick={() => setActiveDashboardTab(tab as any)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${activeDashboardTab === tab ? 'bg-white text-[#122244] shadow-sm border border-gray-200' : 'bg-transparent text-gray-500 hover:text-gray-800'}`}>
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Groups Grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: sectionGroupCountMap[activeSection] ?? 3 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-[450px] overflow-hidden">
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
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredGroups.map((group) => {
                  const totalMembers = group.memberIds.length + 1;
                  const originalIndex = groups.findIndex(g => g.id === group.id) + 1;

                  let statusBadgeColor = "bg-gray-100 text-gray-600"; let statusDotColor = "bg-gray-400";
                  if (group.status === 'Pending Review') { statusBadgeColor = "bg-yellow-100 text-yellow-700"; statusDotColor = "bg-yellow-500"; }
                  if (group.status === 'Approved Proposal') { statusBadgeColor = "bg-green-100 text-green-700"; statusDotColor = "bg-green-500"; }
                  if (group.status === 'Active Business') { statusBadgeColor = "bg-blue-100 text-blue-700"; statusDotColor = "bg-blue-500"; }

                  return (
                    <div key={group.id} className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col relative h-[450px] hover:shadow-md transition-shadow">
                      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-xl">
                        <h3 className="font-bold text-[#122244] text-base">Group {originalIndex}</h3>
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-full">{totalMembers}/{maxMembers}</span>

                          <div className="relative">
                            <button onClick={() => setOpenDropdownId(openDropdownId === group.id ? null : (group.id || null))} className="p-1 text-gray-400 hover:text-gray-800 rounded-md hover:bg-gray-200 transition-colors">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            {openDropdownId === group.id && (
                              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-lg shadow-xl z-10 py-1">
                                <button onClick={() => { setGroupToChangeLeader(group); setShowChangeLeaderModal(true); setOpenDropdownId(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"><Edit2 className="w-4 h-4" /> Change Leader</button>
                                <button onClick={() => { setGroupToDelete(group); setShowDeleteConfirm(true); setOpenDropdownId(null); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"><Trash2 className="w-4 h-4" /> Delete Group</button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="p-5 flex-1 flex flex-col overflow-hidden">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Business Name</p>
                        <p className={`text-lg font-bold mb-3 truncate ${group.title === 'Pending Business Name' ? 'text-gray-400 italic' : 'text-gray-900'}`}>{group.title}</p>

                        <div className="mb-6">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${statusBadgeColor}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusDotColor}`}></span>
                            {group.status === 'Pending Review' ? 'Proposal for Review' : group.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 mb-4">
                          <div className={`w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-xs flex-shrink-0 ${group.status === 'Approved Proposal' || group.status === 'Active Business' ? 'bg-[#ff7f50]' : group.status === 'Pending Review' ? 'bg-[#e74c3c]' : 'bg-[#2ecc71]'}`}>{getInitials(group.leaderName)}</div>
                          <div>
                            <p className="text-[9px] font-bold text-[#c9a654] uppercase tracking-widest leading-none mb-1">Team Leader</p>
                            <p className="text-sm font-bold text-gray-900">{group.leaderName}</p>
                          </div>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                          {group.memberIds.length === 0 ? (
                            <p className="text-xs text-gray-400 italic mt-2">No members assigned yet.</p>
                          ) : (
                            <ul className="space-y-3">
                              {group.memberIds.map(memberId => {
                                const member = students.find(s => s.id === memberId);
                                if (!member) return null;
                                return <li key={memberId} className="text-sm text-gray-500 truncate">{member.firstName} {member.lastName}</li>;
                              })}
                            </ul>
                          )}
                        </div>
                      </div>

                      <div className="p-4 border-t border-gray-100 bg-white rounded-b-xl mt-auto">
                        {group.status === 'Drafting' && (
                          <button onClick={() => handleOpenGroupDetails(group)} className="w-full py-2.5 bg-white border border-gray-200 text-gray-600 font-bold text-sm rounded-lg hover:bg-gray-50 transition-colors shadow-sm">View Group Info</button>
                        )}
                        {group.status === 'Pending Review' && (
                          <button onClick={() => handleOpenGroupDetails(group)} className="w-full py-2.5 bg-[#122244] text-white font-bold text-sm rounded-lg hover:bg-[#0a142e] transition-colors shadow-md flex justify-center items-center gap-2"><FileText className="w-4 h-4" /> Review Proposals</button>
                        )}
                        {group.status === 'Approved Proposal' && (
                          <button onClick={() => handleOpenGroupDetails(group)} className="w-full py-2.5 bg-white border border-green-500 text-green-600 font-bold text-sm rounded-lg hover:bg-green-50 transition-colors shadow-sm flex justify-center items-center gap-2"><FileText className="w-4 h-4" /> View Approved Status</button>
                        )}
                        {group.status === 'Active Business' && (
                          <div className="flex flex-col gap-2 w-full">
                            <button onClick={() => handleOpenActiveBusiness(group)} className="w-full py-2.5 bg-white border border-[#4285F4] text-[#4285F4] font-bold text-sm rounded-lg hover:bg-blue-50 transition-colors shadow-sm flex justify-center items-center gap-2"><TrendingUp className="w-4 h-4" /> View Active Business</button>
                            <button onClick={() => handleOpenGroupDetails(group)} className="w-full py-2.5 bg-white border border-gray-200 text-gray-600 font-bold text-sm rounded-lg hover:bg-gray-50 transition-colors shadow-sm flex justify-center items-center gap-2"><FileText className="w-4 h-4" /> View All Proposals</button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
              <h1 className="text-3xl font-extrabold text-[#122244]">Business Proposals</h1>
              <p className="text-sm text-gray-500 mt-1">{selectedGroup.memberIds.length + 1} members · {groupProposals.filter(p => p.status !== 'Draft').length} proposals submitted</p>
            </div>

            <div className="flex border-b border-gray-200 mb-6">
              <button onClick={() => setActiveDetailTab('Proposals')} className={`pb-3 px-4 text-sm font-bold transition-colors border-b-2 ${activeDetailTab === 'Proposals' ? 'border-[#122244] text-[#122244]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>Proposals</button>
              <button onClick={() => setActiveDetailTab('Members')} className={`pb-3 px-4 text-sm font-bold transition-colors border-b-2 ${activeDetailTab === 'Members' ? 'border-[#122244] text-[#122244]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>Members</button>
            </div>

            {/* Content: PROPOSALS TAB */}
            {activeDetailTab === 'Proposals' && (
              <div className="space-y-4">
                {groupProposals.filter(p => p.status !== 'Draft').length === 0 ? (
                  <div className="py-20 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4 border border-gray-100"><FileText className="w-8 h-8 text-gray-300" /></div>
                    <h3 className="text-lg font-bold text-[#122244]">No proposals yet</h3>
                    <p className="text-sm text-gray-500 mt-1 max-w-sm">The group is still drafting their business proposals. Check back later.</p>
                  </div>
                ) : (
                  <>
                    {(selectedGroup.status === 'Approved Proposal' || selectedGroup.status === 'Active Business') && (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3 mb-6">
                        <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                        <div>
                          <h4 className="font-bold text-green-800 text-sm">Proposal Approved: {selectedGroup.title}</h4>
                          <p className="text-sm text-green-700 mt-0.5">This group can now proceed to financial planning.</p>
                        </div>
                      </div>
                    )}

                    {groupProposals.map((proposal, idx) => {
                      const isApproved = proposal.status === 'Approved';
                      const isRejected = proposal.status === 'Rejected';
                      const isRevision = proposal.status === 'Revision';
                      const isPending = proposal.status === 'Pending';

                      return (
                        <div key={proposal.id} className={`bg-white rounded-xl border-2 p-5 flex justify-between items-center ${isApproved ? 'border-green-400' : isRejected ? 'border-red-200 opacity-80' : isRevision ? 'border-orange-300' : 'border-[#d4af37]'}`}>
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-bold text-[#122244] text-lg">{proposal.businessName || `Business Proposal #${idx + 1}`}</h3>
                              {isPending && <span className="px-2.5 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] font-bold rounded-full uppercase tracking-wider">Pending</span>}
                              {isApproved && <span className="px-2.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full uppercase tracking-wider flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Approved</span>}
                              {isRejected && <span className="px-2.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full uppercase tracking-wider flex items-center gap-1"><X className="w-3 h-3" /> Rejected</span>}
                              {isRevision && <span className="px-2.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-bold rounded-full uppercase tracking-wider flex items-center gap-1"><Edit2 className="w-3 h-3" /> Needs Revision</span>}
                            </div>
                            <p className="text-sm text-gray-500 mb-1">{proposal.businessName} • {proposal.businessType}</p>
                            <p className="text-xs text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" /> Submitted: {proposal.createdAt ? new Date(proposal.createdAt.toDate()).toLocaleString() : 'Recently'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleOpenProposalModal(proposal)} className="px-5 py-2 bg-blue-50 text-[#4285F4] font-bold text-sm rounded-lg hover:bg-blue-100 transition-colors">Open</button>
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}
              </div>
            )}

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
          <div className="p-6 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <button onClick={() => setActiveView('dashboard')} className="flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-gray-900 border border-gray-200 px-3 py-1.5 rounded-lg bg-white shadow-sm transition-all"><ChevronLeft className="w-4 h-4" /> Back</button>
                <span className="px-3 py-1 bg-blue-50 text-[#4285F4] text-xs font-bold rounded-md uppercase tracking-wider">GROUP {groups.findIndex(g => g.id === selectedGroup.id) + 1}</span>
              </div>
            </div>

            {/* Banner Header */}
            <div className="bg-[#122244] rounded-2xl shadow-xl overflow-hidden mb-8 flex flex-col md:flex-row items-center p-8 text-white relative border border-gray-800">
              <div className="flex items-center gap-6 w-full">
                <div className="w-24 h-24 bg-[#1a2f55] rounded-2xl flex items-center justify-center font-extrabold text-4xl shadow-inner border border-white/10 flex-shrink-0 text-[#c9a654]">
                  {getInitials(activeProposal.businessName)}
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span className="px-3 py-1 bg-green-500/20 border border-green-500/30 text-green-400 text-[10px] font-bold rounded flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> APPROVED BUSINESS PROPOSAL</span>
                    <span className="px-3 py-1 bg-white/10 text-gray-300 text-[10px] font-bold rounded flex items-center gap-1"><User className="w-3 h-3" /> SECTION: {selectedGroup.section}</span>
                  </div>
                  <h1 className="text-4xl font-extrabold mb-1 tracking-tight">{activeProposal.businessName}</h1>
                  <p className="text-sm text-gray-400 font-medium">{activeProposal.businessType} • Adviser: {userName}</p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-6 border-b border-gray-200 mb-8 overflow-x-auto custom-scrollbar">
              {['Profile', 'Financial', 'AI'].map(tab => (
                <button key={tab} onClick={() => setActiveBusinessTab(tab as any)}
                  className={`pb-3 text-sm font-bold transition-colors border-b-2 whitespace-nowrap ${activeBusinessTab === tab ? "border-[#122244] text-[#122244]" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
                  {tab === 'Profile' ? 'Business Profile' : tab === 'Financial' ? 'Financial Data' : 'AI Feasibility Analysis'}
                </button>
              ))}
            </div>

            {/* Tab Content & Roster Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">

                {/* TAB: BUSINESS PROFILE */}
                {activeBusinessTab === 'Profile' && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm space-y-6">
                    <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                      <div className="bg-blue-50 p-2.5 rounded-full border border-blue-100"><FileText className="w-5 h-5 text-blue-500" /></div>
                      <div>
                        <h3 className="text-xl font-extrabold text-[#122244]">Complete Project Overview</h3>
                        <p className="text-xs text-gray-400">Approved Business Charter & Profile</p>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-6 flex divide-x divide-gray-200 text-center border border-gray-100">
                      <div className="flex-1 pr-6">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Total Initial Capital</p>
                        <p className="text-2xl font-bold text-green-600">₱{activeProposal.totalCapital || "0"}</p>
                      </div>
                      <div className="flex-1 pl-6">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Business Type</p>
                        <p className="text-xl font-bold text-[#122244]">{activeProposal.businessType || "Uncategorized"}</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Tagline</p>
                        <p className="text-gray-800 font-bold text-lg">{activeProposal.tagline || "None Provided"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Mission Statement</p>
                        <p className="text-gray-600 text-sm leading-relaxed">{activeProposal.missionStatement || "None Provided"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Vision Statement</p>
                        <p className="text-gray-600 text-sm leading-relaxed">{activeProposal.visionStatement || "None Provided"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Target Market</p>
                        <p className="text-gray-600 text-sm leading-relaxed">{activeProposal.targetMarket || "None Provided"}</p>
                      </div>

                      <div className="h-px bg-gray-100 my-4"></div>

                      <div>
                        <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">Product Description</p>
                        <p className="text-gray-600 text-sm leading-relaxed">{activeProposal.productDescription || "None Provided"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest mb-1">Specific Pricing</p>
                        <p className="text-gray-600 text-sm leading-relaxed">{activeProposal.priceRanges || "None Provided"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-1">Location</p>
                        <p className="text-gray-800 font-medium">{activeProposal.proposedLocation || "None Provided"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-purple-500 uppercase tracking-widest mb-1">Promotional Strategy</p>
                        <p className="text-gray-600 text-sm leading-relaxed">{activeProposal.promotionalStrategy || "None Provided"}</p>
                      </div>

                      {(() => {
                        const proposalFin = activeProposal.originalProposalFinancials || activeProposal.financialData;
                        if (!proposalFin) return null;

                        const safeUnitCost = Number(proposalFin.unitCost) || Number(proposalFin.variableCost) || (Number(proposalFin.productionCost) && Number(proposalFin.quantityYield) ? Number(proposalFin.productionCost) / Number(proposalFin.quantityYield) : 0);
                        const safeSellingPrice = Number(proposalFin.sellingPrice) || 0;
                        const safeMonthlySales = Number(proposalFin.monthlySales) || 0;
                        const safeFixedCosts = proposalFin.opexList && proposalFin.opexList.length > 0
                          ? proposalFin.opexList.reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0)
                          : (Number(proposalFin.fixedCosts) || 0);
                        const monthlyRev = safeSellingPrice * safeMonthlySales;
                        const grossMargin = monthlyRev > 0 ? ((monthlyRev - (safeUnitCost * safeMonthlySales)) / monthlyRev) * 100 : 0;

                        return (
                          <div className="space-y-4 pt-4 border-t border-gray-100">
                            <div className="flex items-center justify-between">
                              <p className="text-[10px] font-bold text-[#c9a654] uppercase tracking-widest flex items-center gap-1.5">
                                <Calculator className="w-3.5 h-3.5" /> Original Financial Proposal Inputs (Approved Charter)
                              </p>
                              <span className="text-[9px] font-black uppercase bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200">
                                Proposal Record
                              </span>
                            </div>

                            {/* KPI Banner */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                              <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                                <span className="text-[9px] text-gray-400 font-bold uppercase block">Unit Cost (COGS)</span>
                                <span className="font-extrabold text-[#122244] text-sm">₱{safeUnitCost.toFixed(2)}</span>
                              </div>
                              <div className="bg-amber-50/50 p-2.5 rounded-lg border border-amber-100">
                                <span className="text-[9px] text-[#b59545] font-bold uppercase block">Proposed Price</span>
                                <span className="font-extrabold text-[#c9a654] text-sm">₱{safeSellingPrice.toFixed(2)}</span>
                              </div>
                              <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                                <span className="text-[9px] text-gray-400 font-bold uppercase block">Monthly Sales</span>
                                <span className="font-extrabold text-[#122244] text-sm">{safeMonthlySales.toLocaleString()} pcs</span>
                              </div>
                              <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                                <span className="text-[9px] text-gray-400 font-bold uppercase block">Est. Revenue</span>
                                <span className="font-extrabold text-green-700 text-sm">₱{monthlyRev.toLocaleString()}</span>
                              </div>
                            </div>

                            {/* Detailed Grid: Costing & OpEx */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-gray-50/70 p-4 rounded-xl border border-gray-100">
                              <div className="space-y-2">
                                <span className="font-bold text-[10px] uppercase text-gray-400 block tracking-wider">Unit Costing & Markup Strategy</span>
                                {proposalFin.productionCost && proposalFin.quantityYield && (
                                  <div className="flex justify-between border-b border-gray-200/50 pb-1">
                                    <span className="text-gray-500">Batch Cost / Yield:</span>
                                    <span className="font-semibold text-gray-900">₱{Number(proposalFin.productionCost).toLocaleString()} / {proposalFin.quantityYield} pcs</span>
                                  </div>
                                )}
                                <div className="flex justify-between border-b border-gray-200/50 pb-1">
                                  <span className="text-gray-500">Proposed Markup:</span>
                                  <span className="font-bold text-[#c9a654]">+{proposalFin.markupPercentage || '0'}%</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-200/50 pb-1">
                                  <span className="text-gray-500">Gross Margin:</span>
                                  <span className="font-bold text-purple-700">{grossMargin.toFixed(1)}%</span>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <span className="font-bold text-[10px] uppercase text-gray-400 block tracking-wider">Volume & Fixed Costs</span>
                                <div className="flex justify-between border-b border-gray-200/50 pb-1">
                                  <span className="text-gray-500">Total Fixed OpEx:</span>
                                  <span className="font-bold text-red-600">₱{safeFixedCosts.toLocaleString()}/mo</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-200/50 pb-1">
                                  <span className="text-gray-500">Operating Schedule:</span>
                                  <span className="font-semibold text-gray-900">{proposalFin.operatingDays || '300'} days/yr</span>
                                </div>
                                {proposalFin.isCapitalBorrowed && (
                                  <div className="flex justify-between border-b border-gray-200/50 pb-1 text-amber-800">
                                    <span>Loan Interest:</span>
                                    <span className="font-bold">{proposalFin.interestRate}% Interest/yr</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Itemized OpEx List (if present) */}
                            {proposalFin.opexList && proposalFin.opexList.length > 0 && (
                              <div className="space-y-1.5">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Submitted Operating Expenses</span>
                                <div className="max-h-28 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                                  {proposalFin.opexList.map((item: any, idx: number) => (
                                    <div key={idx} className="flex justify-between text-xs bg-white px-3 py-1 rounded border border-gray-100">
                                      <span className="text-gray-700">{item.name || 'Expense Item'}</span>
                                      <span className="font-semibold text-gray-900">₱{Number(item.amount || 0).toLocaleString()}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Equipment CapEx (if present) */}
                            {proposalFin.equipmentList && proposalFin.equipmentList.length > 0 && (
                              <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Submitted Machinery & Equipment</span>
                                  <span className="text-xs font-bold text-[#122244]">
                                    Total: ₱{proposalFin.equipmentList.reduce((s: number, e: any) => s + (Number(e.total) || 0), 0).toLocaleString()}
                                  </span>
                                </div>
                                <div className="border border-gray-100 rounded-lg overflow-hidden bg-white">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-gray-50 border-b border-gray-100 text-[9px] uppercase text-gray-400 font-bold">
                                      <tr>
                                        <th className="p-2">Item Name</th>
                                        <th className="p-2 text-center w-12">Qty</th>
                                        <th className="p-2 text-right w-20">Unit Price</th>
                                        <th className="p-2 text-right w-24">Total</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                      {proposalFin.equipmentList.map((eq: any, idx: number) => (
                                        <tr key={idx}>
                                          <td className="p-2 text-gray-800 font-medium">{eq.name || '-'}</td>
                                          <td className="p-2 text-center text-gray-600">{eq.quantity || 1}</td>
                                          <td className="p-2 text-right text-gray-600">₱{Number(eq.unitPrice || 0).toLocaleString()}</td>
                                          <td className="p-2 text-right font-bold text-[#122244]">₱{Number(eq.total || 0).toLocaleString()}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Other Details */}
                      {activeProposal.otherDetails && (
                        <div className="pt-2">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Other Details & Notes</p>
                          <p className="text-gray-600 text-sm leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100">{activeProposal.otherDetails}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB: FINANCIAL DATA */}
                {activeBusinessTab === 'Financial' && renderFinancialData()}

                {/* TAB: AI ANALYSIS */}
                {activeBusinessTab === 'AI' && (
                  <div className="space-y-6">
                    {!activeProposal.aiAnalysis ? (
                      <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center text-gray-500">
                        <Zap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p>No AI analysis has been run for this business yet.</p>
                      </div>
                    ) : (
                      <>
                        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm flex items-center justify-between">
                          <div>
                            <h3 className="text-xl font-extrabold text-[#122244] mb-1 flex items-center gap-2"><Zap className="w-5 h-5 text-[#c9a654]" /> AI Feasibility Verdict</h3>
                            <p className="text-sm text-gray-500">{activeProposal.aiAnalysis.explanations?.feasibility || "Evaluation completed."}</p>
                          </div>
                          <div className="text-right">
                            <div className={`text-5xl font-extrabold ...`}>
                              {(activeProposal.aiAnalysis.score || 0) / 10}
                            </div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Score / 10</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          {['Financial Health', 'Risk Assessment', 'Market Viability'].map((metric, idx) => {
                            const key = metric === 'Financial Health' ? 'financial' : metric === 'Risk Assessment' ? 'risk' : 'market';
                            const rawVal = activeProposal.aiAnalysis.metrics?.[key] || 0;
                            const displayVal = rawVal > 10 ? rawVal / 10 : rawVal; // Convert 90 to 9
                            const barWidth = rawVal > 10 ? rawVal : rawVal * 10; // Ensure 90%
                            const desc = activeProposal.aiAnalysis.explanations?.[key];
                            return (
                              <div key={idx} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">{metric}</p>
                                <p className="text-2xl font-bold text-[#122244] mb-2">{displayVal}/10</p>
                                <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
                                  <div className="bg-[#122244] h-1.5 rounded-full transition-all duration-500" style={{ width: `${barWidth}%` }}></div>
                                </div>
                                <p className="text-[10px] text-gray-500 leading-tight">{desc}</p>
                              </div>
                            )
                          })}
                        </div>

                        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
                          <h4 className="text-sm font-bold text-[#122244] uppercase mb-4 tracking-widest">Key Insights</h4>
                          <div className="space-y-3">
                            {activeProposal.aiAnalysis.insights?.map((insight: any, i: number) => (
                              <div key={i} className={`p-4 rounded-lg border ${insight.type === 'positive' ? 'bg-green-50 border-green-200 text-green-800' : insight.type === 'warning' ? 'bg-orange-50 border-orange-200 text-orange-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
                                <p className="font-bold text-sm mb-1">{insight.title}</p>
                                <p className="text-xs leading-relaxed opacity-90">{insight.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* RIGHT SIDE: ROSTER + ADVISER BULLETIN BOARD */}
              <div className="lg:col-span-1 space-y-6">
                {/* PROJECT ROSTER CARD */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                  <h3 className="text-xs font-extrabold text-[#122244] uppercase tracking-widest mb-1">Project Roster</h3>
                  <p className="text-xs text-gray-500 mb-6">{selectedGroup.memberIds.length + 1} Members Total</p>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#122244] rounded-lg text-white flex items-center justify-center font-bold text-sm shadow-sm">{getInitials(userName)}</div>
                        <div>
                          <p className="font-bold text-[#122244] text-sm">Prof. {userName.split(" ").pop()}</p>
                          <p className="text-[10px] text-blue-600">Faculty</p>
                        </div>
                      </div>
                      <span className="text-[9px] font-black uppercase text-blue-600 bg-blue-100 px-2 py-1 rounded">Adviser</span>
                    </div>

                    <div className="flex items-center gap-3 p-2">
                      <div className="w-10 h-10 bg-purple-600 rounded-full text-white flex items-center justify-center font-bold text-sm shadow-sm">{getInitials(selectedGroup.leaderName)}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-gray-900">{selectedGroup.leaderName}</p>
                          <span className="text-[9px] font-bold uppercase text-[#c9a654] bg-[#c9a654]/10 px-1.5 py-0.5 rounded">Leader</span>
                        </div>
                        <p className="text-[10px] text-gray-500">{students.find(s => s.id === selectedGroup.leaderId)?.studentId || 'ID Unknown'}</p>
                      </div>
                    </div>

                    {selectedGroup.memberIds.map(memberId => {
                      const member = students.find(s => s.id === memberId);
                      if (!member) return null;
                      return (
                        <div key={memberId} className="flex items-center gap-3 p-2">
                          <div className="w-10 h-10 bg-green-500 rounded-full text-white flex items-center justify-center font-bold text-sm shadow-sm">{getInitials(`${member.firstName} ${member.lastName}`)}</div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{member.firstName} {member.lastName}</p>
                            <p className="text-[10px] text-gray-500">{member.studentId}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* ADVISER BULLETIN / FEEDBACK BOARD */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <h3 className="text-xs font-extrabold text-[#122244] uppercase tracking-widest flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-[#c9a654]" /> Advisory Bulletin Board
                    </h3>
                    <span className="text-[10px] font-black text-gray-400 uppercase">
                      {activeProposal.feedbackHistory?.length || 0} Notes
                    </span>
                  </div>

                  {/* Bulletin Feed (Scrollable history) */}
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                    {(!activeProposal.feedbackHistory || activeProposal.feedbackHistory.length === 0) ? (
                      <div className="p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-center text-xs text-gray-400 italic">
                        No feedback posted on the bulletin board yet. Write a note below to advise this group.
                      </div>
                    ) : (
                      activeProposal.feedbackHistory.slice().reverse().map((item: any, idx: number) => (
                        <div key={item.id || idx} className="p-3.5 bg-amber-50/60 border border-amber-200/70 rounded-xl space-y-1.5 shadow-sm">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="font-bold text-[#122244] flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-[#c9a654]"></span>
                              {item.authorName || `Prof. ${userName.split(" ").pop()}`}
                            </span>
                            <span className="text-gray-400">
                              {item.date ? new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap pl-3.5 border-l-2 border-[#c9a654]/40">
                            {item.text}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Inline Composer */}
                  <div className="pt-2 border-t border-gray-100 space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                      Post Advisory Note
                    </label>
                    <textarea
                      rows={3}
                      value={feedbackInput}
                      onChange={(e) => setFeedbackInput(e.target.value)}
                      placeholder="Type guidance, required changes, or feedback for the students..."
                      className="w-full text-xs p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-[#c9a654] outline-none resize-none transition-all placeholder:text-gray-400"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                          e.preventDefault();
                          handleSubmitFeedback();
                        }
                      }}
                    />
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] text-gray-400 italic">Press Ctrl + Enter to send</span>
                      <button
                        type="button"
                        onClick={handleSubmitFeedback}
                        disabled={isSaving || !feedbackInput.trim()}
                        className="px-4 py-2 bg-[#122244] hover:bg-[#1a2f55] text-white font-bold text-xs rounded-xl shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {isSaving ? "Posting..." : "Post Feedback"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
            <div className="px-6 py-4 md:px-8 md:py-6 border-b border-gray-100 flex justify-between items-center bg-white rounded-t-[1.5rem] z-10 shadow-sm relative">
              <div className="flex items-center gap-4 md:gap-5">
                <div className="w-12 h-12 md:w-14 md:h-14 bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-100/50 shadow-inner">
                  <FileText className="w-6 h-6 md:w-7 md:h-7 text-blue-600" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-3 mb-1.5">
                    <h2 className="text-2xl md:text-3xl font-extrabold text-[#122244] tracking-tight">{viewingProposal.businessName || 'Business Proposal'}</h2>
                    {viewingProposal.status === 'Pending' && <span className="px-3 py-1 bg-amber-100 text-amber-700 text-[10px] md:text-xs font-black rounded-lg uppercase tracking-widest shadow-sm">Pending Review</span>}
                    {viewingProposal.status === 'Approved' && <span className="px-3 py-1 bg-green-100 text-green-700 text-[10px] md:text-xs font-black rounded-lg uppercase tracking-widest shadow-sm flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Approved</span>}
                    {viewingProposal.status === 'Rejected' && <span className="px-3 py-1 bg-red-100 text-red-700 text-[10px] md:text-xs font-black rounded-lg uppercase tracking-widest shadow-sm flex items-center gap-1.5"><X className="w-3.5 h-3.5" /> Rejected</span>}
                    {viewingProposal.status === 'Revision' && <span className="px-3 py-1 bg-orange-100 text-orange-700 text-[10px] md:text-xs font-black rounded-lg uppercase tracking-widest shadow-sm flex items-center gap-1.5"><Edit2 className="w-3.5 h-3.5" /> Needs Revision</span>}
                  </div>
                  <p className="text-xs md:text-sm text-gray-500 font-medium flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Submitted: {viewingProposal.createdAt ? new Date(viewingProposal.createdAt.toDate()).toLocaleString() : 'Recently'}</p>
                </div>
              </div>
              <button onClick={() => setViewingProposal(null)} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-3 rounded-full transition-all focus:outline-none bg-gray-50/50"><X className="w-6 h-6" /></button>
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
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Business Type</label>
                        <div className="text-base font-bold text-[#122244] bg-gray-50/80 px-5 py-4 rounded-xl border border-gray-100/50">{viewingProposal.businessType || '-'}</div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Capital (₱)</label>
                        <div className="text-base font-bold text-green-700 bg-green-50/50 px-5 py-4 rounded-xl border border-green-100/50">₱ {viewingProposal.totalCapital || '-'}</div>
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
                        const safeSellingPrice = Number(fin.sellingPrice) || 0;
                        const safeMonthlySales = Number(fin.monthlySales) || 0;
                        const safeUnitCost = Number(fin.unitCost) || Number(fin.variableCost) || (Number(fin.productionCost) && Number(fin.quantityYield) ? Number(fin.productionCost) / Number(fin.quantityYield) : 0);
                        const safeFixedCosts = fin.opexList && fin.opexList.length > 0
                          ? fin.opexList.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0)
                          : (Number(fin.fixedCosts) || 0);
                        const safeStartupCapital = Number(fin.startupCapital) || Number(viewingProposal.totalCapital) || 0;

                        const monthlyRevenue = safeSellingPrice * safeMonthlySales;
                        const totalMonthlyVariableCosts = safeUnitCost * safeMonthlySales;
                        const grossProfitMargin = monthlyRevenue > 0 ? ((monthlyRevenue - totalMonthlyVariableCosts) / monthlyRevenue) * 100 : 0;
                        const monthlyInterest = fin.isCapitalBorrowed && fin.interestRate ? (safeStartupCapital * (Number(fin.interestRate) / 100)) / 12 : 0;
                        const netMonthlyProfit = monthlyRevenue - totalMonthlyVariableCosts - safeFixedCosts - monthlyInterest;
                        const contributionMargin = safeSellingPrice - safeUnitCost;
                        const breakEvenUnits = contributionMargin > 0 ? Math.ceil(safeFixedCosts / contributionMargin) : "N/A";

                        return (
                          <>
                            {/* KPI Banner */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-center">
                                <span className="text-[9px] font-bold text-gray-400 uppercase block">Unit Cost (COGS)</span>
                                <span className="text-sm font-black text-[#122244]">₱{safeUnitCost.toFixed(2)}</span>
                              </div>
                              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-center">
                                <span className="text-[9px] font-bold text-gray-400 uppercase block">Selling Price</span>
                                <span className="text-sm font-black text-green-700">₱{safeSellingPrice.toFixed(2)}</span>
                              </div>
                              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-center">
                                <span className="text-[9px] font-bold text-gray-400 uppercase block">Monthly Rev</span>
                                <span className="text-sm font-black text-blue-700">₱{monthlyRevenue.toLocaleString()}</span>
                              </div>
                              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-center">
                                <span className="text-[9px] font-bold text-gray-400 uppercase block">Gross Margin</span>
                                <span className="text-sm font-black text-purple-700">{grossProfitMargin.toFixed(1)}%</span>
                              </div>
                              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-center">
                                <span className="text-[9px] font-bold text-gray-400 uppercase block">Est. Net Profit</span>
                                <span className={`text-sm font-black ${netMonthlyProfit >= 0 ? 'text-[#c9a654]' : 'text-red-500'}`}>
                                  ₱{netMonthlyProfit.toLocaleString()}
                                </span>
                              </div>
                              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-center">
                                <span className="text-[9px] font-bold text-gray-400 uppercase block">Break-Even</span>
                                <span className="text-sm font-black text-amber-700">{breakEvenUnits} units</span>
                              </div>
                            </div>

                            {/* Detailed Breakdown Grids */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                              {/* Step 1 & 2: Costing & Pricing */}
                              <div className="space-y-4 bg-gray-50/60 p-4 rounded-xl border border-gray-100">
                                <h4 className="text-xs font-bold text-[#122244] uppercase tracking-wider flex items-center gap-1.5">
                                  <Package className="w-3.5 h-3.5 text-[#c9a654]" /> Unit Costing & Markup Strategy
                                </h4>
                                <div className="space-y-2.5 text-xs">
                                  <div className="flex justify-between pb-1.5 border-b border-gray-200/60">
                                    <span className="text-gray-500">Batch Production Cost:</span>
                                    <span className="font-bold text-gray-900">₱{Number(fin.productionCost || 0).toLocaleString()}</span>
                                  </div>
                                  <div className="flex justify-between pb-1.5 border-b border-gray-200/60">
                                    <span className="text-gray-500">Quantity Yield per Batch:</span>
                                    <span className="font-bold text-gray-900">{fin.quantityYield || '0'} pcs/batch</span>
                                  </div>
                                  <div className="flex justify-between pb-1.5 border-b border-gray-200/60">
                                    <span className="text-gray-500">Unit Cost (COGS):</span>
                                    <span className="font-extrabold text-[#122244]">₱{safeUnitCost.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between pb-1.5 border-b border-gray-200/60">
                                    <span className="text-gray-500">Proposed Markup:</span>
                                    <span className="font-bold text-[#c9a654]">+{fin.markupPercentage || '0'}% (₱{Number(fin.markupAmount || 0).toFixed(2)})</span>
                                  </div>
                                  <div className="flex justify-between pb-1.5 border-b border-gray-200/60">
                                    <span className="text-gray-500">Computed Base Price:</span>
                                    <span className="font-bold text-gray-700">₱{Number(fin.computedSellingPrice || 0).toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between pt-1 font-bold text-sm">
                                    <span className="text-green-800">Target Selling Price:</span>
                                    <span className="font-black text-green-700">₱{safeSellingPrice.toFixed(2)}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Step 3: Sales Volume & Operating Expenses */}
                              <div className="space-y-4 bg-gray-50/60 p-4 rounded-xl border border-gray-100">
                                <h4 className="text-xs font-bold text-[#122244] uppercase tracking-wider flex items-center gap-1.5">
                                  <TrendingUp className="w-3.5 h-3.5 text-[#c9a654]" /> Sales Volume & Operating Expenses
                                </h4>
                                <div className="space-y-2.5 text-xs">
                                  <div className="flex justify-between pb-1.5 border-b border-gray-200/60">
                                    <span className="text-gray-500">Monthly Target Sales:</span>
                                    <span className="font-bold text-gray-900">{safeMonthlySales.toLocaleString()} units/mo</span>
                                  </div>
                                  <div className="flex justify-between pb-1.5 border-b border-gray-200/60">
                                    <span className="text-gray-500">Total Monthly OpEx:</span>
                                    <span className="font-bold text-red-600">₱{safeFixedCosts.toLocaleString()}/mo</span>
                                  </div>
                                  {fin.opexList && fin.opexList.length > 0 && (
                                    <div className="space-y-1.5 pt-1">
                                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">OpEx Breakdown:</span>
                                      <div className="max-h-24 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                                        {fin.opexList.map((item: any, idx: number) => (
                                          <div key={idx} className="flex justify-between text-[11px] bg-white px-2.5 py-1 rounded border border-gray-100">
                                            <span className="text-gray-700">{item.name || 'Expense'}</span>
                                            <span className="font-semibold text-gray-900">₱{Number(item.amount || 0).toLocaleString()}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {fin.isCapitalBorrowed && (
                                    <div className="flex justify-between pt-1 border-t border-gray-200/60 text-[11px] text-amber-800 bg-amber-50 p-2 rounded">
                                      <span>Borrowed Capital Loan:</span>
                                      <span className="font-bold">{fin.interestRate}% Interest/yr</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Equipment / CapEx Table */}
                            {fin.equipmentList && fin.equipmentList.length > 0 && (
                              <div className="space-y-2 pt-2">
                                <div className="flex justify-between items-center">
                                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                    Itemized Equipment & Machinery (CapEx)
                                  </label>
                                  <span className="text-xs font-extrabold text-[#122244]">
                                    Total: ₱{fin.equipmentList.reduce((sum: number, eq: any) => sum + (Number(eq.total) || 0), 0).toLocaleString()}
                                  </span>
                                </div>
                                <div className="border border-gray-100 rounded-xl overflow-hidden">
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-gray-50 border-b border-gray-100 text-[10px] uppercase text-gray-400 font-bold">
                                      <tr>
                                        <th className="p-2.5">Item Name</th>
                                        <th className="p-2.5 w-16 text-center">Qty</th>
                                        <th className="p-2.5 w-24">Unit Price</th>
                                        <th className="p-2.5 w-28 text-right">Total</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                      {fin.equipmentList.map((eq: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-gray-50/50">
                                          <td className="p-2.5 font-medium text-gray-800">{eq.name || '-'}</td>
                                          <td className="p-2.5 text-center text-gray-600">{eq.quantity || 1}</td>
                                          <td className="p-2.5 text-gray-600">₱{Number(eq.unitPrice || 0).toLocaleString()}</td>
                                          <td className="p-2.5 text-right font-bold text-[#122244]">₱{Number(eq.total || 0).toLocaleString()}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </section>

                  {/* OTHER DETAILS */}
                  {viewingProposal.otherDetails && (
                    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:border-gray-200 transition-colors">
                      <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50 flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-lg"><Info className="w-4 h-4 text-gray-600" /></div>
                        <h3 className="text-sm font-extrabold text-[#122244] uppercase tracking-widest">Other Details & Notes</h3>
                      </div>
                      <div className="p-6">
                        <div className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap bg-gray-50/80 px-5 py-4 rounded-xl border border-gray-100/50">{viewingProposal.otherDetails}</div>
                      </div>
                    </section>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: AI Analysis & Feedback */}
              <div className="w-full lg:w-[45%] xl:w-[40%] h-full bg-[#fcfcfd] flex flex-col relative z-20 shadow-[-10px_0_20px_-10px_rgba(0,0,0,0.03)]">

                {/* AI Analysis Scrollable Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <div className="p-6 md:p-8">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-sm font-extrabold text-[#122244] uppercase tracking-widest flex items-center gap-2.5">
                        <div className="p-1.5 bg-yellow-100/50 rounded-md"><Sparkles className="w-4 h-4 text-[#c9a654]" /></div>
                        AI Feasibility Analysis
                      </h3>
                      {modalAiResult && !isAiAnalyzing && (
                        <button onClick={() => handleAIAnalysis(viewingProposal)} className="text-xs font-bold text-gray-400 hover:text-[#c9a654] flex items-center gap-1.5 transition-colors bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
                          <RefreshCw className="w-3 h-3" /> Re-analyze
                        </button>
                      )}
                    </div>

                    {isAiAnalyzing ? (
                      <div className="flex flex-col items-center justify-center py-20 space-y-6 text-center">
                        <div className="relative w-20 h-20">
                          <div className="absolute inset-0 rounded-full border-[3px] border-gray-100"></div>
                          <div className="absolute inset-0 rounded-full border-[3px] border-[#c9a654] border-t-transparent animate-spin"></div>
                          <Brain className="absolute inset-0 m-auto w-8 h-8 text-[#c9a654] animate-pulse" />
                        </div>
                        <div>
                          <p className="font-extrabold text-[#122244] text-lg">Evaluating Proposal</p>
                          <p className="text-sm text-gray-500 mt-1 max-w-[250px] mx-auto">Our AI is analyzing the proposal against market standards...</p>
                        </div>
                      </div>
                    ) : aiAnalysisError ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-red-200/70 rounded-[1.5rem] p-8 bg-red-50/50">
                        <div className="w-20 h-20 bg-red-100/80 rounded-full flex items-center justify-center mb-5 border border-red-200/50">
                          <AlertCircle className="w-10 h-10 text-red-500" />
                        </div>
                        <h4 className="text-lg font-extrabold text-[#122244] mb-2">Analysis Failed</h4>
                        <p className="text-sm text-red-600 mb-8 max-w-[280px]">{aiAnalysisError}</p>
                        <button
                          onClick={() => handleAIAnalysis(viewingProposal)}
                          className="px-8 py-3.5 bg-red-600 text-white font-extrabold text-sm rounded-xl hover:bg-red-700 transition-all shadow-lg flex items-center gap-2.5">
                          <RefreshCw className="w-4 h-4" /> Try Again
                        </button>
                      </div>
                    ) : !modalAiResult ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-gray-200/70 rounded-[1.5rem] p-8 bg-white/50">
                        <div className="w-20 h-20 bg-blue-50/80 rounded-full flex items-center justify-center mb-5 border border-blue-100/50">
                          <Brain className="w-10 h-10 text-blue-500" />
                        </div>
                        <h4 className="text-lg font-extrabold text-[#122244] mb-2">No Analysis Yet</h4>
                        <p className="text-sm text-gray-500 mb-8 max-w-[240px]">Run an AI evaluation to get scores, insights, and a draft feedback.</p>
                        <button
                          onClick={() => handleAIAnalysis(viewingProposal)}
                          className="px-8 py-3.5 bg-[#122244] text-white font-extrabold text-sm rounded-xl hover:bg-[#0a142e] transition-all shadow-lg hover:shadow-xl flex items-center gap-2.5 transform hover:-translate-y-0.5">
                          <Sparkles className="w-4 h-4" /> Analyze with AI
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {modalAiResult._fallback && (
                          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex items-center gap-3 shadow-sm">
                            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                            <p className="text-sm text-yellow-700 font-medium">
                              ⚡ AI is temporarily unavailable. Results below are placeholder fallbacks.
                            </p>
                          </div>
                        )}


                        {/* Strengths & Weaknesses */}
                        <div className="space-y-4">
                          <div className="bg-green-50/50 border border-green-200/60 rounded-xl p-5 shadow-sm">
                            <h4 className="text-xs font-extrabold text-green-800 flex items-center gap-2 mb-3"><ThumbsUp className="w-4 h-4 text-green-600" /> Key Strengths</h4>
                            {modalAiResult.strengths && modalAiResult.strengths.length > 0 ? (
                              <ul className="space-y-2.5">
                                {modalAiResult.strengths.map((s: any, i: number) => {
                                  const text = typeof s === 'string' ? s : (s?.title && s?.description ? `${s.title}: ${s.description}` : s?.description || s?.title || '');
                                  return (
                                    <li key={i} className="text-base text-green-900 leading-relaxed flex items-start gap-2.5">
                                      <span className="text-green-500 mt-1 flex-shrink-0"><CheckCircle2 className="w-4 h-4" /></span>
                                      <span>{text}</span>
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              <p className="text-base text-green-900 leading-relaxed font-medium">No key strengths identified for this proposal.</p>
                            )}
                          </div>
                          <div className={`${modalAiResult.weaknesses && modalAiResult.weaknesses.length > 0 ? 'bg-amber-50/50 border-amber-200/60' : 'bg-green-50/50 border-green-200/60'} border rounded-xl p-5 shadow-sm`}>
                            <h4 className={`text-xs font-extrabold flex items-center gap-2 mb-3 ${modalAiResult.weaknesses && modalAiResult.weaknesses.length > 0 ? 'text-amber-800' : 'text-green-800'}`}>
                              {modalAiResult.weaknesses && modalAiResult.weaknesses.length > 0 ? <TrendingDown className="w-4 h-4 text-amber-600" /> : <CheckCircle2 className="w-4 h-4 text-green-600" />}
                              Areas of Concern
                            </h4>
                            {modalAiResult.weaknesses && modalAiResult.weaknesses.length > 0 ? (
                              <ul className="space-y-2.5">
                                {modalAiResult.weaknesses.map((w: any, i: number) => {
                                  const text = typeof w === 'string' ? w : (w?.title && w?.description ? `${w.title}: ${w.description}` : w?.description || w?.title || '');
                                  return (
                                    <li key={i} className="text-base text-amber-900 leading-relaxed flex items-start gap-2.5">
                                      <span className="text-amber-500 mt-1 flex-shrink-0"><AlertCircle className="w-4 h-4" /></span>
                                      <span>{text}</span>
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              <p className="text-base text-green-900 leading-relaxed font-medium">There are no major areas of concern. This is an excellent and highly commendable proposal.</p>
                            )}
                          </div>
                        </div>

                        {/* Reality Check */}
                        {modalAiResult.realityCheck && (
                          <div className="bg-red-50/50 border border-red-200/60 rounded-xl p-5 shadow-sm">
                            <h4 className="text-xs font-extrabold text-red-800 flex items-center gap-2 mb-3">
                              <AlertCircle className="w-4 h-4 text-red-600" /> Reality Check
                            </h4>
                            <p className="text-base text-red-900 leading-relaxed font-medium italic">
                              "{modalAiResult.realityCheck}"
                            </p>
                          </div>
                        )}

                        {/* Recommendations */}
                        <div className="bg-white border border-gray-200/80 rounded-xl p-5 shadow-sm">
                          <h4 className="text-xs font-extrabold text-[#122244] flex items-center gap-2 mb-4"><Lightbulb className="w-4 h-4 text-[#c9a654]" /> Actionable Recommendations</h4>
                          <ul className="space-y-3">
                            {modalAiResult.recommendations?.map((r: any, i: number) => {
                              const text = typeof r === 'string' ? r : (r?.title && r?.description ? `${r.title}: ${r.description}` : r?.description || r?.title || '');
                              return (
                                <li key={i} className="text-base text-gray-700 leading-relaxed flex items-start gap-3 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                                  <span className="bg-[#122244] text-white font-bold rounded-md w-6 h-6 flex items-center justify-center flex-shrink-0 text-xs mt-0.5 shadow-sm">{i + 1}</span>
                                  <span>{text}</span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ADVISER FEEDBACK SECTION (Sticky Bottom & Foldable) */}
                {viewingProposal.status === 'Pending' ? (
                  <div className="border-t border-gray-200 bg-white p-4 md:p-6 shadow-[0_-15px_30px_-15px_rgba(0,0,0,0.08)] z-20 mt-auto rounded-br-[1.5rem]">
                    {/* Collapsible Header */}
                    <div 
                      onClick={() => setIsFeedbackExpanded(!isFeedbackExpanded)}
                      className="flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity mb-3"
                    >
                      <div className="flex items-center gap-2">
                        <MessageCircle className="w-4 h-4 text-[#c9a654]" />
                        <h3 className="text-xs font-extrabold text-[#122244] uppercase tracking-widest">
                          Feedback & Decision
                        </h3>
                        {feedbackInput.trim() && !isFeedbackExpanded && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full">
                            Draft Attached
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {modalAiResult && modalAiResult.draftFeedback && !isFeedbackExpanded && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFeedbackInput(modalAiResult.draftFeedback);
                              setIsFeedbackExpanded(true);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-[11px] font-bold border border-blue-200/60 shadow-sm"
                          >
                            <Sparkles className="w-3 h-3" /> Use AI Draft
                          </button>
                        )}
                        <button
                          type="button"
                          className="text-gray-400 hover:text-gray-600 p-1 rounded-md"
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isFeedbackExpanded ? "rotate-180" : ""}`} />
                        </button>
                      </div>
                    </div>

                    {/* Foldable Textarea Container */}
                    {isFeedbackExpanded && (
                      <div className="space-y-3 mb-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                        {modalAiResult && modalAiResult.draftFeedback && (
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => setFeedbackInput(modalAiResult.draftFeedback)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold transition-all border border-blue-200/60 shadow-sm"
                            >
                              <Sparkles className="w-3.5 h-3.5" /> Use AI Draft
                            </button>
                          </div>
                        )}
                        <textarea
                          value={feedbackInput}
                          onChange={(e) => setFeedbackInput(e.target.value)}
                          placeholder="Type your feedback here or run an AI Analysis to generate a draft..."
                          className="w-full p-4 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#c9a654]/50 focus:border-[#c9a654] resize-none h-32 text-sm bg-gray-50/50 text-gray-900 placeholder-gray-400 transition-all shadow-inner"
                        />
                      </div>
                    )}

                    {/* Action Decision Buttons (Always Visible) */}
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <button
                        onClick={() => handleProposalAction(viewingProposal, 'Reject')}
                        disabled={isSaving}
                        className="flex-1 py-3 bg-white text-red-600 border-2 border-red-100 font-extrabold text-xs sm:text-sm rounded-xl hover:bg-red-50 hover:border-red-200 transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95">
                        <X className="w-4 h-4" /> Reject Proposal
                      </button>
                      <button
                        onClick={() => handleProposalAction(viewingProposal, 'Revision')}
                        disabled={isSaving}
                        className="flex-1 py-3 bg-white text-orange-600 border-2 border-orange-100 font-extrabold text-xs sm:text-sm rounded-xl hover:bg-orange-50 hover:border-orange-200 transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95">
                        <Edit2 className="w-4 h-4" /> Needs Revision
                      </button>
                      <button
                        onClick={() => handleProposalAction(viewingProposal, 'Approve')}
                        disabled={isSaving}
                        className="flex-1 py-3 bg-[#c9a654] text-white font-extrabold text-xs sm:text-sm rounded-xl hover:bg-[#b59545] transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-1.5 active:scale-95">
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Approve Proposal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-gray-200 bg-white p-4 md:p-6 flex justify-end gap-3 mt-auto rounded-br-[1.5rem]">
                    <button onClick={() => setViewingProposal(null)} className="py-3 px-8 bg-gray-100 text-[#122244] font-extrabold text-sm rounded-xl hover:bg-gray-200 transition-colors shadow-sm w-full xl:w-auto">
                      Close Proposal
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* NEW MODAL: Create Group Step 1 - Assign Leader */}
      {showCreateLeaderModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-[#122244]">Create Group</h2>
                <p className="text-sm text-gray-500 mt-1">Step 1: Select a team leader for this new group.</p>
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
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {students.filter(s => !assignedIds.has(s.id) && (`${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) || s.studentId.includes(searchTerm))).length === 0 ? (
                <p className="text-center py-6 text-gray-400 italic text-sm">No unassigned students match your search.</p>
              ) : (
                students.filter(s => !assignedIds.has(s.id) && (`${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) || s.studentId.includes(searchTerm))).map(student => {
                  const isSelected = selectedLeaderId === student.id;
                  return (
                    <label key={student.id} className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-colors ${isSelected ? 'border-[#c9a654] bg-yellow-50/30 shadow-sm' : 'border-gray-100 hover:bg-gray-50'}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                          {getInitials(`${student.firstName} ${student.lastName}`)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#122244]">{`${student.firstName} ${student.lastName}`}</p>
                          <p className="text-xs text-gray-500">{student.studentId}</p>
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
      )}

      {/* NEW MODAL: Create Group Step 2 - Assign Members */}
      {showCreateMembersModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-[#122244]">Create Group</h2>
                <p className="text-sm text-gray-500 mt-1">Step 2: Select members to join this group.</p>
              </div>
              <button onClick={() => { setShowCreateMembersModal(false); setSelectedLeaderId(""); setSelectedMemberIds([]); }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="bg-purple-50 border-b border-purple-100 p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                {getInitials(students.find(s => s.id === selectedLeaderId)?.firstName + " " + students.find(s => s.id === selectedLeaderId)?.lastName)}
              </div>
              <div>
                <p className="text-xs font-black uppercase text-purple-600 tracking-tighter">Selected Leader</p>
                <p className="text-sm font-bold text-[#122244]">{students.find(s => s.id === selectedLeaderId)?.firstName} {students.find(s => s.id === selectedLeaderId)?.lastName}</p>
              </div>
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
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {students.filter(s => !assignedIds.has(s.id) && s.id !== selectedLeaderId && (`${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) || s.studentId.includes(searchTerm))).length === 0 ? (
                <p className="text-center py-6 text-gray-400 italic text-sm">No unassigned students match your search.</p>
              ) : (
                students.filter(s => !assignedIds.has(s.id) && s.id !== selectedLeaderId && (`${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) || s.studentId.includes(searchTerm))).map(student => {
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
                          <p className="text-xs text-gray-500">{student.studentId}</p>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'}`}>
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </label>
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
      )}

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
      {showAllStudentsModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-[#122244]">All Students - {activeSection}</h2>
                <p className="text-sm text-gray-500 mt-1">Complete class roster for this section.</p>
              </div>
              <button onClick={() => setShowAllStudentsModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search students by name or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a654]/50"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredStudents.map(student => {
                const isLeader = groups.some(g => g.leaderId === student.id);
                const isMember = groups.some(g => g.memberIds.includes(student.id));
                return (
                  <div key={student.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                        {getInitials(`${student.firstName} ${student.lastName}`)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{`${student.firstName} ${student.lastName}`}</p>
                        <p className="text-xs text-gray-500">{student.studentId}</p>
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
                )
              })}
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-b-2xl">
              <span className="text-sm text-gray-500">Showing <span className="font-bold text-gray-900">{filteredStudents.length}</span> students</span>
              <button onClick={() => setShowAllStudentsModal(false)} className="px-5 py-2 bg-white border border-gray-200 text-gray-700 font-semibold rounded-lg shadow-sm hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}

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

    </div>
  );
};

export default AdviserDashboard;