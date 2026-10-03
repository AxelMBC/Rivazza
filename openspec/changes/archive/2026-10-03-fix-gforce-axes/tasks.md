# Read lateral G from the field that carries it, and smooth the G-force meter

## 1. Implementation

- [x] 1.1 In `bridge/src/udp/parsers.ts`, read `accGHorizontal` (lateral) from offset 28 and `accGVertical` from offset 32, with a note that AC's documented names for these slots are swapped
- [x] 1.2 Swap `accGVertical` and `accGHorizontal` in every frame of `web/public/demo/imola.json`, so the committed recording matches the corrected parser
- [x] 1.3 In `useInputHistory`, smooth lateral and longitudinal G with a ~50 ms exponential moving average

## 2. Verification

- [x] 2.1 Run `/opsx:verify` — bridge and web typecheck, lint, formatting and the spec deltas
- [ ] 2.2 In the demo replay, confirm the dot swings to the outside of each corner, rises under braking, and the rings grow to about 5G for the SF25 without the dot jittering on kerbs
- [ ] 2.3 With the game running, confirm a corner moves the dot sideways (the mock sends no G, so only the game proves the live path)
