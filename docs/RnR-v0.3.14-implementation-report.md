# รายงานการดำเนินงาน Role & Roll (RnR) v0.3.14

**วันที่:** 11 ตุลาคม 2026  
**เวอร์ชันแพ็กเกจ:** 0.3.14  
**รองรับ Foundry VTT:** v13 และ v14  
**ฐานซอร์ส:** สำเนางาน RnR ที่สืบทอดจาก ZIP ของผู้ใช้

## สรุป

ดำเนินงานต่อจากรุ่น 0.3.13 เพื่อย้ายหน้าต่างชีตสู่ ApplicationV2, แก้บัคที่ทำให้ Character Sheet เปิดไม่ได้, เพิ่มผังอุปกรณ์สวมใส่ 12 ตำแหน่ง และซิงก์เอกสาร/metadata ไปยัง compendium ทั้ง 15 ชุดแล้ว

## รายการเปลี่ยนแปลง

### Foundry VTT v13/v14 UI

- ปรับ Actor, NPC/Vehicle และ Item sheets ให้ใช้ ApplicationV2 / DocumentSheetV2
- เปลี่ยน Dialog เดิมเป็น DialogV2 ในจุดที่เกี่ยวข้อง
- แก้ nested `<form>` ซึ่งไม่ถูกต้องใน DocumentSheetV2: templates ใช้ `<div>` เป็น wrapper และให้ DocumentSheetV2 จัดการ outer form
- อัปเดตเลย์เอาต์ wearable เป็น grid 3 คอลัมน์ × 6 แถว

### Wearable equipment: 12 ช่อง

| แถว | ซ้าย | กลาง | ขวา |
|---|---|---|---|
| ศีรษะ | — | Head | — |
| คอ | — | Neck | — |
| แขน/ลำตัว | Right Arm | Torso | Left Arm |
| มือ/หลัง | Right Hand | Back | Left Hand |
| ขา | Right Leg | — | Left Leg |
| เท้า | Right Foot | — | Left Foot |

รวม 12 ช่อง: Head, Neck, Torso, Back, Right/Left Arm, Right/Left Hand, Right/Left Leg และ Right/Left Foot. ช่องสามารถเลือกผ่าน dropdown หรือลาก Item ไปวางได้

### ความเข้ากันได้กับข้อมูลเดิม

- ค่าเดิมอย่าง `hands`, `feet`, `ring` และ `waist` จับคู่กับ physical slot ที่เข้ากันได้ระหว่างเตรียมชีต
- การจับคู่เลือกช่องด้านที่ยังว่างอย่างกำหนดแน่นอน และให้ค่า explicit เช่น `rightHand` มาก่อนค่า legacy ที่กำกวม
- ไม่เขียนทับข้อมูลต้นฉบับ; หากต้องการระบุด้าน ให้กำหนดช่องซ้าย/ขวาใหม่โดยตรง

### คู่มือและ compendium

- เพิ่มคำอธิบายผัง 12 ช่องใน `docs/RnR-user-guide.md`
- ซิงก์คำอธิบายและ metadata รุ่น 0.3.14 ในแหล่ง `rnr-user-guide` compendium
- เพิ่ม regression tests สำหรับ slot mapping, CSS layout และการป้องกัน nested forms

## การตรวจสอบ

- Regression tests: **17/17 ผ่าน** (`node --experimental-default-type=module --test tests/*.test.mjs`)
- `node --check`: ผ่านไฟล์ JavaScript/MJS ใน `scripts` และ `packs`
- JSON parse: **963 ไฟล์ผ่าน**
- Compendium build: **15/15 packs**, **958 parent documents**
- ตรวจอ่านกลับ LevelDB: **985 records** รวม Journal page records; ไม่พบ JSON เสียหรือเอกสารไม่มี `_id`
- ตรวจยืนยันเลขเวอร์ชัน 0.3.14, คำอธิบายภาษาไทยในคู่มือ/compendium และ CSS mappings ครบทั้ง 12 ช่อง

> การตรวจที่ทำเป็น static checks, regression tests และ pack build/readback; ยังไม่ได้รันทดสอบ UI ใน Foundry World จริงหรือหลาย client

## Smoke test ที่แนะนำใน Foundry

1. ติดตั้งรุ่น 0.3.14 และ reload/restart ระบบใน World เป้าหมาย
2. เปิด Character, NPC/Vehicle และ Item sheets; ตรวจว่าหน้าต่างเปิดได้ ปิดได้ และบันทึกค่าจากฟอร์มได้
3. ตรวจผังอุปกรณ์ครบ 12 ช่อง และการจัดวาง Head/Neck, แขน–ลำตัว, มือ–หลัง, ขา และเท้าตามตำแหน่ง
4. ทดลองลากอุปกรณ์ลงช่อง เลือกช่องด้วย dropdown ถอดออก และเปิดชีตใหม่เพื่อตรวจการบันทึก
5. ทดลอง Item ที่ใช้ค่าเก่า `hands`, `feet`, `ring`, `waist` เพื่อดูการจับคู่ด้านว่างโดยไม่เปลี่ยน source data
6. ทดสอบ Actions, DialogV2 และการใช้งาน Player/GM ใน World จริงตาม flow ปกติของโต๊ะ

## ไฟล์สำคัญ

- คู่มือผู้ใช้: `docs/RnR-user-guide.md`
- แหล่งคู่มือใน compendium: `packs/_source/rnr-user-guide/complete-user-guide.json`
- ระบบ wearable: `scripts/modules/equipmentSlots.js`
- Regression tests: `tests/equipment-slots.test.mjs`, `tests/v2-sheet-template.test.mjs`
