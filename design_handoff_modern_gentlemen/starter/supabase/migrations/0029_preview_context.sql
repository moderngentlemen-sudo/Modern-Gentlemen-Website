-- Return the context already stored with a preview capability. This lets a
-- template preview name the published record that should fill its
-- documentContent marker without exposing preview_sessions to anonymous reads.
drop function if exists public.resolve_preview(text);

create function public.resolve_preview(p_token text)
returns table (
  entity_type text,
  entity_id   uuid,
  device      text,
  expires_at  timestamptz,
  context     jsonb,
  data        jsonb
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_session public.preview_sessions%rowtype;
  v_table   text;
  v_data    jsonb;
begin
  select * into v_session
    from public.preview_sessions ps
   where ps.token = p_token and ps.expires_at > now();

  if not found then
    return;
  end if;

  v_table := public.document_table(v_session.entity_type);
  if v_table is null then
    return;
  end if;

  execute format('select draft_data from public.%I where id = $1', v_table)
    into v_data using v_session.entity_id;

  return query
    select v_session.entity_type, v_session.entity_id, v_session.device,
           v_session.expires_at, v_session.context, v_data;
end;
$$;

revoke execute on function public.resolve_preview(text) from public;
grant execute on function public.resolve_preview(text) to anon, authenticated;
