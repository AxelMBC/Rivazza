import type { ConnectionStatus, SessionInfo } from '../types';
import { prettifyName } from '../lib/format';
import { IS_DEMO } from '../lib/demo';
import { ConnectionBadge } from './ConnectionBadge';
import { DemoBadge } from './DemoBadge';
import { GitHubLink } from './GitHubLink';

type Props = {
  session: SessionInfo | null;
  status: ConnectionStatus;
};

// Mobile-first: the title block and pill row stack with tighter padding on
// narrow viewports (one row squeezed everything unreadably); `sm:` restores
// the original single-row desktop layout verbatim. In a demo/replay build the
// connection badge is dropped everywhere — "Live" next to "Demo replay" was
// contradictory; the demo badge is the status.
export const SessionHeader = ({ session, status }: Props) => (
  <header className="flex flex-col gap-2 border-b border-hairline px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-0 sm:px-6 sm:py-4">
    <div className="min-w-0">
      <h1 className="truncate text-lg font-semibold sm:text-xl">
        {session ? prettifyName(session.track) : 'Assetto Corsa Telemetry'}
        {session?.trackConfig && (
          <span className="ml-2 text-sm font-normal text-ink-secondary sm:text-base">
            {prettifyName(session.trackConfig)}
          </span>
        )}
      </h1>
      {session && (
        <p className="mt-0.5 truncate text-sm text-ink-muted">
          {prettifyName(session.car)}
          {session.driver && <> · {session.driver}</>}
        </p>
      )}
    </div>
    <div className="flex flex-wrap items-center gap-2">
      {IS_DEMO ? <DemoBadge /> : <ConnectionBadge status={status} />}
      <GitHubLink />
    </div>
  </header>
);
