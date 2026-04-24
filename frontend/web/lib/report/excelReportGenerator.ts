// ══════════════════════════════════════════════════════════════════════════════
//  excelReportGenerator.ts  ·  Multi-sheet premium xlsx report
// ══════════════════════════════════════════════════════════════════════════════
import type { ReportData, SprintStat } from './reportUtils';

type WorkBook = import('xlsx').WorkBook;
type WorkSheet = import('xlsx').WorkSheet;

// Local cell style shape (avoids xlsx.CellStyle which may not be exported)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CellStyle = Record<string, any>;

// Colour palette as ARGB hex (xlsx format)
const C = {
  primaryBg: '000052CC',   // Blue header bg
  primaryFg: 'FFFFFFFF',   // White text on blue
  greenBg:   '0000875A',
  greenFg:   'FFFFFFFF',
  orangeBg:  '00FF8B00',
  orangeFg:  'FFFFFFFF',
  redBg:     '00DE350B',
  redFg:     'FFFFFFFF',
  purpleBg:  '006554C0',
  purpleFg:  'FFFFFFFF',
  yellowBg:  '00FFC400',
  darkFg:    '00101828',
  midFg:     '00667085',
  lightBg:   '00F2F4F7',
  whiteBg:   '00FFFFFF',
  rowAlt:    '00EAF2FF',
  border:    '00E3E8EF',
};

function makeBorder(style: 'thin'|'medium'|'thick' = 'thin') {
  const b = { style, color: { argb: C.border } };
  return { top: b, bottom: b, left: b, right: b };
}

function headerStyle(argbBg: string, argbFg: string, fontSize = 11, bold = true): CellStyle {
  return {
    fill: { fgColor: { argb: argbBg }, patternType: 'solid', type: 'pattern' },
    font: { color: { argb: argbFg }, bold, sz: fontSize, name: 'Calibri' },
    alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
    border: makeBorder('thin'),
  };
}

function dataStyle(argbBg: string, align: 'left'|'center'|'right' = 'left', bold = false): CellStyle {
  return {
    fill: { fgColor: { argb: argbBg }, patternType: 'solid', type: 'pattern' },
    font: { color: { argb: C.darkFg }, bold, sz: 10, name: 'Calibri' },
    alignment: { vertical: 'center', horizontal: align, wrapText: false },
    border: makeBorder('thin'),
  };
}

function priorityStyle(priority: string): CellStyle {
  const colorMap: Record<string, { bg: string; fg: string }> = {
    URGENT:    { bg: '00FFEDEF', fg: '00DE350B' },
    HIGH:      { bg: '00FFF4ED', fg: '00FF8B00' },
    MEDIUM:    { bg: '00FFFAE6', fg: '00A37400' },
    NORMAL:    { bg: '00EAF2FF', fg: '000052CC' },
    LOW:       { bg: '00E3FCEF', fg: '0000875A' },
    UNASSIGNED:{ bg: '00F2F4F7', fg: '00667085' },
  };
  const c = colorMap[priority.toUpperCase()] || colorMap.UNASSIGNED;
  return {
    fill: { fgColor: { argb: c.bg }, patternType: 'solid', type: 'pattern' },
    font: { color: { argb: c.fg }, bold: true, sz: 10, name: 'Calibri' },
    alignment: { vertical: 'center', horizontal: 'center' },
    border: makeBorder('thin'),
  };
}

function statusStyle(status: string): CellStyle {
  const colorMap: Record<string, { bg: string; fg: string }> = {
    'To Do':       { bg: '00F2F4F7', fg: '00667085' },
    'In Progress': { bg: '00EAF2FF', fg: '000052CC' },
    'In Review':   { bg: '00FFF4ED', fg: '00A35000' },
    'Done':        { bg: '00E3FCEF', fg: '0000875A' },
  };
  const c = colorMap[status] || colorMap['To Do'];
  return {
    fill: { fgColor: { argb: c.bg }, patternType: 'solid', type: 'pattern' },
    font: { color: { argb: c.fg }, bold: true, sz: 10, name: 'Calibri' },
    alignment: { vertical: 'center', horizontal: 'center' },
    border: makeBorder('thin'),
  };
}

