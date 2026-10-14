# Role&Roll Rules Reference

This document describes the rules exactly as the Role&Roll (RnR) system automates them in Foundry VTT. Values marked *(setting)* can be changed by the GM in **Game Settings → Configure Settings → Role&Roll**.

---

## 1. Attributes

Every character has nine attributes:

| Key | Attribute | Typical use |
|---|---|---|
| STR | Strength | Melee attacks and damage, heavy lifting |
| DEX | Dexterity | Ranged attacks, Initiative, Reflex |
| TGH | Toughness | Health, recovery from rest |
| INT | Intellect | Spell attacks, knowledge |
| APT | Aptitude | Practical talent, technical work |
| SAN | Sanity | Willpower |
| CHR | Charm | Social influence |
| RHT | Rhetoric | Argument and persuasion |
| EGO | Ego | Self-belief and resolve |

**Attribute modifier** = ⌊(rating − baseline) ÷ 2⌋.
The baseline is **8** *(setting: Attribute Baseline)*, so a rating of 8 gives +0, 10 gives +1, 12 gives +2, and 6 gives −1. Ratings below 1 count as 1.

## 2. Character Creation

1. Every attribute starts at **8**.
2. Spend **30 State Points** to raise attributes. Each point raises one attribute by 1. The State Point dialog keeps every rating between **8 and 20**.
3. Extra State Points:
   - **+2 per disabled organ**, when the optional disabled-organ rule is enabled for the character.
   - **+1 per Growth Point** the GM awards.
4. Choose an **Origin** (race), **Class** and **Background** from the Compendiums. Dropping one onto the sheet applies its bonuses. Replacing it removes the old bonuses first.
   - A **Background** gives +1 to two skills and a narrative benefit (contacts, access, know-how).
5. Spend **Extra Skill Points** in the **Extra Skill Shop** on the character sheet.

## 3. Derived Values

| Value | Formula |
|---|---|
| Health (max) | 10 + TGH modifier + Health bonuses from Extra Skills, + 2 per level gained |
| Willpower (max) | 8 + SAN modifier, + 1 every second level |
| Mental state | 0–18 track, starts at 9 |
| Initiative | 1d20 + DEX modifier |
| Speed | 30 ft base, plus bonuses from worn equipment and Extra Skills |
| Hit Dice | 3 by default; spent during a Short Rest |

A Health or Willpower maximum entered by hand on the sheet replaces the formula.

## 4. Checks

All checks roll **1d20 + modifiers** against a Difficulty set by the GM.

| Check | Modifiers |
|---|---|
| Attribute check | Attribute modifier |
| Saving throw | Attribute modifier |
| Skill check | Linked attribute modifier + skill rating + Extra Skill bonuses for that skill or attribute |

**Advantage / Disadvantage:** roll 2d20 and keep the higher (advantage) or lower (disadvantage) result. Shift-click a roll button to choose the mode.

**Condition penalties:** every active condition adds its roll penalty to attacks, defences and checks. Penalties default to 0. The GM sets them per condition.

## 5. Combat

### 5.1 Turn order
Initiative is **1d20 + DEX modifier**. Each character has **one Defence per turn**, or two with an Extra Skill whose name refers to defence, reaction or counter.

### 5.2 Attacking
**Attack roll = 1d20 + attribute modifier + item attack bonus + attack bonuses from worn equipment + Active Effect attack modifiers + condition penalties.**

- Weapons use their own attribute. Without one, melee weapons use STR, ranged weapons use DEX, and spells use INT.
- A **natural 20** on the kept die is a **critical hit**.
- A ranged weapon with ammunition must be loaded. An empty weapon prompts a reload instead of attacking.

**Range, line of sight and cover** are checked when a target is selected:

| Situation | Effect |
|---|---|
| Out of range or no line of sight | Attack is blocked (GM may override) |
| Long range | Modifier *(setting, default 0)* |
| Partial cover (1 wall) | Target +2 Reflex *(setting)* |
| Substantial cover (2 walls) | Target +4 Reflex *(setting)* |
| Total cover (3+ walls) | Attack blocked; +6 Reflex if allowed *(setting)* |

### 5.3 Defending
When an attack targets a character, its owner chooses one response on the Chat Card:

| Response | Roll | Notes |
|---|---|---|
| **Defend** | 1d20 + attack modifier of a weapon held in a usable hand | Requires a held weapon |
| **Dodge / Reflex** | 1d20 + DEX modifier + Reflex skill + Reflex bonuses | Always available |
| **Take the Hit** | none | Does not use the Defence |

- A defence **succeeds if its total is equal to or higher than** the attack total.
- A **natural 20 always succeeds**. A **natural 1 always fails**.
- A successful Defend or Dodge stops the attack. No damage button appears.
- **Counterattack:** a Dodge that *beats* the attack total (strictly higher) gives a one-use Counterattack button, but only if the defender holds a usable weapon and has not counterattacked this turn.

### 5.4 Damage
**Damage roll = weapon dice + attribute modifier + item damage bonus + worn damage bonuses + Active Effect damage modifiers.** Spells and abilities add their attribute modifier. Other items add only their own damage bonus.

