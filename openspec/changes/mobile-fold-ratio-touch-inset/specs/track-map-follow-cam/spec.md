## MODIFIED Requirements

### Requirement: Touch gestures detach tracking in place

A one-finger pan gesture on the map during follow tracking (or during the exit animation) SHALL end follow mode immediately and hand the view to manual touch zoom/pan, seeded from the follow transform at that instant (no jump), with the button returning to "Follow car" — there is no separate detached state, and the view stays at the panned zoom and offset rather than animating back to the fit framing. A two-finger pinch SHALL NOT end follow mode; it retargets the follow camera instead. Tapping "Follow car" afterwards SHALL resume tracking from the current view.

#### Scenario: Pan during tracking

- **WHEN** the user drags one finger across the canvas while the view is tracking the car
- **THEN** tracking stops without a jump, the view pans with the finger, and the button changes from "Exit follow" to "Follow car"

#### Scenario: Pinching fully out after a pan

- **WHEN** the user has ended follow mode with a pan and then pinches out until zoom reaches 1×
- **THEN** the map shows the default fit framing and the button still reads "Follow car"

### Requirement: Exit button returns to the normal view with a zoom-out effect

While follow mode is active (tracking, or animating its exit), an exit button SHALL be shown in place of the follow button; a touch pan ends follow mode and dismisses it (see "Touch gestures detach tracking in place").

#### Scenario: Exit button after a pan

- **WHEN** follow mode is tracking and the user pans the map with one finger
- **THEN** the exit button is replaced by the follow button immediately

### Requirement: Follow mode resets with the session

Follow mode (tracking or mid-animation) SHALL end and the view SHALL reset to the 1× fit framing when the session changes or a session restart is detected, together with the existing lap-line and zoom reset.

#### Scenario: Restart while following

- **WHEN** the user restarts the session in game during follow mode
- **THEN** follow mode ends and the map returns to the 1× fit framing
