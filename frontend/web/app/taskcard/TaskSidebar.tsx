'use client';
import React from 'react';
import StatusSection from './sidebar/StatusSection';
import AssigneeSection from './sidebar/AssigneeSection';
import ReporterSection from './sidebar/ReporterSection';
import LabelSection from './sidebar/LabelSection';
import SprintSection from './sidebar/SprintSection';
import MilestoneSection from './sidebar/MilestoneSection';
import PrioritySection from './sidebar/PrioritySection';
import StoryPointSection from './sidebar/StoryPointSection';
import DateSection from './sidebar/DateSection';

interface TaskSidebarProps {
  taskId?: number;
  projectId?: number;
  status: string;
  assignee: string | null;
  reporter: string | null;
  labels: string[];
  priority: string;
  sprint: string | null;
  storyPoint: number;
  milestoneId?: number | null;
  milestoneName?: string | null;
  dates: {
    created: string;
    updated: string;
    dueDate: string;
  };
  onUpdateStatus?: (status: string) => void;
  onUpdatePriority?: (priority: string) => void;
  onUpdateStoryPoint?: (storyPoint: number) => void;
  onUpdateDueDate?: (dueDate: string) => void;
  onUpdateMilestone?: (milestoneId: number | null) => void;
  onUnassign?: () => void;
}

const TaskSidebar: React.FC<TaskSidebarProps> = ({
  projectId, status, assignee, reporter, labels, priority, sprint, storyPoint,
  milestoneId, milestoneName, dates,
  onUpdateStatus, onUpdatePriority, onUpdateStoryPoint, onUpdateDueDate, onUpdateMilestone, onUnassign,
}) => (
  <div className="w-full md:w-80 bg-gray-50/50 p-5 overflow-y-auto border-t md:border-t-0 md:border-l border-gray-100 flex-shrink-0 scrollbar-thin min-h-0">
    <StatusSection status={status} onUpdateStatus={onUpdateStatus} />
    <div className="border rounded-md border-gray-200 bg-white mb-6 shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm text-gray-700">Details</div>
      <div className="p-4 space-y-5">
        <AssigneeSection assignee={assignee} onUnassign={onUnassign} />
        <ReporterSection reporter={reporter} />
        <LabelSection labels={labels} />
        <SprintSection sprint={sprint} />
        <MilestoneSection
          projectId={projectId}
          milestoneId={milestoneId}
          milestoneName={milestoneName}
          onUpdateMilestone={onUpdateMilestone}
        />
        <StoryPointSection storyPoint={storyPoint} onUpdateStoryPoint={onUpdateStoryPoint} />
        <PrioritySection priority={priority} onUpdatePriority={onUpdatePriority} />
      </div>
    </div>
    <DateSection dates={dates} onUpdateDueDate={onUpdateDueDate} />
    <div className="mt-8 text-xs text-gray-400 flex justify-between px-1">
      <button className="hover:text-gray-600">Configure fields</button>
      <button className="hover:text-gray-600">Plain Text</button>
    </div>
  </div>
);

export default TaskSidebar;