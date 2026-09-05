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
- Ogni chiamata a Google Maps o Supabase che fallisce deve essere registrata nel log server e produrre nel pannello un messaggio visibile all'operatore con la causa. Non lasciare mai uno stato `pending` senza una spiegazione operativa.
- Ogni task che modifica `/p/` deve concludersi con la frase “Eseguire la checklist di test manuale” nel riepilogo.

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
- Lo schema abilita RLS senza policy pubbliche. Il flusso cliente passa da server action che rileggono la pratica e validano il token e la schermata consentita prima di ogni scrittura.
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

Il flusso seguente è implementato in `/p/[token]`.

### Navigazione

L'ordine fisso delle schermate è definito in un unico file. “Indietro” apre la schermata precedente applicabile, saltando quelle che non appartengono al percorso corrente. Dopo ogni salvataggio si apre sempre la schermata successiva applicabile nell'ordine fisso; la ricerca del primo campo vuoto è usata soltanto per riprendere il percorso quando il cliente riapre il link senza un parametro di navigazione. Ogni schermata viene renderizzata con una `key` univoca uguale al proprio identificatore, così i componenti non conservano lo stato della schermata precedente. Ogni server action legge e salva soltanto il campo appartenente alla propria schermata, oltre agli eventuali aggiornamenti di stato ed eventi previsti.

### Apertura

Il cliente apre `/p/[token]` e vede targa, marca, modello e prezzo concordato. Risponde alla domanda “Sei tu il proprietario dell'auto?”. Se risponde no, vede un avviso: il proprietario dovrà essere fisicamente presente in agenzia. Il cliente può comunque proseguire.

### Step 1 — Dati personali

Mostrare una domanda per schermata:

1. nome;
2. cognome;
3. codice fiscale, con validazione del formato italiano a 16 caratteri e del carattere di controllo calcolato con la somma dei valori delle posizioni dispari e pari modulo 26;
4. IBAN, con lunghezza specifica per paese e checksum mod-97; se chi compila non è il proprietario, spiegare che il conto deve essere intestato al proprietario;
5. conferma della targa mostrata dall'applicazione.

Il cliente vede la targa inserita dall'operatore e sceglie “Confermo” oppure “Non è la mia targa”. Nel secondo caso mostrare una schermata separata con la domanda “Scrivi la targa che vedi sul libretto”. Normalizzare il valore come la targa inserita dall'operatore; un formato diverso da quello moderno produce un avviso non bloccante. Salvare il valore in `targa_cliente`, registrare un evento `targa_contestata` contenente sia `targa_operatore` sia `targa_cliente`, evidenziarlo nel pannello admin e lasciare proseguire la pratica. Al completamento dello step impostare direttamente `step2_agenzia`.

La targa viene validata quando l'operatore crea la pratica. Normalizzarla in maiuscolo rimuovendo spazi e trattini. Se non rispetta il formato moderno `AA123AA`, mostrare un avviso ma consentire il salvataggio.

### Step 2 — Agenzia

Chiedere:

1. CAP;
2. se l'auto è cointestata; in caso affermativo avvisare che tutti i cointestatari devono essere presenti in agenzia;
3. se sono disponibili due chiavi.

Geocodificare il CAP passando prima da `cap_coordinate`. Mostrare fino a quattro agenzie attive entro 25 km, ordinate per distanza e senza preferenze ulteriori. Per ogni agenzia mostrare nome, indirizzo, distanza e telefono. La distanza si calcola localmente con Haversine.

Se non esistono agenzie entro il raggio configurato, mostrare comunque le quattro agenzie attive più vicine, rendere evidente la distanza, registrare l'evento `nessuna_agenzia_nel_raggio` e mostrare sopra le card: “Non abbiamo agenzie entro 25 km da te. Queste sono le più vicine: se sono troppo lontane, scrivici su WhatsApp e ne cerchiamo una insieme.” Il valore del raggio nel testo proviene da `business-rules.ts`.

Se Google Geocoding restituisce `ZERO_RESULTS` o non fornisce coordinate, restare sulla schermata CAP con l'errore “Non troviamo questo CAP, controlla e riprova” e non registrare `geocoding_fallito`. Soltanto se il servizio non è disponibile per chiave, quota, rete o altro errore operativo mostrare la schermata rassicurante, proseguire senza `agenzia_id` e registrare `geocoding_fallito` con CAP e causa. Il pannello deve rendere evidente questo evento.

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

