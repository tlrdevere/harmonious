-- Counterpart constraints apply to new activations only. Existing pair records,
-- including earlier cross-frame/multiple relationships, are never rewritten.
-- Unlinking is a separate immutable, attributed receipt, not another author's edit.
create function public.harmonious_counterpart_pair(r jsonb,a jsonb,b jsonb) returns boolean
language sql immutable security invoker set search_path='' as $$
 select (r->'target'->>'mapId'=a->>'mapId' and r->'target'->>'nodeId'=a->>'nodeId' and r->'other'->>'mapId'=b->>'mapId' and r->'other'->>'nodeId'=b->>'nodeId')
 or (r->'target'->>'mapId'=b->>'mapId' and r->'target'->>'nodeId'=b->>'nodeId' and r->'other'->>'mapId'=a->>'mapId' and r->'other'->>'nodeId'=a->>'nodeId');
$$;
create function public.harmonious_counterpart_frame(source jsonb,node_id text) returns text
language plpgsql immutable security invoker set search_path='' as $$
declare n jsonb; seen text[]:=array[]::text[];
begin
 loop
  if node_id is null or node_id=any(seen) then return null; end if;
  seen:=array_append(seen,node_id);
  select value into n from jsonb_array_elements(source->'nodes') where value->>'id'=node_id;
  if n is null then return null; end if;
  if n->>'parent' is null then return node_id; end if;
  node_id:=n->>'parent';
 end loop;
end;
$$;
create function public.harmonious_counterpart_unlinked(r jsonb,exclude_receipt text default null) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.harmonious_records u where u.kind='discussion' and (exclude_receipt is null or u.id<>exclude_receipt)
  and u.content->>'kind'='counterpart_unlink' and u.content->>'status'='active' and u.content->>'comparisonId'=r->>'comparisonId'
  and u.content->'unlinkedRecordIds' ? (r->>'id') and public.harmonious_counterpart_pair(u.content,r->'target',r->'other'));
