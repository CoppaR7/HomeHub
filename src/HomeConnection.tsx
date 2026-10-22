import { useState, useSyncExternalStore } from 'react'
import { homeAssistant, REMINDER_ENTITIES } from './home-assistant'

export default function HomeConnection() {
  const home = useSyncExternalStore(
    homeAssistant.subscribe,
    homeAssistant.getSnapshot,
  )
  const [url, setUrl] = useState(home.url)
  const missing = Object.values(REMINDER_ENTITIES).filter(
    (id) => !home.entities[id],
  )
  return (
    <div className="home-connection">
      <h3>Collega la tua casa</h3>
      <p>
        Accedi al tuo Home Assistant per vedere le luci reali e i promemoria
        condivisi con Alexa. La password si inserisce nella sua pagina di
        accesso.
      </p>
      <form
        className="inline-form"
        onSubmit={(event) => {
          event.preventDefault()
          void homeAssistant.connect(url)
        }}
      >
        <label className="sr-only" htmlFor="home-url">
          Indirizzo Home Assistant
        </label>
        <input
          id="home-url"
          type="url"
          value={url}
          placeholder="Indirizzo di Home Assistant sul NAS"
          onChange={(event) => setUrl(event.target.value)}
          required
          autoComplete="url"
          disabled={home.status === 'connecting'}
        />
        <button
          className="primary-button"
          disabled={home.status === 'connecting'}
        >
          {home.status === 'connecting' ? 'Collego…' : 'Collega'}
        </button>
      </form>
      <p role="status">
        {home.status === 'connected'
          ? 'Casa collegata. Le modifiche si aggiornano in tempo reale.'
          : home.enabled
            ? 'Casa non collegata: i comandi reali sono sospesi.'
            : 'Al momento usi luci di esempio e promemoria salvati soltanto in questo browser.'}
      </p>
      {home.error && (
        <p className="connection-error" role="alert">
          {home.error}
        </p>
      )}
      {home.status === 'connected' && missing.length > 0 && (
        <p>
          Crea in Home Assistant i quattro interruttori per i promemoria. Ne
          mancano {missing.length}; gli avvisi vocali richiedono anche le
          routine nell’app Alexa.
        </p>
      )}
      {home.enabled && (
        <button
          className="text-button"
          onClick={() => {
            void homeAssistant.disconnect()
          }}
        >
          Scollega e torna alla demo
        </button>
      )}
      <p>
        La sessione viene mantenuta in questa scheda. Servono un Home Assistant
        sempre acceso e il collegamento delle tue lampadine. Le routine Alexa si
        configurano separatamente.
      </p>
    </div>
  )
}
