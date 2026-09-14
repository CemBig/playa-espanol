import { getSettings } from "./core/storage.js";
import { initSpeech } from "./core/pronunciation.js";
import { applyTheme } from "./ui/settings.js";
import * as Dashboard from "./ui/dashboard.js";
import * as Lessons from "./ui/lessons.js";
import * as LessonDetail from "./ui/lesson-detail.js";
import * as Review from "./ui/review.js";
import * as Pronounce from "./ui/pronounce.js";
import * as Settings from "./ui/settings.js";

const TABS = [
  { path: "#/", icon: "🏝️", label: "Start" },
  { path: "#/lessons", icon: "📚", label: "Lektionen" },
  { path: "#/review", icon: "🔁", label: "Wiederholen" },
  { path: "#/pronounce", icon: "🎤", label: "Aussprache" },
  { path: "#/settings", icon: "⚙️", label: "Mehr" }
];

const ROUTES = {
  "#/": Dashboard,
  "#/lessons": Lessons,
  "#/review": Review,
  "#/pronounce": Pronounce,
  "#/settings": Settings
};

function matchRoute(hash) {
  if (!hash || hash === "#" || hash === "#/") return { view: Dashboard, params: {} };
  const lessonMatch = hash.match(/^#\/lesson\/(.+)$/);
  if (lessonMatch) return { view: LessonDetail, params: { id: decodeURIComponent(lessonMatch[1]) } };
  return { view: ROUTES[hash] || Dashboard, params: {} };
}

function renderTabbar(activeHash) {
  const isActive = (path) => (path === "#/" ? activeHash === "#/" : activeHash.startsWith(path));
  document.getElementById("tabbar").innerHTML = TABS.map(
    (t) => `<a href="${t.path}" class="${isActive(t.path) ? "active" : ""}">
      <span class="ic">${t.icon}</span>${t.label}
    </a>`
  ).join("");
}

function router() {
  const hash = (location.hash || "#/").split("?")[0];
  const { view, params } = matchRoute(hash);
  // Lesson detail lives under the Lektionen tab.
  renderTabbar(hash.startsWith("#/lesson/") ? "#/lessons" : hash);
  try {
    view.render(document.getElementById("view"), params);
  } catch (err) {
    console.error(err);
    document.getElementById("view").innerHTML = `
      <div class="empty-state">
        <div class="emoji">⚠️</div>
        <h2>Etwas ist schiefgelaufen</h2>
        <p>${err.message}</p>
        <button class="btn block" onclick="location.hash='#/'">Zur Startseite</button>
      </div>`;
  }
  window.scrollTo(0, 0);
}

function boot() {
  applyTheme(getSettings().theme);
  initSpeech();
  window.addEventListener("hashchange", router);
  router();

  // Offline support matters on a trip: once loaded, the app keeps working without data.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((err) => console.warn("SW registration failed:", err));
    });
  }
}

boot();
