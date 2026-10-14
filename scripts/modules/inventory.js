// =============================================================
//  RnR — inventory.js
//  Weight tracking, Carry Capacity, item stacking
// =============================================================

// ─────────────────────────────────────────────────────────────
//  CARRY CAPACITY
// ─────────────────────────────────────────────────────────────

/**
 * Maximum carry weight in lbs.
 * RnR rule: Strength × 15 lbs, plus the carry bonus of worn containers
 * (backpacks, pouches) and any equipped item that grants one.
 */
export function carryCapacity(actor) {
  const str = Number(foundry.utils.getProperty(actor, "system.attributes.strength.value")) || 8;
  let bonus = 0;
  for (const item of actor.items?.contents ?? []) {
    if (item.type !== "equipment") continue;
    if (!item.system?.equipmentSlot && !item.system?.handSlot) continue;
    bonus += Number(item.system?.carryBonus) || 0;
  }
  return str * 15 + bonus;
}

/**
 * Total weight of all items in the actor's inventory.
 * Items with a body/hand slot count as "equipped" (carried differently).
 */
export function totalCarriedWeight(actor) {
  let total = 0;
  for (const item of actor.items?.contents ?? []) {
    const sys = item.system ?? {};
    const qty = Math.max(1, Number(sys.quantity) || 1);
    const wgt = Number(sys.weight) || 0;
    total += qty * wgt;
  }
  return Math.round(total * 100) / 100;
}

export function encumbranceStatus(actor) {
  const carried  = totalCarriedWeight(actor);
  const capacity = carryCapacity(actor);
  const ratio    = carried / Math.max(1, capacity);

  if (ratio <= 0.5)  return { label: "Unencumbered", level: 0, ratio };
  if (ratio <= 0.75) return { label: "Lightly Encumbered (−5 Speed)", level: 1, ratio, speedPenalty: 5 };
  if (ratio <= 1.0)  return { label: "Heavily Encumbered (−10 Speed)", level: 2, ratio, speedPenalty: 10 };
  return { label: "Over Capacity", level: 3, ratio, speedPenalty: 20 };
}

// ─────────────────────────────────────────────────────────────
//  STACKING
// ─────────────────────────────────────────────────────────────

/**
 * Types that can stack (multiple of the same item merge qty).
 */
const STACKABLE_TYPES = new Set(["consumable", "loot", "ammunition"]);

export function canStack(item) {
  return STACKABLE_TYPES.has(item.type);
}

/**
 * When adding an item to an actor, check if a matching stack exists.
 * If so, increment quantity instead of creating a new item.
 *
 * @param {Actor}  actor
 * @param {object} itemData   plain item data object
 * @returns {Promise<Item>}
 */
export async function addItemToActor(actor, itemData) {
  if (canStack({ type: itemData.type })) {
    const existing = actor.items.find(i =>
      i.type === itemData.type &&
      i.name === itemData.name &&
      !i.system?.equipmentSlot &&
      !i.system?.handSlot
    );
    if (existing) {
      const curQty = Number(existing.system?.quantity) || 1;
      const addQty = Number(itemData.system?.quantity) || 1;
      await existing.update({ "system.quantity": curQty + addQty });
      return existing;
    }
  }
  const [created] = await actor.createEmbeddedDocuments("Item", [itemData]);
  return created;
}

/**
 * Remove a quantity from a stackable item. Delete the item when qty reaches 0.
 *
 * @param {Item}   item
 * @param {number} quantity   amount to remove (default 1)
 */
export async function consumeItem(item, quantity = 1) {
  const cur = Number(item.system?.quantity) || 1;
  if (cur <= quantity) {
    await item.delete();
    return 0;
  }
  const newQty = cur - quantity;
  await item.update({ "system.quantity": newQty });
  return newQty;
}

// ─────────────────────────────────────────────────────────────
//  INVENTORY SUMMARY (for sheet getData)
// ─────────────────────────────────────────────────────────────

export function buildInventorySummary(actor) {
  const carried  = totalCarriedWeight(actor);
  const capacity = carryCapacity(actor);
  const enc      = encumbranceStatus(actor);

  return {
    carriedWeight:  carried,
    carryCapacity:  capacity,
    encumbrance:    enc,
    weightPercent:  Math.min(100, Math.round((carried / Math.max(1, capacity)) * 100)),
    overCapacity:   enc.level >= 3,
  };
}
