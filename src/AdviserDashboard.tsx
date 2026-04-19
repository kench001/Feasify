import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db, signOutUser } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where, addDoc, doc, getDoc, serverTimestamp, writeBatch, updateDoc, deleteDoc } from "firebase/firestore";
import {
  User, Settings, ShieldAlert, Sidebar as SidebarIcon, Search, Users, Archive, 
  CheckCircle2, AlertCircle, X, Star, FlaskConical, RefreshCw, Lock, TrendingUp,
  MoreVertical, Trash2, Edit2, FileText, ChevronLeft, Clock, Loader2
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
  status?: 'Drafting' | 'Pending Review' | 'Approved Proposal' | 'Active Business';
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

const AdviserDashboard: React.FC = () => {
  const navigate = useNavigate();
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
  const [activeView, setActiveView] = useState<'dashboard' | 'group-details'>('dashboard');
  const [activeDashboardTab, setActiveDashboardTab] = useState<'All Groups' | 'Pending Review' | 'Approved Proposal' | 'Drafting'>('All Groups');
  const [activeDetailTab, setActiveDetailTab] = useState<'Proposals' | 'Members'>('Proposals');
  const [selectedGroup, setSelectedGroup] = useState<GroupData | null>(null);

  // Modals & Popovers
  const [minMembers, setMinMembers] = useState(8);
  const [maxMembers, setMaxMembers] = useState(10);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAllStudentsModal, setShowAllStudentsModal] = useState(false);
  const [showAssignLeaderModal, setShowAssignLeaderModal] = useState(false);
  const [showAutoGroupConfirm, setShowAutoGroupConfirm] = useState(false);
  const [showReshuffleConfirm, setShowReshuffleConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<GroupData | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null); 
  
  // Change Leader State
  const [showChangeLeaderModal, setShowChangeLeaderModal] = useState(false);
  const [groupToChangeLeader, setGroupToChangeLeader] = useState<GroupData | null>(null);
  const [newLeaderId, setNewLeaderId] = useState<string>("");

  // Review Proposal State
  const [viewingProposal, setViewingProposal] = useState<ProposalData | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLeaderIds, setSelectedLeaderIds] = useState<string[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { navigate("/"); return; }
      try {
        const userDoc = await getDoc(doc(db, "users", u.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.role !== "Adviser" && u.email !== "chairperson@gmail.com") {
            navigate("/dashboard"); return;
          }
          setUserName(`${data.firstName} ${data.lastName}`);
          const rawSection = data.section || "Unassigned";
          const parsedSections = rawSection.split(",").map((s: string) => s.trim()).filter(Boolean);
          setAdviserSections(parsedSections);
          setActiveSection(parsedSections[0]); 
          fetchSectionData(parsedSections[0]);
        }
      } catch (error) { console.error(error); }
    });
    return () => unsub();
  }, [navigate]);

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
      setGroups(groupSnap.docs.map(d => ({ id: d.id, ...d.data(), status: d.data().status || 'Drafting' } as GroupData)));
    } catch (error) { console.error("Error fetching data:", error); } 
    finally { setIsLoading(false); }
  };

  const fetchGroupProposals = async (groupId: string) => {
    try {
      const q = query(collection(db, "proposals"), where("groupId", "==", groupId));
      const snap = await getDocs(q);
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() } as ProposalData));
      
      // Sort newest first
      fetched.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setGroupProposals(fetched);
    } catch (error) {
      console.error("Error fetching proposals:", error);
    }
  };

  const handleLogout = async () => {
    try { await signOutUser(); localStorage.clear(); sessionStorage.clear(); } catch (e) {}
    navigate("/");
  };

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  // --- LOGIC: ASSIGN LEADER & AUTO GROUP ---
  const assignLeader = async () => {
    if (!selectedLeaderIds.length || !activeSection) return;
    try {
      const createdGroups: GroupData[] = [];
      for (const leaderId of selectedLeaderIds) {
        const leader = students.find(s => s.id === leaderId);
        if (!leader) continue;
        const docRef = await addDoc(collection(db, "groups"), {
          section: activeSection, leaderId: leader.id, leaderName: `${leader.firstName} ${leader.lastName}`,
          title: "Pending Business Name", memberIds: [], status: 'Drafting', createdAt: serverTimestamp()
        });
        createdGroups.push({ id: docRef.id, leaderId: leader.id, leaderName: `${leader.firstName} ${leader.lastName}`, title: "Pending Business Name", memberIds: [], status: 'Drafting' });
      }
      if (createdGroups.length) setGroups(prev => [...prev, ...createdGroups]);
      setShowAssignLeaderModal(false); setSelectedLeaderIds([]);
    } catch (error) { console.error(error); alert("Failed to create group."); }
  };

  const executeAutoGroup = async (currentGroupsList: GroupData[]) => {
    setIsLoading(true);
    try {
      const assignedIds = new Set<string>();
      currentGroupsList.forEach(g => { assignedIds.add(g.leaderId); g.memberIds.forEach(id => assignedIds.add(id)); });
      const unassignedStudents = students.filter(s => !assignedIds.has(s.id));
      if (unassignedStudents.length === 0) { alert("All students are already assigned!"); setIsLoading(false); return; }

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
        updatedGroups.push({ id: newGroupRef.id, leaderId: leader.id, leaderName: `${leader.firstName} ${leader.lastName}`, title: "Pending Business Name", memberIds: members, status: 'Drafting' });
      }
      await batch.commit(); setGroups(updatedGroups); setShowAutoGroupConfirm(false);
    } catch (error) { console.error(error); alert("Failed to auto-group."); } 
    finally { setIsLoading(false); }
  };

  const handleReshuffle = async () => {
    setIsLoading(true);
    try {
      const batch = writeBatch(db);
      groups.forEach(g => batch.delete(doc(db, "groups", g.id)));
      await batch.commit();
      setGroups([]); setShowReshuffleConfirm(false);
      await executeAutoGroup([]);
    } catch (error) { console.error(error); alert("Failed to reshuffle."); setIsLoading(false); }
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

  const handleOpenGroupDetails = (group: GroupData) => {
    setSelectedGroup(group);
    setActiveView('group-details');
    setActiveDetailTab('Proposals');
    fetchGroupProposals(group.id); 
  };

  // --- LOGIC: APPROVE OR REJECT PROPOSAL ---
  const handleProposalAction = async (proposal: ProposalData, action: 'Approve' | 'Reject') => {
    if (!selectedGroup || !proposal.id) return;
    try {
      const newStatus = action === 'Approve' ? 'Approved' : 'Rejected';
      
      // 1. Update the specific proposal in DB
      await updateDoc(doc(db, "proposals", proposal.id), { 
        status: newStatus, 
        updatedAt: serverTimestamp() 
      });

      // 2. Determine what happens to the Group's status
      let newGroupStatus = selectedGroup.status;
      
      if (action === 'Approve') {
        newGroupStatus = 'Approved Proposal';
      } else if (action === 'Reject') {
        const otherPending = groupProposals.filter(p => p.id !== proposal.id && p.status === 'Pending');
        if (otherPending.length === 0) {
          if (selectedGroup.status !== 'Approved Proposal' && selectedGroup.status !== 'Active Business') {
            newGroupStatus = 'Drafting';
          }
        }
      }

      // 3. Update Group in DB if status changed
      if (newGroupStatus !== selectedGroup.status) {
        await updateDoc(doc(db, "groups", selectedGroup.id), { status: newGroupStatus });
        
        setGroups(prev => prev.map(g => g.id === selectedGroup.id ? { ...g, status: newGroupStatus } : g));
        setSelectedGroup(prev => prev ? { ...prev, status: newGroupStatus } : null);
      }

      // 4. Refresh local proposals list and close modal
      await fetchGroupProposals(selectedGroup.id);
      setViewingProposal(null);

    } catch (error) {
      console.error("Action failed:", error);
      alert("Failed to update proposal status.");
    }
  };

  // Metrics Calculations
  const assignedIds = new Set<string>();
  groups.forEach(g => { assignedIds.add(g.leaderId); g.memberIds.forEach(id => assignedIds.add(id)); });
  const unassignedCount = students.length - assignedIds.size;
  const filteredStudents = students.filter(s => `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) || s.studentId.includes(searchTerm));
  
  const filteredGroups = activeDashboardTab === 'All Groups' ? groups : groups.filter(g => g.status === activeDashboardTab);

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
              <button className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#c9a654] text-white transition-all shadow-md">My Sections</button>
              <div className="pl-4 pr-2 py-2 space-y-2">
                {adviserSections.map((sectionName) => (
                  <button key={sectionName} onClick={() => { setActiveSection(sectionName); fetchSectionData(sectionName); }}
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
              <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-all"><User className="w-4 h-4" /> Profile</button>
              <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-all"><Settings className="w-4 h-4" /> Settings</button>
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
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className={`flex-1 transition-all duration-300 ease-in-out min-h-screen ${isSidebarOpen ? 'lg:ml-64' : 'ml-0'}`}>
        <div className="bg-white border-b border-gray-100 p-4 flex items-center gap-2 text-sm text-gray-500">
          <SidebarIcon className="w-4 h-4 cursor-pointer hover:text-gray-800 transition-colors" onClick={() => setIsSidebarOpen(!isSidebarOpen)} />
          <span className="mx-2">|</span>
          <span className="font-semibold text-gray-900 hover:text-gray-600 cursor-pointer" onClick={() => setActiveView('dashboard')}>FeasiFy</span>
          {activeView === 'group-details' && selectedGroup && (
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
          <div className="p-6 md:p-8 max-w-7xl mx-auto">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 pb-6">
              <div>
                <h1 className="text-3xl font-extrabold text-[#122244]">{activeSection}</h1>
                <p className="text-sm text-gray-500 mt-1 italic">Manage feasibility groups and team leaders for this section.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setShowAllStudentsModal(true)} className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 font-semibold text-sm rounded-lg hover:bg-gray-50 transition-colors bg-white shadow-sm"><Users className="w-4 h-4" /> View All Students</button>
                <button onClick={() => { setShowAssignLeaderModal(true); setSelectedLeaderIds([]); }} className="flex items-center gap-2 px-4 py-2 bg-[#d4af37] text-white font-semibold text-sm rounded-lg hover:bg-[#c19b28] transition-colors shadow-md"><Star className="w-4 h-4" /> Assign Leader</button>
                <button onClick={() => setShowSettingsModal(true)} className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 font-semibold text-sm rounded-lg bg-white hover:bg-gray-50 transition-colors shadow-sm"><Settings className="w-4 h-4" /> Group Settings</button>
                <button onClick={() => setShowAutoGroupConfirm(true)} className="flex items-center gap-2 px-4 py-2 bg-[#122244] text-white font-semibold text-sm rounded-lg hover:bg-[#0a142e] transition-colors shadow-md"><Archive className="w-4 h-4" /> Auto-Group</button>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
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
            </div>

            {/* Tabs & Reshuffle Row */}
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 border-b border-gray-200 pb-2">
              <div className="flex space-x-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
                {['All Groups', 'Pending Review', 'Approved Proposal', 'Drafting'].map(tab => (
                  <button key={tab} onClick={() => setActiveDashboardTab(tab as any)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${activeDashboardTab === tab ? 'bg-white text-[#122244] shadow-sm border border-gray-200' : 'bg-transparent text-gray-500 hover:text-gray-800'}`}>
                    {tab}
                  </button>
                ))}
              </div>
              {groups.length > 0 && (
                <button onClick={() => setShowReshuffleConfirm(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 font-semibold text-sm rounded-lg hover:bg-gray-50 transition-colors shadow-sm whitespace-nowrap">
                  <RefreshCw className="w-4 h-4" /> Reshuffle
                </button>
              )}
            </div>

            {/* Groups Grid */}
            {isLoading ? (
              <div className="text-center py-12 text-gray-400 flex flex-col items-center"><Loader2 className="w-8 h-8 animate-spin mb-4"/>Loading section data...</div>
            ) : filteredGroups.length === 0 ? (
              <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 py-16 flex flex-col items-center justify-center text-center">
                <Users className="w-12 h-12 text-gray-300 mb-3" />
                <h3 className="text-lg font-bold text-gray-900">No Groups Found</h3>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredGroups.map((group, index) => {
                  const totalMembers = group.memberIds.length + 1; 
                  const originalIndex = groups.findIndex(g => g.id === group.id) + 1; 
                  
                  let statusBadgeColor = "bg-gray-100 text-gray-600"; let statusDotColor = "bg-gray-400";
                  if (group.status === 'Pending Review') { statusBadgeColor = "bg-yellow-100 text-yellow-700"; statusDotColor = "bg-yellow-500"; }
                  if (group.status === 'Approved Proposal' || group.status === 'Active Business') { statusBadgeColor = "bg-green-100 text-green-700"; statusDotColor = "bg-green-500"; }

                  return (
                    <div key={group.id} className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col relative h-[450px]">
                      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-xl">
                        <h3 className="font-bold text-[#122244] text-base">Group {originalIndex}</h3>
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-blue-100 text-[#4285F4] text-xs font-bold rounded-full">{totalMembers}/{maxMembers}</span>
                          
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
                            {group.status === 'Pending Review' ? '1 Proposal for Review' : group.status === 'Active Business' ? 'Approved Proposal' : group.status}
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
                          <button onClick={() => handleOpenGroupDetails(group)} className="w-full py-2.5 bg-[#122244] text-white font-bold text-sm rounded-lg hover:bg-[#0a142e] transition-colors shadow-md flex justify-center items-center gap-2"><FileText className="w-4 h-4"/> Review Proposals</button>
                        )}
                        {(group.status === 'Approved Proposal' || group.status === 'Active Business') && (
                          <button onClick={() => handleOpenGroupDetails(group)} className="w-full py-2.5 bg-white border border-[#d4af37] text-[#d4af37] font-bold text-sm rounded-lg hover:bg-yellow-50 transition-colors shadow-sm flex justify-center items-center gap-2"><TrendingUp className="w-4 h-4"/> View Financial Study</button>
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
          <div className="p-6 md:p-8 max-w-5xl mx-auto">
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
                {/* Filter out strictly local "Drafts" so adviser only sees submitted things */}
                {groupProposals.filter(p => p.status !== 'Draft').length === 0 ? (
                  <div className="py-20 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4 border border-gray-100"><FileText className="w-8 h-8 text-gray-300" /></div>
                    <h3 className="text-lg font-bold text-[#122244]">No proposals yet</h3>
                    <p className="text-sm text-gray-500 mt-1 max-w-sm">The group is still drafting their business proposals. Check back later.</p>
                  </div>
                ) : (
                  <>
                    {/* Show Green Banner if a proposal is approved */}
                    {(selectedGroup.status === 'Approved Proposal' || selectedGroup.status === 'Active Business') && (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3 mb-6">
                        <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                        <div>
                          <h4 className="font-bold text-green-800 text-sm">Proposal Approved: {selectedGroup.title}</h4>
                          <p className="text-sm text-green-700 mt-0.5">This group can now proceed to financial planning.</p>
                        </div>
                      </div>
                    )}

                    {groupProposals.filter(p => p.status !== 'Draft').map((proposal, idx) => {
                      const isApproved = proposal.status === 'Approved';
                      const isRejected = proposal.status === 'Rejected';
                      const isPending = proposal.status === 'Pending';

                      return (
                        <div key={proposal.id} className={`bg-white rounded-xl border-2 p-5 flex justify-between items-center ${isApproved ? 'border-green-400' : isRejected ? 'border-gray-200 opacity-60' : 'border-[#d4af37]'}`}>
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-bold text-[#122244] text-lg">{proposal.businessName || `Business Proposal #${idx + 1}`}</h3>
                              {isPending && <span className="px-2.5 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] font-bold rounded-full uppercase tracking-wider">Pending</span>}
                              {isApproved && <span className="px-2.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full uppercase tracking-wider flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Approved</span>}
                              {isRejected && <span className="px-2.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full uppercase tracking-wider flex items-center gap-1"><X className="w-3 h-3"/> Rejected</span>}
                            </div>
                            <p className="text-sm text-gray-500 mb-1">{proposal.businessName} • {proposal.businessType}</p>
                            <p className="text-xs text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3"/> Submitted: {proposal.createdAt ? new Date(proposal.createdAt.toDate()).toLocaleString() : 'Recently'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setViewingProposal(proposal)} className="px-5 py-2 bg-blue-50 text-[#4285F4] font-bold text-sm rounded-lg hover:bg-blue-100 transition-colors">Open</button>
                            <button className="p-2 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-lg"><MoreVertical className="w-4 h-4"/></button>
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}
              </div>
            )}

            {/* Content: MEMBERS TAB (Kept exact same) */}
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
      </main>

      {/* ========================================================= */}
      {/* MODALS                                                    */}
      {/* ========================================================= */}

      {/* MODAL: View Proposal (Adviser Review) */}
      {viewingProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-extrabold text-[#122244]">{viewingProposal.businessName || 'Business Proposal'}</h2>
                <p className="text-sm text-gray-500 mt-1">Submitted: {viewingProposal.createdAt ? new Date(viewingProposal.createdAt.toDate()).toLocaleString() : 'Recently'}</p>
              </div>
              <button onClick={() => setViewingProposal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-gray-50/50 custom-scrollbar">
              
              <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-sm font-bold text-[#122244] uppercase tracking-widest flex items-center gap-2 mb-4"><FileText className="w-4 h-4 text-blue-500"/> BUSINESS OVERVIEW</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Business Type</p><p className="font-medium text-gray-900">{viewingProposal.businessType}</p></div>
                  <div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Business Name</p><p className="font-medium text-gray-900">{viewingProposal.businessName}</p></div>
                  <div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Capital</p><p className="font-bold text-green-600">{viewingProposal.totalCapital}</p></div>
                  <div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Tagline</p><p className="font-medium text-gray-900">{viewingProposal.tagline}</p></div>
                  <div className="col-span-2"><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Target Market</p><p className="text-sm text-gray-700 leading-relaxed">{viewingProposal.targetMarket}</p></div>
                </div>
              </section>

              <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-sm font-bold text-[#122244] uppercase tracking-widest flex items-center gap-2 mb-4"><Star className="w-4 h-4 text-purple-500 fill-current"/> MISSION & VISION</h3>
                <div className="space-y-4">
                  <div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Mission Statement</p><p className="text-sm text-gray-700 leading-relaxed">{viewingProposal.missionStatement}</p></div>
                  <div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Vision Statement</p><p className="text-sm text-gray-700 leading-relaxed">{viewingProposal.visionStatement}</p></div>
                </div>
              </section>

              <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-sm font-bold text-[#122244] uppercase tracking-widest flex items-center gap-2 mb-4"><div className="w-4 h-4 bg-green-500 rounded text-white flex items-center justify-center font-bold text-[10px]">$</div> PRODUCT & PRICING</h3>
                <div className="space-y-4">
                  <div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Product Description</p><p className="text-sm text-gray-700 leading-relaxed">{viewingProposal.productDescription}</p></div>
                  <div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Price Ranges</p><p className="text-sm text-gray-700 leading-relaxed">{viewingProposal.priceRanges}</p></div>
                </div>
              </section>

              <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-sm font-bold text-[#122244] uppercase tracking-widest flex items-center gap-2 mb-4"><div className="w-4 h-4 bg-orange-400 rounded-full text-white flex items-center justify-center font-bold text-[10px]">📍</div> PLACE & PROMOTION</h3>
                <div className="space-y-4">
                  <div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Proposed Location</p><p className="text-sm text-gray-700 leading-relaxed">{viewingProposal.proposedLocation}</p></div>
                  <div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Promotional Strategy</p><p className="text-sm text-gray-700 leading-relaxed">{viewingProposal.promotionalStrategy}</p></div>
                </div>
              </section>
            </div>

            {viewingProposal.status === 'Pending' && (
              <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-white rounded-b-2xl">
                <button onClick={() => handleProposalAction(viewingProposal, 'Reject')} className="px-6 py-3 bg-red-600 text-white font-bold rounded-lg shadow-md hover:bg-red-700 transition-colors">Reject</button>
                <button onClick={() => handleProposalAction(viewingProposal, 'Approve')} className="px-6 py-3 bg-green-600 text-white font-bold rounded-lg shadow-md hover:bg-green-700 transition-colors">Approve Proposal</button>
              </div>
            )}
            {viewingProposal.status !== 'Pending' && (
              <div className="p-4 border-t border-gray-100 flex justify-end bg-white rounded-b-2xl">
                 <button onClick={() => setViewingProposal(null)} className="px-6 py-3 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition-colors">Close</button>
              </div>
            )}
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
              <button onClick={() => setShowAutoGroupConfirm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6">
              <p className="text-gray-600 text-sm leading-relaxed">
                This will automatically shuffle and distribute all <strong>unassigned students</strong> into balanced groups based on your current settings (<strong>{minMembers} to {maxMembers}</strong> members per group). Are you sure you want to proceed?
              </p>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 rounded-b-2xl">
              <button onClick={() => setShowAutoGroupConfirm(false)} className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-lg shadow-sm hover:bg-gray-50">Cancel</button>
              <button onClick={() => executeAutoGroup(groups)} className="px-5 py-2.5 bg-[#122244] text-white font-semibold rounded-lg shadow-md hover:bg-[#1a3263]">Yes, Generate Groups</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Reshuffle Confirmation */}
      {showReshuffleConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="bg-red-50 p-2 rounded-full">
                  <RefreshCw className="w-6 h-6 text-red-500" />
                </div>
                <h2 className="text-xl font-bold text-[#122244]">Reshuffle All Groups?</h2>
              </div>
              <button onClick={() => setShowReshuffleConfirm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6">
              <p className="text-gray-600 text-sm leading-relaxed">
                Are you sure you want to reshuffle? This will <strong>clear all current group assignments</strong> and randomly recreate them from scratch.
              </p>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 rounded-b-2xl">
              <button onClick={() => setShowReshuffleConfirm(false)} className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-lg shadow-sm hover:bg-gray-50">Cancel</button>
              <button onClick={handleReshuffle} className="px-5 py-2.5 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700">Yes, Reshuffle</button>
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
              <button onClick={() => setShowAllStudentsModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
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

      {/* MODAL: Group Settings */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-[#122244]">Group Settings</h2>
                <p className="text-sm text-gray-500 mt-1 leading-snug">Set the required member limits for feasibility groups in this section.</p>
              </div>
              <button onClick={() => setShowSettingsModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 flex gap-4">
              <div className="flex-1">
                <label className="text-sm font-bold text-gray-700 block mb-2">Min. Members</label>
                <input type="number" value={minMembers} onChange={e=>setMinMembers(Number(e.target.value))} className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#122244]" />
              </div>
              <div className="flex-1">
                <label className="text-sm font-bold text-gray-700 block mb-2">Max. Members</label>
                <input type="number" value={maxMembers} onChange={e=>setMaxMembers(Number(e.target.value))} className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#122244]" />
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 rounded-b-2xl">
              <button onClick={() => setShowSettingsModal(false)} className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-lg shadow-sm hover:bg-gray-50">Cancel</button>
              <button onClick={() => setShowSettingsModal(false)} className="px-5 py-2.5 bg-[#122244] text-white font-semibold rounded-lg shadow-md hover:bg-[#1a3263]">Save Settings</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Assign Leader */}
      {showAssignLeaderModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-[#122244]">Assign Team Leader</h2>
                <p className="text-sm text-gray-500 mt-1">Select a student from the list below to assign as a team leader.</p>
              </div>
              <button onClick={() => {setShowAssignLeaderModal(false); setSelectedLeaderIds([]);}} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
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
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {filteredStudents.filter(s => !groups.some(g => g.leaderId === s.id || g.memberIds.includes(s.id))).map(student => {
                const isSelected = selectedLeaderIds.includes(student.id);
                return (
                  <label key={student.id} onClick={() => {
                    setSelectedLeaderIds(prev => prev.includes(student.id) ? prev.filter(id => id !== student.id) : [...prev, student.id]);
                  }} className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-colors ${isSelected ? 'border-[#c9a654] bg-yellow-50/30' : 'border-gray-100 hover:bg-gray-50'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm">
                        {getInitials(`${student.firstName} ${student.lastName}`)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{`${student.firstName} ${student.lastName}`}</p>
                        <p className="text-xs text-gray-500">{student.studentId}</p>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-[#c9a654]' : 'border-gray-300'}`}>
                      {isSelected && <div className="w-2.5 h-2.5 bg-[#c9a654] rounded-full"></div>}
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 rounded-b-2xl">
              <button onClick={() => {setShowAssignLeaderModal(false); setSelectedLeaderIds([]);}} className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-lg shadow-sm hover:bg-gray-50">Cancel</button>
              <button onClick={assignLeader} disabled={!selectedLeaderIds.length} className="px-5 py-2.5 bg-[#c9a654] text-white font-semibold rounded-lg shadow-md hover:bg-[#b59545] disabled:opacity-50">Assign as Leader</button>
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
              <button onClick={() => { setShowChangeLeaderModal(false); setGroupToChangeLeader(null); setNewLeaderId(""); }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
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
              <button onClick={() => { setShowDeleteConfirm(false); setGroupToDelete(null); }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
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