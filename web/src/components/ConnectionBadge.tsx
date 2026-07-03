import type { ConnectionStatus } from '../types';

const STYLES: Record<ConnectionStatus, { dot: string; text: string; label: string }> = {
  connecting: { dot: 'bg-ink-muted', text: 'text-ink-muted', label: 'Connecting to bridge…' },
  waiting: { dot: 'bg-warning animate-pulse', text: 'text-warning', label: 'Waiting for game' },
  connected: { dot: 'bg-good', text: 'text-good', label: 'Live' },
};

export const ConnectionBadge = ({ status }: { status: ConnectionStatus }) => {
  const { dot, text, label } = STYLES[status];
  return (
    <span className="flex items-center gap-2 rounded-full border border-edge bg-surface px-3 py-1.5 text-sm">
      <span className={`size-2 rounded-full ${dot}`} />
      <span className={text}>{label}</span>
    </span>
  );
};
