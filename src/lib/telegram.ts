/*
 * Telegram Mini App integration. Everything degrades gracefully:
 * outside Telegram every call is a no-op (haptics fall back to
 * navigator.vibrate where the browser supports it).
 */

type ImpactStyle = "light" | "medium" | "heavy" | "rigid" | "soft";
type NotifyType = "error" | "success" | "warning";

interface TgHaptic {
  impactOccurred(style: ImpactStyle): void;
  notificationOccurred(type: NotifyType): void;
  selectionChanged(): void;
}

interface TgCloudStorage {
  setItem(key: string, value: string, cb?: (err: unknown, ok?: boolean) => void): void;
  getItem(key: string, cb: (err: unknown, value?: string) => void): void;
  getItems(keys: string[], cb: (err: unknown, values?: Record<string, string>) => void): void;
  removeItems(keys: string[], cb?: (err: unknown, ok?: boolean) => void): void;
  getKeys(cb: (err: unknown, keys?: string[]) => void): void;
}

interface TgBackButton {
  show(): void;
  hide(): void;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { user?: { first_name?: string; last_name?: string } };
  platform: string;
  version: string;
  ready(): void;
  expand(): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  enableClosingConfirmation(): void;
  disableClosingConfirmation(): void;
  disableVerticalSwipes?(): void;
  HapticFeedback: TgHaptic;
  CloudStorage?: TgCloudStorage;
  BackButton: TgBackButton;
}

