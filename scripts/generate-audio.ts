/*
 * Renders one audio clip per built-in card reading.
 *
 * The Telegram desktop client embeds a WebKitGTK build with no Web Speech API
 * at all — `window.speechSynthesis` is undefined there — so a browser voice
 * can never reach that screen. Shipping the readings as files is the only way
 * the sound button works everywhere.
 *
 * Two engines, because the first one did not work out:
 *
 *   openai      gpt-4o-mini-tts. Takes an `instructions` field, which is where
 *               "one clean mora, no emotion" belongs. Asked for the reading on
 *               its own; only the surrounding silence is trimmed.
 *   elevenlabs  A sentence-level model with no Japanese G2P guarantees. Given
 *               one bare mora it improvises — laughter for 「はは」, 「た」 for
 *               「と」 — so it has to be asked for three repetitions and cut
 *               down to the steady middle one. About a quarter still came out
 *               wrong. Kept because the readings that did work are in the app.
 *
 * Whatever comes out must then be checked by machine — see verify-audio.py.
 * Raw responses live in .audio-raw/<engine>/ so a cut can be redone for free.
 *
 * Usage:
 *   set -a; . ~/.secrets/openai.env; set +a
 *   bun run scripts/generate-audio.ts --missing        # fill the gaps
 *   bun run scripts/generate-audio.ts --only=は,を     # spot fixes
 *   bun run scripts/generate-audio.ts --retrim --hold=は  # keep one unpublished
 *   bun run scripts/generate-audio.ts --force          # everything again
 *   bun run scripts/generate-audio.ts --retrim         # re-cut, no API calls
 *   bun run scripts/generate-audio.ts --engine=elevenlabs --redo-seams
 */

import { mkdir, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { BUILTIN_DECKS } from "../src/data/packs";
import { audioKey } from "../src/lib/audio";
import { trimEdges, trimSteadiest } from "./trim";

const OUT_DIR = new URL("../public/audio/", import.meta.url).pathname;
const INDEX_FILE = new URL("../src/data/audio-index.ts", import.meta.url).pathname;
const RAW_ROOT = new URL("../.audio-raw/", import.meta.url).pathname;
const CONCURRENCY = 3;

const INSTRUCTIONS =
  "You are a pronunciation reference for a Japanese kana learning app. " +
  "Read the text as standard Tokyo Japanese, exactly as written. " +
  "A single kana is one clean mora: neutral pitch, no emotion, no elongation, " +
  "no glottal stop, no extra sounds, never repeated. Speak slowly and clearly.";

/** Every kana the app teaches, with the romaji printed on its own card. */
const ROMAJI = new Map<string, string>(
  BUILTIN_DECKS.flatMap((deck) =>
    deck.cards.flatMap((card) => (card.type === "kana" ? [[card.char, card.romaji] as const] : []))
  )
);

/**
 * Spells the reading out for the model. Leaving it to infer the sound is what
 * produced 「た」 for 「と」 — romaji removes the guess, and the app already
 * knows the romaji for every kana it teaches.
 */
function romajiOf(reading: string): string | null {
  const chars = [...reading];
  let out = "";
  for (let i = 0; i < chars.length; ) {
    const pair = chars[i] + (chars[i + 1] ?? "");
    if (ROMAJI.has(pair)) {
      out += ROMAJI.get(pair);
      i += 2;
    } else if (ROMAJI.has(chars[i])) {
      out += ROMAJI.get(chars[i]);
      i += 1;
    } else if (chars[i] === "っ" || chars[i] === "ッ") {
      out += "-";
      i += 1;
    } else {
      return null; // an unknown character: better no hint than a wrong one
    }
  }
  return out;
}

function instructionsFor(reading: string): string {
  const romaji = romajiOf(reading);
  return romaji ? `${INSTRUCTIONS} The text reads "${romaji}" in romaji.` : INSTRUCTIONS;
}

interface Engine {
  name: string;
  keyVar: string;
  /** Three repetitions where a bare mora would otherwise be improvised away. */
  prompt: (reading: string) => string;
  request: (text: string, key: string) => Request;
  cut: typeof trimEdges;
}

const ENGINES: Record<string, Engine> = {
  openai: {
    name: "openai",
    keyVar: "OPENAI_API_KEY",
    prompt: (reading) => reading,
    request: (text, key) =>
      new Request("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini-tts",
          // Picked by transcribing a dozen of the hardest syllables in three
          // voices and keeping the one the recogniser agreed with most often.
          voice: "nova",
          input: text,
          instructions: instructionsFor(text),
          response_format: "mp3",
          speed: 0.9,
        }),
      }),
    cut: trimEdges,
  },
  elevenlabs: {
    name: "elevenlabs",
    keyVar: "ELEVENLABS_API_KEY",
    prompt: (reading) => `${reading}。${reading}。${reading}。`,
    request: (text, key) =>
      new Request(
        "https://api.elevenlabs.io/v1/text-to-speech/B8gJV1IhpuegLxdpXFOE" +
          "?output_format=mp3_44100_64",
        {
          method: "POST",
          headers: { "xi-api-key": key, "content-type": "application/json" },
          body: JSON.stringify({
            text,
            model_id: "eleven_v3",
            voice_settings: { stability: 0.6, similarity_boost: 0.8, style: 0 },
          }),
        }
      ),
    cut: trimSteadiest,
  },
};

