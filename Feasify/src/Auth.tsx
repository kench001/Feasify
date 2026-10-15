import React, { useState, useEffect } from "react";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  ArrowLeft,
  Send,
  ShieldCheck,
  Check,
} from "lucide-react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import {
  loginUser,
  sendResetPasswordEmail,
  verifyResetCode,
  confirmResetPassword,
  db,
} from "./firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

const Auth: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState("");
  const [successBanner, setSuccessBanner] = useState("");

  // 1. FORGOT PASSWORD MODAL STATES (Requesting email)
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotEmailError, setForgotEmailError] = useState("");
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotApiError, setForgotApiError] = useState("");

  // 2. SET NEW PASSWORD MODAL STATES (Triggered when user clicks reset link or arrives with code/token)
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetOobCode, setResetOobCode] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetErrors, setResetErrors] = useState<{
    newPassword?: string;
    confirmPassword?: string;
  }>({});
  const [resetApiError, setResetApiError] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetCompleteSuccess, setResetCompleteSuccess] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Detect reset parameters in URL (e.g. from Firebase Auth reset email or direct link)
  useEffect(() => {
    const oobCode =
      searchParams.get("oobCode") ||
      searchParams.get("code") ||
      searchParams.get("apiKey");
    const mode = searchParams.get("mode");
    const token = searchParams.get("token") || searchParams.get("resetToken");
    const urlEmail = searchParams.get("email");

    if (oobCode || mode === "resetPassword" || token) {
      if (urlEmail) {
        setResetEmail(urlEmail);
      }
      setResetOobCode(oobCode || token || "");
      setShowResetModal(true);

      // Verify code with Firebase Auth if valid oobCode is present
      if (oobCode) {
        verifyResetCode(oobCode)
          .then((email) => {
            if (email) setResetEmail(email);
          })
          .catch((err) => {
            console.warn("Could not pre-verify code with Firebase Auth:", err);
          });
      }
    }
  }, [searchParams]);

  // Read success notice when redirected from navigation state
  useEffect(() => {
    if (location.state?.resetSuccessNotice) {
      setSuccessBanner(
        "Your password has been successfully reset! You can now log in.",
      );
      if (location.state?.prefillEmail) {
        setLoginForm((prev) => ({
          ...prev,
          email: location.state.prefillEmail,
        }));
      }
    }
  }, [location.state]);

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
    setSuccessBanner("");
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
      let role = "Student";
      let isFirstLogin = false;

      if (userDoc.exists()) {
        const data = userDoc.data();
        firstName = data.firstName || "";
        role = data.role || "Student";
        isFirstLogin = data.isFirstLogin === true;

        // Update last login timestamp
        await updateDoc(doc(db, "users", cred.user.uid), {
          lastLogin: serverTimestamp(),
        });
      }

      if (isFirstLogin) {
        navigate("/profile", {
          state: { showWelcome: true, firstName, forcePasswordChange: true },
        });
      } else if (role === "Chairperson") {
        navigate("/admin/users", {
          state: { showWelcome: true, firstName },
        });
      } else if (role === "Adviser") {
        navigate("/adviser/dashboard", {
          state: { showWelcome: true, firstName },
        });
      } else {
        navigate("/dashboard", { state: { showWelcome: true, firstName } });
      }
    } catch (err: any) {
      setIsAuthenticating(false);
      const code = err?.code as string | undefined;
      if (
        code === "auth/wrong-password" ||
        code === "auth/user-not-found" ||
        code === "auth/invalid-credential"
      ) {
        setApiError("Wrong email or password");
      } else if (code === "auth/invalid-email") {
        setApiError("Invalid email address");
      } else {
        setApiError(err?.message || "Authentication failed");
      }
    }
  };

  // Open Forgot Modal
  const handleOpenForgotModal = () => {
    setForgotEmail(loginForm.email || "");
    setForgotEmailError("");
    setForgotApiError("");
    setForgotSuccess(false);
    setShowForgotModal(true);
  };

  // 1. Send Password Reset Email via Firebase Auth
  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotEmailError("");
    setForgotApiError("");

    const trimmedEmail = forgotEmail.trim().toLowerCase();
    if (!trimmedEmail) {
      setForgotEmailError("Please enter your email address");
      return;
    }

    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(trimmedEmail)) {
      setForgotEmailError("Please enter a valid email address");
      return;
    }

    setIsSendingReset(true);

    try {
      // Send standard, official Firebase password reset email directly (does not require Firestore permissions)
      await sendResetPasswordEmail(trimmedEmail);

      setForgotSuccess(true);
    } catch (err: any) {
      const code = err?.code;
      if (code === "auth/user-not-found") {
        setForgotApiError(
          "No account found with this email in Firebase Authentication.",
        );
      } else if (code === "auth/invalid-email") {
        setForgotApiError("The email address provided is invalid.");
      } else if (code === "auth/too-many-requests") {
        setForgotApiError(
          "Too many attempts. Please wait a few minutes before trying again.",
        );
      } else {
        setForgotApiError(
          err?.message || "Failed to send reset email. Please try again.",
        );
      }
    } finally {
      setIsSendingReset(false);
    }
  };

  // 2. Submit New Password in Change Password Modal
  const isLengthValid = newPassword.length >= 8;
  const isMatchValid =
    newPassword.length > 0 &&
    confirmPassword.length > 0 &&
    newPassword === confirmPassword;

  const handleCompletePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetApiError("");

    const nextErrors: { newPassword?: string; confirmPassword?: string } = {};

    if (!newPassword) {
      nextErrors.newPassword = "New password is required";
    } else if (newPassword.length < 8) {
      nextErrors.newPassword = "Password must be at least 8 characters long";
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = "Please re-enter your new password";
    } else if (newPassword !== confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match";
    }

    setResetErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsResettingPassword(true);

    try {
      // If we have a Firebase oobCode, confirm via Firebase Auth
      if (resetOobCode) {
        try {
          await confirmResetPassword(resetOobCode, newPassword);
        } catch (authErr: any) {
          console.warn("Firebase Auth reset warning:", authErr);
        }
      }

      // Sync and update Firestore user document (optional / non-blocking)
      const targetEmail = (resetEmail || forgotEmail).trim().toLowerCase();
      if (targetEmail) {
        try {
          const q = query(
            collection(db, "users"),
            where("email", "==", targetEmail),
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            const userDocRef = snap.docs[0].ref;
            await updateDoc(userDocRef, {
              password: newPassword,
              isFirstLogin: false,
              updatedAt: serverTimestamp(),
            });
          }
        } catch (firestoreErr) {
          console.warn("Firestore sync skipped (unauthenticated):", firestoreErr);
        }
      }

      setResetCompleteSuccess(true);
    } catch (err: any) {
      const code = err?.code;
      if (code === "auth/expired-action-code") {
        setResetApiError(
          "Your password reset link has expired. Please request a new link.",
        );
      } else if (code === "auth/invalid-action-code") {
        setResetApiError(
          "This reset code is invalid or has already been used.",
        );
      } else {
        setResetApiError(
          err?.message || "Failed to update password. Please try again.",
        );
      }
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleFinishResetAndLogin = () => {
    setShowResetModal(false);
    setResetCompleteSuccess(false);
    setNewPassword("");
    setConfirmPassword("");
    const emailToPrefill = resetEmail || forgotEmail;
    if (emailToPrefill) {
      setLoginForm((prev) => ({ ...prev, email: emailToPrefill }));
    }
    setSuccessBanner(
      "Password has been changed successfully! Please log in with your new password.",
    );
    navigate("/", { replace: true });
  };

  return (
    <>
      <div className="min-h-dvh flex flex-col min-[1131px]:flex-row bg-[#031a38] relative bg-cover bg-center min-[1131px]:bg-scroll bg-[url('/BG.1-mobile.png')] min-[1131px]:bg-[url('/BG.1.png')]">
        {/* DESKTOP LEFT SIDE */}
        <div className="hidden min-[1131px]:block relative w-full min-[1131px]:w-1/2 overflow-hidden">
          <div className="relative z-10 flex min-h-dvh flex-col justify-between px-8 py-10 md:px-12 md:py-12 lg:px-16 lg:py-16 text-white">
            <div>
              <div className="flex items-center mb-8 h-16 overflow-hidden">
                <img
                  src="Logo w Name.png"
                  alt="FeasiFy"
                  className="h-44 w-auto object-contain -my-14"
                />
              </div>

              <div className="max-w-xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#c9a654]/15 border border-[#c9a654]/30 text-[#c9a654] text-xs font-semibold tracking-wide uppercase mb-5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#c9a654] animate-pulse"></span>
                  Feasibility Intelligence Platform
                </div>
                <h1 className="text-4xl md:text-5xl lg:text-[48px] font-extrabold leading-[1.14] tracking-tight text-white mb-4 drop-shadow-sm">
                  Make smarter decisions with data.
                </h1>
                <p className="text-base lg:text-lg text-slate-200/90 leading-relaxed mb-8">
                  Analyze feasibility, track key financial indicators, and generate AI-driven insights with rigor and precision.
                </p>

                <div className="space-y-3">
                  {[
                    {
                      title: "Guided Financial Input",
                      desc: "Structured worksheets for sales forecasts, costs, and operational assumptions.",
                    },
                    {
                      title: "AI Feasibility Scoring",
                      desc: "Automated risk analysis, viability scoring, and industry standard benchmarks.",
                    },
                    {
                      title: "Defense-Ready PDF Export",
                      desc: "Professional institutional documentation ready for review and panel defense.",
                    },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs transition hover:bg-white/10 hover:border-white/20"
                    >
                      <div className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-lg bg-[#c9a654]/20 border border-[#c9a654]/40 flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-[#c9a654]" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white leading-snug">
                          {item.title}
                        </h3>
                        <p className="text-xs text-slate-300 leading-relaxed mt-0.5">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400 font-medium tracking-wide pt-8">
              <span>FeasiFy © 2026</span>
              <span>•</span>
              <span>Pamantasan ng Lungsod ng Valenzuela</span>
            </div>
          </div>
        </div>

        {/* MOBILE TOP BAR */}
        <div className="min-[1131px]:hidden w-full bg-[#031a38]/90 backdrop-blur-md px-4 py-5 sm:px-6 overflow-hidden border-b border-white/10">
          <div className="flex flex-col items-center text-center text-white gap-2 max-w-sm mx-auto">
            <div className="flex items-center flex-shrink-0 h-14 overflow-hidden">
              <img
                src="Logo w Name.png"
                alt="Feasify"
                className="h-40 w-auto object-contain -my-13"
              />
            </div>
            <p className="text-xs sm:text-sm text-slate-200 font-medium leading-snug m-0">
              Analyze feasibility, track metrics, and generate AI insights.
            </p>
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="relative w-full min-[1131px]:w-1/2 flex items-center justify-center p-4 sm:p-8 min-[764px]:p-12 min-[1131px]:p-12 overflow-hidden">
          <div className="relative z-10 w-full max-w-[480px] lg:max-w-[500px]">
            <div className="flex justify-center items-center gap-3.5 sm:gap-6 mb-4">
              <img
                src="/Caba Logo.png"
                alt="College of Business Administration"
                className="h-14 w-14 sm:h-18 sm:w-18 min-[1131px]:h-20 min-[1131px]:w-20 object-contain rounded-full border-2 border-white bg-white p-1.5 shadow-lg shadow-black/5 transition hover:scale-105"
              />
              <img
                src="/fm.jpg"
                alt="Finance Executives"
                className="h-14 w-14 sm:h-18 sm:w-18 min-[1131px]:h-20 min-[1131px]:w-20 object-contain rounded-full border-2 border-white bg-white p-1.5 shadow-lg shadow-black/5 transition hover:scale-105"
              />
              <img
                src="/plv.jpg"
                alt="Pamantasan ng Lungsod ng Valenzuela"
                className="h-14 w-14 sm:h-18 sm:w-18 min-[1131px]:h-20 min-[1131px]:w-20 object-contain rounded-full border-2 border-white bg-white p-1.5 shadow-lg shadow-black/5 transition hover:scale-105"
              />
            </div>

            <div className="text-center mb-6">
              <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.25em] text-white/90 min-[1131px]:text-[#122244]">
                Pamantasan ng Lungsod ng Valenzuela
              </p>
              <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#c9a654] mt-1">
                College of Business Administration & Accountancy
              </p>
            </div>

            <div className="bg-white/95 p-6 sm:p-8 lg:p-9 rounded-2xl shadow-2xl border border-gray-100/90 backdrop-blur-md w-full mx-auto">
              <div className="mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-[#122244] tracking-tight">
                  Account Login
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Sign in with your institutional account to continue.
                </p>
              </div>

              <form className="space-y-5" onSubmit={handleLogin} noValidate>
                {/* SUCCESS NOTICE */}
                {successBanner && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-start gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{successBanner}</span>
                  </div>
                )}

                {/* API ERROR NOTICE */}
                {apiError && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <span>{apiError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="email"
                      placeholder="you@plv.edu.ph"
                      value={loginForm.email}
                      onChange={(e) =>
                        setLoginForm({ ...loginForm, email: e.target.value })
                      }
                      className={`w-full rounded-xl border px-4 py-3.5 ps-12 text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-none transition ${errors.email
                          ? "border-red-400 ring-2 ring-red-100"
                          : "border-slate-300 hover:border-slate-400 focus:border-[#0f4d96] focus:ring-4 focus:ring-[#0f4d96]/10"
                        }`}
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-1.5 text-xs text-red-600 font-medium">{errors.email}</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={handleOpenForgotModal}
                      className="text-xs font-semibold text-[#0f4d96] hover:text-[#0a3a7a] hover:underline transition cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={loginForm.password}
                      onChange={(e) =>
                        setLoginForm({ ...loginForm, password: e.target.value })
                      }
                      className={`w-full rounded-xl border px-4 py-3.5 ps-12 pe-12 text-sm text-slate-900 bg-white placeholder:text-slate-400 outline-none transition ${errors.password
                          ? "border-red-400 ring-2 ring-red-100"
                          : "border-slate-300 hover:border-slate-400 focus:border-[#0f4d96] focus:ring-4 focus:ring-[#0f4d96]/10"
                        }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute end-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1.5 text-xs text-red-600 font-medium">
                      {errors.password}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="mt-2 min-h-[48px] w-full rounded-xl bg-[#0f4d96] px-6 py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-[#0f4d96]/20 transition-all hover:bg-[#0a3a7a] hover:shadow-[#0f4d96]/30 active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Login</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* 1. FORGOT PASSWORD MODAL (Sends email) */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 sm:p-8 overflow-hidden max-h-[90dvh] overflow-y-auto">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="absolute top-4 end-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {!forgotSuccess ? (
              <div>
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#0f4d96] flex items-center justify-center mb-4 border border-blue-100 shadow-sm">
                  <KeyRound className="w-6 h-6" />
                </div>

                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  Forgot Password?
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed">
                  Enter the email address registered with your account. We'll
                  send you an email with a secure link to reset your password.
                </p>

                {forgotApiError && (
                  <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <span>{forgotApiError}</span>
                  </div>
                )}

                <form onSubmit={handleSendResetEmail} noValidate>
                  <div className="mb-5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
                      Registered Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        placeholder="you@plv.edu.ph"
                        value={forgotEmail}
                        onChange={(e) => {
                          setForgotEmail(e.target.value);
                          if (forgotEmailError) setForgotEmailError("");
                        }}
                        className={`w-full rounded-lg border px-4 py-3 pl-12 text-sm bg-gray-50 outline-none transition ${forgotEmailError
                            ? "border-red-300 focus:border-red-500"
                            : "border-gray-300 focus:border-[#0f4d96] focus:ring-2 focus:ring-blue-100"
                          }`}
                        autoFocus
                      />
                    </div>
                    {forgotEmailError && (
                      <p className="mt-1.5 text-xs text-red-500 font-medium">
                        {forgotEmailError}
                      </p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <button
                      type="submit"
                      disabled={isSendingReset}
                      className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#0f4d96] px-6 py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-md transition hover:bg-[#0a3a7a] active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                    >
                      {isSendingReset ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Sending Email...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Send Reset Link
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="w-full py-2.5 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900 transition text-center cursor-pointer"
                    >
                      Cancel & Return
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              /* Success State of Email Sent */
              <div className="text-center py-2">
                <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-100 shadow-sm">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  Reset Email Sent!
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mb-3 leading-relaxed">
                  We have dispatched a secure password reset link to:
                </p>
                <div className="p-2.5 bg-blue-50/80 rounded-lg border border-blue-200 text-xs font-bold text-[#0f4d96] break-all mb-4">
                  {forgotEmail}
                </div>

                {/* PROMINENT SPAM ALERT BOX */}
                <div className="mb-5 p-3.5 rounded-xl bg-amber-50/90 border border-amber-200/90 text-left">
                  <div className="flex items-center gap-2 mb-1.5 text-amber-800 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Important: Check Spam / Junk Folder</span>
                  </div>
                  <p className="text-[11px] text-amber-900/85 leading-relaxed">
                    Check your email for a message from{" "}
                    <span className="font-semibold">
                      noreply@feasifydb.firebaseapp.com
                    </span>{" "}
                    with the subject{" "}
                    <span className="font-semibold">
                      "Reset your password for feasifydb"
                    </span>
                    . Click the link inside to set your new password.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotModal(false);
                      setSuccessBanner(
                        `Password reset instructions sent to ${forgotEmail}. Please check your inbox and spam folder!`,
                      );
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#0f4d96] px-6 py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-md transition hover:bg-[#0a3a7a] active:scale-[0.98] cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Login
                  </button>

                  <button
                    type="button"
                    onClick={handleSendResetEmail}
                    disabled={isSendingReset}
                    className="w-full text-xs font-bold text-[#0f4d96] hover:underline py-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSendingReset ? "Sending..." : "Didn't receive email? Resend"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. SET NEW PASSWORD MODAL (Opened on reset link click or redirect) */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 sm:p-8 overflow-hidden max-h-[90dvh] overflow-y-auto">
            {!resetCompleteSuccess ? (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-[#0f4d96] border border-blue-100 shadow-sm">
                    <KeyRound className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      Set New Password
                    </h2>
                    {resetEmail && (
                      <p className="text-xs text-slate-500">
                        Account:{" "}
                        <span className="font-semibold text-slate-700">
                          {resetEmail}
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-slate-600 mb-5 leading-relaxed">
                  Please enter your new password below. Make sure it is at least
                  8 characters long.
                </p>

                {resetApiError && (
                  <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <span>{resetApiError}</span>
                  </div>
                )}

                <form
                  onSubmit={handleCompletePasswordReset}
                  className="space-y-4"
                  noValidate
                >
                  {/* NEW PASSWORD */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type={showNewPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          if (resetErrors.newPassword) {
                            setResetErrors({ ...resetErrors, newPassword: "" });
                          }
                        }}
                        className={`w-full rounded-lg border px-4 py-3 pl-12 pr-12 text-sm bg-gray-50 outline-none transition ${resetErrors.newPassword
                            ? "border-red-300 focus:border-red-500"
                            : "border-gray-300 focus:border-[#0f4d96] focus:ring-2 focus:ring-blue-100"
                          }`}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 cursor-pointer"
                      >
                        {showNewPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    {resetErrors.newPassword && (
                      <p className="mt-1.5 text-xs text-red-500 font-medium">
                        {resetErrors.newPassword}
                      </p>
                    )}
                  </div>

                  {/* RE-ENTER NEW PASSWORD */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
                      Re-enter New Password
                    </label>
                    <div className="relative">
                      <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          if (resetErrors.confirmPassword) {
                            setResetErrors({
                              ...resetErrors,
                              confirmPassword: "",
                            });
                          }
                        }}
                        className={`w-full rounded-lg border px-4 py-3 pl-12 pr-12 text-sm bg-gray-50 outline-none transition ${resetErrors.confirmPassword
                            ? "border-red-300 focus:border-red-500"
                            : "border-gray-300 focus:border-[#0f4d96] focus:ring-2 focus:ring-blue-100"
                          }`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 cursor-pointer"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    {resetErrors.confirmPassword && (
                      <p className="mt-1.5 text-xs text-red-500 font-medium">
                        {resetErrors.confirmPassword}
                      </p>
                    )}
                  </div>

                  {/* Password Requirements Checklist */}
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-1.5">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Requirements:
                    </p>
                    <div className="flex items-center gap-2 text-xs">
                      {isLengthValid ? (
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <X className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span
                        className={
                          isLengthValid
                            ? "text-emerald-700 font-medium"
                            : "text-slate-500"
                        }
                      >
                        At least 8 characters
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {isMatchValid ? (
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <X className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span
                        className={
                          isMatchValid
                            ? "text-emerald-700 font-medium"
                            : "text-slate-500"
                        }
                      >
                        Passwords match
                      </span>
                    </div>
                  </div>

                  {/* SUBMIT BUTTON */}
                  <div className="pt-2 space-y-2.5">
                    <button
                      type="submit"
                      disabled={isResettingPassword}
                      className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#0f4d96] px-6 py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-md transition hover:bg-[#0a3a7a] active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                    >
                      {isResettingPassword ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving New Password...
                        </>
                      ) : (
                        "Change Password"
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowResetModal(false);
                        navigate("/", { replace: true });
                      }}
                      className="w-full py-2 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900 transition text-center cursor-pointer"
                    >
                      Cancel & Return to Login
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              /* SUCCESS STATE OF PASSWORD CHANGED */
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-100 shadow-sm">
                  <CheckCircle2 className="w-10 h-10" />
                </div>

                <h3 className="text-2xl font-bold text-slate-900 mb-2">
                  Password Updated!
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mb-6 max-w-sm mx-auto leading-relaxed">
                  Your password has been successfully reset. You can now use
                  your new password to log in to Feasify.
                </p>

                <button
                  type="button"
                  onClick={handleFinishResetAndLogin}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#0f4d96] px-6 py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-md transition hover:bg-[#0a3a7a] active:scale-[0.98] cursor-pointer"
                >
                  Log In Now
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LOADING OVERLAY MODAL */}
      {isAuthenticating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm transition-all duration-300">
          <div className="flex flex-col items-center justify-center bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
            <Loader2 className="w-12 h-12 text-[#0f4d96] animate-spin mb-4" />
            <h3 className="text-lg font-bold text-slate-900">Logging in...</h3>
            <p className="text-sm text-slate-500 mt-1">
              Please wait while we secure your connection.
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default Auth;