// ── Cell helpers ─────────────────────────────────────────────────────────────
type XLSX = typeof import('xlsx');

function setCell(ws: WorkSheet, row: number, col: number, value: string | number, style: CellStyle, XLSX: XLSX) {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  ws[addr] = { v: value, t: typeof value === 'number' ? 'n' : 's', s: style };
}

function mergeCells(ws: WorkSheet, r1: number, c1: number, r2: number, c2: number) {
  if (!ws['!merges']) ws['!merges'] = [];
  ws['!merges'].push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });
}

// ── Sheet 1: Summary Dashboard ───────────────────────────────────────────────
function buildSummarySheet(data: ReportData, XLSX: XLSX): WorkSheet {
  const ws: WorkSheet = {};

  let r = 0;

  // Title row
  setCell(ws, r, 0, '📊 PLANORA · PROJECT ANALYTICS DASHBOARD', headerStyle(C.primaryBg, C.primaryFg, 16, true), XLSX);
  mergeCells(ws, r, 0, r, 5);
  r++;

  setCell(ws, r, 0, data.projectName, headerStyle('00003B7D', C.primaryFg, 13, true), XLSX);
  mergeCells(ws, r, 0, r, 5);
  r++;

  setCell(ws, r, 0, `${data.projectType}  ·  Generated: ${data.generatedAt}  ·  Planora Project Management`, dataStyle(C.lightBg, 'left', false), XLSX);
  mergeCells(ws, r, 0, r, 5);
  r += 2;

  // ── KPI Cards ──────────────────────────────────────────────────────────
  const kpiHeaders = ['Total Tasks', 'Completed', 'Overdue', 'Completion %', 'Team Members', 'Avg Lead Time'];
  const kpiValues  = [
    data.metrics.totalTasks,
    data.metrics.completedTasks,
    data.metrics.overdueTasks,
    `${data.completionPct}%`,
    data.metrics.memberCount,
    `${data.avgLeadTimeDays} days`,
  ];
  const kpiColors  = [C.primaryBg, C.greenBg, C.redBg, C.primaryBg, C.purpleBg, C.orangeBg];

  kpiHeaders.forEach((h, i) => setCell(ws, r, i, h, headerStyle(kpiColors[i], C.primaryFg, 9, true), XLSX));
  r++;
  kpiValues.forEach((v, i) => {
    const val = typeof v === 'number' ? v : String(v);
    setCell(ws, r, i, val, { ...dataStyle(C.whiteBg, 'center', true), font: { bold: true, sz: 16, name: 'Calibri', color: { argb: C.darkFg } } }, XLSX);
  });
  r += 2;

  if (data.isAgile && data.activeSprint) {
    const as = data.activeSprint;
    setCell(ws, r, 0, '⚡ ACTIVE SPRINT', headerStyle(C.primaryBg, C.primaryFg, 10), XLSX);
    setCell(ws, r, 1, as.name, dataStyle(C.rowAlt, 'left', true), XLSX);
    setCell(ws, r, 2, `${as.start} → ${as.end}`, dataStyle(C.rowAlt), XLSX);
    setCell(ws, r, 3, `${as.completedTasks}/${as.totalTasks} tasks done`, dataStyle(C.rowAlt, 'center'), XLSX);
    setCell(ws, r, 4, `${as.completionRate}% complete`, dataStyle(C.rowAlt, 'center', true), XLSX);
    setCell(ws, r, 5, `Avg Velocity: ${data.avgVelocity} pts`, dataStyle(C.rowAlt, 'center'), XLSX);
    r += 2;
  }

  // ── Priority Distribution ──────────────────────────────────────────────
  setCell(ws, r, 0, 'PRIORITY BREAKDOWN', headerStyle(C.primaryBg, C.primaryFg), XLSX);
  setCell(ws, r, 1, 'Count', headerStyle(C.primaryBg, C.primaryFg), XLSX);
  setCell(ws, r, 2, 'Percentage', headerStyle(C.primaryBg, C.primaryFg), XLSX);
  setCell(ws, r, 3, 'STATUS BREAKDOWN', headerStyle(C.greenBg, C.greenFg), XLSX);
  setCell(ws, r, 4, 'Count', headerStyle(C.greenBg, C.greenFg), XLSX);
  setCell(ws, r, 5, 'Percentage', headerStyle(C.greenBg, C.greenFg), XLSX);
  r++;

  const maxLen = Math.max(data.priorityDist.length, data.statusDist.length);
  for (let i = 0; i < maxLen; i++) {
    const p = data.priorityDist[i];
    const s = data.statusDist[i];
    if (p) {
      setCell(ws, r, 0, p.name, priorityStyle(p.name), XLSX);
      setCell(ws, r, 1, p.count, dataStyle(C.whiteBg, 'center'), XLSX);
      setCell(ws, r, 2, `${p.pct}%`, dataStyle(C.whiteBg, 'center', true), XLSX);
    } else {
      [0,1,2].forEach(c => setCell(ws, r, c, '', dataStyle(C.whiteBg), XLSX));
    }
    if (s) {
      setCell(ws, r, 3, s.name, statusStyle(s.name), XLSX);
      setCell(ws, r, 4, s.count, dataStyle(C.whiteBg, 'center'), XLSX);
      setCell(ws, r, 5, `${s.pct}%`, dataStyle(C.whiteBg, 'center', true), XLSX);
    } else {
      [3,4,5].forEach(c => setCell(ws, r, c, '', dataStyle(C.whiteBg), XLSX));
    }
    r++;
  }

  ws['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 16 }, { wch: 18 }];
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: 5 } });
  return ws;
}

