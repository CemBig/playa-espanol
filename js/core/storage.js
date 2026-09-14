// Central persistence: SRS review state, which cards/lessons have been introduced, and settings.
// Everything lives in localStorage under one key so export/import is a single JSON blob.

const STATE_KEY = "es_app_state_v1";
const SCHEMA_VERSION = 1;

function defaultState() {
  return {
    version: SCHEMA_VERSION,
    srs: {}, // cardId -> { ef, interval, reps, lapses, due, lastReviewed }
    introducedCards: [], // cardIds that have entered the review pool
    introducedLessons: [], // lessonIds the user has opened/started
    stats: { totalReviews: 0, streakDays: 0, lastStudyDate: null },
    settings: { theme: "auto", direction: "mixed", ttsRate: 0.85, voiceURI: null }
  };
}

let cache = null;

function read() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STATE_KEY);
    cache = raw ? { ...defaultState(), ...JSON.parse(raw) } : defaultState();
  } catch {
    cache = defaultState();
  }
  return cache;
}

function write() {
  localStorage.setItem(STATE_KEY, JSON.stringify(cache));
}

export function getState() {
  return read();
}

export function getCardState(cardId) {
  return read().srs[cardId] || null;
}

export function setCardState(cardId, state) {
  const s = read();
  s.srs[cardId] = state;
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
  if (!s.introducedLessons.includes(lessonId)) s.introducedLessons.push(lessonId);
  write();
}

export function isLessonIntroduced(lessonId) {
  return read().introducedLessons.includes(lessonId);
}

export function recordReview() {
  const s = read();
  const today = new Date().toISOString().slice(0, 10);
  if (s.stats.lastStudyDate !== today) {
    const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    s.stats.streakDays = s.stats.lastStudyDate === y ? s.stats.streakDays + 1 : 1;
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
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `spanisch-fortschritt-${date}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function importStateJSON(json) {
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== "object" || !("srs" in parsed)) {
    throw new Error("Ungültige Datei: kein gültiger Fortschritts-Export.");
  }
  cache = { ...defaultState(), ...parsed };
  write();
  return cache;
}

export function resetAllProgress() {
  cache = defaultState();
  write();
}
