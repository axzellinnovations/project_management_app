import { useState, useCallback, useEffect } from 'react';
import { Task } from '../types';
import { format, addDays } from 'date-fns';
import { updateTaskDates } from '../api';

interface TimelineTaskLike {
  id: number;
  startDateObj: Date;
  dueDateObj: Date;
}

export function useTimelineDrag(
  dayColumnWidth: number,
  onTaskUpdated?: (taskId: number, updates: Partial<Task>) => void,
  setLocalTasks?: React.Dispatch<React.SetStateAction<Task[]>>,
) {
  const [activeDrag, setActiveDrag] = useState<{
    taskId: number; type: 'move' | 'resize'; startX: number; origStart: Date; origDue: Date;
  } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!activeDrag) return;
    const deltaPx = e.clientX - activeDrag.startX;
    setDragOffset(Math.round(deltaPx / dayColumnWidth));
  }, [activeDrag, dayColumnWidth]);

  const handleMouseUp = useCallback(async () => {
    if (!activeDrag || dragOffset === 0) {
      setActiveDrag(null);
      setDragOffset(0);
      return;
    }

    const { taskId, type, origStart, origDue } = activeDrag;
    let newStartDate: string | undefined;
    let newDueDate: string | undefined;

    if (type === 'move') {
      newStartDate = format(addDays(origStart, dragOffset), 'yyyy-MM-dd');
      newDueDate = format(addDays(origDue, dragOffset), 'yyyy-MM-dd');
    } else {
      const newDue = addDays(origDue, dragOffset);
      if (newDue <= origStart) { setActiveDrag(null); setDragOffset(0); return; }
      newDueDate = format(newDue, 'yyyy-MM-dd');
    }

    const updates: Partial<Task> = {};
    if (newStartDate) updates.startDate = newStartDate;
    if (newDueDate) updates.dueDate = newDueDate;

    setLocalTasks?.(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
    onTaskUpdated?.(taskId, updates);
    setActiveDrag(null);
    setDragOffset(0);

    try {
      // Use the specialized dates endpoint to avoid 400 errors from missing required fields in PUT
      await updateTaskDates(taskId, updates.startDate, updates.dueDate);
    } catch {
      setLocalTasks?.(prev => prev.map(t =>
        t.id === taskId ? { ...t, startDate: format(origStart, 'yyyy-MM-dd'), dueDate: format(origDue, 'yyyy-MM-dd') } : t
      ));
    }
  }, [activeDrag, dragOffset, onTaskUpdated, setLocalTasks]);

  useEffect(() => {
    if (!activeDrag) return;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeDrag, handleMouseMove, handleMouseUp]);

  const startDrag = useCallback((e: React.MouseEvent, task: TimelineTaskLike, type: 'move' | 'resize') => {
    e.preventDefault();
    setActiveDrag({ taskId: task.id, type, startX: e.clientX, origStart: task.startDateObj, origDue: task.dueDateObj });
    setDragOffset(0);
  }, []);

  return { activeDrag, dragOffset, startDrag };
}
