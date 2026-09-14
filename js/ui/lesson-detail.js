import { getLessonById } from "../core/content.js";
import { getState, introduceCards, markLessonIntroduced, setCardState, getSettings } from "../core/storage.js";
import { freshCardState } from "../core/srs.js";
import { speak } from "../core/pronunciation.js";
import { toast } from "./toast.js";

function attachSpeakHandlers(root) {
  root.querySelectorAll("[data-speak]").forEach((btn) => {
    btn.addEventListener("click", () => speak(decodeURIComponent(btn.dataset.speak)));
  });
}

function tipsHTML(lesson) {
  return lesson.tips.map((t) => `<div class="tip-box">💡 ${t}</div>`).join("");
}

function renderBrowse(root, lesson) {
  root.innerHTML = `
    <div class="top-actions"><a href="#/lessons" class="link-back">‹ Lektionen</a></div>
    <h1>${lesson.icon} ${lesson.title}</h1>
    <p>Alles gelernt — hier als Nachschlagewerk. Tippe 🔊 zum Anhören.</p>
    ${tipsHTML(lesson)}
    ${lesson.cards
      .map(
        (c) => `
      <div class="card row-card">
        <div>
          <div class="row-es">${c.es}</div>
          <div class="row-de">${c.de}</div>
          ${c.note ? `<div class="row-note">${c.note}</div>` : ""}
          ${c.ex_es ? `<div class="row-ex">${c.ex_es} — ${c.ex_de}</div>` : ""}
        </div>
        <button class="speak-btn" data-speak="${encodeURIComponent(c.es)}" aria-label="Anhören">🔊</button>
      </div>`
      )
      .join("")}
  `;
  attachSpeakHandlers(root);
}

// Walks through a batch of new cards. Each card is committed to the review pool as soon as
// it is shown, so quitting halfway keeps whatever was already studied.
function renderLearnFlow(root, lesson, batch, remainingAfter) {
  const settings = getSettings();
  let i = 0;
  markLessonIntroduced(lesson.id);

  function commit(card) {
    introduceCards([card.id]);
    setCardState(card.id, freshCardState());
  }

  function finish() {
    toast(`${batch.length} neue Karte${batch.length === 1 ? "" : "n"} gelernt`);
    root.innerHTML = `
      <div class="empty-state">
        <div class="emoji">🌟</div>
        <h2>Runde geschafft</h2>
        <p>${batch.length} neue Karte${batch.length === 1 ? "" : "n"} sind jetzt in deiner Wiederholung.
        ${remainingAfter > 0 ? `In dieser Lektion warten noch ${remainingAfter}.` : "Diese Lektion ist komplett."}</p>
        ${remainingAfter > 0 ? `<button class="btn block" id="more">Weiter lernen</button>` : ""}
        <button class="btn ${remainingAfter > 0 ? "secondary" : ""} block" id="review" style="margin-top:8px;">Jetzt wiederholen</button>
        <button class="btn ghost block" id="back" style="margin-top:8px;">Zu den Lektionen</button>
      </div>`;
    root.querySelector("#more")?.addEventListener("click", () => render(root, { id: lesson.id }));
    root.querySelector("#review").addEventListener("click", () => (location.hash = "#/review"));
    root.querySelector("#back").addEventListener("click", () => (location.hash = "#/lessons"));
  }

  function step() {
    if (i >= batch.length) {
      finish();
      return;
    }
    const card = batch[i];
    commit(card);

    root.innerHTML = `
      <div class="top-actions">
        <a href="#/lessons" class="link-back">‹ Beenden</a>
        <span class="counter">${i + 1}/${batch.length}</span>
      </div>
      <div class="progress-bar thin"><div style="width:${((i + 1) / batch.length) * 100}%"></div></div>
      <div class="flashcard">
        <button class="speak-btn" data-speak="${encodeURIComponent(card.es)}" aria-label="Anhören">🔊</button>
        <div class="es">${card.es}</div>
        <div class="de">${card.de}</div>
        ${card.note ? `<div class="note">${card.note}</div>` : ""}
        ${card.ex_es ? `<div class="ex">${card.ex_es}<br>${card.ex_de}</div>` : ""}
      </div>
      <div class="center-col" style="margin-top:18px;">
        <button class="btn block" id="next">${i + 1 >= batch.length ? "Fertig" : "Weiter"}</button>
      </div>
    `;
    attachSpeakHandlers(root);
    speak(card.es, { rate: settings.ttsRate });
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
    root.innerHTML = `<div class="empty-state"><div class="emoji">🤔</div><h2>Lektion nicht gefunden</h2>
      <button class="btn block" onclick="location.hash='#/lessons'">Zu den Lektionen</button></div>`;
    return;
  }

  const state = getState();
  const newCards = lesson.cards.filter((c) => !state.introducedCards.includes(c.id));

  if (newCards.length === 0) {
    renderBrowse(root, lesson);
    return;
  }

  const batchSize = Math.max(1, getSettings().newPerSession || 10);
  const batch = newCards.slice(0, batchSize);
  const remainingAfter = newCards.length - batch.length;
  const learnedSoFar = lesson.cards.length - newCards.length;

  root.innerHTML = `
    <div class="top-actions"><a href="#/lessons" class="link-back">‹ Lektionen</a></div>
    <h1>${lesson.icon} ${lesson.title}</h1>
    <p>${lesson.subtitle}</p>
    ${tipsHTML(lesson)}
    <div class="card">
      <h2>${batch.length} neue Karte${batch.length === 1 ? "" : "n"}</h2>
      <p>${
        learnedSoFar > 0
          ? `${learnedSoFar} von ${lesson.cards.length} hast du schon. `
          : ""
      }Wir gehen sie einmal durch, danach übernimmt die Wiederholung.${
        remainingAfter > 0 ? ` Danach bleiben noch ${remainingAfter} für später.` : ""
      }</p>
      <button class="btn block" id="start-learn">Lernen starten</button>
      ${learnedSoFar > 0 ? `<button class="btn ghost block" id="show-browse" style="margin-top:8px;">Alle Vokabeln ansehen</button>` : ""}
    </div>
  `;
  root.querySelector("#start-learn").addEventListener("click", () => renderLearnFlow(root, lesson, batch, remainingAfter));
  root.querySelector("#show-browse")?.addEventListener("click", () => renderBrowse(root, lesson));
}
