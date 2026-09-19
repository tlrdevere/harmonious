-- Authored disagreement points and individual outcomes extend discussions.
-- No existing records, map content, challenge outcomes or privileges change.
create function public.harmonious_reflection_snapshot(target_ref jsonb) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare source_map jsonb; item jsonb; left_node jsonb; right_node jsonb; parent jsonb; wording jsonb; definitions jsonb; label text; left_snapshot jsonb; right_snapshot jsonb;
begin
 if target_ref->>'type'='inference' then
  select content into parent from public.harmonious_records where kind='discussion' and id=target_ref->>'entryId';
  if parent is null or parent->>'kind'<>'argument' or parent->>'action'<>'reason' or parent->'target'->>'type' not in ('node','entry') then return null; end if;
  left_snapshot:=public.harmonious_reflection_snapshot(jsonb_build_object('type','entry','entryId',parent->>'id'));
  right_snapshot:=public.harmonious_reflection_snapshot(parent->'target');
  if left_snapshot is null or right_snapshot is null then return null; end if;
  return jsonb_build_object('target',target_ref,'label','Reasoning connection','wording',jsonb_build_object('reason',left_snapshot,'conclusion',right_snapshot),'definitions','[]'::jsonb);
 elsif target_ref->>'type'='entry' then
  select content into parent from public.harmonious_records where kind='discussion' and id=target_ref->>'entryId';
  if parent is null then return null; end if;
  label:=case parent->>'action' when 'reason' then 'Reason' when 'reply' then 'Response' when 'resolve' then 'Resolved by challenger' when 'reopen' then 'Reopened by challenger' when 'accept' then 'Accept challenge' when 'maintain' then 'Maintain position' when 'disagreement_point' then 'Point of disagreement' when 'outcome' then 'Reflection outcome' else null end;
  -- Reflection targets are restricted below to the entry kinds represented here.
  if label is null then return null; end if;
  wording:=jsonb_build_object('action',parent->>'action','body',parent->>'body','referenceUrl',coalesce(parent->>'referenceUrl',''),'version',parent->'version','status',parent->>'status');
  if parent ? 'premise' then wording:=wording||jsonb_build_object('premise',parent->'premise'); end if;
  if parent ? 'reflection' then wording:=wording||jsonb_build_object('reflection',parent->'reflection'); end if;
  return jsonb_build_object('target',target_ref,'label',label,'wording',wording,'definitions',coalesce(parent->'definitionRefs','[]'::jsonb));
 end if;
 select content into source_map from public.harmonious_records where kind='map' and id=target_ref->>'mapId';
 if source_map is null then return null; end if;
 if target_ref->>'type'='node' then
  select value into item from jsonb_array_elements(source_map->'nodes') where value->>'id'=target_ref->>'nodeId';
  if item is null then return null; end if;
  select jsonb_object_agg(field,coalesce(item->>field,'')) into wording from unnest(array['title','summary','details','kind','timeScope','sourceTitle','sourceUrl']) field;
  label:=item->>'title';
 elsif target_ref->>'type'='edge' then
  select value into item from jsonb_array_elements(source_map->'relations') where value->>'id'=target_ref->>'edgeId';
  if item is null then select jsonb_build_object('from',value->>'parent','to',value->>'id','type',value->>'structuralType') into item from jsonb_array_elements(source_map->'nodes') where 'structure:'||(value->>'id')=target_ref->>'edgeId' and value->>'parent' is not null; end if;
  if item is null then return null; end if;
  select value into left_node from jsonb_array_elements(source_map->'nodes') where value->>'id'=item->>'from';
  select value into right_node from jsonb_array_elements(source_map->'nodes') where value->>'id'=item->>'to';
  if left_node is null or right_node is null then return null; end if;
  label:=(left_node->>'title')||' → '||(right_node->>'title');
  select jsonb_object_agg(field,coalesce(left_node->>field,'')) into left_snapshot from unnest(array['title','summary','details','kind','timeScope','sourceTitle','sourceUrl']) field;
  select jsonb_object_agg(field,coalesce(right_node->>field,'')) into right_snapshot from unnest(array['title','summary','details','kind','timeScope','sourceTitle','sourceUrl']) field;
  wording:=jsonb_build_object('kind',coalesce(nullif(item->>'kind',''),item->>'type',''),'from',left_snapshot,'to',right_snapshot);
 else return null; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'authorId',content->>'authorId','body',content->>'body','version',content->'version') order by id collate "C"),'[]'::jsonb) into definitions from public.harmonious_records where kind='discussion' and content->>'kind'='context' and content->>'status'='active' and content->'target'=target_ref;
 return jsonb_build_object('target',target_ref,'label',label,'wording',wording,'definitions',definitions);
