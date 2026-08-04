import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Play,
  Volume2,
  Check,
  ArrowLeft,
  RotateCcw,
  Shuffle,
  Eye,
  Repeat,
  Trash2,
  Layers,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  DATA                                                               */
/* ------------------------------------------------------------------ */

// Hiragana U+3041–U+3096 maps to Katakana by a fixed +0x60 offset.
const toKata = (s) =>
  s.replace(/[\u3041-\u3096]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60)
  );

const SEION_A = [
  ["あ", "a"], ["い", "i"], ["う", "u"], ["え", "e"], ["お", "o"],
  ["か", "ka"], ["き", "ki"], ["く", "ku"], ["け", "ke"], ["こ", "ko"],
  ["さ", "sa"], ["し", "shi"], ["す", "su"], ["せ", "se"], ["そ", "so"],
  ["た", "ta"], ["ち", "chi"], ["つ", "tsu"], ["て", "te"], ["と", "to"],
  ["な", "na"], ["に", "ni"], ["ぬ", "nu"], ["ね", "ne"], ["の", "no"],
];

const SEION_B = [
  ["は", "ha"], ["ひ", "hi"], ["ふ", "fu"], ["へ", "he"], ["ほ", "ho"],
  ["ま", "ma"], ["み", "mi"], ["む", "mu"], ["め", "me"], ["も", "mo"],
  ["や", "ya"], ["ゆ", "yu"], ["よ", "yo"],
  ["ら", "ra"], ["り", "ri"], ["る", "ru"], ["れ", "re"], ["ろ", "ro"],
  ["わ", "wa"], ["を", "wo"], ["ん", "n"],
];

const DAKUTEN = [
  ["が", "ga"], ["ぎ", "gi"], ["ぐ", "gu"], ["げ", "ge"], ["ご", "go"],
  ["ざ", "za"], ["じ", "ji"], ["ず", "zu"], ["ぜ", "ze"], ["ぞ", "zo"],
  ["だ", "da"], ["ぢ", "ji"], ["づ", "zu"], ["で", "de"], ["ど", "do"],
  ["ば", "ba"], ["び", "bi"], ["ぶ", "bu"], ["べ", "be"], ["ぼ", "bo"],
  ["ぱ", "pa"], ["ぴ", "pi"], ["ぷ", "pu"], ["ぺ", "pe"], ["ぽ", "po"],
];

