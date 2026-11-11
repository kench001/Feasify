import React, { useState, useEffect, useRef, useCallback } from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";

interface AIAdvisoryModalProps {
  isOpen: boolean;
  onAcknowledge: () => void;
}

const COUNTDOWN_DURATION_MS = 3000;

export const AIAdvisoryModal: React.FC<AIAdvisoryModalProps> = ({
  isOpen,
  onAcknowledge,
}) => {
  const [remainingMs, setRemainingMs] = useState(COUNTDOWN_DURATION_MS);
  const [isFinished, setIsFinished] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const modalContentRef = useRef<HTMLDivElement | null>(null);

  // Lock body scrolling while modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Monotonic timer using performance.now() and requestAnimationFrame
  useEffect(() => {
    if (!isOpen) {
      setRemainingMs(COUNTDOWN_DURATION_MS);
      setIsFinished(false);
      startTimeRef.current = null;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    // Reset countdown state on open
    setRemainingMs(COUNTDOWN_DURATION_MS);
    setIsFinished(false);
    startTimeRef.current = performance.now();

    const tick = () => {
      if (!startTimeRef.current) return;
      const elapsed = performance.now() - startTimeRef.current;
      const currentRemaining = Math.max(0, COUNTDOWN_DURATION_MS - elapsed);
      setRemainingMs(currentRemaining);

      if (currentRemaining <= 0) {
        setIsFinished(true);
        if (confirmButtonRef.current) {
          confirmButtonRef.current.focus();
        }
      } else {
        animationFrameRef.current = requestAnimationFrame(tick);
      }
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isOpen]);

  // Focus trapping & Escape key suppression
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (e.key === "Tab") {
        if (!modalContentRef.current) return;
        const focusableElements = modalContentRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[
          focusableElements.length - 1
        ] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    },
    []
  );

  if (!isOpen) return null;

  const secondsLeft = Math.ceil(remainingMs / 1000);
  const progressPercent = Math.min(
    100,
    ((COUNTDOWN_DURATION_MS - remainingMs) / COUNTDOWN_DURATION_MS) * 100
  );

  // SVG Circular progress metrics
  const radius = 22;
  const circumference = 2 * Math.PI * radius; // ~138.23
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-advisory-title"
      aria-describedby="ai-advisory-desc"
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
    >
      <div
        ref={modalContentRef}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-lg sm:max-w-xl w-full p-6 sm:p-8 text-center relative animate-in zoom-in-95 duration-200 select-none my-auto"
      >
        {/* Large Warning Triangle Icon */}
        <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 rounded-2xl bg-amber-50 border border-amber-200/90 flex items-center justify-center shadow-inner">
          <AlertTriangle
            className="w-9 h-9 sm:w-11 sm:h-11 text-amber-500 fill-amber-500/20 stroke-amber-500 stroke-[2.2]"
            aria-hidden="true"
          />
        </div>

        {/* Modal Heading */}
        <h2
          id="ai-advisory-title"
          className="text-2xl sm:text-[26px] font-black text-[#122244] tracking-tight mb-2.5"
        >
          Advisory Acknowledgment
        </h2>

        {/* Modal Description with Highlighted Advising Statement */}
        <p
          id="ai-advisory-desc"
          className="text-gray-600 text-xs sm:text-sm leading-relaxed mb-6 max-w-md mx-auto"
        >
          The AI verdict is only a guide and should not be fully relied on as a
          final decision. You must{" "}
          <strong className="text-[#122244] font-extrabold underline decoration-amber-400 decoration-2 underline-offset-2">
            validate all assumptions and consult your research adviser
          </strong>{" "}
          before finalizing your study.
        </p>

        {/* Countdown & Progress Section */}
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 sm:p-5 mb-6 text-center space-y-3.5 shadow-2xs">
          <div className="flex items-center justify-center gap-3">
            {/* Circular Countdown Indicator */}
            <div className="relative w-12 h-12 flex items-center justify-center flex-shrink-0">
              <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 52 52">
                <circle
                  cx="26"
                  cy="26"
                  r={radius}
                  stroke="#fef3c7"
                  strokeWidth="4"
                  fill="transparent"
                />
                <circle
                  cx="26"
                  cy="26"
                  r={radius}
                  stroke="#f59e0b"
                  strokeWidth="4"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-75 ease-linear"
                />
              </svg>
              <span className="absolute font-black text-amber-900 text-sm">
                {isFinished ? "0" : secondsLeft}s
              </span>
            </div>

            <div className="text-left min-w-0">
              <p className="text-xs sm:text-sm font-bold text-amber-950">
                {isFinished
                  ? "Advisory countdown completed."
                  : `Please wait ${secondsLeft} second${secondsLeft === 1 ? "" : "s"} before continuing.`}
              </p>
              <p className="text-[11px] text-amber-800/80 mt-0.5">
                {isFinished
                  ? "You may now confirm your acknowledgment below."
                  : "Reviewing guidance disclaimer..."}
              </p>
            </div>
          </div>

          {/* Horizontal Progress Bar */}
          <div className="w-full h-2 bg-amber-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-[#c9a654] transition-all duration-75 ease-linear rounded-full"
              style={{ width: `${progressPercent}%` }}
              role="progressbar"
              aria-valuenow={Math.round(progressPercent)}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>

        {/* Acknowledgment Action Button */}
        <button
          ref={confirmButtonRef}
          type="button"
          disabled={!isFinished}
          onClick={onAcknowledge}
          className={`w-full py-3.5 px-6 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 transition-all ${
            isFinished
              ? "bg-[#122244] hover:bg-[#1a2f55] text-white shadow-lg shadow-[#122244]/20 cursor-pointer active:scale-[0.98]"
              : "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed opacity-60"
          }`}
        >
          {isFinished ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-[#c9a654]" />
              I Understand & Continue
            </>
          ) : (
            `I Understand (${secondsLeft}s)`
          )}
        </button>
      </div>
    </div>
  );
};

export default AIAdvisoryModal;