// ── Sheet 2: All Tasks ────────────────────────────────────────────────────────
function buildTasksSheet(data: ReportData, XLSX: XLSX): WorkSheet {
  const ws: WorkSheet = {};
  let r = 0;

  // Title
  setCell(ws, r, 0, `ALL TASKS — ${data.projectName}`, headerStyle(C.primaryBg, C.primaryFg, 12), XLSX);
  mergeCells(ws, r, 0, r, 9);
  r++;

  // Headers
  const headers = ['#', 'ID', 'Title', 'Status', 'Priority', 'Assignee', 'Sprint', 'Story Pts', 'Due Date', 'Completed At'];
  headers.forEach((h, i) => setCell(ws, r, i, h, headerStyle(C.primaryBg, C.primaryFg, 10), XLSX));
  r++;

  // Rows
  data.tasks.forEach((t, idx) => {
    const rowBg = idx % 2 === 0 ? C.whiteBg : C.rowAlt;
    setCell(ws, r, 0, idx + 1, dataStyle(rowBg, 'center'), XLSX);
    setCell(ws, r, 1, t.id, dataStyle(rowBg, 'center'), XLSX);
    setCell(ws, r, 2, t.title, dataStyle(rowBg, 'left'), XLSX);
    setCell(ws, r, 3, t.status, statusStyle(t.status), XLSX);
    setCell(ws, r, 4, t.priority, priorityStyle(t.priority), XLSX);
    setCell(ws, r, 5, t.assignee, dataStyle(rowBg), XLSX);
    setCell(ws, r, 6, t.sprint, dataStyle(rowBg), XLSX);
    setCell(ws, r, 7, t.storyPoints, dataStyle(rowBg, 'center'), XLSX);
    setCell(ws, r, 8, t.dueDate, dataStyle(rowBg, 'center'), XLSX);
    setCell(ws, r, 9, t.completedAt, dataStyle(rowBg, 'center'), XLSX);
    r++;
  });

  ws['!cols'] = [{ wch: 5 }, { wch: 8 }, { wch: 40 }, { wch: 14 }, { wch: 12 }, { wch: 22 }, { wch: 18 }, { wch: 10 }, { wch: 14 }, { wch: 16 }];
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: 9 } });
  return ws;
}

