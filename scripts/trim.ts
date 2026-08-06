/*
 * Cuts one clean syllable out of a repeated recording.
 *
 * A sentence-level TTS given a bare mora improvises: rising pitch, stretched
 * vowels, a question where none was asked. Asked for the same mora three times
 * it settles, and the middle repetition is the steady one — no sentence-initial
 * lift, no final fall. This finds that repetition and lifts it out.
 *
 * How audible the seams are varies wildly between readings: some come back with
 * clear pauses, others run together in one breath. So the gap detector is tried
 * at four sensitivities, cleanest first, and what we know about the request —
 * exactly three repetitions — decides which result to trust. When no threshold
 * finds the seams, the recording is cut in thirds, which is what the three even
 * repetitions actually are.
 */

/** Gap detection from conservative to aggressive. */
const PROFILES = [
  { noise: "-38dB", d: 0.09 },
  { noise: "-45dB", d: 0.06 },
  { noise: "-50dB", d: 0.04 },
  { noise: "-55dB", d: 0.03 },
];
/** Keeps the consonant onset intact. */
const PAD = 0.06;
/**
 * A vowel keeps sounding well after it drops under any silence threshold, and
 * cutting at the threshold leaves a glottal stop: 「く」 comes back as くっ. The
 * tail is therefore given far more room than the detector asks for, clamped so
 * it can never reach into the next repetition.
 */
const TAIL = 0.3;
/** Gap left in front of the following repetition. */
const GAP = 0.04;

async function ffmpeg(args: string[]): Promise<string> {
  const proc = Bun.spawn(["ffmpeg", ...args], { stderr: "pipe", stdout: "pipe" });
  const stderr = await new Response(proc.stderr).text();
  await proc.exited;
  return stderr;
}

export async function duration(file: string): Promise<number> {
  const proc = Bun.spawn(
    ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
    { stdout: "pipe" }
  );
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  return Number(out.trim()) || 0;
}

/** Speech spans, derived from where the silences are. */
async function segments(
  file: string,
  total: number,
  profile: (typeof PROFILES)[number]
): Promise<[number, number][]> {
  const log = await ffmpeg([
    "-i", file,
    "-af", `silencedetect=noise=${profile.noise}:d=${profile.d}`,
    "-f", "null", "-",
  ]);
  const silences: [number, number][] = [];
  let start: number | null = null;
  for (const line of log.split("\n")) {
    const begins = line.match(/silence_start:\s*(-?[\d.]+)/);
    const ends = line.match(/silence_end:\s*([\d.]+)/);
    if (begins) start = Math.max(0, Number(begins[1]));
    if (ends && start !== null) {
      silences.push([start, Number(ends[1])]);
      start = null;
    }
  }
  if (start !== null) silences.push([start, total]);

  const speech: [number, number][] = [];
  let cursor = 0;
  for (const [from, to] of silences) {
    if (from - cursor > 0.05) speech.push([cursor, from]);
    cursor = to;
  }
  if (total - cursor > 0.05) speech.push([cursor, total]);
  return speech;
}

/** Three repetitions were requested, so three spans is the honest reading. */
function preference(count: number): number {
  return { 3: 0, 4: 1, 2: 2 }[count] ?? 9;
}

/** Strips the silence around a single utterance, keeping everything spoken. */
export async function trimEdges(
  input: string,
  output: string
): Promise<{ seconds: number; note: string }> {
  const total = await duration(input);
  const speech = await segments(input, total, PROFILES[1]);
  const from = speech.length ? speech[0][0] : 0;
  const to = speech.length ? speech[speech.length - 1][1] : total;
  await ffmpeg([
    "-y", "-ss", String(Math.max(0, from - PAD)), "-to", String(Math.min(total, to + PAD)),
    "-i", input, "-c:a", "libmp3lame", "-b:a", "64k", "-ac", "1", output,
  ]);
  return { seconds: await duration(output), note: "spoken once" };
}

export async function trimSteadiest(
  input: string,
  output: string
): Promise<{ seconds: number; note: string }> {
  const total = await duration(input);
  let best: { span: [number, number]; count: number; rank: number; next: number } | null = null;

  for (const profile of PROFILES) {
    const speech = await segments(input, total, profile);
    const rank = preference(speech.length);
    if (rank === 9) continue;
    if (!best || rank < best.rank) {
      best = {
        span: speech[1],
        count: speech.length,
        rank,
        next: speech[2]?.[0] ?? total,
      };
    }
    if (rank === 0) break; // exactly three: nothing better to find
  }

  let span = best?.span ?? null;
  let note = best ? `cut 2 of ${best.count}` : "cut in thirds";
  // A middle repetition is about a third of the recording. Anything far off
  // means the detector latched onto something else — the thirds are safer.
  if (span && (span[1] - span[0] < 0.12 || span[1] - span[0] > total * 0.7)) {
    span = null;
    note = "cut in thirds (span looked wrong)";
  }
  if (!span) span = [total / 3, (total * 2) / 3];

  const start = Math.max(0, span[0] - PAD);
  const ceiling = Math.min(total, (best?.next ?? total) - GAP);
  const end = Math.max(span[1], Math.min(span[1] + TAIL, ceiling));
  await ffmpeg([
    "-y", "-ss", String(start), "-to", String(end), "-i", input,
    "-c:a", "libmp3lame", "-b:a", "64k", "-ac", "1", output,
  ]);
  return { seconds: await duration(output), note };
}
