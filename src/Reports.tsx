import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, db, signOutUser } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import {
  LayoutDashboard,
  Folder,
  FileEdit,
  Zap,
  BarChart3,
  MessageCircle,
  User,
  Settings,
  ShieldAlert,
  Sidebar as SidebarIcon,
  Download,
  FileText,
  Printer,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Lightbulb,
  Bell
} from "lucide-react";

const Reports: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleClickOutside = () => setIsProjectMenuOpen(false);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const loadUserGroup = async (uid: string, section: string) => {
    try {
      const q = query(collection(db, "groups"), where("section", "==", section));
      const snap = await getDocs(q);
      
      let myGroup: any = null;
      snap.forEach(doc => {
        const data = doc.data();
        if (data.leaderId === uid || (data.memberIds && data.memberIds.includes(uid))) {
          myGroup = { id: doc.id, ...data };
        }
      });

      if (myGroup && myGroup.isSetup) {
        const projData = [{
          id: myGroup.id,
          name: myGroup.title || "Untitled Business",
          status: myGroup.status || "Pending",
          financialData: myGroup.financialData || null,
          aiAnalysis: myGroup.aiAnalysis || null
        }];
        setProjects(projData);

        const savedProjectId = sessionStorage.getItem("lastSelectedProjectId");
        const state = location.state as any;

        if (state && state.projectId) {
          handleProjectSelect(state.projectId);
        } else if (savedProjectId && projData.some(p => p.id === savedProjectId)) {
          handleProjectSelect(savedProjectId);
        } else {
          handleProjectSelect(projData[0].id);
        }
      } else {
        setProjects([]);
      }
    } catch (error) {
      console.error("Failed to load group:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          if (snap.exists()) {
            const data = snap.data() as any;
            setUserName([data.firstName, data.lastName].filter(Boolean).join(" ") || u.displayName || "");
            
            if (data.section) {
              loadUserGroup(u.uid, data.section);
            } else {
              setIsLoading(false);
            }
          }
        } catch (e) {
          setIsLoading(false);
        }
      } else {
        navigate("/");
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

  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
    sessionStorage.setItem("lastSelectedProjectId", projectId);
    setIsProjectMenuOpen(false);
  };

  const handleLogout = async () => {
    try { await signOutUser(); localStorage.clear(); sessionStorage.clear(); } catch (e) {}
    navigate("/");
  };

  const getSelectedProjectName = () => {
    const proj = projects.find(p => p.id === selectedProjectId);
    return proj ? proj.name : "Select a Project";
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const getInitials = (name: string) => name ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "U";

  return (
    <div className="flex min-h-screen bg-gray-50/50 overflow-hidden">
      {/* NEW SIDEBAR */}
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
              <button onClick={() => navigate('/projects')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all">
                <Folder className="w-4 h-4" /> Business Proposal
              </button>
              <button onClick={() => navigate('/financial-input')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all">
                <FileEdit className="w-4 h-4" /> Financial Input
              </button>
              <button onClick={() => navigate('/ai-analysis')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all">
                <Zap className="w-4 h-4" /> AI Feasibility Analysis
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold bg-[#c9a654] text-white transition-all shadow-md">
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
              <p className="text-sm font-semibold truncate text-white">{userName || "User"}</p>
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

      {/* MAIN CONTENT */}
      <main className={`flex-1 transition-all duration-300 ease-in-out min-h-screen ${isSidebarOpen ? 'lg:ml-64' : 'ml-0'}`}>
        <div className="bg-white border-b border-gray-100 p-4 flex items-center gap-2 text-sm text-gray-500 print:hidden">
          <SidebarIcon className="w-4 h-4 cursor-pointer hover:text-gray-800 transition-colors" onClick={() => setIsSidebarOpen(!isSidebarOpen)} />
          <span className="mx-2">|</span>
          <span className="cursor-pointer hover:text-[#c9a654] transition-colors" onClick={() => navigate('/dashboard')}>FeasiFy</span>
          <span>›</span>
          <span className="font-semibold text-gray-900">Reports</span>
        </div>

        <div className="p-6 md:p-8 max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 border-b border-gray-200 pb-6 print:hidden">
            <div>
              <h1 className="text-3xl font-extrabold text-[#3d2c23]">Executive Reports</h1>
              <p className="text-sm text-gray-500 mt-1 italic">Download and print your official AI-generated feasibility study documentation.</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => window.print()}
                disabled={!selectedProject?.aiAnalysis}
                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-lg font-bold text-sm text-gray-700 hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50"
              >
                <Printer className="w-4 h-4" /> Print Document
              </button>
              <button 
                disabled={!selectedProject?.aiAnalysis}
                className="flex items-center gap-2 bg-[#c9a654] hover:bg-[#b59545] text-white px-6 py-2.5 rounded-lg font-bold text-sm transition-all shadow-md disabled:opacity-50"
              >
                <Download className="w-4 h-4" /> Download PDF
              </button>
            </div>
          </div>

          {/* Project Selector Widget */}
          <div className="mb-8 bg-white p-5 rounded-xl border border-gray-200 shadow-sm print:hidden">
            <label className="text-sm font-bold text-[#122244] uppercase tracking-widest block mb-2">Select Project Document</label>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="relative w-full md:w-1/2 z-30">
                <div 
                  className={`w-full px-4 py-3 bg-gray-50 border rounded-lg cursor-pointer flex items-center justify-between text-sm font-bold transition-all ${isProjectMenuOpen ? 'border-[#c9a654] ring-2 ring-[#c9a654]/20 bg-white' : 'border-gray-200 hover:bg-gray-100'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (projects.length > 0) setIsProjectMenuOpen(!isProjectMenuOpen);
                  }}
                >
                  <span className={selectedProjectId ? 'text-[#122244]' : 'text-gray-400'}>
                    {getSelectedProjectName()}
                  </span>
                  {projects.length > 0 && (
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isProjectMenuOpen ? 'rotate-180 text-[#c9a654]' : ''}`} />
                  )}
                </div>
                
                {isProjectMenuOpen && projects.length > 0 && (
                  <div className="absolute left-0 top-[calc(100%+0.5rem)] w-full bg-white border border-gray-100 shadow-xl rounded-xl py-2 animate-in fade-in zoom-in-95 duration-100 origin-top overflow-hidden">
                    {projects.map(p => (
                      <button 
                        key={p.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleProjectSelect(p.id);
                        }} 
                        className={`w-full text-left px-5 py-3 text-sm flex items-center justify-between gap-3 transition-colors ${selectedProjectId === p.id ? 'bg-blue-50 text-[#122244] font-extrabold' : 'text-gray-700 font-medium hover:bg-gray-50'}`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Document Preview */}
          {isLoading ? (
             <div className="flex flex-col items-center justify-center min-h-[40vh]">
               <div className="w-8 h-8 border-4 border-[#122244] border-t-transparent rounded-full animate-spin mb-4"></div>
               <p className="text-gray-500 font-medium text-sm">Loading reports...</p>
             </div>
          ) : !selectedProject ? (
             <div className="bg-white rounded-xl border border-dashed border-gray-300 py-20 flex flex-col items-center justify-center text-center print:hidden">
              <FileText className="w-12 h-12 text-gray-300 mb-4" />
              <h3 className="text-xl font-bold text-[#122244]">No Project Selected</h3>
              <p className="text-gray-500 mt-2">Open a workspace to view its associated reports.</p>
            </div>
          ) : !selectedProject.aiAnalysis ? (
             <div className="bg-white rounded-xl border border-dashed border-gray-300 py-20 flex flex-col items-center justify-center text-center print:hidden">
              <FileText className="w-12 h-12 text-gray-300 mb-4" />
              <h3 className="text-xl font-bold text-[#122244]">No Report Available</h3>
              <p className="text-gray-500 mt-2 mb-6">You need to run an AI Feasibility Analysis first.</p>
              <button 
                onClick={() => navigate('/ai-analysis')}
                className="bg-[#122244] text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-[#1a3263] transition-colors"
              >
                Go to Analysis Module
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-lg print:shadow-none print:border-none p-10 md:p-16 mb-12">
              
              {/* Report Header */}
              <div className="border-b-2 border-[#122244] pb-8 mb-8 text-center">
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-2">Executive Summary</h2>
                <h1 className="text-4xl font-extrabold text-[#3d2c23] mb-4">{selectedProject.name}</h1>
                <p className="text-gray-600">Generated by FeasiFy AI Engine</p>
                <p className="text-sm text-gray-400 mt-1">Date of Analysis: {new Date(selectedProject.aiAnalysis.lastRun).toLocaleDateString()}</p>
              </div>

              {/* Status Banner */}
              <div className={`p-6 rounded-xl mb-10 flex items-center gap-4 ${selectedProject.aiAnalysis.status === 'FEASIBLE' ? 'bg-green-50 border border-green-200 text-green-900' : selectedProject.aiAnalysis.status === 'NOT_FEASIBLE' ? 'bg-red-50 border border-red-200 text-red-900' : 'bg-orange-50 border border-orange-200 text-orange-900'}`}>
                <div className={`p-3 rounded-full bg-white shadow-sm`}>
                  {selectedProject.aiAnalysis.status === 'FEASIBLE' ? <CheckCircle2 className="w-6 h-6 text-green-600"/> : <AlertCircle className="w-6 h-6 text-red-600"/>}
                </div>
                <div>
                  <h3 className="font-extrabold text-lg tracking-wide uppercase">Official Verdict: {selectedProject.aiAnalysis.status.replace('_', ' ')}</h3>
                  <p className="text-sm font-medium opacity-80 mt-1">Overall Feasibility Score: {selectedProject.aiAnalysis.score}/100</p>
                </div>
              </div>

              {/* Financial Summary */}
              <h3 className="text-xl font-bold text-[#122244] border-b border-gray-200 pb-2 mb-6">Financial Overview</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Initial Capital</p>
                  <p className="text-xl font-bold text-gray-900">₱{(selectedProject.financialData?.initialCapital || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Financial Health</p>
                  <p className="text-xl font-bold text-gray-900">{selectedProject.aiAnalysis.metrics.financial}%</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Risk Level</p>
                  <p className="text-xl font-bold text-gray-900">{selectedProject.aiAnalysis.metrics.risk}%</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Market Viability</p>
                  <p className="text-xl font-bold text-gray-900">{selectedProject.aiAnalysis.metrics.market}%</p>
                </div>
              </div>

              {/* Insights */}
              <h3 className="text-xl font-bold text-[#122244] border-b border-gray-200 pb-2 mb-6">Key Insights & Recommendations</h3>
              <div className="space-y-6">
                {selectedProject.aiAnalysis.insights.map((insight: any, i: number) => (
                  <div key={i} className="flex gap-4">
                    <div className="mt-1">
                      {insight.type === 'positive' ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : 
                       insight.type === 'warning' ? <TrendingUp className="w-5 h-5 text-orange-500" /> : 
                       <Lightbulb className="w-5 h-5 text-blue-500" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">{insight.title}</h4>
                      <p className="text-sm text-gray-600 mt-1 leading-relaxed">{insight.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Footer */}
              <div className="mt-16 pt-8 border-t border-gray-200 text-center">
                <p className="text-xs text-gray-400">This document is auto-generated by the FeasiFy System and is intended for academic evaluation purposes only.</p>
              </div>

            </div>
          )}
        </div>
      </main>

      {/* LOGOUT CONFIRMATION */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowLogoutConfirm(false)} />
          <div className="bg-white rounded-2xl p-6 z-10 w-11/12 max-w-md shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-[#122244] mb-2">Confirm logout</h3>
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to log out?</p>
            <div className="flex justify-end gap-3">
              <button className="px-5 py-2.5 rounded-lg border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50" onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
              <button className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-md" onClick={() => { setShowLogoutConfirm(false); handleLogout(); }}>
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;