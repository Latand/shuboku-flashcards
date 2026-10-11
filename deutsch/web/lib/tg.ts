/*
 * Telegram Mini App setup for Wortschatz. Shuboku's own `initTelegram` paints
 * the header in its ink-black, so this app does the cosmetic calls itself and
 * reuses only the colour-free helpers (haptics, back button, closing prompt).
 */

import { haptics, isTelegram, setClosingConfirmation, setTelegramBack } from "../../../src/lib/telegram";

export const PAPER = "#f4f0e6";

interface WebApp {
  platform: string;
  ready(): void;
  expand(): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  disableVerticalSwipes?(): void;
}

export function initTelegramShell(): void {
  if (!isTelegram) return;
  const wa = (window as unknown as { Telegram?: { WebApp?: WebApp } }).Telegram?.WebApp;
  if (!wa) return;
  try {
    wa.ready();
    wa.expand();
    wa.setHeaderColor(PAPER);
    wa.setBackgroundColor(PAPER);
    // Mobile only: desktop clients have no swipe-to-close, and asking them to
    // suppress vertical gestures stops the mouse wheel from scrolling.
    if (wa.platform === "ios" || wa.platform === "android") wa.disableVerticalSwipes?.();
  } catch {
    /* older client: cosmetic calls only */
  }
}

export { haptics, isTelegram, setClosingConfirmation, setTelegramBack };
