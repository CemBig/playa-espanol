// SM-2 spaced repetition (the same algorithm Anki's core scheduler is based on).
// Quality buttons map to the classic 0-5 grades: Again=2, Hard=3, Good=4, Easy=5.

export const GRADE = { AGAIN: 2, HARD: 3, GOOD: 4, EASY: 5 };
const DAY_MS = 24 * 60 * 60 * 1000;

export function freshCardState() {
  return { ef: 2.5, interval: 0, reps: 0, lapses: 0, due: Date.now(), lastReviewed: null };
}

// Returns the next state given the previous SRS state and a grade (2-5).
export function schedule(prevState, grade) {
  const state = prevState ? { ...prevState } : freshCardState();
  const now = Date.now();

  if (grade < 3) {
    state.reps = 0;
    state.lapses += 1;
    state.interval = 1 / 24; // ~1 hour: come back soon within the same session/day
  } else {
    if (state.reps === 0) state.interval = 1;
    else if (state.reps === 1) state.interval = 6;
    else state.interval = Math.round(state.interval * state.ef);
    state.reps += 1;
  }

  state.ef = Math.max(1.3, state.ef + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
  state.due = now + state.interval * DAY_MS;
  state.lastReviewed = now;
  return state;
}

export function isDue(state) {
  return !state || state.due <= Date.now();
}

// Builds today's review queue: introduced cards that are due, oldest-due first.
export function buildReviewQueue(allCards, introducedIds, srsMap) {
  const introduced = new Set(introducedIds);
  return allCards
    .filter((c) => introduced.has(c.id))
    .map((c) => ({ card: c, state: srsMap[c.id] || freshCardState() }))
    .filter((x) => isDue(x.state))
    .sort((a, b) => a.state.due - b.state.due);
}

export function countDue(allCards, introducedIds, srsMap) {
  return buildReviewQueue(allCards, introducedIds, srsMap).length;
}

export function countNew(lessonCards, introducedIds) {
  const introduced = new Set(introducedIds);
  return lessonCards.filter((c) => !introduced.has(c.id)).length;
}
