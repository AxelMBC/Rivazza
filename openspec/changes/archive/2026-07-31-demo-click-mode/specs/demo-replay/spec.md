## ADDED Requirements

### Requirement: Demo builds interact by click
A demo-replay build SHALL drive its controls by a single click, and SHALL disarm the hover paths those controls use in a live build. The selection SHALL be derived from the same build-time demo flag rather than a second flag or a runtime setting, so a live build can never be configured into click mode.

The controls in scope are the track map's follow-camera button, the session lap-list flyout, the lap-analysis panel, and the instrument cluster's tyre overlay. Each SHALL open or activate on the first click and close or deactivate on a second, and SHALL remain in its new state when the pointer moves away.

Interactions that read out information rather than act as controls SHALL remain pointer-driven in a demo build, identically to a live build: lap-list rows, analysis lap chips, the track map's lap-line readout, and analysis trace scrubbing. Wheel zoom and pinch SHALL be unchanged, a click having no meaning as a zoom gesture.

#### Scenario: Clicking the follow-camera button
- **WHEN** a demo-build viewer clicks the follow button
- **THEN** follow mode activates immediately, with no dwell period and no progress fill

#### Scenario: Hovering a control in a demo build
- **WHEN** a demo-build viewer rests the cursor on the follow button for longer than the live build's dwell
- **THEN** nothing activates and no progress indicator appears

#### Scenario: A revealed panel stays put
- **WHEN** a demo-build viewer clicks the lap-analysis bar and then moves the pointer off it entirely
- **THEN** the panel remains open until it is clicked closed

#### Scenario: Interacting inside an open panel
- **WHEN** a demo-build viewer clicks inside the open session-lap flyout
- **THEN** the flyout stays open

#### Scenario: Readouts stay on hover
- **WHEN** a demo-build viewer hovers an analysis lap chip or a lap-list row
- **THEN** the selection or map emphasis changes on hover, without a click
