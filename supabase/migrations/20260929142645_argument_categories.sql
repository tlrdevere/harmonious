-- Add a versioned four-category dispute catalog; retain all v4 records/revisions.
-- The Worker gates obsolete clients; this additive migration can precede it safely.
create function public.harmonious_argument_options(c jsonb, action_name text, grammar_version jsonb) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
begin
 if grammar_version='4'::jsonb then return public.harmonious_interaction_options(c,action_name); end if;
 if grammar_version='5'::jsonb and action_name='dispute' and
   ((c->>'targetType'='node' and c->>'frame' in ('status','action','goal')) or
    (c->>'targetType' in ('edge','inference') and c->>'edgeType' in ('reason','cause','addresses','enables')))
 then return $catalog$[{"id":"factual_basis","label":"Factual basis","helper":"Is the claim accurate and supported by evidence?","group":"What do you dispute?"},{"id":"reasoning","label":"Reasoning","helper":"Does the conclusion follow from the reasons and assumptions?","group":"What do you dispute?"},{"id":"consequences","label":"Consequences","helper":"What results or side effects would follow?","group":"What do you dispute?"},{"id":"feasibility","label":"Feasibility","helper":"Can the proposed action or goal realistically be achieved?","group":"What do you dispute?"}]$catalog$::jsonb; end if;
 return '[]'::jsonb;