// ── Sheet 3: Sprint Analysis (Agile only) ────────────────────────────────────
function buildSprintSheet(data: ReportData, XLSX: XLSX): WorkSheet {
  const ws: WorkSheet = {};
  let r = 0;

  setCell(ws, r, 0, 'SPRINT ANALYSIS', headerStyle(C.primaryBg, C.primaryFg, 12), XLSX);
  mergeCells(ws, r, 0, r, 7);
  r++;

  if (data.avgVelocity > 0) {
    setCell(ws, r, 0, `Average Sprint Velocity: ${data.avgVelocity} story points`, dataStyle(C.rowAlt, 'left', true), XLSX);
    mergeCells(ws, r, 0, r, 7);
    r++;
  }
  r++;

  const hdrs = ['Sprint Name', 'Status', 'Start Date', 'End Date', 'Total Tasks', 'Completed', 'Total Points', 'Completion %'];
  hdrs.forEach((h, i) => setCell(ws, r, i, h, headerStyle(C.primaryBg, C.primaryFg, 10), XLSX));
  r++;

  data.sprintStats.forEach((s: SprintStat, idx: number) => {
    const rowBg = idx % 2 === 0 ? C.whiteBg : C.rowAlt;
    const statusC = s.status === 'Active' ? headerStyle(C.greenBg, C.greenFg, 10) : dataStyle(rowBg, 'center');
    setCell(ws, r, 0, s.name, dataStyle(rowBg, 'left', s.status === 'Active'), XLSX);
    setCell(ws, r, 1, s.status, statusC, XLSX);
    setCell(ws, r, 2, s.start, dataStyle(rowBg, 'center'), XLSX);
    setCell(ws, r, 3, s.end, dataStyle(rowBg, 'center'), XLSX);
    setCell(ws, r, 4, s.totalTasks, dataStyle(rowBg, 'center'), XLSX);
    setCell(ws, r, 5, s.completedTasks, dataStyle(rowBg, 'center'), XLSX);
    setCell(ws, r, 6, s.totalPoints, dataStyle(rowBg, 'center'), XLSX);
    setCell(ws, r, 7, `${s.completionRate}%`, s.completionRate >= 70 ? { ...dataStyle(C.whiteBg, 'center', true), font: { bold: true, sz: 10, color: { argb: C.greenFg }, name: 'Calibri' }, fill: { patternType: 'solid', type: 'pattern', fgColor: { argb: C.greenBg } } } : dataStyle(rowBg, 'center', true), XLSX);
    r++;
  });

  ws['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }];
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: 7 } });
  return ws;
}

// ── Sheet 4: Team Workload ────────────────────────────────────────────────────
function buildTeamSheet(data: ReportData, XLSX: XLSX): WorkSheet {
  const ws: WorkSheet = {};
  let r = 0;

  setCell(ws, r, 0, 'TEAM WORKLOAD ANALYSIS', headerStyle(C.purpleBg, C.purpleFg, 12), XLSX);
  mergeCells(ws, r, 0, r, 5);
  r++;

  const hdrs = ['Member Name', 'Role', 'Total Tasks', 'Completed', 'Overdue', 'Completion Rate'];
  hdrs.forEach((h, i) => setCell(ws, r, i, h, headerStyle(C.purpleBg, C.purpleFg, 10), XLSX));
  r++;

  data.memberStats.forEach((m, idx) => {
    const rowBg = idx % 2 === 0 ? C.whiteBg : 'FFFFF0FF';
    setCell(ws, r, 0, m.name, dataStyle(rowBg, 'left', true), XLSX);
    setCell(ws, r, 1, m.role, dataStyle(rowBg, 'left'), XLSX);
    setCell(ws, r, 2, m.totalTasks, dataStyle(rowBg, 'center'), XLSX);
    setCell(ws, r, 3, m.completedTasks, { ...dataStyle(rowBg, 'center', true), font: { bold: true, sz: 10, name: 'Calibri', color: { argb: C.greenFg } } }, XLSX);
    setCell(ws, r, 4, m.overdueTasks, m.overdueTasks > 0 ? { ...dataStyle(rowBg, 'center', true), font: { bold: true, sz: 10, name: 'Calibri', color: { argb: C.redFg } } } : dataStyle(rowBg, 'center'), XLSX);
    const rateColor = m.completionRate >= 80 ? C.greenBg : m.completionRate >= 50 ? C.orangeBg : C.redBg;
    setCell(ws, r, 5, `${m.completionRate}%`, headerStyle(rateColor, C.primaryFg, 10), XLSX);
    r++;
  });

  ws['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 13 }, { wch: 13 }, { wch: 12 }, { wch: 16 }];
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: 5 } });
  return ws;
}

