/**
 * Resolve a single d20 Defense or Dodge roll against an Attack total.
 * A natural 20 succeeds and a natural 1 fails regardless of modifiers/total.
 * All other results compare the full total against the Attack total.
 */
export function resolveDefenseRoll(die, total, attackTotal) {
  const natural = Number(die);
  if (natural === 20) return { success: true, automatic: "natural-20" };
  if (natural === 1) return { success: false, automatic: "natural-1" };
  return {
    success: Number(total) >= Number(attackTotal),
    automatic: null,
  };
}
