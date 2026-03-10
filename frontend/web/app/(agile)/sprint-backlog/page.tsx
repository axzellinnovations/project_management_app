'use client';

import { useState } from 'react';
import BacklogCard from './components/BacklogCard';
import ProductBacklogSection from './components/ProductBacklogSection';

export interface TaskItem {
  id: number;
  taskNo: number;
  title: string;
  storyPoints: number;
  selected: boolean;
  assigneeName?: string;
}

export interface SprintItem {
  id: number;
  name: string;
  tasks: TaskItem[];
}

export default function SprintBacklogPage() {
  const [productTasks, setProductTasks] = useState<TaskItem[]>([
    {
      id: 1,
      taskNo: 3,
      title: 'Make a login page',
      storyPoints: 4,
      selected: false,
      assigneeName: 'Unassigned',
    },
    {
      id: 2,
      taskNo: 4,
      title: 'Make a register page',
      storyPoints: 2,
      selected: false,
      assigneeName: 'Unassigned',
    },
  ]);

  const [sprints, setSprints] = useState<SprintItem[]>([
    {
      id: 100,
      name: 'BANK Sprint 1',
      tasks: [],
    },
  ]);

  const toggleTaskSelection = (id: number) => {
    setProductTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, selected: !task.selected } : task
      )
    );
  };

  const updateTaskStoryPoints = (id: number, points: number) => {
    setProductTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? { ...task, storyPoints: Number.isNaN(points) ? 0 : points }
          : task
      )
    );
  };

  const createTask = (title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;

    setProductTasks((prev) => [
      ...prev,
      {
        id: Date.now(),
        taskNo: prev.length + 3,
        title: trimmed,
        storyPoints: 0,
        selected: false,
        assigneeName: 'Unassigned',
      },
    ]);
  };

  const createSprint = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const selectedTasks = productTasks.filter((task) => task.selected);

    const cleanedTasks = selectedTasks.map((task) => ({
      ...task,
      selected: false,
    }));

    const remainingTasks = productTasks.filter((task) => !task.selected);

    const newSprint: SprintItem = {
      id: Date.now(),
      name: trimmed,
      tasks: cleanedTasks,
    };

    setSprints((prev) => [...prev, newSprint]);

    if (selectedTasks.length > 0) {
      setProductTasks(remainingTasks);
    }
  };

  const moveTaskToSprint = (taskId: number, sprintId: number) => {
    const draggedTask = productTasks.find((task) => task.id === taskId);
    if (!draggedTask) return;

    setSprints((prev) =>
      prev.map((sprint) =>
        sprint.id === sprintId
          ? {
              ...sprint,
              tasks: [...sprint.tasks, { ...draggedTask, selected: false }],
            }
          : sprint
      )
    );

    setProductTasks((prev) => prev.filter((task) => task.id !== taskId));
  };

  return (
    <div className="flex flex-col gap-6">
      {sprints.map((sprint) => (
        <BacklogCard
          key={sprint.id}
          sprint={sprint}
          onDropTask={moveTaskToSprint}
        />
      ))}

      <ProductBacklogSection
        tasks={productTasks}
        onToggleTask={toggleTaskSelection}
        onStoryPointsChange={updateTaskStoryPoints}
        onCreateTask={createTask}
        onCreateSprint={createSprint}
      />
    </div>
  );
}