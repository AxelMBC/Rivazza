import type { MapMeta, SessionInfo, TrackEdges } from "@rivazza/protocol";
import { useEffect, useState } from "react";

import { BRIDGE_HTTP } from "../../hooks/useTelemetry";
import { DEMO_MAP_URL, IS_DEMO } from "../../lib/demo";

export type MapData = { meta: MapMeta | null; edges: TrackEdges | null };

const probe = async <T>(url: string): Promise<T | null> => {
  try {
    const res = await fetch(url);
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
};

export const useTrackMapData = (session: SessionInfo) => {
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [mapProbed, setMapProbed] = useState(false);

  useEffect(() => {
    setMapData(null);
    setMapProbed(false);

    let cancelled = false;
    const load = async () => {
      if (IS_DEMO) {
        const data = await probe<MapData>(DEMO_MAP_URL);
        if (cancelled) return;
        if (data && (data.meta || data.edges))
          setMapData({ meta: data.meta ?? null, edges: data.edges ?? null });
        setMapProbed(true);
        return;
      }
      const [meta, edges] = await Promise.all([
        probe<MapMeta>(`${BRIDGE_HTTP}/api/track-map/meta`),
        probe<TrackEdges>(`${BRIDGE_HTTP}/api/track-map/edges`),
      ]);
      if (cancelled) return;
      if (meta || edges) setMapData({ meta, edges });
      setMapProbed(true);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [session]);

  return { mapData, mapProbed };
};
