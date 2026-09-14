// Spaced repetition based on SM-2 (the algorithm behind Anki's classic scheduler), with
// Anki's refinement that Hard/Good/Easy produce genuinely different intervals instead of
// only differing in their effect on the ease factor.
//
// Grades map to the classic 0-5 scale: Again=2, Hard=3, Good=4, Easy=5.

export const GRADE = { AGAIN: 2, HARD: 3, GOOD: 4, EASY: 5 };

const DAY_MS = 24 * 60 * 60 * 1000;
const RELEARN_INTERVAL = 1 / 24; // ~1 hour
const MAX_INTERVAL = 365 * 2;
const MIN_EF = 1.3;
const HARD_FACTOR = 1.2;
const EASY_BONUS = 1.3;

export function freshCardState() {
  return { ef: 2.5, interval: 0, reps: 0, lapses: 0, due: Date.now(), lastReviewed: null };
}

function nextInterval(state, grade) {
  if (grade < GRADE.HARD) return RELEARN_INTERVAL;

  // First successful pass over a new (or lapsed) card.
  if (state.reps === 0) {
    if (grade === GRADE.HARD) return 1;
    if (grade === GRADE.GOOD) return 1;
    return 4; // Easy skips ahead
  }
  // Second pass.
  if (state.reps === 1) {
    if (grade === GRADE.HARD) return Math.max(1, state.interval * HARD_FACTOR);
    if (grade === GRADE.GOOD) return 6;
    return 6 * EASY_BONUS;
  }
  // Mature card: grow by the ease factor.
  if (grade === GRADE.HARD) return state.interval * HARD_FACTOR;
  if (grade === GRADE.GOOD) return state.interval * state.ef;
  return state.interval * state.ef * EASY_BONUS;
}

// Returns the next state for a card given its previous state and a grade (2-5).
// Pure function: safe to call for previewing intervals without committing them.
export function schedule(prevState, grade) {
  const state = prevState ? { ...prevState } : freshCardState();

  const interval = Math.min(MAX_INTERVAL, nextInterval(state, grade));

  if (grade < GRADE.HARD) {
    state.reps = 0;
    state.lapses += 1;
  } else {
    state.reps += 1;
  }

  // SM-2 ease-factor update.
  state.ef = Math.max(MIN_EF, state.ef + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
  state.interval = interval;
  state.due = Date.now() + interval * DAY_MS;
  state.lastReviewed = Date.now();
  return state;
}

export function isDue(state) {
  return !state || state.due <= Date.now();
}

// Builds the review queue: introduced cards that are due, longest-overdue first.
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
