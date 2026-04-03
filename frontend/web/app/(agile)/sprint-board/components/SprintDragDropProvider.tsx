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
import { SprintboardTask } from '../types';
import SprintCard from './SprintCard';

interface SprintDragDropProviderProps {
  children: ReactNode;
  tasks: SprintboardTask[];
  onDragEnd: (event: DragEndEvent) => void;
}

export default function SprintDragDropProvider({
  children,
  tasks,
  onDragEnd,
}: SprintDragDropProviderProps) {
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

  const [draggedTask, setDraggedTask] = React.useState<SprintboardTask | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const taskIdString = active.id.toString();
    const task = tasks.find((t) => t.taskId.toString() === taskIdString);
    if (task) {
      setDraggedTask(task);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggedTask(null);
    onDragEnd(event);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {draggedTask ? (
          <div className="opacity-90 scale-105 shadow-2xl">
            <SprintCard task={draggedTask} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
