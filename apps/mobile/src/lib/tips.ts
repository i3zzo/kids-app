// Tip of the day: the same tip all day for a child, a different one tomorrow.
// No randomness, so both parents see the same tip on the same day.
export const TIP_SECTIONS = ['sleep', 'feeding', 'activities', 'learning', 'health'] as const;
export type TipSection = (typeof TIP_SECTIONS)[number];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Picks one tip for a child on a day ("YYYY-MM-DD"). Undefined if the list is empty. */
export function tipOfTheDay<T>(tips: T[], day: string, childId: string): T | undefined {
  if (!tips.length) return undefined;
  return tips[hash(`${day}:${childId}`) % tips.length];
}
