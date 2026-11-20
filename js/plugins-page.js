import { hydrateIcons, toast, confirmDialog, promptDialog, copyText } from "./ui.js";
import { devOn } from "./dev.js";
import { loadPlugins, savePlugins, normalize, newPluginId, PERMISSIONS, PERM_INFO, UNSANDBOXED_WARNING, groupPermissions, riskOf, unreviewed, pluginIssues, isBlocked, checkPluginUpdate, fetchPluginFromUrl, loadSchema, loadSettings, saveSettings, cleanSettingValue, clearPluginData } from "./plugin-store.js";
import { SITE_VERSION, API_VERSION, checkSiteVersion, lastCheck } from "./version.js";
import { QM } from "./embed.js";

hydrateIcons();
const $ = id => document.getElementById(id);
const host = () => { try { return (QM && QM.plugins) || window.top.QM?.plugins || null; } catch (_) { return null; } };
let editing = null;                              // plugin id being edited, "" for a new one
const updates = new Map();                       // id -> result of the last update check

const TEMPLATES = {
  "": { label: "Empty", perms: [], code: "// qm is the plugin API. See the docs page for everything it can do.\n" },
  hello: { label: "Hello (toast)", perms: ["toast"], code: "await qm.toast('Hello from my plugin! Site ' + qm.version, 'success');\nqm.on('chat-open', () => qm.toast('You opened a chat'));\n" },
  theme: { label: "Restyle the site (CSS)", perms: ["style"], code: "await qm.style.set(`\\n  .bubble, .msg .bubble { border-radius: 4px !important; }\\n  :root { --accent: #e11d48; }\\n`);\n" },
  counter: { label: "Message counter (opens from a chat button)", perms: ["ui", "buttons", "messages"], code: "let n = Number(await qm.storage.get('count')) || 0;\nawait qm.buttons.add({ id: 'stats', where: 'chat', label: 'Count', title: 'How many messages you have seen' });\nqm.on('message', async () => { n++; await qm.storage.set('count', n); });\nconst show = () => qm.ui.open({ id: 'stats', title: 'Messages seen', size: 'sm', blocks: [\n  { type: 'kv', rows: [['Total', String(n)]] },\n  { type: 'buttons', items: [{ id: 'reset', label: 'Reset', kind: 'danger' }, { id: 'close', label: 'Close' }] }\n] });\nqm.on('button', b => { if (b.id === 'stats') show(); });\nqm.on('ui-action', async a => {\n  if (a.id === 'reset') { n = 0; await qm.storage.set('count', 0); show(); }\n  if (a.id === 'close') qm.ui.close('stats');\n});\n" },
  find: { label: "Find a message (button that scrolls the chat)", perms: ["buttons", "page", "toast"], code: "await qm.buttons.add({ id: 'find', where: 'chat', label: 'Find', title: 'Scroll up until a message is found' });\nqm.on('button', async b => {\n  if (b.id !== 'find') return;\n  const text = await qm.ask('Find a message', 'Text to look for');\n  if (!text) return;\n  const r = await qm.page.scrollUntil({ text, direction: 'up', maxMs: 60000 });   // loads older messages on the way\n  qm.toast(r.found ? 'Found it' : 'Not found (' + r.reason + ')', r.found ? 'success' : 'error');\n});\n" },
  callinfo: { label: "Extra call info (developer view)", perms: ["devinfo", "calls"], code: "const paint = async () => {\n  const c = await qm.calls.state();\n  let extra = [];\n  if (c.joined) { try { const s = await qm.dev.read('call'); extra = [['Connections', Object.keys(s.links || {}).length], ['Online', s.online === false ? 'no' : 'yes', s.online === false ? 'bad' : 'ok']]; } catch (e) {} }\n  await qm.dev.addCard('call', { id: 'extra', title: 'Call extras', rows: [['In a call', c.joined ? 'yes' : 'no', c.joined ? 'ok' : ''], ...extra] });\n};\nqm.on('dev-view', paint); qm.on('call-state', paint); paint();\n" },
  appinfo: { label: "Extra app info (developer view)", perms: ["devinfo"], code: "const paint = async () => {\n  const env = await qm.dev.read('env');\n  await qm.dev.addCard('app', { id: 'env', title: 'Quick facts', rows: [['Online', env.online ? 'yes' : 'no', env.online ? 'ok' : 'bad'], ['Screen', env.viewport.w + ' x ' + env.viewport.h], ['Memory (MB)', env.memoryMB ?? 'n/a']] });\n};\nqm.on('dev-view', paint); paint();\n" },
  slash: { label: "Slash commands and a shortcut", perms: ["commands", "keys", "send", "chat", "toast"], code: "await qm.commands.add({ name: 'shrug', description: 'Send a shrug' });\nawait qm.commands.add({ name: 'time', description: 'Send the time' });\nqm.on('command', async c => {\n  if (c.name === 'shrug') await qm.chat.send((c.args ? c.args + ' ' : '') + '¯\\\\_(ツ)_/¯');\n  if (c.name === 'time') await qm.chat.send('It is ' + new Date().toLocaleTimeString());\n});\nawait qm.keys.add({ id: 'draft', combo: 'ctrl+shift+d' });\nqm.on('key', async () => qm.toast('Draft: ' + (await qm.chat.getText())));\n" },
  notes: { label: "Notes window (custom UI)", perms: ["ui", "buttons", "toast"], code: "const draw = async () => qm.ui.open({ id: 'notes', title: 'Notes', size: 'md', blocks: [\n  { type: 'input', id: 'text', label: 'Write a note', multiline: true, value: '' },\n  { type: 'button', id: 'save', label: 'Save note', kind: 'primary' },\n  { type: 'divider' },\n  { type: 'list', empty: 'No notes yet', items: ((await qm.storage.get('notes')) || []).map((t, i) => ({ id: 'del:' + i, title: t, sub: 'Tap to delete' })) }\n] });\nawait qm.buttons.add({ id: 'open', where: 'list', label: 'Notes' });\nqm.on('button', draw);\nqm.on('ui-action', async a => {\n  const notes = (await qm.storage.get('notes')) || [];\n  if (a.id === 'save' && a.values.text) { notes.push(a.values.text); await qm.storage.set('notes', notes); qm.toast('Saved', 'success'); await qm.ui.close('notes'); draw(); }\n  if (a.id.startsWith('del:')) { notes.splice(Number(a.id.slice(4)), 1); await qm.storage.set('notes', notes); await qm.ui.close('notes'); draw(); }\n});" },
  menu: { label: "Message menu: save to notes", perms: ["menu", "messages", "toast"], code: "await qm.messageMenu.add({ id: 'save', label: 'Save text', icon: 'copy', textOnly: true });\nqm.on('menu-click', async m => {\n  if (m.id !== 'save') return;\n  const saved = (await qm.storage.get('saved')) || [];\n  saved.push(m.message.text); await qm.storage.set('saved', saved.slice(-50));\n  qm.toast('Saved (' + saved.length + ')', 'success');\n});" },
  callbanner: { label: "Call timer banner (button on the call screen)", perms: ["panel", "calls", "buttons"], code: "let t0 = 0, on = false;\nawait qm.buttons.add({ id: 'timer', where: 'call', label: 'Timer', title: 'Show or hide a call timer' });\nconst fmt = ms => { const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };\nconst paint = () => qm.banner.show({ where: 'call', text: 'In this call for ' + fmt(Date.now() - t0), kind: 'info', dismiss: false, buttons: ['Hide'] });\nconst hide = () => { on = false; return qm.banner.hide({ where: 'call' }); };\nqm.on('button', b => { if (b.id !== 'timer') return; if (on) hide(); else { on = true; t0 = Date.now(); paint(); } });\nqm.on('banner-button', hide);\nqm.every(1000, () => { if (on) paint().catch(() => { on = false; }); });\nqm.on('call-state', c => { if (!c.joined && on) hide(); });\n" },
  mine: { label: "Copy my recent messages (shortcut)", perms: ["messages", "clipboard", "keys", "toast"], code: "await qm.keys.add({ id: 'copy', combo: 'ctrl+shift+m' });\nqm.on('key', async () => {\n  const mine = await qm.messages.find({ fromMe: true, limit: 10 });\n  await qm.clipboard.write(mine.map(m => m.text).filter(Boolean).join('\\n'));\n  qm.toast('Copied ' + mine.length + ' messages');\n});\n" },
  quick: { label: "Quick replies (opens from a chat button)", perms: ["ui", "buttons", "chat"], code: "const DEFAULTS = ['On my way', 'Call you later', 'Thanks!'];\nconst load = async () => (await qm.storage.get('replies')) || DEFAULTS;\nawait qm.buttons.add({ id: 'quick', where: 'chat', label: 'Quick', title: 'Insert a quick reply' });\nconst show = async () => qm.ui.open({ id: 'quick', title: 'Quick replies', size: 'sm', reset: true, blocks: [\n  { type: 'list', items: (await load()).map((t, i) => ({ id: 'use:' + i, title: t })) },\n  { type: 'divider' },\n  { type: 'input', id: 'new', label: 'Add your own', placeholder: 'Type a reply', submit: 'add' },\n  { type: 'button', id: 'add', label: 'Add', kind: 'primary' }\n] });\nqm.on('button', b => { if (b.id === 'quick') show(); });\nqm.on('ui-action', async a => {\n  const list = await load();\n  if (a.id.startsWith('use:')) { await qm.chat.insertText(list[Number(a.id.slice(4))]); qm.ui.close('quick'); }\n  if (a.id === 'add' && a.values.new) { list.push(a.values.new.slice(0, 80)); await qm.storage.set('replies', list.slice(-12)); show(); }\n});\n" }
};

