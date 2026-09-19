/**
 * Core billing-cycle math.
 *
 * A card has a `cutoff_day` (1-31). A statement "cycle" ends on the cutoff
 * date of a given month. A transaction belongs to the first cycle whose
 * cutoff date is on or after the transaction date:
 *
 *   cutoff_day = 15
 *   buy on Sep 10  -> belongs to cycle ending Sep 15
 *   buy on Sep 20  -> belongs to cycle ending Oct 15 (Sep 15 already passed)
 *
 * If cutoff_day doesn't exist in a given month (e.g. 31 in February), it is
 * clamped to the last day of that month.
 */

function toDateOnly(d) {
  const date = new Date(d);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysInMonth(year, monthIndex /* 0-11 */) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function cutoffDateForMonth(year, monthIndex, cutoffDay) {
  const day = Math.min(cutoffDay, daysInMonth(year, monthIndex));
  return new Date(year, monthIndex, day);
}

function getBillingCycleEnd(transactionDate, cutoffDay) {
  const d = toDateOnly(transactionDate);
  const year = d.getFullYear();
  const monthIndex = d.getMonth();
  const cutoffThisMonth = cutoffDateForMonth(year, monthIndex, cutoffDay);

  if (d <= cutoffThisMonth) {
    return cutoffThisMonth;
  }
  let nextMonth = monthIndex + 1;
  let nextYear = year;
  if (nextMonth > 11) {
    nextMonth = 0;
    nextYear += 1;
  }
  return cutoffDateForMonth(nextYear, nextMonth, cutoffDay);
}

function getNextCycleEnd(cycleEndDate, cutoffDay) {
  const d = toDateOnly(cycleEndDate);
  let nextMonth = d.getMonth() + 1;
  let nextYear = d.getFullYear();
  if (nextMonth > 11) {
    nextMonth = 0;
    nextYear += 1;
  }
  return cutoffDateForMonth(nextYear, nextMonth, cutoffDay);
}

/**
 * Splits a purchase into per-cycle billing_items rows.
 * Non-installment purchases produce exactly one row.
 * Installment purchases produce `months` rows, one per future cycle,
 * starting from the cycle right after the purchase date. Any rounding
 * remainder is absorbed into the last installment so the sum is exact.
 */
function generateBillingSchedule({ transactionDate, cutoffDay, amount, isInstallment, months }) {
  if (!isInstallment || !months || months <= 1) {
    return [
      {
        installment_no: null,
        cycle_end_date: getBillingCycleEnd(transactionDate, cutoffDay),
        amount: round2(amount),
      },
    ];
  }

  const base = Math.floor((amount / months) * 100) / 100;
  const schedule = [];
  let cycleEnd = getBillingCycleEnd(transactionDate, cutoffDay);
  let allocated = 0;

  for (let i = 0; i < months; i++) {
    const isLast = i === months - 1;
    const amt = isLast ? round2(amount - allocated) : base;
    if (!isLast) allocated += base;
    schedule.push({ installment_no: i + 1, cycle_end_date: cycleEnd, amount: amt });
    cycleEnd = getNextCycleEnd(cycleEnd, cutoffDay);
  }
  return schedule;
}

/**
 * Subscriptions (Netflix, Spotify, etc.) recur indefinitely on a fixed
 * `billing_day` each month, so unlike installments we never pre-generate
 * rows for them. Instead, this checks — at query time — whether a given
 * subscription would have charged at some point during a specific billing
 * cycle, using the same cutoff-date math as everything else. A cycle
 * spans about a month, so exactly one candidate charge date normally
 * falls inside it (checked against both the cycle's month and the
 * month before it, to be safe around month boundaries).
 */
function subscriptionOccursInCycle({ billingDay, cutoffDay, cycleEndDate, startDate }) {
  const cycleEndISO = dateToISO(cycleEndDate);
  const d = toDateOnly(cycleEndDate);
  const monthsToCheck = [
    { y: d.getFullYear(), m: d.getMonth() },
    { y: d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear(), m: d.getMonth() === 0 ? 11 : d.getMonth() - 1 },
  ];

  for (const { y, m } of monthsToCheck) {
    const candidate = cutoffDateForMonth(y, m, billingDay);
    if (startDate && toDateOnly(candidate) < toDateOnly(startDate)) continue;
    const candidateCycle = getBillingCycleEnd(candidate, cutoffDay);
    if (dateToISO(candidateCycle) === cycleEndISO) return true;
  }
  return false;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function dateToISO(d) {
  const date = toDateOnly(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

module.exports = {
  getBillingCycleEnd,
  getNextCycleEnd,
  generateBillingSchedule,
  subscriptionOccursInCycle,
  dateToISO,
  round2,
};
