import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
// Import your modules
import Auth from "./Auth";
import Dashboard from "./Dashboard";

function App() {
  return (
    <Router>
      <Routes>
        {/* This is the starting page (Login/Signup) */}
        <Route path="/" element={<Auth />} />

        {/* This is the Dashboard page users see after signing in */}
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
