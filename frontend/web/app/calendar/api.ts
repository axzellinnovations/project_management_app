import api from '@/lib/axios';
import type { CalendarEventItem } from './types';

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const mapTask = (task: any): CalendarEventItem => ({
  id: `task-${task.id}`,
  title: task.title || 'Untitled Task',
  kind: 'task',
  type: task.type || 'Task',
  status: task.status || 'To Do',
  assignee: task.assigneeName || task.assignee?.name,
  startDate: task.startDate || task.dueDate,
  endDate: task.endDate || task.dueDate || task.startDate,
  dueDate: task.dueDate,
  creator: task.creator || task.reporterName,
  description: task.description,
  environment: task.environment,
  hasAttachment: Boolean(task.hasAttachment || (Array.isArray(task.attachments) && task.attachments.length > 0)),
  hasComment: Boolean(task.hasComment || (Array.isArray(task.comments) && task.comments.length > 0)),
});

const mapSprint = (sprint: any): CalendarEventItem => ({
  id: `sprint-${sprint.id}`,
  title: sprint.name || 'Sprint',
  kind: 'sprint',
  type: 'Sprint',
  status: sprint.status || 'Planned',
  startDate: sprint.startDate,
  endDate: sprint.endDate || sprint.dueDate,
  dueDate: sprint.endDate || sprint.dueDate,
  creator: sprint.creator,
  description: sprint.goal || sprint.description,
});

export const fetchCalendarEvents = async (projectId: string | number): Promise<CalendarEventItem[]> => {
  const pid = String(projectId);

  try {
    const response = await api.get(`/api/calendar/events?projectId=${pid}`);
    return asArray<any>(response.data).map((item) => ({
      id: String(item.id),
      title: item.title || 'Untitled',
      kind: item.kind === 'sprint' ? 'sprint' : 'task',
      type: item.type,
      status: item.status,
      assignee: item.assignee,
      startDate: item.startDate,
      endDate: item.endDate,
      dueDate: item.dueDate,
      creator: item.creator,
      description: item.description,
      environment: item.environment,
      hasAttachment: Boolean(item.hasAttachment),
      hasComment: Boolean(item.hasComment),
    }));
  } catch {
    const [tasksRes, sprintsRes] = await Promise.allSettled([
      api.get(`/api/tasks/project/${pid}`),
      api.get(`/api/sprints/project/${pid}`),
    ]);

    const tasks =
      tasksRes.status === 'fulfilled' ? asArray<any>(tasksRes.value.data).map(mapTask) : [];
    const sprints =
      sprintsRes.status === 'fulfilled' ? asArray<any>(sprintsRes.value.data).map(mapSprint) : [];

    return [...sprints, ...tasks];
  }
};
