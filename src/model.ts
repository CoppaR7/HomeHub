export type Light = { id: string; name: string; on: boolean }
export type Place = {
  id: number
  name: string
  region: string
  country: string
  latitude: number
  longitude: number
}
export type Day = {
  date: string
  code: number
  label: string
  max: number
  min: number
}
export const CAMERANO: Place = {
  id: 3181005,
  name: 'Camerano',
  region: 'Marche',
  country: 'Italia',
  latitude: 43.531,
  longitude: 13.552,
}
export const INITIAL_LIGHTS: Light[] = [
  { id: 'entrance', name: 'Ingresso', on: true },
  { id: 'living', name: 'Soggiorno', on: false },
  { id: 'kitchen', name: 'Cucina', on: false },
  { id: 'bedroom', name: 'Camera da letto', on: false },
]
export const WASTE = {
  plastica: { label: 'Plastica', message: 'portare via la plastica!' },
  carta: { label: 'Carta', message: 'portare via la carta!' },
  indifferenziata: {
    label: 'Indifferenziata',
    message: "portare via l'indifferenziata!",
  },
  organico: { label: 'Organico', message: "portare via l'organico!" },
} as const
export type Waste = keyof typeof WASTE
export function parseVoiceCommand(text: string): Waste | null {
  const normalized = text
    .toLowerCase()
    .trim()
    .replace(/^alexa[,\s]*/, '')
    .replace(/[.!?]+$/, '')
    .trim()
  const match = /^(plastica|carta|indifferenziata|organico) pien[ao]$/.exec(
    normalized,
  )
  return match ? (match[1] as Waste) : null
}
export function condition(
  code: number,
): 'sun' | 'mixed' | 'cloud' | 'rain' | 'snow' {
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow'
  if (
    [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(
      code,
    )
  )
    return 'rain'
  if (code === 0) return 'sun'
  if (code === 1 || code === 2) return 'mixed'
  return 'cloud'
}
export function conditionLabel(code: number) {
  return {
    sun: 'Sereno',
    mixed: 'Poco nuvoloso',
    cloud: 'Nuvoloso',
    rain: 'Pioggia',
    snow: 'Neve',
  }[condition(code)]
}
export function currentDateKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type: string) => parts.find((item) => item.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
export function getRainAlert(days: Day[], now = new Date()) {
  const today = days.find((day) => day.date === currentDateKey(now))
  return today && condition(today.code) === 'rain' ? 'oggi' : null
}
function validStored(key: string, value: unknown) {
  if (key === 'homehub.waste')
    return (
      Array.isArray(value) &&
      value.every(
        (item) => typeof item === 'string' && Object.hasOwn(WASTE, item),
      ) &&
      new Set(value).size === value.length
    )
  if (key === 'homehub.lights')
    return (
      Array.isArray(value) &&
      value.length === INITIAL_LIGHTS.length &&
      value.every(
        (item, index) =>
          item?.id === INITIAL_LIGHTS[index].id &&
          item?.name === INITIAL_LIGHTS[index].name &&
          typeof item?.on === 'boolean',
      )
    )
  if (key === 'homehub.place') {
    if (!value || typeof value !== 'object') return false
    const place = value as Place
    return (
      Number.isFinite(place.id) &&
      typeof place.name === 'string' &&
      typeof place.region === 'string' &&
      typeof place.country === 'string' &&
      Number.isFinite(place.latitude) &&
      Math.abs(place.latitude) <= 90 &&
      Number.isFinite(place.longitude) &&
      Math.abs(place.longitude) <= 180
    )
  }
  return false
}
export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const value: unknown = JSON.parse(raw)
    return validStored(key, value) ? (value as T) : fallback
  } catch {
    return fallback
  }
}
const demoMonday = new Date(`${currentDateKey()}T12:00:00Z`)
demoMonday.setUTCDate(
  demoMonday.getUTCDate() - ((demoMonday.getUTCDay() + 6) % 7),
)
export const DEMO_DAYS: Day[] = [0, 2, 61, 3, 0, 2, 71].map((code, index) => {
  const date = new Date(demoMonday)
  date.setUTCDate(date.getUTCDate() + index)
  const iso = date.toISOString().slice(0, 10)
  return {
    date: iso,
    code,
    label: conditionLabel(code),
    max: [22, 21, 17, 19, 23, 20, 4][index],
    min: [14, 13, 12, 11, 14, 13, 0][index],
  }
})
