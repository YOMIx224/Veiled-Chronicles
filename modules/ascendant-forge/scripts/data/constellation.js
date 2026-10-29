/**
 * Ascendant Constellation — default node graph.
 *
 * Four regions, each with its own root, so characters can start anywhere:
 *   Iron (defence / heavy weapons)    — west
 *   Tide (mobility / precision)       — north
 *   Lantern (magic)                   — east
 *   Anchor (leadership / support)     — south
 * Bridge "synergy" nodes connect neighbouring regions. Two pairs of keystones
 * conflict with each other, so no build can take every capstone.
 */
const t = (en, th) => ({ en, th });

export const NODES = [
  /* ---------------------------- Iron ---------------------------- */
  {
    id: "iron-gate", category: "attribute", cost: 1, respec: "free",
    name: t("Iron Gate", "ประตูเหล็ก"),
    description: t("Your frame hardens. +1 hit point per character level.", "ร่างกายแข็งแกร่งขึ้น HP +1 ต่อเลเวลตัวละคร"),
    position: { x: 150, y: 350 }, links: ["bulwark-stance", "iron-hide"], conflicts: [],
    prerequisites: null, eligibility: null, compatibility: null,
    effects: [{ kind: "stat", key: "hpPerLevel", value: 1 }],
    rules: { root: true }
  },
  {
    id: "bulwark-stance", category: "mechanic", cost: 1, respec: "free",
    name: t("Bulwark Stance", "ท่าปราการ"),
    description: t("Learn Bulwark Step. Gain 1 Momentum the first time you take damage each round.",
      "เรียนรู้ก้าวปราการ ได้รับโมเมนตัม 1 แต้มเมื่อได้รับความเสียหายครั้งแรกในแต่ละรอบ"),
    position: { x: 150, y: 220 }, links: ["breaker-discipline"], conflicts: [],
    prerequisites: null, eligibility: null, compatibility: null,
    effects: [
      { kind: "grantTechnique", id: "bulwark-step" },
      { kind: "resourceGain", on: "damaged", value: 1, oncePer: "round" }
    ],
    rules: {}
  },
  {
    id: "iron-hide", category: "attribute", cost: 1, respec: "free",
    name: t("Iron Hide", "หนังเหล็ก"),
    description: t("+1 AC. Requires medium or heavy armor training.", "AC +1 ต้องมีความชำนาญเกราะกลางหรือเกราะหนัก"),
    position: { x: 260, y: 430 }, links: ["breaker-discipline", "tempered-edge", "bastion-chorus"], conflicts: [],
    prerequisites: null, eligibility: { armorProficiency: ["med", "hvy"] }, compatibility: null,
    effects: [{ kind: "stat", key: "ac", value: 1 }],
    rules: {}
  },
  {
    id: "breaker-discipline", category: "specialization", cost: 2, respec: "rest",
    name: t("Breaker Discipline", "วินัยผู้ทำลาย"),
    description: t("Learn Sundering Blow. Heavy two-handed weapon hits add a 1d4 rider die.",
      "เรียนรู้ฟาดทลาย การโจมตีโดนด้วยอาวุธหนักสองมือเพิ่มลูกเต๋าเสริม 1d4"),
    position: { x: 260, y: 220 }, links: ["unyielding-oath"], conflicts: [],
    prerequisites: null, eligibility: { weaponProficiency: ["mar"] }, compatibility: null,
    effects: [
      { kind: "grantTechnique", id: "sundering-blow" },
      { kind: "riderDie", dice: "1d4", when: { weaponAllProperties: ["hvy", "two"] } }
    ],
    rules: { exclusiveGroup: "weapon-specialization" }
  },
  {
    id: "unyielding-oath", category: "keystone", cost: 2, respec: "rest",
    name: t("Unyielding Oath", "ปณิธานไม่หวั่นไหว"),
    description: t("+1 AC and +2 to Concentration saves. Your weapon damage rolls take −2.",
      "AC +1 และเซฟสมาธิ +2 แต่ความเสียหายจากอาวุธ −2"),
    position: { x: 150, y: 90 }, links: [], conflicts: ["reckless-apex"],
    prerequisites: { node: ["bulwark-stance"] }, eligibility: null, compatibility: null,
    effects: [
      { kind: "stat", key: "ac", value: 1 },
      { kind: "stat", key: "concentration", value: 2 },
      { kind: "damagePenalty", value: 2, when: { weapon: true } }
    ],
    rules: { minLevel: 5 }
  },

  /* ---------------------------- Tide ---------------------------- */
  {
    id: "tide-root", category: "attribute", cost: 1, respec: "free",
    name: t("Tide's Edge", "ขอบกระแสน้ำ"),
    description: t("+5 ft walking speed.", "ความเร็วเดิน +5 ฟุต"),
    position: { x: 500, y: 90 }, links: ["quickstep-lore", "tide-reflex"], conflicts: [],
    prerequisites: null, eligibility: null, compatibility: null,
    effects: [{ kind: "stat", key: "speed", value: 5 }],
    rules: { root: true }
  },
  {
    id: "quickstep-lore", category: "mechanic", cost: 1, respec: "free",
    name: t("Quickstep Lore", "ศาสตร์ก้าวพริ้ว"),
    description: t("Learn Slipstream Cut. Gain 1 Momentum the first time you miss each turn.",
      "เรียนรู้ฟันกระแสลม ได้รับโมเมนตัม 1 แต้มเมื่อโจมตีพลาดครั้งแรกในแต่ละเทิร์น"),
    position: { x: 380, y: 160 }, links: ["duelist-focus"], conflicts: [],
    prerequisites: null, eligibility: null, compatibility: null,
    effects: [
      { kind: "grantTechnique", id: "slipstream-cut" },
      { kind: "resourceGain", on: "miss", value: 1, oncePer: "turn" }
    ],
    rules: {}
  },
  {
    id: "tide-reflex", category: "attribute", cost: 1, respec: "free",
    name: t("Tide Reflex", "ปฏิกิริยากระแสน้ำ"),
    description: t("+2 initiative.", "อินิเชียทีฟ +2"),
    position: { x: 620, y: 160 }, links: ["tempered-edge", "spellblade-confluence"], conflicts: [],
    prerequisites: null, eligibility: null, compatibility: null,
    effects: [{ kind: "stat", key: "initiative", value: 2 }],
    rules: {}
  },
  {
    id: "duelist-focus", category: "specialization", cost: 2, respec: "rest",
    name: t("Duelist Focus", "สมาธินักดวล"),
    description: t("+1 to attack rolls with finesse weapons while you have no shield.",
      "การโจมตีด้วยอาวุธฟิเนสส์ +1 เมื่อไม่ได้ถือโล่"),
    position: { x: 380, y: 40 }, links: ["reckless-apex"], conflicts: [],
    prerequisites: null, eligibility: null, compatibility: null,
    effects: [{ kind: "attackBonus", value: 1, when: { weaponProperty: "fin", shield: false } }],
    rules: { exclusiveGroup: "weapon-specialization" }
  },
  {
    id: "reckless-apex", category: "keystone", cost: 2, respec: "rest",
    name: t("Reckless Apex", "จุดสูงสุดบ้าบิ่น"),
    description: t("Weapon damage +half proficiency bonus. Weapon attack rolls take −1.",
      "ความเสียหายอาวุธ +ครึ่งหนึ่งของโบนัสความชำนาญ แต่การโจมตีด้วยอาวุธ −1"),
    position: { x: 260, y: 20 }, links: [], conflicts: ["unyielding-oath"],
    prerequisites: null, eligibility: null, compatibility: null,
    effects: [
      { kind: "damageBonus", value: "halfpb", when: { weapon: true } },
      { kind: "attackPenalty", value: 1, when: { weapon: true } }
    ],
    rules: { minLevel: 5 }
  },

  /* --------------------------- Lantern --------------------------- */
  {
    id: "lantern-root", category: "attribute", cost: 1, respec: "free",
    name: t("Lantern Wick", "ไส้ตะเกียง"),
    description: t("+1 to Constitution saves to maintain Concentration.", "เซฟรักษาสมาธิ +1"),
    position: { x: 850, y: 350 }, links: ["weave-theory", "lantern-clarity"], conflicts: [],
    prerequisites: null, eligibility: null, compatibility: null,
    effects: [{ kind: "stat", key: "concentration", value: 1 }],
    rules: { root: true }
  },
  {
    id: "weave-theory", category: "mechanic", cost: 1, respec: "free",
    name: t("Weave Theory", "ทฤษฎีการถักทอ"),
    description: t("Learn Warding Glyph. Gain 1 Momentum the first time you cast a leveled spell each round.",
      "เรียนรู้ผนึกพิทักษ์ ได้รับโมเมนตัม 1 แต้มเมื่อร่ายเวทระดับ 1 ขึ้นไปครั้งแรกในแต่ละรอบ"),
    position: { x: 850, y: 220 }, links: ["focused-channel"], conflicts: [],
    prerequisites: null, eligibility: { spellcaster: true }, compatibility: null,
    effects: [
      { kind: "grantTechnique", id: "warding-glyph" },
      { kind: "resourceGain", on: "spellCast", value: 1, oncePer: "round" }
    ],
    rules: {}
  },
  {
    id: "lantern-clarity", category: "attribute", cost: 1, respec: "free",
    name: t("Lantern Clarity", "ความแจ่มใสแห่งตะเกียง"),
    description: t("+2 to Concentration saves.", "เซฟรักษาสมาธิ +2"),
    position: { x: 740, y: 280 }, links: ["spellblade-confluence", "beacon-circuit"], conflicts: [],
    prerequisites: null, eligibility: null, compatibility: null,
    effects: [{ kind: "stat", key: "concentration", value: 2 }],
    rules: {}
  },
  {
    id: "focused-channel", category: "specialization", cost: 2, respec: "rest",
    name: t("Focused Channel", "ช่องทางมุ่งเน้น"),
    description: t("+1 spell save DC.", "DC เซฟเวทมนตร์ +1"),
    position: { x: 960, y: 220 }, links: ["overflowing-vessel"], conflicts: [],
    prerequisites: null, eligibility: { spellcaster: true }, compatibility: null,
    effects: [{ kind: "stat", key: "spellDC", value: 1 }],
    rules: { minLevel: 4 }
  },
  {
    id: "overflowing-vessel", category: "keystone", cost: 2, respec: "rest",
    name: t("Overflowing Vessel", "ภาชนะล้นเอ่อ"),
    description: t("Damaging spells of 1st level or higher add a 1d6 rider die. Your weapon attack rolls take −2.",
      "เวทระดับ 1 ขึ้นไปที่สร้างความเสียหายเพิ่มลูกเต๋าเสริม 1d6 แต่การโจมตีด้วยอาวุธ −2"),
    position: { x: 960, y: 90 }, links: [], conflicts: ["shared-burden"],
    prerequisites: null, eligibility: { spellcaster: true }, compatibility: null,
    effects: [
      { kind: "riderDie", dice: "1d6", when: { spell: true, spellLevel: { min: 1 } } },
      { kind: "attackPenalty", value: 2, when: { weapon: true } }
    ],
    rules: { minLevel: 5 }
  },

  /* ---------------------------- Anchor ---------------------------- */
  {
    id: "anchor-root", category: "attribute", cost: 1, respec: "free",
    name: t("Anchor Stone", "ศิลาสมอ"),
    description: t("+1 to all ability checks.", "การทดสอบค่าความสามารถทั้งหมด +1"),
    position: { x: 500, y: 620 }, links: ["rally-doctrine", "anchor-resolve"], conflicts: [],
    prerequisites: null, eligibility: null, compatibility: null,
    effects: [{ kind: "stat", key: "checkAll", value: 1 }],
    rules: { root: true }
  },
  {
    id: "rally-doctrine", category: "mechanic", cost: 1, respec: "free",
    name: t("Rally Doctrine", "หลักการรวมพล"),
    description: t("Learn Rallying Command. While Bloodied, gain 1 Momentum at the start of your turn (once per round).",
      "เรียนรู้คำสั่งรวมพล ขณะบาดเจ็บสาหัส ได้รับโมเมนตัม 1 แต้มเมื่อเริ่มเทิร์น (รอบละครั้ง)"),
    position: { x: 380, y: 540 }, links: ["guardian-mandate"], conflicts: [],
    prerequisites: null, eligibility: null, compatibility: null,
    effects: [
      { kind: "grantTechnique", id: "rallying-command" },
      { kind: "resourceGain", on: "turnStart", value: 1, oncePer: "round", when: { bloodied: true } }
    ],
    rules: {}
  },
  {
    id: "anchor-resolve", category: "attribute", cost: 1, respec: "free",
    name: t("Anchor Resolve", "ความมุ่งมั่นแห่งสมอ"),
    description: t("+1 to all saving throws and +1 maximum Momentum.", "เซฟทั้งหมด +1 และโมเมนตัมสูงสุด +1"),
    position: { x: 620, y: 540 }, links: ["beacon-circuit", "bastion-chorus"], conflicts: [],
    prerequisites: null, eligibility: null, compatibility: null,
    effects: [{ kind: "stat", key: "saveAll", value: 1 }, { kind: "resourceMax", value: 1 }],
    rules: { minLevel: 3 }
  },
  {
    id: "guardian-mandate", category: "specialization", cost: 2, respec: "rest",
    name: t("Guardian Mandate", "พันธกิจผู้พิทักษ์"),
    description: t("Learn Interpose.", "เรียนรู้ขวางรับ"),
    position: { x: 380, y: 660 }, links: ["shared-burden"], conflicts: [],
    prerequisites: null, eligibility: null, compatibility: null,
    effects: [{ kind: "grantTechnique", id: "interpose" }],
    rules: {}
  },
  {
    id: "shared-burden", category: "keystone", cost: 2, respec: "rest",
    name: t("Shared Burden", "ภาระร่วม"),
    description: t("+1 technique slot. Your weapon attack rolls take −1.", "ช่องเทคนิค +1 แต่การโจมตีด้วยอาวุธ −1"),
    position: { x: 500, y: 690 }, links: [], conflicts: ["overflowing-vessel"],
    prerequisites: { node: ["rally-doctrine"] }, eligibility: null, compatibility: null,
    effects: [{ kind: "techniqueSlot", value: 1 }, { kind: "attackPenalty", value: 1, when: { weapon: true } }],
    rules: { minLevel: 5 }
  },

  /* ---------------------------- Bridges ---------------------------- */
  {
    id: "tempered-edge", category: "synergy", cost: 2, respec: "rest",
    name: t("Tempered Edge", "คมที่ผ่านการหลอม"),
    description: t("Bridges Iron and Tide. +1 modifier slot on every technique.", "เชื่อมเหล็กกับกระแสน้ำ ช่องตัวปรับแต่ง +1 ทุกเทคนิค"),
    position: { x: 400, y: 300 }, links: [], conflicts: [],
    prerequisites: { node: ["iron-hide", "tide-reflex"] }, eligibility: null, compatibility: null,
    effects: [{ kind: "modifierSlot", value: 1 }],
    rules: { minLevel: 7 }
  },
  {
    id: "spellblade-confluence", category: "synergy", cost: 2, respec: "rest",
    name: t("Spellblade Confluence", "จุดบรรจบดาบเวท"),
    description: t("Bridges Tide and Lantern. +1 to weapon attack rolls while you are concentrating on a spell. Learn Spellstrike Feint.",
      "เชื่อมกระแสน้ำกับตะเกียง การโจมตีด้วยอาวุธ +1 ขณะรักษาสมาธิเวท เรียนรู้หลอกล่อเวทฟัน"),
    position: { x: 700, y: 200 }, links: [], conflicts: [],
    prerequisites: { node: ["tide-reflex", "lantern-clarity"] }, eligibility: { spellcaster: true }, compatibility: null,
    effects: [
      { kind: "attackBonus", value: 1, when: { weapon: true, concentrating: true } },
      { kind: "grantTechnique", id: "spellstrike-feint" }
    ],
    rules: {}
  },
  {
    id: "beacon-circuit", category: "synergy", cost: 2, respec: "rest",
    name: t("Beacon Circuit", "วงจรประภาคาร"),
    description: t("Bridges Lantern and Anchor. +1 technique slot.", "เชื่อมตะเกียงกับสมอ ช่องเทคนิค +1"),
    position: { x: 700, y: 420 }, links: [], conflicts: [],
    prerequisites: { node: ["lantern-clarity", "anchor-resolve"] }, eligibility: null, compatibility: null,
    effects: [{ kind: "techniqueSlot", value: 1 }],
    rules: {}
  },
  {
    id: "bastion-chorus", category: "synergy", cost: 2, respec: "rest",
    name: t("Bastion Chorus", "ประสานเสียงป้อมปราการ"),
    description: t("Bridges Iron and Anchor. +1 maximum Momentum.", "เชื่อมเหล็กกับสมอ โมเมนตัมสูงสุด +1"),
    position: { x: 400, y: 450 }, links: [], conflicts: [],
    prerequisites: { node: ["iron-hide", "anchor-resolve"] }, eligibility: null, compatibility: null,
    effects: [{ kind: "resourceMax", value: 1 }],
    rules: {}
  }
];
