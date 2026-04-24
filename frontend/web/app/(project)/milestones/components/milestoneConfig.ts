// Single source of truth for all status display logic — adding a new status only requires this one file
export const STATUS_CONFIG = {
  OPEN:      { label: 'Open',      badge: 'bg-blue-50 text-blue-700',   dot: 'bg-blue-500' },
  COMPLETED: { label: 'Completed', badge: 'bg-green-50 text-green-700', dot: 'bg-green-500' },
  ARCHIVED:  { label: 'Archived',  badge: 'bg-gray-100 text-gray-600',  dot: 'bg-gray-400' },
} as const;

// Deriving the type from the config keys keeps the type and the UI mapping permanently in sync
export type MilestoneStatus = keyof typeof STATUS_CONFIG;
