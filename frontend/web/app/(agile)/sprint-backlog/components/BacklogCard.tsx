'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import BacklogRow from './BacklogRow';
import { MoreHorizontal, Pencil, Check, Trash2 } from 'lucide-react';

interface TeamMember {
  id: number;
  name: string;
  email?: string;
}

interface Task {
  id: number;
  title: string;
  assigneeId?: number;
  assigneeName?: string;
  storyPoints: number;
  status: 'todo' | 'inprogress' | 'review' | 'done';
  startDate?: string;
  endDate?: string;
}

export default function BacklogCard() {
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: 1,
      title: 'Transfer fund',
      assigneeId: 1,
      assigneeName: 'Member 1',
      storyPoints: 2,
      status: 'todo',
      startDate: '',
      endDate: '2026-12-26',
    },
    {
      id: 2,
      title: 'Transfer fund',
      assigneeId: 2,
      assigneeName: 'Member 2',
      storyPoints: 0,
      status: 'todo',
      startDate: '',
      endDate: '2026-12-26',
    },
  ]);

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [showCreateBox, setShowCreateBox] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [showSprintMenu, setShowSprintMenu] = useState(false);

  const sprintMenuRef = useRef<HTMLDivElement | null>(null);

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
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchTeamMembers = async () => {
      try {
        // Change this URL to your backend endpoint
        // Example:
        // http://localhost:8080/api/team-members
        const response = await fetch('http://localhost:8080/api/team-members');

        if (!response.ok) {
          throw new Error('Failed to fetch team members');
        }

        const data = await response.json();

        const formattedMembers: TeamMember[] = data.map((member: any) => ({
          id: member.id,
          name: member.name || member.fullName || member.username,
          email: member.email,
        }));

        setTeamMembers(formattedMembers);
      } catch (error) {
        console.error('Error fetching team members:', error);
      }
    };

    fetchTeamMembers();
  }, []);

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

  const handleStartDateChange = (id: number, startDate: string) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, startDate } : task))
    );
  };

  const handleEndDateChange = (id: number, endDate: string) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, endDate } : task))
    );
  };

  const handleAssigneeChange = (id: number, assigneeId: number) => {
    const selectedMember = teamMembers.find((member) => member.id === assigneeId);

    setTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? {
              ...task,
              assigneeId,
              assigneeName: selectedMember?.name || 'Unassigned',
            }
          : task
      )
    );

    // Call backend API to assign user
    fetch(`http://localhost:8080/api/task/${id}/assign/${assigneeId}`, {
      method: 'PATCH',
      credentials: 'include', // if using cookies/auth
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to assign assignee');
        }
      })
      .catch((error) => {
        console.error('Error assigning assignee:', error);
      });
  };

  const handleCreateTask = () => {
    const trimmedName = newTaskName.trim();
    if (!trimmedName) return;

    const newTask: Task = {
      id: Date.now(),
      title: trimmedName,
      assigneeId: undefined,
      assigneeName: 'Unassigned',
      storyPoints: 0,
      status: 'todo',
      startDate: '',
      endDate: '',
    };

    setTasks((prev) => [...prev, newTask]);
    setNewTaskName('');
    setShowCreateBox(false);
  };

  const handleEditSprint = () => {
    alert('Edit Sprint clicked');
    setShowSprintMenu(false);
  };

  const handleCompleteSprint = () => {
    alert('Complete Sprint clicked');
    setShowSprintMenu(false);
  };

  const handleDeleteSprint = () => {
    alert('Delete Sprint clicked');
    setShowSprintMenu(false);
  };

  return (
    <div className="rounded-xl border border-[#E4E7EC] bg-[#F8F9FB] p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between border-b border-[#EAECF0] pb-4">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 rounded-md border-2 border-[#98A2B3] bg-transparent" />

          <button className="text-[#344054]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>

          <div className="flex items-center gap-3">
            <h2 className="text-[16px] font-semibold text-[#101828]">
              BANK Sprint 1
            </h2>
            <span className="text-[14px] text-[#667085]">
              6 Nov - 20 Nov ({tasks.length} work items)
            </span>
          </div>
        </div>

        <div className="relative flex items-center gap-4" ref={sprintMenuRef}>
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
            className="rounded-md border border-[#98A2B3] bg-[#DDEBF8] px-5 py-2 text-[14px] font-semibold text-[#101828] hover:bg-[#cfe3f6]"
          >
            Complete Sprint
          </button>

          <button
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

      <div className="space-y-4">
        {tasks.map((task, index) => (
          <BacklogRow
            key={task.id}
            index={index}
            title={task.title}
            assigneeId={task.assigneeId}
            assigneeName={task.assigneeName}
            assignees={teamMembers}
            storyPoints={task.storyPoints}
            status={task.status}
            startDate={task.startDate}
            endDate={task.endDate}
            onStatusChange={(newStatus) =>
              handleStatusChange(task.id, newStatus)
            }
            onStoryPointsChange={(newPoints) =>
              handleStoryPointsChange(task.id, newPoints)
            }
            onStartDateChange={(value) => handleStartDateChange(task.id, value)}
            onEndDateChange={(value) => handleEndDateChange(task.id, value)}
            onAssigneeChange={(value) => handleAssigneeChange(task.id, value)}
            onDelete={() => handleDeleteTask(task.id)}
          />
        ))}

        {!showCreateBox ? (
          <button
            onClick={() => setShowCreateBox(true)}
            className="flex items-center gap-2 pl-1 text-[16px] font-semibold text-[#667085] hover:text-[#344054]"
          >
            <span className="text-[28px] leading-none">+</span>
            <span>Create</span>
          </button>
        ) : (
          <div className="rounded-lg border border-[#D0D5DD] bg-white p-4">
            <input
              type="text"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full rounded-md border border-[#D0D5DD] px-3 py-2 text-sm text-[#101828] outline-none focus:border-[#84CAFF]"
              autoFocus
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
                  setShowCreateBox(false);
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
    </div>
  );
}