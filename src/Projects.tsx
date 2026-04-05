import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db, signOutUser } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where, doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
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
  X
} from "lucide-react";

interface GroupData {
  id: string;
  leaderId: string;
  leaderName: string;
  title: string; // Used as Business Name
  companyName?: string;
  category?: string;
  description?: string;
  memberIds: string[];
  joinedMembers?: string[]; // Track who clicked "Join"
  section: string;
  isSetup?: boolean;
}

const Projects: React.FC = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [userUid, setUserUid] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  // Group & Project State
  const [userGroup, setUserGroup] = useState<GroupData | null>(null);
  const [isLeader, setIsLeader] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Data states for Roster
  const [leaderData, setLeaderData] = useState<any>(null);
  const [groupMembersData, setGroupMembersData] = useState<any[]>([]);
  const [adviserData, setAdviserData] = useState<any>(null);

  // Leader Setup Modal State
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupStep, setSetupStep] = useState(1);
  const [setupForm, setSetupForm] = useState({
    companyName: "",
    businessName: "",
    category: "Food & Beverage",
    description: ""
  });

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);

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
          }
        }
      } catch (error) {
        console.error(error);
        setIsLoading(false);
      }
    });
    return () => unsub();
  }, [navigate]);

  // Fetch unread notifications count
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

  const fetchUserGroup = async (uid: string, section: string) => {
    try {
      const q = query(collection(db, "groups"), where("section", "==", section));
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
        setUserGroup(foundGroup as GroupData);
        setIsLeader(leader);
        setIsMember(member);
        
        // Check if member has already clicked "Join"
        if (member && (foundGroup as GroupData).joinedMembers && (foundGroup as GroupData).joinedMembers?.includes(uid)) {
          setHasJoined(true);
        }

        // Fetch profiles for roster
        await fetchGroupDetails(foundGroup as GroupData);
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error fetching group:", error);
      setIsLoading(false);
    }
  };

  const fetchGroupDetails = async (group: GroupData) => {
    try {
      // 1. Get Leader Profile
      const leaderSnap = await getDoc(doc(db, "users", group.leaderId));
      if (leaderSnap.exists()) setLeaderData(leaderSnap.data());

      // 2. Get Members Profiles
      if (group.memberIds.length > 0) {
        const memberPromises = group.memberIds.map(id => getDoc(doc(db, "users", id)));
        const memberSnaps = await Promise.all(memberPromises);
        const membersList = memberSnaps.filter(s => s.exists()).map(s => ({ id: s.id, ...s.data() }));
        setGroupMembersData(membersList);
      }

      // 3. Get Adviser Profile for this section
      const advQ = query(collection(db, "users"), where("role", "==", "Adviser"));
      const advSnaps = await getDocs(advQ);
      advSnaps.forEach(d => {
        const data = d.data();
        if (data.section && data.section.includes(group.section)) {
          setAdviserData(data);
        }
      });

    } catch (err) {
      console.error("Failed to fetch group member details", err);
    } finally {
      setIsLoading(false);
    }
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
      await updateDoc(doc(db, "groups", userGroup.id), {
        joinedMembers: arrayUnion(userUid)
      });
      setHasJoined(true);
    } catch (error) {
      console.error("Error joining group:", error);
    }
  };

  const handleSaveSetup = async () => {
    if (!userGroup) return;
    try {
      await updateDoc(doc(db, "groups", userGroup.id), {
        companyName: setupForm.companyName,
        title: setupForm.businessName,
        category: setupForm.category,
        description: setupForm.description,
        isSetup: true
      });
      
      setUserGroup(prev => prev ? { 
        ...prev, 
        companyName: setupForm.companyName, 
        title: setupForm.businessName, 
        category: setupForm.category, 
        description: setupForm.description,
        isSetup: true 
      } : null);
      
      setShowSetupModal(false);
      setShowEditModal(false);
    } catch (error) {
      console.error("Error saving setup:", error);
    }
  };

  // --- RENDER HELPERS ---

  const renderSidebar = () => (
    <aside className={`hidden lg:flex w-64 bg-[#122244] text-white flex-col fixed inset-y-0 shadow-xl z-20 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="p-6 flex items-center gap-3 border-b border-white/10">
        <div className="bg-white p-1.5 rounded-md">
          <BarChart3 className="w-6 h-6 text-[#122244]" />
        </div>
        <div>
          <span className="text-xl font-bold tracking-tight block leading-none">FeasiFy</span>
          <span className="text-[8px] text-gray-400">An AI-Assisted Financial Feasibility System</span>
        </div>
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
          <button
            onClick={() => navigate('/notifications')}
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
  );

  // --- VIEW 1: LOADING OR NO GROUP ---
  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-gray-50/30">
        {renderSidebar()}
        <main className={`flex-1 flex items-center justify-center ${isSidebarOpen ? 'lg:ml-64' : 'ml-0'}`}>
          <div className="w-8 h-8 border-4 border-[#122244] border-t-transparent rounded-full animate-spin"></div>
        </main>
      </div>
    );
  }

  if (!userGroup) {
    return (
      <div className="flex min-h-screen bg-gray-50/30">
        {renderSidebar()}
        <main className={`flex-1 ${isSidebarOpen ? 'lg:ml-64' : 'ml-0'}`}>
          <div className="p-8 flex flex-col items-center justify-center min-h-[80vh] text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-xl font-bold text-[#122244]">Not Assigned Yet</h2>
            <p className="text-gray-500 mt-2 max-w-md">Your adviser has not assigned you to a feasibility group yet. Please check back later.</p>
          </div>
        </main>
      </div>
    );
  }

  // --- VIEW 2: LEADER SETUP REQUIRED ---
  if (isLeader && !userGroup.isSetup) {
    return (
      <div className="flex min-h-screen bg-gray-50/50">
        {renderSidebar()}
        <main className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'lg:ml-64' : 'ml-0'}`}>
          <div className="bg-white border-b border-gray-100 p-4 flex items-center gap-2 text-sm text-gray-500">
            <SidebarIcon className="w-4 h-4 cursor-pointer hover:text-gray-800 transition-colors" onClick={() => setIsSidebarOpen(!isSidebarOpen)} />
            <span className="mx-2">|</span> FeasiFy <span>›</span> <span className="font-semibold text-gray-900">Projects</span>
          </div>

          <div className="p-8 max-w-5xl mx-auto">
            <h1 className="text-3xl font-extrabold text-[#3d2c23] mb-1">Business Proposal</h1>
            <p className="text-sm text-gray-500 italic mb-8">Manage and track your feasibility study project</p>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 flex flex-col items-center text-center min-h-[400px] justify-center border-dashed">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                <Star className="w-8 h-8 text-blue-500" />
              </div>
              <h2 className="text-2xl font-bold text-[#122244] mb-2">You're assigned as Group Leader!</h2>
              <p className="text-gray-500 mb-8 max-w-md">Set up your feasibility study project — add your group members, business name, company name, and project description to get started.</p>
              <button 
                onClick={() => {
                  setSetupForm({ ...setupForm, businessName: userGroup.title === "Pending Title..." ? "" : userGroup.title });
                  setShowSetupModal(true);
                }}
                className="flex items-center gap-2 px-6 py-3 bg-[#c9a654] text-white font-bold rounded-lg hover:bg-[#b59545] shadow-md transition-all"
              >
                <Star className="w-4 h-4 fill-current" /> Set up project
              </button>
            </div>
          </div>

          {/* SETUP MODAL */}
          {showSetupModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-100 flex justify-between items-start text-center relative">
                  <div className="w-full">
                    <h2 className="text-2xl font-extrabold text-[#122244]">Set Up Your Project</h2>
                    <p className="text-sm text-gray-500 mt-1">Complete both steps to create your feasibility study workspace.</p>
                  </div>
                  <button onClick={() => setShowSetupModal(false)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>
                
                {/* Stepper */}
                <div className="flex items-center justify-center gap-4 py-4 bg-gray-50/50 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${setupStep === 1 ? 'bg-[#4285F4] text-white' : 'bg-green-500 text-white'}`}>
                      {setupStep === 2 ? <Check className="w-4 h-4" /> : '1'}
                    </div>
                    <span className={`text-sm font-bold ${setupStep === 1 ? 'text-[#4285F4]' : 'text-green-500'}`}>Feasibility Info</span>
                  </div>
                  <div className="w-16 h-0.5 bg-gray-300"></div>
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${setupStep === 2 ? 'bg-[#4285F4] text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
                    <span className={`text-sm font-bold ${setupStep === 2 ? 'text-[#4285F4]' : 'text-gray-500'}`}>Group Members</span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  {setupStep === 1 ? (
                    <div className="space-y-4 max-w-lg mx-auto">
                      <div>
                        <label className="text-sm font-bold text-gray-700 block mb-1">Company Name</label>
                        <input type="text" value={setupForm.companyName} onChange={e => setSetupForm({...setupForm, companyName: e.target.value})} placeholder="e.g. Sweet Sip Inc." className="w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#c9a654]/50" />
                      </div>
                      <div>
                        <label className="text-sm font-bold text-gray-700 block mb-1">Business Name</label>
                        <input type="text" value={setupForm.businessName} onChange={e => setSetupForm({...setupForm, businessName: e.target.value})} placeholder="e.g. Boba Bites Hub" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#c9a654]/50" />
                      </div>
                      <div>
                        <label className="text-sm font-bold text-gray-700 block mb-1">Category</label>
                        <select value={setupForm.category} onChange={e => setSetupForm({...setupForm, category: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#c9a654]/50">
                          <option>Food & Beverage</option>
                          <option>Technology</option>
                          <option>Services</option>
                          <option>Retail</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-bold text-gray-700 block mb-1">Description</label>
                        <textarea rows={3} value={setupForm.description} onChange={e => setSetupForm({...setupForm, description: e.target.value})} placeholder="Briefly describe your business concept..." className="w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#c9a654]/50 resize-none" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-8 h-full">
                      {/* Left: Current Team */}
                      <div className="flex-1 pr-6 border-r border-gray-100">
                        <h3 className="text-lg font-bold text-[#122244]">Current Team</h3>
                        <p className="text-xs text-gray-500 mb-4">You have <span className="font-bold text-gray-900">{userGroup.memberIds.length + 1}</span> out of 10 members.</p>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center p-2 rounded-lg hover:bg-gray-50">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-purple-600 rounded-full text-white flex items-center justify-center font-bold text-sm">
                                {getInitials(userGroup.leaderName)}
                              </div>
                              <div>
                                <p className="font-bold text-gray-900 text-sm">{userGroup.leaderName}</p>
                                <p className="text-xs text-gray-500">Leader</p>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-2 py-1 rounded uppercase">Leader</span>
                          </div>
                          
                          {/* REAL MEMBERS PULLED FROM DB */}
                          {groupMembersData.map((member) => (
                             <div key={member.id} className="flex justify-between items-center p-2 rounded-lg hover:bg-gray-50">
                             <div className="flex items-center gap-3">
                               <div className="w-10 h-10 bg-green-500 rounded-full text-white flex items-center justify-center font-bold text-sm">
                                 {getInitials(`${member.firstName} ${member.lastName}`)}
                               </div>
                               <div>
                                 <p className="font-bold text-gray-900 text-sm">{member.firstName} {member.lastName}</p>
                                 <p className="text-xs text-gray-500">{member.studentId}</p>
                               </div>
                             </div>
                             <button className="text-xs font-bold text-red-500 hover:underline">Remove</button>
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
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-center">
                          <p className="text-sm font-bold text-blue-800">Use this to add more members later.</p>
                          <p className="text-xs text-blue-600 mt-1">Adviser may have already auto-assigned some members.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 border-t border-gray-100 flex justify-between bg-gray-50/50 rounded-b-2xl">
                  {setupStep === 1 ? (
                     <>
                      <button onClick={() => setShowSetupModal(false)} className="px-5 py-2.5 text-sm font-bold text-[#4285F4] hover:bg-blue-50 rounded-lg transition-colors">Cancel</button>
                      <button onClick={() => setSetupStep(2)} disabled={!setupForm.businessName || !setupForm.companyName} className="px-5 py-2.5 text-sm font-bold text-white bg-[#c9a654] hover:bg-[#b59545] rounded-lg shadow-md transition-colors flex items-center gap-2 disabled:opacity-50">Next <ChevronRight className="w-4 h-4"/></button>
                     </>
                  ) : (
                    <>
                      <button onClick={() => setSetupStep(1)} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-2"><ChevronLeft className="w-4 h-4"/> Back</button>
                      <button onClick={handleSaveSetup} className="px-5 py-2.5 text-sm font-bold text-white bg-[#c9a654] hover:bg-[#b59545] rounded-lg shadow-md transition-colors flex items-center gap-2"><Check className="w-4 h-4"/> Create</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // --- VIEW 3: MEMBER NEEDS TO JOIN ---
  if (isMember && !hasJoined) {
    return (
      <div className="flex min-h-screen bg-gray-50/50">
        {renderSidebar()}
        <main className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'lg:ml-64' : 'ml-0'}`}>
          <div className="bg-white border-b border-gray-100 p-4 flex items-center gap-2 text-sm text-gray-500">
            <SidebarIcon className="w-4 h-4 cursor-pointer hover:text-gray-800 transition-colors" onClick={() => setIsSidebarOpen(!isSidebarOpen)} />
            <span className="mx-2">|</span> FeasiFy <span>›</span> <span className="font-semibold text-gray-900">Projects</span>
          </div>

          <div className="p-8 max-w-5xl mx-auto">
            <h1 className="text-3xl font-extrabold text-[#3d2c23] mb-1">Business Proposal</h1>
            <p className="text-sm text-gray-500 italic mb-8">Manage and track your feasibility study project</p>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 flex flex-col items-center text-center min-h-[400px] justify-center">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-6 border border-blue-100">
                <Bell className="w-8 h-8 text-blue-500" />
              </div>
              <h2 className="text-2xl font-bold text-[#122244] mb-2">You're added to a group!</h2>
              <p className="text-gray-500 mb-8 max-w-md">
                <span className="font-bold text-gray-900">{userGroup.leaderName}</span> has added you to the feasibility study group: <span className="font-bold text-[#4285F4]">{userGroup.title}</span>
              </p>
              <button 
                onClick={handleJoinGroup}
                className="flex items-center gap-2 px-8 py-3 bg-[#c9a654] text-white font-bold rounded-lg hover:bg-[#b59545] shadow-md transition-all"
              >
                <Check className="w-5 h-5" /> Join!
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // --- VIEW 4: FULL PROJECT DASHBOARD (Leader & Joined Members) ---
  return (
    <div className="flex min-h-screen bg-gray-50/50">
      {renderSidebar()}
      
      <main className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'lg:ml-64' : 'ml-0'}`}>
        <div className="bg-white border-b border-gray-100 p-4 flex items-center gap-2 text-sm text-gray-500">
          <SidebarIcon className="w-4 h-4 cursor-pointer hover:text-gray-800 transition-colors" onClick={() => setIsSidebarOpen(!isSidebarOpen)} />
          <span className="mx-2">|</span> FeasiFy <span>›</span> <span className="font-semibold text-gray-900">Projects</span>
        </div>

        <div className="p-6 md:p-8 max-w-6xl mx-auto">
          
          {/* Top Banner */}
          <div className="bg-[#1a2f55] rounded-xl shadow-md overflow-hidden mb-6 flex flex-col md:flex-row items-center justify-between p-8 text-white relative">
            <div className="flex items-center gap-6 z-10 w-full md:w-auto">
              {/* Logo Placeholder */}
              <div className="w-24 h-24 bg-[#122244] rounded-2xl flex items-center justify-center border-2 border-white/20 shadow-inner flex-shrink-0">
                 <span className="text-2xl font-bold text-white tracking-widest">{getInitials(userGroup?.title || "Project")}</span>
              </div>
              
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest bg-white/20 px-2 py-1 rounded border border-white/30 backdrop-blur-sm">{userGroup?.category || "Category"}</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1"><User className="w-3 h-3"/> SECTION: {userGroup?.section}</span>
                </div>
                <h1 className="text-3xl font-extrabold mb-1 tracking-tight">{userGroup?.title || "Business Name"}</h1>
                <p className="text-sm text-blue-200 font-medium uppercase tracking-wider">{userGroup?.companyName || "Company Name Inc."}</p>
              </div>
            </div>

            {/* ONLY LEADER SEES EDIT BUTTON */}
            {isLeader && (
              <button 
                onClick={() => {
                  setSetupForm({
                    companyName: userGroup?.companyName || "",
                    businessName: userGroup?.title || "",
                    category: userGroup?.category || "Food & Beverage",
                    description: userGroup?.description || ""
                  });
                  setShowEditModal(true);
                }}
                className="mt-6 md:mt-0 flex items-center gap-2 px-5 py-2.5 border-2 border-white/30 hover:bg-white/10 rounded-lg text-sm font-bold transition-all z-10 whitespace-nowrap"
              >
                <Pencil className="w-4 h-4" /> Edit Information
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Project Overview */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-blue-50 p-2 rounded-full border border-blue-100">
                  <Info className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#122244]">Project Overview</h3>
                  <p className="text-xs text-gray-500">Executive Summary & Description</p>
                </div>
              </div>
              <p className="text-gray-700 leading-relaxed">
                {userGroup?.description || "No description provided. The leader should edit the project information to add an executive summary here."}
              </p>
            </div>

            {/* Project Roster */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-lg font-bold text-[#122244] uppercase tracking-widest mb-1">Project Roster</h3>
              <p className="text-xs text-gray-500 mb-6">{userGroup?.memberIds.length ? userGroup.memberIds.length + 1 : 1} Members Total</p>

              <div className="space-y-4">
                {/* Adviser */}
                <div className="flex items-center gap-3 p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
                  <div className="w-10 h-10 bg-[#122244] rounded-lg text-white flex items-center justify-center font-bold text-sm">
                    {adviserData ? getInitials(`${adviserData.firstName} ${adviserData.lastName}`) : 'AD'}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-[#122244] flex items-center gap-2">
                      {adviserData ? `Prof. ${adviserData.firstName} ${adviserData.lastName}` : 'Adviser Name'}
                      <span className="text-[10px] bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded font-bold uppercase">Adviser</span>
                    </p>
                    <p className="text-xs text-gray-500">Faculty</p>
                  </div>
                </div>

                {/* Leader */}
                <div className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-colors">
                  <div className="w-10 h-10 bg-purple-600 rounded-full text-white flex items-center justify-center font-bold text-sm">
                    {getInitials(userGroup?.leaderName || "")}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      {userGroup?.leaderName} 
                      <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold uppercase">Leader</span>
                    </p>
                    <p className="text-xs text-gray-500">{leaderData?.studentId || "No ID"}</p>
                  </div>
                </div>

                {/* REAL MEMBERS PULLED FROM DB */}
                {groupMembersData.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-colors">
                    <div className="w-10 h-10 bg-green-500 rounded-full text-white flex items-center justify-center font-bold text-sm">
                      {getInitials(`${member.firstName} ${member.lastName}`)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-900">{member.firstName} {member.lastName}</p>
                      <p className="text-xs text-gray-500">{member.studentId || "No ID"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* EDIT INFO MODAL (LEADER ONLY) */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-extrabold text-[#122244]">Edit Project Info</h2>
                <p className="text-sm text-gray-500 mt-1">Update the core details and branding of your feasibility study.</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
               <div>
                  <label className="text-sm font-bold text-gray-700 block mb-1">Company Name</label>
                  <input type="text" value={setupForm.companyName} onChange={e => setSetupForm({...setupForm, companyName: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#c9a654]/50" />
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-700 block mb-1">Business Name</label>
                  <input type="text" value={setupForm.businessName} onChange={e => setSetupForm({...setupForm, businessName: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#c9a654]/50" />
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-700 block mb-1">Category</label>
                  <select value={setupForm.category} onChange={e => setSetupForm({...setupForm, category: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#c9a654]/50">
                    <option>Food & Beverage</option>
                    <option>Technology</option>
                    <option>Services</option>
                    <option>Retail</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-700 block mb-1">Description</label>
                  <textarea rows={4} value={setupForm.description} onChange={e => setSetupForm({...setupForm, description: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#c9a654]/50 resize-none" />
                </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 rounded-b-2xl">
              <button onClick={() => setShowEditModal(false)} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleSaveSetup} className="px-5 py-2.5 text-sm font-bold text-white bg-[#c9a654] hover:bg-[#b59545] rounded-lg shadow-md transition-colors">Save Changes</button>
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

export default Projects;