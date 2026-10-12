import type { Session, SessionType } from '../../db/schemas';
import { SESSION_LABEL } from '../../lib/calc/training';
import type { ISODate } from '../../lib/date';
import type { OverlayApi } from '../../ui/overlay-context';
import { SessionSheet } from './SessionSheet';

export function openSessionSheet(
  openSheet: OverlayApi['openSheet'],
  opts: { date?: ISODate; type?: SessionType; session?: Session } = {},
): void {
  openSheet({
    title: opts.session ? SESSION_LABEL[opts.session.type] : 'Training eintragen',
    render: (close) => <SessionSheet date={opts.date} type={opts.type} session={opts.session} close={close} />,
  });
}
