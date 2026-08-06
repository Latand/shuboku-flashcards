/*
 * Builds a listening sheet for the rendered clips.
 *
 *   bun run scripts/audio-review.ts && bun run scripts/serve-review.ts
 *
 * Every reading gets a play button and a flag. Flags live in localStorage and
 * copy out as a plain list, which is what a re-render needs as input.
 */

import { readFile, writeFile } from "node:fs/promises";
import { BUILTIN_DECKS } from "../src/data/packs";
import { audioKey } from "../src/lib/audio";

interface Item {
  key: string;
  char: string;
  reading: string;
  hint: string;
}

/** --list=<json array of readings> narrows the sheet to just those. */
const listArg = process.argv.find((a) => a.startsWith("--list="))?.slice(7);
const wanted: Set<string> | null = listArg
  ? new Set(JSON.parse(await readFile(listArg, "utf8")) as string[])
  : null;
/** --heard=<json map reading→transcript> shows what a recogniser made of each. */
const heardArg = process.argv.find((a) => a.startsWith("--heard="))?.slice(8);
const heard: Record<string, string> = heardArg
  ? JSON.parse(await readFile(heardArg, "utf8"))
  : {};

const decksAll = BUILTIN_DECKS.map((deck) => ({
  id: deck.id,
  jp: deck.jp,
  name: deck.name,
  script: deck.script,
  items: deck.cards
    .filter((c) => c.speak && (!wanted || wanted.has(c.speak)))
    .map((card): Item => ({
      key: audioKey(card.speak!),
      char: card.char,
      reading: card.speak!,
      hint:
        (heard[card.speak!] ? `heard: ${heard[card.speak!]} · ` : "") +
        (card.type === "kana"
          ? card.romaji
          : card.type === "kanji"
            ? `${card.meaning} · 訓 ${card.kun} · 音 ${card.on}`
            : ""),
    })),
}));

const decks = decksAll.filter((d) => d.items.length);
const total = decks.reduce((n, d) => n + d.items.length, 0);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>朱墨 — audio review (${total} clips)</title>
<style>
  :root { --ink:#08070a; --sumi:#131114; --edge:#2a2429; --bone:#e9e4da; --ash:#7d7469;
          --blood:#a80f18; --ember:#e2242f; --moss:#4d7a5a; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--ink); color:var(--bone); font-family:system-ui,sans-serif; }
  header { position:sticky; top:0; z-index:5; background:#0d0b0f; border-bottom:1px solid var(--edge);
           padding:14px 20px; display:flex; gap:14px; align-items:center; flex-wrap:wrap; }
  h1 { font-size:15px; margin:0; letter-spacing:.2em; font-weight:400; }
  .count { font-family:ui-monospace,monospace; font-size:12px; color:var(--ash); }
  button { font:inherit; cursor:pointer; border:1px solid var(--edge); background:#17131a;
           color:var(--bone); border-radius:6px; padding:7px 12px; }
  button:hover { border-color:var(--blood); }
  button.primary { background:var(--blood); border-color:var(--blood); }
  main { padding:20px; max-width:1100px; margin:0 auto; }
  section { margin-bottom:34px; }
  h2 { font-size:13px; letter-spacing:.18em; color:var(--ash); font-weight:400; margin:0 0 12px;
       text-transform:uppercase; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(170px,1fr)); gap:10px; }
  .item { border:1px solid var(--edge); border-radius:8px; padding:10px 12px; background:var(--sumi);
          display:flex; flex-direction:column; gap:6px; }
  .item[data-flagged="true"] { border-color:var(--ember); background:#1d1013; }
  .item[data-playing="true"] { border-color:var(--bone); }
  .char { font-size:30px; line-height:1.1; font-family:"Noto Serif JP",serif; }
  .reading { font-size:14px; color:var(--bone); }
  .hint { font-size:11px; color:var(--ash); min-height:14px; }
  .row { display:flex; gap:6px; margin-top:2px; }
  .row button { padding:5px 9px; font-size:12px; flex:1; }
  .flag[aria-pressed="true"] { background:var(--ember); border-color:var(--ember); }
  #out { width:100%; min-height:90px; background:#0d0b0f; color:var(--bone); border:1px solid var(--edge);
         border-radius:6px; padding:10px; font-family:ui-monospace,monospace; font-size:12px; }
