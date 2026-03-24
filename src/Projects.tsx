import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, db, createProject, getUserProjects, updateProject, deleteProject } from "./firebase";
import { onAuthStateChanged, signOut as fbSignOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  LayoutDashboard,
  Folder,
  FileEdit,
  Zap,
  BarChart3,
  User,
  Settings,
  ShieldAlert,
  Plus,
  Search,
  Filter,
  Sidebar as SidebarIcon,
  X,
  Calendar,
  MoreHorizontal,
  Pencil,
  Trash2,
  Check,
  ChevronDown
} from "lucide-react";

type ProjectStatus = "Feasible" | "In Progress" | "Needs Review" | "Not Feasible";

interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  date: string;
  category: string;
  userId?: string;
  financialData?: {
    initialCapital?: number;
  };
}

const Projects: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  // SIDEBAR TOGGLE STATE
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [newProjectCategory, setNewProjectCategory] = useState("");

  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState(""); 
  const [selectedStatus, setSelectedStatus] = useState("All Status"); 
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false); 
  
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false); 

  const filteredProjects = projects.filter(project => {
    const matchesSearch = 
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (project.category && project.category.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = selectedStatus === "All Status" || project.status === selectedStatus;

    return matchesSearch && matchesStatus;
  });

  useEffect(() => {
    const handleClickOutside = () => {
      setActiveMenuId(null);
      setIsStatusMenuOpen(false); 
      // Also close category dropdown if clicked outside
      setIsCategoryMenuOpen(false); 
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Updated to catch the status filter from the Dashboard!
  useEffect(() => {
    const state = location.state as any;
    if (state) {
      let matched = false;
      if (state.openNewProjectModal) {
        openCreateModal();
        matched = true;
      }
      if (state.filterStatus) {
        setSelectedStatus(state.filterStatus);
        matched = true;
      }
      
      // Clear location state so refreshes don't re-trigger
      if (matched) {
        window.history.replaceState({}, document.title);
      }
    }
  }, [location]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUserId(u.uid);
        loadProjects(u.uid);
        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          if (snap.exists()) {
            const data = snap.data() as any;
            setUserName([data.firstName, data.lastName].filter(Boolean).join(" ") || u.displayName || "");
            setUserEmail(data.email || u.email || "");
          } else {
            setUserName(u.displayName || (u.email ? u.email.split("@")[0] : ""));
            setUserEmail(u.email || "");
          }
        } catch (e) {}
      } else {
        navigate("/");
      }
    });
    return () => unsub();
  }, [navigate]);

  const loadProjects = async (uid: string) => {
    setIsLoading(true);
    try {
      const fetchedProjects = await getUserProjects(uid);
      setProjects(fetchedProjects as Project[]);
    } catch (error) {
      console.error("Error loading projects:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try { await fbSignOut(auth); localStorage.clear(); sessionStorage.clear(); } catch (e) {}
    navigate("/");
  };

  const openCreateModal = () => {
    setEditingProjectId(null);
    setNewProjectName("");
    setNewProjectDesc("");
    setNewProjectCategory("");
    setIsCategoryMenuOpen(false); // Make sure this is closed on open
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsCategoryMenuOpen(false); // Make sure this is closed on close
  }

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !userId) return;

    try {
      if (editingProjectId) {
        // Update existing project in Firestore
        await updateProject(editingProjectId, {
          name: newProjectName,
          description: newProjectDesc,
          category: newProjectCategory
        });
        
        // Update local state
        setProjects(projects.map(proj => 
          proj.id === editingProjectId 
            ? { ...proj, name: newProjectName, description: newProjectDesc, category: newProjectCategory }
            : proj
        ));
        closeModal();
      } else {
        // Create new project in Firestore
        const newProjectData = {
          name: newProjectName,
          description: newProjectDesc,
          category: newProjectCategory,
          status: "In Progress" as ProjectStatus,
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        };
        
        const newId = await createProject(userId, newProjectData);
        
        // Add to local state
        const newProject: Project = { id: newId, ...newProjectData };
        setProjects([newProject, ...projects]);
        closeModal();

        // Redirect immediately to Financial Input for this new project
        navigate('/financial-input', { state: { projectId: newId } });
      }
    } catch (error) {
      console.error("Error saving project:", error);
    }
  };

  const handleEditClick = (project: Project) => {
    setEditingProjectId(project.id);
    setNewProjectName(project.name);
    setNewProjectDesc(project.description);
    setNewProjectCategory(project.category || "");
    setIsCategoryMenuOpen(false); // Make sure this is closed on open
    setIsModalOpen(true);
    setActiveMenuId(null);
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await deleteProject(id);
      setProjects(projects.filter(project => project.id !== id));
      setActiveMenuId(null);
    } catch (error) {
      console.error("Error deleting project:", error);
    }
  };

  const getStatusClasses = (status: ProjectStatus) => {
    switch (status) {
      case "Feasible": return "bg-[#249c74] text-white";
      case "In Progress": return "bg-blue-100 text-blue-700 font-semibold";
      case "Needs Review": return "bg-gray-100 text-gray-700 font-semibold";
      case "Not Feasible": return "bg-red-500 text-white font-semibold";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="flex min-h-screen bg-white overflow-hidden">
      {/* SIDEBAR */}
      <aside className={`hidden lg:flex w-64 bg-[#0f171e] text-white flex-col fixed inset-y-0 shadow-xl z-20 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center gap-2 border-b border-gray-800">
          <div className="bg-[#249c74] p-1.5 rounded-md">
            <Zap className="w-5 h-5 text-white fill-current" />
          </div>
          <span className="text-xl font-bold tracking-tight">FeasiFy</span>
        </div>

        <nav className="flex-1 p-4 space-y-8 mt-4">
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 px-2">Main Menu</p>
            <div className="space-y-1">
              <button onClick={() => navigate('/dashboard')} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all">
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium bg-[#249c74] text-white transition-all">
                <Folder className="w-4 h-4" /> Projects
              </button>
              <button onClick={() => navigate('/financial-input')} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all">
                <FileEdit className="w-4 h-4" /> Financial Input
              </button>
              <button onClick={() => navigate('/ai-analysis')} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all">
                <Zap className="w-4 h-4" /> AI Analysis
              </button>
              <button onClick={() => navigate('/reports')} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all">
                <BarChart3 className="w-4 h-4" /> Reports
              </button>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 px-2">Account</p>
            <div className="space-y-1">
              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all">
                <User className="w-4 h-4" /> Profile
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all">
                <Settings className="w-4 h-4" /> Settings
              </button>
              <button
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
                onClick={() => setShowLogoutConfirm(true)}
              >
                <ShieldAlert className="w-4 h-4" /> Logout
              </button>
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-gray-800 bg-[#0a1118]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#249c74] flex items-center justify-center font-bold">
              {userName ? userName.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() : "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{userName || "User"}</p>
              <p className="text-xs text-gray-500 truncate">{userEmail}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className={`flex-1 transition-all duration-300 ease-in-out bg-gray-50/30 min-h-screen ${isSidebarOpen ? 'lg:ml-64' : 'ml-0'}`}>
        <div className="bg-white border-b border-gray-100 p-4 flex items-center gap-2 text-sm text-gray-500">
          <SidebarIcon 
            className="w-4 h-4 cursor-pointer hover:text-gray-800 transition-colors" 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
          />
          <span className="mx-2">|</span>
          <span 
            className="cursor-pointer hover:text-[#249c74] transition-colors"
            onClick={() => navigate('/dashboard')}
          >
            FeasiFy
          </span>
          <span>›</span>
          <span className="font-semibold text-gray-900">Projects</span>
        </div>

        <div className="p-6 md:p-8 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
              <p className="text-sm text-gray-500 mt-1">Manage and track your feasibility study projects</p>
            </div>
            <button 
              onClick={openCreateModal}
              className="flex items-center gap-2 bg-[#249c74] hover:bg-[#1e8563] text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all shadow-md shadow-green-900/10"
            >
              <Plus className="w-4 h-4" /> New Project
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-8 relative">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search projects..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#249c74]/20 focus:border-[#249c74] transition-all text-sm"
              />
            </div>
            
            <div className="relative">
              <button 
                onClick={(e) => { e.stopPropagation(); setIsStatusMenuOpen(!isStatusMenuOpen); }}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Filter className="w-4 h-4" /> 
                {selectedStatus}
                <ChevronDown className="w-4 h-4 text-gray-400 ml-1" />
              </button>

              {isStatusMenuOpen && (
                <div className="absolute right-0 top-[calc(100%+0.5rem)] w-full bg-white border border-gray-100 shadow-lg rounded-xl py-1 z-10 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                  {[
                    "All Status",
                    "Feasible",
                    "In Progress",
                    "Needs Review",
                    "Not Feasible"
                  ].map(statusOption => (
                    <button 
                      key={statusOption}
                      type="button"
                      onClick={() => {
                        setSelectedStatus(statusOption);
                        setIsStatusMenuOpen(false);
                      }} 
                      className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between gap-3 transition-colors ${selectedStatus === statusOption ? 'bg-[#249c74]/10 text-[#249c74]' : 'text-gray-700 hover:bg-gray-50'}`}
                    >
                      <span>{statusOption}</span>
                      {selectedStatus === statusOption && <Check className="w-4 h-4 text-[#249c74]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="w-8 h-8 border-4 border-[#249c74] border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-sm text-gray-500">Loading your projects...</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-xl border-2 border-dashed border-gray-200">
              <img src="/feedback.png" alt="No projects" className="w-16 h-16 mb-4 opacity-60" />
              <h3 className="text-gray-900 font-semibold mb-1">There are currently no study project</h3>
              <p className="text-sm text-gray-500">Click "New Project" to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map(project => ( 
                <div 
                  key={project.id} 
                  onClick={() => navigate('/financial-input', { state: { projectId: project.id } })}
                  className="group relative bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex flex-col hover:border-gray-200 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[#f0f9f6] rounded-lg">
                        <Folder className="w-5 h-5 text-[#249c74]" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-sm leading-tight">{project.name}</h3>
                        <span className={`inline-block mt-1 text-[10px] px-2.5 py-0.5 rounded-full ${getStatusClasses(project.status)}`}>
                          {project.status}
                        </span>
                      </div>
                    </div>

                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Prevents clicking the menu from opening the project
                          setActiveMenuId(activeMenuId === project.id ? null : project.id);
                        }}
                        className={`p-1 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-all ${activeMenuId === project.id ? 'opacity-100 bg-gray-100 text-gray-900' : 'opacity-0 group-hover:opacity-100'}`}
                      >
                        <MoreHorizontal className="w-5 h-5" />
                      </button>

                      {activeMenuId === project.id && (
                        <div className="absolute right-0 top-8 w-32 bg-white border border-gray-100 shadow-lg rounded-xl py-1 z-10 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleEditClick(project); }} 
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }} 
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-500 mb-6 flex-1 line-clamp-2">
                    {project.description}
                  </p>
                  
                  <div className="flex items-center justify-between text-xs text-gray-400 pt-4 border-t border-gray-50 mt-auto">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {project.date}
                    </div>
                    <span className="font-bold text-gray-900">₱{(project.financialData?.initialCapital || 0).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* CREATE/EDIT PROJECT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="bg-white rounded-2xl w-full max-w-lg z-10 shadow-2xl animate-in fade-in zoom-in duration-200 relative">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {editingProjectId ? "Edit Project" : "Create New Project"}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {editingProjectId ? "Update your feasibility study details." : "Set up a new feasibility study project to begin your analysis."}
                </p>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveProject} className="p-6 space-y-5 bg-gray-50/50 rounded-b-2xl">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-900">Project Name</label>
                <input 
                  type="text" 
                  autoFocus
                  required
                  placeholder="e.g., Coffee Shop Startup" 
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#249c74] focus:border-transparent transition-all text-sm"
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-900">Description</label>
                <textarea 
                  rows={3}
                  placeholder="Brief description of your feasibility study..." 
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#249c74] focus:border-transparent transition-all text-sm resize-none"
                />
              </div>

              {/* Category Dropdown */}
              <div className="space-y-1.5 relative">
                <label className="text-sm font-semibold text-gray-900">Category</label>
                
                <div 
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg cursor-pointer flex items-center justify-between text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCategoryMenuOpen(!isCategoryMenuOpen);
                  }}
                >
                  <span className={newProjectCategory ? 'text-gray-900' : 'text-gray-400'}>
                    {newProjectCategory || "Select a category"}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isCategoryMenuOpen ? 'rotate-180' : ''}`} />
                </div>
                
                {isCategoryMenuOpen && (
                  <div className="absolute left-0 top-[calc(100%+0.5rem)] w-full bg-white border border-gray-100 shadow-lg rounded-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100 origin-top">
                    {[
                      "Food & Beverage",
                      "Education",
                      "Services",
                      "Technology",
                      "Retail"
                    ].map(option => (
                      <button 
                        key={option}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setNewProjectCategory(option);
                          setIsCategoryMenuOpen(false);
                        }} 
                        className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors ${newProjectCategory === option ? 'bg-[#249c74]/10 text-[#249c74]' : 'text-gray-700 hover:bg-gray-50'}`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 mt-2">
                <button type="button" onClick={closeModal} className="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2.5 text-sm font-semibold text-white bg-[#249c74] hover:bg-[#1e8563] rounded-lg shadow-sm shadow-green-900/10 transition-all">
                  {editingProjectId ? "Save Changes" : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LOGOUT CONFIRMATION */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowLogoutConfirm(false)} />
          <div className="bg-white rounded-lg p-6 z-10 w-11/12 max-w-md shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold mb-2">Confirm logout</h3>
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to log out?</p>
            <div className="flex justify-end gap-3">
              <button className="px-4 py-2 rounded-lg border text-sm font-semibold" onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
              <button className="px-4 py-2 rounded-lg bg-[#249c74] hover:bg-[#1e8563] text-white text-sm font-semibold shadow-md" onClick={() => { setShowLogoutConfirm(false); handleLogout(); }}>
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