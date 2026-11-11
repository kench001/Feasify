import React from "react";

export interface AIAdvisoryDisclaimerBannerProps {
  className?: string;
}

export const AIAdvisoryDisclaimerBanner: React.FC<AIAdvisoryDisclaimerBannerProps> = ({
  className = "",
}) => {
  return (
    <div
      role="region"
      aria-label="AI Advisory Disclaimer"
      className={`p-4 sm:py-5 sm:px-6 bg-[#fef9ee] border border-[#f59e0b] rounded-2xl shadow-xs flex items-center gap-4 sm:gap-5.5 transition-all ${className}`}
    >
      <div className="flex-shrink-0 flex items-center justify-center">
        <svg
          className="w-9 h-9 sm:w-10 sm:h-10 text-[#f59e0b] drop-shadow-2xs"
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
            fill="#f59e0b"
          />
          <path
            d="M12 9v4m0 3.5h.01"
            stroke="#ffffff"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Vertical Divider */}
      <div
        className="w-[1.5px] bg-[#f59e0b]/60 self-stretch min-h-[40px] flex-shrink-0"
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1">
        <h3 className="font-black text-[#6d280e] text-base sm:text-[18px] tracking-tight block mb-1">
          AI Advisory Disclaimer
        </h3>
        <p className="text-xs sm:text-[13.5px] text-gray-800 leading-relaxed font-normal">
          The verdict and recommendations provided by the AI serve solely as
          guidance to help students explore and evaluate their proposal. Do
          not fully rely on this assessment as a final or definitive
          judgment—always validate assumptions and consult your research
          adviser.
        </p>
      </div>
    </div>
  );
};

export default AIAdvisoryDisclaimerBanner;
