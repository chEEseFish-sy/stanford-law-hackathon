import {
  AlertCircle,
  ArrowUpRight,
  FileText,
  GitCommitHorizontal,
  Layers3,
  PieChart,
  Scale,
  ScanSearch,
  Sparkles,
} from "lucide-react";
import { useWorkbench } from "../../context/WorkbenchContext";
import type { TabKey } from "../../types/navigation";
import { cn } from "../../utils/cn";

interface SidebarProps {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
}

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const { snapshot } = useWorkbench();
  const navItems: Array<{
    id: TabKey;
    label: string;
    caption: string;
    icon: typeof Scale;
  }> = [
    { id: "workflow", label: "Workflow", caption: "One-screen command center", icon: Sparkles },
    { id: "documents", label: "Step 1", caption: "Organize by time and type", icon: FileText },
    { id: "review", label: "Step 2", caption: "Review evidence with source labels", icon: AlertCircle },
    { id: "captable", label: "Step 3", caption: "Build the working cap table", icon: PieChart },
    { id: "compare", label: "Compare", caption: "Previous vs current document", icon: Layers3 },
    { id: "traceback", label: "Traceback", caption: "Rollback and branch history", icon: GitCommitHorizontal },
  ];
  const verifiedCount =
    snapshot?.documents.filter((document) => document.evidenceStatus === "verified").length ?? 0;
  const reviewCount =
    snapshot?.documents.filter((document) => document.evidenceStatus === "conflict").length ?? 0;

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-80 flex-col border-r border-white/10 bg-black/35 text-slate-300 shadow-[18px_0_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
      <div className="border-b border-white/10 p-7">
        <div className="flex items-center gap-3">
          <div className="rounded-3xl bg-gradient-to-br from-orange-300 to-orange-600 p-3 text-black shadow-[0_16px_34px_rgba(255,130,36,0.38)]">
            <Scale className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">VeriCap</h1>
            <div className="mt-1 text-xs uppercase tracking-[0.26em] text-white/35">Evidence-backed cap table audit</div>
          </div>
        </div>
        <div className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.06] p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.26em] text-orange-200/80">
            <ScanSearch className="h-3.5 w-3.5" />
            Matter
          </div>
          <div className="mt-3 text-base font-semibold text-white">
            {snapshot?.workspace.caseName ?? "Loading matter"}
          </div>
          <div className="mt-2 text-sm leading-6 text-white/55">
            Keep the user in a clear sequence from intake to review to a reversible working cap table.
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3">
              <div className="text-[11px] uppercase tracking-[0.22em] text-white/35">Verified</div>
              <div className="mt-2 text-lg font-semibold text-white">{verifiedCount}</div>
            </div>
            <div className="rounded-2xl border border-orange-300/15 bg-orange-500/10 px-3 py-3">
              <div className="text-[11px] uppercase tracking-[0.22em] text-orange-100/60">Needs review</div>
              <div className="mt-2 text-lg font-semibold text-white">{reviewCount}</div>
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto px-5 py-5">
        <div className="mb-3 px-2 text-xs font-semibold uppercase tracking-[0.26em] text-white/35">
          Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "group flex w-full items-center gap-4 rounded-[24px] border px-4 py-4 text-left transition-all duration-200",
                isActive
                  ? "border-orange-300/35 bg-gradient-to-r from-orange-400/18 to-white/8 text-white shadow-[0_16px_40px_rgba(255,120,24,0.18)]"
                  : "border-white/8 bg-white/[0.03] text-white/72 hover:border-white/12 hover:bg-white/[0.06] hover:text-white",
              )}
            >
              <div
                className={cn(
                  "rounded-2xl p-3 transition-colors duration-200",
                  isActive ? "bg-white text-black" : "bg-white/6 text-white/60 group-hover:bg-white/10",
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{item.label}</div>
                <div className="mt-1 text-xs text-white/45">{item.caption}</div>
              </div>
              <ArrowUpRight
                className={cn(
                  "h-4 w-4 shrink-0 transition-all duration-200",
                  isActive ? "text-orange-100" : "translate-y-1 text-white/25 group-hover:translate-y-0 group-hover:text-white/55",
                )}
              />
            </button>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-5">
        <div className="rounded-[24px] border border-emerald-300/18 bg-emerald-500/10 px-4 py-4">
          <div className="text-[11px] uppercase tracking-[0.22em] text-emerald-200/65">Viewing now</div>
          <div className="mt-2 text-sm font-semibold text-white">
            {snapshot?.topology.currentViewingNodeId ?? "—"}
          </div>
        </div>
        <div className="mt-3 rounded-[24px] border border-white/8 bg-white/[0.04] px-4 py-4">
          <div className="text-[11px] uppercase tracking-[0.22em] text-white/35">Reserved API</div>
          <div className="mt-2 break-all text-xs leading-5 text-white/55">
            POST /api/cases/:caseId/files
            <br />
            POST /api/cases/:caseId/viewing-version
          </div>
        </div>
      </div>
    </aside>
  );
}
