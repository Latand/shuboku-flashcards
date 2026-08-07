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
const getKeys = () =>
  new Promise<string[]>((res, rej) => cloud()!.getKeys((e, v) => (e ? rej(e) : res(v ?? []))));

/* ---- read-only rescue ---- */

export interface CloudDump {
  /** every key the account holds for this app, chunk keys or not */
  keys: string[];
  /** what sb_n claims the store spans */
  declared: number | null;
  /** chunk indexes that actually answered, ascending */
  present: number[];
  /** indexes below the highest surviving one that did not answer */
  gaps: number[];
  /** chunk index → contents, exactly as stored */
  parts: Record<number, string>;
  error?: string;
}

/**
 * Everything CloudStorage holds, read without writing a single key.
 *
 * cloudLoad only ever asks for sb_0…sb_(n-1), so a store that shrank leaves
 * chunks above sb_n that nothing reads and nothing deleted — the tail of an
 * older, larger store. getKeys finds those, which is the whole point here.
 */
export interface CloudScan {
  keys: string[];
  declared: number | null;
  indexes: number[];
  /** chunks sitting above what sb_n claims — the tail of a larger, older store */
  orphans: number[];
  error?: string;
}

/** Two calls, no contents: enough to tell whether an older store is stranded. */
export async function cloudScan(): Promise<CloudScan> {
  if (!cloud()) return { keys: [], declared: null, indexes: [], orphans: [] };
  try {
    const keys = await getKeys();
    const indexes = keys
      .filter((k) => k.startsWith(KEY_PREFIX) && /^\d+$/.test(k.slice(KEY_PREFIX.length)))
      .map((k) => Number(k.slice(KEY_PREFIX.length)))
      .sort((a, b) => a - b);
    const nRaw = keys.includes(KEY_COUNT) ? await getItem(KEY_COUNT) : undefined;
    const n = Number(nRaw);
    const declared = nRaw && Number.isFinite(n) ? n : null;
    const orphans = declared == null ? [] : indexes.filter((i) => i >= declared);
    return { keys, declared, indexes, orphans };
  } catch (e) {
    return { keys: [], declared: null, indexes: [], orphans: [], error: String(e).slice(0, 200) };
  }
}

export async function cloudInspect(): Promise<CloudDump> {
  const empty: CloudDump = { keys: [], declared: null, present: [], gaps: [], parts: {} };
  if (!cloud()) return { ...empty, error: "not running inside Telegram" };
  try {
    const { keys, declared, indexes, error } = await cloudScan();
    if (error) return { ...empty, error };

    // getItems takes a list; keep each request small enough to be answered.
    const parts: Record<number, string> = {};
    for (let i = 0; i < indexes.length; i += 40) {
      const batch = indexes.slice(i, i + 40);
      const values = await getItems(batch.map((j) => KEY_PREFIX + j));
      for (const j of batch) {
        const v = values[KEY_PREFIX + j];
        if (v !== undefined) parts[j] = v;
      }
    }

    const present = Object.keys(parts)
      .map(Number)
      .sort((a, b) => a - b);
    const highest = present.length ? present[present.length - 1] : -1;
    const gaps = Array.from({ length: highest + 1 }, (_, i) => i).filter((i) => !(i in parts));
    return { keys, declared, present, gaps, parts };
  } catch (e) {
    return { ...empty, error: String(e).slice(0, 200) };
  }
}

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

/*
 * Only the chunks that actually changed are written.
 *
 * A full collection with its grade history runs to roughly half a megabyte —
 * some 130 chunks — and rewriting all of them after every card would be both
 * slow and a good way to meet Telegram's rate limits. Grading one card changes
 * one or two chunks, so the fingerprints of what was last written are kept and
 * only the differences go up.
 */

/** Telegram allows 1024 keys per user; stay well under, and say so if we don't. */
const MAX_CHUNKS = 900;
const DIGEST_KEY = "sb:cloud-digests";
/** CloudStorage round-trips are slow; a session of grading should not queue up. */
const MIN_INTERVAL_MS = 20_000;

