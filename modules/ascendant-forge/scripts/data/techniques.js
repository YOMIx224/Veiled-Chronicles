/**
 * Ability Techniques and Technique Modifiers — default content.
 *
 * Every technique declares how it is delivered (native weapon attack, spell, self, ally),
 * the action it consumes, its use-time requirements and its cost. Techniques that add
 * control/defence/mobility/support pay for it with damage, accuracy, Momentum or uses.
 */
const t = (en, th) => ({ en, th });

export const TECHNIQUES = [
  {
    id: "measured-thrust", kind: "action", action: "attackReplace", delivery: "weaponAttack", theme: "offense",
    name: t("Measured Thrust", "แทงอย่างแม่นยำ"),
    description: t("Replace one attack: +2 to hit, but add no ability modifier to the damage.",
      "แทนการโจมตีหนึ่งครั้ง: โจมตี +2 แต่ความเสียหายไม่บวกค่าความสามารถ"),
    tags: ["weapon", "melee", "precision"],
    learn: { weaponProficiency: ["mar", "sim"] },
    requires: { weapon: true, weaponProperty: ["fin", "lgt"] },
    cost: {}, limits: { oncePer: "turn" },
    effects: [{ kind: "attackBonus", value: 2 }, { kind: "damagePenalty", value: "ability" }],
    masteryInteraction: t("Mastery applies normally; Graze uses the reduced damage.", "มาสเตอรีทำงานตามปกติ เกรซใช้ความเสียหายที่ลดแล้ว")
  },
  {
    id: "pinning-volley", kind: "action", action: "attackReplace", delivery: "weaponAttack", theme: "control",
    name: t("Pinning Volley", "ระดมยิงตรึง"),
    description: t("Replace one ranged attack: −2 damage; on a hit the target's speed drops by 10 ft until the start of your next turn.",
      "แทนการโจมตีระยะไกลหนึ่งครั้ง: ความเสียหาย −2 หากโดน ความเร็วเป้าหมายลด 10 ฟุตจนถึงต้นเทิร์นถัดไปของคุณ"),
    tags: ["weapon", "ranged", "control"],
    learn: { weaponProficiency: ["mar", "sim"] },
    requires: { weapon: true, weaponRange: "ranged" },
    cost: {}, limits: { oncePer: "turn" },
    effects: [{ kind: "damagePenalty", value: 2 }, { kind: "secondary", type: "slow", feet: 10, target: "target" }],
    masteryInteraction: t("Does not stack with Slow mastery; the target loses the larger amount only.",
      "ไม่ซ้อนกับมาสเตอรีสโลว์ เป้าหมายเสียความเร็วตามค่าที่มากกว่าเท่านั้น")
  },
  {
    id: "sundering-blow", kind: "action", action: "attackReplace", delivery: "weaponAttack", theme: "control",
    grantOnly: true,
    name: t("Sundering Blow", "ฟาดทลาย"),
    description: t("Replace one heavy-weapon attack: no ability modifier to damage; on a hit the target makes a Strength save or falls Prone.",
      "แทนการโจมตีด้วยอาวุธหนักหนึ่งครั้ง: ความเสียหายไม่บวกค่าความสามารถ หากโดน เป้าหมายเซฟ STR มิฉะนั้นล้มลง"),
    tags: ["weapon", "melee", "heavy", "control"],
    requires: { weapon: true, weaponProperty: "hvy" },
    cost: {}, limits: { oncePer: "turn" },
    effects: [{ kind: "damagePenalty", value: "ability" }, { kind: "secondary", type: "condition", condition: "prone", save: "str", target: "target" }],
    masteryInteraction: t("With Topple mastery the target makes a single save against the higher DC, not two.",
      "หากใช้มาสเตอรีท็อปเปิล เป้าหมายเซฟครั้งเดียวโดยใช้ DC ที่สูงกว่า")
  },
  {
    id: "slipstream-cut", kind: "action", action: "attackReplace", delivery: "weaponAttack", theme: "mobility",
    grantOnly: true,
    name: t("Slipstream Cut", "ฟันกระแสลม"),
    description: t("Replace one light or finesse attack: −2 damage; on a hit move 5 ft without provoking Opportunity Attacks.",
      "แทนการโจมตีอาวุธเบาหรือฟิเนสส์: ความเสียหาย −2 หากโดน เคลื่อนที่ 5 ฟุตโดยไม่ถูกโจมตีฉวยโอกาส"),
    tags: ["weapon", "melee", "mobility"],
    requires: { weapon: true, weaponProperty: ["fin", "lgt"] },
    cost: {}, limits: { oncePer: "turn" },
    effects: [{ kind: "damagePenalty", value: 2 }, { kind: "secondary", type: "shift", feet: 5, target: "self" }],
    masteryInteraction: t("Resolve Vex or Nick first, then the shift.", "ใช้เว็กซ์หรือนิกก่อน แล้วจึงเคลื่อนที่")
  },
  {
    id: "spellstrike-feint", kind: "action", action: "attackReplace", delivery: "weaponAttack", theme: "offense",
    grantOnly: true,
    name: t("Spellstrike Feint", "หลอกล่อเวทฟัน"),
    description: t("Replace one melee attack: −1 to hit; on a hit add 1d6 force.", "แทนการโจมตีระยะประชิด: โจมตี −1 หากโดนเพิ่ม 1d6 พลังงาน"),
    tags: ["weapon", "melee", "arcane"],
    requires: { weapon: true, weaponRange: "melee" },
    cost: { momentum: 1 },
    effects: [{ kind: "attackPenalty", value: 1 }, { kind: "riderDie", dice: "1d6", damageType: "force" }]
  },
  {
    id: "riposte-line", kind: "reaction", action: "reaction", delivery: "weaponAttack", theme: "reactive", trigger: "missedBy",
    grantOnly: true,
    name: t("Riposte Line", "แนวสวนกลับ"),
    description: t("Reaction when a melee attack misses you: make one melee weapon attack against the attacker.",
      "รีแอคชันเมื่อการโจมตีประชิดพลาดคุณ: โจมตีด้วยอาวุธประชิดหนึ่งครั้งใส่ผู้โจมตี"),
    tags: ["weapon", "melee", "reaction", "counter"],
    requires: { weapon: true, weaponRange: "melee" },
    cost: { momentum: 2 },
    effects: [],
    masteryInteraction: t("Mastery applies to the riposte as a normal attack.", "มาสเตอรีทำงานกับการสวนกลับตามปกติ")
  },
  {
    id: "bulwark-step", kind: "reaction", action: "reaction", delivery: "self", theme: "defense", trigger: "damaged",
    grantOnly: true,
    name: t("Bulwark Step", "ก้าวปราการ"),
    description: t("Reaction when an attack hits you: +2 AC until the start of your next turn, including against the triggering attack.",
      "รีแอคชันเมื่อถูกโจมตีโดน: AC +2 จนถึงต้นเทิร์นถัดไป รวมถึงการโจมตีที่กระตุ้น"),
    tags: ["reaction", "defense", "self"],
    requires: null,
    cost: { momentum: 1 },
    effects: [{ kind: "secondary", type: "guard", value: 2, target: "self" }]
  },
  {
    id: "interpose", kind: "reaction", action: "reaction", delivery: "ally", theme: "defense", trigger: "allyHit",
    grantOnly: true,
    name: t("Interpose", "ขวางรับ"),
    description: t("Reaction when an ally within 5 ft is hit: that ally gains +2 AC against the attack, possibly turning it into a miss.",
      "รีแอคชันเมื่อพันธมิตรในระยะ 5 ฟุตถูกโจมตีโดน: พันธมิตรได้ AC +2 ต่อการโจมตีนั้น"),
    tags: ["reaction", "defense", "ally"],
    requires: { shield: true },
    cost: { momentum: 1 },
    effects: [{ kind: "secondary", type: "guard", value: 2, target: "ally" }]
  },
  {
    id: "rallying-command", kind: "action", action: "bonus", delivery: "ally", theme: "leadership",
    grantOnly: true,
    name: t("Rallying Command", "คำสั่งรวมพล"),
    description: t("Bonus Action: one ally you can see gains temporary hit points equal to your proficiency bonus.",
      "โบนัสแอคชัน: พันธมิตรหนึ่งคนที่มองเห็นได้รับ HP ชั่วคราวเท่ากับโบนัสความชำนาญ"),
    tags: ["command", "support", "ally"],
    requires: null,
    cost: { momentum: 2 },
    effects: [{ kind: "secondary", type: "tempHp", value: "pb", target: "ally" }]
  },
  {
    id: "warding-glyph", kind: "action", action: "bonus", delivery: "ally", theme: "support",
    grantOnly: true,
    name: t("Warding Glyph", "ผนึกพิทักษ์"),
    description: t("Bonus Action while concentrating on a spell: one ally gains temporary hit points equal to half your proficiency bonus.",
      "โบนัสแอคชันขณะรักษาสมาธิเวท: พันธมิตรหนึ่งคนได้ HP ชั่วคราวเท่าครึ่งหนึ่งของโบนัสความชำนาญ"),
    tags: ["spell", "support", "ally"],
    requires: { concentrating: true },
    cost: { uses: { max: 2, per: "lr" } },
    effects: [{ kind: "secondary", type: "tempHp", value: "halfpb", target: "ally" }]
  },
  {
    id: "lockdown-strike", kind: "action", action: "attackReplace", delivery: "weaponAttack", theme: "control",
    grantOnly: true,
    name: t("Lockdown Strike", "ฟาดตรึงพื้นที่"),
    description: t("Replace one melee attack: −2 damage; on a hit the target is Marked until the start of your next turn (it has disadvantage on attacks against creatures other than you).",
      "แทนการโจมตีประชิด: ความเสียหาย −2 หากโดน เป้าหมายถูกหมายหัวจนถึงต้นเทิร์นถัดไป (เสียเปรียบเมื่อโจมตีผู้อื่นนอกจากคุณ)"),
    tags: ["weapon", "melee", "control"],
    requires: { weapon: true, weaponRange: "melee" },
    cost: {}, limits: { oncePer: "turn" },
    effects: [{ kind: "damagePenalty", value: 2 }, { kind: "secondary", type: "mark", target: "target" }]
  },
  {
    id: "breathing-bastion", kind: "modifyFeature", action: "free", delivery: "self", theme: "defense",
    grantOnly: true,
    modifiesFeature: { feature: "second-wind" },
    name: t("Breathing Bastion", "ป้อมปราการหายใจ"),
    description: t("Modifies Second Wind: when you use it, also gain +1 AC until the start of your next turn.",
      "ปรับแต่งเซคันด์วินด์: เมื่อใช้ ได้รับ AC +1 จนถึงต้นเทิร์นถัดไปด้วย"),
    tags: ["feature", "defense", "self"],
    requires: null,
    cost: { momentum: 1 },
    effects: [{ kind: "secondary", type: "guard", value: 1, target: "self" }]
  }
];