// ── Sheet: Overdue Tasks ────────────────────────────────────────────────────
function buildOverdueSheet(data: ReportData, XLSX: XLSX): WorkSheet {
  const ws: WorkSheet = {};
  let r = 0;

  setCell(ws, r, 0, '⚠️ OVERDUE TASKS', headerStyle(C.redBg, C.redFg, 12), XLSX);
  mergeCells(ws, r, 0, r, 5);
  r++;

  if (data.overdueTasks.length === 0) {
    setCell(ws, r, 0, '✅ No overdue tasks — great work!', dataStyle(C.lightBg, 'left', true), XLSX);
    mergeCells(ws, r, 0, r, 5);
  } else {
    setCell(ws, r, 0, `${data.overdueTasks.length} tasks are past their due date`, dataStyle('00FFEDEF', 'left', true), XLSX);
    mergeCells(ws, r, 0, r, 5);
    r++;

    const hdrs = ['#', 'Task Title', 'Assignee', 'Due Date', 'Days Overdue', 'Priority'];
    hdrs.forEach((h, i) => setCell(ws, r, i, h, headerStyle(C.redBg, C.redFg, 10), XLSX));
    r++;

    data.overdueTasks.forEach((t, idx) => {
      const rowBg = idx % 2 === 0 ? '00FFFFFF' : '00FFEDEF';
      setCell(ws, r, 0, idx + 1, dataStyle(rowBg, 'center'), XLSX);
      setCell(ws, r, 1, t.title, dataStyle(rowBg), XLSX);
      setCell(ws, r, 2, t.assignee === '—' ? 'Unassigned' : t.assignee, dataStyle(rowBg), XLSX);
      setCell(ws, r, 3, t.dueDate, dataStyle(rowBg, 'center'), XLSX);
      setCell(ws, r, 4, `+${t.daysOverdue}d`, { ...dataStyle(rowBg, 'center', true), font: { bold: true, sz: 10, name: 'Calibri', color: { argb: C.redFg } } }, XLSX);
      setCell(ws, r, 5, t.priority, priorityStyle(t.priorityKey), XLSX);
      r++;
    });
  }

  ws['!cols'] = [{ wch: 5 }, { wch: 42 }, { wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 12 }];
  ws['!ref']  = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: 5 } });
  return ws;
}

// ── Sheet: Upcoming Tasks ───────────────────────────────────────────────

function buildUpcomingSheet(data: ReportData, XLSX: XLSX): WorkSheet {
  const ws: WorkSheet = {};
  let r = 0;

  setCell(ws, r, 0, '📅 UPCOMING TASKS (NEXT 7 DAYS)', headerStyle(C.orangeBg, C.primaryFg, 12), XLSX);
  mergeCells(ws, r, 0, r, 5);
  r++;

  if (data.upcomingTasks.length === 0) {
    setCell(ws, r, 0, 'No tasks due in the next 7 days', dataStyle(C.lightBg, 'left', false), XLSX);
    mergeCells(ws, r, 0, r, 5);
  } else {
    setCell(ws, r, 0, `${data.upcomingTasks.length} tasks due this week`, dataStyle('00FFFBEB', 'left', true), XLSX);
    mergeCells(ws, r, 0, r, 5);
    r++;

    const hdrs = ['#', 'Task Title', 'Assignee', 'Due Date', 'Days Left', 'Priority'];
    hdrs.forEach((h, i) => setCell(ws, r, i, h, headerStyle(C.orangeBg, C.primaryFg, 10), XLSX));
    r++;

    data.upcomingTasks.forEach((t, idx) => {
      const rowBg = idx % 2 === 0 ? '00FFFFFF' : '00FFFBEB';
      const daysColor = t.daysUntilDue <= 1 ? C.redFg : t.daysUntilDue <= 3 ? C.orangeBg : C.greenFg;
      setCell(ws, r, 0, idx + 1, dataStyle(rowBg, 'center'), XLSX);
      setCell(ws, r, 1, t.title, dataStyle(rowBg), XLSX);
      setCell(ws, r, 2, t.assignee === '—' ? 'Unassigned' : t.assignee, dataStyle(rowBg), XLSX);
      setCell(ws, r, 3, t.dueDate, dataStyle(rowBg, 'center'), XLSX);
      setCell(ws, r, 4, t.daysUntilDue === 0 ? 'Today' : `${t.daysUntilDue}d`, { ...dataStyle(rowBg, 'center', true), font: { bold: true, sz: 10, name: 'Calibri', color: { argb: daysColor } } }, XLSX);
      setCell(ws, r, 5, t.priority, priorityStyle(t.priorityKey), XLSX);
      r++;
    });
  }

  ws['!cols'] = [{ wch: 5 }, { wch: 42 }, { wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 12 }];
  ws['!ref']  = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: 5 } });
  return ws;
}

