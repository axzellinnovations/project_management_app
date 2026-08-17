'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle, Trash2, LogOut, Settings2,
  FileText, Shield, Loader2, CheckCircle2,
  X, Info, ArrowRight, Github, RefreshCw, Figma,
} from 'lucide-react';
import * as projectsApi from '@/services/projects-service';
import { toast } from '@/components/ui';
import OverlayPortal from '@/components/ui/OverlayPortal';
import GitHubMark from '@/components/github/GitHubMark';
import {
  createGitHubAutomationRule,
  deleteGitHubAutomationRule,
  fetchGitHubAutomationRules,
  getProjectGitHubRepo,
  type GithubAutomationAction,
  type GithubAutomationRule,
  type GithubAutomationTrigger,
  type ProjectGitHubConnection,
} from '@/services/github-service';
import {
  setScopedProjectValue,
  removeScopedProjectValue,
} from '@/hooks/useProjectContext';
import { getUserIdFromToken } from '@/lib/auth';
import CustomFieldsManager from './CustomFieldsManager';
import NotificationPreferencesPanel from '@/components/settings/NotificationPreferencesPanel';
import RecurringSchedulesManager from './RecurringSchedulesManager';
import { formatDate } from '@/lib/date-time';
import { getProjectFigmaPath } from '@/lib/figma';
type ProjectType = 'AGILE' | 'KANBAN';

interface ProjectData {
  id: number;
  name: string;
  description: string;
  projectKey?: string;
  type: ProjectType;
  teamId?: number;
  teamName?: string;
  ownerId?: number;
  ownerName?: string;
  createdAt?: string;
  figmaUrl?: string | null;
}

type QuickTemplateKey = 'prMergedDone' | 'ciFailedBug' | 'prOpenedReview';

interface QuickTemplateRule {
  key: QuickTemplateKey;
  label: string;
  description: string;
  trigger: GithubAutomationTrigger;
  action: GithubAutomationAction;
  config: Record<string, string>;
}

const QUICK_TEMPLATE_BASE: Array<Omit<QuickTemplateRule, 'config'>> = [
  {
    key: 'prMergedDone',
    label: 'Move task to Done when PR is merged',
    description: 'Creates a PR_MERGED -> MOVE_TASK_TO_COLUMN rule targeting Done.',
    trigger: 'PR_MERGED',
    action: 'MOVE_TASK_TO_COLUMN',
  },
  {
    key: 'ciFailedBug',
    label: 'Create bug task when CI fails',
    description: 'Creates a CI_FAILED -> CREATE_TASK rule with default bug settings.',
    trigger: 'CI_FAILED',
    action: 'CREATE_TASK',
  },
  {
    key: 'prOpenedReview',
    label: 'Move task to In Review when PR is opened',
    description: 'Creates a PR_OPENED -> MOVE_TASK_TO_COLUMN rule targeting In Review.',
    trigger: 'PR_OPENED',
    action: 'MOVE_TASK_TO_COLUMN',
  },
];

function normalizeColumnName(config: Record<string, string>): string {
  return (config.targetColumnName || config.columnName || config.column || '').trim().toLowerCase();
}

function buildQuickTemplateConfig(projectId: number, templateKey: QuickTemplateKey): Record<string, string> {
  if (templateKey === 'prMergedDone') {
    return { targetColumnName: 'Done' };
  }

  if (templateKey === 'prOpenedReview') {
    return { targetColumnName: 'In Review' };
  }

  return {
    projectId: String(projectId),
    taskTitle: 'CI failed: {workflowName} on {branch}',
    priority: 'HIGH',
    labelName: 'bug',
    labelColor: '#d73a4a',
  };
}

function matchesTemplate(rule: GithubAutomationRule, templateKey: QuickTemplateKey): boolean {
  switch (templateKey) {
    case 'prMergedDone':
      return (
        rule.trigger === 'PR_MERGED'
        && rule.action === 'MOVE_TASK_TO_COLUMN'
        && normalizeColumnName(rule.config) === 'done'
      );
    case 'ciFailedBug':
      return rule.trigger === 'CI_FAILED' && rule.action === 'CREATE_TASK';
    case 'prOpenedReview':
      return (
        rule.trigger === 'PR_OPENED'
        && rule.action === 'MOVE_TASK_TO_COLUMN'
        && normalizeColumnName(rule.config) === 'in review'
      );
    default:
      return false;
  }
}