end;
$$;
revoke all on function public.harmonious_reflection_snapshot(jsonb) from public,anon,authenticated;
grant execute on function public.harmonious_reflection_snapshot(jsonb) to service_role;

create function public.harmonious_reflection_identity() returns trigger
language plpgsql security invoker set search_path='' as $$
declare r jsonb:=new.content; previous jsonb; version_record jsonb; parent jsonb; metadata jsonb; target_ref jsonb; field text; ordinal bigint; preserved jsonb; is_reflection boolean; withdrawal boolean;
begin
 if new.kind<>'discussion' then return new; end if;
 if tg_op='UPDATE' then previous:=old.content; else select content into previous from public.harmonious_records where kind='discussion' and id=new.id; end if;
 is_reflection:=coalesce(r->>'kind'='reflection',false);
 if not is_reflection then
  if r ? 'reflection' or exists(select 1 from jsonb_array_elements(case when jsonb_typeof(r->'history')='array' then r->'history' else '[]'::jsonb end) v where v ? 'reflection' or v->>'kind'='reflection') then raise exception using errcode='PT400',message='Reflection metadata belongs only to a reflection'; end if;
 else
  if coalesce(r->>'action','') not in ('disagreement_point','outcome') or jsonb_typeof(r->'history') is distinct from 'array' or jsonb_typeof(r->'version') is distinct from 'number' then raise exception using errcode='PT400',message='Invalid reflection history'; end if;
  if (r->>'version')::numeric<>jsonb_array_length(r->'history')+1 then raise exception using errcode='PT400',message='Invalid reflection history'; end if;
  if previous is null then
   if r->'version'<>'1'::jsonb then raise exception using errcode='PT400',message='A new reflection has no earlier history'; end if;
  else
   if previous->>'kind' is distinct from 'reflection' or previous->>'action' is distinct from r->>'action' then raise exception using errcode='PT409',message='Reflection action cannot change'; end if;
   select coalesce(jsonb_agg(value order by ord),'[]'::jsonb) into preserved from jsonb_array_elements(r->'history') with ordinality v(value,ord) where ord<=(previous->>'version')::bigint;
   if (r->>'version')::numeric<=(previous->>'version')::numeric or preserved is distinct from previous->'history'||jsonb_build_array(previous-'history') or r->'sourceSnapshots' is distinct from previous->'sourceSnapshots' then raise exception using errcode='PT409',message='Earlier reflection wording and source snapshots must remain in history'; end if;
  end if;
  for version_record,ordinal in select value,ord from jsonb_array_elements(r->'history'||jsonb_build_array(r)) with ordinality v(value,ord) loop
   if version_record->'version' is distinct from to_jsonb(ordinal) or version_record->>'kind' is distinct from 'reflection' or version_record->>'authorId' is distinct from new.owner_id::text or version_record->>'layer' is distinct from 'arguments' or version_record->'other' is distinct from 'null'::jsonb or version_record ?| array['premise','adoption','definitionRefs','referenceUrl'] or jsonb_typeof(version_record->'body') is distinct from 'string' or length(btrim(version_record->>'body'))=0 or length(version_record->>'body')>10000 or coalesce(version_record->>'status','') not in ('active','withdrawn') then raise exception using errcode='PT400',message='Invalid reflection contribution'; end if;
   foreach field in array array['id','authorId','comparisonId','kind','target','other','createdAt','layer','action'] loop
    if version_record->field is distinct from r->field then raise exception using errcode='PT409',message='Reflection history must preserve its identity and action'; end if;
   end loop;
   if version_record->'sourceSnapshots' is distinct from r->'sourceSnapshots' then raise exception using errcode='PT409',message='Every reflection version must preserve its original source snapshot'; end if;
   metadata:=version_record->'reflection';
   if jsonb_typeof(metadata) is distinct from 'object' then raise exception using errcode='PT400',message='Invalid reflection metadata'; end if;
   if r->>'action'='disagreement_point' then
    if (select count(*) from jsonb_object_keys(metadata))<>1 or jsonb_typeof(metadata->'category') is distinct from 'string' or metadata->>'category' not in ('','facts','reasoning','values','other') then raise exception using errcode='PT400',message='Invalid disagreement category'; end if;
   else
    if (select count(*) from jsonb_object_keys(metadata))<>2 or jsonb_typeof(metadata->'result') is distinct from 'string' or metadata->>'result' not in ('','changed_position','more_work','difference_understood') or jsonb_typeof(metadata->'nextStep') is distinct from 'string' or length(metadata->>'nextStep')>2000 then raise exception using errcode='PT400',message='Invalid individual outcome'; end if;
   end if;
  end loop;
 end if;
 withdrawal:=coalesce(previous->>'status'='active' and r->>'status'='withdrawn' and (r-array['status','version','updatedAt','history'])=(previous-array['status','version','updatedAt','history']) and (r->>'version')::bigint=(previous->>'version')::bigint+1 and r->'history'=previous->'history'||jsonb_build_array(previous-'history'),false);
 if withdrawal then return new; end if;
 for target_ref in select value from jsonb_array_elements(jsonb_build_array(r->'target',r->'other')) where value<>'null'::jsonb loop
  if target_ref->>'type' in ('entry','inference') then
   select content into parent from public.harmonious_records where kind='discussion' and id=target_ref->>'entryId';
   if parent->>'kind'='reflection' and not(is_reflection and r->>'action'='outcome' and target_ref->>'type'='entry' and parent->>'action'='disagreement_point') then raise exception using errcode='PT400',message='Only an individual outcome can follow a disagreement point'; end if;
  end if;
 end loop;
 if not is_reflection then return new; end if;
 target_ref:=r->'target';
 if target_ref->>'type' in ('entry','inference') then
  select content into parent from public.harmonious_records where kind='discussion' and id=target_ref->>'entryId';
  if parent is null or parent->>'status' is distinct from 'active' or parent->>'comparisonId' is distinct from r->>'comparisonId' then raise exception using errcode='PT409',message='Reflection target unavailable'; end if;
  if r->>'action'='outcome' then
   if target_ref->>'type'<>'entry' or parent->>'kind' is distinct from 'reflection' or parent->>'action' is distinct from 'disagreement_point' then raise exception using errcode='PT400',message='Choose an active disagreement point for your outcome'; end if;
  elsif not ((parent->>'kind'='argument' and parent->>'action'='reason') or (target_ref->>'type'='entry' and parent->>'kind'='reply' and parent->>'layer'='arguments')) then raise exception using errcode='PT400',message='Choose a position, reason, argument response or reasoning connection'; end if;
 elsif r->>'action'='outcome' then raise exception using errcode='PT400',message='Choose an active disagreement point for your outcome';
 elsif target_ref->>'type'='node' then
  if not exists(select 1 from public.harmonious_records m cross join lateral jsonb_array_elements(m.content->'nodes') n where m.kind='map' and m.id=target_ref->>'mapId' and n->>'id'=target_ref->>'nodeId' and n->>'parent' is not null) then raise exception using errcode='PT400',message='Choose an ordinary node rather than a frame heading'; end if;
 elsif target_ref->>'type' is distinct from 'edge' then raise exception using errcode='PT400',message='Invalid disagreement target'; end if;
 return new;
