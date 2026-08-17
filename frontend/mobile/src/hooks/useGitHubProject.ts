import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { offlineSyncManager } from '../services/offlineSyncManager';
import { projectService } from '../services/project-service';
import { getCurrentUserId } from '../auth/storage';
import {
  clearGitHubAccountCache,
  clearGitHubToken,
  fetchGitHubConnectionStatus,
  fetchGitHubNotifications,
  fetchGitHubUser,
  fetchImportedGitHubIssueNumbers,
  fetchProjectCommits,
  fetchProjectGitHubStats,
  fetchProjectIssues,
  fetchProjectPullRequests,
  fetchRepositoriesWithToken,
  getProjectGitHubRepo,
  getSavedGitHubAccounts,
  markAllGitHubNotificationsRead,
  markGitHubNotificationRead,
  saveGitHubAccount,
  setProjectGitHubRepo,
  syncProjectGitHub,
  unlinkProjectGitHubRepository,
  type GitHubNotification,
  type GitHubRepository,
  type GitHubUser,
  type GitHubPullRequest,
  type GitHubCommit,
  type GitHubIssue,
  type GitHubStats,
  type ProjectGitHubConnection,
  type SavedGitHubAccount,
} from '../services/githubMobileService';
import { useGitHubRealtime, type GitHubCiEvent as RealtimeCiEvent } from './useGitHubRealtime';
import { GITHUB_TASK_BADGE_EVENT } from '../realtime/events';

export type GitHubRouteState = 'initializing' | 'needsAccount' | 'needsRepository' | 'connected' | 'offline' | 'error';

function messageFromError(error: unknown, fallback: string): string {
  const responseMessage = (error as any)?.response?.data?.message ?? (error as any)?.response?.data?.error;
  if (typeof responseMessage === 'string' && responseMessage.trim()) return responseMessage;
  if ((error as any)?.response?.status === 401) return 'Reconnect your GitHub account to continue.';
  if ((error as any)?.response?.status === 403) return 'You do not have permission to perform this GitHub action.';
  if ((error as any)?.response?.status === 404) return 'The GitHub repository is unavailable or no longer accessible.';
  if ((error as any)?.response?.status === 429) return 'GitHub rate limit reached. Please try again later.';
  return error instanceof Error ? error.message : fallback;
}