On a **critical hit**, the number of every damage die doubles (for example, 2d6 becomes 4d6). Flat bonuses do not double.

Damage is applied in this order, and the Chat Card reports each step:

1. **Raw damage**
2. **minus Damage Reduction** = the actor's Armor DR + Armor Value of every worn armour and equipment piece, to a minimum of 0
3. **× damage-type multiplier**, in priority order:
   - **Immunity**: × 0
   - **Vulnerability**: × 2
   - **Resistance**: × ½ (rounded down)
   - The keyword `all` covers every damage type.

Each Chat Card can be applied **once per target**. Pressing Apply again does nothing. Only the target's owner or the GM can apply damage to it.

### 5.5 Healing
Healing ignores Damage Reduction and multipliers, and cannot raise Health above its maximum.

## 6. Down, Recovery and Death

- At **0 Health** a character is **Down**.
- Each round while Down, roll **1d20** for recovery against the Recovery DC (**10** *(setting)*):
  - **Natural 20** or **beating the DC by 10 or more**: 2 steps
  - **Meeting the DC**: 1 step
  - **Below the DC**: no progress
- After **2 steps** *(setting)* the character stands up with at least **1 Health** *(setting)*.
- Any healing above 0 Health also ends the Down state.
- After **3 rounds** Down without progress *(setting)* the GM is prompted to step in. **RnR never kills a character automatically.** Death is always the GM's decision.

## 7. Rest

| Rest | Effect |
|---|---|
| **Short Rest** | Spend Hit Dice: each restores **1d6 + TGH modifier** Health. Willpower recovers **half its maximum**. |
| **Long Rest** | Fully restores Health and Willpower, recovers Hit Dice and clears exhaustion. |

## 8. Advancement

- The XP needed to reach the next level is **current level × 300** (300 XP for level 2, then 600 more for level 3, and so on). A large award can cross several levels at once.
- Each level gained: **+2 maximum Health**, and **+1 maximum Willpower every second level**.
- The GM awards XP with **Grant Experience** on the sheet, and can award **Growth Points** (extra State Points) and **Extra Skill Points**.

## 9. Equipment

### 9.1 Hands
Weapons, tools, consumables and equipment can be held in the **left** or **right** hand. A **two-handed** item occupies both hands. A disabled hand cannot hold anything.

### 9.2 Worn equipment
Armour and wearable equipment go into **12 body slots**:

| | | |
|---|---|---|
| Head | Neck | Torso |
| Left Arm | Right Arm | Back |
| Left Hand | Right Hand | |
| Left Leg | Right Leg | |
| Left Foot | Right Foot | |

Each item lists the slots it may occupy. Worn items add their Armor Value to Damage Reduction, and add their attack, damage and speed bonuses.

## 10. Extra Skills

Extra Skills are bought with Extra Skill Points in the **Extra Skill Shop** on the character sheet. The shop lists every Extra Skill in any Item Compendium, including Compendiums the GM creates in the World.

- Filter by category, attribute, search text, or **Affordable only**.
- A purchase deducts the cost and adds the skill as an Item on the character.
- Bonuses apply automatically to the listed skill, skills or attribute.
- **Remove** in the Owned tab refunds the points and deletes the Item.

## 11. Mecha

1. A Pilot wearing the **Mecha Command Bracelet** gets an **Activate** button on the character sheet.
2. **Summon / Mecha Mode** places the chosen Mecha's Token next to the Pilot's Token and switches control to the Mecha.
3. **Return to Pilot** removes the Mecha Token and switches back. The Mecha Actor stays in the World.

Requirements: the Pilot's Token must be on the Scene, and the player must own a Vehicle Actor. Import frames from **RnR — Mecha Frames**:

| Frame | Role | Health | DR | Reflex | Speed |
|---|---|---|---|---|---|
| Aegis M-01 | Balanced field frame | 65 | 6 | 12 | 40 ft |
| Vanguard S-02 | Fast scout | 45 | 4 | 14 | 50 ft |
| Bastion H-03 | Heavy defender | 90 | 9 | 10 | 25 ft |
| Relay C-04 | Support, 2 crew | 55 | 5 | 12 | 35 ft |

## 12. GM Settings Summary

| Setting | Default | Effect |
|---|---|---|
| Campaign Setting Profile | Universal | Sheet theme and genre guidance |
| Attribute Baseline | 8 | Rating that counts as +0 |
| Long Range Modifier | 0 | Attack modifier at long range |
| Partial / Substantial / Total Cover | 2 / 4 / 6 | Reflex bonus from cover |
| Recovery DC | 10 | Recovery roll difficulty while Down |
| Recovery Steps Needed | 2 | Steps to stand back up |
| Escalation Rounds | 3 | Rounds Down before the GM is prompted |
| Health on Recovery | 1 | Minimum Health after standing up |

## 13. GM Decisions

The system automates arithmetic, not judgement. The GM always decides:

- Difficulty of checks, and when advantage or disadvantage applies.
- Whether to override range, line of sight or cover blocks.
- Roll penalties for conditions.
- When a Down character dies.
- XP, Growth Point and Extra Skill Point awards.
