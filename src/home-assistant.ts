import {
  callService,
  createConnection,
  getAuth,
  subscribeEntities,
  ERR_INVALID_AUTH,
  type Auth,
  type AuthData,
  type Connection,
  type HassEntities,
} from 'home-assistant-js-websocket'
import type { Waste } from './model'
import { validateCalendarEvents } from './calendar'

export const REMINDER_ENTITIES: Record<Waste, string> = {
  plastica: 'input_boolean.homehub_plastica',
  carta: 'input_boolean.homehub_carta',
  indifferenziata: 'input_boolean.homehub_indifferenziata',
  organico: 'input_boolean.homehub_organico',
}
export const SHOPPING_ENTITY = 'todo.casettolina'
export type ShoppingItem = {
  uid: string
  summary: string
  description?: string
}
export type ShoppingSnapshot = {
  items: ShoppingItem[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  pending: string[]
  error: string
}
const emptyShopping = (): ShoppingSnapshot => ({
  items: [],
  status: 'idle',
  pending: [],
  error: '',
})
const CONFIG_KEY = 'homehub.home-assistant'
const TOKEN_KEY = 'homehub.home-assistant.session'
const NONCE_KEY = 'homehub.home-assistant.login'
type Status = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'
export type HomeSnapshot = {
  enabled: boolean
  url: string
  status: Status
  entities: HassEntities
  shopping: ShoppingSnapshot
  pending: string[]
  error: string
}

export function normalizeHomeUrl(input: string) {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    throw new Error('Inserisci l’indirizzo completo di Home Assistant.')
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !['', '/'].includes(url.pathname)
  ) {
    throw new Error(
      'Usa l’indirizzo principale di Home Assistant, senza password, percorsi o parametri.',
    )
  }
  if (location.protocol === 'https:' && url.protocol !== 'https:') {
    throw new Error(
      'Da questo sito serve un indirizzo HTTPS di Home Assistant. Per collegarti al NAS in rete locale, apri la versione domestica di HomeHub.',
    )
  }
  return url.origin
}
function readConfig(): { enabled: boolean; url: string } {
  try {
    const data = JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null')
    if (data?.enabled === true && typeof data.url === 'string')
      return { enabled: true, url: normalizeHomeUrl(data.url) }
  } catch {
    /* A damaged local setting must not prevent the dashboard from opening. */
  }
  return { enabled: false, url: '' }
}
function clearCallback() {
  const url = new URL(location.href)
  for (const key of ['auth_callback', 'code', 'state', 'homehub_login'])
    url.searchParams.delete(key)
  history.replaceState(null, '', url.pathname + url.search + url.hash)
}
function storedTokens(url: string): AuthData | undefined {
  try {
    const data = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null')
    if (
      data?.hassUrl === url &&
      typeof data.access_token === 'string' &&
      typeof data.refresh_token === 'string' &&
      typeof data.expires === 'number'
    )
      return data
  } catch {
    /* No token is safer than using a damaged session. */
  }
  return undefined
}
function saveTokens(data: AuthData | null) {
  if (data) sessionStorage.setItem(TOKEN_KEY, JSON.stringify(data))
  else sessionStorage.removeItem(TOKEN_KEY)
}

export class HomeAssistantClient {
  private listeners = new Set<() => void>()
  private connection?: Connection
  private auth?: Auth
  private unsubscribeEntities?: () => void
  private job?: Promise<void>
  private generation = 0
  private entityDeadline?: ReturnType<typeof setTimeout>
  private shoppingTimer?: ReturnType<typeof setTimeout>
  private shoppingRequest = 0
  private state: HomeSnapshot

