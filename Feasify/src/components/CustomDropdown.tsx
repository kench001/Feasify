import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface DropdownOption {
  value: string;
  label: string;
}

interface CustomDropdownProps {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  direction?: "auto" | "up" | "down";
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  value,
  options,
  onChange,
  placeholder = "Select an option...",
  disabled = false,
  className = "",
  buttonClassName = "",
  menuClassName = "",
  direction = "down",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      if (direction === "up") {
        setOpenUpward(true);
      } else if (direction === "down") {
        setOpenUpward(false);
      } else if (dropdownRef.current) {
        const rect = dropdownRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        setOpenUpward(spaceBelow < 250 && rect.top > 200);
      }
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative w-full ${className}`} ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 bg-white border ${
          isOpen
            ? "border-[#c9a654] ring-2 ring-[#c9a654]/20 shadow-xs"
            : "border-gray-200 hover:border-[#c9a654]/60"
        } rounded-xl text-sm font-medium transition-all text-[#122244] text-left outline-none cursor-pointer disabled:cursor-not-allowed disabled:bg-gray-100/70 disabled:opacity-60 ${buttonClassName}`}
      >
        <span className={selectedOption ? "text-[#122244] font-medium truncate" : "text-gray-400 font-normal truncate"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0 ml-2 ${
            isOpen ? "rotate-180 text-[#c9a654]" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute z-[999] ${
            openUpward ? "bottom-full mb-1.5" : "top-full mt-1.5"
          } w-full min-w-full bg-white border border-gray-100 rounded-2xl shadow-xl p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 duration-150 max-h-60 overflow-y-auto custom-scrollbar ${menuClassName}`}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <div
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-between cursor-pointer ${
                  isSelected
                    ? "bg-[#fef9ee] text-[#c9a654] font-semibold"
                    : "text-[#122244] hover:bg-gray-50 hover:text-[#c9a654]"
                }`}
              >
                <span className="truncate">{option.label}</span>
                {isSelected && <Check className="w-4 h-4 text-[#c9a654] shrink-0 ml-2" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CustomDropdown;

