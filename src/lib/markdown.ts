import type {
  Day,
  Deadline,
  Meal,
  Module,
  Session,
  Sleep,
  StudySession,
  Subject,
  Todo,
  HealthDay,
} from '../db/schemas';
import { effectiveSleep } from './calc/sleep';
import { SESSION_LABEL, sessionLoad } from './calc/training';
import {
  addDays,
  dateRange,
  formatDE,
  formatHM,
  formatMinutes,
  isoWeekNumber,
  toISODate,
  type ISODate,
} from './date';

/**
 * Markdown-Export für den Obsidian-Vault. Aufbau wie die Vault-Vorlage „Tagesnotiz“:
 * Überschrift „Wochentag, TT.MM.JJJJ“, Abschnitte Aufgaben · Notizen · Training,
 * dazu YAML-Frontmatter (datum, tags). Gym-Übungen als Tabelle wie in der Vorlage „Trainingseinheit“.
 */
export interface MarkdownData {
  days: Day[];
  sessions: Session[];
  todos: Todo[];
  deadlines: Deadline[];
  modules: Module[];
  subjects: Subject[];
  study: StudySession[];
  meals: Meal[];
  sleep: Sleep[];
  health: HealthDay[];
}

const WEEKDAY = new Intl.DateTimeFormat('de-DE', { weekday: 'long', timeZone: 'UTC' });
const weekdayName = (d: ISODate) => WEEKDAY.format(new Date(`${d}T12:00:00Z`));
const fmtKg = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
/** Zeilenumbrüche in Freitext erhalten, aber keine Markdown-Überschriften erzeugen. */
const safe = (s: string) => s.trim().replace(/^#/gm, '\\#');

function sessionLines(s: Session): string[] {
  const out: string[] = [];
  const base = `${SESSION_LABEL[s.type]} · ${s.durationMin} min · RPE ${s.rpe} · Load ${sessionLoad(s.durationMin, s.rpe)}`;
  if (s.match) {
    const m = s.match;
    out.push(`- ${base}`);
    out.push(
      `  - ${m.opponent || 'Gegner'} ${m.goalsFor}:${m.goalsAgainst} · ${m.minutes}′ · ${m.goals} Tore · ${m.assists} Assists · ${m.shots} Schüsse · Note ${m.rating}/10`,
    );
    if (m.reflection.trim()) out.push(`  - ${safe(m.reflection).replace(/\n/g, ' ')}`);
  } else {
    out.push(`- ${base}`);
  }
  if (s.gym && s.gym.exercises.length > 0) {
    out.push('', '| Übung | Sätze × Wdh. | Gewicht |', '|---|---|---|');
    for (const ex of s.gym.exercises) {
      const reps = ex.sets.map((x) => x.reps).join(' / ');
      const kg = ex.sets.map((x) => fmtKg(x.weightKg)).join(' / ');
      out.push(`| ${ex.name.replace(/\|/g, '/')} | ${ex.sets.length} × ${reps} | ${kg} kg |`);
    }
    out.push('');
  }
  if (s.note.trim()) out.push(`  - ${safe(s.note).replace(/\n/g, ' ')}`);
  return out;
}

function taskLines(data: MarkdownData, from: ISODate, to: ISODate): string[] {
  const subj = new Map(data.subjects.map((s) => [s.id, s.name]));
  const mod = new Map(data.modules.map((m) => [m.id, m.name]));
  const inRange = (d: string | undefined) => d !== undefined && d >= from && d <= to;
  const lines: string[] = [];
  const todos = data.todos.filter(
    (t) => inRange(t.due) || (t.done && t.doneAt !== undefined && inRange(toISODate(t.doneAt))),
  );
  for (const t of todos) {
    const meta = [t.subjectId && subj.get(t.subjectId), t.due && from !== to && `fällig ${formatDE(t.due)}`]
      .filter(Boolean)
      .join(', ');
    lines.push(`- [${t.done ? 'x' : ' '}] ${t.title}${meta ? ` (${meta})` : ''}`);
  }
  for (const d of data.deadlines.filter((x) => inRange(x.date))) {
    const name = mod.get(d.moduleId);
    lines.push(
      `- [${d.done ? 'x' : ' '}] FernUni${name ? ` ${name}` : ''}: ${d.title}${from !== to ? ` (fällig ${formatDE(d.date)})` : ''}`,
    );
  }
  return lines.length > 0 ? lines : ['- [ ] '];
}

function noteLines(day: Day | undefined): string[] {
  if (!day) return [];
  const out: string[] = [];
  if (day.note.trim()) out.push(safe(day.note), '');
  if (day.good.trim()) out.push(`**Gut lief:** ${safe(day.good)}`);
  if (day.better.trim()) out.push(`**Besser machen:** ${safe(day.better)}`);
  if (day.tomorrow.trim()) out.push(`**Morgen wichtig:** ${safe(day.tomorrow)}`);
  const mood = [day.mood && `Stimmung ${day.mood}/5`, day.energy && `Energie ${day.energy}/5`]
    .filter(Boolean)
    .join(' · ');
  if (mood) out.push('', mood);
  return out;
}

function bodyLine(data: MarkdownData, date: ISODate): string | null {
  const day = data.days.find((d) => d.date === date);
  const meals = data.meals.filter((m) => m.date === date);
  const sleep = effectiveSleep(
    data.sleep.find((s) => s.date === date),
    data.health.find((h) => h.date === date),
  );
  const steps = data.health.find((h) => h.date === date)?.steps;
  const parts = [
    sleep && `Schlaf ${formatHM(sleep.minutes)} h`,
    meals.length > 0 && `Protein ${Math.round(meals.reduce((a, m) => a + m.proteinG, 0))} g`,
    meals.length > 0 && `${meals.reduce((a, m) => a + m.kcal, 0)} kcal`,
    day && day.water > 0 && `Wasser ${day.water} Gläser`,
    steps !== undefined && `${steps.toLocaleString('de-DE')} Schritte`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

function studyLine(data: MarkdownData, from: ISODate, to: ISODate): string | null {
  const subj = new Map(data.subjects.map((s) => [s.id, s.name]));
  const by = new Map<string, number>();
  for (const s of data.study.filter((x) => x.date >= from && x.date <= to))
    by.set(s.subjectId, (by.get(s.subjectId) ?? 0) + s.minutes);
  if (by.size === 0) return null;
  return [...by.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, min]) => `${subj.get(id) ?? 'Fach'} ${formatMinutes(min)}`)
    .join(' · ');
}

export function dayMarkdown(data: MarkdownData, date: ISODate): string {
  const sessions = data.sessions
    .filter((s) => s.date === date)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const day = data.days.find((d) => d.date === date);
  const body = bodyLine(data, date);
  const study = studyLine(data, date, date);
  const notes = noteLines(day);
  const lines = [
    '---',
    `datum: ${date}`,
    'tags: [tagesnotiz, winter]',
    '---',
    `# ${weekdayName(date)}, ${formatDE(date)}`,
    '',
    '## Aufgaben',
    ...taskLines(data, date, date),
    '',
    '## Notizen',
    ...(notes.length > 0 ? notes : ['']),
    '',
    '## Training',
    ...(sessions.length > 0 ? sessions.flatMap(sessionLines) : ['- frei']),
  ];
  if (study || body) {
    lines.push('', '## Zahlen');
    if (study) lines.push(`- Lernen: ${study}`);
    if (body) lines.push(`- Körper: ${body}`);
  }
  return `${lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()}\n`;
}

export function weekMarkdown(data: MarkdownData, weekStart: ISODate): string {
  const to = addDays(weekStart, 6);
  const kw = isoWeekNumber(weekStart);
  const days = dateRange(weekStart, to);
  const sessions = data.sessions
    .filter((s) => s.date >= weekStart && s.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  const load = sessions.reduce((a, s) => a + sessionLoad(s.durationMin, s.rpe), 0);
  const lines = [
    '---',
    `datum: ${weekStart}`,
    `kw: ${kw}`,
    'tags: [wochenrückblick, winter]',
    '---',
    `# KW ${kw} · ${formatDE(weekStart)} – ${formatDE(to)}`,
    '',
    '## Aufgaben',
    ...taskLines(data, weekStart, to),
    '',
    '## Notizen',
  ];
  let anyNote = false;
  for (const d of days) {
    const n = noteLines(data.days.find((x) => x.date === d));
    if (n.length === 0) continue;
    anyNote = true;
    lines.push(`### ${weekdayName(d)}, ${formatDE(d)}`, ...n, '');
  }
  if (!anyNote) lines.push('');
  lines.push('', `## Training`, `Wochenlast: ${load} · ${sessions.length} Einheiten`, '');
  if (sessions.length === 0) lines.push('- keine Einheiten');
  for (const d of days) {
    const ds = sessions.filter((s) => s.date === d);
    if (ds.length === 0) continue;
    lines.push(`### ${weekdayName(d)}`, ...ds.flatMap(sessionLines), '');
  }
  const study = studyLine(data, weekStart, to);
  if (study) lines.push('', '## Zahlen', `- Lernen: ${study}`);
  return `${lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()}\n`;
}

export function weekFileName(weekStart: ISODate): string {
  return `${addDays(weekStart, 3).slice(0, 4)}-KW${String(isoWeekNumber(weekStart)).padStart(2, '0')}.md`;
}
