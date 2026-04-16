export interface SprintboardTask {
  taskId: number;
  projectTaskNumber?: number;
  title: string;
  storyPoint: number;
  assigneeName?: string;
  assigneePhotoUrl?: string;
  status: string;
  priority: string;
  dueDate?: string;
  updatedAt?: string;
  attachmentCount?: number;
  commentCount?: number;
  label?: { name: string; color?: string };
}

export interface Sprintcolumn {
  id: number;
  position: number;
  columnName: string;
  columnStatus: string;
  tasks: SprintboardTask[];
}

export interface Sprintboard {
  id: number;
  sprintId: number;
  sprintName: string;
  sprintStatus: string;
  columns: Sprintcolumn[];
}

export interface SprintBoardStats {
  totalTasks: number;
  doneTasks: number;
  totalStoryPoints: number;
  doneStoryPoints: number;
  overdueTasks: number;
  unassignedTasks: number;
}

export interface SprintboardFullResponse extends Sprintboard {
  stats: SprintBoardStats;
}

export interface SprintBoardFilters {
  search: string;
  priority: string;
  assignee: string;
  status: string;
  swimlane: 'none' | 'assignee' | 'priority';
  showOnlyMine: boolean;
}
