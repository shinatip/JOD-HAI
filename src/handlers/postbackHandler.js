const { client } = require('../config/line');
const sessionService = require('../services/sessionService');
const categoryService = require('../services/categoryService');
const cardService = require('../services/cardService');
const transactionService = require('../services/transactionService');
const summaryService = require('../services/summaryService');
const subscriptionService = require('../services/subscriptionService');
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
    case 'sub_select_card':
      return onSubSelectCard(event, user, session, data);
    case 'sub_select_category':
      return onSubSelectCategory(event, user, session, data);
    case 'cancel_subscription_pick':
      return onCancelSubscription(event, user, data);
    case 'edit_limit_card':
      return onEditLimitCard(event, user, data);
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
  return reply(event, flows.categoryPickerMessage(categories, 'Which category would you like to charge?', 'txn_select_category'));
}

async function onSelectCategory(event, user, session, data) {
  await sessionService.setSession(user.line_user_id, 'TXN_ENTER_AMOUNT', {
    ...session.data,
    categoryId: data.categoryId,
    categoryName: data.categoryName,
  });
  return reply(event, { type: 'text', text: 'Please enter the amount (THB)' });
}

async function onInstallmentYes(event, user, session) {
  await sessionService.setSession(user.line_user_id, 'TXN_ENTER_MONTHS', session.data);
  return reply(event, { type: 'text', text: 'How many months would you like to finance? (Enter a number, e.g., 3, 10)' });
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
  const summary = await summaryService.getCycleSummary(card, cycleEnd);
  await sessionService.clearSession(user.line_user_id);
  return reply(event, flows.cycleSummaryMessage(card.name, summary));
}

async function onYearSummary(event, user, data) {
  const card = await cardService.getCard(data.cardId);
  const year = new Date().getFullYear();
  const summary = await summaryService.getYearSummary(card, year);
  await sessionService.clearSession(user.line_user_id);
  return reply(event, flows.yearSummaryMessage(card.name, summary));
}

async function onSubSelectCard(event, user, session, data) {
  const categories = await categoryService.getCategories();
  await sessionService.setSession(user.line_user_id, 'SUB_SELECT_CATEGORY', {
    ...session.data,
    cardId: data.cardId,
    cardName: data.cardName,
  });
  return reply(event, flows.categoryPickerMessage(categories, 'Which category would you like to subscribe to?', 'sub_select_category'));
}

async function onSubSelectCategory(event, user, session, data) {
  await sessionService.setSession(user.line_user_id, 'SUB_ADD_BILLING_DAY', {
    ...session.data,
    categoryId: data.categoryId,
    categoryName: data.categoryName,
  });
  return reply(event, { type: 'text', text: 'On which day of the month would you like to be billed? (Enter a number between 1 and 31)' });
}

async function onCancelSubscription(event, user, data) {
  await subscriptionService.cancelSubscription(data.subscriptionId);
  return reply(event, { type: 'text', text: `Cancelled "${data.subscriptionName}" successfully. It will not be included in the next summary.` });
}

async function onEditLimitCard(event, user, data) {
  await sessionService.setSession(user.line_user_id, 'EDIT_LIMIT', {
    cardId: data.cardId,
    cardName: data.cardName,
  });
  return reply(event, { type: 'text', text: `Please enter the new credit limit for "${data.cardName}" (THB)` });
}

module.exports = { handle };
