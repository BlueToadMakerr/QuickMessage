// Plugin storage + compatibility checks, shared by the shell (js/plugins.js) and the Plugins page (js/plugins-page.js).
import { SITE_VERSION, API_VERSION, cmpVer, validVer } from "./version.js";

const KEY = "qm-plugins";
export const PERMISSIONS = {
  toast:    { label: "Show messages (toasts)", risk: "low" },
  style:    { label: "Change how the site looks (CSS)", risk: "low" },
  me:       { label: "Read your name and account id", risk: "medium" },
  chat:     { label: "Know which chat is open; put text in the message box", risk: "medium" },
  messages: { label: "Read the text of messages shown on your screen", risk: "high" },
  panel:    { label: "Show small panels and banners (including on the call screen)", risk: "low" },
  network:  { label: "Contact other websites (can send data out)", risk: "high" },
  page:     { label: "Control the page: read what is on screen, click, type, scroll, search the chat", risk: "high" },
  triggers: { label: "Add pop-up lists for special characters (/ @ # …) in the message box", risk: "low" },
  say:      { label: "Show its own messages in your chats (only you see them; nothing is sent)", risk: "medium" },
  beforeSend: { label: "Change your messages right before they are sent (or stop them)", risk: "high" },
  theme: { label: "Read and change your theme (light / dark, accent colour)", risk: "medium" },
  nav: { label: "Open pages, settings and chats for you", risk: "low" },
  people: { label: "See who is in the open chat", risk: "medium" },
  watchChatList: { label: "Know when you get a new chat or one disappears", risk: "low" },
  markRead: { label: "Mark your chats as read", risk: "medium" },
  watchMessages: { label: "Know when a new message arrives in any of your chats", risk: "medium" },
  typing: { label: "Know when people are typing in your chats", risk: "low" },
  unread: { label: "Know which chats are unread, and when that changes", risk: "low" },
  watchReads: { label: "Know when someone has read the chat you have open", risk: "low" },
  watchCalls: { label: "Know when someone is calling you", risk: "medium" },
  watchEdits: { label: "Know when messages in the open chat are edited", risk: "medium" },
  watchDeletes: { label: "Know when messages in the open chat are deleted", risk: "medium" },
  messageView: { label: "Change how messages look on screen (display only)", risk: "medium" },
  editOwn:  { label: "Edit your own messages", risk: "high" },
  deleteOwn: { label: "Delete your own messages (asks you each time)", risk: "high" },
  buttons:  { label: "Add buttons to the chat, chat list and call screens", risk: "low" },
  calls:    { label: "Know when you are in a call", risk: "medium" },
  devinfo:  { label: "Read developer info and add cards to developer views", risk: "medium" },
  send:      { label: "Send messages in the open chat for you", risk: "high" },
  clipboard: { label: "Copy text to the clipboard", risk: "medium" },
  notify:    { label: "Show notifications and vibrate", risk: "low" },
  keys:      { label: "Add keyboard shortcuts", risk: "low" },
  commands:  { label: "Add slash commands (/name) to the message box", risk: "low" },
  ui:        { label: "Open its own windows with forms, lists and buttons", risk: "low" },
  menu:      { label: "Add choices to the message menu (and receive the message you pick)", risk: "medium" },
  speech:    { label: "Speak text out loud", risk: "low" },
  sound:     { label: "Play short sounds", risk: "low" },
  badge:     { label: "Show a number on the app icon / tab title", risk: "low" },
  share:     { label: "Open the share sheet (or copy) with text it chooses", risk: "low" },
  download:  { label: "Save files to your device (you see the download)", risk: "medium" },
  files:     { label: "Ask you to pick a file and read it", risk: "medium" },
  links:     { label: "Ask to open a web link (you confirm each one)", risk: "medium" },
  unsandboxed: { label: "UNSANDBOXED: run with FULL access to this site, your account and your messages", risk: "critical" }
};
/** Permissions in groups, in the order they are listed in reviews and in the editor. */
export const PERM_GROUPS = [
  { id: "look", label: "Look & feel", hint: "Colours, buttons, windows, messages on screen", perms: ["style", "messageView", "panel", "buttons", "ui", "toast", "notify", "badge", "sound", "speech", "theme", "nav"] },
  { id: "read", label: "Reading your chats", hint: "What the plugin can see", perms: ["me", "chat", "messages", "people", "watchChatList", "watchMessages", "watchEdits", "watchDeletes", "typing", "unread", "watchReads", "watchCalls", "calls", "devinfo"] },
  { id: "write", label: "Writing & sending", hint: "Putting text in chats, editing or deleting your messages", perms: ["say", "markRead", "commands", "triggers", "keys", "menu", "send", "beforeSend", "editOwn", "deleteOwn"] },
  { id: "device", label: "Your device & sharing", hint: "Clipboard, files, links, downloads", perms: ["clipboard", "share", "download", "files", "links"] },
  { id: "power", label: "Network & control", hint: "Contacting other websites, controlling the page", perms: ["network", "page"] },
  { id: "danger", label: "Danger zone", hint: "Full access", perms: ["unsandboxed"] }
];
export const groupOf = k => (PERM_GROUPS.find(g => g.perms.includes(k)) || PERM_GROUPS[PERM_GROUPS.length - 1]).id;
const permRow = k => ({ key: k, label: PERMISSIONS[k].label, risk: PERMISSIONS[k].risk, info: PERM_INFO[k] || "" });
/** [{id, label, hint, risk, perms:[{key,label,risk,info}]}] for the given permission keys (empty groups left out). */
export function groupPermissions(keys) {
  const set = new Set(keys || []);
  const out = PERM_GROUPS.map(g => { const ks = g.perms.filter(k => set.has(k) && PERMISSIONS[k]); return { id: g.id, label: g.label, hint: g.hint, risk: riskOf(ks), perms: ks.map(permRow) }; }).filter(g => g.perms.length);
  const known = new Set(PERM_GROUPS.flatMap(g => g.perms)), rest = [...set].filter(k => PERMISSIONS[k] && !known.has(k));
  if (rest.length) out.push({ id: "other", label: "Other", hint: "", risk: riskOf(rest), perms: rest.map(permRow) });
  return out;
}

