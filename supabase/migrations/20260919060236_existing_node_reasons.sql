-- Existing-position reasons extend authored discussion records. No saved rows,
-- table privileges, or legacy argument graphs are changed by this migration.
create function public.harmonious_valid_premise(p jsonb, actor text) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare wording jsonb; context_record jsonb; ref jsonb; field text; prior_id text; definition_ids text[];
begin
 if jsonb_typeof(p) is distinct from 'object' then return false; end if;
 if (select count(*) from jsonb_object_keys(p))<>6 or not (p ?& array['mapId','nodeId','ideaId','ideaVersion','wording','contexts']) then return false; end if;
 foreach field in array array['mapId','nodeId','ideaId'] loop
  if jsonb_typeof(p->field) is distinct from 'string' or length(btrim(p->>field))=0 or length(p->>field)>200 then return false; end if;
 end loop;
 if jsonb_typeof(p->'ideaVersion') is distinct from 'number' or (p->>'ideaVersion')::numeric not between 1 and 9007199254740991 or trunc((p->>'ideaVersion')::numeric)<>(p->>'ideaVersion')::numeric then return false; end if;
 wording:=p->'wording';
 if jsonb_typeof(wording) is distinct from 'object' then return false; end if;
 if (select count(*) from jsonb_object_keys(wording))<>8 or not (wording ?& array['kind','title','summary','details','timeScope','sourceTitle','sourceUrl','frame']) or wording->>'kind' is distinct from 'position' or coalesce(wording->>'timeScope','') not in ('history','present','likely_future') or coalesce(wording->>'frame','') not in ('status','action','goal') then return false; end if;
 foreach field in array array['title','summary','details','sourceTitle','sourceUrl'] loop
  if jsonb_typeof(wording->field) is distinct from 'string' or length(wording->>field)>(case when field='title' then 200 when field in ('sourceTitle','sourceUrl') then 2000 else 10000 end) then return false; end if;
 end loop;
 if length(btrim(wording->>'title'))=0 or (wording->>'sourceUrl'<>'' and wording->>'sourceUrl' !~* '^https?://[^[:space:]]+') then return false; end if;
 if jsonb_typeof(p->'contexts') is distinct from 'array' then return false; end if;
 if jsonb_array_length(p->'contexts')>30 then return false; end if;
 for context_record in select value from jsonb_array_elements(p->'contexts') loop
  if jsonb_typeof(context_record) is distinct from 'object' then return false; end if;
  if (select count(*) from jsonb_object_keys(context_record))<>5 or not (context_record ?& array['id','authorId','version','body','definitionRefs']) then return false; end if;
  if jsonb_typeof(context_record->'id') is distinct from 'string' or length(btrim(context_record->>'id'))=0 or length(context_record->>'id')>200 or context_record->>'authorId' is distinct from actor or jsonb_typeof(context_record->'body') is distinct from 'string' or length(context_record->>'body')>10000 then return false; end if;
  if prior_id is not null and prior_id collate "C">=(context_record->>'id') collate "C" then return false; end if;
  prior_id:=context_record->>'id';
  if jsonb_typeof(context_record->'version') is distinct from 'number' or (context_record->>'version')::numeric not between 1 and 9007199254740991 or trunc((context_record->>'version')::numeric)<>(context_record->>'version')::numeric then return false; end if;
  if jsonb_typeof(context_record->'definitionRefs') is distinct from 'array' then return false; end if;
  if jsonb_array_length(context_record->'definitionRefs')>30 then return false; end if;
  definition_ids:=array[]::text[];
  for ref in select value from jsonb_array_elements(context_record->'definitionRefs') loop
   if jsonb_typeof(ref) is distinct from 'object' then return false; end if;
   if (select count(*) from jsonb_object_keys(ref))<>6 or not (ref ?& array['definitionId','authorId','type','version','title','body']) or ref->>'authorId' is distinct from actor or coalesce(ref->>'type','') not in ('definition','standard') then return false; end if;
   foreach field in array array['definitionId','title','body'] loop
    if jsonb_typeof(ref->field) is distinct from 'string' or length(btrim(ref->>field))=0 or length(ref->>field)>(case when field='body' then 10000 else 200 end) then return false; end if;
   end loop;
   if jsonb_typeof(ref->'version') is distinct from 'number' or (ref->>'version')::numeric not between 1 and 9007199254740991 or trunc((ref->>'version')::numeric)<>(ref->>'version')::numeric or ref->>'definitionId'=any(definition_ids) then return false; end if;
   definition_ids:=array_append(definition_ids,ref->>'definitionId');
  end loop;
 end loop;
 return true;