Chiedere, una schermata alla volta, dove si trova l'auto (`casa`, `deposito` o `carrozzeria`), l'indirizzo preciso e il telefono di contatto del carro attrezzi.

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

## Esperienza cliente e stile

- Progettare prima per 375 px; su desktop mantenere una colonna centrata larga al massimo circa 480 px.
- Mostrare una sola domanda per schermata, una sola spiegazione breve, un campo o gruppo di scelte e il bottone “Continua”.
- Mostrare il link “Indietro” sotto il bottone e un contatore testuale `x di N` in fondo, senza barra.
- Il bottone resta subito sotto il campo per essere visibile con la tastiera mobile; usare `inputmode`, `autocomplete` e `autocapitalize` appropriati e scorrere il campo in vista al focus.
- Tutti i testi cliente risiedono esclusivamente in `src/lib/copy/customer.ts`, sono in italiano, diretti, caldi e senza gergo interno.
- Usare Red Hat Display tramite `next/font`, colonna crema, header marrone arrotondato e arancione come colore primario, coerentemente con `offerta.automud.com`.
- Non usare librerie UI: soltanto Tailwind CSS.

## Pannello admin

È uno strumento interno per due o tre operatori. Usa soltanto tabelle, form, bottoni e Tailwind di base; non richiede una UI elaborata.

### `/admin/login`

Form con la sola password. Alla riuscita crea il cookie di sessione e reindirizza a `/admin`.

### `/admin`

Lista delle pratiche dalla più recente con targa, marca/modello, nome e cognome del cliente se presenti, stato, data di creazione e tre indicatori: verifiche completate, appuntamento confermato ed eventi da attenzionare (`targa_contestata`, `nessuna_agenzia_nel_raggio`, `geocoding_fallito` o errori dei servizi esterni). Gli errori esterni non risolti sono mostrati con la causa in cima alla pagina. Include il filtro “Da verificare”, definito come pratiche `completata` con `verifiche_completate_at` nullo, e il bottone “Nuova pratica”.

### `/admin/pratiche/nuova`

Form con `tipo_pratica`, `prezzo_concordato`, `targa`, `marca` e `modello`. Normalizza la targa e segnala senza bloccare un formato diverso da `AA123AA`. Normalizza marca e modello con l'iniziale maiuscola di ogni parola, per esempio `audi a3` diventa `Audi A3`. Al salvataggio genera il token e mostra il link completo `/p/[token]`, costruito usando `NEXT_PUBLIC_APP_URL`, con un bottone “Copia link”.

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
- Salvare ogni errore Places in `import_error`, includendo la causa restituita dall'API, e mostrarlo accanto allo stato.
- Eseguire al massimo dieci chiamate Places per pressione del bottone e mostrare quante righe sono state elaborate e quante restano `pending`.
- Salvare ogni riga singolarmente, così un'importazione interrotta riprende dalle righe `pending`.
- Se `GOOGLE_MAPS_API_KEY` manca, inserire o aggiornare le righe, mantenerle `pending` e mostrare un messaggio chiaro.
- Un'agenzia è `attiva` soltanto se possiede un telefono; l'email è facoltativa.
- La pagina mostra il riepilogo totale/ok/not found/pending, le agenzie e permette di attivarle o disattivarle, rispettando il vincolo del telefono. Mostrare `indirizzo` una sola volta, senza aggiungere nuovamente CAP e comune.

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
- `targa_cliente`: testo nullable, compilato soltanto quando il cliente contesta la targa dell'operatore.
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
- `import_error`: ultima causa di errore Places, nullable e cancellata dopo un esito conclusivo.

### `cap_coordinate`

Cache del geocoding: `cap` è la chiave primaria; `lat` e `lng` sono numerici; `created_at` è il timestamp di creazione.

### `eventi`

Log di debug e amministrazione: `id`, `pratica_id`, `created_at`, `tipo` e `dettaglio` JSONB. Gli eventi vengono eliminati a cascata se viene eliminata la pratica.

Eventi da evidenziare nella lista admin: `targa_contestata`, `nessuna_agenzia_nel_raggio`, `geocoding_fallito` ed errori dei servizi esterni.

### `operator_alerts`

Messaggi operativi generati dai fallimenti dei servizi esterni: `id`, `created_at`, `source`, `message`, `context` e `resolved_at`. Sono visibili in `/admin` e possono essere contrassegnati come risolti.

## Regole di business centralizzate

`src/lib/config/business-rules.ts` è l'unica fonte applicativa per:

