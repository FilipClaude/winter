import type { Session, SessionType } from '../../db/schemas';
import { SESSION_LABEL } from '../../lib/calc/training';
import type { ISODate } from '../../lib/date';
import type { OverlayApi } from '../../ui/overlay-context';
import { SessionSheet, type BfvPreset } from './SessionSheet';

export function openSessionSheet(
  openSheet: OverlayApi['openSheet'],
  opts: { date?: ISODate; type?: SessionType; session?: Session; bfv?: BfvPreset } = {},
): void {
  openSheet({
    title: opts.session ? SESSION_LABEL[opts.session.type] : opts.bfv ? 'Spiel eintragen' : 'Training eintragen',
    render: (close) => <SessionSheet date={opts.date} type={opts.type} session={opts.session} bfv={opts.bfv} close={close} />,
  });
}
