import React, { useEffect, useState } from "react";
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
  Search,
  Star,
  Bell,
  Check,
  ChevronRight,
  ChevronLeft,
  Info,
  Pencil,
  X,
  Clock,
  MoreVertical,
  Trash2,
  Edit,
  CheckCircle2,
  FileText,
  FileImage,
} from "lucide-react";

interface GroupData {
  id: string;
  leaderId: string;
  leaderName: string;
  title: string;
  companyName?: string;
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
  status: "Draft" | "Pending" | "Approved" | "Rejected";
  adviserFeedback?: string; // Added field to receive adviser's feedback
  createdAt?: any;
}

const initialProposalState: ProposalData = {
  groupId: "",
  businessType: "",
  businessName: "",
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
};

const Projects: React.FC = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [userUid, setUserUid] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const [userGroup, setUserGroup] = useState<GroupData | null>(null);
  const [isLeader, setIsLeader] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [leaderData, setLeaderData] = useState<any>(null);
  const [groupMembersData, setGroupMembersData] = useState<any[]>([]);
  const [adviserData, setAdviserData] = useState<any>(null);

  const [proposals, setProposals] = useState<ProposalData[]>([]);
  const [currentProposal, setCurrentProposal] =
    useState<ProposalData>(initialProposalState);

  const [activeView, setActiveView] = useState<string>("loading");
  const [dashboardTab, setDashboardTab] = useState<
    "All Proposals" | "Drafts" | "Pending" | "Approved" | "Rejected"
  >("All Proposals");

  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [showLockInModal, setShowLockInModal] = useState(false);
  const [showEditBasicModal, setShowEditBasicModal] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
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
            fetchUserGroup(u.uid, data.section);
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
    return () => unsub();
  }, [navigate]);

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

      querySnapshot.forEach((doc) => {
        const data = doc.data() as GroupData;
        if (data.leaderId === uid) {
          foundGroup = { ...data, id: doc.id };
          leader = true;
        } else if (data.memberIds && data.memberIds.includes(uid)) {
          foundGroup = { ...data, id: doc.id };
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
        await fetchGroupDetails(g);
        await fetchProposals(g.id);

        if (leader && !g.isSetup) {
          setActiveView("leader-setup");
        } else if (
          member &&
          (!g.joinedMembers || !g.joinedMembers.includes(uid))
        ) {
          setActiveView("member-join");
        } else if (g.activeProposalId) {
          // --- AUTO-LOCK LOGIC: If DB has an active proposal, go straight to it and set session ---
          sessionStorage.setItem("lastSelectedProjectId", g.activeProposalId);
          setActiveView("active-business");
        } else {
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

  const fetchProposals = async (groupId: string) => {
    try {
      const q = query(
        collection(db, "proposals"),
        where("groupId", "==", groupId),
      );
      const snap = await getDocs(q);
      setProposals(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ProposalData),
      );
    } catch (err) {
      console.error(err);
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

  const handleFinishTeamSetup = async () => {
    if (!userGroup) return;
    try {
      await updateDoc(doc(db, "groups", userGroup.id), {
        isSetup: true,
        status: "Drafting",
      });
      setUserGroup((prev) =>
        prev ? { ...prev, isSetup: true, status: "Drafting" } : null,
      );
      setShowSetupModal(false);
      setActiveView("dashboard");
    } catch (error) {
      console.error(error);
    }
  };

  const handleSaveProposal = async (status: "Draft" | "Pending") => {
    if (!userGroup) return;
    setIsSaving(true);
    try {
      const proposalData = {
        ...currentProposal,
        groupId: userGroup.id,
        status,
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
      alert("Failed to save proposal.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProposal = async (proposalId: string) => {
    try {
      await deleteDoc(doc(db, "proposals", proposalId));
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
        title: currentProposal.businessName,
      });

      // --- SESSION SYNC LOGIC: Updates DB and saves to session so other tabs match ---
      sessionStorage.setItem("lastSelectedProjectId", currentProposal.id);

      setUserGroup((prev) =>
        prev
          ? {
              ...prev,
              status: "Active Business",
              activeProposalId: currentProposal.id,
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

  const renderSidebar = () => (
    <aside
      className={`hidden lg:flex w-64 bg-[#122244] text-white flex-col fixed inset-y-0 shadow-xl z-20 transition-transform duration-300 ease-in-out ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
    >
      <div className="p-6 flex items-center gap-3 border-b border-white/10">
        <img
          src="/dashboard logo.png"
          alt="FeasiFy"
          className="w-70 h-20 object-contain"
        />
      </div>
      <nav className="flex-1 p-4 space-y-8 mt-4">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">
            Main Menu
          </p>
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
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">
            Account
          </p>
          <div className="space-y-1">
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
  );

  const filteredProposals =
    dashboardTab === "All Proposals"
      ? proposals
      : proposals.filter(
          (p) =>
            p.status === (dashboardTab === "Drafts" ? "Draft" : dashboardTab),
        );

  if (activeView === "loading") {
    return (
      <div className="flex min-h-screen bg-gray-50/30">
        {renderSidebar()}
        <main
          className={`flex-1 flex items-center justify-center ${isSidebarOpen ? "lg:ml-64" : "ml-0"}`}
        >
          <div className="w-8 h-8 border-4 border-[#122244] border-t-transparent rounded-full animate-spin"></div>
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
                Business Proposal
              </h1>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 flex flex-col items-center text-center min-h-[400px] justify-center border-dashed">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                  <Star className="w-8 h-8 text-blue-500" />
                </div>
                <h2 className="text-2xl font-bold text-[#122244] mb-2">
                  You're assigned as Group Leader!
                </h2>
                <button
                  onClick={() => setShowSetupModal(true)}
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
                Business Proposal
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

          {activeView === "dashboard" && userGroup && (
            <div>
              <h1 className="text-3xl font-extrabold text-[#3d2c23] mb-1">
                Business Proposal
              </h1>
              <div className="bg-[#122244] rounded-xl shadow-md overflow-hidden mb-6 flex flex-col md:flex-row items-center justify-between p-6 text-white relative">
                <div className="flex items-center gap-6 z-10 w-full md:w-auto">
                  <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 shadow-inner flex-shrink-0">
                    <span className="text-2xl font-bold text-white tracking-widest">
                      G{userGroup.id.slice(-1) || "1"}
                    </span>
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
                    <h1 className="text-2xl font-bold mb-1">
                      {userGroup.title}
                    </h1>
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
                <button
                  onClick={() => {
                    setCurrentProposal(initialProposalState);
                    setActiveView("form");
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#c9a654] text-white font-bold rounded-lg hover:bg-[#b59545] shadow-md transition-all text-sm"
                >
                  + New Proposal
                </button>
              </div>

              <div className="flex space-x-6 border-b border-gray-200 mb-6">
                {[
                  "All Proposals",
                  "Drafts",
                  "Pending",
                  "Approved",
                  "Rejected",
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

                    return (
                      <div
                        key={proposal.id}
                        className={`bg-white rounded-xl border-2 p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
                          isApproved ? "border-green-400" : 
                          isRejected ? "border-red-300" : "border-gray-200"
                        }`}
                      >
                        <div className="flex gap-4 items-center w-full sm:w-auto">
                          <div
                            className={`w-12 h-12 rounded-lg flex flex-shrink-0 items-center justify-center font-bold text-lg ${
                              isApproved ? "bg-green-50 text-green-600" : 
                              isRejected ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-500"
                            }`}
                          >
                            B#
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-1 flex-wrap">
                              <h3 className="font-bold text-[#122244] text-lg truncate max-w-[250px]">
                                {proposal.businessName}
                              </h3>
                              <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                                proposal.status === 'Approved' ? 'bg-green-100 text-green-700' :
                                proposal.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                                proposal.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {proposal.status}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest truncate">
                              {proposal.businessType || "No Category"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                          {isApproved ? (
                            <button
                              onClick={() => {
                                setCurrentProposal(proposal);
                                setShowLockInModal(true);
                              }}
                              className="px-5 py-2.5 bg-green-600 text-white font-bold text-sm rounded-lg hover:bg-green-700 w-full sm:w-auto"
                            >
                              Setup Approved Business
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setCurrentProposal(proposal);
                                setActiveView("form");
                              }}
                              className="px-5 py-2 bg-blue-50 text-[#4285F4] font-bold text-sm rounded-lg hover:bg-blue-100 flex items-center gap-2"
                            >
                              <Edit className="w-4 h-4" /> Open
                            </button>
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
                                    setCurrentProposal(proposal);
                                    setActiveView("form");
                                    setOpenDropdownId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() =>
                                    handleDeleteProposal(proposal.id!)
                                  }
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
          )}

          {activeView === "form" && (
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
                <div className="flex gap-3 w-full sm:w-auto">
                  {(currentProposal.status === "Draft" ||
                    !currentProposal.id || currentProposal.status === "Rejected") && (
                    <button
                      onClick={() => handleSaveProposal("Draft")}
                      disabled={isSaving}
                      className="flex-1 sm:flex-none px-5 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold text-sm rounded-lg hover:bg-gray-50 shadow-sm"
                    >
                      Save as Draft
                    </button>
                  )}
                  {currentProposal.status !== "Approved" &&
                    currentProposal.status !== "Pending" && (
                      <button
                        onClick={() => handleSaveProposal("Pending")}
                        disabled={isSaving}
                        className="flex-1 sm:flex-none px-5 py-2.5 bg-[#c9a654] text-white font-bold text-sm rounded-lg hover:bg-[#b59545] shadow-md"
                      >
                        Submit to Adviser
                      </button>
                    )}
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-8 border-b border-gray-100 text-center bg-gray-50/50">
                  <h2 className="text-3xl font-extrabold text-[#122244] mb-2">
                    {currentProposal.businessName || "Business Proposal #X"}
                  </h2>
                  <div className="w-full max-w-lg mx-auto h-px bg-blue-600 mb-2"></div>
                  <p className="text-xs text-gray-400">
                    Click title to rename (below in form)
                  </p>
                </div>
                <div className="p-8 space-y-10 max-w-4xl mx-auto">
                  
                  {/* --- NEW: ADVISER FEEDBACK BANNER --- */}
                  {currentProposal.adviserFeedback && (
                    <div className={`p-5 rounded-xl border-2 flex items-start gap-3 ${
                      currentProposal.status === 'Rejected' ? 'bg-red-50 border-red-200' :
                      currentProposal.status === 'Approved' ? 'bg-green-50 border-green-200' :
                      'bg-blue-50 border-blue-200'
                    }`}>
                      <MessageCircle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                        currentProposal.status === 'Rejected' ? 'text-red-500' :
                        currentProposal.status === 'Approved' ? 'text-green-500' :
                        'text-blue-500'
                      }`} />
                      <div>
                        <h4 className={`text-xs font-bold uppercase tracking-widest mb-1 ${
                          currentProposal.status === 'Rejected' ? 'text-red-700' :
                          currentProposal.status === 'Approved' ? 'text-green-700' :
                          'text-blue-700'
                        }`}>
                          Adviser Feedback
                        </h4>
                        <p className={`text-sm leading-relaxed whitespace-pre-wrap ${
                          currentProposal.status === 'Rejected' ? 'text-red-900' :
                          currentProposal.status === 'Approved' ? 'text-green-900' :
                          'text-blue-900'
                        }`}>
                          {currentProposal.adviserFeedback}
                        </p>
                      </div>
                    </div>
                  )}
                  {/* ------------------------------------ */}

                  <section>
                    <h3 className="text-sm font-bold text-[#122244] uppercase tracking-widest flex items-center gap-2 mb-4">
                      <FileText className="w-4 h-4 text-blue-500" /> BUSINESS
                      OVERVIEW
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                          Business Type
                        </label>
                        <select
                          disabled={
                            currentProposal.status === "Pending" ||
                            currentProposal.status === "Approved"
                          }
                          value={currentProposal.businessType}
                          onChange={(e) =>
                            setCurrentProposal({
                              ...currentProposal,
                              businessType: e.target.value,
                            })
                          }
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm"
                        >
                          <option value="">Select category...</option>
                          <option>Food & Beverage</option>
                          <option>Retail</option>
                          <option>Services</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                          Business Name
                        </label>
                        <input
                          disabled={
                            currentProposal.status === "Pending" ||
                            currentProposal.status === "Approved"
                          }
                          type="text"
                          value={currentProposal.businessName}
                          onChange={(e) =>
                            setCurrentProposal({
                              ...currentProposal,
                              businessName: e.target.value,
                            })
                          }
                          placeholder="e.g. eggdesal"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                          Total Capital (₱)
                        </label>
                        <input
                          disabled={
                            currentProposal.status === "Pending" ||
                            currentProposal.status === "Approved"
                          }
                          type="text"
                          value={currentProposal.totalCapital}
                          onChange={(e) =>
                            setCurrentProposal({
                              ...currentProposal,
                              totalCapital: e.target.value,
                            })
                          }
                          placeholder="₱ 0.00"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                          Tagline
                        </label>
                        <input
                          disabled={
                            currentProposal.status === "Pending" ||
                            currentProposal.status === "Approved"
                          }
                          type="text"
                          value={currentProposal.tagline}
                          onChange={(e) =>
                            setCurrentProposal({
                              ...currentProposal,
                              tagline: e.target.value,
                            })
                          }
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                        Target Market
                      </label>
                      <textarea
                        disabled={
                          currentProposal.status === "Pending" ||
                          currentProposal.status === "Approved"
                        }
                        rows={3}
                        value={currentProposal.targetMarket}
                        onChange={(e) =>
                          setCurrentProposal({
                            ...currentProposal,
                            targetMarket: e.target.value,
                          })
                        }
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm resize-none"
                      />
                    </div>
                  </section>
                  <section>
                    <h3 className="text-sm font-bold text-[#122244] uppercase tracking-widest flex items-center gap-2 mb-4">
                      <Star className="w-4 h-4 text-purple-500 fill-current" />{" "}
                      MISSION & VISION
                    </h3>
                    <div className="space-y-6">
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                          Mission Statement
                        </label>
                        <textarea
                          disabled={
                            currentProposal.status === "Pending" ||
                            currentProposal.status === "Approved"
                          }
                          rows={2}
                          value={currentProposal.missionStatement}
                          onChange={(e) =>
                            setCurrentProposal({
                              ...currentProposal,
                              missionStatement: e.target.value,
                            })
                          }
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm resize-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                          Vision Statement
                        </label>
                        <textarea
                          disabled={
                            currentProposal.status === "Pending" ||
                            currentProposal.status === "Approved"
                          }
                          rows={2}
                          value={currentProposal.visionStatement}
                          onChange={(e) =>
                            setCurrentProposal({
                              ...currentProposal,
                              visionStatement: e.target.value,
                            })
                          }
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm resize-none"
                        />
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          )}

          {activeView === "active-business" && activeBusiness && (
            <div>
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => setActiveView("dashboard")}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 font-bold text-sm rounded-lg hover:bg-gray-50 shadow-sm transition-all"
                >
                  <ChevronLeft className="w-4 h-4" /> Back to Proposals List
                </button>
              </div>
              <div className="bg-[#122244] rounded-xl shadow-md overflow-hidden mb-6 flex flex-col md:flex-row items-center justify-between p-8 text-white relative">
                <div className="flex items-center gap-6 z-10 w-full md:w-auto">
                  <div className="w-24 h-24 bg-[#1a2f55] rounded-2xl flex items-center justify-center border border-white/10 shadow-inner flex-shrink-0">
                    <span className="text-3xl font-extrabold text-white tracking-widest">
                      {getInitials(activeBusiness.businessName)}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest bg-green-500/20 text-green-400 px-2 py-1 rounded border border-green-500/30 flex items-center gap-1">
                        <Check className="w-3 h-3" /> APPROVED BUSINESS PROPOSAL
                      </span>
                    </div>
                    <h1 className="text-4xl font-extrabold mb-1 tracking-tight">
                      {activeBusiness.businessName}
                    </h1>
                    <p className="text-sm text-gray-300 font-medium">
                      {activeBusiness.businessType}
                    </p>
                  </div>
                </div>
                {isLeader && (
                  <button
                    onClick={() => setShowEditBasicModal(true)}
                    className="mt-6 md:mt-0 flex items-center gap-2 px-5 py-2.5 border border-white/20 hover:bg-white/10 rounded-lg text-sm font-bold transition-all z-10"
                  >
                    <Pencil className="w-4 h-4" /> Edit Basic Info
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
                    <div className="flex justify-between items-start mb-8">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-50 p-2.5 rounded-full border border-blue-100">
                          <FileText className="w-6 h-6 text-blue-500" />
                        </div>
                        <h3 className="text-xl font-extrabold text-[#122244]">
                          Project Overview
                        </h3>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-6 mb-8 flex divide-x divide-gray-200 text-center">
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
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 h-fit">
                  <h3 className="text-sm font-extrabold text-[#122244] uppercase tracking-widest mb-4">
                    Project Roster
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-600 rounded-full text-white flex items-center justify-center font-bold text-sm">
                        {getInitials(userGroup?.leaderName || "")}
                      </div>
                      <p className="text-sm font-bold text-gray-900">
                        {userGroup?.leaderName} (Leader)
                      </p>
                    </div>
                    {groupMembersData.map((member) => (
                      <div key={member.id} className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-500 rounded-full text-white flex items-center justify-center font-bold text-sm">
                          {getInitials(member.firstName)}
                        </div>
                        <p className="text-sm font-bold text-gray-900">
                          {member.firstName} {member.lastName}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {showSetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-start text-center relative">
              <div className="w-full">
                <h2 className="text-2xl font-extrabold text-[#122244]">
                  Team Setup
                </h2>
              </div>
              <button
                onClick={() => setShowSetupModal(false)}
                className="absolute top-6 right-6 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end bg-gray-50/50 rounded-b-2xl">
              <button
                onClick={handleFinishTeamSetup}
                className="px-8 py-3 text-sm font-bold text-white bg-[#c9a654] rounded-lg shadow-md"
              >
                Finish Setup
              </button>
            </div>
          </div>
        </div>
      )}

      {showRosterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-6 border-b pb-4">
              <div>
                <h2 className="text-2xl font-extrabold text-[#122244]">
                  Project Roster
                </h2>
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

      {showLockInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-8 text-center">
            <Zap className="w-16 h-16 text-blue-500 mx-auto mb-6" />
            <h2 className="text-2xl font-extrabold text-[#122244] mb-2">
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

      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl text-center">
            <h3 className="text-lg font-bold text-[#122244] mb-2">
              Confirm Logout
            </h3>
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
    </div>
  );
};

export default Projects;