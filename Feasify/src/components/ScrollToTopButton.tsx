import React, { useState, useEffect } from "react";
import { ChevronUp } from "lucide-react";

export const ScrollToTopButton: React.FC = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let rafId: number | null = null;

    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        const docScroll = document.documentElement.scrollTop || document.body.scrollTop || 0;
        let maxContainerScroll = 0;
        const mains = document.querySelectorAll("main");
        mains.forEach((m) => {
          if (m.scrollTop > maxContainerScroll) maxContainerScroll = m.scrollTop;
        });
        const isPastThreshold = window.scrollY > 150 || docScroll > 150 || maxContainerScroll > 150;
        setShow((prev) => (prev !== isPastThreshold ? isPastThreshold : prev));
        rafId = null;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true, capture: true });
    // Check initial scroll on mount
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll, { capture: true } as any);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  if (!show) return null;

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.documentElement.scrollTo({ top: 0, behavior: "smooth" });
    document.body.scrollTo({ top: 0, behavior: "smooth" });
    const mains = document.querySelectorAll("main");
    mains.forEach((m) => m.scrollTo({ top: 0, behavior: "smooth" }));
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      title="Back to Top"
      className="fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full bg-[#c9a654] hover:bg-[#b89542] text-white shadow-[0_4px_16px_rgba(201,166,84,0.45)] hover:shadow-[0_6px_22px_rgba(201,166,84,0.65)] transition-all duration-300 transform hover:scale-110 active:scale-95 flex items-center justify-center cursor-pointer group print:hidden animate-in fade-in zoom-in-75 duration-200"
      aria-label="Scroll to top"
    >
      <ChevronUp className="w-5 h-5 text-white stroke-[2.75] transition-transform duration-200 group-hover:-translate-y-0.5" />
    </button>
  );
};

export default ScrollToTopButton;

