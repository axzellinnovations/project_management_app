// ── Task Row Constants & Helpers ──────────────────────────────────────────────

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';

export const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  TODO: 'bg-[#F2F4F7] text-[#344054]',
  IN_PROGRESS: 'bg-[#EFF8FF] text-[#175CD3]',
  IN_REVIEW: 'bg-[#FFFAEB] text-[#B54708]',
  DONE: 'bg-[#ECFDF3] text-[#027A48]',
};

export const STATUS_BORDER: Record<TaskStatus, string> = {
  TODO: '#D0D5DD',
  IN_PROGRESS: '#175CD3',
  IN_REVIEW: '#F79009',
  DONE: '#12B76A',
};

export const PRIORITY_STYLES: Record<string, string> = {
  CRITICAL: 'bg-[#FEF3F2] text-[#B42318]',
  HIGH: 'bg-[#FFFAEB] text-[#B54708]',
  URGENT: 'bg-[#FEF3F2] text-[#B42318]',
  MEDIUM: 'bg-[#EFF8FF] text-[#175CD3]',
  LOW: 'bg-[#F2F4F7] text-[#344054]',
};

export type DueClass = 'none' | 'overdue' | 'today' | 'soon' | 'future';

export const DUE_CHIP_STYLES: Record<DueClass, string> = {
  overdue: 'bg-[#FEF3F2] text-[#B42318] border-[#FDA29B]',
  today: 'bg-[#FEF3F2] text-[#B42318] border-[#FDA29B]',
  soon: 'bg-[#FFFAEB] text-[#B54708] border-[#FEDF89]',
  future: 'bg-[#F9FAFB] text-[#344054] border-[#EAECF0]',
  none: 'bg-[#F9FAFB] text-[#98A2B3] border-[#EAECF0]',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

export function classifyDue(dueDate: string | undefined, status: string): DueClass {
  if (!dueDate || status === 'DONE') return 'none';
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  // Force local-time parsing to avoid off-by-one from UTC interpretation
  const due = new Date(dueDate.length === 10 ? dueDate + 'T00:00:00' : dueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((due.getTime() - now.getTime()) / 86_400_000);
  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'today';
  if (diffDays <= 3) return 'soon';
  return 'future';
}

export function formatDate(value: string | undefined): string {
  if (!value) return 'Set Due';
  const d = new Date(value.length === 10 ? value + 'T00:00:00' : value);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
