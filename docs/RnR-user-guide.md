# คู่มือการใช้งาน Role & Roll (RnR)

คู่มือนี้อธิบายการติดตั้ง การสร้างตัวละคร การใช้ ID Card, Feature, Active Ability, การโจมตี การป้องกัน การหลบ การสวนกลับ Damage Reduction และการใช้งาน NPC / Vehicle / Mecha ในระบบ RnR สำหรับ Foundry VTT

---

## 1. การติดตั้งระบบ

1. สำรองโฟลเดอร์ระบบเดิมก่อนติดตั้ง
2. แตกไฟล์ `RnR-updated-v3.zip`
3. นำโฟลเดอร์ `RnR` ไปวางแทนที่:

```text
C:\Users\User\AppData\Local\FoundryVTT\Data\systems\RnR
```

4. เปิด Foundry VTT
5. Reload World หรือปิดแล้วเปิด World ใหม่
6. ตรวจสอบว่า System RnR ถูกเปิดใช้งานใน World

> หากยังเห็น UI แบบเก่า ให้ปิดหน้าต่าง Actor Sheet แล้วเปิดใหม่ หรือรีสตาร์ต Foundry อีกครั้ง

---

## 2. แนวคิดหลักของระบบ

RnR ใช้แนวคิดดังนี้:

- Attribute เป็นค่าหลักของตัวละคร
- Modifier คำนวณจาก Attribute Baseline
- Skill เพิ่ม Modifier จาก Attribute และค่าของ Skill
- Item, Armor, Extra Skill และ Active Effect สามารถเพิ่มโบนัสได้
- การโจมตีใช้ d20 + Attack Modifier
- ผู้ถูกโจมตีมีสิทธิ์เลือก Defense หรือ Dodge
- Damage Reduction ลดความเสียหายก่อน Resistance / Immunity / Vulnerability
- Campaign Setting เปลี่ยนธีมและการนำเสนอ แต่ไม่บังคับให้กฎหลักเปลี่ยนตาม Setting

---

## 3. Attribute และ Modifier

สูตรพื้นฐาน:

```text
Modifier = floor((Attribute - Attribute Baseline) / 2)
```

ค่าเริ่มต้นของ Attribute Baseline คือ 8

ตัวอย่าง:

| Attribute | Modifier |
|---:|---:|
| 8 | +0 |
| 9 | +0 |
| 10 | +1 |
| 12 | +2 |
| 6 | -1 |
| 4 | -2 |

หาก GM เปลี่ยน Attribute Baseline ใน World Settings ระบบจะคำนวณ Modifier ใหม่ทั้งระบบโดยไม่แก้ค่าพื้นฐานของตัวละคร

### Skill Roll

```text
d20 + Attribute Modifier + Skill Bonus + Extra Skill Bonus
```

### Initiative

```text
d20 + Dexterity Modifier
```

---

## 4. การสร้างตัวละคร

เมื่อสร้าง Character ใหม่ ระบบจะทำสิ่งต่อไปนี้:

- สร้าง Identification Number 13 หลักแบบสุ่ม
- ตรวจไม่ให้เลขซ้ำกับ Actor อื่นใน World
- เพิ่ม Unarmed Strike ให้มือซ้ายและมือขวา หากยังไม่มีอาวุธ
- ตั้งค่า Health, Willpower และ Mental ตาม Attribute
- ตั้งค่า Extra Skill Point และ Growth Point เริ่มต้น

### ข้อมูล Identity

ช่องหลักที่ใช้ในระบบ:

- Gender
- Age
- Date of Birth
- Identification No.
- Address
- Birthplace
- Origin

Date of Birth ใช้รูปแบบ:

```text
YYYY-MM-DD
```

ตัวอย่าง:

```text
2026-09-28
```

Identification No. ต้องเป็นตัวเลข 13 หลัก ระบบจะตัดอักขระอื่นออกและป้องกันเลขซ้ำเมื่อบันทึก

### ช่องสวมใส่บน Actor Sheet

อุปกรณ์สวมใส่แสดงเป็นผัง 3 คอลัมน์ตามตำแหน่งของร่างกาย ผู้เล่นเลือกช่องผ่าน dropdown หรือลาก Item ไปวางในช่องที่ต้องการ:

| แถว | ซ้าย | กลาง | ขวา |
|---|---|---|---|
| ศีรษะและคอ | — | Head | — |
|  | — | Neck | — |
| แขนและลำตัว | Right Arm | Torso | Left Arm |
| มือและหลัง | Right Hand | Back | Left Hand |
| ขา | Right Leg | — | Left Leg |
| เท้า | Right Foot | — | Left Foot |

