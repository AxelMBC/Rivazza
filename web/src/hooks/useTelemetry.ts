import { useCallback, useEffect, useRef, useState } from "react";

import { DEMO_RECORDING_URL, IS_DEMO } from "../lib/demo";
import type {
  BridgeMessage,
  ConnectionStatus,
  CutEvent,
  SessionInfo,
  TelemetryFrame,
} from "../types";

export const BRIDGE_HTTP = `http://${window.location.hostname}:3001`;

const BRIDGE_WS = `ws://${window.location.hostname}:3001/ws`;
const RECONNECT_MS = 1500;
const STATE_INTERVAL_MS = 1000 / 30;

type RecordedEntry = { t: number; msg: BridgeMessage };

export type Telemetry = {
  status: ConnectionStatus;
  session: SessionInfo | null;
  telemetry: TelemetryFrame | null;
  telemetryRef: React.RefObject<TelemetryFrame | null>;
  cutsRef: React.RefObject<CutEvent[]>;
  cutSeq: number;
  subscribeFrame: (cb: (frame: TelemetryFrame) => void) => () => void;
};

export const useTelemetry = (): Telemetry => {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryFrame | null>(null);
  const [cutSeq, setCutSeq] = useState(0);

  const telemetryRef = useRef<TelemetryFrame | null>(null);
  const cutsRef = useRef<CutEvent[]>([]);
  const frameListenersRef = useRef<Set<(frame: TelemetryFrame) => void>>(
    new Set(),
  );

  const subscribeFrame = useCallback((cb: (frame: TelemetryFrame) => void) => {
    frameListenersRef.current.add(cb);
    return () => {
      frameListenersRef.current.delete(cb);
    };
  }, []);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    let flushTimer: number | undefined;
    let replayTimer: number | undefined;
    let lastStateAt = 0;
    let disposed = false;

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

    const handleMessage = (message: BridgeMessage) => {
      switch (message.type) {
        case "status":
          setStatus(message.state);
          if (message.state === "waiting") {
            setSession(null);
            clearFrame();
          }
          break;
        case "session":
          setSession(message);
          clearFrame();
          break;
        case "telemetry": {
          telemetryRef.current = message;
          for (const cb of frameListenersRef.current) cb(message);
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
        case "cut":
          cutsRef.current.push(message);
          setCutSeq((n) => n + 1);
          break;
      }
    };

    const connect = () => {
      socket = new WebSocket(BRIDGE_WS);

      socket.onmessage = (event) => {
        handleMessage(JSON.parse(event.data) as BridgeMessage);
      };

      socket.onclose = () => {
        if (disposed) return;
        setStatus("connecting");
        setSession(null);
        reconnectTimer = window.setTimeout(connect, RECONNECT_MS);
      };
    };

    const replay = (recording: RecordedEntry[]) => {
      if (!recording.length) {
        setStatus("waiting");
        return;
      }
      let index = 0;
      let loopStart = performance.now();

      const tick = () => {
        if (disposed) return;
        const now = performance.now();
        while (
          index < recording.length &&
          loopStart + recording[index].t <= now
        ) {
          handleMessage(recording[index].msg);
          index++;
        }
        if (index >= recording.length) {
          clearFrame();
          index = 0;
          loopStart = performance.now();
        }
        const dueAt = loopStart + recording[index].t;
        replayTimer = window.setTimeout(
          tick,
          Math.max(0, dueAt - performance.now()),
        );
      };

      tick();
    };

    if (IS_DEMO) {
      setStatus("connecting");
      fetch(DEMO_RECORDING_URL)
        .then((res) => {
          if (!res.ok) throw new Error(`demo recording ${res.status}`);
          return res.json() as Promise<RecordedEntry[]>;
        })
        .then((recording) => {
          if (!disposed) replay(recording);
        })
        .catch(() => {
          if (!disposed) setStatus("waiting");
        });
    } else {
      connect();
    }

    return () => {
      disposed = true;
      window.clearTimeout(reconnectTimer);
      window.clearTimeout(flushTimer);
      window.clearTimeout(replayTimer);
      socket?.close();
    };
  }, []);

  return {
    status,
    session,
    telemetry,
    telemetryRef,
    cutsRef,
    cutSeq,
    subscribeFrame,
  };
};
