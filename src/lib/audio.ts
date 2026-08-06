/*
 * Pre-rendered readings.
 *
 * Every built-in card ships its reading as an audio file, because the browser
 * speech API is not everywhere: the Telegram desktop client embeds a WebKitGTK
 * build without it, and a card there would otherwise be silent. Files win when
 * one exists; anything else — a card you wrote yourself — falls back to the
 * browser voice.
 */

/** Codepoints in hex: a stable, URL-safe filename derived from the reading. */
export function audioKey(text: string): string {
  return [...text].map((c) => c.codePointAt(0)!.toString(16)).join("-");
}

export function audioUrl(text: string): string {
  return `${import.meta.env.BASE_URL || "/"}audio/${audioKey(text)}.mp3`;
}