end;
$$;
revoke all on function public.harmonious_valid_premise(jsonb,text) from public,anon,authenticated;
grant execute on function public.harmonious_valid_premise(jsonb,text) to service_role;

create function public.harmonious_premise_identity() returns trigger
language plpgsql security invoker set search_path='' as $$
declare previous jsonb; version_record jsonb; preserved jsonb; ordinal bigint; has_premise boolean;
begin
 if new.kind<>'discussion' then return new; end if;
 if tg_op='UPDATE' then previous:=old.content;
 else select content into previous from public.harmonious_records where kind='discussion' and id=new.id; end if;
 has_premise:=new.content ? 'premise';
 if not has_premise and not coalesce(previous ? 'premise',false) and not exists(select 1 from jsonb_array_elements(case when jsonb_typeof(new.content->'history')='array' then new.content->'history' else '[]'::jsonb end) v where v ? 'premise') then return new; end if;
 if previous is not null and ((previous ? 'premise') is distinct from has_premise or previous->'premise'->'mapId' is distinct from new.content->'premise'->'mapId' or previous->'premise'->'nodeId' is distinct from new.content->'premise'->'nodeId') then raise exception using errcode='PT409',message='An existing-position reason must preserve its source placement'; end if;
 if jsonb_typeof(new.content->'history') is distinct from 'array' or jsonb_typeof(new.content->'version') is distinct from 'number' then raise exception using errcode='PT400',message='Invalid existing-position reason history'; end if;
 if (new.content->>'version')::numeric<>jsonb_array_length(new.content->'history')+1 then raise exception using errcode='PT400',message='Invalid existing-position reason history'; end if;
 if previous is null then
  if new.content->'version'<>'1'::jsonb then raise exception using errcode='PT400',message='A new existing-position reason has no earlier history'; end if;
 else
  select coalesce(jsonb_agg(value order by ord),'[]'::jsonb) into preserved from jsonb_array_elements(new.content->'history') with ordinality v(value,ord) where ord<=(previous->>'version')::bigint;
  if (new.content->>'version')::bigint<=(previous->>'version')::bigint or preserved is distinct from previous->'history'||jsonb_build_array(previous-'history') or new.content->'sourceSnapshots' is distinct from previous->'sourceSnapshots' then raise exception using errcode='PT409',message='Earlier existing-position reason wording must remain in history'; end if;
 end if;
 for version_record,ordinal in select value,ord from jsonb_array_elements(new.content->'history'||jsonb_build_array(new.content)) with ordinality v(value,ord) loop
  if (version_record ? 'premise') is distinct from has_premise or version_record->'version' is distinct from to_jsonb(ordinal) or version_record->>'kind' is distinct from 'argument' or version_record->>'action' is distinct from 'reason' or version_record->>'authorId' is distinct from new.owner_id::text or version_record->'target' is distinct from new.content->'target' or version_record->'comparisonId' is distinct from new.content->'comparisonId' or version_record->'premise'->'mapId' is distinct from new.content->'premise'->'mapId' or version_record->'premise'->'nodeId' is distinct from new.content->'premise'->'nodeId' or version_record->>'body' is distinct from version_record->'premise'->'wording'->>'title' or not public.harmonious_valid_premise(version_record->'premise',new.owner_id::text) then raise exception using errcode='PT400',message='Invalid saved premise wording or context'; end if;
 end loop;
 return new;
end;
$$;
revoke all on function public.harmonious_premise_identity() from public,anon,authenticated;
grant execute on function public.harmonious_premise_identity() to service_role;
create trigger harmonious_premise_identity before insert or update on public.harmonious_records for each row execute function public.harmonious_premise_identity();

