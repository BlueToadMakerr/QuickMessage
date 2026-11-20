// Special-character pop-ups for the message box: type "@", "#", "/" (or any character a plugin claims) and a list opens under it.
// Every list belongs to a *source*: the site itself ("Default") or a plugin. When more than one source answers for the same character,
// each source's choices are shown under its own name, so you can always tell where an entry comes from.
//
//   attachTriggers({ input, providers, chars })
//     chars()            -> Set / array of the characters that currently have a list
//     providers(char)    -> [{ key, source, items(query, char) -> Promise<[{label, sub?, icon?, pfp?, insert?, value?, pick?()}]>, spaces? }]
//   An item's text goes into the box in place of what was typed (insert, or char + value/label + a space); insert: "" only removes it.
import { avatarEl } from "./ui.js";

const MAX_PER_SOURCE = 12, WAIT_MS = 700;

export function attachTriggers({ input, providers, chars }) {
  const wrap = input.closest(".input-wrap") || input.parentNode;
  const pop = document.createElement("div"); pop.className = "trig-pop hidden"; pop.setAttribute("role", "listbox"); wrap.append(pop);
  let flat = [], sel = 0, token = null, seq = 0;

  const close = () => { seq++; pop.classList.add("hidden"); pop.replaceChildren(); flat = []; token = null; input.removeAttribute("aria-activedescendant"); };

  /** The character being typed right now and what follows it: { at, ch, q } */
  function find() {
    const caret = input.selectionStart; if (input.selectionEnd !== caret) return null;
    const before = input.value.slice(0, caret); let best = null;
    for (const ch of chars()) {
      const at = before.lastIndexOf(ch); if (at < 0 || (best && at < best.at)) continue;
      if (at > 0 && !/\s/.test(before[at - 1])) continue;                 // "a#b", "http://x": not a trigger
      const q = before.slice(at + 1);
      if (q.length > 30 || /\n/.test(q)) continue;
      if (/\s/.test(q) && !providers(ch).some(p => p.spaces)) continue;
      best = { at, ch, q };
    }
    return best;
  }
  const withTimeout = (p, ms) => Promise.race([Promise.resolve(p).catch(() => []), new Promise(r => setTimeout(() => r([]), ms))]);

  async function open() {
    const t = find();
    if (!t) { close(); return; }
    const my = ++seq;
    const list = providers(t.ch).filter(p => !/\s/.test(t.q) || p.spaces);
    const groups = (await Promise.all(list.map(async p => ({ p, items: ((await withTimeout(p.items(t.q, t.ch), WAIT_MS)) || []).slice(0, MAX_PER_SOURCE) })))).filter(g => g.items.length);
    if (my !== seq) return;                                              // something newer was typed meanwhile
    if (!groups.length) { close(); return; }
    token = t; flat = []; pop.replaceChildren();
    const head = document.createElement("div"); head.className = "tp-head"; head.textContent = t.q ? t.ch + ' "' + t.q + '"' : t.ch; pop.append(head);
    const lq = t.q.toLowerCase();
    for (const g of groups) {
      if (groups.length > 1) { const gh = document.createElement("div"); gh.className = "tp-group"; gh.textContent = g.p.source; pop.append(gh); }
      for (const it of g.items) {
        const i = flat.length; flat.push({ it, g });
        const row = document.createElement("div"); row.className = "tp-item" + (i === sel ? " on" : ""); row.id = "tp-" + i; row.setAttribute("role", "option");
        if (it.pfp !== undefined && it.label) row.append(avatarEl(it.label, it.pfp || "", "avatar sm"));
        else { const ic = document.createElement("span"); ic.className = "tp-ico"; ic.textContent = String(it.icon || t.ch).slice(0, 2); row.append(ic); }
        const nm = document.createElement("span"); nm.className = "tp-name";
        const lab = String(it.label || ""), j = lq ? lab.toLowerCase().indexOf(lq) : -1;
        if (j >= 0) { nm.append(lab.slice(0, j)); const b = document.createElement("b"); b.textContent = lab.slice(j, j + lq.length); nm.append(b, lab.slice(j + lq.length)); } else nm.textContent = lab;
        row.append(nm);
        if (it.sub) { const sm = document.createElement("small"); sm.className = "tp-sub"; sm.textContent = it.sub; row.append(sm); }
        row.addEventListener("mousedown", e => { e.preventDefault(); pick(i); });         // mousedown: the box must not lose focus
        row.addEventListener("touchstart", e => { e.preventDefault(); pick(i); }, { passive: false });
        pop.append(row);
      }
    }
    sel = Math.min(sel, flat.length - 1);
    pop.querySelectorAll(".tp-item").forEach((r, i) => r.classList.toggle("on", i === sel));
    pop.classList.remove("hidden");
    input.setAttribute("aria-activedescendant", "tp-" + sel);
  }

  function pick(i) {
    const e = flat[i], t = find() || token; if (!e || !t) { close(); return; }
    const { it, g } = e, v = input.value, caret = input.selectionStart;
    const ins = it.insert !== undefined ? String(it.insert) : t.ch + String(it.value !== undefined ? it.value : it.label) + " ";
    input.value = v.slice(0, t.at) + ins + v.slice(caret);
    const pos = t.at + ins.length; input.setSelectionRange(pos, pos);
    close(); input.dispatchEvent(new Event("input", { bubbles: true })); input.focus();
    try { it.pick && it.pick(); } catch (_) { /* a source must never break typing */ }
  }

  const move = d => { sel = (sel + d + flat.length) % flat.length; pop.querySelectorAll(".tp-item").forEach((r, i) => r.classList.toggle("on", i === sel)); input.setAttribute("aria-activedescendant", "tp-" + sel); const r = pop.querySelector(".tp-item.on"); r && r.scrollIntoView({ block: "nearest" }); };
  input.addEventListener("keydown", e => {                 // capture phase: before the box's own "Enter sends"
    if (pop.classList.contains("hidden") || !flat.length || e.isComposing) return;
    if (e.key === "ArrowDown") { e.preventDefault(); e.stopImmediatePropagation(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); e.stopImmediatePropagation(); move(-1); }
    else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); e.stopImmediatePropagation(); pick(sel); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); close(); }
  }, true);
  input.addEventListener("input", () => { sel = 0; open(); });
  input.addEventListener("click", open);
  input.addEventListener("keyup", e => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) open(); });
  input.addEventListener("blur", () => setTimeout(close, 120));
  return { close, refresh: open };
}
