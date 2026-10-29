/**
 * Expansion content: evolution paths for every 2024 class, more techniques,
 * modifiers, weaves, weapon paths, constellation nodes and synergies.
 * Everything here goes through the same validation as the core content.
 */
const t = (en, th) => ({ en, th });
const TIERS = [3, 7, 11, 15];
const tier = (n, name, effects, description) => ({ tier: n, classLevel: TIERS[n - 1], name, description, effects });
const ELEMENTS = ["acid", "cold", "fire", "lightning", "thunder"];
const DAMAGE_TYPES = ["acid", "cold", "fire", "force", "lightning", "necrotic", "poison", "psychic", "radiant", "thunder"];

/* ======================================================================== */
/*  Techniques                                                              */
/* ======================================================================== */

export const TECHNIQUES_EXP = [
  {
    id: "quarry-shot", kind: "action", action: "attackReplace", delivery: "weaponAttack", theme: "offense", grantOnly: true,
    name: t("Quarry Shot", "ยิงเหยื่อ"),
    description: t("Replace one ranged attack: −1 to hit; on a hit add a 1d6 rider die.", "แทนการโจมตีระยะไกล: โจมตี −1 หากโดนเพิ่มลูกเต๋าเสริม 1d6"),
    tags: ["weapon", "ranged", "precision"],
    requires: { weapon: true, weaponRange: "ranged" },
    cost: { momentum: 1 },
    effects: [{ kind: "attackPenalty", value: 1 }, { kind: "riderDie", dice: "1d6" }],
    masteryInteraction: t("Mastery applies normally; the rider die never doubles except on a critical hit.", "มาสเตอรีทำงานปกติ ลูกเต๋าเสริมเพิ่มเป็นสองเท่าเฉพาะคริติคอล")
  },
  {
    id: "crippling-shot", kind: "action", action: "attackReplace", delivery: "weaponAttack", theme: "control", grantOnly: true,
    name: t("Crippling Shot", "ยิงตัดขา"),
    description: t("Replace one ranged attack: no ability modifier to damage; on a hit the target's speed drops by 15 ft until the start of your next turn.",
      "แทนการโจมตีระยะไกล: ความเสียหายไม่บวกค่าความสามารถ หากโดนความเร็วเป้าหมายลด 15 ฟุตจนถึงต้นเทิร์นถัดไป"),
    tags: ["weapon", "ranged", "control"],
    requires: { weapon: true, weaponRange: "ranged" },
    cost: {}, limits: { oncePer: "turn" },
    effects: [{ kind: "damagePenalty", value: "ability" }, { kind: "secondary", type: "slow", feet: 15, target: "target" }],
    masteryInteraction: t("Does not stack with Slow mastery; the larger reduction applies.", "ไม่ซ้อนกับมาสเตอรีสโลว์ ใช้ค่าที่ลดมากกว่า")
  },
  {
    id: "shadow-feint", kind: "action", action: "attackReplace", delivery: "weaponAttack", theme: "control", grantOnly: true,
    name: t("Shadow Feint", "หลอกล่อเงา"),
    description: t("Replace one finesse or light attack: −2 damage; on a hit the target is off-balance (disadvantage on its next attack roll).",
      "แทนการโจมตีอาวุธฟิเนสส์หรือเบา: ความเสียหาย −2 หากโดนเป้าหมายเสียหลัก (เสียเปรียบในการโจมตีครั้งถัดไป)"),
    tags: ["weapon", "melee", "control"],
    requires: { weapon: true, weaponProperty: ["fin", "lgt"] },
    cost: {}, limits: { oncePer: "turn" },
    effects: [{ kind: "damagePenalty", value: 2 }, { kind: "secondary", type: "disadvantageTarget", target: "target" }],
    masteryInteraction: t("Vex and Shadow Feint can both apply: Vex helps you, the feint hinders the target.", "เว็กซ์กับหลอกล่อเงาใช้ร่วมกันได้")
  },
  {
    id: "dawn-strike", kind: "action", action: "attackReplace", delivery: "weaponAttack", theme: "offense", grantOnly: true,
    name: t("Dawn Strike", "ฟาดรุ่งอรุณ"),
    description: t("Replace one melee attack: −1 to hit; on a hit add 1d6 radiant.", "แทนการโจมตีประชิด: โจมตี −1 หากโดนเพิ่ม 1d6 แสงศักดิ์สิทธิ์"),
    tags: ["weapon", "melee", "radiant"],
    requires: { weapon: true, weaponRange: "melee" },
    cost: { momentum: 1 },
    effects: [{ kind: "attackPenalty", value: 1 }, { kind: "riderDie", dice: "1d6", damageType: "radiant" }]
  },
  {
    id: "flowing-palm", kind: "action", action: "attackReplace", delivery: "weaponAttack", theme: "control", grantOnly: true,
    name: t("Flowing Palm", "ฝ่ามือสายน้ำ"),
    description: t("Replace one melee attack: −2 damage; on a hit push the target up to 10 ft.", "แทนการโจมตีประชิด: ความเสียหาย −2 หากโดนผลักเป้าหมายได้ถึง 10 ฟุต"),
    tags: ["weapon", "melee", "control", "unarmed"],
    requires: { weapon: true, weaponRange: "melee" },
    cost: {}, limits: { oncePer: "turn" },
    effects: [{ kind: "damagePenalty", value: 2 }, { kind: "secondary", type: "push", feet: 10, target: "target" }],
    masteryInteraction: t("With Push mastery the target moves once, by the larger distance.", "หากมีมาสเตอรีพุช ผลักครั้งเดียวด้วยระยะที่มากกว่า")
  },
  {
    id: "still-water-guard", kind: "reaction", action: "reaction", delivery: "self", theme: "mobility", trigger: "missedBy",
    grantOnly: true,
    name: t("Still Water Guard", "การ์ดน้ำนิ่ง"),
    description: t("Reaction when an attack misses you: move up to 10 ft without provoking Opportunity Attacks.",
      "รีแอคชันเมื่อการโจมตีพลาดคุณ: เคลื่อนที่ได้ถึง 10 ฟุตโดยไม่ถูกโจมตีฉวยโอกาส"),
    tags: ["reaction", "mobility", "self"],
    requires: null,
    cost: { momentum: 1 },
    effects: [{ kind: "secondary", type: "shift", feet: 10, target: "self" }]
  },
  {
    id: "gale-step", kind: "action", action: "bonus", delivery: "self", theme: "mobility", grantOnly: true,
    name: t("Gale Step", "ก้าวลมกรรโชก"),
    description: t("Bonus Action: move up to 10 ft without provoking Opportunity Attacks.", "โบนัสแอคชัน: เคลื่อนที่ได้ถึง 10 ฟุตโดยไม่ถูกโจมตีฉวยโอกาส"),
    tags: ["self", "mobility"],
    requires: null,
    cost: { momentum: 1 },
    effects: [{ kind: "secondary", type: "shift", feet: 10, target: "self" }]
  },
  {
    id: "earthshaker-stomp", kind: "action", action: "action", delivery: "area", theme: "control", grantOnly: true,
    name: t("Earthshaker Stomp", "กระทืบแผ่นดินไหว"),
    description: t("Action: one creature within 5 ft makes a Strength save or falls Prone.", "แอคชัน: สิ่งมีชีวิตหนึ่งตัวในระยะ 5 ฟุตเซฟ STR มิฉะนั้นล้มลง"),
    tags: ["area", "control", "melee"],
    requires: null,
    cost: { momentum: 2 },
    effects: [{ kind: "secondary", type: "condition", condition: "prone", save: "str", target: "target" }]
  },
  {
    id: "cutting-verse", kind: "action", action: "bonus", delivery: "area", theme: "control", grantOnly: true,
    name: t("Cutting Verse", "บทกลอนเชือดเฉือน"),
    description: t("Bonus Action: one creature you can see within 60 ft is off-balance (disadvantage on its next attack roll).",
      "โบนัสแอคชัน: สิ่งมีชีวิตหนึ่งตัวที่เห็นในระยะ 60 ฟุตเสียหลัก (เสียเปรียบในการโจมตีครั้งถัดไป)"),
    tags: ["command", "control", "spell"],
    requires: null,
    cost: { momentum: 2 },
    effects: [{ kind: "secondary", type: "disadvantageTarget", target: "target" }]
  },
  {
    id: "inspiring-refrain", kind: "action", action: "bonus", delivery: "ally", theme: "support", grantOnly: true,
    name: t("Inspiring Refrain", "ท่อนร้องปลุกใจ"),
    description: t("Bonus Action: the next attack roll one ally makes against a creature before your next turn has advantage.",
      "โบนัสแอคชัน: การโจมตีครั้งถัดไปของพันธมิตรหนึ่งคนก่อนเทิร์นถัดไปของคุณได้เปรียบ"),
    tags: ["command", "support", "ally"],
    requires: null,
    cost: { momentum: 1 },
    effects: [{ kind: "secondary", type: "advantageAlly", target: "ally" }]
  },
  {
    id: "banner-call", kind: "action", action: "bonus", delivery: "ally", theme: "leadership", grantOnly: true,
    name: t("Banner Call", "เสียงเรียกธงรบ"),
    description: t("Bonus Action: one ally within 30 ft gains +1 AC until the start of your next turn.", "โบนัสแอคชัน: พันธมิตรหนึ่งคนในระยะ 30 ฟุตได้ AC +1 จนถึงต้นเทิร์นถัดไป"),
    tags: ["command", "defense", "ally"],
    requires: null,
    cost: { momentum: 1 },
    effects: [{ kind: "secondary", type: "guard", value: 1, target: "ally" }]
  },
  {
    id: "thornlash", kind: "action", action: "bonus", delivery: "area", theme: "control", grantOnly: true,
    name: t("Thornlash", "แส้หนาม"),
    description: t("Bonus Action while concentrating on a spell: one creature within 30 ft has its speed reduced by 10 ft until the start of your next turn.",
      "โบนัสแอคชันขณะรักษาสมาธิเวท: สิ่งมีชีวิตหนึ่งตัวในระยะ 30 ฟุตความเร็วลด 10 ฟุต"),
    tags: ["spell", "control"],
    requires: { concentrating: true },
    cost: { uses: { max: 2, per: "sr" } },
    effects: [{ kind: "secondary", type: "slow", feet: 10, target: "target" }]
  },
  {
    id: "hexing-mark", kind: "action", action: "bonus", delivery: "area", theme: "control", grantOnly: true,
    name: t("Hexing Mark", "ตราสาป"),
    description: t("Bonus Action: a creature within 60 ft is Marked until the start of your next turn (disadvantage on attacks against anyone but you).",
      "โบนัสแอคชัน: สิ่งมีชีวิตในระยะ 60 ฟุตถูกหมายหัวจนถึงต้นเทิร์นถัดไป (เสียเปรียบเมื่อโจมตีผู้อื่นนอกจากคุณ)"),
    tags: ["spell", "control"],
    requires: { spellcaster: true },
    cost: { momentum: 1 },
    effects: [{ kind: "secondary", type: "mark", target: "target" }]
  },
  {
    id: "eldritch-recoil", kind: "reaction", action: "reaction", delivery: "area", theme: "reactive", trigger: "damaged",
    grantOnly: true,
    name: t("Eldritch Recoil", "แรงสะท้อนพิสดาร"),
    description: t("Reaction when a creature within 10 ft damages you: push it up to 10 ft away.", "รีแอคชันเมื่อสิ่งมีชีวิตในระยะ 10 ฟุตทำความเสียหายแก่คุณ: ผลักออกไปได้ถึง 10 ฟุต"),
    tags: ["reaction", "spell", "control"],
    requires: { spellcaster: true },
    cost: { momentum: 1 },
    effects: [{ kind: "secondary", type: "push", feet: 10, target: "target" }]
  },
  {
    id: "sorcerous-surge", kind: "modifyFeature", action: "free", delivery: "self", theme: "resource", grantOnly: true,
    modifiesFeature: { feature: "innate-sorcery" },
    name: t("Sorcerous Surge", "พลังเวทพลุ่งพล่าน"),
    description: t("Modifies Innate Sorcery: when you activate it, also gain temporary HP equal to half your proficiency bonus.",
      "ปรับแต่งอินเนตซอร์เซอรี: เมื่อเปิดใช้ ได้ HP ชั่วคราวเท่าครึ่งหนึ่งของโบนัสความชำนาญ"),
    tags: ["feature", "self", "spell"],
    requires: null,
    cost: { momentum: 1 },
    effects: [{ kind: "secondary", type: "tempHp", value: "halfpb", target: "self" }]
  },
  {
    id: "channel-ward", kind: "modifyFeature", action: "free", delivery: "ally", theme: "support", grantOnly: true,
    modifiesFeature: { feature: "channel-divinity" },
    name: t("Channel Ward", "ผนึกแชนเนล"),
    description: t("Modifies Channel Divinity: when you use it, one ally within 30 ft also gains +1 AC until the start of your next turn.",
      "ปรับแต่งแชนเนลดิวินิตี: เมื่อใช้ พันธมิตรหนึ่งคนในระยะ 30 ฟุตได้ AC +1 จนถึงต้นเทิร์นถัดไปด้วย"),
    tags: ["feature", "support", "ally"],
    requires: null,
    cost: { momentum: 1 },
    effects: [{ kind: "secondary", type: "guard", value: 1, target: "ally" }]
  }
];

