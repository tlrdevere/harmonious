-- Optional, immutable presentation direction on targeted replies. No records rewritten.
create or replace function public.harmonious_check_interaction() returns trigger
language plpgsql security invoker set search_path='' as $$
declare r jsonb:=new.content; previous jsonb; metadata jsonb; c jsonb; current_classification jsonb; allowed jsonb; selected jsonb; expected_selected jsonb; expected_signals jsonb; version_record jsonb; thread jsonb; parent jsonb; source_map jsonb; source_node jsonb; recipient text; expected_mode text; ordinal bigint; preserved jsonb; target_ref jsonb; fresh_snapshot jsonb; field text; withdrawal boolean; addressed jsonb; reply_ref jsonb; seen_ids text[]; cursor_record jsonb;
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
  if jsonb_typeof(metadata) is distinct from 'object' or (select count(*) from jsonb_object_keys(metadata))<>(case when metadata->'version'='7'::jsonb then 9 else 8 end)+(case when metadata ? 'placement' then 1 else 0 end) or not coalesce((metadata->'version'='4'::jsonb or metadata->'version'='5'::jsonb and r->>'action'='dispute' or metadata->'version' in ('6'::jsonb,'7'::jsonb) and r->>'action'='respond' and metadata->>'mode'='argument'),false) or coalesce(metadata->>'mode','') not in ('compare','inquiry','argument') or jsonb_typeof(c) is distinct from 'object' or (select count(*) from jsonb_object_keys(c))<>5 or c->>'targetType' is distinct from r->'target'->>'type' or jsonb_typeof(c->'hasSource') is distinct from 'boolean' or jsonb_typeof(selected) is distinct from 'array' then raise exception using errcode='PT400',message='Invalid interaction metadata'; end if;
  if metadata ? 'placement' and not coalesce(metadata->'version'='7'::jsonb and jsonb_typeof(metadata->'placement')='string' and metadata->>'placement' in ('right','above','below'),false) then raise exception using errcode='PT400',message='Invalid reply placement'; end if;
  if metadata->'placement' is distinct from r->'interaction'->'placement' then raise exception using errcode='PT409',message='A reply keeps its original placement'; end if;
  if metadata->>'mode' is distinct from r->'interaction'->>'mode' or metadata->>'recipientId' is distinct from r->'interaction'->>'recipientId' or metadata->>'recipientId' is not distinct from new.owner_id::text or metadata->>'recipientId' is null then raise exception using errcode='PT403',message='Interaction recipient and mode cannot change'; end if;
  if (metadata->'version' in ('6'::jsonb,'7'::jsonb) or r->'interaction'->'version' in ('6'::jsonb,'7'::jsonb)) and metadata->'version' is distinct from r->'interaction'->'version' then raise exception using errcode='PT409',message='A reply keeps its original type'; end if;
  if metadata->'version' in ('6'::jsonb,'7'::jsonb) and length(regexp_replace(version_record->>'body','[[:space:]]','','g'))=0 then raise exception using errcode='PT400',message='Write a reply before sending'; end if;
  if metadata->'version'='7'::jsonb then
   reply_ref:=metadata->'replyTo';
   if jsonb_typeof(reply_ref) is distinct from 'object' or (select count(*) from jsonb_object_keys(reply_ref))<>2 or jsonb_typeof(reply_ref->'entryId') is distinct from 'string' or jsonb_typeof(reply_ref->'version') is distinct from 'number' or (reply_ref->>'version')::numeric<1 or (reply_ref->>'version')::numeric<>trunc((reply_ref->>'version')::numeric) or reply_ref->>'entryId'=r->>'id' then raise exception using errcode='PT400',message='Invalid reply target'; end if;
   if reply_ref is distinct from r->'interaction'->'replyTo' then raise exception using errcode='PT409',message='A reply keeps its original target'; end if;
   select content into addressed from public.harmonious_records where kind='discussion' and id=reply_ref->>'entryId';
   if addressed is null or addressed->>'comparisonId' is distinct from r->>'comparisonId' or not coalesce(addressed->>'id'=r->'target'->>'entryId' or addressed->>'kind'='interaction' and addressed->>'action'='respond' and addressed->'target'->>'entryId'=r->'target'->>'entryId',false) or not exists(select 1 from jsonb_array_elements(addressed->'history'||jsonb_build_array(addressed)) v where v->'version'=reply_ref->'version') then raise exception using errcode='PT400',message='Choose a contribution in this dispute'; end if;
   if previous is null and (addressed->>'status' is distinct from 'active' or addressed->'version' is distinct from reply_ref->'version') then raise exception using errcode='PT409',message='The reply target changed or was withdrawn'; end if;
   seen_ids:=array[r->>'id'];cursor_record:=addressed;
   while cursor_record->'interaction'->'version'='7'::jsonb loop
    if cursor_record->>'id'=any(seen_ids) then raise exception using errcode='PT400',message='Reply targets cannot form a cycle'; end if;
    seen_ids:=array_append(seen_ids,cursor_record->>'id');
    select content into cursor_record from public.harmonious_records where kind='discussion' and id=cursor_record->'interaction'->'replyTo'->>'entryId';
   end loop;
  end if;
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
   if metadata->'version' in ('6'::jsonb,'7'::jsonb) then
    if target_ref->>'type' is distinct from 'entry' or parent->>'kind' is distinct from 'interaction' or parent->>'action' is distinct from 'dispute' or parent->>'status' is distinct from 'active' or parent->'interaction'->>'mode' is distinct from 'argument' or parent->>'comparisonId' is distinct from r->>'comparisonId' or not (new.owner_id::text=parent->>'authorId' or new.owner_id::text=parent->'interaction'->>'recipientId') then raise exception using errcode='PT403',message='Only the two dispute participants can reply to an active dispute'; end if;
    recipient:=case when new.owner_id::text=parent->>'authorId' then parent->'interaction'->>'recipientId' else parent->>'authorId' end;
   else
   if target_ref->>'type'<>'entry' or parent->>'kind' is distinct from 'interaction' or parent->>'action' not in ('request_reason','request_explanation','propose_alternative','offer_reason','dispute') or parent->'interaction'->>'recipientId' is distinct from new.owner_id::text or parent->'interaction'->>'mode' is distinct from metadata->>'mode' then raise exception using errcode='PT403',message='Only the intended recipient can respond in the original mode'; end if;
   end if;
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


revoke all on function public.harmonious_check_interaction() from public,anon,authenticated;
grant execute on function public.harmonious_check_interaction() to service_role;
