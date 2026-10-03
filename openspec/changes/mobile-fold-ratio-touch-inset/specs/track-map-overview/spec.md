## MODIFIED Requirements

### Requirement: Overview inset appears while zoomed in and not tracking

The inset SHALL additionally be shown only on devices whose primary pointer is fine (a mouse or trackpad — desktops and laptops, including touchscreen laptops); on devices whose primary pointer is coarse (phones, tablets, iPads) it SHALL never be shown, because touch panning already reaches any point of the track while zoomed in.

#### Scenario: Zooming in on a phone

- **WHEN** a user on a phone or tablet pinch-zooms the map past the two-notch threshold with follow mode off
- **THEN** no overview inset is drawn, and the whole map area stays pannable and pinchable

#### Scenario: Detached follow shows the inset

- **WHEN** on a device whose primary pointer is a mouse or trackpad, a touch pan has detached follow mode at a zoom of two notches or more
- **THEN** the inset is shown

### Requirement: Tap and click on the inset navigate immediately where allowed

On a fine-primary-pointer device with a touchscreen, a tap on the visible inset (a touch that ends within the tap slop) SHALL navigate the main view to the tapped point immediately, with the same glide and unchanged zoom; coarse-primary-pointer devices never show the inset.

#### Scenario: Tapping the inset

- **WHEN** a touchscreen-laptop user taps a point on the visible inset
- **THEN** the main view glides to centre that point at the unchanged zoom
