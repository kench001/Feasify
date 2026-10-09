import React from "react";
import { Menu } from "lucide-react";

interface MobileBurgerButtonProps {
  onClick: () => void;
  className?: string;
}

export const MobileBurgerButton: React.FC<MobileBurgerButtonProps> = ({
  onClick,
  className = "",
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-2 -ml-1 mr-1 text-gray-700 hover:text-[#122244] hover:bg-gray-100 dark:text-gray-200 dark:hover:text-white dark:hover:bg-white/10 rounded-lg lg:hidden transition-colors flex items-center justify-center shrink-0 cursor-pointer ${className}`}
      title="Open Navigation Menu"
      aria-label="Open Navigation Menu"
    >
      <Menu className="w-5 h-5 text-[#122244] dark:text-[#c9a654]" />
    </button>
  );
};

export default MobileBurgerButton;
