import React, { useState } from "react";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    navigate("/dashboard");
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row bg-white">
      {/* ADAPTIVE LEFT SECTION 
          Mobile: Top Banner (Small, focused)
          Desktop: Side Hero (Full height, detailed)
      */}
      <div className="w-full lg:w-1/2 bg-[#0f171e] p-8 md:p-12 lg:p-16 flex flex-col justify-between text-white transition-all duration-500">
        <div className="flex items-center gap-2 mb-8 lg:mb-0">
          <div className="bg-[#249c74] p-1.5 rounded-md text-white">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight">FeasiFy</span>
        </div>

        <div className="max-w-md mx-auto lg:mx-0">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4 lg:mb-6 leading-tight text-center lg:text-left">
            Make smarter business decisions with data.
          </h1>
          {/* Subtle change: Reduced text on mobile for better flow */}
          <p className="text-gray-400 text-sm md:text-base lg:text-lg mb-6 lg:mb-10 text-center lg:text-left">
            Analyze financial feasibility, compute key metrics, and get
            AI-powered insights.
          </p>

          {/* Feature list stays, but moves to a horizontal scroll or tight list on mobile */}
          <ul className="space-y-3 md:space-y-4 hidden sm:block">
            {[
              "Input financial data with guided forms",
              "AI-powered feasibility scoring",
              "Export professional PDF reports",
            ].map((text, i) => (
              <li
                key={i}
                className="flex items-center gap-3 text-xs md:text-sm text-gray-300"
              >
                <span className="w-2 h-2 rounded-full bg-[#249c74] shrink-0" />{" "}
                {text}
              </li>
            ))}
          </ul>
        </div>

        <div className="text-[10px] md:text-sm text-gray-500 font-medium italic mt-8 text-center lg:text-left">
          FeasiFy © 2026.
        </div>
      </div>

      {/* RIGHT SECTION: FORM 
          Mobile: Pulls up slightly over the dark background for a "layered" look
      */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 md:p-16 -mt-6 lg:mt-0 bg-white rounded-t-3xl lg:rounded-none z-10">
        <div className="w-full max-w-185">
          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
              {isLogin ? "Welcome back" : "Get started for free"}
            </h2>
            <p className="text-gray-500 text-sm mt-2">
              {isLogin
                ? "Sign in to your account to continue"
                : "Create an account to start analyzing financial feasibility"}
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex bg-gray-100 p-1 rounded-xl mb-8">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${isLogin ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${!isLogin ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
            >
              Create Account
            </button>
          </div>

          <form className="space-y-5" onSubmit={handleLogin}>
            {!isLogin && (
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-bold text-gray-700 uppercase">
                    First name
                  </label>
                  <input
                    type="text"
                    placeholder="Juan"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#249c74] outline-none transition-all"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-bold text-gray-700 uppercase">
                    Last name
                  </label>
                  <input
                    type="text"
                    placeholder="Dela Cruz"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#249c74] outline-none transition-all"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700 uppercase">
                Email
              </label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-[#249c74] transition-colors" />
                <input
                  type="email"
                  placeholder="you@university.edu"
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#249c74] focus:bg-white outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-gray-700 uppercase">
                  Password
                </label>
                {isLogin && (
                  <a
                    href="#"
                    className="text-[11px] font-bold text-[#249c74] hover:underline"
                  >
                    Forgot Password?
                  </a>
                )}
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-[#249c74] transition-colors" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder={isLogin ? "••••••••" : "Create a password"}
                  className="w-full pl-12 pr-12 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#249c74] focus:bg-white outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between py-1">
              <label
                className="flex items-center cursor-pointer group select-none"
                onClick={() => setRememberMe(!rememberMe)}
              >
                <div
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${rememberMe ? "bg-[#249c74] border-[#249c74]" : "bg-transparent border-gray-300 group-hover:border-[#249c74]"}`}
                >
                  {rememberMe && (
                    <Check className="w-3.5 h-3.5 text-white stroke-[4px]" />
                  )}
                </div>
                <span className="ml-3 text-sm font-medium text-gray-600 group-hover:text-gray-900 transition-colors">
                  Remember me
                </span>
              </label>
            </div>

            <button className="w-full bg-[#249c74] text-white font-bold py-4 rounded-xl hover:bg-[#1e8563] active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-900/10">
              {isLogin ? "Sign In" : "Create Account"}
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Auth;
