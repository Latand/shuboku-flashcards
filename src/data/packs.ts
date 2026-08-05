/* Built-in card catalog, ported from the original Shuboku artifact.
 * Card ids must stay stable: repetition state and the v1 migration key on them. */

export type Script = "hiragana" | "katakana" | "kanji" | "custom";

export interface Card {
  id: string;
  type: "kana" | "kanji" | "custom";
  /** front side: the character (or the front text of a custom card) */
  char: string;
  romaji?: string;
  on?: string;
  kun?: string;
  meaning?: string;
  /** custom cards: back text + optional reading and note */
  back?: string;
  reading?: string;
  note?: string;
  /** what TTS should say */
  speak?: string;
}

export interface Deck {
  id: string;
  script: Script;
  jp: string;
  name: string;
  cards: Card[];
  builtin: boolean;
}

// Hiragana U+3041–U+3096 maps to Katakana by a fixed +0x60 offset.
const toKata = (s: string) =>
  s.replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));

type KanaPair = [string, string];

const SEION_A: KanaPair[] = [
  ["あ", "a"], ["い", "i"], ["う", "u"], ["え", "e"], ["お", "o"],
  ["か", "ka"], ["き", "ki"], ["く", "ku"], ["け", "ke"], ["こ", "ko"],
  ["さ", "sa"], ["し", "shi"], ["す", "su"], ["せ", "se"], ["そ", "so"],
  ["た", "ta"], ["ち", "chi"], ["つ", "tsu"], ["て", "te"], ["と", "to"],
  ["な", "na"], ["に", "ni"], ["ぬ", "nu"], ["ね", "ne"], ["の", "no"],
];

const SEION_B: KanaPair[] = [
  ["は", "ha"], ["ひ", "hi"], ["ふ", "fu"], ["へ", "he"], ["ほ", "ho"],
  ["ま", "ma"], ["み", "mi"], ["む", "mu"], ["め", "me"], ["も", "mo"],
  ["や", "ya"], ["ゆ", "yu"], ["よ", "yo"],
  ["ら", "ra"], ["り", "ri"], ["る", "ru"], ["れ", "re"], ["ろ", "ro"],
  ["わ", "wa"], ["を", "wo"], ["ん", "n"],
];

const DAKUTEN: KanaPair[] = [
  ["が", "ga"], ["ぎ", "gi"], ["ぐ", "gu"], ["げ", "ge"], ["ご", "go"],
  ["ざ", "za"], ["じ", "ji"], ["ず", "zu"], ["ぜ", "ze"], ["ぞ", "zo"],
  ["だ", "da"], ["ぢ", "ji"], ["づ", "zu"], ["で", "de"], ["ど", "do"],
  ["ば", "ba"], ["び", "bi"], ["ぶ", "bu"], ["べ", "be"], ["ぼ", "bo"],
  ["ぱ", "pa"], ["ぴ", "pi"], ["ぷ", "pu"], ["ぺ", "pe"], ["ぽ", "po"],
];

const YOON: KanaPair[] = [
  ["きゃ", "kya"], ["きゅ", "kyu"], ["きょ", "kyo"],
  ["しゃ", "sha"], ["しゅ", "shu"], ["しょ", "sho"],
  ["ちゃ", "cha"], ["ちゅ", "chu"], ["ちょ", "cho"],
  ["にゃ", "nya"], ["にゅ", "nyu"], ["にょ", "nyo"],
  ["ひゃ", "hya"], ["ひゅ", "hyu"], ["ひょ", "hyo"],
  ["みゃ", "mya"], ["みゅ", "myu"], ["みょ", "myo"],
  ["りゃ", "rya"], ["りゅ", "ryu"], ["りょ", "ryo"],
  ["ぎゃ", "gya"], ["ぎゅ", "gyu"], ["ぎょ", "gyo"],
  ["じゃ", "ja"], ["じゅ", "ju"], ["じょ", "jo"],
  ["びゃ", "bya"], ["びゅ", "byu"], ["びょ", "byo"],
  ["ぴゃ", "pya"], ["ぴゅ", "pyu"], ["ぴょ", "pyo"],
];

// Katakana-only: sounds invented for foreign words.
const GAIRAI: KanaPair[] = [
  ["ファ", "fa"], ["フィ", "fi"], ["フェ", "fe"], ["フォ", "fo"],
  ["ヴ", "vu"], ["ティ", "ti"], ["ディ", "di"], ["トゥ", "tu"],
  ["ウィ", "wi"], ["ウェ", "we"], ["ウォ", "wo"],
  ["シェ", "she"], ["ジェ", "je"], ["チェ", "che"],
];

type KanjiRow = [string, string, string, string];

