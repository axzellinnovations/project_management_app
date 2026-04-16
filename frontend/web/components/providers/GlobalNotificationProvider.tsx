'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Client, IMessage } from '@stomp/stompjs';
import * as notificationsApi from '@/services/notifications-service';
import { Notification } from '@/services/notifications-service';
import { toast } from '@/components/ui/Toast';
import { AUTH_TOKEN_CHANGED_EVENT, getValidToken } from '@/lib/auth';
import { buildSessionCacheKey, getSessionCache, setSessionCache } from '@/lib/session-cache';

interface GlobalNotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  realtimeConnected: boolean;
  subscribeRealtime: (
    destination: string,
    callback: (message: IMessage) => void,
  ) => { unsubscribe: () => void } | null;
  sendRealtime: (
    destination: string,
    body: string,
    headers?: Record<string, string>,
  ) => void;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotificationById: (id: number) => Promise<void>;
  deleteAllNotifications: () => Promise<{ deleted: number; failed: number }>;
}

const GlobalNotificationContext = createContext<GlobalNotificationContextType | undefined>(undefined);

const CHAT_PATH_PATTERN = /^\/project\/\d+\/chat\/?$/i;
const NOTIFICATIONS_CACHE_TTL_MS = 45_000;

type NotificationsCachePayload = {
  notifications: Notification[];
  unreadCount: number;
};

function normalizePath(path: string): string {
  if (!path) return '';
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return normalized.endsWith('/') && normalized !== '/' ? normalized.slice(0, -1) : normalized;
}

function isOnRelevantRoute(currentPath: string | null, currentQuery: string, targetLink: string): boolean {
  if (!currentPath || !targetLink) return false;

  let targetPath = '';
  let targetParams = new URLSearchParams();

  try {
    const parsed = new URL(targetLink, 'http://localhost');
    targetPath = normalizePath(parsed.pathname);
    targetParams = parsed.searchParams;
  } catch {
    return false;
  }

  const currentNormalized = normalizePath(currentPath);

  if (CHAT_PATH_PATTERN.test(targetPath)) {
    if (currentNormalized !== targetPath) return false;

    const currentParams = new URLSearchParams(currentQuery || '');
    const targetEntries = Array.from(targetParams.entries());

    if (targetEntries.length === 0) {
      // Generic /chat links are only "active" when user is on the base chat route.
      return currentParams.toString().length === 0;
    }

    return targetEntries.every(([key, value]) => currentParams.get(key) === value);
  }

  return currentNormalized.includes(targetPath);
}

