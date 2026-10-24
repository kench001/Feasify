import React from "react";
import { X } from "lucide-react";

interface SidebarCloseButtonProps {
  onClick: () => void;
  className?: string;
}

export const SidebarCloseButton: React.FC<SidebarCloseButtonProps> = ({
  onClick,
  className = "",
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 lg:hidden transition-colors cursor-pointer shrink-0 ${className}`}
      title="Close Menu"
      aria-label="Close Menu"
    >
      <X className="w-5 h-5" />
    </button>
  );
};

export default SidebarCloseButton;
