-- Node-attached, authored standstill proposals and immutable causal receipts.
-- Existing rows, generation, RLS and table privileges remain unchanged.
create function public.harmonious_standstill_head(proposal_id text) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare nodes jsonb; heads jsonb;
begin
 select coalesce(jsonb_agg(v),'[]'::jsonb) into nodes
 from public.harmonious_records r cross join lateral jsonb_array_elements(coalesce(r.content->'history','[]'::jsonb)||jsonb_build_array(r.content-'history')) v
 where r.kind='discussion' and r.content->>'kind'='standstill' and (r.id=proposal_id or r.content->'target'->>'entryId'=proposal_id);
 select coalesce(jsonb_agg(jsonb_build_object('entryId',v->>'id','version',v->'version')),'[]'::jsonb) into heads
 from jsonb_array_elements(nodes) v where not exists(select 1 from jsonb_array_elements(nodes) successor where successor->'standstill'->'previous'=jsonb_build_object('entryId',v->>'id','version',v->'version'));
 if jsonb_array_length(heads)>1 then raise exception using errcode='PT409',message='Standstill history has competing states'; end if;
 return heads->0;
end;
$$;

-- Every external reference in the attached contribution and its immutable
-- history must still be available to both people. Follow reply and causal
-- dependencies rather than trusting only the visible source node.
create function public.harmonious_standstill_access(entry_id text, participants jsonb) returns boolean
language plpgsql stable security invoker set search_path='' as $$
declare todo text[]:=array[entry_id]; visited text[]:=array[]::text[]; current_id text; item jsonb; v jsonb; ref text; source_map jsonb;
begin
 while cardinality(todo)>0 loop
  current_id:=todo[1];todo:=todo[2:];
  if current_id=any(visited) then continue; end if;
  visited:=array_append(visited,current_id);
  select content into item from public.harmonious_records where kind='discussion' and id=current_id;
  if item is null then return false; end if;
  for v in select value from jsonb_array_elements(coalesce(item->'history','[]'::jsonb)||jsonb_build_array(item)) loop
   if v->'interaction'->'reference' is not null and v->'interaction'->'reference'<>'null'::jsonb then
    select content into source_map from public.harmonious_records where kind='map' and id=v->'interaction'->'reference'->'target'->>'mapId';
    if source_map is null or not exists(select 1 from jsonb_array_elements(source_map->'nodes') n where n->>'id'=v->'interaction'->'reference'->'target'->>'nodeId') or exists(select 1 from jsonb_array_elements_text(participants) person where source_map->>'ownerId' is distinct from person and source_map->>'visibility' is distinct from 'shared') then return false; end if;
   end if;
   for ref in select value from jsonb_array_elements_text(jsonb_build_array(v->'target'->>'entryId',v->'other'->>'entryId',v->'interaction'->'replyTo'->>'entryId',v->'standstill'->>'disputeId',v->'standstill'->'anchor'->>'entryId',v->'standstill'->'previous'->>'entryId')) where value is not null loop
    if not ref=any(visited) then todo:=array_append(todo,ref); end if;
   end loop;
  end loop;
 end loop;
 return true;
end;
$$;

