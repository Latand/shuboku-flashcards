/*
 * Wheel-scroll rescue for webviews that swallow the scroll.
 *
 * Telegram's desktop client hands the page a wheel event and then keeps the
 * scroll for itself, so the page sits frozen under a mouse wheel while every
 * other input still works. Ordinary browsers must not notice this code at all,
 * which rules out scrolling on faith: browsers animate a wheel notch over
 * several frames, so acting early would double every scroll.
 *
 * So the first wheel event that should have moved the page is spent measuring.
 * The verdict is a scroll event, not a scroll position: whether the offset has
 * already changed by the time a wheel listener runs differs between engines,
 * but a page that scrolls always reports it. A quarter of a second later either
 * the page moved — the browser is healthy and the listener goes away for good —
 * or nothing moved at all, and from then on each wheel event is applied here.
 */

/** A wheel notch in line mode, in CSS pixels. */
const LINE_HEIGHT = 16;
/** Long enough for any browser's own wheel animation to have started. */
export const PROBE_MS = 250;
/** A scroll this recently before the wheel event still belongs to it. */
const SCROLL_GRACE_MS = 60;

export function wheelDeltaPixels(
  deltaY: number,
  deltaMode: number,
  viewportHeight: number
): number {
  if (deltaMode === 1) return deltaY * LINE_HEIGHT; // DOM_DELTA_LINE
  if (deltaMode === 2) return deltaY * viewportHeight; // DOM_DELTA_PAGE
  return deltaY;
}

/** True when something between the target and the page can absorb the scroll. */
function innerScrollerHandles(target: EventTarget | null, delta: number): boolean {
  let el = target instanceof Element ? target : null;
  for (; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    const overflowY = getComputedStyle(el).overflowY;
    if (overflowY !== "auto" && overflowY !== "scroll") continue;
    const room = delta > 0 ? el.scrollHeight - el.clientHeight - el.scrollTop : el.scrollTop;
    if (room > 1) return true;
  }
  return false;
}

export function installWheelFallback(): () => void {
  if (typeof window === "undefined") return () => {};

  let phase: "probing" | "measuring" | "rescuing" = "probing";
  let lastScrollAt = 0;

  const onScroll = () => {
    lastScrollAt = Date.now();
  };
  const stop = () => {
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("scroll", onScroll);
  };

  function onWheel(e: WheelEvent) {
    if (phase === "measuring" || e.defaultPrevented || e.ctrlKey) return;
    const delta = wheelDeltaPixels(e.deltaY, e.deltaMode, window.innerHeight);
    if (!delta) return;

    const max = document.documentElement.scrollHeight - window.innerHeight;
    const before = window.scrollY;
    if (max <= 0) return;
    // At the end of the page nothing should move, so nothing can be concluded.
    if (delta > 0 ? before >= max - 1 : before <= 0) return;
    if (innerScrollerHandles(e.target, delta)) return;

    if (phase === "rescuing") {
      window.scrollTo(0, Math.min(max, Math.max(0, before + delta)));
      return;
    }

    const at = Date.now();
    phase = "measuring";
    setTimeout(() => {
      if (lastScrollAt >= at - SCROLL_GRACE_MS) {
        stop(); // this browser scrolls on its own — stay out of its way
        return;
      }
      phase = "rescuing";
    }, PROBE_MS);
  }

  window.addEventListener("wheel", onWheel, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  return stop;
}
