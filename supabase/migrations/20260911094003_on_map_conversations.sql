-- Conversation contributions belong to their author. Context belongs to a source map.
-- Existing RLS and service-role-only RPC permissions remain unchanged.
alter table public.harmonious_records drop constraint harmonious_records_kind_check;
alter table public.harmonious_records add constraint harmonious_records_kind_check
 check(kind in ('profile','map','idea','endorsement','comparison','comparison_thread','argument_node','argument_edge','discussion'));
create index harmonious_discussion_comparison on public.harmonious_records ((content->>'comparisonId')) where kind='discussion';
create function public.harmonious_check_discussion() returns trigger
language plpgsql security invoker set search_path='' as $$
declare thread jsonb; source jsonb; parent jsonb; ref jsonb; target_map text;
begin
 if new.kind<>'discussion' then return new; end if;
 if new.content->>'authorId' is distinct from new.owner_id::text then raise exception using errcode='PT403',message='Invalid conversation author'; end if;
 if tg_op='UPDATE' and (new.content->>'authorId' is distinct from old.content->>'authorId' or new.content->>'comparisonId' is distinct from old.content->>'comparisonId' or new.content->>'kind' is distinct from old.content->>'kind' or new.content->'target' is distinct from old.content->'target' or new.content->'other' is distinct from old.content->'other') then
  raise exception using errcode='PT409',message='Conversation identity cannot change';
 end if;
 if new.content->>'kind'<>'context' then
  select content into thread from public.harmonious_records where kind='comparison_thread' and id=new.content->>'comparisonId';
  if thread is null or not (thread->'participants' @> jsonb_build_array(new.owner_id::text)) then raise exception using errcode='PT403',message='Conversation requires comparison membership'; end if;
 end if;
 for ref in select value from jsonb_array_elements(jsonb_build_array(new.content->'target',new.content->'other')) where value<>'null'::jsonb loop
  if ref->>'type'='entry' then
   select content into parent from public.harmonious_records where kind='discussion' and id=ref->>'entryId';
   if parent is null or parent->>'comparisonId' is distinct from new.content->>'comparisonId' or parent->>'status'<>'active' or parent->>'id'=new.id then raise exception using errcode='PT409',message='Conversation target unavailable'; end if;
  else
   target_map:=ref->>'mapId';
   select content into source from public.harmonious_records where kind='map' and id=target_map;
   if source is null then raise exception using errcode='PT409',message='Source map unavailable'; end if;
   if new.content->>'kind'='context' then
    if source->>'ownerId' is distinct from new.owner_id::text or new.content->>'comparisonId' is not null then raise exception using errcode='PT403',message='Only the map author defines its context'; end if;
   elsif target_map not in (thread->>'aMapId',thread->>'bMapId') then raise exception using errcode='PT403',message='Source outside comparison'; end if;
   if new.content->>'kind'='counterpart' and (ref->>'type'<>'node' or source->>'ownerId' is distinct from new.owner_id::text) then raise exception using errcode='PT403',message='Request counterpart for your own node'; end if;
   if ref->>'type'='node' then
    if not exists(select 1 from jsonb_array_elements(source->'nodes') n where n->>'id'=ref->>'nodeId') then raise exception using errcode='PT409',message='Source node unavailable'; end if;
   elsif ref->>'type'='edge' then
    if not exists(select 1 from jsonb_array_elements(source->'relations') e where e->>'id'=ref->>'edgeId') and not exists(select 1 from jsonb_array_elements(source->'nodes') n where 'structure:'||(n->>'id')=ref->>'edgeId' and n->>'parent' is not null) then raise exception using errcode='PT409',message='Source edge unavailable'; end if;
   else raise exception using errcode='PT400',message='Invalid conversation target'; end if;
  end if;
 end loop;
 return new;
end;
$$;
revoke all on function public.harmonious_check_discussion() from public,anon,authenticated;
grant execute on function public.harmonious_check_discussion() to service_role;
create trigger harmonious_discussion_identity before insert or update on public.harmonious_records for each row execute function public.harmonious_check_discussion();
create or replace function public.harmonious_commit(p_actor uuid,p_generation bigint,p_changes jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  generation bigint;
  item jsonb;
  existing public.harmonious_records%rowtype;
  next_revision bigint;
  result jsonb := '{}'::jsonb;
  seen text[] := array[]::text[];
  record_key text;
begin
  if p_actor is null or not exists(select 1 from auth.users where id=p_actor) then
    raise exception using errcode='PT403',message='Unknown account';
  end if;
  if jsonb_typeof(p_changes) is distinct from 'array' or jsonb_array_length(p_changes) not between 1 and 500 then
    raise exception using errcode='PT400',message='Invalid change batch';
  end if;
  select revision into generation from public.harmonious_generation where id for update;
  if generation is distinct from p_generation then
    raise exception using errcode='PT409',message='snapshot_changed';
  end if;
  for item in select value from jsonb_array_elements(p_changes) with ordinality as changes(value,ordinal)
    order by case value->>'kind' when 'comparison_thread' then 1 when 'comparison' then 2 when 'argument_node' then 3 when 'argument_edge' then 4 when 'discussion' then 5 else 0 end, ordinal loop
    if item->>'kind' not in ('profile','map','idea','endorsement','comparison','comparison_thread','argument_node','argument_edge','discussion') or
       item->>'id' is null or item->'value'->>'id' is distinct from item->>'id' or
       not (item ? 'expectedRevision') then
      raise exception using errcode='PT400',message='Invalid record';
    end if;
    record_key := '[' || to_jsonb(item->>'kind')::text || ',' || to_jsonb(item->>'id')::text || ']';
    if record_key=any(seen) then raise exception using errcode='PT400',message='Duplicate record'; end if;
    seen := array_append(seen,record_key);
    select * into existing from public.harmonious_records where kind=item->>'kind' and id=item->>'id';
    if found and existing.owner_id<>p_actor and not (
      item->>'kind'='comparison' and coalesce(existing.content->'participants','[]'::jsonb) @> jsonb_build_array(p_actor::text)
    ) then
      raise exception using errcode='PT403',message='Record belongs to another account';
    end if;
    if coalesce(existing.revision,0) is distinct from (item->>'expectedRevision')::bigint then
      raise exception using errcode='PT409',message='record_changed';
    end if;
    if (item->>'kind'='profile' and item->>'id'<>p_actor::text) or
       (item->>'kind'='map' and item->'value'->>'ownerId' is distinct from p_actor::text) or
       (item->>'kind'='endorsement' and item->'value'->>'participantId' is distinct from p_actor::text) then
      raise exception using errcode='PT403',message='Invalid record owner';
    end if;
    next_revision := coalesce(existing.revision,0)+1;
    insert into public.harmonious_records(kind,id,owner_id,revision,content)
      values(item->>'kind',item->>'id',p_actor,next_revision,item->'value')
      on conflict(kind,id) do update set content=excluded.content,revision=excluded.revision,updated_at=now();
    result := result || jsonb_build_object(record_key,next_revision);
  end loop;
  update public.harmonious_generation set revision=revision+1 where id;
  return jsonb_build_object('revision',generation+1,'revisions',result);
end;
$$;
