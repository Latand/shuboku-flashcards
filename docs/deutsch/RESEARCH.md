# Wortschatz: німецькі картки на Telegram Serverless (tgcloud). Дослідження і дизайн

## 0. Вихідна вимога

Оператор, 2026-10-11, голосове повідомлення оркестратору в Telegram (транскрипт дослівно, російсько-українська мова):

> «https://github.com/aiogram/tgcloud-grammy Пробуй. Попробуй подготовить на основе вот этого, э-э, проект. То есть попробую мигрировать, ну, как подготовить проект, который у нас будет использовать вот этот серверлес. Можно ли его полностью здесь, э-э, сделать и, например, поднять второй... второе приложение? Каким-то образом? Где будет обучаться немецкому языку, а уже не японскому. То есть немножко стиль другой. И позакидывать там базовых слов, таких, э-э, самого базового, и, может быть, даже где-то озвучку, если получится сделать. Ну, для начала просто слова. То есть мне нужно немецкое, чуть-чуть, немножко другой стиль, и вот эту штуку использовать. Нужна исследование. Если всё окей, то можно прямо делать сразу.»

Того ж дня оператор додав скриншот із підписом «И вот такие слова». На ньому шкільна таблиця (особисте листування навколо неї в документ не переноситься):

- «Особові займенники»: ich – я, du – ти, er – він, sie – вона, es – воно, wir – ми, ihr – ви (група або клас), sie – вони, Sie – Ви (ввічлива форма);
- «sein – бути»: ich bin, du bist, er/sie/es ist, wir sind, ihr seid, sie/Sie sind.

Уточнення оператора (2026-10-11, через оркестратора): ці два набори мають бути окремими наборами, першими в каталозі; переклади займенників дослівно як на аркуші; картки sie (вона) / sie (вони) / Sie (Ви) треба зробити розв’язними (підказка або форма дієслова, «sie ist» проти «sie sind»); для відмінювання потрібен зрозумілий формат, наприклад «wir … (sein)» → «sind», за можливості в обох напрямках. Учень — шкільний початківець, тож решта базових слів того ж рівня.

Значення за замовчуванням від оркестратора (оператор може їх змінити): окремий застосунок у цьому репозиторії; Shuboku, його збірка, workflow GitHub Pages і адреса https://latand.github.io/shuboku-flashcards/ працюють без змін; інтерфейс українською; близько 150 слів рівня A1 у кількох наборах, іменники з артиклем і множиною; інший вигляд; бот на grammY, чий /start відкриває Mini App; синхронізація прогресу через endpoint і базу tgcloud; навчання працює локально, коли бекенд недоступний або сторінку відкрито поза Telegram; озвучка поза цим етапом, тут лише шлях до неї.

## 1. Коротко

- **Так, усе можна зробити тут.** tgcloud тепер хостить і бота, і бекенд Mini App (endpoints + SQLite), і саму статику Mini App на `https://app<app_id>.tgcloud.ai/` ([S1] «Recent changes, October 6, 2026»). Код другого застосунку лежить у цьому репозиторії в `deutsch/`, з окремим `package.json` і власною збіркою.
- **Фронтенд хостить tgcloud.** `Telegram.WebApp.Serverless.call` шле запит на відносний шлях `/api/<name>` того самого хоста ([S4]), тож endpoint досяжний лише зі сторінки, яку віддає tgcloud. Копія на GitHub Pages відкладена.
- **Від Shuboku беремо три чисті модулі імпортом:** `src/lib/scheduler.ts` (FSRS), `src/lib/telegram.ts` (вібрація, кнопка «Назад»), `src/lib/scroll.ts` (колесо миші в Telegram Desktop). Shuboku не змінюється; у корені додаються лише `bunfig.toml` (2 рядки) і новий workflow.
- **Синхронізація:** один рядок JSON на користувача в таблиці `progress`, один endpoint `sync`, злиття «по ключу, новіший виграє», яке ніколи не стирає прогрес.
- **Стартові слова:** 13 наборів, 167 карток рівня шкільного початківця. Першими в каталозі йдуть два набори з аркуша оператора: «Особові займенники» (переклади дослівно) і «sein – бути» (картки-пропуски «wir … (sein)» → «wir sind»). Далі `haben`, привітання, числа, кольори, сім’я, школа, тварини, їжа, дім та іграшки, дієслова, прикметники.
- **Стиль:** світлий «зошит у клітинку» з кольорами артиклів (der синій, die червоний, das зелений). Три варіанти опубліковано на рев’ю.
- **Офлайн-збірка перевірена:** прототип у scratch-теці пройшов typecheck бота, `tgcloud-grammy build`, `vite build`, `tgcloud status` без логіна і без токена (§13).
- **Оператор робить сам:** бот у BotFather, увімкнення Serverless, `npx tgcloud login`, перший `bun run deploy`, `npx tgcloud migrate`, кнопка меню в BotFather, за бажанням секрет `TGCLOUD_TOKEN` для CI (§11).

## 2. Що дає tgcloud (спостережено, з джерелами)

| Можливість | Статус | Джерело |
|---|---|---|
| Обробники оновлень `handlers/<update_type>.js`, по файлу на тип; оновлення без файлу ігноруються | є | [S1] «Handlers», [S2] README «Layout» |
| Endpoints Mini App `endpoints/<name>.js` → `POST /api/<name>`; платформа перевіряє initData і відкидає виклик без неї з 401 до запуску коду; `ctx.initData.user` можна довіряти | є | [S1] «Endpoints» |
| Відмова з endpoint тільки через `EndpointError(description, parameters)`; інші винятки → загальна помилка 500, текст лише в логах | є | [S1], [S2] `types/sdk.d.ts` |
| Клієнт: `Telegram.WebApp.Serverless.call(name, input, cb)` з `telegram-web-app.js`; `fetch('/api/' + name)` з заголовком `Authorization: TMA <base64(initData)>`; без initData кидає `WebAppServerlessInitDataUnavailable` синхронно | є | [S4] рядки 2474–2559 |
| Хостинг статики Mini App: `tgcloud.jsonc` → `"static": { "source": "dist", "spa", "immutable", "headers", "redirects" }`; сайт з кореня хоста; `/api/` зарезервовано; `push` сам не збирає фронтенд; файли з крапкою пропускаються | є | [S1] «Mini App front-end», [S3] `schema/tgcloud.json` |
| База: SQLite на бота, переживає виклики; DSL у стилі Drizzle (`table`, `integer`, `text`, `json`, …), `onConflictDoUpdate`, `.returning()`, сирий SQL | є | [S1] «The database», [S2] `types/sdk.d.ts` |
| Міграції окремо від деплою: `push` схему не застосовує, `migrate` класифікує зміни (safe / warning / manual), `--safe` для CI | є | [S1] «Migrations» |
| Зовнішній HTTP лише через `fetch` з `sdk`, відповідь до 30 MB | є | [S1] «HTTP» |
| Bot API повністю через `api.<method>()`, токен бота тримає платформа | є | [S1] «The Bot API» |
| grammY на платформі: `createBot()` без токена, `toHandler(bot, 'message')`, сесії в базі `dbStorage` | є (перевірено автором пакета через `tgcloud run`) | [S2] README «grammY», CLAUDE.md |
| `tgcloud-grammy build`: TypeScript + npm-пакети → `tgcloud/`; esbuild, без мережі і без токена; ключ `--src` задає теку з кодом | є, перевірено в прототипі | [S2] `src/cli.ts`, §13 |
| Вебхук керує платформа; `tgcloud webhook sync` вирівнює `allowed_updates` | є | [S1] «webhook» |
| Деплой з CI через змінну `TGCLOUD_TOKEN` (`app<id>:<secret>`, окремий від токена бота) | є | [S1] «Authentication», [S2] `templates/github-deploy.yml` |

**Які команди потребують логіна** (спостережено в коді `@tgcloud/cli@0.2.0` [S3] і перевірено запуском):

- без токена: `tgcloud init` (опис команди: «local scaffolding only»), `add`, `status`, `diff`, а також `tgcloud-grammy build|init|add`;
- з токеном: `push`, `run`, `migrate`, `fetch`, `pull`, `webhook` (усі викликають `resolveToken()`, який без `TGCLOUD_TOKEN` і без `.tgcloud/credentials` завершує команду помилкою «No CLI access token found»);
- `login` питає токен лише в інтерактивному терміналі.

