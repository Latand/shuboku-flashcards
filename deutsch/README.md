# Wortschatz — німецькі картки

Другий застосунок цього репозиторію: картки для вивчення німецької (інтерфейс і переклади українською) з тим самим інтервальним повторенням FSRS, що й у Shuboku. Стиль «Heft»: світлий зошит у клітинку, кольори артиклів (der синій, die червоний, das зелений).

Shuboku у `../src` не змінюється. Wortschatz імпортує з нього три самодостатні модулі:

| Модуль | Для чого |
|---|---|
| `src/lib/scheduler.ts` | FSRS: інтервали, стан картки |
| `src/lib/telegram.ts` | вібрація, кнопка «Назад», підтвердження закриття |
| `src/lib/scroll.ts` | колесо миші в Telegram Desktop |

Через це `ts-fsrs` береться з кореневого `node_modules`: спершу `bun install` у корені репозиторію.

## Запуск

```sh
bun install            # у корені репозиторію (ts-fsrs)
cd deutsch
bun install
bun run dev            # dev-сервер
bun test               # тести: слова, злиття прогресу, черга, формат, синхронізація
bun run build          # typecheck web і bare-V8 bot, Vite, tgcloud bundle
bun run status         # build + локальний статус прив'язки tgcloud
bun run preview        # показати зібране
```

Тести `deutsch/` запускаються з `deutsch/`. Кореневий `bun test` через `../bunfig.toml` бачить лише тести Shuboku.

## Що всередині

```
web/data/words.ts      167 карток у 13 наборах; id слів незмінні, прогрес прив’язаний до них
web/lib/queue.ts       черга сесії: спершу повторення, потім нові; «Не згадав» повертається раз
web/lib/format.ts      «завтра», «2 дні», «5 днів», «3 тижні», «5 карток»
web/lib/store.ts       localStorage "wortschatz:v1"
web/lib/sync.ts        local-first sync engine та статуси
web/lib/tgcloud.ts     виклик Telegram Serverless endpoint
bot/                   grammY /start, endpoint sync і схема таблиці progress
web/screens/           Home, Study
shared/progress.ts     модель прогресу, злиття, перевірка даних
```

Перші два набори, «Особові займенники» і «sein – бути», взяті зі шкільного аркуша оператора і стоять першими в каталозі та ввімкнені за замовчуванням. Картки `sie` / `sie` / `Sie` розрізняє підказка («sie ist …», «sie sind …», «з великої літери: Sie sind …»). Відмінювання йде пропусками: «wir … (sein)» → «wir sind».

Оцінка: «Не згадав» (1), «Важко» (3), «Добре» (4), «Легко» (5); клавіші 1–4, пробіл або Enter відкриває відповідь.

## Прогрес і синхронізація

Прогрес лежить у `localStorage` і ніколи не вимагає мережі. `shared/progress.ts` описує, як зливаються дві копії: кожен ключ окремо, новіший виграє. Тому порожній пристрій не може стерти прогрес з іншого.

`web/lib/sync.ts` лишається рушієм local-first синхронізації. У Telegram він надсилає повний прогрес у `POST /api/sync`; поза Telegram `web/lib/tgcloud.ts` відмовляє до мережевого виклику, і прогрес лишається в `localStorage`. Недоступний endpoint переводить статус в offline, не перериваючи навчання. Сервер перевіряє Telegram user, розмір і структуру даних, а потім зливає записи через спільні `parseProgress` і `mergeProgress` у таблицю `progress`.

Бот `bot/lib/bot.ts` відповідає на `/start` і показує кнопку Mini App із URL кнопки меню, налаштованої в BotFather. `tgcloud.jsonc` публікує Vite `dist/` на тому ж tgcloud origin, що й API.

## Публікація оператором

Для першої публікації після merge PR:

1. У @BotFather створіть бота, увімкніть Telegram Serverless і створіть CLI Access token.
2. У корені виконайте `bun install`, потім у `deutsch/` — `bun install` і `npx tgcloud login`.
3. Із `deutsch/` запустіть `bun run deploy`. Команда збере клієнт і bot та опублікує обидва на tgcloud; окремого frontend-хостингу для `dist/` немає.
4. Із `deutsch/` виконайте `npx tgcloud migrate` і підтвердьте створення таблиці `progress`.
5. У BotFather встановіть Menu Button на URL, який вивів tgcloud, назва «Картки». Відкрийте бота, надішліть `/start`, запустіть картки й перевірте статус синхронізації.

Для автоматичних наступних публікацій додайте CLI Access token у GitHub Actions як секрет `TGCLOUD_TOKEN`. Workflow збирає PR без публікації; push у `main` збирає, виконує `tgcloud fetch`, `push` і `migrate --safe`, якщо секрет задано. Деплой Shuboku GitHub Pages лишається окремим. Передумови платформи й ручний процес описані в [`../docs/deutsch/RESEARCH.md`](../docs/deutsch/RESEARCH.md#11-кроки-деплою-для-оператора).
