begin;

alter table public.pratiche
  drop constraint pratiche_status_allowed;

update public.pratiche
set status = 'step2_agenzia'
where status in ('in_verifica', 'bloccata');

alter table public.pratiche
  add constraint pratiche_status_allowed check (
    status in (
      'creata',
      'step1_dati',
      'step2_agenzia',
      'step3_appuntamento',
      'step4_ritiro',
      'completata'
    )
  );

alter table public.pratiche
  rename column check_match_intestatario
  to check_intestatario_non_corrisponde;

alter table public.pratiche
  rename column appuntamento_data
  to preferenza_data;

alter table public.pratiche
  rename column appuntamento_fascia
  to preferenza_fascia;

alter table public.pratiche
  rename constraint pratiche_appuntamento_fascia_allowed
  to pratiche_preferenza_fascia_allowed;

alter table public.pratiche
  drop column compila_proprietario;

alter table public.pratiche
  add column appuntamento_confermato_data date,
  add column appuntamento_confermato_fascia text,
  add column verifiche_completate_at timestamptz,
  add constraint pratiche_appuntamento_confermato_fascia_allowed check (
    appuntamento_confermato_fascia is null
    or appuntamento_confermato_fascia in ('mattina', 'pomeriggio')
  );

alter table public.agenzie
  drop constraint agenzie_import_identity;

alter table public.agenzie
  add column maps_url text,
  add column nome_normalizzato text generated always as (
    lower(regexp_replace(btrim(nome), '\s+', ' ', 'g'))
  ) stored,
  add column cap_normalizzato text generated always as (
    lower(regexp_replace(btrim(cap), '\s+', ' ', 'g'))
  ) stored;

update public.agenzie
set attiva = false
where nullif(btrim(telefono), '') is null;

alter table public.agenzie
  alter column attiva set default false,
  add constraint agenzie_import_identity unique (
    nome_normalizzato,
    cap_normalizzato
  ),
  add constraint agenzie_attiva_requires_phone check (
    not attiva or nullif(btrim(telefono), '') is not null
  );

create index pratiche_da_verificare_idx
  on public.pratiche (created_at desc)
  where status = 'completata' and verifiche_completate_at is null;

create index eventi_tipo_pratica_id_idx
  on public.eventi (tipo, pratica_id);

comment on column public.pratiche.preferenza_data is
  'Customer preference only; it is not a confirmed appointment.';
comment on column public.pratiche.preferenza_fascia is
  'Customer preference only; it is not a confirmed appointment.';
comment on column public.pratiche.verifiche_completate_at is
  'Timestamp set by an operator after all five informational checks are complete.';
comment on column public.agenzie.nome_normalizzato is
  'Generated normalized agency name used with cap_normalizzato for idempotent imports.';

commit;
