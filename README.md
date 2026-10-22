# HomeHub

La base della tua webapp per il tablet all’ingresso: luci, meteo e promemoria grandi da leggere prima di uscire. Interfaccia in italiano, adattabile a desktop, tablet e smartphone.

## Avvio nel cloud

Il progetto si trova in `/workspace/HomeHub`. Sono già disponibili Node.js 24 e npm. Non servono database, account Amazon o chiavi API per sviluppare questa prima versione.

```bash
cd /workspace/HomeHub
npm ci
npm run dev
```

Il server di sviluppo usa la porta **5173**, ascolta sulle interfacce della macchina e si aggiorna quando modifichi i file. Se la porta è occupata si ferma, senza sceglierne un’altra. Il server di sviluppo serve per lavorare sul progetto: per usare l’app ogni giorno sul tablet occorre una pubblicazione separata su HTTPS.

La cache npm è configurata in `.npmrc` su `/workspace/.cache/npm`, perché la cartella personale di questa macchina non è scrivibile. Su un altro computer puoi usare `npm ci --cache ./node_modules/.cache/npm`.

## Cosa funziona ora

- **Luci dimostrative:** quattro nomi di esempio, lampadina piena quando accesa e contorno quando spenta, interruttori adatti al tocco. Lo stato viene salvato nel browser. Non vengono comandate luci reali.
- **Meteo:** sette giorni in orizzontale con icone, temperature e condizione prevalente. Camerano (Ancona) è la località iniziale. Puoi cambiarla dalle impostazioni. La fonte predisposta è Open-Meteo, senza chiave API per uso personale non commerciale, con aggiornamento ogni ora. Il servizio ha limiti e condizioni da rivedere prima di un uso commerciale.
- **Pioggia:** quando uno dei sette giorni prevede pioggia compare “prendi l’ombrello!”, con indicazione del primo giorno interessato. L’avviso resta finché è previsto dalla previsione. Se il meteo non è disponibile viene mostrato un errore: non vengono presentati dati inventati come reali. Il pulsante “Mostra esempio” attiva esplicitamente dati dimostrativi.
- **Avvisi manuali:** plastica, carta, indifferenziata e organico. Il pulsante “Fatto” rimuove il promemoria. Gli avvisi restano dopo un ricaricamento nello stesso browser e sullo stesso indirizzo.
- **Prova delle frasi:** puoi scrivere “Alexa, plastica piena”, “Alexa, carta piena”, “Alexa, indifferenziata piena” o “Alexa, organico pieno”. Compaiono rispettivamente “portare via la plastica!”, “portare via la carta!”, “portare via l’indifferenziata!” e “portare via l’organico!”. La prova non usa il microfono e non riceve comandi dai dispositivi Echo.
- **Tablet:** pulsante per lo schermo intero, ove supportato. Per evitare lo spegnimento dello schermo configura Android o una modalità kiosk sul dispositivo. L’app non forza lo schermo a rimanere acceso.

I promemoria sono locali: non sono ancora condivisi tra tablet, telefono e Alexa. Cancellare i dati del sito, usare la navigazione privata o cambiare indirizzo può far perdere i dati salvati. Non è stato installato un servizio per l’uso offline.

## Meteo e preferenza per 3Bmeteo

Hai richiesto Camerano e, se possibile, dati di 3Bmeteo. Nelle impostazioni è presente un collegamento alle previsioni di Camerano sul sito di 3Bmeteo. **Il widget non usa dati 3Bmeteo**: per integrarli occorre verificare la disponibilità di un feed o widget ufficiale e le relative condizioni. Non è stato implementato scraping.

Le prime verifiche meteo erano bloccate dalla rete del cloud. Dopo la pubblicazione dell’ambiente, le richieste HTTPS alle previsioni Open-Meteo e alla ricerca località hanno restituito HTTP 200, con sette giorni validi. I domini usati sono:

- `api.open-meteo.com` per le previsioni;
- `geocoding-api.open-meteo.com` per cercare altre località;
- `3bmeteo.com`, `www.3bmeteo.com`, `3bmeteo.it`, `www.3bmeteo.it` per verificare il servizio preferito.

I test automatici usano risposte simulate: sono distinti dalle verifiche HTTPS effettuate verso il servizio reale. Il browser del tablet deve avere accesso a Internet. Il Chromium della macchina cloud ha incontrato un problema di fiducia nel certificato del proxy durante le richieste esterne; non è stata disabilitata la verifica TLS.

## Collegamento reale con le luci e Alexa

Le marche indicate sono **TP-Link, Teckin, Avatar e GY**, attualmente comandate soltanto tramite Alexa ed Echo. I nomi dell’interfaccia sono ancora esempi, non dispositivi scoperti dal tuo account.

Un semplice accesso con Amazon non mette a disposizione di questa pagina una lista universale delle luci di Alexa con cui leggerne lo stato e comandarle. Non sono stati installati connettori non ufficiali basati sulla sessione Amazon.

