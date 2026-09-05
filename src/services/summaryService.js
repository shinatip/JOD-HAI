const supabase = require('../config/supabase');
const { getBillingCycleEnd, dateToISO, round2 } = require('../utils/billing');

/** The statement that is currently open (not yet cut off) for this card. */
function getCurrentCycleEndDate(card) {
  return getBillingCycleEnd(new Date(), card.cutoff_day);
}

/**
 * Total + per-category breakdown for a single statement (billing cycle).
 */
async function getCycleSummary(cardId, cycleEndDate) {
  const iso = dateToISO(cycleEndDate);
  const { data, error } = await supabase
    .from('billing_items')
    .select('amount, category_id, categories(name)')
    .eq('card_id', cardId)
    .eq('cycle_end_date', iso);
  if (error) throw error;

  const byCategory = {};
  let total = 0;
  for (const row of data) {
    const name = row.categories?.name || 'อื่นๆ';
    byCategory[name] = (byCategory[name] || 0) + Number(row.amount);
    total += Number(row.amount);
  }

  const categories = Object.entries(byCategory)
    .map(([name, amount]) => ({ name, amount: round2(amount) }))
    .sort((a, b) => b.amount - a.amount);

  return { cycleEndDate: iso, total: round2(total), categories };
}

/**
 * Yearly summary for a card, grouped by the month each statement cuts off in.
 * `year` groups by the cycle_end_date's year (i.e. which statement it billed on).
 */
async function getYearSummary(cardId, year) {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const { data, error } = await supabase
    .from('billing_items')
    .select('amount, cycle_end_date, category_id, categories(name)')
    .eq('card_id', cardId)
    .gte('cycle_end_date', start)
    .lte('cycle_end_date', end);
  if (error) throw error;

  const byMonth = Array(12).fill(0);
  const byCategory = {};
  let total = 0;
  for (const row of data) {
    const monthIndex = new Date(row.cycle_end_date).getMonth();
    byMonth[monthIndex] += Number(row.amount);
    const name = row.categories?.name || 'อื่นๆ';
    byCategory[name] = (byCategory[name] || 0) + Number(row.amount);
    total += Number(row.amount);
  }

  const categories = Object.entries(byCategory)
    .map(([name, amount]) => ({ name, amount: round2(amount) }))
    .sort((a, b) => b.amount - a.amount);

  return {
    year,
    total: round2(total),
    byMonth: byMonth.map(round2),
    categories,
  };
}

/**
 * Credit-limit utilization. Assumption: a purchase (installment or not)
 * consumes its FULL amount against the limit from the moment of purchase
 * (matching how real credit cards behave). It stops counting once its
 * billing_item's cycle_end_date is in the past (i.e. assumed billed & paid).
 * For an installment, this naturally frees up limit installment-by-installment
 * as each cycle passes.
 */
async function getCardUtilization(card) {
  const todayIso = dateToISO(new Date());

  const [{ data: allItems, error: e1 }, { data: pastItems, error: e2 }] = await Promise.all([
    supabase.from('billing_items').select('transaction_id, amount').eq('card_id', card.id),
    supabase.from('billing_items').select('transaction_id, amount').eq('card_id', card.id).lt('cycle_end_date', todayIso),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const totalAll = allItems.reduce((sum, r) => sum + Number(r.amount), 0);
  const totalPast = pastItems.reduce((sum, r) => sum + Number(r.amount), 0);
  const outstanding = round2(totalAll - totalPast);
  const available = round2(Number(card.credit_limit) - outstanding);
  const pct = card.credit_limit > 0 ? round2((outstanding / card.credit_limit) * 100) : 0;

  return { outstanding, available, limit: Number(card.credit_limit), pct };
}

module.exports = { getCurrentCycleEndDate, getCycleSummary, getYearSummary, getCardUtilization };
