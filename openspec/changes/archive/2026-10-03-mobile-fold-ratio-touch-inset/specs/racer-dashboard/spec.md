## MODIFIED Requirements

### Requirement: Phone layout keeps the cluster and track map on the first screen

The first screen — the visible viewport height left under the session header — SHALL be a fold split by height one third to the instrument cluster and two thirds to the track map. The cluster SHALL be rendered in full (speedometer, tachometer, status lights, car glyph and pedal lamps, none clipped) by scaling its contents down uniformly to fit its third, keeping their proportions and the speedometer's dominance over the tachometer; it SHALL never scale up beyond its desktop size. The fold SHALL be sized against the small (browser-chrome-visible) viewport height. When the viewport is too short for a usable fold (below about 384 px of fold height, for example a phone in landscape), the fold SHALL keep that minimum height and the page scrolls to reach the rest. This replaces the earlier tighter-spacing rule and the ~160 px track map minimum.

#### Scenario: iPhone SE shows speed and position at once

- **WHEN** the dashboard renders with a session active at 375×667 CSS pixels, and again at 375×553 (the same phone with the browser's toolbars showing)
- **THEN** the whole instrument cluster and the whole track map card are visible without scrolling, the cluster has no internal scrollbar, and the track map card is about twice as tall as the cluster card

#### Scenario: Short landscape viewport degrades to scrolling

- **WHEN** the dashboard renders at a phone landscape viewport such as 667×375
- **THEN** the fold keeps its minimum height with the same one-third/two-thirds split, nothing is clipped, and the content past the viewport is reached by scrolling the page
