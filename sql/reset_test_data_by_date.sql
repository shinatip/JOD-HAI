-- ⚠️ ลบถาวร กู้คืนไม่ได้ ตรวจสอบเงื่อนไขวันที่ให้ถูกต้องก่อนกด Run ทุกครั้ง
-- ลบแค่ transactions ตามเงื่อนไข -> billing_items ที่ผูกกับ transaction นั้น
-- จะถูกลบตามอัตโนมัติเพราะตั้ง ON DELETE CASCADE ไว้แล้ว
-- ไม่กระทบ cards / users / categories เลย (บัตรและผู้ใช้ยังอยู่เหมือนเดิม)

-- ตัวเลือกที่ 1: ลบรายการที่ "ซื้อ" ก่อนวันที่กำหนด (ตาม transaction_date)
delete from transactions
where transaction_date < '2026-09-01';

-- ตัวเลือกที่ 2: ลบรายการที่ "ซื้อ" ในช่วงวันที่ระบุ (ระหว่างวันที่)
-- delete from transactions
-- where transaction_date between '2026-09-01' and '2026-09-05';

-- ตัวเลือกที่ 3: ลบเฉพาะรายการที่ "บันทึกเข้าระบบ" ในวันนั้นๆ (ตาม created_at แทน transaction_date)
-- เผื่อกรณีเทสวันนี้แต่ตั้ง transaction_date ย้อนหลังไว้
-- delete from transactions
-- where created_at::date = '2026-09-06';

-- ตัวเลือกที่ 4: ลบทุกอย่างที่ "ใหม่กว่า" วันที่กำหนด (เผื่อกรณีอยากเก็บของเก่าไว้ ลบแค่ของที่เพิ่งเทสเพิ่ม)
-- delete from transactions
-- where created_at > '2026-09-06';
