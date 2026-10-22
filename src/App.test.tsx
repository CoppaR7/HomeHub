import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { CAMERANO, WASTE, getRainAlert } from './model'
import { loadForecast } from './weather'

function forecast(code = 61) {
  return {
    daily: {
      time: [
        '2026-10-22',
        '2026-10-23',
        '2026-10-24',
        '2026-10-25',
        '2026-10-26',
        '2026-10-27',
        '2026-10-28',
      ],
      weather_code: [code, 0, 2, 3, 71, 0, 0],
      temperature_2m_max: [19, 20, 21, 18, 3, 20, 21],
      temperature_2m_min: [12, 12, 13, 10, 0, 12, 13],
    },
  }
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-22T10:00:00+02:00'))
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => forecast() }),
  )
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('la schermata HomeHub', () => {
  it('carica sette giorni per Camerano e avvisa quando piove', async () => {
    const { container } = render(<App />)
    expect(await screen.findByText("prendi l'ombrello!")).toBeVisible()
    expect(container.querySelectorAll('.day')).toHaveLength(7)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('latitude=43.531&longitude=13.552'),
      expect.anything(),
    )
    expect(screen.getByText('Pioggia prevista oggi.')).toBeVisible()
  })
  it('non mostra avvisi di pioggia quando le previsioni non la prevedono', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => forecast(0),
    } as Response)
    render(<App />)
    expect(await screen.findByText('Tutto a posto!')).toBeVisible()
    expect(screen.queryByText("prendi l'ombrello!")).not.toBeInTheDocument()
  })
  it('non mostra l’ombrello se piove domani ma oggi è sereno', async () => {
    const data = forecast(0)
    data.daily.weather_code[1] = 61
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => data,
    } as Response)
    const { container } = render(<App />)
    expect(await screen.findByText('Tutto a posto!')).toBeVisible()
    expect(container.querySelector('.day:nth-child(2) .rain')).not.toBeNull()
    expect(screen.queryByText("prendi l'ombrello!")).not.toBeInTheDocument()
  })
  it('salva lo stato dimostrativo delle luci dopo il cambio e il ricaricamento', async () => {
    const first = render(<App />)
    const kitchen = screen.getByRole('switch', { name: 'Cucina' })
    expect(kitchen).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(kitchen)
    expect(kitchen).toHaveAttribute('aria-checked', 'true')
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('homehub.lights')!)[2].on).toBe(
        true,
      ),
    )
    first.unmount()
    render(<App />)
    expect(screen.getByRole('switch', { name: 'Cucina' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })
  it.each(Object.entries(WASTE))(
    'prova la frase %s, evita duplicati, salva e rimuove l’avviso',
    async (kind, definition) => {
      const first = render(<App />)
      fireEvent.click(screen.getByText('Aggiungi un promemoria'))
      const input = screen.getByRole('textbox', {
        name: 'Prova una frase Alexa',
      })
      for (let i = 0; i < 2; i++) {
        fireEvent.change(input, { target: { value: `Alexa, ${kind} piena` } })
        fireEvent.click(screen.getByRole('button', { name: 'Prova frase' }))
      }
      expect(screen.getAllByText(definition.message)).toHaveLength(1)
      await waitFor(() =>
        expect(JSON.parse(localStorage.getItem('homehub.waste')!)).toEqual([
          kind,
        ]),
      )
      first.unmount()
      render(<App />)
      expect(screen.getByText(definition.message)).toBeVisible()
      fireEvent.click(
        screen.getByRole('button', {
          name: `Segna come fatto: ${definition.message}`,
        }),
      )
      expect(screen.queryByText(definition.message)).not.toBeInTheDocument()
      await waitFor(() =>
        expect(JSON.parse(localStorage.getItem('homehub.waste')!)).toEqual([]),
      )
    },
  )
  it('non trasforma frasi sconosciute in avvisi', () => {
    render(<App />)
    fireEvent.click(screen.getByText('Aggiungi un promemoria'))
    fireEvent.change(screen.getByLabelText('Prova una frase Alexa'), {
      target: { value: 'Alexa, accendi tutto' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Prova frase' }))
    expect(
      screen.getByText('Prova, per esempio: Alexa, plastica piena'),
    ).toBeVisible()
  })
  it('se la rete fallisce non inventa previsioni e permette di riprovare', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('offline'))
    const { container } = render(<App />)
    expect(
      await screen.findByText(
        'Meteo non disponibile. Controlla la connessione e riprova.',
      ),
    ).toBeVisible()
    expect(container.querySelectorAll('.day')).toHaveLength(0)
    expect(screen.queryByText("prendi l'ombrello!")).not.toBeInTheDocument()
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => forecast(),
    } as Response)
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }))
    expect(await screen.findByText("prendi l'ombrello!")).toBeVisible()
  })
  it('gestisce dati salvati corrotti senza impedire l’avvio', async () => {
    localStorage.setItem('homehub.waste', '{broken')
    localStorage.setItem('homehub.lights', '[null]')
    localStorage.setItem('homehub.place', '{}')
    render(<App />)
    expect(screen.getAllByRole('switch')).toHaveLength(4)
    expect(await screen.findByText("prendi l'ombrello!")).toBeVisible()
  })
  it('se lo storage non è disponibile avvisa e continua a funzionare', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    render(<App />)
    expect(
      await screen.findByText(/Il browser non consente il salvataggio/),
    ).toBeVisible()
    fireEvent.click(screen.getByRole('switch', { name: 'Cucina' }))
    expect(screen.getByRole('switch', { name: 'Cucina' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })
})
describe('i dati del servizio meteo', () => {
  it('a mezzanotte italiana considera la nuova giornata anche con previsioni già caricate', () => {
    const days = [
      { date: '2026-10-22', code: 61, label: 'Pioggia', max: 18, min: 10 },
      { date: '2026-10-23', code: 0, label: 'Sereno', max: 21, min: 11 },
    ]
    expect(getRainAlert(days, new Date('2026-10-22T21:59:59Z'))).toBe('oggi')
    expect(getRainAlert(days, new Date('2026-10-22T22:00:00Z'))).toBeNull()
    expect(getRainAlert([], new Date('2026-10-22T10:00:00Z'))).toBeNull()
  })
  it('rifiuta previsioni incomplete', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ daily: { time: ['2026-10-22'] } }),
    } as Response)
    await expect(loadForecast(CAMERANO)).rejects.toThrow(
      'Previsioni incomplete',
    )
  })
  it('rifiuta valori nulli anziché mostrarli come zero gradi', async () => {
    const data = forecast()
    data.daily.temperature_2m_max[1] = null as unknown as number
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => data,
    } as Response)
    await expect(loadForecast(CAMERANO)).rejects.toThrow(
      'Previsioni incomplete',
    )
  })
})
