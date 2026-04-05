import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db, signOutUser } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where, addDoc, doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import {
  User,
  Settings,
  ShieldAlert,
  Sidebar as SidebarIcon,
  Search,
  Users,
  Archive,
  CheckCircle2,
  AlertCircle,
  X,
  Star,
  FlaskConical,
  RefreshCw,
  Lock,
  TrendingUp
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
  const [isLoading, setIsLoading] = useState(true);

  // Settings & Modals
  const [minMembers, setMinMembers] = useState(8);
  const [maxMembers, setMaxMembers] = useState(10);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAllStudentsModal, setShowAllStudentsModal] = useState(false);
  const [showAssignLeaderModal, setShowAssignLeaderModal] = useState(false);
  const [showAutoGroupConfirm, setShowAutoGroupConfirm] = useState(false);
  const [showReshuffleConfirm, setShowReshuffleConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<GroupData | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<GroupData | null>(null);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLeaderIds, setSelectedLeaderIds] = useState<string[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        navigate("/");
        return;
      }
      try {
        const userDoc = await getDoc(doc(db, "users", u.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.role !== "Adviser" && u.email !== "chairperson@gmail.com") {
            navigate("/dashboard"); 
            return;
          }
          setUserName(`${data.firstName} ${data.lastName}`);
          
          // Parse the sections assigned to this adviser (handles comma-separated lists)
          const rawSection = data.section || "Unassigned";
          const parsedSections = rawSection.split(",").map((s: string) => s.trim()).filter(Boolean);
          
          setAdviserSections(parsedSections);
          setActiveSection(parsedSections[0]); 
          fetchSectionData(parsedSections[0]);
        }
      } catch (error) {
        console.error(error);
      }
    });
    return () => unsub();
  }, [navigate]);

  const fetchSectionData = async (section: string) => {
    if (!section || section === "Unassigned") {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setSearchTerm(""); // Reset search when switching sections
    try {
      const studentQ = query(collection(db, "users"), where("role", "==", "Student"), where("section", "==", section));
      const studentSnap = await getDocs(studentQ);
      const studentList = studentSnap.docs.map(d => ({ id: d.id, ...d.data() } as StudentData));
      setStudents(studentList);

      const groupQ = query(collection(db, "groups"), where("section", "==", section));
      const groupSnap = await getDocs(groupQ);
      const groupList = groupSnap.docs.map(d => ({ id: d.id, ...d.data() } as GroupData));
      setGroups(groupList);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try { await signOutUser(); localStorage.clear(); sessionStorage.clear(); } catch (e) {}
    navigate("/");
  };

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  // --- LOGIC: ASSIGN LEADER ---
  const assignLeader = async () => {
    if (!selectedLeaderIds.length || !activeSection) return;

    try {
      const createdGroups: GroupData[] = [];

      for (const leaderId of selectedLeaderIds) {
        const leader = students.find(s => s.id === leaderId);
        if (!leader) continue;

        const docRef = await addDoc(collection(db, "groups"), {
          section: activeSection,
          leaderId: leader.id,
          leaderName: `${leader.firstName} ${leader.lastName}`,
          title: "Pending Title...",
          memberIds: [],
          createdAt: serverTimestamp()
        });

        createdGroups.push({
          id: docRef.id,
          leaderId: leader.id,
          leaderName: `${leader.firstName} ${leader.lastName}`,
          title: "Pending Title...",
          memberIds: []
        });
      }

      if (createdGroups.length) {
        setGroups(prev => [...prev, ...createdGroups]);
      }

      setShowAssignLeaderModal(false);
      setSelectedLeaderIds([]);
    } catch (error) {
      console.error("Error assigning leaders:", error);
      alert("Failed to create group(s).");
    }
  };

  // --- LOGIC: AUTO-GROUP ALGORITHM ---
  const executeAutoGroup = async (currentGroupsList: GroupData[]) => {
    setIsLoading(true);
    try {
      const assignedIds = new Set<string>();
      currentGroupsList.forEach(g => {
        assignedIds.add(g.leaderId);
        g.memberIds.forEach(id => assignedIds.add(id));
      });

      const unassignedStudents = students.filter(s => !assignedIds.has(s.id));
      
      if (unassignedStudents.length === 0) {
        alert("All students are already assigned to a group!");
        setIsLoading(false);
        return;
      }

      const shuffled = [...unassignedStudents].sort(() => 0.5 - Math.random());
      const batch = writeBatch(db);
      let updatedGroups = [...currentGroupsList];

      // 1. Fill existing groups up to maxMembers
      for (let g of updatedGroups) {
        while (g.memberIds.length < maxMembers - 1 && shuffled.length > 0) { 
          const student = shuffled.pop()!;
          g.memberIds.push(student.id);
          
          const groupRef = doc(db, "groups", g.id);
          batch.update(groupRef, { memberIds: g.memberIds });
        }
      }

      // 2. Create new groups with remaining students
      while (shuffled.length > 0) {
        const leader = shuffled.pop()!;
        const members: string[] = [];
        
        while (members.length < maxMembers - 1 && shuffled.length > 0) {
          members.push(shuffled.pop()!.id);
        }

        const newGroupRef = doc(collection(db, "groups"));
        batch.set(newGroupRef, {
          section: activeSection,
          leaderId: leader.id,
          leaderName: `${leader.firstName} ${leader.lastName}`,
          title: "Pending Title...",
          memberIds: members,
          createdAt: serverTimestamp()
        });

        updatedGroups.push({
          id: newGroupRef.id,
          leaderId: leader.id,
          leaderName: `${leader.firstName} ${leader.lastName}`,
          title: "Pending Title...",
          memberIds: members
        });
      }

      await batch.commit();
      setGroups(updatedGroups);
      setShowAutoGroupConfirm(false);

    } catch (error) {
      console.error("Auto group failed:", error);
      alert("Failed to auto-group students.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- LOGIC: RESHUFFLE ---
  const handleReshuffle = async () => {
    setIsLoading(true);
    try {
      const batch = writeBatch(db);
      groups.forEach(g => {
        batch.delete(doc(db, "groups", g.id));
      });
      await batch.commit();
      
      setGroups([]);
      setShowReshuffleConfirm(false);
      await executeAutoGroup([]);
    } catch (error) {
      console.error("Reshuffle failed:", error);
      alert("Failed to reshuffle groups.");
      setIsLoading(false);
    }
  };

  const handleDeleteGroup = (group: GroupData) => {
    setGroupToDelete(group);
    setShowDeleteConfirm(true);
  };

  const handleShowGroupDetails = (group: GroupData) => {
    setSelectedGroup(group);
  };

  const closeGroupDetails = () => {
    setSelectedGroup(null);
  };

  const confirmDeleteGroup = async () => {
    if (!groupToDelete) return;
    setIsLoading(true);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "groups", groupToDelete.id));
      await batch.commit();
    } catch (error) {
      console.error("Delete group failed:", error);
      alert("Failed to delete the group.");
      setIsLoading(false);
      return;
    }

    setGroups(prev => prev.filter(g => g.id !== groupToDelete.id));
    setGroupToDelete(null);
    setShowDeleteConfirm(false);
    setIsLoading(false);
  };

  // Metrics Calculations
  const assignedIds = new Set<string>();
  groups.forEach(g => {
    assignedIds.add(g.leaderId);
    g.memberIds.forEach(id => assignedIds.add(id));
  });
  
  const unassignedCount = students.length - assignedIds.size;
  const filteredStudents = students.filter(s => 
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.studentId.includes(searchTerm)
  );

  return (
    <div className="flex min-h-screen bg-gray-50/50 overflow-hidden">
      {/* ADVISER SIDEBAR */}
      <aside className={`hidden lg:flex w-64 bg-[#0f171e] text-white flex-col fixed inset-y-0 shadow-xl z-20 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center gap-3 border-b border-gray-800">
          <div className="bg-[#c9a654] p-1.5 rounded-md">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight block leading-none">FeasiFy</span>
            <span className="text-[8px] text-gray-400">An AI-Assisted Financial Feasibility System</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-8 mt-4">
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 px-2">Main Menu</p>
            <div className="space-y-1">
              <button className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#c9a654] text-white transition-all shadow-md">
                My Sections
              </button>
              
              {/* DYNAMIC SECTIONS RENDERED FROM DATABASE */}
              <div className="pl-4 pr-2 py-2 space-y-2">
                {adviserSections.map((sectionName) => (
                  <button 
                    key={sectionName}
                    onClick={() => {
                      setActiveSection(sectionName);
                      fetchSectionData(sectionName);
                    }}
                    className={`w-full text-left text-sm transition-colors ${activeSection === sectionName ? 'text-white font-medium' : 'text-gray-500 hover:text-white'}`}
                  >
                    {sectionName}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 px-2">Account</p>
            <div className="space-y-1">
              <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 bg-gray-900/10 cursor-pointer" disabled>
                <User className="w-4 h-4" /> Profile
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 bg-gray-900/10 cursor-pointer" disabled>
                <Settings className="w-4 h-4" /> Settings
              </button>
              <button onClick={() => setShowLogoutConfirm(true)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all">
                <ShieldAlert className="w-4 h-4" /> Logout
              </button>
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-gray-800 bg-[#0a1118]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#c9a654] flex items-center justify-center font-bold text-sm">
              {getInitials(userName)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-white">{userName}</p>
              <p className="text-[10px] text-gray-400 truncate">Feasibility Adviser</p>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className={`flex-1 transition-all duration-300 ease-in-out min-h-screen ${isSidebarOpen ? 'lg:ml-64' : 'ml-0'}`}>
        <div className="bg-white border-b border-gray-100 p-4 flex items-center gap-2 text-sm text-gray-500">
          <SidebarIcon className="w-4 h-4 cursor-pointer hover:text-gray-800 transition-colors" onClick={() => setIsSidebarOpen(!isSidebarOpen)} />
          <span className="mx-2">|</span>
          <span className="font-semibold text-gray-900">FeasiFy</span>
        </div>

        <div className="p-6 md:p-8 max-w-6xl mx-auto">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 border-b border-gray-200 pb-6">
            <div>
              <h1 className="text-3xl font-extrabold text-[#3d2c23]">{activeSection}</h1>
              <p className="text-sm text-gray-500 mt-1 italic">Manage feasibility groups and team leaders for this section.</p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setShowAllStudentsModal(true)} className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 font-semibold text-sm rounded-lg hover:bg-gray-50 transition-colors bg-white shadow-sm">
                <Users className="w-4 h-4" /> View All Students
              </button>
              <button onClick={() => { setShowAssignLeaderModal(true); setSelectedLeaderIds([]); }} className="flex items-center gap-2 px-4 py-2 bg-[#c9a654] text-white font-semibold text-sm rounded-lg hover:bg-[#b59545] transition-colors shadow-md">
                <Star className="w-4 h-4" /> Assign Leader
              </button>
              <button onClick={() => setShowSettingsModal(true)} className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 font-semibold text-sm rounded-lg bg-white hover:bg-gray-50 transition-colors shadow-sm">
                <Settings className="w-4 h-4" /> Group Settings
              </button>
              <button onClick={() => setShowAutoGroupConfirm(true)} className="flex items-center gap-2 px-4 py-2 bg-[#122244] text-white font-semibold text-sm rounded-lg hover:bg-[#1a3263] transition-colors shadow-md">
                <Archive className="w-4 h-4" /> Auto-Group
              </button>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm border-l-4 border-l-blue-500 flex justify-between items-center">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1 uppercase">Total Students</p>
                <p className="text-3xl font-bold text-[#3d2c23]">{students.length}</p>
              </div>
              <Users className="w-6 h-6 text-blue-400" />
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm border-l-4 border-l-[#c9a654] flex justify-between items-center">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1 uppercase">Total Groups</p>
                <p className="text-3xl font-bold text-[#3d2c23]">{groups.length}</p>
              </div>
              <Archive className="w-6 h-6 text-[#c9a654]" />
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm border-l-4 border-l-green-500 flex justify-between items-center">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1 uppercase">Leaders Assigned</p>
                <p className="text-3xl font-bold text-[#3d2c23]">{groups.length}</p>
              </div>
              <CheckCircle2 className="w-6 h-6 text-green-400" />
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm border-l-4 border-l-red-500 flex justify-between items-center">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1 uppercase">Students Unassigned</p>
                <p className="text-3xl font-bold text-red-500">{unassignedCount}</p>
              </div>
              <AlertCircle className="w-6 h-6 text-red-400" />
            </div>
          </div>

          {/* Reshuffle Container */}
          {groups.length > 0 && (
            <div className="flex justify-end mb-4">
              <button 
                onClick={() => setShowReshuffleConfirm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-[#4285F4] font-semibold text-sm rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
              >
                <RefreshCw className="w-4 h-4" /> Reshuffle
              </button>
            </div>
          )}

          {/* Group Cards Grid */}
          {isLoading ? (
            <div className="text-center py-12 text-gray-400 flex flex-col items-center">
               <div className="w-8 h-8 border-4 border-[#249c74] border-t-transparent rounded-full animate-spin mb-4"></div>
               Loading section data...
            </div>
          ) : groups.length === 0 ? (
            <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 py-16 flex flex-col items-center justify-center text-center">
              <Users className="w-12 h-12 text-gray-300 mb-3" />
              <h3 className="text-lg font-bold text-gray-900">No Groups Formed Yet</h3>
              <p className="text-sm text-gray-500 max-w-md mt-2">Click the 'Auto-Group' button above to automatically distribute the students into balanced teams, or click 'Assign Leader' to allow designated leaders to select their own members.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {groups.map((group, index) => {
                const totalMembers = group.memberIds.length + 1; // +1 for leader
                return (
                  <div
                    key={group.id}
                    onClick={() => handleShowGroupDetails(group)}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col cursor-pointer hover:shadow-lg transition-shadow"
                  >
                    <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                      <h3 className="font-bold text-[#122244] text-lg">Group {index + 1}</h3>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                        {totalMembers}/{maxMembers}
                      </span>
                    </div>
                    
                    <div className="p-6 flex-1 flex flex-col">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Business Name</p>
                      <p className="text-gray-900 font-bold text-lg mb-6">{group.title !== "Pending Title..." ? group.title : "Pending Title..."}</p>
                      
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-[#122244] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                          {getInitials(group.leaderName)}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-[#c9a654] uppercase tracking-widest leading-none mb-1">Team Leader</p>
                          <p className="text-sm font-bold text-gray-900">{group.leaderName}</p>
                        </div>
                      </div>
                      
                      {group.memberIds.length === 0 ? (
                        <p className="text-xs text-gray-400 italic text-center mt-4">No members added by leader yet.</p>
                      ) : (
                        <ul className="mt-2 space-y-1.5 pl-2 border-l-2 border-gray-100">
                          {group.memberIds.map(memberId => {
                            const member = students.find(s => s.id === memberId);
                            if (!member) return null;
                            return (
                              <li key={memberId} className="text-sm text-gray-500 flex items-center gap-2">
                                <span className="text-gray-300 font-bold">+</span> {member.firstName} {member.lastName}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                    
                    <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-gray-50/30">
                      <span className="text-xs text-gray-400 font-medium flex items-center gap-1.5"><Lock className="w-3.5 h-3.5"/> LEADER MANAGES</span>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group); }} className="text-sm font-bold text-red-600 hover:text-red-800">Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </main>

      {/* MODAL: Group Details */}
      {selectedGroup && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-[#122244]">Group {selectedGroup.title !== 'Pending Title...' ? selectedGroup.title : 'Details'}</h2>
                <p className="text-sm text-gray-500 mt-1">Click delete to remove this group, or close to return to the dashboard.</p>
              </div>
              <button onClick={closeGroupDetails} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">Team Leader</p>
                <p className="font-semibold text-gray-900">{selectedGroup.leaderName}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">Group Title</p>
                <p className="font-semibold text-gray-900">{selectedGroup.title}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">Members</p>
                <p className="font-semibold text-gray-900">{selectedGroup.memberIds.length} assigned</p>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 rounded-b-2xl">
              <button onClick={closeGroupDetails} className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-lg shadow-sm hover:bg-gray-50">Close</button>
              <button onClick={() => { handleDeleteGroup(selectedGroup); closeGroupDetails(); }} className="px-5 py-2.5 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700">Delete Group</button>
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

      {/* MODAL: Delete Group Confirmation */}
      {showDeleteConfirm && groupToDelete && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-[#122244]">Delete Group?</h2>
                <p className="text-sm text-gray-500 mt-1">This will remove the selected group and its project record permanently.</p>
              </div>
              <button onClick={() => { setShowDeleteConfirm(false); setGroupToDelete(null); }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6">
              <p className="text-gray-600 text-sm leading-relaxed">
                Are you sure you want to delete <strong>{groupToDelete.title || 'this group'}</strong> managed by <strong>{groupToDelete.leaderName}</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 rounded-b-2xl">
              <button onClick={() => { setShowDeleteConfirm(false); setGroupToDelete(null); }} className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-lg shadow-sm hover:bg-gray-50">Cancel</button>
              <button onClick={confirmDeleteGroup} className="px-5 py-2.5 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700">Yes, Delete</button>
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
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
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
                    <input type="checkbox" name="leader" value={student.id} checked={isSelected} onChange={() => {
                      setSelectedLeaderIds(prev => prev.includes(student.id) ? prev.filter(id => id !== student.id) : [...prev, student.id]);
                    }} className="hidden" />
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