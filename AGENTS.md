# Pratiche Automud — specifica di progetto

## Scopo

Questo sistema è un prototipo di test. L'obiettivo è che il flusso e la logica vengano integrati nel gestionale interno di Automud (Express + React + PostgreSQL). Di conseguenza: la logica di dominio (validazioni, regole, parser, calcoli) va mantenuta in moduli puri senza dipendenze dal framework, con test; le API esterne vanno isolate dietro interfacce sostituibili.

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
- Google Maps Platform: Places API (New), esclusivamente lato server
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

1. nome dell'intestatario del conto, con la domanda “Come si chiama l'intestatario del conto?” e la spiegazione “Il nome di chi riceverà il bonifico, come sull'IBAN”; se `is_proprietario = false`, aggiungere “Il conto deve essere intestato al proprietario dell'auto”;
2. cognome dell'intestatario del conto, con la domanda “E il cognome?” e la spiegazione “Sempre dell'intestatario del conto”;
3. codice fiscale, con validazione del formato italiano a 16 caratteri e del carattere di controllo calcolato con la somma dei valori delle posizioni dispari e pari modulo 26;
4. IBAN, con lunghezza specifica per paese e checksum mod-97; se chi compila non è il proprietario, spiegare che il conto deve essere intestato al proprietario;
5. conferma della targa mostrata dall'applicazione.

Il cliente vede la targa inserita dall'operatore e sceglie “Confermo” oppure “Non è la mia targa”. Nel secondo caso mostrare una schermata separata con la domanda “Scrivi la targa che vedi sul libretto”. Normalizzare il valore come la targa inserita dall'operatore; un formato diverso da quello moderno produce un avviso non bloccante. Salvare il valore in `targa_cliente`, registrare un evento `targa_contestata` contenente sia `targa_operatore` sia `targa_cliente`, evidenziarlo nel pannello admin e lasciare proseguire la pratica. Al completamento dello step impostare direttamente `step2_agenzia`.

La targa viene validata quando l'operatore crea la pratica. Normalizzarla in maiuscolo rimuovendo spazi e trattini. Se non rispetta il formato moderno `AA123AA`, mostrare un avviso ma consentire il salvataggio.

### Step 2 — Agenzia

Chiedere:

1. la posizione dalla quale cercare un'agenzia;
2. se l'auto è cointestata; in caso affermativo avvisare che tutti i cointestatari devono essere presenti in agenzia;
3. se sono disponibili due chiavi.

La domanda sulla posizione usa il titolo “Da quale posizione vuoi che troviamo un'agenzia?” e il sottotitolo “Ci serve per trovare l'agenzia più comoda per te”. Mostrare suggerimenti Places limitati all'Italia dopo almeno tre caratteri e con debounce di 300 ms. Quando il cliente seleziona un suggerimento, mostrare l'indirizzo completo e chiedere conferma con “Sì, è questo” o “Cambia”. Salvare indirizzo formattato, place ID e coordinate nei campi `ricerca_*`.

Dopo la conferma, calcolare Haversine su tutte le agenzie attive con coordinate e prendere le otto più vicine. Inviare una sola richiesta `computeRouteMatrix` a Routes API con origine nella posizione scelta, otto destinazioni, `DRIVE`, `TRAFFIC_UNAWARE` e field mask `distanceMeters,duration`; ordinare per durata e mostrare le prime quattro con nome, indirizzo, telefono e testo come “18 min in auto · 14 km”.

Se Routes non risponde, ordinare le stesse candidate con Haversine, mostrare le prime quattro con “circa 14 km” e creare un avviso operatore con la causa. Il controllo del raggio di 25 km resta sempre basato su Haversine. Quando il cliente sceglie, salvare distanza stradale e durata; nel fallback salvare la distanza Haversine e lasciare nulla la durata.

Se non esistono agenzie entro il raggio configurato, mostrare comunque le quattro agenzie attive più vicine, rendere evidente la distanza, registrare l'evento `nessuna_agenzia_nel_raggio` e mostrare sopra le card: “Non abbiamo agenzie entro 25 km da te. Queste sono le più vicine: se sono troppo lontane, scrivici su WhatsApp e ne cerchiamo una insieme.” Il valore del raggio nel testo proviene da `business-rules.ts`.

Se Places non è disponibile, mostrare il fallback manuale e creare un avviso operatore con la causa. Una posizione inserita manualmente non possiede coordinate: mostrare la schermata rassicurante, proseguire senza `agenzia_id` e registrare `ricerca_agenzie_fallita` con indirizzo e causa. Il pannello deve rendere evidente questo evento.

