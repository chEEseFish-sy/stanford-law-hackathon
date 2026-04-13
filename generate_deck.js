const pptxgen = require('pptxgenjs');

let pptx = new pptxgen();

// ==========================================
// 1. SETUP & STYLES (Midnight Executive Theme)
// ==========================================
pptx.layout = 'LAYOUT_16x9';

const THEME = {
  bg: '0F172A',         // Slate 900 (Dark background)
  primary: '3B82F6',    // Blue 500 (Brand accent)
  secondary: '1E293B',  // Slate 800 (Card background)
  textLight: 'F8FAFC',  // Slate 50 (Main text)
  textMuted: '94A3B8',  // Slate 400 (Subtext)
  accent: 'F59E0B',     // Amber 500 (Highlight)
  success: '10B981',    // Emerald 500
};

// ==========================================
// 2. MASTER SLIDES
// ==========================================
pptx.defineSlideMaster({
  title: "TITLE_SLIDE",
  background: { color: THEME.bg },
  objects: [
    // Top right decorative accent
    { rect: { x: "90%", y: 0, w: "10%", h: "0.2", fill: { color: THEME.primary } } },
    { rect: { x: "85%", y: 0, w: "5%", h: "0.2", fill: { color: THEME.accent } } },
    // Footer
    { text: { text: "VERICAP | Cap Table Audit Copilot", options: { x: 0.5, y: "92%", w: 5, h: 0.3, color: THEME.textMuted, fontSize: 10, fontFace: "Arial" } } }
  ]
});

pptx.defineSlideMaster({
  title: "CONTENT_SLIDE",
  background: { color: THEME.bg },
  objects: [
    // Top bar
    { rect: { x: 0, y: 0, w: "100%", h: 0.1, fill: { color: THEME.primary } } },
    // Footer
    { text: { text: "VERICAP | Hackathon 2026", options: { x: 0.5, y: "92%", w: 5, h: 0.3, color: THEME.textMuted, fontSize: 10, fontFace: "Arial" } } },
    // Page number
    { text: { text: "Slide ", options: { x: "85%", y: "92%", w: 1, h: 0.3, align: "right", color: THEME.textMuted, fontSize: 10, fontFace: "Arial" } } }
  ]
});

// ==========================================
// 3. SLIDES
// ==========================================

// SLIDE 1: TITLE
let slide1 = pptx.addSlide({ masterName: "TITLE_SLIDE" });
slide1.addText("VeriCap", { x: 1, y: 2.2, w: 8, h: 1, color: THEME.textLight, fontSize: 54, bold: true, fontFace: "Arial Black" });
slide1.addText("Cap Table Audit Copilot", { x: 1, y: 3.2, w: 8, h: 0.6, color: THEME.primary, fontSize: 28, bold: true, fontFace: "Arial" });
slide1.addText("Automating equity reconciliation from legal source of truth", { x: 1, y: 3.8, w: 8, h: 0.5, color: THEME.textMuted, fontSize: 18, fontFace: "Arial" });

// SLIDE 2: THE PROBLEM
let slide2 = pptx.addSlide({ masterName: "CONTENT_SLIDE" });
slide2.addText("The Problem: Equity Discrepancies", { x: 0.5, y: 0.5, w: 9, h: 0.8, color: THEME.textLight, fontSize: 32, bold: true, fontFace: "Arial Black" });

// Cards for problems
slide2.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.8, w: 3.8, h: 2.8, fill: { color: THEME.secondary }, line: { color: '334155', width: 1 }, rectRadius: 0.1 });
slide2.addText("Fragmented Documents", { x: 0.7, y: 2.0, w: 3.4, h: 0.4, color: THEME.accent, fontSize: 18, bold: true, fontFace: "Arial" });
slide2.addText("SPA, SAFE, Voting, IRA, Board Consents are scattered across emails and data rooms.", { x: 0.7, y: 2.5, w: 3.4, h: 1.8, color: THEME.textMuted, fontSize: 14, fontFace: "Arial", align: "left" });

slide2.addShape(pptx.ShapeType.rect, { x: 4.8, y: 1.8, w: 4.7, h: 1.3, fill: { color: THEME.secondary }, line: { color: '334155', width: 1 }, rectRadius: 0.1 });
slide2.addText("Complex Conversion Math", { x: 5.0, y: 1.9, w: 4.3, h: 0.4, color: THEME.primary, fontSize: 18, bold: true, fontFace: "Arial" });
slide2.addText("Unclear SAFE / Convertible note triggers and option pool expansions.", { x: 5.0, y: 2.3, w: 4.3, h: 0.6, color: THEME.textMuted, fontSize: 14, fontFace: "Arial" });