function QuickSetupToggleRow({
  label,
  description,
  enabled,
  disabled,
  busy,
  onToggle,
}: {
  label: string;
  description: string;
  enabled: boolean;
  disabled: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{label}</p>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
        <button
          type="button"
          disabled={disabled || busy}
          onClick={onToggle}
          className={[
            'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border px-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50',
            enabled ? 'justify-end border-emerald-300 bg-emerald-500' : 'justify-start border-slate-200 bg-slate-200',
          ].join(' ')}
          aria-label={enabled ? `Disable ${label}` : `Enable ${label}`}
          aria-checked={enabled}
          role="switch"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm">
            {busy ? <Loader2 size={12} className="animate-spin text-slate-500" /> : null}
          </span>
        </button>
      </div>
    </div>
  );
}

function GitHubAutoTransitionsCard({ projectId }: { projectId: number }) {
  const [connection, setConnection] = useState<ProjectGitHubConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [ruleByTemplate, setRuleByTemplate] = useState<Record<QuickTemplateKey, number | null>>({
    prMergedDone: null,
    ciFailedBug: null,
    prOpenedReview: null,
  });
  const [busyByTemplate, setBusyByTemplate] = useState<Record<QuickTemplateKey, boolean>>({
    prMergedDone: false,
    ciFailedBug: false,
    prOpenedReview: false,
  });

  const templates: QuickTemplateRule[] = QUICK_TEMPLATE_BASE.map((base) => ({
    ...base,
    config: buildQuickTemplateConfig(projectId, base.key),
  }));

  const refreshConnection = useCallback(() => {
    setConnection(getProjectGitHubRepo(projectId));
  }, [projectId]);

  const refreshRules = useCallback(async () => {
    setLoading(true);
    try {
      const fetched = await fetchGitHubAutomationRules(projectId);

      const next: Record<QuickTemplateKey, number | null> = {
        prMergedDone: null,
        ciFailedBug: null,
        prOpenedReview: null,
      };

      for (const key of Object.keys(next) as QuickTemplateKey[]) {
        const match = fetched.find((rule) => matchesTemplate(rule, key));
        next[key] = match ? match.id : null;
      }

      setRuleByTemplate(next);
    } catch {
      toast('Failed to load GitHub automation quick setup', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    queueMicrotask(() => {
      refreshConnection();
      void refreshRules();
    });

    const onStorage = () => refreshConnection();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refreshConnection, refreshRules]);

  const setBusy = (key: QuickTemplateKey, value: boolean) => {
    setBusyByTemplate((prev) => ({ ...prev, [key]: value }));
  };

  const handleToggle = async (template: QuickTemplateRule) => {
    const key = template.key;
    const existingRuleId = ruleByTemplate[key];

    setBusy(key, true);
    try {
      if (existingRuleId) {
        await deleteGitHubAutomationRule(projectId, existingRuleId);
        setRuleByTemplate((prev) => ({ ...prev, [key]: null }));
        toast('Quick automation disabled', 'success');
      } else {
        const created = await createGitHubAutomationRule(projectId, {
          trigger: template.trigger,
          action: template.action,
          config: template.config,
        });
        setRuleByTemplate((prev) => ({ ...prev, [key]: created.id }));
        toast('Quick automation enabled', 'success');
      }
    } catch {
      toast('Failed to update quick automation rule', 'error');
    } finally {
      setBusy(key, false);
    }
  };

  const hasGitHubConnection = Boolean(connection?.repoFullName);

  return (
    <SectionCard
      title="GitHub Auto-Transitions"
      description="Quick Setup for the most common GitHub workflow rules"
      icon={<Github size={15} />}
    >
      <div className="space-y-4">
        {!hasGitHubConnection && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex items-start gap-3">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-semibold text-amber-900">GitHub not connected</p>
                <p className="mt-0.5 text-xs text-amber-700">
                  Connect a GitHub repository for this project to make auto-transitions meaningful.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="mb-3 flex items-center gap-2">
            <GitHubMark size={14} className="text-slate-700" />
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Quick Setup</p>
          </div>

          <div className="space-y-3">
            {templates.map((template) => (
              <QuickSetupToggleRow
                key={template.key}
                label={template.label}
                description={template.description}
                enabled={Boolean(ruleByTemplate[template.key])}
                disabled={loading || !hasGitHubConnection}
                busy={busyByTemplate[template.key]}
                onToggle={() => void handleToggle(template)}
              />
            ))}
          </div>

          <div className="mt-4 border-t border-slate-200 pt-3">
            <Link
              href={`/github/${projectId}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline"
            >
              Advanced: Manage all rules
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

// ── Section card shell ─────────────────────────────────────────────────────────

function SectionCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-cu-bg rounded-2xl border border-cu-border overflow-hidden shadow-cu-sm">
      <div className="px-5 sm:px-6 py-4 border-b border-cu-border bg-cu-bg-secondary/70">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cu-bg border border-cu-border flex items-center justify-center text-cu-primary shadow-cu-sm shrink-0">
            {icon}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-cu-text-primary">{title}</h2>
            {description && (
              <p className="text-xs text-cu-text-secondary mt-0.5">{description}</p>
            )}
          </div>
        </div>
      </div>
      <div className="px-5 sm:px-6 py-5">{children}</div>
    </div>
  );
}

// ── Delete confirmation modal ──────────────────────────────────────────────────

function DeleteConfirmModal({
  open,
  projectName,
  onClose,
  onConfirm,
  isDeleting,
}: {
  open: boolean;
  projectName: string;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  const [confirmText, setConfirmText] = useState('');
  const canDelete = confirmText === projectName;

  const handleClose = useCallback(() => {
    setConfirmText('');
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-[var(--cu-z-modal)] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={!isDeleting ? handleClose : undefined}
      />
      <div className="relative bg-cu-bg w-full sm:rounded-2xl sm:max-w-md shadow-cu-xl border-0 sm:border sm:border-cu-border rounded-t-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-full bg-cu-danger/10 ring-4 ring-cu-danger/10 flex items-center justify-center shrink-0">
              <AlertTriangle size={22} className="text-cu-danger" />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <h3 className="text-base font-bold text-cu-text-primary">Delete Project</h3>
              <p className="text-sm text-cu-text-secondary mt-0.5">
                This action is <span className="font-semibold text-cu-text-primary">permanent</span> and cannot be undone.
              </p>
            </div>
            {!isDeleting && (
              <button
                onClick={handleClose}
                className="p-1.5 text-cu-text-muted hover:text-cu-text-primary hover:bg-cu-hover rounded-lg transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Consequences */}
        <div className="mx-5 sm:mx-6 mb-4 bg-cu-danger/10 border border-cu-danger/20 rounded-xl p-4">
          <p className="text-[11px] font-bold text-cu-danger mb-2.5 uppercase tracking-wider">
            Everything that will be deleted
          </p>
          <ul className="space-y-1.5">
            {[
              'All tasks, subtasks, and their attachments',
              'All sprint data, boards, and history',
              'All team member associations',
              'All custom fields and configurations',
              'All milestones and project documents',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs text-cu-danger">
                <span className="mt-[5px] w-1.5 h-1.5 rounded-full bg-cu-danger shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Confirm input */}
        <div className="px-5 sm:px-6 pb-4">
          <label className="block text-xs font-semibold text-cu-text-secondary mb-2">
            Type{' '}
            <span className="font-mono bg-cu-bg-secondary text-cu-text-primary px-1.5 py-0.5 rounded text-[11px] border border-cu-border">
              {projectName}
            </span>{' '}
            to confirm:
          </label>
          <input
            autoFocus
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={projectName}
            disabled={isDeleting}
            className="w-full border border-cu-border rounded-xl px-3.5 py-2.5 text-sm text-cu-text-primary placeholder:text-cu-text-muted focus:outline-none focus:ring-2 focus:ring-cu-danger/20 focus:border-cu-danger transition-all disabled:opacity-60 bg-cu-bg"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canDelete && !isDeleting) onConfirm();
            }}
          />
          {confirmText.length > 0 && !canDelete && (
            <p className="mt-1.5 text-[11px] text-cu-danger flex items-center gap-1">
              <span className="inline-block w-1 h-1 rounded-full bg-cu-danger mt-0.5" />
              Project name does not match
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 sm:px-6 pb-5 sm:pb-6 flex gap-3">
          <button
            onClick={handleClose}
            disabled={isDeleting}
            className="flex-1 h-10 border border-cu-border rounded-xl text-sm font-medium text-cu-text-secondary hover:bg-cu-hover hover:text-cu-text-primary transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canDelete || isDeleting}
            className="flex-1 h-10 bg-cu-danger text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 size={14} />
                Delete Project
              </>
            )}
          </button>
        </div>
      </div>
      </div>
    </OverlayPortal>
  );
}

// ── Leave confirmation modal ───────────────────────────────────────────────────

function LeaveConfirmModal({
  open,
  projectName,
  onClose,
  onConfirm,
  isLeaving,
}: {
  open: boolean;
  projectName: string;
  onClose: () => void;
  onConfirm: () => void;
  isLeaving: boolean;
}) {
  if (!open) return null;

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-[var(--cu-z-modal)] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={!isLeaving ? onClose : undefined}
      />
      <div className="relative bg-cu-bg w-full sm:rounded-2xl sm:max-w-md shadow-cu-xl border-0 sm:border sm:border-cu-border rounded-t-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-full bg-cu-warning/10 ring-4 ring-cu-warning/10 flex items-center justify-center shrink-0">
              <LogOut size={22} className="text-cu-warning" />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <h3 className="text-base font-bold text-cu-text-primary">Leave Project</h3>
              <p className="text-sm text-cu-text-secondary mt-0.5">
                You will lose access to{' '}
                <span className="font-semibold text-cu-text-primary">{projectName}</span> immediately.
              </p>
            </div>
            {!isLeaving && (
              <button
                onClick={onClose}
                className="p-1.5 text-cu-text-muted hover:text-cu-text-primary hover:bg-cu-hover rounded-lg transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="mx-5 sm:mx-6 mb-4 bg-cu-warning/10 border border-cu-warning/20 rounded-xl p-4">
          <p className="text-[11px] font-bold text-cu-warning mb-2.5 uppercase tracking-wider">
            What happens when you leave
          </p>
          <ul className="space-y-1.5">
            {[
              'You will be removed from the project team',
              'Your task assignments will be unassigned',
              'You will no longer receive project notifications',
              'An admin can re-invite you later if needed',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs text-cu-warning">
                <span className="mt-[5px] w-1.5 h-1.5 rounded-full bg-cu-warning shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="px-5 sm:px-6 pb-5 sm:pb-6 flex gap-3">
          <button
            onClick={onClose}
            disabled={isLeaving}
            className="flex-1 h-10 border border-cu-border rounded-xl text-sm font-medium text-cu-text-secondary hover:bg-cu-hover hover:text-cu-text-primary transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLeaving}
            className="flex-1 h-10 bg-cu-warning text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLeaving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Leaving...
              </>
            ) : (
              <>
                <LogOut size={14} />
                Leave Project
              </>
            )}
          </button>
        </div>
      </div>
      </div>
    </OverlayPortal>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ProjectSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = Number(params.id);

  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);

  // General form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [generalSaved, setGeneralSaved] = useState(false);

  // Figma form
  const [figmaInput, setFigmaInput] = useState('');
  const [isSavingFigma, setIsSavingFigma] = useState(false);
  const [figmaSaved, setFigmaSaved] = useState(false);
  const [figmaError, setFigmaError] = useState('');

  // Delete
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Leave
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const currentUserId = getUserIdFromToken();
  const isOwner = project !== null && currentUserId !== null && project.ownerId === currentUserId;

  const isDirtyGeneral =
    project !== null &&
    (name.trim() !== project.name || description.trim() !== project.description);

  const fetchProject = useCallback(async () => {
    if (isNaN(projectId)) return;
    setLoading(true);
    try {
      const data = await projectsApi.fetchProjectDetails(String(projectId));
      const pd: ProjectData = {
        id: data.id,
        name: data.name,
        description: typeof data.description === 'string' ? data.description : '',
        projectKey: data.projectKey,
        type: (data.type as ProjectType | undefined) ?? 'KANBAN',
        teamId: typeof data.teamId === 'number' ? data.teamId : undefined,
        teamName: data.teamName,
        ownerId: typeof data.ownerId === 'number' ? data.ownerId : undefined,
        ownerName: typeof data.ownerName === 'string' ? data.ownerName : undefined,
        createdAt: typeof data.createdAt === 'string' ? data.createdAt : undefined,
        figmaUrl: typeof data.figmaUrl === 'string' ? data.figmaUrl : null,
      };
      setProject(pd);
      setName(pd.name);
      setDescription(pd.description);
      setFigmaInput(pd.figmaUrl ?? '');
    } catch {
      toast('Failed to load project details', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { queueMicrotask(() => void fetchProject()); }, [fetchProject]);

  const handleSaveGeneral = async () => {
    if (!project || !isDirtyGeneral) return;
    setIsSavingGeneral(true);
    try {
      await projectsApi.updateProjectDetails(projectId, {
        name: name.trim(),
        description: description.trim(),
      });
      setProject((prev) =>
        prev ? { ...prev, name: name.trim(), description: description.trim() } : null
      );
      setScopedProjectValue('currentProjectName', name.trim());
      window.dispatchEvent(new Event('storage'));
      setGeneralSaved(true);
      setTimeout(() => setGeneralSaved(false), 3000);
      toast('Project updated successfully', 'success');
    } catch {
      toast('Failed to update project', 'error');
    } finally {
      setIsSavingGeneral(false);
    }
  };

  const handleSaveFigmaUrl = async () => {
    setFigmaError('');
    const trimmed = figmaInput.trim();
    let normalized: string | null = null;
    if (trimmed) {
      const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      try {
        const url = new URL(withProtocol);
        normalized = url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
      } catch { /* fall through */ }
      if (!normalized) { setFigmaError('Enter a valid URL.'); return; }
    }
    setIsSavingFigma(true);
    try {
      await projectsApi.updateProjectDetails(projectId, { figmaUrl: normalized });
      setProject((prev) => prev ? { ...prev, figmaUrl: normalized } : null);
      window.dispatchEvent(new Event('storage'));
      setFigmaSaved(true);
      setTimeout(() => setFigmaSaved(false), 3000);
      toast(normalized ? 'Figma link saved' : 'Figma link removed', 'success');
    } catch {
      toast('Failed to save Figma link', 'error');
    } finally {
      setIsSavingFigma(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    if (!project.teamId) {
      toast('Cannot delete: team information is missing', 'error');
      setShowDeleteModal(false);
      return;
    }
    setIsDeleting(true);
    try {
      await projectsApi.deleteProject(projectId, project.teamId);
      removeScopedProjectValue('currentProjectId');
      removeScopedProjectValue('currentProjectName');
      removeScopedProjectValue('currentProjectType');
      window.dispatchEvent(new Event('storage'));
      toast('Project deleted successfully', 'success');
      router.push('/spaces');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to delete project. Please try again.';
      toast(msg, 'error');
      setIsDeleting(false);
    }
  };

  const handleLeaveProject = async () => {
    setIsLeaving(true);
    try {
      await projectsApi.leaveProject(projectId);
      removeScopedProjectValue('currentProjectId');
      removeScopedProjectValue('currentProjectName');
      removeScopedProjectValue('currentProjectType');
      window.dispatchEvent(new Event('storage'));
      toast('You have left the project', 'success');
      router.push('/spaces');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to leave project. Please try again.';
      toast(msg, 'error');
      setIsLeaving(false);
    }
  };

  if (isNaN(projectId)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-sm text-cu-danger">Invalid project ID.</p>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-full bg-cu-bg-secondary">

        {/* ── Loading ───────────────────────────────────────────────── */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-20">
            <Loader2 size={26} className="animate-spin text-cu-text-muted" />
            <p className="text-sm text-cu-text-muted">Loading settings...</p>
          </div>
        )}

        {/* ── Content grid ──────────────────────────────────────────── */}
        {!loading && (
          <div className="px-6 py-6 pb-20">
            <div className="mx-auto max-w-6xl columns-1 lg:columns-2 gap-5">

              {/* General */}
              <div className="mb-5 break-inside-avoid">
                <SectionCard
                  title="General"
                  description="Project name and description"
                  icon={<FileText size={15} />}
                >
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-cu-text-secondary mb-1.5">
                        Project Name
                      </label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter project name"
                        className="w-full border border-cu-border rounded-xl px-3.5 py-2.5 text-sm text-cu-text-primary placeholder:text-cu-text-muted focus:outline-none focus:ring-2 focus:ring-cu-primary/20 focus:border-cu-primary transition-all bg-cu-bg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-cu-text-secondary mb-1.5">
                        Description
                        <span className="ml-1.5 font-normal text-cu-text-muted">(optional)</span>
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe what this project is about..."
                        rows={4}
                        className="w-full border border-cu-border rounded-xl px-3.5 py-2.5 text-sm text-cu-text-primary placeholder:text-cu-text-muted focus:outline-none focus:ring-2 focus:ring-cu-primary/20 focus:border-cu-primary transition-all bg-cu-bg resize-none"
                      />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <div className="h-5">
                        {generalSaved && (
                          <span className="flex items-center gap-1.5 text-xs text-cu-success">
                            <CheckCircle2 size={13} />
                            Changes saved
                          </span>
                        )}
                      </div>
                      <button
                        onClick={handleSaveGeneral}
                        disabled={!isDirtyGeneral || isSavingGeneral}
                        className="h-9 px-5 bg-cu-primary text-white text-sm font-semibold rounded-xl hover:bg-cu-primary-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-cu-sm"
                      >
                        {isSavingGeneral && <Loader2 size={13} className="animate-spin" />}
                        {isSavingGeneral ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                </SectionCard>
              </div>

              {/* Figma Integration */}
              <div className="mb-5 break-inside-avoid">
                <SectionCard
                  title="Figma Integration"
                  description="Shared design link for all project members"
                  icon={<Figma size={15} />}
                >
                  <div className="space-y-4">
                    {/* Show current link for everyone */}
                    {project?.figmaUrl && (
                      <div className="flex min-w-0 items-center gap-2 rounded-xl border border-cu-border bg-cu-bg-secondary px-3.5 py-2.5">
                        <Figma size={14} className="text-[#F24E1E] shrink-0" />
                        <Link
                          href={getProjectFigmaPath(projectId)}
                          className="min-w-0 flex-1 truncate text-sm font-medium text-cu-primary hover:underline"
                        >
                          {project.figmaUrl}
                        </Link>
                      </div>
                    )}
                    {!project?.figmaUrl && !isOwner && (
                      <p className="text-sm text-cu-text-muted italic">No Figma link configured for this project.</p>
                    )}

                    {/* Edit form — owner only */}
                    {isOwner && (
                      <>
                        <div>
                          <label className="block text-xs font-semibold text-cu-text-secondary mb-1.5">
                            {project?.figmaUrl ? 'Update Figma URL' : 'Add Figma URL'}
                          </label>
                          <input
                            value={figmaInput}
                            onChange={(e) => { setFigmaInput(e.target.value); setFigmaError(''); }}
                            placeholder="https://www.figma.com/file/..."
                            className={`w-full border rounded-xl px-3.5 py-2.5 text-sm text-cu-text-primary placeholder:text-cu-text-muted focus:outline-none focus:ring-2 focus:ring-cu-primary/20 focus:border-cu-primary transition-all bg-cu-bg ${
                              figmaError ? 'border-red-400' : 'border-cu-border'
                            }`}
                          />
                          {figmaError && <p className="mt-1.5 text-xs text-cu-danger">{figmaError}</p>}
                          {project?.figmaUrl && (
                            <p className="mt-1 text-xs text-cu-text-muted">Leave blank and save to remove the link.</p>
                          )}
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <div className="h-5">
                            {figmaSaved && (
                              <span className="flex items-center gap-1.5 text-xs text-cu-success">
                                <CheckCircle2 size={13} />
                                Saved
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => void handleSaveFigmaUrl()}
                            disabled={isSavingFigma}
                            className="h-9 px-5 bg-cu-primary text-white text-sm font-semibold rounded-xl hover:bg-cu-primary-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-cu-sm"
                          >
                            {isSavingFigma && <Loader2 size={13} className="animate-spin" />}
                            {isSavingFigma ? 'Saving...' : figmaInput.trim() ? 'Save Link' : (project?.figmaUrl ? 'Remove Link' : 'Save')}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </SectionCard>
              </div>

              {/* Custom Fields */}
              <div className="mb-5 break-inside-avoid">
                <SectionCard
                  title="Custom Fields"
                  description="Add extra fields to all tasks in this project"
                  icon={<Settings2 size={15} />}
                >
                  <CustomFieldsManager projectId={projectId} />
                </SectionCard>
              </div>

              {/* Recurring Tasks */}
              <div className="mb-5 break-inside-avoid">
                <SectionCard
                  title="Recurring Tasks"
                  description="Manage automated recurring schedules and template tasks in this project"
                  icon={<RefreshCw size={15} />}
                >
                  <RecurringSchedulesManager projectId={projectId} />
                </SectionCard>
              </div>

              {/* GitHub Auto-Transitions */}
              <div className="mb-5 break-inside-avoid">
                <GitHubAutoTransitionsCard projectId={projectId} />
              </div>

              {/* Notification Preferences */}
              <div className="mb-5 break-inside-avoid">
                <NotificationPreferencesPanel
                  title="Project notification overrides"
                  description="Fine-tune which events in this project should notify you, without changing your global defaults."
                  projectId={projectId}
                  helperText="These overrides only affect this project. If no project override exists, your global notification defaults still apply."
                />
              </div>

              {/* Project Identity */}
              {project && (
                <div className="mb-5 break-inside-avoid">
                  <SectionCard
                    title="Project Identity"
                    description="Read-only metadata"
                    icon={<Info size={15} />}
                  >
                    <div className="space-y-3">
                      {[
                        { label: 'Project Key', value: project.projectKey },
                        {
                          label: 'Created',
                          value: project.createdAt
                            ? formatDate(project.createdAt, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                            : undefined,
                        },
                        { label: 'Team', value: project.teamName },
                        { label: 'Owner', value: project.ownerName },
                      ]
                        .filter((f) => f.value)
                        .map(({ label, value }) => (
                          <div key={label}>
                            <p className="text-[11px] font-semibold text-cu-text-muted uppercase tracking-wide mb-1.5">
                              {label}
                            </p>
                            <div className="h-9 px-3.5 border border-cu-border rounded-xl bg-cu-bg-secondary flex items-center">
                              <span className="text-sm text-cu-text-primary font-medium truncate">{value}</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </SectionCard>
                </div>
              )}

              {/* Danger Zone */}
              <div className="mb-5 break-inside-avoid">
                <div className="bg-cu-bg rounded-2xl border-2 border-cu-danger/20 overflow-hidden shadow-cu-sm">
                  <div className="px-5 py-4 border-b border-cu-danger/20 bg-cu-danger/10">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-cu-danger/10 border border-cu-danger/20 flex items-center justify-center text-cu-danger shrink-0">
                        <Shield size={15} />
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-cu-danger">Danger Zone</h2>
                        <p className="text-xs text-cu-danger mt-0.5">Irreversible actions</p>
                      </div>
                    </div>
                  </div>
                  <div className="px-5 py-5 space-y-4">
                    {/* Leave — visible to non-owners only */}
                    {!isOwner && (
                      <div>
                        <h3 className="text-sm font-semibold text-cu-text-primary mb-1">Leave this project</h3>
                        <p className="text-xs text-cu-text-secondary leading-relaxed mb-3">
                          Remove yourself from the project team. Your task assignments will be cleared.
                        </p>
                        <button
                          onClick={() => setShowLeaveModal(true)}
                          className="w-full h-9 bg-cu-bg border-2 border-cu-warning/30 text-cu-warning text-sm font-semibold rounded-xl hover:bg-cu-warning/10 hover:border-cu-warning/45 transition-all flex items-center justify-center gap-2"
                        >
                          <LogOut size={14} />
                          Leave Project
                        </button>
                      </div>
                    )}

                    {/* Delete — visible to owners only */}
                    {isOwner && (
                      <div>
                        <h3 className="text-sm font-semibold text-cu-text-primary mb-1">Delete this project</h3>
                        <p className="text-xs text-cu-text-secondary leading-relaxed mb-3">
                          Permanently removes all tasks, members, and sprints. This cannot be reversed.
                        </p>
                        <button
                          onClick={() => setShowDeleteModal(true)}
                          className="w-full h-9 bg-cu-bg border-2 border-cu-danger/30 text-cu-danger text-sm font-semibold rounded-xl hover:bg-cu-danger/10 hover:border-cu-danger/45 transition-all flex items-center justify-center gap-2"
                        >
                          <Trash2 size={14} />
                          Delete Project
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Portals */}
      {project && (
        <>
          <DeleteConfirmModal
            open={showDeleteModal}
            projectName={project.name}
            onClose={() => !isDeleting && setShowDeleteModal(false)}
            onConfirm={handleDeleteProject}
            isDeleting={isDeleting}
          />
          <LeaveConfirmModal
            open={showLeaveModal}
            projectName={project.name}
            onClose={() => !isLeaving && setShowLeaveModal(false)}
            onConfirm={handleLeaveProject}
            isLeaving={isLeaving}
          />
        </>
      )}
    </>
  );
}
