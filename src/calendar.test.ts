import { describe, expect, it } from 'vitest'
import {
  calendarRange,
  eventLabel,
  eventsForDay,
  validateCalendarEvents,
  weekStart,
} from './calendar'

describe('calendario settimanale italiano', () => {
  it('include sette giorni locali anche al cambio dell’ora legale', () => {
    expect(calendarRange('2026-10-23')).toEqual({
      start: '2026-10-18T22:00:00.000Z',
      end: '2026-10-25T23:00:00.000Z',
    })
    expect(calendarRange('2026-03-27')).toEqual({
      start: '2026-03-22T23:00:00.000Z',
      end: '2026-03-29T22:00:00.000Z',
    })
  })
  it('mostra eventi di più giorni senza includere il giorno finale esclusivo', () => {
    const holiday = {
      summary: 'Vacanza',
      start: '2026-10-26',
      end: '2026-10-28',
    }
    expect(eventsForDay([holiday], '2026-10-27')).toEqual([holiday])
    expect(eventsForDay([holiday], '2026-10-28')).toEqual([])
    expect(eventLabel(holiday, '2026-10-27')).toBe('Tutto il giorno')
  })
  it('converte gli orari UTC in Europe/Rome e mostra gli eventi a cavallo della mezzanotte', () => {
    const event = {
      summary: 'Turno',
      start: '2026-10-26T22:30:00Z',
      end: '2026-10-27T01:00:00Z',
    }
    expect(eventLabel(event, '2026-10-26')).toBe('23:30')
    expect(eventLabel(event, '2026-10-27')).toBe('In corso')
    expect(eventsForDay([event], '2026-10-27')).toEqual([event])
    expect(eventsForDay([event], '2026-10-28')).toEqual([])
  })
  it('rifiuta risposte malformate senza farle apparire come calendario vuoto', () => {
    expect(() => validateCalendarEvents(undefined)).toThrow()
    expect(() =>
      validateCalendarEvents([
        { summary: 'Rotto', start: 'invalid', end: 'invalid' },
      ]),
    ).toThrow()
    expect(validateCalendarEvents([])).toEqual([])
  })
})

it('mantiene il lunedì come primo giorno anche a metà settimana, domenica e a cavallo dell’anno', () => {
  expect(weekStart('2026-10-28')).toBe('2026-10-26')
  expect(weekStart('2026-11-01')).toBe('2026-10-26')
  expect(weekStart('2027-01-01')).toBe('2026-12-28')
})
