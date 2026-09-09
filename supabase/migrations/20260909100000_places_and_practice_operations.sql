begin;

alter table public.pratiche
  drop constraint pratiche_cap_format,
  drop column cap,
  add column ricerca_indirizzo text,
  add column ricerca_place_id text,
  add column ricerca_lat numeric,
  add column ricerca_lng numeric,
  add column ritiro_nome_attivita text,
  add column ritiro_place_id text,
  add column ritiro_lat numeric,
  add column ritiro_lng numeric,
  add constraint pratiche_ricerca_lat_range check (
    ricerca_lat is null or ricerca_lat between -90 and 90
  ),
  add constraint pratiche_ricerca_lng_range check (
    ricerca_lng is null or ricerca_lng between -180 and 180
  ),
  add constraint pratiche_ritiro_lat_range check (
    ritiro_lat is null or ritiro_lat between -90 and 90
  ),
  add constraint pratiche_ritiro_lng_range check (
    ritiro_lng is null or ritiro_lng between -180 and 180
  );

drop table public.cap_coordinate;

alter table public.operator_alerts
  add column pratica_id uuid references public.pratiche(id) on delete cascade;

update public.operator_alerts as alert
set pratica_id = practice.id
from public.pratiche as practice
where alert.context ->> 'practice_id' = practice.id::text;

create index operator_alerts_pratica_id_idx
  on public.operator_alerts (pratica_id)
  where pratica_id is not null;

create table public.place_autocomplete_requests (
  id bigint generated always as identity primary key,
  pratica_id uuid not null references public.pratiche(id) on delete cascade,
  requested_at timestamptz not null default now()
);

create index place_autocomplete_requests_pratica_id_requested_at_idx
  on public.place_autocomplete_requests (pratica_id, requested_at desc);

alter table public.place_autocomplete_requests enable row level security;

create or replace function public.reserve_place_autocomplete_request(
  requested_practice_id uuid,
  window_start timestamptz,
  maximum_requests integer
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  request_count integer;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(requested_practice_id::text, 0)
  );

  delete from public.place_autocomplete_requests
  where requested_at < window_start - interval '1 minute';

  select count(*)
  into request_count
  from public.place_autocomplete_requests
  where pratica_id = requested_practice_id
    and requested_at >= window_start;

  if request_count >= maximum_requests then
    return false;
  end if;

  insert into public.place_autocomplete_requests (pratica_id)
  values (requested_practice_id);

  return true;
end;
$$;

revoke all on function public.reserve_place_autocomplete_request(
  uuid,
  timestamptz,
  integer
) from public, anon, authenticated;
grant execute on function public.reserve_place_autocomplete_request(
  uuid,
  timestamptz,
  integer
) to service_role;

comment on column public.pratiche.ricerca_indirizzo is
  'Formatted place address selected by the customer to find nearby agencies.';
comment on column public.pratiche.ricerca_place_id is
  'Google Place ID selected to find nearby agencies.';
comment on column public.pratiche.ritiro_nome_attivita is
  'Business name returned by Google for a storage facility or body shop.';
comment on table public.place_autocomplete_requests is
  'Per-practice request reservations used to enforce the Places proxy rate limit.';

commit;
