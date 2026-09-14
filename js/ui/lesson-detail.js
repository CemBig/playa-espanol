import { getLessonById } from "../core/content.js";
import { getState, introduceCards, markLessonIntroduced, setCardState } from "../core/storage.js";
import { freshCardState } from "../core/srs.js";
import { speak } from "../core/pronunciation.js";
import { toast } from "./toast.js";

function cardHTML(card, { showBoth = true } = {}) {
  return `
    <div class="flashcard">
      <button class="speak-btn" data-speak="${encodeURIComponent(card.es)}" title="Anhören">🔊</button>
      <div class="es">${card.es}</div>
      ${showBoth ? `<div class="de">${card.de}</div>` : ""}
      ${card.note ? `<div class="note">${card.note}</div>` : ""}
      ${card.ex_es ? `<div class="ex">${card.ex_es}<br>${card.ex_de}</div>` : ""}
    </div>`;
}

function attachSpeakHandlers(root) {
  root.querySelectorAll("[data-speak]").forEach((btn) => {
    btn.addEventListener("click", () => speak(decodeURIComponent(btn.dataset.speak)));
  });
}

function renderBrowse(root, lesson) {
  root.innerHTML = `
    <div class="top-actions">
      <a href="#/lessons" class="link-back">‹ Lektionen</a>
    </div>
    <h1>${lesson.icon} ${lesson.title}</h1>
    <p>Schon gelernt &ndash; hier als schnelles Nachschlagewerk. Tippe 🔊 zum Anhören.</p>
    ${lesson.tips.map((t) => `<div class="tip-box">💡 ${t}</div>`).join("")}
    ${lesson.cards
      .map(
        (c) => `
      <div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <div>
          <div style="font-weight:700;">${c.es}${c.note ? ` <span class="pill">${c.note}</span>` : ""}</div>
          <div style="color:var(--fg-soft);font-size:0.9rem;">${c.de}</div>
          ${c.ex_es ? `<div style="font-size:0.82rem;font-style:italic;color:var(--fg-soft);margin-top:4px;">${c.ex_es} — ${c.ex_de}</div>` : ""}
        </div>
        <button class="speak-btn" data-speak="${encodeURIComponent(c.es)}">🔊</button>
      </div>`
      )
      .join("")}
  `;
  attachSpeakHandlers(root);
}

function renderLearnFlow(root, lesson, newCards) {
  let i = 0;

  function step() {
    if (i >= newCards.length) {
      const ids = newCards.map((c) => c.id);
      introduceCards(ids);
      ids.forEach((id) => setCardState(id, freshCardState()));
      markLessonIntroduced(lesson.id);
      toast(`${newCards.length} neue Karten hinzugefügt`);
      location.hash = `#/lesson/${lesson.id}`;
      return;
    }
    const card = newCards[i];
    root.innerHTML = `
      <div class="top-actions">
        <a href="#/lessons" class="link-back">‹ Lektionen</a>
        <span style="color:var(--fg-soft);font-size:0.85rem;">${i + 1}/${newCards.length}</span>
      </div>
      <h1>${lesson.icon} ${lesson.title}</h1>
      ${i === 0 && lesson.tips.length ? lesson.tips.map((t) => `<div class="tip-box">💡 ${t}</div>`).join("") : ""}
      ${cardHTML(card)}
      <div class="center-col" style="margin-top:18px;">
        <button class="btn block" id="next">${i + 1 >= newCards.length ? "Fertig" : "Weiter"}</button>
      </div>
    `;
    attachSpeakHandlers(root);
    speak(card.es);
    root.querySelector("#next").addEventListener("click", () => {
      i += 1;
      step();
    });
  }

  step();
}

export function render(root, params) {
  const lesson = getLessonById(params.id);
  if (!lesson) {
    root.innerHTML = `<p>Lektion nicht gefunden.</p>`;
    return;
  }
  const state = getState();
  const newCards = lesson.cards.filter((c) => !state.introducedCards.includes(c.id));

  if (newCards.length === 0) {
    renderBrowse(root, lesson);
    return;
  }

  root.innerHTML = `
    <div class="top-actions"><a href="#/lessons" class="link-back">‹ Lektionen</a></div>
    <h1>${lesson.icon} ${lesson.title}</h1>
    <p>${lesson.subtitle}</p>
    ${lesson.tips.map((t) => `<div class="tip-box">💡 ${t}</div>`).join("")}
    <div class="card">
      <h2>${newCards.length} neue Karte${newCards.length === 1 ? "" : "n"}</h2>
      <p>Wir gehen sie kurz durch, danach landen sie automatisch in deiner täglichen Wiederholung.</p>
      <button class="btn block" id="start-learn">Lektion lernen</button>
      ${
        newCards.length < lesson.cards.length
          ? `<button class="btn ghost block" id="show-browse" style="margin-top:8px;">Bereits gelernte ansehen</button>`
          : ""
      }
    </div>
  `;
  root.querySelector("#start-learn").addEventListener("click", () => renderLearnFlow(root, lesson, newCards));
  root.querySelector("#show-browse")?.addEventListener("click", () => renderBrowse(root, lesson));
}
