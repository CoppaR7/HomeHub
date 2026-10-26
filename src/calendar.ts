import { currentDateKey } from './model'

export type CalendarEvent = {
  summary: string
  start: string
  end: string
  location?: string
}
export function addDays(key: string, days: number) {
  const date = new Date(`${key}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
// Resolve local midnights separately: a seven-day range can cross a DST change.
export function romeMidnight(key: string) {
  const target = Date.parse(`${key}T00:00:00Z`)
  let timestamp = target
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Rome',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(timestamp))
    const part = (name: string) => parts.find((p) => p.type === name)!.value
    const rendered = Date.parse(
      `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}Z`,
    )
    timestamp += target - rendered
  }
  return new Date(timestamp).toISOString()
}
export function calendarRange(today: string) {
  return { start: romeMidnight(today), end: romeMidnight(addDays(today, 7)) }
}
function eventTime(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? Date.parse(romeMidnight(value))
    : Date.parse(value)
}
export function validateCalendarEvents(value: unknown): CalendarEvent[] {
  if (
    !Array.isArray(value) ||
    value.some(
      (event) =>
        !event ||
        typeof event.summary !== 'string' ||
        typeof event.start !== 'string' ||
        typeof event.end !== 'string' ||
        !Number.isFinite(eventTime(event.start)) ||
        !Number.isFinite(eventTime(event.end)) ||
        eventTime(event.end) <= eventTime(event.start) ||
        (event.location != null && typeof event.location !== 'string'),
    )
  )
    throw new Error(
      'Home Assistant non ha restituito gli eventi del calendario.',
    )
  return value
}
export function eventsForDay(events: CalendarEvent[], day: string) {
  const start = Date.parse(romeMidnight(day))
  const end = Date.parse(romeMidnight(addDays(day, 1)))
  return events
    .filter(
      (event) => eventTime(event.start) < end && eventTime(event.end) > start,
    )
    .sort(
      (a, b) =>
        eventTime(a.start) - eventTime(b.start) ||
        a.summary.localeCompare(b.summary, 'it'),
    )
}
export function eventLabel(event: CalendarEvent, day: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(event.start)) return 'Tutto il giorno'
  if (currentDateKey(new Date(event.start)) < day) return 'In corso'
  return new Date(event.start).toLocaleTimeString('it-IT', {
    timeZone: 'Europe/Rome',
    hour: '2-digit',
    minute: '2-digit',
  })
}
