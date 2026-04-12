'use client';

import React, { ReactNode } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
} from '@dnd-kit/core';
import { Task } from '../types';
import KanbanCard from './KanbanCard';

interface DragDropProviderProps {
  children: ReactNode;
  tasks: Task[];
  onDragEnd: (event: DragEndEvent) => void;
  onDragStart?: (event: DragStartEvent) => void;
  onDragOver?: (event: DragOverEvent) => void;
}

export default function DragDropProvider({
  children,
  tasks,
  onDragEnd,
  onDragStart,
  onDragOver,
}: DragDropProviderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const [draggedTask, setDraggedTask] = React.useState<Task | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const taskId = parseInt(active.id as string);
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      setDraggedTask(task);
    }
    onDragStart?.(event);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggedTask(null);
    onDragEnd(event);
  };

  const handleDragOver = (event: DragOverEvent) => {
    onDragOver?.(event);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      {children}
      <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
        {draggedTask ? (
          <div className="rotate-[2deg] scale-105 opacity-90" style={{ maxWidth: '300px' }}>
            <KanbanCard task={draggedTask} onDelete={undefined} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
