// ══════════════════════════════════════════════════════════════════════════════
//  pdfReportGenerator.ts  ·  Comprehensive multi-page PDF with charts & tables
// ══════════════════════════════════════════════════════════════════════════════
import type { ReportData } from './reportUtils';

// ── Page constants ────────────────────────────────────────────────────────────
const PW   = 210;           // A4 width  mm
const PH   = 297;           // A4 height mm
const ML   = 14;            // left margin
const MR   = 14;            // right margin
const CW   = PW - ML - MR; // content width

// ── Colour palette ────────────────────────────────────────────────────────────
type RGB = [number, number, number];
const C = {
  primary:  [21,  93, 252] as RGB,
  blue2:    [77, 139, 255] as RGB,
  green:    [22, 163, 74]  as RGB,
  orange:   [249,115,  22] as RGB,
  red:      [220, 38, 38]  as RGB,
  yellow:   [234,179,  8]  as RGB,
  purple:   [124, 58,237]  as RGB,
  grey:     [102,112,133]  as RGB,
  dark:     [26,  26, 46]  as RGB,
  mid:      [107,114,128]  as RGB,
  light:    [232,232,237]  as RGB,
  bg:       [247,248,250]  as RGB,
  white:    [255,255,255]  as RGB,
  headBg:   [235,242,255]  as RGB,
};

const PRIORITY_RGB: Record<string, RGB> = {
  URGENT:    C.red,
  HIGH:      C.orange,
  MEDIUM:    C.yellow,
  NORMAL:    C.primary,
  LOW:       C.green,
  UNASSIGNED:C.grey,
};
const STATUS_RGB: Record<string, RGB> = {
  TODO:        C.grey,
  IN_PROGRESS: C.primary,
  IN_REVIEW:   C.orange,
  DONE:        C.green,
};
const TEAM_PALETTE: RGB[] = [
  C.primary, C.green, C.orange, C.purple, C.red,
  [14,165,233],[236,72,153],[20,184,166],[245,158,11],[132,204,22],
];

// ─────────────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = any;

// ── Low-level drawing helpers ─────────────────────────────────────────────────
function rgb(doc: Doc, c: RGB) { doc.setFillColor(c[0], c[1], c[2]); }
function rgbStroke(doc: Doc, c: RGB) { doc.setDrawColor(c[0], c[1], c[2]); }
function rgbText(doc: Doc, c: RGB) { doc.setTextColor(c[0], c[1], c[2]); }

function fillRect(doc: Doc, x: number, y: number, w: number, h: number, c: RGB, r = 0) {
  rgb(doc, c);
  if (r > 0) doc.roundedRect(x, y, w, h, r, r, 'F');
  else        doc.rect(x, y, w, h, 'F');
}
function strokeRect(doc: Doc, x: number, y: number, w: number, h: number, c: RGB, lw = 0.3) {
  rgbStroke(doc, c); doc.setLineWidth(lw);
  doc.rect(x, y, w, h, 'S');
}

function txt(doc: Doc, t: string, x: number, y: number, size: number, c: RGB, bold = false, align: 'left'|'center'|'right' = 'left') {
  doc.setFontSize(size);
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  rgbText(doc, c);
  doc.text(t, x, y, { align });
}

function hRule(doc: Doc, y: number, c: RGB = C.light) {
  rgbStroke(doc, c); doc.setLineWidth(0.25);
  doc.line(ML, y, PW - MR, y);
}

function clip(s: string, maxChars: number): string {
  return s.length > maxChars ? s.slice(0, maxChars - 3) + '...' : s;
}

// ── Pie / donut chart ─────────────────────────────────────────────────────────
function pieSlice(doc: Doc, cx: number, cy: number, r: number, a0: number, a1: number, c: RGB) {
  if (Math.abs(a1 - a0) < 0.002) return;
  const n = Math.max(4, Math.ceil(40 * Math.abs(a1 - a0) / (2 * Math.PI)));
  const lines: [number, number][] = [];
  lines.push([r * Math.cos(a0), r * Math.sin(a0)]);
  for (let i = 1; i <= n; i++) {
    const pa = a0 + (a1 - a0) * (i - 1) / n;
    const ca = a0 + (a1 - a0) * i / n;
    lines.push([r * (Math.cos(ca) - Math.cos(pa)), r * (Math.sin(ca) - Math.sin(pa))]);
  }
  rgb(doc, c);
  doc.lines(lines, cx, cy, [1, 1], 'F', true);
}

