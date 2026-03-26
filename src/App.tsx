import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
// Import your modules
import Auth from "./Auth";
import Dashboard from "./Dashboard";
import Projects from "./Projects";
import Financial_input from "./Financial_input";
import AI_Analysis from "./AI_Analysis";
import Reports from "./Reports";
import Messages from "./Messages";

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
      </Routes>
    </Router>
  );
}

export default App;
