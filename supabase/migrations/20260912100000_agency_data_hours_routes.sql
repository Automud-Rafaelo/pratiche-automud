begin;

alter table public.agenzie
  drop constraint agenzie_import_identity,
  drop constraint agenzie_attiva_requires_phone,
  add column iban text,
  add column intestatario_iban text,
  add column costi_pratica text,
  add column delega boolean,
  add column istanza boolean,
  add column orari_aggiornati_at timestamptz,
  add column email_normalizzata text generated always as (
    lower(regexp_replace(btrim(coalesce(email, '')), '\s+', ' ', 'g'))
  ) stored;

update public.agenzie
set attiva = false
where delega is distinct from false
   or istanza is distinct from false
   or nullif(btrim(telefono), '') is null;

alter table public.agenzie
  add constraint agenzie_import_identity unique (
    email_normalizzata,
    cap_normalizzato
  ),
  add constraint agenzie_attiva_requires_eligibility check (
    not attiva
    or (
      delega = false
      and istanza = false
      and nullif(btrim(telefono), '') is not null
    )
  );

alter table public.pratiche
  add column agenzia_distanza_km numeric,
  add column agenzia_durata_min integer,
  add constraint pratiche_agenzia_distanza_non_negative check (
    agenzia_distanza_km is null or agenzia_distanza_km >= 0
  ),
  add constraint pratiche_agenzia_durata_non_negative check (
    agenzia_durata_min is null or agenzia_durata_min >= 0
  );

comment on column public.agenzie.email_normalizzata is
  'Normalized email used with cap_normalizzato as the idempotent CSV import key.';
comment on column public.agenzie.delega is
  'Whether the agency requires a delegation; null means unknown.';
comment on column public.agenzie.istanza is
  'Whether the agency requires an application; null means unknown.';
comment on column public.agenzie.orari_aggiornati_at is
  'Timestamp of the latest successful Google Place Details opening-hours refresh.';
comment on column public.pratiche.agenzia_distanza_km is
  'Road distance for the customer-selected agency, or Haversine fallback distance.';
comment on column public.pratiche.agenzia_durata_min is
  'Driving duration for the customer-selected agency; null when Routes is unavailable.';

commit;
