import { getAllCards } from "../core/content.js";
import { getState, setCardState, recordReview, getSettings } from "../core/storage.js";
import { buildReviewQueue, schedule, GRADE } from "../core/srs.js";
import { speak } from "../core/pronunciation.js";
import { toast } from "./toast.js";

function pickDirection(pref) {
  if (pref === "es-de" || pref === "de-es") return pref;
  return Math.random() < 0.5 ? "es-de" : "de-es";
}

export function render(root) {
  const state = getState();
  const cards = getAllCards();
  let queue = buildReviewQueue(cards, state.introducedCards, state.srs);
  const total = queue.length;
  let done = 0;
  let revealed = false;

  if (total === 0) {
    root.innerHTML = `
      <div class="empty-state">
        <div class="emoji">🏖️</div>
        <h2>Keine fälligen Karten</h2>
        <p>Du bist auf dem Laufenden. Lerne eine neue Lektion, damit es weitergeht.</p>
        <button class="btn block" id="go-lessons">Neue Lektion lernen</button>
      </div>`;
    root.querySelector("#go-lessons").addEventListener("click", () => (location.hash = "#/lessons"));
    return;
  }

  const settings = getSettings();

  function next() {
    if (queue.length === 0) {
      root.innerHTML = `
        <div class="empty-state">
          <div class="emoji">🎉</div>
          <h2>Wiederholung geschafft!</h2>
          <p>${done} Karte${done === 1 ? "" : "n"} wiederholt.</p>
          <button class="btn block" id="go-home">Zur Startseite</button>
        </div>`;
      root.querySelector("#go-home").addEventListener("click", () => (location.hash = "#/"));
      return;
    }
    revealed = false;
    draw();
  }

  function draw() {
    const item = queue[0];
    const dir = pickDirection(settings.direction);
    const front = dir === "es-de" ? item.card.es : item.card.de;
    const back = dir === "es-de" ? item.card.de : item.card.es;

    root.innerHTML = `
      <div class="top-actions">
        <a href="#/" class="link-back">‹ Beenden</a>
        <span style="color:var(--fg-soft);font-size:0.85rem;">Karte ${done + 1} von ${done + queue.length}</span>
      </div>
      <div class="flashcard">
        ${dir === "es-de" ? `<button class="speak-btn" id="speak">🔊</button>` : ""}
        <div class="es">${front}</div>
        <div id="answer" style="display:none;">
          <div class="de" style="margin-top:10px;">${back}</div>
          ${item.card.ex_es ? `<div class="ex">${item.card.ex_es}<br>${item.card.ex_de}</div>` : ""}
          ${item.card.note ? `<div class="note">${item.card.note}</div>` : ""}
        </div>
      </div>
      <div id="reveal-area" class="center-col" style="margin-top:18px;">
        <button class="btn block" id="reveal">Antwort zeigen</button>
      </div>
    `;

    root.querySelector("#speak")?.addEventListener("click", () => speak(item.card.es, { rate: settings.ttsRate }));
    if (dir === "es-de") speak(item.card.es, { rate: settings.ttsRate });

    root.querySelector("#reveal").addEventListener("click", () => {
      revealed = true;
      root.querySelector("#answer").style.display = "block";
      if (dir === "de-es") speak(item.card.es, { rate: settings.ttsRate });
      root.querySelector("#reveal-area").innerHTML = `
        <div class="grade-row">
          <button class="btn grade-again" data-g="${GRADE.AGAIN}">Nochmal</button>
          <button class="btn grade-hard" data-g="${GRADE.HARD}">Schwer</button>
          <button class="btn grade-good" data-g="${GRADE.GOOD}">Gut</button>
          <button class="btn grade-easy" data-g="${GRADE.EASY}">Leicht</button>
        </div>`;
      root.querySelectorAll("[data-g]").forEach((btn) => {
        btn.addEventListener("click", () => grade(Number(btn.dataset.g)));
      });
    });
  }

  function grade(g) {
    const item = queue.shift();
    const newState = schedule(item.state, g);
    setCardState(item.card.id, newState);
    recordReview();
    done += 1;
    if (g === GRADE.AGAIN) queue.push(item); // drill again within this session
    next();
  }

  draw();
}