export const MODIFIERS = [
  {
    id: "extended-reach", slotCost: 1, exclusiveGroup: "shape-range",
    name: t("Extended Reach", "ระยะยืดขยาย"),
    description: t("+5 ft reach or range for this technique. Costs 1 more Momentum.", "ระยะเอื้อมหรือระยะยิง +5 ฟุต ใช้โมเมนตัมเพิ่ม 1"),
    compat: { anyTags: ["weapon"], deliveries: ["weaponAttack"] },
    cost: { momentum: 1 },
    effects: [{ kind: "rangeDelta", feet: 5 }],
    interaction: t("Applies once per use; does not stack with other range changes (the largest applies).", "ใช้ครั้งเดียวต่อการใช้ ไม่ซ้อนกับการเพิ่มระยะอื่น")
  },
  {
    id: "twin-mark", slotCost: 2, exclusiveGroup: "shape-target",
    name: t("Twin Mark", "หมายคู่"),
    description: t("This ally technique affects one additional ally. Costs 1 more Momentum.", "เทคนิคสนับสนุนนี้มีผลกับพันธมิตรเพิ่มอีกหนึ่งคน ใช้โมเมนตัมเพิ่ม 1"),
    compat: { anyTags: ["ally"], excludeTags: ["reaction"] },
    cost: { momentum: 1 }, limits: { maxPerLoadout: 1 },
    effects: [{ kind: "targetDelta", value: 1 }],
    interaction: t("Never applies to damage. Only one target increase applies per use.", "ไม่ใช้กับความเสียหาย เพิ่มเป้าหมายได้ครั้งเดียวต่อการใช้")
  },
  {
    id: "counterweight", slotCost: 1, exclusiveGroup: "accuracy",
    name: t("Counterweight", "ถ่วงน้ำหนัก"),
    description: t("+1 to hit with this technique. Costs 1 more Momentum.", "โจมตี +1 ด้วยเทคนิคนี้ ใช้โมเมนตัมเพิ่ม 1"),
    compat: { anyTags: ["weapon"] },
    cost: {},
    effects: [{ kind: "attackBonus", value: 1 }, { kind: "costDelta", value: 1 }],
    interaction: t("Counts toward the +2 Forge accuracy cap.", "นับรวมในเพดานความแม่นยำ +2")
  },
  {
    id: "lean-form", slotCost: 1, exclusiveGroup: "efficiency",
    name: t("Lean Form", "รูปแบบประหยัด"),
    description: t("This technique costs 1 less Momentum (minimum 1) but deals 2 less damage.", "เทคนิคนี้ใช้โมเมนตัมน้อยลง 1 (ขั้นต่ำ 1) แต่ความเสียหาย −2"),
    compat: { anyTags: ["weapon", "spell", "ally", "self"] },
    cost: {},
    effects: [{ kind: "costDelta", value: -1 }, { kind: "damagePenalty", value: 2 }],
    interaction: t("A technique that costs Momentum can never be reduced below 1.", "เทคนิคที่ใช้โมเมนตัมจะไม่ลดต่ำกว่า 1")
  },
  {
    id: "hair-trigger", slotCost: 1, exclusiveGroup: "trigger",
    name: t("Hair Trigger", "ไกปืนไว"),
    description: t("This reaction triggers when an ally within 5 ft is hit instead of its usual trigger. Costs 1 more Momentum.",
      "รีแอคชันนี้ทำงานเมื่อพันธมิตรในระยะ 5 ฟุตถูกโจมตีโดนแทนเงื่อนไขปกติ ใช้โมเมนตัมเพิ่ม 1"),
    compat: { anyTags: ["reaction"], kinds: ["reaction"] },
    cost: { momentum: 1 },
    effects: [{ kind: "triggerOverride", to: "allyHit" }],
    interaction: t("Replaces the trigger; a reaction never has two triggers.", "แทนที่เงื่อนไข รีแอคชันไม่มีสองเงื่อนไข")
  },
  {
    id: "searing-edge", slotCost: 1, exclusiveGroup: "element",
    name: t("Searing Edge", "คมแผดเผา"),
    description: t("Bludgeoning, piercing or slashing damage from this technique becomes fire.", "ความเสียหายทุบ แทง หรือฟันจากเทคนิคนี้กลายเป็นไฟ"),
    compat: { anyTags: ["weapon"] },
    cost: { uses: { max: 3, per: "sr" } },
    effects: [{ kind: "damageTypeSwap", from: ["bludgeoning", "piercing", "slashing"], to: "fire" }],
    interaction: t("Changes type only, never amount. One type change applies per hit.", "เปลี่ยนชนิดเท่านั้น ไม่เปลี่ยนปริมาณ")
  },
  {
    id: "frost-edge", slotCost: 1, exclusiveGroup: "element",
    name: t("Frost Edge", "คมเยือกแข็ง"),
    description: t("Bludgeoning, piercing or slashing damage from this technique becomes cold.", "ความเสียหายทุบ แทง หรือฟันจากเทคนิคนี้กลายเป็นความเย็น"),
    compat: { anyTags: ["weapon"] },
    cost: { uses: { max: 3, per: "sr" } },
    effects: [{ kind: "damageTypeSwap", from: ["bludgeoning", "piercing", "slashing"], to: "cold" }],
    interaction: t("Changes type only, never amount. One type change applies per hit.", "เปลี่ยนชนิดเท่านั้น ไม่เปลี่ยนปริมาณ")
  },
  {
    id: "staggering-rider", slotCost: 1, exclusiveGroup: "control",
    name: t("Staggering Rider", "เสริมให้เซ"),
    description: t("−2 damage; on a hit reduce the target's speed by 10 ft until the start of your next turn.", "ความเสียหาย −2 หากโดนลดความเร็วเป้าหมาย 10 ฟุต"),
    compat: { anyTags: ["weapon"], excludeTags: ["control"] },
    cost: {},
    effects: [{ kind: "damagePenalty", value: 2 }, { kind: "secondary", type: "slow", feet: 10, target: "target" }],
    interaction: t("Competes with other secondary effects: only one Forge secondary applies per hit (you choose).", "แข่งกับผลรองอื่น ใช้ได้เพียงหนึ่งต่อการโจมตีโดน (คุณเลือก)")
  },
  {
    id: "echo-step", slotCost: 1, exclusiveGroup: "mobility",
    name: t("Echo Step", "ก้าวสะท้อน"),
    description: t("−1 damage; on a hit move 5 ft without provoking.", "ความเสียหาย −1 หากโดนเคลื่อนที่ 5 ฟุตโดยไม่ถูกโจมตีฉวยโอกาส"),
    compat: { anyTags: ["weapon"], excludeTags: ["mobility"] },
    cost: {},
    effects: [{ kind: "damagePenalty", value: 1 }, { kind: "secondary", type: "shift", feet: 5, target: "self" }],
    interaction: t("Competes with other secondary effects: only one applies per hit.", "แข่งกับผลรองอื่น ใช้ได้เพียงหนึ่งต่อการโจมตีโดน")
  },
  {
    id: "resonant-focus", slotCost: 1, exclusiveGroup: "resource",
    name: t("Resonant Focus", "สมาธิสั่นพ้อง"),
    description: t("When this technique hits, regain 1 Momentum (once per round). Only fits techniques that cost 2+ Momentum.",
      "เมื่อเทคนิคนี้โจมตีโดน ฟื้นโมเมนตัม 1 (รอบละครั้ง) ใช้ได้กับเทคนิคที่ใช้โมเมนตัม 2 ขึ้นไปเท่านั้น"),
    compat: { anyTags: ["weapon"], excludeTags: ["reaction"] },
    cost: { momentum: 1 }, limits: { maxPerLoadout: 1 },
    effects: [{ kind: "resourceGain", on: "hit", value: 1, oncePer: "round" }],
    interaction: t("Net Momentum is always negative: the build validator rejects loadouts where it would not be.", "โมเมนตัมสุทธิติดลบเสมอ ระบบจะปฏิเสธหากไม่เป็นเช่นนั้น")
  }
];
