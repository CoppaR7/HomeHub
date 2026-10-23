import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import ShoppingList from './ShoppingList'
import { homeAssistant, type HomeSnapshot } from './home-assistant'
import { useHomeAssistant } from './useHomeAssistant'
vi.mock('./useHomeAssistant', () => ({ useHomeAssistant: vi.fn() }))
let snapshot: HomeSnapshot
beforeEach(() => {
  snapshot = {
    enabled: true,
    url: 'http://ha.local:8123',
    status: 'connected',
    error: '',
    pending: [],
    entities: {
      'todo.casettolina': {
        entity_id: 'todo.casettolina',
        state: '1',
        attributes: { supported_features: 2 },
        last_updated: '',
        last_changed: '',
        context: { id: '', user_id: null, parent_id: null },
      },
    },
    shopping: {
      items: [{ uid: 'milk', summary: 'Latte', description: '2 litri' }],
      status: 'ready',
      error: '',
      pending: [],
    },
  }
  vi.mocked(useHomeAssistant).mockImplementation(() => snapshot)
})
it('mostra gli articoli e invia la spunta con UID, con comandi disabilitati durante la conferma', () => {
  const complete = vi
    .spyOn(homeAssistant, 'completeShoppingItem')
    .mockResolvedValue()
  const view = render(<ShoppingList />)
  expect(screen.getByText('2 litri')).toBeVisible()
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Segna Latte come acquistato' }),
  )
  expect(complete).toHaveBeenCalledWith('milk')
  snapshot.shopping.pending = ['milk']
  view.rerender(<ShoppingList />)
  expect(screen.getByRole('checkbox')).toBeDisabled()
  expect(screen.getByRole('checkbox')).not.toBeChecked()
  expect(screen.getByText('Conferma dell’acquisto…')).toBeVisible()
  complete.mockRestore()
})
it('distingue lista vuota, errore e disconnessione', () => {
  snapshot.shopping.items = []
  const view = render(<ShoppingList />)
  expect(screen.getByText('Tutto acquistato! La lista è vuota.')).toBeVisible()
  snapshot.shopping.status = 'error'
  snapshot.shopping.error = 'Accesso negato'
  view.rerender(<ShoppingList />)
  expect(screen.queryByText('Tutto acquistato! La lista è vuota.')).toBeNull()
  expect(screen.getByRole('alert')).toHaveTextContent('Accesso negato')
  snapshot.status = 'disconnected'
  view.rerender(<ShoppingList />)
  expect(screen.getByText(/Lista non aggiornata/)).toBeVisible()
  expect(screen.getByRole('button')).toBeDisabled()
})
