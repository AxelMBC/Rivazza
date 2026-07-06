import { useEffect, useRef, useState } from 'react';
import type {
  BridgeMessage,
  ConnectionStatus,
  CutEvent,
  SessionInfo,
  TelemetryFrame,
} from '../types';

export const BRIDGE_HTTP = `http://${window.location.hostname}:3001`;
const BRIDGE_WS = `ws://${window.location.hostname}:3001/ws`;
const RECONNECT_MS = 1500;
// React state carries the text readouts and data-derivation hooks; ~30 Hz is
// visually indistinguishable for those (the gauge needle interpolates over
// 100 ms anyway) and halves render work. `telemetryRef` stays at the full
// bridge rate so canvas rAF consumers keep 60 Hz fidelity.
const STATE_INTERVAL_MS = 1000 / 30;

export type Telemetry = {
  status: ConnectionStatus;
  session: SessionInfo | null;
  // Throttled to ~STATE_INTERVAL_MS between updates (trailing frame always lands).
  telemetry: TelemetryFrame | null;
  // Same data as `telemetry` but updated on every bridge message — read it
  // from requestAnimationFrame loops (the track map) without re-render coupling.
  telemetryRef: React.RefObject<TelemetryFrame | null>;
  // Session-scoped cut events, appended as they arrive (cuts are rare).
  // Consumers read the ref from effects and rAF loops, tracking their own
  // consumed index; a replaced array identity marks a session reset. `cutSeq`
  // bumps on every append and reset — the re-render/effect change signal.
  cutsRef: React.RefObject<CutEvent[]>;
  cutSeq: number;
};

export const useTelemetry = (): Telemetry => {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryFrame | null>(null);
  const [cutSeq, setCutSeq] = useState(0);
  const telemetryRef = useRef<TelemetryFrame | null>(null);
  const cutsRef = useRef<CutEvent[]>([]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    let flushTimer: number | undefined;
    let lastStateAt = 0;
    let disposed = false;

    // Trailing-edge flush: when the throttle skips a frame, this makes sure
    // the newest frame still reaches state within one interval — so the final
    // frame of a pausing stream (lap boundaries included) is never dropped.
    const scheduleFlush = (delay: number) => {
      window.clearTimeout(flushTimer);
      flushTimer = window.setTimeout(() => {
        lastStateAt = performance.now();
        setTelemetry(telemetryRef.current);
      }, delay);
    };

    const clearFrame = () => {
      window.clearTimeout(flushTimer);
      setTelemetry(null);
      telemetryRef.current = null;
      cutsRef.current = [];
      setCutSeq((n) => n + 1);
    };

    const connect = () => {
      socket = new WebSocket(BRIDGE_WS);

      socket.onmessage = (event) => {
        const message: BridgeMessage = JSON.parse(event.data);
        switch (message.type) {
          case 'status':
            setStatus(message.state);
            if (message.state === 'waiting') {
              setSession(null);
              clearFrame();
            }
            break;
          case 'session':
            setSession(message);
            clearFrame();
            break;
          case 'telemetry': {
            telemetryRef.current = message;
            const elapsed = performance.now() - lastStateAt;
            if (elapsed >= STATE_INTERVAL_MS) {
              window.clearTimeout(flushTimer);
              lastStateAt = performance.now();
              setTelemetry(message);
            } else {
              scheduleFlush(STATE_INTERVAL_MS - elapsed);
            }
            break;
          }
          case 'cut':
            cutsRef.current.push(message);
            setCutSeq((n) => n + 1);
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
      window.clearTimeout(flushTimer);
      socket?.close();
    };
  }, []);

  return { status, session, telemetry, telemetryRef, cutsRef, cutSeq };
};