const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const has = (name: string) => process.argv.includes(`--${name}`);

const engine = ENGINES[arg("engine") ?? "openai"];
if (!engine) throw new Error(`unknown engine — pick one of ${Object.keys(ENGINES).join(", ")}`);

const key = process.env[engine.keyVar];
if (!key) {
  console.error(`${engine.keyVar} is not set — source the matching file in ~/.secrets first`);
  process.exit(1);
}

const force = has("force");
/** Re-cut from the stored responses without calling the API. */
const retrim = has("retrim");
/** Re-request only the readings whose recording had no seam to cut on. */
const redoSeams = has("redo-seams");
/** Render only what has no clip yet. */
const missing = has("missing");
const only = (arg("only") ?? "").split(",").filter(Boolean);
/**
 * Rendered but not published yet: the file stays on disk for the review sheet
 * while the app keeps falling back to the browser voice for that card.
 */
const hold = (arg("hold") ?? "").split(",").filter(Boolean);

const RAW_DIR = `${RAW_ROOT}${engine.name}/`;
await mkdir(OUT_DIR, { recursive: true });
await mkdir(RAW_DIR, { recursive: true });

const readings = [
  ...new Set(BUILTIN_DECKS.flatMap((d) => d.cards.map((c) => c.speak)).filter(Boolean)),
] as string[];

const rawPath = (text: string) => `${RAW_DIR}${audioKey(text)}.mp3`;
const outPath = (text: string) => `${OUT_DIR}${audioKey(text)}.mp3`;

/** Readings whose stored recording has no seam to cut on. */
async function seamless(): Promise<string[]> {
  const out: string[] = [];
  for (const text of readings) {
    if (!existsSync(rawPath(text))) continue;
    const result = await engine.cut(rawPath(text), outPath(text));
    if (result.note.includes("thirds")) out.push(text);
  }
  return out;
}

const pending = only.length
  ? readings.filter((text) => only.includes(text))
  : missing
    ? readings.filter((text) => !existsSync(outPath(text)))
    : redoSeams
      ? await seamless()
      : readings.filter((text) => force || retrim || !existsSync(rawPath(text)));

const refetches = (text: string) =>
  !retrim && (only.length > 0 || missing || redoSeams || force || !existsSync(rawPath(text)));

const characters = pending.reduce(
  (n, t) => n + (refetches(t) ? [...engine.prompt(t)].length : 0),
  0
);

console.log(
  `${readings.length} readings · ${pending.length} to process · ` +
    `${characters} characters · ${engine.name}`
);

async function fetchRaw(text: string, attempt = 1): Promise<void> {
  const response = await fetch(engine.request(engine.prompt(text), key!));
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
const guessed: string[] = [];
const queue = [...pending];

await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let text = queue.shift(); text; text = queue.shift()) {
      try {
        if (refetches(text)) await fetchRaw(text);
        const result = await engine.cut(rawPath(text), outPath(text));
        if (result.note.includes("thirds")) guessed.push(text);
      } catch (e) {
        failures.push(String(e));
      }
      if (++done % 25 === 0 || done === pending.length) console.log(`  ${done}/${pending.length}`);
    }
  })
);

for (const failure of failures) console.error("FAILED", failure);
if (guessed.length) {
  console.warn(`\n${guessed.length} cut in thirds (no audible seams): ${guessed.join(" ")}`);
}

const rendered = (await readdir(OUT_DIR)).filter((f) => f.endsWith(".mp3"));
const available = readings
  .filter((t) => rendered.includes(audioKey(t) + ".mp3") && !hold.includes(t))
  .sort();

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
