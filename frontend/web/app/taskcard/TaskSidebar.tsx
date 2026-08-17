'use client';
import React from 'react';
import Link from 'next/link';
import StatusSection from './sidebar/StatusSection';
import AssigneeSection from './sidebar/AssigneeSection';
import MultiAssigneeSection from './sidebar/MultiAssigneeSection';
import MilestoneSection from './sidebar/MilestoneSection';
import PrioritySection from './sidebar/PrioritySection';
import StoryPointSection from './sidebar/StoryPointSection';
import DateSection from './sidebar/DateSection';
import RecurrenceSection from './sidebar/RecurrenceSection';
import TaskGitHubSection from './sidebar/TaskGitHubSection';
import SidebarField from './sidebar/SidebarField';
import CustomFieldsSection from './sidebar/CustomFieldsSection';
import { Check, ChevronDown, Edit2, Link2, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import GitHubIssueBadge from '@/components/github/GitHubIssueBadge';
import GitHubMark from '@/components/github/GitHubMark';
import { projectsApi } from '@/services/projects-contract';
import type { ProjectGitHubConnection } from '@/services/github-service';
import { labelChipStyle } from './components/taskUi';

interface MultiAssignee {
  memberId: number;
  userId: number;
  name: string;
  photoUrl: string | null;
}

interface ProjectCustomField {
  id: number;
  name: string;
  fieldType: string;
  options?: string[];
}

interface TaskSidebarProps {
  taskId?: number;
  projectId?: number;
  taskTitle?: string;
  taskDescription?: string;
  status: string;
  assignee: string | null;
  assigneePhotoUrl?: string | null;
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
  githubIssueNumber?: number | null;
  githubRepoFullName?: string | null;
  projectGitHubRepo?: ProjectGitHubConnection | null;
  assignees?: MultiAssignee[];
  recurrenceRule?: string | null;
  recurrenceEnd?: string | null;
  customInterval?: number | null;
  recurrenceLimit?: number | null;
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
  onUpdateRecurrence?: (rule: string | null, end: string | null, customInterval: number | null, recurrenceLimit: number | null) => void;
  onUpdateReporter?: (reporterId: number | null) => void;
  onUpdateSprint?: (sprintId: number | null) => void;
  onUpdateLabels?: (labelIds: number[]) => void;
  onCreateLabel?: (name: string, color: string) => Promise<{ id: number; name: string; color?: string | null } | null>;
  onUpdateLabel?: (id: number, name: string, color: string) => Promise<{ id: number; name: string; color?: string | null } | null>;
  onDeleteLabel?: (id: number) => Promise<boolean>;
  onUnassign?: () => void;
  onAssigneesChanged?: () => void;
  canEdit?: boolean;
  canChangeReporter?: boolean;
  members?: Array<{ memberId: number; userId: number; name: string; photoUrl?: string | null }>;
  allLabels?: Array<{ id: number; name: string; color?: string | null }>;
  sprints?: Array<{ id: number; name: string }>;
  onCreateGitHubIssue?: () => void;
}

const LABEL_PALETTE = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16',
  '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6',
  '#6366F1', '#8B5CF6', '#EC4899', '#6B7280',
];

