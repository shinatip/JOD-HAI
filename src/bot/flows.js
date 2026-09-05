const { baht, thaiDate, thaiMonthShort, truncateLabel } = require('../utils/format');

function quickReplyText(text, items) {
  return { type: 'text', text, quickReply: { items } };
}

function postbackItem(label, action, extra = {}) {
  return {
    type: 'action',
    action: {
      type: 'postback',
      label: truncateLabel(label),
      data: JSON.stringify({ action, ...extra }),
      displayText: label,
    },
  };
}

function cardPickerMessage(cards, promptText, action) {
  const items = cards
    .slice(0, 13)
    .map((c) => postbackItem(c.name, action, { cardId: c.id, cardName: c.name }));
  return quickReplyText(promptText, items);
}

function categoryPickerMessage(categories, promptText, action) {
  const items = categories
    .slice(0, 13)
    .map((c) => postbackItem(c.name, action, { categoryId: c.id, categoryName: c.name }));
  return quickReplyText(promptText, items);
}

function yesNoMessage(promptText, yesAction, noAction) {
  return quickReplyText(promptText, [
    postbackItem('ใช่ ผ่อนชำระ', yesAction),
    postbackItem('ไม่ผ่อน จ่ายเต็ม', noAction),
  ]);
}

function helpMessage() {
  return {
    type: 'text',
    text:
      '💳 คำสั่งที่ใช้ได้\n\n' +
      '• "เพิ่มบัตร" - เพิ่มบัตรใหม่\n' +
      '• "บัตรของฉัน" - ดูบัตรทั้งหมด\n' +
      '• "บันทึกรายจ่าย" - บันทึกรายการใหม่\n' +
      '• "สรุปเดือนนี้" - สรุปรอบบิลปัจจุบันของบัตร\n' +
      '• "สรุปปีนี้" - สรุปยอดทั้งปีของบัตร\n' +
      '• "เช็ควงเงิน" - ดูวงเงินคงเหลือทุกบัตร\n' +
      '• "ยกเลิก" - ยกเลิกขั้นตอนที่ทำค้างอยู่',
  };
}

function cardListMessage(cards) {
  if (!cards.length) {
    return { type: 'text', text: 'ยังไม่มีบัตรเลยครับ พิมพ์ "เพิ่มบัตร" เพื่อเริ่มเพิ่มบัตรใบแรก' };
  }
  const lines = cards.map(
    (c) => `💳 ${c.name}\n   วงเงิน: ${baht(c.credit_limit)} บาท | ตัดรอบวันที่ ${c.cutoff_day}`
  );
  return { type: 'text', text: lines.join('\n\n') };
}

function transactionConfirmMessage({ cardName, categoryName, amount, isInstallment, schedule }) {
  let text = `✅ บันทึกรายการแล้ว\n\n💳 บัตร: ${cardName}\n🏷️ หมวด: ${categoryName}\n💰 ยอด: ${baht(amount)} บาท\n`;
  if (isInstallment) {
    text += `📆 ผ่อน ${schedule.length} เดือน (เดือนละ ${baht(schedule[0].amount)} บาท)\n`;
    text += `เริ่มขึ้นบิลรอบตัดวันที่ ${thaiDate(schedule[0].cycle_end_date)}\n`;
    text += `งวดสุดท้ายบิลรอบตัดวันที่ ${thaiDate(schedule[schedule.length - 1].cycle_end_date)}`;
  } else {
    text += `📆 ขึ้นบิลรอบตัดวันที่ ${thaiDate(schedule[0].cycle_end_date)}`;
  }
  return { type: 'text', text };
}

function cycleSummaryMessage(cardName, summary) {
  let text = `📊 สรุปรอบบิล - ${cardName}\nตัดรอบวันที่ ${thaiDate(summary.cycleEndDate)}\n\nยอดรวม: ${baht(summary.total)} บาท\n`;
  if (summary.categories.length) {
    text += `\nแยกตามหมวดหมู่ (มาก→น้อย):\n`;
    text += summary.categories.map((c) => `• ${c.name}: ${baht(c.amount)} บาท`).join('\n');
  } else {
    text += `\nยังไม่มีรายการในรอบบิลนี้`;
  }
  return { type: 'text', text };
}

function yearSummaryMessage(cardName, summary) {
  let text = `📊 สรุปรายปี ${summary.year} - ${cardName}\n\n`;
  text += summary.byMonth
    .map((amt, i) => `${thaiMonthShort(i)}: ${baht(amt)}`)
    .join('\n');
  text += `\n\nรวมทั้งปี: ${baht(summary.total)} บาท`;
  if (summary.categories.length) {
    text += `\n\nแยกตามหมวดหมู่ (มาก→น้อย):\n`;
    text += summary.categories.map((c) => `• ${c.name}: ${baht(c.amount)} บาท`).join('\n');
  }
  return { type: 'text', text };
}

function utilizationMessage(cardName, util) {
  const bar = buildBar(util.pct);
  return {
    type: 'text',
    text:
      `💳 ${cardName}\n` +
      `วงเงิน: ${baht(util.limit)} บาท\n` +
      `ใช้ไปแล้ว: ${baht(util.outstanding)} บาท (${util.pct}%)\n` +
      `คงเหลือ: ${baht(util.available)} บาท\n` +
      `${bar}`,
  };
}

function buildBar(pct) {
  const filled = Math.max(0, Math.min(10, Math.round((pct / 100) * 10)));
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

module.exports = {
  quickReplyText,
  postbackItem,
  cardPickerMessage,
  categoryPickerMessage,
  yesNoMessage,
  helpMessage,
  cardListMessage,
  transactionConfirmMessage,
  cycleSummaryMessage,
  yearSummaryMessage,
  utilizationMessage,
};
