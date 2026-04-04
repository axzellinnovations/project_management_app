'use client';

import { useEffect, useRef } from 'react';
import SockJS from 'sockjs-client';
import { CompatClient, Stomp } from '@stomp/stompjs';

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

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    const stompClient = Stomp.over(() => new SockJS('http://localhost:8080/ws'));
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
      () => {
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
