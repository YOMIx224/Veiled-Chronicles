# RnR v0.4.0 — ความเสถียร, UX และเนื้อหา

**วันที่:** 14 ตุลาคม 2026
**ต่อจาก:** v0.3.19

## 1. ความเสถียร

- **`tools/release.mjs`**: สร้าง ZIP ที่ติดตั้งได้ใน `dist/`
  - ตรวจ manifest และ path รูปไอคอนทั้งหมด
  - รัน unit tests
  - build packs ลงโฟลเดอร์ชั่วคราว (รันได้แม้ Foundry เปิดอยู่)
  - อ่าน ZIP กลับมาตรวจว่ามี `rnr/system.json` และทุก pack ครบ
  - กันปัญหา ZIP ว่างแบบ v0.3.15–0.3.17
- **`packs/build-packs.mjs`**:
  - ใส่ `_stats.systemId`/`systemVersion` ตาม `system.json` (ต้นฉบับเดิมเขียนว่า `"RnR"` / `0.3.7`)
  - อ่านกลับและนับเอกสารทุก pack หลัง build
  - แจ้งชัดเจนเมื่อ Foundry ล็อก pack อยู่
- **`game.RnR.smokeTest()`**: ตรวจสุขภาพระบบใน World จริง โดยใช้เอกสารชั่วคราวในหน่วยความจำ ไม่สร้างหรือแก้อะไรใน World
- **`tools/foundry-sandbox.mjs`**: เปิด Foundry กับโฟลเดอร์ข้อมูลแยก ไม่แตะ World จริง
- **รูปไอคอนเสีย 53 path (119 จุดใน compendium)**: Foundry v14 ตัดไอคอนบางส่วนที่ v13 เคยมีออกไป ข้อมูลเดิมจึงแสดงรูปเสีย แก้เป็นไอคอนที่มีอยู่จริงทั้งหมด รวมถึงไอคอน Session 0 Guide

## 2. ประสบการณ์ผู้ใช้

- **UI เป็นภาษาอังกฤษทั้งหมด**: แปลข้อความแจ้งเตือนและ dialog ของ Mecha, Chat Card และ Session 0, label ของ pack คู่มือ และธีม Martial Arts
  - เนื้อหา (compendium, journal, คำอธิบายไอเทม) ยังเป็นภาษาไทยได้
  - คงชื่อ Journal "RnR — Session 0 Guide (พร้อมเล่น)" ไว้ เพราะระบบใช้ชื่อนี้หาคู่มือเดิม ถ้าเปลี่ยนชื่อ คู่มือเดิมใน World จะถูกลบ
- **Description ของไอเทมใช้ rich-text editor (ProseMirror)** แทน textarea ที่แสดงแท็ก HTML ดิบ ไอเทมใน compendium ที่ล็อกจะแสดงแบบอ่านอย่างเดียว
- **Extra Skill Shop**:
  - เพิ่มตัวกรอง Attribute และ "Affordable only"
  - แสดงทีละ 60 รายการพร้อมปุ่ม "Show more" และจำนวนที่แสดงอยู่
- **ขนาดหน้าต่าง sheet**: เปิดไม่เกินขนาดจอ แก้ปัญหาบนจอเล็ก

## 3. เนื้อหาและกติกา

- **Backgrounds**: จาก 3 เป็น 20 (เพิ่ม Artisan, Devotee, Courtier, Performer, Wanderer, Rural Worker, Gambler, Watch Officer, Medic, Hunter, Laborer, Merchant, Investigator, Technician, Mystic, Bodyguard, Martial Disciple)
- **Mecha Frames**: จาก 1 เป็น 4 (เพิ่ม Vanguard S-02 Scout, Bastion H-03 Heavy, Relay C-04 Support)
- **แก้กติกา: โบนัส Origin / Class / Background ไม่เคยถูกใช้จริง**
  - ฟังก์ชันมีอยู่แต่ไม่มีโค้ดเรียกใช้ ตอนนี้เมื่อเพิ่มไอเทมเหล่านี้ให้ Character โบนัสจะถูกใช้ และถูกถอดออกเมื่อลบไอเทม
  - ตัวละครเดิมไม่ถูกเปลี่ยนย้อนหลัง
- **State Points**: โบนัส attribute จาก Origin ไม่นับเป็นแต้มที่ใช้ไป และลด attribute ต่ำกว่า 8 + โบนัส Origin ไม่ได้
- **`RULES.md`** เขียนใหม่ทั้งหมดจากโค้ดจริง ครอบคลุม attributes, การสร้างตัวละคร, ค่าที่คำนวณได้, การทอย, การต่อสู้ (attack/defend/dodge/counter/damage/cover), Down/Recovery, การพัก, เลเวล, อุปกรณ์ 12 ช่อง, Extra Skills, Mecha และ GM settings

## ความเข้ากันได้

ไม่เปลี่ยน package ID (`rnr`), document types, field paths, flags หรือ settings namespace ไม่มี migration ของข้อมูล World