### Step 3 — Preferenza appuntamento

Il testo introduttivo è: “Quando preferiresti andare in agenzia? Ti confermeremo noi l'appuntamento”. La selezione del cliente è una preferenza, non un appuntamento confermato.

Se `is_proprietario = true`, mostrare il calendario. Se `is_proprietario = false`, chiedere “Conosci gli orari del proprietario?”. Se la risposta è sì, mostrare il calendario. Se la risposta è no, mostrare “Ci sentiamo su WhatsApp per concordare l'orario”, lasciare `preferenza_data` a `null` e proseguire allo step 4.

Regole del calendario, calcolate lato server nel fuso `Europe/Rome`:

- offrire sempre esattamente tre giorni selezionabili a partire da oggi;
- non offrire mai la domenica; saltarla e aggiungere il giorno successivo per mantenere tre opzioni;
- dopo le 18:00 non offrire oggi e partire da domani;
- dopo le 12:00 e fino alle 18:00 offrire oggi soltanto con la fascia `pomeriggio`;
- il sabato offrire soltanto la fascia `mattina`; se il sabato corrente non ha più fasce disponibili, saltarlo;
- negli altri giorni offrire `mattina` e `pomeriggio`.

### Step 4 — Ritiro

Chiedere, una schermata alla volta, dove si trova l'auto (`casa`, `deposito` o `carrozzeria`), il luogo preciso e il telefono di contatto del carro attrezzi.

Se l'auto è a casa, cercare via e numero civico con l'autocomplete indirizzi e chiedere conferma dell'indirizzo completo. Se è in deposito o carrozzeria, chiedere rispettivamente “Come si chiama il deposito?” o “Come si chiama la carrozzeria?”, con il sottotitolo “Scrivi il nome o la via, poi scegli dalla lista”, e usare l'autocomplete per attività commerciali. Alla selezione mostrare nome e indirizzo e salvarli insieme a place ID e coordinate. Il link “Non la trovo, scrivo l'indirizzo a mano” consente sempre il fallback al campo libero per deposito e carrozzeria. Se Places non è disponibile, il fallback manuale viene mostrato anche per l'indirizzo di casa e viene creato un avviso operatore con la causa.

### Completamento

Mostrare una spiegazione finale:

- lasciare le chiavi e le eventuali doppie chiavi nell'auto;
- se l'auto è in deposito o carrozzeria non serve la presenza del cliente, ma il cliente deve avvisare la struttura;
- il carro attrezzi contatterà il cliente entro 24 ore.

Sotto il riepilogo dell'agenzia mostrare “Quando puoi passare” con gli orari del giorno preferito separati in mattina e pomeriggio alle 13:00 ed evidenziare la fascia scelta. Se quel giorno è chiuso, mostrare il giorno lavorativo successivo più vicino con un avviso. Aggiungere sempre: “Non serve un orario preciso: puoi presentarti in qualsiasi momento della fascia, negli orari di apertura dell'agenzia. Porta con te un documento d'identità e libretto auto.” Se gli orari non sono disponibili, mostrare soltanto questo testo, il telefono e “Chiama per gli orari”.

Prima di renderizzare la schermata finale, se gli orari dell'agenzia scelta sono assenti o più vecchi di sette giorni, tentare un refresh Place Details con timeout di cinque secondi. In caso di errore mostrare gli orari in cache o il fallback, e creare un avviso operatore con la causa.

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

Lista delle pratiche dalla più recente con targa, marca/modello, nome e cognome del cliente se presenti, stato, data di creazione e tre indicatori: verifiche completate, appuntamento confermato ed eventi da attenzionare (`targa_contestata`, `nessuna_agenzia_nel_raggio`, `ricerca_agenzie_fallita` o errori dei servizi esterni). Gli errori esterni non risolti sono mostrati con la causa in cima alla pagina. Include il filtro “Da verificare”, definito come pratiche `completata` con `verifiche_completate_at` nullo, e il bottone “Nuova pratica”.

### `/admin/pratiche/nuova`

Form con `tipo_pratica`, `prezzo_concordato`, `targa`, `marca` e `modello`. Normalizza la targa e segnala senza bloccare un formato diverso da `AA123AA`. Normalizza marca e modello con l'iniziale maiuscola di ogni parola, per esempio `audi a3` diventa `Audi A3`. Al salvataggio genera il token e mostra il link completo `/p/[token]`, costruito usando `NEXT_PUBLIC_APP_URL`, con un bottone “Copia link”.

