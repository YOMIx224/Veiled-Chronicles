/**
 * Advanced Magic Specialization — "Weaves".
 *
 * A weave is armed before casting and applies to the next eligible spell. Rules:
 *  - one weave per spell;
 *  - a weave never creates, refunds or substitutes spell slots, and never removes Concentration;
 *  - `appliesTo` states exactly which spells qualify; everything not listed in `effects` is preserved;
 *  - `metamagic.policy` "exclusive" means the weave cannot be combined with the listed
 *    Metamagic options on the same casting (and counts as Metamagic for "one per spell" limits).
 */
const t = (en, th) => ({ en, th });
const DAMAGE_TYPES = ["acid", "cold", "fire", "force", "lightning", "necrotic", "poison", "psychic", "radiant", "thunder"];

export const WEAVES = [
  {
    id: "narrowed-cone", category: "shaping",
    name: t("Narrowed Focus", "จุดโฟกัสแคบลง"),
    description: t("Reduce a cone or line spell's size by 5 ft; its damage roll gains +half proficiency bonus.",
      "ลดขนาดเวทรูปกรวยหรือเส้นตรงลง 5 ฟุต ความเสียหาย +ครึ่งหนึ่งของโบนัสความชำนาญ"),
    learn: { spellcaster: true },
    appliesTo: { spellTarget: ["cone", "line"], spellLevel: { min: 1, max: 5 }, spellDamageType: DAMAGE_TYPES },
    cost: { momentum: 1 },
    effects: [{ kind: "areaDelta", feet: -5 }, { kind: "damageBonus", value: "halfpb" }],
    metamagic: { policy: "compatible", conflicts: [] },
    preserves: t("Range, targets, saving throw, Concentration and components are unchanged.", "ระยะ เป้าหมาย การเซฟ สมาธิ และส่วนประกอบไม่เปลี่ยน")
  },
  {
    id: "frostfire-inversion", category: "elemental",
    name: t("Frostfire Inversion", "สลับไฟน้ำแข็ง"),
    description: t("Fire damage becomes cold, or cold damage becomes fire.", "ความเสียหายไฟกลายเป็นความเย็น หรือความเย็นกลายเป็นไฟ"),
    learn: { spellcaster: true },
    appliesTo: { spellDamageType: ["fire", "cold"] },
    cost: { momentum: 1 },
    effects: [
      { kind: "damageTypeSwap", from: ["fire"], to: "cold" },
      { kind: "damageTypeSwap", from: ["cold"], to: "fire" }
    ],
    metamagic: { policy: "exclusive", conflicts: ["transmuted-spell"] },
    preserves: t("Damage amount and every other property are unchanged; only one type changes.", "ปริมาณความเสียหายและคุณสมบัติอื่นไม่เปลี่ยน")
  },
  {
    id: "anchored-expanse", category: "area",
    name: t("Anchored Expanse", "พื้นที่ยึดตรึง"),
    description: t("A sphere, cube, cylinder or emanation grows by 5 ft. Must be cast with a slot at least one level above the spell's level.",
      "เวททรงกลม ลูกบาศก์ ทรงกระบอก หรือแผ่รังสี ขยาย 5 ฟุต ต้องร่ายด้วยช่องเวทที่สูงกว่าระดับเวทอย่างน้อย 1 ระดับ"),
    learn: { spellcaster: true },
    appliesTo: { spellTarget: ["sphere", "cube", "cylinder", "radius", "emanation"], spellLevel: { min: 1, max: 5 } },
    cost: { slotLevel: 1 },
    effects: [{ kind: "areaDelta", feet: 5 }],
    metamagic: { policy: "compatible", conflicts: [] },
    preserves: t("Saves, duration and Concentration are unchanged; the higher slot is really spent and upcasts normally.", "การเซฟ ระยะเวลา และสมาธิไม่เปลี่ยน ช่องเวทที่สูงกว่าถูกใช้จริงและอัปแคสต์ตามปกติ")
  },
  {
    id: "needle-casting", category: "precision",
    name: t("Needle Casting", "ร่ายเข็ม"),
    description: t("A spell attack gains +1 to hit and +30 ft range.", "การโจมตีด้วยเวท +1 และระยะ +30 ฟุต"),
    learn: { spellcaster: true },
    appliesTo: { spellActivity: ["attack"] },
    cost: { momentum: 1 },
    effects: [{ kind: "attackBonus", value: 1 }, { kind: "rangeDelta", feet: 30 }],
    metamagic: { policy: "exclusive", conflicts: ["distant-spell", "seeking-spell"] },
    preserves: t("Touch spells stay touch spells (range only extends ranged spells).", "เวทสัมผัสยังเป็นเวทสัมผัส")
  },
  {
    id: "siphoned-remnant", category: "efficiency",
    name: t("Siphoned Remnant", "เศษพลังที่ดูดกลับ"),
    description: t("A damaging leveled spell deals 2 less damage; you gain temporary hit points equal to half your proficiency bonus.",
      "เวทระดับ 1+ ที่สร้างความเสียหายลดลง 2 คุณได้ HP ชั่วคราวเท่าครึ่งหนึ่งของโบนัสความชำนาญ"),
    learn: { spellcaster: true },
    appliesTo: { spellLevel: { min: 1 }, spellDamageType: DAMAGE_TYPES },
    cost: { uses: { max: 2, per: "lr" } },
    effects: [{ kind: "damagePenalty", value: 2 }, { kind: "secondary", type: "tempHp", value: "halfpb", target: "self" }],
    metamagic: { policy: "compatible", conflicts: [] },
    preserves: t("Never restores slots or Momentum.", "ไม่คืนช่องเวทหรือโมเมนตัม")
  },
  {
    id: "warding-cast", category: "defensive",
    name: t("Warding Cast", "ร่ายพร้อมป้องกัน"),
    description: t("When you cast a leveled spell, gain +1 AC until the start of your next turn.", "เมื่อร่ายเวทระดับ 1+ ได้รับ AC +1 จนถึงต้นเทิร์นถัดไป"),
    learn: { spellcaster: true },
    appliesTo: { spellLevel: { min: 1 } },
    cost: { momentum: 1 },
    effects: [{ kind: "secondary", type: "guard", value: 1, target: "self" }],
    metamagic: { policy: "compatible", conflicts: [] },
    preserves: t("The spell itself is unchanged.", "ตัวเวทไม่เปลี่ยน")
  },
  {
    id: "shared-conduit", category: "support",
    name: t("Shared Conduit", "ท่อร่วม"),
    description: t("A non-damaging spell of 3rd level or lower that targets one creature can target one additional willing creature. Requires a slot one level higher.",
      "เวทระดับ 3 หรือต่ำกว่าที่ไม่สร้างความเสียหายและมีเป้าหมายเดียว สามารถเพิ่มเป้าหมายที่ยินยอมได้อีกหนึ่ง ต้องใช้ช่องเวทสูงกว่า 1 ระดับ"),
    learn: { spellcaster: true },
    appliesTo: { spellLevel: { min: 1, max: 3 }, spellActivity: ["heal", "utility", "enchant"], not: { spellDamageType: DAMAGE_TYPES } },
    cost: { slotLevel: 1, uses: { max: 1, per: "lr" } },
    effects: [{ kind: "targetDelta", value: 1 }],
    metamagic: { policy: "exclusive", conflicts: ["twinned-spell"] },
    preserves: t("Concentration still applies to both targets as one spell.", "สมาธิยังคงเป็นเวทเดียวสำหรับทั้งสองเป้าหมาย")
  },
  {
    id: "bloodied-surge", category: "conditional",
    name: t("Bloodied Surge", "พลุ่งพล่านยามบาดเจ็บ"),
    description: t("While you are Bloodied, a damaging spell adds a 1d6 rider die.", "ขณะบาดเจ็บสาหัส เวทที่สร้างความเสียหายเพิ่มลูกเต๋าเสริม 1d6"),
    learn: { spellcaster: true },
    appliesTo: { spellDamageType: DAMAGE_TYPES, bloodied: true },
    cost: { momentum: 1 },
    effects: [{ kind: "riderDie", dice: "1d6" }],
    metamagic: { policy: "compatible", conflicts: [] },
    preserves: t("Only one rider die per spell from all Forge sources.", "ลูกเต๋าเสริมหนึ่งลูกต่อเวทจากทุกแหล่ง")
  }
];
