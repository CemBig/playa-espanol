import { getAllCards, getAllLessons } from "../core/content.js";
import { getState } from "../core/storage.js";
import { buildReviewQueue } from "../core/srs.js";

const GREETINGS = [
  "¡Hola! Bereit für ein bisschen Spanisch?",
  "¡Buenos días! Auf geht's.",
  "¡Vamos a practicar!",
  "¿Qué tal? Zeit zum Üben."
];

export function render(root) {
  const state = getState();
  const cards = getAllCards();
  const lessons = getAllLessons();
  const dueCount = buildReviewQueue(cards, state.introducedCards, state.srs).length;
  const learnedCount = state.introducedCards.length;
  const greeting = GREETINGS[new Date().getDate() % GREETINGS.length];

  const nextLesson = lessons.find((l) => !state.introducedLessons.includes(l.id));

  root.innerHTML = `
    <h1>${greeting}</h1>
    <div class="stat-row">
      <div class="stat"><div class="num">${dueCount}</div><div class="label">Fällig heute</div></div>
      <div class="stat"><div class="num">${learnedCount}</div><div class="label">Gelernte Karten</div></div>
      <div class="stat"><div class="num">${state.stats.streakDays}</div><div class="label">Tage-Serie</div></div>
    </div>

    <div class="card">
      ${
        dueCount > 0
          ? `<h2>${dueCount} Karte${dueCount === 1 ? "" : "n"} warten auf dich</h2>
             <p>Kurze, gezielte Wiederholung nach dem Anki-Prinzip &ndash; das bringt am meisten.</p>
             <button class="btn block" id="go-review">Wiederholung starten</button>`
          : `<h2>Alles erledigt für jetzt 🎉</h2>
             <p>Keine fälligen Karten. Lerne etwas Neues oder übe die Aussprache.</p>
             <button class="btn secondary block" id="go-lessons">Neue Lektion lernen</button>`
      }
    </div>

    ${
      nextLesson
        ? `<div class="card">
            <h2>${nextLesson.icon} ${nextLesson.title}</h2>
            <p>${nextLesson.subtitle}</p>
            <button class="btn ghost block" id="go-next-lesson">Lektion starten</button>
          </div>`
        : ""
    }

    <div class="card">
      <h2>🎤 Aussprache trainieren</h2>
      <p>Sprich Sätze nach und bekomme direktes Feedback &ndash; wie im Sprachtandem.</p>
      <button class="btn secondary block" id="go-pronounce">Zum Aussprache-Coach</button>
    </div>
  `;

  root.querySelector("#go-review")?.addEventListener("click", () => (location.hash = "#/review"));
  root.querySelector("#go-lessons")?.addEventListener("click", () => (location.hash = "#/lessons"));
  root.querySelector("#go-pronounce")?.addEventListener("click", () => (location.hash = "#/pronounce"));
  root.querySelector("#go-next-lesson")?.addEventListener("click", () => (location.hash = `#/lesson/${nextLesson.id}`));
}