รวมทั้งหมด 12 ช่อง: Head, Neck, Torso, Back, Right/Left Arm, Right/Left Hand, Right/Left Leg และ Right/Left Foot. ค่า slot แบบเก่า เช่น `hands`, `feet`, `ring` และ `waist` จะถูกแปลงเป็นช่องที่ยังว่างเพื่อแสดงผลระหว่างเตรียมชีต โดยไม่เขียนทับข้อมูลต้นฉบับ; หากต้องการระบุตำแหน่งแน่นอน ให้เลือกช่องซ้ายหรือขวาโดยตรง.

---

## 5. ID Card

กดปุ่ม **ID Card** ใน Biography เพื่อเปิดบัตรประจำตัว

ID Card แสดง:

- Portrait
- ชื่อตัวละคร
- Origin
- Gender
- Age
- Date of Birth
- Identification No.
- Address
- Birthplace
- Source of Willpower ถ้ามี
- Disabled Areas ถ้ามี

ช่องที่ยังไม่มีข้อมูลจะแสดงเป็น `—` เพื่อให้เห็นว่าช่องนั้นมีอยู่จริงและยังไม่ได้กรอก

### ID Card ใน Chat

เมื่อเปิด ID Card ระบบจะส่งข้อมูล Identity ไปยัง Chat ด้วย โดยปรับขนาดให้พอดีกับช่อง Chat และไม่ล้นกรอบ

### NPC และ Vehicle

NPC และ Vehicle มีปุ่ม ID Card เช่นเดียวกับ Character และสามารถกรอกข้อมูล Identity ได้จาก Biography

สำหรับ Vehicle / Mecha แนะนำให้ใช้:

- **Model**, **Manufacturer** และ **Serial Number** เป็นช่องแยกในส่วน Vehicle / Mecha
- Origin และ Identification No. ยังใช้บันทึกข้อมูล identity อื่นได้ตามต้องการ
- Address เป็นสถานที่เก็บหรือฐานปฏิบัติการ
- Birthplace เป็นสถานที่ผลิต

---

## 6. Biography

Biography แบ่งเป็นส่วนหลัก:

- Identity
- Background
- Willpower & State
- Personality & Story
- Notes

ข้อมูลข้อความจะบันทึกระหว่างพิมพ์ด้วยระบบ debounce และบันทึกซ้ำเมื่อเปลี่ยนช่องหรือออกจากช่อง เพื่อป้องกันข้อมูลหายเมื่อ Sheet re-render

---

## 7. Feature และ Ability

Feature จะแสดงป้ายประเภทชัดเจน:

### ACTIVE

ความสามารถที่ผู้เล่นต้องกดใช้หรือเตรียมไว้ใน Active Bar

- ใส่ Active Bar ได้
- มีปุ่ม Make Ready
- ใช้ผ่านปุ่ม Use
- จำกัดจำนวน Active Ability สูงสุด 8 ช่อง

### PASSIVE

ความสามารถที่ทำงานตลอดเวลาหรือเป็นโบนัสติดตัว

- ไม่ต้องใส่ Active Bar
- ไม่ควรใช้ปุ่ม Use แบบ Active
- โบนัสควรถูกคำนวณจาก Item หรือ Active Effect ตามข้อมูลของ Ability

### REACTION

ความสามารถที่ใช้ตอบสนองต่อเหตุการณ์ระหว่างเทิร์นของผู้อื่น

ตัวอย่าง:

- ป้องกันการโจมตี
- เพิ่ม Reflex
- ลด Damage
- ใช้สวนกลับ

Reaction จะไม่ถูกนับเป็น Active Ability ปกติ และไม่ควรใช้ช่อง Active Bar เป็นที่เก็บหลัก

### การใส่ Active Ability

1. เปิดแท็บ Features
2. ลาก Spell หรือ Ability ที่เป็น ACTIVE ไปยัง Active Bar
3. หรือกด Make Ready
4. เมื่อครบ 8 ช่อง ระบบจะแจ้งเตือนและไม่ให้ใส่เพิ่ม
5. กด Put Away เพื่อนำออกจาก Active Bar

---

## 8. การโจมตี

### ขั้นตอน

1. เลือก Token ของผู้โจมตี
2. เลือก Target Token
3. เปิด Backpack หรือ Item Card
4. กด Attack ที่อาวุธในมือ
5. เลือก Normal, Advantage หรือ Disadvantage
6. ระบบทอย Attack
7. ผู้ถูกโจมตีเลือก Defense หรือ Dodge
8. ระบบสรุปผลใน Chat
9. ปุ่ม Damage จะแสดงเฉพาะเมื่อโจมตีโดนจริง

