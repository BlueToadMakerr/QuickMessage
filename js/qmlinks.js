// qm links: a link to any place inside QuickMessage, drawn as a small button instead of a web address.
//
//   qm:page/plugin-docs            a page          (plugin-docs, bots, bot-docs, status)
//   qm:settings/advanced           a settings tab  (account, appearance, calls, privacy, data, plugins, advanced)
//   qm:chat/<chatId>               a chat
//   qm:message/<chatId>/<key>      one message in a chat
//   qm:call/<chatId>               the call of a chat
//
// Links to this site's own addresses (…/plugin-docs.html, …/account.html#tab=advanced, …/?chat=ID, …/message.html?chatId=ID#msg=KEY) count too.
// Nothing is stored in the database for this: a label comes from what is already on screen / remembered in this tab, and only when it
// isn't known the database is asked (one small read). A chat you can't read, or one that doesn't exist, shows as "Unknown chat".
// This file has no imports on purpose (ui.js uses it); the dialogs and the database are loaded when first needed.

/** Addresses of the main site. Links to it are left alone when shown, but turned into qm: tags when you send or paste them. */
export const KNOWN_HOSTS = ["msg.infinityfreeapp.com"];
export const PAGES = {
  "plugin-docs": ["Plugin docs", "plugin-docs.html"], bots: ["Bots", "bots.html"], "bot-docs": ["Bot docs", "bot-docs.html"], status: ["Status", "status.html"]
};
export const TABS = { account: "Account", appearance: "Appearance", calls: "Calls & notifications", privacy: "Privacy & security", data: "Data & storage", plugins: "Plugins", advanced: "Advanced" };
const ID = /^[\w-]{1,64}$/;
const KEYRE = /^[\w-]{1,64}$/;

export const link = {
  page: name => "qm:page/" + name,
  settings: tab => "qm:settings/" + tab,
  chat: id => "qm:chat/" + id,
  message: (chat, key) => "qm:message/" + chat + "/" + key,
  call: id => "qm:call/" + id
};

/** Reads one link (a qm: token or one of this site's own addresses). Returns {kind, ...} or null. */
export function parse(str, includeMainSite = false) {
  let s = String(str || "").trim();
  let m = /^qm:(page|settings|chat|message|call)\/([\w.-]+)(?:\/([\w-]+))?$/i.exec(s);
  if (m) {
    const k = m[1].toLowerCase(), a = m[2], b = m[3];
    if (k === "page") return a === "plugins" ? { kind: "settings", tab: "plugins" } : PAGES[a] ? { kind: "page", name: a } : null;
    if (k === "settings") return TABS[a] ? { kind: "settings", tab: a } : null;
    if (k === "chat") return ID.test(a) && !b ? { kind: "chat", chat: a } : null;
    if (k === "call") return ID.test(a) && !b ? { kind: "call", chat: a } : null;
    return ID.test(a) && b && KEYRE.test(b) ? { kind: "message", chat: a, key: b } : null;
  }
  if (!/^https?:\/\//i.test(s)) return null;
  let u; try { u = new URL(s); } catch (_) { return null; }
  if (u.origin !== location.origin && !(includeMainSite && KNOWN_HOSTS.includes(u.hostname))) return null;       // shown as a button: this copy only; main-site links stay as they were written
  const file = (u.pathname.split("/").pop() || "index.html").toLowerCase();
  const q = u.searchParams, hash = u.hash || "";
  if (file === "plugins.html") return { kind: "settings", tab: "plugins" };
  for (const [name, v] of Object.entries(PAGES)) if (v[1] === file) return { kind: "page", name };
  if (file === "account.html") { const t = q.get("tab") || (hash.match(/tab=(\w+)/) || [])[1] || "account"; return TABS[t] ? { kind: "settings", tab: t } : null; }
  const chat = q.get("chatId") || q.get("chat");
  if (chat && ID.test(chat) && (file === "message.html" || file === "index.html" || file === "")) {
    const key = q.get("msg") || (hash.match(/msg=([\w-]+)/) || [])[1];
    return key && KEYRE.test(key) ? { kind: "message", chat, key } : { kind: "chat", chat };
  }
  if (file === "call.html" && q.get("chatId") && ID.test(q.get("chatId"))) return { kind: "call", chat: q.get("chatId") };
  return null;
}
/** Text form of a parsed link. */
export const toText = p => !p ? "" : p.kind === "page" ? link.page(p.name) : p.kind === "settings" ? link.settings(p.tab) : p.kind === "chat" ? link.chat(p.chat) : p.kind === "call" ? link.call(p.chat) : link.message(p.chat, p.key);
/** Everything a "qm:…" token or address in a text could match (used by linkify). */
export const TOKEN = /(?:https?:\/\/|\bqm:(?:page|settings|chat|message|call)\/)[^\s<>]+/gi;

/** Text you paste or send: addresses of THIS copy or of the main site that point somewhere in QuickMessage become qm: tags (consistent, and they keep working if the site moves). */
export function convertOwn(text) {
  return String(text).replace(new RegExp(TOKEN.source, "gi"), m => {
    if (!/^https?:/i.test(m)) return m;
    const trail = (/[.,;:!?)\]]+$/.exec(m) || [""])[0], url = trail ? m.slice(0, -trail.length) : m;
    const p = parse(url, true); return p ? toText(p) + trail : m;
  });
}

