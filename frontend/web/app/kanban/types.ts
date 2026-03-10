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
  assigneeName?: string;
  reporter?: Assignee;
  reporterName?: string;
  projectId?: number;
  sprintId?: number;
  labels?: Label[];
  subtasks?: Subtask[];
}

// Subtask interface
export interface Subtask {
  id: number;
  title: string;
  status: string;
}

// Kanban column definition
export interface KanbanColumn {
  status: string;
  title: string;
  tasks: Task[];
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
