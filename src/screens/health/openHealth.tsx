import type { OverlayApi } from '../../ui/overlay-context';
import { HealthSheet } from './HealthSheet';

export function openHealthSheet(openSheet: OverlayApi['openSheet'], shortcutName: string): void {
  openSheet({ title: 'Health holen', render: () => <HealthSheet shortcutName={shortcutName} /> });
}