function el(tag, props = {}, ...kids) { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; }

const RISK_N = { low: 0, medium: 1, high: 2, critical: 3 };
/** Expand all / Collapse all for a box of <details> groups. */
function expandBar(box) {
  const mk = (t, open) => { const b = el("button", { type: "button", className: "btn small", textContent: t }); b.onclick = () => box.querySelectorAll("details.perm-group").forEach(d => { d.open = open; }); return b; };
  return el("div", { className: "row wrap perm-bar" }, mk("Expand all", true), mk("Collapse all", false));
}
const groupHead = g => el("summary", {}, el("span", { className: "pg-name", textContent: g.label }), el("span", { className: "pg-count muted", textContent: " " + g.perms.length + (g.perms.length === 1 ? " permission" : " permissions") + " " }), el("span", { className: "risk-badge " + g.risk, textContent: g.risk.toUpperCase() }));
/** The permission review: what a plugin asks for, in plain words, in groups you can open and close (the risky ones start open). */
function permissionList(perms) {
  const box = el("div", { className: "perm-review" }), groups = groupPermissions(perms);
  if (!groups.length) { box.append(el("p", { className: "muted", textContent: "This plugin asks for no permissions. It can't see or change anything." })); return box; }
  if (groups.length > 1) box.append(expandBar(box));
  for (const g of groups) {
    const d = el("details", { className: "perm-group risk-" + g.risk, open: RISK_N[g.risk] >= 2 || groups.length === 1 });
    d.append(groupHead(g));
    if (g.hint) d.append(el("div", { className: "muted pg-hint", textContent: g.hint }));
    for (const x of [...g.perms].sort((a, b) => RISK_N[b.risk] - RISK_N[a.risk])) d.append(el("div", { className: "perm-item risk-" + x.risk }, el("strong", {}, el("span", { className: "risk-badge " + x.risk, textContent: x.risk.toUpperCase() }), " " + x.label), el("div", { className: "muted", textContent: x.info })));
    box.append(d);
  }
  return box;
}
const dangerBox = () => el("div", { className: "danger-box", role: "alert" }, el("strong", { textContent: "⛔ EXTREMELY DANGEROUS: UNSANDBOXED" }), el("p", { textContent: UNSANDBOXED_WARNING }));
function reviewPermissions(p, perms, title) {
  return new Promise(resolve => {
    const all = p.permissions, unsafe = all.includes("unsandboxed"), viewOnly = !!title && !unreviewed(p).length;
    const dlg = el("dialog", { className: "modal perm-dialog" }), form = el("form", { method: "dialog" });
    form.append(el("h2", { textContent: title || `Review “${p.name}”` }));
    form.append(el("p", { className: "muted", textContent: `Version ${p.version}${p.author ? " by " + p.author : ""}. Overall risk: ${riskOf(all)}. Plugins only get what you approve here.` }));
    if (unsafe) form.append(dangerBox());
    form.append(permissionList(all));
    let field = null;
    if (unsafe && !viewOnly) { field = el("input", { className: "field", placeholder: "Type UNSANDBOXED to allow", autocomplete: "off" }); form.append(el("label", {}, "To allow it, type UNSANDBOXED:", field)); }
    const ok = el("button", { type: "submit", className: "btn " + (unsafe ? "danger" : "primary"), textContent: viewOnly ? "Close" : unsafe ? "Allow (dangerous)" : (title ? "Approve" : "Approve and switch on"), value: "ok" });
    if (unsafe && !viewOnly) ok.disabled = true;
    if (field) field.oninput = () => { ok.disabled = field.value.trim().toUpperCase() !== "UNSANDBOXED"; };
    const cancel = el("button", { type: "button", className: "btn", textContent: "Cancel" }); cancel.onclick = () => dlg.close("cancel");
    form.append(el("div", { className: "modal-actions" }, ...(viewOnly ? [] : [cancel]), ok));
    dlg.append(form); document.body.append(dlg);
    dlg.addEventListener("close", () => { const yes = dlg.returnValue === "ok"; dlg.remove(); resolve(yes); });
    dlg.showModal();
  });
}
/** Permissions of an edited or updated plugin that were already reviewed on the old copy stay reviewed; anything new needs a review. */
const keepApproved = (old, perms) => old ? perms.filter(k => (Array.isArray(old.approved) ? old.approved : old.permissions.filter(x => x !== "unsandboxed")).includes(k)) : [];
/** Saves "these permissions were reviewed" for a plugin. */
function approve(id) { const l = loadPlugins(), q = l.find(x => x.id === id); if (q) { q.approved = [...q.permissions]; savePlugins(l); } }

