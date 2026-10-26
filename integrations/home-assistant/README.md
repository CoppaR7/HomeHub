# HomeHub sul QNAP TS-216G, senza Home Assistant Cloud

Questa soluzione usa **Home Assistant Container sul NAS**. Il TS-216G ha un processore ARM64 e l’immagine ufficiale Home Assistant selezionata supporta ARM64. Container Station deve essere installata sul QNAP.

HomeHub viene servito direttamente dal NAS: tablet e NAS comunicano nella rete di casa. Il sito GitHub Pages resta disponibile come anteprima; da una pagina pubblica HTTPS non si può collegare direttamente un Home Assistant locale HTTP. Non è necessario esporre il NAS su Internet per questo percorso e non viene attivato alcun abbonamento.

Per un’installazione esistente usa il pacchetto con i soli file web: [aggiornamento Bring! e ripristino](AGGIORNAMENTO.md). Non sostituire la configurazione del NAS.

## Installazione di una NUOVA istanza

Il pacchetto `HomeHub-QNAP.zip` contiene già l’app compilata e le configurazioni. **Non sovrascrivere un’installazione Home Assistant esistente** con il file `configuration.yaml` del pacchetto; in quel caso occorre unire soltanto il pacchetto HomeHub alla configurazione corrente.

1. Nel QNAP apri **App Center** e installa **Container Station**, se non presente.
2. Con **File Station** apri la cartella condivisa `Container` e crea la cartella `homehub`.
3. Estrai lo ZIP e copia il contenuto della cartella `homehub` dentro `Container/homehub`. Il risultato deve includere `Container/homehub/config/configuration.yaml`, `config/packages/homehub.yaml` e `config/www/homehub/index.html`. Il percorso usato nel contenitore è `/share/Container/homehub/config`; se la cartella condivisa ha un nome diverso, modifica il percorso nel file Compose prima di avviare.
4. In **Container Station → Applicazioni → Crea**, crea un’applicazione chiamata `homehub` usando il contenuto del file `compose.yaml` del pacchetto. Non cambiare contenitori o porte usati da altri servizi. Questa configurazione usa la rete dell’host e la porta standard Home Assistant **8123**.
5. Dopo l’avvio apri `http://IP-DEL-NAS:8123` da un browser sulla rete di casa e completa la creazione dell’account Home Assistant. L’immagine indicata è `ghcr.io/home-assistant/home-assistant:2026.10.2`; l’avvio iniziale può richiedere alcuni minuti.
6. Apri `http://IP-DEL-NAS:8123/local/homehub/index.html` sul tablet. Nelle impostazioni HomeHub, **Collega la tua casa**, inserisci `http://IP-DEL-NAS:8123` e premi **Collega**. Accedi nella pagina di Home Assistant e torna alla dashboard.

Le password di Home Assistant e dei produttori si inseriscono nelle rispettive interfacce di configurazione, mai in chat né nel repository. La sessione HomeHub viene conservata in `sessionStorage` nella scheda del browser e cancellata con “Scollega”; se chiudi completamente la scheda può essere necessario accedere di nuovo.

## Aggiunta delle lampadine

In Home Assistant usa **Impostazioni → Dispositivi e servizi → Aggiungi integrazione**. HomeHub mostra automaticamente le entità del tipo luce, con i loro nomi reali. Una luce non disponibile resta disabilitata; il sito non ne inventa lo stato e non lo cambia finché il server non lo conferma.

- **Tapo:** integrazione ufficiale **TP-Link Smart Home**. Recupera l’account Tapo usato dalle lampadine. I modelli supportati possono essere individuati nella rete locale.
- **Smart Life:** integrazione ufficiale **Tuya**. Recupera l’accesso a Smart Life sul telefono e autorizza l’integrazione tramite il codice utente e il QR previsto dall’app.
- **Meross:** va verificato il modello. Esistono dispositivi integrabili con HomeKit/Matter, se previsti dal modello, oppure il componente della comunità **Meross LAN** tramite HACS. Quest’ultimo non è un’integrazione del core Home Assistant: non installarlo alla cieca senza verificare il modello e la configurazione richiesta.
- **AvatarControls:** non assumere che l’account sia identico a Smart Life. Occorre verificare il modello e la compatibilità con Tuya/Smart Life o con un’altra integrazione. Un’eventuale nuova associazione si prova su una sola lampadina, preservando le altre finché il risultato è confermato.

