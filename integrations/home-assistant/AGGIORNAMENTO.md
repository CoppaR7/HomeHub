# Aggiornare HomeHub sul QNAP: schermata 16:9 e calendario

Usa **HomeHub-QNAP-aggiornamento-Colonne.zip**. Contiene solo la dashboard compilata e questa guida. Non contiene configurazioni Home Assistant, Compose, credenziali o automazioni. Non occorre reinstallare il contenitore.

## Copia con File Station

1. Individua la cartella della dashboard attuale, normalmente `Container/homehub/config/www/homehub`. Se usi una cartella condivisa diversa, usa il percorso reale montato come `/config` nel contenitore esistente.
2. Conserva una copia dell’intera cartella web `homehub` fuori da `config/www`, per esempio in `Container/homehub/backups/homehub-prima-calendario`. Non spostare la cartella in uso.
3. Estrai lo ZIP in una cartella temporanea. Dalla cartella `homehub/config/www/homehub` copia prima **assets**, mantenendo anche i vecchi file. Puoi scegliere **Sostituisci** per `favicon.svg` e per gli eventuali file omonimi. Copia e sostituisci **index.html per ultimo**.
4. Non copiare la cartella `config` sopra l’installazione. Non modificare `.storage`, `configuration.yaml`, `packages/homehub.yaml`, Compose o il contenitore. `LEGGIMI.md` è solo una guida.
5. Ricarica lo stesso indirizzo del tablet: `http://IP-DEL-NAS:8123/local/homehub/index.html`. Se resta la vecchia interfaccia, esegui una ricarica completa. Non cancellare i dati del sito: contengono le preferenze. Se la sessione della scheda è scaduta, accedi dal collegamento Home Assistant già configurato.

Le luci, l’entità Bring! `todo.casettolina`, gli interruttori persistenti e le automazioni Alexa rimangono nella configurazione Home Assistant esistente. Non servono un riavvio del NAS, un nuovo contenitore o un aggiornamento dell’immagine Home Assistant.

## Schermata del tablet 1920×1080

La spesa è il primo riquadro, a sinistra. A destra compaiono **La settimana**, con meteo compatto e impegni, e **Prima di uscire…**. Nel riquadro settimanale, le sette colonne allineano meteo e impegni giorno per giorno, da lunedì a domenica. I tre riquadri rientrano nella prima schermata in formato 16:9, mentre le luci si raggiungono scorrendo verso il basso. Le liste che superano lo spazio disponibile scorrono all’interno del proprio riquadro; per gli eventi, ogni giorno ha il proprio elenco scorrevole. Su telefono le colonne settimanali si raggiungono scorrendo orizzontalmente dentro il riquadro: nessun elemento viene eliminato o limitato a un numero fisso.

La pagina usa l’area utile del browser: se Chrome mostra barre o controlli, lo spazio può essere inferiore ai 1920×1080 fisici. Il pulsante **Schermo intero** e l’orientamento orizzontale permettono di usare meglio il tablet. Su telefono i riquadri rimangono in ordine spesa, settimana, promemoria, luci, su una colonna.

## Collegare il calendario Google condiviso

Il collegamento `calendar.google.com/calendar/u/0?cid=…` apre un calendario nell’account Google, ma non è un indirizzo pubblico degli eventi. Non è necessario rendere pubblico il calendario o inserire credenziali Google in HomeHub.

1. Apri **Home Assistant → Impostazioni → Dispositivi e servizi → Aggiungi integrazione → Google Calendar**.
2. Segui la [guida ufficiale Google Calendar per Home Assistant](https://www.home-assistant.io/integrations/google/). Se vengono richieste credenziali applicative OAuth, completa la configurazione Google Cloud indicata dalla guida e inseriscile soltanto nell’interfaccia Home Assistant. Le credenziali e gli eventuali codici di accesso non vanno in chat o nel repository.
3. Autorizza l’account che può accedere al calendario condiviso del link. In Home Assistant assicurati di aver abilitato il calendario desiderato e che la relativa entità `calendar.…` sia disponibile. Verifica prima nella pagina Calendario di Home Assistant che un suo evento compaia.
4. Ricarica HomeHub. Dentro **La settimana → Impegni**, seleziona il calendario dal menu **Calendario Home Assistant**. La scelta viene salvata solo nel browser del tablet. Puoi cambiarla premendo il nome del calendario accanto a **Impegni**.

HomeHub usa la sessione OAuth/WebSocket Home Assistant esistente e legge `calendar.get_events`: non crea né modifica eventi. Mostra la settimana corrente da **lunedì a domenica**, con orari nel fuso **Europe/Rome**. Ogni giorno occupa una colonna: giorno e data, meteo e temperature, poi gli impegni di quella stessa data. Per i giorni già trascorsi vengono richiesti anche i dati meteo dei sei giorni precedenti, indicati come «Dati passati»; se un dato manca viene segnalato, senza sostituirlo con un’altra data. Include gli eventi di più giorni e quelli di tutta la giornata, rispettando la fine esclusiva degli eventi giornalieri. Rilegge ogni minuto, al cambio del giorno italiano e alle variazioni segnalate dall’entità; il pulsante **Aggiorna impegni** forza una nuova lettura. Google può avere tempi di sincronizzazione propri.

Finché il calendario non è collegato e selezionato, il riquadro mostra le istruzioni. Errori e disconnessioni non vengono presentati come una settimana senza impegni. La scelta del calendario non cambia le impostazioni del meteo, il collegamento delle luci, Bring! o i promemoria Alexa.

## Controlli e ripristino

- Sul tablet verifica che i tre riquadri principali siano visibili e che le luci compaiano sotto.
- Dopo aver collegato Google, verifica un evento noto e il suo orario, poi un evento di tutta la giornata.
- Controlla che la lista Bring! e i promemoria già presenti siano ancora corretti. Per provare una spunta scegli un articolo da acquistare realmente: viene sincronizzato con Bring! tramite Home Assistant.
- Se vuoi tornare alla dashboard precedente, ripristina gli asset dal backup e copia il vecchio `index.html` per ultimo. Il ripristino della pagina non annulla acquisti o promemoria già modificati sul server.

Lo ZIP si genera con `python scripts/package-qnap.py --update`. Lo script verifica il percorso `/local/homehub/`, l’integrità ZIP e l’assenza di YAML o configurazioni nel pacchetto di aggiornamento. Le prove automatiche simulano Home Assistant e gli eventi: la sincronizzazione con l’account Google e con il QNAP reali richiede i controlli indicati sopra.
