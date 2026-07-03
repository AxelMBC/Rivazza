import type { ConnectionStatus, SessionInfo } from '../types';
import { prettifyName } from '../lib/format';
import { ConnectionBadge } from './ConnectionBadge';

type Props = {
  session: SessionInfo | null;
  status: ConnectionStatus;
};

export const SessionHeader = ({ session, status }: Props) => (
  <header className="flex items-center justify-between border-b border-hairline px-6 py-4">
    <div>
      <h1 className="text-xl font-semibold">
        {session ? prettifyName(session.track) : 'Assetto Corsa Telemetry'}
        {session?.trackConfig && (
          <span className="ml-2 text-base font-normal text-ink-secondary">
            {prettifyName(session.trackConfig)}
          </span>
        )}
      </h1>
      {session && (
        <p className="mt-0.5 text-sm text-ink-muted">
          {prettifyName(session.car)}
          {session.driver && <> · {session.driver}</>}
        </p>
      )}
    </div>
    <ConnectionBadge status={status} />
  </header>
);