// on = on'yomi (katakana by convention), kun = kun'yomi (hiragana)
const KANJI: Record<string, { jp: string; name: string; list: KanjiRow[] }> = {
  numbers: {
    jp: "数字",
    name: "Numbers",
    list: [
      ["一", "イチ", "ひと(つ)", "one"],
      ["二", "ニ", "ふた(つ)", "two"],
      ["三", "サン", "みっ(つ)", "three"],
      ["四", "シ", "よっ(つ)・よん", "four"],
      ["五", "ゴ", "いつ(つ)", "five"],
      ["六", "ロク", "むっ(つ)", "six"],
      ["七", "シチ", "なな(つ)", "seven"],
      ["八", "ハチ", "やっ(つ)", "eight"],
      ["九", "キュウ・ク", "ここの(つ)", "nine"],
      ["十", "ジュウ", "とお", "ten"],
      ["百", "ヒャク", "—", "hundred"],
      ["千", "セン", "ち", "thousand"],
      ["万", "マン・バン", "—", "ten thousand"],
      ["円", "エン", "まる(い)", "yen, circle"],
    ],
  },
  time: {
    jp: "時と曜日",
    name: "Time & days",
    list: [
      ["日", "ニチ・ジツ", "ひ・か", "day, sun"],
      ["月", "ゲツ・ガツ", "つき", "month, moon"],
      ["火", "カ", "ひ", "fire"],
      ["水", "スイ", "みず", "water"],
      ["木", "モク", "き", "tree, wood"],
      ["金", "キン", "かね", "gold, money"],
      ["土", "ド", "つち", "earth, soil"],
      ["曜", "ヨウ", "—", "weekday"],
      ["年", "ネン", "とし", "year"],
      ["時", "ジ", "とき", "time, hour"],
      ["分", "フン・ブン", "わ(ける)", "minute, to divide"],
      ["半", "ハン", "なか(ば)", "half"],
      ["今", "コン", "いま", "now"],
      ["毎", "マイ", "—", "every"],
      ["週", "シュウ", "—", "week"],
      ["間", "カン", "あいだ", "interval, between"],
      ["午", "ゴ", "—", "noon"],
      ["前", "ゼン", "まえ", "before, front"],
      ["後", "ゴ・コウ", "あと・うし(ろ)", "after, behind"],
      ["何", "カ", "なに・なん", "what"],
    ],
  },
  people: {
    jp: "人と体",
    name: "People & body",
    list: [
      ["人", "ジン・ニン", "ひと", "person"],
      ["男", "ダン・ナン", "おとこ", "man"],
      ["女", "ジョ", "おんな", "woman"],
      ["子", "シ", "こ", "child"],
      ["父", "フ", "ちち・とう", "father"],
      ["母", "ボ", "はは・かあ", "mother"],
      ["友", "ユウ", "とも", "friend"],
      ["名", "メイ", "な", "name"],
      ["目", "モク", "め", "eye"],
      ["耳", "ジ", "みみ", "ear"],
      ["口", "コウ", "くち", "mouth"],
      ["手", "シュ", "て", "hand"],
      ["足", "ソク", "あし・た(りる)", "foot, enough"],
      ["力", "リョク・リキ", "ちから", "power"],
      ["気", "キ・ケ", "—", "spirit, energy"],
    ],
  },
  nature: {
    jp: "自然",
    name: "Nature",
    list: [
      ["山", "サン", "やま", "mountain"],
      ["川", "セン", "かわ", "river"],
      ["田", "デン", "た", "rice field"],
      ["天", "テン", "あま", "heaven, sky"],
      ["空", "クウ", "そら・あ(く)", "sky, empty"],
      ["雨", "ウ", "あめ", "rain"],
      ["花", "カ", "はな", "flower"],
      ["生", "セイ・ショウ", "い(きる)・なま", "life, raw"],
    ],
  },
  places: {
    jp: "場所と方向",
    name: "Places & direction",
    list: [
      ["上", "ジョウ", "うえ・あ(がる)", "above, up"],
      ["下", "カ・ゲ", "した・さ(がる)", "below, down"],
      ["中", "チュウ", "なか", "middle, inside"],
      ["外", "ガイ", "そと", "outside"],
      ["左", "サ", "ひだり", "left"],
      ["右", "ウ・ユウ", "みぎ", "right"],
      ["東", "トウ", "ひがし", "east"],
      ["西", "セイ", "にし", "west"],
      ["南", "ナン", "みなみ", "south"],
      ["北", "ホク", "きた", "north"],
      ["国", "コク", "くに", "country"],
      ["店", "テン", "みせ", "shop"],
      ["駅", "エキ", "—", "station"],
      ["社", "シャ", "やしろ", "company, shrine"],
      ["校", "コウ", "—", "school"],
      ["学", "ガク", "まな(ぶ)", "study, learning"],
      ["先", "セン", "さき", "ahead, previous"],
      ["車", "シャ", "くるま", "car"],
      ["電", "デン", "—", "electricity"],
      ["道", "ドウ", "みち", "road, way"],
    ],
  },
  verbs: {
    jp: "動詞",
    name: "Verbs",
    list: [
      ["行", "コウ", "い(く)・おこな(う)", "to go"],
      ["来", "ライ", "く(る)", "to come"],
      ["見", "ケン", "み(る)", "to see"],
      ["聞", "ブン", "き(く)", "to hear, to ask"],
      ["言", "ゲン", "い(う)・こと", "to say"],
      ["読", "ドク", "よ(む)", "to read"],
      ["書", "ショ", "か(く)", "to write"],
      ["話", "ワ", "はな(す)・はなし", "to speak, story"],
      ["買", "バイ", "か(う)", "to buy"],
      ["食", "ショク", "た(べる)", "to eat"],
      ["飲", "イン", "の(む)", "to drink"],
      ["立", "リツ", "た(つ)", "to stand"],
      ["休", "キュウ", "やす(む)", "to rest"],
      ["出", "シュツ", "で(る)・だ(す)", "to exit, to put out"],
      ["入", "ニュウ", "はい(る)・い(れる)", "to enter"],
      ["会", "カイ", "あ(う)", "to meet"],
    ],
  },
  adjectives: {
    jp: "形容詞",
    name: "Adjectives",
    list: [
      ["新", "シン", "あたら(しい)", "new"],
      ["古", "コ", "ふる(い)", "old"],
      ["大", "ダイ・タイ", "おお(きい)", "big"],
      ["小", "ショウ", "ちい(さい)", "small"],
      ["高", "コウ", "たか(い)", "tall, expensive"],
      ["安", "アン", "やす(い)", "cheap, peaceful"],
      ["長", "チョウ", "なが(い)", "long"],
      ["白", "ハク", "しろ(い)", "white"],
      ["多", "タ", "おお(い)", "many"],
      ["少", "ショウ", "すく(ない)・すこ(し)", "few, a little"],
    ],
  },
};

