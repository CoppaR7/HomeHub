import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  callService,
  createConnection,
  getAuth,
  subscribeEntities,
  type Connection,
  type HassEntities,
} from 'home-assistant-js-websocket'
import { HomeAssistantClient, normalizeHomeUrl } from './home-assistant'

vi.mock('home-assistant-js-websocket', async (importOriginal) => ({
  ...(await importOriginal<typeof import('home-assistant-js-websocket')>()),
  getAuth: vi.fn(),
  createConnection: vi.fn(),
  subscribeEntities: vi.fn(),
  callService: vi.fn(),
}))

let receive: (entities: HassEntities) => void
let listeners: Record<string, (connection?: unknown, code?: number) => void>
let connection: Connection
let client: HomeAssistantClient
const entity = (id: string, state: string) => ({
  entity_id: id,
  state,
  last_changed: '',
  last_updated: '',
  attributes: { friendly_name: 'Luce reale' },
  context: { id: 'test', user_id: null, parent_id: null },
})
const initial = (): HassEntities => ({
  'light.ingresso': entity('light.ingresso', 'off'),
  'input_boolean.homehub_plastica': entity(
    'input_boolean.homehub_plastica',
    'off',
  ),
})

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  history.replaceState(null, '', '/')
  listeners = {}
  connection = {
    connected: true,
    close: vi.fn(),
    addEventListener: vi.fn((name, callback) => {
      listeners[name] = callback
    }),
  } as unknown as Connection
  vi.mocked(getAuth).mockResolvedValue({
    revoke: vi.fn().mockResolvedValue(undefined),
  } as unknown as Awaited<ReturnType<typeof getAuth>>)
  vi.mocked(createConnection).mockResolvedValue(connection)
  vi.mocked(subscribeEntities).mockImplementation((conn, callback) => {
    void conn
    receive = callback
    return vi.fn()
  })
  vi.mocked(callService).mockResolvedValue({
    context: { id: 'test', user_id: null, parent_id: null },
  })
  client = new HomeAssistantClient()
})
afterEach(async () => {
  await client.disconnect()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('collegamento Home Assistant', () => {
  it('consente l’accesso anche quando il browser in HTTP locale non espone randomUUID', async () => {
    const getRandomValues = crypto.getRandomValues.bind(crypto)
    vi.stubGlobal('crypto', { getRandomValues })
    await client.connect('http://ha.local:8123')
    expect(getAuth).toHaveBeenCalled()
    const redirect = new URL(vi.mocked(getAuth).mock.calls[0][0]!.redirectUrl!)
    expect(
      redirect.searchParams.get('homehub_login')!.length,
    ).toBeGreaterThanOrEqual(32)
    expect(client.getSnapshot().status).toBe('connecting')
  })
  it('attende gli stati del server prima di dichiarare la casa collegata', async () => {
    await client.connect('http://ha.local:8123/')
    expect(client.getSnapshot().status).toBe('connecting')
    receive(initial())
    expect(client.getSnapshot().status).toBe('connected')
    expect(client.getSnapshot().entities['light.ingresso'].state).toBe('off')
    const options = vi.mocked(getAuth).mock.calls[0][0]!
    expect(options.limitHassInstance).toBe(true)
    expect(options.hassUrl).toBe('http://ha.local:8123')
  })
  it('manda il comando reale e attende la conferma, senza cambiare stato per ipotesi', async () => {
    await client.connect('http://ha.local:8123')
    receive(initial())
    const command = client.setEntity('light.ingresso', true)
    await Promise.resolve()
    expect(callService).toHaveBeenCalledWith(connection, 'light', 'turn_on', {
      entity_id: 'light.ingresso',
    })
    expect(client.getSnapshot().entities['light.ingresso'].state).toBe('off')
    expect(client.getSnapshot().pending).toContain('light.ingresso')
    receive({ ...initial(), 'light.ingresso': entity('light.ingresso', 'on') })
    await command
    expect(client.getSnapshot().pending).toEqual([])
    expect(client.getSnapshot().entities['light.ingresso'].state).toBe('on')
  })
  it('riceve un avviso esterno e il pulsante Fatto spegne l’interruttore condiviso', async () => {
    await client.connect('http://ha.local:8123')
    receive({
      ...initial(),
      'input_boolean.homehub_plastica': entity(
        'input_boolean.homehub_plastica',
        'on',
      ),
    })
    const command = client.setEntity('input_boolean.homehub_plastica', false)
    receive(initial())
    await command
    expect(callService).toHaveBeenCalledWith(
      connection,
      'input_boolean',
      'turn_off',
      { entity_id: 'input_boolean.homehub_plastica' },
    )
    expect(
      client.getSnapshot().entities['input_boolean.homehub_plastica'].state,
    ).toBe('off')
  })
  it('sospende i comandi quando la connessione si interrompe', async () => {
    await client.connect('http://ha.local:8123')
    receive(initial())
    listeners.disconnected()
    await client.setEntity('light.ingresso', true)
    expect(callService).not.toHaveBeenCalled()
    expect(client.getSnapshot().enabled).toBe(true)
    expect(client.getSnapshot().status).toBe('disconnected')
  })
  it('non comanda un’entità sconosciuta o non disponibile', async () => {
    await client.connect('http://ha.local:8123')
    receive({
      ...initial(),
      'light.ingresso': entity('light.ingresso', 'unavailable'),
    })
    await client.setEntity('light.ingresso', true)
    await client.setEntity('light.mancante', true)
    expect(callService).not.toHaveBeenCalled()
  })
  it('se il server rifiuta il comando conserva lo stato ricevuto', async () => {
    await client.connect('http://ha.local:8123')
    receive(initial())
    vi.mocked(callService).mockRejectedValueOnce(new Error('Comando rifiutato'))
    await client.setEntity('light.ingresso', true)
    expect(client.getSnapshot().entities['light.ingresso'].state).toBe('off')
    expect(client.getSnapshot().error).toBe('Comando rifiutato')
    expect(client.getSnapshot().pending).toEqual([])
  })
  it('se manca la conferma scade senza fingere che la luce sia accesa', async () => {
    vi.useFakeTimers()
    await client.connect('http://ha.local:8123')
    receive(initial())
    const command = client.setEntity('light.ingresso', true)
    await vi.advanceTimersByTimeAsync(10001)
    await command
    expect(client.getSnapshot().entities['light.ingresso'].state).toBe('off')
    expect(client.getSnapshot().error).toContain('non ha confermato')
  })
  it('rifiuta un callback di accesso privo del codice di verifica locale', async () => {
    history.replaceState(
      null,
      '',
      '/?auth_callback=1&code=foreign&state=foreign&homehub_login=foreign',
    )
    await client.connect('http://ha.local:8123')
    expect(getAuth).not.toHaveBeenCalled()
    expect(client.getSnapshot().status).toBe('error')
    expect(location.search).toBe('')
  })
  it('conserva la sessione solo nella scheda, non nella configurazione pubblicabile', async () => {
    await client.connect('http://ha.local:8123')
    const options = vi.mocked(getAuth).mock.calls[0][0]!
    options.saveTokens!({
      hassUrl: 'http://ha.local:8123',
      clientId: location.origin + '/',
      access_token: 'test-only-access',
      refresh_token: 'test-only-refresh',
      expires: Date.now() + 3600000,
      expires_in: 3600,
    })
    expect(localStorage.getItem('homehub.home-assistant')).not.toContain(
      'test-only',
    )
    expect(sessionStorage.getItem('homehub.home-assistant.session')).toContain(
      'test-only-access',
    )
    await client.disconnect()
    expect(sessionStorage.getItem('homehub.home-assistant.session')).toBeNull()
    expect(connection.close).toHaveBeenCalled()
  })
  it('rifiuta credenziali incorporate nell’indirizzo e protocolli non web', () => {
    expect(() => normalizeHomeUrl('https://user:password@ha.local/')).toThrow()
    expect(() => normalizeHomeUrl('javascript:alert(1)')).toThrow()
    expect(() => normalizeHomeUrl('https://ha.local/api/')).toThrow()
  })
})

describe('lista Bring! tramite la connessione esistente', () => {
  const milk = { uid: 'bring-milk', summary: 'Latte', description: '2 litri' }
  const bread = { uid: 'bring-bread', summary: 'Pane' }
  const response = (items = [milk, bread]) => ({
    response: { 'todo.casettolina': { items } },
  })
  const shoppingEntities = (state = '2', updated = 'first'): HassEntities => ({
    ...initial(),
    'todo.casettolina': {
      ...entity('todo.casettolina', state),
      last_updated: updated,
      attributes: { supported_features: 2 },
    },
  })
  async function openShopping() {
    connection.sendMessagePromise = vi.fn().mockResolvedValue(response())
    await client.connect('http://ha.local:8123')
    receive(shoppingEntities())
    await vi.waitFor(() =>
      expect(client.getSnapshot().shopping.status).toBe('ready'),
    )
  }
  it('legge solo gli articoli da acquistare, senza un secondo accesso', async () => {
    await openShopping()
    expect(getAuth).toHaveBeenCalledTimes(1)
    expect(connection.sendMessagePromise).toHaveBeenCalledWith({
      type: 'call_service',
      domain: 'todo',
      service: 'get_items',
      target: { entity_id: 'todo.casettolina' },
      service_data: { status: 'needs_action' },
      return_response: true,
    })
    expect(client.getSnapshot().shopping.items).toEqual([milk, bread])
  })
  it('completa per UID e rimuove solo dopo la rilettura confermata dal server', async () => {
    await openShopping()
    let confirm!: (value: ReturnType<typeof response>) => void
    vi.mocked(connection.sendMessagePromise)
      .mockResolvedValueOnce({})
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            confirm = resolve
          }),
      )
    const command = client.completeShoppingItem(milk.uid)
    await vi.waitFor(() => expect(confirm).toBeDefined())
    expect(client.getSnapshot().shopping.items).toContainEqual(milk)
    expect(client.getSnapshot().shopping.pending).toEqual([milk.uid])
    expect(connection.sendMessagePromise).toHaveBeenCalledWith({
      type: 'call_service',
      domain: 'todo',
      service: 'update_item',
      target: { entity_id: 'todo.casettolina' },
      service_data: { item: milk.uid, status: 'completed' },
    })
    confirm(response([bread]))
    await command
    expect(client.getSnapshot().shopping.items).toEqual([bread])
    expect(client.getSnapshot().shopping.pending).toEqual([])
  })
  it('conserva gli articoli se il comando fallisce o manca la conferma', async () => {
    await openShopping()
    vi.mocked(connection.sendMessagePromise).mockRejectedValueOnce(
      new Error('Accesso negato'),
    )
    await client.completeShoppingItem(milk.uid)
    expect(client.getSnapshot().shopping.error).toBe('Accesso negato')
    expect(client.getSnapshot().shopping.items).toContainEqual(milk)
    await client.completeShoppingItem(milk.uid)
    expect(client.getSnapshot().shopping.error).toContain(
      'non ancora confermato',
    )
    expect(client.getSnapshot().shopping.items).toContainEqual(milk)
  })
  it('riceve cambiamenti esterni anche a parità di conteggio e aggiorna periodicamente', async () => {
    vi.useFakeTimers()
    await openShopping()
    vi.mocked(connection.sendMessagePromise).mockResolvedValue(
      response([bread]),
    )
    receive(shoppingEntities('2', 'renamed'))
    await vi.advanceTimersByTimeAsync(1)
    expect(client.getSnapshot().shopping.items).toEqual([bread])
    vi.mocked(connection.sendMessagePromise).mockResolvedValue(response([]))
    await vi.advanceTimersByTimeAsync(30000)
    expect(client.getSnapshot().shopping.items).toEqual([])
  })
  it('distingue lista mancante, non disponibile e risposta malformata dalla lista vuota', async () => {
    await client.connect('http://ha.local:8123')
    receive(initial())
    expect(client.getSnapshot().shopping.status).toBe('error')
    receive(shoppingEntities('unavailable'))
    expect(client.getSnapshot().shopping.status).toBe('error')
    connection.sendMessagePromise = vi.fn().mockResolvedValue({})
    receive(shoppingEntities())
    await vi.waitFor(() =>
      expect(client.getSnapshot().shopping.error).toContain(
        'non ha restituito',
      ),
    )
    expect(client.getSnapshot().shopping.status).toBe('error')
  })
  it('non invia acquisti offline, per UID estranei o su liste senza aggiornamento', async () => {
    await openShopping()
    vi.mocked(connection.sendMessagePromise).mockClear()
    await client.completeShoppingItem('foreign')
    const entities = shoppingEntities()
    entities['todo.casettolina'].attributes.supported_features = 0
    receive(entities)
    await client.completeShoppingItem(milk.uid)
    listeners.disconnected()
    await client.completeShoppingItem(milk.uid)
    expect(connection.sendMessagePromise).not.toHaveBeenCalled()
  })
  it('ignora risposte tardive dopo Scollega e arresta il polling', async () => {
    vi.useFakeTimers()
    await openShopping()
    let resolve!: (value: ReturnType<typeof response>) => void
    vi.mocked(connection.sendMessagePromise).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const refresh = client.refreshShopping()
    await client.disconnect()
    resolve(response())
    await refresh
    await vi.advanceTimersByTimeAsync(60000)
    expect(client.getSnapshot().shopping.items).toEqual([])
    expect(client.getSnapshot().shopping.status).toBe('idle')
    expect(connection.sendMessagePromise).toHaveBeenCalledTimes(2)
  })
  it('sblocca la lista quando il server non risponde', async () => {
    vi.useFakeTimers()
    await openShopping()
    vi.mocked(connection.sendMessagePromise).mockImplementationOnce(
      () => new Promise(() => {}),
    )
    const command = client.completeShoppingItem(milk.uid)
    await vi.advanceTimersByTimeAsync(10001)
    await command
    expect(client.getSnapshot().shopping.error).toContain('non ha risposto')
    expect(client.getSnapshot().shopping.pending).toEqual([])
    expect(client.getSnapshot().shopping.items).toContainEqual(milk)
  })
})