function verLine() {
  const l = lastCheck();
  $("verLine").textContent = `You have ${SITE_VERSION} (plugin API v${API_VERSION}).` + (l && l.ok ? (l.newer ? ` A newer version is available: ${l.latest}. Reload the page (or re-download your offline copy).` : ` Latest is ${l.latest}: you are up to date.`) + ` Checked ${new Date(l.at).toLocaleTimeString()}.` : " Not checked yet.");
}

function paintList() {
  const list = loadPlugins(), box = $("list"), st = host()?.status?.() || [];
  box.replaceChildren();
  if (!list.length) box.append(el("p", { className: "muted", textContent: "No plugins yet." }));
  for (const p of list) {
    const issues = pluginIssues(p), up = updates.get(p.id), run = st.find(s => s.id === p.id);
    const row = el("div", { className: "plugin-row" });
    row.dataset.id = p.id;
    const sw = el("input", { type: "checkbox", checked: p.enabled, disabled: isBlocked(p) });
    sw.setAttribute("aria-label", "Enable " + p.name);
    sw.onchange = async () => {
      if (sw.checked && unreviewed(p).length && !(await reviewPermissions(p))) { sw.checked = false; return; }
      if (sw.checked && unreviewed(p).length) approve(p.id);
      const l = loadPlugins(); const q = l.find(x => x.id === p.id); if (q) { q.enabled = sw.checked; savePlugins(l); } sync(); toast(sw.checked ? "Plugin on" : "Plugin off", "success", 1500); setTimeout(paintList, 400);
    };
    row.append(el("label", { className: "switch-row" }, sw, el("span", {}, el("strong", { textContent: p.name }), el("small", { className: "muted", textContent: `  v${p.version} · API v${p.apiVersion}${p.author ? " · " + p.author : ""}` }), el("br"), el("small", { className: "muted", textContent: p.description || "" }))));
    const rk = riskOf(p.permissions), unsafe = p.permissions.includes("unsandboxed"), gs = groupPermissions(p.permissions);
    row.append(el("div", { className: "perm-summary" }, el("span", { className: "risk-badge " + (p.permissions.length ? rk : "low"), textContent: unsafe ? "UNSANDBOXED" : p.permissions.length ? rk + " risk" : "no permissions" }),
      el("span", { className: "muted", textContent: p.permissions.length ? " " + gs.map(g => g.label + " (" + g.perms.length + ")").join(" · ") : " It can't see or change anything." })));
    if (p.permissions.length) { const det = el("details", { className: "plugin-perms" }, el("summary", { textContent: "What it can do" })); det.append(permissionList(p.permissions)); row.append(det); }
    if (unsafe) row.append(dangerBox());
    if (p.enabled && unreviewed(p).length) row.append(el("div", { className: "plugin-issue warn", role: "alert", textContent: "⚠️ Its permissions changed. It stays off until you review and approve them (use the Permissions button)." }));
    for (const i of issues) row.append(el("div", { className: "plugin-issue " + i.level, role: "alert", textContent: (i.level === "error" ? "⛔ " : "⚠️ ") + i.text }));
    if (up && up.ok && up.newer) row.append(el("div", { className: "plugin-issue warn", textContent: `⬆️ Update available: ${up.latest}${up.info.downloadUrl ? " — " + up.info.downloadUrl : ""}. Import the new file to update (your settings stay).` }));
    if (up && up.ok && !up.newer && !up.none) row.append(el("div", { className: "muted", style: "font-size:.8rem", textContent: "Up to date." }));
    if (up && !up.ok) row.append(el("div", { className: "muted", style: "font-size:.8rem", textContent: "Couldn't check for updates: " + up.error }));
    if (p.enabled && run && run.state === "crashed") row.append(el("div", { className: "plugin-issue error", textContent: "Crashed: " + run.error }));
    if (devOn() && p.enabled && run && run.logs.length) row.append(el("details", {}, el("summary", { textContent: "Log (" + run.logs.length + ")" }), el("pre", { className: "dev-pre", textContent: run.logs.join("\n") })));
    const btns = el("div", { className: "row wrap", style: "margin-top:.4rem" });
    const b = (t, fn, cls = "") => { const x = el("button", { type: "button", className: "btn small " + cls, textContent: t }); x.onclick = fn; btns.append(x); };
    if (loadSchema(p.id)) b("⚙ Settings", () => openSettings(p), "primary");
    b("Permissions", async () => { if (await reviewPermissions(p, p.permissions, `What “${p.name}” can do`)) { approve(p.id); sync(); paintList(); } });
    b("Edit", () => openEditor(p));
    b("Export", () => exportPlugin(p));
    if (p.updateUrl) b("Check update", async () => { updates.set(p.id, await checkPluginUpdate(p)); paintList(); });
    b("Delete", async () => { if (await confirmDialog({ title: "Delete plugin?", message: `“${p.name}” and its saved data will be removed.`, confirmText: "Delete", danger: true })) { savePlugins(loadPlugins().filter(x => x.id !== p.id)); clearPluginData(p.id); sync(); paintList(); } });
    row.append(btns);
    box.append(row);
  }
}
/** The plugin's own settings: a form built from what the plugin described (qm.settings.define). */
function openSettings(p) {
  const sc = loadSchema(p.id); if (!sc) return;
  const vals = loadSettings(p.id), inputs = {};
  const dlg = el("dialog", { className: "modal perm-dialog" }), form = el("form", { method: "dialog" });
  form.append(el("h2", { textContent: sc.title || p.name + " settings" }));
  if (sc.description) form.append(el("p", { className: "muted", textContent: sc.description }));
  const body = el("div", { className: "stack" });
  for (const f of sc.fields) {
    let inp;
    if (f.type === "toggle") inp = el("input", { type: "checkbox", checked: !!vals[f.id] });
    else if (f.type === "select") { inp = el("select", { className: "field" }, ...f.options.map(o => el("option", { value: o.value, textContent: o.label }))); inp.value = String(vals[f.id]); }
    else if (f.type === "textarea") inp = el("textarea", { className: "field", rows: 4, value: String(vals[f.id] ?? ""), maxLength: f.maxLength || 500, placeholder: f.placeholder || "" });
    else if (f.type === "number" || f.type === "range") { inp = el("input", { className: "field", type: f.type, value: String(vals[f.id]) }); for (const k of ["min", "max", "step"]) if (f[k] !== undefined) inp.setAttribute(k, f[k]); }
    else if (f.type === "color") inp = el("input", { type: "color", value: String(vals[f.id]) });
    else inp = el("input", { className: "field", type: "text", value: String(vals[f.id] ?? ""), maxLength: f.maxLength || 500, placeholder: f.placeholder || "" });
    inp.dataset.field = f.id; inputs[f.id] = inp;
    const out = f.type === "range" ? el("span", { className: "muted", textContent: " " + vals[f.id] }) : null;
    if (out) inp.addEventListener("input", () => { out.textContent = " " + inp.value; });
    const desc = f.description ? [el("small", { className: "muted", textContent: f.description })] : [];
    body.append(f.type === "toggle"
      ? el("label", { className: "switch-row" }, inp, el("span", {}, el("strong", { textContent: f.label }), ...(f.description ? [el("br")] : []), ...desc))
      : el("label", { className: "lbl" }, f.label, ...(out ? [out] : []), inp, ...desc));
  }
  form.append(body);
  const err = el("div", { className: "muted", role: "alert" }); form.append(err);
  const reset = el("button", { type: "button", className: "btn", textContent: "Reset to defaults" });
  const cancel = el("button", { type: "button", className: "btn", textContent: "Cancel" }); cancel.onclick = () => dlg.close("cancel");
  const save = el("button", { type: "submit", className: "btn primary", textContent: "Save", value: "ok" });
  reset.onclick = () => { for (const f of sc.fields) { const i = inputs[f.id]; if (f.type === "toggle") i.checked = !!f.default; else i.value = String(f.default); } };
  form.append(el("div", { className: "modal-actions" }, reset, cancel, save));
  form.addEventListener("submit", e => {
    const next = {};
    try { for (const f of sc.fields) next[f.id] = cleanSettingValue(f, f.type === "toggle" ? inputs[f.id].checked : inputs[f.id].value); }
    catch (x) { e.preventDefault(); err.textContent = x.message; return; }
    saveSettings(p.id, next); try { host()?.settingsChanged?.(p.id); } catch (_) { /* plugin not running */ } toast("Saved.", "success", 1500);
  });
  dlg.append(form); document.body.append(dlg); dlg.addEventListener("close", () => dlg.remove()); dlg.showModal();
}
const sync = () => { try { host()?.startAll?.(); } catch (_) { /* ignore */ } };

