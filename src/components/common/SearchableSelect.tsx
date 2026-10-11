"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
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
  const [highlightedIndex, setHighlightedIndex] = useState(0);
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
    if (isOpen) {
      setHighlightedIndex(0);
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }
  }, [isOpen]);

  const filteredOptions = options.filter((opt) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const l = opt.label.toLowerCase();
    const v = opt.value.toLowerCase();
    if (l.includes(q) || v.includes(q)) return true;
    const words = q.split(/\s+/).filter(Boolean);
    return words.every((w) => l.includes(w) || v.includes(w));
  });

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredOptions[highlightedIndex]) {
        onChange(filteredOptions[highlightedIndex].value);
        setIsOpen(false);
      }
    }
  };

  return (
    <div className={`relative ${isOpen ? "z-50" : ""} ${className}`} ref={containerRef}>
      <div
        className={`w-full px-3.5 py-2 text-xs text-slate-900 rounded-xl border flex items-center justify-between transition-all min-h-[38px] ${
          disabled
            ? "bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed"
            : isOpen
            ? "bg-white ring-2 ring-[#a80063]/10 border-[#a80063] cursor-text shadow-2xs"
            : "bg-slate-50/70 border-slate-200 hover:bg-slate-100/70 hover:border-slate-300 cursor-pointer"
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
            <Search size={13} className="text-[#a80063] shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Ketik untuk mencari..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setHighlightedIndex(0);
              }}
              className="w-full bg-transparent border-none focus:outline-none placeholder-slate-400 text-xs text-slate-900 font-medium"
              onKeyDown={handleKeyDown}
            />
            {search && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSearch("");
                  searchInputRef.current?.focus();
                }}
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer shrink-0"
                title="Hapus pencarian"
              >
                <X size={12} />
              </button>
            )}
          </div>
        ) : (
          <span className={`truncate pr-2 ${selectedOption ? "font-semibold text-slate-800" : "text-slate-400"}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        )}
        <div
          className="cursor-pointer flex items-center ml-1"
          onClick={(e) => {
            if (isOpen && !disabled) {
              e.stopPropagation();
              setIsOpen(false);
            }
          }}
        >
          <ChevronDown
            size={14}
            className={`text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180 text-[#a80063]" : ""} shrink-0`}
          />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 bg-white border border-slate-200/90 rounded-xl shadow-xl animate-fade-in origin-top overflow-hidden">
          <div className="max-h-56 overflow-y-auto py-1 custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <div className="px-3.5 py-3 text-xs text-slate-400 text-center italic">
                Pencarian tidak ditemukan
              </div>
            ) : (
              filteredOptions.map((opt, idx) => (
                <div
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`px-3.5 py-2 text-xs cursor-pointer flex items-center justify-between transition-colors ${
                    value === opt.value
                      ? "bg-[#fdf2f8] text-[#a80063] font-bold"
                      : highlightedIndex === idx
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="truncate pr-2">{opt.label}</span>
                  {value === opt.value && <Check size={13} className="text-[#a80063] shrink-0" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
