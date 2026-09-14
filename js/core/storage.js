// Central persistence: SRS review state, which cards/lessons have been introduced, and settings.
// Everything lives in localStorage under one key so export/import is a single JSON blob.

const STATE_KEY = "es_app_state_v2";
const LEGACY_KEY = "es_app_state_v1"; // index-based card ids, incompatible with the current scheme
const SCHEMA_VERSION = 2;

function defaultState() {
  return {
    version: SCHEMA_VERSION,
    srs: {}, // cardId -> { ef, interval, reps, lapses, due, lastReviewed }
    introducedCards: [], // cardIds that have entered the review pool
    introducedLessons: [], // lessonIds the user has started
    stats: { totalReviews: 0, streakDays: 0, lastStudyDate: null },
    settings: { theme: "auto", direction: "mixed", ttsRate: 0.85, voiceURI: null, newPerSession: 10 }
  };
}

let cache = null;

// v1 stored card ids as `${lessonId}-${index}`, which broke whenever lesson content changed.
// Those ids can't be mapped onto the current content-derived ids, so scheduling restarts —
// but settings and the study streak are worth carrying over.
function migrateLegacy(fresh) {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return fresh;
    const old = JSON.parse(raw);
    if (old.settings) fresh.settings = { ...fresh.settings, ...old.settings };
    if (old.stats) fresh.stats = { ...fresh.stats, ...old.stats };
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore unreadable legacy state */
  }
  return fresh;
}

function read() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const base = defaultState();
      cache = { ...base, ...parsed, settings: { ...base.settings, ...(parsed.settings || {}) } };
    } else {
      cache = migrateLegacy(defaultState());
      write();
    }
  } catch {
    cache = defaultState();
  }
  return cache;
}

function write() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(cache));
  } catch {
    /* storage full or blocked (private mode) — keep running in memory */
  }
}

export function getState() {
  return read();
}

export function getCardState(cardId) {
  return read().srs[cardId] || null;
}

export function setCardState(cardId, state) {
  read().srs[cardId] = state;
  write();
}

export function isIntroduced(cardId) {
  return read().introducedCards.includes(cardId);
}

export function introduceCards(cardIds) {
  const s = read();
  for (const id of cardIds) {
    if (!s.introducedCards.includes(id)) s.introducedCards.push(id);
  }
  write();
}

export function markLessonIntroduced(lessonId) {
  const s = read();
  if (!s.introducedLessons.includes(lessonId)) {
    s.introducedLessons.push(lessonId);
    write();
  }
}

export function isLessonIntroduced(lessonId) {
  return read().introducedLessons.includes(lessonId);
}

export function recordReview() {
  const s = read();
  const today = new Date().toISOString().slice(0, 10);
  if (s.stats.lastStudyDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    s.stats.streakDays = s.stats.lastStudyDate === yesterday ? s.stats.streakDays + 1 : 1;
    s.stats.lastStudyDate = today;
  }
  s.stats.totalReviews += 1;
  write();
}

export function getSettings() {
  return read().settings;
}

export function updateSettings(patch) {
  const s = read();
  s.settings = { ...s.settings, ...patch };
  write();
}

export function exportStateJSON() {
  return JSON.stringify(read(), null, 2);
}

export function downloadExport() {
  const blob = new Blob([exportStateJSON()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `spanisch-fortschritt-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function importStateJSON(json) {
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== "object" || typeof parsed.srs !== "object") {
    throw new Error("Keine gültige Fortschritts-Datei.");
  }
  const base = defaultState();
  cache = { ...base, ...parsed, settings: { ...base.settings, ...(parsed.settings || {}) } };
  write();
  return cache;
}

export function resetAllProgress() {
  cache = defaultState();
  write();
}
