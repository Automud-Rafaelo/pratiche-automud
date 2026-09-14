begin;

alter table public.agenzie
  add column google_indirizzo text;

comment on column public.agenzie.google_indirizzo is
  'Formatted address returned by Google Places for the matched agency listing.';

commit;
