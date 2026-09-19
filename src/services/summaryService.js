const supabase = require('../config/supabase');
const subscriptionService = require('./subscriptionService');
const { getBillingCycleEnd, subscriptionOccursInCycle, dateToISO, round2 } = require('../utils/billing');

/** The statement that is currently open (not yet cut off) for this card. */
function getCurrentCycleEndDate(card) {
  return getBillingCycleEnd(new Date(), card.cutoff_day);
}

/**
 * Total + per-category breakdown for a single statement (billing cycle).
 * Combines real billing_items (one-off purchases + installments) with any
 * active subscriptions whose billing_day falls inside this cycle, computed
 * on the fly (subscriptions never get their own billing_items rows).
 */
async function getCycleSummary(card, cycleEndDate) {
  const iso = dateToISO(cycleEndDate);

  const [{ data: items, error: e1 }, subscriptions] = await Promise.all([
    supabase
      .from('billing_items')
      .select('amount, category_id, categories(name)')
      .eq('card_id', card.id)
      .eq('cycle_end_date', iso),
    subscriptionService.getActiveSubscriptionsForCard(card.id),
  ]);
  if (e1) throw e1;

  const byCategory = {};
  let total = 0;

  for (const row of items) {
    const name = row.categories?.name || 'อื่นๆ';
    byCategory[name] = (byCategory[name] || 0) + Number(row.amount);
    total += Number(row.amount);
  }

  for (const sub of subscriptions) {
    const occurs = subscriptionOccursInCycle({
      billingDay: sub.billing_day,
      cutoffDay: card.cutoff_day,
      cycleEndDate,
      startDate: sub.start_date,
    });
    if (!occurs) continue;
    const name = sub.categories?.name || 'อื่นๆ';
    byCategory[name] = (byCategory[name] || 0) + Number(sub.amount);
    total += Number(sub.amount);
  }

  const categories = Object.entries(byCategory)
    .map(([name, amount]) => ({ name, amount: round2(amount) }))
    .sort((a, b) => b.amount - a.amount);

  return { cycleEndDate: iso, total: round2(total), categories };
}

/**
 * Yearly summary for a card, grouped by the month each statement cuts off in.
 * `year` groups by the cycle_end_date's year (i.e. which statement it billed on).
 * Includes subscription contributions the same way as getCycleSummary.
 */
async function getYearSummary(card, year) {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const [{ data: items, error: e1 }, subscriptions] = await Promise.all([
    supabase
      .from('billing_items')
      .select('amount, cycle_end_date, category_id, categories(name)')
      .eq('card_id', card.id)
      .gte('cycle_end_date', start)
      .lte('cycle_end_date', end),
    subscriptionService.getActiveSubscriptionsForCard(card.id),
  ]);
  if (e1) throw e1;

  const byMonth = Array(12).fill(0);
  const byCategory = {};
  let total = 0;

  for (const row of items) {
    const monthIndex = new Date(row.cycle_end_date).getMonth();
    byMonth[monthIndex] += Number(row.amount);
    const name = row.categories?.name || 'อื่นๆ';
    byCategory[name] = (byCategory[name] || 0) + Number(row.amount);
    total += Number(row.amount);
  }

  // For each month of the year, check whether each subscription's charge
  // would have landed in that month's cycle, and add it in if so.
  for (let m = 0; m < 12; m++) {
    const properCycleEnd = getBillingCycleEnd(new Date(year, m, 1), card.cutoff_day);
    for (const sub of subscriptions) {
      const occurs = subscriptionOccursInCycle({
        billingDay: sub.billing_day,
        cutoffDay: card.cutoff_day,
        cycleEndDate: properCycleEnd,
        startDate: sub.start_date,
      });
      if (!occurs) continue;
      byMonth[m] += Number(sub.amount);
      const name = sub.categories?.name || 'อื่นๆ';
      byCategory[name] = (byCategory[name] || 0) + Number(sub.amount);
      total += Number(sub.amount);
    }
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
 * as each cycle passes. Active subscriptions add their amount if the
 * currently-open cycle includes a charge (assumed unpaid until that
 * statement's cutoff has passed).
 */
async function getCardUtilization(card) {
  const todayIso = dateToISO(new Date());

  const [{ data: allItems, error: e1 }, { data: pastItems, error: e2 }, subscriptions] = await Promise.all([
    supabase.from('billing_items').select('transaction_id, amount').eq('card_id', card.id),
    supabase.from('billing_items').select('transaction_id, amount').eq('card_id', card.id).lt('cycle_end_date', todayIso),
    subscriptionService.getActiveSubscriptionsForCard(card.id),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const totalAll = allItems.reduce((sum, r) => sum + Number(r.amount), 0);
  const totalPast = pastItems.reduce((sum, r) => sum + Number(r.amount), 0);
  let outstanding = totalAll - totalPast;

  const currentCycleEnd = getCurrentCycleEndDate(card);
  for (const sub of subscriptions) {
    const occurs = subscriptionOccursInCycle({
      billingDay: sub.billing_day,
      cutoffDay: card.cutoff_day,
      cycleEndDate: currentCycleEnd,
      startDate: sub.start_date,
    });
    if (occurs) outstanding += Number(sub.amount);
  }

  outstanding = round2(outstanding);
  const available = round2(Number(card.credit_limit) - outstanding);
  const pct = card.credit_limit > 0 ? round2((outstanding / card.credit_limit) * 100) : 0;

  return { outstanding, available, limit: Number(card.credit_limit), pct };
}

module.exports = { getCurrentCycleEndDate, getCycleSummary, getYearSummary, getCardUtilization };