const wa: TelegramWebApp | null =
  typeof window !== "undefined"
    ? ((window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp ?? null)
    : null;

/** True when the app actually runs inside a Telegram client. */
export const isTelegram = !!wa && wa.platform !== "unknown";

export function initTelegram(): void {
  if (!isTelegram || !wa) return;
  try {
    wa.ready();
    wa.expand();
    wa.setHeaderColor("#08070a");
    wa.setBackgroundColor("#08070a");
    // Vertical swipe-to-close would fight the grading slider. Mobile only:
    // desktop clients have no such gesture, and asking them to suppress
    // vertical gestures is what stops the mouse wheel from scrolling.
    if (wa.platform === "ios" || wa.platform === "android") wa.disableVerticalSwipes?.();
  } catch {
    /* older client — cosmetic calls only */
  }

  // Clients older than Bot API 7.7 ignore disableVerticalSwipes and collapse
  // the webview when the page is pulled down from the very top. Block only
  // that exact gesture (downward drag while the window sits at scroll 0);
  // every other touch keeps native scrolling. Mobile clients only: desktop
  // Telegram has no swipe-to-close, and its webview can synthesize touch
  // events from trackpad scrolling, which this guard would swallow.
  if (wa.platform !== "ios" && wa.platform !== "android") return;
  let startY = 0;
  document.addEventListener(
    "touchstart",
    (e) => {
      startY = e.touches[0]?.clientY ?? 0;
    },
    { passive: true }
  );
  document.addEventListener(
    "touchmove",
    (e) => {
      const dy = (e.touches[0]?.clientY ?? 0) - startY;
      if (dy > 5 && window.scrollY <= 0 && e.cancelable) e.preventDefault();
    },
    { passive: false }
  );
}

export function telegramUserName(): string | null {
  return isTelegram ? (wa?.initDataUnsafe.user?.first_name ?? null) : null;
}

/* ---- haptics (Telegram HapticFeedback, navigator.vibrate elsewhere) ---- */

const IMPACT_VIB: Record<ImpactStyle, number> = { light: 10, medium: 20, heavy: 35, rigid: 15, soft: 8 };
const NOTIFY_VIB: Record<NotifyType, number[]> = {
  success: [15, 60, 20],
  error: [45, 60, 45],
  warning: [25, 50, 25],
};

function buzz(tgCall: () => void, fallback: number | number[]): void {
  try {
    if (isTelegram && wa) tgCall();
    else navigator.vibrate?.(fallback);
  } catch {
    /* haptics are best-effort */
  }
}

export const haptics = {
  /** tiny tick — slider steps, toggles */
  selection: () => buzz(() => wa!.HapticFeedback.selectionChanged(), 5),
  /** physical tap — flipping a card, starting a session */
  impact: (style: ImpactStyle = "light") =>
    buzz(() => wa!.HapticFeedback.impactOccurred(style), IMPACT_VIB[style]),
  /** verdicts — grades, session complete */
  notify: (type: NotifyType) =>
    buzz(() => wa!.HapticFeedback.notificationOccurred(type), NOTIFY_VIB[type]),
};

/* ---- native back button ---- */

let backHandler: (() => void) | null = null;

export function setTelegramBack(visible: boolean, cb: () => void): void {
  if (!isTelegram || !wa) return;
  try {
    if (backHandler) wa.BackButton.offClick(backHandler);
    backHandler = cb;
    wa.BackButton.onClick(cb);
    if (visible) wa.BackButton.show();
    else wa.BackButton.hide();
  } catch {
    /* back button unsupported */
  }
}

export function setClosingConfirmation(on: boolean): void {
  if (!isTelegram || !wa) return;
  try {
    if (on) wa.enableClosingConfirmation();
    else wa.disableClosingConfirmation();
  } catch {
    /* unsupported */
  }
}

/* ---- CloudStorage sync (values are capped at 4096 chars → chunk) ---- */

export const CHUNK_SIZE = 3800;
const KEY_COUNT = "sb_n";
const KEY_PREFIX = "sb_";

export function splitChunks(s: string, size = CHUNK_SIZE): string[] {
  const parts: string[] = [];
  for (let i = 0; i < s.length; i += size) parts.push(s.slice(i, i + size));
  return parts.length ? parts : [""];
}

export function joinChunks(values: Record<string, string>, n: number): string | null {
  let out = "";
  for (let i = 0; i < n; i++) {
    const part = values[KEY_PREFIX + i];
    if (part === undefined) return null; // a chunk went missing — treat as no data
    out += part;
  }
  return out;
}

const cloud = () => (isTelegram ? (wa?.CloudStorage ?? null) : null);

const setItem = (k: string, v: string) =>
  new Promise<void>((res, rej) => cloud()!.setItem(k, v, (e) => (e ? rej(e) : res())));
const getItem = (k: string) =>
  new Promise<string | undefined>((res, rej) =>
    cloud()!.getItem(k, (e, v) => (e ? rej(e) : res(v)))
  );
const getItems = (ks: string[]) =>
  new Promise<Record<string, string>>((res, rej) =>
    cloud()!.getItems(ks, (e, v) => (e ? rej(e) : res(v ?? {})))
  );
const removeItems = (ks: string[]) =>
  new Promise<void>((res, rej) => cloud()!.removeItems(ks, (e) => (e ? rej(e) : res())));

export async function cloudLoad(): Promise<string | null> {
  if (!cloud()) return null;
  try {
    const nRaw = await getItem(KEY_COUNT);
    const n = Number(nRaw);
    if (!nRaw || !Number.isFinite(n) || n < 1) return null;
    const keys = Array.from({ length: n }, (_, i) => KEY_PREFIX + i);
    return joinChunks(await getItems(keys), n);
  } catch {
    return null;
  }
}

async function cloudSaveNow(json: string): Promise<void> {
  if (!cloud()) return;
  try {
    const parts = splitChunks(json);
    await Promise.all(parts.map((p, i) => setItem(KEY_PREFIX + i, p)));
    await setItem(KEY_COUNT, String(parts.length));
    // Drop chunks left over from a previously larger store.
    const prev = Number(sessionStorage.getItem("sb:cloud-chunks") ?? 0);
    if (prev > parts.length) {
      await removeItems(
        Array.from({ length: prev - parts.length }, (_, i) => KEY_PREFIX + (parts.length + i))
      );
    }
    sessionStorage.setItem("sb:cloud-chunks", String(parts.length));
  } catch {
    /* offline or quota — localStorage still has everything */
  }
}

let cloudTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced cloud sync — CloudStorage round-trips are slow, batch them. */
export function cloudSaveDebounced(json: string): void {
  if (!cloud()) return;
  if (cloudTimer) clearTimeout(cloudTimer);
  cloudTimer = setTimeout(() => void cloudSaveNow(json), 1500);
}
