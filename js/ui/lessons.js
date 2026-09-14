import { getAllLessons } from "../core/content.js";
import { getState } from "../core/storage.js";
import { isDue } from "../core/srs.js";

export function render(root) {
  const state = getState();
  const lessons = getAllLessons();

  const tiles = lessons
    .map((lesson) => {
      const learned = lesson.cards.filter((c) => state.introducedCards.includes(c.id));
      const total = lesson.cards.length;
      const pct = total ? Math.round((learned.length / total) * 100) : 0;
      const due = learned.filter((c) => isDue(state.srs[c.id])).length;
      return `
        <button class="lesson-tile" data-id="${lesson.id}">
          <span class="tile-head">
            <span class="icon">${lesson.icon}</span>
            ${due > 0 ? `<span class="badge">${due}</span>` : pct === 100 ? `<span class="check">✓</span>` : ""}
          </span>
          <span class="title">${lesson.title}</span>
          <span class="subtitle">${lesson.subtitle}</span>
          <div class="progress-bar"><div style="width:${pct}%"></div></div>
          <span class="subtitle">${learned.length}/${total}</span>
        </button>`;
    })
    .join("");

  const totalCards = lessons.reduce((n, l) => n + l.cards.length, 0);

  root.innerHTML = `
    <h1>Lektionen</h1>
    <p>Aufbauend geordnet: erst die Bausteine, dann die Verben, dann der Alltag. ${totalCards} Karten insgesamt — die Zahl im Kreis zeigt fällige Wiederholungen.</p>
    <div class="lesson-grid">${tiles}</div>
  `;

  root.querySelectorAll(".lesson-tile").forEach((btn) =>
    btn.addEventListener("click", () => (location.hash = `#/lesson/${btn.dataset.id}`))
  );
}
