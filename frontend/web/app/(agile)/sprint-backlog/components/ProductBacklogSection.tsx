'use client';

import { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  
  UserCircle2,
} from 'lucide-react';
import type { TaskItem } from '../page';

interface ProductBacklogSectionProps {
  tasks: TaskItem[];
  onToggleTask: (id: number) => void;
  onStoryPointsChange: (id: number, points: number) => void;
  onCreateTask: (title: string) => void;
  onCreateSprint: (name: string) => void;
}

export default function ProductBacklogSection({
  tasks,
  onToggleTask,
  onStoryPointsChange,
  onCreateTask,
  onCreateSprint,
}: ProductBacklogSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [showCreateTaskBox, setShowCreateTaskBox] = useState(false);
  const [showCreateSprintBox, setShowCreateSprintBox] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [newSprintName, setNewSprintName] = useState('');

  const totals = useMemo(() => {
    const total = tasks.reduce((sum, task) => sum + task.storyPoints, 0);
    return {
      total,
      middle: 0,
      done: 0,
    };
  }, [tasks]);

  const handleCreateTask = () => {
    onCreateTask(newTaskName);
    setNewTaskName('');
    setShowCreateTaskBox(false);
  };

 const handleCreateSprint = () => {
  if (!newSprintName.trim()) return;

  onCreateSprint(newSprintName);
  setNewSprintName('');
  setShowCreateSprintBox(false);
};

  return (
    <div className="rounded-xl border border-[#E4E7EC] bg-[#F8F9FB] p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between border-b border-[#EAECF0] pb-4">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 rounded border border-[#98A2B3] bg-transparent" />

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="text-[#344054]"
          >
            {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>

          <div className="flex items-center gap-2">
            <span className="text-[16px] font-semibold text-[#101828]">
              Backlog
            </span>
            <span className="text-[14px] text-[#667085]">
              ({tasks.length} work items)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="rounded bg-[#D0D5DD] px-3 py-[3px] text-[12px] font-medium text-[#344054]">
              {totals.total}
            </div>
            <div className="rounded bg-[#D9EAF7] px-3 py-[3px] text-[12px] font-medium text-[#344054]">
              {totals.middle}
            </div>
            <div className="rounded bg-[#B7E4C7] px-3 py-[3px] text-[12px] font-medium text-[#344054]">
              {totals.done}
            </div>
          </div>

          <button
            onClick={() => setShowCreateSprintBox(true)}
            className="rounded-md border border-[#98A2B3] bg-white px-4 py-2 text-[14px] font-semibold text-[#101828] hover:bg-[#F9FAFB]"
          >
            Create Sprint
          </button>

          
        </div>
      </div>

      {isOpen && (
        <div>
          <div className="space-y-4">
            {tasks.map((task) => (
              <div
                key={task.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/plain', String(task.id))}
                className="grid cursor-grab grid-cols-[auto_auto_1fr_auto_auto] items-center gap-5 rounded-md border border-[#D0D5DD] bg-[#E6EEF4] px-4 py-5"
              >
                <button
                  type="button"
                  onClick={() => onToggleTask(task.id)}
                  className={`flex h-7 w-7 items-center justify-center rounded-[6px] border-2 ${
                    task.selected
                      ? 'border-[#175CD3] bg-[#175CD3]'
                      : 'border-[#175CD3] bg-white'
                  }`}
                >
                  {task.selected && <Check size={16} className="text-white" />}
                </button>

                <span className="text-[16px] font-medium text-[#475467]">
                  {task.taskNo}
                </span>

                <span className="text-[18px] font-medium text-[#101828]">
                  {task.title}
                </span>

                <input
                  type="number"
                  min="0"
                  value={task.storyPoints}
                  onChange={(e) =>
                    onStoryPointsChange(task.id, Number(e.target.value))
                  }
                  className="w-12 border-none bg-transparent text-center text-[18px] font-semibold text-[#101828] outline-none"
                />

                <div className="text-[#98A2B3]">
                  <UserCircle2 size={34} strokeWidth={1.5} />
                </div>
              </div>
            ))}
          </div>

          {showCreateSprintBox && (
            <div className="mt-4 rounded-lg border border-[#D0D5DD] bg-white p-4">
              <h3 className="mb-3 text-[15px] font-semibold text-[#101828]">
                Create Sprint
              </h3>

              <input
                type="text"
                value={newSprintName}
                onChange={(e) => setNewSprintName(e.target.value)}
                placeholder="Enter sprint name"
                className="w-full rounded-md border border-[#D0D5DD] px-3 py-2 text-sm text-[#101828] outline-none"
              />

              <p className="mt-2 text-[12px] text-[#667085]">
                Selected tasks will move into the new sprint.
              </p>

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={handleCreateSprint}
                  className="rounded-md bg-[#175CD3] px-4 py-2 text-sm font-medium text-white hover:bg-[#1849A9]"
                >
                  Create Sprint
                </button>

                <button
                  onClick={() => {
                    setShowCreateSprintBox(false);
                    setNewSprintName('');
                  }}
                  className="rounded-md border border-[#D0D5DD] bg-white px-4 py-2 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!showCreateTaskBox ? (
            <button
              onClick={() => setShowCreateTaskBox(true)}
              className="mt-3 flex items-center gap-2 text-[16px] font-medium text-[#667085] hover:text-[#344054]"
            >
              <span className="text-[28px] leading-none">+</span>
              <span>Create</span>
            </button>
          ) : (
            <div className="mt-4 rounded-lg border border-[#D0D5DD] bg-white p-4">
              <h3 className="mb-3 text-[15px] font-semibold text-[#101828]">
                Create Task
              </h3>

              <input
                type="text"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                placeholder="Enter task name"
                className="w-full rounded-md border border-[#D0D5DD] px-3 py-2 text-sm text-[#101828] outline-none"
              />

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={handleCreateTask}
                  className="rounded-md bg-[#175CD3] px-4 py-2 text-sm font-medium text-white hover:bg-[#1849A9]"
                >
                  Create Task
                </button>

                <button
                  onClick={() => {
                    setShowCreateTaskBox(false);
                    setNewTaskName('');
                  }}
                  className="rounded-md border border-[#D0D5DD] bg-white px-4 py-2 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}