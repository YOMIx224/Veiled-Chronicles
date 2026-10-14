# รายงานการดำเนินงาน RnR v0.3.13

> เอกสารนี้เป็นรายงานย้อนหลังของรุ่น 0.3.13; รายงานรุ่นปัจจุบันคือ [RnR v0.3.14](RnR-v0.3.14-implementation-report.md)

**วันที่:** 2026-10-07  
**เวอร์ชันแพ็กเกจ:** 0.3.13  
**ฐานซอร์ส:** ZIP `RnR.zip` ที่ผู้ใช้อัปโหลด

## สรุป

ต่อยอดจากแผน Phase 1–3 และดำเนินงานด้านความถูกต้อง/สิทธิ์ของระบบต่อใน Phase 4 โดยคงตัวเลือกที่ผู้ใช้อนุมัติ **Vehicle A + Defense A**: เพิ่ม Vehicle metadata เป็น fields แยก และให้ Natural 20 สำเร็จอัตโนมัติ / Natural 1 ล้มเหลวอัตโนมัติสำหรับ Defend และ Dodge

รุ่น 0.3.13 เพิ่มสิทธิ์เจ้าของ Actor ใน Chat Card, ทำให้การ Apply damage ผูกกับ Actor ที่ถูกโจมตี, ส่งผล Damage Roll แบบ private ไปยังผู้โจมตีและ GM, แยก Apply-only prompt ให้เจ้าของเป้าหมาย/GM และป้องกันผลซ้ำต่อ Actor พร้อมแก้การนับ Active Effect damage dice ซ้ำ

## สิ่งที่เปลี่ยน

| ขอบเขต | ผลลัพธ์ |
|---|---|
| Compendium | ลงทะเบียน `rnr-setting-guides`, แก้ Journal IDs, เพิ่ม build validation และสร้าง packs ใหม่ครบ 15 ชุดจาก JSON source |
| Migration | schema ปัจจุบันเป็น 14; ถ้าเอกสารใด migrate ไม่สำเร็จ จะไม่เลื่อน world version และจะ retry ได้เมื่อเปิดโลกครั้งถัดไป |
| Vehicle identity | เพิ่ม `system.model`, `system.manufacturer`, `system.serial` ใน Vehicle template, sheet และ view model; migration เติมเฉพาะค่าที่ไม่มีและไม่เขียนทับข้อมูลเดิม |
| Defense/Dodge | ผล d20 ธรรมชาติ 20 ชนะ Defense อัตโนมัติ; ผล 1 แพ้อัตโนมัติ; die อื่นเทียบ total กับ Attack ตามเดิม; Natural 20 ไม่ให้ Counterattack เอง—ยังต้องผ่านเงื่อนไขเดิม |
| Foundry API | ใช้ keyed Scene Controls, `ActorSheetV2`/`ItemSheetV2`, `DialogV2` และ hooks แบบใหม่ตามการตรวจ API v13/v14 |
| Mecha | คำขอ summon ส่ง private whisper ถึงเจ้าของ Actor; owner ยืนยันใน popup; Return ลบเฉพาะ Mecha Token ที่เรียกออกมาและคง Actor ต้นฉบับไว้ |
| DR/LOS | DR ใช้ค่า Actor defense ที่เตรียมแล้วร่วมกับ Armor/Equipment ที่สวม; Resistance/Immunity/Vulnerability ใช้ตามลำดับเดิม; LOS ที่ตรวจไม่ได้หรือเกิด error ถูกถือว่า blocked ใน feasibility result |
| Chat Card permissions | ปุ่มที่ทำงานในนาม Actor ตรวจ owner; GM ใช้ override ได้; ปุ่มที่จำกัดผู้ใช้เฉพาะตรวจ user ID ก่อนเรียก action |
| Attack damage flow | ผลทอยเต็มและสูตรเป็น whisper ถึงผู้โจมตีกับ GM; เจ้าของ Actor เป้าหมายและ GM ได้รับ Apply prompt แยกซึ่งในหน้าจอไม่แสดงจำนวน/สูตร; ปุ่มระบุ Actor เป้าหมายจริง ไม่พึ่ง target selection ณ เวลาคลิก |
| ป้องกันการใช้ซ้ำ | claim ของ Damage/Healing เก็บบน Actor เป้าหมาย ไม่เขียน ChatMessage ของผู้เล่นอื่น; หนึ่ง Chat Card ใช้ได้ครั้งเดียวต่อ Actor; หาก Actor เป้าหมายหายไป ระบบไม่ fallback ไปทำ damage กับ Token อื่น |
| Active Effect dice | รวม dice จากค่าต้นฉบับของ Actor และ Active Effects ที่ยังทำงาน โดยไม่รวมค่าที่ Foundry prepare แล้วซ้ำอีกครั้ง |

## การตรวจสอบ