function donutChart(
  doc: Doc, cx: number, cy: number, r: number, innerR: number,
  segments: { value: number; color: RGB; label: string }[],
  centerLabel?: string, centerSub?: string,
) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) return;
  let a = -Math.PI / 2;
  segments.forEach(s => {
    const da = (s.value / total) * 2 * Math.PI;
    pieSlice(doc, cx, cy, r, a, a + da, s.color);
    a += da;
  });
  // White hole
  fillRect(doc, cx - innerR - 0.5, cy - innerR - 0.5, (innerR + 0.5) * 2, (innerR + 0.5) * 2, C.white);
  rgb(doc, C.white); doc.circle(cx, cy, innerR, 'F');
  // Center text
  if (centerLabel) {
    txt(doc, centerLabel, cx, cy + 1.5, 11, C.dark, true, 'center');
    if (centerSub) txt(doc, centerSub, cx, cy + 6, 7, C.mid, false, 'center');
  }
  // Gap lines between slices
  a = -Math.PI / 2;
  rgbStroke(doc, C.white); doc.setLineWidth(0.7);
  segments.forEach(s => {
    const da = (s.value / total) * 2 * Math.PI;
    doc.line(cx, cy, cx + r * Math.cos(a), cy + r * Math.sin(a));
    a += da;
  });
}

function chartLegend(
  doc: Doc, x: number, y: number, segments: { label: string; value: number; color: RGB }[], total: number,
): number {
  segments.forEach(s => {
    fillRect(doc, x, y - 2.5, 4, 4, s.color, 1);
    txt(doc, clip(s.label, 16), x + 6, y, 7, C.dark);
    txt(doc, String(s.value), x + 64, y, 7, C.mid, true, 'right');
    const p = total > 0 ? Math.round(s.value / total * 100) : 0;
    txt(doc, `${p}%`, x + 76, y, 7, C.grey, false, 'right');
    y += 7;
  });
  return y;
}

// ── Horizontal bar chart ─────────────────────────────────────────────────────
function hBar(
  doc: Doc, y: number, label: string, value: number, maxValue: number,
  color: RGB, barAreaW = 85, labelW = 36, barH = 5,
): number {
  txt(doc, clip(label, Math.floor(labelW / 1.55)), ML, y + barH / 2 + 1, 7.5, C.dark);
  fillRect(doc, ML + labelW, y, barAreaW, barH, C.bg);
  const fw = maxValue > 0 ? Math.max(1.5, (value / maxValue) * barAreaW) : 0;
  if (fw > 0) fillRect(doc, ML + labelW, y, fw, barH, color, 1.5);
  txt(doc, String(value), ML + labelW + barAreaW + 3, y + barH / 2 + 1, 7.5, C.dark, true);
  return y + barH + 4;
}

// ── Vertical bar chart (velocity) ─────────────────────────────────────────────
interface VBarData { label: string; value: number; color?: RGB }
function vBarChart(doc: Doc, x: number, y: number, w: number, h: number, bars: VBarData[]) {
  if (!bars.length) return;
  const max = Math.max(...bars.map(b => b.value), 1);
  const gap = 3;
  const bw  = Math.max(4, (w - gap * (bars.length - 1)) / bars.length);
  fillRect(doc, x, y, w, h, C.bg, 3);
  bars.forEach((b, i) => {
    const bh = h * 0.8 * (b.value / max);
    const bx = x + i * (bw + gap);
    const by = y + h * 0.88 - bh;
    const col = b.color ?? C.primary;
    fillRect(doc, bx, by, bw, bh, col, 2);
    txt(doc, String(b.value), bx + bw / 2, by - 1.5, 6, col, true, 'center');
    const lbl = clip(b.label, Math.max(3, Math.floor(bw / 1.5)));
    txt(doc, lbl, bx + bw / 2, y + h - 1, 5.5, C.mid, false, 'center');
  });
  // Baseline
  rgbStroke(doc, C.light); doc.setLineWidth(0.3);
  doc.line(x, y + h * 0.88, x + w, y + h * 0.88);
}

// ── Progress arc gauge ────────────────────────────────────────────────────────
function progressGauge(doc: Doc, cx: number, cy: number, r: number, pct: number, label: string) {
  // Background arc
  const endA = -Math.PI / 2 + 2 * Math.PI * Math.min(pct / 100, 1);
  pieSlice(doc, cx, cy, r, -Math.PI / 2, 3 * Math.PI / 2, C.bg);
  if (pct > 0) {
    const col: RGB = pct >= 70 ? C.green : pct >= 40 ? C.orange : C.red;
    pieSlice(doc, cx, cy, r, -Math.PI / 2, endA, col);
  }
  rgb(doc, C.white); doc.circle(cx, cy, r * 0.72, 'F');
  txt(doc, `${pct}%`, cx, cy + 1.5, 9, C.dark, true, 'center');
  txt(doc, label, cx, cy + 6.5, 6, C.mid, false, 'center');
}

// ── Section heading ───────────────────────────────────────────────────────────
function sectionHead(doc: Doc, y: number, title: string, sub?: string): number {
  fillRect(doc, ML, y, CW, 8, C.headBg, 2);
  fillRect(doc, ML, y, 3, 8, C.primary);
  txt(doc, title, ML + 6, y + 5.5, 8, C.primary, true);
  if (sub) txt(doc, sub, PW - MR, y + 5.5, 7, C.grey, false, 'right');
  return y + 13;
}

