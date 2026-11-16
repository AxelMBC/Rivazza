## ADDED Requirements

### Requirement: Bridge resolves named track sections
The bridge SHALL resolve the track's named sections from `data/sections.ini`, using the same layout-aware directory order as `map.ini` (layout folder first, then track root), and SHALL treat them as an asset independent of `map.ini` and `ai/fast_lane.ai`: a track with sections but neither of the others still yields sections, and the reverse. On a multi-layout track the first `sections.ini` found SHALL be the only one considered — a layout file that yields nothing SHALL NOT fall through to the track root's, which describes another layout.

Each `[SECTION_n]` block SHALL yield one section from its `IN`, `OUT` and `TEXT` keys, whatever order the blocks and keys appear in and whatever numbers the block headers carry. The parser SHALL be garbage-tolerant in the tradition of the other content parsers: it SHALL ignore a leading byte-order mark, SHALL decode the file as UTF-8 and fall back to Windows-1252 when the bytes are not valid UTF-8, SHALL trim each name and strip control characters from it, and SHALL drop — never throw on — any block whose `IN` or `OUT` is not a finite number, that does not satisfy `0 ≤ IN < OUT ≤ 1`, or whose name is empty after cleaning.

The surviving sections SHALL be ordered by `IN`, and a section that ends no later than the section before it SHALL be dropped, so that the ordered list always advances around the lap. The result SHALL be treated as unavailable when fewer than two sections survive. A missing, unreadable or unusable `sections.ini` SHALL never raise an error and SHALL never affect the resolution of `meta` or `edges`.

#### Scenario: Stock track with sections
- **WHEN** a session starts on the Nordschleife, whose layout folder ships a `sections.ini` with 39 sections
- **THEN** the bridge resolves 39 named sections in lap order, the first named `Hatzenbachbogen`

#### Scenario: Byte-order mark before the first header
- **WHEN** the file begins with a UTF-8 byte-order mark immediately before `[SECTION_0]`
- **THEN** the first section is parsed like every other

#### Scenario: Accented names
- **WHEN** a section's `TEXT` is `Döttinger Höhe` in a UTF-8 file, or the same name in a Windows-1252 file
- **THEN** the resolved name is `Döttinger Höhe` in both cases

#### Scenario: Name with trailing whitespace
- **WHEN** a section's `TEXT` is `Schwalbenschwanz ` with a trailing space
- **THEN** the resolved name is `Schwalbenschwanz`

#### Scenario: Malformed block
- **WHEN** one block has `IN=0.5` and `OUT=0.4`, or a non-numeric `IN`, or no `TEXT`
- **THEN** that block is dropped and the remaining sections still resolve

#### Scenario: Section nested inside the previous one
- **WHEN** a section's span lies entirely within the span of the section before it
- **THEN** the nested section is dropped and the ordered list still advances around the lap

#### Scenario: Track without sections
- **WHEN** the track ships no `sections.ini`, or one from which fewer than two sections survive
- **THEN** no sections resolve, no error is raised, and `meta` and `edges` resolve exactly as they would otherwise

#### Scenario: Sections without map data
- **WHEN** a track ships a usable `sections.ini` but neither a usable `map.ini` nor a usable AI spline
- **THEN** the session still carries the sections, alongside `meta: null` and `edges: null`

#### Scenario: Layout file is unusable
- **WHEN** the loaded layout's `sections.ini` exists but yields no sections and the track root also has a `sections.ini`
- **THEN** no sections resolve rather than the track root's being used

### Requirement: Named sections travel on the session message
Every `session` message the bridge sends SHALL carry the resolved sections for that session as `sections`: an array of `{ name, in, out }` in lap order, with `in` and `out` as normalized track positions, or `null` when none resolved. The field SHALL be additive: a consumer SHALL treat a `session` message without the field — one from a bridge or a recording made before it existed — exactly as it treats `sections: null`, and the protocol version SHALL NOT change on its account.

#### Scenario: Sections available
- **WHEN** a session is active on a track with resolved sections
- **THEN** the session message's `sections` holds them in lap order

#### Scenario: Late-joining client
- **WHEN** a client connects while a session is already active
- **THEN** the `session` message in its greeting carries the same `sections` as the original broadcast

#### Scenario: Recording made before the field existed
- **WHEN** the web app replays a recording whose `session` message has no `sections` field
- **THEN** the recording is accepted and behaves as a session with no named sections
