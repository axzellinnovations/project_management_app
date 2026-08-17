'use client';

import React, { useRef } from 'react';
import {
  CalendarDays,
  Check,
  ChevronDown,
  Loader2,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Target,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { hexToLabelStyle } from '@/components/shared/LabelPicker';
import { AvatarStack } from '@/components/ui/Avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import type { Label, MilestoneResponse, Task } from '@/types';
import {
  LIST_GRID_CLASS,
  PRIORITY_CONFIG,
  PRIORITY_ORDER,
  STATUS_CONFIG,
  STATUS_ORDER,
  formatPriorityLabel,
  formatStatusLabel,
  normalizeStatus,
} from '../lib/list-config';
import { resolveProfilePhotoUrl } from '@/lib/profile-photo';

export type ListProjectStatus = { name: string; status: string; color: string };

const LABEL_PALETTE = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16',
  '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6',
  '#6366F1', '#8B5CF6', '#EC4899', '#6B7280',
];

export interface TaskRowProps {
  task: Task;
  onOpenModal: (id: number) => void;
  onStatusChange: (id: number, status: string) => void;
  onDelete: (id: number) => void;
  members: Array<{ id: number; name: string; photoUrl?: string | null }>;
  availableLabels: Label[];
  onCreateLabel?: (name: string, color: string) => Promise<Label | null>;
  onUpdateLabel?: (id: number, name: string, color: string) => Promise<Label | null>;
  onDeleteLabel?: (id: number) => Promise<boolean>;
  milestones: MilestoneResponse[];
  onDueDateChange: (taskId: number, dueDate: string | null) => void;
  onAssigneesChange: (taskId: number, assigneeIds: number[]) => void;
  onToggleLabel: (taskId: number, label: Label, shouldAttach: boolean) => void;
  onMilestoneChange: (taskId: number, milestoneId: number | null) => void;
  selected?: boolean;
  onToggleSelect?: (taskId: number) => void;
  projectStatuses?: ListProjectStatus[];
  canModifyTasks?: boolean;
  onPriorityChange?: (taskId: number, priority: string) => void;
}

const priorityClasses: Record<string, string> = {
  URGENT: 'bg-red-500/10 text-red-500 border-red-500/20',
  HIGH: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  MEDIUM: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  LOW: 'bg-green-500/10 text-green-500 border-green-500/20',
};

const mobileIconButtonClass =
  'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-cu-md border border-cu-border bg-cu-bg-secondary text-cu-text-secondary transition-colors hover:bg-cu-hover hover:text-cu-text-primary';

function StatusDot({ status }: { status?: string | null }) {
  const safeStatus = normalizeStatus(status);
  const color =
    safeStatus === 'DONE' ? 'bg-cu-success'
    : safeStatus === 'IN_REVIEW' ? 'bg-amber-500'
    : safeStatus === 'IN_PROGRESS' ? 'bg-cu-primary'
    : 'bg-cu-text-muted';
  return <span className={`h-2 w-2 rounded-full ${color}`} />;
}

function getAssignedUsers(task: Task) {
  const assigneePhotoUrl = resolveProfilePhotoUrl(task.assigneePhotoUrl, task.assigneeId);
  if (task.assignees?.length) {
    return task.assignees.map((person) => ({
      name: person.name,
      src: resolveProfilePhotoUrl(person.avatar ?? person.profilePicUrl, person.id),
    }));
  }
  return task.assigneeName && task.assigneeName !== 'Unassigned'
    ? [{ name: task.assigneeName, src: assigneePhotoUrl }]
    : [];
}

function isTaskBlocked(task: Task) {
  return task.dependencies?.some((dependency) => dependency.relation === 'BLOCKED_BY' && dependency.status !== 'DONE') ?? false;
}

function isTaskOverdue(task: Task) {
  return Boolean(
    task.dueDate &&
    task.status !== 'DONE' &&
    new Date(`${task.dueDate}T00:00:00`) < new Date(new Date().toDateString()),
  );
}

function getDueDateTone(task: Task) {
  if (!task.dueDate || task.status === 'DONE') return 'neutral';
  const due = new Date(`${task.dueDate}T00:00:00`);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (diffDays <= 0) return 'danger';
  if (diffDays <= 5) return 'warning';
  return 'neutral';
}

