# RnR v0.3.15 — Sheet Registration Hotfix

**วันที่:** 11 ตุลาคม 2026  
**เป้าหมาย:** แก้การเปิด Character Sheet ใน Foundry VTT v13/v14

## สาเหตุและการแก้ไข

พบการเรียก `DocumentSheetConfig.registerSheet(...)` โดยอ้างชื่อ `DocumentSheetConfig` แบบ global ใน hook `init` ทั้งที่ API ของ Foundry v13/v14 ระบุคลาสผ่าน namespace `foundry.applications.apps.DocumentSheetConfig`. หากชื่อ global ไม่มีอยู่ การลงทะเบียน Actor/Item sheets จะหยุดด้วย `ReferenceError` และชีต RnR อาจไม่ถูกเลือกหรือเปิดได้ตามปกติ

แก้การลงทะเบียนทั้งสามจุดให้เรียก API แบบเต็ม:

```js
foundry.applications.apps.DocumentSheetConfig.registerSheet(...)
```

อัปเดตเวอร์ชันเป็น **0.3.15** และเพิ่ม regression test เพื่อป้องกันการกลับไปใช้ชื่อ global แบบเดิม

## ผลตรวจ

- Regression tests: **18/18 ผ่าน**
- Compendium build: **15/15 packs สำเร็จ**
- `system.json` และ banner ใน `scripts/RnR.js` ใช้เวอร์ชัน 0.3.15

การตรวจนี้ยืนยันจาก source, regression tests และ pack build แต่ไม่ได้เปิด Foundry World ของผู้ใช้จริง หากติดตั้ง 0.3.15 แล้วยังเปิดไม่ได้ กรุณาส่งข้อความ error จาก Console ของเบราว์เซอร์ (F12 → Console) เพื่อไล่ trace จุดถัดไป

## อ้างอิง

- [Foundry v13 DocumentSheetConfig API](https://foundryvtt.com/api/v13/classes/foundry.applications.apps.DocumentSheetConfig.html)
- [Foundry v14 DocumentSheetConfig API](https://foundryvtt.com/api/classes/foundry.applications.apps.DocumentSheetConfig.html)