const YOON = [
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
const GAIRAI = [
  ["ファ", "fa"], ["フィ", "fi"], ["フェ", "fe"], ["フォ", "fo"],
  ["ヴ", "vu"], ["ティ", "ti"], ["ディ", "di"], ["トゥ", "tu"],
  ["ウィ", "wi"], ["ウェ", "we"], ["ウォ", "wo"],
  ["シェ", "she"], ["ジェ", "je"], ["チェ", "che"],
];

// on = on'yomi (katakana by convention), kun = kun'yomi (hiragana)
const KANJI = {
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

/* ---- pack assembly ---- */

function kanaPack(script, id, jp, name, pairs) {
  return {
    id: script + "-" + id,
    script,
    jp,
    name,
    items: pairs.map(([h, r]) => {
      const ch = script === "katakana" && /[\u3041-\u3096]/.test(h) ? toKata(h) : h;
      return {
        id: script + ":" + ch + ":" + r,
        type: "kana",
        char: ch,
        romaji: r,
        speak: ch,
      };
    }),
  };
}

const PACKS = [
  kanaPack("hiragana", "seion-a", "清音 あ–の", "Basic a–no", SEION_A),
  kanaPack("hiragana", "seion-b", "清音 は–ん", "Basic ha–n", SEION_B),
  kanaPack("hiragana", "dakuten", "濁音・半濁音", "Voiced marks", DAKUTEN),
  kanaPack("hiragana", "yoon", "拗音", "Combined sounds", YOON),

  kanaPack("katakana", "seion-a", "清音 ア–ノ", "Basic a–no", SEION_A),
  kanaPack("katakana", "seion-b", "清音 ハ–ン", "Basic ha–n", SEION_B),
  kanaPack("katakana", "dakuten", "濁音・半濁音", "Voiced marks", DAKUTEN),
  kanaPack("katakana", "yoon", "拗音", "Combined sounds", YOON),
  kanaPack("katakana", "gairai", "外来音", "Foreign sounds", GAIRAI),

  ...Object.entries(KANJI).map(([key, group]) => ({
    id: "kanji-" + key,
    script: "kanji",
    jp: group.jp,
    name: group.name,
    items: group.list.map(([c, on, kun, m]) => ({
      id: "kanji:" + c,
      type: "kanji",
      char: c,
      on,
      kun,
      meaning: m,
      speak: kun && kun !== "—" ? kun.replace(/[()（）]/g, "").split("・")[0] : on.split("・")[0],
    })),
  })),
];

const SCRIPTS = [
  { id: "hiragana", numeral: "一", jp: "ひらがな", name: "Hiragana", blurb: "The native syllabary. Everything else rests on it." },
  { id: "katakana", numeral: "二", jp: "カタカナ", name: "Katakana", blurb: "Same sounds, angular strokes. Used for borrowed words." },
  { id: "kanji", numeral: "三", jp: "漢字", name: "Kanji", blurb: "Meaning-carrying characters, read through kana." },
];

/* ------------------------------------------------------------------ */
/*  SPEECH                                                             */
/* ------------------------------------------------------------------ */

function useJapaneseVoice() {
  const [voice, setVoice] = useState(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setChecked(true);
      return;
    }
    const pick = () => {
      const all = window.speechSynthesis.getVoices() || [];
      const ja = all.filter((v) => (v.lang || "").toLowerCase().startsWith("ja"));
      if (ja.length) {
        const preferred =
          ja.find((v) => /kyoko|otoya|google|nanami|haruka|ayumi/i.test(v.name)) || ja[0];
        setVoice(preferred);
      }
      if (all.length) setChecked(true);
    };
    pick();
    window.speechSynthesis.addEventListener("voiceschanged", pick);
    const t = setTimeout(() => setChecked(true), 1500);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", pick);
      clearTimeout(t);
    };
  }, []);

  const speak = useCallback(
    (text) => {
      if (!text || typeof window === "undefined" || !window.speechSynthesis) return;
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "ja-JP";
        u.rate = 0.75;
        u.pitch = 1;
        if (voice) u.voice = voice;
        window.speechSynthesis.speak(u);
      } catch (e) {
        /* speech unavailable; button simply does nothing */
      }
    },
    [voice]
  );

  return { speak, hasVoice: !!voice, checked };
}

/* ------------------------------------------------------------------ */
/*  PROGRESS (Leitner boxes 0–5, persisted)                            */
/* ------------------------------------------------------------------ */

const STORE_KEY = "shuboku:v1:progress";
const MAX_BOX = 5;

