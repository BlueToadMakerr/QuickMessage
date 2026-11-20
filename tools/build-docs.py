#!/usr/bin/env python3
"""Regenerates the in-app docs pages from the Markdown files, so the repo and the site always say the same thing.
   docs/PLUGINS.md -> plugin-docs.html      docs/BOTS.md -> bot-docs.html
Edit the .md files, then run:  python3 tools/build-docs.py     (needs: pip install markdown)"""
import re, sys, pathlib, markdown
root = pathlib.Path(__file__).resolve().parent.parent
PAGES = [("docs/PLUGINS.md", "plugin-docs.html", "Plugin docs", "account.html#tab=plugins", "Back to plugins"),
         ("docs/BOTS.md", "bot-docs.html", "Bot docs", "bots.html", "Back to bots")]
TEMPLATE = """<!DOCTYPE html>
<html lang="en" data-theme="system">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title} · QuickMessage</title>
  <link rel="icon" href="icons/icon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="style.css">
  <script src="js/themeboot.js"></script>
</head>
<body>
<!-- Generated from {src} by tools/build-docs.py: edit the Markdown file, not this page. -->
<div class="shell">
  <header class="topbar"><a href="{back}" class="icon-btn" aria-label="{backlabel}" data-icon="back"></a><h1 class="brand">{title}</h1></header>
  <main class="doc-page">
{body}
  </main>
</div>
<script type="module" src="js/bars.js"></script>
<script type="module">import {{ hydrateIcons }} from "./js/ui.js"; import {{ markReady }} from "./js/embed.js"; hydrateIcons(); markReady();</script>
</body>
</html>
"""
def build(src, out, title, back, backlabel):
    text = (root / src).read_text(encoding="utf-8")
    text = re.sub(r"^# .*\n", "", text, count=1)                                   # the page header already shows the title
    md = markdown.Markdown(extensions=["tables", "fenced_code", "toc", "sane_lists"], extension_configs={"toc": {"toc_depth": "2-2"}})
    body = md.convert(text)
    body = body.replace("\\|", "|")                                                    # table-cell escape inside code spans
    body = re.sub(r"(<table>.*?</table>)", r'<div class="doc-table">\1</div>', body, flags=re.S)
    toc = "".join(f'<li><a href="#{t["id"]}">{t["name"]}</a></li>' for t in md.toc_tokens)
    body = f'<nav class="doc-toc card"><strong>Contents</strong><ol>{toc}</ol></nav>\n' + body
    (root / out).write_text(TEMPLATE.format(title=title, src=src, back=back, backlabel=backlabel, body=body), encoding="utf-8")
    print("wrote", out, len(body))
for p in PAGES: build(*p)
