import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const credentialFile = process.env.HOMEHUB_HA_TEST_CREDENTIALS
test.skip(
  !credentialFile,
  'Richiede un’istanza Home Assistant di test e un account locale dedicato.',
)

test('accesso OAuth, luce e promemoria condiviso su un vero Home Assistant', async ({
  page,
  request,
}) => {
  test.setTimeout(90000)
  const credentials = JSON.parse(readFileSync(credentialFile!, 'utf8'))
  const api = async (path: string, data?: object) => {
    const response = await request.fetch(credentials.url + '/api/' + path, {
      method: data ? 'POST' : 'GET',
      headers: { Authorization: 'Bearer ' + credentials.tokens.access_token },
      ...(data ? { data } : {}),
    })
    expect(response.ok()).toBe(true)
    return response.json()
  }
  const states = await api('states')
  const lamp = states.find((entity: { entity_id: string }) =>
    entity.entity_id.startsWith('light.'),
  )
  expect(lamp).toBeTruthy()
  await api('services/light/turn_off', { entity_id: lamp.entity_id })
  await api('services/input_boolean/turn_off', {
    entity_id: 'input_boolean.homehub_plastica',
  })
  await page.route('https://api.open-meteo.com/**', (route) => route.abort())
  await page.goto('/')
  await page.getByRole('button', { name: 'Impostazioni', exact: true }).click()
  await page.getByLabel('Indirizzo Home Assistant').fill(credentials.url)
  await page.getByRole('button', { name: 'Collega', exact: true }).click()
  await page.locator('input[name="username"]').fill(credentials.username)
  await page.locator('input[type="password"]').fill(credentials.password)
  await page.getByRole('button', { name: /Log in|Accedi|Next|Avanti/i }).click()
  await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:5173\//)
  const light = page.getByRole('switch', {
    name: lamp.attributes.friendly_name,
    exact: true,
  })
  await expect(light).toHaveAttribute('aria-checked', 'false')
  await light.click()
  await expect(light).toHaveAttribute('aria-checked', 'true')
  expect((await api('states/' + lamp.entity_id)).state).toBe('on')

  // This simulates the server-side effect of a voice automation, not an Echo.
  await api('services/input_boolean/turn_on', {
    entity_id: 'input_boolean.homehub_plastica',
  })
  await expect(
    page.getByRole('heading', { name: 'portare via la plastica!' }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Segna come fatto: portare via la plastica!' })
    .click()
  await expect(
    page.getByRole('heading', { name: 'portare via la plastica!' }),
  ).toHaveCount(0)
  expect((await api('states/input_boolean.homehub_plastica')).state).toBe('off')
  await page.reload()
  await expect(
    page.getByRole('switch', {
      name: lamp.attributes.friendly_name,
      exact: true,
    }),
  ).toHaveAttribute('aria-checked', 'true')
  expect(new URL(page.url()).searchParams.has('code')).toBe(false)
  await page.getByRole('button', { name: 'Impostazioni', exact: true }).click()
  await page.getByRole('button', { name: 'Scollega e torna alla demo' }).click()
  await expect(page.getByText('Simulazione locale')).toBeVisible()
})
