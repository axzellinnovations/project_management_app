import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { TaskRowTask, TaskRowProps } from '../TaskRow';
import { classifyDue, STATUS_LABELS, STATUS_COLORS, STATUS_BORDER, PRIORITY_STYLES, type TaskStatus } from './TaskRowConstants';

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useTaskRowState(task: TaskRowTask, props: Pick<TaskRowProps, 'canDelete' | 'onDeleteTask' | 'onRenameTask' | 'onAddLabel' | 'onRemoveLabel' | 'onCreateLabel' | 'extraStatuses' | 'projectLabels'>) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [creatingLabel, setCreatingLabel] = useState(false);
  const [statusRect, setStatusRect] = useState<DOMRect | null>(null);
  const [assignRect, setAssignRect] = useState<DOMRect | null>(null);
  const [labelRect, setLabelRect] = useState<DOMRect | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const statusRef = useRef<HTMLDivElement>(null);
  const assignRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const statusPortalRef = useRef<HTMLDivElement>(null);
  const assignPortalRef = useRef<HTMLDivElement>(null);
  const labelPortalRef = useRef<HTMLDivElement>(null);

  // Touch logic
  const lastTapRef = useRef<number>(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Touch handlers
  const onTouchStartInternal = useCallback((e: React.TouchEvent) => {
    const now = Date.now();
    const isDoubleTap = now - lastTapRef.current < 300;
    if (isDoubleTap) {
      e.preventDefault();
      setRenameValue(task.title);
      setRenaming(true);
      lastTapRef.current = 0;
      if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
      return;
    }
    lastTapRef.current = now;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      if (props.canDelete) props.onDeleteTask(task.id);
    }, 600);
  }, [task.id, task.title, props.canDelete, props.onDeleteTask]);

  const onTouchEndInternal = useCallback(() => {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  }, []);

  const onTouchMoveInternal = useCallback(() => {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  }, []);

  const startRename = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameValue(task.title);
    setRenaming(true);
  }, [task.title]);

  const commitRename = useCallback(async () => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === task.title) { setRenaming(false); return; }
    setRenaming(false);
    try { await props.onRenameTask(task.id, trimmed); } catch (error) { console.error('Failed to rename task:', error); }
  }, [renameValue, task.id, task.title, props.onRenameTask]);

  const taskLabelIds = useMemo(() => new Set((task.labels ?? []).map((l) => l.id)), [task.labels]);

  const openLabel = useCallback(() => {
    setLabelRect(labelRef.current?.getBoundingClientRect() ?? null);
    setLabelOpen(true);
  }, []);

  const handleLabelToggle = useCallback(async (label: { id: number; name: string; color?: string }) => {
    if (taskLabelIds.has(label.id)) {
      await props.onRemoveLabel?.(task.id, label.id);
    } else {
      if (taskLabelIds.size > 0) {
        const existingId = task.labels![0].id;
        await props.onRemoveLabel?.(task.id, existingId);
      }
      await props.onAddLabel?.(task.id, label.id);
    }
  }, [task.id, task.labels, taskLabelIds, props.onAddLabel, props.onRemoveLabel]);

  const handleCreateLabelFromInput = useCallback(async () => {
    const trimmed = labelInput.trim();
    if (!trimmed || creatingLabel || !props.onCreateLabel) return;
    setCreatingLabel(true);
    try {
      const newLabel = await props.onCreateLabel(trimmed);
      await props.onAddLabel?.(task.id, newLabel.id);
      setLabelInput('');
    } finally { setCreatingLabel(false); }
  }, [labelInput, creatingLabel, props.onCreateLabel, props.onAddLabel, task.id]);

  const openStatus = useCallback(() => {
    if (statusRef.current) setStatusRect(statusRef.current.getBoundingClientRect());
    setStatusOpen((p) => !p);
  }, []);

  const openAssign = useCallback(() => {
    if (assignRef.current) setAssignRect(assignRef.current.getBoundingClientRect());
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
  const displayLabel = isKnownStatus ? STATUS_LABELS[validStatus] : (props.extraStatuses?.find(s => s.value === canonicalStatus)?.label ?? task.status ?? 'TODO');
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
    statusRect, assignRect, labelRect,
    isMobile,
    // Refs
    statusRef, assignRef, labelRef, dateRef,
    statusPortalRef, assignPortalRef, labelPortalRef,
    lastTapRef,
    // Handlers
    onTouchStartInternal, onTouchEndInternal, onTouchMoveInternal,
    startRename, commitRename,
    taskLabelIds, openLabel, handleLabelToggle, handleCreateLabelFromInput,
    openStatus, openAssign, openDatePicker,
    // Derived
    canonicalStatus, validStatus, displayLabel, displayStyle,
    dueClass, statusBorderColor, priorityKey, priorityStyle,
  };
}
