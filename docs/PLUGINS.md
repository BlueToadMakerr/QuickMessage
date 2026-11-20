# Plugins

Plugins are small JavaScript programs you can add that change how QuickMessage looks and behaves **on your device**.

1. Settings → **Plugins** (works with Developer mode off; Developer mode only adds plugin logs).
2. New plugin (templates included), choose its permissions, save, switch it on.

The complete reference is in the app: **`plugin-docs.html`** (also linked from the Plugins tab). It covers the sandbox, every permission, every `qm.*` call, events, CSS hooks, examples, the plugin file format, versions and limits.

## Summary
- Each plugin runs in a sandboxed iframe (no access to the site, your login or Firebase). A Content-Security-Policy blocks all network access unless the `network` permission is given.
- Permissions (grouped in the app): **Look & feel** `style`, `messageView`, `panel`, `buttons`, `ui`, `toast`, `notify`, `badge`, `sound`, `speech`; **Reading** `me`, `chat`, `messages`, `watchMessages`, `watchEdits`, `watchDeletes`, `typing`, `unread`, `watchReads`, `watchCalls`, `calls`, `devinfo`; **Writing & sending** `say`, `commands`, `triggers`, `keys`, `menu`, `send`, `beforeSend`, `editOwn`, `deleteOwn`; **Device & sharing** `clipboard`, `share`, `download`, `files`, `links`; **Network & control** `network`, `page`; **Danger** `unsandboxed`. Reading messages plus network access can leak data, and `send` / `beforeSend` / `editOwn` / `deleteOwn` act as you: only install code you trust.
- Plugin API version (`apiVersion`) and `minSite` decide compatibility. Older plugins get an **Outdated** warning but run; plugins for a newer API than the site are blocked with an explanation.
- `updateUrl` lets the Plugins tab check for a newer version of a plugin (it never installs by itself).
- Site version: `js/version.js` / `version.json`; a bar appears when a newer one is deployed.

## Releasing a new site version (maintainers)
1. Change `SITE_VERSION` in `js/version.js` and `version` in `version.json` (same number). The version is only tracked there and in `docs/CHANGELOG.md`, not in the README.
2. If a change could break plugins, raise `API_VERSION` as well and add a row to the table at the end of `plugin-docs.html`.

## What plugins can do (1.46.0+)
- **Control the page**: `qm.page.query / click / type / scroll / scrollUntil / highlight` on the open chat, the call page or the chat list. `scrollUntil` scrolls a chat up until a message with some text appears, letting the page load older messages, then flashes the message.
- **Add buttons**: `qm.buttons.add({id, label, where: 'chat' | 'list' | 'call'})`, then react to the `button` event (for example by asking with `qm.ask` and running a search).
- **Calls**: `qm.calls.state()` and the `call-state` event.
- **Developer info**: `qm.dev.read('env' | 'state' | 'call')` and `qm.dev.addCard('app' | 'chat' | 'message' | 'call', {id, title, rows})`; update cards on the `dev-view` event.

## What plugins can do (1.48.0+)
- Permissions added: `send`, `clipboard`, `notify`, `keys`, `commands`.
- **Messages**: `qm.messages.list / find / get / jump / reply`. **Chat**: `getText / setText / clearText / focus / list / info / send`.
- **Slash commands** (`qm.commands.add`, event `command`) and **keyboard shortcuts** (`qm.keys.add`, event `key`).
- **Windows and menus (1.49.0)**: `qm.ui.open/update/close/confirm/prompt` (block-based windows that follow the theme), `qm.messageMenu.add`, banners on the call screen (`qm.banner.show({where:"call"})`). Plugins can be added from a URL on the Plugins tab.
- **Look and feel**: CSS variables and named stylesheets, a top banner, panel progress bars, notifications, vibration, clipboard.
- **More page control**: `waitFor / text / attr / count / focus / press / select / check / hide / show / title`.
- **No permission needed**: `qm.every / after / now`, `qm.util.*`, `qm.bus.*` (plugin to plugin), `qm.app.info`, `qm.plugins.list`, `qm.storage.keys / clear / usage`.
- Switching a plugin off, deleting or editing it now takes effect immediately and removes everything it added.


## 1.52.0
- **Permission review**: switching a plugin on shows everything it asks for, in plain words with risk labels. Changed permissions need a new review. The Plugins tab has a *Permissions* button.
- New permissions: `speech`, `sound`, `badge`, `share`, `download`, `files`, `links`, `unsandboxed`.
- **`unsandboxed` is EXTREMELY DANGEROUS.** The plugin runs with the full power of the site (messages, keys, what you type). Never run anything you do not trust completely with it. You must type UNSANDBOXED to allow it.

## Added in 1.84.0
- Plugins is its own Settings tab. Permissions are grouped and collapsible (Expand all / Collapse all).
- `qm.settings.define(...)` / `qm.settings.get(id?)` / `qm.settings.set(id, value)` + the `settings-change` event (`{values}`): plugins can describe their own settings; a ⚙ Settings button appears on the plugin.
- Permission `say`: `qm.messages.say(text)` adds a local-only message only you see. Permission `beforeSend`: `qm.beforeSend(fn)` can rewrite or cancel your message before sending (1 s limit; return null to cancel).

## Added in 1.82.0
- `triggers` (`qm.triggers.add`): pop-up lists for `/ @ # !` and other special characters in the message box; when several plugins use one character each is listed under its own name and the site itself is "Default".
- `messageView` (`qm.messageView.add`): change how messages look (replace text, blur, class names, prefix/suffix), display only.
- `editOwn` (`qm.messages.edit`) and `deleteOwn` (`qm.messages.delete`, asks every time): act on your own messages.

## Added in 1.85.0
- `watchEdits` / `watchDeletes`: events `message-edited` / `message-deleted` for messages in the open chat. Text (old and new / last seen) is included only if the plugin also holds `messages`; otherwise it gets who, which message and when.

## Added in 1.86.0
- `watchMessages` (event `chat-message`, any chat), `typing` (event `typing`, any chat), `unread` (`qm.chats.unread()` + event `unread-change`), `watchReads` (event `message-read`, open chat), `watchCalls` (event `incoming-call`). Message text only reaches plugins that also hold `messages`.
