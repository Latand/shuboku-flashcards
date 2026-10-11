import { isPackOn, type Direction, type Progress } from "../../shared/progress";
import { PACKS, type Pack } from "../data/words";
import { cardsLabel } from "../lib/format";
import { countCards } from "../lib/queue";
import type { SyncStatus } from "../lib/sync";

const STATUS_TEXT: Record<SyncStatus, string> = {
  local: "Збережено на цьому пристрої",
  syncing: "Синхронізую…",
  synced: "Синхронізовано з Telegram",
  offline: "Офлайн, синхронізую пізніше",
};

const DIRECTIONS: { value: Direction; label: string }[] = [
  { value: "de-uk", label: "Німецька → українська" },
  { value: "uk-de", label: "Українська → німецька" },
];

function rated(progress: Progress, pack: Pack): number {
  return pack.words.filter((w) => (progress.cards[w.id]?.totalRepetitions ?? 0) > 0).length;
}

interface HomeProps {
  progress: Progress;
  status: SyncStatus;
  onStart(): void;
  onPack(packId: string, on: boolean): void;
  onDirection(direction: Direction): void;
}

export function Home({ progress, status, onStart, onPack, onDirection }: HomeProps) {
  const { due, fresh } = countCards(progress, PACKS, Date.now());
  const ready = due + fresh;
  const mine = PACKS.filter((p) => isPackOn(progress, p.id));
  const others = PACKS.filter((p) => !isPackOn(progress, p.id));

  return (
    <main className="page">
      <header className="masthead">
        <h1 className="title">Wortschatz</h1>
        <p className="subtitle">Німецькі картки для початківців</p>
      </header>

      <section className="panel today" aria-labelledby="today-h">
        <h2 id="today-h" className="label">
          Сьогодні
        </h2>
        <p className="counts">
          <strong>{due}</strong> до повторення <span aria-hidden="true">·</span> <strong>{fresh}</strong> нових
        </p>
        <button type="button" className="btn btn-primary" onClick={onStart} disabled={ready === 0}>
          {ready > 0 ? "Почати" : mine.length === 0 ? "Додай набір" : "На сьогодні все"}
        </button>
      </section>

      <section className="panel" aria-labelledby="dir-h">
        <h2 id="dir-h" className="label">
          Напрямок
        </h2>
        <div className="segmented" role="group" aria-labelledby="dir-h">
          {DIRECTIONS.map((d) => (
            <button
              key={d.value}
              type="button"
              className="seg"
              aria-pressed={progress.settings.direction === d.value}
              onClick={() => onDirection(d.value)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="mine-h">
        <h2 id="mine-h" className="label">
          Мої набори
        </h2>
        {mine.length === 0 ? (
          <p className="empty">Поки порожньо. Додай набір нижче.</p>
        ) : (
          <ul className="packs">
            {mine.map((p) => (
              <PackRow key={p.id} pack={p} progress={progress} action="Прибрати" onAction={() => onPack(p.id, false)} />
            ))}
          </ul>
        )}
      </section>

      {others.length > 0 && (
        <section aria-labelledby="add-h">
          <h2 id="add-h" className="label">
            Додати набір
          </h2>
          <ul className="packs">
            {others.map((p) => (
              <PackRow key={p.id} pack={p} progress={progress} action="Додати" onAction={() => onPack(p.id, true)} />
            ))}
          </ul>
        </section>
      )}

      <p className="sync" role="status">
        {STATUS_TEXT[status]}
      </p>
    </main>
  );
}

function PackRow({
  pack,
  progress,
  action,
  onAction,
}: {
  pack: Pack;
  progress: Progress;
  action: "Додати" | "Прибрати";
  onAction(): void;
}) {
  const done = rated(progress, pack);
  const total = pack.words.length;
  return (
    <li className="pack">
      <div className="pack-body">
        <h3 className="pack-title">{pack.title}</h3>
        <p className="pack-blurb">{pack.blurb}</p>
        <div className="pack-meter">
          <span className="bar" aria-hidden="true">
            <span style={{ width: `${(done / total) * 100}%` }} />
          </span>
          <span className="pack-count">
            {done} / {total} · {cardsLabel(total)}
          </span>
        </div>
      </div>
      <button
        type="button"
        className={action === "Додати" ? "btn btn-small btn-add" : "btn btn-small btn-quiet"}
        onClick={onAction}
        aria-label={`${action}: ${pack.title}`}
      >
        {action}
      </button>
    </li>
  );
}
