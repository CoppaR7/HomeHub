import { expect, test } from '@playwright/test'

test('Bring!: legge e completa un articolo tramite WebSocket Home Assistant simulato', async ({
  page,
}) => {
  const calls: Record<string, unknown>[] = []
  let items = [
    { uid: 'milk-uid', summary: 'Latte', description: '2 litri' },
    { uid: 'bread-uid', summary: 'Pane', description: '' },
  ]
  await page.addInitScript(() => {
    localStorage.setItem(
      'homehub.home-assistant',
      JSON.stringify({ enabled: true, url: 'http://ha.test:8123' }),
    )
    sessionStorage.setItem(
      'homehub.home-assistant.session',
      JSON.stringify({
        hassUrl: 'http://ha.test:8123',
        access_token: 'test-only',
        refresh_token: 'test-only',
        expires: Date.now() + 3600000,
        clientId: location.origin + '/',
      }),
    )
  })
  await page.routeWebSocket('ws://ha.test:8123/api/websocket', (ws) => {
    ws.onMessage((raw) => {
      const message = JSON.parse(String(raw))
      if (message.type === 'auth') {
        ws.send(JSON.stringify({ type: 'auth_ok', ha_version: '2026.10.2' }))
        return
      }
      const reply = (result: unknown = {}) =>
        ws.send(
          JSON.stringify({
            id: message.id,
            type: 'result',
            success: true,
            result,
          }),
        )
      if (message.type === 'subscribe_entities') {
        reply(null)
        ws.send(
          JSON.stringify({
            id: message.id,
            type: 'event',
            event: {
              a: {
                'todo.casettolina': {
                  s: '2',
                  a: { friendly_name: 'Casettolina', supported_features: 2 },
                  c: 'test',
                  lc: 1792756800,
                },
                'light.ingresso': {
                  s: 'off',
                  a: { friendly_name: 'Ingresso reale' },
                  c: 'test',
                  lc: 1792756800,
                },
                'input_boolean.homehub_plastica': {
                  s: 'on',
                  a: {},
                  c: 'test',
                  lc: 1792756800,
                },
              },
            },
          }),
        )
      } else if (message.type === 'call_service') {
        calls.push(message)
        if (message.service === 'get_items')
          reply({ response: { 'todo.casettolina': { items } } })
        else if (message.service === 'update_item') {
          items = items.filter((item) => item.uid !== message.service_data.item)
          reply({ context: { id: 'test' } })
        } else reply()
      } else reply()
    })
    ws.send(JSON.stringify({ type: 'auth_required', ha_version: '2026.10.2' }))
  })
  await page.route('https://api.open-meteo.com/**', (route) => route.abort())
  await page.goto('/')
  const shopping = page.getByRole('region', { name: 'La spesa Bring!' })
  await expect(shopping.getByText('Latte', { exact: true })).toBeVisible()
  await expect(shopping.getByText('2 litri')).toBeVisible()
  await expect(
    page.getByRole('switch', { name: 'Ingresso reale' }),
  ).toHaveAttribute('aria-checked', 'false')
  await expect(
    page.getByRole('heading', { name: 'portare via la plastica!' }),
  ).toBeVisible()
  await shopping
    .getByRole('checkbox', { name: 'Segna Latte come acquistato' })
    .click()
  await expect(shopping.getByText('Latte', { exact: true })).toHaveCount(0)
  await expect(shopping.getByText('Pane', { exact: true })).toBeVisible()
  expect(calls).toContainEqual(
    expect.objectContaining({
      domain: 'todo',
      service: 'update_item',
      target: { entity_id: 'todo.casettolina' },
      service_data: { item: 'milk-uid', status: 'completed' },
    }),
  )
  await expect(
    page.getByRole('heading', { name: 'portare via la plastica!' }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: `test-results/bring-${test.info().project.name}.png`,
    fullPage: true,
  })
})
