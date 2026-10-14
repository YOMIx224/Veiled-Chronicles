# RnR คู่มือ Combat และการใช้ Source Pack ทั้ง 360 รายการ

เอกสารนี้อธิบาย Combat Flow รุ่นล่าสุดของ RnR และวิธีนำ Source Pack ทั้ง 360 รายการมาผสมกันเป็นตัวละคร อาวุธ ความสามารถ และคอมโบที่ใช้งานได้ในทุก Campaign Setting

## 1. ภาพรวม Combat Flow

การโจมตีแบบมี Target ใช้ระบบสองขั้นเสมอ ผู้โจมตีเป็นคนกด **Attack Roll** และทอยค่าโจมตีก่อน ผู้โจมตีจะไม่เป็นคนเลือก Defend หรือ Dodge แทนเป้าหมาย

ลำดับคือ:

1. เลือก Token เป้าหมาย
2. เปิด Weapon หรือ Action ที่ใช้โจมตี
3. กด `Attack Roll`
4. ระบบทอย d20 + Attack Modifier
5. ระบบหักกระสุนทันที หากเป็นอาวุธที่ใช้กระสุน
6. ระบบส่ง Attack Challenge ลง Chat
7. ผู้เป็นเจ้าของ Target เลือก `Defend`, `Dodge / Reflex` หรือ `Take the Hit`
8. ระบบแสดงผล Hit หรือ Defense สำเร็จ
9. หากโจมตีโดน ผู้โจมตีกด `Damage Roll`
10. หาก Dodge สูงกว่าค่าโจมตี ระบบแสดง `Counterattack` ให้ผู้ป้องกัน

ถ้าไม่มี Target ระบบจะส่ง Attack Card ปกติและไม่แสดง Defense Challenge

## 2. สิทธิ์ของแต่ละ Chat Card

ระบบแยกสิทธิ์ตามหน้าที่ ไม่ได้ใช้สิทธิ์ของผู้สร้างข้อความกับทุกปุ่ม

| การกระทำ | ผู้มีสิทธิ์ |
|---|---|
| Attack Roll | ผู้โจมตีหรือผู้สร้างการ์ดโจมตี |
| Defend | เจ้าของ Target Actor หรือ GM |
| Dodge / Reflex | เจ้าของ Target Actor หรือ GM |
| Take the Hit | เจ้าของ Target Actor หรือ GM |
| Damage Roll | ผู้โจมตี |
| Apply Damage | ผู้สร้าง Damage Card หรือ GM |
| Counterattack | เจ้าของ Defender Actor หรือ GM |

ผู้เล่นอื่นจะเห็นปุ่มเป็น Disabled การเปิด Chat Card ซ้ำหรือกดปุ่มด้วยสิทธิ์ผิดคนจะไม่ทำให้เกิดการทอย

## 3. Defend

Defend ใช้ Attack Roll ของ Weapon ที่อยู่ในมือเพื่อป้องกันการโจมตี ระบบจะค้นหา Weapon ที่อยู่ใน `left hand` หรือ `right hand` และตรวจว่า Organ หรือ Slot นั้นใช้งานได้

ถ้า Weapon Roll ได้ค่าเท่ากับหรือสูงกว่าค่า Attack ของผู้โจมตี การโจมตีหยุดทันทีและไม่สามารถกด Damage Roll ได้

ถ้า Target ไม่มี Weapon ที่ใช้ป้องกันได้ ปุ่ม Defend จะไม่ปรากฏ เหลือ Dodge / Reflex และ Take the Hit

การใช้ Defend จะนับเป็น Defense Reaction ของเทิร์นนั้น โดยค่าเริ่มต้นใช้ได้ 1 ครั้งต่อเทิร์น Extra Skill ที่เพิ่ม Defense หรือ Reaction สามารถเพิ่มจำนวนครั้งได้ตามการตั้งค่าของ Campaign

## 4. Dodge / Reflex

Dodge ใช้ Reflex Roll:

```text
d20 + Dexterity Modifier + Reflex Skill + Bonus จาก Effect - Condition Penalty
```

ถ้าผล Reflex เท่ากับหรือสูงกว่าค่า Attack การโจมตีไม่โดน

ถ้าผล Reflex **สูงกว่า** ค่า Attack ระบบจะเปิด Counterattack ให้ผู้ป้องกันหนึ่งครั้ง หากยังไม่เคยใช้ Counterattack ในเทิร์นนั้นและมี Weapon ที่ใช้โจมตีได้

ถ้า Reflex เท่ากับค่า Attack จะหลบได้ แต่ไม่เข้าเงื่อนไข Counterattack แบบผลสูงกว่า

