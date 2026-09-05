function baht(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

function thaiDate(d) {
  const date = new Date(d);
  return `${date.getDate()} ${THAI_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function thaiMonthShort(monthIndex) {
  return THAI_MONTHS[monthIndex];
}

// Truncate a label so it stays inside LINE quick-reply's 20-char limit.
function truncateLabel(s, max = 20) {
  if (!s) return s;
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

module.exports = { baht, thaiDate, thaiMonthShort, truncateLabel };
