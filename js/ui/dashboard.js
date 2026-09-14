import { getAllCards, getAllLessons } from "../core/content.js";
import { getState } from "../core/storage.js";
import { buildReviewQueue } from "../core/srs.js";

const GREETINGS = [
  "¡Hola! Bereit für ein bisschen Spanisch?",
  "¡Buenos días! Auf geht's.",
  "¡Vamos a practicar!",
  "¿Qué tal? Zeit zum Üben.",
  "¡Buenas! Weiter geht's."
];

export function render(root) {
  const state = getState();
  const cards = getAllCards();
  const lessons = getAllLessons();
  const dueCount = buildReviewQueue(cards, state.introducedCards, state.srs).length;
  const learned = state.introducedCards.length;
  const greeting = GREETINGS[new Date().getDate() % GREETINGS.length];

  // The lesson to suggest next: continue a partially learned one, else the first untouched one.
  const withNew = lessons
    .map((l) => ({ lesson: l, remaining: l.cards.filter((c) => !state.introducedCards.includes(c.id)).length }))
    .filter((x) => x.remaining > 0);
  const started = withNew.find((x) => x.remaining < x.lesson.cards.length);
  const suggestion = started || withNew[0] || null;

  root.innerHTML = `
    <h1>${greeting}</h1>
    <div class="stat-row">
      <div class="stat"><div class="num">${dueCount}</div><div class="label">Fällig</div></div>
      <div class="stat"><div class="num">${learned}</div><div class="label">Gelernt</div></div>
      <div class="stat"><div class="num">${state.stats.streakDays}</div><div class="label">Tage-Serie</div></div>
    </div>

    <div class="card">
      ${
        dueCount > 0
          ? `<h2>${dueCount} Karte${dueCount === 1 ? "" : "n"} warten</h2>
             <p>Kurz wiederholen, genau im richtigen Moment — das hält die Vokabeln im Kopf.</p>
             <button class="btn block" id="go-review">Wiederholung starten</button>`
          : learned > 0
          ? `<h2>Alles erledigt 🎉</h2>
             <p>Keine fälligen Karten. Zeit für neue Vokabeln oder etwas Aussprache.</p>
             <button class="btn secondary block" id="go-lessons">Neue Lektion</button>`
          : `<h2>Fang hier an</h2>
             <p>Jede Lektion zeigt dir eine kleine Portion neue Vokabeln. Danach erinnert dich die App automatisch im richtigen Abstand daran.</p>
             <button class="btn block" id="go-lessons">Erste Lektion starten</button>`
      }
    </div>

    ${
      suggestion
        ? `<div class="card">
             <span class="eyebrow">${started ? "Weitermachen" : "Als Nächstes"}</span>
             <h2>${suggestion.lesson.icon} ${suggestion.lesson.title}</h2>
             <p>${suggestion.lesson.subtitle} · ${suggestion.remaining} neue Karte${suggestion.remaining === 1 ? "" : "n"}</p>
             <button class="btn ghost block" id="go-next-lesson">Lektion öffnen</button>
           </div>`
        : `<div class="card">
             <h2>🏆 Alle Lektionen durch</h2>
             <p>Du hast den kompletten Grundstock gelernt. Halte ihn mit der täglichen Wiederholung frisch.</p>
           </div>`
    }

    <div class="card">
      <h2>🎤 Aussprache trainieren</h2>
      <p>Satz hören, nachsprechen, Feedback bekommen.</p>
      <button class="btn secondary block" id="go-pronounce">Zum Aussprache-Coach</button>
    </div>
  `;

  root.querySelector("#go-review")?.addEventListener("click", () => (location.hash = "#/review"));
  root.querySelector("#go-lessons")?.addEventListener("click", () => (location.hash = "#/lessons"));
  root.querySelector("#go-pronounce")?.addEventListener("click", () => (location.hash = "#/pronounce"));
  root.querySelector("#go-next-lesson")?.addEventListener("click", () => {
    location.hash = `#/lesson/${suggestion.lesson.id}`;
  });
}
