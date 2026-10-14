# RnR v0.3.17 — แก้การเปิด Character Sheet

**วันที่:** 11 ตุลาคม 2026  
**เป้าหมาย:** แก้การ render Actor, NPC/Vehicle และ Item sheets บน Foundry VTT v14

## สาเหตุที่พบใน RnR.rar

คลาส `RnRActorSheet`, `RnRNpcSheet` และ `RnRItemSheet` สืบทอดจาก `ActorSheetV2` / `ItemSheetV2` โดยตรง แม้คลาสเหล่านี้ประกาศ `PARTS` ที่ใช้ Handlebars templates แต่ไม่ได้ผสม `HandlebarsApplicationMixin` เข้ามา ทำให้ไม่มี renderer สำหรับแสดง template ใน ApplicationV2 และชีตจึงเปิด/render ไม่สำเร็จ

## การแก้ไข

- สร้าง Handlebars-rendering bases ด้วย `foundry.applications.api.HandlebarsApplicationMixin(...)`
- ให้ Actor และ NPC/Vehicle sheets สืบทอดจาก `RnRHandlebarsActorSheet`
- ให้ Item sheet สืบทอดจาก `RnRHandlebarsItemSheet`
- คง package ID เป็น `rnr` ตาม RnR.rar ที่ตรวจแล้ว ไม่เปลี่ยน ID ซ้ำ
- เพิ่ม regression test ป้องกันการลืม renderer mixin

## การตรวจสอบ

- Regression tests: **21/21 ผ่าน**
- `node --check` สำหรับไฟล์ JavaScript/MJS ผ่าน
- Compendium build: **15/15 packs สำเร็จ**

ตรวจจาก source และการทดสอบอัตโนมัติแล้ว แต่ยังไม่ได้เปิดใน Foundry World ของผู้ใช้จริง หาก v0.3.17 ยังไม่เปิดชีต กรุณาส่งบรรทัด error สีแดงจาก Console (F12 → Console) เพื่อระบุปัญหาขณะทำงานจริง