- stati, tipi pratica, fasce e ubicazioni consentiti;
- semantica e nomi delle verifiche;
- normalizzazione e validazione non bloccante della targa;
- normalizzazione di marca e modello con iniziale maiuscola per parola;
- raggio di 25 km, massimo quattro agenzie e fallback alle quattro più vicine;
- calendario a tre giorni, esclusione domenica, soglie 12:00 e 18:00 e fuso `Europe/Rome`;
- durata e rate limit della sessione admin;
- normalizzazione della chiave di deduplicazione delle agenzie.
- validazione completa di codice fiscale, IBAN, CAP e telefono, batch Places e formula di Haversine.

## Test manuale del flusso cliente

Dopo ogni task che modifica `/p/`, eseguire da smartphone questa checklist:

1. completare l'intero percorso con dati validi;
2. verificare che un codice fiscale errato, incluso il carattere di controllo, e un IBAN errato vengano rifiutati;
3. usare “Indietro” da ogni schermata e poi “Continua”, verificando che ogni campo mostri e salvi esclusivamente il proprio valore;
4. chiudere il browser a metà percorso e riaprire lo stesso link, verificando la ripresa dal primo dato mancante;
5. riaprire il link dopo il completamento e verificare che compaia sempre la schermata finale;
6. completare il ramo proprietario “No” con orari del proprietario sconosciuti;
7. inserire un CAP inesistente e verificare che si resti sulla domanda del CAP senza evento `geocoding_fallito`;
8. usare un CAP senza agenzie nel raggio e verificare avviso, quattro opzioni più vicine ed evento `nessuna_agenzia_nel_raggio`;
9. contestare la targa, inserire quella del libretto e verificare normalizzazione, avviso non bloccante ed evento con entrambe le targhe;
10. controllare nel pannello admin che tutti i dati e gli eventi siano corretti e che le targhe operatore/cliente siano evidenti.

## Variabili d'ambiente

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_WHATSAPP_NUMBER`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_MAPS_API_KEY`
- `ADMIN_PASSWORD`

`ADMIN_PASSWORD` viene usata anche come segreto per firmare il cookie del prototipo e deve quindi essere lunga e non riutilizzata altrove.

## Stato di avanzamento

Ultimo aggiornamento: 5 settembre 2026.

Completato:

- scaffolding Next.js App Router con TypeScript, Tailwind CSS ed ESLint;
- dipendenza `@supabase/supabase-js`;
- specifica aggiornata al flusso cliente senza verifiche bloccanti;
- regole di business centralizzate aggiornate;
- migration iniziale, migration del flusso operatore, migration di supporto admin, migration del flusso cliente e migration per `targa_cliente`;
- autenticazione admin con cookie firmato, scadenza a 12 ore e rate limit persistente per IP;
- lista pratiche con filtro “Da verificare” e indicatori di attenzione;
- creazione pratiche con normalizzazione targa, avviso non bloccante e link cliente copiabile;
- dettaglio pratica con dati cliente, verifiche a tre stati, appuntamento confermato, note e log eventi;
- import idempotente di `data/agenzie.csv`, arricchimento tramite Places API (New), ripresa delle righe `pending` e attivazione/disattivazione;
- accesso admin a Supabase esclusivamente server-side tramite service role;
- flusso cliente completo `/p/[token]`, mobile-first, con una domanda per schermata, ripresa automatica e testi centralizzati;
- navigazione cliente basata su un ordine fisso, con precedente/successiva applicabile e ripresa separata dal primo dato mancante;
- validazione server e browser di codice fiscale, incluso il carattere di controllo, IBAN, CAP e telefono;
- gestione distinta di CAP inesistente e indisponibilità del servizio Geocoding;
- acquisizione della targa indicata dal cliente e visualizzazione delle due targhe nel pannello;
- normalizzazione di marca e modello alla creazione della pratica;
- geocoding CAP con cache, calcolo Haversine, fallback senza agenzia ed eventi di attenzione;
- calendario server-side basato esclusivamente su `getAppointmentPreferenceOptions`;
- pagina finale adattata a preferenza, chiavi, luogo di ritiro, telefono e agenzia scelta;
- gestione visibile degli errori esterni tramite avvisi operatore e `agenzie.import_error`;
- import Places in batch da dieci con riepilogo e causa degli errori;
- test automatici per navigazione, validazioni, calendario e Haversine;
- `.env.example` completo;
- istruzioni locali, Supabase, import agenzie e Vercel aggiornate in `README.md`.

Non ancora implementato:

- deploy Vercel.

## Domande aperte

Nessuna.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
