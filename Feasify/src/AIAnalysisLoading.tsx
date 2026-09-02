import React, { useState, useEffect } from "react";
import {
  BrainCircuit,
  TrendingUp,
  BarChart3,
  ShieldAlert,
  Layers,
  Sparkles,
  FileSpreadsheet,
  CheckCircle2,
} from "lucide-react";

interface AIAnalysisLoadingProps {
  projectName?: string;
}

interface AnalysisStage {
  phase: string;
  status: string;
  supporting: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STAGES: AnalysisStage[] = [
  {
    phase: "Phase 1 of 5",
    badge: "Framework Ingestion",
    status: "Synthesizing Project Parameters",
    supporting:
      "Compiling initial capital outlays, operating cost structures, and venture baseline metrics...",
    icon: FileSpreadsheet,
  },
  {
    phase: "Phase 2 of 5",
    badge: "Fiscal Modeling",
    status: "Evaluating Fiscal Viability",
    supporting:
      "Analyzing break-even thresholds, unit contribution margins, and 5-year pro forma cash flow projections...",
    icon: TrendingUp,
  },
  {
    phase: "Phase 3 of 5",
    badge: "Market & Risk",
    status: "Assessing Market & Risk Dynamics",
    supporting:
      "Cross-examining market demand levels, competitive density, and venture operational risk exposure...",
    icon: ShieldAlert,
  },
  {
    phase: "Phase 4 of 5",
    badge: "Rubric Audit",
    status: "Applying Feasibility Evaluation Rubrics",
    supporting:
      "Benchmarking performance indicators against institutional standards and feasibility criteria...",
    icon: Layers,
  },
  {
    phase: "Phase 5 of 5",
    badge: "Strategic Synthesis",
    status: "Formulating Strategic Assessment",
    supporting:
      "Drafting final performance verdicts, categorical scores, and actionable advisory recommendations...",
    icon: Sparkles,
  },
];

export const AIAnalysisLoading: React.FC<AIAnalysisLoadingProps> = ({ projectName }) => {
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [fadeState, setFadeState] = useState<"in" | "out">("in");

  useEffect(() => {
    const stageInterval = setInterval(() => {
      // Fade out
      setFadeState("out");
      setTimeout(() => {
        setCurrentStageIndex((prev) => (prev + 1) % STAGES.length);
        setFadeState("in");
      }, 300);
    }, 3400);

    return () => clearInterval(stageInterval);
  }, []);

  const currentStage = STAGES[currentStageIndex];
  const StageIcon = currentStage.icon;

  return (
    <div className="flex flex-col items-center justify-center min-h-[72vh] px-4 py-12 text-center select-none">
      {/* 1. Context / Project Pill Badge */}
      <div className="mb-8 inline-flex items-center gap-2.5 px-4 py-1.5 bg-slate-50 border border-slate-200 rounded-full shadow-xs">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#c9a654] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#c9a654]"></span>
        </span>
        <span className="text-xs font-semibold text-[#122244] tracking-wide">
          {projectName ? `Analyzing: ${projectName}` : "Feasibility Engine Active"}
        </span>
        <span className="text-slate-300">|</span>
        <span className="text-[11px] font-bold text-[#b59545] uppercase tracking-wider">
          {currentStage.badge}
        </span>
      </div>

      {/* 2. Central AI Analysis Visual */}
      <div className="relative w-52 h-52 sm:w-60 sm:h-60 mb-10 flex items-center justify-center">
        {/* Soft Ambient Radial Glow */}
        <div className="absolute inset-4 rounded-full bg-gradient-to-tr from-[#c9a654]/15 via-[#122244]/5 to-amber-200/20 blur-xl animate-pulse pointer-events-none" />

        {/* Outer Orbital Track 1 - Clockwise */}
        <div className="absolute inset-0 rounded-full border border-dashed border-[#c9a654]/40 animate-[spin_20s_linear_infinite]" />

        {/* Outer Orbital Track 2 - Counter-Clockwise with Segment Accents */}
        <div className="absolute inset-3 rounded-full border border-slate-200/80 animate-[spin_14s_linear_infinite_reverse]">
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#c9a654] shadow-xs shadow-[#c9a654]" />
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#122244]" />
        </div>

        {/* Inner Orbital Track 3 - Gentle Clockwise */}
        <div className="absolute inset-7 rounded-full border border-[#c9a654]/25 animate-[spin_9s_linear_infinite]" />

        {/* Floating Satellite Data Badge: Top-Left (Financial Metrics) */}
        <div className="absolute -top-1 -left-1 sm:top-1 sm:left-1 w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-md flex items-center justify-center text-[#122244] animate-bounce [animation-duration:3.2s]">
          <BarChart3 className="w-4 h-4 text-[#c9a654]" />
        </div>

        {/* Floating Satellite Data Badge: Top-Right (Risk & Rubrics) */}
        <div className="absolute -top-1 -right-1 sm:top-1 sm:right-1 w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-md flex items-center justify-center text-[#122244] animate-bounce [animation-duration:3.8s] [animation-delay:0.4s]">
          <ShieldAlert className="w-4 h-4 text-[#122244]" />
        </div>

        {/* Floating Satellite Data Badge: Bottom-Right (Market Growth) */}
        <div className="absolute -bottom-1 -right-1 sm:bottom-1 sm:right-1 w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-md flex items-center justify-center text-[#122244] animate-bounce [animation-duration:3.5s] [animation-delay:0.8s]">
          <TrendingUp className="w-4 h-4 text-[#c9a654]" />
        </div>

        {/* Floating Satellite Data Badge: Bottom-Left (Audit Check) */}
        <div className="absolute -bottom-1 -left-1 sm:bottom-1 sm:left-1 w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-md flex items-center justify-center text-[#122244] animate-bounce [animation-duration:4s] [animation-delay:0.2s]">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        </div>

        {/* Central Core Hub */}
        <div className="relative z-10 w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-[#122244] to-[#0a1428] border-2 border-[#c9a654]/70 shadow-xl shadow-[#122244]/25 flex items-center justify-center group">
          {/* Subtle Rotating Light Sweep */}
          <div className="absolute inset-0 rounded-full border border-white/10" />
          
          {/* Pulsing Concentric Ripple */}
          <div className="absolute inset-1 rounded-full border border-[#c9a654]/30 animate-ping [animation-duration:2.5s]" />

          {/* Central AI Icon */}
          <div className="relative flex flex-col items-center justify-center text-[#c9a654]">
            <BrainCircuit className="w-10 h-10 sm:w-12 sm:h-12 animate-pulse text-[#c9a654] drop-shadow-[0_2px_8px_rgba(201,166,84,0.4)]" />
          </div>
        </div>
      </div>

      {/* 3. Dynamic Loading Messages with Smooth Fade Transition */}
      <div className="max-w-xl mx-auto px-4 min-h-[96px] flex flex-col items-center justify-center">
        <div
          className={`transition-all duration-300 ease-in-out transform ${
            fadeState === "in"
              ? "opacity-100 translate-y-0"
              : "opacity-0 -translate-y-2"
          }`}
        >
          {/* Dynamic Status Heading */}
          <div className="flex items-center justify-center gap-2 mb-2">
            <StageIcon className="w-5 h-5 text-[#c9a654]" />
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#122244] tracking-tight">
              {currentStage.status}
            </h2>
          </div>

          {/* Small Supporting Message */}
          <p className="text-xs sm:text-sm text-slate-500 font-normal leading-relaxed max-w-md mx-auto">
            {currentStage.supporting}
          </p>
        </div>
      </div>

      {/* 4. Activity-Driven Progress Stepper (● ● ● ● ●) */}
      <div className="mt-8 flex flex-col items-center gap-3">
        <div className="flex items-center gap-2.5">
          {STAGES.map((_, index) => {
            const isActive = index === currentStageIndex;
            const isCompleted = index < currentStageIndex;

            return (
              <div
                key={index}
                className={`transition-all duration-500 ease-out rounded-full ${
                  isActive
                    ? "w-8 h-2.5 bg-gradient-to-r from-[#c9a654] to-[#e6ca85] shadow-xs shadow-[#c9a654]/60"
                    : isCompleted
                    ? "w-2.5 h-2.5 bg-[#122244]/75"
                    : "w-2.5 h-2.5 bg-slate-200"
                }`}
                title={`Stage ${index + 1}`}
              />
            );
          })}
        </div>

        {/* Phase Subtitle */}
        <span className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
          {currentStage.phase}
        </span>
      </div>
    </div>
  );
};

export default AIAnalysisLoading;
