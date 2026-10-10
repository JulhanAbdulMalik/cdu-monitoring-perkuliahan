"use client";

import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, Check, X } from "lucide-react";

export interface OptionItem {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: OptionItem[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Pilih opsi...",
  className = "",
  disabled = false,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={`relative ${isOpen ? "z-30" : ""} ${className}`} ref={containerRef}>
      <div
        className={`w-full px-3 py-1.5 text-xs text-slate-900 rounded-lg border flex items-center justify-between transition-colors ${
          disabled ? "bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed" : 
          isOpen ? "bg-white ring-1 ring-[#a80063]/20 border-[#a80063] cursor-text" : 
          "bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300 cursor-pointer"
        }`}
        onClick={() => {
          if (!disabled && !isOpen) {
            setIsOpen(true);
            setSearch("");
          }
        }}
      >
        {isOpen ? (
          <div className="flex items-center gap-2 w-full">
            <Search size={13} className="text-slate-400 flex-shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Ketik untuk mencari..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent border-none focus:outline-none placeholder-slate-400"
              onKeyDown={(e) => {
                if (e.key === "Escape") setIsOpen(false);
              }}
            />
          </div>
        ) : (
          <span className={`truncate pr-2 ${selectedOption ? "font-medium" : "text-slate-400"}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        )}
        <div
          className="cursor-pointer flex items-center"
          onClick={(e) => {
            if (isOpen && !disabled) {
              e.stopPropagation();
              setIsOpen(false);
            }
          }}
        >
          <ChevronDown size={14} className={`text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""} flex-shrink-0`} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl animate-fade-in origin-top">
          <div className="max-h-48 overflow-y-auto py-1 custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-500 text-center">
                Pencarian tidak ditemukan
              </div>
            ) : (
              filteredOptions.map((opt) => (
                <div
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`px-3 py-1.5 text-xs cursor-pointer flex items-center justify-between hover:bg-slate-50 ${
                    value === opt.value ? "bg-[#fdf2f8] text-[#a80063] font-medium" : "text-slate-700"
                  }`}
                >
                  <span className="truncate pr-2">{opt.label}</span>
                  {value === opt.value && <Check size={12} className="text-[#a80063] flex-shrink-0" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
