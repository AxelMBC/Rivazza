# touch-interaction

## Purpose
Give touch devices first-class equivalents to the dashboard's hover-only desktop interactions. Every hover-revealed surface (lap-list flyout, lap-analysis panel, tyre overlay), in-panel hover action (lap rows, lap chips), and canvas gesture (lap-line readout, trace scrub) gains a tap or touch-drag counterpart, branched per input event's pointer type so mouse behavior stays byte-identical and touchscreen laptops get both models. Touch gestures handled on canvases never leak into page scroll or browser zoom.

## Requirements

### Requirement: Interactions branch on the gesture's own pointer type
Interaction handlers SHALL determine touch versus mouse behavior from the modality of each individual input event (touch events, or pointer events with `pointerType === 'touch'`), not from a device-level mode. Mouse-driven interactions SHALL behave exactly as they do today — hover, wheel, and dwell semantics unchanged — regardless of whether the device also has a touchscreen.

#### Scenario: Touchscreen laptop uses both models
- **WHEN** a user on a touchscreen laptop hovers the lap list with the mouse, then taps it with a finger
- **THEN** the hover reveal works exactly as on a mouse-only desktop, and the tap toggle works exactly as on a phone

#### Scenario: Desktop behavior unchanged
- **WHEN** a mouse-only user interacts with any hover-revealed surface
- **THEN** the reveal, dwell, and wheel behavior is identical to the pre-change behavior

### Requirement: Hover-revealed panels toggle by tap on touch
Every surface revealed by hover on desktop — the session lap-list flyout, the lap-analysis panel, and the tyre overlay — SHALL open on a tap of its collapsed summary on touch devices and close on a subsequent tap (on the summary or an equivalent close affordance). An open panel SHALL NOT depend on the browser's emulated-hover state to stay open or to close.

#### Scenario: Opening the lap analysis panel by tap
- **WHEN** a touch user taps the collapsed lap-analysis summary bar
- **THEN** the analysis panel opens and stays open until deliberately closed

#### Scenario: Closing a tapped-open panel
- **WHEN** the panel is open from a tap and the user taps its summary/close affordance again
- **THEN** the panel closes

#### Scenario: Tyre overlay on touch
- **WHEN** a touch user taps the instrument cluster region that reveals the tyre overlay on hover
- **THEN** the overlay shows, and a second tap dismisses it

### Requirement: In-panel hover interactions have tap equivalents
Within revealed panels, interactions driven by row or chip hover on desktop SHALL work by tap on touch: tapping a lap row in the session lap list SHALL focus that lap on the track map (cut markers, emphasis) as row hover does, and tapping a lap chip in the analysis panel SHALL select that lap.

#### Scenario: Tapping a lap row
- **WHEN** a touch user taps a lap row in the open session-lap flyout
- **THEN** the track map emphasizes that lap and reveals its cut markers, as desktop row hover does

#### Scenario: Tapping a lap chip
- **WHEN** a touch user taps a lap chip in the open analysis panel
- **THEN** that lap becomes the analysis selection, with the same map-side effects as desktop chip hover

### Requirement: Lap-line readout by tap on the track map
On touch devices, a single-finger tap (a touch that ends within a small movement slop) near a stored lap line SHALL show the same readout and line emphasis that cursor hover shows on desktop. A tap on empty map area SHALL dismiss the readout. Pinch or pan gestures SHALL NOT trigger or retain the readout.

#### Scenario: Tapping a lap line
- **WHEN** a touch user taps within the pick radius of a stored lap's line
- **THEN** the lap's readout (lap, time, speed, gear, pedal state) appears and the line is emphasized, identical to desktop hover

#### Scenario: Dismissing the readout
- **WHEN** a readout is showing and the user taps an empty area of the map
- **THEN** the readout and emphasis clear

#### Scenario: Pinching does not pick
- **WHEN** the user pinches to zoom with a finger passing near a lap line
- **THEN** no readout appears

### Requirement: Analysis traces scrub by touch drag
Dragging a finger across the lap-analysis traces SHALL scrub them — moving the trace cursor and echoing the ring marker on the track map — exactly as mouse movement does on desktop. Lifting the finger SHALL clear the scrub state as the mouse leaving does. The drag SHALL NOT scroll the page.

#### Scenario: Scrubbing by finger
- **WHEN** a touch user drags a finger horizontally across the open analysis traces
- **THEN** the scrub cursor follows the finger and the track map shows the ring at the corresponding lap position, without the page scrolling

#### Scenario: Lifting the finger
- **WHEN** the finger lifts off the traces
- **THEN** the scrub cursor and the map ring clear

### Requirement: Canvas gestures never leak to the page
Touch gestures that the dashboard handles on its canvases (map pinch, map pan, trace scrub) SHALL NOT cause page scrolling or browser zoom.

#### Scenario: Pinching over the map
- **WHEN** a touch user pinches on the track-map canvas
- **THEN** the map zooms and the browser page does not zoom or scroll