/** Cheap 32-bit fingerprint — enough to tell one chunk's contents from another. */
function digest(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function chunkDigests(parts: readonly string[]): number[] {
  return parts.map(digest);
}

/** Which chunks differ from what the cloud was last told. */
export function changedIndexes(wanted: readonly number[], previous: readonly number[]): number[] {
  return wanted.map((_, i) => i).filter((i) => wanted[i] !== previous[i]);
}

function readDigests(): number[] {
  try {
    const raw = localStorage.getItem(DIGEST_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export interface CloudSyncResult {
  written: number;
  total: number;
  skipped: boolean;
  error?: string;
}

async function cloudSaveNow(json: string): Promise<CloudSyncResult> {
  const parts = splitChunks(json);
  if (!cloud()) return { written: 0, total: parts.length, skipped: true };
  if (parts.length > MAX_CHUNKS) {
    return {
      written: 0,
      total: parts.length,
      skipped: true,
      error: `store needs ${parts.length} cloud keys, over the ${MAX_CHUNKS} this app will use`,
    };
  }
  try {
    const previous = readDigests();
    const wanted = chunkDigests(parts);

    /*
     * With no fingerprints this device has no idea what the cloud holds, and
     * the cloud may well hold more than we are about to write — a device whose
     * browser storage was cleared starts empty and would otherwise flatten the
     * backup of a full collection. Ask what is up there first and refuse.
     */
    if (previous.length === 0) {
      const nRaw = await getItem(KEY_COUNT);
      const declared = Number(nRaw);
      if (nRaw && Number.isFinite(declared) && declared > parts.length) {
        return {
          written: 0,
          total: parts.length,
          skipped: true,
          error: `cloud holds ${declared} chunks and this device only has ${parts.length}; refusing to overwrite — restore from the cloud first`,
        };
      }
    }

    const changed = changedIndexes(wanted, previous);

    for (const i of changed) await setItem(KEY_PREFIX + i, parts[i]);
    if (previous.length !== parts.length) await setItem(KEY_COUNT, String(parts.length));
    // Drop chunks left over from a previously larger store.
    if (previous.length > parts.length) {
      await removeItems(
        Array.from({ length: previous.length - parts.length }, (_, i) => KEY_PREFIX + (parts.length + i))
      );
    }
    localStorage.setItem(DIGEST_KEY, JSON.stringify(wanted));
    return { written: changed.length, total: parts.length, skipped: false };
  } catch (e) {
    // Offline, throttled or out of quota. localStorage still has everything,
    // and the fingerprints are left untouched so the next attempt retries.
    return { written: 0, total: parts.length, skipped: false, error: String(e).slice(0, 120) };
  }
}

let pendingJson: string | null = null;
let cloudTimer: ReturnType<typeof setTimeout> | null = null;
let lastSyncAt = 0;
let lastResult: CloudSyncResult | null = null;

export function lastCloudSync(): CloudSyncResult | null {
  return lastResult;
}

async function flush(): Promise<void> {
  const json = pendingJson;
  if (!json || !cloud()) return;
  pendingJson = null;
  lastSyncAt = Date.now();
  lastResult = await cloudSaveNow(json);
  // A failed write leaves the content pending so the next flush retries it.
  if (lastResult.error && !pendingJson) pendingJson = json;
}

/**
 * Queues the store for the cloud. Writes are spaced out rather than debounced:
 * a long session should still reach the cloud regularly, not only when it ends.
 */
export function cloudSync(json: string): void {
  if (!cloud()) return;
  pendingJson = json;
  if (cloudTimer) return;
  const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastSyncAt));
  cloudTimer = setTimeout(() => {
    cloudTimer = null;
    void flush();
  }, wait);
}

/** Pushes whatever is pending right away — for a closing or backgrounded app. */
export function cloudFlushNow(): void {
  if (cloudTimer) {
    clearTimeout(cloudTimer);
    cloudTimer = null;
  }
  void flush();
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") cloudFlushNow();
  });
  window.addEventListener("pagehide", cloudFlushNow);
}
