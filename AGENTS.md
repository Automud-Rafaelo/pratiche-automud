# Pratiche Automud — specifica di progetto

## Scopo

Automud S.r.l. acquista auto incidentate da privati. Dopo che un commerciale ha concordato il prezzo, il cliente riceve via WhatsApp un link a una web app. Con il minimo intervento umano, il cliente deve completare i dati per il pagamento, scegliere l'agenzia per il passaggio di proprietà, prenotare l'appuntamento e fornire i dati necessari al ritiro con carro attrezzi.

Il prodotto è un prototipo da testare con clienti reali. Le priorità sono:

1. massima semplicità;
2. esperienza mobile-first;
3. salvataggio immediato e ripartenza dal punto di interruzione.

## Regole per ogni task futuro

- Leggere questo file prima di modificare il progetto.
- Non cambiare lo stack senza una richiesta esplicita.
- Scrivere codice, nomi di variabili e commenti in inglese.
- Scrivere in italiano tutti i testi visibili all'utente.
- Aggiornare sempre la sezione **Stato di avanzamento**.
- Inserire le ambiguità in **Domande aperte** e scegliere la soluzione più semplice e reversibile; non inventare requisiti.
- Mantenere tutte le regole di business in `src/lib/config/business-rules.ts`, senza duplicarle nei componenti, nelle route o nei servizi.
- Non introdurre servizi esterni diversi da Supabase e Google Maps Platform.

## Stack obbligatorio

- Next.js con App Router
- TypeScript
- Tailwind CSS
- Supabase Postgres tramite `@supabase/supabase-js`
- Google Maps Platform: Places API e Geocoding API, esclusivamente lato server
- Deploy su Vercel

## Ambito dell'inizializzazione

Questo task crea soltanto lo scaffolding Next.js, lo schema Supabase, la configurazione delle regole, la documentazione e l'esempio delle variabili d'ambiente. Non implementa le schermate del flusso cliente, il pannello admin, gli endpoint, le server action, l'import CSV o le chiamate Google Maps.

## Attori

### Cliente

Privato che vende l'auto. Non crea un account e usa esclusivamente il link ricevuto, principalmente da smartphone.

### Operatore Automud

Commerciale che usa il pannello admin per creare pratiche, controllarne lo stato, eseguire verifiche manuali e importare le agenzie.

## Accesso e sicurezza

