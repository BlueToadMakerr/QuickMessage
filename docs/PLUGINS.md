# QuickMessage plugins

Plugins are small JavaScript programs you write (or import) to change how QuickMessage looks and behaves **on your own device**. They live in **Settings → Plugins**, work with Developer mode **off** (Developer mode only adds extras such as the plugin log), are stored in this browser only and never touch other people's devices.

This file is the source of the in-app page `plugin-docs.html` (regenerated with `python3 tools/build-docs.py`). The **Since** columns are the site version that introduced a permission, call or event: when your plugin uses one, set its `minSite` to the highest version it needs, so older copies of the site show a clear "update the site" message instead of failing.

## 1. Your first plugin in 60 seconds

1. Open **Settings → Plugins**.
2. Press **New plugin**, pick the **Hello (toast)** starting point, give it a name and press **Save**.
3. Switch the plugin on and approve its permissions. You see a toast "Hello from my plugin!".

```js
await qm.toast('Hello from my plugin! Site ' + qm.version, 'success');
qm.on('chat-open', () => qm.toast('You opened a chat'));
```

Your code is the body of an `async` function, so you can use `await` at the top level and `return` early. The variable `qm` is the only door to the site. The editor offers a dozen starting points (restyle the site, message counter, find a message, slash commands, notes window, message menu, quick replies, call banner…).

## 2. The Plugins tab

| Where | What |
|---|---|
| **Site version** card | Your site version and a check for a newer one. |
| **Your plugins** | One row per plugin with its on/off switch, status (running, crashed, outdated, blocked), a one-line permission summary (risk and groups), and buttons. |
| **⚙ Settings** | Only shown when the plugin describes its own settings (see `qm.settings`). Opens a form with Save and Reset to defaults. |
| **Permissions** | What it can do, in plain words, grouped (open / close each group, *Expand all* / *Collapse all*). |
| **Edit**, **Export**, **Delete**, **Check update** | Edit the code and permissions; save a `.qmplugin.json` file; remove the plugin together with its storage and settings; look for a newer version at its `updateUrl`. |
| **New plugin**, **Import file**, **Import from URL**, **Update all** | Add plugins. A new plugin always arrives **switched off** so you can read its permissions and code first. |
| **Log** | Only with Developer mode on: the last 100 lines of `qm.log` and errors. Hidden otherwise. |

### Permission review

When you switch a plugin on, or it asks for new permissions after an edit or an update, every permission is listed in plain words (most dangerous first, with a risk label) and the plugin stays **off until you approve**. Permissions are shown in groups: **Look & feel**, **Reading your chats**, **Writing & sending**, **Your device & sharing**, **Network & control**, **Danger zone**. Groups with high-risk entries start open. A plugin can read its own list with `qm.permissions.list()` and `qm.permissions.has(name)` (no permission needed).

## 3. How plugins run

- Each enabled plugin runs in its own hidden `<iframe sandbox="allow-scripts">`. Without `allow-same-origin` it cannot read the site, your login, your messages, cookies, localStorage, IndexedDB or Firebase.
- A Content-Security-Policy inside the frame blocks every network request unless the plugin declares the `network` permission (then only `https:`).
- Everything a plugin does goes through `qm.*` calls, which the site checks against the permissions you approved. A call without the permission fails with an error you can catch.
- A plugin that throws on start is marked **crashed** and its error is shown on the Plugins tab; other plugins and the site keep working. Errors in event handlers are caught and written to the log.
- Plugins run in the app shell, so they work on every page (chat list, chat, account, call). They don't run on a standalone page opened outside the shell.
- Plugins run whether or not Developer mode is on. Switch a plugin off to stop it; editing, switching off or deleting takes effect immediately.
- Sandboxing protects the site from a plugin, but a plugin you let read messages **and** contact other websites can send what it reads anywhere. Read code before enabling it.

### Unsandboxed plugins (extremely dangerous)

> ⛔ **Unsandboxed is EXTREMELY DANGEROUS.** The lock is removed and the plugin runs with the same power as the site itself: it can read all your messages and encryption keys, send messages as you, read what you type (including passwords), change settings and send everything to anyone. You must type `UNSANDBOXED` to allow it, and it asks again whenever the plugin changes its permissions. Never turn it on because someone online asked you to.

Inside the plugin `qm.permissions.sandboxed` is `false` and `qm.unsafe.window` / `qm.unsafe.document` reach the page. Prefer normal permissions whenever they are enough.

## 4. Permissions

Risk is what the review shows. **Since** is the site version that added it.

### Look & feel

