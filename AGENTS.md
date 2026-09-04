# Pratiche Automud — specifica di progetto

## Scopo

Automud S.r.l. acquista auto incidentate da privati. Dopo che un commerciale ha concordato il prezzo, il cliente riceve via WhatsApp un link a una web app. Con il minimo intervento umano, il cliente completa i dati per il pagamento, sceglie l'agenzia per il passaggio di proprietà, indica una preferenza per l'appuntamento e fornisce i dati necessari al ritiro con carro attrezzi.

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
- Google Maps Platform: Places API (New) e Geocoding API, esclusivamente lato server
- Deploy su Vercel

## Attori e responsabilità

### Cliente

È il privato che vende l'auto. Non crea un account e usa esclusivamente il link ricevuto, principalmente da smartphone. Compila l'intero flusso senza interruzioni e senza vedere o conoscere le verifiche interne.

### Operatore Automud

È il commerciale che usa il pannello admin per creare e consultare le pratiche, eseguire le cinque verifiche dopo la compilazione del cliente, comunicare eventuali anomalie, concordare e registrare l'appuntamento reale e importare le agenzie.

## Accesso e sicurezza

- Il link cliente ha forma `/p/[token]`.
- Il token è casuale, non indovinabile, URL-safe e lungo almeno 32 caratteri.
- Non esporre mai l'UUID `pratiche.id` nell'URL cliente.
- Il cliente non usa autenticazione: il token è l'unico titolo di accesso alla singola pratica.
- Il pannello `/admin` usa la password contenuta in `ADMIN_PASSWORD`.
- Una login admin riuscita crea un cookie httpOnly firmato, con durata di 12 ore.
- La login accetta al massimo cinque tentativi falliti per IP in una finestra di 15 minuti.
- Tutte le route sotto `/admin`, esclusa `/admin/login`, verificano la sessione.
- Tutte le operazioni admin sono server-side e usano `SUPABASE_SERVICE_ROLE_KEY`; il browser non comunica mai direttamente con Supabase.
- `GOOGLE_MAPS_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `ADMIN_PASSWORD` devono essere usate soltanto lato server.
- Lo schema abilita RLS senza policy pubbliche. Anche il futuro flusso cliente deve passare da route handler o server action che validano il token.
- Non registrare token, password, IBAN, codice fiscale o altre informazioni sensibili nei log applicativi.

## Stati della pratica

Il campo `pratiche.status` ammette soltanto:

- `creata`: l'operatore ha creato la pratica e il link non è ancora stato aperto;
- `step1_dati`: il cliente sta inserendo i dati personali;
- `step2_agenzia`: il cliente sceglie l'agenzia;
- `step3_appuntamento`: il cliente indica una preferenza per l'appuntamento;
- `step4_ritiro`: il cliente inserisce i dati per il ritiro;
- `completata`: il cliente ha terminato il flusso.

Lo step 1 passa direttamente a `step2_agenzia`. Le verifiche non modificano lo stato e non possono bloccare il cliente. Ogni cambio di stato e ogni azione rilevante produce una riga in `eventi`.

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
5. conferma della targa mostrata dall'applicazione.

Il cliente non digita la targa. Sceglie “Confermo” oppure “Non è la mia targa”. Nel secondo caso registrare un evento `targa_contestata`, evidenziarlo nel pannello admin e lasciare proseguire la pratica. Al completamento dello step impostare direttamente `step2_agenzia`.

La targa viene validata quando l'operatore crea la pratica. Normalizzarla in maiuscolo rimuovendo spazi e trattini. Se non rispetta il formato moderno `AA123AA`, mostrare un avviso ma consentire il salvataggio.

### Step 2 — Agenzia

Chiedere:

1. CAP;
2. se l'auto è cointestata; in caso affermativo avvisare che tutti i cointestatari devono essere presenti in agenzia;
3. se sono disponibili due chiavi.

Geocodificare il CAP passando prima da `cap_coordinate`. Mostrare fino a quattro agenzie attive entro 25 km, ordinate per distanza e senza preferenze ulteriori. Per ogni agenzia mostrare nome, indirizzo, distanza e telefono. La distanza si calcola localmente con Haversine.

Se non esistono agenzie entro 25 km, mostrare comunque le quattro agenzie attive più vicine, rendere evidente la distanza e registrare l'evento `nessuna_agenzia_nel_raggio`.

### Step 3 — Preferenza appuntamento

Il testo introduttivo è: “Quando preferiresti andare in agenzia? Ti confermeremo noi l'appuntamento”. La selezione del cliente è una preferenza, non un appuntamento confermato.

Se `is_proprietario = true`, mostrare il calendario. Se `is_proprietario = false`, chiedere “Conosci gli orari del proprietario?”. Se la risposta è sì, mostrare il calendario. Se la risposta è no, mostrare “Ci sentiamo su WhatsApp per concordare l'orario”, lasciare `preferenza_data` a `null` e proseguire allo step 4.

Regole del calendario, calcolate lato server nel fuso `Europe/Rome`:

- offrire sempre esattamente tre giorni selezionabili a partire da oggi;
- non offrire mai la domenica; saltarla e aggiungere il giorno successivo per mantenere tre opzioni;
- dopo le 18:00 non offrire oggi e partire da domani;
- dopo le 12:00 e fino alle 18:00 offrire oggi soltanto con la fascia `pomeriggio`;
- negli altri giorni offrire `mattina` e `pomeriggio`.

### Step 4 — Ritiro

Chiedere dove si trova l'auto: `casa`, `deposito` o `carrozzeria`. Raccogliere indirizzo preciso e telefono di contatto.

### Completamento

Mostrare una spiegazione finale:

- lasciare le chiavi e le eventuali doppie chiavi nell'auto;
- se l'auto è in deposito o carrozzeria non serve la presenza del cliente, ma il cliente deve avvisare la struttura;
- il carro attrezzi contatterà il cliente entro 24 ore.

Impostare quindi lo stato su `completata`. Le verifiche e la conferma dell'appuntamento avvengono successivamente e non sono visibili nel flusso cliente.

## Verifiche dell'operatore

Le cinque verifiche sono tutte informative per l'operatore e non producono transizioni di stato. La semantica uniforme è:

- `true`: anomalia rilevata;
- `false`: verificato, nessuna anomalia;
- `null`: non ancora verificato.

I campi sono:

- `check_intestatario_non_corrisponde`;
- `check_cdp_cartaceo`;
- `check_revisione_scaduta`;
- `check_km_scalati`;
- `check_fermo_amministrativo`.

Quando l'operatore dichiara conclusa l'attività, valorizza `verifiche_completate_at`. Eventuali indicazioni su CDP cartaceo, revisione scaduta o altre anomalie vengono comunicate al cliente a voce o su WhatsApp, mai durante il flusso web.

## Persistenza e ripresa

- Ogni schermata salva immediatamente i dati su Supabase.
- Se il cliente chiude e riapre il link, il server ricostruisce il punto corretto usando `status` e i campi già compilati.
- Le operazioni di salvataggio devono essere idempotenti quando possibile.
- Le transizioni di stato devono essere validate lato server; il browser non può impostare liberamente uno stato.

## Pannello admin

È uno strumento interno per due o tre operatori. Usa soltanto tabelle, form, bottoni e Tailwind di base; non richiede una UI elaborata.

### `/admin/login`

Form con la sola password. Alla riuscita crea il cookie di sessione e reindirizza a `/admin`.

### `/admin`

Lista delle pratiche dalla più recente con targa, marca/modello, nome e cognome del cliente se presenti, stato, data di creazione e tre indicatori: verifiche completate, appuntamento confermato ed eventi da attenzionare (`targa_contestata` o `nessuna_agenzia_nel_raggio`). Include il filtro “Da verificare”, definito come pratiche `completata` con `verifiche_completate_at` nullo, e il bottone “Nuova pratica”.

### `/admin/pratiche/nuova`

Form con `tipo_pratica`, `prezzo_concordato`, `targa`, `marca` e `modello`. Normalizza la targa e segnala senza bloccare un formato diverso da `AA123AA`. Al salvataggio genera il token e mostra il link completo `/p/[token]`, costruito usando `NEXT_PUBLIC_APP_URL`, con un bottone “Copia link”.

### `/admin/pratiche/[id]`

Mostra:

- riepilogo dei dati operatore e link cliente;
- dati cliente in sola lettura, raggruppati per step, usando “—” per i valori mancanti;
- cinque verifiche a tre stati con etichette italiane e il bottone “Verifiche completate”;
- preferenza del cliente, agenzia scelta con telefono ed email, data e fascia dell'appuntamento confermato modificabili;
- note operatore modificabili;
- log eventi in ordine cronologico inverso.

Ogni salvataggio dell'operatore genera un evento.

### `/admin/import-agenzie`

Legge `data/agenzie.csv`, le cui colonne sono `nome`, `email`, `telefono`, `indirizzo`, `cap`, `comune`, `provincia`, `lat`, `lng`, `maps_url`.

- Deduplicare su nome e CAP normalizzati: minuscolo e spazi collassati. Il CSV non contiene un ID.
- Inserire o aggiornare ogni riga tramite upsert.
- Se latitudine e longitudine sono già presenti, usarle senza chiamare Places e impostare `import_status = 'ok'`.
- Per ogni riga `pending` senza coordinate, chiamare Google Places API (New), Text Search, con nome e indirizzo e salvare latitudine, longitudine, `google_place_id` e orari.
- Se nessun risultato è trovato, impostare `import_status = 'not_found'`.
- Salvare ogni riga singolarmente, così un'importazione interrotta riprende dalle righe `pending`.
- Se `GOOGLE_MAPS_API_KEY` manca, inserire o aggiornare le righe, mantenerle `pending` e mostrare un messaggio chiaro.
- Un'agenzia è `attiva` soltanto se possiede un telefono; l'email è facoltativa.
- La pagina mostra le agenzie e permette di attivarle o disattivarle, rispettando il vincolo del telefono.

## Google Maps Platform

- Usare `GOOGLE_MAPS_API_KEY` solo in route handler o server action.
- Usare Places API (New), Text Search, soltanto durante l'import delle agenzie.
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
- `targa`, `marca`, `modello`: testo, inserito dall'operatore; il cliente vede i dati e conferma o contesta la targa.
- Campi cliente nullable: `is_proprietario`, `nome`, `cognome`, `codice_fiscale`, `iban`, `cap`, `cointestata`, `due_chiavi`, `agenzia_id`, `preferenza_data`, `preferenza_fascia`, `conosce_orari_proprietario`, `ubicazione_auto`, `indirizzo_ritiro`, `telefono_ritiro`.
- Verifiche nullable con semantica anomalia/ok/non verificato: `check_intestatario_non_corrisponde`, `check_cdp_cartaceo`, `check_revisione_scaduta`, `check_km_scalati`, `check_fermo_amministrativo`.
- Campi operatore nullable: `appuntamento_confermato_data`, `appuntamento_confermato_fascia`, `verifiche_completate_at`, `note_operatore`.

### `agenzie`

- `id`: UUID, chiave primaria.
- `nome`, `indirizzo`, `cap`, `comune`, `provincia`: testo importato dal CSV.
- `nome_normalizzato`, `cap_normalizzato`: campi generati usati come chiave univoca per l'upsert.
- `telefono`: testo nullable; senza telefono l'agenzia non può essere attiva.
- `email`: testo facoltativo.
- `lat`, `lng`: numerici nullable, provenienti dal CSV o da Places.
- `maps_url`, `google_place_id`: testo nullable.
- `orari`: JSONB nullable ottenuto tramite Places e non mostrato nella v1.
- `attiva`: booleano, consentito soltanto quando il telefono è presente.
- `import_status`: `pending`, `ok` oppure `not_found`.

### `cap_coordinate`

Cache del geocoding: `cap` è la chiave primaria; `lat` e `lng` sono numerici; `created_at` è il timestamp di creazione.

### `eventi`

Log di debug e amministrazione: `id`, `pratica_id`, `created_at`, `tipo` e `dettaglio` JSONB. Gli eventi vengono eliminati a cascata se viene eliminata la pratica.

Eventi da evidenziare nella lista admin: `targa_contestata` e `nessuna_agenzia_nel_raggio`.

## Regole di business centralizzate

`src/lib/config/business-rules.ts` è l'unica fonte applicativa per:

- stati, tipi pratica, fasce e ubicazioni consentiti;
- semantica e nomi delle verifiche;
- normalizzazione e validazione non bloccante della targa;
- raggio di 25 km, massimo quattro agenzie e fallback alle quattro più vicine;
- calendario a tre giorni, esclusione domenica, soglie 12:00 e 18:00 e fuso `Europe/Rome`;
- durata e rate limit della sessione admin;
- normalizzazione della chiave di deduplicazione delle agenzie.

## Variabili d'ambiente

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_MAPS_API_KEY`
- `ADMIN_PASSWORD`

