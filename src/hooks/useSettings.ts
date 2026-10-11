import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { parseSettings } from '../db/repo';
import { DEFAULT_SETTINGS, type Settings } from '../db/schemas';

export function useSettings(): Settings {
  return useLiveQuery(async () => parseSettings((await db.kv.get('settings'))?.value), [], DEFAULT_SETTINGS);
}

export function useKV<T>(key: string): T | undefined {
  return useLiveQuery(async () => (await db.kv.get(key))?.value as T | undefined, [key]);
}
