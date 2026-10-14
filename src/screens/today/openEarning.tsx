import type { Earning } from '../../db/schemas';
import type { ISODate } from '../../lib/date';
import type { OverlayApi } from '../../ui/overlay-context';
import { EarningSheet } from './Earnings';

export function openEarningSheet(openSheet: OverlayApi['openSheet'], opts: { date?: ISODate; earning?: Earning } = {}) {
  openSheet({
    title: opts.earning ? 'Verdienst bearbeiten' : 'Verdienst eintragen',
    render: (close) => <EarningSheet close={close} {...opts} />,
  });
}