// ── Sheet: Milestones ─────────────────────────────────────────────────────────
function buildMilestoneSheet(data: ReportData, XLSX: XLSX): WorkSheet {
  const ws: WorkSheet = {};
  let r = 0;

  setCell(ws, r, 0, 'MILESTONES', headerStyle(C.orangeBg, C.primaryFg, 12), XLSX);
  mergeCells(ws, r, 0, r, 4);
  r++;

  const hdrs = ['Milestone Name', 'Status', 'Due Date', 'Task Count', 'Description'];
  hdrs.forEach((h, i) => setCell(ws, r, i, h, headerStyle(C.orangeBg, C.orangeFg, 10), XLSX));
  r++;

  data.milestones.forEach((m, idx) => {
    const rowBg = idx % 2 === 0 ? C.whiteBg : C.rowAlt;
    const statusBg = m.status === 'COMPLETED' ? C.greenBg : m.status === 'ARCHIVED' ? C.midFg : C.orangeBg;
    setCell(ws, r, 0, m.name, dataStyle(rowBg, 'left', true), XLSX);
    setCell(ws, r, 1, m.status, headerStyle(statusBg, C.primaryFg, 9), XLSX);
    setCell(ws, r, 2, m.dueDate ? new Date(m.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—', dataStyle(rowBg, 'center'), XLSX);
    setCell(ws, r, 3, m.taskCount, dataStyle(rowBg, 'center', true), XLSX);
    setCell(ws, r, 4, m.description || '—', dataStyle(rowBg), XLSX);
    r++;
  });

  ws['!cols'] = [{ wch: 32 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 40 }];
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: 4 } });
  return ws;
}

// ════════════════════════════════════════════════════════════════════════════
//  MAIN EXPORT
// ════════════════════════════════════════════════════════════════════════════
export async function generateExcelReport(data: ReportData): Promise<void> {
  const XLSX = await import('xlsx');

  const wb: WorkBook = XLSX.utils.book_new();
  wb.Props = {
    Title:       `${data.projectName} — Planora Analytics Report`,
    Subject:     data.projectType,
    Author:      'Planora Project Management Suite',
    CreatedDate: new Date(),
  };

  XLSX.utils.book_append_sheet(wb, buildSummarySheet(data, XLSX),  'Dashboard');
  XLSX.utils.book_append_sheet(wb, buildTasksSheet(data, XLSX),    'All Tasks');
  XLSX.utils.book_append_sheet(wb, buildOverdueSheet(data, XLSX),  'Overdue Tasks');
  XLSX.utils.book_append_sheet(wb, buildUpcomingSheet(data, XLSX), 'Upcoming Tasks');
  if (data.isAgile && data.sprintStats.length > 0) {
    XLSX.utils.book_append_sheet(wb, buildSprintSheet(data, XLSX), 'Sprints');
  }
  XLSX.utils.book_append_sheet(wb, buildTeamSheet(data, XLSX), 'Team Workload');
  if (data.milestones.length > 0) {
    XLSX.utils.book_append_sheet(wb, buildMilestoneSheet(data, XLSX), 'Milestones');
  }

  // Browser-safe download — XLSX.writeFile can fail in Next.js; use Blob + anchor instead
  const wbBinary = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbBinary], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${data.projectName.replace(/[^a-zA-Z0-9]/g, '_')}_Report_${new Date().toISOString().slice(0,10)}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
