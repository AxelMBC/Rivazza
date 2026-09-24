## MODIFIED Requirements

### Requirement: Zoom requires no click, keyboard, or window focus
All zoom and navigation interaction SHALL work with hover and scroll-wheel alone: no click, drag, double-click, keyboard, or browser-window focus is required at any point. This covers wheel zoom on the map and navigating a zoomed view through the overview inset (see `track-map-overview`), so a mouse user can reach any part of the track at the current zoom without zooming out. This preserves controller input to the running game.

#### Scenario: Zooming with the game focused
- **WHEN** the browser window is unfocused (the game has focus) and the cursor hovers the map while the wheel scrolls
- **THEN** the map zooms, and the game continues to receive controller input

#### Scenario: Moving a zoomed view with the game focused
- **WHEN** the browser window is unfocused, the map is zoomed in with follow mode off, and the cursor rests on another part of the track in the overview inset
- **THEN** the main view moves there at the same zoom, and the game continues to receive controller input