// ── Table ─────────────────────────────────────────────────────────────────────
interface ColDef { h: string; k: string; w: number; align?: 'left'|'right'|'center' }

function drawTable(doc: Doc, data: ReportData, y: number, cols: ColDef[], rows: Record<string, unknown>[], rh = 7): number {
  const tW = cols.reduce((s, c) => s + c.w, 0);
  // Header
  fillRect(doc, ML, y, tW, rh, C.primary);
  let cx = ML;
  cols.forEach(c => {
    txt(doc, c.h, cx + (c.align === 'right' ? c.w - 2 : 2), y + 4.8, 6.5, C.white, true, c.align ?? 'left');
    cx += c.w;
  });
  y += rh;
  rows.forEach((row, i) => {
    if (y + rh > PH - 14) { y = newPage(doc, data); }
    fillRect(doc, ML, y, tW, rh, i % 2 === 0 ? C.white : C.bg);
    strokeRect(doc, ML, y, tW, rh, C.light);
    let cx2 = ML;
    cols.forEach(c => {
      const v = clip(String(row[c.k] ?? '-'), Math.floor(c.w / 1.55));
      txt(doc, v, cx2 + (c.align === 'right' ? c.w - 2 : 2), y + 4.8, 6.5, C.dark, false, c.align ?? 'left');
      cx2 += c.w;
    });
    y += rh;
  });
  return y + 4;
}

// ── New page helper ───────────────────────────────────────────────────────────
function newPage(doc: Doc, data: ReportData): number {
  doc.addPage();
  const n = doc.internal.getNumberOfPages();
  fillRect(doc, 0, 0, PW, PH, C.bg);
  fillRect(doc, 0, 0, PW, 10, C.primary);
  txt(doc, 'PLANORA - PROJECT MANAGEMENT', ML, 6.5, 6, [200, 220, 255]);
  txt(doc, `${data.projectName.toUpperCase()} - Page ${n}`, PW - MR, 6.5, 6, [210, 225, 255], false, 'right');
  return 16;
}

// ── Milestone timeline ────────────────────────────────────────────────────────
function milestoneTimeline(doc: Doc, y: number, data: ReportData): number {
  if (!data.milestones.length) return y;
  const now = Date.now();
  const mx0 = ML + 10;
  const mx1 = PW - MR - 10;
  const mw  = mx1 - mx0;
  const cy  = y + 8;
  hRule(doc, cy, C.light);
  const sorted = [...data.milestones].sort((a, b) =>
    (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) -
    (b.dueDate ? new Date(b.dueDate).getTime() : Infinity),
  );
  const times = sorted.map(m => m.dueDate ? new Date(m.dueDate).getTime() : now);
  const minT  = Math.min(...times, now - 30 * 86400000);
  const maxT  = Math.max(...times, now + 30 * 86400000);
  const tRange = maxT - minT || 1;

  sorted.forEach((m, i) => {
    const t   = m.dueDate ? new Date(m.dueDate).getTime() : now;
    const px  = mx0 + mw * (t - minT) / tRange;
    const col: RGB = m.status === 'COMPLETED' ? C.green : m.status === 'ARCHIVED' ? C.grey : t < now ? C.red : C.orange;
    rgb(doc, col); doc.circle(px, cy, 2.5, 'F');
    rgb(doc, C.white); doc.circle(px, cy, 1.2, 'F');
    const label = clip(m.name, 14);
    const ty    = i % 2 === 0 ? cy - 7 : cy + 10;
    txt(doc, label, px, ty, 5.5, C.dark, false, 'center');
    if (m.dueDate) txt(doc, new Date(m.dueDate).toLocaleDateString('en-US',{month:'short',day:'numeric'}), px, ty + 4.5, 5, C.mid, false, 'center');
  });
  // Today marker
  const todayX = mx0 + mw * (now - minT) / tRange;
  rgbStroke(doc, C.primary); doc.setLineWidth(0.5);
  doc.setLineDash([2, 2]); doc.line(todayX, cy - 5, todayX, cy + 5);
  doc.setLineDash([]);
  txt(doc, 'Today', todayX, cy + 14, 5.5, C.primary, true, 'center');
  return cy + 20;
}

