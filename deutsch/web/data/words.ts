/*
 * Starter vocabulary: 167 cards in 13 packs, school-beginner level.
 *
 * Word ids are permanent. Learner progress is stored under them, so a typo in
 * `de` or `uk` may be fixed, but an id must never change or be reused.
 * Ukrainian text uses the typographic apostrophe ’ (U+2019).
 */

export type Article = "der" | "die" | "das";
export type Pos = "noun" | "verb" | "adj" | "pron" | "num" | "phrase" | "form";

export interface Word {
  /** "<packId>:<slug>", slug in [a-z0-9-] */
  id: string;
  /** German without the article ("Apfel", "Guten Morgen!"); for "form" the full form ("wir sind") */
  de: string;
  uk: string;
  pos: Pos;
  /** required for nouns, absent otherwise */
  article?: Article;
  /** nouns only: plural without the article; null = normally no plural */
  plural?: string | null;
  /** "form" only: the German front with a gap, "wir … (sein)" */
  cloze?: string;
  /** shown only when the front is German (sie ist … / sie sind …) */
  deHint?: string;
  /** shown only when the front is Ukrainian (the verb a form belongs to) */
  ukHint?: string;
  /** shown on the back: a third-person form, an example, a reminder */
  note?: string;
}

export interface Pack {
  id: string;
  title: string;
  blurb: string;
  words: Word[];
}

const w = (pack: string, slug: string, pos: Pos, de: string, uk: string, extra: Partial<Word> = {}): Word => ({
  id: `${pack}:${slug}`,
  de,
  uk,
  pos,
  ...extra,
});

const noun = (
  pack: string,
  slug: string,
  article: Article,
  de: string,
  plural: string | null,
  uk: string,
  note?: string
): Word => w(pack, slug, "noun", de, uk, { article, plural, ...(note ? { note } : {}) });

const pron = (slug: string, de: string, uk: string, extra: Partial<Word> = {}) =>
  w("pronomen", slug, "pron", de, uk, extra);

/** One row of a verb table: "wir … (sein)" → "wir sind". */
const form = (pack: string, verb: string, slug: string, who: string, de: string, uk: string, note?: string) =>
  w(pack, slug, "form", de, uk, { cloze: `${who} … (${verb})`, ukHint: verb, ...(note ? { note } : {}) });
const sein = (slug: string, who: string, de: string, uk: string, note?: string) =>
  form("sein", "sein", slug, who, de, uk, note);
const haben = (slug: string, who: string, de: string, uk: string, note?: string) =>
  form("haben", "haben", slug, who, de, uk, note);

const hallo = (slug: string, de: string, uk: string, note?: string) =>
  w("hallo", slug, "phrase", de, uk, note ? { note } : {});
const zahl = (slug: string, de: string, uk: string, n: number, note?: string) =>
  w("zahlen", slug, "num", de, `${uk} (${n})`, note ? { note } : {});
const verb = (slug: string, de: string, uk: string, note?: string) =>
  w("verben", slug, "verb", de, uk, note ? { note } : {});
const adj = (pack: string, slug: string, de: string, uk: string) => w(pack, slug, "adj", de, uk);

