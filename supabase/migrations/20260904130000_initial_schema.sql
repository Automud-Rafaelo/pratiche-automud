begin;

create extension if not exists pgcrypto;

create table public.agenzie (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  indirizzo text not null,
  cap text not null,
  comune text not null,
  provincia text not null,
  telefono text,
  email text,
  lat numeric,
  lng numeric,
  google_place_id text,
  orari jsonb,
  attiva boolean not null default true,
  import_status text not null default 'pending',
  constraint agenzie_cap_format check (cap ~ '^[0-9]{5}$'),
  constraint agenzie_lat_range check (lat is null or lat between -90 and 90),
  constraint agenzie_lng_range check (lng is null or lng between -180 and 180),
  constraint agenzie_import_status_allowed check (
    import_status in ('pending', 'ok', 'not_found')
  ),
  constraint agenzie_import_identity unique (nome, indirizzo, cap)
);

create table public.pratiche (
  id uuid primary key default gen_random_uuid(),
  token text not null default rtrim(
    translate(encode(gen_random_bytes(32), 'base64'), '+/', '-_'),
    '='
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'creata',
  tipo_pratica text not null,
  prezzo_concordato numeric(12, 2) not null,
  targa text not null,
  marca text not null,
  modello text not null,
  is_proprietario boolean,
  nome text,
  cognome text,
  codice_fiscale text,
  iban text,
  cap text,
  cointestata boolean,
  due_chiavi boolean,
  agenzia_id uuid references public.agenzie(id) on delete set null,
  appuntamento_data date,
  appuntamento_fascia text,
  compila_proprietario boolean,
  conosce_orari_proprietario boolean,
  ubicazione_auto text,
  indirizzo_ritiro text,
  telefono_ritiro text,
  check_match_intestatario boolean,
  check_cdp_cartaceo boolean,
  check_revisione_scaduta boolean,
  check_km_scalati boolean,
  check_fermo_amministrativo boolean,
  note_operatore text,
  constraint pratiche_token_unique unique (token),
  constraint pratiche_token_format check (
    length(token) >= 32 and token ~ '^[A-Za-z0-9_-]+$'
  ),
  constraint pratiche_status_allowed check (
    status in (
      'creata',
      'step1_dati',
      'in_verifica',
      'bloccata',
      'step2_agenzia',
      'step3_appuntamento',
      'step4_ritiro',
      'completata'
    )
  ),
  constraint pratiche_tipo_allowed check (tipo_pratica in ('dini', 'atto_demo')),
  constraint pratiche_prezzo_non_negative check (prezzo_concordato >= 0),
  constraint pratiche_cap_format check (cap is null or cap ~ '^[0-9]{5}$'),
  constraint pratiche_appuntamento_fascia_allowed check (
    appuntamento_fascia is null or appuntamento_fascia in ('mattina', 'pomeriggio')
  ),
  constraint pratiche_ubicazione_auto_allowed check (
    ubicazione_auto is null or ubicazione_auto in ('casa', 'deposito', 'carrozzeria')
  )
);

create table public.cap_coordinate (
  cap text primary key,
  lat numeric not null,
  lng numeric not null,
  created_at timestamptz not null default now(),
  constraint cap_coordinate_cap_format check (cap ~ '^[0-9]{5}$'),
  constraint cap_coordinate_lat_range check (lat between -90 and 90),
  constraint cap_coordinate_lng_range check (lng between -180 and 180)
);

create table public.eventi (
  id uuid primary key default gen_random_uuid(),
  pratica_id uuid not null references public.pratiche(id) on delete cascade,
  created_at timestamptz not null default now(),
  tipo text not null,
  dettaglio jsonb not null default '{}'::jsonb
);

create index pratiche_status_created_at_idx
  on public.pratiche (status, created_at desc);

create index pratiche_agenzia_id_idx
  on public.pratiche (agenzia_id)
  where agenzia_id is not null;

create index agenzie_attiva_import_status_idx
  on public.agenzie (attiva, import_status);

create index eventi_pratica_id_created_at_idx
  on public.eventi (pratica_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger pratiche_set_updated_at
before update on public.pratiche
for each row
execute function public.set_updated_at();

alter table public.pratiche enable row level security;
alter table public.agenzie enable row level security;
alter table public.cap_coordinate enable row level security;
alter table public.eventi enable row level security;

comment on table public.pratiche is
  'Vehicle purchase cases. Customer-facing URLs use token and never expose id.';
comment on column public.pratiche.token is
  'Random URL-safe customer access token with at least 32 characters.';
comment on table public.cap_coordinate is
  'Geocoding cache: each Italian postal code must be requested from Google at most once.';
comment on table public.eventi is
  'Audit log for status transitions and relevant actions.';

commit;
