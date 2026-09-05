alter table public.pratiche
  add column targa_cliente text;

comment on column public.pratiche.targa_cliente is
  'Targa indicata dal cliente quando contesta quella inserita dall''operatore.';