$$;
create function public.harmonious_counterpart_identity() returns trigger
language plpgsql security invoker set search_path='' as $$
declare r jsonb:=new.content; previous jsonb; ref jsonb; expected_ids jsonb;
begin
 if new.kind<>'discussion' then return new; end if;
 if tg_op='UPDATE' then previous:=old.content;
 else select content into previous from public.harmonious_records where kind='discussion' and id=new.id; end if;
 if previous->>'kind'='counterpart_unlink' and previous is distinct from r then raise exception using errcode='PT409',message='An unlink receipt cannot be edited or withdrawn'; end if;
 if r->>'kind' not in ('correspondence','relationship','counterpart_unlink') then
  if r ? 'unlinkedRecordIds' then raise exception using errcode='PT400',message='Unlinked records belong only to an unlink receipt'; end if;
  return new;
 end if;
 -- The RPC already owns this lock. Direct service-role writes use it too, so
 -- two transactions cannot both validate an unoccupied endpoint concurrently.
 perform 1 from public.harmonious_generation where id for update;
 if r->>'kind'<>'counterpart_unlink' then
  if r ? 'unlinkedRecordIds' then raise exception using errcode='PT400',message='Unlinked records belong only to an unlink receipt'; end if;
  return new;
 end if;
 if previous is not null and previous is distinct from r then raise exception using errcode='PT409',message='An unlink receipt cannot replace an earlier contribution'; end if;
 if r->>'authorId' is distinct from new.owner_id::text or r->>'action' is distinct from 'unlink_counterpart' or r->>'status' is distinct from 'active'
  or r->'version' is distinct from '1'::jsonb or r->'history' is distinct from '[]'::jsonb or r->>'body' is distinct from '' or r->'layer' is distinct from 'null'::jsonb
  or jsonb_typeof(r->'createdAt') is distinct from 'string' or jsonb_typeof(r->'updatedAt') is distinct from 'string' or jsonb_typeof(r->'targetLabel') is distinct from 'string'
  or r ?| array['sourceSnapshots','reviewedSources','definitionRefs','premise','adoption','reflection','interaction','referenceUrl']
  or jsonb_typeof(r->'unlinkedRecordIds') is distinct from 'array' then raise exception using errcode='PT400',message='Invalid counterpart unlink receipt'; end if;
 if r->>'createdAt' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$' or r->'updatedAt' is distinct from r->'createdAt'
  or to_char((r->>'createdAt')::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') is distinct from r->>'createdAt' then raise exception using errcode='PT400',message='Invalid unlink receipt time'; end if;
 if jsonb_array_length(r->'unlinkedRecordIds') not between 1 and 10000
  or exists(select 1 from jsonb_array_elements(r->'unlinkedRecordIds') v where jsonb_typeof(v)<>'string' or length(v#>>'{}') not between 1 and 200)
  or (select count(distinct value) from jsonb_array_elements(r->'unlinkedRecordIds'))<>jsonb_array_length(r->'unlinkedRecordIds') then raise exception using errcode='PT400',message='Invalid unlinked record identities'; end if;
 for ref in select value from jsonb_array_elements(jsonb_build_array(r->'target',r->'other')) loop
  if ref->>'type' is distinct from 'node' or jsonb_typeof(ref->'mapId') is distinct from 'string' or jsonb_typeof(ref->'nodeId') is distinct from 'string' or coalesce(length(ref->>'mapId'),0)=0 or coalesce(length(ref->>'nodeId'),0)=0 then raise exception using errcode='PT400',message='An unlink receipt requires two node identities'; end if;
 end loop;
 if r->'target'->>'mapId'=r->'other'->>'mapId' then raise exception using errcode='PT400',message='Choose one node from each map'; end if;
 if previous is null then
  select coalesce(jsonb_agg(content->>'id'),'[]'::jsonb) into expected_ids from public.harmonious_records where kind='discussion' and content->>'comparisonId'=r->>'comparisonId'
   and content->>'kind' in ('correspondence','relationship') and content->>'status'='active' and public.harmonious_counterpart_pair(content,r->'target',r->'other') and not public.harmonious_counterpart_unlinked(content);
  if not (expected_ids @> (r->'unlinkedRecordIds') and (r->'unlinkedRecordIds') @> expected_ids) then raise exception using errcode='PT409',message='These counterparts changed; reopen their details before unlinking'; end if;
 end if;
 return new;
end;
$$;
create function public.harmonious_counterpart_complete() returns trigger
language plpgsql security invoker set search_path='' as $$
declare r jsonb:=new.content; previous jsonb; thread jsonb; source jsonb; ref jsonb; linked jsonb; record_id text; frame_a text; frame_b text; owner boolean:=false;
begin
 if new.kind<>'discussion' or r->>'kind' not in ('correspondence','relationship','counterpart_unlink') then return new; end if;
 if tg_op='UPDATE' then previous:=old.content; end if;
 if r->>'kind'='counterpart_unlink' and previous is not null and previous=r then return new; end if;
 if r->>'kind'<>'counterpart_unlink' and (r->>'status'<>'active' or previous->>'status'='active') then return new; end if;
 select content into thread from public.harmonious_records where kind='comparison_thread' and id=r->>'comparisonId';
 if thread is null or not (thread->'participants' @> jsonb_build_array(new.owner_id::text)) then raise exception using errcode='PT403',message='Counterpart changes require comparison membership'; end if;
 for ref in select value from jsonb_array_elements(jsonb_build_array(r->'target',r->'other')) loop
  if ref->>'type' is distinct from 'node' or coalesce(ref->>'mapId','') not in (thread->>'aMapId',thread->>'bMapId') then raise exception using errcode='PT400',message='Choose a node from each comparison map'; end if;
  select content into source from public.harmonious_records where kind='map' and id=ref->>'mapId';
  if source is null or (source->>'ownerId' is distinct from new.owner_id::text and source->>'visibility' is distinct from 'shared') then raise exception using errcode='PT403',message='Both comparison maps must be available'; end if;
  owner:=owner or source->>'ownerId'=new.owner_id::text;
  if r->>'kind'<>'counterpart_unlink' then
   if not exists(select 1 from jsonb_array_elements(source->'nodes') n where n->>'id'=ref->>'nodeId' and n->>'parent' is not null) then raise exception using errcode='PT409',message='Choose available ordinary nodes'; end if;
   if frame_a is null then frame_a:=public.harmonious_counterpart_frame(source,ref->>'nodeId'); else frame_b:=public.harmonious_counterpart_frame(source,ref->>'nodeId'); end if;
  end if;
 end loop;
 if not owner or r->'target'->>'mapId'=r->'other'->>'mapId' then raise exception using errcode='PT403',message='A participating map owner must change a counterpart pair'; end if;
 if r->>'kind'='counterpart_unlink' then
  for record_id in select value from jsonb_array_elements_text(r->'unlinkedRecordIds') loop
   select content into linked from public.harmonious_records where kind='discussion' and id=record_id;
   if linked is null or linked->>'comparisonId' is distinct from r->>'comparisonId' or linked->>'status' is distinct from 'active' or linked->>'kind' not in ('correspondence','relationship')
    or public.harmonious_counterpart_pair(linked,r->'target',r->'other') is not true or public.harmonious_counterpart_unlinked(linked,new.id) then raise exception using errcode='PT409',message='These counterparts changed or were already unlinked'; end if;
  end loop;
  return new;
 end if;
 if frame_a is null or frame_b is null or frame_a<>frame_b then raise exception using errcode='PT409',message='Choose a counterpart in the same frame'; end if;
 if public.harmonious_counterpart_unlinked(r) then raise exception using errcode='PT409',message='This link was unlinked; create a new counterpart link'; end if;
 for linked in select content from public.harmonious_records where kind='discussion' and id<>new.id and content->>'comparisonId'=r->>'comparisonId'
  and content->>'kind' in ('correspondence','relationship') and content->>'status'='active' loop
  if public.harmonious_counterpart_unlinked(linked) then continue; end if;
  if public.harmonious_counterpart_pair(linked,r->'target',r->'other') then
   if (r->>'kind'='correspondence' and linked->>'kind'='correspondence') or (r->>'kind'='relationship' and linked->>'kind'='relationship' and linked->>'authorId'=new.owner_id::text) then raise exception using errcode='PT409',message='These counterparts are already linked'; end if;
  elsif exists(select 1 from jsonb_array_elements(jsonb_build_array(r->'target',r->'other')) a cross join jsonb_array_elements(jsonb_build_array(linked->'target',linked->'other')) b where a->>'mapId'=b->>'mapId' and a->>'nodeId'=b->>'nodeId') then
   raise exception using errcode='PT409',message='One of these nodes already has a counterpart; unlink it first';
  end if;
 end loop;
 return new;
end;
$$;
revoke all on function public.harmonious_counterpart_pair(jsonb,jsonb,jsonb),public.harmonious_counterpart_frame(jsonb,text),public.harmonious_counterpart_unlinked(jsonb,text),public.harmonious_counterpart_identity(),public.harmonious_counterpart_complete() from public,anon,authenticated;
grant execute on function public.harmonious_counterpart_pair(jsonb,jsonb,jsonb),public.harmonious_counterpart_frame(jsonb,text),public.harmonious_counterpart_unlinked(jsonb,text),public.harmonious_counterpart_identity(),public.harmonious_counterpart_complete() to service_role;
create trigger harmonious_counterpart_identity before insert or update on public.harmonious_records for each row execute function public.harmonious_counterpart_identity();
create constraint trigger harmonious_counterpart_complete after insert or update on public.harmonious_records deferrable initially deferred for each row execute function public.harmonious_counterpart_complete();
-- A receipt may unlink a deleted node. Its dedicated validators check saved
-- pair identities and accessible maps instead of demanding live node wording.
drop trigger harmonious_discussion_identity on public.harmonious_records;
create trigger harmonious_discussion_identity before insert or update on public.harmonious_records for each row when (new.kind<>'discussion' or new.content->>'kind' is distinct from 'counterpart_unlink') execute function public.harmonious_check_discussion();

-- Save receipts before new linking records, independent of client batch order.
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
    order by case value->>'kind' when 'comparison_thread' then 1 when 'comparison' then 2 when 'argument_node' then 3 when 'argument_edge' then 4 when 'discussion' then case when value->'value'->>'kind'='counterpart_unlink' then 5 else 6 end else 0 end, ordinal loop
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
