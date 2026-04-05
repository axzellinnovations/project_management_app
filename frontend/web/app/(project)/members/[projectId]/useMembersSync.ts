/**
 * useMembersSync
 *
 * A React hook that connects to the existing STOMP/SockJS WebSocket endpoint
 * (/ws) and subscribes to the project-scoped members topic:
 *
 *   /topic/project/{projectId}/members
 *
 * When the backend broadcasts a MemberEvent (ROLE_CHANGED, MEMBER_REMOVED, or
 * MEMBER_JOINED), this hook applies the change to the local members state
 * immediately — no page reload or polling required.
 *
 * Design decisions:
 *  - Reuses the identical SockJS + STOMP setup already used by the chat system
 *    (same /ws endpoint, same JWT Authorization header pattern, same CompatClient).
 *  - Exponential back-off reconnect (max 30 s) handles transient network drops.
 *  - All cleanup is done in the useEffect return function to prevent leaks.
 *  - The hook is intentionally thin: it only handles WebSocket lifecycle and
 *    state updates. All business logic stays in MembersPageClient.
 */

import { useEffect, useRef, useCallback } from 'react';
import SockJS from 'sockjs-client';
import { CompatClient, Stomp } from '@stomp/stompjs';
import { getValidToken } from '@/lib/auth';

// ── Types that mirror the backend MemberEvent record ───────────────────────────

export type MemberEventAction = 'ROLE_CHANGED' | 'MEMBER_REMOVED' | 'MEMBER_JOINED';

export interface MemberPayload {
  userId: number;
  username: string;
  fullName: string;
  email: string;
  profilePicUrl?: string;
  role: string;
  taskCount: number;
  status: string;
}

export interface MemberEvent {
  action: MemberEventAction;
  userId: number;
  newRole?: string;   // populated when action === 'ROLE_CHANGED'
  member?: MemberPayload; // populated when action === 'MEMBER_JOINED'
}

// ── Member shape (subset — must match MembersPageClient's Member interface) ────

export interface LiveMember {
  id: number;
  role: string;
  user: {
    userId: number;
    username: string;
    fullName: string;
    email: string;
    profilePicUrl?: string;
  };
  taskCount: number;
  status: string;
}

// ── Hook options ───────────────────────────────────────────────────────────────

interface UseMembersSyncOptions {
  /** Called when a ROLE_CHANGED event is received. */
  onRoleChanged: (userId: number, newRole: string) => void;
  /** Called when a MEMBER_REMOVED event is received. */
  onMemberRemoved: (userId: number) => void;
  /** Called when a MEMBER_JOINED event is received. */
  onMemberJoined: (member: MemberPayload) => void;
}

// ── Reconnect configuration ───────────────────────────────────────────────────

const INITIAL_RECONNECT_DELAY_MS = 2_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const RECONNECT_BACKOFF_MULTIPLIER = 2;

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useMembersSync(
  projectId: string,
  { onRoleChanged, onMemberRemoved, onMemberJoined }: UseMembersSyncOptions
) {
  const stompRef = useRef<CompatClient | null>(null);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY_MS);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUnmountedRef = useRef(false);

  // Stable callback refs so the WebSocket closure never captures stale state.
  const onRoleChangedRef = useRef(onRoleChanged);
  const onMemberRemovedRef = useRef(onMemberRemoved);
  const onMemberJoinedRef = useRef(onMemberJoined);

  useEffect(() => { onRoleChangedRef.current = onRoleChanged; }, [onRoleChanged]);
  useEffect(() => { onMemberRemovedRef.current = onMemberRemoved; }, [onMemberRemoved]);
  useEffect(() => { onMemberJoinedRef.current = onMemberJoined; }, [onMemberJoined]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (stompRef.current?.connected) {
      try { stompRef.current.disconnect(); } catch { /* ignore */ }
    }
    stompRef.current = null;
  }, []);

  // Use a ref to resolve the circular dependency/hoisting issue with connect() calling itself in the retry logic.
  const connectRef = useRef<(() => void) | undefined>(undefined);

  const connect = useCallback(() => {
    if (isUnmountedRef.current) return;

    const token = getValidToken();
    if (!token) {
      console.warn('[members-ws] No valid token found, skipping connection.');
      return;
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
    const socket = new SockJS(`${backendUrl}/ws`);
    const client = Stomp.over(socket);

    // Silence the STOMP library's own console noise in production.
    client.debug = process.env.NODE_ENV === 'development'
      ? (msg: string) => console.debug('[members-ws]', msg)
      : () => {};

    stompRef.current = client;

    client.connect(
      { Authorization: `Bearer ${token}` },

      // ── onConnected ──────────────────────────────────────────────────────────
      () => {
        if (isUnmountedRef.current) {
          try { client.disconnect(); } catch { /* ignore */ }
          return;
        }

        // Reset back-off on successful connection.
        reconnectDelayRef.current = INITIAL_RECONNECT_DELAY_MS;

        const topic = `/topic/project/${projectId}/members`;
        client.subscribe(topic, (frame) => {
          if (isUnmountedRef.current) return;

          let event: MemberEvent;
          try {
            event = JSON.parse(frame.body) as MemberEvent;
          } catch (parseError) {
            console.error('[members-ws] Failed to parse MemberEvent:', parseError);
            return;
          }

          switch (event.action) {
            case 'ROLE_CHANGED':
              if (event.userId != null && event.newRole) {
                onRoleChangedRef.current(event.userId, event.newRole);
              }
              break;

            case 'MEMBER_REMOVED':
              if (event.userId != null) {
                onMemberRemovedRef.current(event.userId);
              }
              break;

            case 'MEMBER_JOINED':
              if (event.member) {
                onMemberJoinedRef.current(event.member);
              }
              break;

            default:
              console.warn('[members-ws] Unknown action:', event.action);
          }
        });
      },

      // ── onError / onDisconnected ─────────────────────────────────────────────
      (error: any) => {
        if (isUnmountedRef.current) return;

        const errorMessage = typeof error === 'string' ? error : (error?.headers?.message || '');
        const isAuthError = errorMessage.toLowerCase().includes('auth') ||
                           errorMessage.toLowerCase().includes('jwt') ||
                           errorMessage.toLowerCase().includes('expired') ||
                           errorMessage.toLowerCase().includes('invalid');

        if (isAuthError) {
          console.error('[members-ws] Fatal authentication error:', errorMessage);
          // Stop retrying on fatal auth errors to avoid backend log spam.
          return;
        }

        console.warn('[members-ws] Disconnected, will reconnect in',
          reconnectDelayRef.current, 'ms', error);

        // Exponential back-off reconnect.
        reconnectTimerRef.current = setTimeout(() => {
          if (!isUnmountedRef.current) {
            reconnectDelayRef.current = Math.min(
              reconnectDelayRef.current * RECONNECT_BACKOFF_MULTIPLIER,
              MAX_RECONNECT_DELAY_MS
            );
            connectRef.current?.();
          }
        }, reconnectDelayRef.current);
      }
    );
  }, [projectId]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    isUnmountedRef.current = false;

    if (!projectId) return;

    connect();

    return () => {
      isUnmountedRef.current = true;
      disconnect();
    };
  }, [projectId, connect, disconnect]);
}