| Permission | Risk | Allows | Since |
|---|---|---|---|
| `toast` | low | `qm.toast()` | 1.44.0 |
| `style` | low | `qm.style.set / clear / vars / sheet / removeSheet / get`: CSS injected into the site | 1.44.0 |
| `panel` | low | `qm.panel.*`, `qm.banner.*`, events `panel-button`, `banner-button` | 1.44.0 |
| `buttons` | low | `qm.buttons.*` and the `button` event: your own buttons in the chat header, chat list and call controls | 1.46.0 |
| `ui` | low | `qm.ui.*`: windows with forms, lists and buttons | 1.49.0 |
| `notify` | low | `qm.notify()` (system notification when the page is in the background, else a toast), `qm.vibrate()` | 1.48.0 |
| `speech` | low | `qm.speech.say(text, {rate, pitch, lang})`, `qm.speech.stop()` | 1.52.0 |
| `sound` | low | `qm.sound.play("beep"\|"success"\|"error"\|"alert")` | 1.52.0 |
| `badge` | low | `qm.badge.set(n)`, `qm.badge.clear()` (app icon badge and a number in the tab title) | 1.52.0 |
| `messageView` | medium | `qm.messageView.*`: change how messages look on screen (display only) | 1.82.0 |
| `theme` | medium | `qm.theme.get()` / `qm.theme.set({mode?, accent?, midnight?})`: read and change your real theme settings (they stay until changed back) | 1.87.2 |
| `nav` | low | `qm.nav.open(link)`: opens a page, settings tab, chat or message for you, like tapping a QuickMessage link (never a call or a website) | 1.87.2 |

### Reading your chats

| Permission | Risk | Allows | Since |
|---|---|---|---|
| `me` | medium | `qm.me()`: your account id and display name | 1.44.0 |
| `chat` | medium | `qm.chat.current / open / info / list / getText / setText / clearText / focus / insertText`, events `chat-open`, `chat-close` | 1.44.0 (open 1.46.0, rest 1.48.0) |
| `messages` | high | `qm.messages.list / find / get / jump` and the `message` event: text of messages shown on your screen (already decrypted for display; locked ones are `null`) | 1.44.0 (API 1.48.0) |
| `calls` | medium | `qm.calls.state()` and the `call-state` event | 1.46.0 |
| `devinfo` | medium | `qm.dev.*`: read developer info and add cards to the developer views; event `dev-view` | 1.46.0 |
| `watchEdits` | medium | event `message-edited` (open chat). Old and new text only with `messages` too | 1.85.0 |
| `watchDeletes` | medium | event `message-deleted` (open chat). The text only with `messages` too | 1.85.0 |
| `people` | medium | `qm.people.list()`: names of the people in the open chat | 1.87.2 |
| `watchChatList` | low | events `chat-added`, `chat-removed`: your chat list gained or lost a chat | 1.87.2 |
| `watchMessages` | medium | event `chat-message`: a new message in **any** of your chats (no extra database reads). Text only with `messages` too | 1.86.0 |
| `typing` | low | event `typing`: someone started / stopped typing in any chat | 1.86.0 |
| `unread` | low | `qm.chats.unread()` and event `unread-change` (chat names only, no text) | 1.86.0 |
| `watchReads` | low | event `message-read`: someone read the chat you have open | 1.86.0 |
| `watchCalls` | medium | event `incoming-call`: someone is calling you | 1.86.0 |

### Writing & sending

| Permission | Risk | Allows | Since |
|---|---|---|---|
| `commands` | low | `qm.commands.*` and the `command` event: slash commands in the message box | 1.48.0 |
| `keys` | low | `qm.keys.*` and the `key` event: keyboard shortcuts (they need ctrl, alt or meta, so typing is never hijacked) | 1.48.0 |
| `menu` | medium | `qm.messageMenu.*`: extra choices in the message menu | 1.49.0 |
| `triggers` | low | `qm.triggers.*` and event `trigger-pick`: pop-up lists for special characters in the message box | 1.82.0 |
| `send` | high | `qm.chat.send()`, `qm.messages.reply()`: sends in the open chat as you (5 per 10 seconds; a small notice says the plugin sent it) | 1.48.0 |
| `addMembers` | high | `qm.chat.addUser(friendCodeOrEmail)`, `qm.chat.addBot(botIdOrCode)`, `qm.chat.myBots()`: ask to add a person or a bot to the open chat. You are asked to confirm every add, naming the plugin | 1.88.0 |
| `editOwn` | high | `qm.messages.edit(key, text)` on your own messages | 1.82.0 |
| `deleteOwn` | high | `qm.messages.delete(key)` on your own messages (you confirm each time) | 1.82.0 |
| `markRead` | medium | `qm.chats.markRead(chatId)`, `qm.chats.markAllRead()`: mark chats as read (the other people see you read them) | 1.87.2 |
| `say` | medium | `qm.messages.say(text)`: a message from the plugin that only **you** see (never sent or saved) | 1.84.0 |
| `beforeSend` | high | `qm.beforeSend(fn)`: your message passes through the plugin before it is sent (rewrite or cancel) | 1.84.0 |

### Your device & sharing

| Permission | Risk | Allows | Since |
|---|---|---|---|
| `clipboard` | medium | `qm.clipboard.write()` | 1.48.0 |
| `share` | low | `qm.share(text)`: share sheet, or copies the text when sharing isn't available | 1.52.0 |
| `download` | medium | `qm.download.save(name, text\|object, mimeType)`: asks you first, 5 MB at most | 1.52.0 |
| `files` | medium | `qm.files.pick({accept})`: you choose one file (2 MB at most); returns `{name, size, type, text \| base64}` or `null` | 1.52.0 |
| `links` | medium | `qm.links.open(url)`: https only, you confirm each address | 1.52.0 |

