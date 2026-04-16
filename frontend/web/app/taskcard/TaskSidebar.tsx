'use client';
import React from 'react';
import StatusSection from './sidebar/StatusSection';
import AssigneeSection from './sidebar/AssigneeSection';
import MultiAssigneeSection from './sidebar/MultiAssigneeSection';
import MilestoneSection from './sidebar/MilestoneSection';
import PrioritySection from './sidebar/PrioritySection';
import StoryPointSection from './sidebar/StoryPointSection';
import DateSection from './sidebar/DateSection';
import RecurrenceSection from './sidebar/RecurrenceSection';
import CustomFieldsSection from './sidebar/CustomFieldsSection';
import SidebarField from './sidebar/SidebarField';
import { Check, ChevronDown, Plus } from 'lucide-react';

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
  reporterId?: number | null;
  labels: string[];
  labelIds?: number[];
  priority: string;
  sprint: string | null;
  sprintId?: number | null;
  storyPoint: number;
  milestoneId?: number | null;
  milestoneName?: string | null;
  assignees?: MultiAssignee[];
  recurrenceRule?: string | null;
  recurrenceEnd?: string | null;
  dates: {
    created: string;
    updated: string;
    dueDate: string | null;
    startDate?: string | null;
  };
  onUpdateStatus?: (status: string) => void;
  onUpdatePriority?: (priority: string) => void;
  onUpdateStoryPoint?: (storyPoint: number) => void;
  onUpdateDueDate?: (dueDate: string | null) => void;
  onUpdateStartDate?: (startDate: string | null) => void;
  onUpdateMilestone?: (milestoneId: number | null) => void;
  onUpdateRecurrence?: (rule: string | null, end: string | null) => void;
  onUpdateReporter?: (reporterId: number | null) => void;
  onUpdateSprint?: (sprintId: number | null) => void;
  onUpdateLabels?: (labelIds: number[]) => void;
  onUnassign?: () => void;
  onAssigneesChanged?: () => void;
  canEdit?: boolean;
  members?: Array<{ memberId: number; userId: number; name: string }>;
  allLabels?: Array<{ id: number; name: string }>;
  sprints?: Array<{ id: number; name: string }>;
}

