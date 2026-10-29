-- Behavium Test Generator: schema database.
-- Da eseguire una volta nel SQL Editor di Supabase.

create table if not exists tests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  autore text not null default '',
  stato text not null default 'bozza' check (stato in ('bozza', 'approvato', 'scartato')),
  input jsonb not null,
  analisi jsonb not null,
  test jsonb not null,
  problemi jsonb not null default '[]',
  modello text not null default '',
  costo numeric not null default 0,
  catalogo_versione text not null default ''
);

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  test_id uuid not null references tests(id) on delete cascade,
  item_ref text,
  esito text not null check (esito in ('ok', 'da_rivedere')),
  commento text not null default '',
  autore text not null default '',
  elaborato boolean not null default false
);
create index if not exists feedback_test_idx on feedback(test_id);

create table if not exists regole (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  testo text not null,
  ambito text not null default 'tutti' check (ambito in ('tutti', 'inBasket', 'situational')),
  stato text not null default 'proposta' check (stato in ('proposta', 'approvata', 'scartata')),
  origine text not null default 'manuale',
  autore text not null default ''
);

-- L'app accede solo dal server con la service_role key: blocchiamo l'accesso pubblico.
alter table tests enable row level security;
alter table feedback enable row level security;
alter table regole enable row level security;
