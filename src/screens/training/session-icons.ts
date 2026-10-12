import type { LucideIcon } from 'lucide-react';
import { Activity, Dumbbell, Footprints, HeartHandshake, Trophy, Volleyball } from 'lucide-react';
import type { SessionType } from '../../db/schemas';

export const SESSION_ICON: Record<SessionType, LucideIcon> = {
  // Lucide hat keinen Fußball; der Volleyball liest sich in 16px als Ball.
  football: Volleyball,
  match: Trophy,
  gym: Dumbbell,
  run: Footprints,
  recovery: HeartHandshake,
  other: Activity,
};
