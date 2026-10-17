# Review: track-assets-on-session

Snapshot: 4134a8b242715b556c296a3ffb282f7487b43710

1. [rule] web/src/components/TrackMap/index.tsx:114 — the render effect destructures the whole `session` (`const { meta, edges } = session;`) but depends on `session.meta` / `session.edges`; exhaustive-deps reads that as a missing `session` dependency, and adding it would re-run the effect (dropping layer caches) on every session-object change, undoing design decision 3 · fixed
   Fix: hoist `const { meta, edges } = session;` to the component body, depend on `[meta, edges, telemetryRef, …]`, and use `!meta && !edges` for the "No map file" note (:414).
