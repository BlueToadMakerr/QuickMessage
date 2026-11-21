// Bot accounts: create / manage / add to a chat. The bot API itself lives in functions/bots.js (Firebase), server/qm_server.py (private server) and worker/botapi.py.
import { db } from "./firebase.js";
import { ref, get, set, update, remove, push } from "./sdk.js";
import { PRIVATE, privateBase } from "./mode.js";
import { activeDbUrl } from "./dburl.js";

const A = "abcdefghijklmnopqrstuvwxyz0123456789";
export const BOT_RE = /^bot_[a-z0-9]{12}$/;
export const isBotUid = u => typeof u === "string" && u.startsWith("bot_");

function randomChars(n, alphabet) {
  const out = [], lim = 256 - (256 % alphabet.length);
  while (out.length < n) for (const x of crypto.getRandomValues(new Uint8Array(32))) if (x < lim && out.length < n) out.push(alphabet[x % alphabet.length]);
  return out.join("");
}
export const newBotId = () => "bot_" + randomChars(12, A);
export function newToken(id) {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return `qmbot.${id}.` + btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export async function sha256Hex(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, "0")).join("");
}
/** Where bots connect. Private server: its HTTP address. Firebase: the database itself (bots write requests to botInbox, the worker answers). */
export function apiBase() {
  if (PRIVATE) return ((privateBase() || location.origin).replace(/\/+$/, "")) + "/api/bot";
  return activeDbUrl();
}
const cleanName = s => String(s || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 100);
const cleanPic = u => { u = String(u || "").trim(); if (!u) return ""; if (/^data:image\/\S+$/i.test(u) && u.length <= 30000) return u; return cleanUrl(u, 2000); };
const cleanUrl = (u, n) => { u = String(u || "").trim(); if (!u) return ""; if (!/^https:\/\/\S+$/i.test(u) || u.length > n) throw new Error("That must be an https:// address."); return u; };

/** Makes a bot and returns { id, token } (the token is shown once; only its hash is stored). */
export async function createBot(me, name, pfp) {
  name = cleanName(name); if (!name) throw new Error("Give the bot a name.");
  pfp = cleanPic(pfp);
  const id = newBotId(), token = newToken(id);
  await set(ref(db, `bots/${id}`), { owner: me, created: Date.now(), name, ...(pfp ? { pfp } : {}) });     // first: the rules for the rest look at the owner
  await set(ref(db, `botList/${me}/${id}`), true);
  await set(ref(db, `accsettings/${id}/settings`), { displayName: name, ...(pfp ? { pfp } : {}) });
  await set(ref(db, `botKeys/${id}`), { th: await sha256Hex(token), token });         // the rules compare the token in a bot's request with this one
  return { id, token };
}
export async function listBots(me) {
  const ids = Object.keys((await get(ref(db, `botList/${me}`))).val() || {});
  const out = await Promise.all(ids.map(async id => {
    const [b, k, j] = await Promise.all([get(ref(db, `bots/${id}`)), get(ref(db, `botKeys/${id}`)).catch(() => null), get(ref(db, `botJoin/${id}`)).catch(() => null)]);
    const jv = (j && j.val()) || {};
    return b.exists() ? { id, ...b.val(), webhook: (k && k.val() && k.val().webhook) || "", token: (k && k.val() && k.val().token) || "", joinOn: jv.on === true, joinSecret: jv.code || "" } : null;
  }));
  return out.filter(Boolean).sort((a, b) => (a.created || 0) - (b.created || 0));
}
export async function saveBot(id, { name, pfp, webhook }) {
  name = cleanName(name); if (!name) throw new Error("Give the bot a name.");
  pfp = cleanPic(pfp); webhook = cleanUrl(webhook, 300);
  await update(ref(db), { [`bots/${id}/name`]: name, [`bots/${id}/pfp`]: pfp || null, [`accsettings/${id}/settings/displayName`]: name, [`accsettings/${id}/settings/pfp`]: pfp || null, [`botKeys/${id}/webhook`]: webhook || null });
}
export async function regenerateToken(id) {
  const token = newToken(id);
  await update(ref(db, `botKeys/${id}`), { th: await sha256Hex(token), token });
  return token;
}
export async function deleteBot(me, id) {
  await remove(ref(db, `botKeys/${id}`)); await remove(ref(db, `botJoin/${id}`)); await remove(ref(db, `botPerms/${id}`)); await remove(ref(db, `accsettings/${id}`));
  await remove(ref(db, `botList/${me}/${id}`)); await remove(ref(db, `bots/${id}`));
}
/** Adds one of your bots to the chat. The rules only let the bot's owner do this. */
export async function addBotToChat(chatPath, chatId, id) {
  await update(ref(db, `${chatPath}/participants`), { [id]: true });
  await set(ref(db, `chatList/${id}/${chatId}`), true);
}

