# Aggiornare HomeHub già installato sul QNAP: widget Bring!

Usa `HomeHub-QNAP-aggiornamento-Bring.zip`. Contiene esclusivamente la dashboard compilata e questa guida. Non contiene configurazioni Home Assistant, Compose, credenziali o automazioni. L’integrazione Bring! è già configurata in Home Assistant con l’entità `todo.casettolina`: non servono altri account, token o integrazioni in HomeHub.

## Copia con File Station

1. Individua la cartella che contiene la dashboard attuale, normalmente `Container/homehub/config/www/homehub`. Se l’installazione usa una cartella condivisa diversa, usa il percorso reale montato come `/config` nel contenitore esistente.
2. Prima della copia, conserva una copia dell’intera cartella web `homehub` fuori da `config/www`, per esempio in `Container/homehub/backups/homehub-prima-bring`. Non spostare né cancellare la cartella in uso.
3. Estrai lo ZIP in una cartella temporanea. Dalla sua cartella `homehub/config/www/homehub` copia prima `assets` e `favicon.svg` nella cartella web esistente, mantenendo anche i vecchi asset. Copia **`index.html` per ultimo**. Non copiare la cartella `config` sopra l’installazione e non modificare `.storage`, `configuration.yaml`, `packages/homehub.yaml`, Compose o il contenitore. Il file `LEGGIMI.md` è solo una guida.
4. Ricarica sul tablet lo stesso indirizzo di prima: `http://IP-DEL-NAS:8123/local/homehub/index.html`. Se il browser mantiene la vecchia pagina, usa una ricarica completa. Non cancellare i dati del sito: contengono le preferenze. L’indirizzo Home Assistant e le chiavi di salvataggio restano invariati; se la sessione della scheda è scaduta, accedi dal collegamento già configurato.

Non occorre riavviare Home Assistant, ricreare Container Station o aggiornare l’immagine del contenitore. Luci, integrazione Bring!, promemoria persistenti e automazioni Alexa rimangono nella configurazione esistente.

## Controllo sul NAS

- Verifica che luci e promemoria già presenti continuino a comparire.
- Il riquadro **La spesa Bring!** mostra gli articoli da acquistare di **Casettolina**, incluse le eventuali descrizioni. La lista viene riletta ogni 30 secondi e quando Home Assistant segnala una modifica; il pulsante di aggiornamento forza una nuova lettura. La sincronizzazione effettiva con l’app Bring! dipende anche dai tempi dell’integrazione Home Assistant.
- Scegli un articolo che vuoi effettivamente acquistare e spuntalo. HomeHub invia `todo.update_item` con l’UID dell’articolo e `status: completed`, poi rilegge `todo.get_items` con `status: needs_action`. L’articolo scompare solo quando la rilettura ne conferma l’assenza dagli articoli da acquistare. Controlla anche nell’app Bring! la conferma dell’acquisto.
- Se compare un errore, usa **Aggiorna lista Bring!** prima di riprovare. In caso di disconnessione i comandi sono disabilitati e gli ultimi articoli ricevuti rimangono visibili come dati non aggiornati. Una lista assente o non disponibile viene segnalata e non viene presentata come vuota.
- Se la lista non è disponibile, verifica in Home Assistant che `todo.casettolina` sia presente, accessibile all’utente della sessione e disponibile. Per le spunte deve supportare l’aggiornamento degli elementi. Non occorre modificare i quattro interruttori dei promemoria Alexa.

## Ripristino

Per tornare alla dashboard precedente, copia gli asset dal backup nella cartella web in uso, poi ripristina `index.html` per ultimo e ricarica il tablet. Il ripristino della pagina non modifica gli acquisti già sincronizzati con Bring!: per annullarli usa Bring! o Home Assistant.

## Verifiche del pacchetto

Il pacchetto viene generato con `python scripts/package-qnap.py --update`. Lo script controlla il percorso `/local/homehub/`, l’integrità ZIP e l’assenza di file YAML o configurazioni nel pacchetto di aggiornamento. I test automatici del widget simulano le risposte Home Assistant; la prova sul NAS e sull’account Bring! reale va eseguita con i controlli sopra.
