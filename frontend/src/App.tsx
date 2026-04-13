import { useState } from "react";
import { AppLayout } from "./components/layout/AppLayout";
import { useWorkbench, WorkbenchProvider } from "./context/WorkbenchContext";
import { Dashboard } from "./pages/dashboard/Dashboard";
import { DocumentIntake } from "./pages/documents/DocumentIntake";

type ActiveView = "dashboard" | "documents";

function AppShell() {
  const [activeView, setActiveView] = useState<ActiveView>("dashboard");
  const { apiError } = useWorkbench();

  return (
    <AppLayout>
      <div className="flex h-full flex-col gap-3">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-[22px] border border-white/10 bg-black/25 px-4 py-3 backdrop-blur-xl">
          <div className="flex gap-2">
            {(["dashboard", "documents"] as ActiveView[]).map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => setActiveView(view)}
                className={
                  activeView === view
                    ? "rounded-full border border-orange-300/35 bg-orange-500/16 px-4 py-2 text-sm font-medium text-white"
                    : "rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/58 transition hover:bg-white/[0.08] hover:text-white"
                }
              >
                {view === "dashboard" ? "Dashboard" : "Document Intake"}
              </button>
            ))}
          </div>
          {apiError ? (
            <div className="rounded-full border border-amber-300/25 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
              Backend unavailable, showing demo data: {apiError}
            </div>
          ) : (
            <div className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">
              SQLite workbench connected
            </div>
          )}
        </div>
        <div className="min-h-0 flex-1">
          {activeView === "dashboard" ? <Dashboard /> : <DocumentIntake />}
        </div>
      </div>
    </AppLayout>
  );
}

export default function App() {
  return (
    <WorkbenchProvider>
      <AppShell />
    </WorkbenchProvider>
  );
}