/* ======================================================================== */
/*  Modifiers                                                               */
/* ======================================================================== */

export const MODIFIERS_EXP = [
  {
    id: "wide-arc", slotCost: 1, exclusiveGroup: "shape-area",
    name: t("Wide Arc", "วงกว้าง"),
    description: t("This area technique reaches one more creature within 5 ft of the first. Costs 1 more Momentum.", "เทคนิคพื้นที่นี้ส่งผลถึงสิ่งมีชีวิตเพิ่มอีกหนึ่งตัวในระยะ 5 ฟุตจากเป้าหมายแรก ใช้โมเมนตัมเพิ่ม 1"),
    compat: { anyTags: ["area"], excludeTags: ["reaction"] },
    cost: { momentum: 1 }, limits: { maxPerLoadout: 1 },
    effects: [{ kind: "targetDelta", value: 1 }],
    interaction: t("Only one target increase applies per use.", "เพิ่มเป้าหมายได้ครั้งเดียวต่อการใช้")
  },
  {
    id: "long-shadow", slotCost: 1, exclusiveGroup: "shape-range",
    name: t("Long Shadow", "เงายาว"),
    description: t("+10 ft range for this technique.", "ระยะของเทคนิคนี้ +10 ฟุต"),
    compat: { anyTags: ["spell", "command"] },
    cost: { uses: { max: 3, per: "sr" } },
    effects: [{ kind: "rangeDelta", feet: 10 }],
    interaction: t("The largest single range change applies.", "ใช้การเพิ่มระยะที่มากที่สุดเพียงครั้งเดียว")
  },
  {
    id: "steady-hand", slotCost: 1, exclusiveGroup: "accuracy",
    name: t("Steady Hand", "มือมั่นคง"),
    description: t("+1 to hit, −1 damage.", "โจมตี +1 ความเสียหาย −1"),
    compat: { anyTags: ["weapon"] },
    cost: {},
    effects: [{ kind: "attackBonus", value: 1 }, { kind: "damagePenalty", value: 1 }],
    interaction: t("An alternative to Counterweight: pays in damage instead of Momentum.", "ทางเลือกแทนถ่วงน้ำหนัก: แลกด้วยความเสียหายแทนโมเมนตัม")
  },
  {
    id: "radiant-edge", slotCost: 1, exclusiveGroup: "element",
    name: t("Radiant Edge", "คมแสงศักดิ์สิทธิ์"),
    description: t("Bludgeoning, piercing or slashing damage from this technique becomes radiant.", "ความเสียหายทุบ แทง หรือฟันจากเทคนิคนี้กลายเป็นแสงศักดิ์สิทธิ์"),
    compat: { anyTags: ["weapon"] },
    cost: { uses: { max: 2, per: "sr" } },
    effects: [{ kind: "damageTypeSwap", from: ["bludgeoning", "piercing", "slashing"], to: "radiant" }],
    interaction: t("Changes type only, never amount.", "เปลี่ยนชนิดเท่านั้น ไม่เปลี่ยนปริมาณ")
  },
  {
    id: "thunder-edge", slotCost: 1, exclusiveGroup: "element",
    name: t("Thunder Edge", "คมอัสนี"),
    description: t("Bludgeoning, piercing or slashing damage from this technique becomes thunder.", "ความเสียหายทุบ แทง หรือฟันจากเทคนิคนี้กลายเป็นเสียงสะท้าน"),
    compat: { anyTags: ["weapon"] },
    cost: { uses: { max: 3, per: "sr" } },
    effects: [{ kind: "damageTypeSwap", from: ["bludgeoning", "piercing", "slashing"], to: "thunder" }],
    interaction: t("Changes type only, never amount.", "เปลี่ยนชนิดเท่านั้น ไม่เปลี่ยนปริมาณ")
  },
  {
    id: "sustaining-echo", slotCost: 1, exclusiveGroup: "sustain",
    name: t("Sustaining Echo", "เสียงสะท้อนหล่อเลี้ยง"),
    description: t("On a hit you gain temporary HP equal to half your proficiency bonus. Costs 1 more Momentum.", "หากโจมตีโดน ได้ HP ชั่วคราวเท่าครึ่งหนึ่งของโบนัสความชำนาญ ใช้โมเมนตัมเพิ่ม 1"),
    compat: { anyTags: ["weapon"] },
    cost: {},
    effects: [{ kind: "secondary", type: "tempHp", value: "halfpb", target: "self" }, { kind: "costDelta", value: 1 }],
    interaction: t("Competes with other secondary effects: only one applies per hit.", "แข่งกับผลรองอื่น ใช้ได้หนึ่งอย่างต่อการโจมตีโดน")
  },
  {
    id: "quickened-reflex", slotCost: 2, exclusiveGroup: "efficiency",
    name: t("Quickened Reflex", "ปฏิกิริยาเร่ง"),
    description: t("This reaction costs 1 less Momentum (minimum 1). Takes two modifier slots.", "รีแอคชันนี้ใช้โมเมนตัมน้อยลง 1 (ขั้นต่ำ 1) ใช้ช่องตัวปรับแต่งสองช่อง"),
    compat: { anyTags: ["reaction"], kinds: ["reaction"] },
    cost: {}, limits: { maxPerLoadout: 1 },
    effects: [{ kind: "costDelta", value: -1 }],
    interaction: t("Cost floor of 1 still applies; one per loadout.", "ค่าใช้จ่ายขั้นต่ำ 1 ยังมีผล ใช้ได้หนึ่งครั้งต่อชุด")
  },
  {
    id: "binding-rider", slotCost: 1, exclusiveGroup: "control",
    name: t("Binding Rider", "เสริมพันธนาการ"),
    description: t("No ability modifier to damage; on a hit the target makes a Strength save or is Grappled by you.", "ความเสียหายไม่บวกค่าความสามารถ หากโดนเป้าหมายเซฟ STR มิฉะนั้นถูกคุณจับล็อก"),
    compat: { anyTags: ["melee"], allTags: ["weapon"], excludeTags: ["control"] },
    cost: { momentum: 1 },
    effects: [{ kind: "damagePenalty", value: "ability" }, { kind: "secondary", type: "condition", condition: "grappled", save: "str", target: "target" }],
    interaction: t("Uses the normal Grappled rules (escape DC = the save DC). One secondary per hit.", "ใช้กฎจับล็อกปกติ หนึ่งผลรองต่อการโจมตีโดน")
  },
  {
    id: "piercing-focus", slotCost: 1, exclusiveGroup: "accuracy",
    name: t("Piercing Focus", "สมาธิทะลุทะลวง"),
    description: t("+1 to hit with this spell-tagged technique. Costs 1 more Momentum.", "โจมตี +1 สำหรับเทคนิคเวทนี้ ใช้โมเมนตัมเพิ่ม 1"),
    compat: { anyTags: ["spell", "arcane"] },
    cost: {},
    effects: [{ kind: "attackBonus", value: 1 }, { kind: "costDelta", value: 1 }],
    interaction: t("Counts toward the +2 Forge accuracy cap.", "นับรวมในเพดานความแม่นยำ +2")
  }
];

