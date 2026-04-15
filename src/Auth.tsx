import React, { useState } from "react";
import { Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { loginUser, db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

const Auth: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false); // Loading state
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState("");

  const navigate = useNavigate();

  const validate = () => {
    const next: Record<string, string> = {};

    if (!loginForm.email) {
      next.email = "Email is required";
    } else {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!re.test(loginForm.email)) next.email = "Enter a valid email address";
    }

    if (!loginForm.password) {
      next.password = "Password is required";
    } else {
      if (loginForm.password.length < 8) {
        next.password = "Password must be at least 8 characters";
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError("");
    if (!validate()) return;
    
    setIsAuthenticating(true); 
    
    try {
      const cred = await loginUser(loginForm.email, loginForm.password);
      
      if (cred.user.email?.toLowerCase() === "chairperson@gmail.com") {
        navigate("/admin/users");
        return; 
      }

      const userDoc = await getDoc(doc(db, "users", cred.user.uid));
      let firstName = "";
      let role = "Student"; // Default role
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        firstName = data.firstName || "";
        role = data.role || "Student";
      }
      
      // --- NEW ROUTING LOGIC ---
      if (role === "Adviser") {
        navigate("/adviser/dashboard", { state: { showWelcome: true, firstName } });
      } else {
        navigate("/dashboard", { state: { showWelcome: true, firstName } });
      }
      
    } catch (err: any) {
      // ... (keep your existing error handling)
      setIsAuthenticating(false); 
      const code = err?.code as string | undefined;
      if (code === "auth/wrong-password" || code === "auth/user-not-found" || code === "auth/invalid-credential") {
        setApiError("Wrong email or password");
      } else if (code === "auth/invalid-email") {
        setApiError("Invalid email address");
      } else {
        setApiError(err?.message || "Authentication failed");
      }
    }
  };

  return (
    <>
      <div className="min-h-screen flex flex-col lg:flex-row bg-white relative bg-cover bg-center" style={{ backgroundImage: "url('/BG.1.png')" }}>
        {/* LEFT SIDE */}
        <div className="relative w-full lg:w-1/2 overflow-hidden">
          
          <div className="relative z-10 flex min-h-screen flex-col justify-between px-8 py-10 md:px-12 md:py-14 lg:px-16 lg:py-20 text-white">
            <div>
              <div className="flex items-center gap-3 mb-10">
                <img src="Logo w Name.png" alt="FeasiFy" className="h-80 w-auto object-contain"style={{ marginTop: '-160px' }}  />
                
              </div>

              <div className="max-w-md">
                <h1 className="text-4xl md:text-5xl font-bold leading-tight tracking-tight mb-6">
                  Make smarter decisions with data.
                </h1>
                <p className="text-sm md:text-base text-gray-300 mb-8 leading-relaxed">
                  Analyze feasibility, track metrics and generate AI insights.
                </p>

                <ul className="space-y-4">
                  {[
                    "Guided financial input",
                    "AI feasibility scoring",
                    "PDF export",
                  ].map((text, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-gray-200">
                      <div className="flex-shrink-0">
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="text-xs text-gray-400 italic">
              FeasiFy © 2026.
            </div>
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="relative w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-10 md:p-12 lg:p-16 overflow-hidden">
          <div className="absolute inset-0 opacity-15">
            <svg viewBox="0 0 800 800" className="absolute right-[-15%] top-0 h-full w-[140%]">
              <defs>
                <pattern id="hexPattern" width="120" height="104" patternUnits="userSpaceOnUse">
                  <path d="M60 0 L120 30 L120 74 L60 104 L0 74 L0 30 Z" fill="none" stroke="#d4af37" strokeWidth="1.5" />
                </pattern>
              </defs>
              <rect width="800" height="800" fill="url(#hexPattern)" />
            </svg>
          </div>

          <div className="relative w-full max-w-md">
            <div className="flex justify-center gap-6 mb-10">
              <img src="/Caba Logo.png" alt="College of Business Administration" className="h-25 w-25 object-contain rounded-full border border-gray-300 bg-white p-1" />
              <img src="/fm.jpg" alt="Finance Executives" className="h-25 w-25 object-contain rounded-full border border-gray-300 bg-white p-1" />
              <img src="/plv.jpg" alt="Pamantasan ng Lungsod ng Valenzuela" className="h-25 w-25 object-contain rounded-full border border-gray-300 bg-white p-1" />
            </div>

            <p className="text-center text-sm font-bold uppercase tracking-widest text-slate-900 mb-12">
              Pamantasan ng Lungsod ng Valenzuela
            </p>

            <div className="bg-white">
              <form className="space-y-6" onSubmit={handleLogin} noValidate>
                {apiError && <p className="text-sm text-red-500 mb-4">{apiError}</p>}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-800 mb-3">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      placeholder="you@plv.edu.ph"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                      className={`w-full rounded-lg border px-4 py-3 pl-12 text-sm bg-gray-100 outline-none transition ${errors.email ? "border-red-300" : "border-gray-300 focus:border-[#0f4d96] focus:ring-2 focus:ring-blue-100"}`}
                    />
                  </div>
                  {errors.email && <p className="mt-2 text-xs text-red-500">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-800 mb-3">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      className={`w-full rounded-lg border px-4 py-3 pl-12 pr-12 text-sm bg-gray-100 outline-none transition ${errors.password ? "border-red-300" : "border-gray-300 focus:border-[#0f4d96] focus:ring-2 focus:ring-blue-100"}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.password && <p className="mt-2 text-xs text-red-500">{errors.password}</p>}
                  <div className="mt-2 text-right">
                    <a href="#" className="text-xs font-bold uppercase tracking-wider text-slate-800 hover:text-[#0f4d96]">
                      Forgot Password?
                    </a>
                  </div>
                </div>

                <button className="mt-8 w-full rounded-lg bg-[#0f4d96] px-6 py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-md transition hover:bg-[#0a3a7a] active:scale-[0.98]">
                  Login
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* LOADING OVERLAY MODAL */}
      {isAuthenticating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm transition-all duration-300">
          <div className="flex flex-col items-center justify-center bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
            <Loader2 className="w-12 h-12 text-[#0f4d96] animate-spin mb-4" />
            <h3 className="text-lg font-bold text-slate-900">Logging in...</h3>
            <p className="text-sm text-slate-500 mt-1">Please wait while we secure your connection.</p>
          </div>
        </div>
      )}
    </>
  );
};

export default Auth;