function useProgress() {
  const [progress, setProgress] = useState({});
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await window.storage.get(STORE_KEY);
        if (alive && res && res.value) setProgress(JSON.parse(res.value));
      } catch (e) {
        /* nothing stored yet, or storage unavailable */
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const persist = useCallback((next) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await window.storage.set(STORE_KEY, JSON.stringify(next));
      } catch (e) {
        /* offline / storage unavailable — session still works */
      }
    }, 400);
  }, []);

  const grade = useCallback(
    (itemId, correct) => {
      setProgress((prev) => {
        const cur = prev[itemId] || { box: 0, seen: 0, right: 0 };
        const next = {
          ...prev,
          [itemId]: {
            box: correct ? Math.min(MAX_BOX, cur.box + 1) : 0,
            seen: cur.seen + 1,
            right: cur.right + (correct ? 1 : 0),
          },
        };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const reset = useCallback(async () => {
    setProgress({});
    try {
      await window.storage.delete(STORE_KEY);
    } catch (e) {
      /* nothing to delete */
    }
  }, []);

  return { progress, grade, reset, loaded };
}

/* ------------------------------------------------------------------ */
/*  STYLES                                                             */
/* ------------------------------------------------------------------ */

const CSS = `
.sb-root {
  --ink: #08070a;
  --sumi: #131114;
  --edge: #2a2429;
  --bone: #e9e4da;
  --ash: #7d7469;
  --blood: #a80f18;
  --ember: #e2242f;

  --mincho: "Hiragino Mincho ProN", "Yu Mincho", YuMincho, "Noto Serif JP",
    "Shippori Mincho", "MS Mincho", serif;
  --display: Didot, "Bodoni MT", "Playfair Display", "Times New Roman", serif;
  --mono: ui-monospace, "SF Mono", "JetBrains Mono", "Roboto Mono", Menlo, monospace;

  position: relative;
  min-height: 100vh;
  width: 100%;
  background: var(--ink);
  color: var(--bone);
  font-family: var(--mincho);
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
}
.sb-root::before {
  content: "";
  position: absolute; inset: 0;
  pointer-events: none;
  background-image: repeating-linear-gradient(
    to bottom, rgba(233,228,218,.028) 0 1px, transparent 1px 34px
  );
  z-index: 0;
}
.sb-root::after {
  content: "";
  position: absolute; inset: 0;
  pointer-events: none;
  background: radial-gradient(120% 90% at 50% 0%, transparent 30%, rgba(0,0,0,.75) 100%);
  z-index: 0;
}
.sb-wrap { position: relative; z-index: 1; max-width: 880px; margin: 0 auto; padding: 0 20px 64px; }

.sb-btn { font: inherit; cursor: pointer; border: none; background: none; color: inherit; }
.sb-btn:focus-visible, .sb-tap:focus-visible {
  outline: 2px solid var(--ember); outline-offset: 3px;
}

/* --- masthead --- */
.sb-mast { padding: 56px 0 30px; text-align: center; }
.sb-seal {
  display: inline-flex; align-items: center; justify-content: center;
  width: 46px; height: 46px; margin-bottom: 20px;
  border: 1px solid var(--blood); color: var(--ember);
  font-size: 20px; line-height: 1;
  box-shadow: 0 0 22px rgba(168,15,24,.34);
}
.sb-title {
  font-family: var(--mincho); font-size: clamp(46px, 12vw, 76px);
  letter-spacing: .22em; margin: 0 0 6px; font-weight: 400;
  text-indent: .22em;
  text-shadow: 0 0 26px rgba(168,15,24,.42);
}
.sb-latin {
  font-family: var(--display); font-size: 12px; letter-spacing: .52em;
  text-transform: uppercase; color: var(--ash); margin: 0 0 18px; text-indent: .52em;
}
.sb-tag { font-size: 14px; color: var(--ash); margin: 0; line-height: 1.6; }

/* --- section head --- */
.sb-sec { margin-top: 44px; }
.sb-sec-head { display: flex; align-items: baseline; gap: 14px; border-bottom: 1px solid var(--edge); padding-bottom: 10px; }
.sb-num { font-size: 22px; color: var(--blood); line-height: 1; }
.sb-sec-jp { font-size: 21px; letter-spacing: .1em; }
.sb-sec-en {
  font-family: var(--mono); font-size: 10px; letter-spacing: .22em;
  text-transform: uppercase; color: var(--ash); margin-left: auto;
}
.sb-blurb { font-size: 13px; color: var(--ash); margin: 10px 0 16px; line-height: 1.6; }

/* --- pack rows --- */
.sb-packs { display: grid; gap: 8px; }
.sb-pack {
  display: flex; align-items: center; gap: 14px; width: 100%;
  padding: 13px 15px; text-align: left;
  background: var(--sumi); border: 1px solid var(--edge);
  transition: border-color .18s, background .18s, transform .18s;
}
.sb-pack:hover { border-color: #4a3238; transform: translateX(3px); }
.sb-pack[data-on="true"] { border-color: var(--blood); background: #1a0f12; }
.sb-mark {
  flex: none; width: 17px; height: 17px; border: 1px solid var(--edge);
  display: grid; place-items: center;
}
.sb-pack[data-on="true"] .sb-mark { border-color: var(--blood); background: var(--blood); }
.sb-pack-jp { font-size: 16px; letter-spacing: .06em; }
.sb-pack-en { font-family: var(--mono); font-size: 10px; color: var(--ash); letter-spacing: .12em; text-transform: uppercase; margin-top: 3px; }
.sb-count { margin-left: auto; text-align: right; flex: none; }
.sb-count-n { font-family: var(--mono); font-size: 12px; color: var(--ash); }
.sb-bar { width: 54px; height: 2px; background: #241d21; margin-top: 6px; }
.sb-bar > i { display: block; height: 100%; background: var(--blood); }

/* --- options --- */
.sb-opts { margin-top: 40px; border-top: 1px solid var(--edge); padding-top: 20px; display: grid; gap: 12px; }
.sb-opt { display: flex; align-items: center; gap: 14px; }
.sb-opt-label { font-size: 14px; }
.sb-opt-hint { font-size: 12px; color: var(--ash); margin-top: 2px; }
.sb-seg { margin-left: auto; display: flex; border: 1px solid var(--edge); flex: none; }
.sb-seg button {
  font-family: var(--mono); font-size: 11px; letter-spacing: .1em;
  padding: 7px 13px; color: var(--ash); transition: color .15s, background .15s;
}
.sb-seg button + button { border-left: 1px solid var(--edge); }
.sb-seg button[data-on="true"] { background: var(--blood); color: var(--bone); }

/* --- start --- */
.sb-start-row { position: sticky; bottom: 0; margin-top: 34px; padding: 18px 0 10px;
  background: linear-gradient(to top, var(--ink) 62%, transparent); }
.sb-start {
  display: flex; align-items: center; justify-content: center; gap: 11px;
  width: 100%; padding: 17px; letter-spacing: .3em; text-indent: .3em;
  font-family: var(--display); font-size: 13px; text-transform: uppercase;
  background: var(--blood); color: var(--bone);
  transition: background .18s, box-shadow .18s;
}
.sb-start:hover:not(:disabled) { background: var(--ember); box-shadow: 0 0 34px rgba(226,36,47,.34); }
.sb-start:disabled { background: #1c181a; color: #4c454a; cursor: not-allowed; }

/* --- study --- */
.sb-rail { position: fixed; top: 0; left: 0; right: 0; height: 2px; background: #1c1719; z-index: 3; }
.sb-rail > i { display: block; height: 100%; background: var(--blood); transition: width .3s ease; }
.sb-bar-top { display: flex; align-items: center; gap: 12px; padding: 22px 0 0; }
.sb-icon { padding: 8px; color: var(--ash); transition: color .15s; }
.sb-icon:hover { color: var(--bone); }
.sb-meta { margin-left: auto; font-family: var(--mono); font-size: 11px; letter-spacing: .16em; color: var(--ash); }
.sb-meta b { color: var(--bone); font-weight: 400; }

.sb-stage { display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: 64vh; text-align: center; }
.sb-tap { display: block; width: 100%; cursor: pointer; background: none; border: none; color: inherit; padding: 0; }

.sb-glyphbox { position: relative; display: inline-block; }
.sb-glyph {
  position: relative; display: inline-block;
  font-family: var(--mincho); font-weight: 400; line-height: 1;
  font-size: clamp(108px, 30vw, 210px);
  letter-spacing: .02em;
  transition: font-size .38s cubic-bezier(.2,.8,.2,1);
  animation: sb-write .5s cubic-bezier(.2,.8,.2,1) both;
}
.sb-glyph[data-small="true"] { font-size: clamp(48px, 14vw, 92px); }
@keyframes sb-write {
  0%   { opacity: 0; transform: translateY(14px) scale(.94); }
  100% { opacity: 1; transform: none; }
}
.sb-glyph > .sb-ghost {
  position: absolute; left: 0; top: 0; right: 0; bottom: 0;
  color: var(--blood); animation: none;
  filter: blur(15px); opacity: .55;
  transform: translate(8px, 8px);
  transition: transform .5s cubic-bezier(.2,.8,.2,1), opacity .5s;
  pointer-events: none;
}
.sb-glyphbox[data-open="true"] .sb-glyph > .sb-ghost { transform: none; opacity: .28; }

.sb-prompt {
  font-family: var(--mono); font-size: clamp(30px, 9vw, 58px);
  letter-spacing: .08em; animation: sb-write .5s cubic-bezier(.2,.8,.2,1) both;
}
.sb-prompt-en { font-family: var(--display); font-size: clamp(26px, 7vw, 44px); letter-spacing: .04em; }

.sb-rule { width: 132px; height: 1px; background: var(--edge); margin: 26px auto 22px; position: relative; }
.sb-rule::after { content: ""; position: absolute; left: 0; top: 0; height: 1px; background: var(--blood);
  width: 0; animation: sb-draw .45s .06s ease forwards; }
@keyframes sb-draw { to { width: 100%; } }

.sb-answer { animation: sb-write .42s .04s cubic-bezier(.2,.8,.2,1) both; }
.sb-romaji { font-family: var(--mono); font-size: clamp(34px, 10vw, 62px); letter-spacing: .1em; }
.sb-read-row { display: flex; align-items: baseline; justify-content: center; gap: 14px; margin: 7px 0; }
.sb-read-tag {
  font-size: 12px; color: var(--ember); border: 1px solid var(--blood);
  padding: 2px 7px; line-height: 1.2; flex: none;
}
.sb-read { font-size: clamp(22px, 6vw, 33px); letter-spacing: .06em; }
.sb-mean { font-family: var(--display); font-size: 17px; color: var(--ash); margin-top: 16px; font-style: italic; }
.sb-hidden { color: var(--ash); font-family: var(--mono); font-size: 12px; letter-spacing: .24em; text-transform: uppercase; }

.sb-sound {
  display: inline-flex; align-items: center; gap: 9px; margin-top: 26px;
  padding: 10px 20px; border: 1px solid var(--edge); color: var(--ash);
  font-family: var(--mono); font-size: 11px; letter-spacing: .2em; text-transform: uppercase;
  transition: color .16s, border-color .16s;
}
.sb-sound:hover { color: var(--ember); border-color: var(--blood); }
.sb-sound:disabled { opacity: .35; cursor: default; }

.sb-grade { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 34px; }
.sb-g {
  display: flex; align-items: center; justify-content: center; gap: 9px; padding: 16px;
  border: 1px solid var(--edge); font-family: var(--display); font-size: 12px;
  letter-spacing: .24em; text-transform: uppercase; transition: all .16s;
}
.sb-g-again:hover { border-color: var(--blood); color: var(--ember); }
.sb-g-good:hover { border-color: var(--bone); background: var(--bone); color: var(--ink); }
.sb-reveal {
  display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%;
  margin-top: 34px; padding: 17px; background: var(--blood); color: var(--bone);
  font-family: var(--display); font-size: 12px; letter-spacing: .3em; text-transform: uppercase;
  transition: background .16s;
}
.sb-reveal:hover { background: var(--ember); }
.sb-keys { margin-top: 20px; font-family: var(--mono); font-size: 10px; letter-spacing: .14em;
  color: #554d52; text-transform: uppercase; }

/* --- done --- */
.sb-done-fig { font-family: var(--mono); font-size: 60px; letter-spacing: .04em; }
.sb-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: var(--edge);
  border: 1px solid var(--edge); margin: 32px 0; }
.sb-stat { background: var(--ink); padding: 20px 12px; text-align: center; }
.sb-stat-n { font-family: var(--mono); font-size: 26px; }
.sb-stat-l { font-family: var(--mono); font-size: 10px; letter-spacing: .18em; text-transform: uppercase;
  color: var(--ash); margin-top: 7px; }

.sb-note { font-size: 12px; color: var(--ash); line-height: 1.65; margin-top: 14px;
  border-left: 1px solid var(--blood); padding-left: 13px; }
.sb-foot { margin-top: 48px; padding-top: 18px; border-top: 1px solid var(--edge);
  display: flex; align-items: center; gap: 10px; }
.sb-reset { display: inline-flex; align-items: center; gap: 8px; font-family: var(--mono);
  font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: #554d52; padding: 6px 0; }
.sb-reset:hover { color: var(--ember); }

@media (prefers-reduced-motion: reduce) {
  .sb-root * { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
@media (max-width: 520px) {
  .sb-mast { padding-top: 40px; }
  .sb-stage { min-height: 58vh; }
}
`;

/* ------------------------------------------------------------------ */
/*  APP                                                                */
/* ------------------------------------------------------------------ */

export default function Shuboku() {
  const [screen, setScreen] = useState("decks");
  const [selected, setSelected] = useState(() => new Set(["hiragana-seion-a"]));
  const [reverse, setReverse] = useState(false);
  const [autoSound, setAutoSound] = useState(true);
  const [limit, setLimit] = useState(20);

  const [queue, setQueue] = useState([]);
  const [open, setOpen] = useState(false);
  const [tally, setTally] = useState({ done: 0, first: 0, missed: 0 });
  const [total, setTotal] = useState(0);
  const seenOnce = useRef(new Set());

  const { speak, hasVoice, checked } = useJapaneseVoice();
  const { progress, grade, reset } = useProgress();

  const itemsById = useMemo(() => {
    const m = {};
    PACKS.forEach((p) => p.items.forEach((it) => (m[it.id] = it)));
    return m;
  }, []);

  const current = queue.length ? itemsById[queue[0]] : null;

  const togglePack = (id) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const toggleScript = (scriptId) => {
    const ids = PACKS.filter((p) => p.script === scriptId).map((p) => p.id);
    const allOn = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const n = new Set(prev);
      ids.forEach((id) => (allOn ? n.delete(id) : n.add(id)));
      return n;
    });
  };

  const pool = useMemo(
    () => PACKS.filter((p) => selected.has(p.id)).flatMap((p) => p.items),
    [selected]
  );

  const packMastery = (pack) => {
    const boxes = pack.items.map((i) => (progress[i.id] ? progress[i.id].box : 0));
    return boxes.reduce((a, b) => a + b, 0) / (pack.items.length * MAX_BOX);
  };

  const begin = () => {
    // Weakest cards first, shuffled inside each box, then trimmed to the session size.
    const ranked = pool
      .map((it) => ({
        id: it.id,
        box: progress[it.id] ? progress[it.id].box : 0,
        r: Math.random(),
      }))
      .sort((a, b) => a.box - b.box || a.r - b.r)
      .slice(0, limit === 0 ? pool.length : limit)
      .map((x) => x.id)
      .sort(() => Math.random() - 0.5);

    seenOnce.current = new Set();
    setQueue(ranked);
    setTotal(ranked.length);
    setTally({ done: 0, first: 0, missed: 0 });
    setOpen(false);
    setScreen("study");
  };

  const sayCurrent = useCallback(() => {
    if (current) speak(current.speak);
  }, [current, speak]);

  const flip = useCallback(() => {
    if (open) return;
    setOpen(true);
    if (autoSound) setTimeout(sayCurrent, 130);
  }, [open, autoSound, sayCurrent]);

  const answer = useCallback(
    (correct) => {
      if (!current) return;
      const firstLook = !seenOnce.current.has(current.id);
      seenOnce.current.add(current.id);
      grade(current.id, correct);

      setTally((t) => ({
        done: t.done + (correct ? 1 : 0),
        first: t.first + (correct && firstLook ? 1 : 0),
        missed: t.missed + (correct ? 0 : 1),
      }));

      setQueue((q) => {
        const [head, ...rest] = q;
        if (!correct) {
          const at = Math.min(4, rest.length);
          return [...rest.slice(0, at), head, ...rest.slice(at)];
        }
        return rest;
      });
      setOpen(false);
    },
    [current, grade]
  );

  // session ends when the queue empties
  useEffect(() => {
    if (screen === "study" && total > 0 && queue.length === 0) setScreen("done");
  }, [screen, total, queue.length]);

  // keyboard
  useEffect(() => {
    if (screen !== "study") return;
    const onKey = (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        open ? answer(true) : flip();
      } else if (open && (e.key === "1" || e.key.toLowerCase() === "j")) {
        answer(false);
      } else if (open && (e.key === "2" || e.key.toLowerCase() === "k")) {
        answer(true);
      } else if (e.key.toLowerCase() === "s") {
        sayCurrent();
      } else if (e.key === "Escape") {
        setScreen("decks");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, open, answer, flip, sayCurrent]);

  const pct = total ? Math.round(((total - queue.length) / total) * 100) : 0;

  /* ---------------- deck screen ---------------- */

  if (screen === "decks") {
    return (
      <div className="sb-root">
        <style>{CSS}</style>
        <div className="sb-wrap">
          <header className="sb-mast">
            <div className="sb-seal">朱</div>
            <h1 className="sb-title">朱墨</h1>
            <p className="sb-latin">Shuboku</p>
            <p className="sb-tag">
              Vermilion and ink. Read the character, then turn the page.
            </p>
          </header>

          {SCRIPTS.map((s) => {
            const packs = PACKS.filter((p) => p.script === s.id);
            const allOn = packs.every((p) => selected.has(p.id));
            return (
              <section className="sb-sec" key={s.id}>
                <button className="sb-btn sb-sec-head" style={{ width: "100%" }} onClick={() => toggleScript(s.id)}>
                  <span className="sb-num">{s.numeral}</span>
                  <span className="sb-sec-jp">{s.jp}</span>
                  <span className="sb-sec-en">{allOn ? "clear all" : s.name}</span>
                </button>
                <p className="sb-blurb">{s.blurb}</p>
                <div className="sb-packs">
                  {packs.map((p) => {
                    const on = selected.has(p.id);
                    const m = packMastery(p);
                    return (
                      <button
                        key={p.id}
                        className="sb-btn sb-pack"
                        data-on={on}
                        onClick={() => togglePack(p.id)}
                        aria-pressed={on}
                      >
                        <span className="sb-mark">
                          {on && <Check size={11} strokeWidth={3} color="#e9e4da" />}
                        </span>
                        <span>
                          <span className="sb-pack-jp">{p.jp}</span>
                          <span className="sb-pack-en" style={{ display: "block" }}>
                            {p.name}
                          </span>
                        </span>
                        <span className="sb-count">
                          <span className="sb-count-n">{p.items.length}</span>
                          <span className="sb-bar">
                            <i style={{ width: Math.round(m * 100) + "%" }} />
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}

          <div className="sb-opts">
            <div className="sb-opt">
              <span>
                <span className="sb-opt-label">Session length</span>
                <span className="sb-opt-hint" style={{ display: "block" }}>
                  Weakest cards come first.
                </span>
              </span>
              <span className="sb-seg">
                {[20, 50, 0].map((n) => (
                  <button key={n} className="sb-btn" data-on={limit === n} onClick={() => setLimit(n)}>
                    {n === 0 ? "ALL" : n}
                  </button>
                ))}
              </span>
            </div>

            <div className="sb-opt">
              <span>
                <span className="sb-opt-label">Direction</span>
                <span className="sb-opt-hint" style={{ display: "block" }}>
                  {reverse ? "Reading first, character second." : "Character first, reading second."}
                </span>
              </span>
              <span className="sb-seg">
                <button className="sb-btn" data-on={!reverse} onClick={() => setReverse(false)}>
                  字→音
                </button>
                <button className="sb-btn" data-on={reverse} onClick={() => setReverse(true)}>
                  音→字
                </button>
              </span>
            </div>

            <div className="sb-opt">
              <span>
                <span className="sb-opt-label">Speak on reveal</span>
                <span className="sb-opt-hint" style={{ display: "block" }}>
                  {checked && !hasVoice
                    ? "No Japanese voice found on this device."
                    : "Plays the reading automatically."}
                </span>
              </span>
              <span className="sb-seg">
                <button className="sb-btn" data-on={autoSound} onClick={() => setAutoSound(true)}>
                  ON
                </button>
                <button className="sb-btn" data-on={!autoSound} onClick={() => setAutoSound(false)}>
                  OFF
                </button>
              </span>
            </div>

            {checked && !hasVoice && (
              <p className="sb-note">
                Audio uses your device's built-in Japanese voice. To turn it on, add a Japanese
                voice in your system speech settings — macOS: Spoken Content › System Voice;
                Windows: Time &amp; Language › Speech; Android and iOS ship one already.
              </p>
            )}
          </div>

          <div className="sb-start-row">
            <button className="sb-btn sb-start" onClick={begin} disabled={!pool.length}>
              <Play size={14} strokeWidth={2} />
              {pool.length ? `Begin · ${limit === 0 || limit > pool.length ? pool.length : limit} cards` : "Pick a deck"}
            </button>
          </div>

          <div className="sb-foot">
            <Layers size={12} color="#554d52" />
            <span className="sb-count-n" style={{ color: "#554d52" }}>
              {Object.keys(progress).length} characters tracked
            </span>
            <button className="sb-btn sb-reset" style={{ marginLeft: "auto" }} onClick={reset}>
              <Trash2 size={11} /> Clear progress
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- done screen ---------------- */

  if (screen === "done") {
    const acc = total ? Math.round((tally.first / total) * 100) : 0;
    return (
      <div className="sb-root">
        <style>{CSS}</style>
        <div className="sb-wrap">
          <div className="sb-stage">
            <div className="sb-seal" style={{ marginBottom: 26 }}>了</div>
            <h2 className="sb-title" style={{ fontSize: "clamp(30px,8vw,46px)" }}>完</h2>
            <p className="sb-latin" style={{ marginTop: 10 }}>Session complete</p>

            <div className="sb-stats" style={{ width: "100%", maxWidth: 460 }}>
              <div className="sb-stat">
                <div className="sb-stat-n">{total}</div>
                <div className="sb-stat-l">cards</div>
              </div>
              <div className="sb-stat">
                <div className="sb-stat-n">{acc}%</div>
                <div className="sb-stat-l">first try</div>
              </div>
              <div className="sb-stat">
                <div className="sb-stat-n">{tally.missed}</div>
                <div className="sb-stat-l">retries</div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10, width: "100%", maxWidth: 460 }}>
              <button className="sb-btn sb-reveal" onClick={begin}>
                <Repeat size={14} /> Run it again
              </button>
              <button className="sb-btn sb-g sb-g-again" onClick={() => setScreen("decks")}>
                <ArrowLeft size={13} /> Back to decks
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- study screen ---------------- */

  const isKanji = current && current.type === "kanji";
  const frontText = !current
    ? ""
    : reverse
    ? isKanji
      ? current.meaning
      : current.romaji
    : current.char;

  return (
    <div className="sb-root">
      <style>{CSS}</style>
      <div className="sb-rail">
        <i style={{ width: pct + "%" }} />
      </div>

      <div className="sb-wrap">
        <div className="sb-bar-top">
          <button className="sb-btn sb-icon" onClick={() => setScreen("decks")} aria-label="Back to decks">
            <ArrowLeft size={17} />
          </button>
          <button
            className="sb-btn sb-icon"
            onClick={() => setQueue((q) => [...q].sort(() => Math.random() - 0.5))}
            aria-label="Shuffle remaining"
          >
            <Shuffle size={15} />
          </button>
          <span className="sb-meta">
            <b>{total - queue.length}</b> / {total}
          </span>
        </div>

        {current && (
          <div className="sb-stage">
            <button className="sb-tap" onClick={flip} aria-label={open ? "Answer shown" : "Reveal reading"}>
              {reverse ? (
                <div
                  className={isKanji ? "sb-prompt sb-prompt-en" : "sb-prompt"}
                  key={"p" + current.id}
                >
                  {frontText}
                </div>
              ) : (
                <span className="sb-glyphbox" data-open={open}>
                  <span className="sb-glyph" data-small={open} key={"g" + current.id}>
                    <span className="sb-ghost" aria-hidden="true">
                      {current.char}
                    </span>
                    {current.char}
                  </span>
                </span>
              )}

              <div className="sb-rule" key={"r" + current.id + open} />

              {!open ? (
                <div className="sb-hidden">tap to reveal</div>
              ) : (
                <div className="sb-answer" key={"a" + current.id}>
                  {reverse ? (
                    <div className="sb-glyph" data-small="true">
                      {current.char}
                    </div>
                  ) : isKanji ? (
                    <>
                      <div className="sb-read-row">
                        <span className="sb-read-tag">音</span>
                        <span className="sb-read">{current.on}</span>
                      </div>
                      <div className="sb-read-row">
                        <span className="sb-read-tag">訓</span>
                        <span className="sb-read">{current.kun}</span>
                      </div>
                      <div className="sb-mean">{current.meaning}</div>
                    </>
                  ) : (
                    <div className="sb-romaji">{current.romaji}</div>
                  )}
                </div>
              )}
            </button>

            <button
              className="sb-btn sb-sound"
              onClick={sayCurrent}
              disabled={checked && !hasVoice}
            >
              <Volume2 size={14} />
              {checked && !hasVoice ? "no voice" : "hear it"}
            </button>

            {!open ? (
              <button className="sb-btn sb-reveal" onClick={flip}>
                <Eye size={14} /> Reveal
              </button>
            ) : (
              <div className="sb-grade" style={{ width: "100%" }}>
                <button className="sb-btn sb-g sb-g-again" onClick={() => answer(false)}>
                  <RotateCcw size={13} /> Again
                </button>
                <button className="sb-btn sb-g sb-g-good" onClick={() => answer(true)}>
                  <Check size={14} /> Got it
                </button>
              </div>
            )}

            <div className="sb-keys">space reveal · 1 again · 2 got it · s sound · esc exit</div>
          </div>
        )}

        {!current && (
          <div className="sb-stage">
            <p className="sb-hidden">queue empty</p>
            <button className="sb-btn sb-g sb-g-again" style={{ marginTop: 20 }} onClick={() => setScreen("decks")}>
              <ArrowLeft size={13} /> Back to decks
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
