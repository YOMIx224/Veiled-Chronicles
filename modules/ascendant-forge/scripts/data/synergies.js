/**
 * Build Synergy registry — curated cross-system combinations.
 *
 * A synergy activates only when every listed requirement is present in the build
 * (equipped techniques/modifiers, allocated nodes, chosen paths). Its effects enter the
 * normal resolution pipeline at `priority`, so they compete with — never stack beyond —
 * other sources. Each one exists to create a choice, described in `tactic`.
 */
const t = (en, th) => ({ en, th });

export const SYNERGIES = [
  {
    id: "anvil-and-hammer", priority: 60, oncePer: "turn",
    name: t("Anvil and Hammer", "ทั่งและค้อน"),
    description: t("Sundering Blow may push the target 10 ft instead of knocking it Prone.", "ฟาดทลายสามารถผลักเป้าหมาย 10 ฟุตแทนการทำให้ล้ม"),
    tactic: t("Prone helps melee allies; the push protects ranged ones. Choose per hit.", "ล้มช่วยพวกประชิด ผลักช่วยพวกระยะไกล เลือกทุกครั้งที่โดน"),
    requires: { nodes: ["breaker-discipline"], weaponPaths: ["heavy-breaker"], techniques: ["sundering-blow"] },
    cost: {},
    effects: [{ kind: "secondary", type: "push", feet: 10, target: "target", when: { usingTechnique: "sundering-blow" } }]
  },
  {
    id: "spellsteel-cadence", priority: 55, oncePer: "turn",
    name: t("Spellsteel Cadence", "จังหวะเหล็กเวท"),
    description: t("Spellstrike Feint's weapon damage becomes force while you concentrate.", "ความเสียหายอาวุธของหลอกล่อเวทฟันกลายเป็นพลังงานขณะรักษาสมาธิ"),
    tactic: t("Bypass physical resistance, but only while risking your Concentration in melee.", "ข้ามการต้านทานกายภาพ แต่ต้องเสี่ยงสมาธิในระยะประชิด"),
    requires: { nodes: ["spellblade-confluence"], techniques: ["spellstrike-feint"] },
    cost: {},
    effects: [{ kind: "damageTypeSwap", from: ["bludgeoning", "piercing", "slashing"], to: "force", when: { usingTechnique: "spellstrike-feint", concentrating: true } }]
  },
  {
    id: "phalanx-doctrine", priority: 50, oncePer: "round",
    name: t("Phalanx Doctrine", "หลักการแฟแลงซ์"),
    description: t("Interpose also gives the protected ally +1 to its next saving throw this round.",
      "ขวางรับยังให้พันธมิตร +1 ต่อการเซฟครั้งถัดไปในรอบนี้"),
    tactic: t("Spend your reaction to protect an ally rather than to riposte.", "ใช้รีแอคชันปกป้องพันธมิตรแทนการสวนกลับ"),
    requires: { evolutions: [{ class: "fighter", path: "vanguard-bulwark", tier: 1 }], techniques: ["interpose"] },
    cost: {},
    effects: [{ kind: "note", text: t("The protected ally gains +1 to its next saving throw before the end of the round.", "พันธมิตรที่ได้รับการปกป้องได้ +1 ต่อการเซฟครั้งถัดไปก่อนจบรอบ"), when: { usingTechnique: "interpose" } }]
  },
  {
    id: "tidal-riposte", priority: 55, oncePer: "round",
    name: t("Tidal Riposte", "สวนกลับดั่งคลื่น"),
    description: t("A Riposte Line hit may move you 10 ft without provoking instead of using your weapon's mastery rider from Forge sources.",
      "การสวนกลับที่โดนสามารถเคลื่อนที่ 10 ฟุตโดยไม่ถูกโจมตีฉวยโอกาส แทนผลรองอื่นจากฟอร์จ"),
    tactic: t("Counter and slip out of a flank, or stay and hold the line.", "สวนกลับแล้วหลุดจากวงล้อม หรืออยู่ยึดแนว"),
    requires: { weaponPaths: ["counterattacker"], techniques: ["riposte-line"], nodes: ["quickstep-lore"] },
    cost: {},
    effects: [{ kind: "secondary", type: "shift", feet: 10, target: "self", when: { usingTechnique: "riposte-line" } }]
  },
  {
    id: "beacon-of-the-line", priority: 45, oncePer: "round",
    name: t("Beacon of the Line", "ประภาคารแห่งแนวรบ"),
    description: t("Rallying Command reaches one additional ally, costing 1 more Momentum.", "คำสั่งรวมพลมีผลกับพันธมิตรเพิ่มหนึ่งคน ใช้โมเมนตัมเพิ่ม 1"),
    tactic: t("Spread a thinner shield across the party, or save Momentum for a reaction.", "กระจายการป้องกันให้ทั้งทีม หรือเก็บโมเมนตัมไว้ใช้รีแอคชัน"),
    requires: { nodes: ["rally-doctrine", "beacon-circuit"], techniques: ["rallying-command"] },
    cost: { momentum: 1 },
    effects: [{ kind: "targetDelta", value: 1, when: { usingTechnique: "rallying-command" } }]
  },
  {
    id: "ember-cascade", priority: 50, oncePer: "turn",
    name: t("Ember Cascade", "ถ่านไฟถล่ม"),
    description: t("A spell under Frostfire Inversion may widen its area by 5 ft for 1 more Momentum.",
      "เวทที่ใช้สลับไฟน้ำแข็งสามารถขยายพื้นที่ 5 ฟุต โดยใช้โมเมนตัมเพิ่ม 1"),
    tactic: t("Catch one more foe in the inverted blast, or keep Momentum for the next turn.", "ครอบคลุมศัตรูเพิ่ม หรือเก็บโมเมนตัมไว้เทิร์นหน้า"),
    requires: { evolutions: [{ class: "wizard", path: "ember-conduit", tier: 2 }], weaves: ["frostfire-inversion"] },
    cost: { momentum: 1 },
    effects: [{ kind: "areaDelta", feet: 5, when: { usingWeave: "frostfire-inversion" } }]
  }
];