function exportPlugin(p) {
  const { enabled, added, ...rest } = p;
  const blob = new Blob([JSON.stringify(rest, null, 2)], { type: "application/json" });
  const a = el("a", { href: URL.createObjectURL(blob), download: p.name.replace(/[^\w-]+/g, "-").toLowerCase() + ".qmplugin.json" });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function openEditor(p) {
  editing = p ? p.id : "";
  $("edTitle").textContent = p ? "Edit plugin" : "New plugin";
  $("edName").value = p?.name || ""; $("edVersion").value = p?.version || "1.0.0"; $("edApi").value = p?.apiVersion || API_VERSION;
  $("edMin").value = p?.minSite || ""; $("edDesc").value = p?.description || ""; $("edAuthor").value = p?.author || ""; $("edUpd").value = p?.updateUrl || "";
  $("edCode").value = p?.code ?? TEMPLATES[""].code; $("edErr").textContent = "";
  paintPerms(p?.permissions || []);
  $("edTpl").value = ""; $("edTpl").parentElement.hidden = !!p;
  $("editor").classList.remove("hidden"); $("editor").scrollIntoView({ block: "start" });
}
function paintPerms(on) {
  const box = $("edPerms"); box.replaceChildren(); if (!$("edUnsafe")) { const d = dangerBox(); d.id = "edUnsafe"; box.after(d); }
  $("edUnsafe").hidden = !on.includes("unsandboxed");
  const wrap = el("div", { className: "perm-review" }); wrap.append(expandBar(wrap));
  for (const g of groupPermissions(Object.keys(PERMISSIONS))) {
    const d = el("details", { className: "perm-group risk-" + g.risk, open: g.perms.some(x => on.includes(x.key)) });
    d.append(groupHead(g));
    if (g.hint) d.append(el("div", { className: "muted pg-hint", textContent: g.hint }));
    for (const x of g.perms) {
      const cb = el("input", { type: "checkbox", checked: on.includes(x.key), id: "perm-" + x.key });
      d.append(el("label", { className: "switch-row perm-opt risk-" + x.risk }, cb, el("span", {}, el("strong", { textContent: x.key }), " — " + x.label, el("small", { className: "muted", textContent: "  [" + x.risk + " risk]" }), el("br"), el("small", { className: "muted", textContent: x.info }))));
      if (x.key === "unsandboxed") cb.addEventListener("change", () => { $("edUnsafe").hidden = !cb.checked; });
    }
    wrap.append(d);
  }
  box.append(wrap);
}
const chosenPerms = () => Object.keys(PERMISSIONS).filter(k => $("perm-" + k)?.checked);

$("edTpl").append(...Object.entries(TEMPLATES).map(([k, t]) => el("option", { value: k, textContent: t.label })));
$("edTpl").onchange = () => { const t = TEMPLATES[$("edTpl").value]; if (!t) return; $("edCode").value = t.code; paintPerms(t.perms); if (!$("edName").value) $("edName").value = t.label.replace(/ \(.*/, ""); };
$("newBtn").onclick = () => openEditor(null);
$("edCancel").onclick = () => { $("editor").classList.add("hidden"); editing = null; };
$("edSave").onclick = () => {
  try {
    const list = loadPlugins(), old = editing ? list.find(x => x.id === editing) : null;
    const p = normalize({
      id: old?.id, name: $("edName").value, version: $("edVersion").value, apiVersion: Number($("edApi").value) || API_VERSION, minSite: $("edMin").value, description: $("edDesc").value,
      author: $("edAuthor").value, updateUrl: $("edUpd").value, permissions: chosenPerms(), code: $("edCode").value, enabled: old ? old.enabled : false, added: old?.added
    });
    p.approved = keepApproved(old, p.permissions);
    savePlugins(old ? list.map(x => x.id === old.id ? p : x) : [...list, p]);
    $("editor").classList.add("hidden"); editing = null; sync(); paintList();
    toast(old ? "Plugin saved." : "Plugin added. Switch it on when you're ready.", "success", 2500);
  } catch (e) { $("edErr").textContent = e.message; }
};
$("importBtn").onclick = () => $("importFile").click();
$("importFile").onchange = async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  try {
    const raw = JSON.parse(await f.text());
    const p = normalize({ ...raw, enabled: false });
    const list = loadPlugins(), same = list.find(x => x.id === p.id || (x.name === p.name && x.author === p.author));
    if (same) { p.id = same.id; p.enabled = same.enabled; p.approved = keepApproved(same, p.permissions); }
    savePlugins(same ? list.map(x => x.id === same.id ? p : x) : [...list, p]);
    sync(); paintList();
    toast(same ? `Updated “${p.name}” to ${p.version}.` : `Imported “${p.name}” (switched off: check its permissions, then turn it on).`, "success", 4000);
  } catch (err) { toast("Couldn't import: " + err.message, "error", 5000); }
};
$("urlBtn").onclick = async () => {
  const u = await promptDialog({ title: "Add a plugin from a web address", message: "Paste the link to a plugin file (.json). GitHub page links work too. Nothing runs until you review the permissions and switch it on.", input: { type: "url", placeholder: "https://…/my-plugin.json" }, okText: "Download" });
  if (!u || !String(u).trim()) return;
  try {
    const { plugin: p, url } = await fetchPluginFromUrl(u);
    const list = loadPlugins(), same = list.find(x => x.id === p.id || (x.name === p.name && x.author === p.author));
    const perms = p.permissions.length ? p.permissions.map(k => `• ${PERMISSIONS[k]?.label || k}  [${PERMISSIONS[k]?.risk} risk]`).join("\n") : "• none";
    const node = el("div", {}, ...(p.permissions.includes("unsandboxed") ? [dangerBox()] : []));
    const ok = await confirmDialog({ title: same ? `Update “${p.name}”?` : `Add “${p.name}”?`, node, message: `Version ${p.version}${p.author ? " by " + p.author : ""}\nFrom ${url}\n\nIt asks to:\n${perms}\n\nIt will be added switched off, and you review every permission again before it can run. Only continue if you trust the author.`, okText: same ? "Update" : "Add", danger: p.permissions.includes("unsandboxed") });
    if (!ok) return;
    if (same) { p.id = same.id; p.enabled = same.enabled; p.approved = keepApproved(same, p.permissions); }
    savePlugins(same ? list.map(x => x.id === same.id ? p : x) : [...list, p]);
    sync(); paintList(); toast(same ? `Updated “${p.name}” to ${p.version}.` : `Added “${p.name}” (switched off).`, "success", 4000);
  } catch (err) { toast(err.message, "error", 6000); }
};
$("updAll").onclick = async () => { for (const p of loadPlugins()) if (p.updateUrl) updates.set(p.id, await checkPluginUpdate(p)); paintList(); toast("Checked.", "success", 1500); };
$("verCheck").onclick = async () => { const r = await checkSiteVersion(); verLine(); toast(!r.ok ? "Couldn't reach the site to check (offline copy or no connection)." : r.newer ? "A new version is available: " + r.latest : "You're up to date.", r.ok ? "success" : "error", 3500); };
verLine(); paintList();
window.addEventListener("qm-plugin-settings", () => { if (!document.querySelector("dialog[open]")) paintList(); });
setInterval(() => {                                       // keep run states fresh, but never while you're reading or typing
  const pane = document.querySelector('[data-pane="plugins"]');
  if ((pane && pane.hidden) || document.querySelector("dialog[open]") || document.querySelector("details.plugin-perms[open]") || (editing !== null)) return;
  paintList();
}, 4000);