## 5. Take the Hit

Take the Hit ใช้เมื่อผู้ถูกโจมตีไม่ต้องการใช้ Defense Reaction หรือไม่สามารถป้องกันได้ ระบบจะถือว่าการโจมตีโดนและส่ง Damage Roll ให้ผู้โจมตี

Take the Hit ไม่ใช้ Defense Slot แต่ Challenge เดิมจะถูกล็อกทันทีเพื่อป้องกันการกดซ้ำ

## 6. Damage และ Critical

หลังแก้ Attack Challenge และตัดสินแล้วว่าโดน ผู้โจมตีจึงจะเห็น Damage Roll โดยส่งผลทอยฉบับเต็มแบบ private ถึงผู้โจมตีและ GM เท่านั้น

ถ้า Attack เป็น Critical ระบบจะส่งสถานะ Critical ไปยัง Damage Card ด้วย และใช้ Critical Damage Formula ของ Weapon หรือ Ability แทนการทอยปกติ

ลำดับ Damage ที่ใช้กับ Target คือ:

1. Raw Damage
2. ลดด้วย Armor Damage Reduction จนต่ำสุดเป็นศูนย์
3. ใช้ Resistance, Immunity หรือ Vulnerability
4. ปรับผลจาก Condition หรือ Effect
5. ลดหรือเพิ่ม Health

เมื่อ Damage Roll มาจาก Attack Challenge ระบบส่งการ์ด Apply แบบไม่แสดงจำนวนหรือสูตรให้เจ้าของ Actor เป้าหมายและ GM แยกต่างหาก ปุ่มผูกกับ Actor ที่ถูกโจมตีจริง ไม่ใช้ Token ที่ผู้คลิกเลือกไว้ และใช้ได้เฉพาะเจ้าของ Actor หรือ GM การใช้ซ้ำถูกบันทึกต่อ Actor เพื่อไม่ต้องแก้ ChatMessage ที่ผู้เล่นอื่นเป็นผู้สร้าง ส่วน Damage Roll ที่สร้างแบบไม่มี Attack Challenge ยังเป็นการ์ดทั่วไปและใช้เป้าหมายที่ผู้เล่นเลือกอยู่

## 7. Counterattack

เมื่อ Defender เลือก Dodge และ Reflex สูงกว่าค่า Attack ระบบจะสร้าง Counterattack Button โดยเก็บข้อมูลสำคัญไว้ครบ:

- Actor ของ Defender
- Weapon ที่ใช้ Counterattack
- Actor เดิมของผู้โจมตี
- ผู้มีสิทธิ์กด Counterattack

เมื่อกด Counterattack ระบบจะ Target Token ของผู้โจมตีเดิมอัตโนมัติ แล้วทำ Attack Roll ใหม่ตาม Combat Flow เดิม ผู้โจมตีเดิมจะได้รับ Defense Challenge ใหม่และเลือก Defend / Dodge / Take the Hit ของตนเอง

Counterattack ไม่ข้าม Defense ของอีกฝ่าย และไม่ทำ Damage อัตโนมัติ

## 8. การป้องกันการกดซ้ำ

ทุก Defense Challenge มี `challengeId` ของตัวเอง เมื่อมีผู้เลือกคำตอบ ระบบบันทึก `lastChallengeId` ลงใน `system.combatDefense`

ผลคือ:

- Defend และ Dodge เลือกซ้ำไม่ได้
- Take the Hit เลือกซ้ำไม่ได้
- เปิด Chat Card หลายหน้าต่างก็ไม่ทำให้เกิดผลซ้ำ
- เริ่มเทิร์นใหม่จะล้าง Challenge Lock
- Defense และ Counterattack ถูกนับแยกตามรอบ Combat

## 9. การใช้ Active / Passive / Reaction Feature

Feature Mode อ่านจากข้อมูลตามลำดับที่ยืดหยุ่น:

```text
abilityType
activationType
featureType
mode
actionType
```

ระบบรองรับ:

- `ACTIVE`: ใส่ Active Bar ได้ สูงสุด 8 ช่อง
- `PASSIVE`: แสดงเป็นผลถาวร ไม่กิน Active Slot
- `REACTION`: แสดงเป็นความสามารถตอบสนอง ไม่กิน Active Slot และใช้เมื่อกฎอนุญาต

Active Bar รองรับ:

- Spell
- Ability
- Extra Skill ที่มี Mode เป็น Active

Class, Background, Origin และ Passive/Reaction Feature จะไม่ถูกใส่ Active Bar โดยอัตโนมัติ

## 10. Source Pack ทั้ง 360 รายการ

