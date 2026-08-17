import { useState, useRef, useEffect, useCallback, useMemo, useLayoutEffect } from 'react';
import type { TaskRowTask, TaskRowProps } from '../TaskRow';
import { classifyDue, STATUS_LABELS, STATUS_COLORS, STATUS_BORDER, PRIORITY_STYLES, type TaskStatus } from './TaskRowConstants';

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useTaskRowState(task: TaskRowTask, props: Pick<TaskRowProps, 'canDelete' | 'onDeleteTask' | 'onRenameTask' | 'onAddLabel' | 'onRemoveLabel' | 'onCreateLabel' | 'onUpdateLabel' | 'onDeleteLabel' | 'extraStatuses' | 'projectLabels'>) {
  const {
    canDelete: _canDelete, onDeleteTask: _onDeleteTask, onRenameTask, onAddLabel,
    onRemoveLabel, onCreateLabel, onUpdateLabel, onDeleteLabel, extraStatuses, projectLabels: _projectLabels
  } = props;

  const [statusOpen, setStatusOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [creatingLabel, setCreatingLabel] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState<number | null>(null);
  const [editLabelName, setEditLabelName] = useState('');
  const [editLabelColor, setEditLabelColor] = useState('#6366F1');
  const [isSavingLabelEdit, setIsSavingLabelEdit] = useState(false);
  const [deletingLabelId, setDeletingLabelId] = useState<number | null>(null);
  const [isDeletingLabel, setIsDeletingLabel] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Layout positions to avoid ref access during render
  const [statusPosition, setStatusPosition] = useState({ top: 0, left: 0 });
  const [assignPosition, setAssignPosition] = useState({ top: 0, left: 0 });
  const [labelPosition, setLabelPosition] = useState({ top: 0, left: 0 });

  const statusRef = useRef<HTMLDivElement>(null);
  const assignRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const statusPortalRef = useRef<HTMLDivElement>(null);
  const assignPortalRef = useRef<HTMLDivElement>(null);
  const labelPortalRef = useRef<HTMLDivElement>(null);

  // Update layout positions when dropdowns open
  useLayoutEffect(() => {
    if (statusOpen && statusRef.current) {
      const rect = statusRef.current.getBoundingClientRect();
      setStatusPosition({
        top: rect.bottom + (isMobile ? 8 : 4),
        left: isMobile ? Math.min(rect.left, window.innerWidth - 180) : rect.left
      });
    }
  }, [statusOpen, isMobile]);

  useLayoutEffect(() => {
    if (assignOpen && assignRef.current) {
      const rect = assignRef.current.getBoundingClientRect();
      setAssignPosition({
        top: rect.bottom + 8,
        left: isMobile ? Math.min(rect.left, window.innerWidth - 220) : Math.max(4, rect.right - 208)
      });
    }
  }, [assignOpen, isMobile]);

  useLayoutEffect(() => {
    if (labelOpen && labelRef.current) {
      const rect = labelRef.current.getBoundingClientRect();
      setLabelPosition({
        top: rect.bottom + 4,
        left: Math.max(4, rect.right - 224)
      });
    }
  }, [labelOpen]);

  // Touch logic
  const lastTapRef = useRef<number>(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renameCommitStartedRef = useRef(false);

  // Responsive
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: Event) => {
      const target = e.target as Node;
      if (statusRef.current && !statusRef.current.contains(target) && statusPortalRef.current && !statusPortalRef.current.contains(target)) setStatusOpen(false);
      if (assignRef.current && !assignRef.current.contains(target) && assignPortalRef.current && !assignPortalRef.current.contains(target)) setAssignOpen(false);
      if (labelRef.current && !labelRef.current.contains(target) && labelPortalRef.current && !labelPortalRef.current.contains(target)) setLabelOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, []);

  // Touch handlers — double-tap on title to rename
  const onTouchStartInternal = useCallback((e: React.TouchEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      e.preventDefault();
      renameCommitStartedRef.current = false;
      setRenameValue(task.title);
      setRenaming(true);
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;
  }, [task.title]);

  const onTouchEndInternal = useCallback(() => {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  }, []);

  const onTouchMoveInternal = useCallback(() => {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  }, []);

  const startRename = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    renameCommitStartedRef.current = false;
    setRenameValue(task.title);
    setRenaming(true);
  }, [task.title]);

  const updateLastTap = useCallback((time: number) => {
    lastTapRef.current = time;
  }, []);

  const commitRename = useCallback(async () => {
    if (renameCommitStartedRef.current) return;
    renameCommitStartedRef.current = true;
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === task.title) { setRenaming(false); return; }
    setRenaming(false);
    try { await onRenameTask(task.id, trimmed); } catch (error) { console.error('Failed to rename task:', error); }
  }, [renameValue, task.id, task.title, onRenameTask]);

  const cancelRename = useCallback(() => {
    renameCommitStartedRef.current = true;
    setRenaming(false);
  }, []);

  const taskLabelIds = useMemo(() => new Set((task.labels ?? []).map((l) => l.id)), [task.labels]);

  const openLabel = useCallback(() => {
    setLabelOpen(true);
  }, []);

  const handleLabelToggle = useCallback(async (label: { id: number; name: string; color?: string }) => {
    if (taskLabelIds.has(label.id)) {
      await onRemoveLabel?.(task.id, label.id);
    } else {
      if (taskLabelIds.size > 0) {
        const existingId = (task.labels ?? [])[0].id;
        await onRemoveLabel?.(task.id, existingId);
      }
      await onAddLabel?.(task.id, label.id);
    }
  }, [task.id, task.labels, taskLabelIds, onAddLabel, onRemoveLabel]);

  const handleCreateLabelFromInput = useCallback(async () => {
    const trimmed = labelInput.trim();
    if (!trimmed || creatingLabel || !onCreateLabel) return;
    setCreatingLabel(true);
    try {
      const newLabel = await onCreateLabel(trimmed);
      await onAddLabel?.(task.id, newLabel.id);
      setLabelInput('');
    } finally { setCreatingLabel(false); }
  }, [labelInput, creatingLabel, onCreateLabel, onAddLabel, task.id]);

  const handleSaveLabelEdit = useCallback(async (id: number, name: string, color: string) => {
    if (!name.trim() || isSavingLabelEdit || !onUpdateLabel) return;
    setIsSavingLabelEdit(true);
    try {
      await onUpdateLabel(id, name.trim(), color);
      setEditingLabelId(null);
    } finally {
      setIsSavingLabelEdit(false);
    }
  }, [isSavingLabelEdit, onUpdateLabel]);

  const handleConfirmDeleteLabel = useCallback(async (id: number) => {
    if (isDeletingLabel || !onDeleteLabel) return;
    setIsDeletingLabel(true);
    try {
      await onDeleteLabel(id);
      setDeletingLabelId(null);
    } finally {
      setIsDeletingLabel(false);
    }
  }, [isDeletingLabel, onDeleteLabel]);

  const openStatus = useCallback(() => {
    setStatusOpen((p) => !p);
  }, []);

  const openAssign = useCallback(() => {
    setAssignOpen((p) => !p);
  }, []);

  const openDatePicker = useCallback(() => {
    if (!dateRef.current) return;
    if (typeof dateRef.current.showPicker === 'function') dateRef.current.showPicker();
    else dateRef.current.click();
  }, []);

  // Derived values
  const canonicalStatus = (task.status ?? 'TODO').toUpperCase() as TaskStatus;
  const isKnownStatus = canonicalStatus in STATUS_LABELS;
  const validStatus: TaskStatus = isKnownStatus ? canonicalStatus : 'TODO';
  const displayLabel = isKnownStatus ? STATUS_LABELS[validStatus] : (extraStatuses?.find(s => s.value === canonicalStatus)?.label ?? task.status ?? 'TODO');
  const displayStyle = isKnownStatus ? STATUS_COLORS[validStatus] : 'bg-[#F2F4F7] text-[#344054]';
  const dueClass = classifyDue(task.dueDate, validStatus);
  const statusBorderColor = STATUS_BORDER[validStatus];
  const priorityKey = (task.priority ?? 'LOW').toUpperCase();
  const priorityStyle = PRIORITY_STYLES[priorityKey] ?? PRIORITY_STYLES.LOW;

  return {
    // State
    statusOpen, setStatusOpen,
    assignOpen, setAssignOpen,
    labelOpen, setLabelOpen,
    renaming, setRenaming,
    renameValue, setRenameValue,
    labelInput, setLabelInput,
    creatingLabel,
    editingLabelId, setEditingLabelId,
    editLabelName, setEditLabelName,
    editLabelColor, setEditLabelColor,
    isSavingLabelEdit,
    deletingLabelId, setDeletingLabelId,
    isDeletingLabel,
    statusPosition, assignPosition, labelPosition,
    isMobile,
    // Refs
    statusRef, assignRef, labelRef, dateRef,
    statusPortalRef, assignPortalRef, labelPortalRef,
    lastTapRef,
    // Handlers
    onTouchStartInternal, onTouchEndInternal, onTouchMoveInternal,
    startRename, updateLastTap, commitRename, cancelRename,
    taskLabelIds, openLabel, handleLabelToggle, handleCreateLabelFromInput,
    handleSaveLabelEdit, handleConfirmDeleteLabel,
    onUpdateLabel, onDeleteLabel,
    openStatus, openAssign, openDatePicker,
    // Derived
    canonicalStatus, validStatus, displayLabel, displayStyle,
    dueClass, statusBorderColor, priorityKey, priorityStyle,
  };
}