/* ======================================================================== */
/*  Weaves                                                                  */
/* ======================================================================== */

export const WEAVES_EXP = [
  {
    id: "steady-aim", category: "precision",
    name: t("Steady Aim", "เล็งมั่นคง"),
    description: t("A spell attack gains +1 to hit but deals 2 less damage.", "การโจมตีด้วยเวท +1 แต่ความเสียหาย −2"),
    learn: { spellcaster: true },
    appliesTo: { spellActivity: ["attack"] },
    cost: { uses: { max: 3, per: "sr" } },
    effects: [{ kind: "attackBonus", value: 1 }, { kind: "damagePenalty", value: 2 }],
    metamagic: { policy: "compatible", conflicts: [] },
    preserves: t("Range, targets and every other property are unchanged.", "ระยะ เป้าหมาย และคุณสมบัติอื่นไม่เปลี่ยน")
  },
  {
    id: "tempest-shift", category: "elemental",
    name: t("Tempest Shift", "สลับพายุ"),
    description: t("Lightning damage becomes thunder, or thunder becomes lightning.", "ความเสียหายสายฟ้ากลายเป็นเสียงสะท้าน หรือกลับกัน"),
    learn: { spellcaster: true },
    appliesTo: { spellDamageType: ["lightning", "thunder"] },
    cost: { momentum: 1 },
    effects: [
      { kind: "damageTypeSwap", from: ["lightning"], to: "thunder" },
      { kind: "damageTypeSwap", from: ["thunder"], to: "lightning" }
    ],
    metamagic: { policy: "exclusive", conflicts: ["transmuted-spell"] },
    preserves: t("Damage amount and saves are unchanged.", "ปริมาณความเสียหายและการเซฟไม่เปลี่ยน")
  },
  {
    id: "twilight-inversion", category: "elemental",
    name: t("Twilight Inversion", "สลับสนธยา"),
    description: t("Radiant damage becomes necrotic, or necrotic becomes radiant.", "ความเสียหายแสงศักดิ์สิทธิ์กลายเป็นพลังมืด หรือกลับกัน"),
    learn: { spellcaster: true },
    appliesTo: { spellDamageType: ["radiant", "necrotic"] },
    cost: { momentum: 1 },
    effects: [
      { kind: "damageTypeSwap", from: ["radiant"], to: "necrotic" },
      { kind: "damageTypeSwap", from: ["necrotic"], to: "radiant" }
    ],
    metamagic: { policy: "exclusive", conflicts: ["transmuted-spell"] },
    preserves: t("Damage amount and saves are unchanged; healing is never affected.", "ปริมาณความเสียหายและการเซฟไม่เปลี่ยน ไม่มีผลกับการรักษา")
  },
  {
    id: "contained-burst", category: "area",
    name: t("Contained Burst", "ระเบิดในกรอบ"),
    description: t("A sphere, cube or emanation shrinks by 5 ft; its damage roll gains +2.", "เวททรงกลม ลูกบาศก์ หรือแผ่รังสีหดลง 5 ฟุต ความเสียหาย +2"),
    learn: { spellcaster: true },
    appliesTo: { spellTarget: ["sphere", "cube", "radius", "emanation"], spellDamageType: DAMAGE_TYPES },
    cost: { uses: { max: 2, per: "lr" } },
    effects: [{ kind: "areaDelta", feet: -5 }, { kind: "damageBonus", value: 2 }],
    metamagic: { policy: "compatible", conflicts: [] },
    preserves: t("Saves, duration and Concentration are unchanged.", "การเซฟ ระยะเวลา และสมาธิไม่เปลี่ยน")
  },
  {
    id: "momentum-surge", category: "conditional",
    name: t("Momentum Surge", "โมเมนตัมพุ่งทะยาน"),
    description: t("While you have 3+ Momentum, a damaging spell gains +proficiency bonus damage. Costs 2 Momentum.",
      "ขณะมีโมเมนตัม 3 ขึ้นไป เวทที่สร้างความเสียหาย +โบนัสความชำนาญ ใช้โมเมนตัม 2"),
    learn: { spellcaster: true },
    appliesTo: { momentum: { min: 3 }, spellDamageType: DAMAGE_TYPES },
    cost: { momentum: 2 },
    effects: [{ kind: "damageBonus", value: "pb" }],
    metamagic: { policy: "compatible", conflicts: [] },
    preserves: t("Applies to one damage roll; never to healing.", "ใช้กับการทอยความเสียหายหนึ่งครั้ง ไม่ใช้กับการรักษา")
  },
  {
    id: "guardian-chant", category: "support",
    name: t("Guardian Chant", "บทสวดผู้พิทักษ์"),
    description: t("When a healing spell restores hit points to an ally, that ally also gains +1 AC until the start of your next turn.",
      "เมื่อเวทรักษาฟื้น HP ให้พันธมิตร พันธมิตรนั้นได้ AC +1 จนถึงต้นเทิร์นถัดไปด้วย"),
    learn: { spellcaster: true },
    appliesTo: { spellActivity: ["heal"] },
    cost: { momentum: 1 },
    effects: [{ kind: "secondary", type: "guard", value: 1, target: "ally" }],
    metamagic: { policy: "compatible", conflicts: [] },
    preserves: t("The amount healed is unchanged.", "ปริมาณการรักษาไม่เปลี่ยน")
  },
  {
    id: "stalwart-focus", category: "defensive",
    name: t("Stalwart Focus", "สมาธิแน่วแน่"),
    description: t("When you cast a Concentration spell, gain temporary HP equal to half your proficiency bonus.", "เมื่อร่ายเวทที่ต้องรักษาสมาธิ ได้ HP ชั่วคราวเท่าครึ่งหนึ่งของโบนัสความชำนาญ"),
    learn: { spellcaster: true },
    appliesTo: { spellConcentration: true },
    cost: { uses: { max: 2, per: "lr" } },
    effects: [{ kind: "secondary", type: "tempHp", value: "halfpb", target: "self" }],
    metamagic: { policy: "compatible", conflicts: [] },
    preserves: t("Concentration rules are unchanged.", "กฎการรักษาสมาธิไม่เปลี่ยน")
  },
  {
    id: "quick-weave", category: "efficiency",
    name: t("Quick Weave", "ถักทอฉับไว"),
    description: t("A damaging cantrip deals 1 less damage; you may move 5 ft without provoking.", "เวทแคนทริปที่สร้างความเสียหายลดลง 1 คุณเคลื่อนที่ 5 ฟุตได้โดยไม่ถูกโจมตีฉวยโอกาส"),
    learn: { spellcaster: true },
    appliesTo: { spellLevel: { max: 0 }, spellDamageType: DAMAGE_TYPES },
    cost: { uses: { max: 3, per: "sr" } },
    effects: [{ kind: "damagePenalty", value: 1 }, { kind: "secondary", type: "shift", feet: 5, target: "self" }],
    metamagic: { policy: "compatible", conflicts: [] },
    preserves: t("Never refunds slots or Momentum.", "ไม่คืนช่องเวทหรือโมเมนตัม")
  }
];

