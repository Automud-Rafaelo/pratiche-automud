begin;

alter table public.agenzie
  add column import_error text;

create table public.operator_alerts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text not null,
  message text not null,
  context jsonb not null default '{}'::jsonb,
  resolved_at timestamptz
);

create index operator_alerts_unresolved_created_at_idx
  on public.operator_alerts (created_at desc)
  where resolved_at is null;

alter table public.operator_alerts enable row level security;

comment on column public.agenzie.import_error is
  'Last actionable Google Places import error shown to operators; cleared after a conclusive result.';
comment on table public.operator_alerts is
  'Actionable external-service failures shown in the admin panel. Writes are server-side only.';

commit;
