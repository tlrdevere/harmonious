-- Grammar v4 adds authored interaction records within existing discussions.
-- No map mutation, existing data rewrite, grant expansion, or RLS changes.
-- Connection wording participates in source review. Empty legacy wording keeps
-- the original snapshot shape, so unchanged earlier sources do not go stale.
alter function public.harmonious_reflection_snapshot(jsonb) rename to harmonious_reflection_snapshot_base;
create function public.harmonious_reflection_snapshot(target_ref jsonb) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb; connection_note text;
begin
 result:=public.harmonious_reflection_snapshot_base(target_ref);
 if target_ref->>'type'='edge' and result is not null then
  select edge->>'note' into connection_note from public.harmonious_records source_map cross join lateral jsonb_array_elements(source_map.content->'relations') edge where source_map.kind='map' and source_map.id=target_ref->>'mapId' and edge->>'id'=target_ref->>'edgeId';
  if length(coalesce(connection_note,''))>0 then result:=jsonb_set(result,'{wording,note}',to_jsonb(connection_note)); end if;
 end if;
 return result;
end;
$$;
revoke all on function public.harmonious_reflection_snapshot(jsonb) from public,anon,authenticated;
grant execute on function public.harmonious_reflection_snapshot(jsonb) to service_role;
create function public.harmonious_interaction_options(c jsonb, action_name text) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare catalog jsonb:=$catalog${"disputes":{"status":[{"id":"false","label":"It's false","helper":"","group":"About the claim","signal":"Factual"},{"id":"overstated","label":"It's overstated","helper":"True only in some cases (hasty generalization)","group":"About the claim","signal":"Factual"},{"id":"omission","label":"It leaves out something important","helper":"True but misleading by omission","group":"About the claim","signal":"Factual"},{"id":"value_as_fact","label":"It's a value judgment presented as fact","helper":"","group":"About the claim","signal":"Values"},{"id":"conflicting_claim","label":"It conflicts with another claim","helper":"Point to the other claim on any map you both can access","group":"About the claim","signal":"Logical"},{"id":"double_standard","label":"It uses a standard not applied elsewhere","helper":"Double standard","group":"About the claim","signal":"Logical"}],"goal":[{"id":"conflicting_goal","label":"It conflicts with another goal","helper":"","group":"About the claim","signal":"Logical"},{"id":"unachievable","label":"It isn't achievable","helper":"","group":"About the claim","signal":"Factual"},{"id":"different_value","label":"It serves a value I weigh differently","helper":"","group":"About the claim","signal":"Values"},{"id":"double_standard","label":"It uses a standard not applied elsewhere","helper":"Double standard","group":"About the claim","signal":"Logical"}],"action":[{"id":"side_effects","label":"It has harmful side effects","helper":"","group":"About the claim","signal":"Factual"},{"id":"better_alternative","label":"There's a better alternative","helper":"False dilemma, if only two options were considered","group":"About the claim","signal":"Mixed"},{"id":"infeasible","label":"It isn't practically or politically feasible","helper":"","group":"About the claim","signal":"Factual"},{"id":"cost","label":"It costs more than it's worth","helper":"","group":"About the claim","signal":"Mixed"},{"id":"conflicts_goal","label":"It conflicts with a goal","helper":"","group":"About the claim","signal":"Logical"}],"source":[{"id":"data_inaccurate","label":"The data is inaccurate or misreported","helper":"","group":"About the source","signal":"Factual"},{"id":"data_outdated","label":"The data is outdated","helper":"","group":"About the source","signal":"Factual"},{"id":"unrepresentative","label":"It's unrepresentative or cherry-picked","helper":"Including a single anecdote","group":"About the source","signal":"Factual"},{"id":"source_expertise","label":"The source isn't credible or lacks relevant expertise","helper":"Appeal to authority","group":"About the source","signal":"Factual"},{"id":"source_conflict","label":"The source has a conflict of interest","helper":"","group":"About the source","signal":"Factual"},{"id":"sources_disagree","label":"Other sources disagree","helper":"","group":"About the source","signal":"Factual"}],"reason":[{"id":"irrelevant","label":"Not relevant","helper":"Including attacking the person rather than the claim (ad hominem)","group":"About the claim","signal":"Logical"},{"id":"insufficient","label":"Not enough on its own","helper":"Hasty generalization","group":"About the claim","signal":"Logical"},{"id":"hidden_assumption","label":"Relies on a hidden assumption","helper":"State the assumption","group":"About the claim","signal":"Logical"},{"id":"false_analogy","label":"The cases differ in an important way","helper":"False analogy (e.g., 'it worked in another city')","group":"About the claim","signal":"Logical"},{"id":"circular","label":"The reason assumes the conclusion","helper":"Circular reasoning","group":"About the claim","signal":"Logical"},{"id":"equivocation","label":"A key term shifts meaning","helper":"Equivocation","group":"About the claim","signal":"Logical"},{"id":"exception","label":"There's an exception","helper":"Usually true, but not in this case","group":"About the claim","signal":"Logical"}],"cause":[{"id":"correlation","label":"It's correlation, not cause","helper":"False cause","group":"About the claim","signal":"Factual"},{"id":"third_factor","label":"Something else explains it","helper":"A third factor drives both","group":"About the claim","signal":"Factual"},{"id":"mechanism","label":"The mechanism doesn't work","helper":"","group":"About the claim","signal":"Factual"},{"id":"exception","label":"There's an exception","helper":"","group":"About the claim","signal":"Factual"}],"addresses":[{"id":"ineffective","label":"It won't address the problem","helper":"","group":"About the claim","signal":"Factual"},{"id":"symptom","label":"It treats a symptom, not the cause","helper":"","group":"About the claim","signal":"Factual"},{"id":"unstated_conditions","label":"It only works under conditions not stated","helper":"","group":"About the claim","signal":"Factual"}],"enables":[{"id":"ineffective","label":"It won't achieve the goal","helper":"","group":"About the claim","signal":"Factual"},{"id":"symptom","label":"It treats a symptom, not the cause","helper":"","group":"About the claim","signal":"Factual"},{"id":"unstated_conditions","label":"It only works under conditions not stated","helper":"","group":"About the claim","signal":"Factual"}]},"choices":{"endorse":[{"id":"already_hold","label":"I already hold this","helper":"","group":"Choices"},{"id":"own_reason","label":"For my own reason","helper":"","group":"Choices"}],"decline":[{"id":"dont_know","label":"I don't know","helper":"","group":"Choices"},{"id":"need_information","label":"I need more information","helper":"","group":"Choices"},{"id":"not_considered","label":"I haven't considered this","helper":"","group":"Choices"}],"request_reason":[{"id":"reason","label":"A reason","helper":"","group":"Choices"},{"id":"source","label":"Evidence or a source","helper":"","group":"Choices"}],"request_explanation":[{"id":"term","label":"A word or term","helper":"","group":"Choices"},{"id":"scope","label":"How broadly it applies","helper":"","group":"Choices"}],"propose_alternative":[{"id":"narrower","label":"Narrower","helper":"","group":"Choices"},{"id":"clearer","label":"Clearer wording","helper":"","group":"Choices"},{"id":"neutral","label":"More neutral wording","helper":"","group":"Choices"}],"propose_edge":[{"id":"condition","label":"Only under a condition","helper":"","group":"Choices"},{"id":"weaker","label":"A weaker connection","helper":"","group":"Choices"}],"respond_request":[{"id":"answer","label":"Answer","helper":"","group":"Choices"},{"id":"dont_know","label":"I don't know","helper":"","group":"Choices"}],"respond_dispute":[{"id":"accept","label":"Accept","helper":"","group":"Choices"},{"id":"partly_accept","label":"Partly accept","helper":"","group":"Choices"},{"id":"reject","label":"Reject","helper":"","group":"Choices"},{"id":"misrepresented","label":"You've misrepresented my claim","helper":"","group":"Choices"}],"respond_proposal":[{"id":"accept","label":"Accept","helper":"","group":"Choices"},{"id":"reject","label":"Reject","helper":"","group":"Choices"}]},"actions":{"compare":[["endorse","Endorse"],["disagree","Disagree"],["decline","No position"]],"inquiry":[["request_reason","Request reason"],["request_explanation","Request explanation"],["propose_alternative","Propose alternative"],["offer_reason","Offer reason"]],"argument":[["dispute","Dispute reasoning"]]}}$catalog$::jsonb; rows jsonb:='[]'::jsonb; choice_key text; is_node boolean:=c->>'targetType'='node';
begin
 if action_name='dispute' then
  if is_node then
   rows:=coalesce(catalog->'disputes'->(c->>'frame'),'[]'::jsonb);
   if c->'hasSource'='true'::jsonb then rows:=rows||(catalog->'disputes'->'source'); end if;
  elsif c->>'targetType' in ('edge','inference') then rows:=coalesce(catalog->'disputes'->(c->>'edgeType'),'[]'::jsonb); end if;
  if jsonb_array_length(rows)=0 then return rows; end if;
 elsif action_name='respond' then
  choice_key:=case when c->>'parentAction' in ('request_reason','request_explanation') then 'respond_request' when c->>'parentAction' in ('propose_alternative','offer_reason') then 'respond_proposal' when c->>'parentAction'='dispute' then 'respond_dispute' else null end;
  if choice_key is null then return rows; end if;
  rows:=catalog->'choices'->choice_key;
 elsif action_name='endorse' then if is_node then rows:=catalog->'choices'->'endorse'; end if;
 elsif action_name='request_explanation' then if is_node then rows:=catalog->'choices'->'request_explanation'; end if;
 elsif action_name='propose_alternative' then rows:=catalog->'choices'->(case when is_node then 'propose_alternative' else 'propose_edge' end);
 else rows:=coalesce(catalog->'choices'->action_name,'[]'::jsonb); end if;
 if jsonb_array_length(rows)>0 or action_name='endorse' then rows:=rows||'[{"id":"other","label":"Other"}]'::jsonb; end if;
 return rows;