### Attack Roll

```text
d20 + Attribute Modifier + Weapon Attack Bonus + Equipment Bonus + Global Modifier
```

ถ้าเป็นอาวุธประชิดโดยทั่วไปจะใช้ Strength
ถ้าเป็นอาวุธระยะไกลโดยทั่วไปจะใช้ Dexterity

---

## 9. Defense และ Dodge

เมื่อถูกโจมตี ผู้ถูกโจมตีสามารถเลือกได้ 3 ทาง:

### 9.1 Defend

ใช้ Attack ของอาวุธที่ถืออยู่ในมือ

```text
d20 + Attack Modifier ของอาวุธ
```

ผล d20 ธรรมชาติ **20 สำเร็จอัตโนมัติ** และ **1 ล้มเหลวอัตโนมัติ** โดยไม่สนผลรวมหลังบวก modifier

ถ้าผลรวม Defense **เท่ากับหรือสูงกว่า** Attack Total:

- การโจมตีถูกหยุด
- ไม่ได้รับ Damage
- ไม่แสดงปุ่ม Damage Roll
- ใช้สิทธิ์ Defense ของเทิร์นนั้น

หากมีอาวุธหลายชิ้นในมือ ระบบเลือกอาวุธที่พร้อมใช้ในมือก่อน หากต้องการความละเอียดมากขึ้น GM ควรเลือกอาวุธให้ถูกต้องก่อนเริ่มการป้องกัน

### 9.2 Dodge

ใช้ Reflex Roll

```text
d20 + Dexterity Modifier + Reflex Skill + Reflex Effect
```

ผล d20 ธรรมชาติ **20 สำเร็จอัตโนมัติ** และ **1 ล้มเหลวอัตโนมัติ** โดยไม่สนผลรวมหลังบวก modifier

ถ้าผลรวม Reflex **เท่ากับหรือสูงกว่า** Attack Total:

- หลบสำเร็จ
- ไม่ได้รับ Damage
- ไม่แสดงปุ่ม Damage Roll

ถ้า Reflex **สูงกว่า** Attack Total:

- หลบสำเร็จ
- ได้สิทธิ์ Counterattack
- Counterattack ใช้ได้ 1 ครั้งต่อเทิร์น
- หากไม่มีอาวุธในมือ จะไม่แสดงปุ่ม Counterattack

### 9.3 Take the Hit

ผู้ถูกโจมตีสามารถเลือกไม่ใช้ Defense และ Dodge ได้

ผลคือ:

- การโจมตีดำเนินต่อ
- หากเข้าเงื่อนไขจะทอย Damage ได้
- ไม่ใช้สิทธิ์ Defense

---

## 10. Reaction และจำนวนครั้งต่อเทิร์น

ระบบเก็บสถานะไว้ที่ Actor:

- Defense ใช้ไปกี่ครั้ง
- Counterattack ถูกใช้หรือยัง
- รอบการต่อสู้ปัจจุบัน

เมื่อเริ่มเทิร์นของ Actor ระบบจะรีเซ็ต:

```text
Defense Used = 0
Counterattack Used = false
```

Extra Skill ที่มีชื่อเกี่ยวข้องกับคำต่อไปนี้จะเพิ่ม Defense ได้อีก 1 ครั้ง:

- Defense
- Defend
- Reaction
- Counter

GM ควรตั้งชื่อ Extra Skill ให้สื่อความหมายชัดเจน เช่น:

```text
Extra Reaction
Second Defense
Combat Counter
```

---

## 11. Counterattack

Counterattack เกิดเมื่อ:

1. ผู้ถูกโจมตีเลือก Dodge
2. Reflex Total สูงกว่า Attack Total
3. มีอาวุธที่พร้อมใช้ในมือ
4. ยังไม่ใช้ Counterattack ในเทิร์นนั้น

กดปุ่ม **Counterattack** ใน Attack Chat Card เพื่อทอยโจมตีสวนกลับ

ระบบจะ:

- ใช้อาวุธที่ผูกไว้กับการป้องกัน
- จำกัดให้ใช้ครั้งเดียวต่อเทิร์น
- ปิดปุ่มหลังใช้งาน

GM ควรตรวจสอบ Target ใหม่ก่อนสวนกลับ หากการสวนกลับต้องใช้ Target ที่ต่างจาก Target เดิม

---

## 12. Damage และ Damage Reduction

