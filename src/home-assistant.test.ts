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