const TaskSidebar: React.FC<TaskSidebarProps> = ({
  taskId, projectId, taskTitle, taskDescription, status, assignee, assigneePhotoUrl, reporter, labels, labelIds = [], priority, sprint, storyPoint,
  milestoneId, milestoneName, githubIssueNumber = null, githubRepoFullName = null, projectGitHubRepo = null, assignees,
  recurrenceRule, recurrenceEnd, customInterval, recurrenceLimit, dates, reporterId, sprintId,
  onUpdateStatus, onUpdatePriority, onUpdateStoryPoint, onUpdateDueDate, onUpdateMilestone,
  onUpdateRecurrence, onUnassign, onAssigneesChanged, onUpdateReporter, onUpdateSprint, onUpdateLabels, onUpdateStartDate,
  onCreateLabel, onUpdateLabel, onDeleteLabel,
  canEdit = true, canChangeReporter = false, members = [], allLabels = [], sprints = [], onCreateGitHubIssue,
}) => {
  const [sections, setSections] = React.useState<Record<string, boolean>>({
    details: true,
    dates: true,
    github: true,
  });
  const [labelMenuOpen, setLabelMenuOpen] = React.useState(false);
  const [selectedLabelIds, setSelectedLabelIds] = React.useState<number[]>(labelIds);
  const labelMenuRef = React.useRef<HTMLDivElement>(null);
  const [projectCustomFields, setProjectCustomFields] = React.useState<ProjectCustomField[]>([]);

  // Search, Create, Edit & Delete label states inside sidebar
  const [labelSearch, setLabelSearch] = React.useState('');
  const [newLabelColor, setNewLabelColor] = React.useState(LABEL_PALETTE[0]);
  const [showColorPicker, setShowColorPicker] = React.useState(false);
  const [isCreatingLabel, setIsCreatingLabel] = React.useState(false);

  const [editingLabelId, setEditingLabelId] = React.useState<number | null>(null);
  const [editLabelName, setEditLabelName] = React.useState('');
  const [editLabelColor, setEditLabelColor] = React.useState(LABEL_PALETTE[0]);
  const [isSavingEdit, setIsSavingEdit] = React.useState(false);

  const [deletingLabelId, setDeletingLabelId] = React.useState<number | null>(null);
  const [isDeletingLabel, setIsDeletingLabel] = React.useState(false);

  React.useEffect(() => {
    if (projectId == null) return;
    let active = true;
    projectsApi.getCustomFields(projectId)
      .then((res) => {
        if (active) {
          setProjectCustomFields(res || []);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [projectId]);

  React.useEffect(() => {
    queueMicrotask(() => setSelectedLabelIds((prev) => {
      if (prev.length === labelIds.length && prev.every((id, idx) => id === labelIds[idx])) {
        return prev;
      }
      return labelIds;
    }));
  }, [labelIds]);

  React.useEffect(() => {
    if (typeof window === 'undefined' || taskId == null) return;
    const raw = window.localStorage.getItem(`planora:task-sidebar:${taskId}`);
    if (!raw) return;
    try {
      // Restore per-task collapsed/expanded sidebar preferences set in a previous session
      queueMicrotask(() => setSections((prev) => ({
        ...prev,
        ...(JSON.parse(raw) as Record<string, boolean>),
      })));
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
    // Document-level listener rather than onBlur so clicks on other interactive
    // elements also close the label dropdown without requiring focus management.
    const handleOutside = (event: MouseEvent) => {
      if (labelMenuRef.current && !labelMenuRef.current.contains(event.target as Node)) {
        setLabelMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [labelMenuOpen]);

  const selectedLabels = allLabels.filter((label) => selectedLabelIds.includes(label.id));
  const connectedRepoFullName = githubRepoFullName || projectGitHubRepo?.repoFullName || null;
  const githubIssueUrl = githubIssueNumber && connectedRepoFullName
    ? `https://github.com/${connectedRepoFullName}/issues/${githubIssueNumber}`
    : null;

  return (
    <div className="w-full md:w-[340px] bg-cu-bg-secondary border-t md:border-t-0 md:border-l border-cu-border flex-shrink-0 overflow-visible md:overflow-y-auto scrollbar-thin min-h-0">
      <div className="p-3.5 sm:p-4 space-y-4">
      {!canEdit && (
        <div className="rounded-lg border border-cu-warning/20 bg-cu-warning/10 px-3 py-2 text-xs text-cu-warning">
          You have view-only access for this task.
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
        <StatusSection projectId={projectId} status={status} onUpdateStatus={canEdit ? onUpdateStatus : undefined} />
        <PrioritySection priority={priority} onUpdatePriority={canEdit ? onUpdatePriority : undefined} />
      </div>
      <div className="border border-cu-border rounded-xl bg-cu-bg shadow-cu-sm overflow-hidden">
        <button onClick={() => toggleSection('details')} className="w-full px-4 py-2.5 border-b border-cu-border text-[10px] font-bold text-cu-text-muted uppercase tracking-wider flex items-center justify-between bg-cu-bg/90">
          Properties <ChevronDown size={14} className={`transition-transform ${sections.details ? '' : '-rotate-90'}`} />
        </button>
        {sections.details && <div className="p-4 space-y-4">
          {(!assignees || assignees.length === 0) && (
            <AssigneeSection assignee={assignee} profilePicUrl={assigneePhotoUrl} onUnassign={onUnassign} />
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
              disabled={!canChangeReporter}
              className="w-full text-sm border border-cu-border rounded-lg px-2.5 h-9 bg-cu-bg text-cu-text-primary disabled:bg-cu-bg-secondary disabled:cursor-not-allowed"
            >
              <option value="">{reporter ?? 'Select reporter'}</option>
              {members.map((member) => (
                <option key={member.memberId} value={member.userId}>{member.name}</option>
              ))}
            </select>
          </SidebarField>
          <SidebarField label="Labels">
            <div className="space-y-2" ref={labelMenuRef}>
              <div className="flex flex-wrap gap-1.5 min-h-[24px]">
                {selectedLabels.length > 0 ? (
                  selectedLabels.map((label) => (
                    <span
                      key={label.id}
                      style={labelChipStyle(label.color)}
                      className="inline-flex items-center gap-1 rounded-full border border-cu-border bg-cu-bg-secondary px-2 py-0.5 text-[11px] font-semibold text-cu-text-secondary"
                    >
                      {label.name}
                    </span>
                  ))
                ) : labels.length > 0 ? (
                  labels.map((label) => (
                    <span key={label} className="inline-flex items-center rounded-full border border-cu-border bg-cu-bg-secondary px-2 py-0.5 text-[11px] font-semibold text-cu-text-secondary">
                      {label}
                    </span>
                  ))
                ) : (
                  <span className="text-[12px] text-cu-text-muted">No labels selected</span>
                )}
              </div>
              {canEdit && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setLabelMenuOpen((prev) => !prev);
                      setEditingLabelId(null);
                      setDeletingLabelId(null);
                      setShowColorPicker(false);
                    }}
                    className="w-full h-9 rounded-xl border border-cu-border bg-cu-bg px-3 text-[12px] font-semibold text-cu-text-primary hover:bg-cu-hover flex items-center justify-between"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Plus size={12} />
                      {selectedLabelIds.length > 0 ? `Manage labels (${selectedLabelIds.length})` : 'Add labels'}
                    </span>
                    <ChevronDown size={13} className={`transition-transform ${labelMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {labelMenuOpen && (
                    <div className="absolute z-50 mt-1 w-full max-h-72 overflow-y-auto rounded-xl border border-cu-border bg-cu-bg shadow-cu-xl p-1.5 space-y-1.5 animate-in fade-in zoom-in-95 duration-100">
                      {/* Search / Quick Create Input */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 bg-cu-bg-secondary/60 border border-cu-border rounded-lg px-2 py-1 focus-within:border-cu-primary focus-within:ring-1 focus-within:ring-cu-primary/20 transition-all">
                          <Search size={12} className="text-cu-text-muted shrink-0" />
                          <input
                            type="text"
                            value={labelSearch}
                            onChange={(e) => setLabelSearch(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const trimmed = labelSearch.trim();
                                if (trimmed && !allLabels.some((l) => l.name.toLowerCase() === trimmed.toLowerCase())) {
                                  if (onCreateLabel) {
                                    setIsCreatingLabel(true);
                                    onCreateLabel(trimmed, newLabelColor)
                                      .then((created) => {
                                        if (created) {
                                          const next = [...selectedLabelIds, created.id];
                                          setSelectedLabelIds(next);
                                          onUpdateLabels?.(next);
                                          setLabelSearch('');
                                          setShowColorPicker(false);
                                        }
                                      })
                                      .finally(() => setIsCreatingLabel(false));
                                  }
                                }
                              }
                            }}
                            placeholder="Search or new label…"
                            className="flex-1 text-[11px] bg-transparent outline-none text-cu-text-primary placeholder:text-cu-text-muted min-w-0"
                          />
                          {/* Color swatch trigger */}
                          <button
                            type="button"
                            onClick={() => setShowColorPicker((p) => !p)}
                            title="Pick color"
                            className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0 hover:scale-110 transition-transform shadow-xs"
                            style={{ backgroundColor: newLabelColor }}
                          />
                          {labelSearch.trim() && !allLabels.some((l) => l.name.toLowerCase() === labelSearch.trim().toLowerCase()) && onCreateLabel && (
                            <button
                              type="button"
                              onClick={() => {
                                const trimmed = labelSearch.trim();
                                if (!trimmed) return;
                                setIsCreatingLabel(true);
                                onCreateLabel(trimmed, newLabelColor)
                                  .then((created) => {
                                    if (created) {
                                      const next = [...selectedLabelIds, created.id];
                                      setSelectedLabelIds(next);
                                      onUpdateLabels?.(next);
                                      setLabelSearch('');
                                      setShowColorPicker(false);
                                    }
                                  })
                                  .finally(() => setIsCreatingLabel(false));
                              }}
                              disabled={isCreatingLabel}
                              title="Create label"
                              className="p-1 rounded bg-cu-primary text-white hover:bg-cu-primary/90 disabled:opacity-50 transition-colors shrink-0"
                            >
                              {isCreatingLabel ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                            </button>
                          )}
                        </div>

                        {/* Color palette selector */}
                        {showColorPicker && (
                          <div className="p-1 bg-cu-bg-secondary border border-cu-border rounded-lg shadow-xs">
                            <div className="flex flex-wrap gap-1">
                              {LABEL_PALETTE.map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => {
                                    setNewLabelColor(c);
                                    setShowColorPicker(false);
                                  }}
                                  className={`w-4 h-4 rounded-full transition-transform hover:scale-110 ${
                                    newLabelColor === c ? 'ring-2 ring-offset-1 ring-cu-primary scale-110' : ''
                                  }`}
                                  style={{ backgroundColor: c }}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Labels List */}
                      <div className="divide-y divide-cu-border/40 max-h-48 overflow-y-auto">
                        {(() => {
                          const term = labelSearch.toLowerCase().trim();
                          const filtered = term
                            ? allLabels.filter((l) => l.name.toLowerCase().includes(term))
                            : allLabels;

                          if (filtered.length === 0) {
                            return (
                              <p className="px-2 py-3 text-[11px] text-center text-cu-text-muted">
                                {term ? `No labels matching "${labelSearch}"` : 'No labels available'}
                              </p>
                            );
                          }

                          return filtered.map((label) => {
                            const active = selectedLabelIds.includes(label.id);
                            const isEditing = editingLabelId === label.id;
                            const isDeleting = deletingLabelId === label.id;

                            // Inline Edit
                            if (isEditing) {
                              return (
                                <div key={label.id} className="p-1.5 bg-cu-primary/10 rounded-lg space-y-1.5 my-0.5 border border-cu-primary/30">
                                  <div className="flex items-center gap-1">
                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: editLabelColor }} />
                                    <input
                                      autoFocus
                                      type="text"
                                      value={editLabelName}
                                      onChange={(e) => setEditLabelName(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          if (onUpdateLabel && editLabelName.trim()) {
                                            setIsSavingEdit(true);
                                            onUpdateLabel(label.id, editLabelName.trim(), editLabelColor)
                                              .then(() => setEditingLabelId(null))
                                              .finally(() => setIsSavingEdit(false));
                                          }
                                        }
                                        if (e.key === 'Escape') setEditingLabelId(null);
                                      }}
                                      className="flex-1 text-[11px] px-1.5 py-0.5 bg-cu-bg border border-cu-border rounded outline-none focus:border-cu-primary text-cu-text-primary"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (onUpdateLabel && editLabelName.trim()) {
                                          setIsSavingEdit(true);
                                          onUpdateLabel(label.id, editLabelName.trim(), editLabelColor)
                                            .then(() => setEditingLabelId(null))
                                            .finally(() => setIsSavingEdit(false));
                                        }
                                      }}
                                      disabled={!editLabelName.trim() || isSavingEdit}
                                      className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                                      title="Save"
                                    >
                                      {isSavingEdit ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingLabelId(null)}
                                      className="p-1 rounded bg-cu-bg-secondary text-cu-text-secondary hover:bg-cu-hover"
                                      title="Cancel"
                                    >
                                      <X size={11} />
                                    </button>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {LABEL_PALETTE.map((c) => (
                                      <button
                                        key={c}
                                        type="button"
                                        onClick={() => setEditLabelColor(c)}
                                        className={`w-3.5 h-3.5 rounded-full transition-transform hover:scale-110 ${
                                          editLabelColor === c ? 'ring-2 ring-offset-1 ring-cu-primary scale-110' : ''
                                        }`}
                                        style={{ backgroundColor: c }}
                                      />
                                    ))}
                                  </div>
                                </div>
                              );
                            }

                            // Inline Delete Confirmation
                            if (isDeleting) {
                              return (
                                <div key={label.id} className="p-1.5 bg-red-500/10 rounded-lg flex items-center justify-between gap-1.5 my-0.5 border border-red-500/30">
                                  <span className="text-[11px] font-medium text-red-500 truncate">
                                    Delete &quot;{label.name}&quot;?
                                  </span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (onDeleteLabel) {
                                          setIsDeletingLabel(true);
                                          onDeleteLabel(label.id)
                                            .then((success) => {
                                              if (success) {
                                                const next = selectedLabelIds.filter((id) => id !== label.id);
                                                setSelectedLabelIds(next);
                                                onUpdateLabels?.(next);
                                                setDeletingLabelId(null);
                                              }
                                            })
                                            .finally(() => setIsDeletingLabel(false));
                                        }
                                      }}
                                      disabled={isDeletingLabel}
                                      className="px-2 py-0.5 text-[10px] font-semibold bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                                    >
                                      {isDeletingLabel ? <Loader2 size={10} className="animate-spin" /> : 'Delete'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDeletingLabelId(null)}
                                      className="px-2 py-0.5 text-[10px] bg-cu-bg-secondary text-cu-text-secondary rounded hover:bg-cu-hover"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              );
                            }

                            // Normal Item
                            return (
                              <div
                                key={label.id}
                                className={`group flex items-center justify-between gap-1 px-2 py-1 rounded-lg hover:bg-cu-hover transition-colors ${
                                  active ? 'bg-cu-primary/10' : ''
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextIds = active
                                      ? selectedLabelIds.filter((id) => id !== label.id)
                                      : [...selectedLabelIds, label.id];
                                    setSelectedLabelIds(nextIds);
                                    onUpdateLabels?.(nextIds);
                                  }}
                                  className="flex-1 flex items-center gap-2 text-left min-w-0 py-0.5"
                                >
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: label.color || '#6366F1' }}
                                  />
                                  <span
                                    className={`text-[12px] truncate ${
                                      active ? 'font-semibold text-cu-primary' : 'text-cu-text-primary'
                                    }`}
                                  >
                                    {label.name}
                                  </span>
                                </button>
                                <div className="flex items-center gap-0.5 shrink-0">
                                  {active && <Check size={13} className="text-cu-primary mr-1" />}
                                  {onUpdateLabel && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingLabelId(label.id);
                                        setEditLabelName(label.name);
                                        setEditLabelColor(label.color || LABEL_PALETTE[0]);
                                        setDeletingLabelId(null);
                                      }}
                                      title="Edit label"
                                      className="p-1 text-cu-text-muted hover:text-cu-primary hover:bg-cu-bg rounded opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
                                    >
                                      <Edit2 size={11} />
                                    </button>
                                  )}
                                  {onDeleteLabel && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeletingLabelId(label.id);
                                        setEditingLabelId(null);
                                      }}
                                      title="Delete label"
                                      className="p-1 text-cu-text-muted hover:text-red-500 hover:bg-cu-bg rounded opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </SidebarField>
          {projectCustomFields.length > 0 && taskId != null && projectId != null && (
            <CustomFieldsSection
              taskId={taskId}
              projectId={projectId}
              canEdit={canEdit}
            />
          )}
          <SidebarField label="Sprint">
            <select
              value={sprintId ?? ''}
              onChange={(event) => onUpdateSprint?.(event.target.value ? Number(event.target.value) : null)}
              disabled={!canEdit}
              className="w-full text-sm border border-cu-border rounded-lg px-2.5 h-9 bg-cu-bg text-cu-text-primary disabled:bg-cu-bg-secondary"
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
              customInterval={customInterval}
              recurrenceLimit={recurrenceLimit}
              onUpdate={canEdit ? onUpdateRecurrence : () => {}}
            />
          )}
        </div>}
      </div>
      <div className="border border-cu-border rounded-xl bg-cu-bg shadow-cu-sm overflow-hidden">
        <button onClick={() => toggleSection('dates')} className="w-full px-4 py-2.5 border-b border-cu-border text-[10px] font-bold text-cu-text-muted uppercase tracking-wider flex items-center justify-between bg-cu-bg/90">
          Schedule <ChevronDown size={14} className={`transition-transform ${sections.dates ? '' : '-rotate-90'}`} />
        </button>
        {sections.dates && <DateSection dates={dates} onUpdateDueDate={canEdit ? onUpdateDueDate : undefined} onUpdateStartDate={canEdit ? onUpdateStartDate : undefined} />}
      </div>
      {taskId != null && (
        <TaskGitHubSection
          taskId={taskId}
          projectId={projectId}
          taskTitle={taskTitle || `Task #${taskId}`}
          taskDescription={taskDescription}
          taskLabels={labels}
        />
      )}
      <div className="border border-cu-border rounded-xl bg-cu-bg shadow-cu-sm overflow-hidden">
        <button onClick={() => toggleSection('github')} className="w-full px-4 py-2.5 border-b border-cu-border text-[10px] font-bold text-cu-text-muted uppercase tracking-wider flex items-center justify-between bg-cu-bg/90">
          GitHub <ChevronDown size={14} className={`transition-transform ${sections.github ? '' : '-rotate-90'}`} />
        </button>
        {sections.github && (
          <div className="p-4 space-y-3">
            {githubIssueNumber ? (
              <div className="space-y-2">
                <GitHubIssueBadge
                  issueNumber={githubIssueNumber}
                  repoFullName={connectedRepoFullName || 'github.com'}
                  size="sm"
                  linkToGitHub={Boolean(githubIssueUrl)}
                />
                {githubIssueUrl && (
                  <Link
                    href={githubIssueUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm font-semibold text-cu-primary hover:underline"
                  >
                    <Link2 size={12} />
                    View on GitHub
                  </Link>
                )}
              </div>
            ) : projectGitHubRepo ? (
              <button
                type="button"
                onClick={onCreateGitHubIssue}
                className="inline-flex items-center gap-2 rounded-xl border border-cu-border bg-cu-bg px-3 py-2 text-sm font-semibold text-cu-text-primary hover:bg-cu-hover transition-colors"
              >
                <GitHubMark size={14} className="text-cu-text-primary" />
                Create GitHub Issue
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-cu-text-secondary">Connect a GitHub repo first</p>
                {projectId != null && (
                  <Link href={`/github/${projectId}`} className="flex items-center gap-1 text-sm font-semibold text-cu-primary hover:underline">
                    <Link2 size={12} />
                    Go to GitHub tab
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="text-[10px] text-cu-text-muted flex justify-between px-1 pb-2">
        <button className="hover:text-cu-text-primary transition-colors">Configure fields</button>
        <button className="hover:text-cu-text-primary transition-colors">Plain Text</button>
      </div>
      </div>
    </div>
  );
};

export default TaskSidebar
