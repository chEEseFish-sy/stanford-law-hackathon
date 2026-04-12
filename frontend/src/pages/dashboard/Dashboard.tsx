import { FileText, AlertCircle, CheckCircle2, TrendingUp, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "../../utils/cn";

export function Dashboard() {
  const stats = [
    { label: "Documents Scanned", value: "24", icon: FileText, color: "text-blue-500", bg: "bg-blue-50" },
    { label: "Evidence Conflicts", value: "3", icon: AlertCircle, color: "text-amber-500", bg: "bg-amber-50" },
    { label: "Events Reconstructed", value: "18", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50" },
    { label: "Cap Table Accuracy", value: "85%", icon: TrendingUp, color: "text-indigo-500", bg: "bg-indigo-50" },
  ];

  const recentActivity = [
    { type: "conflict", text: "SAFE Note valuation cap mismatch detected.", time: "10 mins ago", status: "needs_review" },
    { type: "success", text: "Founder A's initial shares verified.", time: "1 hr ago", status: "confirmed" },
    { type: "upload", text: "Uploaded 5 new Board Consent PDFs.", time: "3 hrs ago", status: "neutral" },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              key={i} 
              className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-start justify-between"
            >
              <div>
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">{stat.label}</p>
                <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
              </div>
              <div className={cn("p-3 rounded-xl", stat.bg)}>
                <Icon className={cn("w-6 h-6", stat.color)} />
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900">Working Cap Table Summary</h3>
            <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 group">
              View Full Table <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 text-sm font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="pb-3 pr-4">Shareholder</th>
                  <th className="pb-3 px-4">Security Type</th>
                  <th className="pb-3 px-4 text-right">Shares</th>
                  <th className="pb-3 pl-4 text-right">Ownership</th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium text-slate-700">
                <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="py-4 pr-4">Alice Founder</td>
                  <td className="py-4 px-4"><span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md text-xs font-bold">Common</span></td>
                  <td className="py-4 px-4 text-right font-mono">4,000,000</td>
                  <td className="py-4 pl-4 text-right">40.0%</td>
                </tr>
                <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="py-4 pr-4">Bob Founder</td>
                  <td className="py-4 px-4"><span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md text-xs font-bold">Common</span></td>
                  <td className="py-4 px-4 text-right font-mono">4,000,000</td>
                  <td className="py-4 pl-4 text-right">40.0%</td>
                </tr>
                <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="py-4 pr-4">Seed VC Fund</td>
                  <td className="py-4 px-4"><span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md text-xs font-bold">Seed Preferred</span></td>
                  <td className="py-4 px-4 text-right font-mono">2,000,000</td>
                  <td className="py-4 pl-4 text-right">20.0%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Recent Activity</h3>
          <div className="space-y-6">
            {recentActivity.map((activity, i) => (
              <div key={i} className="flex gap-4 relative">
                {i !== recentActivity.length - 1 && (
                  <div className="absolute top-8 left-3.5 bottom-[-24px] w-px bg-slate-200" />
                )}
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 ring-4 ring-white",
                  activity.status === 'needs_review' ? "bg-amber-100 text-amber-600" :
                  activity.status === 'confirmed' ? "bg-emerald-100 text-emerald-600" :
                  "bg-blue-100 text-blue-600"
                )}>
                  {activity.status === 'needs_review' ? <AlertCircle className="w-4 h-4" /> :
                   activity.status === 'confirmed' ? <CheckCircle2 className="w-4 h-4" /> :
                   <FileText className="w-4 h-4" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{activity.text}</p>
                  <p className="text-xs text-slate-500 mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
