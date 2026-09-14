import { getSettings } from "./core/storage.js";
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

function matchRoute(hash) {
  if (hash === "" || hash === "#/" || hash === "#") return { view: Dashboard, params: {} };
  if (hash === "#/lessons") return { view: Lessons, params: {} };
  if (hash === "#/review") return { view: Review, params: {} };
  if (hash === "#/pronounce") return { view: Pronounce, params: {} };
  if (hash === "#/settings") return { view: Settings, params: {} };
  const lessonMatch = hash.match(/^#\/lesson\/(.+)$/);
  if (lessonMatch) return { view: LessonDetail, params: { id: decodeURIComponent(lessonMatch[1]) } };
  return { view: Dashboard, params: {} };
}

function renderTabbar(activeHash) {
  const nav = document.getElementById("tabbar");
  nav.innerHTML = TABS.map(
    (t) => `<a href="${t.path}" class="${activeHash === t.path || (t.path !== "#/" && activeHash.startsWith(t.path)) ? "active" : ""}">
      <span class="ic">${t.icon}</span>${t.label}
    </a>`
  ).join("");
}

function router() {
  const hash = location.hash || "#/";
  const { view, params } = matchRoute(hash);
  const root = document.getElementById("view");
  view.render(root, params);
  renderTabbar(hash.split("?")[0]);
  window.scrollTo(0, 0);
}

function boot() {
  applyTheme(getSettings().theme);
  window.addEventListener("hashchange", router);
  router();
}

boot();
