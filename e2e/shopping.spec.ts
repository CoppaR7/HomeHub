import { expect, test } from '@playwright/test'

test('Bring!: legge e completa un articolo tramite WebSocket Home Assistant simulato', async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === 'desktop')
    await page.setViewportSize({ width: 1920, height: 1080 })
  if (testInfo.project.name === 'tablet')
    await page.setViewportSize({ width: 1024, height: 576 })
  await page.clock.setFixedTime(new Date('2026-10-26T08:00:00Z'))
  const calls: Record<string, unknown>[] = []
  let items = [
    ...Array.from({ length: 20 }, (_, i) => ({
      uid: `extra-${i}`,
      summary: `Articolo ${i + 1}`,
      description: '',
    })),
    { uid: 'milk-uid', summary: 'Latte', description: '2 litri' },
    { uid: 'bread-uid', summary: 'Pane', description: '' },
  ]
  await page.addInitScript(() => {
    localStorage.setItem('homehub.calendar', 'calendar.famiglia')
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
                ...Object.fromEntries(
                  ['carta', 'organico', 'indifferenziata'].map((kind) => [
                    `input_boolean.homehub_${kind}`,
                    { s: 'on', a: {}, c: 'test', lc: 1793001600 },
                  ]),
                ),
                'calendar.famiglia': {
                  s: 'off',
                  a: { friendly_name: 'Famiglia' },
                  c: 'test',
                  lc: 1793001600,
                },
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
        if (message.service === 'get_events')
          reply({
            response: {
              'calendar.famiglia': {
                events: [
                  {
                    summary: 'Dentista',
                    start: '2026-10-26T10:00:00+01:00',
                    end: '2026-10-26T11:00:00+01:00',
                  },
                  {
                    summary: 'Vacanza',
                    start: '2026-10-27',
                    end: '2026-10-29',
                  },
                  {
                    summary: 'Riunione',
                    start: '2026-10-30T17:00:00+01:00',
                    end: '2026-10-30T18:00:00+01:00',
                  },
                ],
              },
            },
          })
        else if (message.service === 'get_items')
          reply({ response: { 'todo.casettolina': { items } } })
        else if (message.service === 'update_item') {
          items = items.filter((item) => item.uid !== message.service_data.item)
          reply({ context: { id: 'test' } })
        } else reply()
      } else reply()
    })
    ws.send(JSON.stringify({ type: 'auth_required', ha_version: '2026.10.2' }))
  })
  await page.route('https://api.open-meteo.com/**', (route) =>
    route.fulfill({
      json: {
        daily: {
          time: Array.from(
            { length: 7 },
            (_, i) => `2026-${i < 6 ? '10-' + (26 + i) : '11-01'}`,
          ),
          weather_code: [61, 2, 0, 3, 0, 2, 3],
          temperature_2m_max: [20, 21, 22, 23, 24, 25, 26],
          temperature_2m_min: [10, 11, 12, 13, 14, 15, 16],
        },
      },
    }),
  )
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
  await expect(page.getByText('Dentista', { exact: true })).toBeVisible()
  await expect(page.getByText('Vacanza', { exact: true })).toHaveCount(2)
  if (testInfo.project.name !== 'mobile') {
    for (const name of [
      'La spesa Bring!',
      'La settimana',
      'Prima di uscire…',
    ]) {
      const box = await page
        .getByRole('region', { name, exact: true })
        .boundingBox()
      expect(box!.y).toBeGreaterThanOrEqual(0)
      expect(box!.y + box!.height).toBeLessThanOrEqual(
        page.viewportSize()!.height,
      )
    }
    const lights = await page
      .getByRole('region', { name: 'Le tue luci', exact: true })
      .boundingBox()
    expect(lights!.y).toBeGreaterThanOrEqual(page.viewportSize()!.height)
    if (testInfo.project.name === 'desktop') {
      await expect(page.locator('.agenda-day').last()).toBeInViewport({
        ratio: 1,
      })
      for (const notice of await page.locator('.notice-list .notice').all()) {
        await expect(notice).toBeInViewport({ ratio: 1 })
      }
    }
    await page.screenshot({
      path: `test-results/overview-${testInfo.project.name}.png`,
    })
  }
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