</style>
</head>
<body>
<header>
  <h1>朱墨 AUDIO REVIEW</h1>
  <span class="count">${total} clips · <b id="flagcount">0</b> flagged</span>
  <button id="playall" class="primary">▶ play everything</button>
  <button id="stop">■ stop</button>
  <button id="copy">copy flagged list</button>
  <button id="clear">clear flags</button>
  <span class="count">space = play next · f = flag current</span>
</header>
<main id="root"></main>
<section style="padding:0 20px 40px; max-width:1100px; margin:0 auto;">
  <h2>flagged readings</h2>
  <textarea id="out" readonly placeholder="nothing flagged yet"></textarea>
</section>
<script>
const DECKS = ${JSON.stringify(decks)};
const FLAG_KEY = "shuboku:audio-flags";
let flags = new Set(JSON.parse(localStorage.getItem(FLAG_KEY) || "[]"));
let order = [], cursor = -1, queue = null, audio = new Audio();

const root = document.getElementById("root");
for (const deck of DECKS) {
  const section = document.createElement("section");
  section.innerHTML = '<h2>' + deck.jp + ' · ' + deck.name + ' · ' + deck.script + '</h2>';
  const grid = document.createElement("div");
  grid.className = "grid";
  for (const item of deck.items) {
    const el = document.createElement("div");
    el.className = "item";
    el.dataset.key = item.key;
    el.dataset.reading = item.reading;
    el.innerHTML =
      '<div class="char">' + item.char + '</div>' +
      '<div class="reading">' + item.reading + '</div>' +
      '<div class="hint">' + item.hint + '</div>' +
      '<div class="row"><button class="play">▶ hear</button>' +
      '<button class="flag" aria-pressed="false">flag</button></div>';
    el.querySelector(".play").onclick = () => play(item.key, el);
    el.querySelector(".flag").onclick = () => toggle(item.reading, el);
    grid.appendChild(el);
    order.push({ key: item.key, reading: item.reading, el });
  }
  section.appendChild(grid);
  root.appendChild(section);
}

function play(key, el) {
  document.querySelectorAll('.item[data-playing="true"]').forEach((n) => (n.dataset.playing = "false"));
  if (el) { el.dataset.playing = "true"; el.scrollIntoView({ block: "center", behavior: "smooth" }); }
  audio.pause();
  audio = new Audio("public/audio/" + key + ".mp3");
  audio.play().catch((e) => console.warn("play failed", e));
  return audio;
}

function toggle(reading, el) {
  if (flags.has(reading)) flags.delete(reading); else flags.add(reading);
  el.dataset.flagged = String(flags.has(reading));
  el.querySelector(".flag").setAttribute("aria-pressed", String(flags.has(reading)));
  localStorage.setItem(FLAG_KEY, JSON.stringify([...flags]));
  render();
}

function render() {
  document.getElementById("flagcount").textContent = flags.size;
  document.getElementById("out").value = [...flags].join(" ");
}

for (const entry of order) {
  if (flags.has(entry.reading)) {
    entry.el.dataset.flagged = "true";
    entry.el.querySelector(".flag").setAttribute("aria-pressed", "true");
  }
}
render();

function playFrom(index) {
  if (index >= order.length) { queue = null; return; }
  cursor = index;
  const entry = order[index];
  const a = play(entry.key, entry.el);
  a.onended = () => { if (queue !== null) playFrom(index + 1); };
}

document.getElementById("playall").onclick = () => { queue = 1; playFrom(cursor < 0 ? 0 : cursor); };
document.getElementById("stop").onclick = () => { queue = null; audio.pause(); };
document.getElementById("clear").onclick = () => {
  flags = new Set(); localStorage.removeItem(FLAG_KEY);
  document.querySelectorAll(".item").forEach((n) => {
    n.dataset.flagged = "false"; n.querySelector(".flag").setAttribute("aria-pressed", "false");
  });
  render();
};
document.getElementById("copy").onclick = async () => {
  await navigator.clipboard.writeText([...flags].join(" "));
  document.getElementById("copy").textContent = "copied";
  setTimeout(() => (document.getElementById("copy").textContent = "copy flagged list"), 1200);
};

addEventListener("keydown", (e) => {
  if (e.target.tagName === "TEXTAREA") return;
  if (e.code === "Space") { e.preventDefault(); queue = null; playFrom(cursor + 1); }
  if (e.key.toLowerCase() === "f" && cursor >= 0) {
    const entry = order[cursor];
    toggle(entry.reading, entry.el);
  }
});
</script>
</body>
</html>
`;

await writeFile(new URL("../audio-review.html", import.meta.url).pathname, html);
console.log(`audio-review.html written — ${total} clips across ${decks.length} decks`);
