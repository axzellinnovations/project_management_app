export const STATUS_COLOR: Record<string, string> = {
  TODO:        'bg-[#F3F4F6] text-[#6A7282]',
  IN_PROGRESS: 'bg-[#EFF6FF] text-[#1D4ED8]',
  IN_REVIEW:   'bg-[#FEF3C7] text-[#92400E]',
  DONE:        'bg-[#DCFCE7] text-[#166534]',
};

export const PRIORITY_CONFIG: Record<string, { color: string; dot: string; bg: string; label: string }> = {
  URGENT: { color: '#DC2626', dot: 'bg-red-500',    bg: 'bg-red-50',    label: 'Urgent' },
  HIGH:   { color: '#EA580C', dot: 'bg-orange-500', bg: 'bg-orange-50', label: 'High'   },
  MEDIUM: { color: '#D97706', dot: 'bg-amber-400',  bg: 'bg-amber-50',  label: 'Medium' },
  LOW:    { color: '#22C55E', dot: 'bg-gray-400',   bg: 'bg-gray-100',  label: 'Low'    },
};

export const STATUS_OPTIONS = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const;
export const PRIORITY_OPTIONS = [
  { value: 'LOW',    label: 'Low'    },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH',   label: 'High'   },
  { value: 'URGENT', label: 'Urgent' },
] as const;
export const DAY_COLUMN_WIDTH = 36; // pixels per day in timeline

export const DEFAULT_COLUMN_COLORS: Record<string, string> = {
  TODO:        '#F3F4F6',
  IN_PROGRESS: '#EFF6FF',
  IN_REVIEW:   '#FEF3C7',
  DONE:        '#DCFCE7',
};

export const COLUMN_SWATCH_COLORS = [
  { label: 'Gray',   value: '#F3F4F6' },
  { label: 'Blue',   value: '#EFF6FF' },
  { label: 'Amber',  value: '#FEF3C7' },
  { label: 'Pink',   value: '#FDF2F8' },
  { label: 'Green',  value: '#DCFCE7' },
  { label: 'Purple', value: '#F3E8FF' },
];
