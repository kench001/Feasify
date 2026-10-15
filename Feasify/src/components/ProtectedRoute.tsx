import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const [authState, setAuthState] = useState<{
    isLoading: boolean;
    isAuthenticated: boolean;
    role?: string;
  }>({
    isLoading: true,
    isAuthenticated: false,
  });
  const location = useLocation();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAuthState({ isLoading: false, isAuthenticated: false });
        return;
      }

      // Special case for default hardcoded chairperson email
      if (user.email?.toLowerCase() === "chairperson@gmail.com") {
        setAuthState({ isLoading: false, isAuthenticated: true, role: "Chairperson" });
        return;
      }

      if (allowedRoles && allowedRoles.length > 0) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          const role = userDoc.exists() ? (userDoc.data().role || "Student") : "Student";
          setAuthState({ isLoading: false, isAuthenticated: true, role });
        } catch (e) {
          console.warn("Failed to retrieve user role for protection:", e);
          setAuthState({ isLoading: false, isAuthenticated: true, role: "Student" });
        }
      } else {
        setAuthState({ isLoading: false, isAuthenticated: true });
      }
    });

    return () => unsub();
  }, [allowedRoles]);

  if (authState.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <div className="w-8 h-8 border-4 border-[#122244] border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Verifying session...</p>
      </div>
    );
  }

  if (!authState.isAuthenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && authState.role) {
    if (!allowedRoles.includes(authState.role)) {
      if (authState.role === "Chairperson") return <Navigate to="/admin/users" replace />;
      if (authState.role === "Adviser") return <Navigate to="/adviser/dashboard" replace />;
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
