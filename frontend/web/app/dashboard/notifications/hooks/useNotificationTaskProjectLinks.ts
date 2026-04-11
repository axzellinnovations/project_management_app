import { useEffect, useMemo, useRef, useState } from 'react';
import api from '@/lib/axios';
import type { Notification } from '@/services/notifications-service';
import type { TaskProjectLinkMap } from '../types';
import {
  extractTaskIdFromLink,
  TASK_LOOKUP_BATCH_SIZE,
  TASK_LOOKUP_WINDOW,
} from '../utils';

export function useNotificationTaskProjectLinks(sortedNotifications: Notification[]) {
  const [taskProjectLinks, setTaskProjectLinks] = useState<TaskProjectLinkMap>({});
  const attemptedTaskLookupsRef = useRef<Set<number>>(new Set());

  const unresolvedTaskIds = useMemo(() => {
    const ids: number[] = [];

    sortedNotifications.slice(0, TASK_LOOKUP_WINDOW).forEach((notification) => {
      const taskId = extractTaskIdFromLink(notification.link);
      if (
        taskId !== null
        && !taskProjectLinks[taskId]
        && !attemptedTaskLookupsRef.current.has(taskId)
        && !ids.includes(taskId)
      ) {
        ids.push(taskId);
      }
    });

    return ids.slice(0, TASK_LOOKUP_BATCH_SIZE);
  }, [sortedNotifications, taskProjectLinks]);

  useEffect(() => {
    if (unresolvedTaskIds.length === 0) {
      return;
    }

    let disposed = false;
    unresolvedTaskIds.forEach((taskId) => {
      attemptedTaskLookupsRef.current.add(taskId);
    });

    const hydrateTaskProjectLinks = async () => {
      const updates: TaskProjectLinkMap = {};

      await Promise.all(
        unresolvedTaskIds.map(async (taskId) => {
          try {
            const response = await api.get(`/api/tasks/${taskId}`);
            const projectId = Number(response?.data?.projectId);
            if (!Number.isFinite(projectId) || projectId <= 0) {
              return;
            }

            const projectName =
              typeof response?.data?.projectName === 'string'
                ? response.data.projectName.trim()
                : '';

            updates[taskId] = {
              projectId,
              projectName: projectName || `Project ${projectId}`,
            };
          } catch {
            // Skip failed lookups; notification still renders with primary action link.
          }
        }),
      );

      if (disposed || Object.keys(updates).length === 0) {
        return;
      }

      setTaskProjectLinks((prev) => ({ ...prev, ...updates }));
    };

    void hydrateTaskProjectLinks();

    return () => {
      disposed = true;
    };
  }, [unresolvedTaskIds]);

  return taskProjectLinks;
}