ลำดับการคำนวณ:

```text
Raw Damage
→ ลบ Damage Reduction
→ Resistance / Immunity / Vulnerability
→ Final Damage
```

ตัวอย่าง:

```text
Raw Damage = 9
Damage Reduction = 3
หลังลด DR = 6
Resistance x0.5
Final Damage = 3
```

Damage Reduction มาจาก:

- Armor ที่สวมใส่
- Equipment ที่ให้ Armor Value
- Active Effect ที่เพิ่ม `armorDamageReduction`
- ค่า Defense ของ NPC / Vehicle ตามระบบ

หน้า Main แสดงค่า:

```text
DAMAGE REDUCTION: DR X
```

เมื่อกด Apply Damage ระบบจะแจ้งรายละเอียด:

```text
Raw - DR = หลังลดเกราะ
หลังลดเกราะ × ตัวคูณ = Final Damage
```

---

## 13. Resistance, Immunity และ Vulnerability

- Resistance: คูณความเสียหายด้วย 0.5
- Immunity: คูณความเสียหายด้วย 0
- Vulnerability: คูณความเสียหายด้วย 2

ระบบรองรับการใส่หลายประเภทโดยคั่นด้วย comma, space หรือ semicolon เช่น:

```text
fire, cold, lightning
```

หรือ:

```text
physical; slashing
```

---

## 14. NPC และ Vehicle / Mecha

NPC Sheet รองรับ:

- Attribute Modifier
- Skill Modifier
- Permanent Modifier
- Reflex
- Armor DR
- Speed
- Actions
- ID Card
- Identity และ Description

Vehicle / Mecha ใช้ข้อมูล Defense เช่น:

- Reflex Defense
- Armor DR
- Speed
- Cover
- Handling
- Crew
- Passengers
- Cargo
- Weapon Systems

หาก Campaign ใช้ Mecha Setting ระบบจะแสดง Vehicle ในบริบท Mecha แต่ยังใช้โครงสร้าง Actor ประเภท Vehicle เดิมเพื่อไม่ทำให้ข้อมูลเก่าเสียหาย

### เรียกหุ่นด้วย Command Bracelet

- เมื่อ GM เรียกหุ่นให้ Pilot ที่มี Player Owner ระบบส่งคำขอแบบ private ไปยัง Player Owner ที่กำลัง active และเปิด popup ให้ผู้เล่นเลือกหุ่นและยืนยันการเรียกจาก Client ของตนเอง
- หาก Player Owner เป็นผู้กด Bracelet เอง หน้าต่างเลือกการเรียก/กลับสู่ Pilot จะแสดงบน Client นั้นโดยตรง
- เมื่อกด **กลับเป็น Pilot และเก็บหุ่น** ระบบลบเฉพาะ Mecha Token ที่ Bracelet เรียกไว้จาก Scene ปัจจุบัน แล้วคืนการควบคุมให้ Pilot; Actor Vehicle/Mecha ยังอยู่ใน World
- Player ต้องมีสิทธิ์สร้างและลบ Token บน Scene รวมถึงเป็น Owner ของ Pilot และ Actor Mecha ที่เลือก หากไม่มีสิทธิ์ ให้ GM ตรวจ permission ก่อนใช้งาน

---

## 15. Conditions และ State Points

### Disabled Organs

- เปิดใช้กฎ Disabled Organ ได้จาก Biography
- เลือกอวัยวะที่ได้รับผลกระทบได้หลายรายการ
- แต่ละรายการเพิ่ม State Point ตามกฎของระบบ
- Prosthetic Equipment สามารถทำให้อวัยวะกลับมาใช้งานได้

### Conditions

Conditions มี Penalty แยกเป็นรายรายการ

ระบบไม่บังคับ Advantage / Disadvantage อัตโนมัติ GM สามารถกำหนด Penalty ที่เหมาะสมกับ Campaign ได้

---

## 16. การทดสอบหลังติดตั้ง

### Test A — ID Card

1. สร้าง Character ใหม่
2. เปิด Biography
3. ตรวจว่า Identification No. เป็นตัวเลข 13 หลัก
4. กรอก Gender, Age, Date of Birth, Address, Birthplace และ Origin
5. กด ID Card
6. ตรวจข้อมูลใน Dialog และ Chat

### Test B — Feature

1. เพิ่ม Ability ที่เป็น ACTIVE
2. เพิ่ม Ability ที่เป็น PASSIVE
3. เพิ่ม Ability ที่เป็น REACTION
4. ตรวจว่าป้ายประเภทถูกต้อง
5. ตรวจว่า Passive / Reaction ไม่ถูกนับใน Active Bar แบบ Active
6. ใส่ Active Ability ครบ 8 ช่องและทดสอบช่องที่ 9