Source Pack ที่มีในระบบมี 9 หมวด หมวดละ 40 รายการ:

| หมวด | จำนวน | ใช้เป็น |
|---|---:|---|
| Weapons | 40 | อาวุธประชิด ระยะไกล หรือเทคโนโลยี |
| Armor | 40 | เกราะ โล่ ชุดป้องกัน หรือพลังป้องกัน |
| Equipment | 40 | เครื่องมือ อุปกรณ์ Implant หรือ Gadget |
| Consumables | 40 | ยา กระสุน แบตเตอรี่ สารเคมี หรือทรัพยากรใช้แล้วหมด |
| Abilities | 40 | ท่า เทคนิค พลัง หรือ Action พิเศษ |
| Spells | 40 | เวทมนตร์ Psychic Program หรือ Superpower |
| Extra Skills | 40 | Training, Perk, Implant, Passive หรือ Reaction |
| Classes | 40 | Class, Role, School, Crew หรือ Organization |
| Origins | 40 | Species, Culture, Nation, Faction หรือ Background |

ทุกรายการถูกกำหนดเป็น Universal และมี Description เพื่อให้ใช้ร่วมกับ Setting อื่นได้

## 11. วิธีตั้งค่าคอมโบระหว่าง Source Pack

### 11.1 คอมโบพื้นฐาน

สร้างตัวละครแล้วเลือก:

```text
Origin 1 รายการ
Class 1 รายการ
Weapon 1–2 รายการ
Armor 1 รายการ
Equipment ตามความเหมาะสม
Ability หรือ Spell ตามบทบาท
Extra Skill ตามจุดเด่น
```

ตัวอย่าง:

```text
Origin: Urban Survivor
Class: Scout
Weapon: Light Pistol
Armor: Reinforced Jacket
Equipment: Toolkit
Ability: Feint
Extra Skill: Alertness (Passive)
Extra Skill: Uncanny Timing (Reaction)
```

คอมโบนี้สร้างตัวละครสาย Scout ที่มีโบนัสการเอาตัวรอด มี Passive Perception และมี Reaction สำหรับจังหวะสำคัญ

### 11.2 คอมโบสายโจมตี

```text
Class: Soldier / Duelist / Hunter
Weapon: Weapon ที่มี Attack และ Damage
Armor: Armor ที่มี Damage Reduction
Ability: Active Damage หรือ Control
Extra Skill: Active Attack Booster
Extra Skill: Reaction Counter หรือ Defensive Timing
```

ใช้ Active Ability ใน Active Bar ไม่เกิน 8 ช่อง และใช้ Reaction แยกตามจังหวะ ไม่ต้องกิน Slot ของ Active Bar

### 11.3 คอมโบสายป้องกัน

```text
Class: Guardian / Defender
Armor: Armor ที่มี DR สูง
Weapon: Weapon ที่อยู่ในมือและใช้ Defend ได้
Extra Skill: Passive Toughness
Extra Skill: Reaction Defensive Training
Ability: Active Barrier หรือ Guard
```

เมื่อถูกโจมตี ให้เลือก Defend หาก Attack Weapon มีค่าเหมาะสม หรือเลือก Dodge หาก Reflex สูงกว่า

### 11.4 คอมโบสาย Counterattack

```text
Origin: Agile / Street / Martial Origin
Class: Duelist / Scout
Weapon: One-handed Weapon
Ability: Feint หรือ Riposte
Extra Skill: Reaction Timing
Extra Skill: Passive Reflex Training
```

แนวทางการใช้:

1. รอให้ฝ่ายตรงข้ามโจมตี
2. เลือก Dodge / Reflex
3. ทอยให้สูงกว่าค่า Attack
4. กด Counterattack
5. ระบบ Target ผู้โจมตีเดิม
6. ผู้โจมตีเดิมเลือก Defense

### 11.5 คอมโบสายเวทหรือพลังพิเศษ

```text
Origin: Mystical / Mutant / Psionic
Class: Mage / Scholar / Adept
Equipment: Focus / Catalyst / Device
Spell: Attack, Control หรือ Defense
Ability: Utility หรือ Movement
Extra Skill: Passive Knowledge
Extra Skill: Reaction Escape
```

Spell สามารถ Reskin เป็น:

- เวทมนตร์
- Psychic Power
- Nanotech
- Program
- Mutation
- Superpower

### 11.6 คอมโบ Vehicle และ Mecha

```text
Vehicle Actor: Mecha หรือ Vehicle
Weapon: Mounted Weapon
Armor: Plating หรือ Shield
Equipment: Engine, Sensor, Repair Kit
Ability: Boost, Eject, Barrier หรือ Grapple
Extra Skill: Pilot Training / Reaction Maneuver
```