export function useGitHubProject(projectId: string) {
  const [routeState, setRouteState] = useState<GitHubRouteState>('initializing');
  const [error, setError] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [connection, setConnection] = useState<ProjectGitHubConnection | null>(null);
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [savedAccounts, setSavedAccounts] = useState<SavedGitHubAccount[]>([]);
  const [pullRequests, setPullRequests] = useState<GitHubPullRequest[]>([]);
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [notifications, setNotifications] = useState<GitHubNotification[]>([]);
  const [stats, setStats] = useState<GitHubStats | null>(null);
  const [importedIssues, setImportedIssues] = useState<Set<number>>(new Set());
  const [members, setMembers] = useState<any[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingRepositories, setLoadingRepositories] = useState(false);
  const [latestCi, setLatestCi] = useState<RealtimeCiEvent | null>(null);
  const [liveNotice, setLiveNotice] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(offlineSyncManager.getOnlineStatus());
  const seenRealtimeEvents = useRef(new Set<string>());

  const acceptRealtimeEvent = useCallback((key: string): boolean => {
    if (seenRealtimeEvents.current.has(key)) return false;
    seenRealtimeEvents.current.add(key);
    if (seenRealtimeEvents.current.size > 100) {
      const oldest = seenRealtimeEvents.current.values().next().value;
      if (oldest) seenRealtimeEvents.current.delete(oldest);
    }
    return true;
  }, []);

  const loadActivity = useCallback(async (repo: ProjectGitHubConnection, synchronize = false) => {
    setLoading(true);
    setActivityError(null);
    try {
      if (synchronize) await syncProjectGitHub(projectId);
      const results = await Promise.allSettled([
        fetchProjectPullRequests(projectId),
        fetchProjectCommits(projectId),
        fetchProjectIssues(projectId),
        fetchProjectGitHubStats(projectId),
        fetchGitHubNotifications(repo.repoFullName),
        fetchImportedGitHubIssueNumbers(projectId, repo.repoFullName),
      ]);
      if (results[0].status === 'fulfilled') setPullRequests(results[0].value);
      if (results[1].status === 'fulfilled') setCommits(results[1].value);
      if (results[2].status === 'fulfilled') setIssues(results[2].value);
      if (results[3].status === 'fulfilled') setStats(results[3].value);
      if (results[4].status === 'fulfilled') setNotifications(results[4].value);
      if (results[5].status === 'fulfilled') setImportedIssues(new Set(results[5].value));
      const failed = results.filter(result => result.status === 'rejected');
      if (failed.length) setActivityError('Some GitHub activity could not be refreshed. Existing data is still shown.');
    } catch (requestError) {
      setActivityError(messageFromError(requestError, 'GitHub activity could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const initialize = useCallback(async () => {
    setRouteState('initializing');
    setError(null);
    try {
      const status = await fetchGitHubConnectionStatus();
      if (!status.connected) {
        setRouteState('needsAccount');
        return;
      }
      const [githubUser, repo, accounts, projectMembers, currentUserId] = await Promise.all([
        fetchGitHubUser(),
        getProjectGitHubRepo(projectId),
        getSavedGitHubAccounts(),
        projectService.getMembersCached(projectId).catch(() => []),
        getCurrentUserId(),
      ]);
      setUser(githubUser);
      await saveGitHubAccount(githubUser);
      setSavedAccounts(accounts.some(item => item.login === githubUser.login)
        ? accounts
        : [{ login: githubUser.login, name: githubUser.name, avatarUrl: githubUser.avatar_url }, ...accounts]);
      setMembers(projectMembers);
      const me = projectMembers.find((member: any) => (member.user?.userId ?? member.userId) === currentUserId);
      setCanManage(me?.role === 'OWNER' || me?.role === 'ADMIN');
      if (!repo) {
        setRouteState('needsRepository');
        return;
      }
      setConnection(repo);
      setRouteState('connected');
      void loadActivity(repo);
    } catch (requestError) {
      if (!offlineSyncManager.getOnlineStatus()) setRouteState('offline');
      else {
        setError(messageFromError(requestError, 'The GitHub project view could not be initialized.'));
        setRouteState('error');
      }
    }
  }, [loadActivity, projectId]);

  useEffect(() => { void initialize(); }, [initialize]);
  useEffect(() => offlineSyncManager.addListener(event => {
    if (event.type !== 'CONNECTION_CHANGED') return;
    setIsOnline(event.isOnline);
    if (event.isOnline && routeState === 'offline') void initialize();
  }), [initialize, routeState]);

  const loadRepositories = useCallback(async () => {
    setLoadingRepositories(true);
    setError(null);
    try {
      setRepositories(await fetchRepositoriesWithToken());
    } catch (requestError) {
      setError(messageFromError(requestError, 'Repositories could not be loaded.'));
    } finally {
      setLoadingRepositories(false);
    }
  }, []);

  const selectRepository = useCallback(async (repository: GitHubRepository) => {
    setLoadingRepositories(true);
    setPullRequests([]);
    setCommits([]);
    setIssues([]);
    setActivityError(null);
    try {
      const repo = await setProjectGitHubRepo(projectId, repository);
      setConnection(repo);
      setRouteState('connected');
      await loadActivity(repo, true);
    } finally {
      setLoadingRepositories(false);
    }
  }, [loadActivity, projectId]);

  const disconnectAccount = useCallback(async () => {
    await clearGitHubToken();
    await clearGitHubAccountCache();
    setUser(null);
    setRouteState('needsAccount');
  }, []);

  const markNotification = useCallback(async (id: number) => {
    await markGitHubNotificationRead(id);
    setNotifications(current => current.map(item => item.id === id ? { ...item, read: true } : item));
  }, []);

  const markAllNotifications = useCallback(async () => {
    await markAllGitHubNotificationsRead(notifications);
    setNotifications(current => current.map(item => ({ ...item, read: true })));
  }, [notifications]);

  const realtime = useGitHubRealtime(routeState === 'connected' ? projectId : '', {
    onPullRequest: event => {
      const key = `pr:${event.type}:${event.prNumber}`;
      if (!acceptRealtimeEvent(key)) return;
      setLiveNotice(`${event.type === 'opened' ? 'PR opened' : event.type === 'merged' ? 'PR merged' : 'PR closed'}: #${event.prNumber} ${event.prTitle}`);
      if (connection) void fetchProjectPullRequests(projectId).then(setPullRequests);
    },
    onCi: event => {
      if (!acceptRealtimeEvent(`ci:${event.status}:${event.commitSha}`)) return;
      setLatestCi(event);
      if (connection) void fetchProjectCommits(projectId).then(setCommits);
    },
    onIssue: event => {
      if (!acceptRealtimeEvent(`issue:${event.action}:${event.issueNumber}`)) return;
      setLiveNotice(`Issue ${event.action}: #${event.issueNumber} ${event.issueTitle}`);
      if (connection) void fetchProjectIssues(projectId).then(setIssues);
    },
    onTaskBadge: event => {
      if (!acceptRealtimeEvent(`badge:${event.taskId}:${event.issueState}`)) return;
      setImportedIssues(current => new Set(current).add(event.githubIssueNumber));
      setLiveNotice(`Task link updated for issue #${event.githubIssueNumber}`);
      DeviceEventEmitter.emit(GITHUB_TASK_BADGE_EVENT, event);
    },
  });

  const unreadNotifications = useMemo(() => notifications.filter(item => !item.read).length, [notifications]);

  return {
    routeState, error, activityError, connection, user, repositories, savedAccounts,
    pullRequests, commits, issues, notifications, stats, importedIssues, members, canManage,
    loading, loadingRepositories, latestCi, liveNotice, isOnline, unreadNotifications,
    setImportedIssues, setLatestCi, setLiveNotice, initialize, loadActivity, loadRepositories,
    selectRepository, disconnectAccount, markNotification, markAllNotifications, realtime,
  };
}