### `/admin/pratiche/[id]`

Mostra:

- riepilogo dei dati operatore e link cliente;
- prezzo concordato modificabile con un evento `prezzo_modificato` contenente `{ da, a }` per ogni variazione;
- dati cliente in sola lettura, raggruppati per step, usando “—” per i valori mancanti;
- per il ritiro, nome dell'attività se presente, indirizzo e link “Apri in Google Maps” quando sono disponibili le coordinate;
- cinque verifiche a tre stati con etichette italiane e il bottone “Verifiche completate”;
- preferenza del cliente, agenzia scelta con telefono ed email, data e fascia dell'appuntamento confermato modificabili;
- distanza e durata in auto salvate al momento della scelta, quando disponibili;
- blocco degli orari dell'agenzia relativo alla data e fascia preferite dal cliente;
- note operatore modificabili;
- log eventi in ordine cronologico inverso.
- tabella “Tempo per schermata” con ogni completamento, incluse le ripetizioni dovute alla navigazione indietro, durata in secondi e totale.
- eliminazione definitiva della pratica dopo conferma tramite digitazione della targa; tutte le righe collegate vengono cancellate a cascata e il token cliente non è più valido.

Ogni salvataggio dell'operatore genera un evento.

### `/admin/import-agenzie`

Legge `data/agenzie.csv`, composto da 109 righe con le colonne `nome`, `email`, `telefono`, `indirizzo`, `cap`, `comune`, `provincia`, `maps_url`, `iban`, `intestatario_iban`, `costi_pratica`, `delega`, `istanza`. I link brevi `share.google` presenti in `maps_url` non vengono usati per l'import. `delega` e `istanza` accettano `si`, `no` o un valore vuoto, che significa sconosciuto.

- Deduplicare sull'email normalizzata in minuscolo e sul CAP normalizzato; quando il CAP è vuoto, usare la sola email. Il CSV non contiene un ID.
- Prima dell'upsert riconciliare una tantum ogni riga con una riga esistente cercando email e CAP, oppure la sola email quando il CAP CSV è vuoto; se non c'è corrispondenza, cercare per nome e CAP normalizzati. Aggiornare la riga trovata conservandone coordinate, Place ID e orari.
- Inserire le righe non riconciliate tramite upsert sulla nuova chiave e lasciarle `pending` senza coordinate.
- Le righe esistenti assenti dal nuovo CSV non vengono eliminate: vengono rese inattive per conservare i riferimenti delle pratiche.
- Per ogni riga `pending` senza coordinate, chiamare Google Places API (New), Text Search, con nome e indirizzo e salvare latitudine, longitudine e `google_place_id`.
- Durante l'import, per ogni agenzia con `google_place_id` e orari assenti o più vecchi di sette giorni, richiamare Place Details (New) e salvare `regularOpeningHours`, `businessStatus` e l'istante di aggiornamento. Questo vale anche per le agenzie che possiedono già le coordinate.
- Se nessun risultato è trovato, impostare `import_status = 'not_found'`.
- Salvare ogni errore Places in `import_error`, includendo la causa restituita dall'API, e mostrarlo accanto allo stato.
- Elaborare al massimo venti agenzie tramite Places per pressione del bottone e mostrare quante righe sono state elaborate e quante restano `pending`.
- Salvare ogni riga singolarmente, così un'importazione interrotta riprende dalle righe `pending`.
- Se `GOOGLE_MAPS_API_KEY` manca, inserire o aggiornare le righe, mantenerle `pending` e mostrare un messaggio chiaro.
- Un'agenzia è `attiva` soltanto quando ha un telefono e sia `delega` sia `istanza` sono esplicitamente `false`. Un valore `true` o `null` in uno dei due campi la mantiene inattiva.
- La pagina mostra il riepilogo totale/ok/not found/pending, il report create/aggiornate/disattivate/pending e tutte le colonne del CSV, compreso l'IBAN riservato agli operatori. Mostra inoltre quando gli orari sono stati aggiornati e consente il refresh di una singola agenzia. Permette di attivare o disattivare le agenzie rispettando tutti i requisiti di attivazione. Mostrare `indirizzo` una sola volta, senza aggiungere nuovamente CAP e comune.

## Google Maps Platform

