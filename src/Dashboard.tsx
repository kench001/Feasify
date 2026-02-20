import React from "react";
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
                { name: "Dashboard", icon: LayoutDashboard, active: true },
                { name: "Projects", icon: Folder },
                { name: "Financial Input", icon: FileEdit },
                { name: "AI Analysis", icon: Zap },
                { name: "Reports", icon: BarChart3 },
              ].map((item) => (
                <button
                  key={item.name}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${item.active ? "bg-[#249c74] text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
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
                { name: "Admin", icon: ShieldAlert },
              ].map((item) => (
                <button
                  key={item.name}
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
              JD
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">Juan Dela Cruz</p>
              <p className="text-xs text-gray-500 truncate">
                juan@university.edu
              </p>
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
          <button className="flex items-center gap-2 bg-[#249c74] hover:bg-[#1e8563] text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all shadow-md shadow-green-900/10">
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
            <button className="text-xs font-bold text-[#249c74] hover:underline flex items-center gap-1">
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
    </div>
  );
};

export default Dashboard;
