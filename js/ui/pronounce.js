import { getAllLessons } from "../core/content.js";
import { getState, getSettings } from "../core/storage.js";
import {
  speak,
  supportsRecognition,
  supportsRecording,
  listenOnce,
  recordClip
} from "../core/pronunciation.js";
import { similarity, wordDiff, scoreLabel } from "../core/text.js";

const mode = supportsRecognition() ? "auto" : supportsRecording() ? "shadow" : "none";

let activeLessonId = "all";
let lastCardId = null;

function pool(lessons, state) {
  const lesson = lessons.find((l) => l.id === activeLessonId);
  const cards = lesson ? lesson.cards : lessons.flatMap((l) => l.cards);
  const introduced = cards.filter((c) => state.introducedCards.includes(c.id));
  return introduced.length ? introduced : cards;
}

function pickCard(lessons, state) {
  const cards = pool(lessons, state);
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
          .map((l) => `<button class="pill ${activeLessonId === l.id ? "active" : ""}" data-id="${l.id}">${l.icon} ${l.title}</button>`)
          .join("")}
      </div>
      ${
        mode === "none"
          ? `<div class="tip-box">🎧 Auf diesem Gerät ist keine Spracherkennung/-aufnahme verfügbar. Du kannst trotzdem hören & nachsprechen.</div>`
          : mode === "shadow"
          ? `<div class="tip-box">📱 Auf diesem Gerät nutzen wir den Nachsprech-Modus: nimm dich auf und vergleiche selbst mit dem Original.</div>`
          : ""
      }
      <div id="round"></div>
    `;

    root.querySelectorAll("#pills .pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeLessonId = btn.dataset.id;
        renderShell();
      });
    });

    if (!card) {
      document.getElementById("round").innerHTML = `<p>Keine Karten in dieser Lektion.</p>`;
      return;
    }
    renderRound(card);
  }

  function renderRound(card) {
    const area = document.getElementById("round");
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
            : mode === "shadow"
            ? `<button class="btn block" id="rec">🎙️ Aufnehmen (4s)</button>`
            : `<button class="btn block" id="skip">Weiter</button>`
        }
      </div>
      <div id="feedback"></div>
    `;
    area.querySelector("#hear").addEventListener("click", () => speak(card.es, { rate: settings.ttsRate }));
    speak(card.es, { rate: settings.ttsRate });

    area.querySelector("#skip")?.addEventListener("click", renderShell);

    area.querySelector("#talk")?.addEventListener("click", async () => {
      const btn = area.querySelector("#talk");
      btn.disabled = true;
      btn.textContent = "🎙️ Höre zu...";
      try {
        const transcript = await listenOnce({ timeoutMs: 6000 });
        showAutoFeedback(card, transcript);
      } catch (err) {
        showError(err);
      } finally {
        btn.disabled = false;
        btn.textContent = "🎤 Sprechen";
      }
    });

    area.querySelector("#rec")?.addEventListener("click", async () => {
      const btn = area.querySelector("#rec");
      btn.disabled = true;
      btn.textContent = "🔴 Nimmt auf...";
      try {
        const { result } = await recordClip(4000);
        const url = await result;
        showShadowFeedback(card, url);
      } catch (err) {
        showError(err);
      } finally {
        btn.disabled = false;
        btn.textContent = "🎙️ Aufnehmen (4s)";
      }
    });
  }

  function showAutoFeedback(card, transcript) {
    const score = similarity(card.es, transcript);
    const { label, tone } = scoreLabel(score);
    const diff = wordDiff(card.es, transcript);
    document.getElementById("feedback").innerHTML = `
      <div class="card">
        <div class="score-badge score-${tone}">${label} · ${score}%</div>
        <p style="margin-bottom:6px;">Du hast gesagt: <em>„${transcript}“</em></p>
        <div>${diff.map((d) => `<span class="word-chip ${d.matched ? "match" : "miss"}">${d.word}</span>`).join("")}</div>
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
        <p>Vergleiche deine Aufnahme mit dem Original:</p>
        <p><strong>Original:</strong> <button class="speak-btn" id="hear2">🔊</button></p>
        <p><strong>Deine Aufnahme:</strong></p>
        <audio controls src="${url}" style="width:100%;"></audio>
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
    const msg =
      err.message === "not-allowed"
        ? "Mikrofon-Zugriff wurde blockiert. Bitte in den Browser-Einstellungen erlauben."
        : err.message === "no-speech"
        ? "Da war nichts zu hören. Versuch's nochmal etwas lauter."
        : err.message === "network"
        ? "Spracherkennung braucht eine Internetverbindung."
        : "Konnte die Aufnahme nicht verarbeiten. Versuch's nochmal.";
    document.getElementById("feedback").innerHTML = `<div class="tip-box">⚠️ ${msg}</div>`;
  }

  renderShell();
}
