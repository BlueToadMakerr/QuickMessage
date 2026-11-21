import { hydrateIcons, toast, confirmDialog, copyText, avatarEl } from "./ui.js";
import { auth } from "./firebase.js";
import { onAuthStateChanged } from "./sdk.js";
import { wirePhotoUpload } from "./photo.js";
import { QM, markReady } from "./embed.js";
import { listBots, createBot, saveBot, regenerateToken, deleteBot, apiBase, setJoin, joinCodeText, newJoinSecret, BOT_PERMS, getBotPerms, setBotPerm } from "./bots.js";

hydrateIcons();
markReady();                                          // tell the app shell the page is up right away (a later error must never leave it on "loading")
const $ = id => document.getElementById(id);
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
let me = null, editing = null;                        // editing: bot id, "" for a new one

import("./mode.js").then(m => {
  $("apiUrl").textContent = apiBase();
  $("apiHow").textContent = m.PRIVATE
    ? "Your program sends requests to this address with the header Authorization: Bearer <token>."
    : "Database address. Your program writes its requests into the database (botInbox) with its token, and the worker answers (botOutbox) and passes on new messages (botEvents): nothing to open or expose. docs/bots/qmbot.py is a ready-made client.";
});

/** Shows a token once, with a copy button. Resolves when the person closes it. */
function showToken(title, id, token, again = false) {
  return new Promise(resolve => {
    const dlg = el("dialog", { className: "modal small" }), form = el("form", { method: "dialog" });
    const box = el("pre", { className: "dev-pre", textContent: token, style: "word-break:break-all;white-space:pre-wrap;user-select:all" });
    const copy = el("button", { type: "button", className: "btn", textContent: "Copy token" }); copy.onclick = async () => { await copyText(token); toast("Token copied.", "success", 1500); };
    form.append(el("h2", { textContent: title }),
      el("p", { className: "modal-text", textContent: `Bot id: ${id}\n\nThis is the bot's password. Anyone who has it can post as this bot and read the plain messages in its chats. Only you (its owner) can see it here. If it leaks, make a new one (the old one stops working at once).` }),
      box, el("div", { className: "modal-actions" }, copy, el("button", { type: "submit", className: "btn primary", textContent: "I saved it" })));
    dlg.append(form); document.body.append(dlg);
    dlg.addEventListener("close", () => { dlg.remove(); resolve(); });
    dlg.showModal();
  });
}

/** The gear next to a bot's name: what the owner lets this bot do through the bot API. Every switch is off until turned on. */
async function permDialog(b) {
  let cur = {}; try { cur = await getBotPerms(b.id); } catch (e) { return toast("Couldn't load: " + e.message, "error"); }
  const dlg = el("dialog", { className: "modal small" }), form = el("form", { method: "dialog" }), err = el("p", { className: "plugin-issue error", role: "alert" });
  form.append(el("h2", { textContent: `What “${b.name}” may do` }), el("p", { className: "modal-text", textContent: "These are the riskier things a bot can do through its token. They are all off until you turn them on, and you can turn them off again at any time. Posting messages, reading its own chats and leaving a chat are always allowed." }));
  for (const p of BOT_PERMS) {
    const box = el("input", { type: "checkbox", checked: cur[p.key] === true });
    box.onchange = async () => { err.textContent = ""; try { await setBotPerm(b.id, p.key, box.checked); } catch (e) { box.checked = !box.checked; err.textContent = e.message || "That didn't work."; } };
    form.append(el("label", { className: "switch-row" }, box, el("span", {}, el("strong", { textContent: p.label }), el("br"), el("small", { className: "muted", textContent: p.info }))));
  }
  form.append(err, el("div", { className: "modal-actions" }, el("button", { type: "submit", className: "btn primary", textContent: "Done" })));
  dlg.append(form); document.body.append(dlg); dlg.addEventListener("close", () => dlg.remove()); dlg.showModal();
}

/** "Let others add this bot": switch, code, new random code, your own code. Re-reads and repaints on every change. */
function joinDialog(b) {
  const dlg = el("dialog", { className: "modal small" }), form = el("form", { method: "dialog" });
  let st = { on: b.joinOn, secret: b.joinSecret };
  const status = el("p", { className: "modal-text" }), code = el("pre", { className: "dev-pre", style: "word-break:break-all;white-space:pre-wrap;user-select:all" });
  const own = el("input", { className: "field", placeholder: "Your own code (6–40 letters, numbers, - _)", maxLength: 40, autocomplete: "off" });
  const err = el("p", { className: "plugin-issue error", role: "alert" });
  const copy = el("button", { type: "button", className: "btn", textContent: "Copy code" });
  const toggle = el("button", { type: "button", className: "btn" }), fresh = el("button", { type: "button", className: "btn", textContent: "New random code" }), setOwn = el("button", { type: "button", className: "btn", textContent: "Use my code" });
  const draw = () => {
    status.textContent = st.on ? "On: anyone with this code can add this bot to a chat they are in (Members → Add a bot with its code). The old code stops working when you change it." : "Off: only you can add this bot to chats. Turn it on to get a code you can share.";
    code.textContent = st.on && st.secret ? joinCodeText(b.id, st.secret) : "(off)"; code.hidden = !st.on; copy.hidden = !st.on; fresh.hidden = setOwn.hidden = own.hidden = !st.on;
    toggle.textContent = st.on ? "Turn off" : "Turn on";
  };
  const run = async fn => { err.textContent = ""; try { st = await fn(); b.joinOn = st.on; b.joinSecret = st.code || st.secret; st = { on: st.on, secret: st.code || st.secret }; draw(); } catch (e) { err.textContent = e.message || "That didn't work."; } };
  toggle.onclick = () => run(() => setJoin(b.id, { on: !st.on }));
  fresh.onclick = () => run(() => setJoin(b.id, { on: true, secret: newJoinSecret() }));
  setOwn.onclick = () => run(() => setJoin(b.id, { on: true, secret: own.value }));
  copy.onclick = async () => { await copyText(code.textContent); toast("Code copied.", "success", 1500); };
  form.append(el("h2", { textContent: `Add “${b.name}” with a code` }), status, code, el("div", { className: "row wrap" }, toggle, copy, fresh), el("div", { className: "row" }, own, setOwn), err,
    el("div", { className: "modal-actions" }, el("button", { type: "submit", className: "btn primary", textContent: "Done" })));
  dlg.append(form); document.body.append(dlg); draw();
  dlg.addEventListener("close", () => { dlg.remove(); paint(); }); dlg.showModal();
}