/* ======================================================================== */
/*  Weapon paths                                                            */
/* ======================================================================== */

export const WEAPON_PATHS_EXP = [
  {
    id: "polearm-sentinel", style: "sentinel", masteryPolicy: "augment",
    name: t("Polearm Sentinel", "ผู้เฝ้าทวน"),
    description: t("Hold the space your reach covers.", "ยึดพื้นที่ในระยะเอื้อม"),
    learn: { hasMastery: ["topple", "push", "cleave", "graze"] },
    requires: { weaponProperty: "rch" },
    ranks: [
      { rank: 1, level: 1, effects: [{ kind: "grantTechnique", id: "lockdown-strike" }] },
      { rank: 2, level: 5, effects: [{ kind: "stat", key: "initiative", value: 1 }] },
      { rank: 3, level: 11, effects: [{ kind: "secondary", type: "slow", feet: 10, target: "target", when: { weaponProperty: "rch", weaponMastery: ["topple", "push"] } }] }
    ]
  },
  {
    id: "marksman", style: "marksman", masteryPolicy: "augment",
    name: t("Marksman", "นักแม่นปืน"),
    description: t("Patience, then one clean shot.", "อดทน แล้วยิงนัดเดียวให้แม่น"),
    learn: { hasMastery: ["slow", "vex"] },
    requires: { weaponRange: "ranged" },
    ranks: [
      { rank: 1, level: 1, effects: [{ kind: "grantTechnique", id: "crippling-shot" }] },
      { rank: 2, level: 5, effects: [{ kind: "attackBonus", value: 1, when: { weaponRange: "ranged", weaponMastery: "vex" } }] },
      { rank: 3, level: 11, effects: [{ kind: "riderDie", dice: "1d4", when: { usingTechnique: ["crippling-shot", "quarry-shot"] } }] }
    ]
  },
  {
    id: "twin-fang", style: "dual", masteryPolicy: "augment",
    name: t("Twin Fang", "เขี้ยวคู่"),
    description: t("Two light blades, never still.", "ดาบเบาสองเล่มที่ไม่เคยหยุดนิ่ง"),
    learn: { hasMastery: ["nick"] },
    requires: { weaponProperty: "lgt" },
    ranks: [
      { rank: 1, level: 1, effects: [{ kind: "grantTechnique", id: "shadow-feint" }] },
      { rank: 2, level: 5, effects: [{ kind: "attackBonus", value: 1, when: { weaponProperty: "lgt", weaponMastery: "nick" } }] },
      { rank: 3, level: 11, effects: [{ kind: "secondary", type: "shift", feet: 5, target: "self", when: { weaponMastery: "nick" } }] }
    ]
  }
];

/* ======================================================================== */
/*  Class evolutions                                                        */
/* ======================================================================== */

const fx = {
  grant: id => ({ kind: "grantTechnique", id }),
  momentum: () => ({ kind: "resourceMax", value: 1 }),
  slot: () => ({ kind: "techniqueSlot", value: 1 }),
  modSlot: () => ({ kind: "modifierSlot", value: 1 }),
  stat: (key, value) => ({ kind: "stat", key, value })
};
const T = {
  momentum: tier3 => tier(3, tier3 ?? t("Deep Reserve", "สำรองลึก"), [fx.momentum()], t("+1 maximum Momentum.", "โมเมนตัมสูงสุด +1")),
  learn: (n, name, id, en, th) => tier(n, name, [fx.grant(id)], t(`Learn ${en}.`, `เรียนรู้${th}`))
};
const compatAll = t("Compatible with every subclass.", "ใช้ได้กับทุกซับคลาส");

