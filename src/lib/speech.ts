import { useCallback, useEffect, useState } from "react";

export function useJapaneseVoice() {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
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
    (text: string | undefined) => {
      if (!text || typeof window === "undefined" || !window.speechSynthesis) return;
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "ja-JP";
        u.rate = 0.75;
        u.pitch = 1;
        if (voice) u.voice = voice;
        window.speechSynthesis.speak(u);
      } catch {
        /* speech unavailable; button simply does nothing */
      }
    },
    [voice]
  );

  return { speak, hasVoice: !!voice, checked };
}