Коренем проєкту CLI вважає найближчу теку з `.tgcloud/` вгору від поточної ([S3] `src/core/project-root.js`). Без неї команди працюють у поточній теці. Тому всі команди tgcloud запускаються з `deutsch/`.

## 3. Чого tgcloud не має або що не задокументовано

| Прогалина | Що це означає для дизайну | Джерело |
|---|---|---|
| Ліміти CPU, пам’яті, часу виконання, розміру запиту до endpoint, обсягу бази і статики, ціни не опубліковані | тримаємо запит `sync` до 512 KB і перевіряємо це на сервері; аудіо не кладемо в першу версію | [S1] (немає розділу про ліміти), [S2] CLAUDE.md «Not yet verified: size, CPU and time limits» |
| Немає API для секретів і змінних оточення | ключ Soniox не можна тримати в endpoint; озвучка лише як готові mp3 (§12) | [S2] README «No secrets/env API is documented by the platform yet» |
| Немає таймерів, `URL`, `atob`, `Buffer`, глобального `fetch`, динамічного `import()`, вбудованих модулів Node | код бота пишемо без них; typecheck з пресетом пакета це ловить | [S2] README «Runtime rules», `types/sdk.d.ts` |
| Немає зовнішніх ключів у базі, немає документованих транзакцій | один рядок на користувача; злиття, що сходиться при повторах (§7) | [S1] «No foreign keys» |
| Немає локального рантайму | endpoint і бот перевіряються після деплою; логіку виносимо в чисті функції з тестами | [S2] CLAUDE.md «there is no local runtime» |
| Немає cron | нагадування «пора повторити» з бота відкладені | [S1] (не згадано) |
| Чи віддає `app<id>.tgcloud.ai` сторінку поза Telegram, не перевірено (потрібен деплой) | навчання локальне і так працює; синхронізація лише в Telegram | — |
| Чи збігається `<id>` у токені з `<app_id>` у URL, не перевірено | бот бере URL Mini App з кнопки меню через `getChatMenuButton` і нічого не вгадує (§8) | — |
| Пресет `@aiogram/tgcloud-grammy/tsconfig.json` має `target`/`lib` ES2025: TypeScript 5.9.3 його відкидає (TS6046), TypeScript 6.0.3 приймає | у `deutsch/` TypeScript `~6.0.3`; Shuboku лишається на своєму 5.x | спостережено в прототипі |

## 4. Фронтенд: tgcloud чи GitHub Pages

Рішення: німецький фронтенд хостить tgcloud разом із ботом, одним `push`.

Причини:

1. `Serverless.call` звертається до `/api/<name>` на тому ж хості ([S4]). Сторінка з `latand.github.io` полетіла б на `latand.github.io/api/sync` і отримала 404. Ручний крос-доменний `fetch` на `app<id>.tgcloud.ai/api/sync` вимагав би CORS, а про CORS платформа нічого не каже. Дизайн, що спирається лише на задокументовану поведінку, отже, тримає фронтенд на tgcloud.
2. Оператор питав, чи можна зробити «полностью здесь». З хостингом на tgcloud увесь застосунок (статика, бот, бекенд, база) живе на одній платформі.
3. Workflow GitHub Pages у Shuboku публікує один артефакт `dist`. Додати туди другий застосунок означало б міняти робочий деплой Shuboku. Цього уникаємо.

Vite лишає `base: "/"` за замовчуванням, бо tgcloud віддає сайт із кореня хоста ([S1]).

## 5. Архітектура і розкладка

```
shuboku-flashcards/
├─ src/ … index.html, vite.config.ts, package.json, bun.lock   ← Shuboku, без змін
├─ bunfig.toml                ← НОВЕ: [test] root = "./src" (кореневий bun test бачить лише тести Shuboku)
├─ .github/workflows/
│  ├─ deploy.yml              ← Shuboku → GitHub Pages, без змін
│  └─ deutsch.yml             ← НОВЕ: тести + збірка Wortschatz; деплой у tgcloud, лише коли є секрет TGCLOUD_TOKEN
├─ docs/deutsch/RESEARCH.md   ← цей документ
└─ deutsch/                   ← НОВЕ: проєкт tgcloud (тут з’являються .tgcloud/ і tgcloud/)
   ├─ package.json, bun.lock  ← власні залежності, TypeScript ~6.0.3
   ├─ .gitignore              ← .tgcloud/  /tgcloud/  dist/  node_modules/
   ├─ tgcloud.jsonc           ← static → dist
   ├─ README.md               ← запуск, збірка, деплой (українською)
   ├─ index.html, vite.config.ts, tsconfig.json
   ├─ web/                    ← Mini App (React 18)
   │  ├─ main.tsx, App.tsx, styles.css
   │  ├─ data/words.ts        ← набори і слова
   │  ├─ lib/queue.ts         ← черга сесії
   │  ├─ lib/format.ts        ← «завтра», «4 дні», «9 днів»
   │  ├─ lib/tg.ts            ← ініціалізація Telegram, обгортка Serverless.call
   │  ├─ lib/sync.ts          ← localStorage + синхронізація
   │  └─ screens/Home.tsx, Study.tsx
   ├─ shared/progress.ts      ← модель прогресу, злиття, валідація (спільне для web і bot)
   └─ bot/                    ← вихідний код для tgcloud-grammy (--src bot)
      ├─ tsconfig.json        ← extends @aiogram/tgcloud-grammy/tsconfig.json
      ├─ schema.ts            ← таблиця progress
      ├─ lib/bot.ts           ← grammY: /start
      ├─ handlers/message.ts  ← toHandler(bot, 'message')
      └─ endpoints/sync.ts    ← POST /api/sync
```

Чому тека `bot/`: типовий для tgcloud-grammy `src/` у теці з фронтендом змішав би два рантайми з різними `tsconfig` (DOM проти голого V8). `tgcloud-grammy build --src bot` це підтримує ([S2] `src/cli.ts`, перевірено). `shared/progress.ts` лежить поза `bot/{handlers,endpoints,lib}`, тож збірка вбудовує його в `endpoints/sync.js` (перевірено в прототипі).

Чому не запускати `tgcloud init` / `tgcloud-grammy init` у `deutsch/`: `tgcloud-grammy init` кладе власний `tsconfig.json` для `src/` і скрипт `deploy: tsc && …`, які не підходять до розкладки з `web/` і `bot/`. Достатньо вручну написати `tgcloud.jsonc` і `.gitignore` (вміст у §16). `AGENTS.md` і `docs/tgcloud-sdk.md`, які генерує `tgcloud init`, описують JS-розкладку `tgcloud/` і в TypeScript-проєкті вводили б в оману.

## 6. Повторне використання коду Shuboku без поломки Shuboku

| Модуль Shuboku | Як використовуємо | Чому |
|---|---|---|
| `src/lib/scheduler.ts` | імпорт `../../src/lib/scheduler` | чистий FSRS-6 на `ts-fsrs`, одне джерело правди для інтервалів |
| `src/lib/telegram.ts` | імпорт лише `haptics`, `setTelegramBack`, `setClosingConfirmation`, `isTelegram` | без даних Shuboku; `initTelegram` не імпортуємо, бо в ньому зашиті кольори `#08070a` |
| `src/lib/scroll.ts` | імпорт `installWheelFallback` | виправлення колеса миші в Telegram Desktop |
| `src/lib/storage.ts`, `insights.ts`, `store.tsx`, `screens/*`, `speech.ts`, `audio.ts`, `salvage.ts` | не імпортуємо | тягнуть японські набори (`data/packs.ts`), класи CSS `sb-*` або японську озвучку |

Перевірено в прототипі: з імпортом `insights.ts` у бандл потрапили японські дані (8 збігів `hiragana`/`seion`), з трьома модулями вище збігів 0 і кольору `#08070a` теж 0.

Як це розв’язується залежностями:

