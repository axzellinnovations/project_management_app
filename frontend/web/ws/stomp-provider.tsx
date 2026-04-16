'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { CompatClient, Stomp, IMessage } from '@stomp/stompjs';

// ── Types ──

interface StompContextValue {
  client: CompatClient | null;
  connected: boolean;
  subscribe: (
    destination: string,
    callback: (message: IMessage) => void,
  ) => { unsubscribe: () => void } | null;
  send: (destination: string, body: string) => void;
}

interface StompProviderProps {
  token: string;
  children: React.ReactNode;
}

// ── Context ──

const StompContext = createContext<StompContextValue>({
  client: null,
  connected: false,
  subscribe: () => null,
  send: () => {},
});

export const useStomp = () => useContext(StompContext);

// ── Provider ──

export function StompProvider({ token, children }: StompProviderProps) {
  const clientRef = useRef<CompatClient | null>(null);
  const [clientState, setClientState] = useState<CompatClient | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const stompClient = Stomp.client('ws://localhost:8080/ws-native');
    stompClient.debug = () => {};
    stompClient.reconnect_delay = 5000;

    stompClient.connect(
      { Authorization: `Bearer ${token}` },
      () => {
        clientRef.current = stompClient;
        setClientState(stompClient);
        setConnected(true);
      },
      (error: unknown) => {
        setConnected(false);
        console.error('STOMP connection error:', error);
      },
    );

    return () => {
      setConnected(false);
      setClientState(null);
      if (stompClient.connected) {
        stompClient.disconnect();
      }
      clientRef.current = null;
    };
  }, [token]);

  const subscribe = useCallback(
    (destination: string, callback: (message: IMessage) => void) => {
      if (!clientRef.current?.connected) return null;
      return clientRef.current.subscribe(destination, callback);
    },
    [],
  );

  const send = useCallback(
    (destination: string, body: string) => {
      if (!clientRef.current?.connected) return;
      clientRef.current.send(destination, {}, body);
    },
    [],
  );

  return (
    <StompContext.Provider value={{ client: clientState, connected, subscribe, send }}>
      {children}
    </StompContext.Provider>
  );
}
