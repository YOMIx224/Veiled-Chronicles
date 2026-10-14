# RnR v0.3.18 — แก้ Flag scope, Chat Card และ Extra Skill Shop บน Foundry v14

**วันที่:** 14 ตุลาคม 2026
**ทดสอบกับ:** Foundry VTT v14 build 368 (instance ทดสอบแยก ไม่ใช้ World จริง)

## สถานะ Character Sheet

ทดสอบ v0.3.17 ใน Foundry v14 จริงแล้ว: Character, NPC, Vehicle และ Item ทั้ง 14 ประเภท render ได้, ไม่มี nested `<form>`, ส่งฟอร์ม (submit) บันทึกค่าได้ และสลับแท็บได้โดยไม่มี error การแก้ `HandlebarsApplicationMixin` ใน v0.3.17 จึงใช้ได้จริง v0.3.18 ไม่ได้แก้โค้ด sheet

## ปัญหาที่พบใน runtime

1. **ทุกข้อความแชท throw `Flag scope "RnR" is not valid or not currently active`.**
   Foundry v13+ อนุญาตให้ `getFlag`/`setFlag` ใช้ได้แค่ scope `core`, `world`, system id (`rnr`) และ module ที่เปิดอยู่
   hook `renderChatMessageHTML` เรียก `handleMechaSummonMessage` → `message.getFlag("RnR", …)` ซึ่ง throw ก่อนถึง
   `activateChatCardListeners` ผลคือปุ่มบน Chat Card ทุกปุ่ม (Attack, Damage, Apply Damage, Defend/Dodge, Reload) กดแล้วไม่ทำงาน
2. **Apply Damage แบบเจ้าของเป้าหมาย** ใช้ `actor.setFlag("RnR", …)` ซึ่ง throw ด้วยสาเหตุเดียวกัน
3. **Mecha return-to-pilot** ใช้ `token.document.getFlag("RnR", …)` ซึ่ง throw เช่นกัน
4. **Extra Skill Shop** กรอง compendium ด้วย `pack.metadata.system !== "RnR"` แต่ทุก pack ประกาศ `system: "rnr"` จึงไม่แสดง extra skills 616 รายการจาก compendium
5. หัวหน้าต่าง sheet แสดง `TYPES.Actor.character` เพราะไม่มีคำแปลประเภทเอกสาร

## การแก้ไข

- เพิ่ม `scripts/modules/flags.js` ให้อ่าน/เขียน path เดิม `flags.RnR.*` โดยตรง (`doc.update({"flags.RnR.<key>": value})` ซึ่งเป็นสิ่งเดียวกับที่ `setFlag` ทำ)
  ข้อมูลเดิมใน World จึงยังอยู่ที่เดิม **ไม่ต้อง migrate และไม่เปลี่ยน schema**
- `damage.js`, `chatcard.js`, `mecha.js` ใช้ helper ใหม่แทน `getFlag`/`setFlag("RnR")`
- Extra Skill Shop เทียบกับ `game.system.id`
- เพิ่ม `TYPES.Actor.*` และ `TYPES.Item.*` ใน `lang/en.json` (ใช้คำเดิมจาก `ACTOR`/`ITEM.Type`)

ไม่ได้เปลี่ยน package ID (`rnr`), ชื่อโฟลเดอร์, settings namespace (`RnR`), document types, template paths หรือกติกาเกม

## การตรวจสอบ

- `node --test tests/*.test.mjs`: 25/25 ผ่าน (เพิ่ม `tests/flag-scope.test.mjs` และทำ mock ใน `targeting-damage.test.mjs` ให้เข้ม scope แบบ v14; 4 tests ใหม่ล้มบนโค้ด v0.3.17)
- Runtime บน v14 build 368: เปิดทุก sheet ผ่าน, Chat Card → Attack → Damage → Apply Damage ผ่าน, กด Apply ซ้ำไม่หัก HP ซ้ำ, Shop แสดง extra skills จาก compendium
- Compendium: build 15/15 packs จาก `_source` และอ่านกลับเทียบกับ LevelDB ที่ส่งมา ตรงกันทุก pack
