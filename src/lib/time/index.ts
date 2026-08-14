/**
 * Timezone helpers shared by timeline reconstruction and seed/fixtures.
 * Store UTC in DB; interpret wall-clock times in the user's timezone.
 */

export function nextDate(date: string): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

export function timeZoneOffsetMilliseconds(timestamp: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(timestamp);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
  );
  const renderedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );
  return renderedAsUtc - timestamp.getTime();
}

/** Convert a local wall-clock date+time in `timezone` to a UTC Date. */
export function zonedDateTime(date: string, time: string, timezone: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
  const firstPass = new Date(utcGuess - timeZoneOffsetMilliseconds(new Date(utcGuess), timezone));
  const secondOffset = timeZoneOffsetMilliseconds(firstPass, timezone);
  return new Date(utcGuess - secondOffset);
}
