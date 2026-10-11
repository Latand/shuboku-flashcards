/* Ukrainian number-aware labels. */

const rules = new Intl.PluralRules("uk");

/** Picks the form for n: [one, few, many], e.g. день / дні / днів. */
export function plural(n: number, forms: readonly [string, string, string]): string {
  const cat = rules.select(Math.abs(n));
  return cat === "one" ? forms[0] : cat === "few" ? forms[1] : forms[2];
}

export const daysLabel = (n: number) => `${n} ${plural(n, ["день", "дні", "днів"])}`;
export const cardsLabel = (n: number) => `${n} ${plural(n, ["картка", "картки", "карток"])}`;

const weeksLabel = (n: number) => `${n} ${plural(n, ["тиждень", "тижні", "тижнів"])}`;
const monthsLabel = (n: number) => `${n} ${plural(n, ["місяць", "місяці", "місяців"])}`;
const yearsLabel = (n: number) => `${n} ${plural(n, ["рік", "роки", "років"])}`;

/** Interval until the next review, as shown under a grade button. */
export function formatInterval(days: number): string {
  if (!(days >= 1)) return "скоро";
  const d = Math.round(days);
  if (d === 1) return "завтра";
  if (d < 14) return daysLabel(d);
  if (d < 60) return weeksLabel(Math.round(d / 7));
  if (d < 365) return monthsLabel(Math.round(d / 30));
  return yearsLabel(Math.round(d / 365));
}