end;
$$;
create or replace function public.harmonious_check_interaction() returns trigger
language plpgsql security invoker set search_path='' as $$
declare r jsonb:=new.content; previous jsonb; metadata jsonb; c jsonb; current_classification jsonb; allowed jsonb; selected jsonb; expected_selected jsonb; expected_signals jsonb; version_record jsonb; thread jsonb; parent jsonb; source_map jsonb; source_node jsonb; recipient text; expected_mode text; ordinal bigint; preserved jsonb; target_ref jsonb; fresh_snapshot jsonb; field text; withdrawal boolean;
begin
 if new.kind<>'discussion' then return new; end if;
 if r->>'kind' is distinct from 'interaction' then
  if r ? 'interaction' or exists(select 1 from jsonb_array_elements(coalesce(r->'history','[]'::jsonb)) v where v ? 'interaction') then raise exception using errcode='PT400',message='Interaction metadata belongs only to an interaction'; end if;
  return new;
 end if;
 if jsonb_typeof(r->'history') is distinct from 'array' or jsonb_typeof(r->'version') is distinct from 'number' or (r->>'version')::numeric<>jsonb_array_length(r->'history')+1 then raise exception using errcode='PT400',message='Invalid interaction history'; end if;
 select content into previous from public.harmonious_records where kind='discussion' and id=new.id;
 if previous is null then
  if r->'version'<>'1'::jsonb then raise exception using errcode='PT400',message='New interaction cannot invent history'; end if;
 else
  select coalesce(jsonb_agg(value order by ord),'[]'::jsonb) into preserved from jsonb_array_elements(r->'history') with ordinality v(value,ord) where ord<=(previous->>'version')::bigint;
  if previous->>'kind' is distinct from 'interaction' or previous->>'action' is distinct from r->>'action' or (r->>'version')::numeric<=(previous->>'version')::numeric or preserved is distinct from previous->'history'||jsonb_build_array(previous-'history') or r->'sourceSnapshots' is distinct from previous->'sourceSnapshots' then raise exception using errcode='PT409',message='Earlier interaction history must be preserved'; end if;
 end if;
 for version_record,ordinal in select value,ord from jsonb_array_elements(r->'history'||jsonb_build_array(r)) with ordinality v(value,ord) loop
  if version_record->'version' is distinct from to_jsonb(ordinal) or version_record->>'kind' is distinct from 'interaction' or version_record->>'authorId' is distinct from new.owner_id::text or version_record->'other' is distinct from 'null'::jsonb or version_record ?| array['premise','adoption','reflection','definitionRefs','referenceUrl'] or jsonb_typeof(version_record->'body') is distinct from 'string' or length(version_record->>'body')>10000 or coalesce(version_record->>'status','') not in ('active','withdrawn') then raise exception using errcode='PT400',message='Invalid interaction record'; end if;
  foreach field in array array['id','authorId','comparisonId','kind','target','other','createdAt','layer','action'] loop
   if version_record->field is distinct from r->field then raise exception using errcode='PT409',message='Interaction history preserves identity'; end if;
  end loop;
  metadata:=version_record->'interaction';c:=metadata->'classification';selected:=metadata->'options';
  if jsonb_typeof(metadata) is distinct from 'object' or (select count(*) from jsonb_object_keys(metadata))<>8 or (metadata->'version' is distinct from '4'::jsonb and (metadata->'version' is distinct from '5'::jsonb or r->>'action' is distinct from 'dispute')) or coalesce(metadata->>'mode','') not in ('compare','inquiry','argument') or jsonb_typeof(c) is distinct from 'object' or (select count(*) from jsonb_object_keys(c))<>5 or c->>'targetType' is distinct from r->'target'->>'type' or jsonb_typeof(c->'hasSource') is distinct from 'boolean' or jsonb_typeof(selected) is distinct from 'array' then raise exception using errcode='PT400',message='Invalid interaction metadata'; end if;
  if metadata->>'mode' is distinct from r->'interaction'->>'mode' or metadata->>'recipientId' is distinct from r->'interaction'->>'recipientId' or metadata->>'recipientId' is not distinct from new.owner_id::text or metadata->>'recipientId' is null then raise exception using errcode='PT403',message='Interaction recipient and mode cannot change'; end if;
  expected_mode:=case when r->>'action' in ('endorse','disagree','decline') then 'compare' when r->>'action' in ('request_reason','request_explanation','propose_alternative','offer_reason') then 'inquiry' when r->>'action'='dispute' then 'argument' when r->>'action'='respond' then metadata->>'mode' else null end;
  if expected_mode is null or metadata->>'mode'<>expected_mode then raise exception using errcode='PT400',message='Choose an interaction for this mode'; end if;
  allowed:=public.harmonious_argument_options(c,r->>'action',metadata->'version');
  select coalesce(jsonb_agg(value->'id' order by ord),'[]'::jsonb) into expected_selected from jsonb_array_elements(allowed) with ordinality v(value,ord) where selected @> jsonb_build_array(value->>'id');
  select coalesce(jsonb_agg(jsonb_build_object('optionId',value->>'id','tag',value->>'signal') order by ord),'[]'::jsonb) into expected_signals from jsonb_array_elements(allowed) with ordinality v(value,ord) where selected @> jsonb_build_array(value->>'id') and value ? 'signal';
  if selected is distinct from expected_selected or metadata->'signals' is distinct from expected_signals then raise exception using errcode='PT400',message='Interaction options and signals must match the source'; end if;
  if (r->>'action'='respond' and jsonb_array_length(selected)<>1) or (r->>'action'='dispute' and jsonb_array_length(selected)=0) then raise exception using errcode='PT400',message='Choose a response outcome or dispute option'; end if;
  if jsonb_typeof(metadata->'otherText') is distinct from 'string' or length(metadata->>'otherText')>10000 or (not (selected @> '["other"]'::jsonb) and metadata->>'otherText'<>'') then raise exception using errcode='PT400',message='Invalid Other text'; end if;
 end loop;
 withdrawal:=coalesce(previous->>'status'='active' and r->>'status'='withdrawn' and (r-array['status','version','updatedAt','history'])=(previous-array['status','version','updatedAt','history']) and (r->>'version')::bigint=(previous->>'version')::bigint+1,false);
 if withdrawal then return new; end if;
 if r->>'action'='dispute' and r->'interaction'->'version'='4'::jsonb and exists(select 1 from jsonb_array_elements(r->'history') v where v->'interaction'->'version'='5'::jsonb) then raise exception using errcode='PT409',message='Refresh Harmonious and choose the current dispute categories'; end if;
 metadata:=r->'interaction';target_ref:=r->'target';
 current_classification:=public.harmonious_interaction_classification(target_ref);
 if metadata->'classification' is distinct from current_classification or current_classification is null then raise exception using errcode='PT409',message='Interaction source classification changed'; end if;
 select content into thread from public.harmonious_records where kind='comparison_thread' and id=r->>'comparisonId';
 if target_ref->>'type' in ('entry','inference') then
  select content into parent from public.harmonious_records where kind='discussion' and id=target_ref->>'entryId';recipient:=parent->>'authorId';
  if r->>'action'='respond' then
   if target_ref->>'type'<>'entry' or parent->>'kind' is distinct from 'interaction' or parent->>'action' not in ('request_reason','request_explanation','propose_alternative','offer_reason','dispute') or parent->'interaction'->>'recipientId' is distinct from new.owner_id::text or parent->'interaction'->>'mode' is distinct from metadata->>'mode' then raise exception using errcode='PT403',message='Only the intended recipient can respond in the original mode'; end if;
  elsif parent->>'kind' is distinct from 'argument' or parent->>'action' is distinct from 'reason' then raise exception using errcode='PT403',message='Choose a source node or connection'; end if;
 else
  select content into source_map from public.harmonious_records where kind='map' and id=target_ref->>'mapId';recipient:=source_map->>'ownerId';
  if r->>'action'='respond' then raise exception using errcode='PT400',message='Respond to an interaction'; end if;
  if target_ref->>'type'='node' and not exists(select 1 from jsonb_array_elements(source_map->'nodes') n where n->>'id'=target_ref->>'nodeId' and n->>'parent' is not null) then raise exception using errcode='PT400',message='Choose an ordinary node'; end if;
 end if;
 if recipient is null or recipient=new.owner_id::text or metadata->>'recipientId' is distinct from recipient then raise exception using errcode='PT403',message='Select the other person source or response'; end if;
 if metadata->'reference' is distinct from public.harmonious_interaction_reference(metadata->'reference'->'target',thread) then raise exception using errcode='PT409',message='Referenced node snapshot changed'; end if;
 fresh_snapshot:=jsonb_build_array(public.harmonious_interaction_snapshot(target_ref));
 if previous is null and (r->'sourceSnapshots' is distinct from fresh_snapshot or fresh_snapshot @> '[null]'::jsonb) then raise exception using errcode='PT409',message='Interaction source wording changed'; end if;
 if r ? 'reviewedSources' and (previous is null or r->'reviewedSources' is distinct from previous->'reviewedSources') and r->'reviewedSources' is distinct from fresh_snapshot then raise exception using errcode='PT409',message='Review current source wording'; end if;
 return new;
end;
$$;

revoke all on function public.harmonious_argument_options(jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.harmonious_argument_options(jsonb,text,jsonb) to service_role;