- Usare `GOOGLE_MAPS_API_KEY` solo in route handler o server action.
- L'autocomplete cliente passa esclusivamente dai proxy server `POST /api/places/suggest` e `POST /api/places/resolve`, accessibili soltanto con un token pratica valido e limitati complessivamente a 30 richieste al minuto per pratica.
- Ogni ricerca autocomplete usa un session token UUID generato dal server, riutilizzato durante la digitazione e passato a Place Details (New) alla selezione per chiudere la sessione.
- Place Details (New) dell'autocomplete richiede soltanto `id`, `displayName`, `formattedAddress` e `location` tramite field mask.
- Il refresh degli orari usa Place Details (New) con field mask `regularOpeningHours,businessStatus`, un timeout di cinque secondi e una cache applicativa di sette giorni.
- Usare Places API (New), Text Search, soltanto durante l'import delle agenzie.
- Gli orari usano Place Details (New), richiesto come integrazione Place Details Pro, con la field mask minima indicata sopra.
- Routes API usa una sola matrice per un'origine e fino a otto destinazioni, con `DRIVE`, `TRAFFIC_UNAWARE` e field mask `distanceMeters,duration`. Deve essere abilitata e inclusa nelle restrizioni della stessa chiave Google.
- Haversine resta il calcolo locale per preselezione, avviso del raggio e fallback se Routes non è disponibile.

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
- Campi cliente nullable: `is_proprietario`, `nome`, `cognome`, `codice_fiscale`, `iban`, `ricerca_indirizzo`, `ricerca_place_id`, `ricerca_lat`, `ricerca_lng`, `cointestata`, `due_chiavi`, `agenzia_id`, `agenzia_distanza_km`, `agenzia_durata_min`, `preferenza_data`, `preferenza_fascia`, `conosce_orari_proprietario`, `ubicazione_auto`, `indirizzo_ritiro`, `ritiro_nome_attivita`, `ritiro_place_id`, `ritiro_lat`, `ritiro_lng`, `telefono_ritiro`.
- Verifiche nullable con semantica anomalia/ok/non verificato: `check_intestatario_non_corrisponde`, `check_cdp_cartaceo`, `check_revisione_scaduta`, `check_km_scalati`, `check_fermo_amministrativo`.
- Campi operatore nullable: `appuntamento_confermato_data`, `appuntamento_confermato_fascia`, `verifiche_completate_at`, `note_operatore`.

### `agenzie`

- `id`: UUID, chiave primaria.
- `nome`, `indirizzo`, `cap`, `comune`, `provincia`: testo importato dal CSV.
- `nome_normalizzato`, `email_normalizzata`, `cap_normalizzato`: campi generati; email e CAP formano la chiave univoca dell'upsert.
- `telefono`: testo nullable.
- `email`: testo importato e normalizzato in minuscolo per la chiave.
- `iban`, `intestatario_iban`, `costi_pratica`: testo nullable importato dal CSV e visibile soltanto nel pannello.
- `delega`, `istanza`: booleani nullable; il valore nullo significa sconosciuto.
- `lat`, `lng`: numerici nullable, ottenuti da Places; quelli già presenti sulle righe riconciliate vengono conservati.
- `maps_url`, `google_place_id`: testo nullable.
- `orari`: JSONB nullable con `regularOpeningHours` e `businessStatus` ottenuti tramite Place Details e mostrati nel riepilogo finale e nel dettaglio pratica.
- `orari_aggiornati_at`: timestamp nullable dell'ultimo refresh riuscito; gli orari scadono dopo sette giorni.
- `attiva`: booleano, consentito soltanto con telefono presente, `delega = false` e `istanza = false`.
- `import_status`: `pending`, `ok` oppure `not_found`.
- `import_error`: ultima causa di errore Places, nullable e cancellata dopo un esito conclusivo.

### `eventi`

Log di debug e amministrazione: `id`, `pratica_id`, `created_at`, `tipo` e `dettaglio` JSONB. Gli eventi vengono eliminati a cascata se viene eliminata la pratica.

Quando il server serve una schermata cliente registra `schermata_visualizzata`. Dopo ogni salvataggio registra `schermata_completata` con `{ schermata, durata_ms }`, calcolando la durata dall'ultima visualizzazione della stessa schermata. Le schermate ripetute producono righe distinte. Il log admin mostra data e ora fino ai secondi e una tabella riepiloga le singole durate e il totale.

