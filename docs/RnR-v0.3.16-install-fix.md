# RnR v0.3.16 — إصلاح ظهور النظام في Foundry v14

**วันที่:** 11 ตุลาคม 2026  
**เป้าหมาย:** ทำให้ Role&Roll ถูกตรวจพบในรายการ Game Systems หลังติดตั้งด้วยตนเอง

## สาเหตุ

พบปัญหาสองจุดในแพ็กเกจที่ส่งก่อนหน้า:

1. `system.json` ใช้ ID `RnR` ตัวพิมพ์ใหญ่ ขณะที่แนวทาง System Development ของ Foundry กำหนดให้ package ID เป็นตัวพิมพ์เล็ก และชื่อโฟลเดอร์ระบบต้องตรงกับ ID
2. ZIP ก่อนหน้าไม่มีโฟลเดอร์ระบบชั้นบน จึงเสี่ยงแตกไฟล์แล้ววาง `system.json` ไว้ตรง `Data/systems/` แทน `Data/systems/<id>/system.json`

## การแก้ไข

- เปลี่ยน package ID เป็น `rnr` และอัปเดต metadata ของ packs ให้ตรงกัน
- เปลี่ยน URL ของ Actor/NPC/Item templates เป็น `systems/rnr/...`
- จัด ZIP ใหม่ให้มีโฟลเดอร์ชั้นบน `rnr/` พร้อม `system.json` ที่รากของโฟลเดอร์นั้น
- คง namespace เดิม `RnR` สำหรับ game settings และ flags เพื่อไม่เปลี่ยนชื่อข้อมูลที่ระบบเคยบันทึก
- เพิ่ม `INSTALL-TH.md` พร้อมภาพรวมตำแหน่งติดตั้งและข้อควรระวังเรื่อง World เดิม

## ตรวจสอบ

- Regression tests: **20/20 ผ่าน**
- Syntax check ของ `scripts/RnR.js` ผ่าน
- JSON manifest/source ผ่านการ parse
- Build compendium: **15/15 packs สำเร็จ**
- ZIP มีโครงสร้าง `rnr/system.json` และผ่าน integrity test

ZIP นี้เป็น **แพ็กเกจติดตั้งด้วยตนเอง** ไม่ได้อยู่ในรายการ Package Browser ของ Foundry; หลังแตกไว้ใต้ `Data/systems/` และรีสตาร์ต Foundry จึงควรเห็น Role&Roll ในช่องเลือก Game System ตอนสร้าง World

> **สำคัญ:** ID เปลี่ยนจาก `RnR` เป็น `rnr`. หากมี World เดิมที่บันทึก ID `RnR` อยู่ โปรดสำรองข้อมูลและแจ้งก่อนเปลี่ยนไปใช้แพ็กเกจนี้ เพราะ World เดิมอาจไม่เปิดด้วย ID ใหม่โดยอัตโนมัติ

## อ้างอิง

- [Foundry — Introduction to System Development](https://foundryvtt.com/article/system-development/)
- [Foundry v14 — BaseSystem API](https://foundryvtt.com/api/classes/foundry.packages.BaseSystem.html)
