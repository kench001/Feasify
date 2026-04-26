import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
// Import your modules
import Auth from "./Auth";
import Dashboard from "./Dashboard";
import Projects from "./Projects";
import Financial_input from "./Financial_input";
import AI_Analysis from "./AI_Analysis";
import Reports from "./Reports";
import Messages from "./Messages";
import Profile from "./Profile";
import SettingsPage from "./Settings";
import ChairpersonSettings from "./ChairpersonSettings";
import Notifications from "./Notifications";
import AdminUsers from "./AdminUsers";
import AdminFeasibility from "./AdminFeasibility";
import AdminProfile from "./Admin-Profile";
import AdviserDashboard from "./AdviserDashboard";
import AdviserSettings from "./Adviser-Settings";
import AdviserProfile from "./Adviser-Profile";

function App() {
  return (
    <Router>
      <Routes>
        {/* This is the starting page (Login/Signup) */}
        <Route path="/" element={<Auth />} />

        {/* This is the Dashboard page users see after signing in */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Projects module */}
        <Route path="/projects" element={<Projects />} />

        {/* Financial Input module */}
        <Route path="/financial-input" element={<Financial_input />} />

        {/* AI Analysis module */}
        <Route path="/ai-analysis" element={<AI_Analysis />} />

        {/* Reports module */}
        <Route path="/reports" element={<Reports />} />

        {/* Messages module */}
        <Route path="/messages" element={<Messages />} />

        {/* Profile module */}
        <Route path="/profile" element={<Profile />} />

        {/* Settings module */}
        <Route path="/settings" element={<SettingsPage />} />
        
        {/* Chairperson Settings module */}
        <Route path="/admin/chairpersonsettings" element={<ChairpersonSettings />} />
        
        <Route path="/notifications" element={<Notifications />} />

        {/* Admin Modules */}
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/profile" element={<AdminProfile />} />
        <Route path="/admin/projects" element={<AdminFeasibility />} /> {/* <-- Add this route */}

        {/* Adviser Modules */}
        <Route path="/adviser/dashboard" element={<AdviserDashboard />} />
        <Route path="/adviser/settings" element={<AdviserSettings />} />
        <Route path="/adviser/profile" element={<AdviserProfile />} />
      </Routes>
    </Router>
  );
}

export default App;
