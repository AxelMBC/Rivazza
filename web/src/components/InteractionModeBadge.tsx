import { CLICK_MODE } from '../lib/interaction';

const LABEL = CLICK_MODE ? 'Click mode' : 'Hover mode';
const DOT_CLASS = CLICK_MODE ? 'bg-accent' : 'bg-ink-muted';
const EXPLANATION = CLICK_MODE
  ? 'Demo replay — buttons and panels respond to clicks'
  : 'Interactions are hover-only so clicking never steals input focus from Assetto Corsa';

export const InteractionModeBadge = () => (
  <span
    className="flex items-center gap-2 rounded-full border border-edge bg-surface px-3 py-1.5 text-sm"
    title={EXPLANATION}
  >
    <span className={`size-2 rounded-full ${DOT_CLASS}`} />
    <span className="text-ink-secondary">{LABEL}</span>
  </span>
);
