import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db, signOutUser } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where, doc, getDoc, updateDoc, arrayUnion, addDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import {
  LayoutDashboard, Folder, FileEdit, Zap, BarChart3, MessageCircle, User, Users,
  Settings, ShieldAlert, Sidebar as SidebarIcon, Search, Star, Bell, Check,
  ChevronRight, ChevronLeft, Info, Pencil, X, Clock, MoreVertical, Trash2, Edit, CheckCircle2, FileText, FileImage
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
  status?: 'Drafting' | 'Pending Review' | 'Approved Proposal' | 'Active Business';
  activeProposalId?: string; // Links to the locked-in business
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
  status: 'Draft' | 'Pending' | 'Approved' | 'Rejected';
  createdAt?: any;
}

const initialProposalState: ProposalData = {
  groupId: "", businessType: "", businessName: "", totalCapital: "", tagline: "",
  targetMarket: "", missionStatement: "", visionStatement: "", productDescription: "",
  priceRanges: "", proposedLocation: "", promotionalStrategy: "", otherDetails: "", status: 'Draft'
};

const Projects: React.FC = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [userUid, setUserUid] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  // Group State
  const [userGroup, setUserGroup] = useState<GroupData | null>(null);
  const [isLeader, setIsLeader] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Roster Data
  const [leaderData, setLeaderData] = useState<any>(null);
  const [groupMembersData, setGroupMembersData] = useState<any[]>([]);
  const [adviserData, setAdviserData] = useState<any>(null);

  // Proposals Data
  const [proposals, setProposals] = useState<ProposalData[]>([]);
  const [currentProposal, setCurrentProposal] = useState<ProposalData>(initialProposalState);

  // View States: 'loading' | 'no-group' | 'leader-setup' | 'member-join' | 'dashboard' | 'form' | 'active-business' | 'history'
  const [activeView, setActiveView] = useState<string>('loading');
  const [dashboardTab, setDashboardTab] = useState<'All Proposals' | 'Drafts' | 'Pending' | 'Approved' | 'Rejected'>('All Proposals');

  // Modals & Popovers
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [showLockInModal, setShowLockInModal] = useState(false);
  const [showEditBasicModal, setShowEditBasicModal] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { navigate("/"); return; }
      setUserUid(u.uid);
      try {
        const userDoc = await getDoc(doc(db, "users", u.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserName(`${data.firstName} ${data.lastName}`);
          if (data.section) { fetchUserGroup(u.uid, data.section); } 
          else { setIsLoading(false); setActiveView('no-group'); }
        }
      } catch (error) { console.error(error); setIsLoading(false); setActiveView('no-group'); }
    });
    return () => unsub();
  }, [navigate]);

  const fetchUserGroup = async (uid: string, section: string) => {
    try {
      const q = query(collection(db, "groups"), where("section", "==", section));
      const querySnapshot = await getDocs(q);
      
      let foundGroup: GroupData | null = null;
      let leader = false;
      let member = false;

      querySnapshot.forEach((doc) => {
        const data = doc.data() as GroupData;
        if (data.leaderId === uid) { foundGroup = { ...data, id: doc.id }; leader = true; } 
        else if (data.memberIds && data.memberIds.includes(uid)) { foundGroup = { ...data, id: doc.id }; member = true; }
      });

      if (foundGroup) {
        const g = foundGroup as GroupData;
        setUserGroup(g);
        setIsLeader(leader);
        setIsMember(member);
        
        if (member && g.joinedMembers && g.joinedMembers.includes(uid)) setHasJoined(true);
        await fetchGroupDetails(g);
        await fetchProposals(g.id);

        // Routing Logic
        if (g.status === 'Active Business') {
          setActiveView('active-business');
        } else if (leader && !g.isSetup) {
          setActiveView('leader-setup');
        } else if (member && (!g.joinedMembers || !g.joinedMembers.includes(uid))) {
          setActiveView('member-join');
        } else {
          setActiveView('dashboard');
        }
      } else {
        setIsLoading(false);
        setActiveView('no-group');
      }
    } catch (error) { console.error(error); setIsLoading(false); setActiveView('no-group'); }
  };

  const fetchGroupDetails = async (group: GroupData) => {
    try {
      const leaderSnap = await getDoc(doc(db, "users", group.leaderId));
      if (leaderSnap.exists()) setLeaderData(leaderSnap.data());

      if (group.memberIds.length > 0) {
        const memberPromises = group.memberIds.map(id => getDoc(doc(db, "users", id)));
        const memberSnaps = await Promise.all(memberPromises);
        setGroupMembersData(memberSnaps.filter(s => s.exists()).map(s => ({ id: s.id, ...s.data() })));
      }

      const advQ = query(collection(db, "users"), where("role", "==", "Adviser"));
      const advSnaps = await getDocs(advQ);
      advSnaps.forEach(d => {
        if (d.data().section && d.data().section.includes(group.section)) setAdviserData(d.data());
      });
    } catch (err) { console.error(err); } 
    finally { setIsLoading(false); }
  };

  const fetchProposals = async (groupId: string) => {
    try {
      const q = query(collection(db, "proposals"), where("groupId", "==", groupId));
      const snap = await getDocs(q);
      setProposals(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProposalData)));
    } catch (err) { console.error(err); }
  };

  const handleLogout = async () => {
    try { await signOutUser(); localStorage.clear(); sessionStorage.clear(); } catch (e) {}
    navigate("/");
  };

  const getInitials = (name: string) => name ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "U";

  // --- ACTIONS ---

  const handleJoinGroup = async () => {
    if (!userGroup || !userUid) return;
    try {
      await updateDoc(doc(db, "groups", userGroup.id), { joinedMembers: arrayUnion(userUid) });
      setHasJoined(true);
      setActiveView('dashboard');
    } catch (error) { console.error(error); }
  };

  const handleFinishTeamSetup = async () => {
    if (!userGroup) return;
    try {
      await updateDoc(doc(db, "groups", userGroup.id), { isSetup: true, status: 'Drafting' });
      setUserGroup(prev => prev ? { ...prev, isSetup: true, status: 'Drafting' } : null);
      setShowSetupModal(false);
      setActiveView('dashboard');
    } catch (error) { console.error(error); }
  };

  const handleSaveProposal = async (status: 'Draft' | 'Pending') => {
    if (!userGroup) return;
    setIsSaving(true);
    try {
      const proposalData = { ...currentProposal, groupId: userGroup.id, status };
      if (currentProposal.id) {
        // Update existing
        await updateDoc(doc(db, "proposals", currentProposal.id), { ...proposalData, updatedAt: serverTimestamp() });
      } else {
        // Create new
        await addDoc(collection(db, "proposals"), { ...proposalData, createdAt: serverTimestamp() });
      }
      
      // If submitting to pending, update group status
      if (status === 'Pending') {
        await updateDoc(doc(db, "groups", userGroup.id), { status: 'Pending Review' });
        setUserGroup(prev => prev ? { ...prev, status: 'Pending Review' } : null);
      }

      await fetchProposals(userGroup.id);
      setActiveView('dashboard');
      setCurrentProposal(initialProposalState);
    } catch (error) { console.error(error); alert("Failed to save proposal."); }
    finally { setIsSaving(false); }
  };

  const handleDeleteProposal = async (proposalId: string) => {
    try {
      await deleteDoc(doc(db, "proposals", proposalId));
      setProposals(prev => prev.filter(p => p.id !== proposalId));
      setOpenDropdownId(null);
    } catch (error) { console.error(error); }
  };

  const handleLockInBusiness = async () => {
    if (!userGroup) return;
    try {
      const approvedProposal = proposals.find(p => p.status === 'Approved');
      if (!approvedProposal) return;

      await updateDoc(doc(db, "groups", userGroup.id), {
        status: 'Active Business',
        activeProposalId: approvedProposal.id,
        title: approvedProposal.businessName
      });
      setUserGroup(prev => prev ? { ...prev, status: 'Active Business', activeProposalId: approvedProposal.id, title: approvedProposal.businessName } : null);
      setShowLockInModal(false);
      setActiveView('active-business');
    } catch (error) { console.error(error); }
  };

  // --- RENDER HELPERS ---

  const renderSidebar = () => (
    <aside className={`hidden lg:flex w-64 bg-[#122244] text-white flex-col fixed inset-y-0 shadow-xl z-20 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="p-6 flex items-center gap-3 border-b border-white/10">
        <img src="/dashboard logo.png" alt="FeasiFy" className="w-70 h-20 object-contain" />
      </div>

      <nav className="flex-1 p-4 space-y-8 mt-4">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">Main Menu</p>
          <div className="space-y-1">
            <button onClick={() => navigate('/dashboard')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all">
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold bg-[#c9a654] text-white transition-all shadow-md">
              <Folder className="w-4 h-4" /> Business Proposal
            </button>
            <button onClick={() => navigate('/financial-input')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all">
              <FileEdit className="w-4 h-4" /> Financial Input
            </button>
            <button onClick={() => navigate('/ai-analysis')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all">
              <Zap className="w-4 h-4" /> AI Feasibility Analysis
            </button>
            <button onClick={() => navigate('/reports')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all">
              <BarChart3 className="w-4 h-4" /> Reports
            </button>
            <button onClick={() => navigate('/messages')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all">
              <MessageCircle className="w-4 h-4" /> Message
            </button>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">Account</p>
          <div className="space-y-1">
            <button onClick={() => navigate('/profile')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all">
              <User className="w-4 h-4" /> Profile
            </button>
            <button onClick={() => navigate('/settings')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all">
              <Settings className="w-4 h-4" /> Settings
            </button>
            <button onClick={() => setShowLogoutConfirm(true)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all">
              <ShieldAlert className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="p-4 border-t border-white/10 bg-black/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#c9a654] flex items-center justify-center font-bold text-sm">
            {getInitials(userName)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate text-white">{userName}</p>
            <p className="text-[10px] text-gray-400 truncate">Student</p>
          </div>
        </div>
      </div>
    </aside>
  );

  // Filtered Proposals for Dashboard
  const filteredProposals = dashboardTab === 'All Proposals' 
    ? proposals 
    : proposals.filter(p => p.status === (dashboardTab === 'Drafts' ? 'Draft' : dashboardTab));

  // Loading Screen
  if (activeView === 'loading') {
    return (
      <div className="flex min-h-screen bg-gray-50/30">
        {renderSidebar()}
        <main className={`flex-1 flex items-center justify-center ${isSidebarOpen ? 'lg:ml-64' : 'ml-0'}`}>
          <div className="w-8 h-8 border-4 border-[#122244] border-t-transparent rounded-full animate-spin"></div>
        </main>
      </div>
    );
  }

  // Active Business Object
  const activeBusiness = activeView === 'active-business' ? proposals.find(p => p.id === userGroup?.activeProposalId) : null;

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      {renderSidebar()}
      
      <main className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'lg:ml-64' : 'ml-0'}`}>
        <div className="bg-white border-b border-gray-100 p-4 flex items-center gap-2 text-sm text-gray-500">
          <SidebarIcon className="w-4 h-4 cursor-pointer hover:text-gray-800 transition-colors" onClick={() => setIsSidebarOpen(!isSidebarOpen)} />
          <span className="mx-2">|</span> FeasiFy <span>›</span> <span className="font-semibold text-gray-900">Projects</span>
        </div>

        <div className="p-6 md:p-8 max-w-6xl mx-auto">
          
          {/* ========================================== */}
          {/* VIEW: NO GROUP ASSIGNED                    */}
          {/* ========================================== */}
          {activeView === 'no-group' && (
            <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4"><Users className="w-8 h-8 text-gray-400" /></div>
              <h2 className="text-xl font-bold text-[#122244]">Not Assigned Yet</h2>
              <p className="text-gray-500 mt-2 max-w-md">Your adviser has not assigned you to a feasibility group yet. Please check back later.</p>
            </div>
          )}

          {/* ========================================== */}
          {/* VIEW: LEADER SETUP REQUIRED                */}
          {/* ========================================== */}
          {activeView === 'leader-setup' && (
            <div>
              <h1 className="text-3xl font-extrabold text-[#3d2c23] mb-1">Business Proposal</h1>
              <p className="text-sm text-gray-500 italic mb-8">Manage and track your feasibility study project</p>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 flex flex-col items-center text-center min-h-[400px] justify-center border-dashed">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-6"><Star className="w-8 h-8 text-blue-500" /></div>
                <h2 className="text-2xl font-bold text-[#122244] mb-2">You're assigned as Group Leader!</h2>
                <p className="text-gray-500 mb-8 max-w-md">Set up your business proposal — add your group members to your workspace to get started.</p>
                <button onClick={() => setShowSetupModal(true)} className="flex items-center gap-2 px-6 py-3 bg-[#c9a654] text-white font-bold rounded-lg hover:bg-[#b59545] shadow-md transition-all">
                  <Star className="w-4 h-4 fill-current" /> Set up team
                </button>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* VIEW: MEMBER NEEDS TO JOIN                 */}
          {/* ========================================== */}
          {activeView === 'member-join' && (
            <div>
              <h1 className="text-3xl font-extrabold text-[#3d2c23] mb-1">Business Proposal</h1>
              <p className="text-sm text-gray-500 italic mb-8">Manage and track your feasibility study project</p>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 flex flex-col items-center text-center min-h-[400px] justify-center">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-6 border border-blue-100"><Bell className="w-8 h-8 text-blue-500" /></div>
                <h2 className="text-2xl font-bold text-[#122244] mb-2">You're added to a group!</h2>
                <p className="text-gray-500 mb-8 max-w-md"><span className="font-bold text-gray-900">{userGroup?.leaderName}</span> has added you to their feasibility study workspace.</p>
                <button onClick={handleJoinGroup} className="flex items-center gap-2 px-8 py-3 bg-[#c9a654] text-white font-bold rounded-lg hover:bg-[#b59545] shadow-md transition-all">
                  <Check className="w-5 h-5" /> Join Workspace
                </button>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* VIEW: PROPOSALS DASHBOARD                  */}
          {/* ========================================== */}
          {activeView === 'dashboard' && userGroup && (
            <div>
              <h1 className="text-3xl font-extrabold text-[#3d2c23] mb-1">Business Proposal</h1>
              <p className="text-sm text-gray-500 italic mb-8">Manage and track your feasibility study project</p>

              {/* Top Banner */}
              <div className="bg-[#122244] rounded-xl shadow-md overflow-hidden mb-6 flex flex-col md:flex-row items-center justify-between p-6 text-white relative">
                <div className="flex items-center gap-6 z-10 w-full md:w-auto">
                  <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 shadow-inner flex-shrink-0">
                    <span className="text-2xl font-bold text-white tracking-widest">G{userGroup.id.slice(-1) || '1'}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest bg-[#4285F4] px-2 py-1 rounded">PROPOSAL PHASE</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 text-gray-300"><User className="w-3 h-3"/> SECTION: {userGroup.section}</span>
                    </div>
                    <h1 className="text-2xl font-bold mb-1">Group {userGroup.id.slice(-1) || '1'}</h1>
                    <p className="text-xs text-gray-400">+ Adviser: Prof. {adviserData ? adviserData.lastName : 'Santos'}</p>
                  </div>
                </div>
                <button onClick={() => setShowRosterModal(true)} className="mt-6 md:mt-0 flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 hover:bg-white/20 rounded-lg text-sm font-bold transition-all z-10">
                  <Users className="w-4 h-4"/> {userGroup.memberIds.length + 1} Members <span className="text-[10px] uppercase ml-1">View Team</span>
                </button>
              </div>

              {/* Submission Guideline */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3 mb-8">
                <Info className="w-5 h-5 text-blue-500 mt-0.5" />
                <div>
                  <h4 className="font-bold text-[#122244] text-sm">Proposal Submission Guideline</h4>
                  <p className="text-sm text-gray-600 mt-0.5">Your team can submit multiple business proposals for your adviser's approval. Click "New Proposal" below to draft a proposal.</p>
                </div>
              </div>

              {/* Proposals Area */}
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-[#122244]">Business Proposals</h2>
                <button onClick={() => { setCurrentProposal(initialProposalState); setActiveView('form'); }} className="flex items-center gap-2 px-5 py-2.5 bg-[#c9a654] text-white font-bold rounded-lg hover:bg-[#b59545] shadow-md transition-all text-sm">
                  + New Proposal
                </button>
              </div>

              {/* Tabs */}
              <div className="flex space-x-6 border-b border-gray-200 mb-6">
                {['All Proposals', 'Drafts', 'Pending', 'Approved', 'Rejected'].map(tab => (
                  <button key={tab} onClick={() => setDashboardTab(tab as any)} className={`pb-3 text-sm font-bold transition-colors border-b-2 ${dashboardTab === tab ? 'border-[#4285F4] text-[#4285F4]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                    {tab}
                  </button>
                ))}
              </div>

              {/* Proposals List */}
              {proposals.length === 0 ? (
                 <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 py-20 flex flex-col items-center justify-center text-center">
                   <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4 border border-gray-100"><FileText className="w-8 h-8 text-gray-300" /></div>
                   <h3 className="text-lg font-bold text-[#122244]">No proposals yet</h3>
                   <p className="text-sm text-gray-500 mt-1">Start by drafting your first business idea for feasibility analysis.</p>
                 </div>
              ) : filteredProposals.length === 0 ? (
                <p className="text-center text-gray-500 py-12">No proposals found for this filter.</p>
              ) : (
                <div className="space-y-4">
                  {filteredProposals.map((proposal, idx) => {
                    // Status styling
                    let borderCol = "border-gray-200";
                    let badgeBg = "bg-gray-100"; let badgeText = "text-gray-600";
                    let isApproved = proposal.status === 'Approved';
                    let isPending = proposal.status === 'Pending';
                    let isRejected = proposal.status === 'Rejected';

                    if (isPending) { borderCol = "border-[#c9a654]"; badgeBg = "bg-yellow-100"; badgeText = "text-yellow-700"; }
                    if (isApproved) { borderCol = "border-green-400"; badgeBg = "bg-green-100"; badgeText = "text-green-700"; }
                    if (isRejected) { borderCol = "border-red-200"; badgeBg = "bg-red-50"; badgeText = "text-red-500"; }

                    return (
                      <div key={proposal.id} className={`bg-white rounded-xl border-2 p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${borderCol}`}>
                        <div className="flex gap-4 items-center w-full sm:w-auto">
                          <div className={`w-12 h-12 rounded-lg flex flex-shrink-0 items-center justify-center font-bold text-lg ${isApproved ? 'bg-green-50 text-green-600' : isPending ? 'bg-yellow-50 text-yellow-600' : isRejected ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                            B#
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-1 flex-wrap">
                              <h3 className="font-bold text-[#122244] text-lg truncate max-w-[250px]">{proposal.businessName || `Business Proposal #${idx + 1}`}</h3>
                              <span className={`px-2.5 py-0.5 ${badgeBg} ${badgeText} text-[10px] font-bold rounded-full uppercase tracking-wider flex items-center gap-1`}>
                                {isApproved && <CheckCircle2 className="w-3 h-3"/>}
                                {isRejected && <X className="w-3 h-3"/>}
                                {proposal.status}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1 truncate max-w-[300px]">
                              {proposal.businessName ? `${proposal.businessName} • ${proposal.businessType || 'No Category'}` : '- - -'}
                            </p>
                            <p className="text-xs text-gray-400 flex items-center gap-1">
                              <Clock className="w-3 h-3"/> {proposal.createdAt ? new Date(proposal.createdAt.toDate()).toLocaleString() : 'Just now'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                          {isApproved ? (
                            <button onClick={() => setShowLockInModal(true)} className="px-5 py-2.5 bg-green-600 text-white font-bold text-sm rounded-lg hover:bg-green-700 transition-colors shadow-sm w-full sm:w-auto">
                              Setup Approved Business
                            </button>
                          ) : (
                            <button onClick={() => { setCurrentProposal(proposal); setActiveView('form'); }} className="px-5 py-2 bg-blue-50 text-[#4285F4] font-bold text-sm rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-2">
                              <Edit className="w-4 h-4"/> Open
                            </button>
                          )}
                          
                          {/* 3 Dot Menu */}
                          <div className="relative">
                            <button onClick={() => setOpenDropdownId(openDropdownId === proposal.id ? null : (proposal.id || null))} className="p-2 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-lg">
                              <MoreVertical className="w-4 h-4"/>
                            </button>
                            {openDropdownId === proposal.id && (
                              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-lg shadow-xl z-10 py-1">
                                <button onClick={() => { setCurrentProposal(proposal); setActiveView('form'); setOpenDropdownId(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                  {proposal.status === 'Draft' ? 'Edit Draft' : 'View Details'}
                                </button>
                                {proposal.status === 'Draft' && (
                                  <button onClick={() => handleDeleteProposal(proposal.id!)} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Delete</button>
                                )}
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

          {/* ========================================== */}
          {/* VIEW: PROPOSAL FORM (NEW/EDIT)             */}
          {/* ========================================== */}
          {activeView === 'form' && (
            <div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div className="flex items-center gap-4">
                  <button onClick={() => setActiveView('dashboard')} className="flex items-center gap-2 text-sm font-bold text-[#4285F4] hover:text-blue-700">
                    <ChevronLeft className="w-4 h-4" /> Back to Proposals
                  </button>
                  {currentProposal.status === 'Draft' && <span className="text-xs text-green-600 font-bold flex items-center gap-1"><Check className="w-3 h-3"/> Draft auto-saved</span>}
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                  {(currentProposal.status === 'Draft' || !currentProposal.id) && (
                     <button onClick={() => handleSaveProposal('Draft')} disabled={isSaving} className="flex-1 sm:flex-none px-5 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold text-sm rounded-lg hover:bg-gray-50 shadow-sm disabled:opacity-50">
                       Save as Draft
                     </button>
                  )}
                  {currentProposal.status !== 'Approved' && currentProposal.status !== 'Pending' && (
                    <button onClick={() => handleSaveProposal('Pending')} disabled={isSaving} className="flex-1 sm:flex-none px-5 py-2.5 bg-[#c9a654] text-white font-bold text-sm rounded-lg hover:bg-[#b59545] shadow-md disabled:opacity-50">
                    Submit to Adviser
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-8 border-b border-gray-100 text-center bg-gray-50/50">
                  <h2 className="text-3xl font-extrabold text-[#122244] mb-2">{currentProposal.businessName || 'Business Proposal #X'}</h2>
                  <div className="w-full max-w-lg mx-auto h-px bg-blue-600 mb-2"></div>
                  <p className="text-xs text-gray-400">Click title to rename (below in form)</p>
                </div>

                <div className="p-8 space-y-10 max-w-4xl mx-auto">
                  {/* OVERVIEW */}
                  <section>
                    <h3 className="text-sm font-bold text-[#122244] uppercase tracking-widest flex items-center gap-2 mb-4"><FileText className="w-4 h-4 text-blue-500"/> BUSINESS OVERVIEW</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Business Type</label>
                        <select disabled={currentProposal.status === 'Pending' || currentProposal.status === 'Approved'} value={currentProposal.businessType} onChange={e => setCurrentProposal({...currentProposal, businessType: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#4285F4]/50 text-sm disabled:opacity-70">
                          <option value="">Select category...</option>
                          <option>Food & Beverage</option>
                          <option>Retail</option>
                          <option>Services</option>
                          <option>Technology</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Business Name</label>
                        <input disabled={currentProposal.status === 'Pending' || currentProposal.status === 'Approved'} type="text" value={currentProposal.businessName} onChange={e => setCurrentProposal({...currentProposal, businessName: e.target.value})} placeholder="e.g. Pinoy Roll" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#4285F4]/50 text-sm disabled:opacity-70"/>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Total Capital (₱)</label>
                        <input disabled={currentProposal.status === 'Pending' || currentProposal.status === 'Approved'} type="text" value={currentProposal.totalCapital} onChange={e => setCurrentProposal({...currentProposal, totalCapital: e.target.value})} placeholder="₱ 0.00" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#4285F4]/50 text-sm disabled:opacity-70"/>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Tagline</label>
                        <input disabled={currentProposal.status === 'Pending' || currentProposal.status === 'Approved'} type="text" value={currentProposal.tagline} onChange={e => setCurrentProposal({...currentProposal, tagline: e.target.value})} placeholder="e.g. Your Pinoy Meal on the Go" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#4285F4]/50 text-sm disabled:opacity-70"/>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Target Market</label>
                      <textarea disabled={currentProposal.status === 'Pending' || currentProposal.status === 'Approved'} rows={3} value={currentProposal.targetMarket} onChange={e => setCurrentProposal({...currentProposal, targetMarket: e.target.value})} placeholder="Who is your customer? Demographics?" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#4285F4]/50 text-sm resize-none disabled:opacity-70"/>
                    </div>
                  </section>

                  {/* MISSION & VISION */}
                  <section>
                    <h3 className="text-sm font-bold text-[#122244] uppercase tracking-widest flex items-center gap-2 mb-4"><Star className="w-4 h-4 text-purple-500 fill-current"/> MISSION & VISION</h3>
                    <div className="space-y-6">
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Mission Statement</label>
                        <textarea disabled={currentProposal.status === 'Pending' || currentProposal.status === 'Approved'} rows={2} value={currentProposal.missionStatement} onChange={e => setCurrentProposal({...currentProposal, missionStatement: e.target.value})} placeholder="What is the purpose of your business?" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#4285F4]/50 text-sm resize-none disabled:opacity-70"/>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Vision Statement</label>
                        <textarea disabled={currentProposal.status === 'Pending' || currentProposal.status === 'Approved'} rows={2} value={currentProposal.visionStatement} onChange={e => setCurrentProposal({...currentProposal, visionStatement: e.target.value})} placeholder="Where do you see the business in 3-5 years?" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#4285F4]/50 text-sm resize-none disabled:opacity-70"/>
                      </div>
                    </div>
                  </section>

                  {/* PRODUCT & PRICING */}
                  <section>
                    <h3 className="text-sm font-bold text-[#122244] uppercase tracking-widest flex items-center gap-2 mb-4"><div className="w-4 h-4 bg-green-500 rounded text-white flex items-center justify-center font-bold text-[10px]">$</div> PRODUCT & PRICING</h3>
                    <div className="space-y-6">
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Product Description</label>
                        <textarea disabled={currentProposal.status === 'Pending' || currentProposal.status === 'Approved'} rows={3} value={currentProposal.productDescription} onChange={e => setCurrentProposal({...currentProposal, productDescription: e.target.value})} placeholder="Describe exactly what you are selling." className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#4285F4]/50 text-sm resize-none disabled:opacity-70"/>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Price Ranges</label>
                        <textarea disabled={currentProposal.status === 'Pending' || currentProposal.status === 'Approved'} rows={2} value={currentProposal.priceRanges} onChange={e => setCurrentProposal({...currentProposal, priceRanges: e.target.value})} placeholder="List price ranges for your offerings" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#4285F4]/50 text-sm resize-none disabled:opacity-70"/>
                      </div>
                    </div>
                  </section>

                   {/* PLACE & PROMOTION */}
                   <section>
                    <h3 className="text-sm font-bold text-[#122244] uppercase tracking-widest flex items-center gap-2 mb-4"><div className="w-4 h-4 bg-orange-400 rounded-full text-white flex items-center justify-center font-bold text-[10px]">📍</div> PLACE & PROMOTION</h3>
                    <div className="space-y-6">
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Proposed Location</label>
                        <input disabled={currentProposal.status === 'Pending' || currentProposal.status === 'Approved'} type="text" value={currentProposal.proposedLocation} onChange={e => setCurrentProposal({...currentProposal, proposedLocation: e.target.value})} placeholder="Where will you operate?" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#4285F4]/50 text-sm disabled:opacity-70"/>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Promotional Strategy</label>
                        <textarea disabled={currentProposal.status === 'Pending' || currentProposal.status === 'Approved'} rows={2} value={currentProposal.promotionalStrategy} onChange={e => setCurrentProposal({...currentProposal, promotionalStrategy: e.target.value})} placeholder="How will you attract customers?" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#4285F4]/50 text-sm resize-none disabled:opacity-70"/>
                      </div>
                    </div>
                  </section>

                   {/* ADDITIONAL DETAILS */}
                   <section>
                    <h3 className="text-sm font-bold text-[#122244] uppercase tracking-widest flex items-center gap-2 mb-4"><MoreVertical className="w-4 h-4 text-gray-400"/> ADDITIONAL DETAILS</h3>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Other Relevant Information (Optional)</label>
                      <textarea disabled={currentProposal.status === 'Pending' || currentProposal.status === 'Approved'} rows={3} value={currentProposal.otherDetails} onChange={e => setCurrentProposal({...currentProposal, otherDetails: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#4285F4]/50 text-sm resize-none disabled:opacity-70"/>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* VIEW: ACTIVE BUSINESS DASHBOARD            */}
          {/* ========================================== */}
          {activeView === 'active-business' && activeBusiness && (
            <div>
              <div className="flex justify-end mb-4">
                <button onClick={() => setActiveView('history')} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 font-bold text-sm rounded-lg hover:bg-gray-50 shadow-sm transition-all">
                  <Clock className="w-4 h-4"/> View Proposals History
                </button>
              </div>

              {/* Active Banner */}
              <div className="bg-[#122244] rounded-xl shadow-md overflow-hidden mb-6 flex flex-col md:flex-row items-center justify-between p-8 text-white relative">
                <div className="flex items-center gap-6 z-10 w-full md:w-auto">
                  <div className="w-24 h-24 bg-[#1a2f55] rounded-2xl flex items-center justify-center border border-white/10 shadow-inner flex-shrink-0">
                    <span className="text-3xl font-extrabold text-white tracking-widest">{getInitials(activeBusiness.businessName)}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest bg-green-500/20 text-green-400 px-2 py-1 rounded border border-green-500/30 flex items-center gap-1"><Check className="w-3 h-3"/> APPROVED BUSINESS PROPOSAL</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 text-gray-400"><User className="w-3 h-3"/> SECTION: {userGroup?.section}</span>
                    </div>
                    <h1 className="text-4xl font-extrabold mb-1 tracking-tight">{activeBusiness.businessName}</h1>
                    <p className="text-sm text-gray-300 font-medium">{activeBusiness.businessType}</p>
                    <p className="text-xs text-gray-400 mt-2 flex items-center gap-1"><User className="w-3 h-3"/> Adviser: Prof. {adviserData?.lastName || 'Santos'}</p>
                  </div>
                </div>
                {isLeader && (
                  <button onClick={() => setShowEditBasicModal(true)} className="mt-6 md:mt-0 flex items-center gap-2 px-5 py-2.5 border border-white/20 hover:bg-white/10 rounded-lg text-sm font-bold transition-all z-10">
                    <Pencil className="w-4 h-4" /> Edit Basic Info
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Active Overview */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
                    <div className="flex justify-between items-start mb-8">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-50 p-2.5 rounded-full border border-blue-100"><FileText className="w-6 h-6 text-blue-500" /></div>
                        <div>
                          <h3 className="text-xl font-extrabold text-[#122244]">Complete Project Overview</h3>
                          <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">Approved Business Charter</p>
                        </div>
                      </div>
                      {isLeader && <button className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-[#4285F4] font-bold text-sm rounded-lg hover:bg-blue-100"><Pencil className="w-4 h-4"/> Edit</button>}
                    </div>

                    <div className="bg-gray-50 rounded-xl p-6 mb-8 flex divide-x divide-gray-200">
                      <div className="flex-1 pr-6">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Total Capital</p>
                        <p className="text-2xl font-bold text-green-600">{activeBusiness.totalCapital || '₱0.00'}</p>
                      </div>
                      <div className="flex-1 pl-6">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Business Type</p>
                        <p className="text-xl font-bold text-[#122244]">{activeBusiness.businessType}</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Tagline</p>
                        <p className="text-gray-800 font-medium text-lg">{activeBusiness.tagline}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Mission Statement</p>
                        <p className="text-gray-600 text-sm leading-relaxed">{activeBusiness.missionStatement}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Vision Statement</p>
                        <p className="text-gray-600 text-sm leading-relaxed">{activeBusiness.visionStatement}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Target Market</p>
                        <p className="text-gray-600 text-sm leading-relaxed">{activeBusiness.targetMarket}</p>
                      </div>
                      <div className="h-px bg-gray-100 my-4"></div>
                      <div>
                        <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">Product Description</p>
                        <p className="text-gray-600 text-sm leading-relaxed">{activeBusiness.productDescription}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest mb-1">Specific Pricing</p>
                        <p className="text-gray-600 text-sm leading-relaxed">{activeBusiness.priceRanges}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-1">Location</p>
                        <p className="text-gray-600 text-sm leading-relaxed">{activeBusiness.proposedLocation}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-purple-500 uppercase tracking-widest mb-1">Promotional Strategy</p>
                        <p className="text-gray-600 text-sm leading-relaxed">{activeBusiness.promotionalStrategy}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Active Roster */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 h-fit">
                  <h3 className="text-sm font-extrabold text-[#122244] uppercase tracking-widest mb-1">Project Roster</h3>
                  <p className="text-xs text-gray-500 mb-6">{userGroup?.memberIds.length ? userGroup.memberIds.length + 1 : 1} Members Total</p>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
                      <div className="w-10 h-10 bg-[#122244] rounded-lg text-white flex items-center justify-center font-bold text-sm">
                        {adviserData ? getInitials(`${adviserData.firstName} ${adviserData.lastName}`) : 'AD'}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-[#122244] flex items-center gap-2">
                          {adviserData ? `Prof. ${adviserData.firstName} ${adviserData.lastName}` : 'Adviser Name'}
                          <span className="text-[8px] bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Adviser</span>
                        </p>
                        <p className="text-[10px] text-gray-500 uppercase">Faculty</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-xl transition-colors">
                      <div className="w-10 h-10 bg-purple-600 rounded-full text-white flex items-center justify-center font-bold text-sm">
                        {getInitials(userGroup?.leaderName || "")}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
                          {userGroup?.leaderName} 
                          <span className="text-[8px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Leader</span>
                        </p>
                        <p className="text-[10px] text-gray-500 uppercase">{leaderData?.studentId || "No ID"}</p>
                      </div>
                    </div>
                    {groupMembersData.map((member) => (
                      <div key={member.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-xl transition-colors">
                        <div className="w-10 h-10 bg-green-500 rounded-full text-white flex items-center justify-center font-bold text-sm">
                          {getInitials(`${member.firstName} ${member.lastName}`)}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-gray-900">{member.firstName} {member.lastName}</p>
                          <p className="text-[10px] text-gray-500 uppercase">{member.studentId || "No ID"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* VIEW: PROPOSALS HISTORY                    */}
          {/* ========================================== */}
          {activeView === 'history' && (
            <div>
              <div className="mb-8">
                <button onClick={() => setActiveView('active-business')} className="flex items-center gap-2 text-sm font-bold text-[#4285F4] hover:text-blue-700 mb-4">
                  <ChevronLeft className="w-4 h-4" /> Back to Active Business
                </button>
                <h1 className="text-3xl font-extrabold text-[#122244] mb-1">Proposals History</h1>
                <p className="text-sm text-gray-500">An archive of all past business concepts submitted by your group. These are strictly read-only.</p>
              </div>

              <div className="space-y-4">
                {proposals.map((proposal, idx) => {
                  let borderCol = "border-gray-200";
                  let badgeBg = "bg-gray-100"; let badgeText = "text-gray-600";
                  let isApproved = proposal.status === 'Approved';
                  let isPending = proposal.status === 'Pending';
                  let isRejected = proposal.status === 'Rejected';

                  if (isPending) { borderCol = "border-[#c9a654]"; badgeBg = "bg-yellow-100"; badgeText = "text-yellow-700"; }
                  if (isApproved) { borderCol = "border-green-400"; badgeBg = "bg-green-100"; badgeText = "text-green-700"; }
                  if (isRejected) { borderCol = "border-red-400"; badgeBg = "bg-red-100"; badgeText = "text-red-700"; }

                  return (
                    <div key={proposal.id} className={`bg-white rounded-xl border-2 p-5 flex justify-between items-center ${borderCol}`}>
                      <div className="flex gap-4 items-center">
                        <div className={`w-14 h-14 rounded-lg flex flex-shrink-0 items-center justify-center font-bold text-xl ${isApproved ? 'bg-green-50 text-green-600' : isPending ? 'bg-yellow-50 text-yellow-600' : isRejected ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                          B#
                        </div>
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-extrabold text-[#122244] text-lg">{proposal.businessName || `Business Proposal #${idx + 1}`}</h3>
                            <span className={`px-2.5 py-0.5 ${badgeBg} ${badgeText} text-[10px] font-bold rounded-full uppercase tracking-wider flex items-center gap-1`}>
                              {isApproved && <CheckCircle2 className="w-3 h-3"/>}
                              {isRejected && <X className="w-3 h-3"/>}
                              {proposal.status}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">
                            {proposal.businessName ? `${proposal.businessName} • ${proposal.businessType || 'No Category'}` : '- - -'}
                          </p>
                          <p className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3"/> {proposal.createdAt ? new Date(proposal.createdAt.toDate()).toLocaleString() : 'Just now'}
                          </p>
                        </div>
                      </div>
                      <button onClick={() => { setCurrentProposal(proposal); setActiveView('form'); }} className="px-5 py-2.5 bg-gray-50 border border-gray-200 text-gray-700 font-bold text-sm rounded-lg hover:bg-gray-100 transition-colors">
                        View Data
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ========================================== */}
      {/* MODALS                                     */}
      {/* ========================================== */}

      {/* LEADER TEAM SETUP MODAL */}
      {showSetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-start text-center relative">
              <div className="w-full">
                <h2 className="text-2xl font-extrabold text-[#122244]">Set Up Your Team</h2>
                <p className="text-sm text-gray-500 mt-1">Search and recruit unassigned students from your section to build your workspace.</p>
              </div>
              <button onClick={() => setShowSetupModal(false)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 flex flex-col sm:flex-row gap-8 min-h-[300px]">
              {/* Left: Current Team */}
              <div className="flex-1 sm:pr-6 sm:border-r border-gray-100">
                <h3 className="text-lg font-bold text-[#122244]">Current Team</h3>
                <p className="text-xs text-gray-500 mb-4">You have <span className="font-bold text-gray-900">{userGroup?.memberIds.length ? userGroup.memberIds.length + 1 : 1}</span> out of 10 members.</p>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-2 rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-600 rounded-full text-white flex items-center justify-center font-bold text-sm">{getInitials(userGroup?.leaderName || "")}</div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{userGroup?.leaderName}</p>
                        <p className="text-[10px] text-gray-500 uppercase">{leaderData?.studentId || "No ID"}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-2 py-1 rounded uppercase tracking-wider">Leader</span>
                  </div>
                  {groupMembersData.map((member) => (
                    <div key={member.id} className="flex justify-between items-center p-2 rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-500 rounded-full text-white flex items-center justify-center font-bold text-sm">{getInitials(`${member.firstName} ${member.lastName}`)}</div>
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{member.firstName} {member.lastName}</p>
                          <p className="text-[10px] text-gray-500 uppercase">{member.studentId || "No ID"}</p>
                        </div>
                      </div>
                      <button className="text-[10px] font-bold text-red-500 hover:underline uppercase tracking-wider">Remove</button>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Right: Add Members */}
              <div className="flex-1">
                <h3 className="text-lg font-bold text-[#122244]">Add Members</h3>
                <p className="text-xs text-gray-500 mb-4">Search and recruit unassigned students.</p>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="Search by name or ID..." className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#c9a654]/50" />
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 text-center mt-8">
                  <p className="text-sm font-bold text-blue-800">Your team is ready.</p>
                  <p className="text-xs text-blue-600 mt-1">You can manage members later if needed.</p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex justify-end bg-gray-50/50 rounded-b-2xl">
              <button onClick={handleFinishTeamSetup} className="px-8 py-3 text-sm font-bold text-white bg-[#c9a654] hover:bg-[#b59545] rounded-lg shadow-md transition-colors">Finish Setup</button>
            </div>
          </div>
        </div>
      )}

      {/* ROSTER MODAL (DASHBOARD) */}
      {showRosterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-extrabold text-[#122244]">Group {userGroup?.id.slice(-1) || '1'} Roster</h2>
                <p className="text-sm text-gray-500 mt-1">{userGroup?.memberIds.length ? userGroup.memberIds.length + 1 : 1} Members Total</p>
              </div>
              <button onClick={() => setShowRosterModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="flex items-center gap-4 p-3 border border-gray-100 rounded-xl shadow-sm">
                <div className="w-12 h-12 bg-purple-600 rounded-full text-white flex items-center justify-center font-bold text-lg">{getInitials(userGroup?.leaderName || "")}</div>
                <div>
                  <p className="font-bold text-gray-900 flex items-center gap-2">{userGroup?.leaderName} <span className="text-[8px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Leader</span></p>
                  <p className="text-xs text-gray-500">{leaderData?.studentId || "No ID"}</p>
                </div>
              </div>
              {groupMembersData.map((member) => (
                <div key={member.id} className="flex items-center gap-4 p-3 border border-gray-100 rounded-xl shadow-sm">
                  <div className="w-12 h-12 bg-green-500 rounded-full text-white flex items-center justify-center font-bold text-lg">{getInitials(`${member.firstName} ${member.lastName}`)}</div>
                  <div>
                    <p className="font-bold text-gray-900">{member.firstName} {member.lastName}</p>
                    <p className="text-xs text-gray-500">{member.studentId || "No ID"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* LOCK IN BUSINESS MODAL */}
      {showLockInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 text-center p-8">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6"><Zap className="w-8 h-8 text-blue-500" /></div>
            <h2 className="text-2xl font-extrabold text-[#122244] mb-2">Set as Active Business?</h2>
            <p className="text-sm text-gray-500 mb-8">Proceeding will lock in this proposal as your official active business. You will be transitioned to your business profile to begin financial data setup.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setShowLockInModal(false)} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleLockInBusiness} className="px-5 py-2.5 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-md transition-colors flex items-center gap-2">Proceed to Business Profile <ChevronRight className="w-4 h-4"/></button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT BASIC INFO MODAL (ACTIVE BUSINESS) */}
      {showEditBasicModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-extrabold text-[#122244]">Edit Business Profile</h2>
                <p className="text-sm text-gray-500 mt-1">Update the core details and branding of your feasibility study.</p>
              </div>
              <button onClick={() => setShowEditBasicModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Business Logo</label>
                <div className="flex items-center gap-4 p-3 border border-gray-200 rounded-lg bg-gray-50 border-dashed">
                   <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-blue-600 font-bold text-sm rounded-md shadow-sm"><FileImage className="w-4 h-4"/> Choose File</button>
                   <span className="text-sm text-gray-400">No file chosen</span>
                </div>
                <p className="text-xs text-gray-400 mt-2">Upload a square image (PNG, JPG, Max 2MB)</p>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Company Name</label>
                <input type="text" defaultValue={userGroup?.companyName || activeBusiness?.businessType} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#4285F4]/50 text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Business Name</label>
                <input type="text" defaultValue={activeBusiness?.businessName} className="w-full px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg outline-none font-bold text-[#122244] text-sm" />
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 rounded-b-2xl">
              <button onClick={() => setShowEditBasicModal(false)} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors">Cancel</button>
              <button onClick={() => setShowEditBasicModal(false)} className="px-5 py-2.5 text-sm font-bold text-white bg-[#c9a654] hover:bg-[#b59545] rounded-lg shadow-md transition-colors">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl text-center">
            <h3 className="text-lg font-bold text-[#122244] mb-2">Confirm Logout</h3>
            <p className="text-sm text-gray-500 mb-6">Are you sure you want to log out of your account?</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setShowLogoutConfirm(false)} className="px-5 py-2 text-sm font-bold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleLogout} className="px-5 py-2 text-sm font-bold bg-red-600 text-white rounded-lg hover:bg-red-700">Logout</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;