// ---- "Add this bot with a code": the owner switches it on, others type the code in a chat's Members section.
// The code people share is "<bot id>.<secret>"; only the secret is stored (botJoin/{id}), readable by the owner only.
export const JOIN_RE = /^[A-Za-z0-9_-]{6,40}$/;
export const newJoinSecret = () => randomChars(10, "ABCDEFGHJKLMNPQRSTUVWXYZ23456789");
export const joinCodeText = (id, secret) => `${id}.${secret}`;
/** Turns the add code on (making a code if there is none), off, or sets a code the owner chose (secret). Returns the stored state. */
export async function setJoin(id, { on, secret }) {
  const cur = (await get(ref(db, `botJoin/${id}`))).val() || {};
  let code = secret !== undefined ? String(secret).trim() : cur.code || newJoinSecret();
  if (!JOIN_RE.test(code)) throw new Error("A code needs 6 to 40 letters, numbers, - or _.");
  const next = { on: on === undefined ? cur.on === true : !!on, code };
  await set(ref(db, `botJoin/${id}`), next);
  return next;
}
/** Adds a bot to this chat using the code its owner gave out ("bot_xxxxxxxxxxxx.SECRET"). Returns the bot id. */
/** "bot_abc123def456.K7M2Q9XT3A" -> { id, secret }, or null when the text isn't a bot code. */
export function parseBotCode(text) {
  const m = /^\s*(bot_[a-z0-9]{12})[.:\s]+([A-Za-z0-9_-]{6,40})\s*$/.exec(String(text || ""));
  return m ? { id: m[1], secret: m[2] } : null;
}
export async function addBotByCode(chatPath, chatId, text) {
  const pc = parseBotCode(text);
  if (!pc) throw new Error("That isn't a bot code. It looks like bot_abc123def456.K7M2Q9XT3A");
  const { id, secret } = pc;
  if (!(await get(ref(db, `bots/${id}`))).exists()) throw new Error("No bot with that code.");
  try {
    await update(ref(db), { [`${chatPath}/participants/${id}`]: true, [`botJoinUse/${chatId}/${id}`]: secret });
  } catch (e) { throw new Error("That code didn't work. It may be wrong, or the bot's owner turned it off or changed it."); }
  await set(ref(db, `chatList/${id}/${chatId}`), true).catch(() => {});
  remove(ref(db, `botJoinUse/${chatId}/${id}`)).catch(() => {});
  return id;
}

/** Starts a new chat that has only you and the bot in it (its add code is needed unless the bot is yours). Returns the chat id. */
export async function newChatWithBot(me, text) {
  const pc = parseBotCode(text);
  if (!pc) throw new Error("That isn't a bot code.");
  const { id, secret } = pc, chatId = push(ref(db, "privateChats")).key;
  const chat = { participants: { [me]: true, [id]: true }, lastMessage: { fromUid: "", text: "(No messages yet)", timestamp: Date.now() } };
  const mine = (await get(ref(db, `bots/${id}/owner`))).val() === me;
  try { await update(ref(db), { [`privateChats/${chatId}`]: chat, ...(mine ? {} : { [`botJoinUse/${chatId}/${id}`]: secret }) }); }
  catch (e) { throw new Error("That code didn't work. It may be wrong, or the bot's owner turned it off or changed it."); }
  await update(ref(db), { [`chatList/${me}/${chatId}`]: true }).catch(() => {});
  await set(ref(db, `chatList/${id}/${chatId}`), true).catch(() => {});
  if (!mine) remove(ref(db, `botJoinUse/${chatId}/${id}`)).catch(() => {});
  return chatId;
}

// ---- What the owner lets the bot do through the bot API (everything here is off until switched on). Enforced by the bot API (botPerms/{id}).
export const BOT_PERMS = [
  { key: "createChats", label: "Start its own chats", info: "The bot can make new chats it is in (POST /createChat). On its own that only makes a chat with the bot alone; adding people needs the next switch." },
  { key: "addUsers", label: "Add people to chats", info: "The bot can add people to a chat it is in, by friend code, and name them when it makes a chat (POST /addUser). They are put in the chat without being asked. Not for end-to-end encrypted chats." },
  { key: "kickUsers", label: "Remove people from chats", info: "The bot can remove people from a chat it is in (POST /kick), except you (its owner) and itself. Not for end-to-end encrypted chats." }
];
export async function getBotPerms(id) { return (await get(ref(db, `botPerms/${id}`))).val() || {}; }
export async function setBotPerm(id, key, on) {
  if (!BOT_PERMS.some(p => p.key === key)) throw new Error("Unknown permission.");
  await update(ref(db, `botPerms/${id}`), { [key]: !!on });
}
