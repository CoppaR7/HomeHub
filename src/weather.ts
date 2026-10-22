import { conditionLabel, type Day, type Place } from './model'

async function request(url: string, signal?: AbortSignal) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal?.aborted) controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  const timeout = setTimeout(abort, 15000)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok)
      throw new Error('Il servizio meteo non è disponibile. Riprova tra poco.')
    return await response.json()
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}
export async function searchPlaces(query: string): Promise<Place[]> {
  const data = await request(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=5&language=it&format=json`,
  )
  if (data.error) throw new Error('Ricerca non disponibile.')
  return (data.results ?? []).map(
    (item: {
      id: number
      name: string
      admin1?: string
      country?: string
      latitude: number
      longitude: number
    }) => ({
      id: item.id,
      name: item.name,
      region: item.admin1 ?? '',
      country: item.country ?? '',
      latitude: item.latitude,
      longitude: item.longitude,
    }),
  )
}
export async function loadForecast(
  place: Place,
  signal?: AbortSignal,
): Promise<Day[]> {
  const data = await request(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=7`,
    signal,
  )
  const daily = data.daily
  if (!daily || !Array.isArray(daily.time) || daily.time.length !== 7)
    throw new Error('Previsioni incomplete. Riprova tra poco.')
  return daily.time.map((date: string, index: number) => {
    const code = daily.weather_code?.[index],
      max = daily.temperature_2m_max?.[index],
      min = daily.temperature_2m_min?.[index]
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      ![code, max, min].every(Number.isFinite)
    )
      throw new Error('Previsioni incomplete. Riprova tra poco.')
    return { date, code, label: conditionLabel(code), max, min }
  })
}
