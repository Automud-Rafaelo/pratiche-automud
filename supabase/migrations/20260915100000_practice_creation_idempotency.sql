begin;

alter table public.pratiche
  add column creazione_token text,
  add constraint pratiche_creazione_token_unique unique (creazione_token);

create index pratiche_targa_created_at_idx
  on public.pratiche (targa, created_at desc);

comment on column public.pratiche.creazione_token is
  'Idempotency token generated when the admin creation form is rendered; null only for historical rows.';

commit;
