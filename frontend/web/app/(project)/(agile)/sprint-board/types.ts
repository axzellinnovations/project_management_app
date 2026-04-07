export interface SprintboardTask {
  taskId: number;
  title: string;
  storyPoint: number;
  assigneeName?: string;
  assigneePhotoUrl?: string;
  status: string;
  priority: string;
  dueDate?: string;
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
