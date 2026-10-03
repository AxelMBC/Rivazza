// Normalised slip peaks at ~1; cornering at the limit reads 0.6–1.0, so the
// off point sits below that band or a lamp flickers through the corner.
export const SLIP_ON = 1.2;
export const SLIP_OFF = 0.9;
export const SLIP_CRITICAL = 3;

// Index order must match the tyreSlip / wheelLoad arrays.
export const WHEEL_LABELS = ["FL", "FR", "RL", "RR"] as const;
