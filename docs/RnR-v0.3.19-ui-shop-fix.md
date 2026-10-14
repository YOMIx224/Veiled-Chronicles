# RnR v0.3.19 — แก้ปุ่มบิดเบี้ยวและ Extra Skill Shop ว่าง

**วันที่:** 14 ตุลาคม 2026
**หมายเหตุ:** รุ่นนี้ไม่ได้รันการทดสอบตามคำขอผู้ใช้ ตรวจแค่ syntax (`node --check`)

## ปุ่มบิดเบี้ยว (Dialog, Character/NPC Sheet, Item Sheet)

สาเหตุ
- Foundry v13+/v14 กำหนดให้ `<button>` ทุกปุ่มสูงคงที่ `height: var(--button-size)` (2em) พร้อม `min-height` เป็น `display: flex` และตัวอักษร 14px
  CSS ของ RnR เขียนไว้สำหรับปุ่มที่สูงตามเนื้อหา จึงมีป้ายถูกตัดหรือเยื้องตำแหน่ง
- hook `renderApplicationV2` เติม class `rnr-dialog` ให้ **ทุก** DialogV2 รวมถึงหน้าต่างของ Foundry เอง กฎ `!important` (ปุ่ม 2 คอลัมน์, `max-width: 560px`) จึงไปบิดหน้าต่าง core ด้วย
- CSS ของ dialog ใช้ `.dialog-buttons` / `.dialog-button` ของ Dialog v1 แต่ DialogV2 ใน v14 ใช้ `footer.form-footer`

การแก้
- `styles/RnR.css`: reset `--button-size`/`height` เฉพาะปุ่มใน `.rnr.sheet .window-content`, `.rnr-dialog .window-content` และ `.rnr-chat-card` ปุ่มบนหัวหน้าต่างไม่ถูกแตะ
- `styles/RnR.css`: จัดปุ่มใน footer ของ dialog เป็นแถวเดียว ความกว้างเท่ากัน รองรับ `.form-footer`
- `scripts/RnR.js`: เติม `rnr-dialog` เฉพาะ dialog ที่มีเนื้อหา RnR

## Extra Skill Shop ไม่มีให้ซื้อ

สาเหตุ: ร้านกรอง compendium ด้วย `metadata.system !== "RnR"` แต่ทุก pack เป็น `rnr` จึงไม่พบ skill เลย (v0.3.18 แก้ไปบางส่วนแล้ว)
การแก้: อ่านทุก Item Compendium (รวม compendium ที่ GM สร้างใน World) และถ้า pack ใดอ่านไม่ได้ จะข้ามเฉพาะ pack นั้น

ไม่ได้เปลี่ยน schema, package ID, flags หรือข้อมูล World
