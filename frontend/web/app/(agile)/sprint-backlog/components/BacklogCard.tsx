'use client';

import React, { useMemo, useState } from 'react';
import BacklogRow from './BacklogRow';

interface Task {
  id: number;
  title: string;
  assignee?: string;
  storyPoints: number;
  status: 'todo' | 'inprogress' | 'review' | 'done';
}

export default function BacklogCard() {
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: 1,
      title: 'Design login page',
      assignee: 'Pushmitha',
      storyPoints: 0,
      status: 'todo',
    },
    {
      id: 2,
      title: 'Create sprint backlog UI',
      assignee: 'Admin',
      storyPoints: 0,
      status: 'inprogress',
    },
  ]);

  const [showCreateBox, setShowCreateBox] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');

  const totals = useMemo(() => {
    return tasks.reduce(
      (acc, task) => {
        if (task.status === 'todo') acc.todo += task.storyPoints;
        if (task.status === 'inprogress') acc.inprogress += task.storyPoints;
        if (task.status === 'done') acc.done += task.storyPoints;
        return acc;
      },
      { todo: 0, inprogress: 0, done: 0 }
    );
  }, [tasks]);

  const handleStatusChange = (
    id: number,
    newStatus: 'todo' | 'inprogress' | 'review' | 'done'
  ) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, status: newStatus } : task
      )
    );
  };

  const handleStoryPointsChange = (id: number, newPoints: number) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, storyPoints: newPoints } : task
      )
    );
  };

  const handleDeleteTask = (id: number) => {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  };

  const handleCreateTask = () => {
    const trimmedName = newTaskName.trim();

    if (!trimmedName) return;

    const newTask: Task = {
      id: Date.now(),
      title: trimmedName,
      assignee: 'Unassigned',
      storyPoints: 0,
      status: 'todo',
    };

    setTasks((prev) => [...prev, newTask]);
    setNewTaskName('');
    setShowCreateBox(false);
  };

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Sprint Backlog</h2>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="min-w-[28px] rounded bg-gray-200 px-2 py-[2px] text-center text-xs font-medium text-gray-700">
              {totals.todo}
            </div>
            <div className="min-w-[28px] rounded bg-blue-100 px-2 py-[2px] text-center text-xs font-medium text-blue-700">
              {totals.inprogress}
            </div>
            <div className="min-w-[28px] rounded bg-green-100 px-2 py-[2px] text-center text-xs font-medium text-green-700">
              {totals.done}
            </div>
          </div>

          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
  Complete Sprint
</button>
        </div>
      </div>

      {/* Task List */}
      <div className="rounded-xl border border-gray-200">
        {tasks.map((task, index) => (
          <BacklogRow
            key={task.id}
            index={index}
            title={task.title}
            assignee={task.assignee}
            storyPoints={task.storyPoints}
            status={task.status}
            onStatusChange={(newStatus) =>
              handleStatusChange(task.id, newStatus)
            }
            onStoryPointsChange={(newPoints) =>
              handleStoryPointsChange(task.id, newPoints)
            }
            onDelete={() => handleDeleteTask(task.id)}
          />
        ))}

        {/* Jira-style create section */}
        <div className="border-t border-gray-200 p-3">
          {!showCreateBox ? (
            <button
              onClick={() => setShowCreateBox(true)}
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              + Create
            </button>
          ) : (
            <div className="rounded-lg border border-gray-300 bg-gray-50 p-3">
              <input
                type="text"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                placeholder="What needs to be done?"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                autoFocus
              />

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={handleCreateTask}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Create Task
                </button>

                <button
                  onClick={() => {
                    setShowCreateBox(false);
                    setNewTaskName('');
                  }}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}