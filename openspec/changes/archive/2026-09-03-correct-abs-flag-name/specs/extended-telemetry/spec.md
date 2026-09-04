## MODIFIED Requirements

### Requirement: Bridge parses the full RTCarInfo packet

The bridge SHALL parse the complete 328-byte RTCarInfo struct, and this specification SHALL name each decoded flag exactly as its `TelemetryFrame` field is named, so a reader can grep the specification against the code and find it.

#### Scenario: Boolean flags decoded from struct bytes

- **WHEN** the RTCarInfo packet has a non-zero byte at a flag offset (e.g., `absInAction` at offset 21)
- **THEN** the corresponding `TelemetryFrame` field is `true`, and `false` when the byte is zero