end;
$$;
revoke all on function public.harmonious_reflection_identity() from public,anon,authenticated;
grant execute on function public.harmonious_reflection_identity() to service_role;
create trigger harmonious_reflection_identity before insert or update on public.harmonious_records for each row execute function public.harmonious_reflection_identity();

create function public.harmonious_reflection_complete() returns trigger
language plpgsql security invoker set search_path='' as $$
declare r jsonb:=new.content; previous jsonb; target_ref jsonb; parent jsonb; snapshot jsonb; snapshots jsonb[]; actual jsonb; expected jsonb; normalized jsonb; location text[]; seen text[]:=array[]::text[]; withdrawal boolean;
begin
 if new.kind<>'discussion' or r->>'kind' is distinct from 'reflection' then return new; end if;
 if tg_op='UPDATE' then previous:=old.content; end if;
 withdrawal:=coalesce(previous->>'status'='active' and r->>'status'='withdrawn' and (r-array['status','version','updatedAt','history'])=(previous-array['status','version','updatedAt','history']) and (r->>'version')::bigint=(previous->>'version')::bigint+1 and r->'history'=previous->'history'||jsonb_build_array(previous-'history'),false);
 if withdrawal then return new; end if;
 -- The earlier premise trigger verifies active contextual ancestry and every
 -- reused source. Also require the final ordinary map/edge anchor to exist.
 target_ref:=r->'target';
 while target_ref->>'type' in ('entry','inference') loop
  if target_ref->>'entryId'=any(seen) then raise exception using errcode='PT400',message='Reflection ancestry cannot cycle'; end if;
  seen:=array_append(seen,target_ref->>'entryId');select content into parent from public.harmonious_records where kind='discussion' and id=target_ref->>'entryId';
  if parent is null or parent->>'status' is distinct from 'active' or parent->>'comparisonId' is distinct from r->>'comparisonId' then raise exception using errcode='PT409',message='Reflection source unavailable'; end if;
  target_ref:=parent->'target';
 end loop;
 if public.harmonious_reflection_snapshot(target_ref) is null then raise exception using errcode='PT409',message='Reflection source unavailable'; end if;
 expected:=public.harmonious_reflection_snapshot(r->'target');
 if expected is null then raise exception using errcode='PT409',message='Reflection source unavailable'; end if;
 snapshots:=array[]::jsonb[];
 if previous is null then
  snapshots:=array_append(snapshots,r->'sourceSnapshots');
  if r ? 'reviewedSources' then snapshots:=array_append(snapshots,r->'reviewedSources'); end if;
 elsif r->'reviewedSources' is distinct from previous->'reviewedSources' then snapshots:=array_append(snapshots,r->'reviewedSources'); end if;
 foreach snapshot in array snapshots loop
  if jsonb_typeof(snapshot) is distinct from 'array' or jsonb_array_length(snapshot)<>1 then raise exception using errcode='PT409',message='Reflection snapshot must capture the current source'; end if;
  actual:=snapshot->0;
  -- Context order is presentation-only (browser locale versus database C).
  -- Normalize just those lists; require every exact captured value to match.
  foreach location slice 1 in array array[array['definitions',null,null],array['wording','reason','definitions'],array['wording','conclusion','definitions']] loop
   location:=array_remove(location,null);
   if expected#>location is not null then
    if jsonb_typeof(actual#>location) is distinct from 'array' then raise exception using errcode='PT409',message='Reflection snapshot must capture the current source'; end if;
    select coalesce(jsonb_agg(value order by value::text),'[]'::jsonb) into normalized from jsonb_array_elements(expected#>location);expected:=jsonb_set(expected,location,normalized);
    select coalesce(jsonb_agg(value order by value::text),'[]'::jsonb) into normalized from jsonb_array_elements(actual#>location);actual:=jsonb_set(actual,location,normalized);
   end if;
  end loop;
  if actual is distinct from expected then raise exception using errcode='PT409',message='Reflection snapshot must capture the current source'; end if;
 end loop;
 if r->>'action'='outcome' and r->>'status'='active' and exists(select 1 from public.harmonious_records where kind='discussion' and id<>new.id and owner_id=new.owner_id and content->>'kind'='reflection' and content->>'action'='outcome' and content->>'status'='active' and content->>'comparisonId'=r->>'comparisonId' and content->'target'=r->'target') then raise exception using errcode='PT409',message='You already have an outcome for this disagreement point'; end if;
 return new;
end;
$$;
revoke all on function public.harmonious_reflection_complete() from public,anon,authenticated;
grant execute on function public.harmonious_reflection_complete() to service_role;
create constraint trigger harmonious_reflection_complete after insert or update on public.harmonious_records deferrable initially deferred for each row execute function public.harmonious_reflection_complete();