function kanaPack(
  script: "hiragana" | "katakana",
  id: string,
  jp: string,
  name: string,
  pairs: KanaPair[]
): Deck {
  return {
    id: script + "-" + id,
    script,
    jp,
    name,
    builtin: true,
    cards: pairs.map(([h, r]) => {
      const ch = script === "katakana" && /[ぁ-ゖ]/.test(h) ? toKata(h) : h;
      return { id: script + ":" + ch + ":" + r, type: "kana" as const, char: ch, romaji: r, speak: ch };
    }),
  };
}

export const BUILTIN_DECKS: Deck[] = [
  kanaPack("hiragana", "seion-a", "清音 あ–の", "Basic a–no", SEION_A),
  kanaPack("hiragana", "seion-b", "清音 は–ん", "Basic ha–n", SEION_B),
  kanaPack("hiragana", "dakuten", "濁音・半濁音", "Voiced marks", DAKUTEN),
  kanaPack("hiragana", "yoon", "拗音", "Combined sounds", YOON),

  kanaPack("katakana", "seion-a", "清音 ア–ノ", "Basic a–no", SEION_A),
  kanaPack("katakana", "seion-b", "清音 ハ–ン", "Basic ha–n", SEION_B),
  kanaPack("katakana", "dakuten", "濁音・半濁音", "Voiced marks", DAKUTEN),
  kanaPack("katakana", "yoon", "拗音", "Combined sounds", YOON),
  kanaPack("katakana", "gairai", "外来音", "Foreign sounds", GAIRAI),

  ...Object.entries(KANJI).map(
    ([key, group]): Deck => ({
      id: "kanji-" + key,
      script: "kanji",
      jp: group.jp,
      name: group.name,
      builtin: true,
      cards: group.list.map(([c, on, kun, m]) => ({
        id: "kanji:" + c,
        type: "kanji" as const,
        char: c,
        on,
        kun,
        meaning: m,
        speak:
          kun && kun !== "—"
            ? kun.replace(/[()（）]/g, "").split("・")[0]
            : on.split("・")[0],
      })),
    })
  ),
];

export const SCRIPTS = [
  { id: "hiragana" as const, numeral: "一", jp: "ひらがな", name: "Hiragana", blurb: "The native syllabary. Everything else rests on it." },
  { id: "katakana" as const, numeral: "二", jp: "カタカナ", name: "Katakana", blurb: "Same sounds, angular strokes. Used for borrowed words." },
  { id: "kanji" as const, numeral: "三", jp: "漢字", name: "Kanji", blurb: "Meaning-carrying characters, read through kana." },
];

export const BUILTIN_BY_ID: Record<string, Deck> = Object.fromEntries(
  BUILTIN_DECKS.map((d) => [d.id, d])
);
