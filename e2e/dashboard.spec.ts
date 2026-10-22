import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-22T10:00:00+02:00'))
})

test('widget, avvisi e salvataggio funzionano su desktop, tablet e telefono', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('https://api.open-meteo.com/**', (route) =>
    route.fulfill({
      json: {
        daily: {
          time: [
            '2026-10-22',
            '2026-10-23',
            '2026-10-24',
            '2026-10-25',
            '2026-10-26',
            '2026-10-27',
            '2026-10-28',
          ],
          weather_code: [61, 2, 61, 3, 0, 71, 0],
          temperature_2m_max: [22, 21, 17, 19, 23, 4, 22],
          temperature_2m_min: [14, 13, 12, 11, 14, 0, 14],
        },
      },
    }),
  )
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Ogni cosa al suo posto.' }),
  ).toBeVisible()
  await expect(page.locator('.day')).toHaveCount(7)
  await expect(page.getByText("prendi l'ombrello!")).toBeVisible()
  await expect(page.getByRole('switch', { name: 'Cucina' })).toHaveAttribute(
    'aria-checked',
    'false',
  )
  await page.getByRole('switch', { name: 'Cucina' }).click()
  await page.getByText('Aggiungi un promemoria').click()
  await page.getByLabel('Prova una frase Alexa').fill('Alexa, plastica piena')
  await page.getByRole('button', { name: 'Prova frase' }).click()
  await expect(
    page.getByRole('heading', { name: 'portare via la plastica!' }),
  ).toBeVisible()
  await page.reload()
  await expect(page.getByRole('switch', { name: 'Cucina' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(
    page.getByRole('heading', { name: 'portare via la plastica!' }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Segna come fatto: portare via la plastica!' })
    .click()
  await expect(
    page.getByRole('heading', { name: 'portare via la plastica!' }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: "prendi l'ombrello!" }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  if (test.info().project.name === 'tablet') {
    await page.evaluate(() => scrollTo(0, 0))
    const notice = await page
      .getByRole('heading', { name: "prendi l'ombrello!" })
      .boundingBox()
    expect(notice!.y + notice!.height).toBeLessThan(768)
  }
  expect(errors).toEqual([])
  await page.screenshot({
    path: `test-results/homehub-${test.info().project.name}.png`,
    fullPage: true,
  })
})

test('rete non disponibile e dimostrazione sono riconoscibili', async ({
  page,
}) => {
  await page.route('https://api.open-meteo.com/**', (route) => route.abort())
  await page.goto('/')
  await expect(
    page.getByText(
      'Meteo non disponibile. Controlla la connessione e riprova.',
    ),
  ).toBeVisible()
  await expect(page.locator('.day')).toHaveCount(0)
  await expect(page.getByText("prendi l'ombrello!")).toHaveCount(0)
  await page.getByRole('button', { name: 'Mostra esempio' }).click()
  await expect(page.getByText('Dati dimostrativi')).toBeVisible()
  await expect(page.locator('.day')).toHaveCount(7)
  await expect(page.getByText("prendi l'ombrello!")).toHaveCount(0)
  await expect(page.locator('.day').filter({ hasText: 'Pioggia' })).toHaveCount(
    1,
  )
})

test('l’ombrello non compare se la pioggia è prevista solo nei prossimi giorni', async ({
  page,
}) => {
  await page.route('https://api.open-meteo.com/**', (route) =>
    route.fulfill({
      json: {
        daily: {
          time: [
            '2026-10-22',
            '2026-10-23',
            '2026-10-24',
            '2026-10-25',
            '2026-10-26',
            '2026-10-27',
            '2026-10-28',
          ],
          weather_code: [0, 61, 61, 3, 0, 71, 0],
          temperature_2m_max: [22, 21, 17, 19, 23, 4, 22],
          temperature_2m_min: [14, 13, 12, 11, 14, 0, 14],
        },
      },
    }),
  )
  await page.goto('/')
  await expect(page.locator('.day')).toHaveCount(7)
  await expect(page.getByText('Tutto a posto!')).toBeVisible()
  await expect(page.getByText("prendi l'ombrello!")).toHaveCount(0)
})
