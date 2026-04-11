'use client';
import React from 'react';
import StatusSection from './sidebar/StatusSection';
import AssigneeSection from './sidebar/AssigneeSection';
import MultiAssigneeSection from './sidebar/MultiAssigneeSection';
import ReporterSection from './sidebar/ReporterSection';
import LabelSection from './sidebar/LabelSection';
import SprintSection from './sidebar/SprintSection';
import MilestoneSection from './sidebar/MilestoneSection';
import PrioritySection from './sidebar/PrioritySection';
import StoryPointSection from './sidebar/StoryPointSection';
import DateSection from './sidebar/DateSection';
import RecurrenceSection from './sidebar/RecurrenceSection';
import CustomFieldsSection from './sidebar/CustomFieldsSection';

interface MultiAssignee {
  memberId: number;
  userId: number;
  name: string;
  photoUrl: string | null;
}

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
  assignees?: MultiAssignee[];
  recurrenceRule?: string | null;
  recurrenceEnd?: string | null;
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
  onUpdateRecurrence?: (rule: string | null, end: string | null) => void;
  onUnassign?: () => void;
  onAssigneesChanged?: () => void;
}

const TaskSidebar: React.FC<TaskSidebarProps> = ({
  taskId, projectId, status, assignee, reporter, labels, priority, sprint, storyPoint,
  milestoneId, milestoneName, assignees, recurrenceRule, recurrenceEnd, dates,
  onUpdateStatus, onUpdatePriority, onUpdateStoryPoint, onUpdateDueDate, onUpdateMilestone,
  onUpdateRecurrence, onUnassign, onAssigneesChanged,
}) => (
  <div className="w-full md:w-72 bg-[#F7F8FA] border-t md:border-t-0 md:border-l border-[#EAECF0] flex-shrink-0 overflow-y-auto scrollbar-thin min-h-0">
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
        <StatusSection status={status} onUpdateStatus={onUpdateStatus} />
        <PrioritySection priority={priority} onUpdatePriority={onUpdatePriority} />
      </div>
      <div className="border border-[#E5E7EB] rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#F2F4F7] text-[10px] font-bold text-[#6A7282] uppercase tracking-wider">Details</div>
        <div className="p-4 space-y-4">
          {(!assignees || assignees.length === 0) && (
            <AssigneeSection assignee={assignee} onUnassign={onUnassign} />
          )}
          {taskId != null && (
            <MultiAssigneeSection
              taskId={taskId}
              projectId={projectId}
              assignees={assignees ?? []}
              onChanged={onAssigneesChanged ?? (() => {})}
            />
          )}
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
          {onUpdateRecurrence && (
            <RecurrenceSection
              recurrenceRule={recurrenceRule}
              recurrenceEnd={recurrenceEnd}
              onUpdate={onUpdateRecurrence}
            />
          )}
        </div>
      </div>
      <DateSection dates={dates} onUpdateDueDate={onUpdateDueDate} />
      {taskId != null && projectId != null && (
        <CustomFieldsSection taskId={taskId} projectId={projectId} />
      )}
      <div className="text-[10px] text-[#9CA3AF] flex justify-between px-1 pb-2">
        <button className="hover:text-[#374151] transition-colors">Configure fields</button>
        <button className="hover:text-[#374151] transition-colors">Plain Text</button>
      </div>
    </div>
  </div>
);

export default TaskSidebar;