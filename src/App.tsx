import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
// Import your modules
import Auth from "./Auth";
import Dashboard from "./Dashboard";
import Projects from "./Projects";
import Financial_input from "./Financial_input";

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
      </Routes>
    </Router>
  );
}

export default App;
