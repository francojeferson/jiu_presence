-- Habilitar extensão pgvector
create extension if not exists vector;

-- Tabela de Academias
create table public.academia (
  id uuid default gen_random_uuid() primary key,
  nome text not null,
  data_expira date not null,
  criado_em timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabela de Alunos
create table public.aluno (
  id uuid default gen_random_uuid() primary key,
  academia_id uuid references public.academia(id) not null,
  nome text not null,
  idade integer not null,
  peso numeric,
  altura numeric,
  cor_faixa text not null,
  foto_url text,
  face_embedding vector(128),
  termo_aceite boolean default false,
  termo_data timestamp with time zone,
  criado_em timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabela de Presença
create table public.presenca (
  id uuid default gen_random_uuid() primary key,
  aluno_id uuid references public.aluno(id) not null,
  data_aula timestamp with time zone default timezone('utc'::text, now()) not null,
  metodo_registro text not null default 'facial'
);

-- Políticas de RLS (Row Level Security) básicas
alter table public.academia enable row level security;
alter table public.aluno enable row level security;
alter table public.presenca enable row level security;
