import { useEffect, useState } from 'react'
import {
  ArrowUpRight,
  Bell,
  Check,
  ChevronRight,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudSun,
  House,
  Lightbulb,
  MapPin,
  Maximize,
  Plus,
  Settings2,
  Sun,
  Trash2,
  Umbrella,
  X,
} from 'lucide-react'
import type { FormEvent, ReactNode } from 'react'
import {
  CAMERANO,
  DEMO_DAYS,
  INITIAL_LIGHTS,
  WASTE,
  condition,
  currentDateKey,
  getRainAlert,
  parseVoiceCommand,
  readStored,
  type Day,
  type Light,
  type Place,
  type Waste,
} from './model'
import { loadForecast, searchPlaces } from './weather'
import HomeConnection from './HomeConnection'
import ShoppingList from './ShoppingList'
import WeeklyAgenda from './WeeklyAgenda'
import { weekStart, addDays } from './calendar'
import { useHomeAssistant } from './useHomeAssistant'
import { homeAssistant, REMINDER_ENTITIES } from './home-assistant'
import './App.css'

function useSaved<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => readStored(key, initial))
  const [error, setError] = useState(false)
  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (!active) return
      try {
        localStorage.setItem(key, JSON.stringify(value))
        setError(false)
      } catch {
        setError(true)
      }
    })
    return () => {
      active = false
    }
  }, [key, value])
  return [value, setValue, error] as const
}
function WeatherIcon({ code }: { code: number }) {
  const icons: Record<ReturnType<typeof condition>, typeof Sun> = {
    sun: Sun,
    mixed: CloudSun,
    cloud: Cloud,
    rain: CloudRain,
    snow: CloudSnow,
  }
  const Icon = icons[condition(code)]
  return (
    <Icon
      size={34}
      strokeWidth={1.6}
      aria-hidden="true"
      className={`weather-icon ${condition(code)}`}
    />
  )
}
function Alert({
  icon,
  title,
  description,
  onDismiss,
  disabled,
}: {
  icon: ReactNode
  title: string
  description: string
  onDismiss?: () => void
  disabled?: boolean
}) {
  return (
    <div className="notice">
      <div className="notice-icon">{icon}</div>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {onDismiss && (
        <button
          className="done-button"
          onClick={onDismiss}
          disabled={disabled}
          aria-label={`Segna come fatto: ${title}`}
        >
          <Check size={19} />
          <span>Fatto</span>
        </button>
      )}
    </div>
  )
}
export default function App() {
  const home = useHomeAssistant()
  const [now, setNow] = useState(() => new Date())
  const [lights, setLights, lightsError] = useSaved<Light[]>(
    'homehub.lights',
    INITIAL_LIGHTS,
  )
  const [waste, setWaste, wasteError] = useSaved<Waste[]>('homehub.waste', [])
  const [place, setPlace, placeError] = useSaved<Place>(
    'homehub.place',
    CAMERANO,
  )
  const [settings, setSettings] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [searchStatus, setSearchStatus] = useState('')
  const [searching, setSearching] = useState(false)
  const [days, setDays] = useState<Day[]>([])
  const [weatherState, setWeatherState] = useState<
    'demo' | 'loading' | 'ready' | 'error'
  >('loading')
  const [weatherError, setWeatherError] = useState('')
  const [updated, setUpdated] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [command, setCommand] = useState('')
  const [commandStatus, setCommandStatus] = useState('')
  const [displayStatus, setDisplayStatus] = useState('')
  const today = currentDateKey(now)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    const timer = setInterval(() => setRefresh((n) => n + 1), 60 * 60 * 1000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    loadForecast(place, controller.signal)
      .then((data) => {
        setDays(data)
        setWeatherState('ready')
        setWeatherError('')
        setUpdated(
          new Date().toLocaleTimeString('it-IT', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        )
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setWeatherState('error')
          setWeatherError(
            'Meteo non disponibile. Controlla la connessione e riprova.',
          )
        }
      })
    return () => controller.abort()
  }, [place, refresh, today])
  const weatherDays =
    weatherState === 'ready' || weatherState === 'demo'
      ? days.filter(
          (day) =>
            day.date >= weekStart(today) &&
            day.date < addDays(weekStart(today), 7),
        )
      : []
  const rain = getRainAlert(weatherDays, now)
  const visibleLights = home.enabled
    ? Object.values(home.entities)
        .filter((entity) => entity.entity_id.startsWith('light.'))
        .map((entity) => ({
          id: entity.entity_id,
          name: String(entity.attributes.friendly_name || entity.entity_id),
          on: entity.state === 'on',
          available:
            home.status === 'connected' && ['on', 'off'].includes(entity.state),
        }))
        .sort((left, right) => left.name.localeCompare(right.name, 'it'))
    : lights.map((light) => ({ ...light, available: true }))
  const visibleWaste = home.enabled
    ? (Object.keys(REMINDER_ENTITIES) as Waste[]).filter(
        (item) => home.entities[REMINDER_ENTITIES[item]]?.state === 'on',
      )
    : waste
  const noticeCount = visibleWaste.length + (rain ? 1 : 0)
  const litCount = visibleLights.filter(
    (light) => light.on && light.available,
  ).length
  const dateLabel = now.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Rome',
  })

  async function findPlace(event: FormEvent) {
    event.preventDefault()
    setSearching(true)
    setSearchStatus('')
    setResults([])
    try {
      const places = await searchPlaces(query)
      setResults(places)
      if (!places.length)
        setSearchStatus('Nessuna località trovata. Prova con un comune vicino.')
    } catch {
      setSearchStatus(
        'Ricerca non disponibile. Controlla la connessione e riprova.',
      )
    } finally {
      setSearching(false)
    }
  }
  function addWaste(item: Waste) {
    if (home.enabled) {
      void homeAssistant.setEntity(REMINDER_ENTITIES[item], true)
      return
    }
    setWaste((previous) =>
      previous.includes(item) ? previous : [...previous, item],
    )
  }
  function simulateVoice(event: FormEvent) {
    event.preventDefault()
    const item = parseVoiceCommand(command)
    if (item) {
      addWaste(item)
      setCommand('')
      setCommandStatus('Avviso aggiunto. Questa prova non usa Alexa.')
    } else setCommandStatus('Prova, per esempio: Alexa, plastica piena')
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else if (document.documentElement.requestFullscreen)
        await document.documentElement.requestFullscreen()
      else
        setDisplayStatus(
          'Usa il menu del browser per la visualizzazione a schermo intero.',
        )
    } catch {
      setDisplayStatus('Schermo intero non disponibile in questo browser.')
    }
  }
  function retryWeather() {
    setWeatherState('loading')
    setRefresh((n) => n + 1)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="HomeHub, pagina iniziale">
          <span className="brand-icon">
            <House size={23} />
          </span>
          home<span className="brand-light">hub</span>
          <span className="brand-dot" />
        </a>
        <div className="header-actions">
          <span className="tablet-label">IL TUO SPAZIO DI CASA</span>
          <button
            className="icon-button"
            aria-label="Schermo intero"
            onClick={fullscreen}
          >
            <Maximize size={19} />
          </button>
          <button
            className={`icon-button ${settings ? 'selected' : ''}`}
            aria-label="Impostazioni"
            aria-expanded={settings}
            aria-controls="settings"
            onClick={() => setSettings(!settings)}
          >
            <Settings2 size={20} />
          </button>
        </div>
      </header>
      <main id="home">
        <section className="welcome">
          <div>
            <p className="eyebrow">
              <span className="small-dot" /> CASA, A COLPO D’OCCHIO
            </p>
            <h1>Ogni cosa al suo posto.</h1>
            <p className="welcome-subtitle">
              La spesa, gli impegni e le cose da ricordare. Tutto qui.
            </p>
          </div>
          <div className="clock">
            <time>
              {now.toLocaleTimeString('it-IT', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Europe/Rome',
              })}
            </time>
            <p>{dateLabel}</p>
          </div>
        </section>
        {(lightsError || wasteError || placeError) && (
          <p className="error" role="alert">
            Il browser non consente il salvataggio. Le modifiche potrebbero
            andare perse alla chiusura.
          </p>
        )}
        {displayStatus && <p role="status">{displayStatus}</p>}
        {settings && (
          <section
            className="settings-panel"
            id="settings"
            aria-label="Impostazioni HomeHub"
          >
            <div className="card-heading">
              <div>
                <p className="eyebrow">PERSONALIZZA IL TUO HUB</p>
                <h2>Facciamolo sentire a casa.</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Chiudi impostazioni"
                onClick={() => setSettings(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="settings-grid">
              <div>
                <h3>La tua località</h3>
                <p>Scegli il comune per vedere le previsioni reali.</p>
                <form onSubmit={findPlace} className="inline-form">
                  <label className="sr-only" htmlFor="city">
                    Città
                  </label>
                  <input
                    id="city"
                    placeholder="Es. Camerano"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    required
                    minLength={2}
                    maxLength={120}
                  />
                  <button className="primary-button" disabled={searching}>
                    {searching ? 'Cerco…' : 'Cerca'}
                  </button>
                </form>
                <p role="status" className="form-status">
                  {searchStatus}
                </p>
                <div className="place-results">
                  {results.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => {
                        setPlace(result)
                        setWeatherState('loading')
                        setResults([])
                        setQuery('')
                        setSearchStatus(`Località impostata: ${result.name}`)
                      }}
                    >
                      <MapPin size={17} />
                      {result.name}, {result.region}, {result.country}
                      <ChevronRight size={17} />
                    </button>
                  ))}
                </div>
                <p className="muted">Località attuale: {place.name}</p>
                <p>
                  Le previsioni del widget sono di Open-Meteo.{' '}
                  <a
                    href="https://www.3bmeteo.com/meteo/camerano"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Consulta Camerano su 3Bmeteo ↗
                  </a>
                </p>
              </div>
              <div>
                <HomeConnection />
                <p>
                  Per mantenere acceso il tablet, configura lo schermo nelle
                  impostazioni Android.
                </p>
              </div>
            </div>
          </section>
        )}
        <div className="dashboard">
          <div className="overview">
            <ShoppingList />
            <section
              className="card weather-card"
              aria-labelledby="weather-heading"
            >
              <div className="card-heading">
                <div className="heading-with-icon">
                  <span className="section-icon blue">
                    <CloudSun size={22} />
                  </span>
                  <h2 id="weather-heading">La settimana</h2>
                </div>
                <button
                  className="location-button"
                  onClick={() => setSettings(true)}
                >
                  <MapPin size={14} />
                  {place.name}
                  <ChevronRight size={14} />
                </button>
              </div>
              <p className="card-description">
                Un’occhiata fuori, prima di uscire.
                {weatherState === 'demo' && (
                  <span className="demo-weather"> Dati dimostrativi</span>
                )}
              </p>
              {weatherState === 'loading' && (
                <p role="status" className="weather-message">
                  Caricamento delle previsioni…
                </p>
              )}
              {weatherState === 'error' && (
                <div className="weather-message" role="alert">
                  <p>{weatherError}</p>
                  <button className="text-button" onClick={retryWeather}>
                    Riprova
                  </button>
                  <button
                    className="text-button"
                    onClick={() => {
                      setDays(DEMO_DAYS)
                      setWeatherState('demo')
                    }}
                  >
                    Mostra esempio
                  </button>
                </div>
              )}
              <WeeklyAgenda
                today={today}
                renderWeather={(date) => {
                  const day = weatherDays.find((item) => item.date === date)
                  return day ? (
                    <div className="day">
                      <WeatherIcon code={day.code} />
                      <span className="sr-only">{day.label}</span>
                      <div className="temperature">
                        {Math.round(day.max)}°{' '}
                        <span>{Math.round(day.min)}°</span>
                      </div>
                      <span className="weather-label">{day.label}</span>
                      {date < today && (
                        <span className="past-weather">Dati passati</span>
                      )}
                    </div>
                  ) : (
                    <div className="day-weather-missing">
                      Meteo non disponibile
                    </div>
                  )
                }}
              />
              <div className="card-foot">
                <span>
                  {weatherState === 'ready'
                    ? `Aggiornato alle ${updated} · ogni ora`
                    : weatherState === 'demo'
                      ? 'Esempio · non sono previsioni reali'
                      : 'È necessaria una connessione Internet'}
                </span>
                {weatherState === 'ready' ? (
                  <a
                    href="https://open-meteo.com/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open-Meteo <ArrowUpRight size={12} />
                  </a>
                ) : (
                  <Sun size={15} />
                )}
              </div>
            </section>
            <section
              className="card notices-card"
              aria-labelledby="notices-heading"
            >
              <div className="card-heading">
                <div className="heading-with-icon">
                  <span className="section-icon peach">
                    <Bell size={22} />
                  </span>
                  <div>
                    <p className="eyebrow">UN PICCOLO PROMEMORIA</p>
                    <h2 id="notices-heading">Prima di uscire…</h2>
                  </div>
                </div>
                <span className="count-badge">
                  {noticeCount} {noticeCount === 1 ? 'avviso' : 'avvisi'}
                </span>
              </div>
              <div className="notice-list">
                {rain && (
                  <Alert
                    icon={<Umbrella size={29} />}
                    title="prendi l'ombrello!"
                    description={`${weatherState === 'demo' ? 'Esempio meteo · ' : ''}Pioggia prevista ${rain}.`}
                  />
                )}
                {visibleWaste.map((item) => (
                  <Alert
                    key={item}
                    icon={<Trash2 size={27} />}
                    title={WASTE[item].message}
                    description={
                      home.enabled && home.status !== 'connected'
                        ? 'Ultimo stato ricevuto: collegamento interrotto.'
                        : 'Da portare via quando esci.'
                    }
                    disabled={
                      home.enabled &&
                      (home.status !== 'connected' ||
                        home.pending.includes(REMINDER_ENTITIES[item]))
                    }
                    onDismiss={() =>
                      home.enabled
                        ? void homeAssistant.setEntity(
                            REMINDER_ENTITIES[item],
                            false,
                          )
                        : setWaste((previous) =>
                            previous.filter((value) => value !== item),
                          )
                    }
                  />
                ))}
                {noticeCount === 0 &&
                  !(
                    home.enabled &&
                    (home.status !== 'connected' ||
                      Object.values(REMINDER_ENTITIES).some(
                        (id) =>
                          !['on', 'off'].includes(home.entities[id]?.state),
                      ))
                  ) && (
                    <div className="empty-notices">
                      <Check size={30} />
                      <div>
                        <h3>
                          {weatherState === 'ready' || weatherState === 'demo'
                            ? 'Tutto a posto!'
                            : 'Nessun promemoria manuale.'}
                        </h3>
                        <p>
                          {weatherState === 'ready' || weatherState === 'demo'
                            ? 'Nessun promemoria da ricordare.'
                            : 'Gli avvisi meteo compariranno quando saranno disponibili le previsioni.'}
                        </p>
                      </div>
                    </div>
                  )}
                {noticeCount === 0 &&
                  home.enabled &&
                  (home.status !== 'connected' ||
                    Object.values(REMINDER_ENTITIES).some(
                      (id) => !['on', 'off'].includes(home.entities[id]?.state),
                    )) && (
                    <p className="connection-error">
                      I promemoria di casa non sono ancora disponibili.
                      Controlla il collegamento e i quattro interruttori in Home
                      Assistant.
                    </p>
                  )}
              </div>
              <details className="add-notice">
                <summary>
                  <Plus size={17} />
                  Aggiungi un promemoria
                  <span>
                    {home.enabled
                      ? 'Promemoria condivisi'
                      : 'Alexa da collegare'}
                  </span>
                </summary>
                <p>
                  {home.enabled
                    ? 'Puoi aggiungere un avviso qui oppure attivarlo tramite Alexa, dopo avere configurato il collegamento vocale in Home Assistant.'
                    : 'Puoi aggiungere un avviso a mano, oppure provare una frase. La prova non ascolta la voce e non è collegata ad Alexa.'}
                </p>
                <div className="waste-buttons">
                  {(Object.keys(WASTE) as Waste[]).map((item) => (
                    <button
                      key={item}
                      onClick={() => addWaste(item)}
                      disabled={
                        visibleWaste.includes(item) ||
                        (home.enabled &&
                          (home.status !== 'connected' ||
                            home.pending.includes(REMINDER_ENTITIES[item]) ||
                            !['on', 'off'].includes(
                              home.entities[REMINDER_ENTITIES[item]]?.state,
                            )))
                      }
                    >
                      <Plus size={15} />
                      {WASTE[item].label}
                    </button>
                  ))}
                </div>
                {!home.enabled && (
                  <form className="inline-form" onSubmit={simulateVoice}>
                    <label className="sr-only" htmlFor="voice">
                      Prova una frase Alexa
                    </label>
                    <input
                      id="voice"
                      value={command}
                      onChange={(event) => setCommand(event.target.value)}
                      placeholder="Alexa, plastica piena"
                      maxLength={100}
                      required
                    />
                    <button className="primary-button">Prova frase</button>
                  </form>
                )}
                <p className="form-status" role="status">
                  {commandStatus}
                </p>
              </details>
            </section>
          </div>
          <section
            className="card lights-card"
            aria-labelledby="lights-heading"
          >
            <div className="card-heading">
              <div className="heading-with-icon">
                <span className="section-icon amber">
                  <Lightbulb size={21} />
                </span>
                <h2 id="lights-heading">Le tue luci</h2>
              </div>
              <span className="badge">
                {home.enabled
                  ? home.status === 'connected'
                    ? 'CASA'
                    : 'NON COLLEGATA'
                  : 'DEMO'}
              </span>
            </div>
            <p className="card-description">Un tocco per cambiare atmosfera.</p>
            <div className="lights-list">
              {visibleLights.length === 0 && (
                <div className="home-empty">
                  <p>
                    {home.status === 'connected'
                      ? 'Nessuna luce trovata. Aggiungi le lampadine in Home Assistant.'
                      : 'Collega Home Assistant dalle impostazioni per vedere le luci.'}
                  </p>
                  <button
                    className="text-button"
                    onClick={() => setSettings(true)}
                  >
                    Apri impostazioni
                  </button>
                </div>
              )}
              {visibleLights.map((light) => (
                <div
                  key={light.id}
                  className={`light-row ${light.on && light.available ? 'light-on' : ''}`}
                >
                  <span className="bulb-icon">
                    <Lightbulb
                      fill={
                        light.on && light.available ? 'currentColor' : 'none'
                      }
                      size={24}
                      strokeWidth={1.5}
                    />
                  </span>
                  <div className="light-name">
                    <h3>{light.name}</h3>
                    <span>
                      {!light.available
                        ? 'Non disponibile'
                        : home.pending.includes(light.id)
                          ? 'In attesa di conferma…'
                          : light.on
                            ? 'Accesa'
                            : 'Spenta'}
                    </span>
                  </div>
                  <button
                    role="switch"
                    aria-checked={light.on}
                    aria-label={light.name}
                    className="switch"
                    disabled={
                      !light.available || home.pending.includes(light.id)
                    }
                    onClick={() =>
                      home.enabled
                        ? void homeAssistant.setEntity(light.id, !light.on)
                        : setLights((previous) =>
                            previous.map((item) =>
                              item.id === light.id
                                ? { ...item, on: !item.on }
                                : item,
                            ),
                          )
                    }
                  >
                    <span />
                  </button>
                </div>
              ))}
            </div>
            <div className="card-foot">
              <span>
                <span className={`small-dot ${litCount ? 'orange' : 'gray'}`} />
                {home.enabled && home.status !== 'connected'
                  ? 'Stati non aggiornati'
                  : `${litCount} di ${visibleLights.length} accese`}
              </span>
              <span>
                {home.enabled ? 'Home Assistant' : 'Simulazione locale'}
              </span>
            </div>
            {home.enabled && home.error && (
              <p className="connection-error" role="alert">
                {home.error}
              </p>
            )}
          </section>
        </div>
        <footer>
          <span>
            <House size={14} /> Uno spazio semplice. Per la tua casa.
          </span>
          <span>
            HomeHub <span className="footer-dot">·</span> Prima versione
          </span>
        </footer>
      </main>
    </div>
  )
}
