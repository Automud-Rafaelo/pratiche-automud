begin;

alter table public.pratiche
  add column agenzie_proposte jsonb;

comment on column public.pratiche.agenzie_proposte is
  'Ordered agency choices shown to the customer, with the route metrics used to validate the later selection.';

commit;
