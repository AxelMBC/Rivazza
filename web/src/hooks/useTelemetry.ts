import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  BridgeMessage,
  ConnectionStatus,
  CutEvent,
  SessionInfo,
  TelemetryFrame,
} from '../types';
import { IS_DEMO, DEMO_RECORDING_URL } from '../lib/demo';

export const BRIDGE_HTTP = `http://${window.location.hostname}:3001`;
const BRIDGE_WS = `ws://${window.location.hostname}:3001/ws`;
const RECONNECT_MS = 1500;
// React state carries the text readouts and data-derivation hooks; ~30 Hz is
// visually indistinguishable for those (the gauge needle interpolates over
// 100 ms anyway) and halves render work. `telemetryRef` stays at the full
// bridge rate so canvas rAF consumers keep 60 Hz fidelity.
const STATE_INTERVAL_MS = 1000 / 30;

// A recorded session: relative-ms-stamped BridgeMessages produced by the bridge
// recorder (bridge/src/record.ts) and replayed in demo mode. See lib/demo.ts.
type RecordedEntry = { t: number; msg: BridgeMessage };

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
  // Full-rate frame subscription, invoked synchronously for every telemetry
  // message alongside the telemetryRef update. For recorders that must not
  // miss frames: the ~30 Hz state blurs sample spacing and rAF loops throttle
  // when the (game-focused) browser window is occluded. Returns unsubscribe.
  subscribeFrame: (cb: (frame: TelemetryFrame) => void) => () => void;
};

export const useTelemetry = (): Telemetry => {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryFrame | null>(null);
  const [cutSeq, setCutSeq] = useState(0);
  const telemetryRef = useRef<TelemetryFrame | null>(null);
  const cutsRef = useRef<CutEvent[]>([]);
  const frameListenersRef = useRef<Set<(frame: TelemetryFrame) => void>>(new Set());
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

    // The one place bridge messages become app state — shared by the live
    // WebSocket path and the demo replay path so both behave identically.
    const handleMessage = (message: BridgeMessage) => {
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
        case 'cut':
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
        setStatus('connecting');
        setSession(null);
        reconnectTimer = window.setTimeout(connect, RECONNECT_MS);
      };
    };

    // Demo mode: fetch the recorded session and replay it into the same sinks,
    // honoring recorded inter-frame timing and looping forever. No WebSocket is
    // opened and no reconnect is scheduled — the app runs with zero backend.
    const replay = (recording: RecordedEntry[]) => {
      if (!recording.length) {
        setStatus('waiting');
        return;
      }
      let index = 0;
      // Wall-clock anchor for the current loop; each entry is due at
      // loopStart + entry.t, so playback tracks real time and self-corrects
      // for timer drift instead of accumulating per-frame delay.
      let loopStart = performance.now();

      const tick = () => {
        if (disposed) return;
        const now = performance.now();
        // Emit every entry now due (frames arrive in ~16 ms bursts; catch them
        // up within one tick rather than one timer per frame).
        while (index < recording.length && loopStart + recording[index].t <= now) {
          handleMessage(recording[index].msg);
          index++;
        }
        if (index >= recording.length) {
          // Loop: reset session-scoped state as a fresh session would, then the
          // replayed status/session messages re-establish it seamlessly.
          clearFrame();
          index = 0;
          loopStart = performance.now();
        }
        const dueAt = loopStart + recording[index].t;
        replayTimer = window.setTimeout(tick, Math.max(0, dueAt - performance.now()));
      };

      tick();
    };

    if (IS_DEMO) {
      setStatus('connecting');
      fetch(DEMO_RECORDING_URL)
        .then((res) => {
          if (!res.ok) throw new Error(`demo recording ${res.status}`);
          return res.json() as Promise<RecordedEntry[]>;
        })
        .then((recording) => {
          if (!disposed) replay(recording);
        })
        .catch(() => {
          if (!disposed) setStatus('waiting');
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

  return { status, session, telemetry, telemetryRef, cutsRef, cutSeq, subscribeFrame };
};