### Network & control

| Permission | Risk | Allows | Since |
|---|---|---|---|
| `network` | high | `qm.fetch` / `fetch` to https websites (the site must allow it with CORS) | 1.44.0 |
| `page` | high | `qm.page.*`: read what's on screen, click, type, scroll, search the chat; event `page-load`. It can read message text, so treat it like `messages` | 1.46.0 |

### Danger zone

| Permission | Risk | Allows | Since |
|---|---|---|---|
| `unsandboxed` | critical | See the warning above. `qm.unsafe = {window, document}` is the real page | 1.52.0 |

**No permission needed:** `qm.storage.*`, `qm.log`, `qm.on / off`, `qm.sleep`, `qm.every / after / now`, `qm.util.*`, `qm.bus.*`, `qm.app.info`, `qm.plugins.list`, `qm.permissions`, `qm.settings.*`, `qm.version`, `qm.apiVersion`. `qm.ask` needs any one of `panel`, `buttons`, `toast`.

## 5. The `qm` API

Every method that talks to the site returns a Promise. **Needs** names the permission; **Since** is the site version.

### Basics

| Call | Returns | Needs | Since | Details |
|---|---|---|---|---|
| `qm.version` / `qm.apiVersion` | string / number | none | 1.44.0 | Site version (e.g. `"1.86.1"`) and plugin API number (currently 1). |
| `qm.on(event, fn)` / `qm.off(event, fn)` | function | none | 1.44.0 | Subscribe (returns an unsubscribe function). See Events. |
| `qm.log(...args)` | | none | 1.44.0 | Writes to the plugin log (Developer mode) and the browser console. |
| `qm.storage.get / set / remove / all` | any / null | none | 1.44.0 | Per-plugin storage in this browser (JSON values, 100 KB in total). `set` throws when full. Deleted with the plugin. |
| `qm.storage.keys() / clear() / usage()` | | none | 1.48.0 | The keys, wipe, and `{bytes, limit}`. |
| `qm.sleep(ms)` | | none | 1.46.0 | Waits (60 s at most). |
| `qm.every(ms, fn)` / `qm.after(ms, fn)` | function | none | 1.48.0 | Repeat (200 ms minimum) / run once later. Return a function that cancels; stopped for you when the plugin is switched off. |
| `qm.now()` | number | none | 1.48.0 | `Date.now()`. |
| `qm.util.debounce / throttle / uid / clamp / fmtBytes / fmtTime / fmtDuration` | | none | 1.48.0 | Small helpers: `fmtBytes(1536)` is `"1.5 KB"`, `fmtDuration(65000)` is `"1:05"`. |
| `qm.bus.emit(topic, data)` / `qm.bus.on(topic, fn)` | number | none | 1.48.0 | Plugins talk to each other: `emit` sends (20 KB at most) to every other running plugin and returns how many got it; `on` calls `fn(data, fromPluginName)`. |
| `qm.app.info()` | `{site, api, platform, online, dark, language, chatId?}` | none (`chatId` needs `chat`) | 1.48.0 | `platform` is `"web"`, `"android"` or `"ios"`. |
| `qm.plugins.list()` | array | none | 1.48.0 | `{id, name, version, state}` of the running plugins. |
| `qm.permissions.list() / has(name) / sandboxed` | | none | 1.52.0 | Your own permissions. |
| `qm.toast(text, kind?)` | | `toast` | 1.44.0 | `kind`: `"info"` (default), `"success"`, `"error"`. Cut at 200 characters, prefixed with the plugin name. |
| `qm.me()` | `{uid, displayName}` | `me` | 1.44.0 | |
| `qm.fetch(url, init?)` | Response | `network` | 1.44.0 | The normal `fetch`; subject to CORS. |
| `qm.ask(title, placeholder?)` | string / null | `panel`, `buttons` or `toast` | 1.46.0 | A question box labelled with your plugin's name; `null` when cancelled. |

### Your own settings (no permission)

`qm.settings.define({title, description, fields})` describes a form. The plugin then gets a **⚙ Settings** button on the Plugins tab (Save, Reset to defaults). Call it every time the plugin starts; defining nothing removes the button.

| Call | Since | Details |
|---|---|---|
| `qm.settings.define({title?, description?, fields})` | 1.84.0 | Each field is `{id, type, label, default, description?}`. `type`: `toggle`, `text`, `textarea`, `number`, `range` (with `min`, `max`, `step`), `select` (with `options: [{value, label}]`) or `color`. |
| `qm.settings.get(id?)` | 1.84.0 | All values (an object) or one. Missing values fall back to the field's `default`. |
| `qm.settings.set(id, value)` | 1.84.0 | Change one value from code. It is checked against the field (range, options, length). |
| event `settings-change` | 1.84.0 | `{values}` after the person saves the form. |

