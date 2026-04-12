import { motion } from "framer-motion";
import { FileText, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { cn } from "../../utils/cn";

export function EventTimeline() {
  const events = [
    {
      id: 1,
      date: "Jan 15, 2022",
      title: "Company Incorporation",
      description: "Founder shares issued to Alice and Bob (4M shares each).",
      status: "confirmed",
      documents: ["Founder_Stock_Purchase_Alice.pdf", "Founder_Stock_Purchase_Bob.pdf"]
    },
    {
      id: 2,
      date: "Jun 01, 2022",
      title: "Pre-seed SAFE Round",
      description: "Raised $500k via post-money SAFE at $5M valuation cap.",
      status: "confirmed",
      documents: ["SAFE_Agreement_SeedVC.pdf"]
    },
    {
      id: 3,
      date: "Mar 10, 2023",
      title: "Option Pool Creation",
      description: "Board approved 10% option pool for early employees.",
      status: "needs_review",
      conflict: "Missing Board Consent document.",
      documents: []
    },
    {
      id: 4,
      date: "Jun 15, 2023",
      title: "Seed Priced Round",
      description: "Raised $2M at $10M pre-money. SAFE converted to Seed Preferred.",
      status: "needs_review",
      conflict: "Missing Stockholder Consent for priced round approval.",
      documents: ["Stock_Purchase_Agreement_VC.pdf", "Board_Consent_Seed_Round.pdf"]
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto py-8"
    >
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Event Timeline</h3>
            <p className="text-sm text-slate-500 mt-1">Chronological reconstruction of cap table events.</p>
          </div>
          <button className="px-4 py-2 text-sm font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors shadow-sm flex items-center gap-2">
            Switch to Topology View <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="relative pl-8 border-l-2 border-slate-200 space-y-10">
          {events.map((event, i) => (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              key={event.id} 
              className="relative"
            >
              <div className={cn(
                "absolute -left-[43px] w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-white shadow-sm",
                event.status === 'confirmed' ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
              )}>
                {event.status === 'confirmed' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              </div>
              
              <div className={cn(
                "bg-white border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow",
                event.status === 'confirmed' ? "border-slate-200" : "border-amber-200 bg-amber-50/30"
              )}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-indigo-600 tracking-wider uppercase">{event.date}</span>
                  {event.status === 'needs_review' && (
                    <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded uppercase tracking-wider">
                      Needs Review
                    </span>
                  )}
                </div>
                <h4 className="text-lg font-bold text-slate-900 mb-2">{event.title}</h4>
                <p className="text-slate-600 text-sm leading-relaxed mb-4">{event.description}</p>
                
                {event.conflict && (
                  <div className="bg-amber-100 text-amber-800 p-3 rounded-xl text-sm font-medium mb-4 flex items-start gap-2 border border-amber-200 shadow-sm">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                    {event.conflict}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {event.documents.map((doc, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-200 hover:text-slate-900 transition-colors cursor-pointer shadow-sm">
                      <FileText className="w-3.5 h-3.5 text-slate-400" /> {doc}
                    </span>
                  ))}
                  {event.documents.length === 0 && (
                    <span className="text-xs font-bold text-slate-400 italic px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">No documents linked</span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
