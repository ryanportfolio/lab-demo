export const fmtDelta = (g: number) => `${g >= 0 ? '+' : ''}${g.toFixed(3)}`;
export const fmtGini = (g: number) => g.toFixed(3);
export const fmtDev = (d: number) =>
  `deviance ${d >= 0 ? '+' : '-'}${Math.abs(d).toFixed(2)}%`;
export const fmtAic = (a: number) => `AIC ${a >= 0 ? '+' : ''}${Math.round(a)}`;
export const fmtThousands = (n: number) =>
  n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
export const countWord = (n: number) => WORDS[n] ?? String(n);

/** Render **bold** spans from platform copy. */
export function boldSpans(text: string): (string | { b: string })[] {
  const parts = text.split('**');
  return parts.map((p, i) => (i % 2 === 1 ? { b: p } : p));
}
