// Settings page sections. Opens on "Account"; #tab=data (or ?tab=data) opens another section.
const tabs = [...document.querySelectorAll("#settingsTabs [data-tab]")], panes = [...document.querySelectorAll(".settings-pane")];
function show(name, focus) {
  if (!panes.some(p => p.dataset.pane === name)) name = "account";
  tabs.forEach(t => { const on = t.dataset.tab === name; t.classList.toggle("on", on); t.setAttribute("aria-selected", on); t.tabIndex = on ? 0 : -1; if (on && focus) t.scrollIntoView({ inline: "center", block: "nearest" }); });
  panes.forEach(p => { p.hidden = p.dataset.pane !== name; });
  window.dispatchEvent(new CustomEvent("qm-settings-tab", { detail: name }));
}
tabs.forEach(t => { t.onclick = () => { show(t.dataset.tab, true); window.scrollTo(0, 0); document.querySelector("main")?.scrollTo?.(0, 0); }; });
tabs.forEach(t => t.addEventListener("keydown", e => { const i = tabs.indexOf(t), n = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0; if (n) { const x = tabs[(i + n + tabs.length) % tabs.length]; x.focus(); show(x.dataset.tab, true); } }));
// Leaving for a sub-page (Plugins, Bots, Status…) and coming back lands on the tab you came from, not on "Account".
const RET = "qm-settings-return";
let current = "account";
window.addEventListener("qm-settings-tab", e => { current = e.detail; });
document.addEventListener("click", e => {
  const a = e.target.closest && e.target.closest("a[href]"); if (!a) return;
  try { const u = new URL(a.href, location.href); if (u.origin === location.origin && !/account\.html$/.test(u.pathname) && /\.html$/.test(u.pathname)) sessionStorage.setItem(RET, JSON.stringify({ tab: current, at: Date.now() })); } catch (_) { /* ignore */ }
}, true);
let back = null;
try { const r = JSON.parse(sessionStorage.getItem(RET) || "null"); sessionStorage.removeItem(RET); if (r && Date.now() - r.at < 900e3) back = r.tab; } catch (_) { /* ignore */ }
const q = new URLSearchParams(location.search).get("tab") || (location.hash.match(/tab=(\w+)/) || [])[1];
show(q || back || "account");
document.addEventListener("click", e => { const g = e.target.closest && e.target.closest("[data-goto-tab]"); if (g) { show(g.dataset.gotoTab, true); window.scrollTo(0, 0); } });
export { show as showSettingsTab };