  constructor() {
    const config = readConfig()
    this.state = {
      ...config,
      status: config.enabled ? 'disconnected' : 'idle',
      shopping: emptyShopping(),
      entities: {},
      pending: [],
      error: '',
    }
  }
  getSnapshot = () => this.state
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private update(patch: Partial<HomeSnapshot>) {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }
  resume = async () => {
    if (!this.state.enabled || this.connection || this.job) return
    const callback = new URLSearchParams(location.search).has('auth_callback')
    if (callback || storedTokens(this.state.url))
      await this.connect(this.state.url)
    else
      this.update({
        error: 'Accedi a Home Assistant per riprendere il collegamento.',
      })
  }
  connect = async (input: string): Promise<void> => {
    if (this.job) return this.job
    const job = this.open(input)
    this.job = job
    try {
      await job
    } finally {
      if (this.job === job) this.job = undefined
    }
  }
  private async open(input: string) {
    let url: string
    try {
      url = normalizeHomeUrl(input)
    } catch (error) {
      this.update({ error: (error as Error).message })
      return
    }
    const generation = ++this.generation
    clearTimeout(this.entityDeadline)
    clearTimeout(this.shoppingTimer)
    ++this.shoppingRequest
    this.unsubscribeEntities?.()
    this.connection?.close()
    this.connection = undefined
    this.update({
      enabled: true,
      url,
      status: 'connecting',
      shopping: emptyShopping(),
      entities: {},
      pending: [],
      error: '',
    })
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify({ enabled: true, url }))
      const callback = new URLSearchParams(location.search)
      if (callback.has('auth_callback')) {
        const nonce = sessionStorage.getItem(NONCE_KEY)
        if (!nonce || callback.get('homehub_login') !== nonce)
          throw new Error(
            'Accesso non riconosciuto. Premi Collega per accedere di nuovo.',
          )
      }
      // Home Assistant's /local file server does not provide directory indexes.
      const redirect = new URL(
        'index.html',
        new URL(import.meta.env.BASE_URL, location.origin),
      )
      let nonce = sessionStorage.getItem(NONCE_KEY)
      if (!callback.has('auth_callback')) {
        // getRandomValues also works on the NAS's normal HTTP LAN address.
        // randomUUID is limited to secure contexts in Android Chrome.
        nonce = Array.from(
          crypto.getRandomValues(new Uint8Array(24)),
          (value) => value.toString(16).padStart(2, '0'),
        ).join('')
        sessionStorage.setItem(NONCE_KEY, nonce)
      }
      redirect.searchParams.set('homehub_login', nonce!)
      const auth = await getAuth({
        hassUrl: url,
        clientId: new URL(import.meta.env.BASE_URL, location.origin).href,
        redirectUrl: redirect.href,
        limitHassInstance: true,
        loadTokens: async () => storedTokens(url),
        saveTokens: (data) => {
          if (generation === this.generation) saveTokens(data)
        },
      })
      if (generation !== this.generation) return
      clearCallback()
      sessionStorage.removeItem(NONCE_KEY)
      const connection = await createConnection({ auth, connectTimeout: 10000 })
      if (generation !== this.generation) {
        connection.close()
        return
      }
      this.connection = connection
      this.auth = auth
      const waitForEntities = () => {
        clearTimeout(this.entityDeadline)
        this.entityDeadline = setTimeout(() => {
          if (
            generation === this.generation &&
            this.state.status === 'connecting'
          )
            this.update({
              status: 'error',
              error:
                'Home Assistant non ha inviato gli stati dei dispositivi. Premi Collega per riprovare.',
            })
        }, 15000)
      }
      waitForEntities()
      connection.addEventListener('disconnected', () => {
        if (generation === this.generation) {
          clearTimeout(this.entityDeadline)
          clearTimeout(this.shoppingTimer)
          ++this.shoppingRequest
          this.update({
            shopping: { ...this.state.shopping, pending: [], status: 'idle' },
            status: 'disconnected',
            error:
              'Collegamento interrotto. Riprovo a connettermi; gli stati delle luci non sono aggiornati.',
          })
        }
      })
      connection.addEventListener('ready', () => {
        // Mark the connection ready only after the new entity snapshot arrives.
        if (generation === this.generation) {
          this.update({ status: 'connecting', error: '' })
          waitForEntities()
        }
      })
      connection.addEventListener('reconnect-error', (conn, code) => {
        void conn
        if (generation === this.generation) {
          if (code === ERR_INVALID_AUTH) saveTokens(null)
          this.update({
            status: 'error',
            error: 'Accesso scaduto. Premi Collega per accedere di nuovo.',
          })
        }
      })
      this.unsubscribeEntities = subscribeEntities(connection, (entities) => {
        if (generation === this.generation && connection.connected) {
          clearTimeout(this.entityDeadline)
          const previous = this.state.entities[SHOPPING_ENTITY]
          const reconnecting = this.state.status !== 'connected'
          this.update({ entities, status: 'connected', error: '' })
          if (
            reconnecting ||
            previous?.state !== entities[SHOPPING_ENTITY]?.state ||
            previous?.last_updated !== entities[SHOPPING_ENTITY]?.last_updated
          )
            void this.refreshShopping()
        }
      })
    } catch (error) {
      if (generation !== this.generation) return
      if (error === ERR_INVALID_AUTH) saveTokens(null)
      if (new URLSearchParams(location.search).has('auth_callback'))
        clearCallback()
      sessionStorage.removeItem(NONCE_KEY)
      this.update({
        status: 'error',
        error:
          error instanceof Error
            ? error.message
            : 'Non riesco a collegarmi a Home Assistant. Controlla l’indirizzo e accedi di nuovo.',
      })
    }
  }
  disconnect = async () => {
    ++this.generation
    clearTimeout(this.entityDeadline)
    clearTimeout(this.shoppingTimer)
    ++this.shoppingRequest
    this.unsubscribeEntities?.()
    this.connection?.close()
    this.connection = undefined
    this.job = undefined
    const auth = this.auth
    this.auth = undefined
    localStorage.removeItem(CONFIG_KEY)
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(NONCE_KEY)
    clearCallback()
    this.update({
      enabled: false,
      status: 'idle',
      shopping: emptyShopping(),
      entities: {},
      pending: [],
      error: '',
    })
    if (auth) {
      try {
        await auth.revoke()
      } catch {
        this.update({
          error:
            'Collegamento rimosso dal tablet. Per revocare anche la sessione sul server, usa il profilo di Home Assistant.',
        })
      }
    }
  }
  getCalendarEvents = async (id: string, start: string, end: string) => {
    const connection = this.connection
    const generation = this.generation
    const entity = this.state.entities[id]
    if (
      !connection?.connected ||
      this.state.status !== 'connected' ||
      !id.startsWith('calendar.') ||
      !entity ||
      ['unknown', 'unavailable'].includes(entity.state)
    )
      throw new Error(
        'Calendario non disponibile. Controlla il collegamento a Home Assistant.',
      )
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      const result = await Promise.race([
        connection.sendMessagePromise<{
          response?: Record<string, { events?: unknown }>
        }>({
          type: 'call_service',
          domain: 'calendar',
          service: 'get_events',
          target: { entity_id: id },
          service_data: { start_date_time: start, end_date_time: end },
          return_response: true,
        }),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error('Il calendario non ha risposto. Riprova.')),
            10000,
          )
        }),
      ])
      if (generation !== this.generation || this.state.status !== 'connected')
        throw new Error('Collegamento al calendario interrotto.')
      return validateCalendarEvents(result.response?.[id]?.events)
    } finally {
      clearTimeout(timeout)
    }
  }
  private shoppingAvailable() {
    const entity = this.state.entities[SHOPPING_ENTITY]
    return (
      this.state.status === 'connected' &&
      this.connection?.connected &&
      entity &&
      !['unavailable', 'unknown'].includes(entity.state)
    )
  }
  private async shoppingCall(service: string, data: Record<string, unknown>) {
    const connection = this.connection!
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        connection.sendMessagePromise<{
          response?: Record<string, { items: ShoppingItem[] }>
        }>({
          type: 'call_service',
          domain: 'todo',
          service,
          target: { entity_id: SHOPPING_ENTITY },
          service_data: data,
          ...(service === 'get_items' ? { return_response: true } : {}),
        }),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error('Bring! non ha risposto. Riprova.')),
            10000,
          )
        }),
      ])
    } finally {
      clearTimeout(timeout)
    }
  }
  private async readShoppingItems() {
    const result = await this.shoppingCall('get_items', {
      status: 'needs_action',
    })
    const items = result.response?.[SHOPPING_ENTITY]?.items
    if (
      !Array.isArray(items) ||
      items.some(
        (item) =>
          !item ||
          typeof item.uid !== 'string' ||
          typeof item.summary !== 'string' ||
          (item.description !== undefined &&
            typeof item.description !== 'string'),
      )
    )
      throw new Error('Home Assistant non ha restituito la lista Bring!.')
    return items
  }
  refreshShopping = async () => {
    if (this.state.shopping.pending.length) return
    clearTimeout(this.shoppingTimer)
    const request = ++this.shoppingRequest
    const generation = this.generation
    if (!this.shoppingAvailable()) {
      this.update({
        shopping: {
          ...this.state.shopping,
          status: 'error',
          error:
            'Lista Bring! non disponibile. Controlla todo.casettolina in Home Assistant.',
        },
      })
      return
    }
    this.update({
      shopping: { ...this.state.shopping, status: 'loading', error: '' },
    })
    try {
      const items = await this.readShoppingItems()
      if (generation === this.generation && request === this.shoppingRequest)
        this.update({
          shopping: { items, status: 'ready', pending: [], error: '' },
        })
    } catch (error) {
      if (generation === this.generation && request === this.shoppingRequest)
        this.update({
          shopping: {
            ...this.state.shopping,
            status: 'error',
            error:
              error instanceof Error
                ? error.message
                : 'Non riesco a leggere la lista Bring!.',
          },
        })
    } finally {
      if (
        generation === this.generation &&
        request === this.shoppingRequest &&
        this.state.status === 'connected'
      )
        this.shoppingTimer = setTimeout(
          () => void this.refreshShopping(),
          30000,
        )
    }
  }
  completeShoppingItem = async (uid: string) => {
    if (
      !this.shoppingAvailable() ||
      this.state.shopping.pending.length ||
      !this.state.shopping.items.some((item) => item.uid === uid) ||
      !(
        Number(
          this.state.entities[SHOPPING_ENTITY].attributes.supported_features,
        ) & 2
      )
    )
      return
    const generation = this.generation
    const request = ++this.shoppingRequest
    clearTimeout(this.shoppingTimer)
    this.update({
      shopping: { ...this.state.shopping, pending: [uid], error: '' },
    })
    try {
      await this.shoppingCall('update_item', { item: uid, status: 'completed' })
      if (generation !== this.generation || request !== this.shoppingRequest)
        return
      const items = await this.readShoppingItems()
      if (generation !== this.generation || request !== this.shoppingRequest)
        return
      if (items.some((item) => item.uid === uid))
        throw new Error(
          'Acquisto non ancora confermato da Bring!. Aggiorna la lista prima di riprovare.',
        )
      this.update({
        shopping: { items, status: 'ready', pending: [], error: '' },
      })
    } catch (error) {
      if (generation === this.generation && request === this.shoppingRequest)
        this.update({
          shopping: {
            ...this.state.shopping,
            status: 'error',
            error:
              error instanceof Error
                ? error.message
                : 'Acquisto non riuscito. Riprova.',
          },
        })
    } finally {
      if (generation === this.generation && request === this.shoppingRequest) {
        this.update({ shopping: { ...this.state.shopping, pending: [] } })
        if (this.state.status === 'connected')
          this.shoppingTimer = setTimeout(
            () => void this.refreshShopping(),
            30000,
          )
      }
    }
  }
  setEntity = async (id: string, on: boolean) => {
    const generation = this.generation
    const entity = this.state.entities[id]
    const domain = id.split('.')[0]
    if (
      !this.connection?.connected ||
      this.state.status !== 'connected' ||
      !entity ||
      !['on', 'off'].includes(entity.state) ||
      !['light', 'input_boolean'].includes(domain)
    ) {
      this.update({
        error:
          'Il dispositivo non è disponibile. Controlla il collegamento a Home Assistant.',
      })
      return
    }
    if (this.state.pending.includes(id)) return
    this.update({ pending: [...this.state.pending, id], error: '' })
    try {
      const connection = this.connection
      let deadline: ReturnType<typeof setTimeout> | undefined
      try {
        await Promise.race([
          callService(connection, domain, on ? 'turn_on' : 'turn_off', {
            entity_id: id,
          }),
          new Promise<never>((_, reject) => {
            deadline = setTimeout(
              () =>
                reject(new Error('Il dispositivo non ha risposto. Riprova.')),
              10000,
            )
          }),
        ])
      } finally {
        clearTimeout(deadline)
      }
      if (generation !== this.generation) return
      if (this.state.entities[id]?.state === (on ? 'on' : 'off')) return
      let unsubscribe: (() => void) | undefined
      try {
        await new Promise<void>((resolve, reject) => {
          deadline = setTimeout(
            () =>
              reject(
                new Error(
                  'Il dispositivo non ha confermato il nuovo stato. Riprova.',
                ),
              ),
            10000,
          )
          const check = () => {
            if (this.state.status !== 'connected')
              reject(new Error('Collegamento interrotto prima della conferma.'))
            else if (this.state.entities[id]?.state === (on ? 'on' : 'off'))
              resolve()
          }
          unsubscribe = this.subscribe(check)
          check()
        })
      } finally {
        clearTimeout(deadline)
        unsubscribe?.()
      }
    } catch (error) {
      if (generation !== this.generation) return
      this.update({
        error:
          error instanceof Error
            ? error.message
            : 'Comando non riuscito. Riprova.',
      })
    } finally {
      if (generation === this.generation)
        this.update({
          pending: this.state.pending.filter((value) => value !== id),
        })
    }
  }
}

export const homeAssistant = new HomeAssistantClient()