- `ts-fsrs` береться лише з кореневого `node_modules` (його ставить кореневий `bun install`), тому в бандлі одна копія і та сама версія 5.4.1, що в Shuboku. У `deutsch/package.json` `ts-fsrs` не додаємо. Прототип зібрався й пройшов тести саме так.
- Vite dev-сервер за замовчуванням не віддає файли поза `deutsch/`, тож потрібен `server.fs.allow: [".."]` (перевірено: `/@fs/.../src/lib/scheduler.ts` → 200).
- Тести `deutsch/` запускаються з `deutsch/`. Кореневий `bun test` інакше знайшов би і їх (перевірено: Bun шукає `*.test.ts` у всіх підтеках), а в CI Shuboku немає `deutsch/node_modules`. Кореневий `bunfig.toml` з `[test] root = "./src"` обмежує кореневий запуск тестами Shuboku. На експорті коміту 8ac5b47: без нього і з ним однаково 86 тестів у 9 файлах проходять, `bun run build` проходить.
- Зміна в трьох модулях Shuboku може зламати Wortschatz. Workflow `deutsch.yml` запускається на зміну цих файлів і ганяє тести Wortschatz.

## 7. Модель даних і синхронізація прогресу

### Клієнт

`localStorage["wortschatz:v1"]` зберігає один об’єкт:

```ts
// deutsch/shared/progress.ts
import type { CardState } from "../../src/lib/scheduler";   // лише тип: у бандл бота не потрапляє (перевірено)

export type Direction = "de-uk" | "uk-de";
export interface PackFlag { on: boolean; at: number }        // at = epoch ms зміни; 0 = значення за замовчуванням
export interface Progress {
  version: 1;
  packs: Record<string, PackFlag>;                           // packId → додано / прибрано
  cards: Record<string, CardState>;                          // cardId → стан FSRS; запис з’являється після першої оцінки
  settings: { direction: Direction; at: number };
}

export function emptyProgress(): Progress;                   // pronomen і sein увімкнені з at: 0, direction "de-uk", at: 0
export function cardChangedAt(s: CardState): number;         // остання history[].at, інакше lastReview, інакше 0
export function mergeProgress(a: Progress | null, b: Progress): Progress;
export function parseProgress(x: unknown): Progress | null;  // для сервера і localStorage; биті записи відкидає
```

Картки без запису в `cards` вважаються новими. Стан для них не створюється заздалегідь, тож запити менші і злиттю нема чого порівнювати.

### Правила злиття (кожен ключ окремо, новіший виграє)

| Поле | Правило | Нічия |
|---|---|---|
| `cards[id]` | більший `cardChangedAt` | більший `totalRepetitions`, далі порівняння `JSON.stringify` |
| `packs[id]` | більший `at` | `on: true` |
| `settings` | більший `at` | порівняння рядка `direction` |
| ключ лише з одного боку | береться як є | — |

Чому `cardChangedAt` дивиться на `history`: для оцінки 6 `review()` у Shuboku оновлює `history` і `intervalStart`, а `lastReview` лишає старим (`src/lib/scheduler.ts:182-191`).