// ---------------------------------------------------------------- finding out what a link points at
const mem = new Map();            // link text -> { label, sub, ok, at }
const TTL = 5 * 60 * 1000;
const sGet = k => { try { return JSON.parse(sessionStorage.getItem("qm-linkc") || "{}")[k] || null; } catch (_) { return null; } };
const sPut = (k, v) => { try { const o = JSON.parse(sessionStorage.getItem("qm-linkc") || "{}"); o[k] = v; const keys = Object.keys(o); if (keys.length > 80) for (const x of keys.slice(0, keys.length - 80)) delete o[x]; sessionStorage.setItem("qm-linkc", JSON.stringify(o)); } catch (_) { /* storage blocked */ } };
const topWin = () => { try { return window.top && window.top.document ? window.top : window; } catch (_) { return window; } };
const shellQM = () => { try { return window.QM || (window.parent !== window && window.parent.QM) || null; } catch (_) { return null; } };
const clip = (t, n = 48) => { t = String(t || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };

/** Chat title from what is on screen: the chat list (shell) or this very page. */
function chatFromScreen(id) {
  try {
    const el = topWin().document.querySelector('.chat-item[data-chat="' + id.replace(/"/g, "") + '"] .chat-title');
    if (el && el.textContent.trim()) return el.textContent.trim();
  } catch (_) { /* ignore */ }
  try {
    const here = new URLSearchParams(location.search).get("chatId");
    if (here === id) { const t = document.getElementById("chatTitle"); if (t && t.textContent.trim()) return t.textContent.trim(); }
  } catch (_) { /* ignore */ }
  return "";
}
async function chatFromDb(id) {
  const [{ auth, db }, sdk, users] = await Promise.all([import("./firebase.js"), import("./sdk.js"), import("./users.js")]);
  const me = auth.currentUser && auth.currentUser.uid; if (!me) return { ok: false, label: "Unknown chat", sub: "Sign in to see this" };
  let parts;
  try { parts = (await sdk.get(sdk.ref(db, `privateChats/${id}/participants`))).val(); } catch (_) { return { ok: false, label: "Unknown chat", sub: "You don't have access to this chat" }; }
  if (!parts || typeof parts !== "object") return { ok: false, label: "Unknown chat", sub: "This chat doesn't exist" };
  if (!parts[me]) return { ok: false, label: "Unknown chat", sub: "You don't have access to this chat" };
  let name = ""; try { name = (await sdk.get(sdk.ref(db, `privateChats/${id}/chatData/name`))).val() || ""; } catch (_) { /* ignore */ }
  if (!name) {
    const others = Object.keys(parts).filter(u => u !== me).slice(0, 4);
    const ps = await Promise.all(others.map(u => users.getProfile(u).catch(() => null)));
    name = ps.map(p => p && p.displayName).filter(Boolean).join(", ") || "Chat";
  }
  return { ok: true, label: name };
}
async function chatInfo(id) {
  const k = "chat/" + id, c = mem.get(k); if (c && Date.now() - c.at < TTL) return c;
  let r = null;
  const screen = chatFromScreen(id); if (screen) r = { ok: true, label: screen };
  if (!r) { const s = sGet(k); if (s && Date.now() - s.at < TTL) r = s; }
  if (!r) { try { r = await chatFromDb(id); } catch (_) { r = { ok: false, label: "Unknown chat", sub: "Couldn't check right now", soft: true }; } }
  r.at = Date.now(); if (!r.soft) { mem.set(k, r); sPut(k, r); }
  return r;
}
function messageFromScreen(chat, key) {
  try {
    if (new URLSearchParams(location.search).get("chatId") === chat && window.__qmMsgs) { const m = window.__qmMsgs().find(x => x.key === key); if (m) return m; }
  } catch (_) { /* ignore */ }
  try {                                           // the shell: the open chat's page
    const f = topWin().document.getElementById("detailFrame"), w = f && f.contentWindow;
    if (w && w.__qmMsgs && new URL(w.location.href).searchParams.get("chatId") === chat) { const m = w.__qmMsgs().find(x => x.key === key); if (m) return m; }
  } catch (_) { /* ignore */ }
  return null;
}
async function messageInfo(chat, key) {
  const k = "msg/" + chat + "/" + key, c = mem.get(k); if (c && Date.now() - c.at < TTL) return c;
  const ch = await chatInfo(chat);
  if (!ch.ok) return { ok: false, label: "Unknown chat", sub: ch.sub, chatName: "" };
  let r = null;
  const m = messageFromScreen(chat, key);
  if (m) r = { ok: true, label: m.text != null ? clip(m.text) : m.type === "text" ? "Message" : kindName(m.type), chatName: ch.label };
  if (!r) { const s = sGet(k); if (s && Date.now() - s.at < TTL) r = s; }
  if (!r) {
    try {
      const [{ db }, sdk] = await Promise.all([import("./firebase.js"), import("./sdk.js")]);
      const v = (await sdk.get(sdk.ref(db, `privateChats/${chat}/messages/${key}`))).val();
      if (!v) r = { ok: false, label: "Unknown message", sub: "This message doesn't exist (it may have been deleted)", chatName: ch.label };
      else if (v.enc || v._enc || (v.type === "text" && typeof v.text === "string" && /^[\w+/=:.-]{40,}$/.test(v.text) && v.enc)) r = { ok: true, label: "Encrypted message", chatName: ch.label };
      else r = { ok: true, label: v.type && v.type !== "text" ? kindName(v.type) : clip(v.text || v.content || "Message"), chatName: ch.label };
    } catch (_) { r = { ok: false, label: "Unknown message", sub: "Couldn't check right now", chatName: ch.label, soft: true }; }
  }
  r.at = Date.now(); if (!r.soft) { mem.set(k, r); sPut(k, r); }
  return r;
}
const kindName = t => ({ image: "Photo", video: "Video", audio: "Audio", file: "File" }[t] || "Message");

/** { icon, label, sub, ok } for a parsed link (static ones at once; chats / messages may ask the database). */
export async function resolve(p) {
  if (p.kind === "page") return { icon: "link", label: PAGES[p.name][0], ok: true };
  if (p.kind === "settings") return { icon: "link", label: "Settings → " + TABS[p.tab], ok: true };
  if (p.kind === "chat") { const r = await chatInfo(p.chat); return { icon: "chat", label: r.label, sub: r.sub, ok: r.ok }; }
  if (p.kind === "call") { const r = await chatInfo(p.chat); return { icon: "phone", label: r.ok ? "Call · " + r.label : "Unknown chat", sub: r.sub, ok: r.ok }; }
  const r = await messageInfo(p.chat, p.key);
  const here = (() => { try { return new URLSearchParams(location.search).get("chatId") === p.chat; } catch (_) { return false; } })();
  return { icon: "chat", label: r.ok && r.chatName && !here ? r.chatName + " › " + r.label : r.label, sub: r.sub, ok: r.ok };
}
const syncLabel = p => p.kind === "page" ? PAGES[p.name][0] : p.kind === "settings" ? "Settings → " + TABS[p.tab] : p.kind === "chat" ? "Chat" : p.kind === "call" ? "Call" : "Message";

// ---------------------------------------------------------------- going there
async function dialogs() { return import("./ui.js"); }
export async function open(p) {
  const QM = shellQM();
  if (p.kind === "page" || p.kind === "settings") {
    if (QM && QM.openPane) { p.kind === "page" ? QM.openPane("page", { page: PAGES[p.name][1] }) : QM.openPane("account", { tab: p.tab }); return; }
    const top = topWin(); top.location.href = p.kind === "page" ? PAGES[p.name][1] : "account.html#tab=" + p.tab; return;
  }
  const r = await resolve(p);
  if (!r.ok) {
    const ui = await dialogs();
    ui.alertDialog({ title: p.kind === "message" && r.label === "Unknown message" ? "Unknown message" : "Unknown chat", message: r.sub || "This link doesn't work: it points at something that doesn't exist, or that you can't open.", okText: "OK" });
    return;
  }
  if (QM) {
    if (p.kind === "message") QM.openChatAt(p.chat, p.key);
    else { QM.openChat(p.chat); if (p.kind === "call" && QM.openCall) QM.openCall(p.chat); }
    return;
  }
  topWin().location.href = "index.html?chat=" + encodeURIComponent(p.chat) + (p.kind === "message" ? "&msg=" + encodeURIComponent(p.key) : "");
}

// ---------------------------------------------------------------- the button
const ICON_PATHS = {
  link: '<path d="M10 13a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>'
};
const svg = n => '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICON_PATHS[n] || ICON_PATHS.link) + "</svg>";

/** A button for a link (text or parsed). Returns null when it isn't a qm link. */
export function chip(l) {
  const p = typeof l === "string" ? parse(l) : l; if (!p) return null;
  const b = document.createElement("button");
  b.type = "button"; b.className = "qm-chip"; b.dataset.qmlink = toText(p);
  b.innerHTML = svg(p.kind === "call" ? "phone" : p.kind === "chat" || p.kind === "message" ? "chat" : "link") + '<span class="qc-l"></span>';
  const lab = b.querySelector(".qc-l"); lab.textContent = syncLabel(p);
  b.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); open(p); });
  resolve(p).then(r => {
    lab.textContent = r.label; b.classList.toggle("bad", !r.ok); if (r.sub) b.title = r.sub; else b.title = toText(p);
    b.querySelector("svg").outerHTML = svg(r.ok ? r.icon : "link");
  }).catch(() => { /* keeps the plain label */ });
  return b;
}
