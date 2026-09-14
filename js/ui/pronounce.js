import { getAllLessons } from "../core/content.js";
import { getState, getSettings } from "../core/storage.js";
import {
  speak,
  supportsRecognition,
  supportsRecording,
  listenOnce,
  recordClip,
  FATAL_RECOGNITION_ERRORS
} from "../core/pronunciation.js";
import { similarity, wordDiff, scoreLabel } from "../core/text.js";

// "auto" = speech recognition scores the attempt, "shadow" = record and compare by ear.
// Starts on whatever the browser supports and can be switched by hand, because iOS Safari
// sometimes exposes SpeechRecognition without it actually working.
let mode = supportsRecognition() ? "auto" : "shadow";
let activeLessonId = "all";
let lastCardId = null;

function candidates(lessons, state) {
  const lesson = lessons.find((l) => l.id === activeLessonId);
  const cards = lesson ? lesson.cards : lessons.flatMap((l) => l.cards);
  const introduced = cards.filter((c) => state.introducedCards.includes(c.id));
  return introduced.length ? introduced : cards;
}

function pickCard(lessons, state) {
  const cards = candidates(lessons, state);
  if (cards.length === 0) return null;
  if (cards.length === 1) return cards[0];
  let card;
  do {
    card = cards[Math.floor(Math.random() * cards.length)];
  } while (card.id === lastCardId);
  lastCardId = card.id;
  return card;
}

