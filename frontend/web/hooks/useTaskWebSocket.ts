'use client';

import { useEffect, useRef } from 'react';
import SockJS from 'sockjs-client';
import { CompatClient, Stomp } from '@stomp/stompjs';
import { getValidToken } from '@/lib/auth';

interface TaskEvent {
  type: 'TASK_CREATED' | 'TASK_UPDATED' | 'TASK_DELETED';
  task?: {
    id: number;
    title: string;
    storyPoint: number;
    status: string;
    priority: string;
    sprintId: number | null;
    assigneeName: string | null;
    assigneePhotoUrl: string | null;
    startDate: string | null;
    dueDate: string | null;
  };
  taskId?: number;
}

export function useTaskWebSocket(
  projectId: string | null,
  onEvent: (event: TaskEvent) => void
) {
  const clientRef = useRef<CompatClient | null>(null);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  });

  useEffect(() => {
    if (!projectId) return;

    const token = getValidToken();
    if (!token) return;

    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
    const stompClient = Stomp.over(() => new SockJS(`${backendUrl}/ws`));
    stompClient.debug = () => {};
    stompClient.reconnect_delay = 5000;

    stompClient.connect(
      { Authorization: `Bearer ${token}` },
      () => {
        clientRef.current = stompClient;
        stompClient.subscribe(
          `/topic/project/${projectId}/tasks`,
          (message) => {
            try {
              const event = JSON.parse(message.body) as TaskEvent;
              onEventRef.current(event);
            } catch {
              // ignore parse errors
            }
          }
        );
      },
      (error: unknown) => {
        const errorMessage = typeof error === 'string' ? error : ((error as { headers?: { message?: string } })?.headers?.message || '');
        const isAuthError = errorMessage.toLowerCase().includes('auth') ||
                           errorMessage.toLowerCase().includes('jwt') ||
                           errorMessage.toLowerCase().includes('expired') ||
                           errorMessage.toLowerCase().includes('invalid');

        if (isAuthError) {
          console.error('[task-ws] Fatal authentication error:', errorMessage);
          // Stop retrying on fatal auth errors to avoid backend log spam.
          return;
        }
        // connection error — silent, will auto-reconnect
      }
    );

    return () => {
      if (stompClient.connected) {
        stompClient.disconnect();
      }
      clientRef.current = null;
    };
  }, [projectId]);
}
