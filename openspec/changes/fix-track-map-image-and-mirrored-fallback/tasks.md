## 1. Bridge: route map endpoints by pathname

- [x] 1.1 In `bridge/src/index.ts`, derive the pathname (`url.split('?')[0]`) in the HTTP handler and match both `/api/track-map/meta` and `/api/track-map/image` against it instead of the raw `req.url`
- [x] 1.2 Type-check the bridge (`npm run build -w bridge`)

## 2. Web: un-mirror the no-map-data fallback projection

- [x] 2.1 In `web/src/components/TrackMap.tsx`, change the fallback projection Y term from `height / 2 - (p.z - view.cz) * scale` to `height / 2 + (p.z - view.cz) * scale`
- [x] 2.2 Replace the stale "Y is flipped so driving north in the sim moves the dot up on screen" comment with the actual invariant: world +Z maps down-screen, matching the map.ini/map.png convention so turn handedness is identical in every mode
- [x] 2.3 Lint and type-check the web app (`npm run lint -w web`, `npm run build -w web`)

## 3. Verify end-to-end

- [x] 3.1 Run `npm run dev` plus `npm run mock -w bridge` (Magione has both `map.ini` and `map.png`) and confirm the header no longer says "No map image", the Magione outline renders, and the dot + pedal-colored line ride exactly on the drawn ribbon — *note: the mock streams a parametric ellipse, not real track geometry, so "riding the ribbon" isn't observable with mock data; verified instead that the ellipse renders correctly centered/scaled inside the map bounds. Real-data registration was proven separately (the real Imola trace matches the official map.png orientation exactly).*
- [x] 3.2 `curl "http://localhost:3001/api/track-map/image?v=x"` returns 200 with PNG bytes; without a query string it still works; meta endpoint unaffected
- [x] 3.3 Screenshot the dashboard via headless Chrome (raw CDP + the repo's `ws` package — no playwright in this repo) to confirm the rendered map visually