export const EVOLUTIONS_EXP = [
  /* Barbarian */
  {
    id: "earthshaker", class: "barbarian", theme: "control", learn: null,
    name: t("Earthshaker", "ผู้เขย่าแผ่นดิน"), description: t("Rage that topples the battlefield.", "เรจที่โค่นสนามรบ"),
    tiers: [
      T.learn(1, t("Quaking Step", "ก้าวแผ่นดินไหว"), "earthshaker-stomp", "Earthshaker Stomp", "กระทืบแผ่นดินไหว"),
      tier(2, t("Unmovable", "ไม่อาจขยับ"), [fx.stat("saveAll", 1)], t("+1 to all saving throws.", "เซฟทั้งหมด +1")),
      T.momentum(),
      tier(4, t("Fault Line", "รอยเลื่อน"), [{ kind: "riderDie", dice: "1d4", damageType: "thunder", when: { weaponProperty: "hvy" } }], t("Heavy weapon hits add 1d4 thunder (rider die).", "การโจมตีด้วยอาวุธหนักเพิ่ม 1d4 เสียงสะท้าน"))
    ],
    interactions: { features: [{ feature: "rage", rule: t("Stomp works while raging; it is not an attack, so Rage Damage doesn't apply.", "ใช้กระทืบขณะเรจได้ ไม่ใช่การโจมตีจึงไม่ได้ความเสียหายเรจ") }], subclasses: compatAll },
    balance: { note: t("Control costs 2 Momentum and an Action.", "การควบคุมใช้โมเมนตัม 2 และแอคชัน"), reviewed: true }
  },
  /* Bard */
  {
    id: "cutting-chorus", class: "bard", theme: "control", learn: null,
    name: t("Cutting Chorus", "คอรัสเชือดเฉือน"), description: t("Words that unbalance foes.", "ถ้อยคำที่ทำให้ศัตรูเสียหลัก"),
    tiers: [
      T.learn(1, t("Barbed Verse", "กลอนหนาม"), "cutting-verse", "Cutting Verse", "บทกลอนเชือดเฉือน"),
      tier(2, t("Unshaken Voice", "เสียงไม่สั่นคลอน"), [fx.stat("concentration", 1)], t("+1 to Concentration saves.", "เซฟสมาธิ +1")),
      T.momentum(),
      tier(4, t("Full Repertoire", "บทเพลงครบชุด"), [fx.slot()], t("+1 technique slot.", "ช่องเทคนิค +1"))
    ],
    interactions: { features: [{ feature: "bardic-inspiration", rule: t("Unchanged; Momentum and Bardic Inspiration never convert into each other.", "ไม่เปลี่ยน โมเมนตัมกับบาร์ดิกอินสไปเรชันแลกกันไม่ได้") }], subclasses: compatAll },
    balance: { note: t("Debuff costs a Bonus Action and 2 Momentum.", "การลดทอนใช้โบนัสแอคชันและโมเมนตัม 2"), reviewed: true }
  },
  {
    id: "anthem-keeper", class: "bard", theme: "support", learn: null,
    name: t("Anthem Keeper", "ผู้รักษาเพลงสรรเสริญ"), description: t("Keep allies on the attack.", "ทำให้พันธมิตรรุกต่อเนื่อง"),
    tiers: [
      T.learn(1, t("Rousing Line", "ท่อนปลุกเร้า"), "inspiring-refrain", "Inspiring Refrain", "ท่อนร้องปลุกใจ"),
      T.learn(2, t("Marching Song", "เพลงเดินทัพ"), "rallying-command", "Rallying Command", "คำสั่งรวมพล"),
      T.momentum(),
      tier(4, t("Encore", "อังกอร์"), [fx.stat("checkAll", 1)], t("+1 to ability checks.", "การทดสอบความสามารถ +1"))
    ],
    interactions: { features: [{ feature: "bardic-inspiration", rule: t("An ally can benefit from Inspiring Refrain and Bardic Inspiration on the same roll; advantage never stacks.", "ใช้ร่วมกับบาร์ดิกอินสไปเรชันได้ ความได้เปรียบไม่ซ้อน") }], subclasses: compatAll },
    balance: { note: t("Advantage is a single next-roll effect; temp HP never stacks.", "ความได้เปรียบใช้ครั้งเดียว HP ชั่วคราวไม่ซ้อน"), reviewed: true }
  },
  /* Cleric */
  {
    id: "dawnbringer", class: "cleric", theme: "offense", learn: null,
    name: t("Dawnbringer", "ผู้นำรุ่งอรุณ"), description: t("Radiance in melee and in prayer.", "แสงศักดิ์สิทธิ์ทั้งในการต่อสู้และคำอธิษฐาน"),
    tiers: [
      T.learn(1, t("First Light", "แสงแรก"), "dawn-strike", "Dawn Strike", "ฟาดรุ่งอรุณ"),
      T.learn(2, t("Sheltering Light", "แสงคุ้มภัย"), "channel-ward", "Channel Ward (modifies Channel Divinity)", "ผนึกแชนเนล (ปรับแต่งแชนเนลดิวินิตี)"),
      T.momentum(),
      tier(4, t("Noon Sun", "ตะวันเที่ยง"), [{ kind: "riderDie", dice: "1d4", damageType: "radiant", when: { spell: true, spellDamageType: ["radiant"], spellLevel: { min: 1 } } }], t("Leveled radiant spells add 1d4 radiant (rider die).", "เวทแสงศักดิ์สิทธิ์ระดับ 1+ เพิ่ม 1d4"))
    ],
    interactions: { features: [{ feature: "divine-strike", rule: t("Divine Strike is native and separate; Forge still adds at most one rider die.", "ดีไวน์สไตรก์แยกจากระบบนี้ ฟอร์จยังเพิ่มลูกเต๋าเสริมได้หนึ่งลูก") }], subclasses: compatAll },
    balance: { note: t("Damage riders capped at 1d6 and cost Momentum.", "ลูกเต๋าเสริมสูงสุด 1d6 และใช้โมเมนตัม"), reviewed: true }
  },
  /* Druid */
  {
    id: "thornwarden", class: "druid", theme: "control", learn: { spellcaster: true },
    name: t("Thornwarden", "ผู้คุมหนาม"), description: t("Briars that slow every step.", "หนามที่ถ่วงทุกก้าว"),
    tiers: [
      T.learn(1, t("Briar Sense", "สัมผัสหนาม"), "thornlash", "Thornlash", "แส้หนาม"),
      tier(2, t("Deep Roots", "รากลึก"), [fx.stat("concentration", 2)], t("+2 to Concentration saves.", "เซฟสมาธิ +2")),
      T.momentum(),
      tier(4, t("Bramble Craft", "ศิลป์พงหนาม"), [fx.modSlot()], t("+1 modifier slot.", "ช่องตัวปรับแต่ง +1"))
    ],
    interactions: { features: [{ feature: "wild-shape", rule: t("Thornlash requires Concentration, so it ends if Wild Shape ends your spell.", "แส้หนามต้องมีสมาธิ จึงหยุดหากไวลด์เชปทำให้เวทจบ") }], subclasses: compatAll },
    balance: { note: t("Limited uses per short rest; requires Concentration.", "จำกัดครั้งต่อพักสั้น ต้องรักษาสมาธิ"), reviewed: true }
  },
  {
    id: "storm-herald", class: "druid", theme: "mobility", learn: { spellcaster: true },
    name: t("Storm Herald", "ผู้ประกาศพายุ"), description: t("Ride the wind between lightning.", "ขี่สายลมระหว่างสายฟ้า"),
    tiers: [
      T.learn(1, t("Tailwind", "ลมส่ง"), "gale-step", "Gale Step", "ก้าวลมกรรโชก"),
      tier(2, t("Static Charge", "ประจุสถิต"), [{ kind: "riderDie", dice: "1d4", damageType: "lightning", when: { spell: true, spellDamageType: ["lightning", "thunder"], spellLevel: { min: 1 } } }], t("Leveled lightning or thunder spells add 1d4 lightning.", "เวทสายฟ้าหรือเสียงสะท้านระดับ 1+ เพิ่ม 1d4 สายฟ้า")),
      T.momentum(),
      tier(4, t("Eye of the Gale", "ตาลมกรรโชก"), [fx.stat("speed", 5)], t("+5 ft speed.", "ความเร็ว +5 ฟุต"))
    ],
    interactions: { features: [{ feature: "wild-shape", rule: t("Gale Step works in any form.", "ก้าวลมกรรโชกใช้ได้ทุกร่าง") }], subclasses: compatAll },
    balance: { note: t("One rider die per spell from all sources.", "ลูกเต๋าเสริมหนึ่งลูกต่อเวทจากทุกแหล่ง"), reviewed: true }
  },
  /* Monk */
  {
    id: "flowing-river", class: "monk", theme: "control", learn: null,
    name: t("Flowing River", "แม่น้ำไหลริน"), description: t("Redirect force; never meet it head-on.", "เบี่ยงแรง ไม่ปะทะตรงๆ"),
    tiers: [
      T.learn(1, t("Current Palm", "ฝ่ามือกระแสน้ำ"), "flowing-palm", "Flowing Palm", "ฝ่ามือสายน้ำ"),
      T.learn(2, t("Still Water", "น้ำนิ่ง"), "still-water-guard", "Still Water Guard", "การ์ดน้ำนิ่ง"),
      T.momentum(),
      tier(4, t("River's Patience", "ความอดทนของสายน้ำ"), [fx.stat("saveAll", 1)], t("+1 to all saving throws.", "เซฟทั้งหมด +1"))
    ],
    interactions: { features: [{ feature: "flurry-of-blows", rule: t("Flowing Palm can replace one Flurry strike; once per turn still applies.", "ฝ่ามือสายน้ำแทนหนึ่งการโจมตีในเฟลอร์รีได้ ยังจำกัดเทิร์นละครั้ง") }], subclasses: compatAll },
    balance: { note: t("Push trades 2 damage; reaction costs Momentum.", "การผลักแลกความเสียหาย 2 รีแอคชันใช้โมเมนตัม"), reviewed: true }
  },
  {
    id: "tempest-fist", class: "monk", theme: "offense", learn: null,
    name: t("Tempest Fist", "หมัดพายุ"), description: t("Strikes that crack like thunder.", "หมัดที่ดังเหมือนฟ้าผ่า"),
    tiers: [
      T.learn(1, t("Rolling Strike", "หมัดม้วน"), "slipstream-cut", "Slipstream Cut", "ฟันกระแสลม"),
      T.learn(2, t("Storm Step", "ก้าวพายุ"), "gale-step", "Gale Step", "ก้าวลมกรรโชก"),
      tier(3, t("Thunderclap", "เสียงฟ้าลั่น"), [{ kind: "riderDie", dice: "1d4", damageType: "thunder", when: { usingTechnique: ["slipstream-cut", "flowing-palm"] } }], t("Slipstream Cut and Flowing Palm add 1d4 thunder.", "ฟันกระแสลมและฝ่ามือสายน้ำเพิ่ม 1d4 เสียงสะท้าน")),
      tier(4, t("Eye of the Tempest", "ตาพายุ"), [fx.modSlot()], t("+1 modifier slot.", "ช่องตัวปรับแต่ง +1"))
    ],
    interactions: { features: [{ feature: "martial-arts", rule: t("Martial Arts damage dice are native; the rider die is separate and capped.", "ลูกเต๋ามาร์เชียลอาร์ตเป็นของระบบหลัก ลูกเต๋าเสริมแยกและมีเพดาน") }], subclasses: compatAll },
    balance: { note: t("Rider only on technique hits, which already trade damage.", "ลูกเต๋าเสริมเฉพาะเทคนิคที่แลกความเสียหายแล้ว"), reviewed: true }
  },
  /* Paladin */
  {
    id: "banner-of-dawn", class: "paladin", theme: "leadership", learn: null,
    name: t("Banner of Dawn", "ธงรุ่งอรุณ"), description: t("Lead from the front line.", "นำจากแนวหน้า"),
    tiers: [
      T.learn(1, t("Raise the Banner", "ชูธง"), "banner-call", "Banner Call", "เสียงเรียกธงรบ"),
      T.learn(2, t("Charge at Dawn", "บุกยามรุ่ง"), "dawn-strike", "Dawn Strike", "ฟาดรุ่งอรุณ"),
      tier(3, t("Standard Bearer", "ผู้ถือธง"), [fx.slot()], t("+1 technique slot.", "ช่องเทคนิค +1")),
      tier(4, t("Unfading Dawn", "รุ่งอรุณไม่ร่วงโรย"), [fx.momentum()], t("+1 maximum Momentum.", "โมเมนตัมสูงสุด +1"))
    ],
    interactions: { features: [{ feature: "aura-of-protection", rule: t("Aura is native; Banner Call's +1 AC is separate and expires at your next turn.", "ออร่าเป็นของระบบหลัก ธงรบ AC +1 แยกและหมดที่เทิร์นถัดไป") }], subclasses: compatAll },
    balance: { note: t("Guard is +1 and shares the Forge AC limits.", "การ์ด +1 ใช้เพดาน AC ร่วม"), reviewed: true }
  },
  /* Ranger */
  {
    id: "quarry-warden", class: "ranger", theme: "offense", learn: null,
    name: t("Quarry Warden", "ผู้คุมเหยื่อ"), description: t("Mark, track, finish.", "หมาย ตาม แล้วจบ"),
    tiers: [
      T.learn(1, t("Marked Prey", "เหยื่อที่ถูกหมาย"), "quarry-shot", "Quarry Shot", "ยิงเหยื่อ"),
      T.learn(2, t("Hamstring", "ตัดเอ็น"), "crippling-shot", "Crippling Shot", "ยิงตัดขา"),
      T.momentum(),
      tier(4, t("Hunter's Kit", "ชุดนักล่า"), [fx.modSlot()], t("+1 modifier slot.", "ช่องตัวปรับแต่ง +1"))
    ],
    interactions: { features: [{ feature: "hunters-mark", rule: t("Hunter's Mark damage is native; Quarry Shot's rider is separate. Only one Forge rider die applies.", "ความเสียหายฮันเตอร์สมาร์กเป็นของระบบหลัก ลูกเต๋าเสริมฟอร์จได้หนึ่งลูก") }], subclasses: compatAll },
    balance: { note: t("Offense pays with −1 to hit and Momentum.", "การรุกแลกด้วยโจมตี −1 และโมเมนตัม"), reviewed: true }
  },
  {
    id: "thicket-stalker", class: "ranger", theme: "mobility", learn: null,
    name: t("Thicket Stalker", "นักย่องพุ่มไม้"), description: t("Never where the enemy looks.", "ไม่เคยอยู่ตรงที่ศัตรูมอง"),
    tiers: [
      T.learn(1, t("Slip Through", "ลอดผ่าน"), "gale-step", "Gale Step", "ก้าวลมกรรโชก"),
      T.learn(2, t("Briar Trap", "กับดักหนาม"), "thornlash", "Thornlash", "แส้หนาม"),
      tier(3, t("Long Stride", "ก้าวยาว"), [fx.stat("speed", 5)], t("+5 ft speed.", "ความเร็ว +5 ฟุต")),
      tier(4, t("Hidden Reserve", "สำรองซ่อน"), [fx.momentum()], t("+1 maximum Momentum.", "โมเมนตัมสูงสุด +1"))
    ],
    interactions: { features: [{ feature: "roving", rule: t("Speed bonuses share the +10 ft Forge cap.", "โบนัสความเร็วใช้เพดานร่วม +10 ฟุต") }], subclasses: compatAll },
    balance: { note: t("Mobility only.", "เน้นการเคลื่อนที่"), reviewed: true }
  },
  /* Sorcerer */
  {
    id: "wellspring-heart", class: "sorcerer", theme: "resource", learn: { spellcaster: true },
    name: t("Wellspring Heart", "หัวใจตาน้ำ"), description: t("Magic that refuels the body.", "เวทที่เติมพลังให้ร่างกาย"),
    tiers: [
      T.learn(1, t("Overflow", "ล้นทะลัก"), "sorcerous-surge", "Sorcerous Surge", "พลังเวทพลุ่งพล่าน"),
      tier(2, t("Living Current", "กระแสมีชีวิต"), [{ kind: "resourceGain", on: "spellCast", value: 1, oncePer: "round" }], t("Gain 1 Momentum the first time you cast a leveled spell each round.", "ได้โมเมนตัม 1 เมื่อร่ายเวทระดับ 1+ ครั้งแรกในแต่ละรอบ")),
      T.momentum(),
      tier(4, t("Bottomless", "ไร้ก้น"), [fx.stat("concentration", 2)], t("+2 to Concentration saves.", "เซฟสมาธิ +2"))
    ],
    interactions: { features: [{ feature: "font-of-magic", rule: t("Momentum never converts into Sorcery Points or spell slots.", "โมเมนตัมแลกเป็นซอร์เซอรีพอยต์หรือช่องเวทไม่ได้") }], subclasses: compatAll },
    balance: { note: t("Momentum gain shares the 2-per-round global cap.", "การได้โมเมนตัมใช้เพดานรวม 2 ต่อรอบ"), reviewed: true }
  },
  {
    id: "stormsoul-conduit", class: "sorcerer", theme: "offense", learn: { spellcaster: true },
    name: t("Stormsoul Conduit", "ท่อวิญญาณพายุ"), description: t("Lightning answers your blood.", "สายฟ้าตอบรับสายเลือดของคุณ"),
    tiers: [
      tier(1, t("Static Blood", "เลือดสถิต"), [fx.stat("initiative", 2)], t("+2 initiative.", "อินิเชียทีฟ +2")),
      tier(2, t("Arc", "ประกายไฟฟ้า"), [{ kind: "riderDie", dice: "1d4", damageType: "lightning", when: { spell: true, spellDamageType: ["lightning", "thunder"], spellLevel: { min: 1 } } }], t("Leveled lightning or thunder spells add 1d4 lightning.", "เวทสายฟ้าหรือเสียงสะท้านระดับ 1+ เพิ่ม 1d4 สายฟ้า")),
      T.momentum(),
      tier(4, t("Storm Crown", "มงกุฎพายุ"), [fx.stat("spellDC", 1)], t("+1 spell save DC (shared cap).", "DC เวท +1 (เพดานร่วม)"))
    ],
    interactions: { features: [{ feature: "metamagic", rule: t("Metamagic is native; Tempest Shift counts as Metamagic for Transmuted Spell.", "เมตาเมจิกเป็นของระบบหลัก สลับพายุนับเป็นเมตาเมจิกเมื่อเทียบกับทรานส์มิวเทดสเปลล์") }], subclasses: compatAll },
    balance: { note: t("Spell DC shares the +1 global cap.", "DC เวทใช้เพดานรวม +1"), reviewed: true }
  },
  /* Warlock */
  {
    id: "pact-sentinel", class: "warlock", theme: "reactive", learn: { spellcaster: true },
    name: t("Pact Sentinel", "ผู้เฝ้าพันธสัญญา"), description: t("Your patron punishes those who touch you.", "ผู้อุปถัมภ์ลงโทษผู้ที่แตะต้องคุณ"),
    tiers: [
      T.learn(1, t("Recoil", "แรงสะท้อน"), "eldritch-recoil", "Eldritch Recoil", "แรงสะท้อนพิสดาร"),
      T.learn(2, t("Hex Sight", "ตาสาป"), "hexing-mark", "Hexing Mark", "ตราสาป"),
      T.momentum(),
      tier(4, t("Pact Armor", "เกราะพันธสัญญา"), [fx.stat("ac", 1)], t("+1 AC (shared cap).", "AC +1 (เพดานร่วม)"))
    ],
    interactions: { features: [{ feature: "pact-magic", rule: t("Pact slots are never restored by Forge.", "ฟอร์จไม่คืนช่องเวทพันธสัญญา") }], subclasses: compatAll },
    balance: { note: t("Reaction push costs Momentum; AC shares the +2 cap.", "รีแอคชันผลักใช้โมเมนตัม AC ใช้เพดาน +2"), reviewed: true }
  },
  {
    id: "veil-binder", class: "warlock", theme: "control", learn: { spellcaster: true },
    name: t("Veil Binder", "ผู้ผูกม่าน"), description: t("Bind attention to yourself.", "ผูกความสนใจไว้ที่ตัวคุณ"),
    tiers: [
      T.learn(1, t("Binding Sigil", "สัญลักษณ์ผูกมัด"), "hexing-mark", "Hexing Mark", "ตราสาป"),
      tier(2, t("Veiled Mind", "จิตใต้ม่าน"), [fx.stat("concentration", 1)], t("+1 to Concentration saves.", "เซฟสมาธิ +1")),
      tier(3, t("Many Threads", "หลายเส้นด้าย"), [fx.slot()], t("+1 technique slot.", "ช่องเทคนิค +1")),
      tier(4, t("Woven Veil", "ม่านถักทอ"), [fx.modSlot()], t("+1 modifier slot.", "ช่องตัวปรับแต่ง +1"))
    ],
    interactions: { features: [{ feature: "eldritch-invocations", rule: t("Invocations are native and unaffected.", "อินโวเคชันเป็นของระบบหลักไม่ถูกเปลี่ยน") }], subclasses: compatAll },
    balance: { note: t("Control only; no damage.", "ควบคุมเท่านั้น ไม่มีความเสียหาย"), reviewed: true }
  },
  /* Wizard: third path */
  {
    id: "spell-archivist", class: "wizard", theme: "resource", learn: { spellcaster: true },
    name: t("Spell Archivist", "บรรณารักษ์เวท"), description: t("More options, carefully catalogued.", "ทางเลือกมากขึ้น จัดหมวดอย่างดี"),
    tiers: [
      tier(1, t("Indexed Mind", "จิตจัดดัชนี"), [fx.slot()], t("+1 technique slot.", "ช่องเทคนิค +1")),
      T.learn(2, t("Margin Notes", "บันทึกริมหน้า"), "hexing-mark", "Hexing Mark", "ตราสาป"),
      T.momentum(),
      tier(4, t("Cross-reference", "อ้างอิงข้าม"), [fx.modSlot()], t("+1 modifier slot.", "ช่องตัวปรับแต่ง +1"))
    ],
    interactions: { features: [{ feature: "spellbook", rule: t("Never adds spells to your spellbook or prepared list.", "ไม่เพิ่มเวทในตำราหรือรายการเตรียม") }], subclasses: compatAll },
    balance: { note: t("Breadth, not power: slots only.", "เพิ่มความกว้าง ไม่เพิ่มพลัง"), reviewed: true }
  }
];

