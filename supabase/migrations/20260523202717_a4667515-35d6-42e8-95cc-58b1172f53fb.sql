
create or replace function public.match_document_chunks(
  query_embedding vector(1536),
  match_count int default 6
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  similarity float,
  filename text
)
language sql stable security invoker set search_path = public as $$
  select
    c.id,
    c.document_id,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity,
    d.filename
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where c.user_id = auth.uid()
    and c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

drop function if exists public.match_document_chunks(vector, uuid, int);
