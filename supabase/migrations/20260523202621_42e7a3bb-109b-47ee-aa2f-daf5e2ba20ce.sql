
-- Extensions
create extension if not exists vector;

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Profiles viewable by owner" on public.profiles for select using (auth.uid() = id);
create policy "Profiles insertable by owner" on public.profiles for insert with check (auth.uid() = id);
create policy "Profiles updatable by owner" on public.profiles for update using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Documents
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  file_type text not null,
  file_size bigint not null,
  storage_path text not null,
  status text not null default 'pending', -- pending, processing, ready, error
  summary text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.documents enable row level security;
create policy "Documents select own" on public.documents for select using (auth.uid() = user_id);
create policy "Documents insert own" on public.documents for insert with check (auth.uid() = user_id);
create policy "Documents update own" on public.documents for update using (auth.uid() = user_id);
create policy "Documents delete own" on public.documents for delete using (auth.uid() = user_id);
create index documents_user_id_idx on public.documents(user_id, created_at desc);

-- Document chunks with embeddings (1536 dim via Matryoshka truncation)
create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);
alter table public.document_chunks enable row level security;
create policy "Chunks select own" on public.document_chunks for select using (auth.uid() = user_id);
create policy "Chunks insert own" on public.document_chunks for insert with check (auth.uid() = user_id);
create policy "Chunks delete own" on public.document_chunks for delete using (auth.uid() = user_id);
create index document_chunks_embedding_idx on public.document_chunks using hnsw (embedding vector_cosine_ops);
create index document_chunks_document_id_idx on public.document_chunks(document_id);

-- Conversations
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.conversations enable row level security;
create policy "Convos select own" on public.conversations for select using (auth.uid() = user_id);
create policy "Convos insert own" on public.conversations for insert with check (auth.uid() = user_id);
create policy "Convos update own" on public.conversations for update using (auth.uid() = user_id);
create policy "Convos delete own" on public.conversations for delete using (auth.uid() = user_id);
create index conversations_user_idx on public.conversations(user_id, updated_at desc);

-- Messages
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  sources jsonb,
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;
create policy "Messages select own" on public.messages for select using (auth.uid() = user_id);
create policy "Messages insert own" on public.messages for insert with check (auth.uid() = user_id);
create policy "Messages delete own" on public.messages for delete using (auth.uid() = user_id);
create index messages_conversation_idx on public.messages(conversation_id, created_at);

-- Semantic search function
create or replace function public.match_document_chunks(
  query_embedding vector(1536),
  match_user_id uuid,
  match_count int default 6
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  similarity float,
  filename text
)
language sql stable security definer set search_path = public as $$
  select
    c.id,
    c.document_id,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity,
    d.filename
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where c.user_id = match_user_id
    and c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- Storage bucket
insert into storage.buckets (id, name, public) values ('documents','documents', false)
on conflict (id) do nothing;

create policy "Users read own files" on storage.objects for select
  using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users upload own files" on storage.objects for insert
  with check (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users delete own files" on storage.objects for delete
  using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
