import { 
  Home, 
  FileText, 
  AlertCircle, 
  ListTree, 
  PieChart, 
  Settings,
  Scale,
  GitCommitHorizontal
} from "lucide-react";
import { cn } from "../../utils/cn";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "documents", label: "Document Intake", icon: FileText },
    { id: "evidence", label: "Evidence Review", icon: AlertCircle },
    { id: "timeline", label: "Event Timeline", icon: ListTree },
    { id: "captable", label: "Working Cap Table", icon: PieChart },
    { id: "topology", label: "Evidence Topology", icon: GitCommitHorizontal },
  ];

  return (
    <aside className="w-64 h-screen bg-slate-900 text-slate-300 flex flex-col fixed left-0 top-0">
      <div className="p-6 flex items-center gap-3">
        <div className="bg-indigo-500 p-2 rounded-lg">
          <Scale className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">VeriCap</h1>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-2">
          Workspace
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group text-sm font-medium",
                isActive 
                  ? "bg-indigo-500/10 text-indigo-400" 
                  : "hover:bg-slate-800 hover:text-white"
              )}
            >
              <Icon className={cn(
                "w-5 h-5 transition-colors duration-200",
                isActive ? "text-indigo-400" : "text-slate-400 group-hover:text-slate-300"
              )} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors text-sm font-medium">
          <Settings className="w-5 h-5 text-slate-400" />
          Settings
        </button>
      </div>
    </aside>
  );
}