end;
$$;

create function public.harmonious_interaction_classification(target_ref jsonb) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare source_map jsonb; item jsonb; frame_name text; edge_type text; parent jsonb;
begin
 if target_ref->>'type' in ('entry','inference') then
  select content into parent from public.harmonious_records where kind='discussion' and id=target_ref->>'entryId';
  if parent is null then return null; end if;
  return jsonb_build_object('targetType',target_ref->>'type','frame',null,'edgeType',case when target_ref->>'type'='inference' then 'reason' else null end,'hasSource',false,'parentAction',parent->>'action');
 end if;
 select content into source_map from public.harmonious_records where kind='map' and id=target_ref->>'mapId';
 if source_map is null then return null; end if;
 if target_ref->>'type'='node' then
  select value into item from jsonb_array_elements(source_map->'nodes') where value->>'id'=target_ref->>'nodeId';
  if item is null then return null; end if;
  frame_name:=public.harmonious_node_wording(source_map,item)->>'frame';
 elsif target_ref->>'type'='edge' then
  select value into item from jsonb_array_elements(source_map->'relations') where value->>'id'=target_ref->>'edgeId';
  if item is null then select jsonb_build_object('type',value->>'structuralType') into item from jsonb_array_elements(source_map->'nodes') where 'structure:'||(value->>'id')=target_ref->>'edgeId' and value->>'parent' is not null; end if;
  if item is null then return null; end if;
  edge_type:=case item->>'type' when 'causal' then 'cause' when 'motivates' then 'addresses' when 'aims_for' then 'enables' else item->>'type' end;
 else return null; end if;
 return jsonb_build_object('targetType',target_ref->>'type','frame',frame_name,'edgeType',edge_type,'hasSource',target_ref->>'type'='node' and (length(btrim(coalesce(item->>'sourceTitle','')))>0 or length(btrim(coalesce(item->>'sourceUrl','')))>0),'parentAction',null);