export function render(root) {
  const lessons = getAllLessons();
  const settings = getSettings();

  function renderShell() {
    const state = getState();
    const card = pickCard(lessons, state);

    root.innerHTML = `
      <h1>🎤 Aussprache-Coach</h1>
      <div class="pill-row" id="pills">
        <button class="pill ${activeLessonId === "all" ? "active" : ""}" data-id="all">Alle</button>
        ${lessons
          .map(
            (l) =>
              `<button class="pill ${activeLessonId === l.id ? "active" : ""}" data-id="${l.id}">${l.icon} ${l.title}</button>`
          )
          .join("")}
      </div>

      <div class="mode-switch">
        <button class="pill ${mode === "auto" ? "active" : ""}" data-mode="auto" ${supportsRecognition() ? "" : "disabled"}>
          Auto-Bewertung
        </button>
        <button class="pill ${mode === "shadow" ? "active" : ""}" data-mode="shadow" ${supportsRecording() ? "" : "disabled"}>
          Nachsprechen
        </button>
      </div>
      ${
        mode === "shadow"
          ? `<div class="tip-box">🎧 Nachsprech-Modus: Original hören, selbst aufnehmen, vergleichen. Das ist die Technik, mit der Schauspieler Akzente lernen.</div>`
          : ""
      }
      ${
        !supportsRecognition() && !supportsRecording()
          ? `<div class="tip-box">⚠️ Dieses Gerät erlaubt weder Spracherkennung noch Aufnahme. Du kannst trotzdem hören und nachsprechen.</div>`
          : ""
      }
      <div id="round"></div>
    `;

    root.querySelectorAll("#pills .pill").forEach((btn) =>
      btn.addEventListener("click", () => {
        activeLessonId = btn.dataset.id;
        renderShell();
      })
    );
    root.querySelectorAll("[data-mode]").forEach((btn) =>
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        mode = btn.dataset.mode;
        renderShell();
      })
    );

    if (!card) {
      document.getElementById("round").innerHTML = `<p>Keine Karten in dieser Lektion.</p>`;
      return;
    }
    renderRound(card);
  }

  function renderRound(card) {
    const area = document.getElementById("round");
    const canRecord = supportsRecording();
    area.innerHTML = `
      <div class="flashcard">
        <div class="es">${card.es}</div>
        <div class="de">${card.de}</div>
      </div>
      <div class="center-col" style="margin-top:16px;">
        <button class="btn secondary" id="hear">🔊 Anhören</button>
        ${
          mode === "auto"
            ? `<button class="btn block" id="talk">🎤 Sprechen</button>`
            : canRecord
            ? `<button class="btn block" id="rec">🎙️ Aufnehmen (4s)</button>`
            : ""
        }
        <button class="btn ghost block" id="skip">Nächster Satz</button>
      </div>
      <div id="feedback"></div>
    `;
    area.querySelector("#hear").addEventListener("click", () => speak(card.es, { rate: settings.ttsRate }));
    area.querySelector("#skip").addEventListener("click", renderShell);

    area.querySelector("#talk")?.addEventListener("click", async () => {
      const btn = area.querySelector("#talk");
      btn.disabled = true;
      btn.textContent = "🎙️ Höre zu…";
      try {
        const transcript = await listenOnce();
        showAutoFeedback(card, transcript);
      } catch (err) {
        // If recognition can never work here, silently switch to the shadowing mode.
        if (FATAL_RECOGNITION_ERRORS.has(err.message) && supportsRecording()) {
          mode = "shadow";
          renderShell();
          document.getElementById("feedback").innerHTML =
            `<div class="tip-box">ℹ️ Die Spracherkennung funktioniert auf diesem Gerät nicht — ich habe auf den Nachsprech-Modus umgestellt.</div>`;
          return;
        }
        showError(err);
      } finally {
        if (btn.isConnected) {
          btn.disabled = false;
          btn.textContent = "🎤 Sprechen";
        }
      }
    });

    area.querySelector("#rec")?.addEventListener("click", async () => {
      const btn = area.querySelector("#rec");
      btn.disabled = true;
      btn.textContent = "🔴 Nimmt auf…";
      try {
        const { result } = await recordClip(4000);
        showShadowFeedback(card, await result);
      } catch (err) {
        showError(err);
      } finally {
        if (btn.isConnected) {
          btn.disabled = false;
          btn.textContent = "🎙️ Aufnehmen (4s)";
        }
      }
    });

    speak(card.es, { rate: settings.ttsRate });
  }

  function showAutoFeedback(card, transcript) {
    const score = similarity(card.es, transcript);
    const { label, tone } = scoreLabel(score);
    const diff = wordDiff(card.es, transcript);
    document.getElementById("feedback").innerHTML = `
      <div class="card">
        <div class="score-badge score-${tone}">${label} · ${score}%</div>
        <p>Erkannt: <em>„${transcript}“</em></p>
        <div>${diff.map((d) => `<span class="word-chip ${d.matched ? "match" : "miss"}">${d.word}</span>`).join("")}</div>
        <p class="hint">Grün = klar erkannt. Rot heißt nicht zwangsläufig falsch — die Erkennung ist nur ein Hinweis.</p>
        <div class="center-col" style="margin-top:14px;">
          <button class="btn secondary" id="retry">Nochmal versuchen</button>
          <button class="btn block" id="next">Nächster Satz</button>
        </div>
      </div>`;
    document.getElementById("retry").addEventListener("click", () => renderRound(card));
    document.getElementById("next").addEventListener("click", renderShell);
  }

  function showShadowFeedback(card, url) {
    document.getElementById("feedback").innerHTML = `
      <div class="card">
        <p><strong>Original</strong> <button class="speak-btn" id="hear2" aria-label="Original anhören">🔊</button></p>
        <p><strong>Deine Aufnahme</strong></p>
        <audio controls src="${url}" style="width:100%;"></audio>
        <p class="hint">Hör auf die Vokale (im Spanischen immer kurz und klar), das rollende r und dass jede Silbe gleich lang klingt.</p>
        <div class="center-col" style="margin-top:14px;">
          <button class="btn secondary" id="retry">Nochmal aufnehmen</button>
          <button class="btn block" id="next">Nächster Satz</button>
        </div>
      </div>`;
    document.getElementById("hear2").addEventListener("click", () => speak(card.es, { rate: settings.ttsRate }));
    document.getElementById("retry").addEventListener("click", () => renderRound(card));
    document.getElementById("next").addEventListener("click", renderShell);
  }

  function showError(err) {
    const messages = {
      "not-allowed": "Mikrofon-Zugriff wurde blockiert. In Safari: aA-Symbol in der Adressleiste → Website-Einstellungen → Mikrofon erlauben.",
      "no-speech": "Da war nichts zu hören. Versuch's nochmal, etwas lauter.",
      timeout: "Zeit abgelaufen — tippe erneut und sprich direkt los.",
      network: "Die Spracherkennung braucht eine Internetverbindung.",
      aborted: "Aufnahme abgebrochen."
    };
    document.getElementById("feedback").innerHTML = `<div class="tip-box">⚠️ ${
      messages[err.message] || "Das hat nicht funktioniert. Versuch's nochmal."
    }</div>`;
  }

  renderShell();
}