- Il link cliente ha forma `/p/[token]`.
- Il token è casuale, non indovinabile, URL-safe e lungo almeno 32 caratteri.
- Non esporre mai l'UUID `pratiche.id` nell'URL.
- Il cliente non usa autenticazione: il token è l'unico titolo di accesso alla singola pratica.
- Il pannello `/admin` usa una password semplice contenuta in `ADMIN_PASSWORD`.
- `GOOGLE_MAPS_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `ADMIN_PASSWORD` devono essere usate solo lato server.
- Lo schema iniziale abilita RLS senza policy pubbliche. Finché non viene definito un modello RLS sicuro basato sul token, le operazioni del cliente devono passare da route handler o server action che validano il token e usano la service role key sul server.
- Non registrare token, password, IBAN, codice fiscale o altre informazioni sensibili nei log applicativi.

## Stati della pratica

Il campo `pratiche.status` ammette soltanto:

- `creata`: l'operatore ha creato la pratica; il link non è ancora stato aperto.
- `step1_dati`: il cliente sta inserendo i dati personali.
- `in_verifica`: lo step 1 è completo e il cliente attende le verifiche dell'operatore.
- `bloccata`: una verifica bloccante è fallita; il cliente vede che verrà ricontattato dal commerciale e non può proseguire.
- `step2_agenzia`: le verifiche sono state superate e il cliente sceglie l'agenzia.
- `step3_appuntamento`: il cliente organizza l'appuntamento.
- `step4_ritiro`: il cliente inserisce i dati per il ritiro.
- `completata`: il flusso è terminato.

Ogni cambio di stato e ogni azione rilevante deve produrre una riga in `eventi`.

## Flusso cliente di riferimento

Il flusso seguente è specificato ma non ancora implementato.

### Apertura

Il cliente apre `/p/[token]` e vede targa, marca, modello e prezzo concordato. Risponde alla domanda “Sei tu il proprietario dell'auto?”. Se risponde no, vede un avviso: il proprietario dovrà essere fisicamente presente in agenzia. Il cliente può comunque proseguire.

### Step 1 — Dati personali

Mostrare una domanda per schermata:

1. nome;
2. cognome;
3. codice fiscale, con validazione del formato italiano;
4. IBAN, con validazione del formato IBAN;
5. conferma della targa, con validazione del formato italiano.

Al completamento impostare lo stato su `in_verifica` e mostrare una schermata di attesa.

### Verifiche operatore

L'operatore compila cinque verifiche, inizialmente `null` per indicare “non ancora verificato”.

Verifiche bloccanti:

- corrispondenza dell'intestatario;
- chilometri scalati;
- fermo amministrativo.

Se una verifica bloccante fallisce, impostare `bloccata`. Il cliente non può proseguire e vede il messaggio “Ti ricontatterà il commerciale”.

Verifiche informative:

- CDP cartaceo: se presente, nello step successivo mostrare “Porta il CDP in agenzia”.
- revisione scaduta: mostrare l'avviso solo quando `tipo_pratica = 'atto_demo'`.

Quando tutte e cinque le verifiche sono non nulle e nessuna bloccante richiede il blocco, impostare `step2_agenzia`.

### Step 2 — Agenzia

Chiedere:

1. CAP;
2. se l'auto è cointestata; in caso affermativo avvisare che tutti i cointestatari devono essere presenti in agenzia;
3. se sono disponibili due chiavi.

Geocodificare il CAP passando prima da `cap_coordinate`. Mostrare fino a quattro agenzie attive entro 25 km, ordinate per distanza e senza preferenze ulteriori. Per ogni agenzia mostrare nome, indirizzo, distanza e telefono. La distanza tra CAP e agenzia si calcola localmente con la formula di Haversine.

### Step 3 — Appuntamento

Chiedere “Chi sta compilando è il proprietario?”.

- Se sì, mostrare il calendario.
- Se no, chiedere “Conosci gli orari del proprietario?”. Se sì, mostrare il calendario. Se no, mostrare “Ci sentiamo su WhatsApp entro domani per l'orario” e mantenere la pratica in `step3_appuntamento`.

Il calendario consente di scegliere tra i prossimi sei giorni a partire da oggi e poi tra `mattina` e `pomeriggio`.

### Step 4 — Ritiro

Chiedere dove si trova l'auto: `casa`, `deposito` o `carrozzeria`. Raccogliere indirizzo preciso e telefono di contatto.

### Completamento

Mostrare una spiegazione finale:

- lasciare le chiavi e le eventuali doppie chiavi nell'auto;
- se l'auto è in deposito o carrozzeria non serve la presenza del cliente, ma il cliente deve avvisare la struttura;
- il carro attrezzi contatterà il cliente entro 24 ore.

Impostare quindi lo stato su `completata`.

## Persistenza e ripresa

- Ogni schermata salva immediatamente i dati su Supabase.
- Se il cliente chiude e riapre il link, il server ricostruisce il punto corretto usando `status` e i campi già compilati.
- Le operazioni di salvataggio devono essere idempotenti quando possibile.
- Le transizioni di stato devono essere validate lato server; il browser non può impostare liberamente uno stato.

## Pannello admin di riferimento

Il pannello non è ancora implementato. Sarà disponibile su `/admin`, protetto dalla password in `ADMIN_PASSWORD`, e dovrà consentire di:

- creare una pratica con tipo, prezzo, targa, marca e modello e ottenere il link cliente;
- vedere la lista delle pratiche con il relativo stato;
- vedere il dettaglio con tutti i dati del cliente;
- compilare i cinque toggle delle verifiche;
- consultare il log eventi;
- modificare le note dell'operatore.

La pagina `/admin/import-agenzie` dovrà leggere un CSV presente nella repository, inserire le agenzie e interrogare Google Places per latitudine, longitudine, `google_place_id` e orari. Dovrà aggiornare `import_status` e poter essere rilanciata senza creare duplicati.

## Google Maps Platform

- Usare `GOOGLE_MAPS_API_KEY` solo in route handler o server action.
- Usare Places API soltanto durante l'import delle agenzie dal pannello admin.
- Usare Geocoding API soltanto per ottenere le coordinate del CAP inserito dal cliente.
- Consultare sempre `cap_coordinate` prima del geocoding. Chiedere un CAP a Google al massimo una volta e poi usare la cache.
- Calcolare la distanza agenzia–CAP localmente con Haversine.
- Gli orari ottenuti da Places sono salvati in `agenzie.orari`, ma non sono mostrati al cliente nella v1.

## Modello dati Supabase

### `pratiche`

- `id`: UUID, chiave primaria.
- `token`: testo univoco, casuale, URL-safe, almeno 32 caratteri.
- `created_at`, `updated_at`: timestamp; `updated_at` viene aggiornato tramite trigger.
- `status`: uno degli stati definiti sopra.
- `tipo_pratica`: `dini` oppure `atto_demo`, inserito dall'operatore.
- `prezzo_concordato`: numerico, inserito dall'operatore.
- `targa`, `marca`, `modello`: testo, inserito dall'operatore; il cliente vede i dati e conferma la targa.
- Campi cliente nullable: `is_proprietario`, `nome`, `cognome`, `codice_fiscale`, `iban`, `cap`, `cointestata`, `due_chiavi`, `agenzia_id`, `appuntamento_data`, `appuntamento_fascia`, `compila_proprietario`, `conosce_orari_proprietario`, `ubicazione_auto`, `indirizzo_ritiro`, `telefono_ritiro`.
- Verifiche nullable: `check_match_intestatario`, `check_cdp_cartaceo`, `check_revisione_scaduta`, `check_km_scalati`, `check_fermo_amministrativo`.
- `note_operatore`: testo nullable.

### `agenzie`

- `id`: UUID, chiave primaria.
- `nome`, `indirizzo`, `cap`, `comune`, `provincia`: testo importato dal CSV.
- `telefono`, `email`: testo.
- `lat`, `lng`: numerici nullable, ottenuti tramite Places.
- `google_place_id`: testo nullable.
- `orari`: JSONB nullable ottenuto tramite Places e non mostrato nella v1.
- `attiva`: booleano, default `true`.
- `import_status`: `pending`, `ok` oppure `not_found`.
- Lo schema iniziale usa `(nome, indirizzo, cap)` come identità univoca per rendere l'import ripetibile.

### `cap_coordinate`

Cache del geocoding: `cap` è la chiave primaria; `lat` e `lng` sono numerici; `created_at` è il timestamp di creazione.

### `eventi`

Log di debug e amministrazione: `id`, `pratica_id`, `created_at`, `tipo` e `dettaglio` JSONB. Gli eventi vengono eliminati a cascata se viene eliminata la pratica.

## Variabili d'ambiente

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_MAPS_API_KEY`
- `ADMIN_PASSWORD`