### Chat (needs `chat`; sending needs `send`; adding people needs `addMembers`)

| Call | Needs | Since | Details |
|---|---|---|---|
| `qm.chat.current()` | `chat` | 1.44.0 | `{chatId}` or `null`. |
| `qm.chat.insertText(text)` | `chat` | 1.44.0 | Appends to the message box (2,000 characters at most). Never sends: the person still presses Send. Throws if no chat is open. |
| `qm.chat.open(chatId)` | `chat` | 1.46.0 | Opens that chat. |
| `qm.chat.getText() / setText(t) / clearText() / focus()` | `chat` | 1.48.0 | Read, replace, clear the message box, or put the cursor in it. |
| `qm.chat.list()` | `chat` | 1.48.0 | `[{id, title, unread}]` (plus `preview` if you also have `messages`). |
| `qm.chat.info()` | `chat` | 1.48.0 | `{chatId, title}` of the open chat. |
| `qm.chat.send(text, {replyTo?})` | `send` | 1.48.0 | Sends like pressing Send (mentions and replies work). 5 per 10 seconds. Returns a boolean. |
| `qm.chat.addUser(who)` | `addMembers` | 1.88.0 | `who` is a friend code (`QM-…`) or an email. Shows you a confirmation naming the plugin; resolves `true` if you accepted and they were added, `false` if you declined; rejects if they are already in, don't exist, or your email isn't verified. |
| `qm.chat.addBot(what)` | `addMembers` | 1.88.0 | `what` is one of **your** bot ids (`bot_…`) or a bot's add code (`bot_….SECRET`, see the bot docs). Confirmation first; `true` / `false` as above. A code only works while the bot's owner has it on. |
| `qm.chat.myBots()` | `addMembers` | 1.88.0 | `[{id, name, inChat}]`: only the bots you own. |
| `qm.chats.unread()` | `unread` | 1.86.0 | `[{id, title}]` of the chats that are unread right now. |
| `qm.chats.markRead(chatId)` | `markRead` | 1.87.2 | Sets your read marker to the chat's newest message; `true` when it worked. |
| `qm.chats.markAllRead()` | `markRead` | 1.87.2 | Marks every unread chat as read; returns how many. |
| `qm.people.list()` | `people` | 1.87.2 | `[{uid, name, you}]` for the open chat (waits up to 3 s while the chat loads). |
| `qm.theme.get()` | `theme` | 1.87.2 | `{mode: "system"\|"light"\|"dark", dark, accent, midnight, material, colors}`. |
| `qm.theme.set({mode?, accent?, midnight?})` | `theme` | 1.87.2 | `mode` as above, `accent` like `"#e11d48"` (or `""` for the default), `midnight` true/false. Changes the real settings at once, everywhere. |
| `qm.nav.open(link)` | `nav` | 1.87.2 | `link`: `"qm:chat/ID"`, `"qm:message/CHAT/KEY"`, `"qm:settings/appearance"`, `"qm:page/NAME"`. Rejects anything else (calls, websites). |

### Messages (needs `messages`: the messages loaded in the open chat)

| Call | Needs | Since | Details |
|---|---|---|---|
| `qm.messages.list({limit?, text?, regex?, type?, fromMe?})` | `messages` | 1.48.0 | `{key, fromMe, from, text, type, name?, time, replyTo, edited, pending}`, oldest first (the last `limit`, default 50). `text` is `null` for files and locked messages. |
| `qm.messages.find({...})` / `qm.messages.get(key)` | `messages` | 1.48.0 | Filter the loaded messages / one message. |
| `qm.messages.jump(key)` | `messages` | 1.48.0 | Scrolls to the message and flashes it (`false` if not loaded: use `qm.page.scrollUntil` first). |
| `qm.messages.reply(key, text)` | `send` | 1.48.0 | Replies to a message. |
| `qm.messages.edit(key, text)` | `editOwn` | 1.82.0 | Edits one of your own text messages in the open chat, for everyone, without asking. |
| `qm.messages.delete(key)` | `deleteOwn` | 1.82.0 | Deletes one of your own messages for everyone. The person confirms each time (rejects if declined). |
| `qm.messages.say(text)` | `say` | 1.84.0 | Adds a local-only message (marked as coming from the plugin) to the open chat. Never sent or saved. |
| `qm.beforeSend(async (text, {chatId}) => …)` | `beforeSend` | 1.84.0 | Runs every time you send a **text** message. Return a string to send that instead, `null` (or `false`) to cancel, or nothing to send it unchanged. If the plugin takes longer than 1 second or throws, the message is sent as typed. Several plugins run one after another. Slash commands and `qm.chat.send` are not passed through it. |

### Look and feel

