import { useEffect } from 'react';
import { CompatClient, Stomp } from '@stomp/stompjs';

interface UseNotificationSocketOptions {
  token: string | null;
  enabled?: boolean;
  onNotification: () => void;
}

export default function useNotificationSocket({
  token,
  enabled = true,
  onNotification,
}: UseNotificationSocketOptions) {
  useEffect(() => {
    if (!enabled || !token) return;

    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
    const wsUrl = backendUrl.replace(/^http/, 'ws');
    const client: CompatClient = Stomp.client(`${wsUrl}/ws-native`);
    client.debug = () => {};

    client.connect(
      { Authorization: `Bearer ${token}` },
      () => {
        client.subscribe('/user/queue/notifications', () => {
          onNotification();
        });
      },
      () => {
        // no-op: sidebar can continue without live notification updates
      }
    );

    return () => {
      if (client.connected) {
        client.disconnect(() => {});
      }
    };
  }, [enabled, token, onNotification]);
}
