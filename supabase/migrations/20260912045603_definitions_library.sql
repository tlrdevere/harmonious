-- Add a private, author-owned definitions library. Source invocations continue to
-- use versioned context contributions; no existing row is rewritten.
alter table public.harmonious_records drop constraint harmonious_records_kind_check;
alter table public.harmonious_records add constraint harmonious_records_kind_check
 check(kind in ('profile','map','idea','endorsement','comparison','comparison_thread','argument_node','argument_edge','discussion','definition'));
create function public.harmonious_check_definition() returns trigger
language plpgsql security invoker set search_path='' as $$
declare previous_versions jsonb; v jsonb; n bigint;
begin
 if new.kind<>'definition' then return new; end if;
 if new.content->>'authorId' is distinct from new.owner_id::text then raise exception using errcode='PT403',message='Invalid definition author'; end if;
 if coalesce(new.content->>'type','') not in ('definition','standard') or coalesce(new.content->>'status','') not in ('active','archived') or jsonb_typeof(new.content->'versions') is distinct from 'array' or jsonb_array_length(new.content->'versions') not between 1 and 1000 then raise exception using errcode='PT400',message='Invalid definition'; end if;
 for v,n in select value,ordinality from jsonb_array_elements(new.content->'versions') with ordinality loop
  if (v->>'version')::bigint is distinct from n or coalesce(length(trim(v->>'title')),0) not between 1 and 200 or coalesce(length(trim(v->>'body')),0) not between 1 and 10000 then raise exception using errcode='PT400',message='Invalid definition version'; end if;
 end loop;
 if tg_op='UPDATE' then
  select jsonb_agg(value order by ordinality) into previous_versions from jsonb_array_elements(new.content->'versions') with ordinality where ordinality<=jsonb_array_length(old.content->'versions');
  if previous_versions is distinct from old.content->'versions' or new.content->>'type' is distinct from old.content->>'type' or new.content->>'authorId' is distinct from old.content->>'authorId' then raise exception using errcode='PT409',message='Definition history cannot change'; end if;
 end if;
 return new;
end;
$$;
revoke all on function public.harmonious_check_definition() from public,anon,authenticated;
grant execute on function public.harmonious_check_definition() to service_role;
create trigger harmonious_definition_identity before insert or update on public.harmonious_records for each row execute function public.harmonious_check_definition();
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
    if item->>'kind' not in ('profile','map','idea','endorsement','comparison','comparison_thread','argument_node','argument_edge','discussion','definition') or
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
