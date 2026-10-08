import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
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
  useEffect(() => {
    let isHovered = false;

    const handleMouseMove = (e: MouseEvent) => {
      if (window.innerWidth < 1024) {
        if (isHovered) {
          isHovered = false;
          document.documentElement.classList.remove("sidebar-hovered");
        }
        return;
      }

      const aside = document.querySelector("aside");
      if (!aside) {
        // Aside might temporarily unmount during route transitions
        return;
      }

      const rect = aside.getBoundingClientRect();
      // When expanded, the hit zone is 256px (w-64 = 16rem = 256px)
      // When folded, the hit zone is the folded aside width (~64px)
      const hitWidth = isHovered ? Math.max(rect.width, 256) : rect.width;

      const inSidebar =
        e.clientX >= 0 &&
        e.clientX <= hitWidth &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      if (inSidebar && !isHovered) {
        isHovered = true;
        document.documentElement.classList.add("sidebar-hovered");
      } else if (!inSidebar && isHovered) {
        isHovered = false;
        document.documentElement.classList.remove("sidebar-hovered");
      }
    };

    const handleMouseLeave = () => {
      if (isHovered) {
        isHovered = false;
        document.documentElement.classList.remove("sidebar-hovered");
      }
    };

    const handleWindowResize = () => {
      if (window.innerWidth < 1024 && isHovered) {
        isHovered = false;
        document.documentElement.classList.remove("sidebar-hovered");
      }
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("resize", handleWindowResize);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("resize", handleWindowResize);
      document.documentElement.classList.remove("sidebar-hovered");
    };
  }, []);

  return (
    <SkeletonTheme baseColor="#e8ecf0" highlightColor="#f4f6f8">
    <Router>
      <Routes>
        {/* This is the starting page (Login/Signup) */}
        <Route path="/" element={<Auth />} />

        {/* Password Reset Handlers */}
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth/action" element={<ResetPassword />} />
        <Route path="/__/auth/action" element={<ResetPassword />} />

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

        {/* Student Profile / Settings module (combined in Settings with tabs) */}
        <Route path="/profile" element={<SettingsPage defaultTab="profile" />} />
        <Route path="/settings" element={<SettingsPage defaultTab="profile" />} />
        <Route path="/audit-trail" element={<SettingsPage defaultTab="audit" />} />
        <Route path="/notifications" element={<Notifications />} />

        {/* Admin / Chairperson Modules */}
        <Route path="/admin/users" element={<ChairpersonModule />} />
        <Route path="/admin/projects" element={<ChairpersonFeasib />} />
        <Route path="/admin/chairpersonnotification" element={<ChairpersonNotifications />} />
        <Route path="/admin/chairpersonsettings" element={<ChairpersonSettings defaultTab="profile" />} />
        <Route path="/admin/settings" element={<ChairpersonSettings defaultTab="profile" />} />
        <Route path="/admin/profile" element={<ChairpersonSettings defaultTab="profile" />} />
        <Route path="/admin/audit-trail" element={<ChairpersonSettings defaultTab="audit" />} />

        {/* Adviser Modules */}
        <Route path="/adviser/dashboard" element={<AdviserDashboard />} />
        <Route path="/adviser/profile" element={<AdviserSettings defaultTab="profile" />} />
        <Route path="/adviser/settings" element={<AdviserSettings defaultTab="profile" />} />
        <Route path="/adviser/audit-trail" element={<AdviserSettings defaultTab="audit" />} />
        <Route path="/adviser/airules" element={<AdviserAIRules />} />
        <Route path="/adviser/notifications" element={<AdviserNotifications />} />
      </Routes>
    </Router>
    </SkeletonTheme>
  );
}

export default App;