/* ======================================================================== */
/*  Constellation nodes                                                     */
/* ======================================================================== */

const node = (def) => ({ prerequisites: null, eligibility: null, compatibility: null, conflicts: [], links: [], rules: {}, ...def });

export const NODES_EXP = [
  /* Iron */
  node({
    id: "counterweight-drills", category: "mechanic", cost: 1, respec: "free",
    name: t("Counterweight Drills", "ฝึกถ่วงน้ำหนัก"),
    description: t("Learn Earthshaker Stomp. Gain 1 Momentum the first time an attack misses you each round.", "เรียนรู้กระทืบแผ่นดินไหว ได้โมเมนตัม 1 เมื่อการโจมตีพลาดคุณครั้งแรกในแต่ละรอบ"),
    position: { x: 60, y: 470 }, links: ["iron-gate"],
    effects: [fx.grant("earthshaker-stomp"), { kind: "resourceGain", on: "missedBy", value: 1, oncePer: "round" }]
  }),
  node({
    id: "siege-temper", category: "specialization", cost: 2, respec: "rest",
    name: t("Siege Temper", "อารมณ์ทลายป้อม"),
    description: t("+1 damage with heavy weapons.", "ความเสียหาย +1 ด้วยอาวุธหนัก"),
    position: { x: 160, y: 560 }, links: ["counterweight-drills"],
    eligibility: { weaponProficiency: ["mar"] },
    effects: [{ kind: "damageBonus", value: 1, when: { weaponProperty: "hvy" } }],
    rules: { exclusiveGroup: "weapon-specialization" }
  }),
  node({
    id: "juggernaut", category: "keystone", cost: 2, respec: "rest",
    name: t("Juggernaut", "ผู้บดขยี้"),
    description: t("+1 maximum Momentum and +2 initiative. Ranged weapon attack rolls take −2.", "โมเมนตัมสูงสุด +1 และอินิเชียทีฟ +2 แต่การโจมตีด้วยอาวุธระยะไกล −2"),
    position: { x: 60, y: 650 }, links: ["siege-temper"], conflicts: ["eagle-eye"],
    prerequisites: { node: ["counterweight-drills"] },
    effects: [fx.momentum(), fx.stat("initiative", 2), { kind: "attackPenalty", value: 2, when: { weaponRange: "ranged" } }],
    rules: { minLevel: 5 }
  }),
  /* Tide */
  node({
    id: "windrunner-lore", category: "mechanic", cost: 1, respec: "free",
    name: t("Windrunner Lore", "ศาสตร์นักวิ่งลม"),
    description: t("Learn Gale Step. Gain 1 Momentum on a critical hit (once per round).", "เรียนรู้ก้าวลมกรรโชก ได้โมเมนตัม 1 เมื่อโจมตีคริติคอล (รอบละครั้ง)"),
    position: { x: 630, y: 50 }, links: ["tide-root"],
    effects: [fx.grant("gale-step"), { kind: "resourceGain", on: "crit", value: 1, oncePer: "round" }]
  }),
  node({
    id: "marksman-focus", category: "specialization", cost: 2, respec: "rest",
    name: t("Marksman Focus", "สมาธินักแม่นปืน"),
    description: t("+1 to attack rolls with ranged weapons.", "การโจมตีด้วยอาวุธระยะไกล +1"),
    position: { x: 750, y: 70 }, links: ["windrunner-lore"],
    effects: [{ kind: "attackBonus", value: 1, when: { weaponRange: "ranged" } }],
    rules: { exclusiveGroup: "weapon-specialization" }
  }),
  node({
    id: "eagle-eye", category: "keystone", cost: 2, respec: "rest",
    name: t("Eagle Eye", "ตาเหยี่ยว"),
    description: t("Ranged weapon hits add a 1d4 rider die. Melee weapon attack rolls take −2.", "การโจมตีระยะไกลที่โดนเพิ่มลูกเต๋าเสริม 1d4 แต่การโจมตีประชิด −2"),
    position: { x: 760, y: 0 }, links: ["marksman-focus"], conflicts: ["juggernaut"],
    effects: [{ kind: "riderDie", dice: "1d4", when: { weaponRange: "ranged" } }, { kind: "attackPenalty", value: 2, when: { weaponRange: "melee" } }],
    rules: { minLevel: 5 }
  }),
  /* Lantern */
  node({
    id: "ley-tap", category: "mechanic", cost: 1, respec: "free",
    name: t("Ley Tap", "เจาะสายพลัง"),
    description: t("Learn Hexing Mark.", "เรียนรู้ตราสาป"),
    position: { x: 1050, y: 320 }, links: ["lantern-root"],
    eligibility: { spellcaster: true },
    effects: [fx.grant("hexing-mark")]
  }),
  node({
    id: "elemental-attunement", category: "specialization", cost: 2, respec: "rest",
    name: t("Elemental Attunement", "การปรับคลื่นธาตุ"),
    description: t("Leveled acid, cold, fire, lightning or thunder spells add a 1d4 rider die.", "เวทระดับ 1+ ธาตุกรด น้ำแข็ง ไฟ สายฟ้า หรือเสียงสะท้าน เพิ่มลูกเต๋าเสริม 1d4"),
    position: { x: 1050, y: 450 }, links: ["ley-tap"],
    eligibility: { spellcaster: true },
    effects: [{ kind: "riderDie", dice: "1d4", when: { spell: true, spellDamageType: ELEMENTS, spellLevel: { min: 1 } } }],
    rules: { exclusiveGroup: "spell-specialization" }
  }),
  node({
    id: "warding-lattice", category: "mechanic", cost: 1, respec: "free",
    name: t("Warding Lattice", "โครงข่ายผนึก"),
    description: t("Learn Eldritch Recoil. Gain 1 Momentum when you start Concentrating (once per round).", "เรียนรู้แรงสะท้อนพิสดาร ได้โมเมนตัม 1 เมื่อเริ่มรักษาสมาธิ (รอบละครั้ง)"),
    position: { x: 930, y: 500 }, links: ["lantern-root"],
    eligibility: { spellcaster: true },
    effects: [fx.grant("eldritch-recoil"), { kind: "resourceGain", on: "concentrationStart", value: 1, oncePer: "round" }]
  }),
  /* Anchor */
  node({
    id: "chorus-lore", category: "mechanic", cost: 1, respec: "free",
    name: t("Chorus Lore", "ศาสตร์คอรัส"),
    description: t("Learn Inspiring Refrain.", "เรียนรู้ท่อนร้องปลุกใจ"),
    position: { x: 650, y: 650 }, links: ["anchor-root"],
    effects: [fx.grant("inspiring-refrain")]
  }),
  node({
    id: "field-medic", category: "specialization", cost: 2, respec: "rest",
    name: t("Field Marshal", "จอมพลสนาม"),
    description: t("Learn Banner Call. +1 maximum Momentum.", "เรียนรู้เสียงเรียกธงรบ โมเมนตัมสูงสุด +1"),
    position: { x: 790, y: 610 }, links: ["chorus-lore"],
    effects: [fx.grant("banner-call"), fx.momentum()],
    rules: { exclusiveGroup: "support-specialization" }
  }),
  node({
    id: "martyrs-vow", category: "keystone", cost: 2, respec: "rest",
    name: t("Martyr's Vow", "ปณิธานผู้เสียสละ"),
    description: t("+1 to all saving throws and +1 technique slot. Your weapon damage rolls take −2.", "เซฟทั้งหมด +1 และช่องเทคนิค +1 แต่ความเสียหายอาวุธ −2"),
    position: { x: 800, y: 700 }, links: ["field-medic"], conflicts: ["reckless-apex"],
    effects: [fx.stat("saveAll", 1), fx.slot(), { kind: "damagePenalty", value: 2, when: { weapon: true } }],
    rules: { minLevel: 5 }
  })
];