slide2.addShape(pptx.ShapeType.rect, { x: 4.8, y: 3.3, w: 4.7, h: 1.3, fill: { color: THEME.secondary }, line: { color: '334155', width: 1 }, rectRadius: 0.1 });
slide2.addText("Manual Cross-Checking", { x: 5.0, y: 3.4, w: 4.3, h: 0.4, color: THEME.textLight, fontSize: 18, bold: true, fontFace: "Arial" });
slide2.addText("Lawyers and founders waste hours manually tracing cap tables back to legal texts.", { x: 5.0, y: 3.8, w: 4.3, h: 0.6, color: THEME.textMuted, fontSize: 14, fontFace: "Arial" });


// SLIDE 3: OUR SOLUTION
let slide3 = pptx.addSlide({ masterName: "CONTENT_SLIDE" });
slide3.addText("The Solution: VeriCap", { x: 0.5, y: 0.5, w: 9, h: 0.8, color: THEME.textLight, fontSize: 32, bold: true, fontFace: "Arial Black" });

// 3-step workflow
const stepY = 2.0;
// Step 1
slide3.addShape(pptx.ShapeType.ellipse, { x: 0.8, y: stepY, w: 0.6, h: 0.6, fill: { color: THEME.primary } });
slide3.addText("1", { x: 0.8, y: stepY, w: 0.6, h: 0.6, color: "FFFFFF", fontSize: 20, bold: true, align: "center", fontFace: "Arial" });
slide3.addText("Organize", { x: 1.6, y: stepY, w: 2.5, h: 0.3, color: THEME.textLight, fontSize: 18, bold: true, fontFace: "Arial" });
slide3.addText("Upload raw .docx / .pdf.\nAuto-classify by doc type and time.", { x: 1.6, y: stepY+0.3, w: 2.5, h: 1.0, color: THEME.textMuted, fontSize: 14, fontFace: "Arial" });

// Arrow
slide3.addText("→", { x: 3.8, y: stepY+0.1, w: 0.5, h: 0.5, color: THEME.textMuted, fontSize: 24, align: "center" });

// Step 2
slide3.addShape(pptx.ShapeType.ellipse, { x: 4.3, y: stepY, w: 0.6, h: 0.6, fill: { color: THEME.accent } });
slide3.addText("2", { x: 4.3, y: stepY, w: 0.6, h: 0.6, color: "FFFFFF", fontSize: 20, bold: true, align: "center", fontFace: "Arial" });
slide3.addText("Extract", { x: 5.1, y: stepY, w: 2.5, h: 0.3, color: THEME.textLight, fontSize: 18, bold: true, fontFace: "Arial" });
slide3.addText("AI parses facts into normalized Equity Events with evidence traces.", { x: 5.1, y: stepY+0.3, w: 2.5, h: 1.0, color: THEME.textMuted, fontSize: 14, fontFace: "Arial" });

// Arrow
slide3.addText("→", { x: 7.3, y: stepY+0.1, w: 0.5, h: 0.5, color: THEME.textMuted, fontSize: 24, align: "center" });

// Step 3
slide3.addShape(pptx.ShapeType.ellipse, { x: 7.8, y: stepY, w: 0.6, h: 0.6, fill: { color: THEME.success } });
slide3.addText("3", { x: 7.8, y: stepY, w: 0.6, h: 0.6, color: "FFFFFF", fontSize: 20, bold: true, align: "center", fontFace: "Arial" });
slide3.addText("Reconstruct", { x: 8.6, y: stepY, w: 2.5, h: 0.3, color: THEME.textLight, fontSize: 18, bold: true, fontFace: "Arial" });
slide3.addText("Generate theoretical Cap Table Excel & Flag conflicts.", { x: 8.6, y: stepY+0.3, w: 2.5, h: 1.0, color: THEME.textMuted, fontSize: 14, fontFace: "Arial" });


// SLIDE 4: HOW IT WORKS UNDER THE HOOD
let slide4 = pptx.addSlide({ masterName: "CONTENT_SLIDE" });
slide4.addText("How It Works: Evidence-Driven Architecture", { x: 0.5, y: 0.5, w: 9, h: 0.8, color: THEME.textLight, fontSize: 32, bold: true, fontFace: "Arial Black" });

