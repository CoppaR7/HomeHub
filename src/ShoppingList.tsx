import { RefreshCw, ShoppingBasket } from 'lucide-react'
import { homeAssistant, SHOPPING_ENTITY } from './home-assistant'
import { useHomeAssistant } from './useHomeAssistant'

export default function ShoppingList() {
  const home = useHomeAssistant()
  const { shopping } = home
  const connected = home.status === 'connected'
  const entity = home.entities[SHOPPING_ENTITY]
  const available =
    connected && entity && !['unknown', 'unavailable'].includes(entity.state)
  const canComplete =
    available && (Number(entity.attributes.supported_features) & 2) !== 0
  return (
    <section className="card shopping-card" aria-labelledby="shopping-heading">
      <div className="card-heading">
        <div className="heading-with-icon">
          <span className="section-icon blue">
            <ShoppingBasket size={22} />
          </span>
          <h2 id="shopping-heading">La spesa Bring!</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Aggiorna lista Bring!"
          disabled={
            !connected ||
            shopping.status === 'loading' ||
            shopping.pending.length > 0
          }
          onClick={() => void homeAssistant.refreshShopping()}
        >
          <RefreshCw size={19} />
        </button>
      </div>
      <p className="card-description">Casettolina · Da acquistare</p>
      {!home.enabled ? (
        <p>
          Collega Home Assistant dalle impostazioni per vedere la tua lista
          Bring!.
        </p>
      ) : !connected ? (
        <p role="status">
          Lista non aggiornata: collega Home Assistant per riprendere la spesa.
        </p>
      ) : shopping.status === 'loading' ? (
        <p role="status">Aggiornamento della lista…</p>
      ) : null}
      {home.enabled && connected && shopping.error && (
        <p className="connection-error" role="alert">
          {shopping.error}
        </p>
      )}
      {shopping.status === 'ready' &&
        connected &&
        shopping.items.length === 0 && (
          <p role="status">Tutto acquistato! La lista è vuota.</p>
        )}
      {available && !canComplete && (
        <p>
          Questa lista non consente di segnare gli acquisti da Home Assistant.
        </p>
      )}
      <ul
        className="shopping-list"
        aria-label="Articoli da acquistare"
        aria-busy={shopping.status === 'loading' || shopping.pending.length > 0}
      >
        {shopping.items.map((item) => (
          <li key={item.uid}>
            <label>
              <input
                type="checkbox"
                checked={false}
                disabled={
                  !canComplete ||
                  shopping.status !== 'ready' ||
                  shopping.pending.length > 0
                }
                aria-label={`Segna ${item.summary} come acquistato`}
                onChange={() =>
                  void homeAssistant.completeShoppingItem(item.uid)
                }
              />
              <span>
                <strong>{item.summary}</strong>
                {item.description && <small>{item.description}</small>}
                {shopping.pending.includes(item.uid) && (
                  <small role="status">Conferma dell’acquisto…</small>
                )}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="card-foot">
        <span>Sincronizzata tramite Home Assistant</span>
        <span>Bring!</span>
      </div>
    </section>
  )
}
