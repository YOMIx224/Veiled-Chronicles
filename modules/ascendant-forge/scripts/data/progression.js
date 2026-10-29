/**
 * Class Evolution paths and Weapon Mastery Expansion paths — default content.
 *
 * Evolutions run alongside dnd5e class/subclass advancement. A character picks at most
 * one path per class. Tiers unlock automatically at class levels that sit between the
 * native subclass milestones (3/7/11/15 in 2024 rules) and never grant subclass features.
 *
 * Weapon paths augment native Weapon Mastery: they require the character to actually have
 * mastery of a weapon with the right mastery property, and never replace the native effect.
 */
const t = (en, th) => ({ en, th });
const TIERS = [3, 7, 11, 15];

const tier = (n, name, effects, description) => ({ tier: n, classLevel: TIERS[n - 1], name, description, effects });

export const EVOLUTIONS = [
  /* ------------------------------ Fighter ------------------------------ */
  {
    id: "vanguard-bulwark", class: "fighter", theme: "defense",
    name: t("Vanguard Bulwark", "แนวหน้าปราการ"),
    description: t("Hold the line: reactions, shields and endurance.", "ยึดแนว: รีแอคชัน โล่ และความอึด"),
    learn: null,
    tiers: [
      tier(1, t("Shieldbearer's Habit", "นิสัยผู้ถือโล่"), [{ kind: "grantTechnique", id: "interpose" }],
        t("Learn Interpose.", "เรียนรู้ขวางรับ")),
      tier(2, t("Second Breath", "ลมหายใจที่สอง"), [{ kind: "grantTechnique", id: "breathing-bastion" }],
        t("Learn Breathing Bastion (modifies Second Wind).", "เรียนรู้ป้อมปราการหายใจ (ปรับแต่งเซคันด์วินด์)")),
      tier(3, t("Unbroken Line", "แนวที่ไม่แตก"), [{ kind: "resourceMax", value: 1 }],
        t("+1 maximum Momentum.", "โมเมนตัมสูงสุด +1")),
      tier(4, t("Living Rampart", "กำแพงมีชีวิต"), [{ kind: "stat", key: "saveAll", value: 1 }],
        t("+1 to all saving throws.", "เซฟทั้งหมด +1"))
    ],
    interactions: {
      features: [
        { feature: "second-wind", rule: t("Breathing Bastion adds to Second Wind; healing is unchanged.", "ป้อมปราการหายใจเพิ่มผลให้เซคันด์วินด์ การฟื้นฟูไม่เปลี่ยน") },
        { feature: "action-surge", rule: t("Unchanged. Techniques used during the surge still respect once-per-turn limits.", "ไม่เปลี่ยน เทคนิคยังคงจำกัดเทิร์นละครั้ง") }
      ],
      subclasses: t("Works with every subclass; Battle Master maneuvers and Forge secondaries never apply to the same hit together—choose one.",
        "ใช้กับทุกซับคลาส มาเนิฟเวอร์ของแบทเทิลมาสเตอร์และผลรองของฟอร์จใช้ร่วมในการโจมตีเดียวกันไม่ได้ ต้องเลือกหนึ่ง")
    },
    balance: { note: t("Defensive reactions cost Momentum; no damage increase anywhere in the path.", "รีแอคชันป้องกันใช้โมเมนตัม ไม่มีการเพิ่มความเสียหาย"), reviewed: true }
  },
  {
    id: "war-tactician", class: "fighter", theme: "leadership",
    name: t("War Tactician", "นักยุทธวิธีสงคราม"),
    description: t("Direct the battle: commands and extra technique capacity.", "บัญชาการรบ: คำสั่งและความจุเทคนิคเพิ่ม"),
    learn: null,
    tiers: [
      tier(1, t("Field Orders", "คำสั่งภาคสนาม"), [{ kind: "grantTechnique", id: "rallying-command" }], t("Learn Rallying Command.", "เรียนรู้คำสั่งรวมพล")),
      tier(2, t("Drilled Formation", "รูปขบวนฝึกซ้อม"), [{ kind: "stat", key: "initiative", value: 2 }], t("+2 initiative.", "อินิเชียทีฟ +2")),
      tier(3, t("Command Depth", "ความลึกการบัญชา"), [{ kind: "techniqueSlot", value: 1 }], t("+1 technique slot.", "ช่องเทคนิค +1")),
      tier(4, t("Tactical Reserve", "กองหนุนยุทธวิธี"), [{ kind: "resourceMax", value: 1 }], t("+1 maximum Momentum.", "โมเมนตัมสูงสุด +1"))
    ],
    interactions: {
      features: [{ feature: "tactical-mind", rule: t("Unchanged; Field Orders uses a Bonus Action and Momentum, not Second Wind uses.", "ไม่เปลี่ยน คำสั่งภาคสนามใช้โบนัสแอคชันและโมเมนตัม") }],
      subclasses: t("Stacks with Banneret-style subclasses only through separate actions; temporary hit points never stack (take the higher).",
        "HP ชั่วคราวไม่ซ้อนกัน ใช้ค่าที่สูงกว่า")
    },
    balance: { note: t("Support output is temp HP (non-stacking) gated by a Bonus Action and 2 Momentum.", "การสนับสนุนเป็น HP ชั่วคราวที่ไม่ซ้อน จำกัดด้วยโบนัสแอคชันและโมเมนตัม 2"), reviewed: true }
  },
  {
    id: "storm-duelist", class: "fighter", theme: "offense",
    name: t("Storm Duelist", "นักดวลพายุ"),
    description: t("Precise one-handed offense that pays in defence.", "การรุกแม่นยำด้วยมือเดียวแลกกับการป้องกัน"),
    learn: null,
    tiers: [
      tier(1, t("Opening Read", "อ่านช่องว่าง"), [{ kind: "grantTechnique", id: "measured-thrust" }], t("Learn Measured Thrust.", "เรียนรู้แทงอย่างแม่นยำ")),
      tier(2, t("Gale Footwork", "ฝีเท้าลมกรรโชก"), [{ kind: "grantTechnique", id: "slipstream-cut" }], t("Learn Slipstream Cut.", "เรียนรู้ฟันกระแสลม")),
      tier(3, t("Thunder Point", "ปลายดาบอัสนี"), [{ kind: "riderDie", dice: "1d4", damageType: "thunder", when: { weaponProperty: "fin", shield: false } }],
        t("Finesse hits without a shield add 1d4 thunder (rider die).", "การโจมตีอาวุธฟิเนสส์ที่ไม่ถือโล่เพิ่ม 1d4 เสียงสะท้าน")),
      tier(4, t("Eye of the Storm", "ตาพายุ"), [{ kind: "modifierSlot", value: 1 }], t("+1 modifier slot.", "ช่องตัวปรับแต่ง +1"))
    ],
    interactions: {
      features: [{ feature: "extra-attack", rule: t("Rider die applies per hit but only one rider die per hit from all Forge sources.", "ลูกเต๋าเสริมหนึ่งลูกต่อการโจมตีโดนจากทุกแหล่ง") }],
      subclasses: t("A Champion's expanded critical range doubles the rider die only through the native critical rule.", "คริติคอลขยายของแชมเปียนเพิ่มลูกเต๋าเสริมตามกฎคริติคอลปกติเท่านั้น")
    },
    balance: { note: t("Single rider die capped at 1d4 here; requires no shield (lower AC).", "ลูกเต๋าเสริม 1d4 ต้องไม่ถือโล่"), reviewed: true }
  },

  /* ------------------------------ Rogue ------------------------------ */
  {
    id: "shadow-skirmisher", class: "rogue", theme: "mobility",
    name: t("Shadow Skirmisher", "นักรบเงาจู่โจม"),
    description: t("Strike and reposition.", "โจมตีแล้วเปลี่ยนตำแหน่ง"),
    learn: null,
    tiers: [
      tier(1, t("Slip Away", "หลุดลอย"), [{ kind: "grantTechnique", id: "slipstream-cut" }], t("Learn Slipstream Cut.", "เรียนรู้ฟันกระแสลม")),
      tier(2, t("Light Feet", "เท้าเบา"), [{ kind: "stat", key: "speed", value: 5 }], t("+5 ft speed.", "ความเร็ว +5 ฟุต")),
      tier(3, t("Shadow Reserve", "สำรองเงา"), [{ kind: "resourceMax", value: 1 }], t("+1 maximum Momentum.", "โมเมนตัมสูงสุด +1")),
      tier(4, t("Ghost Angle", "มุมวิญญาณ"), [{ kind: "modifierSlot", value: 1 }], t("+1 modifier slot.", "ช่องตัวปรับแต่ง +1"))
    ],
    interactions: {
      features: [
        { feature: "sneak-attack", rule: t("Sneak Attack is never reduced by technique damage penalties applied to the weapon die; penalties apply to the total once.", "บทลงโทษความเสียหายใช้กับผลรวมครั้งเดียว") },
        { feature: "cunning-action", rule: t("Unchanged. Slipstream shift is separate from Cunning Action movement.", "ไม่เปลี่ยน") }
      ],
      subclasses: t("Compatible with all subclasses.", "ใช้ได้กับทุกซับคลาส")
    },
    balance: { note: t("Mobility only; no damage.", "เน้นการเคลื่อนที่ ไม่เพิ่มความเสียหาย"), reviewed: true }
  },
  {
    id: "snare-artisan", class: "rogue", theme: "control",
    name: t("Snare Artisan", "ช่างกับดัก"),
    description: t("Pin and hinder from range.", "ตรึงและขัดขวางจากระยะไกล"),
    learn: null,
    tiers: [
      tier(1, t("Pinning Habit", "นิสัยตรึง"), [{ kind: "grantTechnique", id: "pinning-volley" }], t("Learn Pinning Volley.", "เรียนรู้ระดมยิงตรึง")),
      tier(2, t("Lockdown", "ล็อกดาวน์"), [{ kind: "grantTechnique", id: "lockdown-strike" }], t("Learn Lockdown Strike.", "เรียนรู้ฟาดตรึงพื้นที่")),
      tier(3, t("Patient Hunter", "นักล่าอดทน"), [{ kind: "stat", key: "checkAll", value: 1 }], t("+1 to ability checks.", "การทดสอบความสามารถ +1")),
      tier(4, t("Web of Blades", "ใยใบมีด"), [{ kind: "techniqueSlot", value: 1 }], t("+1 technique slot.", "ช่องเทคนิค +1"))
    ],
    interactions: {
      features: [{ feature: "cunning-strike", rule: t("A hit may apply a Cunning Strike effect or a Forge secondary, not both.", "การโจมตีโดนใช้คันนิงสไตรก์หรือผลรองฟอร์จได้อย่างใดอย่างหนึ่ง") }],
      subclasses: t("Compatible with all subclasses.", "ใช้ได้กับทุกซับคลาส")
    },
    balance: { note: t("Control effects always trade 2 damage.", "ผลควบคุมแลกความเสียหาย 2 เสมอ"), reviewed: true }
  },

  /* ------------------------------ Wizard ------------------------------ */
  {
    id: "arcane-architect", class: "wizard", theme: "control",
    name: t("Arcane Architect", "สถาปนิกเวท"),
    description: t("Shape areas precisely.", "ปั้นพื้นที่เวทอย่างแม่นยำ"),
    learn: { spellcaster: true },
    tiers: [
      tier(1, t("Draftsman's Eye", "ตานักร่างแบบ"), [{ kind: "stat", key: "concentration", value: 1 }], t("+1 to Concentration saves.", "เซฟสมาธิ +1")),
      tier(2, t("Load-bearing Wards", "ผนึกรับน้ำหนัก"), [{ kind: "grantTechnique", id: "warding-glyph" }], t("Learn Warding Glyph.", "เรียนรู้ผนึกพิทักษ์")),
      tier(3, t("Structural Reserve", "สำรองโครงสร้าง"), [{ kind: "resourceMax", value: 1 }], t("+1 maximum Momentum.", "โมเมนตัมสูงสุด +1")),
      tier(4, t("Master Plan", "แผนแม่บท"), [{ kind: "modifierSlot", value: 1 }], t("+1 modifier slot.", "ช่องตัวปรับแต่ง +1"))
    ],
    interactions: {
      features: [{ feature: "arcane-recovery", rule: t("Unchanged. Weaves never restore or create spell slots.", "ไม่เปลี่ยน การถักทอไม่คืนหรือสร้างช่องเวท") }],
      subclasses: t("Evoker's Sculpt Spells and Area weaves can both apply to one spell (they change different things).", "สคัลป์สเปลล์และการถักทอพื้นที่ใช้ร่วมกันได้")
    },
    balance: { note: t("No damage; utility and sustain.", "ไม่มีความเสียหาย เน้นอรรถประโยชน์"), reviewed: true }
  },
  {
    id: "ember-conduit", class: "wizard", theme: "offense",
    name: t("Ember Conduit", "ท่อนำถ่านเพลิง"),
    description: t("Elemental conversion and burst.", "การแปลงธาตุและระเบิดพลัง"),
    learn: { spellcaster: true },
    tiers: [
      tier(1, t("Kindled Mind", "จิตจุดไฟ"), [{ kind: "stat", key: "initiative", value: 1 }], t("+1 initiative.", "อินิเชียทีฟ +1")),
      tier(2, t("Conduit Heat", "ความร้อนในท่อ"), [{ kind: "riderDie", dice: "1d4", damageType: "fire", when: { spell: true, spellDamageType: ["fire", "cold"], spellLevel: { min: 1 } } }],
        t("Leveled fire or cold spells add 1d4 fire (rider die).", "เวทระดับ 1+ ที่เป็นไฟหรือน้ำแข็งเพิ่ม 1d4 ไฟ")),
      tier(3, t("Pressure Valve", "วาล์วแรงดัน"), [{ kind: "resourceMax", value: 1 }], t("+1 maximum Momentum.", "โมเมนตัมสูงสุด +1")),
      tier(4, t("White Flame", "เปลวขาว"), [{ kind: "stat", key: "spellDC", value: 1 }], t("+1 spell save DC.", "DC เซฟเวท +1"))
    ],
    interactions: {
      features: [{ feature: "spellcasting", rule: t("Rider die adds once per spell, to one target's damage roll.", "ลูกเต๋าเสริมเพิ่มครั้งเดียวต่อเวท") }],
      subclasses: t("Does not stack with Empowered Evocation-style flat bonuses beyond the Forge damage cap.", "ไม่เกินเพดานความเสียหายของฟอร์จ")
    },
    balance: { note: t("Spell DC +1 shares the global +1 spellDC cap with Focused Channel (they do not stack).", "DC +1 ใช้เพดานร่วมกับช่องทางมุ่งเน้น ไม่ซ้อน"), reviewed: true }
  },

  /* ------------------------------ Others ------------------------------ */
  {
    id: "sanctum-warden", class: "cleric", theme: "support",
    name: t("Sanctum Warden", "ผู้คุมวิหาร"),
    description: t("Shielding allies with wards.", "ปกป้องพันธมิตรด้วยผนึก"),
    learn: { spellcaster: true },
    tiers: [
      tier(1, t("Warden's Sign", "สัญลักษณ์ผู้คุม"), [{ kind: "grantTechnique", id: "warding-glyph" }], t("Learn Warding Glyph.", "เรียนรู้ผนึกพิทักษ์")),
      tier(2, t("Steadfast Prayer", "คำอธิษฐานมั่นคง"), [{ kind: "stat", key: "concentration", value: 2 }], t("+2 to Concentration saves.", "เซฟสมาธิ +2")),
      tier(3, t("Vigil", "การเฝ้ายาม"), [{ kind: "grantTechnique", id: "interpose" }], t("Learn Interpose.", "เรียนรู้ขวางรับ")),
      tier(4, t("Sanctuary Reserve", "สำรองแห่งวิหาร"), [{ kind: "resourceMax", value: 1 }], t("+1 maximum Momentum.", "โมเมนตัมสูงสุด +1"))
    ],
    interactions: {
      features: [{ feature: "channel-divinity", rule: t("Unchanged; Momentum is never converted to Channel Divinity uses or back.", "ไม่เปลี่ยน โมเมนตัมแลกกับแชนเนลดิวินิตีไม่ได้") }],
      subclasses: t("Compatible with all domains.", "ใช้ได้กับทุกโดเมน")
    },
    balance: { note: t("Temp HP never stacks; Interpose needs a shield.", "HP ชั่วคราวไม่ซ้อน ขวางรับต้องมีโล่"), reviewed: true }
  },
  {
    id: "oathbound-aegis", class: "paladin", theme: "reactive",
    name: t("Oathbound Aegis", "โล่แห่งคำสาบาน"),
    description: t("Punish attackers and protect allies.", "ลงโทษผู้โจมตีและปกป้องพันธมิตร"),
    learn: null,
    tiers: [
      tier(1, t("Answering Steel", "เหล็กตอบโต้"), [{ kind: "grantTechnique", id: "riposte-line" }], t("Learn Riposte Line.", "เรียนรู้แนวสวนกลับ")),
      tier(2, t("Shield of Vows", "โล่แห่งปณิธาน"), [{ kind: "grantTechnique", id: "interpose" }], t("Learn Interpose.", "เรียนรู้ขวางรับ")),
      tier(3, t("Oath Reserve", "สำรองคำสาบาน"), [{ kind: "resourceMax", value: 1 }], t("+1 maximum Momentum.", "โมเมนตัมสูงสุด +1")),
      tier(4, t("Aegis Discipline", "วินัยโล่"), [{ kind: "stat", key: "ac", value: 1 }], t("+1 AC.", "AC +1"))
    ],
    interactions: {
      features: [{ feature: "divine-smite", rule: t("Divine Smite may be cast on a Riposte hit using its normal Bonus Action and slot; Forge never pays for it.", "ใช้ไดวีนสไมต์กับการสวนกลับได้ตามกฎปกติ") }],
      subclasses: t("Compatible with all oaths.", "ใช้ได้กับทุกคำสาบาน")
    },
    balance: { note: t("Riposte costs 2 Momentum and the reaction; AC shares the +2 Forge AC cap.", "สวนกลับใช้โมเมนตัม 2 และรีแอคชัน AC ใช้เพดานร่วม +2"), reviewed: true }
  },
  {
    id: "bloodstorm", class: "barbarian", theme: "resource",
    name: t("Bloodstorm", "พายุโลหิต"),
    description: t("Turn punishment into Momentum.", "เปลี่ยนความเจ็บปวดเป็นโมเมนตัม"),
    learn: null,
    tiers: [
      tier(1, t("Pain Engine", "เครื่องยนต์ความเจ็บ"), [{ kind: "resourceGain", on: "damaged", value: 1, oncePer: "round" }],
        t("Gain 1 Momentum the first time you take damage each round.", "ได้รับโมเมนตัม 1 เมื่อได้รับความเสียหายครั้งแรกในแต่ละรอบ")),
      tier(2, t("Heavy Swing", "เหวี่ยงหนัก"), [{ kind: "grantTechnique", id: "sundering-blow" }], t("Learn Sundering Blow.", "เรียนรู้ฟาดทลาย")),
      tier(3, t("Deep Reserves", "สำรองลึก"), [{ kind: "resourceMax", value: 1 }], t("+1 maximum Momentum.", "โมเมนตัมสูงสุด +1")),
      tier(4, t("Storm Heart", "หัวใจพายุ"), [{ kind: "stat", key: "hpPerLevel", value: 1 }], t("+1 HP per level.", "HP +1 ต่อเลเวล"))
    ],
    interactions: {
      features: [{ feature: "rage", rule: t("Rage Damage is native and is not part of the Forge damage cap.", "ความเสียหายจากเรจเป็นของระบบหลัก ไม่นับรวมเพดานฟอร์จ") }],
      subclasses: t("Compatible with all paths.", "ใช้ได้กับทุกเส้นทาง")
    },
    balance: { note: t("Momentum gain shares the 2-per-round global cap with every other source.", "การได้โมเมนตัมใช้เพดานรวม 2 ต่อรอบ"), reviewed: true }
  }
];

