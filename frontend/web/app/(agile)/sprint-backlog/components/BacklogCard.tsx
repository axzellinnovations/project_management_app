'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Check,
  Trash2,
  UserCircle2,
} from 'lucide-react';
import type { SprintItem } from '../page';

interface BacklogCardProps {
  sprint: SprintItem;
  onDropTask: (taskId: number, sprintId: number) => void;
}

type SprintStatus = 'todo' | 'inprogress' | 'review' | 'done';

interface LocalSprintTask {
  id: number;
  taskNo: number;
  title: string;
  storyPoints: number;
  selected: boolean;
  assigneeName?: string;
  status: SprintStatus;
  startDate: string;
  endDate: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  subtasks: string;
}

export default function BacklogCard({ sprint, onDropTask }: BacklogCardProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [openMenuTaskId, setOpenMenuTaskId] = useState<number | null>(null);
  const [showSprintMenu, setShowSprintMenu] = useState(false);

  const sprintMenuRef = useRef<HTMLDivElement | null>(null);

  const [localTasks, setLocalTasks] = useState<LocalSprintTask[]>([]);

  useEffect(() => {
    setLocalTasks((prev) => {
      const prevMap = new Map(prev.map((task) => [task.id, task]));

      return sprint.tasks.map((task) => {
        const existing = prevMap.get(task.id);

        return {
          id: task.id,
          taskNo: task.taskNo,
          title: task.title,
          storyPoints: existing?.storyPoints ?? task.storyPoints,
          selected: task.selected,
          assigneeName: existing?.assigneeName ?? task.assigneeName ?? 'Unassigned',
          status: existing?.status ?? 'todo',
          startDate: existing?.startDate ?? '',
          endDate: existing?.endDate ?? '',
          priority: existing?.priority ?? 'Medium',
          subtasks: existing?.subtasks ?? '',
        };
      });
    });
  }, [sprint.tasks]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sprintMenuRef.current &&
        !sprintMenuRef.current.contains(event.target as Node)
      ) {
        setShowSprintMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const totals = useMemo(() => {
    return localTasks.reduce(
      (acc, task) => {
        if (task.status === 'todo') acc.todo += task.storyPoints;
        if (task.status === 'inprogress') acc.inprogress += task.storyPoints;
        if (task.status === 'done') acc.done += task.storyPoints;
        return acc;
      },
      { todo: 0, inprogress: 0, done: 0 }
    );
  }, [localTasks]);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const taskId = Number(event.dataTransfer.getData('text/plain'));
    if (!taskId) return;

    onDropTask(taskId, sprint.id);
  };

  const updateTask = (taskId: number, updates: Partial<LocalSprintTask>) => {
    setLocalTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, ...updates } : task
      )
    );
  };

  const formatDate = (value: string) => {
    if (!value) return 'Set Date';

    const date = new Date(value);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const handleEditSprint = () => {
    alert(`Edit ${sprint.name}`);
    setShowSprintMenu(false);
  };

  const handleCompleteSprint = () => {
    alert(`Complete ${sprint.name}`);
    setShowSprintMenu(false);
  };

  const handleDeleteSprint = () => {
    alert(`Delete ${sprint.name}`);
    setShowSprintMenu(false);
  };

  return (
    <div className="rounded-xl border border-[#E4E7EC] bg-[#F8F9FB] p-5 shadow-sm">
      {/* Sprint Header */}
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
              {sprint.name}
            </span>
            <span className="text-[14px] text-[#667085]">
              ({localTasks.length} work items)
            </span>
          </div>
        </div>

        <div className="relative flex items-center gap-3" ref={sprintMenuRef}>
          <div className="flex items-center gap-1">
            <div className="rounded bg-[#D0D5DD] px-3 py-[3px] text-[12px] font-medium text-[#344054]">
              {totals.todo}
            </div>
            <div className="rounded bg-[#D9EAF7] px-3 py-[3px] text-[12px] font-medium text-[#344054]">
              {totals.inprogress}
            </div>
            <div className="rounded bg-[#B7E4C7] px-3 py-[3px] text-[12px] font-medium text-[#344054]">
              {totals.done}
            </div>
          </div>

          <button
            onClick={handleCompleteSprint}
            className="rounded-md border border-[#98A2B3] bg-[#CBD9E1] px-5 py-2 text-[14px] font-semibold text-[#101828] hover:bg-[#B8C9D3]"
          >
            Complete Sprint
          </button>

          <button
            type="button"
            onClick={() => setShowSprintMenu((prev) => !prev)}
            className="text-[#344054]"
          >
            <MoreHorizontal size={20} />
          </button>

          {showSprintMenu && (
            <div className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-xl border border-[#D0D5DD] bg-white shadow-xl">
              <button
                onClick={handleEditSprint}
                className="flex w-full items-center gap-3 px-5 py-4 text-left text-[14px] text-[#101828] hover:bg-[#F9FAFB]"
              >
                <Pencil size={18} />
                <span>Edit Sprint</span>
              </button>

              <button
                onClick={handleCompleteSprint}
                className="flex w-full items-center gap-3 px-5 py-4 text-left text-[14px] text-[#101828] hover:bg-[#F9FAFB]"
              >
                <Check size={18} />
                <span>Complete Sprint</span>
              </button>

              <div className="border-t border-[#EAECF0]" />

              <button
                onClick={handleDeleteSprint}
                className="flex w-full items-center gap-3 px-5 py-4 text-left text-[14px] text-[#F04438] hover:bg-[#FEF3F2]"
              >
                <Trash2 size={18} />
                <span>Delete Sprint</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {isOpen && (
        <div onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
          <div className="space-y-4">
            {localTasks.length > 0 ? (
              localTasks.map((task) => (
                <div
                  key={task.id}
                  className="relative grid grid-cols-[auto_auto_1fr_auto_auto_auto_auto] items-center gap-5 rounded-md border border-[#D0D5DD] bg-[#E6EEF4] px-4 py-5"
                >
                  <div className="h-7 w-7 rounded-[6px] border-2 border-[#175CD3] bg-white" />

                  <span className="text-[16px] font-medium text-[#475467]">
                    {task.taskNo}
                  </span>

                  <span className="text-[18px] font-medium text-[#101828]">
                    {task.title}
                  </span>

                  <div className="relative">
                    <select
                      value={task.status}
                      onChange={(e) =>
                        updateTask(task.id, {
                          status: e.target.value as SprintStatus,
                        })
                      }
                      className="appearance-none rounded-md border border-[#D0D5DD] bg-white pl-4 pr-12 py-2 text-[14px] font-medium text-[#101828] outline-none"
                    >
                      <option value="todo">To Do</option>
                      <option value="inprogress">In Progress</option>
                      <option value="review">In Review</option>
                      <option value="done">Done</option>
                    </select>

                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#667085]">
                      ▼
                    </span>
                  </div>

                  <div className="flex items-center gap-2 rounded-md border border-[#98A2B3] bg-white px-3 py-2 text-[14px] text-[#101828]">
                    <CalendarDays size={18} className="text-[#101828]" />
                    <span>{formatDate(task.endDate)}</span>
                  </div>

                  <input
                    type="number"
                    min="0"
                    value={task.storyPoints}
                    onChange={(e) =>
                      updateTask(task.id, {
                        storyPoints: Number.isNaN(Number(e.target.value))
                          ? 0
                          : Number(e.target.value),
                      })
                    }
                    className="w-14 rounded-md border border-[#D0D5DD] bg-white px-2 py-2 text-center text-[16px] font-semibold text-[#101828] outline-none"
                  />

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      title={task.assigneeName || 'Unassigned'}
                      className="text-[#98A2B3]"
                    >
                      <UserCircle2 size={34} strokeWidth={1.5} />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setOpenMenuTaskId((prev) =>
                          prev === task.id ? null : task.id
                        )
                      }
                      className="text-[#344054]"
                    >
                      <MoreHorizontal size={20} />
                    </button>
                  </div>

                  {openMenuTaskId === task.id && (
                    <div className="absolute right-4 top-[78px] z-50 w-80 rounded-xl border border-[#D0D5DD] bg-white p-4 shadow-xl">
                      <h4 className="mb-3 text-sm font-semibold text-[#344054]">
                        Task Options
                      </h4>

                      <div className="mb-3">
                        <label className="mb-1 block text-xs text-[#667085]">
                          Subtasks
                        </label>
                        <input
                          type="text"
                          value={task.subtasks}
                          onChange={(e) =>
                            updateTask(task.id, { subtasks: e.target.value })
                          }
                          className="w-full rounded-md border border-[#D0D5DD] px-3 py-2 text-sm outline-none"
                          placeholder="Enter subtasks"
                        />
                      </div>

                      <div className="mb-3">
                        <label className="mb-1 block text-xs text-[#667085]">
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={task.startDate}
                          onChange={(e) =>
                            updateTask(task.id, { startDate: e.target.value })
                          }
                          className="w-full rounded-md border border-[#D0D5DD] px-3 py-2 text-sm outline-none"
                        />
                      </div>

                      <div className="mb-3">
                        <label className="mb-1 block text-xs text-[#667085]">
                          End Date
                        </label>
                        <input
                          type="date"
                          value={task.endDate}
                          onChange={(e) =>
                            updateTask(task.id, { endDate: e.target.value })
                          }
                          className="w-full rounded-md border border-[#D0D5DD] px-3 py-2 text-sm outline-none"
                        />
                      </div>

                      <div className="mb-3">
                        <label className="mb-1 block text-xs text-[#667085]">
                          Assignee
                        </label>
                        <input
                          type="text"
                          value={task.assigneeName || ''}
                          onChange={(e) =>
                            updateTask(task.id, { assigneeName: e.target.value })
                          }
                          className="w-full rounded-md border border-[#D0D5DD] px-3 py-2 text-sm outline-none"
                          placeholder="Enter assignee"
                        />
                      </div>

                      <div className="mb-1">
                        <label className="mb-1 block text-xs text-[#667085]">
                          Priority
                        </label>
                        <select
                          value={task.priority}
                          onChange={(e) =>
                            updateTask(task.id, {
                              priority: e.target.value as
                                | 'Low'
                                | 'Medium'
                                | 'High'
                                | 'Critical',
                            })
                          }
                          className="w-full rounded-md border border-[#D0D5DD] px-3 py-2 text-sm outline-none"
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                          <option value="Critical">Critical</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="rounded-md border border-dashed border-[#98A2B3] bg-white px-4 py-8 text-center text-[14px] text-[#667085]">
                Drag tasks here from Product Backlog
              </div>
            )}
          </div>

          <button className="mt-3 flex items-center gap-2 text-[16px] font-medium text-[#667085] hover:text-[#344054]">
            <span className="text-[28px] leading-none">+</span>
            <span>Create</span>
          </button>
        </div>
      )}
    </div>
  );
}