- `node --check` ผ่านไฟล์ JavaScript/MJS ใน `scripts` และ `packs` รวมทั้ง regression test file
- ตรวจ parse JSON ผ่าน **960 ไฟล์** ได้แก่ `system.json`, `template.json` และ source JSON
- Regression tests (`tests/targeting-damage.test.mjs`) ผ่าน **10/10** ครอบคลุม LOS, DR/Resistance, Active Effect dice, owner/GM authorization, per-Actor one-shot และการผูก target ID
- Build Compendium ผ่าน **15 packs / 958 parent documents**
- เปิดตรวจ LevelDB ได้ **985 records** รวม Journal page records 27 รายการ; User Guide Compendium metadata เป็น 0.3.13
- Mock tests จากงานก่อนหน้านี้ครอบคลุม migration retry, Natural 20/1, GM toolbar และ Mecha summon/Return

การตรวจด้านบนเป็น static checks, unit/mock tests และการ build เท่านั้น **ยังไม่ได้ทดสอบ UI ใน Foundry World จริงหรือหลาย client** จึงยังไม่รับรอง form save, Dialog lifecycle, whisper permission configuration และ event binding จนกว่าจะผ่าน smoke test ใน World เป้าหมาย

## Smoke test ที่แนะนำใน Foundry

1. ติดตั้งรุ่น 0.3.13 แล้ว reload/restart ระบบ; ตรวจ migration schema 14 และ Vehicle/Mecha fields
2. ทดสอบ Attack Challenge ด้วย Player A, Player B และ GM: เฉพาะเจ้าของ Actor เป้าหมายตอบ Defense ได้; ตรวจ Natural 20/1 และผล die ปกติ
3. เมื่อ Attack โดน ตรวจว่า Player A และ GM เห็น Damage Roll เต็ม ส่วนเจ้าของเป้าหมายเห็นเฉพาะ Apply prompt; ทดลอง Apply/Apply Half สลับกันและกดซ้ำเพื่อยืนยันว่า HP เปลี่ยนครั้งเดียว
4. ให้ผู้คลิกเลือก Token อื่นไว้ก่อนกด Apply แล้วตรวจว่าระบบยังใช้ Actor เป้าหมายของ Challenge เดิม
5. ทดสอบ GM override และกรณีเป้าหมายไม่มี Player owner ที่ active
6. ตรวจ Character/NPC/Vehicle/Item sheets, DialogV2 และ Scene Controls ใน Foundry เวอร์ชันของ World จริง
7. ทดลอง Mecha summon จาก Player client แล้วกด Return; ยืนยันว่าลบเฉพาะ deployed Token
8. ทดลอง Active Effect `system.mods.damage` หลายรายการและ flat bonus เพื่อยืนยันสูตรที่ได้ตรงกับค่าที่คาด

## ขอบเขต/การตัดสินใจที่ยังเปิดอยู่

- **Range/LOS hard gate:** ระบบยังแสดงผล feasibility เป็นข้อมูลประกอบและไม่บล็อก Attack อัตโนมัติ แม้ LOS fallback จะ fail-closed ภายในตัวประเมิน การเปลี่ยนให้ range/LOS หยุด Attack เป็นการเปลี่ยนกติกาโต๊ะ จึงยังไม่ได้เปิดใช้โดยไม่มีการเลือกนโยบายจากผู้ใช้
- **Condition/Effect modifiers:** ระบบอ่าน damage dice/flat bonus จาก `system.mods.damage` และ `system.mods.damageFlat` รวมถึง Defense/Resistance fields ที่รองรับ หากต้องการกติกาเฉพาะของ Condition ที่ไม่ได้ map เข้าฟิลด์เหล่านี้ ต้องกำหนด mapping/rules แยกต่างหาก
- Damage Roll ที่เกิดโดยไม่มี Attack Challenge ยังคงเป็นการ์ดทั่วไปซึ่งใช้ target selection ปัจจุบัน; private roll และ Apply-only prompt แยกใช้กับ Attack Challenge ที่ระบุเป้าหมายชัดเจน

## แหล่ง API ทางการ

- [Foundry v13 ChatMessage API](https://foundryvtt.com/api/v13/classes/foundry.documents.ChatMessage.html)
- [Foundry v13 ActorSheetV2](https://foundryvtt.com/api/v13/classes/foundry.applications.sheets.ActorSheetV2.html), [ItemSheetV2](https://foundryvtt.com/api/v13/classes/foundry.applications.sheets.ItemSheetV2.html) และ [DialogV2](https://foundryvtt.com/api/v13/classes/foundry.applications.api.DialogV2.html)
- [Foundry v13/v14 Scene Controls](https://foundryvtt.com/api/v13/functions/hookEvents.getSceneControlButtons.html) และ [Foundry v13 renderApplicationV2 hook](https://foundryvtt.com/api/v13/functions/hookEvents.renderApplicationV2.html)
- [Foundry v13 WallsLayer](https://foundryvtt.com/api/v13/classes/foundry.canvas.layers.WallsLayer.html) — collision checks ที่เกี่ยวข้องกับ LOS

> ซอร์สและ Compendium ผ่านการตรวจ static, regression และ build แล้ว แต่ smoke test ใน World จริงยังเป็นขั้นตอนที่จำเป็นก่อนยืนยันการทำงานครบทุก UI/client
