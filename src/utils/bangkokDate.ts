// The office works on Thai time; a UTC date stamps anything done before
// 07:00 as the previous day.
const BANGKOK_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's calendar date in Asia/Bangkok as `YYYY-MM-DD`. */
export function bangkokToday(now: Date = new Date()): string {
  return BANGKOK_DATE.format(now);
}
