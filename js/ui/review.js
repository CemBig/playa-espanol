import { getAllCards } from "../core/content.js";
import { getState, setCardState, recordReview, getSettings } from "../core/storage.js";
import { buildReviewQueue, schedule, GRADE } from "../core/srs.js";
import { speak } from "../core/pronunciation.js";

function pickDirection(pref) {
  if (pref === "es-de" || pref === "de-es") return pref;
  return Math.random() < 0.5 ? "es-de" : "de-es";
}

// Human-readable "next due in ..." so the grading buttons aren't a black box.
function formatInterval(days) {
  if (days < 1) return "in ca. 1 Std.";
  if (days < 2) return "morgen";
  if (days < 30) return `in ${Math.round(days)} Tagen`;
  if (days < 365) return `in ${Math.round(days / 30)} Mon.`;
  return `in ${(days / 365).toFixed(1)} Jahren`;
}

export function render(root) {
  const state = getState();
  const cards = getAllCards();
  const settings = getSettings();
  const queue = buildReviewQueue(cards, state.introducedCards, state.srs);
  let done = 0;

  if (queue.length === 0) {
    const hasCards = state.introducedCards.length > 0;
    root.innerHTML = `
      <div class="empty-state">
        <div class="emoji">🏖️</div>
        <h2>${hasCards ? "Keine fälligen Karten" : "Noch nichts zu wiederholen"}</h2>
        <p>${
          hasCards
            ? "Du bist auf dem Laufenden. Lerne eine neue Lektion, dann geht es weiter."
            : "Starte mit einer Lektion — die gelernten Vokabeln landen automatisch hier."
        }</p>
        <button class="btn block" id="go-lessons">Zu den Lektionen</button>
        <button class="btn ghost block" id="go-pron" style="margin-top:8px;">Aussprache üben</button>
      </div>`;
    root.querySelector("#go-lessons").addEventListener("click", () => (location.hash = "#/lessons"));
    root.querySelector("#go-pron").addEventListener("click", () => (location.hash = "#/pronounce"));
    return;
  }

  function finish() {
    root.innerHTML = `
      <div class="empty-state">
        <div class="emoji">🎉</div>
        <h2>¡Muy bien!</h2>
        <p>${done} Karte${done === 1 ? "" : "n"} wiederholt. Morgen kommen die nächsten dran.</p>
        <button class="btn block" id="go-home">Zur Startseite</button>
      </div>`;
    root.querySelector("#go-home").addEventListener("click", () => (location.hash = "#/"));
  }

  function grade(item, g) {
    const newState = schedule(item.state, g);
    setCardState(item.card.id, newState);
    recordReview();
    done += 1;
    // "Nochmal" puts the card back into this session so it gets drilled again right away.
    if (g === GRADE.AGAIN) queue.push({ card: item.card, state: newState });
    draw();
  }

  function draw() {
    const item = queue.shift();
    if (!item) {
      finish();
      return;
    }

    const dir = pickDirection(settings.direction);
    const front = dir === "es-de" ? item.card.es : item.card.de;
    const back = dir === "es-de" ? item.card.de : item.card.es;
    const remaining = queue.length + 1;

    root.innerHTML = `
      <div class="top-actions">
        <a href="#/" class="link-back">‹ Beenden</a>
        <span class="counter">${remaining} übrig · ${done} erledigt</span>
      </div>
      <div class="flashcard">
        <button class="speak-btn" data-speak aria-label="Anhören">🔊</button>
        <span class="dir-hint">${dir === "es-de" ? "Spanisch → Deutsch" : "Deutsch → Spanisch"}</span>
        <div class="es">${front}</div>
        <div id="answer" hidden>
          <div class="de">${back}</div>
          ${item.card.note ? `<div class="note">${item.card.note}</div>` : ""}
          ${item.card.ex_es ? `<div class="ex">${item.card.ex_es}<br>${item.card.ex_de}</div>` : ""}
        </div>
      </div>
      <div id="reveal-area" class="center-col" style="margin-top:18px;">
        <button class="btn block" id="reveal">Antwort zeigen</button>
      </div>
    `;

    root.querySelector("[data-speak]").addEventListener("click", () => speak(item.card.es, { rate: settings.ttsRate }));
    // Only pronounce up front when Spanish is the prompt — otherwise it gives the answer away.
    if (dir === "es-de") speak(item.card.es, { rate: settings.ttsRate });

    root.querySelector("#reveal").addEventListener("click", () => {
      root.querySelector("#answer").hidden = false;
      if (dir === "de-es") speak(item.card.es, { rate: settings.ttsRate });

      const preview = (g) => formatInterval(schedule(item.state, g).interval);
      root.querySelector("#reveal-area").innerHTML = `
        <div class="grade-row">
          <button class="btn grade-again" data-g="${GRADE.AGAIN}">Nochmal<small>${preview(GRADE.AGAIN)}</small></button>
          <button class="btn grade-hard" data-g="${GRADE.HARD}">Schwer<small>${preview(GRADE.HARD)}</small></button>
          <button class="btn grade-good" data-g="${GRADE.GOOD}">Gut<small>${preview(GRADE.GOOD)}</small></button>
          <button class="btn grade-easy" data-g="${GRADE.EASY}">Leicht<small>${preview(GRADE.EASY)}</small></button>
        </div>`;
      root.querySelectorAll("[data-g]").forEach((btn) =>
        btn.addEventListener("click", () => grade(item, Number(btn.dataset.g)))
      );
    });
  }

  draw();
}
