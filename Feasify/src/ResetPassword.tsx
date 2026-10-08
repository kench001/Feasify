import React, { useState, useEffect } from "react";
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  KeyRound,
  ShieldCheck,
  Check,
  X,
} from "lucide-react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import {
  verifyResetCode,
  confirmResetPassword,
  db,
} from "./firebase";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Extract oobCode from query parameters (Firebase uses oobCode)
  const oobCode =
    searchParams.get("oobCode") ||
    searchParams.get("code") ||
    searchParams.get("apiKey");

  // State management
  const [isVerifying, setIsVerifying] = useState<boolean>(true);
  const [verifiedEmail, setVerifiedEmail] = useState<string>("");
  const [codeError, setCodeError] = useState<string>("");

  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  const [validationErrors, setValidationErrors] = useState<{
    newPassword?: string;
    confirmPassword?: string;
  }>({});
  const [submitError, setSubmitError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  // Validate the oobCode upon component mount
  useEffect(() => {
    let isMounted = true;

    async function checkCode() {
      const codeToVerify = searchParams.get("oobCode");
      const urlEmail = searchParams.get("email");

      if (codeToVerify) {
        try {
          const email = await verifyResetCode(codeToVerify);
          if (isMounted) {
            setVerifiedEmail(email || urlEmail || "");
            setIsVerifying(false);
          }
        } catch (err: any) {
          if (isMounted) {
            const code = err?.code;
            if (code === "auth/expired-action-code") {
              setCodeError(
                "This password reset link has expired. Please request a new reset email.",
              );
            } else if (code === "auth/invalid-action-code") {
              setCodeError(
                "This password reset link is invalid or has already been used.",
              );
            } else {
              setCodeError(
                err?.message || "Failed to verify reset link. Please try again.",
              );
            }
            setIsVerifying(false);
          }
        }
      } else if (urlEmail) {
        if (isMounted) {
          setVerifiedEmail(urlEmail);
          setIsVerifying(false);
        }
      } else {
        if (isMounted) {
          setCodeError(
            "No valid reset link or email found. Please request a new password reset link from the login page.",
          );
          setIsVerifying(false);
        }
      }
    }

    checkCode();

    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  // Validation criteria
  const isLengthValid = newPassword.length >= 8;
  const isMatchValid =
    newPassword.length > 0 &&
    confirmPassword.length > 0 &&
    newPassword === confirmPassword;

  const validateForm = () => {
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

    setValidationErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");

    if (!validateForm()) return;

    const codeToConfirm = searchParams.get("oobCode");
    if (!codeToConfirm) {
      setSubmitError("Missing password reset token. Please request a new link.");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Confirm password reset in Firebase Auth if oobCode is present
      if (codeToConfirm) {
        try {
          await confirmResetPassword(codeToConfirm, newPassword);
        } catch (fbErr: any) {
          console.warn("Firebase confirm error:", fbErr);
          if (!verifiedEmail) throw fbErr;
        }
      }

      // 2. Sync updated password to Firestore user document
      if (verifiedEmail) {
        try {
          const q = query(
            collection(db, "users"),
            where("email", "==", verifiedEmail.toLowerCase().trim()),
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
          console.warn(
            "Firestore sync notice:",
            firestoreErr,
          );
        }
      }

      setIsSuccess(true);
    } catch (err: any) {
      const code = err?.code;
      if (code === "auth/expired-action-code") {
        setSubmitError(
          "Your reset code has expired. Please request a new link.",
        );
      } else if (code === "auth/invalid-action-code") {
        setSubmitError(
          "This reset code is invalid or has already been used. Please request a new link.",
        );
      } else if (code === "auth/weak-password") {
        setSubmitError("Password is too weak. Please use a stronger password.");
      } else {
        setSubmitError(
          err?.message || "Failed to update password. Please try again.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#031a38] relative bg-cover bg-center min-[1131px]:bg-fixed bg-[url('/BG.1-mobile.png')] min-[1131px]:bg-[url('/BG.1.png')] p-4 sm:p-6 lg:p-8">
      {/* Background Decorative SVG */}
      <div className="absolute inset-0 opacity-15 pointer-events-none">
        <svg viewBox="0 0 800 800" className="absolute right-[-10%] top-0 h-full w-[120%]">
          <defs>
            <pattern
              id="hexPatternReset"
              width="120"
              height="104"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M60 0 L120 30 L120 74 L60 104 L0 74 L0 30 Z"
                fill="none"
                stroke="#d4af37"
                strokeWidth="1.5"
              />
            </pattern>
          </defs>
          <rect width="800" height="800" fill="url(#hexPatternReset)" />
        </svg>
      </div>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-md min-[764px]:max-w-lg">
        {/* Logos Header */}
        <div className="flex justify-center gap-3 sm:gap-6 mb-6 sm:mb-8">
          <img
            src="/Caba Logo.png"
            alt="College of Business Administration"
            className="h-14 w-14 sm:h-16 sm:w-16 object-contain rounded-full border border-gray-300 bg-white p-1 shadow-md"
          />
          <img
            src="/fm.jpg"
            alt="Finance Executives"
            className="h-14 w-14 sm:h-16 sm:w-16 object-contain rounded-full border border-gray-300 bg-white p-1 shadow-md"
          />
          <img
            src="/plv.jpg"
            alt="Pamantasan ng Lungsod ng Valenzuela"
            className="h-14 w-14 sm:h-16 sm:w-16 object-contain rounded-full border border-gray-300 bg-white p-1 shadow-md"
          />
        </div>

        <p className="text-center text-xs sm:text-sm font-bold uppercase tracking-[0.25em] text-white/90 mb-6">
          Pamantasan ng Lungsod ng Valenzuela
        </p>

        {/* Card Content */}
        <div className="bg-white/95 rounded-2xl shadow-2xl border border-gray-100/60 backdrop-blur-md p-6 sm:p-10">
          {/* STATE 1: VERIFYING CODE */}
          {isVerifying && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Loader2 className="w-12 h-12 text-[#0f4d96] animate-spin mb-4" />
              <h3 className="text-xl font-bold text-slate-900">
                Verifying Reset Link...
              </h3>
              <p className="text-sm text-slate-500 mt-2 max-w-xs">
                Please wait while we validate your secure password reset request.
              </p>
            </div>
          )}

          {/* STATE 2: CODE ERROR / EXPIRED */}
          {!isVerifying && codeError && (
            <div className="flex flex-col items-center text-center py-6">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-4 border border-red-100 shadow-inner">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                Invalid or Expired Link
              </h3>
              <p className="text-sm text-slate-600 mb-8 max-w-sm leading-relaxed">
                {codeError}
              </p>

              <div className="w-full space-y-3">
                <Link
                  to="/"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#0f4d96] px-6 py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-md transition hover:bg-[#0a3a7a] active:scale-[0.98]"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Return to Login
                </Link>
              </div>
            </div>
          )}

          {/* STATE 3: SUCCESS */}
          {!isVerifying && !codeError && isSuccess && (
            <div className="flex flex-col items-center text-center py-6">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mb-4 border border-emerald-100 shadow-inner">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h3 className="text-2xl font-black text-[#031a38] mb-2">
                Password Changed!
              </h3>
              <p className="text-sm text-slate-600 mb-6 max-w-sm leading-relaxed">
                Your password has been successfully reset. You can now use your
                new credentials to log into Feasify.
              </p>

              <button
                type="button"
                onClick={() =>
                  navigate("/", {
                    state: {
                      prefillEmail: verifiedEmail,
                      resetSuccessNotice: true,
                    },
                  })
                }
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#0f4d96] px-6 py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-md transition hover:bg-[#0a3a7a] active:scale-[0.98]"
              >
                Log In Now
              </button>
            </div>
          )}

          {/* STATE 4: RESET PASSWORD FORM */}
          {!isVerifying && !codeError && !isSuccess && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-[#0f4d96] border border-blue-100/80">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Reset Password
                  </h2>
                  {verifiedEmail && (
                    <p className="text-xs text-slate-500">
                      Account:{" "}
                      <span className="font-semibold text-slate-700">
                        {verifiedEmail}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              <p className="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed">
                Please enter your new password below. Make sure it is at least 8
                characters long.
              </p>

              {submitError && (
                <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
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
                        if (validationErrors.newPassword) {
                          setValidationErrors({
                            ...validationErrors,
                            newPassword: "",
                          });
                        }
                      }}
                      className={`w-full rounded-lg border px-4 py-3 pl-12 pr-12 text-sm bg-gray-50/80 outline-none transition ${
                        validationErrors.newPassword
                          ? "border-red-300 focus:border-red-500"
                          : "border-gray-300 focus:border-[#0f4d96] focus:ring-2 focus:ring-blue-100"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showNewPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {validationErrors.newPassword && (
                    <p className="mt-1.5 text-xs text-red-500 font-medium">
                      {validationErrors.newPassword}
                    </p>
                  )}
                </div>

                {/* CONFIRM NEW PASSWORD */}
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
                        if (validationErrors.confirmPassword) {
                          setValidationErrors({
                            ...validationErrors,
                            confirmPassword: "",
                          });
                        }
                      }}
                      className={`w-full rounded-lg border px-4 py-3 pl-12 pr-12 text-sm bg-gray-50/80 outline-none transition ${
                        validationErrors.confirmPassword
                          ? "border-red-300 focus:border-red-500"
                          : "border-gray-300 focus:border-[#0f4d96] focus:ring-2 focus:ring-blue-100"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {validationErrors.confirmPassword && (
                    <p className="mt-1.5 text-xs text-red-500 font-medium">
                      {validationErrors.confirmPassword}
                    </p>
                  )}
                </div>

                {/* Password Criteria Feedback */}
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-2">
                  <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    Password Requirements:
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
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#0f4d96] px-6 py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-md transition hover:bg-[#0a3a7a] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Updating Password...
                    </>
                  ) : (
                    "Set New Password"
                  )}
                </button>

                <div className="text-center pt-2">
                  <Link
                    to="/"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#0f4d96] transition"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to Login
                  </Link>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
