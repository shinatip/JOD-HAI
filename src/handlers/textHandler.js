const { client } = require('../config/line');
const sessionService = require('../services/sessionService');
const cardService = require('../services/cardService');
const categoryService = require('../services/categoryService');
const transactionService = require('../services/transactionService');
const summaryService = require('../services/summaryService');
const subscriptionService = require('../services/subscriptionService');
const flows = require('../bot/flows');

function reply(event, messages) {
  return client.replyMessage(event.replyToken, Array.isArray(messages) ? messages : [messages]);
}

async function handle(event, user) {
  const text = event.message.text.trim();
  const lineUserId = user.line_user_id;
  const session = await sessionService.getSession(lineUserId);

  // console.log(`[text] "${text}" | state=${session.state}`);

  if (text === 'cancel') {
    await sessionService.clearSession(lineUserId);
    return reply(event, { type: 'text', text: 'Cancelled! Type "menu" to see all commands.' });
  }

  switch (session.state) {
    case 'ADD_CARD_NAME':
      return handleAddCardName(event, user, text);
    // case 'ADD_CARD_LIMIT':
    //   return handleAddCardLimit(event, user, session, text);
    case 'ADD_CARD_CUTOFF':
      return handleAddCardCutoff(event, user, session, text);
    case 'TXN_ENTER_AMOUNT':
      return handleTxnAmount(event, user, session, text);
    case 'TXN_ENTER_MONTHS':
      return handleTxnMonths(event, user, session, text);
    case 'SUB_ADD_NAME':
      return handleSubName(event, user, text);
    case 'SUB_ADD_AMOUNT':
      return handleSubAmount(event, user, session, text);
    case 'SUB_ADD_BILLING_DAY':
      return handleSubBillingDay(event, user, session, text);
    case 'EDIT_LIMIT':
      return handleEditLimit(event, user, session, text);
    case 'IDLE':
    default:
      return handleCommand(event, user, text);
  }
}

async function handleCommand(event, user, text) {
  const lineUserId = user.line_user_id;
  const messageText = text.toLowerCase();
  if (['menu', 'help'].includes(messageText)) {
    return reply(event,null);
  }

  if (messageText === 'add card') {
    await sessionService.setSession(lineUserId, 'ADD_CARD_NAME', {});
    return reply(event, { type: 'text', text: 'What would you like to name this card? (e.g., "KBank Platinum") and enter the credit limit separated by a comma.' });
  }

  if (messageText === 'my cards') {
    const cards = await cardService.getCards(user.id);
    return reply(event, flows.cardListMessage(cards));
  }

  if (['save', 'paid'].includes(messageText)) {
    const cards = await cardService.getCards(user.id);
    if (!cards.length) {
      return reply(event, { type: 'text', text: 'You don\'t have any cards yet. Please type "add card" to add your first card.' });
    }
    await sessionService.setSession(lineUserId, 'TXN_SELECT_CARD', {});
    return reply(event, flows.cardPickerMessage(cards, 'Which card would you like to use?', 'txn_select_card'));
  }

  if (messageText === 'summary') {
    const cards = await cardService.getCards(user.id);
    if (!cards.length) return reply(event, { type: 'text', text: 'You don\'t have any cards yet. Please type "add card" to add your first card.' });
    const entries = await Promise.all(
      cards.map(async (card) => {
        const cycleEndDate = summaryService.getCurrentCycleEndDate(card);
        const summary = await summaryService.getCycleSummary(card, cycleEndDate);
        return { card, summary };
      })
    );
    return reply(event, flows.allCardsCycleSummaryMessage(entries));
  }

  if (messageText === 'annual summary') {
    const cards = await cardService.getCards(user.id);
    if (!cards.length) return reply(event, { type: 'text', text: 'You don\'t have any cards yet. Please type "add card" to add your first card.' });
    await sessionService.setSession(lineUserId, 'SUMMARY_YEAR_SELECT_CARD', {});
    return reply(event, flows.cardPickerMessage(cards, 'Which card would you like to see the annual summary for?', 'year_summary_card'));
  }

  if (['check limit', 'limit', 'credit limit'].includes(messageText)) {
    const cards = await cardService.getCards(user.id);
    if (!cards.length) return reply(event, { type: 'text', text: 'You don\'t have any cards yet. Please type "add card" to add your first card.' });
    const messages = await Promise.all(
      cards.slice(0, 5).map(async (c) => {
        const util = await summaryService.getCardUtilization(c);
        return flows.utilizationMessage(c.name, util);
      })
    );
    return reply(event, messages);
  }

  if (messageText === 'add subscription') {
    const cards = await cardService.getCards(user.id);
    if (!cards.length) {
      return reply(event, { type: 'text', text: 'You don\'t have any cards yet. Please type "add card" to add your first card.' });
    }
    await sessionService.setSession(lineUserId, 'SUB_ADD_NAME', {});
    return reply(event, { type: 'text', text: 'What is the name of the subscription you want to add? (e.g., "Netflix")' });
  }

  if (messageText === 'subscriptions') {
    const subs = await subscriptionService.getActiveSubscriptions(user.id);
    return reply(event, flows.subscriptionListMessage(subs));
  }

  if (messageText === 'cancel subscription') {
    const subs = await subscriptionService.getActiveSubscriptions(user.id);
    if (!subs.length) {
      return reply(event, { type: 'text', text: 'You don\'t have any active subscriptions. Type "add subscription" to get started.' });
    }
    return reply(event, flows.cancelSubscriptionPickerMessage(subs));
  }

  if(messageText === 'edit limit') {
    const cards = await cardService.getCards(user.id);
    return reply(event, flows.cardPickerMessage(cards, 'Which card would you like to update limit?', 'edit_limit_card'));
  }

  return reply(event, {
    type: 'text',
    text: 'I don\'t understand that command. Type "menu" to see all available commands.',
  });
}