it('legge il calendario con la sessione esistente, senza autorizzare scritture sugli eventi', async () => {
  await client.connect('http://ha.local:8123')
  receive({
    ...initial(),
    'calendar.famiglia': entity('calendar.famiglia', 'off'),
  })
  const event = {
    summary: 'Dentista',
    start: '2026-10-26T09:00:00+01:00',
    end: '2026-10-26T10:00:00+01:00',
  }
  connection.sendMessagePromise = vi
    .fn()
    .mockResolvedValue({
      response: { 'calendar.famiglia': { events: [event] } },
    })
  expect(
    await client.getCalendarEvents(
      'calendar.famiglia',
      '2026-10-25T23:00:00Z',
      '2026-11-01T23:00:00Z',
    ),
  ).toEqual([event])
  expect(connection.sendMessagePromise).toHaveBeenCalledWith({
    type: 'call_service',
    domain: 'calendar',
    service: 'get_events',
    target: { entity_id: 'calendar.famiglia' },
    service_data: {
      start_date_time: '2026-10-25T23:00:00Z',
      end_date_time: '2026-11-01T23:00:00Z',
    },
    return_response: true,
  })
  listeners.disconnected()
  await expect(
    client.getCalendarEvents('calendar.famiglia', '', ''),
  ).rejects.toThrow('non disponibile')
  expect(getAuth).toHaveBeenCalledTimes(1)
})