| Call | Needs | Since | Details |
|---|---|---|---|
| `qm.style.set(css)` / `qm.style.clear()` | `style` | 1.44.0 | Replaces this plugin's CSS (50,000 characters at most), applied to the shell and every frame and re-applied when a frame reloads. Plain CSS, no `<style>` tags. |
| `qm.style.vars({"--accent": "#e11d48"})` | `style` | 1.48.0 | Sets CSS variables (replaces your previous set; values can't contain `; { } < > \`). |
| `qm.style.sheet(id, css)` / `removeSheet(id)` / `get()` | `style` | 1.48.0 | Up to 10 named stylesheets besides `qm.style.set`. |
| `qm.panel.set({title, lines, buttons, progress?})` / `qm.panel.hide()` | `panel` | 1.44.0 | A floating card (bottom right). Up to 30 lines of plain text, 8 buttons (event `panel-button`); `progress` (0 to 1) adds a bar. |
| `qm.banner.show({text, kind?, where?, buttons?, dismiss?})` / `hide({where?})` / `clear()` | `panel` | 1.48.0 (`where` 1.49.0) | A bar at the top (`kind`: info, success, error; up to 3 buttons, which fire `banner-button`). |
| `qm.buttons.add({id, label, where?, title?})` / `remove(id)` / `clear()` | `buttons` | 1.46.0 | `where`: `"chat"`, `"list"` or `"call"`. Up to 6 per plugin; they come back by themselves when a page is replaced. A press fires `button`. |
| `qm.ui.open({id?, title, size?, blocks, dismiss?})` / `update(id, patch)` / `close(id)` / `list()` | `ui` | 1.49.0 | A window drawn from blocks: heading, text, kv, badge, input, toggle, select, progress, list, image, button, buttons, divider. Give inputs an `id` to receive values in `ui-action`. Up to 4 windows. `reset: true` clears what was typed on redraw. |
| `qm.ui.confirm({title, message, ok?, danger?})` / `prompt({title, message, value?})` | `ui` | 1.49.0 | The site's own dialogs; resolve to true/false or text/null. |
| `qm.messageMenu.add({id, label, icon?, mine?, textOnly?, danger?})` / `remove / clear / list` | `menu` | 1.49.0 | Adds a choice to every message's menu (8 at most); picking it fires `menu-click`. |
| `qm.messageView.add({id, match?, replace?, prefix?, suffix?, className?, hide?, blur?})` / `remove / clear / list` | `messageView` | 1.82.0 | Changes how a message is drawn; the stored message, what others see and what "Copy" copies stay the same. `match`: `{fromMe?, type?, text?, regex?, flags?}`. `replace`: up to 6 of `{find, with, flags?, regex?}` (`with` may use `$1`). `className` adds `qmx-NAME`; `hide`, `blur` (until hovered). 10 rules per plugin. |
| `qm.notify(title, body?)` / `qm.vibrate(ms \| [ms, …])` | `notify` | 1.48.0 | `notify` returns `"system"` or `"toast"`. |
| `qm.speech.say / stop`, `qm.sound.play`, `qm.badge.set / clear` | `speech`, `sound`, `badge` | 1.52.0 | See the permission table. |

### Commands, shortcuts and pop-up lists

| Call | Needs | Since | Details |
|---|---|---|---|
| `qm.commands.add({name, description?})` / `remove(name)` / `clear()` / `list()` | `commands` | 1.48.0 | When someone sends `/name some words`, nothing is sent and the plugin gets `command` `{name, args, chatId}`. Names: letters, numbers, `-` `_`; up to 10; a name belongs to one plugin. They also appear in the `/` list. |
| `qm.keys.add({id, combo, label?})` / `remove / clear / list` | `keys` | 1.48.0 | `combo` like `"ctrl+shift+k"` or `"alt+1"` (ctrl, alt or meta required, or an F key; browser shortcuts like ctrl+c are refused). Fires `key` `{id, combo}`. Up to 10; works in the chat list, chats and the call page. |
| `qm.triggers.add({char, id?, title?, items})` / `remove(id)` / `clear()` / `list()` | `triggers` | 1.82.0 | When the person types `char` (at the start or after a space) a list opens under the message box. `items` is an array of `"text"` or `{label, sub?, icon?, value?, insert?}`, or a function `(query, char) => items` (may be async; answer within 0.6 s). Picking puts `insert` (default: the character + value/label + a space) in the box; `insert: ""` only removes what was typed. Then `trigger-pick` fires. When several plugins (or the site: *Default*) use one character, each is listed under its own name. 6 lists per plugin. Characters: `/ @ # ! $ % & * + = ~ ; : < > ? ^ \|`. |

### Your device and sharing

| Call | Needs | Since | Details |
|---|---|---|---|
| `qm.clipboard.write(text)` | `clipboard` | 1.48.0 | Returns a boolean; the browser may refuse when the page isn't in front. |
| `qm.share(text)` | `share` | 1.52.0 | |
| `qm.download.save(name, data, mimeType?)` | `download` | 1.52.0 | |
| `qm.files.pick({accept?})` | `files` | 1.52.0 | |
| `qm.links.open(url)` | `links` | 1.52.0 | |

### Calls and developer info

| Call | Needs | Since | Details |
|---|---|---|---|
| `qm.calls.state()` | `calls` | 1.46.0 | `{chatId, joined, visible, muted, camOn, screenOn, startedAt, title}` (`joined: false` when none). |
| `qm.dev.addCard(scope, {id, title, rows})` / `removeCard(id)` | `devinfo` | 1.46.0 | `scope`: `"app"`, `"chat"`, `"message"` or `"call"`. `rows`: `[label, value, tone?]` with tone `ok`, `warn`, `bad`, `info`; up to 40 rows, 8 cards per plugin. Update it on `dev-view`. |
| `qm.dev.read(scope)` | `devinfo` | 1.46.0 | `"env"`, `"state"` or `"call"` (throws when no call is running). 200 KB cap. |

### Page control (needs `page`)

`frame` is `"detail"` (the open chat or account page, default), `"call"` or `"shell"` (the chat list).

| Call | Since | Details |
|---|---|---|
| `qm.page.query(selector, {text?, limit?, frame?})` | 1.46.0 | Elements matching a CSS selector: `{index, tag, text, attrs, visible, rect}`. Password values are never returned. In a chat, `.msg` is a message and `#messages` the list. |
| `qm.page.click(selector, {index?, text?, frame?})` | 1.46.0 | Clicks the element; throws if nothing matches. |
| `qm.page.type(selector, text, {index?, frame?})` | 1.46.0 | Sets a text box (not password fields) and fires `input` / `change`. The chat's box is `#msgInput`. It doesn't send. |
| `qm.page.scroll({to?, by?, scroller?, frame?})` | 1.46.0 | `to`: `"top"`, `"bottom"`, pixels or a selector. Returns `{top, height, view}`. |
| `qm.page.scrollUntil({text? \| regex?, selector?, direction?, maxMs?, scroller?, frame?})` | 1.46.0 | Keeps scrolling and loading older messages until something matches, then flashes it. Stops at the end, after `maxMs` (default 30 s, max 120 s) or when the person presses Stop. |
| `qm.page.cancel() / highlight(selector, opts?) / url(opts?)` | 1.46.0 | Stop a search; flash an element; the path of the page. |
| `qm.page.waitFor(selector, {timeout?, text?, frame?})` | 1.48.0 | Waits (30 s at most, default 5 s). |
| `qm.page.text / attr / count / focus / press / select / check / hide / show / title` | 1.48.0 | Small page helpers; `hide` is undone when the plugin stops, `title` is restored. |

## 6. Events

Handlers get one object. Errors in a handler are caught and written to the log.

| Event | Needs | Since | Data |
|---|---|---|---|
| `chat-open` / `chat-close` | `chat` | 1.44.0 | `{chatId}` |
| `message` | `messages` | 1.44.0 | `{chatId, key, fromMe, text, type, time}` for every message drawn in an open chat (history included). `text` is `null` for files and undecryptable messages. |
| `panel-button` | `panel` | 1.44.0 | `{label}` |
| `button` | `buttons` | 1.46.0 | `{id, where}` |
| `call-state` | `calls` | 1.46.0 | Same object as `qm.calls.state()` when it changes. |
| `dev-view` | `devinfo` | 1.46.0 | `{scope}`: a developer view was opened or refreshed. |
| `page-load` | `page` | 1.46.0 | `{frame}` |
| `command` | `commands` | 1.48.0 | `{name, args, chatId}` |
| `key` | `keys` | 1.48.0 | `{id, combo}` |
| `banner-button` | `panel` | 1.48.0 | `{label}` |
| `bus` | none | 1.48.0 | `{topic, data, from}` |
| `online` / `offline`, `visibility`, `theme-change` | none | 1.48.0 | `{}`, `{visible}`, `{dark}` |
| `ui-action` / `ui-close` | `ui` | 1.49.0 | `{window, id, value, values}` / `{window, reason}` |
| `menu-click` | `menu` | 1.49.0 | `{id, message}`; `message.text` only with `messages` too. |
| `trigger-pick` | `triggers` | 1.82.0 | `{id, char, label, value, chatId}` |
| `settings-change` | none | 1.84.0 | `{values}` |
| `chat-added` / `chat-removed` | `watchChatList` | 1.87.2 | `{chatId, title}` when a chat joins or leaves your list (not for the chats loaded at start). |
| `message-edited` | `watchEdits` | 1.85.0 | `{chatId, key, fromMe, type, time, editedAt, text, oldText}` for the open chat. `text` / `oldText` are `null` without `messages`. |
| `message-deleted` | `watchDeletes` | 1.85.0 | `{chatId, key, fromMe, type, time, text}`; only messages already shown. `text` is the last text seen, only with `messages`. |
| `chat-message` | `watchMessages` | 1.86.0 | `{chatId, title, key, fromMe, fromName, type, time, text}` for a new message in any chat (not the history at start). `text` is `null` without `messages`. |
| `typing` | `typing` | 1.86.0 | `{chatId, title, typing, count, names}` whenever who is typing in a chat changes (`typing: false` when nobody). |
| `unread-change` | `unread` | 1.86.0 | `{chatId, title, unread, total}` (`total` = unread chats now). |
| `message-read` | `watchReads` | 1.86.0 | `{chatId, uid, name, key}` when someone else's read marker moves in the open chat. |
| `incoming-call` | `watchCalls` | 1.86.0 | `{chatId, chatName, fromName, self}` (`self`: your own other device). |

## 7. Styling

The site uses CSS variables for colours, so many looks need only a few lines: `--accent`, `--bg`, `--card`, `--text`, `--border`. Open Developer mode's `{ }` buttons or the browser inspector to find class names (`.msg`, `.bubble`, `.chat-row`, `.topbar`…). Class names are not a stable API: use `minSite` and test after updates. Links to places inside QuickMessage (`qm:chat/ID`, `qm:settings/advanced`…) are typed with `#` in the message box and shown as small buttons.

## 8. Examples

### Settings and a before-send filter

Permissions: `beforeSend`, `say`. (1.84.0)

```js
await qm.settings.define({ title: "Politeness", fields: [
  { id: "on", type: "toggle", label: "Add a greeting", default: true },
  { id: "greeting", type: "text", label: "Greeting", default: "Hey! " } ] });
let cfg = await qm.settings.get();
qm.on("settings-change", e => { cfg = e.values; });
await qm.beforeSend(async text => (cfg.on ? cfg.greeting + text : text));
qm.messages.say("Politeness is on");
```

### Unread badge and typing

Permissions: `unread`, `typing`, `badge`. (1.86.0)

```js
const paint = async () => qm.badge.set((await qm.chats.unread()).length);
qm.on("unread-change", paint); paint();
qm.on("typing", e => { if (e.typing) qm.toast((e.names[0] || "Someone") + " is typing in " + e.title); });
```

### Know when messages are edited or deleted

Permissions: `watchEdits`, `watchDeletes`, `messages`, `say`. (1.85.0)

```js
qm.on("message-edited", e => { if (!e.fromMe) qm.messages.say("Edited: “" + e.oldText + "” → “" + e.text + "”"); });
qm.on("message-deleted", e => { if (!e.fromMe && e.text) qm.messages.say("Deleted: “" + e.text + "”"); });
```

### Pop-up list on a character and message looks

Permissions: `triggers`, `messageView`. (1.82.0)

```js
qm.triggers.add({ char: "!", title: "Emoji", items: [
  { label: "shrug", insert: "¯\\_(ツ)_/¯ " }, { label: "party", insert: "🎉 " } ] });
qm.messageView.add({ id: "spoilers", match: { regex: "spoiler" }, blur: true });
qm.messageView.add({ id: "shout", replace: [{ find: "\\bheck\\b", with: "h*ck" }] });
```

### Slash commands and a shortcut

Permissions: `commands`, `keys`, `send`, `chat`, `toast`. (1.48.0)

```js
await qm.commands.add({ name: 'shrug', description: 'Send a shrug' });
qm.on('command', async c => { if (c.name === 'shrug') await qm.chat.send((c.args ? c.args + ' ' : '') + '¯\\_(ツ)_/¯'); });
await qm.keys.add({ id: 'draft', combo: 'ctrl+shift+d' });
qm.on('key', async () => qm.toast('Draft: ' + (await qm.chat.getText())));
```

### Message counter

Permissions: `panel`, `messages`.

```js
let n = Number(await qm.storage.get('count')) || 0;
const show = () => qm.panel.set({ title: 'Messages seen', lines: ['Total: ' + n], buttons: ['Reset'] });
show();
qm.on('message', async () => { n++; await qm.storage.set('count', n); show(); });
qm.on('panel-button', async () => { n = 0; await qm.storage.set('count', 0); show(); });
```

### Find a message

Permissions: `buttons`, `page`, `toast`. (1.46.0)

```js
await qm.buttons.add({ id: 'find', where: 'chat', label: 'Find' });
qm.on('button', async b => {
  if (b.id !== 'find') return;
  const text = await qm.ask('Find a message', 'Text to look for');
  if (!text) return;
  const r = await qm.page.scrollUntil({ text, direction: 'up', maxMs: 60000 });
  qm.toast(r.found ? 'Found it' : 'Not found (' + r.reason + ')', r.found ? 'success' : 'error');
});
```

### Square bubbles and a red accent

Permission: `style`.

```js
await qm.style.set(`
  :root { --accent: #e11d48; }
  .bubble { border-radius: 4px !important; }
`);
```

### Joke of the day

Permissions: `network`, `toast`.

```js
const r = await qm.fetch('https://official-joke-api.appspot.com/random_joke');
const j = await r.json();
qm.toast(j.setup + ' ' + j.punchline);
```

## 9. Plugin files

**Export** writes a `.qmplugin.json` file:

```json
{
  "id": "p3k9x2ab",
  "name": "Message counter",
  "version": "1.2.0",
  "apiVersion": 1,
  "minSite": "1.86.0",
  "updateUrl": "https://example.com/counter.json",
  "description": "Counts messages",
  "author": "You",
  "permissions": ["panel", "messages"],
  "code": "..."
}
```

Importing a file with the same `id` (or the same name and author) replaces the installed one and keeps it on/off as it was; permissions that are new need your approval. A new plugin always arrives switched off.

## 10. Versions, outdated warnings and updates

- **Site version** (`qm.version`) is shown on the Plugins tab. The site checks `version.json` when it opens and every 30 minutes; a bar offers *Reload* when a newer one exists. From an offline copy the check can't reach the site; download a fresh copy to update.
- **Plugin API version** (`apiVersion`) only changes when something a plugin relies on changes in a way that could break it. A plugin with a lower number than the site is shown as **Outdated** (it still runs). A plugin with a higher number, or a `minSite` newer than the site, is **blocked** with an explanation until the site is updated.
- When plugins start, a toast warns about each enabled plugin that has a problem.
- **Updates**: with an `updateUrl`, *Check update* downloads that JSON (`{"version": "1.3.0", "downloadUrl": "https://…"}`, optionally `apiVersion`, `minSite`) and compares versions. Nothing installs by itself: import the new file. *Update all* checks every plugin.
- Version numbers are dotted numbers (1.10.0 is newer than 1.9.2).

## 11. Limits

| Thing | Limit |
|---|---|
| Plugin code | 200,000 characters |
| Plugin storage | 100 KB |
| CSS | 50,000 characters (10 named sheets) |
| Panel | 30 lines, 8 buttons |
| `qm.chat.send` | 5 per 10 seconds |
| `qm.beforeSend` | 1 second per plugin, then the message goes unchanged |
| `qm.bus.emit` | 20 KB |
| `qm.download.save` / `qm.files.pick` | 5 MB / 2 MB |
| Buttons, commands, shortcuts, windows | 6, 10, 10, 4 per plugin |

Plugins have no access to Firebase, other people's accounts or devices. They can send messages as you only with `send` / `beforeSend` / `editOwn` / `deleteOwn` / `unsandboxed`.

## 12. Troubleshooting

- **Nothing happens**: is the plugin switched on and approved? Look for a red "Crashed" line (turn on Developer mode to also see the Log on the Plugins tab).
- **"Needs the "x" permission"**: tick it in the editor and save, then approve the review.
- **fetch fails**: add `network`; the target site must send CORS headers.
- **Style not applied**: add `!important`; the site's own rules can be more specific.
- **A new call "isn't a function"**: your site is older than the call's *Since* version; set `minSite` so it is blocked with a clear message instead.

## 13. What changed (plugin API history)

The API number stays **1**: every addition so far is optional, so a plugin only needs `minSite` set to the highest *Since* it uses.

| Site | Added |
|---|---|
| 1.44.0 | First version: `toast`, `style`, `panel`, `me`, `chat`, `messages`, `network`; storage, `qm.on`. |
| 1.46.0 | `page`, `buttons`, `calls`, `devinfo`; `qm.page.*`, `qm.buttons.*`, `qm.calls.state`, `qm.dev.*`, `qm.ask`, `qm.sleep`, `qm.chat.open`; events `button`, `call-state`, `dev-view`, `page-load`. |
| 1.48.0 | `send`, `clipboard`, `notify`, `keys`, `commands`; `qm.messages.*`, `qm.chat.*` (text box, list, info, send), `qm.commands`, `qm.keys`, `qm.banner`, `qm.style.vars / sheet`, `qm.bus`, `qm.app.info`, `qm.plugins.list`, `qm.every / after / now`, `qm.util`, more `qm.page.*`; events `command`, `key`, `banner-button`, `bus`, `online`, `offline`, `visibility`, `theme-change`. |
| 1.49.0 | `ui`, `menu`; `qm.ui.*`, `qm.messageMenu.*`, banner `where`; events `ui-action`, `ui-close`, `menu-click`. |
| 1.52.0 | `speech`, `sound`, `badge`, `share`, `download`, `files`, `links`, `unsandboxed`; `qm.permissions`. Plugins need a permission review before they run. |
| 1.82.0 | `triggers`, `messageView`, `editOwn`, `deleteOwn`; `qm.triggers`, `qm.messageView`, `qm.messages.edit / delete`; event `trigger-pick`. |
| 1.84.0 | `say`, `beforeSend`; `qm.messages.say`, `qm.beforeSend`, `qm.settings.*`; event `settings-change`. Plugins got their own Settings tab, work with Developer mode off, grouped permissions. |
| 1.85.0 | `watchEdits`, `watchDeletes`; events `message-edited`, `message-deleted`. |
| 1.86.0 | `watchMessages`, `typing`, `unread`, `watchReads`, `watchCalls`; events `chat-message`, `typing`, `unread-change`, `message-read`, `incoming-call`; `qm.chats.unread()`. |
| 1.87.2 | `theme`, `nav`, `people`, `watchChatList`, `markRead`; `qm.theme`, `qm.nav`, `qm.people`, `qm.chats.markRead / markAllRead`; events `chat-added`, `chat-removed`. |
| 1.88.0 | `addMembers`; `qm.chat.addUser`, `qm.chat.addBot`, `qm.chat.myBots`. |

*Keeping this current:* when you add a permission, call or event, add it to the tables above with its **Since** version and a line in section 13, then run `python3 tools/build-docs.py`.
