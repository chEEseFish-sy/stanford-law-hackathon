import type { ReactNode } from "react";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="relative h-screen overflow-hidden bg-[#0A0A0A] font-sans text-white">
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:72px_72px]" />
      {/* Removed the center radial gradient shadow */}
      {/* Top Navigation - Removed Dashboard Header as requested */}
      <main className="relative z-10 flex h-screen flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="h-full w-full">{children}</div>
        </div>
      </main>
    </div>
  );
}