/* ======================================================================== */
/*  Synergies                                                               */
/* ======================================================================== */

export const SYNERGIES_EXP = [
  {
    id: "volley-and-step", priority: 55, oncePer: "turn",
    name: t("Volley and Step", "ยิงแล้วถอย"),
    description: t("A Crippling Shot hit may let you move 5 ft without provoking instead of slowing the target.", "ยิงตัดขาที่โดนเลือกเคลื่อนที่ 5 ฟุตโดยไม่ถูกโจมตีฉวยโอกาสแทนการทำให้ช้าได้"),
    tactic: t("Slow the chaser or open distance yourself.", "ถ่วงผู้ไล่ล่า หรือเปิดระยะเอง"),
    requires: { weaponPaths: ["marksman"], techniques: ["crippling-shot"] },
    cost: {},
    effects: [{ kind: "secondary", type: "shift", feet: 5, target: "self", when: { usingTechnique: "crippling-shot" } }]
  },
  {
    id: "hex-and-blade", priority: 45, oncePer: "turn",
    name: t("Hex and Blade", "คำสาปและคมดาบ"),
    description: t("While concentrating, a weapon hit can add 1d4 necrotic for 1 Momentum.", "ขณะรักษาสมาธิ การโจมตีด้วยอาวุธเพิ่ม 1d4 พลังมืดได้โดยใช้โมเมนตัม 1"),
    tactic: t("Spend Momentum on damage now or save it for Recoil.", "ใช้โมเมนตัมเพิ่มความเสียหายตอนนี้ หรือเก็บไว้ใช้แรงสะท้อน"),
    requires: { techniques: ["hexing-mark"], nodes: ["spellblade-confluence"] },
    cost: { momentum: 1 },
    effects: [{ kind: "riderDie", dice: "1d4", damageType: "necrotic", when: { weapon: true, concentrating: true } }]
  },
  {
    id: "stormcaller-cadence", priority: 50, oncePer: "turn",
    name: t("Stormcaller Cadence", "จังหวะผู้เรียกพายุ"),
    description: t("A spell under Tempest Shift may widen its area by 5 ft for 1 more Momentum.", "เวทที่ใช้สลับพายุขยายพื้นที่ 5 ฟุตได้โดยใช้โมเมนตัมเพิ่ม 1"),
    tactic: t("Catch one more foe or keep Momentum.", "ครอบคลุมศัตรูเพิ่ม หรือเก็บโมเมนตัม"),
    requires: { evolutions: [{ class: "sorcerer", path: "stormsoul-conduit", tier: 2 }], weaves: ["tempest-shift"] },
    cost: { momentum: 1 },
    effects: [{ kind: "areaDelta", feet: 5, when: { usingWeave: "tempest-shift" } }]
  },
  {
    id: "unbroken-chorus", priority: 45, oncePer: "round",
    name: t("Unbroken Chorus", "คอรัสไม่ขาดสาย"),
    description: t("Inspiring Refrain reaches one additional ally for 1 more Momentum.", "ท่อนร้องปลุกใจส่งถึงพันธมิตรเพิ่มอีกหนึ่งคนโดยใช้โมเมนตัมเพิ่ม 1"),
    tactic: t("Set up two allies at once, or keep Momentum for Cutting Verse.", "เตรียมพันธมิตรสองคนพร้อมกัน หรือเก็บโมเมนตัมไว้ใช้บทกลอน"),
    requires: { techniques: ["inspiring-refrain"], nodes: ["chorus-lore"] },
    cost: { momentum: 1 },
    effects: [{ kind: "targetDelta", value: 1, when: { usingTechnique: "inspiring-refrain" } }]
  },
  {
    id: "earth-and-iron", priority: 60, oncePer: "turn",
    name: t("Earth and Iron", "ดินและเหล็ก"),
    description: t("Earthshaker Stomp may push the target 10 ft instead of knocking it Prone.", "กระทืบแผ่นดินไหวเลือกผลักเป้าหมาย 10 ฟุตแทนทำให้ล้มได้"),
    tactic: t("Drop them for your allies, or shove them into the hazard.", "ทำให้ล้มเพื่อพันธมิตร หรือผลักเข้าอันตราย"),
    requires: { techniques: ["earthshaker-stomp"], nodes: ["siege-temper"] },
    cost: {},
    effects: [{ kind: "secondary", type: "push", feet: 10, target: "target", when: { usingTechnique: "earthshaker-stomp" } }]
  },
  {
    id: "dawn-vigil", priority: 50, oncePer: "round",
    name: t("Dawn Vigil", "เฝ้ายามรุ่งอรุณ"),
    description: t("Banner Call may grant temporary HP equal to half your proficiency bonus instead of +1 AC.", "เสียงเรียกธงรบเลือกให้ HP ชั่วคราวเท่าครึ่งหนึ่งของโบนัสความชำนาญแทน AC +1 ได้"),
    tactic: t("Prevent the next hit, or cushion the one you can't stop.", "ป้องกันการโจมตีครั้งถัดไป หรือรองรับการโจมตีที่หยุดไม่ได้"),
    requires: { evolutions: [{ class: "paladin", path: "banner-of-dawn", tier: 1 }], techniques: ["banner-call"] },
    cost: {},
    effects: [{ kind: "secondary", type: "tempHp", value: "halfpb", target: "ally", when: { usingTechnique: "banner-call" } }]
  }
];
