import type { ReactNode } from "react";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="relative h-screen overflow-hidden bg-[#050505] font-sans text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,141,35,0.28),_transparent_24%),radial-gradient(circle_at_80%_20%,_rgba(255,98,0,0.22),_transparent_18%),radial-gradient(circle_at_50%_100%,_rgba(255,176,96,0.12),_transparent_26%),linear-gradient(180deg,_#090909_0%,_#111111_46%,_#0a0a0a_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:72px_72px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_40%,_rgba(0,0,0,0.58)_100%)]" />
      <main className="relative z-10 flex h-screen flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-hidden px-3 py-3">
          <div className="mx-auto h-full max-w-[1600px]">{children}</div>
        </div>
      </main>
    </div>
  );
}
