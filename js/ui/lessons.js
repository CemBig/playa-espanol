import { getAllLessons } from "../core/content.js";
import { getState } from "../core/storage.js";

export function render(root) {
  const state = getState();
  const lessons = getAllLessons();

  const tiles = lessons
    .map((lesson) => {
      const introduced = lesson.cards.filter((c) => state.introducedCards.includes(c.id)).length;
      const total = lesson.cards.length;
      const pct = total ? Math.round((introduced / total) * 100) : 0;
      return `
        <button class="lesson-tile" data-id="${lesson.id}">
          <span class="icon">${lesson.icon}</span>
          <span class="title">${lesson.title}</span>
          <span class="subtitle">${lesson.subtitle}</span>
          <div class="progress-bar"><div style="width:${pct}%"></div></div>
          <span class="subtitle">${introduced}/${total} gelernt</span>
        </button>`;
    })
    .join("");

  root.innerHTML = `
    <h1>Lektionen</h1>
    <p>Grundgerüst für Spanien: das Wichtigste zuerst, nach dem 80/20-Prinzip.</p>
    <div class="lesson-grid">${tiles}</div>
  `;

  root.querySelectorAll(".lesson-tile").forEach((btn) => {
    btn.addEventListener("click", () => (location.hash = `#/lesson/${btn.dataset.id}`));
  });
}