// Left column: Extraction Engine
slide4.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.6, w: 4.2, h: 3.2, fill: { color: THEME.secondary }, line: { color: '334155', width: 1 }, rectRadius: 0.1 });
slide4.addText("Extraction Engine", { x: 0.7, y: 1.8, w: 3.8, h: 0.4, color: THEME.primary, fontSize: 18, bold: true, fontFace: "Arial" });
slide4.addText("• Analyzes Legal Texts (SPA, Voting, etc.)\n• Extracts Facts (e.g., Price: $1.67)\n• Retains Exact Source Location\n• Calculates Confidence Scores", { x: 0.7, y: 2.3, w: 3.8, h: 2.0, color: THEME.textLight, fontSize: 15, fontFace: "Arial", bullet: true });

// Right column: Reconciliation Engine
slide4.addShape(pptx.ShapeType.rect, { x: 5.1, y: 1.6, w: 4.4, h: 3.2, fill: { color: THEME.secondary }, line: { color: '334155', width: 1 }, rectRadius: 0.1 });
slide4.addText("Reconciliation Engine", { x: 5.3, y: 1.8, w: 4.0, h: 0.4, color: THEME.accent, fontSize: 18, bold: true, fontFace: "Arial" });
slide4.addText("• Maps Facts to Standardized Events\n• Simulates Option Pool Increases\n• Computes SAFE Conversions\n• Outputs Clean Excel Export", { x: 5.3, y: 2.3, w: 4.0, h: 2.0, color: THEME.textLight, fontSize: 15, fontFace: "Arial", bullet: true });

// SLIDE 5: MARKET OPPORTUNITY
let slide5 = pptx.addSlide({ masterName: "CONTENT_SLIDE" });
slide5.addText("Market & Business Value", { x: 0.5, y: 0.5, w: 9, h: 0.8, color: THEME.textLight, fontSize: 32, bold: true, fontFace: "Arial Black" });

slide5.addText("The LegalTech Market is projected to reach $69.7B by 2033 (12.2% CAGR).", { x: 0.5, y: 1.5, w: 9, h: 0.6, color: THEME.textMuted, fontSize: 16, fontFace: "Arial" });

// Target Audience grid
slide5.addShape(pptx.ShapeType.rect, { x: 0.5, y: 2.4, w: 2.8, h: 2.2, fill: { color: '1E293B' } });
slide5.addText("Law Firms", { x: 0.7, y: 2.6, w: 2.4, h: 0.4, color: THEME.primary, fontSize: 18, bold: true, fontFace: "Arial" });
slide5.addText("Save billable hours on initial reviews. Higher throughput for financing deals.", { x: 0.7, y: 3.1, w: 2.4, h: 1.2, color: THEME.textLight, fontSize: 13, fontFace: "Arial" });

slide5.addShape(pptx.ShapeType.rect, { x: 3.5, y: 2.4, w: 2.8, h: 2.2, fill: { color: '1E293B' } });
slide5.addText("In-House Legal", { x: 3.7, y: 2.6, w: 2.4, h: 0.4, color: THEME.success, fontSize: 18, bold: true, fontFace: "Arial" });
slide5.addText("Pre-diligence self-checks. Identify missing documents before the VC auditors arrive.", { x: 3.7, y: 3.1, w: 2.4, h: 1.2, color: THEME.textLight, fontSize: 13, fontFace: "Arial" });

slide5.addShape(pptx.ShapeType.rect, { x: 6.5, y: 2.4, w: 2.8, h: 2.2, fill: { color: '1E293B' } });
slide5.addText("Founders / CFOs", { x: 6.7, y: 2.6, w: 2.4, h: 0.4, color: THEME.accent, fontSize: 18, bold: true, fontFace: "Arial" });
slide5.addText("Validate equity tables independently. Lower friction in next round of funding.", { x: 6.7, y: 3.1, w: 2.4, h: 1.2, color: THEME.textLight, fontSize: 13, fontFace: "Arial" });


// SLIDE 6: CONCLUSION / END
let slide6 = pptx.addSlide({ masterName: "TITLE_SLIDE" });
slide6.addText("VeriCap", { x: 1, y: 2.2, w: 8, h: 1, color: THEME.textLight, fontSize: 54, bold: true, fontFace: "Arial Black", align: "center" });
slide6.addText("Trust, but verify.", { x: 1, y: 3.2, w: 8, h: 0.6, color: THEME.primary, fontSize: 24, fontFace: "Arial", align: "center" });

// Save the file
pptx.writeFile({ fileName: 'VeriCap_Pitch_Deck.pptx' }).then(fileName => {
  console.log(`created file: ${fileName}`);
});
