// Turns raw lesson packs into a flat card index and keeps built-in + imported packs together.
import { LESSONS as CORE_LESSONS, LESSON_PACK_ID, LESSON_PACK_VERSION } from "../content/lessons.js";

// Card ids are derived from the Spanish text rather than the array position, so editing,
// reordering or inserting items in lessons.js leaves existing review progress intact.
function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // drop combining accents after NFD
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function buildCards(lesson) {
  const seen = new Map();
  return lesson.items.map((item) => {
    const base = `${lesson.id}:${slugify(item.es)}`;
    // Guard against two items in one lesson slugifying to the same string.
    const n = seen.get(base) || 0;
    seen.set(base, n + 1);
    return {
      id: n === 0 ? base : `${base}~${n + 1}`,
      lessonId: lesson.id,
      es: item.es,
      de: item.de,
      ex_es: item.ex_es || null,
      ex_de: item.ex_de || null,
      note: item.note || null
    };
  });
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
  if (!pack || !Array.isArray(pack.lessons)) {
    throw new Error("Ungültiges Lektionspaket: erwartet { id, lessons: [...] }");
  }
  if (!pack.id) throw new Error("Dem Lektionspaket fehlt eine id.");
  for (const lesson of pack.lessons) {
    if (!lesson.id || !Array.isArray(lesson.items)) {
      throw new Error("Jede Lektion braucht id und items.");
    }
    if (lesson.items.some((it) => !it || !it.es || !it.de)) {
      throw new Error("Jeder Eintrag braucht „es“ und „de“.");
    }
  }
  const packs = loadCustomPacks();
  const idx = packs.findIndex((p) => p.id === pack.id);
  if (idx >= 0) packs[idx] = pack;
  else packs.push(pack);
  saveCustomPacks(packs);
  return pack;
}

export function removeCustomPack(packId) {
  saveCustomPacks(loadCustomPacks().filter((p) => p.id !== packId));
}

// Builds the full lesson+card registry from the core pack plus any user-imported packs.
export function getAllLessons() {
  const packs = [{ id: LESSON_PACK_ID, version: LESSON_PACK_VERSION, lessons: CORE_LESSONS }, ...loadCustomPacks()];
  const lessons = [];
  for (const pack of packs) {
    for (const lesson of pack.lessons) {
      lessons.push({
        ...lesson,
        tips: lesson.tips || [],
        icon: lesson.icon || "⭐",
        subtitle: lesson.subtitle || "",
        packId: pack.id,
        cards: buildCards(lesson)
      });
    }
  }
  return lessons;
}

export function getAllCards() {
  return getAllLessons().flatMap((l) => l.cards);
}

export function getCardById(id) {
  return getAllCards().find((c) => c.id === id) || null;
}

export function getLessonById(id) {
  return getAllLessons().find((l) => l.id === id) || null;
}
