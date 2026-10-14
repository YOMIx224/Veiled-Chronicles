import { existsSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";

const root = join(import.meta.dirname, "_source");
const stats = { systemId: "RnR", systemVersion: "0.3.6", coreVersion: "13" };
const common = (description) => ({
  description: { value: description, chat: "" }, quantity: 1, weight: 0,
  price: { value: 0, denomination: "gp" }, rarity: "common", handSlot: "",
  source: { book: "RnR Universal Collection", page: "" },
});
const id = (prefix, index) => `uni${prefix}${String(index).padStart(9, "0")}`;

function addToForty(folder, type, entries) {
  const dir = join(root, folder);
  const existing = readdirSync(dir).filter(file => file.endsWith(".json")).length;
  const needed = Math.max(0, 40 - existing);
  for (let index = 0; index < needed; index++) {
    const entry = entries[(existing + index) % entries.length];
    const document = {
      _id: id(folder.replace("rnr-", "").slice(0, 4), existing + index + 1),
      name: entry.name,
      type,
      img: entry.img,
      system: entry.system,
      flags: {},
      _stats: stats,
    };
    let filename = `${String(existing + index + 1).padStart(2, "0")}-${entry.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.json`;
    while (existsSync(join(dir, filename))) filename = `universal-${filename}`;
    writeFileSync(join(dir, filename), `${JSON.stringify(document, null, 2)}\n`);
  }
}

const skills = [
  ["Academic Focus", "science", "intellect", ["generalEducation", "history"]], ["Analyst", "investigation", "aptitude", ["search", "consider"]],
  ["Artisan", "arts", "dexterity", ["art", "craft"]], ["Athletic Training", "physical", "strength", ["athlete", "climb"]],
  ["Calm Presence", "other", "ego", ["consider", "empathy"]], ["Careful Crafting", "science", "dexterity", ["craft", "mechanical"]],
  ["Close Combat Training", "combat", "strength", ["brawl", "weapons"]], ["Composure", "other", "sanity", ["occult", "senseOfLie"]],
  ["Confident Speaker", "communication", "rhetoric", ["persuade", "intimidate"]], ["Covert Movement", "physical", "dexterity", ["stealth", "hideAndSneak"]],
  ["Cultural Knowledge", "academic", "intellect", ["history", "law"]], ["Defensive Footwork", "combat", "dexterity", ["reflex", "athlete"]],
  ["Digital Literacy", "science", "intellect", ["electronic", "search"]], ["Empathic Listener", "communication", "aptitude", ["empathy", "persuade"]],
  ["Field Repair", "science", "intellect", ["mechanical", "craft"]], ["First Responder", "science", "aptitude", ["firstAid", "medicine"]],
  ["Focused Aim", "combat", "dexterity", ["shootingWeapons", "throwing"]], ["Graceful Movement", "physical", "dexterity", ["athlete", "reflex"]],
  ["Hazard Sense", "investigation", "aptitude", ["perception", "survival"]], ["Insightful Observer", "investigation", "aptitude", ["perception", "senseOfLie"]],
  ["Legal Awareness", "academic", "intellect", ["law", "generalEducation"]], ["Linguistic Talent", "communication", "rhetoric", ["persuade", "generalEducation"]],
  ["Medicinal Knowledge", "science", "intellect", ["medicine", "herb"]], ["Mental Discipline", "other", "sanity", ["occult", "consider"]],
  ["Nimble Hands", "physical", "dexterity", ["larceny", "craft"]], ["Patient Researcher", "academic", "intellect", ["history", "search"]],
  ["Practical Survival", "physical", "aptitude", ["survival", "herb"]], ["Quick Reflexes", "combat", "dexterity", ["reflex", "brawl"]],
  ["Reliable Negotiator", "communication", "rhetoric", ["persuade", "bet"]], ["Resilient Body", "physical", "toughness", ["athlete", "survival"]],
  ["Ritual Study", "academic", "sanity", ["occult", "history"]], ["Sensible Planner", "other", "ego", ["consider", "search"]],
  ["Social Grace", "communication", "charm", ["empathy", "persuade"]], ["Steady Hands", "combat", "dexterity", ["swordPlay", "throwing"]],
  ["Streetwise", "investigation", "aptitude", ["larceny", "senseOfLie"]], ["Team Coordinator", "communication", "rhetoric", ["persuade", "empathy"]],
  ["Tool Proficiency", "science", "intellect", ["electronic", "mechanical"]], ["Unarmed Practice", "combat", "strength", ["brawl", "reflex"]],
  ["Versatile Performer", "arts", "charm", ["art", "persuade"]], ["Watchful Guard", "investigation", "aptitude", ["perception", "intimidate"]],
].map(([name, category, attribute, skillKeys]) => ({ name, img: "icons/skills/trades/trade-swordrock-purple.webp", system: { ...common(`+1 to ${skillKeys.join(" and ")} checks.`), category, attribute, cost: 1, bonus: 1, skills: skillKeys, effect: `+1 to ${skillKeys.join(" and ")} checks.`, properties: [] } }));
addToForty("rnr-extraskills", "extraskills", skills);

const weaponNames = ["Club","Dagger","Staff","Spear","Hatchet","Mace","Hammer","Short Sword","Long Sword","Battle Axe","War Pick","Morningstar","Glaive","Halberd","Whip","Rapier","Sabre","Greatsword","Maul","Throwing Knife","Javelin","Sling","Shortbow","Longbow","Crossbow","Heavy Crossbow","Hand Cannon","Light Pistol","Carbine","Rifle","Shotgun","Compact Launcher","Training Baton","Telescopic Staff","Utility Blade","Hooked Pole","Shield Bash","Chain Weapon","Practice Bow","Signal Flare Gun"];
addToForty("rnr-weapons", "weapon", weaponNames.map((name, i) => {
  const ranged = i >= 20;
  const firearm = i >= 26 && i <= 31;
  return { name, img: ranged ? "icons/weapons/guns/gun-pistol-worn.webp" : "icons/weapons/swords/sword-guard-bronze.webp", system: { ...common(`${name} suitable for any campaign that uses its profile.`), weaponType: ranged ? "ranged" : "melee", attribute: ranged ? "dexterity" : "strength", damageFormula: firearm ? "1d8" : i % 5 === 0 ? "1d8" : "1d6", damageType: firearm ? "piercing" : i % 3 === 0 ? "bludgeoning" : i % 3 === 1 ? "piercing" : "slashing", damageBonus: 0, attackBonus: 0, range: ranged ? (firearm ? "60/180 ft" : "30/120 ft") : "", reach: i === 12 || i === 13 || i === 35 ? 10 : 5, caliber: firearm ? "universal" : "", ammunition: firearm ? 6 : 0, ammunitionMax: firearm ? 6 : 0, reload: firearm ? "1 action" : "", handsRequired: [12,13,17,18,24,25,28,29,30,31,35].includes(i) ? 2 : 1, properties: [] } };
}));

const armorNames = ["Padded Vest","Travel Coat","Reinforced Jacket","Leather Armor","Layered Clothing","Mesh Shirt","Scale Vest","Brigandine","Protective Suit","Chain Shirt","Half Plate","Full Plate","Ballistic Vest","Hazard Suit","Ceremonial Guard","Field Uniform","Heavy Coat","Shield Buckler","Round Shield","Tower Shield","Helm","Visor","Arm Guards","Gloves","Boot Guards","Knee Guards","Shoulder Guard","Back Plate","Utility Belt","Protective Cloak","Riot Shield","Reflective Suit","Padded Hood","Explorer Harness","Body Shell","Combat Harness","Light Exosuit","Heavy Exosuit","Deflector Bracer","Ward Mantle"];
addToForty("rnr-armors", "armor", armorNames.map((name, i) => ({ name, img: "icons/equipment/chest/breastplate-layered-steel.webp", system: { ...common(`${name} provides reliable, setting-neutral protection.`), armorType: i >= 17 && i <= 19 || i === 30 ? "shield" : i > 34 ? "heavy" : i > 15 ? "medium" : "light", armorValue: i >= 17 && i <= 19 || i === 30 ? 2 : 1 + Math.floor(i / 12), maxDex: i > 34 ? 1 : i > 15 ? 2 : 99, strengthReq: i > 34 ? 12 : 0, speedBonus: 0, stealthDisadv: i > 34, equipmentSlot: i >= 17 && i <= 19 || i === 30 ? "hands" : [20,21,32].includes(i) ? "head" : [22,23].includes(i) ? "hands" : [24,25].includes(i) ? "feet" : [26,27].includes(i) ? "torso" : [28].includes(i) ? "waist" : [29,39].includes(i) ? "back" : "torso", properties: [] } })));

const equipmentNames = ["Backpack","Bedroll","Rope","Lantern","Compass","Map Case","Notebook","Writing Kit","Tool Kit","Repair Kit","First Aid Kit","Rations","Waterskin","Torch","Grappling Hook","Crowbar","Binoculars","Field Radio","Signal Mirror","Pocket Light","Protective Gloves","Travel Cloak","Utility Belt","Pouch","Lockbox","Tent","Cooking Set","Climbing Kit","Disguise Kit","Survey Kit","Data Pad","Multi-Tool","Handcart","Saddle Bags","Filter Mask","Rain Cover","Hearing Protection","Lens Kit","Emergency Beacon","Storage Case"];
addToForty("rnr-equipment", "equipment", equipmentNames.map((name, i) => ({ name, img: "icons/containers/bags/pack-simple-leather.webp", system: { ...common(`${name} is useful in exploration, travel, or problem-solving.`), equipType: i >= 20 ? "worn" : i === 32 || i === 33 ? "mount" : i === 8 || i === 9 || i === 10 || i === 26 || i === 27 || i === 28 || i === 29 || i === 30 || i === 31 ? "tool" : "gear", equipmentSlot: "", allowedSlot: "", prostheticFor: "", armorValue: 0, speedBonus: 0, attackBonus: 0, damageBonus: 0, carryBonus: 0, attribute: "", attributeBonus: 0, skill: "", bonus: 0, properties: [] } })));

const consumableNames = ["Bandage","Healing Draught","Stimulant","Antitoxin","Ration Pack","Water Purifier","Smoke Capsule","Glow Stick","Signal Flare","Repair Patch","Tool Charge","Battery Cell","Fuel Canister","Universal Ammunition","Arrow Bundle","Bolt Bundle","Throwing Blade Set","Fire Bomb","Flash Capsule","Adhesive Foam","Breathing Filter","Pain Reliever","Focus Tonic","Sleep Aid","Cold Pack","Heat Pack","Emergency Blanket","Scent Mask","Chalk Pack","Ink Refill","Lock Lubricant","Cleaning Kit","Rope Patch","Food Supplement","Medicine Dose","Energy Bar","Water Tablet","Spare Fuse","Data Chip","Sealant Tube"];
addToForty("rnr-consumables", "consumable", consumableNames.map((name, i) => ({ name, img: "icons/consumables/potions/potion-flask-corked-blue.webp", system: { ...common(`${name} is a single-use universal resource.`), quantity: i >= 13 && i <= 16 ? 20 : 1, consumableType: i >= 13 && i <= 16 ? "ammunition" : "supply", effect: i === 0 ? "Restore 1d4 Health." : i === 1 ? "Restore 2d4+2 Health." : `${name} provides its described utility.`, healingFormula: i === 0 ? "1d4" : i === 1 ? "2d4+2" : "", damageFormula: i === 17 ? "2d6" : "", damageType: i === 17 ? "fire" : "", caliber: i >= 13 && i <= 16 ? "universal" : "", isAmmunition: i >= 13 && i <= 16, uses: { value: 1, max: 1, per: "charges" }, properties: [] } })));

const abilityNames = ["Brace","Charge","Combat Focus","Covering Move","Defensive Stance","Disarm","Dodge Step","Encourage","Feint","First Response","Forceful Push","Guard","Improvised Tool","Inspiring Word","Keen Eye","Last Stand","Measured Strike","Mobile Defense","Parry","Quick Recovery","Rally","Ready Action","Resilient Mind","Resourceful","Second Effort","Shield Ally","Sprint","Steady Aim","Suppress","Take Cover","Tactical Assessment","Teamwork","Threaten","Tireless","Track Signs","Uncanny Timing","Unyielding","Versatile Action","Watchful","Withdraw"];
addToForty("rnr-abilities", "ability", abilityNames.map((name, i) => ({ name, img: "icons/skills/melee/shield-block-bash-blue.webp", system: { ...common(`${name} is a setting-neutral technique; resolve its narrative effect with the GM.`), abilityType: i % 4 === 0 ? "reaction" : i % 3 === 0 ? "passive" : "active", attribute: ["strength","dexterity","toughness","intellect","aptitude","sanity","charm","rhetoric","ego"][i % 9], effect: `${name}: gain an appropriate situational benefit when the GM agrees it applies.`, damageFormula: "", damageType: "", healingFormula: "", actionType: i % 4 === 0 ? "reaction" : "action", range: "Self", uses: { value: 0, max: 0, per: "" }, properties: [] } })));

const spellNames = ["Arcane Barrier","Beacon","Bind","Calm","Cleanse","Conceal","Detect","Distant Voice","Earth Grip","Elemental Bolt","Endure","Feather Step","Flame Spark","Force Pulse","Frost Veil","Guiding Light","Hasten","Healing Touch","Illusion","Inner Sight","Leap","Levitate","Mend","Mind Link","Mist Form","Protective Ward","Purify","Quiet Step","Renew","Restore","Reveal","Root","Scry","Shatter","Shielding Field","Silent Message","Sleep","Soothing Wave","Spark","Stone Skin"];
addToForty("rnr-spells", "spell", spellNames.map((name, i) => ({ name, img: "icons/magic/light/orb-shadow-blue.webp", system: { ...common(`${name} is a flexible supernatural, psychic, or technological effect.`), spellLevel: Math.floor(i / 5), school: "universal", attribute: ["intellect","aptitude","sanity","ego","rhetoric"][i % 5], castingTime: "1 action", range: i % 3 === 0 ? "Self" : "30 ft", duration: i % 4 === 0 ? "1 minute" : "instantaneous", effect: `${name}: resolve the described effect with the GM.`, damageFormula: [9,12,13,33,38].includes(i) ? "2d6" : "", damageType: [9,12,13,33,38].includes(i) ? "energy" : "", healingFormula: i === 17 || i === 28 || i === 29 ? "2d4+2" : "", saveAttribute: "", saveDC: 0, uses: { value: 0, max: 0, per: "" }, properties: [] } })));

const classNames = ["Adept","Adventurer","Agent","Analyst","Artisan","Athlete","Commander","Counselor","Courier","Craftsperson","Defender","Diplomat","Explorer","Guardian","Guide","Healer","Hunter","Innovator","Investigator","Leader","Medic","Negotiator","Operative","Performer","Pioneer","Protector","Researcher","Scout","Scholar","Sentinel","Specialist","Survivor","Tactician","Technician","Traveler","Troubleshooter","Vanguard","Veteran","Warden","Wayfinder"];
addToForty("rnr-classes", "class", classNames.map((name, i) => ({ name, img: "icons/sundries/documents/document-sealed-signatures-red.webp", system: { ...common(`${name} is a setting-neutral character role.`), role: name, hitDie: i % 4 === 0 ? "1d10" : i % 4 === 1 ? "1d8" : "1d6", subclass: "", features: `Core ${name} feature; choose campaign-appropriate specialization.` } })));

const originNames = ["Adaptable","Alert","Balanced","Bold","Calm","Caring","Cautious","Community Raised","Curious","Determined","Disciplined","Driven","Empathic","Enduring","Focused","Free Spirit","Gifted","Grounded","Hardy","Hopeful","Independent","Insightful","Inventive","Keen Senses","Learned","Lucky","Methodical","Observant","Patient","Pragmatic","Quick","Resilient","Resourceful","Social","Steadfast","Thoughtful","Tireless","Trained","Versatile","Worldly"];
addToForty("rnr-races", "race", originNames.map((name, i) => { const attribute = ["strength","dexterity","toughness","intellect","aptitude","sanity","charm","rhetoric","ego"][i % 9]; return { name: `${name} Origin`, img: "icons/environment/people/group.webp", system: { ...common(`${name} is a flexible origin that can represent culture, upbringing, lineage, training, or background.`), raceName: name, size: "med", speed: 30, traits: `Choose narrative details that explain this origin's ${attribute} aptitude.`, abilityScoreIncrease: { [attribute]: 1 }, languages: ["Common"] } }; }));

console.log("Universal source entries generated to a minimum of 40 per requested category.");
