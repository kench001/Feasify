import React, { useEffect, useState } from "react";
import Skeleton from "react-loading-skeleton";
import { useNavigate } from "react-router-dom";
import { auth, db, signOutUser } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  limit
} from "firebase/firestore";
import {
  Users,
  FileText,
  User,
  Settings,
  ShieldAlert,
  Sidebar as SidebarIcon,
  Search,
  Clock,
  Eye,
  X,
  ShieldCheck,
  Bell,
  CheckCircle2,
  Filter
} from "lucide-react";

export interface AuditRecord {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "APPROVE" | "REJECT" | "REVISION" | "SUBMIT" | "LOGIN";
  sectionCode: string;
  description: string;
  recordId?: string;
  oldValue?: any;
  newValue?: any;
  status: string;
  createdAt: any;
}

const ChairpersonAuditTrail: React.FC = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("Chairperson");
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  // Audit Logs Data
  const [logs, setLogs] = useState<AuditRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter States
  const [selectedSectionFilter, setSelectedSectionFilter] = useState("ALL");
  const [selectedActionFilter, setSelectedActionFilter] = useState("ALL");
  const [selectedUserFilter, setSelectedUserFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Detail Modal State
  const [selectedLog, setSelectedLog] = useState<AuditRecord | null>(null);

  // Auth Guard
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u || u.email !== "chairperson@gmail.com") {
        navigate("/");
      }
    });
    return () => unsub();
  }, [navigate]);

  // Real-time Audit Logs Query for Chairperson (ALL audit records across all sections)
  useEffect(() => {
    setIsLoading(true);
    const logsQuery = query(
      collection(db, "audit_logs"),
      orderBy("createdAt", "desc"),
      limit(300)
    );

    const unsubLogs = onSnapshot(
      logsQuery,
      (snapshot) => {
        const fetchedLogs: AuditRecord[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now())
          } as AuditRecord;
        });
        setLogs(fetchedLogs);
        setIsLoading(false);
      },
      (error) => {
        console.error("Chairperson audit logs error:", error);
        setIsLoading(false);
      }
    );

    return () => unsubLogs();
  }, []);

  const handleLogout = async () => {
    try {
      await signOutUser();
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {}
    navigate("/");
  };

  const getInitials = (name: string) =>
    name ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "CP";

  // Dynamic Options for Filters
  const uniqueSections = Array.from(new Set(logs.map((l) => l.sectionCode).filter(Boolean))).sort();
  const uniqueUsers = Array.from(new Set(logs.map((l) => l.userName).filter(Boolean))).sort();

  // Filtered Logs
  const filteredLogs = logs.filter((log) => {
    // Section filter
    if (selectedSectionFilter !== "ALL" && log.sectionCode !== selectedSectionFilter) {
      return false;
    }
    // Action filter
    if (selectedActionFilter !== "ALL" && log.action !== selectedActionFilter) {
      return false;
    }
    // User filter
    if (selectedUserFilter !== "ALL" && log.userName !== selectedUserFilter) {
      return false;
    }
    // Text search
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchDescription = log.description?.toLowerCase().includes(q);
      const matchUser = log.userName?.toLowerCase().includes(q);
      const matchSection = log.sectionCode?.toLowerCase().includes(q);
      const matchAction = log.action?.toLowerCase().includes(q);
      if (!matchDescription && !matchUser && !matchSection && !matchAction) return false;
    }
    // Date range filter
    if (startDate) {
      const start = new Date(startDate);
      if (new Date(log.createdAt) < start) return false;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (new Date(log.createdAt) > end) return false;
    }
    return true;
  });

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case "CREATE":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "UPDATE":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "DELETE":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "APPROVE":
        return "bg-teal-50 text-teal-700 border-teal-200";
      case "REJECT":
        return "bg-red-50 text-red-700 border-red-200";
      case "REVISION":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "SUBMIT":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const formatDate = (dateObj: any) => {
    if (!dateObj) return "N/A";
    const d = new Date(dateObj);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  };

  return (
    <div className="flex min-h-screen bg-gray-50/30 overflow-hidden font-sans">
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[50] lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ADMIN SIDEBAR */}
      <aside
        className={`flex w-72 bg-[#122244] text-white flex-col fixed inset-y-0 shadow-xl z-[60] transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="p-6 flex items-center gap-3 border-b border-white/10">
          <img src="/dashboard logo.png" alt="FeasiFy" className="w-70 h-20 object-contain" />
        </div>

        <nav className="flex-1 p-4 space-y-8 mt-4">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">Main Menu</p>
            <div className="space-y-2">
              <button
                onClick={() => navigate("/admin/users")}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-all"
              >
                <Users className="w-5 h-5" /> User Accounts Management
              </button>
              <button
                onClick={() => navigate("/admin/projects")}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-all"
              >
                <FileText className="w-5 h-5" /> Business Feasibility Management
              </button>
              <button
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold bg-[#c9a654] text-white transition-all shadow-md"
              >
                <Clock className="w-5 h-5" /> Audit Trail
              </button>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">Account</p>
            <div className="space-y-1">
              <button
                onClick={() => navigate("/admin/profile")}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-all"
              >
                <User className="w-5 h-5" /> Profile
              </button>
              <button
                onClick={() => navigate("/admin/chairpersonsettings")}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-all"
              >
                <Settings className="w-5 h-5" /> Settings
              </button>
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-all"
              >
                <ShieldAlert className="w-5 h-5" /> Logout
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
              <p className="text-[10px] text-gray-400 truncate">FM Chairperson</p>
            </div>
            <button
              onClick={() => navigate("/admin/chairpersonnotification")}
              className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-all relative shrink-0"
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
      <main
        className={`flex-1 transition-all duration-300 ease-in-out min-h-screen ${
          isSidebarOpen ? "lg:ml-72" : "ml-0"
        }`}
      >
        <div className="bg-white border-b border-gray-100 p-4 flex items-center gap-2 text-sm text-gray-500 sticky top-0 z-10 shadow-xs">
          <SidebarIcon
            className="w-4 h-4 cursor-pointer hover:text-gray-800 transition-colors"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          />
          <span className="mx-2">|</span>
          <span className="font-semibold text-gray-900">System Audit Trail</span>
        </div>

        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
          {/* PAGE HEADER */}
          <div>
            <h1 className="text-3xl font-bold text-[#122244]">System Audit Trail</h1>
            <p className="text-sm text-gray-500 mt-1">
              Chairperson Overview — Complete log of user actions, updates, and proposal revisions across all university sections.
            </p>
          </div>

          {/* FILTERS TOOLBAR */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* SECTION FILTER */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Section
                </label>
                <select
                  value={selectedSectionFilter}
                  onChange={(e) => setSelectedSectionFilter(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c9a654]/50"
                >
                  <option value="ALL">All Sections</option>
                  {uniqueSections.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
              </div>

              {/* USER FILTER */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  User
                </label>
                <select
                  value={selectedUserFilter}
                  onChange={(e) => setSelectedUserFilter(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c9a654]/50"
                >
                  <option value="ALL">All Users</option>
                  {uniqueUsers.map((uName) => (
                    <option key={uName} value={uName}>
                      {uName}
                    </option>
                  ))}
                </select>
              </div>

              {/* ACTION FILTER */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Action
                </label>
                <select
                  value={selectedActionFilter}
                  onChange={(e) => setSelectedActionFilter(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c9a654]/50"
                >
                  <option value="ALL">All Actions</option>
                  <option value="CREATE">CREATE</option>
                  <option value="UPDATE">UPDATE</option>
                  <option value="DELETE">DELETE</option>
                  <option value="APPROVE">APPROVE</option>
                  <option value="REJECT">REJECT</option>
                  <option value="REVISION">REVISION</option>
                  <option value="SUBMIT">SUBMIT</option>
                </select>
              </div>

              {/* START DATE */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c9a654]/50"
                />
              </div>

              {/* END DATE */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c9a654]/50"
                />
              </div>
            </div>

            {/* SEARCH INPUT */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search audit trails across all sections..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c9a654]/50 transition-all"
              />
            </div>
          </div>

          {/* AUDIT LOGS TABLE */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50/70 text-gray-500 font-bold uppercase tracking-wider text-[11px] border-b border-gray-100">
                  <tr>
                    <th className="px-5 py-4">Date & Time</th>
                    <th className="px-5 py-4">Action</th>
                    <th className="px-5 py-4">Section</th>
                    <th className="px-5 py-4">Description</th>
                    <th className="px-5 py-4">User</th>
                    <th className="px-5 py-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}>
                        <td className="px-5 py-4"><Skeleton width={130} /></td>
                        <td className="px-5 py-4"><Skeleton width={70} height={20} borderRadius={6} /></td>
                        <td className="px-5 py-4"><Skeleton width={60} /></td>
                        <td className="px-5 py-4"><Skeleton width={240} /></td>
                        <td className="px-5 py-4"><Skeleton width={120} /></td>
                        <td className="px-5 py-4 text-right"><Skeleton width={40} /></td>
                      </tr>
                    ))
                  ) : filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-gray-400">
                        <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="font-semibold text-gray-600">No audit records match your filters</p>
                        <p className="text-[11px] text-gray-400 mt-1">Try resetting search or section selection.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-amber-50/30 transition-colors">
                        <td className="px-5 py-4 text-gray-600 whitespace-nowrap">
                          {formatDate(log.createdAt)}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold border ${getActionBadgeColor(
                              log.action
                            )}`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap font-bold text-[#122244]">
                          <span className="inline-block bg-gray-100 text-gray-800 px-2 py-0.5 rounded font-mono text-[11px]">
                            {log.sectionCode || "N/A"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-gray-900 font-semibold max-w-md truncate">
                          {log.description}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-gray-700">
                          <div className="font-semibold">{log.userName || "System"}</div>
                          {log.userRole && (
                            <span className="text-[10px] text-gray-400 block">{log.userRole}</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="p-1.5 text-gray-500 hover:text-[#c9a654] hover:bg-amber-50 rounded-lg transition-colors inline-flex items-center gap-1 font-semibold text-[11px]"
                            title="View log details"
                          >
                            <Eye className="w-3.5 h-3.5" /> View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* SUMMARY FOOTER */}
            <div className="px-5 py-3 bg-gray-50/50 border-t border-gray-100 text-xs text-gray-500 flex items-center justify-between">
              <span>Showing {filteredLogs.length} total activity records</span>
              <span className="text-[11px] text-gray-400">Chairperson Full System Access</span>
            </div>
          </div>
        </div>
      </main>

      {/* DETAIL MODAL */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-[#122244] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#c9a654]" />
                <h3 className="font-bold text-base">Audit Trail Entry Details</h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 text-gray-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Timestamp</span>
                  <span className="font-semibold text-gray-800">{formatDate(selectedLog.createdAt)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Section Code</span>
                  <span className="font-bold text-[#122244] bg-white border border-gray-200 px-2 py-0.5 rounded text-[11px] inline-block mt-0.5">
                    {selectedLog.sectionCode}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Action</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border mt-0.5 ${getActionBadgeColor(selectedLog.action)}`}>
                    {selectedLog.action}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">User</span>
                  <span className="font-semibold text-gray-800">{selectedLog.userName} ({selectedLog.userRole || "User"})</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Description</span>
                <p className="p-3 bg-gray-50 rounded-xl text-gray-900 font-medium border border-gray-100">
                  {selectedLog.description}
                </p>
              </div>

              {selectedLog.recordId && (
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Record ID</span>
                  <code className="block p-2 bg-gray-100 rounded-lg text-gray-700 font-mono text-[11px]">
                    {selectedLog.recordId}
                  </code>
                </div>
              )}

              {selectedLog.oldValue && (
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Previous State</span>
                  <pre className="p-3 bg-gray-900 text-gray-100 rounded-xl overflow-x-auto text-[10px] font-mono">
                    {JSON.stringify(selectedLog.oldValue, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.newValue && (
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1">New State</span>
                  <pre className="p-3 bg-gray-900 text-emerald-300 rounded-xl overflow-x-auto text-[10px] font-mono">
                    {JSON.stringify(selectedLog.newValue, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-[#122244] text-white font-semibold rounded-xl text-xs hover:bg-[#1c3260] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Logout</h3>
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to log out of your account?</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-700 border border-gray-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-xs font-semibold bg-red-600 text-white rounded-xl"
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

export default ChairpersonAuditTrail;
