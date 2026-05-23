
revoke execute on function public.match_document_chunks(vector, uuid, int) from public, anon;
grant execute on function public.match_document_chunks(vector, uuid, int) to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
