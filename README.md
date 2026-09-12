# Pratiche Automud

Prototipo mobile-first per accompagnare i clienti Automud nella raccolta dei dati di pagamento, nella scelta dell'agenzia, nella preferenza di appuntamento e nell'organizzazione del ritiro dell'auto. Il pannello operatori è disponibile in `/admin`.

## Avvio in locale

Requisiti: Node.js 20.9 o successivo e npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Compilare `.env.local` con i valori del proprio ambiente. Per lo sviluppo locale usare `NEXT_PUBLIC_APP_URL=http://localhost:3000`, impostare `NEXT_PUBLIC_WHATSAPP_NUMBER` nel formato internazionale con prefisso paese e senza `+` (per esempio `393331234567`), una `ADMIN_PASSWORD` lunga e non riutilizzata e le credenziali del progetto Supabase. Aprire quindi [http://localhost:3000/admin](http://localhost:3000/admin); i link cliente generati dal pannello usano `/p/[token]`.

Comandi di verifica:

```bash
npm run lint
npm test
npm run build
```

## Applicare la migration Supabase

Installare o usare la Supabase CLI, autenticarsi e collegare il progetto remoto:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Le migration in `supabase/migrations` vengono applicate in ordine:

1. `20260904130000_initial_schema.sql` crea lo schema iniziale;
2. `20260904140000_operator_workflow.sql` aggiorna stati, verifiche, appuntamenti e deduplicazione agenzie;
3. `20260904150000_admin_support.sql` aggiunge il rate limiting della login e consente le righe CSV prive di CAP;
4. `20260904160000_customer_flow.sql` aggiunge gli errori import visibili e gli avvisi operatore per i servizi esterni;
5. `20260905090000_customer_plate.sql` aggiunge la targa indicata dal cliente quando contesta quella dell'operatore.
6. `20260909100000_places_and_practice_operations.sql` sostituisce il CAP cliente con le coordinate Places, aggiunge i dati strutturati del ritiro e rende eliminabili a cascata i dati collegati alla pratica.
7. `20260912100000_agency_data_hours_routes.sql` aggiunge i dati amministrativi delle agenzie, la nuova chiave email+CAP, il timestamp degli orari e distanza/durata dell'agenzia scelta.

`npx supabase db push` applica soltanto le migration non ancora eseguite. Le tabelle hanno Row Level Security attiva e nessuna policy pubblica: il pannello usa la service role key esclusivamente lato server.

## Import delle agenzie

Il pannello `/admin/import-agenzie` legge le 109 righe di `data/agenzie.csv`, riconcilia prima le righe esistenti tramite email+CAP (o nome+CAP come fallback), conserva le coordinate già presenti, disattiva le righe storiche assenti dal CSV e inserisce le nuove come `pending`. Le coordinate delle nuove righe arrivano da Places API (New), Text Search; i link brevi `share.google` non vengono usati. Ogni pressione elabora al massimo venti agenzie tramite Google, compreso il refresh degli orari assenti o più vecchi di sette giorni tramite Place Details (New). Gli errori, compresa un'API non abilitata o una chiave assente, restano visibili nella colonna dedicata e negli avvisi operatore.

Dopo il deploy applicare prima la migration più recente, quindi premere “Importa” finché il report indica zero elementi `pending`.

Nel progetto Google Cloud abilitare **Places API (New)** e **Routes API**. Includere entrambe nelle restrizioni API di `GOOGLE_MAPS_API_KEY` e limitare la chiave agli ambienti server autorizzati. Places serve per autocomplete, Text Search e Place Details degli orari; Routes serve per la matrice di distanza e durata in auto. La chiave non deve essere prefissata con `NEXT_PUBLIC_`.

## Configurazione e deploy su Vercel

1. Importare la repository GitHub in Vercel.
2. In **Project Settings → Environment Variables**, aggiungere tutte le variabili elencate in `.env.example` per gli ambienti necessari. Impostare `NEXT_PUBLIC_APP_URL` sul dominio pubblico completo, per esempio `https://pratiche.example.it`.
3. Impostare `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD` e `GOOGLE_MAPS_API_KEY`. La chiave Google viene usata soltanto lato server per Places API (New) e Routes API.
4. Verificare che `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_MAPS_API_KEY` e `ADMIN_PASSWORD` non vengano mai esposte al browser.
5. Applicare tutte le migration al progetto Supabase di destinazione.
6. Eseguire il deploy dalla dashboard. I push successivi al branch collegato genereranno nuovi deploy automaticamente.

La sessione admin usa un cookie httpOnly firmato con `ADMIN_PASSWORD`, dura 12 ore e limita a cinque i tentativi falliti in 15 minuti per IP.
