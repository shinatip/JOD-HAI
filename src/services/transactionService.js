const supabase = require('../config/supabase');
const cardService = require('./cardService');
const { generateBillingSchedule, dateToISO } = require('../utils/billing');

/**
 * Saves a purchase and expands it into one or more billing_items rows
 * (one per future statement, for installments).
 */
async function addTransaction({ userId, cardId, categoryId, amount, isInstallment, totalInstallments, note }) {
  const card = await cardService.getCard(cardId);
  const transactionDate = new Date();

  const { data: txn, error: txnErr } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      card_id: cardId,
      category_id: categoryId,
      amount,
      transaction_date: dateToISO(transactionDate),
      note: note || null,
      is_installment: !!isInstallment,
      total_installments: isInstallment ? totalInstallments : null,
    })
    .select()
    .single();
  if (txnErr) throw txnErr;

  const schedule = generateBillingSchedule({
    transactionDate,
    cutoffDay: card.cutoff_day,
    amount,
    isInstallment,
    months: totalInstallments,
  });

  const rows = schedule.map((s) => ({
    transaction_id: txn.id,
    card_id: cardId,
    user_id: userId,
    category_id: categoryId,
    cycle_end_date: dateToISO(s.cycle_end_date),
    amount: s.amount,
    installment_no: s.installment_no,
  }));

  const { error: biErr } = await supabase.from('billing_items').insert(rows);
  if (biErr) throw biErr;

  return { transaction: txn, schedule };
}

module.exports = { addTransaction };
