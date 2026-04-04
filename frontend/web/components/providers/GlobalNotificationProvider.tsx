'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import SockJS from 'sockjs-client';
import { CompatClient, Stomp } from '@stomp/stompjs';
import * as notificationsApi from '@/services/notifications-service';
import { Notification } from '@/services/notifications-service';
import { toast } from '@/components/ui/Toast';

interface GlobalNotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const GlobalNotificationContext = createContext<GlobalNotificationContextType | undefined>(undefined);

export function GlobalNotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const pathname = usePathname();
  // We use refs to avoid re-triggering stomp effects on route path transitions
  const pathnameRef = useRef(pathname);
  
  const stompClientRef = useRef<CompatClient | null>(null);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const loadInitialData = async () => {
    try {
      const [notifs, count] = await Promise.all([
        notificationsApi.fetchNotifications(),
        notificationsApi.fetchUnreadCount(),
      ]);
      setNotifications(notifs);
      setUnreadCount(count);
    } catch (e) {
      console.error('Failed to load initial notifications', e);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    queueMicrotask(() => {
      void loadInitialData();
    });

    const client = Stomp.over(() => new SockJS('http://localhost:8080/ws'));
    client.debug = () => {}; 
    client.reconnect_delay = 5000;
    
    stompClientRef.current = client;

    client.connect({ Authorization: `Bearer ${token}` }, () => {
      client.subscribe('/user/queue/notifications', (payload) => {
        const newNotif: Notification = JSON.parse(payload.body);
        
        // Add to state
        setNotifications((prev) => {
          // Prevent duplicates incase of reconnects
          if (prev.some((n) => n.id === newNotif.id)) return prev;
          return [newNotif, ...prev];
        });

        // Current navigation path check
        const currentPath = pathnameRef.current;
        const targetPath = (newNotif.link as string) || '';
        
        // Conditional toast display: 
        // Example: If link is /project/123/chat and we are ON /project/123/chat, suppress toast.
        // We do a loose match (starts with or exactly equal) depending on route structure.
        const isOnRelevantPage = currentPath && targetPath && currentPath.includes(targetPath);

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
    });

    return () => {
      if (stompClientRef.current && stompClientRef.current.connected) {
        stompClientRef.current.disconnect();
      }
    };
  }, []);

  const markAsRead = async (id: number) => {
    try {
      await notificationsApi.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((notif) => (notif.id === id ? { ...notif, read: true } : notif))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      console.error(e);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationsApi.markAllNotificationsRead();
      setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <GlobalNotificationContext.Provider
      value={{ notifications, unreadCount, markAsRead, markAllAsRead }}
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
