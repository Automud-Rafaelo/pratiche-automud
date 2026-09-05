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

`npx supabase db push` applica soltanto le migration non ancora eseguite. Le tabelle hanno Row Level Security attiva e nessuna policy pubblica: il pannello usa la service role key esclusivamente lato server.

## Import delle agenzie

Il pannello `/admin/import-agenzie` legge `data/agenzie.csv`. Le righe con coordinate vengono importate direttamente; per quelle senza coordinate usa Places API (New), Text Search, se `GOOGLE_MAPS_API_KEY` è configurata. Ogni pressione elabora al massimo dieci agenzie tramite Places. Gli errori, compresa un'API non abilitata o una chiave assente, restano visibili nella colonna dedicata. L'import è idempotente sulla coppia nome + CAP normalizzati e può essere rilanciato per riprendere le righe `pending`.

Nel progetto Google Cloud abilitare **Places API (New)** e limitare la chiave all'API e agli ambienti server autorizzati. La chiave non deve essere prefissata con `NEXT_PUBLIC_`.

## Configurazione e deploy su Vercel

1. Importare la repository GitHub in Vercel.
2. In **Project Settings → Environment Variables**, aggiungere tutte le variabili elencate in `.env.example` per gli ambienti necessari. Impostare `NEXT_PUBLIC_APP_URL` sul dominio pubblico completo, per esempio `https://pratiche.example.it`.
3. Impostare `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD` e `GOOGLE_MAPS_API_KEY`. La stessa chiave Google viene usata lato server per Places API (New) e Geocoding API.
4. Verificare che `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_MAPS_API_KEY` e `ADMIN_PASSWORD` non vengano mai esposte al browser.
5. Applicare tutte le migration al progetto Supabase di destinazione.
6. Eseguire il deploy dalla dashboard. I push successivi al branch collegato genereranno nuovi deploy automaticamente.

La sessione admin usa un cookie httpOnly firmato con `ADMIN_PASSWORD`, dura 12 ore e limita a cinque i tentativi falliti in 15 minuti per IP.
