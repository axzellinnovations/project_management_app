export type Task = {
  id: string;
  title: string;
  assignees?: string[];
  due?: string;
  subtasks?: number;
};