Eventi da evidenziare nella lista admin: `targa_contestata`, `nessuna_agenzia_nel_raggio`, `ricerca_agenzie_fallita` ed errori dei servizi esterni.

### `operator_alerts`

Messaggi operativi generati dai fallimenti dei servizi esterni: `id`, `created_at`, `pratica_id` nullable con cancellazione a cascata, `source`, `message`, `context` e `resolved_at`. Sono visibili in `/admin` e possono essere contrassegnati come risolti.

### `place_autocomplete_requests`

Prenotazioni del rate limit del proxy Places: `id`, `pratica_id` con cancellazione a cascata e `requested_at`. Non sono accessibili pubblicamente.

## Regole di business centralizzate

`src/lib/config/business-rules.ts` è l'unica fonte applicativa per:

- stati, tipi pratica, fasce e ubicazioni consentiti;
- semantica e nomi delle verifiche;
- normalizzazione e validazione non bloccante della targa;
- normalizzazione di marca e modello con iniziale maiuscola per parola;
- raggio Haversine di 25 km, otto candidate Routes, massimo quattro risultati e fallback Haversine;
- calendario a tre giorni, esclusione domenica, sabato solo mattina, soglie 12:00 e 18:00 e fuso `Europe/Rome`;
- durata e rate limit della sessione admin;
- autocomplete Places: minimo tre caratteri, debounce 300 ms, massimo 30 richieste al minuto e massimo cinque suggerimenti;
- orari agenzia: TTL sette giorni, timeout cinque secondi, field mask Place Details e divisione delle fasce alle 13:00;
- matrice Routes: numero di candidate, modalità di viaggio, preferenza, field mask, timeout e fallback Haversine;
- normalizzazione della chiave di deduplicazione delle agenzie.
- validazione completa di codice fiscale, IBAN e telefono, batch Places e formula di Haversine.

## Test manuale del flusso cliente

Dopo ogni task che modifica `/p/`, eseguire da smartphone questa checklist:

1. completare l'intero percorso con dati validi;
2. verificare che un codice fiscale errato, incluso il carattere di controllo, e un IBAN errato vengano rifiutati;
3. usare “Indietro” da ogni schermata e poi “Continua”, verificando che ogni campo mostri e salvi esclusivamente il proprio valore;
4. chiudere il browser a metà percorso e riaprire lo stesso link, verificando la ripresa dal primo dato mancante;
5. riaprire il link dopo il completamento e verificare che compaia sempre la schermata finale;
6. completare il ramo proprietario “No” con orari del proprietario sconosciuti;
7. cercare una posizione, selezionare un suggerimento, usare “Cambia”, selezionare di nuovo e confermare l'indirizzo, verificando che le agenzie siano ordinate per distanza;
8. usare una posizione senza agenzie nel raggio e verificare avviso, quattro opzioni più vicine ed evento `nessuna_agenzia_nel_raggio`;
9. scegliere il ritiro a casa, selezionare e confermare un indirizzo tramite autocomplete;
10. scegliere il ritiro in carrozzeria, selezionare e confermare nome e indirizzo tramite autocomplete e verificare il link Google Maps nel pannello;
11. verificare il fallback “Non la trovo, scrivo l'indirizzo a mano” e il fallback manuale quando Places non è disponibile;
12. contestare la targa, inserire quella del libretto e verificare normalizzazione, avviso non bloccante ed evento con entrambe le targhe;
13. modificare il prezzo dal pannello, riaprire la schermata iniziale cliente e verificare che mostri subito il valore corrente e l'evento `prezzo_modificato`;
14. verificare nel pannello la tabella dei tempi, includendo le schermate ripetute tornando indietro, e i timestamp del log fino ai secondi;
15. eliminare una pratica digitando la targa, quindi verificare che scompaiano dati collegati e avvisi e che il link cliente mostri la pagina di link non valido;
16. controllare nel pannello admin che tutti i dati e gli eventi siano corretti e che le targhe operatore/cliente siano evidenti.
17. importare il nuovo CSV da 109 righe, rilanciare l'import e verificare che non compaiano doppioni, che le righe assenti vengano disattivate e che il report mostri create/aggiornate/disattivate/pending;
18. verificare che un'agenzia con `delega = true` o con delega/istanza sconosciute non sia attivabile e non compaia al cliente;
19. arrivare al calendario quando tra le opzioni c'è un sabato e verificare che sia disponibile soltanto la mattina;
20. completare scegliendo una preferenza e verificare nella pagina finale e nel pannello gli orari dell'agenzia, la separazione alle 13:00 e la fascia preferita evidenziata;
21. verificare che le card agenzia mostrino tempo in auto e distanza stradale e che il pannello salvi i valori dell'agenzia scelta;
22. rendere Routes API temporaneamente indisponibile e verificare le card “circa … km”, l'ordinamento Haversine e l'avviso operatore con la causa.

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

