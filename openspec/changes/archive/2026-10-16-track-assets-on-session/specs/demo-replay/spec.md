## MODIFIED Requirements

### Requirement: Recorder captures the live BridgeMessage stream to a file

The project SHALL provide a bridge-side recorder that connects to the running bridge as an ordinary WebSocket client and appends every received `BridgeMessage` (`status` | `session` | `telemetry` | `cut`) to a single recording file, each entry stamped with a relative arrival time (milliseconds since the first captured message) so original inter-frame timing can be reconstructed on replay. The recorder SHALL NOT modify or depend on the bridge's UDP ingestion or HTTP/WebSocket serving code — it is purely an additional consumer. The recording SHALL preserve message contents verbatim so replay is indistinguishable from the original session at the wire level. Because the track's map metadata and edges travel inside the `session` message, the recording file alone SHALL be sufficient for a demo build to draw the track: the recorder SHALL NOT make HTTP requests to the bridge and SHALL NOT write any companion file.

#### Scenario: Capturing a session

- **WHEN** the recorder runs while a real (or mock) driving session streams over the bridge WebSocket
- **THEN** it writes a recording file containing every `status`, `session`, `telemetry`, and `cut` message in arrival order, each with a relative timestamp

#### Scenario: Recorder does not affect the bridge

- **WHEN** the recorder connects and disconnects
- **THEN** the bridge's telemetry throughput and other WebSocket clients are unaffected, exactly as any other read-only client connecting would be

#### Scenario: Recording carries the track outline

- **WHEN** a demo build replays a recording captured on a track with resolved metadata and edges
- **THEN** the track map draws the metadata-fit viewport and the track-limits ribbon from the replayed `session` message, with no other file fetched