export const PACKS: Pack[] = [
  {
    id: "pronomen",
    title: "Особові займенники",
    blurb: "ich, du, er … Хто виконує дію. Три слова sie / sie / Sie розрізняє підказка.",
    words: [
      pron("ich", "ich", "я", { note: "ich bin" }),
      pron("du", "du", "ти", { note: "du bist" }),
      pron("er", "er", "він", { note: "er ist" }),
      pron("sie-sg", "sie", "вона", { deHint: "sie ist …" }),
      pron("es", "es", "воно", { note: "es ist" }),
      pron("wir", "wir", "ми", { note: "wir sind" }),
      pron("ihr", "ihr", "ви (група або клас)", { note: "ihr seid" }),
      pron("sie-pl", "sie", "вони", { deHint: "sie sind …" }),
      pron("sie-formal", "Sie", "Ви (ввічлива форма)", {
        deHint: "з великої літери: Sie sind …",
        note: "завжди з великої літери",
      }),
    ],
  },
  {
    id: "sein",
    title: "sein – бути",
    blurb: "Теперішній час. Українською «є» часто пропускають: Ich bin Anna — Я Анна.",
    words: [
      sein("ich-bin", "ich", "ich bin", "я є", "Ich bin Anna. — Я Анна."),
      sein("du-bist", "du", "du bist", "ти є", "Du bist Max. — Ти Макс."),
      sein("er-ist", "er/sie/es", "er/sie/es ist", "він/вона/воно є", "Er ist Tom. — Він Том."),
      sein("wir-sind", "wir", "wir sind", "ми є", "Wir sind Freunde. — Ми друзі."),
      sein("ihr-seid", "ihr", "ihr seid", "ви є (група або клас)", "Ihr seid Kinder. — Ви діти."),
      sein("sie-sind", "sie/Sie", "sie/Sie sind", "вони є / Ви є", "Sie sind Lehrer. — Вони вчителі / Ви вчитель."),
    ],
  },
  {
    id: "haben",
    title: "haben – мати",
    blurb: "Друге головне дієслово: Ich habe ein Buch — У мене є книжка.",
    words: [
      haben("ich-habe", "ich", "ich habe", "я маю", "Ich habe ein Buch. — У мене є книжка."),
      haben("du-hast", "du", "du hast", "ти маєш", "Du hast ein Auto. — У тебе є автомобіль."),
      haben("er-hat", "er/sie/es", "er/sie/es hat", "він/вона/воно має", "Sie hat eine Katze. — У неї є кішка."),
      haben("wir-haben", "wir", "wir haben", "ми маємо", "Wir haben ein Haus. — У нас є будинок."),
      haben("ihr-habt", "ihr", "ihr habt", "ви маєте (група або клас)", "Ihr habt ein Heft. — У вас є зошит."),
      haben("sie-haben", "sie/Sie", "sie/Sie haben", "вони мають / Ви маєте", "Sie haben ein Zimmer. — У них є кімната."),
    ],
  },
  {
    id: "hallo",
    title: "Привітання",
    blurb: "Перші фрази для знайомства і ввічливості.",
    words: [
      hallo("hallo", "Hallo!", "Привіт!"),
      hallo("guten-morgen", "Guten Morgen!", "Доброго ранку!"),
      hallo("guten-tag", "Guten Tag!", "Добрий день!"),
      hallo("guten-abend", "Guten Abend!", "Добрий вечір!"),
      hallo("gute-nacht", "Gute Nacht!", "На добраніч!"),
      hallo("tschuess", "Tschüss!", "Бувай!"),
      hallo("auf-wiedersehen", "Auf Wiedersehen!", "До побачення!"),
      hallo("danke", "Danke!", "Дякую!"),
      hallo("bitte", "Bitte!", "Будь ласка!", "ще й «прошу» у відповідь на «дякую»"),
      hallo("ja", "ja", "так"),
      hallo("nein", "nein", "ні"),
      hallo("entschuldigung", "Entschuldigung!", "Вибачте!"),
      hallo("wie-gehts", "Wie geht's?", "Як справи?"),
      hallo("gut-danke", "Gut, danke.", "Добре, дякую."),
      hallo("wie-heisst-du", "Wie heißt du?", "Як тебе звати?"),
      hallo("ich-heisse", "Ich heiße …", "Мене звати …"),
      hallo("wie-alt", "Wie alt bist du?", "Скільки тобі років?"),
      hallo("ich-bin-jahre-alt", "Ich bin … Jahre alt.", "Мені … років."),
    ],
  },
  {
    id: "zahlen",
    title: "Числа",
    blurb: "Від 0 до 20 і сто.",
    words: [
      zahl("null", "null", "нуль", 0),
      zahl("eins", "eins", "один", 1),
      zahl("zwei", "zwei", "два", 2),
      zahl("drei", "drei", "три", 3),
      zahl("vier", "vier", "чотири", 4),
      zahl("fuenf", "fünf", "п’ять", 5),
      zahl("sechs", "sechs", "шість", 6),
      zahl("sieben", "sieben", "сім", 7),
      zahl("acht", "acht", "вісім", 8),
      zahl("neun", "neun", "дев’ять", 9),
      zahl("zehn", "zehn", "десять", 10),
      zahl("elf", "elf", "одинадцять", 11),
      zahl("zwoelf", "zwölf", "дванадцять", 12),
      zahl("dreizehn", "dreizehn", "тринадцять", 13),
      zahl("vierzehn", "vierzehn", "чотирнадцять", 14),
      zahl("fuenfzehn", "fünfzehn", "п’ятнадцять", 15),
      zahl("sechzehn", "sechzehn", "шістнадцять", 16, "sech-, без s"),
      zahl("siebzehn", "siebzehn", "сімнадцять", 17, "sieb-, без en"),
      zahl("achtzehn", "achtzehn", "вісімнадцять", 18),
      zahl("neunzehn", "neunzehn", "дев’ятнадцять", 19),
      zahl("zwanzig", "zwanzig", "двадцять", 20),
      zahl("hundert", "hundert", "сто", 100),
    ],
  },
  {
    id: "farben",
    title: "Кольори",
    blurb: "Які кольори бачимо навколо.",
    words: [
      adj("farben", "rot", "rot", "червоний"),
      adj("farben", "blau", "blau", "синій"),
      adj("farben", "gruen", "grün", "зелений"),
      adj("farben", "gelb", "gelb", "жовтий"),
      adj("farben", "schwarz", "schwarz", "чорний"),
      adj("farben", "weiss", "weiß", "білий"),
      adj("farben", "grau", "grau", "сірий"),
      adj("farben", "braun", "braun", "коричневий"),
      adj("farben", "orange", "orange", "помаранчевий"),
      adj("farben", "rosa", "rosa", "рожевий"),
      adj("farben", "lila", "lila", "фіолетовий"),
    ],
  },
  {
    id: "familie",
    title: "Сім’я",
    blurb: "Хто є хто. Запам’ятовуй слово разом з артиклем.",
    words: [
      noun("familie", "familie", "die", "Familie", "Familien", "сім’я"),
      noun("familie", "mutter", "die", "Mutter", "Mütter", "мама"),
      noun("familie", "vater", "der", "Vater", "Väter", "тато"),
      noun("familie", "bruder", "der", "Bruder", "Brüder", "брат"),
      noun("familie", "schwester", "die", "Schwester", "Schwestern", "сестра"),
      noun("familie", "kind", "das", "Kind", "Kinder", "дитина"),
      noun("familie", "oma", "die", "Oma", "Omas", "бабуся"),
      noun("familie", "opa", "der", "Opa", "Opas", "дідусь"),
      noun("familie", "mann", "der", "Mann", "Männer", "чоловік"),
      noun("familie", "frau", "die", "Frau", "Frauen", "жінка"),
      noun("familie", "junge", "der", "Junge", "Jungen", "хлопчик"),
      noun("familie", "maedchen", "das", "Mädchen", "Mädchen", "дівчинка", "-chen завжди das"),
      noun("familie", "freund", "der", "Freund", "Freunde", "друг"),
      noun("familie", "freundin", "die", "Freundin", "Freundinnen", "подруга"),
    ],
  },
  {
    id: "schule",
    title: "Школа",
    blurb: "Що в класі і в портфелі.",
    words: [
      noun("schule", "schule", "die", "Schule", "Schulen", "школа"),
      noun("schule", "klasse", "die", "Klasse", "Klassen", "клас"),
      noun("schule", "lehrer", "der", "Lehrer", "Lehrer", "учитель"),
      noun("schule", "lehrerin", "die", "Lehrerin", "Lehrerinnen", "учителька"),
      noun("schule", "buch", "das", "Buch", "Bücher", "книжка"),
      noun("schule", "heft", "das", "Heft", "Hefte", "зошит"),
      noun("schule", "bleistift", "der", "Bleistift", "Bleistifte", "олівець"),
      noun("schule", "kuli", "der", "Kuli", "Kulis", "ручка", "скорочення від der Kugelschreiber"),
      noun("schule", "radiergummi", "der", "Radiergummi", "Radiergummis", "гумка"),
      noun("schule", "lineal", "das", "Lineal", "Lineale", "лінійка"),
      noun("schule", "schere", "die", "Schere", "Scheren", "ножиці"),
      noun("schule", "schultasche", "die", "Schultasche", "Schultaschen", "портфель"),
      noun("schule", "tafel", "die", "Tafel", "Tafeln", "дошка"),
      noun("schule", "tisch", "der", "Tisch", "Tische", "стіл, парта"),
      noun("schule", "stuhl", "der", "Stuhl", "Stühle", "стілець"),
    ],
  },
  {
    id: "tiere",
    title: "Тварини",
    blurb: "Домашні й лісові друзі.",
    words: [
      noun("tiere", "hund", "der", "Hund", "Hunde", "собака"),
      noun("tiere", "katze", "die", "Katze", "Katzen", "кішка"),
      noun("tiere", "maus", "die", "Maus", "Mäuse", "миша"),
      noun("tiere", "vogel", "der", "Vogel", "Vögel", "птах"),
      noun("tiere", "pferd", "das", "Pferd", "Pferde", "кінь"),
      noun("tiere", "fisch", "der", "Fisch", "Fische", "риба"),
      noun("tiere", "kuh", "die", "Kuh", "Kühe", "корова"),
      noun("tiere", "schwein", "das", "Schwein", "Schweine", "свиня"),
      noun("tiere", "hase", "der", "Hase", "Hasen", "заєць"),
      noun("tiere", "baer", "der", "Bär", "Bären", "ведмідь"),
    ],
  },
  {
    id: "essen",
    title: "Їжа та напої",
    blurb: "Що їмо і п’ємо.",
    words: [
      noun("essen", "brot", "das", "Brot", "Brote", "хліб"),
      noun("essen", "wasser", "das", "Wasser", null, "вода"),
      noun("essen", "milch", "die", "Milch", null, "молоко"),
      noun("essen", "saft", "der", "Saft", "Säfte", "сік"),
      noun("essen", "tee", "der", "Tee", "Tees", "чай"),
      noun("essen", "apfel", "der", "Apfel", "Äpfel", "яблуко"),
      noun("essen", "banane", "die", "Banane", "Bananen", "банан"),
      noun("essen", "orange", "die", "Orange", "Orangen", "апельсин"),
      noun("essen", "kartoffel", "die", "Kartoffel", "Kartoffeln", "картопля"),
      noun("essen", "tomate", "die", "Tomate", "Tomaten", "помідор"),
      noun("essen", "ei", "das", "Ei", "Eier", "яйце"),
      noun("essen", "kaese", "der", "Käse", null, "сир"),
      noun("essen", "kuchen", "der", "Kuchen", "Kuchen", "пиріг"),
      noun("essen", "schokolade", "die", "Schokolade", "Schokoladen", "шоколад"),
    ],
  },
  {
    id: "haus",
    title: "Дім та іграшки",
    blurb: "Кімната, меблі й те, з чим граємось.",
    words: [
      noun("haus", "haus", "das", "Haus", "Häuser", "будинок, дім"),
      noun("haus", "zimmer", "das", "Zimmer", "Zimmer", "кімната"),
      noun("haus", "tuer", "die", "Tür", "Türen", "двері"),
      noun("haus", "fenster", "das", "Fenster", "Fenster", "вікно"),
      noun("haus", "bett", "das", "Bett", "Betten", "ліжко"),
      noun("haus", "lampe", "die", "Lampe", "Lampen", "лампа"),
      noun("haus", "ball", "der", "Ball", "Bälle", "м’яч"),
      noun("haus", "spielzeug", "das", "Spielzeug", "Spielzeuge", "іграшка"),
      noun("haus", "fahrrad", "das", "Fahrrad", "Fahrräder", "велосипед"),
      noun("haus", "auto", "das", "Auto", "Autos", "машина, автомобіль"),
    ],
  },
  {
    id: "verben",
    title: "Дієслова",
    blurb: "Двадцять дієслів з перших уроків.",
    words: [
      verb("machen", "machen", "робити"),
      verb("gehen", "gehen", "іти, ходити"),
      verb("kommen", "kommen", "приходити"),
      verb("essen", "essen", "їсти", "er isst"),
      verb("trinken", "trinken", "пити"),
      verb("schlafen", "schlafen", "спати", "er schläft"),
      verb("spielen", "spielen", "грати, гратися"),
      verb("lernen", "lernen", "учити, учитися"),
      verb("lesen", "lesen", "читати", "er liest"),
      verb("schreiben", "schreiben", "писати"),
      verb("malen", "malen", "малювати"),
      verb("singen", "singen", "співати"),
      verb("schwimmen", "schwimmen", "плавати"),
      verb("laufen", "laufen", "бігати", "er läuft"),
      verb("sehen", "sehen", "бачити", "er sieht"),
      verb("hoeren", "hören", "слухати, чути"),
      verb("sprechen", "sprechen", "говорити", "er spricht"),
      verb("wohnen", "wohnen", "жити, мешкати"),
      verb("heissen", "heißen", "називатися", "Ich heiße … — Мене звати …"),
      verb("moegen", "mögen", "любити", "er mag"),
    ],
  },
  {
    id: "adjektive",
    title: "Які? Прикметники",
    blurb: "Слова, якими описуємо речі й людей.",
    words: [
      adj("adjektive", "gross", "groß", "великий"),
      adj("adjektive", "klein", "klein", "маленький"),
      adj("adjektive", "gut", "gut", "добрий, хороший"),
      adj("adjektive", "schlecht", "schlecht", "поганий"),
      adj("adjektive", "neu", "neu", "новий"),
      adj("adjektive", "alt", "alt", "старий"),
      adj("adjektive", "schoen", "schön", "гарний"),
      adj("adjektive", "lustig", "lustig", "веселий"),
      adj("adjektive", "traurig", "traurig", "сумний"),
      adj("adjektive", "kalt", "kalt", "холодний"),
      adj("adjektive", "warm", "warm", "теплий"),
      adj("adjektive", "schnell", "schnell", "швидкий"),
    ],
  },
];

export const ALL_WORDS: Word[] = PACKS.flatMap((p) => p.words);
export const WORD_BY_ID: ReadonlyMap<string, Word> = new Map(ALL_WORDS.map((x) => [x.id, x]));
