import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css"; // Crucial: This must be here for Tailwind to work!

// Initialize dark mode if previously enabled
if (localStorage.getItem("feasify_theme") === "dark") {
  document.documentElement.classList.add("dark");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
