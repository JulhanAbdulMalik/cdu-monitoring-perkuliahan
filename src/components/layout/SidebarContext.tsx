"use client";
// src/components/layout/SidebarContext.tsx
// Context for Collapsible Mini / Full Sidebar with localStorage persistence

import React, { createContext, useContext, useState, useEffect } from "react";

interface SidebarContextType {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  setCollapsed: (value: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("cdu_sidebar_collapsed");
    if (saved !== null) {
      setIsCollapsed(saved === "true");
    }
  }, []);

  function toggleSidebar() {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("cdu_sidebar_collapsed", String(next));
      return next;
    });
  }

  function setCollapsed(value: boolean) {
    setIsCollapsed(value);
    localStorage.setItem("cdu_sidebar_collapsed", String(value));
  }

  return (
    <SidebarContext.Provider
      value={{
        isCollapsed: mounted ? isCollapsed : false,
        toggleSidebar,
        setCollapsed,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