create function public.harmonious_check_standstill() returns trigger
language plpgsql security invoker set search_path='' as $$
declare r jsonb:=new.content; old_record jsonb; proposal jsonb; meta jsonb; prior jsonb; thread jsonb; dispute jsonb; anchor jsonb; source_map jsonb; node jsonb; point jsonb; field text; withdrawal boolean:=false; head jsonb; actual_snapshot jsonb; version_record jsonb; ordinal bigint; trim_chars text:=U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
begin
 if new.kind<>'discussion' then return new; end if;
 if r->>'kind' is distinct from 'standstill' then
  if r ? 'standstill' or exists(select 1 from jsonb_array_elements(case when jsonb_typeof(r->'history')='array' then r->'history' else '[]'::jsonb end) v where v ? 'standstill' or v->>'kind'='standstill') then raise exception using errcode='PT400',message='Standstill metadata belongs only to a standstill'; end if;
  if exists(select 1 from public.harmonious_records where kind='discussion' and content->>'kind'='standstill' and id in (r->'target'->>'entryId',r->'other'->>'entryId')) then raise exception using errcode='PT400',message='Use the standstill actions; reply to its addressed contribution'; end if;
  return new;
 end if;
 select content into old_record from public.harmonious_records where kind='discussion' and id=new.id;
 if r->>'authorId' is distinct from new.owner_id::text or r->>'id' is distinct from new.id then raise exception using errcode='PT403',message='Invalid standstill author'; end if;
 if coalesce(r->>'action','') not in ('propose_standstill','suggest_standstill','confirm_standstill','resume_standstill') or r->>'layer' is distinct from 'arguments' or r->'other' is distinct from 'null'::jsonb or jsonb_typeof(r->'history') is distinct from 'array' or jsonb_typeof(r->'body') is distinct from 'string' or length(r->>'body')>10000 or jsonb_typeof(r->'version') is distinct from 'number' or (r->>'version')::numeric<>jsonb_array_length(r->'history')+1 or r ?| array['interaction','premise','adoption','reflection','definitionRefs','referenceUrl','unlinkedRecordIds'] then raise exception using errcode='PT400',message='Invalid standstill record'; end if;
 if r->>'action' in ('propose_standstill','suggest_standstill') then
  if length(btrim(r->>'body',trim_chars))=0 or r->>'body'<>btrim(r->>'body',trim_chars) then raise exception using errcode='PT400',message='Explain why this argument cannot move forward'; end if;
 elsif r->>'body'<>'' then raise exception using errcode='PT400',message='A standstill receipt has no explanation'; end if;
 if old_record is null then
  if r->'version'<>'1'::jsonb or r->'history'<>'[]'::jsonb or r->>'status' is distinct from 'active' then raise exception using errcode='PT400',message='New standstill cannot invent history'; end if;
 else
  if r->>'action' is distinct from 'propose_standstill' or old_record->>'action' is distinct from 'propose_standstill' or old_record->>'kind' is distinct from 'standstill' then raise exception using errcode='PT409',message='Standstill responses cannot be edited or withdrawn'; end if;
  if (r->>'version')::numeric<>(old_record->>'version')::numeric+1 or r->'history' is distinct from old_record->'history'||jsonb_build_array(old_record-'history') or r->'sourceSnapshots' is distinct from old_record->'sourceSnapshots' then raise exception using errcode='PT409',message='Earlier standstill history must be preserved'; end if;
  foreach field in array array['id','authorId','comparisonId','kind','target','other','createdAt','layer','action','targetLabel'] loop
   if r->field is distinct from old_record->field then raise exception using errcode='PT409',message='A standstill keeps its original point'; end if;
  end loop;
 end if;
 if jsonb_typeof(r->'createdAt') is distinct from 'string' or jsonb_typeof(r->'updatedAt') is distinct from 'string' or jsonb_typeof(r->'targetLabel') is distinct from 'string' or length(r->>'targetLabel')>2000 then raise exception using errcode='PT400',message='Invalid standstill attribution'; end if;
 perform (r->>'createdAt')::timestamptz,(r->>'updatedAt')::timestamptz;
 if old_record is null and r->>'createdAt' is distinct from r->>'updatedAt' then raise exception using errcode='PT400',message='New standstill receipt must preserve its creation time'; end if;
 if coalesce(r->>'status','') not in ('active','withdrawn') then raise exception using errcode='PT400',message='Invalid standstill status'; end if;
 meta:=r->'standstill';prior:=meta->'previous';
 if jsonb_typeof(meta) is distinct from 'object' or meta->'version' is distinct from '1'::jsonb then raise exception using errcode='PT400',message='Invalid standstill metadata'; end if;
 if r->>'action'='propose_standstill' then
  if (select count(*) from jsonb_object_keys(meta))<>6 or jsonb_typeof(meta->'disputeId') is distinct from 'string' or jsonb_typeof(meta->'anchor') is distinct from 'object' or (select count(*) from jsonb_object_keys(meta->'anchor'))<>2 or jsonb_typeof(meta->'anchor'->'entryId') is distinct from 'string' or jsonb_typeof(meta->'anchor'->'version') is distinct from 'number' or (meta->'anchor'->>'version')::numeric<1 or (meta->'anchor'->>'version')::numeric<>trunc((meta->'anchor'->>'version')::numeric) or jsonb_typeof(meta->'reviewedAnchorVersion') is distinct from 'number' or jsonb_typeof(meta->'reviewedDisputeVersion') is distinct from 'number' or r->'target'->>'type' is distinct from 'node' or (select count(*) from jsonb_object_keys(r->'target'))<>3 then raise exception using errcode='PT400',message='A standstill requires a source node and addressed contribution'; end if;
  proposal:=r;
  if old_record is not null and (meta->'anchor' is distinct from old_record->'standstill'->'anchor' or meta->'disputeId' is distinct from old_record->'standstill'->'disputeId') then raise exception using errcode='PT409',message='A standstill keeps its original point'; end if;
  if old_record is null then
   if prior is distinct from 'null'::jsonb then raise exception using errcode='PT409',message='A new standstill has no previous state'; end if;
  else
   withdrawal:=r->>'status'='withdrawn' and (r-array['status','version','updatedAt','history','standstill'])=(old_record-array['status','version','updatedAt','history','standstill']) and (meta-'previous')=((old_record->'standstill')-'previous');
  end if;
 else
  if (select count(*) from jsonb_object_keys(meta))<>4 or jsonb_typeof(meta->'reviewedContext') is distinct from 'object' or (select count(*) from jsonb_object_keys(meta->'reviewedContext'))<>3 or jsonb_typeof(meta->'proposalVersion') is distinct from 'number' or r->'version'<>'1'::jsonb or r->'history'<>'[]'::jsonb or r->>'status' is distinct from 'active' or r->'target'->>'type' is distinct from 'entry' or (select count(*) from jsonb_object_keys(r->'target'))<>2 then raise exception using errcode='PT400',message='Invalid immutable standstill response'; end if;
  select content into proposal from public.harmonious_records where kind='discussion' and id=r->'target'->>'entryId';
  if proposal is null or proposal->>'kind' is distinct from 'standstill' or proposal->>'action' is distinct from 'propose_standstill' or proposal->>'comparisonId' is distinct from r->>'comparisonId' then raise exception using errcode='PT400',message='Choose a standstill in this comparison'; end if;
  if meta->'proposalVersion' is distinct from proposal->'version' then raise exception using errcode='PT409',message='The standstill explanation changed; review it again'; end if;
  actual_snapshot:=jsonb_build_array(jsonb_build_object('target',r->'target','label','Propose standstill','wording',jsonb_build_object('action',proposal->>'action','body',proposal->>'body','referenceUrl','','version',proposal->'version','status',proposal->>'status','standstill',proposal->'standstill'),'definitions','[]'::jsonb));
  if r->'sourceSnapshots' is distinct from actual_snapshot or r ? 'reviewedSources' then raise exception using errcode='PT409',message='The standstill explanation snapshot changed'; end if;
 end if;
 if old_record is not null or r->>'action'<>'propose_standstill' then
  if jsonb_typeof(prior) is distinct from 'object' or (select count(*) from jsonb_object_keys(prior))<>2 or jsonb_typeof(prior->'entryId') is distinct from 'string' or jsonb_typeof(prior->'version') is distinct from 'number' then raise exception using errcode='PT400',message='Review the latest standstill state'; end if;
  head:=public.harmonious_standstill_head(proposal->>'id');
  if prior is distinct from head then raise exception using errcode='PT409',message='The standstill changed; review the latest state'; end if;
  if coalesce(old_record->>'status',proposal->>'status')='withdrawn' or exists(select 1 from public.harmonious_records where kind='discussion' and content->>'kind'='standstill' and content->>'action'='resume_standstill' and content->'target'->>'entryId'=proposal->>'id') then raise exception using errcode='PT409',message='This standstill has ended; propose a new standstill'; end if;
 end if;
 select content into thread from public.harmonious_records where kind='comparison_thread' and id=r->>'comparisonId';
 select content into dispute from public.harmonious_records where kind='discussion' and id=proposal->'standstill'->>'disputeId';
 select content into anchor from public.harmonious_records where kind='discussion' and id=proposal->'standstill'->'anchor'->>'entryId';
 if thread is null or jsonb_array_length(thread->'participants')<>2 or dispute->>'authorId'=dispute->'interaction'->>'recipientId' or not (thread->'participants' @> jsonb_build_array(dispute->>'authorId',dispute->'interaction'->>'recipientId')) or dispute is null or dispute->>'kind' is distinct from 'interaction' or dispute->>'action' is distinct from 'dispute' or dispute->'interaction'->>'mode' is distinct from 'argument' or dispute->>'comparisonId' is distinct from r->>'comparisonId' or dispute->'target' is distinct from proposal->'target' or not (thread->'participants' @> jsonb_build_array(new.owner_id::text)) or not (new.owner_id::text=dispute->>'authorId' or new.owner_id::text=dispute->'interaction'->>'recipientId') then raise exception using errcode='PT403',message='Only the two dispute participants can record a standstill'; end if;
 if r->>'action' in ('confirm_standstill','suggest_standstill') and new.owner_id::text=proposal->>'authorId' then raise exception using errcode='PT403',message='The other participant must confirm or suggest changes'; end if;
 if withdrawal then return new; end if;
 if anchor is null or anchor->>'comparisonId' is distinct from r->>'comparisonId' or not (anchor->>'id'=dispute->>'id' or anchor->>'kind'='interaction' and anchor->>'action'='respond' and anchor->'interaction'->>'mode'='argument' and anchor->'target'->>'entryId'=dispute->>'id') or not exists(select 1 from jsonb_array_elements(anchor->'history'||jsonb_build_array(anchor)) v where v->'version'=proposal->'standstill'->'anchor'->'version') then raise exception using errcode='PT400',message='Choose a contribution in this dispute'; end if;
 for point in select value from jsonb_array_elements(jsonb_build_array(thread->>'aMapId',thread->>'bMapId')) loop
  select content into source_map from public.harmonious_records where kind='map' and id=point#>>'{}';
  if source_map is null or exists(select 1 from jsonb_array_elements_text(thread->'participants') person where source_map->>'ownerId' is distinct from person and source_map->>'visibility' is distinct from 'shared') then raise exception using errcode='PT403',message='Both comparison maps must be available'; end if;
 end loop;
 if r->>'status'='withdrawn' then raise exception using errcode='PT409',message='Withdrawal cannot change the explanation'; end if;
 if not public.harmonious_standstill_access(anchor->>'id',thread->'participants') or not public.harmonious_standstill_access(dispute->>'id',thread->'participants') or (old_record is not null or r->>'action'<>'propose_standstill') and not public.harmonious_standstill_access(proposal->>'id',thread->'participants') then raise exception using errcode='PT403',message='Standstill context is unavailable to both participants'; end if;
 select content into source_map from public.harmonious_records where kind='map' and id=proposal->'target'->>'mapId';
 select value into node from jsonb_array_elements(source_map->'nodes') where value->>'id'=proposal->'target'->>'nodeId';
 if node is null or node->>'parent' is null or proposal->'target'->>'mapId' not in (thread->>'aMapId',thread->>'bMapId') or dispute->>'status' is distinct from 'active' or anchor->>'status' is distinct from 'active' then raise exception using errcode='PT409',message='The standstill point is unavailable or withdrawn'; end if;
 actual_snapshot:=jsonb_build_array(public.harmonious_interaction_snapshot(proposal->'target'));
 if r->>'action'<>'propose_standstill' and meta->'reviewedContext' is distinct from jsonb_build_object('source',actual_snapshot->0,'anchorVersion',anchor->'version','disputeVersion',dispute->'version') then raise exception using errcode='PT409',message='The standstill context changed; review the latest source and contribution'; end if;
 if r->>'action'='propose_standstill' then
  if proposal->'standstill'->'reviewedAnchorVersion' is distinct from anchor->'version' or proposal->'standstill'->'reviewedDisputeVersion' is distinct from dispute->'version' or old_record is null and proposal->'standstill'->'anchor'->'version' is distinct from anchor->'version' then raise exception using errcode='PT409',message='The addressed contribution changed; review it again'; end if;
  if (old_record is null and r->'sourceSnapshots' is distinct from actual_snapshot) or coalesce(r->'reviewedSources',r->'sourceSnapshots') is distinct from actual_snapshot then raise exception using errcode='PT409',message='Review the current source wording'; end if;
  if old_record is null and exists(select 1 from public.harmonious_records p where p.kind='discussion' and p.content->>'kind'='standstill' and p.content->>'action'='propose_standstill' and p.content->>'status'='active' and p.content->>'authorId'=new.owner_id::text and p.content->>'comparisonId'=r->>'comparisonId' and p.content->'standstill'->'anchor'->>'entryId'=meta->'anchor'->>'entryId' and not exists(select 1 from public.harmonious_records e where e.kind='discussion' and e.content->>'kind'='standstill' and e.content->>'action'='resume_standstill' and e.content->'target'->>'entryId'=p.id)) then raise exception using errcode='PT409',message='Reopen your existing standstill proposal at this point'; end if;
 elsif r->>'action'<>'resume_standstill' and (proposal->'standstill'->'reviewedAnchorVersion' is distinct from anchor->'version' or proposal->'standstill'->'reviewedDisputeVersion' is distinct from dispute->'version' or coalesce(proposal->'reviewedSources',proposal->'sourceSnapshots') is distinct from actual_snapshot) then raise exception using errcode='PT409',message='The standstill needs review before confirmation or suggestions'; end if;
 return new;
end;
$$;

revoke all on function public.harmonious_standstill_head(text),public.harmonious_standstill_access(text,jsonb),public.harmonious_check_standstill() from public,anon,authenticated;
grant execute on function public.harmonious_standstill_head(text),public.harmonious_standstill_access(text,jsonb),public.harmonious_check_standstill() to service_role;
create trigger harmonious_standstill_identity before insert or update on public.harmonious_records for each row execute function public.harmonious_check_standstill();
-- Standstill's own validator covers the source and response identities. Its
-- narrow withdrawal path can preserve an unavailable addressed contribution.
drop trigger harmonious_discussion_identity on public.harmonious_records;
create trigger harmonious_discussion_identity before insert or update on public.harmonious_records for each row when (new.kind<>'discussion' or new.content->>'kind' is distinct from 'counterpart_unlink' and new.content->>'kind' is distinct from 'standstill') execute function public.harmonious_check_discussion();
