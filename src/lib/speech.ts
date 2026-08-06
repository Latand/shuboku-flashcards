import { useSyncExternalStore } from "react";

/*
 * Japanese speech.
 *
 * Voice lists arrive late and unevenly. A Linux desktop publishing every
 * espeak variant through speech-dispatcher hands the browser some fifteen
 * thousand voices, and enumerating them takes seconds; some webviews never
 * fire `voiceschanged` at all. Asking once and giving up after a moment is
 * what produced a dead "no voice" button on a machine that speaks Japanese
 * perfectly well.
 *
 * So discovery lives here, outside React: it starts at boot, keeps looking
 * until voices appear, and survives every screen that mounts and unmounts.
 * The button is disabled only when the engine is missing or an utterance has
 * actually failed — a guess about silence is never enough to disable it.
 */

const POLL_MS = 300;
const GIVE_UP_MS = 15_000;

export interface VoiceStatus {
  /** the Japanese voice to speak with, when the engine offers one */
  voice: SpeechSynthesisVoice | null;
  /** how many voices the engine has published so far */
  count: number;
  /** discovery finished: voices arrived, or the wait ran out */
  settled: boolean;
  /** an utterance failed for real — this engine cannot speak here */
  failed: boolean;
}

let status: VoiceStatus = { voice: null, count: 0, settled: false, failed: false };
const watchers = new Set<() => void>();

function publish(next: Partial<VoiceStatus>): void {
  const merged = { ...status, ...next };
  if (
    merged.voice === status.voice &&
    merged.count === status.count &&
    merged.settled === status.settled &&
    merged.failed === status.failed
  ) {
    return;
  }
  status = merged;
  for (const notify of watchers) notify();
}

function synthesis(): SpeechSynthesis | null {
  return typeof window !== "undefined" && window.speechSynthesis ? window.speechSynthesis : null;
}

export function pickJapaneseVoice(
  voices: readonly SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  const ja = voices.filter((v) => (v.lang || "").toLowerCase().startsWith("ja"));
  if (!ja.length) return null;
  const known = ja.find((v) => /kyoko|otoya|google|nanami|haruka|ayumi/i.test(v.name));
  if (known) return known;
  const preset = ja.find((v) => v.default);
  if (preset) return preset;
  // speech-dispatcher publishes one base voice per language and a long tail of
  // variants named after it ("Japanese+Alex"). The base one is the shortest.
  return [...ja].sort((a, b) => a.name.length - b.name.length)[0];
}

let discovering = false;

export function startVoiceDiscovery(): void {
  if (discovering) return;
  discovering = true;
  const synth = synthesis();
  if (!synth) {
    publish({ settled: true });
    return;
  }

  const deadline = Date.now() + GIVE_UP_MS;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const look = () => {
    const voices = synth.getVoices() ?? [];
    if (voices.length) {
      publish({ voice: pickJapaneseVoice(voices), count: voices.length, settled: true });
    } else if (Date.now() >= deadline) {
      publish({ settled: true });
    } else {
      timer = setTimeout(look, POLL_MS);
      return;
    }
    if (timer) clearTimeout(timer);
    timer = null;
  };

  // The listener stays for the session: engines are free to publish more
  // voices later, and a Japanese one may be among them.
  synth.addEventListener?.("voiceschanged", look);
  look();
}

export function speakJapanese(text: string | undefined): void {
  const synth = synthesis();
  if (!text || !synth) return;
  try {
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP";
    utterance.rate = 0.75;
    utterance.pitch = 1;
    // The list can still be arriving while the first card is on screen.
    const voice = status.voice ?? pickJapaneseVoice(synth.getVoices() ?? []);
    if (voice) utterance.voice = voice;
    utterance.onstart = () => publish({ failed: false });
    utterance.onerror = (e) => {
      // Moving to the next card cancels the previous utterance; that is us.
      const reason = (e as SpeechSynthesisErrorEvent).error;
      if (reason !== "interrupted" && reason !== "canceled") publish({ failed: true });
    };
    synth.speak(utterance);
  } catch {
    publish({ failed: true });
  }
}

function subscribe(notify: () => void): () => void {
  startVoiceDiscovery(); // safe to call again; a screen may mount before boot
  watchers.add(notify);
  return () => {
    watchers.delete(notify);
  };
}

const snapshot = () => status;

export function useJapaneseVoice() {
  const current = useSyncExternalStore(subscribe, snapshot, snapshot);
  return {
    speak: speakJapanese,
    /** a Japanese voice was found; without one the engine still reads the text */
    hasVoice: !!current.voice,
    /** nothing can be spoken here: no engine, or an utterance already failed */
    unavailable: !synthesis() || current.failed,
  };
}