end;
$$;

create function public.harmonious_interaction_reference(target_ref jsonb, thread jsonb) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare source_map jsonb; item jsonb; wording jsonb;
begin
 if target_ref is null or target_ref='null'::jsonb then return 'null'::jsonb; end if;
 if target_ref->>'type' is distinct from 'node' or (select count(*) from jsonb_object_keys(target_ref))<>3 then raise exception using errcode='PT400',message='Point to one node'; end if;
 select content into source_map from public.harmonious_records where kind='map' and id=target_ref->>'mapId';
 if source_map is null or exists(select 1 from jsonb_array_elements_text(thread->'participants') participant where source_map->>'ownerId'<>participant and source_map->>'visibility' is distinct from 'shared') then raise exception using errcode='PT403',message='Reference must be on a map both participants can access'; end if;
 select value into item from jsonb_array_elements(source_map->'nodes') where value->>'id'=target_ref->>'nodeId' and value->>'parent' is not null;
 if item is null then raise exception using errcode='PT409',message='Referenced node unavailable'; end if;
 select jsonb_object_agg(field,coalesce(item->>field,'')) into wording from unnest(array['title','summary','details','kind','sourceTitle','sourceUrl']) field;
 return jsonb_build_object('target',target_ref,'snapshot',jsonb_build_object('label',item->>'title','frame',public.harmonious_node_wording(source_map,item)->>'frame','wording',wording));
end;
$$;