/** A plugin's own settings: the form it described (qm.settings.define) and the values you chose. Kept per plugin on this device. */
export const SETTINGS_TYPES = ["toggle", "text", "textarea", "number", "range", "select", "color"];
export function loadSchema(id) { try { const s = JSON.parse(localStorage.getItem("qm-pschema-" + id) || "null"); return s && Array.isArray(s.fields) && s.fields.length ? s : null; } catch (_) { return null; } }
export function saveSchema(id, schema) { try { schema ? localStorage.setItem("qm-pschema-" + id, JSON.stringify(schema)) : localStorage.removeItem("qm-pschema-" + id); } catch (_) { /* storage full */ } }
export function loadSettings(id) {
  const schema = loadSchema(id); let saved = {}; try { saved = JSON.parse(localStorage.getItem("qm-pset-" + id) || "{}") || {}; } catch (_) { /* ignore */ }
  const out = {}; for (const f of (schema ? schema.fields : [])) out[f.id] = f.id in saved ? saved[f.id] : f.default;
  return out;
}
export function saveSettings(id, values) { try { localStorage.setItem("qm-pset-" + id, JSON.stringify(values)); } catch (_) { /* storage full */ } }
export function clearPluginData(id) { for (const k of ["qm-pstore-", "qm-pschema-", "qm-pset-"]) { try { localStorage.removeItem(k + id); } catch (_) { /* ignore */ } } }
/** Cleans a settings form a plugin described (never trusts it). Throws a readable error. */
export function cleanSchema(o) {
  o = o && typeof o === "object" ? o : {};
  const has = v => v !== undefined && v !== "" && Number.isFinite(Number(v));
  const fields = (Array.isArray(o.fields) ? o.fields : []).slice(0, 30).map(f => {
    f = f && typeof f === "object" ? f : {}; const id = String(f.id || ""), type = String(f.type || "text");
    if (!/^\w{1,30}$/.test(id)) throw new Error("A settings field needs an id of letters, digits or _ (max 30).");
    if (!SETTINGS_TYPES.includes(type)) throw new Error("Settings field type must be one of " + SETTINGS_TYPES.join(", ") + ".");
    const c = { id, type, label: String(f.label || id).slice(0, 60), description: f.description ? String(f.description).slice(0, 200) : "" };
    if (type === "select") { c.options = (Array.isArray(f.options) ? f.options : []).slice(0, 30).map(x => typeof x === "object" && x ? { value: String(x.value ?? x.label ?? "").slice(0, 60), label: String(x.label ?? x.value ?? "").slice(0, 60) } : { value: String(x).slice(0, 60), label: String(x).slice(0, 60) }); if (!c.options.length) throw new Error("A select field needs options."); }
    if (type === "number" || type === "range") for (const k of ["min", "max", "step"]) if (has(f[k])) c[k] = Number(f[k]);
    if (type === "text" || type === "textarea") { if (f.placeholder) c.placeholder = String(f.placeholder).slice(0, 80); c.maxLength = Math.min(Number(f.maxLength) || 500, 2000); }
    const d = f.default;
    c.default = type === "toggle" ? !!d : type === "number" || type === "range" ? (has(d) ? Number(d) : (c.min ?? 0)) : type === "select" ? String(d ?? c.options[0].value) : type === "color" ? (/^#[0-9a-f]{6}$/i.test(String(d)) ? String(d) : "#4f46e5") : String(d ?? "").slice(0, c.maxLength);
    return c;
  });
  const ids = new Set(); for (const f of fields) { if (ids.has(f.id)) throw new Error("Two settings fields share the id " + f.id + "."); ids.add(f.id); }
  return { title: String(o.title || "").slice(0, 60), description: String(o.description || "").slice(0, 300), fields };
}
/** Checks a value for a field and returns the cleaned value (or throws). */
export function cleanSettingValue(f, v) {
  switch (f.type) {
    case "toggle": return !!v;
    case "number": case "range": { let n = Number(v); if (!Number.isFinite(n)) throw new Error(f.label + " must be a number."); if (f.min !== undefined) n = Math.max(f.min, n); if (f.max !== undefined) n = Math.min(f.max, n); return n; }
    case "select": if (!f.options.some(o => o.value === String(v))) throw new Error(f.label + ": not one of the choices."); return String(v);
    case "color": if (!/^#[0-9a-f]{6}$/i.test(String(v))) throw new Error(f.label + " must be a colour like #4f46e5."); return String(v);
    default: return String(v ?? "").slice(0, f.maxLength || 500);
  }
}

/** What each permission really allows, in plain words (shown when you review a plugin). */
export const PERM_INFO = {
  toast: "Pops up short messages at the bottom of the screen.",
  style: "Can restyle the whole site (colours, fonts, hide parts). It cannot read anything.",
  me: "Can see your display name and your account id (UID).",
  chat: "Knows which chat you have open and can put text into your message box (it cannot send it).",
  theme: "Can see whether you use light, dark or system, your accent colour and Midnight setting, and can change them. Changes stay (they are your real settings) until you change them back.",
  nav: "Can open a page, a settings tab or a chat for you (like tapping a QuickMessage link). It cannot start or join a call.",
  people: "Can see the names of the people in the chat you have open.",
  watchChatList: "Gets told when a chat is added to or removed from your chat list (which chat and its name).",
  markRead: "Can mark one of your chats, or all of them, as read. That also tells the other people you have read their messages.",
  watchMessages: "Gets told when a new message arrives in ANY of your chats, not just the open one: which chat, who sent it and when. It also gets the text only if it holds the \"messages\" permission too.",
  typing: "Gets told when someone starts or stops typing in any of your chats (which chat and who).",
  unread: "Can ask which chats are unread and is told when a chat becomes unread or is read. It sees chat names, not message text.",
  watchReads: "Gets told when someone reads the chat you have open (who and up to which message).",
  watchCalls: "Gets told when someone calls you (who and in which chat), including on the call screen of another device of yours.",
  watchEdits: "Gets told when someone edits a message in the chat you have open (who, which message, when). It also gets the old and new text only if it holds the \"messages\" permission too.",
  watchDeletes: "Gets told when a message in the chat you have open is deleted (which message, whose). It also gets the text it had only if it holds the \"messages\" permission too.",
  messages: "Can read the text of messages that are on your screen, including decrypted ones. This is as sensitive as shoulder-surfing.",
  panel: "Can show small panels and banners, also on the call screen.",
  network: "The plugin can contact any website. Combined with another permission it can send what it learned (messages, names) out of your device.",
  page: "Can read what is on screen, click buttons, type into fields and scroll for you. It can act as you inside the app.",
  buttons: "Can add buttons in the chat header, the chat list and the call screen.",
  calls: "Knows when you are in a call and with which chat.",
  devinfo: "Can read developer information and add cards to the developer views.",
  send: "Can send messages in the open chat as you, without asking each time.",
  clipboard: "Can put text on your clipboard (it can overwrite what you copied).",
  notify: "Can show system notifications and make your phone vibrate.",
  keys: "Can add keyboard shortcuts.",
  commands: "Can add slash commands to the message box and see what you type after the slash.",
  ui: "Can open its own windows with text, forms, lists and buttons (drawn by the site, so they match the theme).",
  menu: "Adds choices to every message's menu. When you pick one it receives that message (its text only if it also has the 'messages' permission).",
  speech: "Can read text aloud with your device's voice.",
  sound: "Can play short beeps and alert sounds.",
  badge: "Can show a count on the app icon or in the tab title.",
  share: "Can open your device's share sheet with text it chooses (you pick where it goes).",
  download: "Can save a file it creates to your device. Your browser shows the download.",
  files: "Can open a file picker. It only gets the one file you choose.",
  links: "Can ask to open a web link. Nothing opens until you confirm that exact address.",
  triggers: "Can add pop-up lists for special characters in the message box (like / @ #). You pick an entry and its text goes into the box; it sees what you typed after the character.",
  messageView: "Can change how messages LOOK on your screen (replace words, add text, hide or blur messages). The saved messages never change, and it cannot read them out.",
  editOwn: "Can edit the text of YOUR OWN messages in the open chat, for everyone in the chat, without asking each time.",
  deleteOwn: "Can delete YOUR OWN messages in the open chat for everyone. You are asked to confirm every time.",
  say: "Can drop messages into the open chat that only you see, always labelled with the plugin's name. Nothing is sent to anyone, and they disappear when you reload.",
  beforeSend: "Every message you send is shown to the plugin first, and it can rewrite it or cancel it. It can read everything you type to send (but not what you receive).",
  unsandboxed: "The plugin is NOT locked in its safe box any more. It runs inside the site itself with the same powers as the site: it can read your messages and keys, act as you, send messages, change settings, read what you type (including passwords) and contact any server. Extremely dangerous."
};
export const UNSANDBOXED_WARNING = "Having a plugin unsandboxed is EXTREMELY DANGEROUS. It runs with the full power of the site: it can read all your messages and encryption keys, send messages as you, read what you type (including passwords) and send everything to anyone. Do NOT run anything you do not trust completely with this permission, and never enable it because someone online asked you to.";
const RISK_RANK = { low: 0, medium: 1, high: 2, critical: 3 };
export const riskOf = perms => (perms || []).reduce((m, k) => (RISK_RANK[PERMISSIONS[k]?.risk] ?? 0) > RISK_RANK[m] ? PERMISSIONS[k].risk : m, "low");
/** [{key, label, risk, info}] for a list of permission keys, most dangerous first. */
export function describePermissions(perms) {
  return (perms || []).filter(k => PERMISSIONS[k]).map(k => ({ key: k, label: PERMISSIONS[k].label, risk: PERMISSIONS[k].risk, info: PERM_INFO[k] || "" }))
    .sort((a, b) => RISK_RANK[b.risk] - RISK_RANK[a.risk]);
}
/** Permissions the person has not reviewed yet. A plugin saved before reviewing existed (no `approved` list) counts as reviewed, except "unsandboxed", which always needs a deliberate yes. */
export function unreviewed(p) {
  const ok = Array.isArray(p.approved) ? p.approved : (p.permissions || []).filter(k => k !== "unsandboxed");
  return (p.permissions || []).filter(k => !ok.includes(k));
}
export const MAX_CODE = 200000;

export function loadPlugins() { try { const l = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(l) ? l : []; } catch (_) { return []; } }
export function savePlugins(list) { localStorage.setItem(KEY, JSON.stringify(list)); }
export const newPluginId = () => "p" + Math.random().toString(36).slice(2, 10);

/** Clean a plugin object (from the editor or an imported file); throws Error with a readable message. */
export function normalize(raw) {
  if (!raw || typeof raw !== "object") throw new Error("Not a plugin file.");
  const name = String(raw.name || "").trim().slice(0, 60);
  if (!name) throw new Error("A plugin needs a name.");
  const version = String(raw.version || "1.0.0").trim();
  if (!validVer(version)) throw new Error("Version must look like 1.0.0.");
  const code = String(raw.code || "");
  if (code.length > MAX_CODE) throw new Error("The code is too long (200,000 characters at most).");
  const apiVersion = Number.isInteger(raw.apiVersion) ? raw.apiVersion : API_VERSION;
  const minSite = raw.minSite ? String(raw.minSite).trim() : "";
  if (minSite && !validVer(minSite)) throw new Error("“Minimum site version” must look like 1.44.0.");
  const updateUrl = raw.updateUrl ? String(raw.updateUrl).trim() : "";
  if (updateUrl && !/^https:\/\//i.test(updateUrl)) throw new Error("The update address must start with https://");
  return {
    id: /^p[a-z0-9]{3,16}$/.test(raw.id || "") ? raw.id : newPluginId(),
    name, version, apiVersion, minSite, updateUrl,
    description: String(raw.description || "").slice(0, 300), author: String(raw.author || "").slice(0, 60),
    permissions: [...new Set((Array.isArray(raw.permissions) ? raw.permissions : []).filter(p => PERMISSIONS[p]))],
    code, enabled: raw.enabled === true, added: raw.added || Date.now(), approved: []
  };                                   // note: "approved" is never taken from a file; the Plugins page sets it after you review the permissions
}

/** Problems with a plugin on this site: [{level: "warn" | "error", text}]. Empty = fine. */
export function pluginIssues(p) {
  const out = [];
  if (p.apiVersion < API_VERSION) out.push({ level: "warn", text: `Outdated: written for plugin API v${p.apiVersion}; this site uses v${API_VERSION}. It may not work properly. Ask its author for an update (see "What changed" in the docs).` });
  if (p.apiVersion > API_VERSION) out.push({ level: "error", text: `Needs a newer site: it uses plugin API v${p.apiVersion}, this site has v${API_VERSION}. Update the site (or reload) to use it.` });
  if (p.minSite && cmpVer(p.minSite, SITE_VERSION) > 0) out.push({ level: "error", text: `Needs site version ${p.minSite} or newer; this site is ${SITE_VERSION}.` });
  return out;
}
export const isBlocked = p => pluginIssues(p).some(i => i.level === "error");

/** Looks for a newer copy of the plugin at its update address (JSON with {version, apiVersion?, minSite?, downloadUrl?}). */
export async function checkPluginUpdate(p) {
  if (!p.updateUrl) return { ok: true, none: true };
  try {
    const r = await fetch(p.updateUrl, { cache: "no-store" });
    const j = await r.json();
    if (!r.ok || !validVer(j.version)) throw new Error("Unexpected answer");
    return { ok: true, newer: cmpVer(j.version, p.version) > 0, latest: j.version, info: j };
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}

/** Turns what people paste (a GitHub page link, say) into the address of the plain file. */
export function directPluginUrl(u) {
  u = String(u || "").trim();
  let x; try { x = new URL(u); } catch (_) { throw new Error("That doesn't look like a web address."); }
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(x.hostname);
  if (x.protocol !== "https:" && !(x.protocol === "http:" && local)) throw new Error("The address must start with https://");
  const m = x.hostname === "github.com" && x.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
  if (m) return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`;
  return x.href;
}
/** Downloads a plugin file from a web address and checks it. It comes back switched OFF; the person reviews permissions first. */
export async function fetchPluginFromUrl(url) {
  const href = directPluginUrl(url);
  let r;
  try { r = await fetch(href, { cache: "no-store", credentials: "omit", redirect: "follow" }); }
  catch (_) { throw new Error("Couldn't download it. The site may be offline, or it doesn't allow other websites to read the file (GitHub raw links and jsDelivr work)."); }
  if (!r.ok) throw new Error("The site answered " + r.status + ".");
  const text = await r.text();
  if (text.length > MAX_CODE + 20000) throw new Error("That file is too big for a plugin.");
  let raw; try { raw = JSON.parse(text); } catch (_) { throw new Error("That isn't a plugin file (expected JSON exported from the Plugins page)."); }
  if (!raw || typeof raw !== "object") throw new Error("That isn't a plugin file.");
  const p = normalize({ ...raw, updateUrl: raw.updateUrl || href, enabled: false });
  return { plugin: p, url: href };
}
