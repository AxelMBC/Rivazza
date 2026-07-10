# responsive-header

## Purpose
Keep the session header readable at every viewport width. Below the small breakpoint the header reflows into a stacked arrangement — track title, car · driver line, and badge pills wrap with reduced spacing and long names truncate — instead of crushing onto a single row; at and above the breakpoint the desktop single-row layout is untouched.

## Requirements

### Requirement: Session header adapts to narrow viewports
On viewports narrower than the small breakpoint, the session header SHALL reflow instead of compressing on a single row: the track title (with layout config), the car · driver line, and the badge pills (demo indicator, connection status, source link) SHALL wrap into a stacked arrangement with reduced spacing, and long track/car names SHALL truncate rather than overflow or crush the pills. On viewports at or above the small breakpoint the header SHALL render exactly as it does today — single row, title left, pills right, identical typography and spacing.

#### Scenario: Header on a phone
- **WHEN** the dashboard renders at a phone-width viewport with a session active
- **THEN** the track title, car · driver line, and pills are each fully readable — nothing overlaps, overflows the viewport, or shrinks to an unreadable squeeze

#### Scenario: Long names on a phone
- **WHEN** the track or car name is longer than the viewport width allows
- **THEN** the name truncates with an ellipsis instead of pushing the pills off-screen

#### Scenario: Desktop unchanged
- **WHEN** the dashboard renders at a desktop-width viewport
- **THEN** the header layout, typography, and spacing are pixel-identical to the pre-change rendering