export function GlobalNotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const pathname = usePathname();
  // We use refs to avoid re-triggering stomp effects on route path transitions
  const pathnameRef = useRef(pathname);
  const searchRef = useRef('');
  const seenNotificationIdsRef = useRef<Set<number>>(new Set());
  const notificationsCacheKeyRef = useRef<string | null>(null);
  const stompClientRef = useRef<Client | null>(null);
  const activeTokenRef = useRef<string | null>(null);
  const isConnectingRef = useRef(false);
  const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

  useEffect(() => {
    pathnameRef.current = pathname;
    if (typeof window !== 'undefined') {
      searchRef.current = window.location.search.replace(/^\?/, '');
    }
  }, [pathname]);

  const loadInitialData = useCallback(async () => {
    try {
      const [notifs, count] = await Promise.all([
        notificationsApi.fetchNotifications(),
        notificationsApi.fetchUnreadCount(),
      ]);
      setNotifications(notifs);
      setUnreadCount(count);
      seenNotificationIdsRef.current = new Set(notifs.map((notif) => notif.id));
      const cacheKey = notificationsCacheKeyRef.current;
      if (cacheKey) {
        setSessionCache<NotificationsCachePayload>(
          cacheKey,
          {
            notifications: notifs,
            unreadCount: count,
          },
          NOTIFICATIONS_CACHE_TTL_MS,
        );
      }
    } catch (e) {
      console.error('Failed to load initial notifications', e);
    }
  }, []);

  const disconnectClient = useCallback(() => {
    isConnectingRef.current = false;
    setRealtimeConnected(false);
    if (stompClientRef.current) {
      stompClientRef.current.deactivate();
      stompClientRef.current = null;
    }
  }, []);

  const connectRealtime = useCallback((token: string) => {
    const hasSameActiveConnection =
      stompClientRef.current?.connected && activeTokenRef.current === token;

    if (hasSameActiveConnection || (isConnectingRef.current && activeTokenRef.current === token)) {
      return;
    }

    disconnectClient();
    isConnectingRef.current = true;
    activeTokenRef.current = token;

    const wsUrl = backendUrl.replace(/^http/, 'ws');
    const client = new Client({
      brokerURL: `${wsUrl}/ws-native`,
      connectHeaders: { Authorization: `Bearer ${token}` },
      debug: () => {},
      reconnectDelay: 5000,
      onConnect: () => {
        isConnectingRef.current = false;
        setRealtimeConnected(true);

        if (stompClientRef.current !== client) {
          return;
        }

        client.subscribe('/user/queue/notifications', (payload) => {
          const newNotif: Notification = JSON.parse(payload.body);
          if (seenNotificationIdsRef.current.has(newNotif.id)) {
            return;
          }

          seenNotificationIdsRef.current.add(newNotif.id);

          // Add to state
          setNotifications((prev) => {
            return [newNotif, ...prev];
          });

          // Keep chat inbox badges synchronized with realtime notifications.
          window.dispatchEvent(new CustomEvent('planora:chat-inbox-updated'));

          // Current navigation path check
          const currentPath = pathnameRef.current;
          const currentQuery = searchRef.current;
          const targetPath = (newNotif.link as string) || '';

          const isOnRelevantPage = isOnRelevantRoute(currentPath, currentQuery, targetPath);

          if (!isOnRelevantPage) {
            setUnreadCount((prev) => prev + 1);
            toast(newNotif.message, 'info', 5000);
          } else {
            // If we're on the relevant page, we can instantly mark it as read behind the scenes
            notificationsApi.markNotificationRead(newNotif.id).catch(() => {});
            setNotifications((prev) =>
              prev.map((n) => (n.id === newNotif.id ? { ...n, read: true } : n))
            );
          }
        });
      },
      onStompError: () => {
        isConnectingRef.current = false;
        setRealtimeConnected(false);
      },
      onWebSocketClose: () => {
        isConnectingRef.current = false;
        setRealtimeConnected(false);
      },
    });

    stompClientRef.current = client;
    client.activate();
  }, [backendUrl, disconnectClient]);

  const syncAuthAndConnection = useCallback(() => {
    const token = getValidToken();

    if (!token) {
      activeTokenRef.current = null;
      notificationsCacheKeyRef.current = null;
      disconnectClient();
      setNotifications([]);
      setUnreadCount(0);
      seenNotificationIdsRef.current.clear();
      return;
    }

    const nextCacheKey = buildSessionCacheKey('notifications', ['global'], token);
    notificationsCacheKeyRef.current = nextCacheKey;

    const tokenChanged = activeTokenRef.current !== token;

    if (tokenChanged) {
      setNotifications([]);
      setUnreadCount(0);
      seenNotificationIdsRef.current.clear();
    }

    let shouldLoadInitialData = tokenChanged;
    if (nextCacheKey) {
      const cached = getSessionCache<NotificationsCachePayload>(nextCacheKey, { allowStale: true });
      if (cached.data) {
        setNotifications(cached.data.notifications || []);
        setUnreadCount(Number(cached.data.unreadCount) || 0);
        seenNotificationIdsRef.current = new Set((cached.data.notifications || []).map((notif) => notif.id));
        if (!cached.isStale) {
          shouldLoadInitialData = false;
        }
      }
    }

    if (shouldLoadInitialData) {
      void loadInitialData();
    }

    if (tokenChanged || !stompClientRef.current?.connected) {
      connectRealtime(token);
    }
  }, [connectRealtime, disconnectClient, loadInitialData]);

  useEffect(() => {
    const cacheKey = notificationsCacheKeyRef.current;
    if (!cacheKey) return;

    setSessionCache<NotificationsCachePayload>(
      cacheKey,
      {
        notifications,
        unreadCount,
      },
      NOTIFICATIONS_CACHE_TTL_MS,
    );
  }, [notifications, unreadCount]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'token' || event.key === null) {
        syncAuthAndConnection();
      }
    };

    const handleAuthTokenChanged = () => {
      syncAuthAndConnection();
    };

    const handleFocus = () => {
      syncAuthAndConnection();
    };

    const handleVisibility = () => {
      if (!document.hidden) {
        syncAuthAndConnection();
      }
    };

    const initialSyncTimer = window.setTimeout(() => {
      syncAuthAndConnection();
    }, 0);

    window.addEventListener('storage', handleStorage);
    window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, handleAuthTokenChanged);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, handleAuthTokenChanged);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearTimeout(initialSyncTimer);

      activeTokenRef.current = null;
      disconnectClient();
    };
  }, [syncAuthAndConnection, disconnectClient]);

  const subscribeRealtime = useCallback(
    (
      destination: string,
      callback: (message: IMessage) => void,
    ): { unsubscribe: () => void } | null => {
      const client = stompClientRef.current;
      if (!client?.connected) return null;
      return client.subscribe(destination, callback);
    },
    [],
  );

  const sendRealtime = useCallback(
    (destination: string, body: string, headers?: Record<string, string>) => {
      const client = stompClientRef.current;
      if (!client?.connected) return;
      client.send(destination, headers || {}, body);
    },
    [],
  );

  const markAsRead = async (id: number) => {
    try {
      await notificationsApi.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((notif) => (notif.id === id ? { ...notif, read: true } : notif))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationsApi.markAllNotificationsRead();
      setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const deleteNotificationById = async (id: number) => {
    await notificationsApi.deleteNotification(id);
    setNotifications((prev) => {
      const next = prev.filter((notif) => notif.id !== id);
      setUnreadCount(next.filter((notif) => !notif.read).length);
      return next;
    });
  };

  const deleteAllNotifications = async (): Promise<{ deleted: number; failed: number }> => {
    const ids = notifications.map((notification) => notification.id);
    if (ids.length === 0) {
      return { deleted: 0, failed: 0 };
    }

    const results = await notificationsApi.deleteAllNotifications(ids);
    const successfulIds = new Set<number>();

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successfulIds.add(ids[index]);
      }
    });

    setNotifications((prev) => {
      const next = prev.filter((notif) => !successfulIds.has(notif.id));
      setUnreadCount(next.filter((notif) => !notif.read).length);
      return next;
    });

    return {
      deleted: successfulIds.size,
      failed: ids.length - successfulIds.size,
    };
  };

  return (
    <GlobalNotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        realtimeConnected,
        subscribeRealtime,
        sendRealtime,
        markAsRead,
        markAllAsRead,
        deleteNotificationById,
        deleteAllNotifications,
      }}
    >
      {children}
    </GlobalNotificationContext.Provider>
  );
}

export function useGlobalNotifications() {
  const context = useContext(GlobalNotificationContext);
  if (context === undefined) {
    throw new Error('useGlobalNotifications must be used within a GlobalNotificationProvider');
  }
  return context;
}
