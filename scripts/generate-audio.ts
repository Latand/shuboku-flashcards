/*
 * Renders one audio clip per built-in card reading.
 *
 * The Telegram desktop client embeds a WebKitGTK build with no Web Speech API
 * at all — `window.speechSynthesis` is undefined there — so a browser voice
 * can never reach that screen. Shipping the readings as files is the only way
 * the sound button works everywhere.
 *
 * A bare mora is a bad prompt: a sentence-level model given one character
 * improvises a rising pitch or a stretched vowel. Asked for the same mora
 * three times it settles, so each reading is requested as 「X。X。X。」 and the
 * steady middle repetition is cut out of the result. Multi-mora words are
 * already natural utterances and can be asked for on their own (--solo). Raw
 * responses are kept in .audio-raw/ so a cut can be redone without paying.
 *
 * Usage:
 *   set -a; . ~/.secrets/elevenlabs.env; set +a
 *   bun run scripts/generate-audio.ts              # fill gaps
 *   bun run scripts/generate-audio.ts --force      # render everything again
 *   bun run scripts/generate-audio.ts --retrim     # re-cut, no API calls
 *   bun run scripts/generate-audio.ts --redo-seams # redo what had no seam
 *   bun run scripts/generate-audio.ts --only=あ,い --solo   # spot fixes
 */

import { mkdir, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { BUILTIN_DECKS } from "../src/data/packs";
import { audioKey } from "../src/lib/audio";
import { trimEdges, trimSteadiest } from "./trim";

const VOICE_ID = "B8gJV1IhpuegLxdpXFOE"; // "kuon" — native Japanese
const MODEL_ID = "eleven_v3";
const OUTPUT_FORMAT = "mp3_44100_64";
const VOICE_SETTINGS = { stability: 0.6, similarity_boost: 0.8, style: 0 };
const OUT_DIR = new URL("../public/audio/", import.meta.url).pathname;
const RAW_DIR = new URL("../.audio-raw/", import.meta.url).pathname;
const INDEX_FILE = new URL("../src/data/audio-index.ts", import.meta.url).pathname;
const CONCURRENCY = 3;

/**
 * Three steady repetitions, so the middle one can be lifted out clean. Full
 * stops rather than commas: asked with commas the model runs the repetitions
 * together in one breath about a fifth of the time, leaving no seam to cut on.
 */
const prompt = (reading: string) => `${reading}。${reading}。${reading}。`;

const key = process.env.ELEVENLABS_API_KEY;
if (!key) {
  console.error("ELEVENLABS_API_KEY is not set — source ~/.secrets/elevenlabs.env first");
  process.exit(1);
}

const force = process.argv.includes("--force");
/** Re-cut from the stored responses without calling the API. */
const retrim = process.argv.includes("--retrim");
/** Re-request only the readings whose recording had no seam to cut on. */
const redoSeams = process.argv.includes("--redo-seams");
/**
 * Ask for the reading once, on its own, and keep all of it. Multi-mora words
 * are already a natural utterance — the repetition trick exists for the bare
 * morae that a sentence model cannot say convincingly alone.
 */
const solo = process.argv.includes("--solo");
/** Redo named readings only, e.g. --only=いつつ,ここのつ — for spot fixes after listening. */
const only = (process.argv.find((a) => a.startsWith("--only="))?.slice(7) ?? "")
  .split(",")
  .filter(Boolean);

const readings = [
  ...new Set(BUILTIN_DECKS.flatMap((d) => d.cards.map((c) => c.speak)).filter(Boolean)),
] as string[];

await mkdir(OUT_DIR, { recursive: true });
await mkdir(RAW_DIR, { recursive: true });

const rawPath = (text: string) => `${RAW_DIR}${audioKey(text)}.mp3`;
const outPath = (text: string) => `${OUT_DIR}${audioKey(text)}.mp3`;

/** Readings whose stored recording has no seam to cut on. */
async function seamless(): Promise<string[]> {
  const out: string[] = [];
  for (const text of readings) {
    if (!existsSync(rawPath(text))) continue;
    const result = await trimSteadiest(rawPath(text), outPath(text));
    if (result.note.includes("thirds")) out.push(text);
  }
  return out;
}

const pending = only.length
  ? readings.filter((text) => only.includes(text))
  : redoSeams
    ? await seamless()
    : readings.filter(
        (text) => (force && !retrim) || (!retrim && !existsSync(rawPath(text))) || retrim
      );

const willFetch = redoSeams || !retrim;
const characters = willFetch
  ? pending.reduce(
      (n, t) =>
        n +
        (!redoSeams && !only.length && existsSync(rawPath(t)) && !force
          ? 0
          : [...(solo ? t : prompt(t))].length),
      0
    )
  : 0;

console.log(
  `${readings.length} readings · ${pending.length} to process · ` +
    `${characters} characters (≈${characters} credits) · ${MODEL_ID}`
);

async function fetchRaw(text: string, attempt = 1): Promise<void> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=${OUTPUT_FORMAT}`,
    {
      method: "POST",
      headers: { "xi-api-key": key!, "content-type": "application/json" },
      body: JSON.stringify({
        text: solo ? text : prompt(text),
        model_id: MODEL_ID,
        voice_settings: VOICE_SETTINGS,
      }),
    }
  );
  if (!response.ok) {
    const retriable = response.status === 429 || response.status >= 500;
    const detail = (await response.text()).slice(0, 160);
    if (retriable && attempt < 4) {
      await new Promise((r) => setTimeout(r, 900 * attempt));
      return fetchRaw(text, attempt + 1);
    }
    throw new Error(`${text}: HTTP ${response.status} ${detail}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 512) throw new Error(`${text}: suspiciously small response`);
  await writeFile(rawPath(text), bytes);
}

let done = 0;
const failures: string[] = [];
const untrimmed: string[] = [];
const queue = [...pending];

await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let text = queue.shift(); text; text = queue.shift()) {
      try {
        const refetch = only.length > 0 || redoSeams || (force && !retrim) || !existsSync(rawPath(text));
        if (refetch && !retrim) await fetchRaw(text);
        const result = solo
          ? await trimEdges(rawPath(text), outPath(text))
          : await trimSteadiest(rawPath(text), outPath(text));
        if (result.note.includes("thirds")) untrimmed.push(text);
      } catch (e) {
        failures.push(String(e));
      }
      if (++done % 25 === 0 || done === pending.length) console.log(`  ${done}/${pending.length}`);
    }
  })
);

for (const failure of failures) console.error("FAILED", failure);
if (untrimmed.length) {
  console.warn(`\n${untrimmed.length} cut in thirds (no audible seams): ${untrimmed.join(" ")}`);
}

const rendered = (await readdir(OUT_DIR)).filter((f) => f.endsWith(".mp3"));
const available = readings.filter((t) => rendered.includes(audioKey(t) + ".mp3")).sort();

await writeFile(
  INDEX_FILE,
  `// Generated by scripts/generate-audio.ts — do not edit by hand.\n` +
    `// Readings with a rendered clip in public/audio/.\n` +
    `export const AUDIO_READINGS: ReadonlySet<string> = new Set([\n` +
    available.map((t) => `  ${JSON.stringify(t)},`).join("\n") +
    `\n]);\n`
);

console.log(`\n${available.length}/${readings.length} readings have audio; index written`);
if (failures.length) process.exit(1);