-- Deferred validation sees the complete atomic map/context/contribution batch.
-- Unchanged historical snapshots are retained when source maps are later edited.
create function public.harmonious_check_premise() returns trigger
language plpgsql security invoker set search_path='' as $$
declare
 r jsonb:=new.content; previous jsonb; source_map jsonb; scope_map jsonb; source_node jsonb; root_node jsonb; edge jsonb; thread jsonb;
 target_ref jsonb; initial_ref jsonb; parent_record jsonb; ancestor jsonb; ancestors jsonb[]; context_values jsonb; expected jsonb; current_wording jsonb; scope_frame text;
 seen text[]:=array[]::text[]; withdrawal boolean:=false; fresh boolean; cyclic boolean; start_key jsonb;
begin
 if new.kind<>'discussion' then return new; end if;
 if tg_op='UPDATE' then previous:=old.content; end if;
 withdrawal:=coalesce(previous->>'status'='active' and r->>'status'='withdrawn' and (r-array['status','version','updatedAt','history'])=(previous-array['status','version','updatedAt','history']) and (r->>'version')::bigint=(previous->>'version')::bigint+1 and r->'history'=previous->'history'||jsonb_build_array(previous-'history'),false);
 if withdrawal then return new; end if;
 -- Existing contributions remain readable when a reused source disappears.
 -- New work still requires all reused-source ancestors to be available. Walk
 -- each contextual path once, then compare its premises to the common anchor.
 if r->>'kind'<>'context' then
  select content into thread from public.harmonious_records where kind='comparison_thread' and id=r->>'comparisonId';
  for initial_ref in select value from jsonb_array_elements(jsonb_build_array(r->'target',r->'other')) where value<>'null'::jsonb loop
   target_ref:=initial_ref;seen:=array[]::text[];ancestors:=array[]::jsonb[];
   while target_ref->>'type' in ('entry','inference') loop
    if target_ref->>'entryId'=any(seen) then raise exception using errcode='PT400',message='Conversation context cannot form a cycle'; end if;
    seen:=array_append(seen,target_ref->>'entryId');
    select content into parent_record from public.harmonious_records where kind='discussion' and id=target_ref->>'entryId';
    if parent_record is null or parent_record->>'comparisonId' is distinct from r->>'comparisonId' or parent_record->>'status' is distinct from 'active' then raise exception using errcode='PT409',message='Conversation target unavailable'; end if;
    if parent_record ? 'premise' then ancestors:=array_append(ancestors,parent_record); end if;
    target_ref:=parent_record->'target';
   end loop;
   if cardinality(ancestors)=0 then continue; end if;
   select content into scope_map from public.harmonious_records where kind='map' and id=target_ref->>'mapId';scope_frame:=null;
   if scope_map is null or scope_map->>'id' not in (thread->>'aMapId',thread->>'bMapId') then raise exception using errcode='PT409',message='Ancestor source position unavailable'; end if;
   if target_ref->>'type'='node' then
    select value into root_node from jsonb_array_elements(scope_map->'nodes') where value->>'id'=target_ref->>'nodeId';
    if root_node is not null then scope_frame:=public.harmonious_node_wording(scope_map,root_node)->>'frame'; end if;
   elsif target_ref->>'type'='edge' then
    select value into edge from jsonb_array_elements(scope_map->'relations') where value->>'id'=target_ref->>'edgeId';
    if edge is null then select jsonb_build_object('from',value->>'parent','to',value->>'id') into edge from jsonb_array_elements(scope_map->'nodes') where 'structure:'||(value->>'id')=target_ref->>'edgeId' and value->>'parent' is not null; end if;
    select value into root_node from jsonb_array_elements(scope_map->'nodes') where value->>'id'=edge->>'from';
    if root_node is not null then scope_frame:=public.harmonious_node_wording(scope_map,root_node)->>'frame'; end if;
    select value into root_node from jsonb_array_elements(scope_map->'nodes') where value->>'id'=edge->>'to';
    if root_node is null or scope_frame is distinct from public.harmonious_node_wording(scope_map,root_node)->>'frame' then scope_frame:=null; end if;
   end if;
   foreach ancestor in array ancestors loop
    select content into source_map from public.harmonious_records where kind='map' and id=ancestor->'premise'->>'mapId';
    if source_map is null or source_map->>'ownerId' is distinct from ancestor->>'authorId' or source_map->>'id' not in (thread->>'aMapId',thread->>'bMapId') or (scope_map->>'ownerId'=ancestor->>'authorId' and scope_map->>'id' is distinct from source_map->>'id') then raise exception using errcode='PT409',message='Ancestor source position unavailable'; end if;
    select value into source_node from jsonb_array_elements(source_map->'nodes') where value->>'id'=ancestor->'premise'->>'nodeId' and value->>'parent' is not null and value->>'kind'='position';
    if source_node is null or scope_frame is null or scope_frame is distinct from public.harmonious_node_wording(source_map,source_node)->>'frame' then raise exception using errcode='PT409',message='Ancestor source position unavailable'; end if;
   end loop;
  end loop;
 end if;
 if r->>'kind' is distinct from 'argument' or r->>'action' is distinct from 'reason' then return new; end if;
 if r ? 'premise' then
  select content into thread from public.harmonious_records where kind='comparison_thread' and id=r->>'comparisonId';
  select content into source_map from public.harmonious_records where kind='map' and id=r->'premise'->>'mapId';
  if source_map is null or source_map->>'ownerId' is distinct from new.owner_id::text or source_map->>'id' not in (thread->>'aMapId',thread->>'bMapId') then raise exception using errcode='PT403',message='Choose your own Position in the same comparison map and frame'; end if;
  select value into source_node from jsonb_array_elements(source_map->'nodes') where value->>'id'=r->'premise'->>'nodeId' and value->>'parent' is not null and value->>'kind'='position';
  if source_node is null then raise exception using errcode='PT409',message='Source position unavailable'; end if;
  current_wording:=public.harmonious_node_wording(source_map,source_node);
  target_ref:=r->'target';seen:=array[]::text[];scope_frame:=null;
  while target_ref->>'type' in ('entry','inference') loop
   if target_ref->>'entryId'=any(seen) then raise exception using errcode='PT400',message='Conversation context cannot form a cycle'; end if;
   seen:=array_append(seen,target_ref->>'entryId');
   select content into parent_record from public.harmonious_records where kind='discussion' and id=target_ref->>'entryId';
   if parent_record is null or parent_record->>'comparisonId' is distinct from r->>'comparisonId' or parent_record->>'status' is distinct from 'active' then raise exception using errcode='PT409',message='Conversation target unavailable'; end if;
   target_ref:=parent_record->'target';
  end loop;
  select content into scope_map from public.harmonious_records where kind='map' and id=target_ref->>'mapId';
  if scope_map is null or scope_map->>'id' not in (thread->>'aMapId',thread->>'bMapId') or (scope_map->>'ownerId'=new.owner_id::text and scope_map->>'id' is distinct from source_map->>'id') then raise exception using errcode='PT403',message='Choose your own Position in the same comparison map and frame'; end if;
  if target_ref->>'type'='node' then
   select value into root_node from jsonb_array_elements(scope_map->'nodes') where value->>'id'=target_ref->>'nodeId';
   if root_node is not null then scope_frame:=public.harmonious_node_wording(scope_map,root_node)->>'frame'; end if;
  elsif target_ref->>'type'='edge' then
   select value into edge from jsonb_array_elements(scope_map->'relations') where value->>'id'=target_ref->>'edgeId';
   if edge is null then
    select jsonb_build_object('from',value->>'parent','to',value->>'id') into edge from jsonb_array_elements(scope_map->'nodes') where 'structure:'||(value->>'id')=target_ref->>'edgeId' and value->>'parent' is not null;
   end if;
   select value into root_node from jsonb_array_elements(scope_map->'nodes') where value->>'id'=edge->>'from';
   if root_node is not null then scope_frame:=public.harmonious_node_wording(scope_map,root_node)->>'frame'; end if;
   select value into root_node from jsonb_array_elements(scope_map->'nodes') where value->>'id'=edge->>'to';
   if root_node is null or scope_frame is distinct from public.harmonious_node_wording(scope_map,root_node)->>'frame' then scope_frame:=null; end if;
  end if;
  if scope_frame is null or scope_frame is distinct from current_wording->>'frame' then raise exception using errcode='PT403',message='Choose your own Position in the same comparison map and frame'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',content->>'id','authorId',content->>'authorId','version',content->'version','body',content->>'body','definitionRefs',coalesce(content->'definitionRefs','[]'::jsonb)) order by id collate "C"),'[]'::jsonb) into context_values from public.harmonious_records where kind='discussion' and content->>'kind'='context' and content->>'status'='active' and content->>'authorId'=new.owner_id::text and content->'target'=jsonb_build_object('type','node','mapId',source_map->>'id','nodeId',source_node->>'id');
  if jsonb_array_length(context_values)>30 then raise exception using errcode='PT400',message='Too many source position contexts'; end if;
  expected:=jsonb_build_object('mapId',source_map->>'id','nodeId',source_node->>'id','ideaId',source_node->>'ideaId','ideaVersion',source_node->'ideaVersion','wording',current_wording,'contexts',context_values);
  if previous is not null and exists(select 1 from jsonb_array_elements(r->'history') with ordinality v(value,ord) where ord>(previous->>'version')::bigint and value->'premise' is distinct from previous->'premise' and value->'premise' is distinct from expected) then raise exception using errcode='PT409',message='New history must preserve a saved or current source snapshot'; end if;
  fresh:=previous is null or r->'premise' is distinct from previous->'premise';
  if fresh and r->'premise' is distinct from expected then raise exception using errcode='PT409',message='The source position changed; review its current wording before saving'; end if;
 end if;
 if r->>'status' is distinct from 'active' then return new; end if;
 if r ? 'premise' then
  if exists(select 1 from public.harmonious_records where kind='discussion' and id<>new.id and content->>'comparisonId'=r->>'comparisonId' and content->>'kind'='argument' and content->>'action'='reason' and content->>'status'='active' and content->'target'=r->'target' and content->'premise'->'mapId'=r->'premise'->'mapId' and content->'premise'->'nodeId'=r->'premise'->'nodeId') then raise exception using errcode='PT409',message='This position already supports that conclusion'; end if;
  target_ref:=r->'target';seen:=array[]::text[];
  while target_ref->>'type'='entry' loop
   select content into parent_record from public.harmonious_records where kind='discussion' and id=target_ref->>'entryId';
   exit when parent_record is null or parent_record->>'kind'<>'argument' or parent_record->>'action'<>'reason';
   if target_ref->>'entryId'=any(seen) then raise exception using errcode='PT400',message='Supporting reasons cannot form a cycle'; end if;
   seen:=array_append(seen,target_ref->>'entryId');
   if parent_record->'premise'->'mapId'=r->'premise'->'mapId' and parent_record->'premise'->'nodeId'=r->'premise'->'nodeId' then raise exception using errcode='PT400',message='A position cannot repeat within its support ancestry'; end if;
   target_ref:=parent_record->'target';
  end loop;
  if target_ref->>'type'='node' and target_ref->'mapId'=r->'premise'->'mapId' and target_ref->'nodeId'=r->'premise'->'nodeId' then raise exception using errcode='PT400',message='A position cannot support itself'; end if;
 end if;
 -- Only reasons contribute dependency edges. Contextual replies/challenges
 -- establish a display anchor, never an implied supporting relationship.
 start_key:=jsonb_build_array('entry',new.id);
 with recursive reasons as materialized (
  select content from public.harmonious_records where kind='discussion' and content->>'comparisonId'=r->>'comparisonId' and content->>'kind'='argument' and content->>'action'='reason' and content->>'status'='active'
 ), edges(a,b) as (
  select case when content->'target'->>'type'='node' then jsonb_build_array('node',content->'target'->>'mapId',content->'target'->>'nodeId') else jsonb_build_array('entry',content->'target'->>'entryId') end,jsonb_build_array('entry',content->>'id') from reasons
  union all select jsonb_build_array('entry',content->>'id'),jsonb_build_array('node',content->'premise'->>'mapId',content->'premise'->>'nodeId') from reasons where content ? 'premise'
 ), reachable(vertex) as (
  select b from edges where a=start_key
  union select edges.b from edges join reachable on edges.a=reachable.vertex
 ) select exists(select 1 from reachable where vertex=start_key) into cyclic;
 if cyclic then raise exception using errcode='PT400',message='Supporting reasons cannot form a cycle'; end if;
 return new;
end;
$$;
revoke all on function public.harmonious_check_premise() from public,anon,authenticated;
grant execute on function public.harmonious_check_premise() to service_role;
create constraint trigger harmonious_premise_complete after insert or update on public.harmonious_records deferrable initially deferred for each row execute function public.harmonious_check_premise();
