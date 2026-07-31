## MODIFIED Requirements

### Requirement: Interactions branch on the gesture's own pointer type
Interaction handlers SHALL determine touch versus mouse behavior from the modality of each individual input event (touch events, or pointer events with `pointerType === 'touch'`), not from a device-level mode. In a build that can drive a live session, mouse-driven interactions SHALL behave exactly as they did before this capability existed — hover, wheel, and dwell semantics unchanged — regardless of whether the device also has a touchscreen.

In a click-mode build (see `demo-replay`), mouse pointer events on the app's controls SHALL take the same immediate-activation path as touch taps, and the corresponding mouse hover paths SHALL be disarmed so a single gesture never triggers both. Touch behavior SHALL be identical in both modes.

#### Scenario: Touchscreen laptop uses both models
- **WHEN** a user on a touchscreen laptop hovers the lap list with the mouse in a live build, then taps it with a finger
- **THEN** the hover reveal works exactly as on a mouse-only desktop, and the tap toggle works exactly as on a phone

#### Scenario: Desktop behavior unchanged
- **WHEN** a mouse-only user interacts with any hover-revealed surface in a live build
- **THEN** the reveal, dwell, and wheel behavior is identical to the pre-change behavior

#### Scenario: Click and tap share one path
- **WHEN** a mouse user clicks a control in a click-mode build
- **THEN** the control behaves exactly as it does for a touch tap, and the control's hover path does not also fire

#### Scenario: Touch unaffected by the mode
- **WHEN** a touch user taps any hover-revealed surface
- **THEN** the behavior is the same whether the build is click-mode or hover-mode
