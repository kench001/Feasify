import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { signOutUser } from "./firebase";
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
  ArrowUpRight,
  CheckCircle2,
  Clock,
  ArrowRight,
} from "lucide-react";

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const handleLogout = async () => {
    try {
      await signOutUser();
    } catch (e) {
      // ignore
    }
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      // ignore
    }
    navigate("/");
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const uid = u.uid;
          const snap = await getDoc(doc(db, "users", uid));
          if (snap.exists()) {
            const data = snap.data() as any;
            const first = data.firstName || "";
            const last = data.lastName || "";
            setUserName([first, last].filter(Boolean).join(" ") || u.displayName || "");
            setUserEmail(data.email || u.email || "");
          } else {
            setUserName(u.displayName || (u.email ? u.email.split("@")[0] : ""));
            setUserEmail(u.email || "");
          }
        } catch (e) {
          setUserName(u.displayName || (u.email ? u.email.split("@")[0] : ""));
          setUserEmail(u.email || "");
        }
      } else {
        setUserName("");
        setUserEmail("");
      }
    });
    return () => unsub();
  }, []);
  return (
    <div className="flex min-h-screen bg-gray-50/50">
      {/* SIDEBAR: Professional Dark Navigation */}
      <aside className="hidden lg:flex w-64 bg-[#0f171e] text-white flex-col fixed inset-y-0 shadow-xl">
        <div className="p-6 flex items-center gap-2 border-b border-gray-800">
          <div className="bg-[#249c74] p-1.5 rounded-md">
            <Zap className="w-5 h-5 text-white fill-current" />
          </div>
          <span className="text-xl font-bold tracking-tight">FeasiFy</span>
        </div>

        <nav className="flex-1 p-4 space-y-8 mt-4">
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 px-2">
              Main Menu
            </p>
            <div className="space-y-1">
              {[
                { name: "Dashboard", icon: LayoutDashboard, route: "/dashboard" },
                { name: "Projects", icon: Folder, route: "/projects" },
                { name: "Financial Input", icon: FileEdit, route: "/financial-input" },
                { name: "AI Analysis", icon: Zap, route: "/ai-analysis" },
                { name: "Reports", icon: BarChart3, route: "/reports" },
              ].map((item) => (
                <button
                  key={item.name}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${item.route === "/dashboard" ? "bg-[#249c74] text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
                  onClick={() => item.route && navigate(item.route)}
                >
                  <item.icon className="w-4 h-4" /> {item.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 px-2">
              Account
            </p>
            <div className="space-y-1">
              {[
                { name: "Profile", icon: User },
                { name: "Settings", icon: Settings },
                { name: "Logout", icon: ShieldAlert },
              ].map((item) => (
                <button
                  key={item.name}
                  onClick={() => (item.name === "Logout" ? setShowLogoutConfirm(true) : undefined)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
                >
                  <item.icon className="w-4 h-4" /> {item.name}
                </button>
              ))}
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-gray-800 bg-[#0a1118]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#249c74] flex items-center justify-center font-bold">
              {(() => {
                const parts = userName.trim().split(/\s+/).filter(Boolean);
                if (parts.length === 0) return "U";
                const initials = parts.map((p) => p[0]).slice(0, 2).join("");
                return initials.toUpperCase();
              })()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{userName || "User"}</p>
              <p className="text-xs text-gray-500 truncate">{userEmail || ""}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 lg:ml-64 p-4 md:p-8">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">
              Overview of your feasibility studies and key metrics
            </p>
          </div>
          <button
            className="flex items-center gap-2 bg-[#249c74] hover:bg-[#1e8563] text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all shadow-md shadow-green-900/10"
            onClick={() => navigate("/projects")}
          >
            <Plus className="w-4 h-4" /> New Project
          </button>
        </div>

        {/* STATS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "Total Projects",
              value: "12",
              sub: "+2 this month",
              icon: Folder,
            },
            {
              label: "Feasible",
              value: "8",
              sub: "67% success rate",
              icon: CheckCircle2,
            },
            {
              label: "In Progress",
              value: "3",
              sub: "Active analyses",
              icon: Clock,
            },
            {
              label: "Avg. ROI",
              value: "24.5%",
              sub: "+3.2% vs last quarter",
              icon: BarChart3,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-gray-50 rounded-lg group-hover:bg-green-50 transition-colors">
                  <stat.icon className="w-5 h-5 text-gray-400 group-hover:text-[#249c74]" />
                </div>
                <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-[#249c74]" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs font-semibold text-gray-500 mb-1">
                {stat.label}
              </p>
              <p className="text-[10px] text-gray-400 font-medium">
                {stat.sub}
              </p>
            </div>
          ))}
        </div>

        {/* BOTTOM SECTION: RECENT PROJECTS */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-50 flex justify-between items-center">
            <h3 className="font-bold text-gray-900">Recent Projects</h3>
            <button className="text-xs font-bold text-[#249c74] hover:underline flex items-center gap-1" onClick={() => navigate("/projects")}>
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {[
              {
                name: "Coffee Shop Startup",
                status: "Feasible",
                color: "bg-green-100 text-green-700",
                progress: "100%",
              },
              {
                name: "Online Tutoring Platform",
                status: "In Progress",
                color: "bg-blue-100 text-blue-700",
                progress: "65%",
              },
              {
                name: "Laundry Service Business",
                status: "Needs Review",
                color: "bg-gray-100 text-gray-700",
                progress: "40%",
              },
            ].map((project) => (
              <div
                key={project.name}
                className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-gray-900">
                      {project.name}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      Last updated: Feb 10, 2026
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${project.color}`}
                  >
                    {project.status}
                  </span>
                </div>
                <div className="w-full md:w-48 flex items-center gap-3">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#249c74]"
                      style={{ width: project.progress }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-gray-500">
                    {project.progress}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowLogoutConfirm(false)} />
          <div className="bg-white rounded-lg p-6 z-10 w-11/12 max-w-md shadow-lg">
            <h3 className="text-lg font-bold mb-2">Confirm logout</h3>
            <p className="text-sm text-gray-600 mb-4">Are you sure you want to log out?</p>
            <div className="flex justify-end gap-3">
              <button className="px-4 py-2 rounded-lg border" onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
              <button
                className="px-4 py-2 rounded-lg bg-[#249c74] text-white"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  handleLogout();
                }}
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

export default Dashboard;
