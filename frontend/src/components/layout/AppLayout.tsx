import type { ReactNode } from "react";
import { useWorkbench } from "../../context/WorkbenchContext";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { snapshot } = useWorkbench();

  return (
    <div className="relative h-screen overflow-hidden bg-[#050505] font-sans text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,141,35,0.28),_transparent_24%),radial-gradient(circle_at_80%_20%,_rgba(255,98,0,0.22),_transparent_18%),radial-gradient(circle_at_50%_100%,_rgba(255,176,96,0.12),_transparent_26%),linear-gradient(180deg,_#090909_0%,_#111111_46%,_#0a0a0a_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:72px_72px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_40%,_rgba(0,0,0,0.58)_100%)]" />
      <main className="relative z-10 flex h-screen flex-col overflow-hidden">
        <header className="z-10 shrink-0 border-b border-white/10 bg-black/30 px-4 py-3 backdrop-blur-2xl">
          <div className="mx-auto flex max-w-[1600px] items-center gap-3">
            <div className="flex-1">
              <div className="text-[11px] uppercase tracking-[0.32em] text-orange-200/70">VeriCap</div>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
                Evidence workspace
              </h1>
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/65">
              {snapshot?.workspace.caseName ?? "Loading matter"}
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/65">
              Viewing {snapshot?.topology.currentViewingNodeId ?? "Loading"}
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-hidden px-3 py-3">
          <div className="mx-auto h-full max-w-[1600px]">{children}</div>
        </div>
      </main>
    </div>
  );
}
