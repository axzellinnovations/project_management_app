'use client';

import React, { ReactNode } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
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
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    })
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
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      {children}
      <DragOverlay>
        {draggedTask ? (
          <div className="opacity-80">
            <KanbanCard task={draggedTask} onDelete={undefined} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
