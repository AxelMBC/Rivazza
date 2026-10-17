# Hold telemetry until the session is published, reject unusable map.ini values, and pull session and shared-memory wiring into their own bridge modules

## 1. Behaviour fixes

- [x] 1.1 Forward telemetry to the throttle only once the session message has been broadcast (`bridge/src/index.ts`)
- [x] 1.2 `parseMapIni` returns `null` unless all five values are finite and width, height and scale factor are positive (`bridge/src/content/trackAssets.ts`)

## 2. Structure

- [x] 2.1 Move `readStaticPageTokens` and the static page constants to `bridge/src/shm/staticPage.ts`; `resolveTrackAssetsForSession` takes the token reader as an argument, passed in from `index.ts`
- [x] 2.2 Extract the session state, generation guard and greeting into `bridge/src/session.ts`; `index.ts` only wires it
- [x] 2.3 Build the track root and asset file paths in one place in `trackAssets.ts`

## 3. Verification

- [x] 3.1 Run `/axl:verify`
- [x] 3.2 Start the bridge while AC is already in a session on a multi-layout track (e.g. ks_highlands): the map renders the layout's bounds and edges from the first frame, with no frames before the session
