/*
 * Pre-rendered readings.
 *
 * Every built-in card ships its reading as an audio file, because the browser
 * speech API is not everywhere: the Telegram desktop client embeds a WebKitGTK
 * build without it, and a card there would otherwise be silent. Files win when
 * one exists; anything else — a card you wrote yourself — falls back to the
 * browser voice.
 *
 * The clips live in the repository but outside the deployed bundle, and are
 * served from jsDelivr instead. Including them in the Pages artifact made every
 * deployment sit in the queue until it timed out — four attempts, while the
 * same commit without the audio published in two minutes. jsDelivr serves any
 * public repository, so nothing new has to be hosted or paid for, and a URL
 * pinned to a tag is cached as immutable.
 */

const REPO = "Latand/shuboku-flashcards";
/** Bump when the clips change; the tag is what makes the CDN copy immutable. */
export const AUDIO_TAG = "audio-v1";

/** Codepoints in hex: a stable, URL-safe filename derived from the reading. */
export function audioKey(text: string): string {
  return [...text].map((c) => c.codePointAt(0)!.toString(16)).join("-");
}

export function audioUrl(text: string): string {
  return `https://cdn.jsdelivr.net/gh/${REPO}@${AUDIO_TAG}/audio/${audioKey(text)}.mp3`;
}