## Stato di avanzamento

Ultimo aggiornamento: 4 settembre 2026.

Completato:

- scaffolding Next.js App Router con TypeScript, Tailwind CSS ed ESLint;
- dipendenza `@supabase/supabase-js`;
- configurazione centralizzata iniziale delle regole di business;
- migration iniziale con tabelle, vincoli, indici, token casuale, trigger `updated_at` e RLS;
- `.env.example`;
- istruzioni locali, Supabase e Vercel in `README.md`.

Non ancora implementato:

- flusso cliente `/p/[token]`;
- pannello `/admin` e autenticazione amministrativa;
- accesso applicativo a Supabase, transizioni ed eventi;
- import CSV delle agenzie;
- integrazione Google Places e Geocoding;
- ricerca delle agenzie e Haversine;
- test automatici e deploy Vercel.

## Domande aperte

1. **Semantica di `check_match_intestatario`:** il nome suggerisce che `true` significhi “corrispondenza riuscita”, mentre la descrizione delle verifiche bloccanti dice che un valore `true` blocca anche per “match intestatario fallito”. Prima di automatizzare le transizioni va definita una semantica uniforme, idealmente rinominando il campo o distinguendo esito positivo e anomalia.
2. **Identità delle agenzie nel CSV:** in assenza di un identificatore stabile, la migration usa provvisoriamente la combinazione esatta `(nome, indirizzo, cap)` per evitare duplicati. Va confermato se il CSV possiede un ID oppure se la deduplicazione deve ignorare maiuscole, spazi e variazioni dell'indirizzo.
3. **Finestra dei sei giorni:** la configurazione iniziale include oggi nei sei giorni. Va confermato se si intendono giorni di calendario o lavorativi e se vanno esclusi festivi o giorni non disponibili per l'agenzia.
4. **Disponibilità degli appuntamenti:** non sono definite capacità, chiusure o conferme dell'agenzia. La soluzione minima registra soltanto data e fascia scelte dal cliente; va confermato se serve disponibilità reale.
5. **Validazione della targa:** la regola iniziale accetta il formato moderno `AA123AA`. Va chiarito se accettare targhe storiche, speciali, estere o spazi e trattini.
6. **Contatti agenzia mancanti:** `telefono` ed `email` sono nullable per non bloccare l'import. Va confermato se uno dei due debba essere obbligatorio, considerando che il telefono deve essere mostrato al cliente.
7. **Sessione admin:** è richiesta una sola password, ma non sono definiti durata della sessione, rate limiting e procedura di rotazione. Prima di esporre `/admin` a clienti reali va scelta la soluzione minima sicura.