async function paint() {
  const box = $("list"); box.replaceChildren();
  let bots = [];
  try { bots = await listBots(me); } catch (e) { box.append(el("p", { className: "plugin-issue error", textContent: "Couldn't load your bots: " + e.message })); }
  $("empty").hidden = bots.length > 0;
  for (const b of bots) {
    const row = el("div", { className: "plugin-row" });
    row.dataset.id = b.id;
    const head = el("div", { className: "row", style: "align-items:center;gap:.6rem" }, avatarEl(b.name, b.pfp || "", "avatar sm"),
      el("span", {}, el("strong", { textContent: b.name }), (() => { const g = el("button", { type: "button", className: "icon-btn", title: "What this bot may do", "aria-label": "Permissions for " + b.name, textContent: "⚙", style: "margin-left:.3rem" }); g.dataset.gear = b.id; g.onclick = () => permDialog(b); return g; })(), el("span", { className: "risk-badge", textContent: "BOT", style: "margin-left:.4rem" }), el("br"), el("small", { className: "muted", textContent: b.id + (b.webhook ? " · webhook on" : "") + (b.joinOn ? " · add code on" : "") })));
    row.append(head);
    const btns = el("div", { className: "row wrap", style: "margin-top:.4rem" });
    const add = (t, fn, cls = "") => { const x = el("button", { type: "button", className: "btn small " + cls, textContent: t }); x.onclick = fn; btns.append(x); };
    add("Copy id", async () => { await copyText(b.id); toast("Bot id copied.", "success", 1500); });
    if (b.token) add("Show token", () => showToken("Token", b.id, b.token, true));
    else row.append(el("div", { className: "plugin-issue warn", role: "alert", textContent: "This bot was made before bots talked through the database. Press “New token” to get a token that works." }));
    add("Add code", () => joinDialog(b));
    add("Edit", () => openEditor(b));
    add("New token", async () => {
      if (!await confirmDialog({ title: "Make a new token?", message: "The old token stops working immediately. Update your program with the new one.", okText: "Make new token", danger: true })) return;
      try { await showToken("New token", b.id, await regenerateToken(b.id)); } catch (e) { toast(e.message, "error"); }
    });
    add("Delete", async () => {
      if (!await confirmDialog({ title: "Delete this bot?", message: `“${b.name}” and its token are removed for good. Its old messages stay in the chats. (You may want to remove it from chats too.)`, okText: "Delete", danger: true })) return;
      try { await deleteBot(me, b.id); toast("Bot deleted.", "success", 1500); paint(); } catch (e) { toast("Couldn't delete: " + e.message, "error"); }
    }, "danger");
    row.append(btns); box.append(row);
  }
}
function openEditor(b) {
  editing = b ? b.id : "";
  $("edTitle").textContent = b ? "Edit bot" : "New bot";
  $("edName").value = b?.name || ""; $("edPfp").value = b?.pfp || ""; $("edHook").value = b?.webhook || ""; $("edErr").textContent = "";
  $("edHookRow").hidden = $("edHookHelp").hidden = !b;                 // a webhook is set after the bot exists
  $("editor").classList.remove("hidden"); $("editor").scrollIntoView({ block: "start" });
}
$("newBtn").onclick = () => openEditor(null);
$("edCancel").onclick = () => { $("editor").classList.add("hidden"); editing = null; };
$("edSave").onclick = async () => {
  $("edErr").textContent = "";
  try {
    if (editing) { await saveBot(editing, { name: $("edName").value, pfp: $("edPfp").value, webhook: $("edHook").value }); toast("Saved.", "success", 1500); }
    else {
      const r = await createBot(me, $("edName").value, $("edPfp").value);
      $("editor").classList.add("hidden"); editing = null; await paint();
      await showToken("Bot created", r.id, r.token); return;
    }
    $("editor").classList.add("hidden"); editing = null; paint();
  } catch (e) { $("edErr").textContent = e.message || "That didn't work."; }
};
onAuthStateChanged(auth, u => { me = u && u.uid; if (me) paint(); });

wirePhotoUpload(document.getElementById("edPfpUp"), document.getElementById("edPfpFile"), d => { document.getElementById("edPfp").value = d; toast("Photo ready. Save the bot to keep it.", "success", 2500); }, m => toast(m, "error"));
