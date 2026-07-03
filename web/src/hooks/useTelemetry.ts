import { useEffect, useRef, useState } from 'react';
import type {
  BridgeMessage,
  ConnectionStatus,
  SessionInfo,
  TelemetryFrame,
} from '../types';

export const BRIDGE_HTTP = `http://${window.location.hostname}:3001`;
const BRIDGE_WS = `ws://${window.location.hostname}:3001/ws`;
const RECONNECT_MS = 1500;

export type Telemetry = {
  status: ConnectionStatus;
  session: SessionInfo | null;
  telemetry: TelemetryFrame | null;
  // Same data as `telemetry` but updated outside React — read it from
  // requestAnimationFrame loops (the track map) without re-render coupling.
  telemetryRef: React.RefObject<TelemetryFrame | null>;
};

export const useTelemetry = (): Telemetry => {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryFrame | null>(null);
  const telemetryRef = useRef<TelemetryFrame | null>(null);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    let disposed = false;

    const connect = () => {
      socket = new WebSocket(BRIDGE_WS);

      socket.onmessage = (event) => {
        const message: BridgeMessage = JSON.parse(event.data);
        switch (message.type) {
          case 'status':
            setStatus(message.state);
            if (message.state === 'waiting') {
              setSession(null);
              setTelemetry(null);
              telemetryRef.current = null;
            }
            break;
          case 'session':
            setSession(message);
            setTelemetry(null);
            telemetryRef.current = null;
            break;
          case 'telemetry':
            telemetryRef.current = message;
            setTelemetry(message);
            break;
        }
      };

      socket.onclose = () => {
        if (disposed) return;
        setStatus('connecting');
        setSession(null);
        reconnectTimer = window.setTimeout(connect, RECONNECT_MS);
      };
    };

    connect();
    return () => {
      disposed = true;
      window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  return { status, session, telemetry, telemetryRef };
};
