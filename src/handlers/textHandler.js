const { client } = require('../config/line');
const sessionService = require('../services/sessionService');
const cardService = require('../services/cardService');
const categoryService = require('../services/categoryService');
const transactionService = require('../services/transactionService');
const summaryService = require('../services/summaryService');
const flows = require('../bot/flows');

function reply(event, messages) {
  return client.replyMessage(event.replyToken, Array.isArray(messages) ? messages : [messages]);
}

async function handle(event, user) {
  const text = event.message.text.trim();
  const lineUserId = user.line_user_id;
  const session = await sessionService.getSession(lineUserId);

  if (text === 'ยกเลิก') {
    await sessionService.clearSession(lineUserId);
    return reply(event, { type: 'text', text: 'ยกเลิกแล้วครับ พิมพ์ "เมนู" เพื่อดูคำสั่งทั้งหมด' });
  }

  switch (session.state) {
    case 'ADD_CARD_NAME':
      return handleAddCardName(event, user, text);
    case 'ADD_CARD_LIMIT':
      return handleAddCardLimit(event, user, session, text);
    case 'ADD_CARD_CUTOFF':
      return handleAddCardCutoff(event, user, session, text);
    case 'TXN_ENTER_AMOUNT':
      return handleTxnAmount(event, user, session, text);
    case 'TXN_ENTER_MONTHS':
      return handleTxnMonths(event, user, session, text);
    case 'IDLE':
    default:
      return handleCommand(event, user, text);
  }
}

async function handleCommand(event, user, text) {
  const lineUserId = user.line_user_id;

  if (['เมนู', 'menu', 'help', 'ช่วยเหลือ'].includes(text.toLowerCase())) {
    return reply(event, flows.helpMessage());
  }

  if (text === 'เพิ่มบัตร') {
    await sessionService.setSession(lineUserId, 'ADD_CARD_NAME', {});
    return reply(event, { type: 'text', text: 'ตั้งชื่อบัตรว่าอะไรดีครับ (เช่น "KBank Platinum")' });
  }

  if (text === 'บัตรของฉัน') {
    const cards = await cardService.getCards(user.id);
    return reply(event, flows.cardListMessage(cards));
  }

  if (['บันทึกรายจ่าย', 'จ่าย', 'บันทึก'].includes(text)) {
    const cards = await cardService.getCards(user.id);
    if (!cards.length) {
      return reply(event, { type: 'text', text: 'ยังไม่มีบัตรเลยครับ พิมพ์ "เพิ่มบัตร" ก่อนนะครับ' });
    }
    await sessionService.setSession(lineUserId, 'TXN_SELECT_CARD', {});
    return reply(event, flows.cardPickerMessage(cards, 'จ่ายด้วยบัตรไหนครับ', 'txn_select_card'));
  }

  if (text === 'สรุปเดือนนี้') {
    const cards = await cardService.getCards(user.id);
    if (!cards.length) return reply(event, { type: 'text', text: 'ยังไม่มีบัตรเลยครับ' });
    await sessionService.setSession(lineUserId, 'SUMMARY_MONTH_SELECT_CARD', {});
    return reply(event, flows.cardPickerMessage(cards, 'ดูสรุปรอบบิลของบัตรไหนครับ', 'month_summary_card'));
  }

  if (text === 'สรุปปีนี้') {
    const cards = await cardService.getCards(user.id);
    if (!cards.length) return reply(event, { type: 'text', text: 'ยังไม่มีบัตรเลยครับ' });
    await sessionService.setSession(lineUserId, 'SUMMARY_YEAR_SELECT_CARD', {});
    return reply(event, flows.cardPickerMessage(cards, 'ดูสรุปรายปีของบัตรไหนครับ', 'year_summary_card'));
  }

  if (['เช็ควงเงิน', 'limit', 'วงเงิน'].includes(text.toLowerCase())) {
    const cards = await cardService.getCards(user.id);
    if (!cards.length) return reply(event, { type: 'text', text: 'ยังไม่มีบัตรเลยครับ' });
    const messages = await Promise.all(
      cards.slice(0, 5).map(async (c) => {
        const util = await summaryService.getCardUtilization(c);
        return flows.utilizationMessage(c.name, util);
      })
    );
    return reply(event, messages);
  }

  return reply(event, {
    type: 'text',
    text: 'ไม่เข้าใจคำสั่งครับ พิมพ์ "เมนู" เพื่อดูคำสั่งทั้งหมด',
  });
}

async function handleAddCardName(event, user, text) {
  if (!text) {
    return reply(event, { type: 'text', text: 'กรุณาพิมพ์ชื่อบัตรครับ' });
  }
  await sessionService.setSession(user.line_user_id, 'ADD_CARD_LIMIT', { name: text });
  return reply(event, { type: 'text', text: `วงเงินบัตร "${text}" เท่าไหร่ครับ (พิมพ์ตัวเลข เช่น 100000)` });
}

async function handleAddCardLimit(event, user, session, text) {
  const limit = parseFloat(text.replace(/,/g, ''));
  if (isNaN(limit) || limit <= 0) {
    return reply(event, { type: 'text', text: 'กรุณาพิมพ์วงเงินเป็นตัวเลขครับ เช่น 100000' });
  }
  await sessionService.setSession(user.line_user_id, 'ADD_CARD_CUTOFF', { ...session.data, limit });
  return reply(event, { type: 'text', text: 'บัตรนี้ตัดรอบวันที่เท่าไหร่ครับ (พิมพ์ 1-31)' });
}

async function handleAddCardCutoff(event, user, session, text) {
  const cutoffDay = parseInt(text, 10);
  if (isNaN(cutoffDay) || cutoffDay < 1 || cutoffDay > 31) {
    return reply(event, { type: 'text', text: 'กรุณาพิมพ์วันตัดรอบเป็นตัวเลข 1-31 ครับ' });
  }
  const { name, limit } = session.data;
  const card = await cardService.createCard(user.id, name, limit, cutoffDay);
  await sessionService.clearSession(user.line_user_id);
  return reply(event, flows.cardListMessage([card]));
}

async function handleTxnAmount(event, user, session, text) {
  const amount = parseFloat(text.replace(/,/g, ''));
  if (isNaN(amount) || amount <= 0) {
    return reply(event, { type: 'text', text: 'กรุณาพิมพ์จำนวนเงินเป็นตัวเลขครับ เช่น 1500' });
  }
  await sessionService.setSession(user.line_user_id, 'TXN_ASK_INSTALLMENT', { ...session.data, amount });
  return reply(
    event,
    flows.yesNoMessage('รายการนี้ผ่อนชำระไหมครับ', 'txn_installment_yes', 'txn_installment_no')
  );
}

async function handleTxnMonths(event, user, session, text) {
  const months = parseInt(text, 10);
  if (isNaN(months) || months < 2 || months > 60) {
    return reply(event, { type: 'text', text: 'กรุณาพิมพ์จำนวนงวดเป็นตัวเลข 2-60 ครับ' });
  }
  const { cardId, cardName, categoryId, categoryName, amount } = session.data;
  const { schedule } = await transactionService.addTransaction({
    userId: user.id,
    cardId,
    categoryId,
    amount,
    isInstallment: true,
    totalInstallments: months,
  });
  await sessionService.clearSession(user.line_user_id);
  return reply(
    event,
    flows.transactionConfirmMessage({ cardName, categoryName, amount, isInstallment: true, schedule })
  );
}

module.exports = { handle };