async function handleAddCardName(event, user, text) {
  console.log(`handleAddCardName: user=${user.line_user_id} | text="${text}"`);
  
  if (!text || text.split(',').length < 2) {
    return reply(event, { type: 'text', text: 'Please enter the card name and credit limit separated by a comma.' });
  }
  const [name, limitText] = text.split(',');
  const limit = parseFloat(limitText.replace(/,/g, ''));
  if (isNaN(limit) || limit <= 0) {
    return reply(event, { type: 'text', text: 'Please enter the credit limit as a number (e.g., 100000).' });
  }
  data = { name: name.trim(), limit };

  await sessionService.setSession(user.line_user_id, 'ADD_CARD_CUTOFF', {...data });
  // console.log(`From handleAddCardName`, sessionService.getSession(user.line_user_id));
  
  return reply(event, { type: 'text', text: `On which day of the month does "${name}" cut off? (Enter a number between 1 and 31)` });

  // await sessionService.setSession(user.line_user_id, 'ADD_CARD_LIMIT', { name: text });
  // return reply(event, { type: 'text', text: `What is the credit limit for "${text}"? (Enter a number, e.g., 100000)` });
}

// async function handleAddCardLimit(event, user, session, text) {
//   const limit = parseFloat(text.replace(/,/g, ''));
//   if (isNaN(limit) || limit <= 0) {
//     return reply(event, { type: 'text', text: 'Please enter the credit limit as a number (e.g., 100000).' });
//   }
//   await sessionService.setSession(user.line_user_id, 'ADD_CARD_CUTOFF', { ...session.data, limit });
//   return reply(event, { type: 'text', text: `On which day of the month does "${session.data.name}" cut off? (Enter a number between 1 and 31)` });
// }

async function handleAddCardCutoff(event, user, session, text) {
  const cutoffDay = parseInt(text, 10);
  if (isNaN(cutoffDay) || cutoffDay < 1 || cutoffDay > 31) {
    return reply(event, { type: 'text', text: 'Please enter the cutoff day as a number between 1 and 31.' });
  }

  
  const { name, limit } = session.data;
  const card = await cardService.createCard(user.id, name, limit, cutoffDay);
  await sessionService.clearSession(user.line_user_id);
  return reply(event, flows.cardListMessage([card]));
}

async function handleTxnAmount(event, user, session, text) {
  const amount = parseFloat(text.replace(/,/g, ''));
  if (isNaN(amount) || amount <= 0) {
    return reply(event, { type: 'text', text: 'Please enter the transaction amount as a number (e.g., 1500).' });
  }
  await sessionService.setSession(user.line_user_id, 'TXN_ASK_INSTALLMENT', { ...session.data, amount });
  return reply(
    event,
    flows.yesNoMessage('Is this an installment transaction?', 'txn_installment_yes', 'txn_installment_no')
  );
}

async function handleTxnMonths(event, user, session, text) {
  const months = parseInt(text, 10);
  if (isNaN(months) || months < 2 || months > 60) {
    return reply(event, { type: 'text', text: 'Please enter the number of installments as a number between 2 and 60.' });
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

async function handleEditLimit(event, user, session, text) {
  const newLimit = parseFloat(text.replace(/,/g, ''));
  if (isNaN(newLimit) || newLimit <= 0) {
    return reply(event, { type: 'text', text: 'Please enter the new credit limit as a number (e.g., 100000).' });
  }
  const card = await cardService.updateLimit(session.data.cardId, newLimit);
  await sessionService.clearSession(user.line_user_id);
  return reply(event, { type: 'text', text: `Updated credit limit for "${card.name}" to ${newLimit} THB.` });
}

async function handleSubName(event, user, text) {
  if (!text) {
    return reply(event, { type: 'text', text: 'Please enter the subscription name.' });
  }
  await sessionService.setSession(user.line_user_id, 'SUB_ADD_AMOUNT', { name: text });
  return reply(event, { type: 'text', text: `"${text}" How much is the monthly fee? (Enter a number)` });
}

async function handleSubAmount(event, user, session, text) {
  const amount = parseFloat(text.replace(/,/g, ''));
  if (isNaN(amount) || amount <= 0) {
    return reply(event, { type: 'text', text: 'Please enter the monthly fee as a number (e.g., 169).' });
  }
  const cards = await cardService.getCards(user.id);
  await sessionService.setSession(user.line_user_id, 'SUB_SELECT_CARD', { ...session.data, amount });
  return reply(event, flows.cardPickerMessage(cards, 'Which card would you like to use?', 'sub_select_card'));
}

async function handleSubBillingDay(event, user, session, text) {
  const billingDay = parseInt(text, 10);
  if (isNaN(billingDay) || billingDay < 1 || billingDay > 31) {
    return reply(event, { type: 'text', text: 'Please enter the billing day as a number between 1 and 31.' });
  }
  const { name, amount, cardId, cardName, categoryId, categoryName } = session.data;
  await subscriptionService.createSubscription({
    userId: user.id,
    cardId,
    categoryId,
    name,
    amount,
    billingDay,
  });
  await sessionService.clearSession(user.line_user_id);
  return reply(event, flows.subscriptionConfirmMessage({ name, amount, cardName, categoryName, billingDay }));
}

module.exports = { handle };
