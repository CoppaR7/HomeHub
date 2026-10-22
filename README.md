# HomeHub

Dashboard in italiano per il tablet all’ingresso: luci, meteo settimanale e promemoria grandi prima di uscire. React, TypeScript e Vite; interfaccia responsive per desktop, tablet e smartphone.

**Anteprima pubblica:** https://coppar7.github.io/HomeHub/

## Stato dei collegamenti

- **Ombrello:** compare soltanto se oggi è prevista pioggia. La data usa il fuso `Europe/Rome`; a mezzanotte viene considerato il nuovo giorno e viene richiesto un aggiornamento. La pioggia prevista soltanto per domani o nei giorni successivi non genera avvisi.
- **Meteo:** sette giorni per Camerano, aggiornati ogni ora, da Open-Meteo. Puoi cambiare località dalle impostazioni. Le richieste HTTPS reali al servizio sono state verificate; i test automatici usano risposte simulate. Se il servizio non risponde compare un errore. “Mostra esempio” attiva esplicitamente dati dimostrativi. Il widget non usa dati 3Bmeteo; nelle impostazioni rimane un collegamento alle previsioni di Camerano sul suo sito.
- **Senza collegamento domestico:** luci di esempio e promemoria salvati soltanto nel browser. La casella per provare le frasi è una simulazione esplicita.
- **Con Home Assistant:** accesso OAuth nella sua pagina di login; nomi e stati delle luci ricevuti dal server; comandi di accensione/spegnimento con conferma; quattro promemoria condivisi. “Fatto” spegne il promemoria sul server. Nessuna password o chiave è inclusa nel codice. La sessione è conservata nella scheda tramite `sessionStorage` e rimossa con “Scollega”. Una disconnessione sospende i comandi e segnala che gli stati non sono aggiornati.

## NAS QNAP e Alexa senza abbonamento

L’utente dispone di **QNAP TS-216G con Container Station** e usa le skill **Tapo, Meross, AvatarControls e Smart Life**. È stato scelto un percorso **senza Home Assistant Cloud**.

La soluzione preparata esegue Home Assistant Container sul NAS e serve HomeHub dalla sua cartella pubblica locale. L’integrazione ufficiale **Alexa Devices** fornisce gli eventi delle frasi pronunciate agli Echo. Il pacchetto configura quattro promemoria persistenti e un’automazione che riconosce:

- “Alexa, plastica piena” → “portare via la plastica!”;
- “Alexa, carta piena” → “portare via la carta!”;
- “Alexa, indifferenziata piena” → “portare via l’indifferenziata!”;
- “Alexa, organico pieno” → “portare via l’organico!”.

**Installazione e limiti:** [guida QNAP](integrations/home-assistant/README.md).

Il NAS va configurato nella rete di casa. Le credenziali dei produttori e l’accesso Amazon con MFA si inseriscono in Home Assistant. Non sono ancora stati collaudati né le lampadine fisiche dell’utente né gli eventi dei suoi Echo. La compatibilità va verificata per i modelli Meross e AvatarControls; il solo nome della skill non garantisce l’importazione. Le skill Alexa esistenti non devono essere rimosse per iniziare.

Da GitHub Pages, una pagina HTTPS, non si può usare direttamente un NAS locale HTTP: per questo percorso si apre **`http://IP-DEL-NAS:8123/local/homehub/index.html`** sul tablet e si collega **`http://IP-DEL-NAS:8123`** nelle impostazioni. Non è necessario esporre il NAS su Internet. Non è stato attivato un servizio a pagamento.

Per preparare il pacchetto installabile:

```bash
python scripts/package-qnap.py
```

Lo script include soltanto configurazioni pubbliche, istruzioni e app compilata con base `/local/homehub/`. Non include dati o credenziali di un’istanza Home Assistant. Il file `configuration.yaml` del pacchetto è per una nuova istanza: preservare le configurazioni già esistenti.

## Sviluppo nel cloud

```bash
cd /workspace/HomeHub
npm ci
npm run dev
```

Node.js 24 e npm sono disponibili nell’ambiente. Non servono account Amazon, database o Home Assistant per modificare l’interfaccia nella modalità dimostrativa. Il server usa **5173**, ascolta sulle interfacce della macchina e si ferma se la porta è già occupata. Il server di sviluppo non è il sito pubblico.

La cache npm è impostata in `.npmrc` su `/workspace/.cache/npm`, perché la cartella personale non è scrivibile. Su un altro computer puoi usare `npm ci --cache ./node_modules/.cache/npm`.

Ogni attività cloud è già isolata: usa il checkout esistente, senza creare worktree aggiuntivi. Preserva modifiche e file dell’utente.

## Verifiche

```bash
npm run check       # lint, test e compilazione TypeScript/Vite
npm run test:e2e    # browser Chromium su desktop, tablet e telefono
npm run test:watch
npm run format
```

La suite comprende 26 test per meteo, cambio del giorno, promemoria, persistenza, accesso Home Assistant, rifiuto di callback estranei, conferma dei comandi e gestione degli errori. Le prove browser comprendono nove casi senza backend e tre casi opzionali con una vera istanza Home Assistant dedicata. Questi ultimi vengono saltati se `HOMEHUB_HA_TEST_CREDENTIALS` non è impostato al percorso di un file privato di test. Per il collaudo sono state usate luci della piattaforma demo di Home Assistant e modifiche dei promemoria sul server: non sono test di lampadine fisiche o comandi Echo.

Playwright usa `/usr/bin/chromium` quando disponibile. È possibile indicare un altro browser con `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Nel cloud non occorre scaricare un browser aggiuntivo. Le prove sul formato tablet non equivalgono a una prova su un dispositivo Android fisico.

La verifica della configurazione Home Assistant e i quattro template delle frasi vocali sono stati eseguiti anche nel server di test. Il Chromium del cloud ha incontrato un problema di fiducia nel certificato del proxy durante le richieste HTTPS esterne; non è stata disabilitata la verifica TLS.

## Pubblicazione

Il codice sorgente è sul branch `main` di `CoppaR7/HomeHub`. GitHub Pages serve la radice del branch compilato `gh-pages`, con HTTPS. La pubblicazione del sito e quella dell’ambiente cloud sono operazioni distinte.

```bash
npm run build -- --base=/HomeHub/ --outDir=/workspace/scratch/homehub-pages --emptyOutDir
```

Per aggiornare il sito, aggiungi `.nojekyll` all’output, verifica la build e pubblicane i contenuti alla radice di `gh-pages`, preservando la cronologia senza force push. Il push del solo codice su `main` non aggiorna automaticamente il sito in questa configurazione.

`npm run build` senza opzioni genera `dist/` con base `/`; `npm run preview` serve per controllarla localmente. I file QNAP richiedono invece il percorso `/local/homehub/` e vanno prodotti con lo script dedicato.

## Uso sul tablet

Apri l’indirizzo della versione scelta in Chrome e usa **⋮ → Aggiungi a schermata Home**. Il pulsante nell’intestazione attiva lo schermo intero se supportato. Per mantenere il tablet sempre acceso configura Android o una modalità kiosk. Non è stato aggiunto un servizio per l’uso offline.

Nella modalità demo, cambiare indirizzo o cancellare i dati del sito può eliminare i promemoria locali. Nel collegamento reale, i promemoria risiedono in Home Assistant e possono essere ripristinati dopo un riavvio del NAS.
