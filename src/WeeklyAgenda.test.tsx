import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import WeeklyAgenda from './WeeklyAgenda'
import { homeAssistant, type HomeSnapshot } from './home-assistant'
import { useHomeAssistant } from './useHomeAssistant'
vi.mock('./useHomeAssistant', () => ({ useHomeAssistant: vi.fn() }))
let home: HomeSnapshot
const meeting = {
  summary: 'Dentista',
  start: '2026-10-26T09:00:00+01:00',
  end: '2026-10-26T10:00:00+01:00',
}
beforeEach(() => {
  localStorage.clear()
  home = {
    enabled: true,
    url: '',
    status: 'connected',
    pending: [],
    error: '',
    entities: {
      'calendar.famiglia': {
        entity_id: 'calendar.famiglia',
        state: 'off',
        attributes: { friendly_name: 'Famiglia' },
        last_changed: '',
        last_updated: '',
        context: { id: '', parent_id: null, user_id: null },
      },
    },
    shopping: { items: [], pending: [], status: 'idle', error: '' },
  }
  vi.mocked(useHomeAssistant).mockImplementation(() => home)
  vi.spyOn(homeAssistant, 'getCalendarEvents').mockResolvedValue([meeting])
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})
it('richiede una scelta esplicita e salva solo l’entità scelta', async () => {
  render(<WeeklyAgenda today="2026-10-26" />)
  expect(homeAssistant.getCalendarEvents).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Calendario Home Assistant'), {
    target: { value: 'calendar.famiglia' },
  })
  expect(await screen.findByText('Dentista')).toBeVisible()
  expect(screen.getByText('09:00')).toBeVisible()
  expect(localStorage.getItem('homehub.calendar')).toBe('calendar.famiglia')
  expect(homeAssistant.getCalendarEvents).toHaveBeenCalledWith(
    'calendar.famiglia',
    '2026-10-25T23:00:00.000Z',
    '2026-11-01T23:00:00.000Z',
  )
})
it('distingue errore, nessun evento e disconnessione', async () => {
  localStorage.setItem('homehub.calendar', 'calendar.famiglia')
  vi.mocked(homeAssistant.getCalendarEvents).mockRejectedValueOnce(
    new Error('Accesso negato'),
  )
  const view = render(<WeeklyAgenda today="2026-10-26" />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Accesso negato')
  vi.mocked(homeAssistant.getCalendarEvents).mockResolvedValue([])
  fireEvent.click(screen.getByRole('button', { name: 'Aggiorna impegni' }))
  await waitFor(() =>
    expect(screen.getAllByText('Nessun impegno')).toHaveLength(7),
  )
  home = { ...home, status: 'disconnected' }
  view.rerender(<WeeklyAgenda today="2026-10-26" />)
  expect(screen.getByText(/Calendario non disponibile:/)).toBeVisible()
  expect(screen.queryAllByText('Nessun impegno')).toHaveLength(0)
})
it('ignora risposte precedenti se cambia il calendario', async () => {
  localStorage.setItem('homehub.calendar', 'calendar.famiglia')
  let finish!: (events: (typeof meeting)[]) => void
  vi.mocked(homeAssistant.getCalendarEvents).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  home.entities['calendar.lavoro'] = {
    ...home.entities['calendar.famiglia'],
    entity_id: 'calendar.lavoro',
    attributes: { friendly_name: 'Lavoro' },
  }
  render(<WeeklyAgenda today="2026-10-26" />)
  fireEvent.click(screen.getByRole('button', { name: 'Famiglia' }))
  fireEvent.change(screen.getByLabelText('Calendario Home Assistant'), {
    target: { value: 'calendar.lavoro' },
  })
  await screen.findByText('Dentista')
  await act(async () => {
    finish([{ ...meeting, summary: 'Evento vecchio' }])
  })
  expect(screen.queryByText('Evento vecchio')).toBeNull()
})
it('aggiorna ogni minuto e al cambio del giorno italiano', async () => {
  vi.useFakeTimers()
  localStorage.setItem('homehub.calendar', 'calendar.famiglia')
  const view = render(<WeeklyAgenda today="2026-10-26" />)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60001)
  })
  expect(homeAssistant.getCalendarEvents).toHaveBeenCalledTimes(2)
  view.rerender(<WeeklyAgenda today="2026-10-27" />)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1)
  })
  expect(homeAssistant.getCalendarEvents).toHaveBeenLastCalledWith(
    'calendar.famiglia',
    '2026-10-25T23:00:00.000Z',
    '2026-11-01T23:00:00.000Z',
  )
})
