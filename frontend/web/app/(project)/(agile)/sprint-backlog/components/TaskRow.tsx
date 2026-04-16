'use client';

import React, { useState, useEffect } from 'react';
import MobileTaskRow from './task-row/MobileTaskRow';
import DesktopTaskRow from './task-row/DesktopTaskRow';

// ── Types (re-exported for external consumers) ──────────────────────────────

export interface TaskRowTask {
  id: number;
  taskNo: number;
  title: string;
  storyPoints: number;
  selected?: boolean;
  assigneeName?: string;
  assigneePhotoUrl?: string | null;
  status: string;
  dueDate?: string;
  priority?: string;
  labels?: Array<{ id: number; name: string; color?: string }>;
}

export interface TaskRowTeamMember {
  id: number;
  user: {
    userId: number;
    fullName: string;
    username: string;
    profilePicUrl?: string | null;
  };
}

export interface TaskRowProps {
  task: TaskRowTask;
  projectKey?: string;
  teamMembers?: TaskRowTeamMember[];
  loadingMembers?: boolean;
  canDelete?: boolean;
  showCheckbox?: boolean;
  onToggle?: (id: number) => void;
  onStatusChange: (id: number, status: string) => void;
  onStoryPointsChange: (id: number, points: number) => void;
  onRenameTask: (id: number, title: string) => Promise<void>;
  onAssignTask: (id: number, userId: number) => Promise<void>;
  onDueDateChange?: (id: number, date: string) => void;
  onDeleteTask: (id: number) => void;
  onOpenTask?: (id: number) => void;
  projectLabels?: Array<{ id: number; name: string; color?: string }>;
  onAddLabel?: (taskId: number, labelId: number) => Promise<void>;
  onRemoveLabel?: (taskId: number, labelId: number) => Promise<void>;
  onCreateLabel?: (name: string) => Promise<{ id: number; name: string; color?: string }>;
  extraStatuses?: Array<{ value: string; label: string }>;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

function TaskRow(props: TaskRowProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (isMobile) {
    return <MobileTaskRow {...props} />;
  }

  return <DesktopTaskRow {...props} />;
}

export default React.memo(TaskRow);