function formatDueDate(dueDate?: string) {
  return dueDate
    ? new Date(`${dueDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : 'Set date';
}

function StopPropagation({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={className} onClick={(event) => event.stopPropagation()}>
      {children}
    </div>
  );
}

function SelectionCell({ task, selected, onToggleSelect }: TaskRowProps) {
  return (
    <StopPropagation className="flex items-center justify-center">
      <input
        type="checkbox"
        checked={Boolean(selected)}
        onChange={() => onToggleSelect?.(task.id)}
        className="h-4 w-4 rounded border-cu-border accent-cu-primary"
        aria-label={`Select ${task.title}`}
      />
    </StopPropagation>
  );
}

function PriorityControl({ task, onPriorityChange }: Pick<TaskRowProps, 'task' | 'onPriorityChange'>) {
  const priority = task.priority ?? '';
  const config = priority ? PRIORITY_CONFIG[priority] : null;
  const Icon = config?.icon ?? Plus;

  return (
    <StopPropagation>
      <DropdownMenu>
        <DropdownMenuTrigger className={`inline-flex h-7 max-w-full items-center gap-1.5 rounded-cu-md border px-2 text-[11px] font-bold ${priorityClasses[priority] ?? 'border-cu-border bg-cu-bg-secondary text-cu-text-secondary'}`}>
          <Icon size={12} className="shrink-0" />
          <span className="truncate">{formatPriorityLabel(priority)}</span>
          <ChevronDown size={11} className="shrink-0 opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[140px]">
          {PRIORITY_ORDER.map((value) => {
            const itemConfig = PRIORITY_CONFIG[value];
            const ItemIcon = itemConfig.icon;
            return (
              <DropdownMenuItem
                key={value}
                onSelect={() => onPriorityChange?.(task.id, value)}
                className="min-h-9 justify-between text-[12px] font-semibold"
              >
                <span className="flex items-center gap-2" style={{ color: itemConfig.color }}>
                  <ItemIcon size={13} />
                  {itemConfig.label}
                </span>
                {priority === value && <Check size={13} className="text-cu-primary" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </StopPropagation>
  );
}

function LabelDropdownList({
  task,
  availableLabels,
  onToggleLabel,
  onCreateLabel,
  onUpdateLabel,
  onDeleteLabel,
}: Pick<TaskRowProps, 'task' | 'availableLabels' | 'onToggleLabel' | 'onCreateLabel' | 'onUpdateLabel' | 'onDeleteLabel'>) {
  const [labelInput, setLabelInput] = React.useState('');
  const [newLabelColor, setNewLabelColor] = React.useState(LABEL_PALETTE[0]);
  const [showColorPicker, setShowColorPicker] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);

  const [editingLabelId, setEditingLabelId] = React.useState<number | null>(null);
  const [editLabelName, setEditLabelName] = React.useState('');
  const [editLabelColor, setEditLabelColor] = React.useState(LABEL_PALETTE[0]);
  const [isSavingEdit, setIsSavingEdit] = React.useState(false);

  const [deletingLabelId, setDeletingLabelId] = React.useState<number | null>(null);
  const [isDeletingLabel, setIsDeletingLabel] = React.useState(false);

  const handleCreate = async () => {
    const trimmed = labelInput.trim();
    if (!trimmed || !onCreateLabel || isCreating) return;
    setIsCreating(true);
    try {
      const created = await onCreateLabel(trimmed, newLabelColor);
      if (created) {
        onToggleLabel(task.id, created, true);
        setLabelInput('');
        setShowColorPicker(false);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const filteredLabels = React.useMemo(() => {
    const term = labelInput.toLowerCase().trim();
    if (!term) return availableLabels;
    return availableLabels.filter((l) => l.name.toLowerCase().includes(term));
  }, [availableLabels, labelInput]);

  return (
    <div className="p-1 space-y-1 w-64 max-h-72 overflow-y-auto">
      {/* Search / Create Bar */}
      <div className="p-1.5 bg-cu-bg-secondary/50 rounded-lg space-y-1">
        <div className="flex items-center gap-1.5 bg-cu-bg border border-cu-border rounded-md px-2 py-1 focus-within:border-cu-primary">
          <Search size={12} className="text-cu-text-muted shrink-0" />
          <input
            type="text"
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleCreate();
              }
            }}
            placeholder="Search or create…"
            className="flex-1 text-[11px] bg-transparent outline-none text-cu-text-primary placeholder:text-cu-text-muted min-w-0"
          />
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowColorPicker((p) => !p);
            }}
            className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0 hover:scale-110 transition-transform"
            style={{ backgroundColor: newLabelColor }}
            title="Choose color"
          />
          {labelInput.trim() && !availableLabels.some((l) => l.name.toLowerCase() === labelInput.trim().toLowerCase()) && onCreateLabel && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void handleCreate();
              }}
              disabled={isCreating}
              className="p-0.5 rounded bg-cu-primary text-white hover:bg-cu-primary/90 disabled:opacity-50"
              title="Create"
            >
              {isCreating ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
            </button>
          )}
        </div>
        {showColorPicker && (
          <div className="flex flex-wrap gap-1 p-1 bg-cu-bg rounded border border-cu-border">
            {LABEL_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setNewLabelColor(c);
                  setShowColorPicker(false);
                }}
                className={`w-3.5 h-3.5 rounded-full transition-transform ${
                  newLabelColor === c ? 'ring-2 ring-offset-1 ring-cu-primary scale-110' : ''
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}
      </div>

      {/* List */}
      <div className="divide-y divide-cu-border/30">
        {filteredLabels.length === 0 ? (
          <div className="px-2.5 py-3 text-[11px] text-center text-cu-text-muted">
            {labelInput.trim() ? `No labels matching "${labelInput}"` : 'No labels yet'}
          </div>
        ) : (
          filteredLabels.map((label) => {
            const attached = Boolean(task.labels?.some((item) => item.id === label.id));
            const isEditing = editingLabelId === label.id;
            const isDeleting = deletingLabelId === label.id;

            if (isEditing) {
              return (
                <div key={label.id} className="p-1.5 bg-cu-primary/10 rounded-md space-y-1 my-0.5" onClick={(e) => e.stopPropagation()}>
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
                            void onUpdateLabel(label.id, editLabelName.trim(), editLabelColor)
                              .then(() => setEditingLabelId(null))
                              .finally(() => setIsSavingEdit(false));
                          }
                        }
                        if (e.key === 'Escape') setEditingLabelId(null);
                      }}
                      className="flex-1 text-[11px] px-1 py-0.5 bg-cu-bg border border-cu-border rounded outline-none text-cu-text-primary min-w-0"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onUpdateLabel && editLabelName.trim()) {
                          setIsSavingEdit(true);
                          void onUpdateLabel(label.id, editLabelName.trim(), editLabelColor)
                            .then(() => setEditingLabelId(null))
                            .finally(() => setIsSavingEdit(false));
                        }
                      }}
                      disabled={!editLabelName.trim() || isSavingEdit}
                      className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                      title="Save"
                    >
                      <Check size={10} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingLabelId(null);
                      }}
                      className="p-1 rounded bg-cu-bg-secondary text-cu-text-secondary hover:bg-cu-hover"
                      title="Cancel"
                    >
                      <X size={10} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {LABEL_PALETTE.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditLabelColor(c);
                        }}
                        className={`w-3 h-3 rounded-full transition-transform ${
                          editLabelColor === c ? 'ring-2 ring-offset-1 ring-cu-primary scale-110' : ''
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              );
            }

            if (isDeleting) {
              return (
                <div key={label.id} className="p-1.5 bg-red-500/10 rounded-md flex items-center justify-between gap-1 my-0.5" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[10px] font-medium text-red-500 truncate">
                    Delete &quot;{label.name}&quot;?
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onDeleteLabel) {
                          setIsDeletingLabel(true);
                          void onDeleteLabel(label.id)
                            .then(() => setDeletingLabelId(null))
                            .finally(() => setIsDeletingLabel(false));
                        }
                      }}
                      disabled={isDeletingLabel}
                      className="px-1.5 py-0.5 text-[9px] font-semibold bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingLabelId(null);
                      }}
                      className="px-1.5 py-0.5 text-[9px] bg-cu-bg-secondary text-cu-text-secondary rounded hover:bg-cu-hover"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={label.id}
                className={`group flex items-center justify-between gap-1 px-2 py-1.5 rounded-md hover:bg-cu-hover transition-colors ${
                  attached ? 'bg-cu-primary/5 font-semibold text-cu-primary' : 'text-cu-text-primary'
                }`}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onToggleLabel(task.id, label, !attached);
                  }}
                  className="flex-1 flex items-center gap-2 text-left min-w-0 py-0.5 text-[11px]"
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: label.color ?? '#6366F1' }} />
                  <span className="truncate">{label.name}</span>
                </button>
                <div className="flex items-center gap-0.5 shrink-0">
                  {attached && <Check size={12} className="text-cu-primary mr-1" />}
                  {onUpdateLabel && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditingLabelId(label.id);
                        setEditLabelName(label.name);
                        setEditLabelColor(label.color || LABEL_PALETTE[0]);
                        setDeletingLabelId(null);
                      }}
                      title="Edit label"
                      className="p-0.5 text-cu-text-muted hover:text-cu-primary hover:bg-cu-bg rounded opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
                    >
                      <Pencil size={10} />
                    </button>
                  )}
                  {onDeleteLabel && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeletingLabelId(label.id);
                        setEditingLabelId(null);
                      }}
                      title="Delete label"
                      className="p-0.5 text-cu-text-muted hover:text-red-500 hover:bg-cu-bg rounded opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function LabelControl(props: Pick<TaskRowProps, 'task' | 'availableLabels' | 'onToggleLabel' | 'onCreateLabel' | 'onUpdateLabel' | 'onDeleteLabel'>) {
  const { task } = props;
  return (
    <StopPropagation>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-cu-md px-2 text-[11px] text-cu-text-secondary transition-colors hover:bg-cu-hover">
          <span className="flex min-w-0 gap-1 overflow-hidden">
            {task.labels?.length ? (
              task.labels.slice(0, 2).map((label) => (
                <span
                  key={label.id}
                  style={hexToLabelStyle(label.color ?? '#6366F1')}
                  className="truncate rounded-full border border-black/5 px-1.5 py-0.5 text-[10px] font-semibold"
                >
                  {label.name}
                </span>
              ))
            ) : (
              <span className="truncate text-cu-text-muted">Labels</span>
            )}
          </span>
          <Plus size={12} className="shrink-0 text-cu-text-tertiary" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="p-0 border-0 shadow-none bg-transparent">
          <div className="rounded-xl border border-cu-border bg-cu-bg shadow-cu-xl">
            <LabelDropdownList {...props} />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </StopPropagation>
  );
}

function MilestoneControl({ task, milestones, onMilestoneChange }: Pick<TaskRowProps, 'task' | 'milestones' | 'onMilestoneChange'>) {
  return (
    <StopPropagation>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-8 w-full min-w-0 items-center gap-1.5 rounded-cu-md px-2 text-left text-[11px] font-semibold text-cu-text-secondary transition-colors hover:bg-cu-hover">
          <Target size={12} className="shrink-0 text-cu-text-tertiary" />
          <span className="truncate">{task.milestoneName || 'Milestone'}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-64 min-w-[210px] overflow-y-auto">
          <DropdownMenuItem onSelect={() => onMilestoneChange(task.id, null)} className="min-h-9 text-[12px]">
            No milestone
          </DropdownMenuItem>
          {milestones.map((milestone) => (
            <DropdownMenuItem
              key={milestone.id}
              onSelect={() => onMilestoneChange(task.id, milestone.id)}
              className="min-h-9 justify-between text-[12px]"
            >
              <span className="truncate">{milestone.name}</span>
              {task.milestoneId === milestone.id && <Check size={13} className="text-cu-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </StopPropagation>
  );
}

function AssigneeControl({ task, members, onAssigneesChange }: Pick<TaskRowProps, 'task' | 'members' | 'onAssigneesChange'>) {
  const assignedUsers = getAssignedUsers(task);
  const selectedIds = new Set((task.assignees ?? []).map((person) => person.id).filter(Boolean) as number[]);

  return (
    <StopPropagation>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-8 w-full min-w-0 items-center gap-2 rounded-cu-md px-2 text-left transition-colors hover:bg-cu-hover">
          {assignedUsers.length > 0 ? (
            <>
              <AvatarStack users={assignedUsers} size="xs" max={3} />
              <span className="truncate text-[11px] font-semibold text-cu-text-secondary">
                {assignedUsers[0]?.name}{assignedUsers.length > 1 ? ` +${assignedUsers.length - 1}` : ''}
              </span>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-cu-text-muted">
              <Plus size={12} />
              Assign
            </span>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-64 min-w-[220px] overflow-y-auto">
          <DropdownMenuItem onSelect={() => onAssigneesChange(task.id, [])} className="min-h-9 text-[12px]">
            Unassigned
          </DropdownMenuItem>
          {members.map((member) => {
            const selectedMemberIds = selectedIds.size > 0
              ? Array.from(selectedIds)
              : task.assigneeId ? [task.assigneeId] : [];
            const checked = selectedMemberIds.includes(member.id);
            return (
              <DropdownMenuItem
                key={member.id}
                onSelect={(event) => {
                  event.preventDefault();
                  const nextIds = checked
                    ? selectedMemberIds.filter((id) => id !== member.id)
                    : [...selectedMemberIds, member.id];
                  onAssigneesChange(task.id, nextIds);
                }}
                className="min-h-9 justify-between text-[12px]"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <AvatarStack users={[{ name: member.name, src: member.photoUrl }]} size="xs" max={1} />
                  <span className="truncate">{member.name}</span>
                </span>
                {checked && <Check size={13} className="text-cu-primary" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </StopPropagation>
  );
}

function StatusControl({ task, projectStatuses, onStatusChange }: Pick<TaskRowProps, 'task' | 'projectStatuses' | 'onStatusChange'>) {
  const taskStatus = normalizeStatus(task.status);
  const options = projectStatuses?.length
    ? projectStatuses.map((status) => ({ value: normalizeStatus(status.status), label: status.name || formatStatusLabel(status.status) }))
    : STATUS_ORDER.map((status) => ({ value: status, label: formatStatusLabel(status) }));
  const current = projectStatuses?.find((status) => normalizeStatus(status.status) === taskStatus);
  const label = current?.name || STATUS_CONFIG[taskStatus]?.label || formatStatusLabel(taskStatus);

  return (
    <StopPropagation>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-cu-md border border-cu-border bg-cu-bg-secondary px-2 text-[11px] font-bold text-cu-text-primary transition-colors hover:bg-cu-hover">
          <span className="flex min-w-0 items-center gap-1.5">
            <StatusDot status={taskStatus} />
            <span className="truncate">{label}</span>
          </span>
          <ChevronDown size={11} className="shrink-0 text-cu-text-tertiary" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[160px]">
          {options.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => onStatusChange(task.id, option.value)}
              className="min-h-9 justify-between text-[12px] font-semibold"
            >
              <span className="flex items-center gap-2">
                <StatusDot status={option.value} />
                {option.label}
              </span>
              {taskStatus === option.value && <Check size={13} className="text-cu-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </StopPropagation>
  );
}

function DueDateControl({ task, onDueDateChange }: Pick<TaskRowProps, 'task' | 'onDueDateChange'>) {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const dueTone = getDueDateTone(task);
  const label = dueTone === 'danger' && isTaskOverdue(task) ? 'Overdue' : formatDueDate(task.dueDate);
  const toneClass = dueTone === 'danger'
    ? 'border-red-500/20 bg-red-500/10 text-red-500'
    : dueTone === 'warning'
      ? 'border-amber-500/25 bg-amber-500/10 text-amber-600'
      : 'border-cu-border bg-cu-bg-secondary text-cu-text-secondary hover:bg-cu-hover hover:text-cu-text-primary';

  return (
    <StopPropagation>
      <button
        type="button"
        className={`inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-cu-md border px-2 text-[11px] font-bold transition-colors ${toneClass}`}
        onClick={() => dateInputRef.current?.showPicker?.() ?? dateInputRef.current?.click()}
        aria-label="Edit due date"
      >
        <CalendarDays size={12} className="shrink-0" />
        <span className="truncate">{label}</span>
      </button>
      <input
        ref={dateInputRef}
        type="date"
        className="sr-only"
        value={task.dueDate ?? ''}
        onChange={(event) => onDueDateChange(task.id, event.target.value || null)}
      />
    </StopPropagation>
  );
}

function TaskBadges({ task, compact = false }: { task: Task; compact?: boolean }) {
  const blocked = isTaskBlocked(task);
  return (
    <>
      {task.recurrenceRule && (
        <span
          className={`inline-flex items-center gap-1 rounded-cu-sm px-1.5 py-0.5 font-semibold ${
            compact ? 'text-[9px]' : 'text-[10px]'
          } ${
            task.recurrenceActive === false
              ? 'bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/30'
              : 'bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/30'
          }`}
          title={task.recurrenceActive === false ? 'Recurring (Paused)' : `Recurring (${task.recurrenceRule})`}
        >
          <RefreshCw size={compact ? 8 : 9} className="shrink-0" />
          Recur{task.recurrenceActive === false ? ' paused' : ''}
        </span>
      )}
      {blocked && (
        <span className={`inline-flex items-center gap-1 rounded-cu-sm bg-red-500/10 px-1.5 py-0.5 font-semibold text-red-500 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
          <Lock size={compact ? 8 : 9} className="shrink-0" />
          Blocked
        </span>
      )}
    </>
  );
}

