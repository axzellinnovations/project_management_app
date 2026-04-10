export type CalendarView = 'month' | 'week' | 'agenda';

export interface CalendarEventItem {
  id: string;
  taskId?: number;
  title: string;
  kind: 'sprint' | 'task';
  type?: string;
  status?: string;
  assignee?: string;
  startDate?: string;
  endDate?: string;
  dueDate?: string;
  creator?: string;
  description?: string;
  environment?: string;
  hasAttachment?: boolean;
  hasComment?: boolean;
}

export interface CalendarFilters {
  search: string;
  assignees: string[];
  types: string[];
  statuses: string[];
  moreFilters: string[];
}