### Test C — Defense

1. สร้างผู้โจมตีและผู้ถูกโจมตี
2. ให้ผู้ถูกโจมตีถืออาวุธ
3. เลือก Target
4. โจมตี
5. เลือก Defend
6. ทดสอบผลสำเร็จและล้มเหลว
7. ทดสอบ Dodge
8. ทอยให้สูงกว่า Attack เพื่อให้ได้ Counterattack
9. กด Counterattack
10. ตรวจว่าปุ่ม Damage ไม่แสดงเมื่อ Defense สำเร็จ

### Test D — Damage Reduction

1. ใส่ Armor ให้ตัวละคร
2. ตรวจค่า DR บนหน้า Main
3. โดนโจมตี
4. Apply Damage
5. ตรวจข้อความ Raw Damage, DR, Multiplier และ Final Damage

### Test E — NPC / Vehicle

1. สร้าง NPC
2. สร้าง Vehicle
3. กรอก Identity
4. เปิด ID Card
5. ตรวจ Identification Number และ Origin
6. ตรวจ Reflex และ Armor DR

---

## 17. ข้อจำกัดที่ยังควรรู้

### 17.1 Multiplayer Defense Dialog

ในเวอร์ชันปัจจุบัน Defense Dialog ถูกเรียกจาก flow การโจมตีของผู้โจมตี หากเล่นหลายคนและผู้โจมตีไม่มีสิทธิ์แก้ไข Actor ของผู้ถูกโจมตี อาจเกิดปัญหา Permission ตอนบันทึกสถานะ Defense

แนวทางต่อยอดที่ดีที่สุดคือ:

1. ผู้โจมตีโพสต์ Attack Challenge ลง Chat
2. ผู้ถูกโจมตีกด Defend หรือ Dodge จาก Client ของตนเอง
3. ระบบล็อก Chat Message ป้องกันการตอบซ้ำ
4. GM มีปุ่ม Override

### 17.2 Natural 20 และ Natural 1

สำหรับ **Defense และ Dodge** ระบบบังคับกฎดังนี้: Natural 20 สำเร็จอัตโนมัติ; Natural 1 ล้มเหลวอัตโนมัติ แม้ผลรวมจะสูงหรือต่ำกว่า Attack อย่างไร

Natural 20 ของ Dodge ไม่ให้ Counterattack โดยอัตโนมัติ; Counterattack ยังคงต้องมีผลรวม Reflex สูงกว่า Attack และมีอาวุธพร้อมใช้ตามกติกาเดิม

### 17.3 Vehicle Metadata

Vehicle / Mecha มีช่องแยกสำหรับ **Model**, **Manufacturer** และ **Serial Number** ในแผง Vehicle Systems; fields เหล่านี้ไม่ทับ Origin หรือ Identification No. เดิม

---

## 18. แนวทางสำหรับ GM

ก่อนเริ่ม Campaign ควรกำหนดให้ชัดเจน:

- Attribute Baseline
- ความหมายของ Damage Reduction
- ลำดับ Resistance และ Vulnerability
- จำนวน Defense ต่อเทิร์น
- จำนวน Counterattack ต่อเทิร์น
- Natural 20 / Natural 1
- Reaction ใดใช้ได้กับการโจมตีประเภทใด
- Extra Skill ใดเพิ่ม Defense หรือ Counterattack
- Vehicle / Mecha ใช้ Reflex แบบทอยหรือค่าคงที่

แนะนำให้บันทึก House Rules ใน Rules Reference ของ World เพื่อให้ผู้เล่นทุกคนใช้กติกาเดียวกัน

---

## 19. สรุปกฎ Combat ฉบับสั้น

```text
1. ผู้โจมตีทอย Attack
2. ผู้ถูกโจมตีเลือก Defend, Dodge หรือ Take the Hit
3. Defend ใช้ Attack ของอาวุธในมือ
4. Dodge ใช้ Reflex
5. ผลเท่ากันหรือสูงกว่า = ป้องกัน / หลบสำเร็จ
6. Dodge สูงกว่า = ได้ Counterattack
7. ป้องกันสำเร็จ = ไม่มี Damage Roll
8. โจมตีโดน = ทอย Damage
9. ลด DR ก่อน Resistance / Immunity / Vulnerability
10. ใช้ Defense และ Counterattack ตามจำนวนต่อเทิร์น
```
