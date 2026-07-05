## 1. Web: remove the map.png underlay

- [x] 1.1 In `web/src/components/TrackMap.tsx`, collapse `MapData` to metadata only, delete the `Image` fetch/decode block in the meta-loading effect, and remove the `ctx.drawImage` call from the draw loop — projection, layer caching, and `projKey` logic stay unchanged
- [x] 1.2 Remove the "No map image — track bounds from map.ini" header note (keep "No map file — drawing your driving line" for the no-data fallback)
- [x] 1.3 Lint and type-check the web app (`npm run lint -w web`, `npm run build -w web`)

## 2. Verify end-to-end

- [x] 2.1 With `npm run dev` + `npm run mock -w bridge` (Magione ships a map.png), screenshot via headless Chrome (raw CDP + repo's `ws`) and confirm: no white outline, no "No map image" note, driven line and dot render in the same fixed viewport and orientation as before
- [x] 2.2 Confirm no request to `/api/track-map/image` is made by the page (network check via CDP or bridge log absence) — CDP `Network.requestWillBeSent` capture showed only `/api/track-map/meta` fetches