// ── Due-soon mini calendar grid ───────────────────────────────────────────────
function dueSoonGrid(doc: Doc, y: number, data: ReportData): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days: Map<string, string[]> = new Map();
  for (let d = 0; d < 14; d++) {
    const dt = new Date(today); dt.setDate(today.getDate() + d);
    const key = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    days.set(key, []);
  }
  data.tasks.forEach(t => {
    if (!t.dueDate || t.dueDate === '-' || t.status === 'Done') return;
    const days2 = days;
    if (days2.has(t.dueDate)) days2.get(t.dueDate)!.push(t.title);
  });
  const entries = [...days.entries()].filter(([, tasks]) => tasks.length > 0);
  if (!entries.length) return y;

  const cellW = (CW - 2) / 7;
  const cellH = 16;
  let col = 0; let row = 0;
  entries.slice(0, 14).forEach(([date, tasks]) => {
    const cx2 = ML + col * (cellW + 1);
    const cy2  = y + row * (cellH + 2);
    fillRect(doc, cx2, cy2, cellW, cellH, C.white, 2);
    strokeRect(doc, cx2, cy2, cellW, cellH, C.light);
    txt(doc, date, cx2 + cellW / 2, cy2 + 4.5, 6, C.primary, true, 'center');
    txt(doc, `${tasks.length} task${tasks.length > 1 ? 's' : ''}`, cx2 + cellW / 2, cy2 + 9, 5.5, C.mid, false, 'center');
    if (tasks[0]) txt(doc, clip(tasks[0], Math.floor(cellW / 1.4)), cx2 + cellW / 2, cy2 + 13.5, 5, C.dark, false, 'center');
    col++;
    if (col >= 7) { col = 0; row++; }
  });
  return y + (row + 1) * (cellH + 2) + 4;
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export async function generatePDFReport(data: ReportData): Promise<void> {
  const jsPDFModule = await import('jspdf');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const JsPDF = (jsPDFModule as any).jsPDF ?? (jsPDFModule as any).default ?? jsPDFModule;
  const doc: Doc = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  // ════════════════════════════════════════════════════════════════════════════
  //  PAGE 1 · COVER
  // ════════════════════════════════════════════════════════════════════════════
  fillRect(doc, 0, 0, PW, PH, C.bg);

  // Hero banner
  fillRect(doc, 0, 0, PW, 82, C.primary);
  // Decorative circles
  rgb(doc, [10, 60, 180]); doc.ellipse(PW - 5, 18, 40, 40, 'F');
  rgb(doc, [5, 40, 155]);  doc.ellipse(PW + 8, 75, 52, 52, 'F');
  rgb(doc, [35, 100, 210]);doc.ellipse(15,  85, 28, 28, 'F');

  // App icon box
  fillRect(doc, ML, 14, 15, 15, [10, 50, 180], 3);
  txt(doc, 'RPT', ML + 2, 24, 8, C.white, true);

  txt(doc, 'PLANORA PROJECT MANAGEMENT', ML + 19, 19, 7, [200, 220, 255]);
  txt(doc, 'PROJECT ANALYTICS REPORT', ML + 19, 25, 6, [160, 190, 255]);

  const nameLines: string[] = doc.splitTextToSize(data.projectName, CW - 15);
  txt(doc, nameLines.slice(0, 2).join('\n'), ML, 40, 20, C.white, true);
  txt(doc, `${data.projectType}  -  ${data.generatedAt}`, ML, 62, 9, [190, 215, 255]);

  // Type badge
  fillRect(doc, ML, 68, 38, 8, [10, 50, 180], 2);
  txt(doc, data.isAgile ? 'AGILE / SCRUM' : 'KANBAN', ML + 19, 73.5, 7.5, C.white, true, 'center');

  // ── KPI stat boxes ──
  let y = 90;
  const kpiW = (CW - 9) / 4;
  const kpis = [
    { label: 'Total Tasks',  value: String(data.metrics.totalTasks),    color: C.primary },
    { label: 'Completed',    value: String(data.metrics.completedTasks), color: C.green   },
    { label: 'Overdue',      value: String(data.metrics.overdueTasks),   color: C.red     },
    { label: 'Team Members', value: String(data.metrics.memberCount),    color: C.purple  },
  ];
  kpis.forEach((k, i) => {
    const kx = ML + i * (kpiW + 3);
    fillRect(doc, kx, y, kpiW, 28, C.white, 3);
    strokeRect(doc, kx, y, kpiW, 28, C.light);
    fillRect(doc, kx, y, kpiW, 2, k.color);
    txt(doc, k.value, kx + kpiW / 2, y + 17, 16, k.color, true, 'center');
    txt(doc, k.label, kx + kpiW / 2, y + 24, 6.5, C.mid, false, 'center');
  });
  y += 34;

  // ── Completion progress ──
  fillRect(doc, ML, y, CW, 18, C.white, 3);
  strokeRect(doc, ML, y, CW, 18, C.light);
  txt(doc, 'Project Completion Progress', ML + 4, y + 7, 8, C.dark, true);
  const pctColor: RGB = data.completionPct >= 70 ? C.green : data.completionPct >= 40 ? C.orange : C.red;
  txt(doc, `${data.completionPct}%`, PW - MR - 4, y + 7, 10, pctColor, true, 'right');
  fillRect(doc, ML + 4, y + 10.5, CW - 8, 4, C.bg, 2);
  const progW = Math.max(2, (CW - 8) * data.completionPct / 100);
  fillRect(doc, ML + 4, y + 10.5, progW, 4, pctColor, 2);
  y += 24;

  // ── Secondary metrics row ──
  const sm = [
    { label: 'Completion', value: `${data.completionPct}%` },
    { label: 'Avg Lead Time', value: `${data.avgLeadTimeDays}d` },
    { label: 'Overdue Rate', value: `${data.overduePct}%` },
    ...(data.isAgile ? [{ label: 'Avg Velocity', value: `${data.avgVelocity}pts` }] : []),
  ];
  const smW = (CW - (sm.length - 1) * 3) / sm.length;
  sm.forEach((m, i) => {
    const sx = ML + i * (smW + 3);
    fillRect(doc, sx, y, smW, 14, C.headBg, 3);
    txt(doc, m.value, sx + smW / 2, y + 7, 10, C.primary, true, 'center');
    txt(doc, m.label, sx + smW / 2, y + 12, 5.5, C.mid, false, 'center');
  });
  y += 20;

  // ── Active sprint ──
  if (data.isAgile && data.activeSprint) {
    const as = data.activeSprint;
    fillRect(doc, ML, y, CW, 20, [235, 242, 255], 3);
    fillRect(doc, ML, y, 3, 20, C.primary);
    txt(doc, `Active Sprint: ${as.name}`, ML + 6, y + 8, 8, C.primary, true);
    txt(doc, `${as.start} - ${as.end}   ${as.completedTasks}/${as.totalTasks} tasks done   ${as.completionRate}% complete`, ML + 6, y + 15, 7, C.mid);
    const spW = CW - 12;
    fillRect(doc, ML + 6, y + 17.5, spW, 1.5, C.light);
    fillRect(doc, ML + 6, y + 17.5, Math.max(1, spW * as.completionRate / 100), 1.5, C.primary, 0.5);
    y += 26;
  }

  // ── Description ──
  if (data.projectDescription) {
    fillRect(doc, ML, y, CW, 20, C.white, 3);
    strokeRect(doc, ML, y, CW, 20, C.light);
    txt(doc, 'Project Description', ML + 4, y + 6, 7, C.primary, true);
    const dl: string[] = doc.splitTextToSize(data.projectDescription, CW - 8);
    txt(doc, dl.slice(0, 2).join('\n'), ML + 4, y + 12, 7, C.dark);
    y += 24;
  }

  // Page footer
  fillRect(doc, 0, PH - 12, PW, 12, C.dark);
  txt(doc, 'PLANORA PROJECT MANAGEMENT SUITE - CONFIDENTIAL', PW / 2, PH - 6, 6, [180, 190, 210], false, 'center');
  txt(doc, 'Page 1', PW - MR, PH - 6, 6, [180, 190, 210], false, 'right');

  // ════════════════════════════════════════════════════════════════════════════
  //  PAGE 2 · PROJECT HEALTH DASHBOARD (Charts)
  // ════════════════════════════════════════════════════════════════════════════
  y = newPage(doc, data);
  y = sectionHead(doc, y, 'PROJECT HEALTH OVERVIEW', `${data.tasks.length} tasks total`);

  // ── Row: Completion gauge + Status donut ──
  const gaugeR = 20;
  const donutR = 22; const donutInner = 13;
  const chartY = y + 5;

  // Completion gauge (left)
  progressGauge(doc, ML + gaugeR + 4, chartY + gaugeR, gaugeR, data.completionPct, 'Done');

  // Status donut (center)
  const statusSegs = data.statusDist.map(s => ({
    value: s.count,
    color: STATUS_RGB[s.name.toUpperCase()] ?? C.grey,
    label: s.name,
  }));
  const cx2 = ML + 70;
  donutChart(doc, cx2, chartY + donutR, donutR, donutInner, statusSegs, `${data.completionPct}%`, 'Complete');
  txt(doc, 'Status Distribution', cx2, chartY - 2, 8, C.dark, true, 'center');
  chartLegend(doc, cx2 - 37, chartY + donutR * 2 + 7, statusSegs, data.tasks.length);

  // Priority donut (right)
  const prioritySegs = data.priorityDist.map(p => ({
    value: p.count,
    color: PRIORITY_RGB[p.name.toUpperCase()] ?? C.grey,
    label: p.name,
  }));
  const px2 = ML + 140;
  donutChart(doc, px2, chartY + donutR, donutR, donutInner, prioritySegs, String(data.tasks.length), 'Tasks');
  txt(doc, 'Priority Breakdown', px2, chartY - 2, 8, C.dark, true, 'center');
  chartLegend(doc, px2 - 37, chartY + donutR * 2 + 7, prioritySegs, data.tasks.length);

  y = chartY + donutR * 2 + 42;
  hRule(doc, y); y += 8;

  // ── Key insights row ──
  y = sectionHead(doc, y, 'KEY INSIGHTS');
  const insights = [
    { label: 'Completed Tasks',    value: `${data.metrics.completedTasks} / ${data.metrics.totalTasks}` },
    { label: 'Overdue Tasks',      value: `${data.metrics.overdueTasks} (${data.overduePct}%)` },
    { label: 'Avg Lead Time',      value: `${data.avgLeadTimeDays} days per task` },
    { label: 'Team Size',          value: `${data.metrics.memberCount} members` },
    ...(data.isAgile ? [
      { label: 'Avg Velocity',     value: `${data.avgVelocity} pts/sprint` },
      { label: 'Total Sprints',    value: String(data.sprintStats.length) },
    ] : []),
    { label: 'Milestones',         value: String(data.milestones.length) },
  ];
  const col2W = (CW - 4) / 2;
  insights.forEach((ins, i) => {
    const ix = ML + (i % 2) * (col2W + 4);
    const iy = y + Math.floor(i / 2) * 10;
    fillRect(doc, ix, iy, col2W, 8, i % 4 < 2 ? C.white : C.bg, 2);
    txt(doc, ins.label, ix + 3, iy + 5.5, 7, C.dark);
    txt(doc, ins.value, ix + col2W - 3, iy + 5.5, 7, C.primary, true, 'right');
  });
  y += Math.ceil(insights.length / 2) * 10 + 6;

  // ════════════════════════════════════════════════════════════════════════════
  //  PAGE 3 · TASK ANALYSIS
  // ════════════════════════════════════════════════════════════════════════════
  y = newPage(doc, data);
  y = sectionHead(doc, y, 'TASK PRIORITY ANALYSIS', 'Horizontal distribution');
  const maxP = Math.max(...data.priorityDist.map(p => p.count), 1);
  data.priorityDist.forEach(p => {
    y = hBar(doc, y, `${p.name.charAt(0) + p.name.slice(1).toLowerCase()} (${p.pct}%)`,
      p.count, maxP, PRIORITY_RGB[p.name.toUpperCase()] ?? C.grey, 100, 40);
  });
  y += 4;

  y = sectionHead(doc, y, 'TASK STATUS ANALYSIS', 'Horizontal distribution');
  const maxS = Math.max(...data.statusDist.map(s => s.count), 1);
  data.statusDist.forEach(s => {
    const lbl = s.name === 'IN_PROGRESS' ? 'In Progress' : s.name === 'IN_REVIEW' ? 'In Review' :
                s.name === 'TODO' ? 'To Do' : 'Done';
    y = hBar(doc, y, `${lbl} (${s.pct}%)`, s.count, maxS, STATUS_RGB[s.name.toUpperCase()] ?? C.grey, 100, 40);
  });
  y += 5;

  // ── Overdue breakdown (use pre-computed list) ──
  const overduePDF = data.overdueTasks.slice(0, 12);
  if (overduePDF.length) {
    y = sectionHead(doc, y, 'OVERDUE TASKS', `${data.overdueTasks.length} tasks past due date`);
    y = drawTable(doc, data, y, [
      { h: 'Task Title', k: 'title',       w: 72 },
      { h: 'Priority',   k: 'priority',    w: 25 },
      { h: 'Assignee',   k: 'assignee',    w: 34 },
      { h: 'Due Date',   k: 'dueDate',     w: 28, align: 'right' },
      { h: '+Days',      k: 'daysOverdue', w: 23, align: 'right' },
    ], overduePDF.map(t => ({ ...t, daysOverdue: `+${t.daysOverdue}d` })));
  }

  // ── Due in next 7 days (use pre-computed list) ──
  const upcomingPDF = data.upcomingTasks.slice(0, 10);
  if (upcomingPDF.length) {
    y = sectionHead(doc, y, 'DUE WITHIN 7 DAYS', `${data.upcomingTasks.length} tasks upcoming`);
    y = drawTable(doc, data, y, [
      { h: 'Task Title', k: 'title',       w: 72 },
      { h: 'Priority',   k: 'priority',    w: 25 },
      { h: 'Assignee',   k: 'assignee',    w: 34 },
      { h: 'Due Date',   k: 'dueDate',     w: 28, align: 'right' },
      { h: 'Days Left',  k: 'daysUntilDue', w: 23, align: 'right' },
    ], upcomingPDF.map(t => ({ ...t, daysUntilDue: `${t.daysUntilDue}d` })));
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  PAGE 4 · SPRINT ANALYSIS  (Agile)  /  KANBAN FLOW  (Kanban)
  // ════════════════════════════════════════════════════════════════════════════
  y = newPage(doc, data);

  if (data.isAgile && data.sprintStats.length > 0) {
    y = sectionHead(doc, y, 'SPRINT OVERVIEW', `${data.sprintStats.length} sprints`);

    // Velocity bar chart
    const velBars: VBarData[] = data.sprintStats.map(s => ({
      label: s.name.replace(/sprint/i, 'S').trim(),
      value: s.completedPoints,
      color: s.status === 'Active' ? C.primary : s.status === 'Completed' ? C.green : C.grey,
    }));
    const chartH = 44;
    txt(doc, 'Sprint Velocity (Completed Story Points)', ML, y + 3, 7.5, C.dark, true);
    vBarChart(doc, ML, y + 6, CW, chartH, velBars);
    y += chartH + 14;

    // Velocity legend
    txt(doc, '[*] Completed', ML, y, 6.5, C.green); txt(doc, '[*] Active', ML + 28, y, 6.5, C.primary); txt(doc, '[*] Planned', ML + 52, y, 6.5, C.grey);
    y += 8;

    // Sprint completion rate bars
    y = sectionHead(doc, y, 'SPRINT COMPLETION RATES');
    const maxRate = 100;
    data.sprintStats.forEach(s => {
      const col: RGB = s.status === 'Active' ? C.primary : s.status === 'Completed' ? C.green : C.grey;
      y = hBar(doc, y, `${s.name} (${s.status})`, s.completionRate, maxRate, col, 100, 50, 5);
      txt(doc, `${s.completedTasks}/${s.totalTasks} tasks`, PW - MR - 2, y - 5, 6, C.mid, false, 'right');
    });
    y += 6;

    // Sprint details table
    y = sectionHead(doc, y, 'SPRINT DETAILS TABLE');
    y = drawTable(doc, data, y, [
      { h: 'Sprint',    k: 'name',           w: 38 },
      { h: 'Status',    k: 'status',          w: 22 },
      { h: 'Start',     k: 'start',           w: 24 },
      { h: 'End',       k: 'end',             w: 24 },
      { h: 'Tasks',     k: 'totalTasks',      w: 16, align:'right'},
      { h: 'Done',      k: 'completedTasks',  w: 14, align:'right'},
      { h: 'Pts Total', k: 'totalPoints',     w: 18, align:'right'},
      { h: 'Pts Done',  k: 'completedPoints', w: 18, align:'right'},
      { h: 'Rate',      k: 'completionRate',  w: 18, align:'right'},
    ], data.sprintStats.map(s => ({
      name: s.name, status: s.status, start: s.start, end: s.end,
      totalTasks: String(s.totalTasks), completedTasks: String(s.completedTasks),
      totalPoints: String(s.totalPoints), completedPoints: String(s.completedPoints),
      completionRate: `${s.completionRate}%`,
    })));

  } else {
    // Kanban flow
    y = sectionHead(doc, y, 'KANBAN FLOW ANALYSIS', 'Status distribution');
    txt(doc, 'Task Status Distribution (Kanban Board)', ML, y + 3, 7.5, C.dark, true);
    const kBars: VBarData[] = data.statusDist.map(s => ({
      label: s.name === 'IN_PROGRESS' ? 'In Progress' : s.name === 'IN_REVIEW' ? 'In Review' :
             s.name === 'TODO' ? 'To Do' : 'Done',
      value: s.count,
      color: STATUS_RGB[s.name.toUpperCase()] ?? C.grey,
    }));
    vBarChart(doc, ML, y + 6, CW, 50, kBars);
    y += 66;

    y = sectionHead(doc, y, 'KANBAN STATUS DETAILS');
    const mx2 = Math.max(...data.statusDist.map(s => s.count), 1);
    data.statusDist.forEach(s => {
      const lbl = s.name === 'IN_PROGRESS' ? 'In Progress' : s.name === 'IN_REVIEW' ? 'In Review' :
                  s.name === 'TODO' ? 'To Do' : 'Done';
      y = hBar(doc, y, `${lbl} - ${s.count} tasks (${s.pct}%)`, s.count, mx2, STATUS_RGB[s.name.toUpperCase()] ?? C.grey, 100, 55);
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  PAGE 5 · TEAM WORKLOAD
  // ════════════════════════════════════════════════════════════════════════════
  y = newPage(doc, data);
  y = sectionHead(doc, y, 'TEAM WORKLOAD ANALYSIS', `${data.memberStats.length} team members`);

  if (data.memberStats.length > 0) {
    // Bar chart: tasks per member
    txt(doc, 'Tasks Assigned Per Member', ML, y + 3, 7.5, C.dark, true);
    const memberBars: VBarData[] = data.memberStats.map((m, i) => ({
      label: m.name.split(' ')[0],
      value: m.totalTasks,
      color: TEAM_PALETTE[i % TEAM_PALETTE.length],
    }));
    vBarChart(doc, ML, y + 6, CW, 44, memberBars);
    y += 60;

    // Completion rate per member bars
    y = sectionHead(doc, y, 'MEMBER COMPLETION RATES');
    data.memberStats.forEach((m, i) => {
      const col = TEAM_PALETTE[i % TEAM_PALETTE.length];
      y = hBar(doc, y, `${m.name} - ${m.role}`, m.completionRate, 100, col, 90, 54, 5);
      txt(doc, `${m.completedTasks}/${m.totalTasks}`, PW - MR - 2, y - 5, 6, C.mid, false, 'right');
    });
    y += 6;

    // Member full table
    y = sectionHead(doc, y, 'MEMBER PERFORMANCE TABLE');
    y = drawTable(doc, data, y, [
      { h: 'Member',     k: 'name',           w: 50 },
      { h: 'Role',       k: 'role',           w: 30 },
      { h: 'Assigned',   k: 'totalTasks',     w: 22, align:'right'},
      { h: 'Completed',  k: 'completedTasks', w: 24, align:'right'},
      { h: 'Overdue',    k: 'overdueTasks',   w: 20, align:'right'},
      { h: 'Rate',       k: 'completionRate', w: 20, align:'right'},
                    { h: '', k: '_', w: 16 },
    ], data.memberStats.map(m => ({
      name: m.name, role: m.role,
      totalTasks: String(m.totalTasks), completedTasks: String(m.completedTasks),
      overdueTasks: String(m.overdueTasks), completionRate: `${m.completionRate}%`, _: '',
    })));
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  PAGE 6 · MILESTONES & TIMELINE / DUE-SOON CALENDAR
  // ════════════════════════════════════════════════════════════════════════════
  y = newPage(doc, data);

  if (data.milestones.length > 0) {
    y = sectionHead(doc, y, 'MILESTONE TIMELINE', `${data.milestones.length} milestones`);
    y = milestoneTimeline(doc, y, data);
    y += 6;

    // Milestone table
    y = sectionHead(doc, y, 'MILESTONE DETAILS');
    y = drawTable(doc, data, y, [
      { h: 'Milestone',  k: 'name',      w: 74 },
      { h: 'Status',     k: 'status',    w: 26 },
      { h: 'Due Date',   k: 'dueDate',   w: 30 },
      { h: 'Tasks',      k: 'taskCount', w: 18, align:'right'},
                    { h: '', k: '_', w: 34 },
    ], data.milestones.map(m => ({
      name: m.name,
      status: m.status,
      dueDate: m.dueDate ? new Date(m.dueDate).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}) : '-',
      taskCount: String(m.taskCount ?? 0),
      _: '',
    })));
    y += 4;
  }

  // ── Due-soon grid ──
  y = sectionHead(doc, y, '14-DAY DUE DATE CALENDAR', 'Tasks due in the next 2 weeks');
  const calY = dueSoonGrid(doc, y, data);
  if (calY === y) {
    txt(doc, 'No tasks due within the next 14 days.', ML, y + 8, 8, C.mid, false, 'left');
    y += 16;
  } else { y = calY; }

  // ── Recently completed (use pre-computed list) ──
  const recentDone = data.recentlyCompletedTasks.slice(0, 10);
  if (recentDone.length) {
    y = sectionHead(doc, y, 'RECENTLY COMPLETED (LAST 7 DAYS)', `${recentDone.length} tasks`);
    y = drawTable(doc, data, y, [
      { h: 'Task',      k: 'title',       w: 80 },
      { h: 'Priority',  k: 'priority',    w: 25 },
      { h: 'Assignee',  k: 'assignee',    w: 35 },
      { h: 'Completed', k: 'completedAt', w: 30, align: 'right' },
      { h: '',          k: '_',           w: 12 },
    ], recentDone.map(t => ({ ...t, _: '' })));
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  PAGE 7+ · FULL TASK LIST
  // ════════════════════════════════════════════════════════════════════════════
  y = newPage(doc, data);
  y = sectionHead(doc, y, 'COMPLETE TASK LIST', `${data.tasks.length} tasks`);
  y = drawTable(doc, data, y, [
    { h: '#',          k: 'seq',         w: 10 },
    { h: 'Title',      k: 'title',       w: 56 },
    { h: 'Status',     k: 'status',      w: 22 },
    { h: 'Priority',   k: 'priority',    w: 19 },
    { h: 'Assignee',   k: 'assignee',    w: 28 },
    { h: 'Sprint',     k: 'sprint',      w: 22 },
    { h: 'Pts',        k: 'storyPoints', w: 10, align:'right' },
    { h: 'Due',        k: 'dueDate',     w: 20, align:'right' },
                  { h: 'Done',      k: 'completedAt', w: 15, align:'right' },
  ], data.tasks.map((t, i) => ({ seq: String(i + 1), ...t, storyPoints: String(t.storyPoints) })));

  // ── Final: stamp all page footers ──
  const total = doc.internal.getNumberOfPages();
  for (let i = 2; i <= total; i++) {
    doc.setPage(i);
    fillRect(doc, 0, PH - 10, PW, 10, C.dark);
    txt(doc, 'PLANORA PROJECT MANAGEMENT - CONFIDENTIAL', PW / 2, PH - 5, 5.5, [180, 190, 210], false, 'center');
    txt(doc, `Page ${i} of ${total}`, PW - MR, PH - 5, 5.5, [180, 190, 210], false, 'right');
  }

  const fname = `${data.projectName.replace(/[^a-zA-Z0-9]/g, '_')}_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fname);
}
