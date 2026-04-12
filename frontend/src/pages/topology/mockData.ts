export const initialNodes = [
  {
    id: "doc-1",
    type: "document",
    position: { x: 100, y: 50 },
    data: { label: "SAFE Agreement - Founder A", date: "2023-01-15", type: "safe" },
  },
  {
    id: "doc-2",
    type: "document",
    position: { x: 400, y: 50 },
    data: { label: "Board Consent - Seed Round", date: "2023-06-01", type: "board_consent" },
  },
  {
    id: "event-1",
    type: "event",
    position: { x: 100, y: 200 },
    data: { 
      label: "SAFE Issuance", 
      status: "confirmed",
      details: "Amount: $500k, Valuation Cap: $5M, Discount: 20%"
    },
  },
  {
    id: "event-2",
    type: "event",
    position: { x: 400, y: 200 },
    data: { 
      label: "Priced Round Approval", 
      status: "needs_review",
      details: "Approved $2M at $10M pre-money valuation. Missing stockholder consent."
    },
  },
  {
    id: "cap-row-1",
    type: "capTableRow",
    position: { x: 250, y: 400 },
    data: { label: "Founder A - Seed Preferred", shares: "1,250,000" },
  },
];

export const initialEdges = [
  { id: "e1-1", source: "doc-1", target: "event-1", animated: true },
  { id: "e1-2", source: "doc-2", target: "event-2", animated: true },
  { id: "e2-1", source: "event-1", target: "cap-row-1", animated: true },
  { id: "e2-2", source: "event-2", target: "cap-row-1", animated: true },
];