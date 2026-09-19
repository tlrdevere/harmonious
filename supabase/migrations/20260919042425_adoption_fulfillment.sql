-- Recipient-controlled adoption uses existing service-only records/RPCs.
-- No saved row is rewritten and no public table privileges are added.
create function public.harmonious_node_wording(source_map jsonb,source_node jsonb) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare cursor_node jsonb:=source_node; count_steps integer:=0;
begin
 while cursor_node->>'parent' is not null loop
  select value into cursor_node from jsonb_array_elements(source_map->'nodes') where value->>'id'=cursor_node->>'parent';
  count_steps:=count_steps+1;
  if cursor_node is null or count_steps>2000 then raise exception using errcode='PT400',message='Invalid node ancestry'; end if;
 end loop;
 return jsonb_build_object('kind',source_node->>'kind','title',source_node->>'title','summary',source_node->>'summary','details',source_node->>'details','timeScope',coalesce(source_node->>'timeScope','present'),'sourceTitle',coalesce(source_node->>'sourceTitle',''),'sourceUrl',coalesce(source_node->>'sourceUrl',''),'frame',cursor_node->>'id');
end;
$$;
revoke all on function public.harmonious_node_wording(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.harmonious_node_wording(jsonb,jsonb) to service_role;

create function public.harmonious_adoption_identity() returns trigger
language plpgsql security invoker set search_path='' as $$
declare previous jsonb; source_map jsonb; thread jsonb;
begin
 if new.kind='definition' then
  if tg_op='UPDATE' and new.content->'copiedFrom' is distinct from old.content->'copiedFrom' then raise exception using errcode='PT409',message='Definition attribution cannot change'; end if;
 elsif new.kind='discussion' then
  if tg_op='UPDATE' then previous:=old.content;
  else select content into previous from public.harmonious_records where kind='discussion' and id=new.id; end if;
  if previous is null and new.content->>'kind'='adoption' then
   select content into source_map from public.harmonious_records where kind='map' and id=new.content->'target'->>'mapId';
   select content into thread from public.harmonious_records where kind='comparison_thread' and id=new.content->>'comparisonId';
   if coalesce(jsonb_array_length(thread->'participants'),0)<2 or not exists(select 1 from jsonb_array_elements(source_map->'nodes') n where n->>'id'=new.content->'target'->>'nodeId' and n->>'parent' is not null) then raise exception using errcode='PT403',message='Suggest one ordinary node to another map owner'; end if;
  end if;
  if previous->>'action' in ('adoption_added','adoption_existing') and new.content is distinct from previous then raise exception using errcode='PT409',message='Adoption receipts cannot be edited or withdrawn'; end if;
  if new.content ? 'adoption' and (new.content->>'kind' is distinct from 'reply' or coalesce(new.content->>'action','') not in ('adoption_added','adoption_existing')) then raise exception using errcode='PT400',message='Only adoption receipts carry fulfillment details'; end if;
 end if;
 return new;
end;
$$;
revoke all on function public.harmonious_adoption_identity() from public,anon,authenticated;
grant execute on function public.harmonious_adoption_identity() to service_role;
create trigger harmonious_adoption_identity before insert or update on public.harmonious_records for each row execute function public.harmonious_adoption_identity();

create function public.harmonious_check_adoption() returns trigger
language plpgsql security invoker set search_path='' as $$
declare
 record jsonb:=new.content; suggestion jsonb; thread jsonb; source_map jsonb; destination_map jsonb; source_node jsonb; destination_node jsonb;
 receipt jsonb; provenance jsonb; context_values jsonb; reference_values jsonb; expected_source jsonb; context_record jsonb; counterpart jsonb;
 item jsonb; definition jsonb; definition_version jsonb; expected_refs jsonb:='[]'::jsonb; actor text:=new.owner_id::text; destination_id text; receipt_id text;
begin
 if new.kind='map' and tg_op='UPDATE' and new.content is distinct from old.content then
  -- Deferred checks can inspect the final receipt after its map row was saved.
  for receipt in select content from public.harmonious_records where kind='discussion' and content->>'action' in ('adoption_added','adoption_existing') and content->'adoption'->'destination'->>'mapId'=new.id and xmin=(pg_current_xact_id()::text)::xid loop
   if receipt->>'action'='adoption_existing' then raise exception using errcode='PT409',message='Using an existing node cannot alter its map'; end if;
   if exists(select 1 from jsonb_array_elements(old.content->'nodes') n where n->>'id'=receipt->'adoption'->'destination'->>'nodeId') then raise exception using errcode='PT409',message='An adopted copy must be a new node'; end if;
  end loop;
  return new;
 end if;
 if new.kind='definition' and record ? 'copiedFrom' then
  if tg_op='UPDATE' then return new; end if;
  if not exists(select 1 from public.harmonious_records r cross join lateral jsonb_array_elements(coalesce(r.content->'adoption'->'importedDefinitions','[]'::jsonb)) i where r.kind='discussion' and r.owner_id=new.owner_id and r.content->>'action'='adoption_added' and i->>'definitionId'=new.id and i->'source'=record->'copiedFrom') then raise exception using errcode='PT403',message='Import definitions through an adoption receipt'; end if;
  return new;
 end if;
 if new.kind<>'discussion' or coalesce(record->>'action','') not in ('adoption_added','adoption_existing','adoption_not_now') then return new; end if;
 -- Existing receipts are historical; later edits to their source never rewrite
 -- or invalidate the fact that the recipient previously created a copy.
 if tg_op='UPDATE' and record=old.content then return new; end if;
 if tg_op='UPDATE' and record->>'action'='adoption_not_now' and old.content->>'status'='active' and record->>'status'='withdrawn' and (record-array['status','version','history','updatedAt'])=(old.content-array['status','version','history','updatedAt']) and (record->>'version')::bigint=(old.content->>'version')::bigint+1 and record->'history'=old.content->'history'||jsonb_build_array(old.content-'history') then return new; end if;
 select content into suggestion from public.harmonious_records where kind='discussion' and id=record->'target'->>'entryId';
 select content into thread from public.harmonious_records where kind='comparison_thread' and id=record->>'comparisonId';
 if record->>'kind' is distinct from 'reply' or record->>'layer' is distinct from 'inquiries' or suggestion->>'kind' is distinct from 'adoption' or suggestion->>'comparisonId' is distinct from record->>'comparisonId' or suggestion->>'status' is distinct from 'active' or not coalesce(thread->'participants' @> jsonb_build_array(actor),false) then raise exception using errcode='PT403',message='Choose an active adoption suggestion in this comparison'; end if;
 select content into source_map from public.harmonious_records where kind='map' and id=suggestion->'target'->>'mapId';
 destination_id:=case when source_map->>'id'=thread->>'aMapId' then thread->>'bMapId' when source_map->>'id'=thread->>'bMapId' then thread->>'aMapId' end;
 select content into destination_map from public.harmonious_records where kind='map' and id=destination_id;
 if destination_map->>'ownerId' is distinct from actor or source_map->>'ownerId'=actor or source_map->>'ownerId' is distinct from suggestion->>'authorId' or source_map->>'visibility' is distinct from 'shared' then raise exception using errcode='PT403',message='Only the other map owner can fulfill adoption'; end if;
 select value into source_node from jsonb_array_elements(source_map->'nodes') where value->>'id'=suggestion->'target'->>'nodeId' and value->>'parent' is not null;
 if source_node is null then raise exception using errcode='PT409',message='Adoption source unavailable'; end if;
 if exists(select 1 from public.harmonious_records where kind='discussion' and id<>new.id and owner_id=new.owner_id and content->>'action' in ('adoption_added','adoption_existing') and content->'target'->>'entryId'=suggestion->>'id') then raise exception using errcode='PT409',message='This suggestion was already fulfilled'; end if;
 if record->>'action'='adoption_not_now' then return new; end if;
 receipt_id:='adoption-result-'||encode(sha256(convert_to((suggestion->>'id')||chr(10)||actor,'UTF8')),'hex');
 provenance:=record->'adoption';
 if new.id<>receipt_id or record->>'status' is distinct from 'active' or record->'version' is distinct from '1'::jsonb or record->'history' is distinct from '[]'::jsonb or provenance->>'mode' is distinct from (case record->>'action' when 'adoption_added' then 'copy' else 'existing' end) or provenance->'destination'->>'mapId' is distinct from destination_id then raise exception using errcode='PT400',message='Invalid immutable adoption receipt'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',content->>'id','version',content->'version','authorId',content->>'authorId','body',content->>'body','definitionRefs',coalesce(content->'definitionRefs','[]'::jsonb)) order by id collate "C"),'[]'::jsonb) into context_values from public.harmonious_records where kind='discussion' and content->>'kind'='context' and content->>'status'='active' and content->>'authorId'=source_map->>'ownerId' and content->'target'=suggestion->'target';
 select coalesce(jsonb_agg(ref order by (ref->>'authorId') collate "C",(ref->>'definitionId') collate "C",(ref->>'version') collate "C"),'[]'::jsonb) into reference_values from (select distinct d.value as ref from jsonb_array_elements(context_values) c cross join lateral jsonb_array_elements(c->'definitionRefs') d) refs;
 if jsonb_array_length(context_values)>30 or jsonb_array_length(reference_values)>30 then raise exception using errcode='PT400',message='Too many adoption definitions'; end if;
 expected_source:=jsonb_build_object('mapId',source_map->>'id','nodeId',source_node->>'id','ideaId',source_node->>'ideaId','ideaVersion',source_node->'ideaVersion','mapRevision',source_map->'revision','suggestionVersion',suggestion->'version','wording',public.harmonious_node_wording(source_map,source_node),'contexts',context_values,'definitions',reference_values);
 if provenance->'source' is distinct from expected_source or provenance->'suggestionVersion' is distinct from suggestion->'version' then raise exception using errcode='PT409',message='The adoption source changed; review it before saving'; end if;
 select value into destination_node from jsonb_array_elements(destination_map->'nodes') where value->>'id'=provenance->'destination'->>'nodeId' and value->>'parent' is not null;
 if destination_node is null or provenance->'destination'->'wording' is distinct from public.harmonious_node_wording(destination_map,destination_node) or provenance->'destination'->>'parentId' is distinct from destination_node->>'parent' then raise exception using errcode='PT409',message='Adoption destination changed or unavailable'; end if;
 if jsonb_typeof(provenance->'importedDefinitions') is distinct from 'array' or jsonb_array_length(provenance->'importedDefinitions')>30 then raise exception using errcode='PT400',message='Invalid imported definitions'; end if;
 if record->>'action'='adoption_existing' and (provenance->'importedDefinitions'<>'[]'::jsonb or provenance->'contextId'<>'null'::jsonb) then raise exception using errcode='PT400',message='An existing node keeps its definitions'; end if;
 if record->>'action'='adoption_added' then
  if jsonb_array_length(destination_map->'nodes')>2000 then raise exception using errcode='PT400',message='Adoption exceeds the map node limit'; end if;
  if destination_node->'copiedFrom' is distinct from jsonb_build_object('ideaId',source_node->>'ideaId','version',source_node->'ideaVersion','mapId',source_map->>'id','nodeId',source_node->>'id') or not exists(select 1 from public.harmonious_records where kind='idea' and id=destination_node->>'ideaId' and owner_id=new.owner_id and revision=1 and xmin=(pg_current_xact_id()::text)::xid and content->>'originMapId'=destination_id and content->>'originNodeId'=destination_node->>'id') then raise exception using errcode='PT403',message='An adopted copy needs a new independent idea and exact attribution'; end if;
 end if;
 for item in select value from jsonb_array_elements(provenance->'importedDefinitions') loop
  if not reference_values @> jsonb_build_array(item->'source') then raise exception using errcode='PT403',message='Only invoked source definitions may be imported'; end if;
  select content into definition from public.harmonious_records where kind='definition' and id=item->>'definitionId' and owner_id=new.owner_id;
  select value into definition_version from jsonb_array_elements(coalesce(definition->'versions','[]'::jsonb)) where value->'version'=item->'version';
  if definition->>'type' is distinct from item->'source'->>'type' or definition->'copiedFrom' is distinct from item->'source' or definition_version->>'title' is distinct from item->'source'->>'title' or definition_version->>'body' is distinct from item->'source'->>'body' then raise exception using errcode='PT403',message='Imported definition wording or attribution changed'; end if;
  expected_refs:=expected_refs||jsonb_build_array(jsonb_build_object('definitionId',definition->>'id','authorId',actor,'type',definition->>'type','version',definition_version->'version','title',definition_version->>'title','body',definition_version->>'body'));
 end loop;
 if jsonb_array_length(expected_refs)<> (select count(distinct value->>'definitionId') from jsonb_array_elements(expected_refs)) then raise exception using errcode='PT400',message='Duplicate imported definition'; end if;
 if jsonb_array_length(expected_refs)>0 then
  select content into context_record from public.harmonious_records where kind='discussion' and id=provenance->>'contextId' and owner_id=new.owner_id;
  if context_record->>'kind' is distinct from 'context' or context_record->>'status' is distinct from 'active' or context_record->'target' is distinct from jsonb_build_object('type','node','mapId',destination_id,'nodeId',destination_node->>'id') or context_record->'definitionRefs' is distinct from expected_refs then raise exception using errcode='PT403',message='Invoke copied definitions on the new node'; end if;
 elsif provenance->'contextId' is distinct from 'null'::jsonb then raise exception using errcode='PT400',message='Unexpected adoption context'; end if;
 if provenance->'counterpartId' is distinct from 'null'::jsonb then
  select content into counterpart from public.harmonious_records where kind='discussion' and id=provenance->>'counterpartId';
  if counterpart->>'comparisonId' is distinct from record->>'comparisonId' or coalesce(counterpart->>'kind','') not in ('correspondence','relationship') or counterpart->>'status' is distinct from 'active' or not(jsonb_build_array(counterpart->'target',counterpart->'other') @> jsonb_build_array(suggestion->'target',jsonb_build_object('type','node','mapId',destination_id,'nodeId',destination_node->>'id'))) then raise exception using errcode='PT403',message='Counterpart link must refer to the adopted pair'; end if;
 end if;
 return new;
end;
$$;
revoke all on function public.harmonious_check_adoption() from public,anon,authenticated;
grant execute on function public.harmonious_check_adoption() to service_role;
create constraint trigger harmonious_adoption_complete after insert or update on public.harmonious_records deferrable initially deferred for each row execute function public.harmonious_check_adoption();