`ADMIN_PASSWORD` viene usata anche come segreto per firmare il cookie del prototipo e deve quindi essere lunga e non riutilizzata altrove.

## Stato di avanzamento

Ultimo aggiornamento: 4 settembre 2026.

Completato:

- scaffolding Next.js App Router con TypeScript, Tailwind CSS ed ESLint;
- dipendenza `@supabase/supabase-js`;
- specifica aggiornata al flusso cliente senza verifiche bloccanti;
- regole di business centralizzate aggiornate;
- migration iniziale, migration del flusso operatore e migration di supporto admin;
- autenticazione admin con cookie firmato, scadenza a 12 ore e rate limit persistente per IP;
- lista pratiche con filtro “Da verificare” e indicatori di attenzione;
- creazione pratiche con normalizzazione targa, avviso non bloccante e link cliente copiabile;
- dettaglio pratica con dati cliente, verifiche a tre stati, appuntamento confermato, note e log eventi;
- import idempotente di `data/agenzie.csv`, arricchimento tramite Places API (New), ripresa delle righe `pending` e attivazione/disattivazione;
- accesso admin a Supabase esclusivamente server-side tramite service role;
- `.env.example` completo;
- istruzioni locali, Supabase, import agenzie e Vercel aggiornate in `README.md`.

Non ancora implementato:

- flusso cliente `/p/[token]`;
- flusso cliente, relativo accesso applicativo a Supabase, transizioni ed eventi;
- integrazione Google Geocoding;
- ricerca delle agenzie e Haversine;
- test automatici e deploy Vercel.

## Domande aperte

Nessuna.
