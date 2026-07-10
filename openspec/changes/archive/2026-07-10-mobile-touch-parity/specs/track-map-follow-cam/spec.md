# track-map-follow-cam (delta)

## ADDED Requirements

### Requirement: Tap toggles follow mode on touch
On touch devices, a tap on the follow button SHALL activate follow mode immediately, and a tap on the exit button SHALL trigger the animated zoom-out to the fit view immediately — no dwell, no press-and-hold. The 3-second hover dwell SHALL remain the activation mechanism for mouse pointers only. A tap SHALL NOT leave the button in a state where the opposite action is blocked (the mouse-path re-arm guard SHALL NOT apply to touch activations), and the compatibility mouse events a browser synthesizes after a tap SHALL NOT start a phantom dwell or re-toggle the state.

#### Scenario: Tap to follow
- **WHEN** a touch user taps the "Follow car" button
- **THEN** follow mode activates immediately and the button becomes "Exit follow"

#### Scenario: Tap to exit — the reported bug
- **WHEN** follow mode is active (entered by tap) and the touch user taps "Exit follow"
- **THEN** the view animates back to the 1× fit framing and the follow button returns

#### Scenario: Repeated toggling
- **WHEN** a touch user taps the button several times in succession
- **THEN** each tap toggles between following and exiting with no stuck state

#### Scenario: Mouse dwell unaffected
- **WHEN** a mouse user hovers the follow button
- **THEN** the 3-second dwell with progress indicator behaves exactly as before

### Requirement: Touch gestures detach tracking in place
A pinch or pan gesture on the map during follow tracking (or during the exit animation) SHALL stop the tracking immediately and hand the view to manual touch zoom/pan, seeded from the follow transform at that instant — the same detach-in-place rule as wheel input. In the detached state the exit button SHALL remain available, and pinching fully out to 1× SHALL reset to the fit framing and end follow mode.

#### Scenario: Pinch during tracking
- **WHEN** the user pinches while the view is tracking the car
- **THEN** tracking stops without a jump, the pinch zooms from the current framing, and the exit button stays visible

#### Scenario: Pinching fully out while detached
- **WHEN** the user in the detached state pinches out until zoom reaches 1×
- **THEN** the map shows the default fit framing and the exit button is dismissed
