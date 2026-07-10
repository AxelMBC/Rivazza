import { useRef } from "react";
import { useTelemetry } from "./hooks/useTelemetry";
import { useInputHistory } from "./hooks/useInputHistory";
import { useLapDelta } from "./hooks/useLapDelta";
import { useLapHistory } from "./hooks/useLapHistory";
import { useLapRecordings } from "./hooks/useLapRecordings";
import { SessionHeader } from "./components/SessionHeader";
import { LapTimes } from "./components/LapTimes";
import { InstrumentCluster } from "./components/InstrumentCluster";
import { PedalTrace } from "./components/PedalTrace";
import { GForceMeter } from "./components/GForceMeter";
import { SteeringBar } from "./components/SteeringBar";
import { TrackMap } from "./components/TrackMap";
import { LapAnalysis } from "./components/LapAnalysis";
import type { ScrubPoint } from "./lib/lapAnalysis";
import type { ConnectionStatus } from "./types";

const WaitingScreen = ({ status }: { status: ConnectionStatus }) => (
  <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
    <p className="text-2xl font-semibold text-ink-secondary">
      {status === "connecting"
        ? "Connecting to telemetry bridge…"
        : "Waiting for Assetto Corsa"}
    </p>
    <p className="max-w-md text-sm text-ink-muted">
      {status === "connecting"
        ? "Make sure the bridge is running (npm run dev starts it alongside this app)."
        : "Start Assetto Corsa and enter a session — the dashboard will light up automatically."}
    </p>
  </div>
);

const App = () => {
  const {
    status,
    session,
    telemetry,
    telemetryRef,
    cutsRef,
    cutSeq,
    subscribeFrame,
  } = useTelemetry();
  const historyRef = useInputHistory(telemetry);
  const deltaMs = useLapDelta(telemetry);
  const { lapsRef: lapHistoryRef, currentLapInvalidRef } = useLapHistory(
    telemetry,
    cutsRef,
    cutSeq,
  );
  // Full-rate per-lap telemetry recordings; validity stays a consumer-side
  // join against the lap history by lap number.
  const { recordingsRef, version: recVersion } = useLapRecordings(
    subscribeFrame,
    session,
    lapHistoryRef,
  );
  // Display lap number hovered in the session-lap list; the track map reveals
  // that lap's cut markers. A ref, not state — the map's rAF loop reads it.
  const hoveredLapRef = useRef<number | null>(null);
  // Scrub position hovered in the analysis panel's traces; the track map
  // echoes it as a ring on the lap line. Same ref pattern as hoveredLapRef.
  const scrubRef = useRef<ScrubPoint | null>(null);
  // Lap selected in the open analysis panel; the track map reveals that
  // lap's braking ticks while set. Same ref pattern as hoveredLapRef.
  const analysisLapRef = useRef<number | null>(null);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <SessionHeader session={session} status={status} />
      {session ? (
        <main className="grid min-h-0 flex-1 grid-rows-[35fr_65fr] gap-4 p-4 lg:grid-cols-[24rem_1fr] lg:grid-rows-none">
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
            <InstrumentCluster telemetry={telemetry} session={session} />
            <LapTimes
              telemetry={telemetry}
              deltaMs={deltaMs}
              lapsRef={lapHistoryRef}
              currentLapInvalidRef={currentLapInvalidRef}
              hoveredLapRef={hoveredLapRef}
            />
            <PedalTrace historyRef={historyRef} />
            <div className="grid grid-cols-[10rem_1fr] items-start gap-3">
              <GForceMeter historyRef={historyRef} />
              <div className="rounded-lg border border-edge bg-surface p-4">
                <SteeringBar telemetry={telemetry} />
              </div>
            </div>
          </div>
          <div className="flex min-h-0 flex-col gap-4">
            <TrackMap
              session={session}
              telemetryRef={telemetryRef}
              lapsRef={lapHistoryRef}
              cutsRef={cutsRef}
              hoveredLapRef={hoveredLapRef}
              scrubRef={scrubRef}
              analysisLapRef={analysisLapRef}
            />
            <LapAnalysis
              recordingsRef={recordingsRef}
              version={recVersion}
              lapsRef={lapHistoryRef}
              scrubRef={scrubRef}
              analysisLapRef={analysisLapRef}
            />
          </div>
        </main>
      ) : (
        <WaitingScreen status={status} />
      )}
    </div>
  );
};

export default App;
