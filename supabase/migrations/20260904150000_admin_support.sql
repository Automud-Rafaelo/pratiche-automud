begin;

alter table public.agenzie
  drop constraint agenzie_cap_format;

alter table public.agenzie
  add constraint agenzie_cap_format check (
    cap = '' or cap ~ '^[0-9]{5}$'
  );

create table public.admin_login_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  failed_at timestamptz not null default now()
);

create index admin_login_attempts_ip_hash_failed_at_idx
  on public.admin_login_attempts (ip_hash, failed_at desc);

alter table public.admin_login_attempts enable row level security;

create or replace function public.reserve_admin_login_attempt(
  requested_ip_hash text,
  window_start timestamptz,
  maximum_attempts integer
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  attempt_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(requested_ip_hash, 0));

  delete from public.admin_login_attempts
  where failed_at < window_start;

  select count(*)
  into attempt_count
  from public.admin_login_attempts
  where ip_hash = requested_ip_hash
    and failed_at >= window_start;

  if attempt_count >= maximum_attempts then
    return false;
  end if;

  insert into public.admin_login_attempts (ip_hash)
  values (requested_ip_hash);

  return true;
end;
$$;

comment on table public.admin_login_attempts is
  'Admin login attempt reservations keyed by a one-way IP hash for distributed rate limiting.';

commit;