Le skill Alexa esistenti possono rimanere collegate: non occorre rimuoverle per configurare queste integrazioni. L’importazione di tutte le lampadine non è ancora stata verificata sui dispositivi dell’utente.

## Frasi Alexa senza abbonamento

L’integrazione ufficiale Home Assistant **Alexa Devices** espone eventi delle interazioni vocali degli Echo. La configurazione `packages/homehub.yaml` ascolta soltanto gli eventi provenienti da questa integrazione e accende uno dei quattro promemoria persistenti. Il tablet riceve l’aggiornamento via WebSocket; “Fatto” spegne il promemoria sul NAS.

1. In Home Assistant aggiungi **Alexa Devices** e collega l’account Amazon usato dagli Echo.
2. L’integrazione richiede la verifica in due passaggi Amazon tramite **app di autenticazione**, impostata come metodo preferito. Segui la procedura Amazon nella tua area **Accesso e sicurezza → Verifica in due passaggi**. Gli OTP si inseriscono nella schermata Home Assistant; non vanno inviati all’assistente.
3. Verifica che Home Assistant abbia creato gli eventi vocali degli Echo e riceva l’attributo `voice_command` pronunciando un comando. Questo è il collaudo decisivo: il funzionamento con l’account e gli Echo reali non può essere confermato senza questa prova.
4. Pronuncia le frasi della tabella. Puoi aggiungere nell’app Alexa quattro routine con quelle attivazioni vocali e una risposta come “Promemoria aggiunto”, così Alexa risponde in modo comprensibile. La routine non chiama direttamente il NAS: il collegamento usa l’evento vocale ricevuto dall’integrazione Alexa Devices. Non è necessaria una propria skill né una funzione AWS per questo percorso.
5. Controlla che il messaggio appaia sul tablet, premi “Fatto” e ripeti la stessa frase per verificare che l’avviso possa essere aggiunto nuovamente.

| Frase pronunciata all’Echo   | Entità Home Assistant                   | Messaggio sul tablet           |
| ---------------------------- | --------------------------------------- | ------------------------------ |
| Alexa, plastica piena        | `input_boolean.homehub_plastica`        | portare via la plastica!       |
| Alexa, carta piena           | `input_boolean.homehub_carta`           | portare via la carta!          |
| Alexa, indifferenziata piena | `input_boolean.homehub_indifferenziata` | portare via l’indifferenziata! |
| Alexa, organico pieno        | `input_boolean.homehub_organico`        | portare via l’organico!        |

L’automazione ignora gli stati iniziali non disponibili e gli aggiornamenti non provenienti dagli eventi Alexa Devices. Dipende dagli eventi forniti da Amazon: se il comando non compare negli eventi, la sola routine non può aggiornare HomeHub. In quel caso bisogna diagnosticare l’integrazione prima di considerare completato il collegamento. Non viene nascosto il problema facendo comparire un promemoria soltanto locale.

Il pacchetto non imposta `initial: false` sui promemoria: Home Assistant può ripristinare gli avvisi attivi dopo un riavvio.

## Verifiche e limiti

Sono previsti test con una vera istanza Home Assistant isolata: accesso OAuth, accensione di una luce della piattaforma demo del server, ricezione di un promemoria modificato dal server, rimozione e ricaricamento. Questi test verificano il collegamento software, **non** una lampadina fisica o un comando realmente pronunciato a un Echo.

Per eseguire le prove opzionali su un’istanza dedicata di test, imposta `HOMEHUB_HA_TEST_CREDENTIALS` al percorso di un file privato contenente l’account e la sessione di test. Il file resta fuori dal repository e dai pacchetti distribuiti. Non usare l’account Amazon per queste prove.

## Fonti consultate

- [Specifiche QNAP TS-216G](https://www.qnap.com/en/product/ts-216g)
- [Installazione Home Assistant Container](https://www.home-assistant.io/installation/linux#install-home-assistant-container)
- [TP-Link Smart Home](https://www.home-assistant.io/integrations/tplink/)
- [Tuya](https://www.home-assistant.io/integrations/tuya/)
- [Meross LAN, progetto della comunità](https://github.com/krahabb/meross_lan)
- [Alexa Devices e gli eventi vocali](https://www.home-assistant.io/integrations/alexa_devices/)
