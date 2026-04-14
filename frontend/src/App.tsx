import { useState } from "react";
import { AppLayout } from "./components/layout/AppLayout";
import { Sidebar } from "./components/layout/Sidebar";
import { WorkbenchProvider } from "./context/WorkbenchContext";
import { WorkingCapTable } from "./pages/captable/WorkingCapTable";
import { Dashboard } from "./pages/dashboard/Dashboard";
import { DocumentIntake } from "./pages/documents/DocumentIntake";
import { EvidenceReview } from "./pages/evidence/EvidenceReview";
import { TopologyGraph } from "./pages/topology/TopologyGraph";
import type { TabKey } from "./types/navigation";
import { cn } from "./utils/cn";

const quickTabs: Array<{ id: TabKey; label: string }> = [
  { id: "workflow", label: "Workflow" },
  { id: "documents", label: "Documents" },
  { id: "review", label: "Review" },
  { id: "captable", label: "Cap table" },
  { id: "traceback", label: "Traceback" },
];

function AppShell() {
  const [activeTab, setActiveTab] = useState<TabKey>("workflow");

  const renderActiveTab = () => {
    if (activeTab === "workflow") {
      return <Dashboard />;
    }
    if (activeTab === "documents") {
      return <DocumentIntake />;
    }
    if (activeTab === "review") {
      return <EvidenceReview />;
    }
    if (activeTab === "captable") {
      return <WorkingCapTable setActiveTab={setActiveTab} />;
    }
    return <TopologyGraph />;
  };

  return (
    <AppLayout>
      <div className="h-full w-full">
        {activeTab === "workflow" ? null : <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />}
        <QuickTabBar activeTab={activeTab} setActiveTab={setActiveTab} />
        <div
          className={cn(
            "h-full w-full",
            activeTab === "workflow" ? "overflow-hidden" : "overflow-y-auto pl-80 pt-20",
          )}
        >
          <div className={cn(activeTab === "workflow" ? "h-full" : "mx-auto max-w-7xl px-8 pb-10")}>
            {renderActiveTab()}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function QuickTabBar({
  activeTab,
  setActiveTab,
}: {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
}) {
  return (
    <div className="fixed right-4 top-4 z-50 flex flex-wrap gap-2 rounded-[18px] border border-white/10 bg-black/70 p-2 backdrop-blur-xl">
      {quickTabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => setActiveTab(tab.id)}
          className={cn(
            "rounded-lg px-3 py-2 text-xs font-medium text-white/68 transition hover:bg-white/[0.08] hover:text-white",
            activeTab === tab.id ? "bg-orange-500/18 text-orange-100" : "",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default function App() {
  return (
    <WorkbenchProvider>
      <AppShell />
    </WorkbenchProvider>
  );
}