Ultimo aggiornamento: 14 settembre 2026.

Completato:

- scaffolding Next.js App Router con TypeScript, Tailwind CSS ed ESLint;
- dipendenza `@supabase/supabase-js`;
- specifica aggiornata al flusso cliente senza verifiche bloccanti;
- regole di business centralizzate aggiornate;
- migration iniziale, migration del flusso operatore, migration di supporto admin, migration del flusso cliente, migration per `targa_cliente`, migration Places/ritiro/cascade e migration unica per dati agenzie, orari e metriche Routes;
- autenticazione admin con cookie firmato, scadenza a 12 ore e rate limit persistente per IP;
- lista pratiche con filtro “Da verificare” e indicatori di attenzione;
- creazione pratiche con normalizzazione targa, avviso non bloccante e link cliente copiabile;
- dettaglio pratica con dati cliente, verifiche a tre stati, appuntamento confermato, note e log eventi;
- import idempotente del CSV da 109 agenzie con riconciliazione delle righe storiche, deduplicazione email+CAP, disattivazione delle righe assenti e vincoli su telefono/delega/istanza;
- accesso admin a Supabase esclusivamente server-side tramite service role;
- flusso cliente completo `/p/[token]`, mobile-first, con una domanda per schermata, ripresa automatica e testi centralizzati;
- navigazione cliente basata su un ordine fisso, con precedente/successiva applicabile e ripresa separata dal primo dato mancante;
- validazione server e browser di codice fiscale, incluso il carattere di controllo, IBAN e telefono;
- ricerca posizione cliente tramite Places Autocomplete e conferma dell'indirizzo;
- proxy Places autenticato dal token pratica, con session token server-side, field mask minima, limite persistente di 30 richieste al minuto e provider sostituibile;
- autocomplete del ritiro per casa, deposito e carrozzeria, con conferma, dati strutturati e fallback manuale;
- acquisizione della targa indicata dal cliente e visualizzazione delle due targhe nel pannello;
- normalizzazione di marca e modello alla creazione della pratica;
- calcolo Haversine dalle coordinate scelte, fallback senza agenzia ed eventi di attenzione;
- calendario server-side basato esclusivamente su `getAppointmentPreferenceOptions`;
- sabato limitato alla fascia mattina nel calendario, con test automatici;
- pagina finale adattata a preferenza, chiavi, luogo di ritiro, telefono e agenzia scelta;
- refresh e visualizzazione degli orari dell'agenzia nella pagina finale e nel pannello, con cache di sette giorni e fallback telefonico;
- selezione agenzie tramite matrice Routes sulle otto candidate Haversine, con distanza/durata persistite e fallback locale segnalato agli operatori;
- tempi di completamento delle singole schermate, incluse ripetizioni, riepilogati nel pannello;
- modifica del prezzo concordato con storico evento e lettura dinamica nel flusso cliente;
- eliminazione definitiva della pratica e dei dati collegati tramite conferma della targa;
- gestione visibile degli errori esterni tramite avvisi operatore e `agenzie.import_error`;
- import Places in batch da venti con report create/aggiornate/disattivate/pending e causa degli errori;
- branch della pull request riallineato a `main`, mantenendo il registro aggiornato di 109 agenzie come sorgente CSV;
- test automatici per navigazione, validazioni, importi, conferma targa, calendario, Haversine, parser orari, provider Places/Routes e tempi schermata;
- `.env.example` completo;
- istruzioni locali, Supabase, import agenzie e Vercel aggiornate in `README.md`.

Non ancora implementato:

- deploy Vercel.

## Domande aperte

- La documentazione Google corrente classifica `regularOpeningHours` nella SKU Place Details Enterprise, non Pro: confermare che costi e restrizioni del progetto Google Cloud siano compatibili prima del test in produzione.
- La field mask Routes richiesta contiene soltanto `distanceMeters,duration`; la documentazione Google raccomanda anche indici e stato per associare con certezza gli elementi di una risposta matrix in streaming. Verificare sul progetto reale che l'ordine della risposta coincida stabilmente con quello delle destinazioni.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
