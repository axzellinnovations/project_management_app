// Task status enum matching backend
export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  DONE = 'DONE',
}

// Task priority enum
export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

// Assignee info
export interface Assignee {
  id: number;
  name: string;
  email?: string;
  avatar?: string;
}

// Label/tag for tasks
export interface Label {
  id: number;
  name: string;
  color?: string;
}

// Dependency link between tasks
export interface Dependency {
  id: number;
  title: string;
  relation: string; // BLOCKED_BY | BLOCKS | RELATES_TO
}

// Task interface matching backend response
export interface Task {
  id: number;
  title: string;
  description?: string;
  status: string; // TODO, IN_PROGRESS, IN_REVIEW, DONE
  priority?: string;
  storyPoint?: number;
  dueDate?: string; // ISO date string
  startDate?: string; // ISO date string
  createdAt?: string;
  updatedAt?: string;
  assignee?: Assignee;
  assigneeId?: number;
  assigneeName?: string;
  assigneePhotoUrl?: string | null;
  reporter?: Assignee;
  reporterId?: number;
  reporterName?: string;
  projectId?: number;
  sprintId?: number;
  labels?: Label[];
  labelId?: number;        // single label ID (one label per task per SRS)
  milestoneId?: number;    // milestone ID (new feature — may be null)
  milestoneTitle?: string; // milestone name for display
  dependencies?: Dependency[];
  subtasks?: Subtask[];
  commentCount?: number;     // number of comments on this task
  attachmentCount?: number;  // number of attachments on this task
}

// Subtask interface
export interface Subtask {
  id: number;
  title: string;
  status: string;
}

// Kanban column definition (runtime/display)
export interface KanbanColumn {
  status: string;
  title: string;
  tasks: Task[];
}

// Kanban column config (from backend, includes DB id, color, wipLimit)
export interface KanbanColumnConfig {
  id: number;
  status: string;
  title: string;
  color: string;
  wipLimit: number; // 0 = unlimited
}

// Drag item payload
export interface DragItem {
  type: 'task';
  taskId: number;
  columnStatus: string;
}

// Date filter state
export interface DateFilter {
  startDate: Date | null;
  endDate: Date | null;
}

