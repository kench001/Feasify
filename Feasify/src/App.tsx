import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { SkeletonTheme } from "react-loading-skeleton";
import { LanguageProvider } from "./context/LanguageContext";
import "react-loading-skeleton/dist/skeleton.css";
import ProtectedRoute from "./components/ProtectedRoute";

// Import your modules
import Auth from "./Auth";
import Dashboard from "./Dashboard";
import Projects from "./Projects";
import Financial_input from "./Financial_input";
import AI_Analysis from "./AI_Analysis";
import Reports from "./Reports";
import Messages from "./Messages";
import SettingsPage from "./Settings";
import ChairpersonSettings from "./ChairpersonSettings";
import Notifications from "./Notifications";
import ChairpersonNotifications from "./ChairpersonNotifications";
import AdviserNotifications from "./AdviserNotifications";
import ChairpersonModule from "./ChairpersonModule";
import ChairpersonFeasib from "./ChairpersonFeasib";
import AdviserDashboard from "./AdviserDashboard";
import AdviserSettings from "./AdviserSettings";
import AdviserAIRules from "./AdviserAIRules";
import ResetPassword from "./ResetPassword";

function App() {
  return (
    <LanguageProvider>
    <SkeletonTheme baseColor="#e8ecf0" highlightColor="#f4f6f8">
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth/action" element={<ResetPassword />} />
        <Route path="/__/auth/action" element={<ResetPassword />} />

        {/* Student / Common Authenticated Modules */}
        <Route path="/dashboard" element={<ProtectedRoute allowedRoles={["Student", "Adviser", "Chairperson"]}><Dashboard /></ProtectedRoute>} />
        <Route path="/projects" element={<ProtectedRoute allowedRoles={["Student"]}><Projects /></ProtectedRoute>} />
        <Route path="/financial-input" element={<ProtectedRoute allowedRoles={["Student"]}><Financial_input /></ProtectedRoute>} />
        <Route path="/ai-analysis" element={<ProtectedRoute allowedRoles={["Student"]}><AI_Analysis /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute allowedRoles={["Student"]}><Reports /></ProtectedRoute>} />
        <Route path="/messages" element={<ProtectedRoute allowedRoles={["Student", "Adviser", "Chairperson"]}><Messages /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute allowedRoles={["Student"]}><SettingsPage defaultTab="profile" /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute allowedRoles={["Student"]}><SettingsPage defaultTab="profile" /></ProtectedRoute>} />
        <Route path="/audit-trail" element={<ProtectedRoute allowedRoles={["Student"]}><SettingsPage defaultTab="audit" /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute allowedRoles={["Student"]}><Notifications /></ProtectedRoute>} />

        {/* Admin / Chairperson Modules */}
        <Route path="/admin/users" element={<ProtectedRoute allowedRoles={["Chairperson"]}><ChairpersonModule /></ProtectedRoute>} />
        <Route path="/admin/projects" element={<ProtectedRoute allowedRoles={["Chairperson"]}><ChairpersonFeasib /></ProtectedRoute>} />
        <Route path="/admin/chairpersonnotification" element={<ProtectedRoute allowedRoles={["Chairperson"]}><ChairpersonNotifications /></ProtectedRoute>} />
        <Route path="/admin/chairpersonsettings" element={<ProtectedRoute allowedRoles={["Chairperson"]}><ChairpersonSettings defaultTab="profile" /></ProtectedRoute>} />
        <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={["Chairperson"]}><ChairpersonSettings defaultTab="profile" /></ProtectedRoute>} />
        <Route path="/admin/profile" element={<ProtectedRoute allowedRoles={["Chairperson"]}><ChairpersonSettings defaultTab="profile" /></ProtectedRoute>} />
        <Route path="/admin/audit-trail" element={<ProtectedRoute allowedRoles={["Chairperson"]}><ChairpersonSettings defaultTab="audit" /></ProtectedRoute>} />

        {/* Adviser Modules */}
        <Route path="/adviser/dashboard" element={<ProtectedRoute allowedRoles={["Adviser", "Chairperson"]}><AdviserDashboard /></ProtectedRoute>} />
        <Route path="/adviser/profile" element={<ProtectedRoute allowedRoles={["Adviser", "Chairperson"]}><AdviserSettings defaultTab="profile" /></ProtectedRoute>} />
        <Route path="/adviser/settings" element={<ProtectedRoute allowedRoles={["Adviser", "Chairperson"]}><AdviserSettings defaultTab="profile" /></ProtectedRoute>} />
        <Route path="/adviser/audit-trail" element={<ProtectedRoute allowedRoles={["Adviser", "Chairperson"]}><AdviserSettings defaultTab="audit" /></ProtectedRoute>} />
        <Route path="/adviser/airules" element={<ProtectedRoute allowedRoles={["Adviser", "Chairperson"]}><AdviserAIRules /></ProtectedRoute>} />
        <Route path="/adviser/notifications" element={<ProtectedRoute allowedRoles={["Adviser", "Chairperson"]}><AdviserNotifications /></ProtectedRoute>} />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
    </SkeletonTheme>
    </LanguageProvider>
  );
}

export default App;
