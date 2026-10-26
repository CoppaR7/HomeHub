import { useEffect, useState } from 'react'
import { CalendarDays, RefreshCw } from 'lucide-react'
import { useHomeAssistant } from './useHomeAssistant'
import { homeAssistant } from './home-assistant'
import {
  addDays,
  calendarRange,
  eventLabel,
  eventsForDay,
  type CalendarEvent,
} from './calendar'

const CALENDAR_KEY = 'homehub.calendar'
function savedCalendar() {
  try {
    return localStorage.getItem(CALENDAR_KEY) || ''
  } catch {
    return ''
  }
}
export default function WeeklyAgenda({ today }: { today: string }) {
  const home = useHomeAssistant()
  const [selected, setSelected] = useState(savedCalendar)
  const [refresh, setRefresh] = useState(0)
  const [storageError, setStorageError] = useState(false)
  const [result, setResult] = useState<{
    status: 'loading' | 'ready' | 'error'
    events: CalendarEvent[]
    error: string
  }>({ status: 'loading', events: [], error: '' })
  const [choosing, setChoosing] = useState(!selected)
  const calendars = Object.values(home.entities).filter((entity) =>
    entity.entity_id.startsWith('calendar.'),
  )
  const entity = home.entities[selected]
  const available =
    home.status === 'connected' &&
    entity &&
    !['unavailable', 'unknown'].includes(entity.state)
  const updated = entity?.last_updated
  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const load = async () => {
      if (!available) return
      setResult({ status: 'loading', events: [], error: '' })
      try {
        const range = calendarRange(today)
        const events = await homeAssistant.getCalendarEvents(
          selected,
          range.start,
          range.end,
        )
        if (active) setResult({ status: 'ready', events, error: '' })
      } catch (error) {
        if (active)
          setResult({
            status: 'error',
            events: [],
            error:
              error instanceof Error
                ? error.message
                : 'Calendario non disponibile.',
          })
      } finally {
        if (active)
          timer = setTimeout(() => {
            void load()
          }, 60000)
      }
    }
    void load()
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [available, selected, today, updated, refresh])
  const name = String(
    entity?.attributes.friendly_name || selected || 'Scegli calendario',
  )
  return (
    <div className="weekly-agenda">
      <div className="agenda-heading">
        <h3>
          <CalendarDays size={16} /> Impegni · prossimi 7 giorni
        </h3>
        <button
          className="text-button calendar-choice"
          onClick={() => setChoosing(!choosing)}
          aria-expanded={choosing}
        >
          {name}
        </button>
        <button
          className="icon-button"
          aria-label="Aggiorna impegni"
          disabled={!available || result.status === 'loading'}
          onClick={() => setRefresh((n) => n + 1)}
        >
          <RefreshCw size={16} />
        </button>
      </div>
      {choosing && (
        <div className="calendar-picker">
          <label htmlFor="calendar-select">Calendario Home Assistant</label>
          <select
            id="calendar-select"
            value={selected}
            onChange={(event) => {
              const id = event.target.value
              setSelected(id)
              setChoosing(!id)
              try {
                localStorage.setItem(CALENDAR_KEY, id)
                setStorageError(false)
              } catch {
                setStorageError(true)
              }
            }}
          >
            <option value="">Scegli il calendario Google collegato</option>
            {selected && !entity && (
              <option value={selected}>{selected} (non disponibile)</option>
            )}
            {calendars.map((calendar) => (
              <option key={calendar.entity_id} value={calendar.entity_id}>
                {String(
                  calendar.attributes.friendly_name || calendar.entity_id,
                )}
              </option>
            ))}
          </select>
          <p>
            In Home Assistant aggiungi Google Calendar da Impostazioni →
            Dispositivi e servizi. Autorizza Google, abilita il calendario
            condiviso, poi selezionalo qui.
          </p>
        </div>
      )}
      {storageError && (
        <p role="alert">
          Il browser non consente di salvare il calendario scelto.
        </p>
      )}
      {!selected ? (
        <p className="agenda-message">
          Seleziona il calendario per vedere i tuoi impegni.
        </p>
      ) : !available ? (
        <p className="agenda-message" role="status">
          Calendario non disponibile: controlla il collegamento e l’integrazione
          Google Calendar in Home Assistant.
        </p>
      ) : result.status === 'loading' ? (
        <p className="agenda-message" role="status">
          Caricamento degli impegni…
        </p>
      ) : result.status === 'error' ? (
        <p className="connection-error" role="alert">
          {result.error}
        </p>
      ) : (
        <div
          className="agenda-days"
          role="region"
          aria-label="Impegni dei prossimi sette giorni"
          tabIndex={0}
        >
          {Array.from({ length: 7 }, (_, index) => {
            const day = addDays(today, index)
            const events = eventsForDay(result.events, day)
            return (
              <div className="agenda-day" key={day}>
                <time dateTime={day}>
                  {index === 0
                    ? 'Oggi'
                    : new Date(`${day}T12:00:00Z`).toLocaleDateString('it-IT', {
                        timeZone: 'Europe/Rome',
                        weekday: 'short',
                        day: 'numeric',
                      })}
                </time>
                {events.length ? (
                  <ul>
                    {events.map((event, i) => (
                      <li key={`${event.start}-${i}`}>
                        <span className="event-time">
                          {eventLabel(event, day)}
                        </span>
                        <span>
                          {event.summary || 'Impegno'}
                          {event.location && <small>{event.location}</small>}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="no-events">Nessun impegno</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