const TaskSidebar: React.FC<TaskSidebarProps> = ({
  taskId, projectId, status, assignee, reporter, labels, labelIds = [], priority, sprint, storyPoint,
  milestoneId, milestoneName, assignees, recurrenceRule, recurrenceEnd, dates, reporterId, sprintId,
  onUpdateStatus, onUpdatePriority, onUpdateStoryPoint, onUpdateDueDate, onUpdateMilestone,
  onUpdateRecurrence, onUnassign, onAssigneesChanged, onUpdateReporter, onUpdateSprint, onUpdateLabels, onUpdateStartDate,
  canEdit = true, members = [], allLabels = [], sprints = [],
}) => {
  const [sections, setSections] = React.useState<Record<string, boolean>>({
    details: true,
    dates: true,
    customFields: true,
  });
  const [labelMenuOpen, setLabelMenuOpen] = React.useState(false);
  const [selectedLabelIds, setSelectedLabelIds] = React.useState<number[]>(labelIds);
  const labelMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setSelectedLabelIds((prev) => {
      if (prev.length === labelIds.length && prev.every((id, idx) => id === labelIds[idx])) {
        return prev;
      }
      return labelIds;
    });
  }, [labelIds]);

  React.useEffect(() => {
    if (typeof window === 'undefined' || taskId == null) return;
    const raw = window.localStorage.getItem(`planora:task-sidebar:${taskId}`);
    if (!raw) return;
    try {
      setSections((prev) => ({ ...prev, ...(JSON.parse(raw) as Record<string, boolean>) }));
    } catch {
      // ignore malformed preferences
    }
  }, [taskId]);

  const toggleSection = (key: string) => {
    const next = { ...sections, [key]: !sections[key] };
    setSections(next);
    if (typeof window !== 'undefined' && taskId != null) {
      window.localStorage.setItem(`planora:task-sidebar:${taskId}`, JSON.stringify(next));
    }
  };

  React.useEffect(() => {
    if (!labelMenuOpen) return;
    const handleOutside = (event: MouseEvent) => {
      if (labelMenuRef.current && !labelMenuRef.current.contains(event.target as Node)) {
        setLabelMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [labelMenuOpen]);

  const selectedLabels = allLabels.filter((label) => selectedLabelIds.includes(label.id));

  return (
    <div className="w-full md:w-80 bg-[#F7F8FA] border-t md:border-t-0 md:border-l border-[#EAECF0] flex-shrink-0 overflow-visible md:overflow-y-auto scrollbar-thin min-h-0">
      <div className="p-4 space-y-4">
      {!canEdit && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          You have view-only access for this task.
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
        <StatusSection status={status} onUpdateStatus={canEdit ? onUpdateStatus : undefined} />
        <PrioritySection priority={priority} onUpdatePriority={canEdit ? onUpdatePriority : undefined} />
      </div>
      <div className="border border-[#E5E7EB] rounded-xl bg-white shadow-sm overflow-hidden">
        <button onClick={() => toggleSection('details')} className="w-full px-4 py-2.5 border-b border-[#F2F4F7] text-[10px] font-bold text-[#6A7282] uppercase tracking-wider flex items-center justify-between">
          Details <ChevronDown size={14} className={`transition-transform ${sections.details ? '' : '-rotate-90'}`} />
        </button>
        {sections.details && <div className="p-4 space-y-4">
          {(!assignees || assignees.length === 0) && (
            <AssigneeSection assignee={assignee} onUnassign={onUnassign} />
          )}
          {taskId != null && (
            <MultiAssigneeSection
              taskId={taskId}
              projectId={projectId}
              assignees={assignees ?? []}
              onChanged={onAssigneesChanged ?? (() => {})}
              readOnly={!canEdit}
            />
          )}
          <SidebarField label="Reporter">
            <select
              value={reporterId ?? ''}
              onChange={(event) => onUpdateReporter?.(event.target.value ? Number(event.target.value) : null)}
              disabled={!canEdit}
              className="w-full text-sm border border-[#E5E7EB] rounded-lg px-2.5 h-9 bg-white disabled:bg-gray-100"
            >
              <option value="">{reporter ?? 'Select reporter'}</option>
              {members.map((member) => (
                <option key={member.memberId} value={member.memberId}>{member.name}</option>
              ))}
            </select>
          </SidebarField>
          <SidebarField label="Labels">
            <div className="space-y-2" ref={labelMenuRef}>
              <div className="flex flex-wrap gap-1.5 min-h-[24px]">
                {selectedLabels.length > 0 ? (
                  selectedLabels.map((label) => (
                    <span key={label.id} className="inline-flex items-center gap-1 rounded-full border border-[#D0D5DD] bg-[#F2F4F7] px-2 py-0.5 text-[11px] font-semibold text-[#475467]">
                      {label.name}
                    </span>
                  ))
                ) : labels.length > 0 ? (
                  labels.map((label) => (
                    <span key={label} className="inline-flex items-center rounded-full border border-[#D0D5DD] bg-[#F2F4F7] px-2 py-0.5 text-[11px] font-semibold text-[#475467]">
                      {label}
                    </span>
                  ))
                ) : (
                  <span className="text-[12px] text-[#98A2B3]">No labels selected</span>
                )}
              </div>
              {canEdit && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setLabelMenuOpen((prev) => !prev)}
                    className="w-full h-9 rounded-xl border border-[#D0D5DD] bg-white px-3 text-[12px] font-semibold text-[#344054] hover:bg-[#F9FAFB] flex items-center justify-between"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Plus size={12} />
                      {selectedLabelIds.length > 0 ? `Edit labels (${selectedLabelIds.length})` : 'Add labels'}
                    </span>
                    <ChevronDown size={13} className={`transition-transform ${labelMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {labelMenuOpen && (
                    <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-[#E4E7EC] bg-white shadow-xl p-1">
                      {allLabels.length === 0 ? (
                        <p className="px-2 py-2 text-[12px] text-[#98A2B3]">No labels available</p>
                      ) : (
                        allLabels.map((label) => {
                          const active = selectedLabelIds.includes(label.id);
                          return (
                            <button
                              key={label.id}
                              type="button"
                              onClick={() => {
                                const nextIds = active
                                  ? selectedLabelIds.filter((id) => id !== label.id)
                                  : [...selectedLabelIds, label.id];
                                setSelectedLabelIds(nextIds);
                                onUpdateLabels?.(nextIds);
                              }}
                              className="w-full rounded-lg px-2.5 py-2 text-left text-[12px] hover:bg-[#F9FAFB] flex items-center justify-between gap-2"
                            >
                              <span className={`${active ? 'font-semibold text-[#155DFC]' : 'text-[#344054]'}`}>{label.name}</span>
                              {active ? <Check size={13} className="text-[#155DFC]" /> : null}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </SidebarField>
          <SidebarField label="Sprint">
            <select
              value={sprintId ?? ''}
              onChange={(event) => onUpdateSprint?.(event.target.value ? Number(event.target.value) : null)}
              disabled={!canEdit}
              className="w-full text-sm border border-[#E5E7EB] rounded-lg px-2.5 h-9 bg-white disabled:bg-gray-100"
            >
              <option value="">{sprint ?? 'No sprint'}</option>
              {sprints.map((value) => (
                <option key={value.id} value={value.id}>{value.name}</option>
              ))}
            </select>
          </SidebarField>
          <MilestoneSection
            projectId={projectId}
            milestoneId={milestoneId}
            milestoneName={milestoneName}
            onUpdateMilestone={canEdit ? onUpdateMilestone : undefined}
          />
          <StoryPointSection storyPoint={storyPoint} onUpdateStoryPoint={canEdit ? onUpdateStoryPoint : undefined} />
          {onUpdateRecurrence && (
            <RecurrenceSection
              recurrenceRule={recurrenceRule}
              recurrenceEnd={recurrenceEnd}
              onUpdate={canEdit ? onUpdateRecurrence : () => {}}
            />
          )}
        </div>}
      </div>
      <div className="border rounded-md border-gray-200 bg-white shadow-sm">
        <button onClick={() => toggleSection('dates')} className="w-full px-4 py-3 border-b border-gray-100 font-semibold text-sm text-gray-700 flex items-center justify-between">
          Dates <ChevronDown size={14} className={`transition-transform ${sections.dates ? '' : '-rotate-90'}`} />
        </button>
        {sections.dates && <DateSection dates={dates} onUpdateDueDate={canEdit ? onUpdateDueDate : undefined} onUpdateStartDate={canEdit ? onUpdateStartDate : undefined} />}
      </div>
      {taskId != null && projectId != null && (
        <div className="border rounded-md border-gray-200 bg-white shadow-sm">
          <button onClick={() => toggleSection('customFields')} className="w-full px-4 py-3 border-b border-gray-100 font-semibold text-sm text-gray-700 flex items-center justify-between">
            Custom Fields <ChevronDown size={14} className={`transition-transform ${sections.customFields ? '' : '-rotate-90'}`} />
          </button>
          {sections.customFields && <div className="p-4"><CustomFieldsSection taskId={taskId} projectId={projectId} readOnly={!canEdit} /></div>}
        </div>
      )}
      <div className="text-[10px] text-[#9CA3AF] flex justify-between px-1 pb-2">
        <button className="hover:text-[#374151] transition-colors">Configure fields</button>
        <button className="hover:text-[#374151] transition-colors">Plain Text</button>
      </div>
      </div>
    </div>
  );
};

export default TaskSidebar;