create function public.harmonious_interaction_snapshot(target_ref jsonb) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare parent jsonb; label text;
begin
 if target_ref->>'type'='entry' then
  select content into parent from public.harmonious_records where kind='discussion' and id=target_ref->>'entryId';
  if parent->>'kind'='interaction' then
   label:=case parent->>'action' when 'endorse' then 'Endorse' when 'disagree' then 'Disagree' when 'decline' then 'No position' when 'request_reason' then 'Request reason' when 'request_explanation' then 'Request explanation' when 'propose_alternative' then 'Propose alternative' when 'offer_reason' then 'Offer reason' when 'dispute' then 'Dispute reasoning' when 'respond' then 'Response' end;
   return jsonb_build_object('target',target_ref,'label',label,'wording',jsonb_build_object('action',parent->>'action','body',parent->>'body','referenceUrl','','version',parent->'version','status',parent->>'status','interaction',parent->'interaction'),'definitions','[]'::jsonb);
  end if;
 end if;
 return public.harmonious_reflection_snapshot(target_ref);
end;
$$;

create function public.harmonious_check_interaction() returns trigger
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
  if jsonb_typeof(metadata) is distinct from 'object' or (select count(*) from jsonb_object_keys(metadata))<>8 or metadata->'version' is distinct from '4'::jsonb or coalesce(metadata->>'mode','') not in ('compare','inquiry','argument') or jsonb_typeof(c) is distinct from 'object' or (select count(*) from jsonb_object_keys(c))<>5 or c->>'targetType' is distinct from r->'target'->>'type' or jsonb_typeof(c->'hasSource') is distinct from 'boolean' or jsonb_typeof(selected) is distinct from 'array' then raise exception using errcode='PT400',message='Invalid interaction metadata'; end if;
  if metadata->>'mode' is distinct from r->'interaction'->>'mode' or metadata->>'recipientId' is distinct from r->'interaction'->>'recipientId' or metadata->>'recipientId' is not distinct from new.owner_id::text or metadata->>'recipientId' is null then raise exception using errcode='PT403',message='Interaction recipient and mode cannot change'; end if;
  expected_mode:=case when r->>'action' in ('endorse','disagree','decline') then 'compare' when r->>'action' in ('request_reason','request_explanation','propose_alternative','offer_reason') then 'inquiry' when r->>'action'='dispute' then 'argument' when r->>'action'='respond' then metadata->>'mode' else null end;
  if expected_mode is null or metadata->>'mode'<>expected_mode then raise exception using errcode='PT400',message='Choose an interaction for this mode'; end if;
  allowed:=public.harmonious_interaction_options(c,r->>'action');
  select coalesce(jsonb_agg(value->'id' order by ord),'[]'::jsonb) into expected_selected from jsonb_array_elements(allowed) with ordinality v(value,ord) where selected @> jsonb_build_array(value->>'id');
  select coalesce(jsonb_agg(jsonb_build_object('optionId',value->>'id','tag',value->>'signal') order by ord),'[]'::jsonb) into expected_signals from jsonb_array_elements(allowed) with ordinality v(value,ord) where selected @> jsonb_build_array(value->>'id') and value ? 'signal';
  if selected is distinct from expected_selected or metadata->'signals' is distinct from expected_signals then raise exception using errcode='PT400',message='Interaction options and signals must match the source'; end if;
  if (r->>'action'='respond' and jsonb_array_length(selected)<>1) or (r->>'action'='dispute' and jsonb_array_length(selected)=0) then raise exception using errcode='PT400',message='Choose a response outcome or dispute option'; end if;
  if jsonb_typeof(metadata->'otherText') is distinct from 'string' or length(metadata->>'otherText')>10000 or (not (selected @> '["other"]'::jsonb) and metadata->>'otherText'<>'') then raise exception using errcode='PT400',message='Invalid Other text'; end if;
 end loop;
 withdrawal:=coalesce(previous->>'status'='active' and r->>'status'='withdrawn' and (r-array['status','version','updatedAt','history'])=(previous-array['status','version','updatedAt','history']) and (r->>'version')::bigint=(previous->>'version')::bigint+1,false);
 if withdrawal then return new; end if;
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
revoke all on function public.harmonious_interaction_options(jsonb,text), public.harmonious_interaction_classification(jsonb), public.harmonious_interaction_reference(jsonb,jsonb), public.harmonious_interaction_snapshot(jsonb), public.harmonious_check_interaction() from public,anon,authenticated;
grant execute on function public.harmonious_interaction_options(jsonb,text), public.harmonious_interaction_classification(jsonb), public.harmonious_interaction_reference(jsonb,jsonb), public.harmonious_interaction_snapshot(jsonb), public.harmonious_check_interaction() to service_role;
create trigger harmonious_interaction_identity before insert or update on public.harmonious_records for each row execute function public.harmonious_check_interaction();
