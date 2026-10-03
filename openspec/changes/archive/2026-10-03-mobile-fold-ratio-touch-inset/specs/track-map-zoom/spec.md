## MODIFIED Requirements

### Requirement: Scroll-wheel zoom anchored at the cursor

This cursor-anchored behavior SHALL apply whenever the follow camera is not tracking — that is, with follow mode off, including after a touch pan has ended follow mode.

#### Scenario: Cursor anchoring after a touch pan ended follow

- **WHEN** a touch pan has ended follow mode and the wheel scrolls with the cursor over a corner
- **THEN** the view magnifies around the cursor exactly as it does with follow mode off
