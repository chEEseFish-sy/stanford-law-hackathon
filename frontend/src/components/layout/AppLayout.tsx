import React, { useState } from "react";
import { Sidebar } from "./Sidebar";
import { cn } from "../../utils/cn";

interface AppLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function AppLayout({ children, activeTab, setActiveTab }: AppLayoutProps) {
  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 ml-64 flex flex-col h-full relative z-0">
        <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10 flex items-center px-8 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-800 capitalize tracking-tight">
            {activeTab.replace(/([A-Z])/g, ' $1').trim()}
          </h2>
          <div className="ml-auto flex items-center gap-4">
            <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
              Acme Corp Seed Round
            </span>
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center border-2 border-indigo-500 text-indigo-700 font-bold shadow-sm">
              AC
            </div>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}