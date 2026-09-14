import {
  getSettings,
  updateSettings,
  downloadExport,
  importStateJSON,
  resetAllProgress,
  getState
} from "../core/storage.js";
import { addCustomPack, getCustomPacks, removeCustomPack, getAllCards } from "../core/content.js";
import { getSpanishVoices, speak, supportsRecognition, supportsRecording } from "../core/pronunciation.js";
import { toast } from "./toast.js";

const SCHEMA_EXAMPLE = `{
  "id": "mein-paket",
  "lessons": [
    {
      "id": "custom-1",
      "title": "Meine Lektion",
      "subtitle": "Eigene Wörter",
      "icon": "⭐",
      "tips": ["Optionaler Hinweis"],
      "items": [
        { "es": "el gato", "de": "die Katze" },
        { "es": "el perro", "de": "der Hund",
          "note": "optional", "ex_es": "Mi perro es grande.",
          "ex_de": "Mein Hund ist groß." }
      ]
    }
  ]
}`;

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

export async function render(root) {
  const settings = getSettings();
  const state = getState();
  const customPacks = getCustomPacks();
  const voices = await getSpanishVoices();
  const totalCards = getAllCards().length;

  root.innerHTML = `
    <h1>Einstellungen</h1>

    <div class="card">
      <h2>Darstellung</h2>
      <div class="pill-row">
        <button class="pill ${settings.theme === "auto" ? "active" : ""}" data-theme="auto">Auto</button>
        <button class="pill ${settings.theme === "light" ? "active" : ""}" data-theme="light">Hell</button>
        <button class="pill ${settings.theme === "dark" ? "active" : ""}" data-theme="dark">Dunkel</button>
      </div>
    </div>

    <div class="card">
      <h2>Wiederholungs-Richtung</h2>
      <p>Gemischt trainiert am besten: Erkennen und aktives Produzieren.</p>
      <div class="pill-row">
        <button class="pill ${settings.direction === "mixed" ? "active" : ""}" data-dir="mixed">Gemischt</button>
        <button class="pill ${settings.direction === "es-de" ? "active" : ""}" data-dir="es-de">ES → DE</button>
        <button class="pill ${settings.direction === "de-es" ? "active" : ""}" data-dir="de-es">DE → ES</button>
      </div>
    </div>

    <div class="card">
      <h2>Neue Karten pro Runde</h2>
      <p>Wie viele neue Vokabeln eine Lern-Runde maximal enthält. Weniger heißt: öfter, aber entspannter.</p>
      <div class="pill-row">
        ${[5, 10, 15, 25]
          .map((n) => `<button class="pill ${settings.newPerSession === n ? "active" : ""}" data-new="${n}">${n}</button>`)
          .join("")}
      </div>
    </div>

    <div class="card">
      <h2>Sprachausgabe</h2>
      <label class="field-label" for="rate">Geschwindigkeit: <span id="rate-val">${settings.ttsRate.toFixed(2)}×</span></label>
      <input type="range" id="rate" min="0.5" max="1.2" step="0.05" value="${settings.ttsRate}">
      ${
        voices.length
          ? `<label class="field-label" for="voice">Stimme (${voices.length} spanische gefunden)</label>
             <select id="voice">
               <option value="">Systemstandard</option>
               ${voices
                 .map(
                   (v) =>
                     `<option value="${v.voiceURI}" ${settings.voiceURI === v.voiceURI ? "selected" : ""}>${v.name} (${v.lang})</option>`
                 )
                 .join("")}
             </select>`
          : `<p class="hint">Noch keine spanische Stimme gefunden. Auf dem iPhone: Einstellungen → Bedienungshilfen → Gesprochene Inhalte → Stimmen → Spanisch laden.</p>`
      }
      <button class="btn secondary block" id="test-voice" style="margin-top:10px;">Testen: „¿Dónde está la playa?“</button>
    </div>

    <div class="card">
      <h2>Fortschritt sichern</h2>
      <p>${state.introducedCards.length} von ${totalCards} Karten gelernt · ${state.stats.totalReviews} Wiederholungen · ${state.stats.streakDays} Tage Serie.</p>
      <p class="hint">Der Fortschritt liegt nur in diesem Browser. Exportiere ihn, wenn du das Gerät wechselst oder den Verlauf löschst.</p>
      <button class="btn block" id="export">Fortschritt exportieren</button>
      <label class="btn secondary block file-label">
        Fortschritt importieren
        <input type="file" id="import" accept="application/json,.json">
      </label>
    </div>

    <div class="card">
      <h2>Eigene Lektionen</h2>
      <p>Erweitere die App mit eigenen Vokabelpaketen als JSON-Datei.</p>
      <label class="btn secondary block file-label">
        Lektionspaket importieren
        <input type="file" id="import-pack" accept="application/json,.json">
      </label>
      ${
        customPacks.length
          ? `<div class="pack-list">${customPacks
              .map(
                (p) => `
            <div class="pack-row">
              <span>${p.id} · ${p.lessons.length} Lektion${p.lessons.length === 1 ? "" : "en"}</span>
              <button class="btn sm secondary" data-remove-pack="${p.id}">Entfernen</button>
            </div>`
              )
              .join("")}</div>`
          : ""
      }
      <details>
        <summary>Format anzeigen</summary>
        <textarea readonly rows="16" spellcheck="false">${SCHEMA_EXAMPLE}</textarea>
      </details>
    </div>

    <div class="card">
      <h2>Aussprache-Coach auf diesem Gerät</h2>
      <p class="hint">
        Spracherkennung (Auto-Bewertung): <strong>${supportsRecognition() ? "verfügbar" : "nicht verfügbar"}</strong><br>
        Aufnahme (Nachsprech-Modus): <strong>${supportsRecording() ? "verfügbar" : "nicht verfügbar"}</strong><br>
        Auf iPhones ist die Spracherkennung je nach iOS-Version unzuverlässig — im Coach kannst du jederzeit manuell umschalten.
      </p>
    </div>

    <div class="card">
      <h2>Zurücksetzen</h2>
      <p>Löscht den gesamten Lernfortschritt auf diesem Gerät. Exportiere vorher, wenn du ihn behalten willst.</p>
      <button class="btn danger-outline block" id="reset">Fortschritt zurücksetzen</button>
    </div>
  `;

  root.querySelectorAll("[data-theme]").forEach((btn) =>
    btn.addEventListener("click", () => {
      updateSettings({ theme: btn.dataset.theme });
      applyTheme(btn.dataset.theme);
      render(root);
    })
  );
  root.querySelectorAll("[data-dir]").forEach((btn) =>
    btn.addEventListener("click", () => {
      updateSettings({ direction: btn.dataset.dir });
      render(root);
    })
  );
  root.querySelectorAll("[data-new]").forEach((btn) =>
    btn.addEventListener("click", () => {
      updateSettings({ newPerSession: Number(btn.dataset.new) });
      render(root);
    })
  );

  const rate = root.querySelector("#rate");
  rate.addEventListener("input", () => {
    root.querySelector("#rate-val").textContent = `${Number(rate.value).toFixed(2)}×`;
  });
  rate.addEventListener("change", () => updateSettings({ ttsRate: Number(rate.value) }));

  root.querySelector("#voice")?.addEventListener("change", (e) => updateSettings({ voiceURI: e.target.value || null }));
  root.querySelector("#test-voice").addEventListener("click", () => {
    const s = getSettings();
    speak("¿Dónde está la playa?", { rate: Number(rate.value), voiceURI: s.voiceURI });
  });

  root.querySelector("#export").addEventListener("click", () => {
    downloadExport();
    toast("Export gestartet");
  });

  root.querySelector("#import").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      importStateJSON(await file.text());
      applyTheme(getSettings().theme);
      toast("Fortschritt importiert");
      render(root);
    } catch (err) {
      toast(`Import fehlgeschlagen: ${err.message}`);
    }
  });

  root.querySelector("#import-pack").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      addCustomPack(JSON.parse(await file.text()));
      toast("Lektionspaket importiert");
      render(root);
    } catch (err) {
      toast(`Import fehlgeschlagen: ${err.message}`);
    }
  });

  root.querySelectorAll("[data-remove-pack]").forEach((btn) =>
    btn.addEventListener("click", () => {
      removeCustomPack(btn.dataset.removePack);
      toast("Paket entfernt");
      render(root);
    })
  );

  root.querySelector("#reset").addEventListener("click", () => {
    if (confirm("Wirklich den gesamten Fortschritt löschen? Das kann nicht rückgängig gemacht werden.")) {
      resetAllProgress();
      applyTheme(getSettings().theme);
      toast("Fortschritt zurückgesetzt");
      render(root);
    }
  });
}
