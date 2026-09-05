const { client } = require('../config/line');
const sessionService = require('../services/sessionService');
const categoryService = require('../services/categoryService');
const cardService = require('../services/cardService');
const transactionService = require('../services/transactionService');
const summaryService = require('../services/summaryService');
const flows = require('../bot/flows');

function reply(event, messages) {
  return client.replyMessage(event.replyToken, Array.isArray(messages) ? messages : [messages]);
}

async function handle(event, user) {
  const data = JSON.parse(event.postback.data);
  const lineUserId = user.line_user_id;
  const session = await sessionService.getSession(lineUserId);

  switch (data.action) {
    case 'txn_select_card':
      return onSelectCard(event, user, session, data);
    case 'txn_select_category':
      return onSelectCategory(event, user, session, data);
    case 'txn_installment_yes':
      return onInstallmentYes(event, user, session);
    case 'txn_installment_no':
      return onInstallmentNo(event, user, session);
    case 'month_summary_card':
      return onMonthSummary(event, user, data);
    case 'year_summary_card':
      return onYearSummary(event, user, data);
    default:
      return reply(event, { type: 'text', text: 'ไม่เข้าใจการเลือกนี้ครับ พิมพ์ "เมนู" เพื่อเริ่มใหม่' });
  }
}

async function onSelectCard(event, user, session, data) {
  const categories = await categoryService.getCategories();
  await sessionService.setSession(user.line_user_id, 'TXN_SELECT_CATEGORY', {
    ...session.data,
    cardId: data.cardId,
    cardName: data.cardName,
  });
  return reply(event, flows.categoryPickerMessage(categories, 'จ่ายหมวดไหนครับ', 'txn_select_category'));
}

async function onSelectCategory(event, user, session, data) {
  await sessionService.setSession(user.line_user_id, 'TXN_ENTER_AMOUNT', {
    ...session.data,
    categoryId: data.categoryId,
    categoryName: data.categoryName,
  });
  return reply(event, { type: 'text', text: 'พิมพ์จำนวนเงินครับ (บาท)' });
}

async function onInstallmentYes(event, user, session) {
  await sessionService.setSession(user.line_user_id, 'TXN_ENTER_MONTHS', session.data);
  return reply(event, { type: 'text', text: 'ผ่อนกี่เดือนครับ (พิมพ์ตัวเลข เช่น 3, 10)' });
}

async function onInstallmentNo(event, user, session) {
  const { cardId, cardName, categoryId, categoryName, amount } = session.data;
  const { schedule } = await transactionService.addTransaction({
    userId: user.id,
    cardId,
    categoryId,
    amount,
    isInstallment: false,
  });
  await sessionService.clearSession(user.line_user_id);
  return reply(
    event,
    flows.transactionConfirmMessage({ cardName, categoryName, amount, isInstallment: false, schedule })
  );
}

async function onMonthSummary(event, user, data) {
  const card = await cardService.getCard(data.cardId);
  const cycleEnd = summaryService.getCurrentCycleEndDate(card);
  const summary = await summaryService.getCycleSummary(card.id, cycleEnd);
  await sessionService.clearSession(user.line_user_id);
  return reply(event, flows.cycleSummaryMessage(card.name, summary));
}

async function onYearSummary(event, user, data) {
  const card = await cardService.getCard(data.cardId);
  const year = new Date().getFullYear();
  const summary = await summaryService.getYearSummary(card.id, year);
  await sessionService.clearSession(user.line_user_id);
  return reply(event, flows.yearSummaryMessage(card.name, summary));
}

module.exports = { handle };
