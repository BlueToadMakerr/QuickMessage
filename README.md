# QuickMessage

A small, fast private chat for the web, Android and iPhone: messages, **end-to-end encryption**, photos, voice notes, files, voice / video / screen-sharing **group calls**, themes, and a plugin system for developers.

> Designed and written entirely with AI (Anthropic's Claude). It is an independent project, so rough edges are possible.

**Live site:** https://msg.infinityfreeapp.com/ · [changelog](docs/CHANGELOG.md) (current version at the top)

## Run it your way

| | Needs | Good for |
|---|---|---|
| **Firebase** (default) | A free Google Firebase project + any static web host | Friends anywhere, apps, push notifications |
| **Private server** | Python 3 and a computer on your network. Works with **no internet** | Home / office / offline groups, old browsers |

```bash
python3 server/qm_server.py        # private server on http://localhost:8080
```

## What's inside
- Chats and groups, typing, read receipts, edit / delete / reply, link previews, per-chat E2E encryption
- Photos, short clips, voice recorder, camera, files up to 1 GB through free file hosts (or your server), upload progress that survives navigation
- Group voice / video / screen sharing, picture-in-picture, incoming-call ring on every device
- Android and iPhone apps built by one GitHub workflow
- Notifications from Firebase Cloud Functions (no PHP involved), with pictures where the platform allows
- Sandboxed **plugins** with their own Settings tab, grouped permissions and per-plugin settings (no Developer mode needed), site version checks
- Appearance: themes, a background picture with a glass look, `qm:` links that open any page, setting, chat, message or call
- Call ping and frame-rate badges
- Compatibility mode for very old browsers (even a Nintendo Wii) with the private server
- Optimised database usage for the free Firebase plan

Details: [docs/FEATURES.md](docs/FEATURES.md).

## Documentation
| Page | About |
|---|---|
| [docs/SETUP-FIREBASE.md](docs/SETUP-FIREBASE.md) | Firebase project, rules, Cloud Functions, hosting |
| [docs/SERVER-PRIVATE.md](docs/SERVER-PRIVATE.md) | The offline Python server |
| [docs/OLD-BROWSERS.md](docs/OLD-BROWSERS.md) | Compatibility mode |
| [docs/PLUGINS.md](docs/PLUGINS.md) | Plugins (full reference inside the app: `plugin-docs.html`) |
| [docs/DATABASE-USAGE.md](docs/DATABASE-USAGE.md) | How reads, writes and storage are kept small |
| [docs/APPS.md](docs/APPS.md) | Android / iPhone apps and the workflow |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Every change, round by round |

## Repository layout
```
index.html message.html account.html call.html …   pages (ES modules in js/, no build step)
js/                      app code (js/private = private-server SDK, js/call = calls)
legacy/                  compatibility client for very old browsers
plugin-docs.html          plugin reference (plugins themselves live in Settings → Plugins)
server/qm_server.py      private server
functions/               Firebase Cloud Functions (notifications)
database.rules.json      Realtime Database rules
*.php                    optional helpers for the hosted site (uploads, previews, e-mail lookup)
android/ ios/            native apps
docs/                    documentation
.github/workflows/       the single build / import workflow (uploads are encrypted: see docs/APPS.md)
tools/                   encrypt-zip.sh + the public key for encrypted uploads, build-docs.py (docs/*.md -> the in-app docs pages)
```

## Credits and licence
Made with AI. Third-party services used by the default setup: Firebase, public STUN servers, anonymous file hosts (Litterbox, oshi.at, tmpfile.link, file.io, 0x0.st, tempfile.org).

## Suggestions and contact
Ideas and bug reports: open an issue at https://github.com/BlueToadMakerr/QuickMessage/issues or email bluetmaker@gmail.com (both are also linked in Account → Suggest a feature).

Usage statistics (account based, on by default, can be switched off in the welcome tour / Account → Privacy): see docs/ANALYTICS.md.
