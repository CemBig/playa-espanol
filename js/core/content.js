// Turns raw lesson packs into a flat card index and keeps built-in + imported packs together.
import { LESSONS as CORE_LESSONS, LESSON_PACK_ID, LESSON_PACK_VERSION } from "../content/lessons.js";

function buildCards(lesson) {
  return lesson.items.map((item, i) => ({
    id: `${lesson.id}-${i}`,
    lessonId: lesson.id,
    es: item.es,
    de: item.de,
    ex_es: item.ex_es || null,
    ex_de: item.ex_de || null,
    note: item.note || null
  }));
}

function loadCustomPacks() {
  try {
    const raw = localStorage.getItem("es_custom_packs");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomPacks(packs) {
  localStorage.setItem("es_custom_packs", JSON.stringify(packs));
}

export function getCustomPacks() {
  return loadCustomPacks();
}

export function addCustomPack(pack) {
  if (!pack || !pack.lessons || !Array.isArray(pack.lessons)) {
    throw new Error("Ungültiges Lektionspaket: erwartet { id, name, lessons: [...] }");
  }
  const packs = loadCustomPacks();
  const idx = packs.findIndex((p) => p.id === pack.id);
  if (idx >= 0) packs[idx] = pack;
  else packs.push(pack);
  saveCustomPacks(packs);
  return pack;
}

export function removeCustomPack(packId) {
  const packs = loadCustomPacks().filter((p) => p.id !== packId);
  saveCustomPacks(packs);
}

// Builds the full lesson+card registry from the core pack plus any user-imported packs.
export function getAllLessons() {
  const packs = [{ id: LESSON_PACK_ID, version: LESSON_PACK_VERSION, lessons: CORE_LESSONS }, ...loadCustomPacks()];
  const lessons = [];
  for (const pack of packs) {
    for (const lesson of pack.lessons) {
      lessons.push({ ...lesson, packId: pack.id, cards: buildCards(lesson) });
    }
  }
  return lessons;
}

export function getAllCards() {
  const lessons = getAllLessons();
  return lessons.flatMap((l) => l.cards);
}

export function getCardById(id) {
  return getAllCards().find((c) => c.id === id) || null;
}

export function getLessonById(id) {
  return getAllLessons().find((l) => l.id === id) || null;
}