La strada da valutare è **Home Assistant**, un servizio domestico che può riunire luci compatibili di marche diverse. Non è installato in questo cloud e richiede un dispositivo sempre acceso in casa oppure un’istanza già disponibile e raggiungibile in modo sicuro. Prima occorre identificare i modelli esatti e i servizi usati:

1. Nell’app Alexa apri la sezione delle skill già abilitate e annota i nomi usati dalle luci. TP-Link potrebbe usare Tapo oppure Kasa; non è possibile stabilirlo dal solo marchio. Per le altre lampadine va verificato se usano Smart Life, Tuya o altri servizi.
2. Verifica la compatibilità dei modelli con Home Assistant o con un’API ufficiale del produttore.
3. Per i promemoria pronunciati agli Echo serve un’integrazione separata: una skill Alexa oppure una routine con un’azione supportata che raggiunga un servizio autenticato. Non è sufficiente un webhook generico né collegare l’account Amazon alla pagina.
4. Il servizio condiviso dovrà conservare gli avvisi e distribuirli al tablet. I token dei dispositivi resteranno sul servizio, non nel codice React.

Questo passaggio richiede una scelta di integrazione e credenziali inserite attraverso i canali sicuri previsti. Non servono password o token in chat e non sono state aggiunte richieste di segreti generiche alla configurazione.

## Verifiche

```bash
npm run check       # controllo del codice, test dei widget e build TypeScript/Vite
npm run test:e2e    # prove in un browser Chromium su desktop, tablet e smartphone
npm run test:watch  # test interattivi durante lo sviluppo
npm run format     # formattazione dei file del progetto
```

I test coprono caricamento meteo, avviso pioggia, errori di rete, dati incompleti, luci dimostrative, i quattro promemoria, duplicati, rimozione e persistenza, dati locali corrotti e storage non disponibile. Le prove browser controllano anche assenza di scorrimento orizzontale e visibilità dell’avviso sul tablet orizzontale. Non sono prove eseguite su un dispositivo Android fisico.

In questo cloud Playwright usa il Chromium già presente in `/usr/bin/chromium`. Puoi indicare un altro eseguibile con `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Su altre macchine, se non è presente un browser, occorre installarne uno con `npx playwright install chromium` e le relative librerie di sistema. Nel cloud il download dal CDN Playwright è attualmente bloccato; qui non è necessario perché il browser di sistema funziona.

`npm run build` genera `dist/`, utilizzabile per una pubblicazione statica. `npm run preview` serve per controllare localmente quella build; non è un servizio di produzione.

## File principali

- `src/App.tsx`: schermata e interazioni dei widget.
- `src/model.ts`: dati iniziali, frasi e regole degli avvisi.
- `src/weather.ts`: ricerca località e richieste Open-Meteo.
- `src/App.css`: aspetto e adattamento alle dimensioni dello schermo.
- `src/App.test.tsx` ed `e2e/dashboard.spec.ts`: verifiche automatiche.

Ogni attività cloud è già isolata: usa il checkout esistente, senza creare worktree aggiuntivi. Il repository remoto era vuoto all’inizio; la pubblicazione del progetto e della demo su GitHub è stata autorizzata esplicitamente dall’utente. La pubblicazione dell’ambiente cloud e la pubblicazione della webapp sono due operazioni distinte.

## Pubblicazione su GitHub Pages

Il codice sorgente viene conservato nel branch `main` di `CoppaR7/HomeHub`. La versione compilata del sito viene pubblicata nel branch `gh-pages`, dalla sua cartella principale, con GitHub Pages. Non occorre scaricare file ZIP per usare il sito.

Indirizzo del sito, dopo il completamento della distribuzione GitHub Pages: **https://coppar7.github.io/HomeHub/**.

Sul tablet apri questo indirizzo con Chrome e usa il menu ⋮ → **Aggiungi a schermata Home** per creare un collegamento. Per il funzionamento continuo configura lo schermo nelle impostazioni Android o una modalità kiosk. Le luci rimangono dimostrative e Alexa non è ancora collegata.

Per preparare una nuova distribuzione, compila con il percorso corretto:

```bash
npm run build -- --base=/HomeHub/ --outDir=/workspace/scratch/homehub-pages
```

La cartella prodotta contiene `index.html`, `favicon.svg` e `assets/`. Aggiungi un file vuoto `.nojekyll` alla cartella di pubblicazione. Pubblica questi file alla radice del branch `gh-pages`, mantenendo i sorgenti nel branch `main`, quindi controlla l’esito della distribuzione e le risorse all’indirizzo pubblico. Il semplice push su `main` non aggiorna il sito: questa prima configurazione usa la pubblicazione del branch compilato. Non inserire token, password o file di configurazione personali nei file pubblicati.