Властивості, які покривають тести: `merge(a, b) = merge(b, a)`; `merge(a, a) = a`; асоціативність; жоден ключ не зникає; новіший стан картки ніколи не замінюється старішим; `merge(повний, emptyProgress())` = повний. Остання властивість закриває відомий ризик Shuboku: пристрій з очищеним сховищем починає з порожнього стану і міг би затерти хмарну копію (коментарі в `src/lib/telegram.ts:355-372`, коміт 48a9ff8 «Read a lost collection back out of Telegram's cloud»).

### Сервер

```ts
// deutsch/bot/schema.ts
import { table, integer, json } from 'sdk/db';
import type { Progress } from '../shared/progress.js';
export const progress = table('progress', {
  userId: integer('user_id').primaryKey(),       // Telegram user id з перевіреної initData
  data: json<Progress>('data').notNull(),
  updatedAt: integer('updated_at').notNull(),    // epoch ms
});
```

`POST /api/sync` (`deutsch/bot/endpoints/sync.ts`), вхід `{ progress: unknown }`:

1. `user = ctx.initData.user`; без нього `EndpointError('…', { code: 'NO_USER' })`.
2. `JSON.stringify(input).length > 512_000` → `EndpointError(…, { code: 'TOO_LARGE' })`.
3. `incoming = parseProgress(input.progress)`; `null` → `EndpointError(…, { code: 'BAD_INPUT' })`.
4. Прочитати рядок користувача; `merged = mergeProgress(row?.data ?? null, incoming)`.
5. Якщо рядка нема або `merged` відрізняється від `row.data`, записати (`insert … onConflictDoUpdate`).
6. Повернути `{ progress: merged, serverTime: Date.now() }` (лише числа, без `Date`, бо `Date` приходить у Mini App як `{}` [S2]).

Чому один JSON-рядок на користувача: 167 карток, найгірший випадок близько 290 KB (167 × 50 записів історії × ~30 байт + стани), і злиття живе в коді. Рядок на картку означав би пакетні записи під лімітом змінних SQLite ([S1]) і злиття в SQL.

Конкурентні виклики з двох пристроїв без транзакції можуть перезаписати один одного. Клієнт завжди шле повний стан і зливає відповідь зі своїм, тож наступна синхронізація відновлює втрачене: злиття сходиться за будь-якого порядку.

### Коли клієнт синхронізується

- `web/lib/tg.ts` експортує `callEndpoint<T>(name, input)`: якщо `Telegram.WebApp.initData` порожній або немає `Serverless`, одразу відхиляє з `outside-telegram`; виклик `Serverless.call` у `try/catch`; тайм-аут 15 с.
- `web/lib/sync.ts`: `createSync({ call, load, save, now })` з `start()`, `changed(progress)`, `flush()` і статусом `local | syncing | synced | offline`. `call` передається ззовні, щоб тестувати без платформи.
- Синхронізація при старті (якщо в Telegram), після оцінки чи зміни набору (не частіше ніж раз на 15 с) і негайно на `visibilitychange → hidden` та `pagehide`.
- Відповідь сервера: `local = mergeProgress(response.progress, поточнийLocal)`, зберегти, перемалювати.
- Помилка або тайм-аут: стан лишається локальним, статус `offline`, повтор на наступній зміні чи поверненні на вкладку.
- Тексти статусу: «збережено на цьому пристрої» (поза Telegram), «синхронізую…», «синхронізовано з Telegram», «офлайн, синхронізую пізніше».

## 8. Бот

- `bot/lib/bot.ts`: `createBot()`; `bot.command('start', …)`:
  - у приватному чаті викликає `ctx.api.getChatMenuButton({ chat_id: ctx.chat.id })`; якщо тип `web_app`, відповідає «Привіт! Тут німецькі картки: займенники, числа, перші слова.» з inline-кнопкою `{ text: 'Відкрити картки', web_app: { url: button.web_app.url } }`;
  - інакше (кнопку меню ще не налаштовано або чат груповий) відповідає текстом без кнопки: «Застосунок відкривається кнопкою меню біля поля вводу».
- Так бот не тримає в коді `app<id>` і не залежить від припущення про збіг `<id>` у токені й URL. Єдине джерело адреси Mini App: кнопка меню, яку оператор ставить у BotFather.
- `bot/handlers/message.ts`: `export default toHandler(bot, 'message')`. Інших типів оновлень боту не треба.
- Ручна перевірка після деплою: `npx tgcloud run handlers/message '{ chat: { id: <ваш chat id>, type: "private" }, from: { id: <ваш id>, is_bot: false, first_name: "Test" }, text: "/start", entities: [{ type: "bot_command", offset: 0, length: 6 }], message_id: 1, date: 0 }'`. Без `entities` grammY не розпізнає команду.

## 9. Стартовий список слів

Рівень: шкільний початківець. Перші два набори оператор узяв зі шкільного аркуша (§0) і просив поставити їх окремими наборами, першими в каталозі; переклади займенників дослівно як на аркуші. Решта слів з тих самих перших шкільних уроків німецької: привітання, числа, кольори, сім’я, школа, тварини, їжа, дім, прості дієслова і прикметники. Слова дорослого побуту (квартира, ключ, кава, працювати, купувати) у список не входять.

Модель (у `deutsch/web/data/words.ts`):

```ts
export type Article = "der" | "die" | "das";
export type Pos = "noun" | "verb" | "adj" | "pron" | "num" | "phrase" | "form";
export interface Word {
  id: string;              // "<packId>:<slug>", [a-z0-9-] після двокрапки; НЕЗМІННИЙ: прогрес прив’язаний до нього
  de: string;              // без артикля: "Apfel", "Guten Morgen!"; для "form" повна форма: "wir sind"
  uk: string;              // "яблуко"; займенники дослівно як на аркуші: "ви (група або клас)"
  pos: Pos;
  article?: Article;       // обов’язковий для "noun", заборонений для інших
  plural?: string | null;  // лише "noun": множина без артикля; null = «зазвичай без множини»
  cloze?: string;          // обов’язковий для "form" і лише там: німецький лицьовий бік з пропуском, "wir … (sein)"
  deHint?: string;         // видно лише тоді, коли лицьовий бік німецький
  ukHint?: string;         // видно лише тоді, коли лицьовий бік український
  note?: string;           // на звороті: "er isst", "-chen завжди das"
}
export interface Pack { id: string; title: string; blurb: string; words: Word[] }
```

Як картка показується:

| pos | `de-uk`: лицьовий бік → зворот | `uk-de`: лицьовий бік → зворот |
|---|---|---|
| `noun` | `der Apfel` (артикль кольором роду) → «яблуко», «мн.: die Äpfel» | «яблуко» + «der / die / das?» → `der Apfel`, множина |
| `form` | `wir … (sein)` → `wir sind` (форма дієслова виділена) + «ми є» | «ми є» + `ukHint` «sein» → `wir sind` |
| решта | `de` (+ `deHint`) → `uk` + `note` | `uk` (+ `ukHint`) → `de` + `note` |

Обидва напрямки для `form` тренують те саме: назвати форму дієслова. У `uk-de` іменник вимагає згадати рід, найважче в німецькій для початківця.

Підказки розрізняють однакові лицьові боки. Кожна показується лише з того боку, де без неї картка двозначна, тож відповіді вона не видає. Так `sie` / `sie` / `Sie` розв’язні:

- `de-uk`: «sie» + «sie ist …» → вона; «sie» + «sie sind …» → вони; «Sie» + «з великої літери: Sie sind …» → Ви (ввічлива форма);
- `uk-de`: «вона», «вони», «Ви (ввічлива форма)», «ви (група або клас)» різні й без підказок.

Апостроф в українських словах: `’` (U+2019) скрізь. Набори `pronomen` і `sein` увімкнені за замовчуванням (`emptyProgress`), решту користувач додає сам. Порядок у каталозі — як нижче.

**1. `pronomen` — «Особові займенники» (9, pos `pron`)** — з аркуша оператора, `uk` дослівно

| id | de | uk | deHint | note |
|---|---|---|---|---|
| pronomen:ich | ich | я | | ich bin |
| pronomen:du | du | ти | | du bist |
| pronomen:er | er | він | | er ist |
| pronomen:sie-sg | sie | вона | sie ist … | |
| pronomen:es | es | воно | | es ist |
| pronomen:wir | wir | ми | | wir sind |
| pronomen:ihr | ihr | ви (група або клас) | | ihr seid |
| pronomen:sie-pl | sie | вони | sie sind … | |
| pronomen:sie-formal | Sie | Ви (ввічлива форма) | з великої літери: Sie sind … | завжди з великої літери |

**2. `sein` — «sein – бути» (6, pos `form`)** — з аркуша оператора. Blurb: «Теперішній час. Українською «є» часто пропускають: Ich bin Anna — Я Анна.» `ukHint` у всіх карток: «sein».

| id | cloze | de | uk |
|---|---|---|---|
| sein:ich-bin | ich … (sein) | ich bin | я є |
| sein:du-bist | du … (sein) | du bist | ти є |
| sein:er-ist | er/sie/es … (sein) | er/sie/es ist | він/вона/воно є |
| sein:wir-sind | wir … (sein) | wir sind | ми є |
| sein:ihr-seid | ihr … (sein) | ihr seid | ви є (група або клас) |
| sein:sie-sind | sie/Sie … (sein) | sie/Sie sind | вони є / Ви є |

**3. `haben` — «haben – мати» (6, pos `form`)**, той самий формат, `ukHint` «haben».

| id | cloze | de | uk |
|---|---|---|---|
| haben:ich-habe | ich … (haben) | ich habe | я маю |
| haben:du-hast | du … (haben) | du hast | ти маєш |
| haben:er-hat | er/sie/es … (haben) | er/sie/es hat | він/вона/воно має |
| haben:wir-haben | wir … (haben) | wir haben | ми маємо |
| haben:ihr-habt | ihr … (haben) | ihr habt | ви маєте (група або клас) |
| haben:sie-haben | sie/Sie … (haben) | sie/Sie haben | вони мають / Ви маєте |

**4. `hallo` — «Привітання» (18, pos `phrase`)**

| id | de | uk | note |
|---|---|---|---|
| hallo:hallo | Hallo! | Привіт! | |
| hallo:guten-morgen | Guten Morgen! | Доброго ранку! | |
| hallo:guten-tag | Guten Tag! | Добрий день! | |
| hallo:guten-abend | Guten Abend! | Добрий вечір! | |
| hallo:gute-nacht | Gute Nacht! | На добраніч! | |
| hallo:tschuess | Tschüss! | Бувай! | |
| hallo:auf-wiedersehen | Auf Wiedersehen! | До побачення! | |
| hallo:danke | Danke! | Дякую! | |
| hallo:bitte | Bitte! | Будь ласка! | ще й «прошу» у відповідь на «дякую» |
| hallo:ja | ja | так | |
| hallo:nein | nein | ні | |
| hallo:entschuldigung | Entschuldigung! | Вибачте! | |
| hallo:wie-gehts | Wie geht's? | Як справи? | |
| hallo:gut-danke | Gut, danke. | Добре, дякую. | |
| hallo:wie-heisst-du | Wie heißt du? | Як тебе звати? | |
| hallo:ich-heisse | Ich heiße … | Мене звати … | |
| hallo:wie-alt | Wie alt bist du? | Скільки тобі років? | |
| hallo:ich-bin-jahre-alt | Ich bin … Jahre alt. | Мені … років. | |

**5. `zahlen` — «Числа» (22, pos `num`)**: id `zahlen:<число>`, `uk` у формі «три (3)».

null — нуль (0); eins — один (1); zwei — два (2); drei — три (3); vier — чотири (4); fünf — п’ять (5); sechs — шість (6); sieben — сім (7); acht — вісім (8); neun — дев’ять (9); zehn — десять (10); elf — одинадцять (11); zwölf — дванадцять (12); dreizehn — тринадцять (13); vierzehn — чотирнадцять (14); fünfzehn — п’ятнадцять (15); sechzehn — шістнадцять (16, note «sech-, без s»); siebzehn — сімнадцять (17, note «sieb-, без en»); achtzehn — вісімнадцять (18); neunzehn — дев’ятнадцять (19); zwanzig — двадцять (20); hundert — сто (100).

**6. `farben` — «Кольори» (11, pos `adj`)**: rot — червоний; blau — синій; grün — зелений; gelb — жовтий; schwarz — чорний; weiß — білий; grau — сірий; braun — коричневий; orange — помаранчевий; rosa — рожевий; lila — фіолетовий.

Іменники нижче: id `<packId>:<slug>`, slug = `de` малими латинськими, умлаут → `ae/oe/ue`, `ß` → `ss`; `plural: null` має note «зазвичай без множини».

**7. `familie` — «Сім’я» (14, pos `noun`)**

| de | article | plural | uk | note |
|---|---|---|---|---|
| Familie | die | Familien | сім’я | |
| Mutter | die | Mütter | мама | |
| Vater | der | Väter | тато | |
| Bruder | der | Brüder | брат | |
| Schwester | die | Schwestern | сестра | |
| Kind | das | Kinder | дитина | |
| Oma | die | Omas | бабуся | |
| Opa | der | Opas | дідусь | |
| Mann | der | Männer | чоловік | |
| Frau | die | Frauen | жінка | |
| Junge | der | Jungen | хлопчик | |
| Mädchen | das | Mädchen | дівчинка | -chen завжди das |
| Freund | der | Freunde | друг | |
| Freundin | die | Freundinnen | подруга | |

**8. `schule` — «Школа» (15, pos `noun`)**

| de | article | plural | uk | note |
|---|---|---|---|---|
| Schule | die | Schulen | школа | |
| Klasse | die | Klassen | клас | |
| Lehrer | der | Lehrer | учитель | |
| Lehrerin | die | Lehrerinnen | учителька | |
| Buch | das | Bücher | книжка | |
| Heft | das | Hefte | зошит | |
| Bleistift | der | Bleistifte | олівець | |
| Kuli | der | Kulis | ручка | скорочення від der Kugelschreiber |
| Radiergummi | der | Radiergummis | гумка | |
| Lineal | das | Lineale | лінійка | |
| Schere | die | Scheren | ножиці | |
| Schultasche | die | Schultaschen | портфель | |
| Tafel | die | Tafeln | дошка | |
| Tisch | der | Tische | стіл, парта | |
| Stuhl | der | Stühle | стілець | |

**9. `tiere` — «Тварини» (10, pos `noun`)**

| de | article | plural | uk |
|---|---|---|---|
| Hund | der | Hunde | собака |
| Katze | die | Katzen | кішка |
| Maus | die | Mäuse | миша |
| Vogel | der | Vögel | птах |
| Pferd | das | Pferde | кінь |
| Fisch | der | Fische | риба |
| Kuh | die | Kühe | корова |
| Schwein | das | Schweine | свиня |
| Hase | der | Hasen | заєць |
| Bär | der | Bären | ведмідь |

**10. `essen` — «Їжа та напої» (14, pos `noun`)**

| de | article | plural | uk |
|---|---|---|---|
| Brot | das | Brote | хліб |
| Wasser | das | null | вода |
| Milch | die | null | молоко |
| Saft | der | Säfte | сік |
| Tee | der | Tees | чай |
| Apfel | der | Äpfel | яблуко |
| Banane | die | Bananen | банан |
| Orange | die | Orangen | апельсин |
| Kartoffel | die | Kartoffeln | картопля |
| Tomate | die | Tomaten | помідор |
| Ei | das | Eier | яйце |
| Käse | der | null | сир |
| Kuchen | der | Kuchen | пиріг |
| Schokolade | die | Schokoladen | шоколад |

**11. `haus` — «Дім та іграшки» (10, pos `noun`)**

| de | article | plural | uk |
|---|---|---|---|
| Haus | das | Häuser | будинок, дім |
| Zimmer | das | Zimmer | кімната |
| Tür | die | Türen | двері |
| Fenster | das | Fenster | вікно |
| Bett | das | Betten | ліжко |
| Lampe | die | Lampen | лампа |
| Ball | der | Bälle | м’яч |
| Spielzeug | das | Spielzeuge | іграшка |
| Fahrrad | das | Fahrräder | велосипед |
| Auto | das | Autos | машина, автомобіль |

**12. `verben` — «Дієслова» (20, pos `verb`)**; `note` = форма 3-ї особи там, де вона неправильна.

| de | uk | note |
|---|---|---|
| machen | робити | |
| gehen | іти, ходити | |
| kommen | приходити | |
| essen | їсти | er isst |
| trinken | пити | |
| schlafen | спати | er schläft |
| spielen | грати, гратися | |
| lernen | учити, учитися | |
| lesen | читати | er liest |
| schreiben | писати | |
| malen | малювати | |
| singen | співати | |
| schwimmen | плавати | |
| laufen | бігати | er läuft |
| sehen | бачити | er sieht |
| hören | слухати, чути | |
| sprechen | говорити | er spricht |
| wohnen | жити, мешкати | |
| heißen | називатися | Ich heiße … — Мене звати … |
| mögen | любити | er mag |

**13. `adjektive` — «Які? Прикметники» (12, pos `adj`)**: groß — великий; klein — маленький; gut — добрий, хороший; schlecht — поганий; neu — новий; alt — старий; schön — гарний; lustig — веселий; traurig — сумний; kalt — холодний; warm — теплий; schnell — швидкий.

Разом: 9 + 6 + 6 + 18 + 22 + 11 + 14 + 15 + 10 + 14 + 10 + 20 + 12 = **167** карток у 13 наборах.

## 10. Візуальний напрям

Опубліковано три варіанти на рев’ю завдання (Delegatus, review `pr_ca53ec45c35405ad8aa36de9a0fb261c`): головний екран і екран навчання, 390 px і 1280 px, з питаннями про оцінювання, хостинг, озвучку і назву. Рекомендовано варіант 1. Якщо оператор обере інший, токени для всіх трьох є нижче.

**Варіант 1 «Heft» (рекомендовано)**: світлий папір у дрібну клітинку, чорнило, гірчична головна кнопка, кольори артиклів.

```css
--bg: #f4f0e6;  --panel: #fffdf8;  --line: #ddd5c4;  --ink: #1c1b1f;  --muted: #6f6a60;
--accent: #f0b429;  --accent-ink: #1c1b1f;
--der: #2457c5;  --die: #c8332a;  --das: #23845a;
--grid: rgba(36, 87, 197, .07);              /* клітинка 24px */
```

Виміряний контраст (WCAG): ink/bg 15.05; muted/panel 5.29; muted/bg 4.72; der/panel 6.37; die/panel 5.21; das/panel 4.57; білий на der/die/das 6.47 / 5.30 / 4.65; ink/accent 9.19. Усі пари ≥ 4.5:1.

**Варіант 2 «Tafel»**: темний сланець і крейда. `--bg #1f2b2d; --panel #263538; --line #3a4b4e; --ink #eef1ea; --muted #9fb0ab; --accent #f2c14e; --accent-ink #1f2b2d; --der #79aefc; --die #ff8a80; --das #6fd69a`. Текст на плашці артикля тут має бути темним (`--bg`, 6.43:1); білий на `--der` дає лише 2.26:1.

**Варіант 3 «Flagge»**: білий фон, чорний текст, смуга чорний-червоний-золотий. `--der #111111; --die #dd0000; --das #b38600`; золотий на білому 3.32:1, для дрібного тексту його треба затемнити.

Шрифти (вебшрифти не вантажимо, як і Shuboku):

- `--word: Futura, "Avenir Next", "Century Gothic", Jost, system-ui, sans-serif` лише для німецьких слів на картці (латиниця з умлаутами);
- `--ui: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif` для українського інтерфейсу. Futura і Avenir Next на пристроях Apple можуть не мати кирилиці. Змішування шрифтів посеред слова виглядає зле;
- `--mono: ui-monospace, "SF Mono", "Noto Sans Mono", Menlo, monospace` для лічильників.

Що змінюється відносно Shuboku:

| | Shuboku | Wortschatz |
|---|---|---|
| Тло | чорнило `#08070a`, рядки-сканлайни, віньєтка | папір `#f4f0e6` у клітинку |
| Акцент | вермільйон `#e2242f` | гірчичний `#f0b429` на кнопці, кольори артиклів на картці |
| Шрифт | мінчо із засічками, Didot | геометричний гротеск для слів, системний для інтерфейсу |
| Картка | темна панель із червоним світінням | біла картка з лівою смугою кольору роду і плашкою «der · чоловічий» |
| Оцінка | повзунок 0–6 з емодзі | 4 кнопки (§16) |
| Колір шапки Telegram | `#08070a` | `#f4f0e6` (`setHeaderColor`, `setBackgroundColor`) |

Два правила:

- множину показуємо нейтрально («мн.: **die** Äpfel», `die` кольором `--ink`), щоб червоний `die` жіночого роду не плутався з множиною (макет на рев’ю ще фарбує його червоним, у збірці так не робити);
- серія днів «🔥 4 дні» на макеті відкладена (§15).

## 11. Кроки деплою для оператора

Агенти цього не роблять: не логіняться в tgcloud, не створюють ботів, не деплоять і не ставлять секрети.

1. **Бот.** @BotFather → `/newbot` → ім’я (наприклад «Wortschatz») і username.
2. **Serverless.** @BotFather → ваш бот → Serverless → увімкнути. Там же «CLI Access» → «Access token» (`app<id>:<secret>`, окремий від токена бота).
3. **Логін** (один раз, з теки `deutsch/`, бо саме там з’явиться `.tgcloud/`):
   ```sh
   bun install                 # у корені репозиторію (ts-fsrs для планувальника)
   cd deutsch && bun install
   npx tgcloud login           # вставити токен; він ляже в deutsch/.tgcloud/credentials (у .gitignore)
   ```
4. **Перший деплой:** `bun run deploy` (typecheck, `vite build`, `tgcloud-grammy build --src bot`, `tgcloud push`). `push` надрукує адресу `https://app<id>.tgcloud.ai/`.
5. **База:** `npx tgcloud migrate`, підтвердити безпечну зміну «створити таблицю `progress`».
6. **Кнопка меню:** @BotFather → Bot Settings → Menu Button → URL з кроку 4, назва «Картки». За бажанням ту саму адресу як Main Mini App.
7. **Перевірка:** відкрити бота, `/start` → «Відкрити картки» → оцінити кілька карток → статус «синхронізовано з Telegram» → відкрити на іншому пристрої і побачити той самий прогрес. Якщо `npx tgcloud status` пише, що вебхук «out of sync», виконати `npx tgcloud webhook sync`.
8. **CI (за бажанням):** `gh secret set TGCLOUD_TOKEN` (той самий CLI-токен). Після цього `.github/workflows/deutsch.yml` на кожен push у `main`, що зачіпає `deutsch/**` або три модулі Shuboku, робить `tgcloud fetch`, `push`, `migrate --safe`. Без секрету workflow лише тестує і збирає.
9. **GitHub Pages:** нічого не змінюється. Shuboku і далі на https://latand.github.io/shuboku-flashcards/; Wortschatz там не публікується.

## 12. Як додати озвучку пізніше

Спостережено 2026-10-11 запитом `GET https://api.soniox.com/v1/tts-models` з ключем оператора [S6]: модель `tts-rt-v2` підтримує мову `de` (усього 63 мови, зокрема `uk`), 200 голосів, швидкість 0.7–1.3. Голоси з описом «German»: Annika (жіночий, «suited to lessons and assistant dialogue»), Marlene, Lena (жіночі); Jonas, Konrad, Florian, Tobias, Matthias, Reinhard, Stefan (чоловічі). Рекомендовано Annika.

Шлях:

1. Скрипт `deutsch/scripts/generate-audio.ts` за зразком `~/Projects/svit-u-kysheni/scripts/generate-audio.ts`: `POST https://tts-rt.soniox.com/tts` з тілом `{ model: "tts-rt-v2", language: "de", voice: "Annika", audio_format: "mp3", text }`; ключ читається з `~/.config/agent-log-viewer/soniox-api-key` під час запуску, ніде не друкується і не комітиться; на 429 чекати (ліміт близько 100 запитів на хвилину, з пам’яті проєкту).
2. Текст: для іменників артикль + слово («der Apfel»), для решти `de`; для «er/sie/es ist» читати першу форму або додати поле `speak`.
3. Файли: `deutsch/public/audio/<id з двокрапкою, заміненою на ->.mp3`, приблизно 167 × 17 KB ≈ 2.8 MB (оцінка за «Світ у кишені»: 204 кліпи = 3.5 MB). Vite копіює їх у `dist/`, `push` вивантажує лише змінені файли ([S1]). Якщо ліміти статики tgcloud (не опубліковані) завадять, запасний шлях як у Shuboku: jsDelivr з git-тегу.
4. Відтворення: `new Audio(url)`; запасний варіант `speechSynthesis` з голосом `de-DE`, де він є (у Telegram Desktop на WebKitGTK його немає, README Shuboku).
5. Перевірка вимови: транскрипція Whisper і порівняння з текстом, як `scripts/verify-audio.py` у Shuboku.

Синтез у endpoint під час виконання не підходить: без API секретів ключ опинився б у розгорнутому коді. Генерація платна, запускати лише з підтвердженням оператора.

## 13. Що перевірено в прототипі (scratch-тека поза worktree)

| Перевірка | Результат |
|---|---|
| `npm view` | `@aiogram/tgcloud-grammy@0.3.0`, `@aiogram/create-tgcloud-grammy@0.3.0`, `@tgcloud/cli@0.2.0`, `@tgcloud/create-bot@0.1.1` опубліковані; git-тег `v0.3.0` = коміт `6e6d08c`; пакет `tgcloud` на npm чужий (shahradelahi/tgcloud, 2024) |
| `tsc -p bot/tsconfig.json` з пресетом пакета | TypeScript 5.9.3: TS6046 (`ES2025`); TypeScript 6.0.3: OK |
| `tgcloud-grammy build --src bot` без токена | OK: `schema.js`, `lib/bot.js`, `handlers/message.js`, `endpoints/sync.js`, `lib/vendor/aiogram/tgcloud-grammy*.js`, разом 116 KB; `shared/progress.ts` вбудовано в endpoint; type-only імпорт `CardState` з `src/lib/scheduler.ts` не тягне `ts-fsrs` у бота |
| `tgcloud init --no-git` у теці з Vite | без мережі і токена; створює `tgcloud.jsonc` зі `static.source: "dist"`, `.tgcloud/state.json`, `AGENTS.md`, `docs/tgcloud-sdk.md`, скрипт `deploy` |
| `tgcloud status` без `.tgcloud/` | exit 0, «Not linked to a bot yet», список модулів і файлів `dist/`; стану не створює |
| `tgcloud push` без токена | друкує список змін і зупиняється на `resolveToken()` (код [S3]); токена в оточенні й на диску не було, тож нічого не розгорнуто |
| Web: `tsc` (TS 6) + `vite build` з імпортом `src/lib/{scheduler,telegram,scroll}.ts`, без `ts-fsrs` у пакеті | OK; японських даних і `#08070a` у бандлі 0 |
| Те саме з `insights.ts` | 8 збігів японських даних, тому `insights.ts` не імпортуємо |
| `vite` dev з `server.fs.allow: [".."]` | `src/lib/scheduler.ts` віддається (200) |
| `bun test` у `deutsch/` без кореневого `node_modules` | падає: `Cannot find package 'ts-fsrs'`; з кореневим `bun install` проходить |
| Кореневий `bun test` | без `bunfig.toml` знаходить і тести в підтеці; з `[test] root = "./src"` лише тести `src/` |
| Shuboku на експорті 8ac5b47 | `bun test`: 86 тестів у 9 файлах, 0 падінь (з `bunfig.toml` і без); `bun run build`: OK |
| Макети трьох варіантів у Chromium | 390 і 1280 px, `scrollWidth == clientWidth` на всіх 12 кадрах |
| `actionlint` 1.7.12 на workflow з §16 | без зауважень |

Не перевірено, бо потрібен бот і токен оператора: реальний `push`, роботу endpoint і `/start` на платформі, віддачу `app<id>.tgcloud.ai` поза Telegram, ліміти платформи.

## 14. Ризики

| Ризик | Вплив | Що робимо |
|---|---|---|
| Платформа нова: хостинг і endpoints з 6.10.2026, `tgcloud-grammy` 0.3.0 від 11.10.2026 | зміни API, баги | точні версії `@aiogram/tgcloud-grammy@0.3.0`, `@tgcloud/cli@0.2.0`; оновлення лише свідомо |
| Ліміти й ціна не опубліковані | раптові відмови або рахунок | запит `sync` ≤ 512 KB, синхронізація не частіше ніж раз на 15 с, аудіо не в першій версії |
| Немає локального рантайму | помилки бота й endpoint видно лише після деплою | тонкий endpoint, логіка в `shared/progress.ts` під тестами; ручна перевірка оператора (§11 крок 7) |
| Serverless може бути недоступний для акаунта чи бота оператора в BotFather | tgcloud-частина не запуститься | перевіряється на кроці 2; фронтенд і далі працює локально (`bun run preview`) |
| Зміна API модулів Shuboku ламає Wortschatz | червона збірка Wortschatz | `deutsch.yml` запускається на зміни цих трьох файлів |
| Два пристрої синхронізуються одночасно | один запис може загубитися | злиття сходиться, клієнт шле повний стан при кожній синхронізації |
| Кнопку меню не налаштовано | `/start` без кнопки | текстова відповідь з поясненням (§8) |
| Хтось запустить `tgcloud login` у корені репозиторію | корінь стане проєктом tgcloud | `deutsch/README.md` і §11 кажуть запускати з `deutsch/`; `.tgcloud/` у `.gitignore` |

## 15. Відкладено — зараз не виправдано (Deferred — not currently justified)

| Що | Чому відкладено | Як додати потім |
|---|---|---|
| Озвучка | оператор: «для начала просто слова» | §12 |
| Копія Wortschatz на GitHub Pages | endpoint з іншого хоста потребує CORS, якого платформа не обіцяє; workflow Shuboku довелося б міняти | окремий Pages-артефакт або інший репозиторій |
| Перенесення самого Shuboku на tgcloud («мигрировать») | вимога оркестратора: Shuboku працює без змін | `tgcloud.jsonc` зі `static: "dist"`, у Vite `base: "/"` (зараз `/shuboku-flashcards/`), CloudStorage замінити на endpoint і таблицю з цього документа |
| Повзунок 0–6 і підказка оцінки за часом (`suggest.ts`) | 4 великі кнопки зручно натискати на телефоні; `Grade` той самий, тож історію можна буде показати пізніше | імпортувати `GradeSlider`-логіку або `suggest.ts` |
| Серія днів, статистика, графік історії, браузер карток | не вимагалися | `reviewLog` у `Progress` з правилом «максимум за день» |
| Кілька профілів на пристрої, власні колоди, експорт/імпорт JSON | профіль = акаунт Telegram; синхронізація закриває перенос між пристроями | як у Shuboku |
| Нагадування від бота «пора повторити» | на платформі немає cron | коли з’явиться планувальник |
| CloudStorage Telegram | його замінює база tgcloud | — |
| Рядок у базі на кожну картку | при 167 картках вистачає одного JSON-рядка | якщо знадобиться аналітика на сервері |
| Темна тема для варіанта 1 | не вимагалася | токени варіанта 2 як `prefers-color-scheme: dark` |

Перевірка дизайну проти вихідної вимоги: Telegram Serverless через `@aiogram/tgcloud-grammy` використано для бота, бекенду, бази і хостингу (так); «полностью здесь» і «второе приложение» — `deutsch/` у цьому репозиторії (так); вивчається німецька (так); «немножко другой стиль» — варіант «Heft» (так); «самые базовые слова» і «вот такие слова» — 167 карток рівня шкільного початківця, перші два набори з аркуша оператора окремими наборами, переклади займенників дослівно, sie / sie / Sie розв’язні (так); озвучка «если получится», «для начала просто слова» — шлях описано, у збірку не входить (так); «если всё окей, можно делать сразу» — дизайн придатний до збірки, бриф нижче.

## 16. Бриф для білдера

> **Стан збірки клієнта (етап frontend, 2026-10-11).** Зроблено: `bunfig.toml`, `deutsch/` (Vite, React, `web/`, `shared/`), 167 карток у 13 наборах, стиль «Heft», тести, `.github/workflows/deutsch.yml` без кроку деплою, розділ у кореневому `README.md`. Свідомо не зроблено, лишається наступному етапу: `bot/`, `tgcloud.jsonc`, залежності `@aiogram/tgcloud-grammy`, `@tgcloud/cli`, `grammy`, скрипти `status`/`deploy`, крок деплою в workflow, `web/lib/tg.ts::callEndpoint`. Шов для сервера: `deutsch/web/lib/sync.ts` (`SyncTransport`, `localOnlyTransport`), підключається одним рядком у `deutsch/web/App.tsx`. Тому `build` у `deutsch/package.json` зараз `tsc -p tsconfig.json && vite build`. Пункти нижче про `bot/` і `tgcloud-grammy build` ще не виконані.

### Файли

Нові файли в корені (лише ці):

- `bunfig.toml`:
  ```toml
  [test]
  root = "./src"
  ```
- `.github/workflows/deutsch.yml`:
  ```yaml
  name: Wortschatz (tgcloud)
  on:
    push:
      branches: [main]
      paths: &paths
        - "deutsch/**"
        - "src/lib/scheduler.ts"
        - "src/lib/telegram.ts"
        - "src/lib/scroll.ts"
        - "package.json"
        - "bun.lock"
        - ".github/workflows/deutsch.yml"
    pull_request:
      paths: *paths
    workflow_dispatch:
  concurrency:
    group: tgcloud-deploy
    cancel-in-progress: false
  permissions:
    contents: read
  jobs:
    build:
      runs-on: ubuntu-latest
      env:
        TGCLOUD_TOKEN: ${{ secrets.TGCLOUD_TOKEN }}
      steps:
        - uses: actions/checkout@v4
        - uses: oven-sh/setup-bun@v2
          with:
            bun-version: latest
        - uses: actions/setup-node@v4
          with:
            node-version: 22
        - run: bun install --frozen-lockfile            # корінь: ts-fsrs для src/lib/scheduler.ts
        - run: bun install --frozen-lockfile
          working-directory: deutsch
        - run: bun test
          working-directory: deutsch
        - run: bun run build
          working-directory: deutsch
        - name: Deploy to Telegram Serverless
          if: github.event_name != 'pull_request' && github.ref == 'refs/heads/main' && env.TGCLOUD_TOKEN != ''
          working-directory: deutsch
          run: |
            npx tgcloud fetch
            npx tgcloud push
            npx tgcloud migrate --safe
  ```
  `actionlint` 1.7.12 приймає цей файл разом з YAML-якорями `&paths`/`*paths` (перевірено). Якщо GitHub відхилить якорі, повторити список `paths` двічі.
- У кореневому `README.md` дозволено один короткий розділ із посиланням на `deutsch/README.md`.

Усередині `deutsch/`:

- `package.json`:
  ```json
  {
    "name": "wortschatz",
    "private": true,
    "type": "module",
    "scripts": {
      "dev": "vite",
      "build": "tsc -p tsconfig.json && tsc -p bot/tsconfig.json && vite build && tgcloud-grammy build --src bot",
      "preview": "vite preview",
      "test": "bun test",
      "status": "bun run build && tgcloud status",
      "deploy": "bun run build && tgcloud push"
    },
    "dependencies": { "grammy": "^1.46.0", "react": "^18.3.1", "react-dom": "^18.3.1" },
    "devDependencies": {
      "@aiogram/tgcloud-grammy": "0.3.0",
      "@tgcloud/cli": "0.2.0",
      "@types/bun": "^1.1.14",
      "@types/react": "^18.3.12",
      "@types/react-dom": "^18.3.1",
      "@vitejs/plugin-react": "^4.3.4",
      "typescript": "~6.0.3",
      "vite": "^6.0.5"
    }
  }
  ```
  `ts-fsrs` сюди не додавати. `bun.lock` згенерувати через `bun install`.
- `.gitignore`: `.tgcloud/`, `/tgcloud/`, `dist/`, `node_modules/`.
- `tgcloud.jsonc`:
  ```jsonc
  {
    "$schema": "./node_modules/@tgcloud/cli/schema/tgcloud.json",
    "static": {
      "source": "dist",
      "immutable": ["/assets/*"]
    }
  }
  ```
- `vite.config.ts`: `plugins: [react()]`, `server: { fs: { allow: [".."] } }`, `base` не задавати.
- `tsconfig.json` (web + shared + тести): як у Shuboku (`ES2020`, `DOM`, `bundler`, `react-jsx`, `strict`, `noUnusedLocals`, `noUnusedParameters`, `noEmit`, `skipLibCheck`), `"types": ["bun"]`, `"include": ["web", "shared", "vite.config.ts"]`.
- `bot/tsconfig.json`:
  ```json
  { "extends": "@aiogram/tgcloud-grammy/tsconfig.json", "include": [".", "../shared"], "exclude": ["../shared/**/*.test.ts"] }
  ```
- `index.html`: `lang="uk"`, `theme-color` `#f4f0e6`, `<script src="https://telegram.org/js/telegram-web-app.js">`, заголовок «Wortschatz — німецькі картки», `<script type="module" src="/web/main.tsx">`.
- `README.md` (українською): що це, `bun install` у корені і в `deutsch/`, `bun run dev|test|build|preview`, кроки деплою з §11, перелік команд tgcloud, які потребують токена.
- `shared/progress.ts` + `shared/progress.test.ts`: §7.
- `web/data/words.ts` + `web/data/words.test.ts`: §9, рівно ці 167 карток у 13 наборах, у тому самому порядку; `pronomen` і `sein` перші.
- `web/lib/queue.ts` + тест: `buildQueue(progress, packs, now, limit = 20, random)`: спершу картки до повторення (`isDue` з планувальника) з увімкнених наборів у випадковому порядку, потім нові в порядку наборів, разом не більше `limit`. Картку з «Не згадав» один раз повернути в кінець сесії; друга оцінка теж іде в FSRS.
- `web/lib/format.ts` + тест: інтервал українською з правильною множиною (`Intl.PluralRules("uk")`): «скоро», «завтра», «2 дні», «5 днів», «3 тижні»; число для лічильників («1 картка», «2 картки», «5 карток»).
- `web/lib/tg.ts`: ініціалізація (`ready`, `expand`, `setHeaderColor`/`setBackgroundColor` у колір фону, `disableVerticalSwipes` лише на iOS/Android), `inTelegram()` (є `initData`), `callEndpoint` (§7). Імпортує `haptics`, `setTelegramBack`, `setClosingConfirmation`, `isTelegram` з `../../src/lib/telegram`.
- `web/lib/sync.ts` + тест: §7, з підставним `call`.
- `web/main.tsx`, `web/App.tsx`, `web/styles.css`, `web/screens/Home.tsx`, `web/screens/Study.tsx`:
  - головний екран: назва, лічильники «N до повторення · M нових», головна кнопка «Почати» (неактивна з текстом «На сьогодні все», коли черга порожня), «Мої набори» з прогресом (оцінені / всього) і кнопкою «Прибрати», «Додати набір» з кнопкою «Додати», перемикач напрямку «Німецька → українська» / «Українська → німецька», рядок статусу синхронізації;
  - навчання: прогрес «7 / 20», картка за таблицею показу з §9 (іменник, `form` з пропуском, решта; `deHint`/`ukHint` лише з потрібного боку), відкриття тапом, пробілом або Enter, 4 кнопки з прогнозом інтервалу (`review(state ?? newCardState(now), g, now)` без збереження): «Не згадав» → оцінка 1, «Важко» → 3, «Добре» → 4, «Легко» → 5; клавіші 1–4; вібрація; кнопка «Назад» Telegram виходить із сесії; підтвердження закриття під час сесії;
  - кінець сесії: «Готово: N карток», коли наступне повторення, кнопка на головну;
  - стиль варіанта 1 (§10), якщо `read_prototype_review` не покаже іншого вибору оператора.
- `bot/schema.ts`, `bot/endpoints/sync.ts`: §7. `bot/lib/bot.ts`, `bot/handlers/message.ts`: §8.

### Перевірки приймання

1. Корінь, після `bun install --frozen-lockfile`: `bun test` → 86 тестів у 9 файлах, 0 падінь (тести `deutsch/` не підхоплюються); `bun run build` → OK.
2. `git diff --stat main -- src index.html vite.config.ts package.json bun.lock tsconfig.json .gitignore .github/workflows/deploy.yml audio scripts reference ALGORITHM.md BRIEF.md docs/simulations` порожній.
3. `cd deutsch && bun install --frozen-lockfile && bun test` → усе зелене, зокрема:
   - слова: 167 карток, 13 наборів, перші `pronomen` і `sein`; id унікальні й відповідають `^<packId>:[a-z0-9-]+$`; у кожного `noun` є `article` і `plural !== undefined`, у не-іменників `article` і `plural` відсутні; у кожного `form` є `cloze` з «…» і назвою дієслова в дужках, і `de` починається з частини `cloze` до «…»; `cloze` є лише в `form`; `de`/`uk` непорожні й без пробілів по краях; лицьовий бік з підказкою унікальний у кожному напрямку (`de-uk`: `cloze` або артикль + `de`, плюс `deHint`; `uk-de`: `uk` плюс `ukHint`); `uk` займенників дорівнює рядкам з аркуша («я», «ти», «він», «вона», «воно», «ми», «ви (група або клас)», «вони», «Ви (ввічлива форма)»);
   - злиття: комутативність, ідемпотентність, асоціативність на згенерованих випадках; `merge(повний, emptyProgress())` = повний; новіший стан картки виграє за `history`, включно з оцінкою 6; `parseProgress` відкидає биті записи і повертає `null` на не-об’єкт;
   - черга: спершу due, потім нові, ліміт, «Не згадав» повертається один раз;
   - формат: «1 день», «2 дні», «5 днів», «21 день», «завтра»;
   - синхронізація: поза Telegram виклику немає і статус `local`; помилка → `offline`, локальний стан цілий; відповідь сервера зливається з локальними змінами, зробленими під час запиту.
4. `cd deutsch && bun run build` без `TGCLOUD_TOKEN` і без `deutsch/.tgcloud/credentials` → exit 0; є `dist/index.html` і `tgcloud/{schema.js, lib/bot.js, handlers/message.js, endpoints/sync.js}`.
5. `cd deutsch && npx tgcloud status` → exit 0, «Not linked to a bot yet», перелічено ці модулі і файли `dist/`.
6. Гігієна бандла: `grep -c 'hiragana\|ひらがな\|seion' deutsch/dist/assets/*.js` → 0; `#08070a` → 0; `grep -c 'ts-fsrs\|fsrs' deutsch/tgcloud/endpoints/sync.js` → 0.
7. `cd deutsch && bun run preview` (або `dev`) у Chromium при 390×844 і 1280×800: головна, лицьовий бік, зворот, кінець сесії; скриншоти обох ширин; `scrollWidth == clientWidth` на кожному екрані; кнопки оцінки ≥ 44 px заввишки; повний сценарій: додати набір → пройти сесію → лічильники змінилися → перезавантаження зберегло прогрес → перемикач напрямку працює; поза Telegram статус каже, що прогрес на цьому пристрої, і запитів до `/api/` немає.
8. Секретів немає: `git grep -nE 'app[0-9]+:' -- deutsch` порожній; `.tgcloud/` і `/tgcloud/` у `deutsch/.gitignore`.
9. `deutsch.yml` проходить `actionlint`, якщо він є; крок деплою має умову на `TGCLOUD_TOKEN`.

### Чого не чіпати і не робити

- Не змінювати `src/**` (лише імпортувати три модулі з §6), кореневі `index.html`, `vite.config.ts`, `package.json`, `bun.lock`, `tsconfig.json`, `.gitignore`, `.github/workflows/deploy.yml`, `audio/`, `scripts/`, `reference/`, `ALGORITHM.md`, `BRIEF.md`, `docs/simulations/`.
- Не запускати `tgcloud login`, `push`, `run`, `migrate`, `fetch`, `pull`, `reset`, `webhook` і `tgcloud-grammy init`. Дозволено: `tgcloud-grammy build|add`, `tgcloud status|diff`.
- Не створювати ботів, не ставити секрети GitHub, не пушити в `main`.
- Не генерувати озвучку (платно) і не друкувати ключ Soniox.
- Не додавати `ts-fsrs` у `deutsch/package.json`, не імпортувати `src/lib/storage.ts`, `insights.ts`, `store.tsx`, `screens/*`.
- Не міняти `id` слів після мерджу: прогрес прив’язаний до них.

## Джерела

- [S1] Telegram Serverless, https://core.telegram.org/bots/serverless (прочитано 2026-10-11; «Recent changes — October 6, 2026»).
- [S2] aiogram/tgcloud-grammy, коміт `6e6d08c` = тег `v0.3.0`: `README.md`, `CLAUDE.md`, `types/sdk.d.ts`, `src/cli.ts`, `src/init.ts`, `src/grammy.ts`, `src/index.ts`, `templates/`, `create/index.js`.
- [S3] npm `@tgcloud/cli@0.2.0`: `src/cli.js`, `src/commands/init.js`, `src/commands/deploy.js`, `src/core/credentials.js`, `src/core/project-root.js`, `schema/tgcloud.json`, `CHANGELOG.md`.
- [S4] https://telegram.org/js/telegram-web-app.js (завантажено 2026-10-11), об’єкт `Serverless`.
- [S5] npm registry, `npm view` 2026-10-11: `@aiogram/tgcloud-grammy` 0.3.0, `@aiogram/create-tgcloud-grammy` 0.3.0, `@tgcloud/cli` 0.2.0, `@tgcloud/create-bot` 0.1.1, `typescript` latest 7.0.2.
- [S6] Soniox `GET https://api.soniox.com/v1/tts-models`, 2026-10-11 (без ключа 401, з ключем 200).
- Shuboku: `src/lib/scheduler.ts`, `src/lib/storage.ts`, `src/lib/telegram.ts`, `src/lib/insights.ts`, `src/data/packs.ts`, `src/styles.css`, `vite.config.ts`, `.github/workflows/deploy.yml`, `README.md` на коміті 8ac5b47.
