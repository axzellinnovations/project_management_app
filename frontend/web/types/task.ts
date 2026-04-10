// ── Task Domain Types ──────────────────────────────

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  DONE = 'DONE',
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export interface Assignee {
  id: number;
  name: string;
  email?: string;
  avatar?: string;
}

export interface Label {
  id: number;
  name: string;
  color?: string;
}

export interface Subtask {
  id: number;
  title: string;
  status: string;
}

export interface Dependency {
  id: number;
  title: string;
  relation: string;
}

export interface TaskAttachmentSummary {
  id: number;
  fileName: string;
  contentType: string;
  fileSize: number;
  uploadedByName: string;
}

export interface Task {
  id: number;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  storyPoint?: number;
  dueDate?: string;
  startDate?: string;
  createdAt?: string;
  completedAt?: string;
  updatedAt?: string;
  assignee?: Assignee;
  assigneeId?: number;
  assigneeName?: string;
  assignees?: Assignee[];
  assigneeIds?: number[];
  reporter?: Assignee;
  reporterId?: number;
  reporterName?: string;
  projectId?: number;
  sprintId?: number;
  sprintName?: string;
  milestoneId?: number;
  milestoneName?: string;
  labels?: Label[];
  subtasks?: Subtask[];
  dependencies?: Dependency[];
  attachments?: TaskAttachmentSummary[];
  assigneePhotoUrl?: string;
  reporterPhotoUrl?: string;
  recurrenceRule?: string;
  recurrenceEnd?: string;
  recurrenceParentId?: number;
  nextOccurrence?: string;
}

export interface TaskActivity {
  id: number;
  activityType: string;
  actorName: string;
  description: string;
  createdAt: string;
}

export interface TaskData {
  id: number;
  title: string;
  description: string;
  projectName: string;
  projectId: number;
  status: string;
  priority: string;
  storyPoint: number;
  reporterName: string;
  reporterId?: number;
  assigneeName: string;
  assigneeId?: number;
  assigneePhotoUrl?: string;
  sprintName: string;
  sprintId?: number;
  milestoneId?: number;
  milestoneName?: string;
  startDate?: string;
  labels: Label[];
  createdAt: string;
  updatedAt: string;
  dueDate: string;
  subtasks: Subtask[];
  dependencies: Dependency[];
  attachments?: TaskAttachmentSummary[];
}

export interface TaskItem {
  id: number;
  taskNo: number;
  title: string;
  storyPoints: number;
  selected: boolean;
  assigneeName?: string;
  assigneePhotoUrl?: string | null;
  sprintId?: number | null;
  status?: string;
  startDate?: string;
  dueDate?: string;
  priority?: string;
  labels?: Label[];
}

export interface CustomField {
  id: number;
  projectId: number;
  name: string;
  fieldType: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT';
  options?: string[];
  position: number;
}

export interface CustomFieldValue {
  customFieldId: number;
  fieldName: string;
  fieldType: string;
  value: string | null;
}

export interface TaskTemplate {
  id: number;
  projectId: number;
  name: string;
  title: string;
  description?: string;
  priority?: string;
  storyPoint: number;
  labelIds?: number[];
  createdAt: string;
  createdByName?: string;
}

// ── Status / Priority colour maps ──────────────────

export const STATUS_COLORS: Record<string, string> = {
  TODO: 'bg-status-todo',
  IN_PROGRESS: 'bg-status-in-progress',
  IN_REVIEW: 'bg-status-in-review',
  DONE: 'bg-status-done',
};

export const STATUS_TEXT_COLORS: Record<string, string> = {
  TODO: 'text-cu-text-secondary',
  IN_PROGRESS: 'text-cu-purple',
  IN_REVIEW: 'text-cu-warning',
  DONE: 'text-cu-success',
};

export const STATUS_LABELS: Record<string, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
};

export const PRIORITY_COLORS: Record<string, string> = {
  URGENT: 'text-priority-urgent',
  HIGH: 'text-priority-high',
  MEDIUM: 'text-priority-normal',
  NORMAL: 'text-priority-normal',
  LOW: 'text-priority-low',
};

export const PRIORITY_BG_COLORS: Record<string, string> = {
  URGENT: 'bg-priority-urgent',
  HIGH: 'bg-priority-high',
  MEDIUM: 'bg-priority-normal',
  NORMAL: 'bg-priority-normal',
  LOW: 'bg-priority-low',
};
