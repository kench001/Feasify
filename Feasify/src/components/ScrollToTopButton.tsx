import React, { useState, useEffect } from "react";
import { ChevronUp } from "lucide-react";

export const ScrollToTopButton: React.FC = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let rafId: number | null = null;

    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        const isPastThreshold = window.scrollY > 300;
        setShow((prev) => (prev !== isPastThreshold ? isPastThreshold : prev));
        rafId = null;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  if (!show) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      title="Back to Top"
      className="fixed bottom-6 right-6 z-40 p-3.5 rounded-full bg-[#c9a654] hover:bg-[#b59545] text-white shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-110 active:scale-95 flex items-center justify-center cursor-pointer group print:hidden border border-amber-300/40"
      aria-label="Scroll to top"
    >
      <ChevronUp className="w-5 h-5 transition-transform group-hover:-translate-y-0.5" />
    </button>
  );
};

export default ScrollToTopButton;
