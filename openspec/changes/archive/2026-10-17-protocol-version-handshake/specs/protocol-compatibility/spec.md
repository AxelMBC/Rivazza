## ADDED Requirements

### Requirement: Status messages carry the protocol version

The wire contract SHALL declare a single integer `PROTOCOL_VERSION`, exported at runtime by `@rivazza/protocol`, and the bridge SHALL include it as `protocol` on every `status` message it sends, including the greeting a newly connected client receives.

The version SHALL be incremented whenever a change to `BridgeMessage` would be misread by a peer built before that change: a removed, renamed or retyped field, or a new message variant. A purely additive optional field that older peers can ignore does not require a bump.

#### Scenario: Greeting with no game running

- **WHEN** a client connects while the bridge is waiting for the game
- **THEN** the first message it receives is a `status` with `state: "waiting"` and `protocol` equal to the bridge's `PROTOCOL_VERSION`

#### Scenario: Greeting during a session

- **WHEN** a client connects while a session is live
- **THEN** the `status` message that precedes the `session` message carries `protocol`

### Requirement: The web app accepts a stream only after a matching version

The web app SHALL ignore every message on a connection (or in a replay loop) until it has received a `status` message whose `protocol` equals its own `PROTOCOL_VERSION`. The check SHALL run once per connection or replay loop, not per message, so the 60 Hz telemetry path pays no validation cost.

When the first `status` carries a different `protocol`, or none, the app SHALL enter a `mismatch` connection status, clear any session and frame state, log one `console.error` naming the received and expected versions, and ignore the remaining messages on that connection. A new connection SHALL be checked again from scratch.

#### Scenario: Matching bridge

- **WHEN** the bridge's greeting `status` carries the same `protocol` as the web app
- **THEN** the dashboard behaves exactly as before this change

#### Scenario: Bridge from an older checkout

- **WHEN** the web app connects to a bridge whose `status` messages have no `protocol` field
- **THEN** the app shows the mismatch state, the console shows one error naming the missing and expected versions, and no gauge, lap or track-map data from that bridge is rendered

#### Scenario: Different version

- **WHEN** the bridge's `status` carries a `protocol` different from the web app's
- **THEN** the app shows the mismatch state and ignores that connection's later `session`, `telemetry` and `cut` messages

#### Scenario: Restarting the bridge after a mismatch

- **WHEN** a mismatched bridge is stopped and a matching one is started
- **THEN** the web app reconnects as usual and, on the matching greeting, leaves the mismatch state

### Requirement: A live build explains a version mismatch

In a live (non-demo) build, the `mismatch` status SHALL replace the connecting and waiting screens with a screen stating that the bridge and the dashboard come from different versions and telling the user to restart both from the same checkout (`npm run dev`). The header connection badge SHALL show a distinct mismatch label in an error colour, never "Live".

#### Scenario: Mismatch screen

- **WHEN** a live build is in the `mismatch` status
- **THEN** the main area shows the version-mismatch screen with the restart instruction, and the header badge shows the mismatch label

### Requirement: Unknown message types are reported

When the web app receives a message whose `type` it does not handle, it SHALL log a `console.warn` naming that type once per page load, and SHALL otherwise ignore the message.

#### Scenario: A newer variant arrives

- **WHEN** an accepted connection delivers many messages of a type the web app does not know
- **THEN** the console shows a single warning naming that type, and the dashboard keeps rendering the known messages

### Requirement: The committed demo recording matches the current protocol

The unit tests SHALL fail when any `status` message in the committed demo recording carries a `protocol` other than the current `PROTOCOL_VERSION`, or none, so a protocol bump cannot ship without re-recording or migrating the demo.

#### Scenario: Bump without migrating the recording

- **WHEN** `PROTOCOL_VERSION` is incremented and the committed recording is left unchanged
- **THEN** `npm test` fails, naming the recording's version and the expected one
