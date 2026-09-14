import { getSettings, updateSettings, downloadExport, importStateJSON, resetAllProgress, getState } from "../core/storage.js";
import { addCustomPack, getCustomPacks, removeCustomPack } from "../core/content.js";
import { getSpanishVoices } from "../core/pronunciation.js";
import { toast } from "./toast.js";

const SCHEMA_EXAMPLE = `{
  "id": "mein-paket",
  "lessons": [
    {
      "id": "custom-1",
      "title": "Meine Lektion",
      "subtitle": "Eigene Wörter",
      "icon": "⭐",
      "tips": [],
      "items": [
        { "es": "el gato", "de": "die Katze" }
      ]
    }
  ]
}`;

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

export async function render(root) {
  const settings = getSettings();
  const state = getState();
  const customPacks = getCustomPacks();
  const voices = await getSpanishVoices();

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
      <p>In welche Richtung sollen Karten beim Wiederholen abgefragt werden?</p>
      <div class="pill-row">
        <button class="pill ${settings.direction === "mixed" ? "active" : ""}" data-dir="mixed">Gemischt</button>
        <button class="pill ${settings.direction === "es-de" ? "active" : ""}" data-dir="es-de">ES → DE</button>
        <button class="pill ${settings.direction === "de-es" ? "active" : ""}" data-dir="de-es">DE → ES</button>
      </div>
    </div>

    <div class="card">
      <h2>Sprachausgabe</h2>
      <label style="font-size:0.85rem;color:var(--fg-soft);">Geschwindigkeit</label>
      <input type="range" id="rate" min="0.5" max="1.2" step="0.05" value="${settings.ttsRate}" style="width:100%;">
      ${
        voices.length
          ? `<label style="font-size:0.85rem;color:var(--fg-soft);">Stimme</label>
             <select id="voice">
               <option value="">Standard</option>
               ${voices.map((v) => `<option value="${v.voiceURI}" ${settings.voiceURI === v.voiceURI ? "selected" : ""}>${v.name}</option>`).join("")}
             </select>`
          : `<p style="font-size:0.82rem;">Keine spanischen Stimmen gefunden &ndash; es wird die Systemstimme genutzt.</p>`
      }
    </div>

    <div class="card">
      <h2>Fortschritt sichern</h2>
      <p>${state.introducedCards.length} Karten gelernt · ${state.stats.totalReviews} Wiederholungen insgesamt.</p>
      <button class="btn block" id="export">Fortschritt exportieren (JSON)</button>
      <label class="btn secondary block" style="margin-top:8px;">
        Fortschritt importieren
        <input type="file" id="import" accept="application/json" style="display:none;">
      </label>
    </div>

    <div class="card">
      <h2>Eigene Lektionen importieren</h2>
      <p>Du kannst später eigene Vokabelpakete als JSON-Datei hinzufügen, um die App zu erweitern.</p>
      <label class="btn secondary block">
        Lektionspaket importieren
        <input type="file" id="import-pack" accept="application/json" style="display:none;">
      </label>
      ${
        customPacks.length
          ? customPacks
              .map(
                (p) => `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
            <span>${p.id} (${p.lessons.length} Lektion${p.lessons.length === 1 ? "" : "en"})</span>
            <button class="btn sm secondary" data-remove-pack="${p.id}">Entfernen</button>
          </div>`
              )
              .join("")
          : ""
      }
      <details style="margin-top:10px;">
        <summary style="cursor:pointer;color:var(--accent-2);font-weight:600;">Format anzeigen</summary>
        <textarea readonly rows="10" style="margin-top:8px;font-size:0.78rem;">${SCHEMA_EXAMPLE}</textarea>
      </details>
    </div>

    <div class="card">
      <h2>Zurücksetzen</h2>
      <p>Löscht deinen gesamten Lernfortschritt unwiderruflich auf diesem Gerät.</p>
      <button class="btn ghost block" id="reset" style="color:var(--danger);box-shadow:inset 0 0 0 1.5px var(--danger);">Fortschritt zurücksetzen</button>
    </div>

    <div class="card">
      <h2>Über den Aussprache-Coach</h2>
      <p style="font-size:0.85rem;">Nutzt die Spracherkennung deines Browsers. Auf iPhone/Safari ist das je nach iOS-Version eingeschränkt &ndash; die App erkennt das automatisch und wechselt in den Nachsprech-Modus (Aufnahme + Vergleich per Ohr).</p>
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
  root.querySelector("#rate").addEventListener("change", (e) => updateSettings({ ttsRate: Number(e.target.value) }));
  root.querySelector("#voice")?.addEventListener("change", (e) => updateSettings({ voiceURI: e.target.value || null }));

  root.querySelector("#export").addEventListener("click", () => {
    downloadExport();
    toast("Export gestartet");
  });

  root.querySelector("#import").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      importStateJSON(await file.text());
      toast("Fortschritt importiert");
      render(root);
    } catch (err) {
      toast("Import fehlgeschlagen: " + err.message);
    }
  });

  root.querySelector("#import-pack").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const pack = JSON.parse(await file.text());
      addCustomPack(pack);
      toast("Lektionspaket importiert");
      render(root);
    } catch (err) {
      toast("Import fehlgeschlagen: " + err.message);
    }
  });

  root.querySelectorAll("[data-remove-pack]").forEach((btn) =>
    btn.addEventListener("click", () => {
      removeCustomPack(btn.dataset.removePack);
      render(root);
    })
  );

  root.querySelector("#reset").addEventListener("click", () => {
    if (confirm("Wirklich den gesamten Fortschritt löschen?")) {
      resetAllProgress();
      toast("Fortschritt zurückgesetzt");
      render(root);
    }
  });
}

export { applyTheme };
