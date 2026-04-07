import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents } from '@common/types';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface SocketContextValue {
  socket: AppSocket | null;
  connected: boolean;
  serverUrl: string | null;
  setServerUrl: (url: string) => void;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null, connected: false, serverUrl: null, setServerUrl: () => {},
});

function getServerUrl(): string | null {
  // In development or self-hosted, the server is on the same origin
  // On Vercel/static hosting, user must provide a server URL
  const saved = localStorage.getItem('lazypoker_server');
  if (saved) return saved;

  // If running on localhost or a LAN IP, assume same-origin server
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return window.location.origin;
  }

  // On a hosted domain (e.g. vercel.app), no server available yet
  return null;
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<AppSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [serverUrl, setServerUrlState] = useState<string | null>(getServerUrl);

  const setServerUrl = (url: string) => {
    localStorage.setItem('lazypoker_server', url);
    setServerUrlState(url);
  };

  useEffect(() => {
    if (!serverUrl) return;

    // Disconnect previous socket if any
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
    }) as AppSocket;

    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    return () => {
      socket.disconnect();
    };
  }, [serverUrl]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected, serverUrl, setServerUrl }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
