-- Each participant owns individual reasoning nodes and connections. Shared
-- access is projected by the Worker through the existing proposal boundary.
alter table public.harmonious_records drop constraint harmonious_records_kind_check;
alter table public.harmonious_records add constraint harmonious_records_kind_check
  check(kind in ('profile','map','idea','endorsement','comparison','comparison_thread','argument_node','argument_edge'));
create index harmonious_argument_proposal on public.harmonious_records ((content->>'proposalId'),(content->>'proposalRevision'))
  where kind in ('argument_node','argument_edge');

create function public.harmonious_check_argument() returns trigger
language plpgsql security invoker set search_path='' as $$
declare proposal jsonb; proposal_version jsonb; ref jsonb; endpoint jsonb;
begin
  if new.kind not in ('argument_node','argument_edge') then return new; end if;
  if new.content->>'authorId' is distinct from new.owner_id::text then
    raise exception using errcode='PT403',message='Invalid reasoning author';
  end if;
  if tg_op='UPDATE' and (
    new.content->>'proposalId' is distinct from old.content->>'proposalId' or
    new.content->>'proposalRevision' is distinct from old.content->>'proposalRevision' or
    new.content->>'comparisonId' is distinct from old.content->>'comparisonId' or
    new.content->>'authorId' is distinct from old.content->>'authorId') then
    raise exception using errcode='PT409',message='Reasoning identity cannot change';
  end if;
  select content into proposal from public.harmonious_records where kind='comparison' and id=new.content->>'proposalId';
  if proposal is null or proposal->>'comparisonId' is distinct from new.content->>'comparisonId' then
    raise exception using errcode='PT409',message='Reasoning proposal is missing';
  end if;
  if not exists(select 1 from public.harmonious_records where kind='comparison_thread' and id=new.content->>'comparisonId' and content->'participants' @> jsonb_build_array(new.owner_id::text)) then
    raise exception using errcode='PT403',message='Reasoning author must be a comparison participant';
  end if;
  select value into proposal_version from jsonb_array_elements(coalesce(proposal->'proposalVersions','[]')) where value->>'revision'=new.content->>'proposalRevision';
  if proposal_version is null and not (proposal ? 'proposalVersions') and new.content->>'proposalRevision'='1' then proposal_version:=proposal; end if;
  if proposal_version is null then raise exception using errcode='PT409',message='Reasoning proposal version is missing'; end if;
  if new.kind='argument_edge' then
    if new.content->'from'->>'type' is distinct from 'node' then raise exception using errcode='PT400',message='Reasoning connection needs a node'; end if;
    for ref in select value from jsonb_array_elements(jsonb_build_array(new.content->'from',new.content->'to')) loop
      if ref->>'type'='node' then
        select content into endpoint from public.harmonious_records where kind='argument_node' and id=ref->>'id';
        if endpoint is null or endpoint->>'proposalId' is distinct from new.content->>'proposalId' or
          endpoint->>'proposalRevision' is distinct from new.content->>'proposalRevision' or
          (ref->>'version') is null or not ((ref->>'version')::int between 1 and (endpoint->>'version')::int) then
          raise exception using errcode='PT409',message='Invalid reasoning endpoint';
        end if;
        if ref=new.content->'from' and endpoint->>'authorId' is distinct from new.owner_id::text then
          raise exception using errcode='PT403',message='Start connections from your own reasoning';
        end if;
      elsif ref->>'type'='source' then
        if ref->>'side' not in ('a','b') or coalesce(proposal_version->((ref->>'side')||'Snapshot')->'node','null'::jsonb)='null'::jsonb then
          raise exception using errcode='PT409',message='Invalid source endpoint';
        end if;
      else raise exception using errcode='PT400',message='Invalid endpoint type'; end if;
    end loop;
  end if;
  return new;
end;
$$;
revoke all on function public.harmonious_check_argument() from public,anon,authenticated;
grant execute on function public.harmonious_check_argument() to service_role;
create trigger harmonious_argument_identity before insert or update on public.harmonious_records
for each row execute function public.harmonious_check_argument();
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
  for item in select value from jsonb_array_elements(p_changes)
    order by case value->>'kind' when 'comparison_thread' then 1 when 'comparison' then 2 when 'argument_node' then 3 when 'argument_edge' then 4 else 0 end loop
    if item->>'kind' not in ('profile','map','idea','endorsement','comparison','comparison_thread','argument_node','argument_edge') or
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
