-- ⚠️ ลบข้อมูลทั้งหมดถาวร ไม่สามารถกู้คืนได้ รันเฉพาะตอนต้องการล้างข้อมูลทดสอบเท่านั้น
-- categories จะไม่ถูกลบ (เป็นหมวดหมู่เริ่มต้น ไม่ใช่ข้อมูลทดสอบ)

truncate table billing_items, transactions, cards, users, user_sessions
restart identity cascade;
