## MODIFIED Requirements

### Requirement: Motorsport visual restyle

The dashboard layout SHALL be reorganized into a dense, race-engineering style: instrument cluster and lap timing prominent, track map dominant, G-meter and steering as supporting panels, using the existing dark theme tokens with tabular numerals for all timing and numeric readouts. The pre-session waiting screen behavior SHALL remain unchanged.

On the desktop layout (at and above the large breakpoint) the sidebar SHALL be arranged, top to bottom, as: the instrument cluster, with the speedometer on the left and, in a column to its right, the tachometer on top and the status lights (including the pedal lights) beneath it; the lap-timing tiles; and a single supporting card holding the G-force meter with the steering indicator as a single full-width row along its bottom. The supporting card SHALL be the sidebar's only element whose height follows the available space — it fills what the fixed-height elements leave, and the meter resizes with it — so the sidebar never needs to scroll. When that leftover height is too small for a legible meter (a card slot below about 160 px), the G-force meter SHALL hide rather than render collapsed rings, and the card SHALL show the steering indicator alone, vertically centred. The G-force meter SHALL stay square (a circle of rings, never an ellipse) at every card size. Below the large breakpoint the dashboard SHALL follow the phone layout defined by the "Phone layout keeps the cluster and track map on the first screen" requirement.

#### Scenario: Session active

- **WHEN** a session is connected and telemetry is flowing on a viewport at or above the large breakpoint
- **THEN** the dashboard shows cluster, status and pedal lights, steering indicator, lap times with delta, G-meter, and the gradient track map in a single non-scrolling viewport

#### Scenario: Desktop and laptop viewports fit without scrolling

- **WHEN** the dashboard renders with a session active at any viewport from 1366×650 up to 1920×1080 CSS pixels
- **THEN** the sidebar's content height does not exceed its visible height — no sidebar scrollbar appears, the steering indicator is visible, and the G-force meter is either fully visible and circular or hidden entirely

#### Scenario: Supporting card absorbs the leftover height

- **WHEN** the viewport height changes between those sizes
- **THEN** only the G-force card changes height; the cluster and timing tiles keep their size, and the G-force meter remains circular

#### Scenario: Too little height for a legible G-force meter

- **WHEN** the dashboard renders at 1366×650, where the sidebar leaves the supporting card less than about 160 px
- **THEN** the card shows only the steering indicator — no collapsed rings — and the G-force meter reappears above it as soon as the viewport is tall enough

#### Scenario: Waiting for the sim

- **WHEN** no session is active
- **THEN** the existing waiting screen is shown as before

## ADDED Requirements

### Requirement: Phone layout keeps the cluster and track map on the first screen

Below the large breakpoint the dashboard SHALL render as a single column that scrolls as one page, ordered top to bottom: the instrument cluster, the track map, the lap-timing tiles, the supporting G-force/steering card, and the lap analysis. No dashboard card SHALL scroll inside its own box in this layout; the page scroll is the only scroll.

The first screen — the visible viewport height left under the session header — SHALL be a fold holding exactly the instrument cluster and the track map: the cluster rendered in full (speedometer, tachometer, status lights, car glyph and pedal lamps, none clipped), and the track map filling the remaining fold height. The fold SHALL be sized against the small (browser-chrome-visible) viewport height, so the map's bottom edge stays on screen while a mobile browser's toolbars are showing. In this layout the cluster and the page SHALL use tighter padding and gaps than on desktop, so the track map keeps a usable minimum height of about 160 px; the cluster's gauges keep their desktop proportions. When the viewport is too short for the full cluster plus that minimum map height (for example a phone in landscape), the fold SHALL grow past the viewport rather than clip either element, and the page scrolls to reach the rest.

The lap-timing tiles, the supporting card and the lap analysis SHALL follow below the fold at their natural heights, each fully reachable by scrolling the page. The supporting card's G-force meter SHALL stay square in this layout. The desktop layout at and above the large breakpoint SHALL be unaffected.

#### Scenario: iPhone SE shows speed and position at once

- **WHEN** the dashboard renders with a session active at 375×667 CSS pixels, and again at 375×553 (the same phone with the browser's toolbars showing)
- **THEN** the whole instrument cluster and the whole track map card are visible without scrolling, the cluster has no internal scrollbar, and the track map is at least about 250 px tall at 375×667 and at least about 160 px tall at 375×553

#### Scenario: Scrolling reveals the rest of the dashboard

- **WHEN** the user scrolls the page down from the first screen on a phone-width viewport
- **THEN** the lap-timing tiles, the G-force/steering card and the lap analysis appear below the track map in that order, and the page scroll reaches the bottom of the lap analysis

#### Scenario: Short landscape viewport degrades to scrolling

- **WHEN** the dashboard renders at a phone landscape viewport such as 667×375
- **THEN** neither the cluster nor the track map is clipped or collapsed below its minimum; the content past the viewport is reached by scrolling the page

#### Scenario: Track-map gestures stay on the map

- **WHEN** a touch user pinches or pans on the track map in the phone layout
- **THEN** the map zooms or pans as before and the page does not scroll; a swipe that starts on the cluster, the header, or a below-fold card scrolls the page

#### Scenario: Desktop unchanged

- **WHEN** the dashboard renders at or above the large breakpoint
- **THEN** the two-column layout, the no-scroll sidebar fit, and every element's size are identical to before this change
