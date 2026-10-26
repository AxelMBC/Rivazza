import {
  PROTOCOL_VERSION,
  type BridgeMessage,
  type CutEvent,
  type GameState,
  type SessionInfo,
  type TelemetryFrame,
} from "@rivazza/protocol";
import { useCallback, useEffect, useRef, useState } from "react";

import { DEMO_RECORDING_URL, IS_DEMO } from "../lib/demo";
import { matchesProtocol } from "../lib/protocolCheck";

const BRIDGE_WS = `ws://${window.location.hostname}:3001/ws`;
const RECONNECT_MS = 1500;
const STATE_INTERVAL_MS = 1000 / 30;

export type ConnectionStatus =
  "connecting" | "waiting" | "connected" | "paused" | "replay" | "mismatch";

const GAME_STATUS: Record<GameState, ConnectionStatus> = {
  live: "connected",
  paused: "paused",
  replay: "replay",
};

type RecordedEntry = { t: number; msg: BridgeMessage };

type StreamGate = "pending" | "accepted" | "refused";

const warnedTypes = new Set<string>();

const warnUnknownType = (message: { type: unknown }) => {
  const type = String(message.type);
  if (warnedTypes.has(type)) return;
  warnedTypes.add(type);
  console.warn(`[telemetry] ignoring unknown message type "${type}"`);
};

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
    let gate: StreamGate = "pending";

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
          if (message.state === "connected") {
            setStatus(GAME_STATUS[message.game ?? "live"]);
            break;
          }
          setStatus(message.state);
          setSession(null);
          clearFrame();
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
        default: {
          const unhandled: never = message;
          warnUnknownType(unhandled);
        }
      }
    };

    const admit = (message: BridgeMessage): boolean => {
      if (gate === "accepted") return true;
      if (gate === "refused" || message.type !== "status") return false;
      if (matchesProtocol(message)) {
        gate = "accepted";
        return true;
      }
      gate = "refused";
      console.error(
        `[telemetry] protocol mismatch: received ${String(message.protocol)}, expected ${PROTOCOL_VERSION}`,
      );
      setStatus("mismatch");
      setSession(null);
      clearFrame();
      return false;
    };

    const receive = (message: BridgeMessage) => {
      if (admit(message)) handleMessage(message);
    };

    const connect = () => {
      socket = new WebSocket(BRIDGE_WS);
      gate = "pending";

      socket.onmessage = (event) => {
        receive(JSON.parse(event.data) as BridgeMessage);
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
      gate = "pending";

      const tick = () => {
        if (disposed) return;
        const now = performance.now();
        while (
          index < recording.length &&
          loopStart + recording[index].t <= now
        ) {
          receive(recording[index].msg);
          index++;
        }
        if (gate === "refused") return;
        if (index >= recording.length) {
          clearFrame();
          index = 0;
          loopStart = performance.now();
          gate = "pending";
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