function ActionsMenu({
  task,
  onOpenModal,
  onDelete,
  canModifyTasks = true,
}: Pick<TaskRowProps, 'task' | 'onOpenModal' | 'onDelete' | 'canModifyTasks'>) {
  return (
    <StopPropagation>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex h-8 w-8 items-center justify-center rounded-cu-md text-cu-text-tertiary transition-colors hover:bg-cu-hover hover:text-cu-text-primary"
          aria-label={`Actions for ${task.title}`}
        >
          <MoreHorizontal size={16} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[150px]">
          <DropdownMenuItem onSelect={() => onOpenModal(task.id)} className="min-h-9 text-[12px]">
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            destructive
            disabled={!canModifyTasks}
            onSelect={(event) => {
              if (!canModifyTasks) {
                event.preventDefault();
                return;
              }
              onDelete(task.id);
            }}
            className={`min-h-9 text-[12px] ${canModifyTasks ? '' : 'cursor-not-allowed text-cu-text-muted'}`}
          >
            <Trash2 size={13} />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </StopPropagation>
  );
}

function MobilePriorityControl({ task, onPriorityChange }: Pick<TaskRowProps, 'task' | 'onPriorityChange'>) {
  const priority = task.priority ?? '';
  const config = priority ? PRIORITY_CONFIG[priority] : null;
  const Icon = config?.icon ?? Plus;

  return (
    <StopPropagation>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={`${mobileIconButtonClass} ${priorityClasses[priority] ?? ''}`}
          aria-label={`Priority: ${formatPriorityLabel(priority)}`}
          title={`Priority: ${formatPriorityLabel(priority)}`}
        >
          <Icon size={14} className="shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[140px]">
          {PRIORITY_ORDER.map((value) => {
            const itemConfig = PRIORITY_CONFIG[value];
            const ItemIcon = itemConfig.icon;
            return (
              <DropdownMenuItem
                key={value}
                onSelect={() => onPriorityChange?.(task.id, value)}
                className="min-h-9 justify-between text-[12px] font-semibold"
              >
                <span className="flex items-center gap-2" style={{ color: itemConfig.color }}>
                  <ItemIcon size={13} />
                  {itemConfig.label}
                </span>
                {priority === value && <Check size={13} className="text-cu-primary" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </StopPropagation>
  );
}

function MobileStatusControl({ task, projectStatuses, onStatusChange }: Pick<TaskRowProps, 'task' | 'projectStatuses' | 'onStatusChange'>) {
  const taskStatus = normalizeStatus(task.status);
  const options = projectStatuses?.length
    ? projectStatuses.map((status) => ({ value: normalizeStatus(status.status), label: status.name || formatStatusLabel(status.status) }))
    : STATUS_ORDER.map((status) => ({ value: status, label: formatStatusLabel(status) }));
  const current = projectStatuses?.find((status) => normalizeStatus(status.status) === taskStatus);
  const label = current?.name || STATUS_CONFIG[taskStatus]?.label || formatStatusLabel(taskStatus);

  return (
    <StopPropagation>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={mobileIconButtonClass}
          aria-label={`Status: ${label}`}
          title={`Status: ${label}`}
        >
          <StatusDot status={taskStatus} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[160px]">
          {options.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => onStatusChange(task.id, option.value)}
              className="min-h-9 justify-between text-[12px] font-semibold"
            >
              <span className="flex items-center gap-2">
                <StatusDot status={option.value} />
                {option.label}
              </span>
              {taskStatus === option.value && <Check size={13} className="text-cu-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </StopPropagation>
  );
}

function MobileDueDateControl({ task, onDueDateChange }: Pick<TaskRowProps, 'task' | 'onDueDateChange'>) {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const dueTone = getDueDateTone(task);
  const label = dueTone === 'danger' && isTaskOverdue(task) ? 'Overdue' : formatDueDate(task.dueDate);
  const toneClass = dueTone === 'danger'
    ? 'border-red-500/20 bg-red-500/10 text-red-500'
    : dueTone === 'warning'
      ? 'border-amber-500/25 bg-amber-500/10 text-amber-600'
      : '';

  return (
    <StopPropagation>
      <button
        type="button"
        className={`${mobileIconButtonClass} ${toneClass}`}
        onClick={() => dateInputRef.current?.showPicker?.() ?? dateInputRef.current?.click()}
        aria-label={`Due date: ${label}`}
        title={`Due date: ${label}`}
      >
        <CalendarDays size={14} />
      </button>
      <input
        ref={dateInputRef}
        type="date"
        className="sr-only"
        value={task.dueDate ?? ''}
        onChange={(event) => onDueDateChange(task.id, event.target.value || null)}
      />
    </StopPropagation>
  );
}

function MobileAssigneeControl({ task, members, onAssigneesChange }: Pick<TaskRowProps, 'task' | 'members' | 'onAssigneesChange'>) {
  const assignedUsers = getAssignedUsers(task);
  const selectedIds = new Set((task.assignees ?? []).map((person) => person.id).filter(Boolean) as number[]);
  const label = assignedUsers.length > 0
    ? `Assignee: ${assignedUsers[0]?.name}${assignedUsers.length > 1 ? ` +${assignedUsers.length - 1}` : ''}`
    : 'Assign task';

  return (
    <StopPropagation>
      <DropdownMenu>
        <DropdownMenuTrigger className={mobileIconButtonClass} aria-label={label} title={label}>
          {assignedUsers.length > 0 ? (
            <AvatarStack users={assignedUsers} size="xs" max={2} />
          ) : (
            <UserPlus size={14} />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-64 min-w-[220px] overflow-y-auto">
          <DropdownMenuItem onSelect={() => onAssigneesChange(task.id, [])} className="min-h-9 text-[12px]">
            Unassigned
          </DropdownMenuItem>
          {members.map((member) => {
            const selectedMemberIds = selectedIds.size > 0
              ? Array.from(selectedIds)
              : task.assigneeId ? [task.assigneeId] : [];
            const checked = selectedMemberIds.includes(member.id);
            return (
              <DropdownMenuItem
                key={member.id}
                onSelect={(event) => {
                  event.preventDefault();
                  const nextIds = checked
                    ? selectedMemberIds.filter((id) => id !== member.id)
                    : [...selectedMemberIds, member.id];
                  onAssigneesChange(task.id, nextIds);
                }}
                className="min-h-9 justify-between text-[12px]"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <AvatarStack users={[{ name: member.name, src: member.photoUrl }]} size="xs" max={1} />
                  <span className="truncate">{member.name}</span>
                </span>
                {checked && <Check size={13} className="text-cu-primary" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </StopPropagation>
  );
}

function MobileLabelControl(props: Pick<TaskRowProps, 'task' | 'availableLabels' | 'onToggleLabel' | 'onCreateLabel' | 'onUpdateLabel' | 'onDeleteLabel'>) {
  const { task } = props;
  const firstLabel = task.labels?.[0];
  const labelCount = task.labels?.length ?? 0;

  return (
    <StopPropagation>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={mobileIconButtonClass}
          aria-label={labelCount > 0 ? `${labelCount} label${labelCount === 1 ? '' : 's'}` : 'Labels'}
          title={labelCount > 0 ? `${labelCount} label${labelCount === 1 ? '' : 's'}` : 'Labels'}
        >
          <Tag size={14} style={firstLabel?.color ? { color: firstLabel.color } : undefined} />
          {labelCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-cu-primary px-1 text-[9px] font-bold text-white">
              {labelCount}
            </span>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="p-0 border-0 shadow-none bg-transparent">
          <div className="rounded-xl border border-cu-border bg-cu-bg shadow-cu-xl">
            <LabelDropdownList {...props} />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </StopPropagation>
  );
}

function MobileMilestoneControl({ task, milestones, onMilestoneChange }: Pick<TaskRowProps, 'task' | 'milestones' | 'onMilestoneChange'>) {
  const label = task.milestoneName ? `Milestone: ${task.milestoneName}` : 'Milestone';

  return (
    <StopPropagation>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={`${mobileIconButtonClass} ${task.milestoneName ? 'text-cu-primary' : ''}`}
          aria-label={label}
          title={label}
        >
          <Target size={14} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-64 min-w-[210px] overflow-y-auto">
          <DropdownMenuItem onSelect={() => onMilestoneChange(task.id, null)} className="min-h-9 text-[12px]">
            No milestone
          </DropdownMenuItem>
          {milestones.map((milestone) => (
            <DropdownMenuItem
              key={milestone.id}
              onSelect={() => onMilestoneChange(task.id, milestone.id)}
              className="min-h-9 justify-between text-[12px]"
            >
              <span className="truncate">{milestone.name}</span>
              {task.milestoneId === milestone.id && <Check size={13} className="text-cu-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </StopPropagation>
  );
}

export function DesktopTaskRow(props: TaskRowProps) {
  const {
    task,
    onOpenModal,
    selected,
    onToggleSelect,
  } = props;
  const priorityColor = PRIORITY_CONFIG[task.priority ?? '']?.color ?? '#9CA3AF';

  return (
    <div
      className={`hidden min-h-[48px] cursor-pointer border-b border-cu-border/50 transition-colors ${LIST_GRID_CLASS} ${
        selected ? 'border-l-2 border-l-cu-primary bg-cu-primary/[0.04]' : 'border-l-2 border-l-transparent bg-cu-bg hover:bg-cu-hover/70'
      }`}
      onClick={() => onOpenModal(task.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpenModal(task.id);
        }
      }}
      tabIndex={0}
      data-testid="desktop-task-row"
    >
      <SelectionCell {...props} selected={selected} onToggleSelect={onToggleSelect} />
      <PriorityControl {...props} />

      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-6 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: priorityColor }} />
          <span className="truncate text-[13px] font-semibold text-cu-text-primary group-hover:text-cu-primary">
            {task.title}
          </span>
          <TaskBadges task={task} />
        </div>
      </div>

      <div className="min-w-0">
        <LabelControl {...props} />
      </div>

      <div className="hidden min-w-0 xl:block">
        <MilestoneControl {...props} />
      </div>

      <div className="min-w-0">
        <AssigneeControl {...props} />
      </div>

      <StatusControl {...props} />
      <DueDateControl {...props} />
      <ActionsMenu {...props} />
    </div>
  );
}

export function MobileTaskRow(props: TaskRowProps) {
  const { task, onOpenModal, selected, onToggleSelect } = props;
  const priorityColor = PRIORITY_CONFIG[task.priority ?? '']?.color ?? '#9CA3AF';

  return (
    <div
      className={`flex min-h-[60px] items-center overflow-hidden rounded-cu-md border border-cu-border bg-cu-bg shadow-cu-sm transition-colors md:hidden ${
        selected ? 'ring-2 ring-cu-primary/25' : ''
      }`}
      data-testid="mobile-task-row"
    >
      <span className="h-10 w-1 shrink-0 rounded-r-full" style={{ backgroundColor: priorityColor }} />
      <div className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2">
        <SelectionCell {...props} selected={selected} onToggleSelect={onToggleSelect} />
        <button
          type="button"
          onClick={() => onOpenModal(task.id)}
          className="min-w-0 flex-1 text-left"
        >
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <h3 className="truncate text-[13px] font-bold leading-5 text-cu-text-primary">
                {task.title}
              </h3>
              <TaskBadges task={task} compact />
            </div>
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[10px] font-semibold text-cu-text-tertiary">
              <span className="truncate">{formatPriorityLabel(task.priority)}</span>
              <span aria-hidden="true">/</span>
              <span className="truncate">{formatDueDate(task.dueDate)}</span>
              {task.labels?.[0] && (
                <>
                  <span aria-hidden="true">/</span>
                  <span className="truncate" style={{ color: task.labels[0].color ?? undefined }}>
                    {task.labels[0].name}
                  </span>
                </>
              )}
            </div>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <MobilePriorityControl {...props} />
          <MobileStatusControl {...props} />
          <MobileDueDateControl {...props} />
          <MobileAssigneeControl {...props} />
          <MobileLabelControl {...props} />
          <MobileMilestoneControl {...props} />
          <ActionsMenu {...props} />
        </div>
      </div>
    </div>
  );
}

export const MobileTaskCard = MobileTaskRow;

const TaskRow = React.memo(function TaskRow(props: TaskRowProps) {
  return (
    <>
      <DesktopTaskRow {...props} />
      <MobileTaskRow {...props} />
    </>
  );
});

export default TaskRow;
