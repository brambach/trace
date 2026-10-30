import { buildLetter, weekStartOf, type FixStatus, type Letter } from '@trace/coach';
import { getCoach } from './coach';

export function letterFor(week: string | undefined): Letter {
  const view = getCoach();
  const status = new Map<string, FixStatus>(view.views.map((v) => [v.fix.id, { state: v.state, saidSince: v.saidSince }]));
  const parsed = week && /^\d{4}-\d{2}-\d{2}$/u.test(week) ? new Date(`${week}T00:00:00Z`) : new Date();
  return buildLetter(view.timelines, view, status, weekStartOf(parsed));
}