สามารถแยก Pilot Actor และ Mecha Actor ได้ โดย Pilot ใช้ Skill และ Extra Skill ของตนเอง ส่วน Mecha ใช้ Weapon, Armor, Equipment และ Ability ของ Vehicle Actor

## 12. วิธีผสมทุก Pack โดยไม่ทำให้ระบบขัดกัน

ให้แยกบทบาทของแต่ละ Pack:

- Origin กำหนดตัวตนและพื้นฐาน
- Class กำหนดบทบาท
- Weapon กำหนด Attack และ Damage
- Armor กำหนด Damage Reduction
- Equipment เพิ่มเครื่องมือหรือ Modifier
- Consumable สร้างทรัพยากรชั่วคราว
- Ability สร้าง Action หรือพลังเฉพาะ
- Spell ใช้เป็นพลังที่มี Damage หรือ Effect
- Extra Skill เพิ่ม Passive, Active หรือ Reaction

ควรหลีกเลี่ยงการใส่ Modifier เดิมซ้ำหลายช่องโดยไม่ตั้งใจ เช่น Bonus เดียวกันถูกเพิ่มทั้งจาก Class, Extra Skill และ Active Effect หากต้องการให้ซ้อนกัน ให้เขียนชื่อและแหล่งที่มาให้ชัดเจนใน Description

## 13. Checklist ก่อนเล่นจริง

ตรวจสอบว่า:

- ทุกผู้เล่นมี Token ที่ถูกต้อง
- ผู้โจมตีเลือก Target แล้ว
- ผู้โจมตีเป็นเจ้าของ Weapon หรือ Ability
- ผู้ถูกโจมตีเป็นเจ้าของ Target Actor
- Weapon ป้องกันถูกใส่อยู่ในมือ
- Reflex Skill และ Dexterity ถูกตั้งค่าแล้ว
- Active Bar ไม่เกิน 8 ช่อง
- Passive และ Reaction ไม่ถูกลากเข้า Active Bar
- ผู้เล่นเห็น Chat Card ของกันและกัน
- GM มีสิทธิ์ Override หาก Actor ไม่มีเจ้าของ
- ทดสอบ Attack → Defense → Damage ก่อนเริ่ม Session

## 14. การทดสอบสองผู้เล่น

ให้เปิด Foundry ด้วยผู้ใช้สองคน:

**Player A** ใช้ Actor A เป็นผู้โจมตี และ **Player B** ใช้ Actor B เป็นเป้าหมาย

1. Player A เลือก Token B
2. Player A กด Attack Roll
3. ตรวจว่า Player A ไม่เห็น Dialog ให้เลือก Defend หรือ Dodge
4. ตรวจว่า Player B เห็น Defense Challenge
5. Player A ต้องไม่สามารถกด Defend แทน Player B
6. Player B กด Dodge
7. ตรวจว่า Player A เห็นผล Attack แต่ไม่สามารถเลือก Defense แทน
8. หาก Reflex สูงกว่า Attack ให้ Player B เห็น Counterattack
9. Player B กด Counterattack
10. ตรวจว่า Target เปลี่ยนเป็น Token A
11. Player A ได้รับ Defense Challenge ใหม่
12. Player B ต้องไม่สามารถเลือก Defense ของ Player A
13. เมื่อ Attack โดน มีเพียง Player A และ GM ที่เห็นสูตร/ผล Damage Roll; เจ้าของ Actor เป้าหมายได้รับเฉพาะการ์ด Apply ที่ไม่แสดงจำนวนหรือสูตร
14. ตรวจว่า Critical Damage ใช้ Formula แบบ Critical
15. ตรวจว่าปุ่ม Apply ผูกกับ Actor ที่ถูกโจมตีจริง แม้ผู้คลิกเลือก Token อื่นอยู่
16. ลองเปิด Chat Card ซ้ำและกดปุ่มเดิม ต้องไม่เกิดผลซ้ำ

## 15. ขอบเขตการยืนยันผล

สคริปต์ Audit ของ RnR ตรวจ Manifest, Source Pack, Duplicate ID, Feature Mode, Permission Routing และจำลอง Protocol ของผู้เล่นสองคนได้ แต่ไม่สามารถแทนการเปิด Foundry แบบสอง Browser Session ได้ทั้งหมด

การยืนยัน Multiplayer ขั้นสุดท้ายควรทำใน Foundry จริงด้วยผู้ใช้สองบัญชีและ Token สองตัวตาม Checklist ในหัวข้อ 14