/* ======================================================================== */

export const WEAPON_PATHS = [
  {
    id: "precision-duelist", style: "duelist", masteryPolicy: "augment",
    name: t("Precision Duelist", "นักดวลแม่นยำ"),
    description: t("One blade, one opening.", "ดาบเล่มเดียว ช่องว่างเดียว"),
    learn: { hasMastery: ["vex", "nick"] },
    requires: { weaponProperty: "fin" },
    ranks: [
      { rank: 1, level: 1, effects: [{ kind: "grantTechnique", id: "measured-thrust" }] },
      { rank: 2, level: 5, effects: [{ kind: "attackBonus", value: 1, when: { weaponProperty: "fin", weaponMastery: "vex" } }] },
      { rank: 3, level: 11, effects: [{ kind: "secondary", type: "disadvantageTarget", target: "target", when: { weaponMastery: "vex", usingTechnique: "measured-thrust" } }] }
    ]
  },
  {
    id: "counterattacker", style: "counter", masteryPolicy: "augment",
    name: t("Counterattacker", "ผู้สวนกลับ"),
    description: t("Every miss against you is an opening.", "ทุกครั้งที่ศัตรูพลาดคือช่องว่าง"),
    learn: { hasMastery: ["sap", "vex", "slow"] },
    requires: { weaponRange: "melee" },
    ranks: [
      { rank: 1, level: 1, effects: [{ kind: "grantTechnique", id: "riposte-line" }] },
      { rank: 2, level: 5, effects: [{ kind: "resourceGain", on: "missedBy", value: 1, oncePer: "round" }] },
      { rank: 3, level: 11, effects: [{ kind: "riderDie", dice: "1d6", when: { usingTechnique: "riposte-line" } }] }
    ]
  },
  {
    id: "heavy-breaker", style: "breaker", masteryPolicy: "augment",
    name: t("Heavy Breaker", "ผู้ทลายหนัก"),
    description: t("Break stances and bodies.", "ทำลายท่าทางและร่างกาย"),
    learn: { hasMastery: ["topple", "cleave", "graze", "push"] },
    requires: { weaponProperty: "hvy" },
    ranks: [
      { rank: 1, level: 1, effects: [{ kind: "grantTechnique", id: "sundering-blow" }] },
      { rank: 2, level: 5, effects: [{ kind: "secondary", type: "push", feet: 5, target: "target", when: { weaponMastery: ["topple", "push"] } }] },
      { rank: 3, level: 11, effects: [{ kind: "damageBonus", value: 2, when: { weaponProperty: "hvy", weaponMastery: "graze" } }] }
    ]
  },
  {
    id: "defensive-master", style: "defender", masteryPolicy: "augment",
    name: t("Defensive Weapon Master", "ปรมาจารย์อาวุธป้องกัน"),
    description: t("Weapon and shield as one wall.", "อาวุธและโล่คือกำแพงเดียว"),
    learn: { armorProficiency: ["shl"] },
    requires: { shield: true },
    ranks: [
      { rank: 1, level: 1, effects: [{ kind: "grantTechnique", id: "bulwark-step" }] },
      { rank: 2, level: 5, effects: [{ kind: "grantTechnique", id: "interpose" }] },
      { rank: 3, level: 11, effects: [{ kind: "secondary", type: "guard", value: 1, target: "self", when: { shield: true, weaponMastery: ["sap", "push"] } }] }
    ]
  },
  {
    id: "mobile-skirmisher", style: "skirmisher", masteryPolicy: "augment",
    name: t("Mobile Skirmisher", "นักรบเคลื่อนที่"),
    description: t("Never where they swing.", "ไม่เคยอยู่ตรงที่ศัตรูฟาด"),
    learn: { hasMastery: ["nick", "vex", "slow"] },
    requires: { weaponProperty: ["lgt", "fin", "thr"] },
    ranks: [
      { rank: 1, level: 1, effects: [{ kind: "grantTechnique", id: "slipstream-cut" }] },
      { rank: 2, level: 5, effects: [{ kind: "stat", key: "speed", value: 5 }] },
      { rank: 3, level: 11, effects: [{ kind: "secondary", type: "shift", feet: 10, target: "self", when: { weaponMastery: "nick" } }] }
    ]
  },
  {
    id: "battlefield-controller", style: "controller", masteryPolicy: "augment",
    name: t("Battlefield Controller", "ผู้คุมสนามรบ"),
    description: t("Decide where the enemy may stand.", "กำหนดว่าศัตรูยืนตรงไหนได้"),
    learn: { hasMastery: ["slow", "push", "topple"] },
    requires: { weapon: true },
    ranks: [
      { rank: 1, level: 1, effects: [{ kind: "grantTechnique", id: "pinning-volley" }] },
      { rank: 2, level: 5, effects: [{ kind: "grantTechnique", id: "lockdown-strike" }] },
      { rank: 3, level: 11, effects: [{ kind: "rangeDelta", feet: 5, when: { usingTechnique: ["lockdown-strike"] } }] }
    ]
  }
].map(p => ({ ...p, ranks: p.ranks.map(r => ({ ...r })) }));
