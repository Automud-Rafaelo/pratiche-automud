# Pratiche Automud

Prototipo mobile-first per accompagnare i clienti Automud nella raccolta dei dati di pagamento, nella scelta dell'agenzia, nella prenotazione e nell'organizzazione del ritiro dell'auto.

## Avvio in locale

Requisiti: Node.js 20.9 o successivo e npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Compilare `.env.local` con i valori del proprio ambiente, quindi aprire [http://localhost:3000](http://localhost:3000).

Comandi di verifica:

```bash
npm run lint
npm run build
```

## Applicare la migration Supabase

Installare o usare la Supabase CLI, autenticarsi e collegare il progetto remoto:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

La migration iniziale si trova in `supabase/migrations`. Le tabelle hanno Row Level Security attiva e nessuna policy pubblica: il codice futuro dovrà accedere ai dati sensibili tramite route handler o server action, validando il token della pratica e mantenendo la service role key esclusivamente sul server.

## Configurazione e deploy su Vercel

1. Importare la repository GitHub in Vercel.
2. In **Project Settings → Environment Variables**, aggiungere tutte le variabili elencate in `.env.example` per gli ambienti necessari.
3. Verificare che `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_MAPS_API_KEY` e `ADMIN_PASSWORD` non vengano mai esposte al browser.
4. Eseguire il deploy dalla dashboard. I push successivi al branch collegato genereranno nuovi deploy automaticamente.

Prima del deploy applicare le migration al progetto Supabase di destinazione.
