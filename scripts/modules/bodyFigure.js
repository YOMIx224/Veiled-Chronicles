// =============================================================
//  bodyFigure.js — SVG body figure for equipment and organs
// =============================================================
// One figure serves both panels:
//   "equipment"  the 12 wear slots; worn parts glow gold, unusable parts red
//   "organs"     the same body plus senses and internal organs; disabled parts
//                are red, prosthetic replacements blue, and every organ is
//                clickable (data-organ) to toggle it in the picker
// The character faces the viewer, so their right side is drawn on the left.

// [region, label, svg shapes]. Order is paint order: later shapes sit on top.
const BODY_REGIONS = [
  ["back",      "Back",       `<path d="M33 57 L87 57 L93 134 L27 134 Z"/>`],
  ["rightArm",  "Right Arm",  `<rect x="21" y="58" width="13" height="60" rx="6.5"/>`],
  ["leftArm",   "Left Arm",   `<rect x="86" y="58" width="13" height="60" rx="6.5"/>`],
  ["rightHand", "Right Hand", `<circle cx="27.5" cy="126" r="8"/>`],
  ["leftHand",  "Left Hand",  `<circle cx="92.5" cy="126" r="8"/>`],
  ["rightLeg",  "Right Leg",  `<rect x="42" y="126" width="16" height="92" rx="7"/>`],
  ["leftLeg",   "Left Leg",   `<rect x="62" y="126" width="16" height="92" rx="7"/>`],
  ["rightFoot", "Right Foot", `<ellipse cx="47" cy="229" rx="13" ry="6"/>`],
  ["leftFoot",  "Left Foot",  `<ellipse cx="73" cy="229" rx="13" ry="6"/>`],
  ["torso",     "Torso",      `<rect x="37" y="55" width="46" height="74" rx="13"/>`],
  ["neck",      "Neck",       `<rect x="53" y="43" width="14" height="13" rx="3"/>`],
  ["head",      "Head",       `<ellipse cx="60" cy="26" rx="16" ry="19"/>`],
];

// Organ-only marks drawn on top of the body in "organs" mode.
const ORGAN_MARKS = [
  ["spine",    "Spine",       `<rect x="58.5" y="58" width="3" height="68" rx="1.5"/>`],
  ["lungs",    "Lungs",       `<ellipse cx="50" cy="79" rx="7" ry="11"/><ellipse cx="70" cy="79" rx="7" ry="11"/>`],
  ["heart",    "Heart",       `<circle cx="64" cy="85" r="4.5"/>`],
  ["liver",    "Liver",       `<ellipse cx="51" cy="100" rx="8" ry="5"/>`],
  ["stomach",  "Stomach",     `<ellipse cx="69" cy="101" rx="7" ry="5"/>`],
  ["kidneys",  "Kidneys",     `<ellipse cx="51" cy="113" rx="3.5" ry="5"/><ellipse cx="69" cy="113" rx="3.5" ry="5"/>`],
  ["rightEar", "Right Ear",   `<ellipse cx="43.5" cy="27" rx="2.6" ry="5"/>`],
  ["leftEar",  "Left Ear",    `<ellipse cx="76.5" cy="27" rx="2.6" ry="5"/>`],
  ["rightEye", "Right Eye",   `<circle cx="53" cy="23" r="2.8"/>`],
  ["leftEye",  "Left Eye",    `<circle cx="67" cy="23" r="2.8"/>`],
  ["smell",    "Smell",       `<ellipse cx="60" cy="31" rx="2.2" ry="3.2"/>`],
  ["voice",    "Voice",       `<circle cx="60" cy="50" r="3"/>`],
];

// Body parts that are also disabled-organ choices (limbs).
const LIMB_ORGANS = new Set(["rightArm", "leftArm", "rightHand", "leftHand", "rightLeg", "leftLeg", "rightFoot", "leftFoot"]);

const escape = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

function region(key, label, shapes, state, { organ = false } = {}) {
  const classes = ["rnr-fig-region", state ? `is-${state}` : ""].filter(Boolean).join(" ");
  const organAttr = organ ? ` data-organ="${key}" role="button" tabindex="-1"` : "";
  return `<g class="${classes}" data-region="${key}"${organAttr}><title>${escape(label)}${state ? ` — ${escape(state)}` : ""}</title>${shapes}</g>`;
}

/**
 * @param {"equipment"|"organs"} mode
 * @param {Record<string, string>} states  region/organ key → "equipped" | "unusable" | "disabled" | "prosthetic"
 * @returns {string} inline SVG markup
 */
export function bodyFigureSvg(mode, states = {}) {
  const organs = mode === "organs";
  const body = BODY_REGIONS.map(([key, label, shapes]) =>
    region(key, label, shapes, states[key] ?? "", { organ: organs && LIMB_ORGANS.has(key) })).join("");
  const marks = organs
    ? `<g class="rnr-fig-organs">${ORGAN_MARKS.map(([key, label, shapes]) => region(key, label, shapes, states[key] ?? "", { organ: true })).join("")}</g>`
    : "";
  return `<svg class="rnr-fig rnr-fig-${organs ? "organs" : "equipment"}" viewBox="0 0 120 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="${organs ? "false" : "true"}">${body}${marks}</svg>`;
}

export const BODY_FIGURE_REGIONS = BODY_REGIONS.map(([key]) => key);
export const BODY_FIGURE_ORGAN_MARKS = ORGAN_MARKS.map(([key]) => key);
