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
    postbackItem('Yes', yesAction),
    postbackItem('No', noAction),
  ]);
}

// function helpMessage() {
//   return {
//     type: 'text',
//     text:
//       '💳 Commands\n\n' +
//       '• "add card" - Add a new card\n' +
//       '• "my cards" - View all cards\n' +
//       '• "save" - Save a new transaction\n' +
//       '• "summary"\n\t - View current billing cycle\n\tsummary for all cards\n' +
//       '• "annual summary"\n\t - View annual summary for the\n\tselected card\n' +
//       '• "limit"\n\t - View available credit for all\n\tcards\n' +
//       '• "add subscription"\n\t - Add a new subscription\n\t(Netflix, Spotify etc.)\n' +
//       '• "subscriptions"\n\t - View all active subscriptions\n' +
//       '• "cancel subscription"\n\t - Cancel an active subscription\n' +
//       '• "cancel" - Cancel the current\n\toperation',
//   };
// }

function cardListMessage(cards) {
  if (!cards.length) {
    return { type: 'text', text: 'You don\'t have any cards yet. Please type "add card" to add your first card.' };
  }
  const lines = cards.map(
    (c) => `💳 ${c.name}\n   limit: ${baht(c.credit_limit)} baht | settlement date: ${c.cutoff_day}`
  );
  return { type: 'text', text: lines.join('\n\n') };
}

function allCardsCycleSummaryMessage(entries) {
  // entries: [{ card, cycleEndDate, summary }]
  const today = thaiDate(new Date());
  let text = `📊 Summary of Current Billing Cycle (as of ${today})\n`;

  for (const { card, summary } of entries) {
    text += `\n━━━━━━━━━━\n💳 ${card.name} (Billing date: ${card.cutoff_day})\n`;
    text += `This Cycle Ends: ${thaiDate(summary.cycleEndDate)}\n`;
    text += `Total So Far: ${baht(summary.total)} baht\n`;
    if (summary.categories.length) {
      text += summary.categories.map((c) => `  • ${c.name}: ${baht(c.amount)} baht`).join('\n');
    } else {
      text += `  No transactions in this cycle.`;
    }
  }

  const grandTotal = entries.reduce((sum, e) => sum + e.summary.total, 0);
  text += `\n━━━━━━━━━━\n💰 Total for All Cards: ${baht(grandTotal)} baht`;

  return { type: 'text', text };
}

function subscriptionConfirmMessage({ name, amount, cardName, categoryName, billingDay }) {
  return {
    type: 'text',
    text:
      `✅ Subscription added successfully\n\n` +
      `📺 ${name}\n💳 card: ${cardName}\n🏷️ category: ${categoryName}\n` +
      `💰 ${baht(amount)} baht/month\n📆 billed on day ${billingDay}\n\n` +
      `The system will automatically include this in your monthly/yearly summaries. No need to key it in again.`,
  };
}

function subscriptionListMessage(subscriptions) {
  if (!subscriptions.length) {
    return { type: 'text', text: 'You don\'t have any active subscriptions. Type "add subscription" to get started.' };
  }
  const lines = subscriptions.map(
    (s) =>
      `📺 ${s.name}\n   ${baht(s.amount)} baht/month | card: ${s.cards?.name || '-'} | billed on day ${s.billing_day}`
  );
  return { type: 'text', text: '📋 active subscriptions\n\n' + lines.join('\n\n') };
}

function cancelSubscriptionPickerMessage(subscriptions) {
  const items = subscriptions
    .slice(0, 13)
    .map((s) => postbackItem(`${s.name} (${baht(s.amount)})`, 'cancel_subscription_pick', { subscriptionId: s.id, subscriptionName: s.name }));
  return quickReplyText('Which subscription would you like to cancel?', items);
}

function transactionConfirmMessage({ cardName, categoryName, amount, isInstallment, schedule }) {
  let text = `✅ Transaction has been saved\n\n💳 card: ${cardName}\n🏷️ category: ${categoryName}\n💰 amount: ${baht(amount)} baht\n`;
  if (isInstallment) {
    text += `📆 installment: ${schedule.length} months (monthly: ${baht(schedule[0].amount)} baht)\n`;
    text += `Start billing on: ${thaiDate(schedule[0].cycle_end_date)}\n`;
    text += `Final installment on: ${thaiDate(schedule[schedule.length - 1].cycle_end_date)}`;
  } else {
    text += `📆 billed on: ${thaiDate(schedule[0].cycle_end_date)}`;
  }
  return { type: 'text', text };
}

function cycleSummaryMessage(cardName, summary) {
  let text = `📊 cycle summary - ${cardName}\ncut-off date: ${thaiDate(summary.cycleEndDate)}\n\ntotal: ${baht(summary.total)} baht\n`;
  if (summary.categories.length) {
    text += `\nbreakdown by category (high to low):\n`;
    text += summary.categories.map((c) => `• ${c.name}: ${baht(c.amount)} baht`).join('\n');
  } else {
    text += `\nno transactions in this cycle`;
  }
  return { type: 'text', text };
}

function yearSummaryMessage(cardName, summary) {
  let text = `📊 Annual summary ${summary.year} - ${cardName}\n\n`;
  text += summary.byMonth
    .map((amt, i) => `${thaiMonthShort(i)}: ${baht(amt)}`)
    .join('\n');
  text += `\n\ntotal for the year: ${baht(summary.total)} baht`;
  if (summary.categories.length) {
    text += `\n\nbreakdown by category (high to low):\n`;
    text += summary.categories.map((c) => `• ${c.name}: ${baht(c.amount)} baht`).join('\n');
  }
  return { type: 'text', text };
}

function utilizationMessage(cardName, util) {
  const bar = buildBar(util.pct);
  return {
    type: 'text',
    text:
      `💳 ${cardName}\n` +
      `limit: ${baht(util.limit)} baht\n` +
      `used: ${baht(util.outstanding)} baht (${util.pct}%)\n` +
      `available: ${baht(util.available)} baht\n` +
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
  // helpMessage,
  cardListMessage,
  transactionConfirmMessage,
  cycleSummaryMessage,
  allCardsCycleSummaryMessage,
  yearSummaryMessage,
  utilizationMessage,
  subscriptionConfirmMessage,
  subscriptionListMessage,
  cancelSubscriptionPickerMessage,
};
