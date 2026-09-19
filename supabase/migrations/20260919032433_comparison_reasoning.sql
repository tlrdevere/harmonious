-- Extend existing authored conversations with reasons and inference targets.
-- No row rewrites, table/grant changes, or legacy argument migration.
create or replace function public.harmonious_check_discussion() returns trigger
language plpgsql security invoker set search_path='' as $$
declare
 thread jsonb; source jsonb; parent jsonb; ref jsonb; target_map text;
 definition jsonb; definition_version jsonb; expected_reference jsonb; previous jsonb;
 reason boolean; old_reason boolean; withdrawal boolean:=false; parent_layer text; recipient text;
begin
 if new.kind<>'discussion' then return new; end if;
 if new.content->>'authorId' is distinct from new.owner_id::text then raise exception using errcode='PT403',message='Invalid conversation author'; end if;
 if jsonb_typeof(new.content->'target') is distinct from 'object' then raise exception using errcode='PT400',message='Invalid conversation target'; end if;
 reason:=coalesce(new.content->>'kind'='argument' and new.content->>'action'='reason',false);
 if new.content->>'action'='reason' and not reason then raise exception using errcode='PT400',message='A reason must be an argument'; end if;
 if tg_op='UPDATE' then
  old_reason:=coalesce(old.content->>'kind'='argument' and old.content->>'action'='reason',false);
  if new.content->>'authorId' is distinct from old.content->>'authorId' or new.content->>'comparisonId' is distinct from old.content->>'comparisonId' or new.content->>'kind' is distinct from old.content->>'kind' or new.content->'target' is distinct from old.content->'target' or new.content->'other' is distinct from old.content->'other' or new.content->>'layer' is distinct from old.content->>'layer' or new.content->>'createdAt' is distinct from old.content->>'createdAt' or reason is distinct from old_reason then
   raise exception using errcode='PT409',message='Conversation identity and reason role cannot change';
  end if;
  if new.content->>'kind'='reply' and new.content->>'action' is distinct from old.content->>'action' then raise exception using errcode='PT409',message='Add a new response to preserve outcome history'; end if;
 end if;
 -- RPC upserts execute INSERT checks before UPDATE checks. Read the existing
 -- authored row in either case so withdrawing a child is possible after its
 -- parent has been withdrawn. This exception cannot carry an edit or retarget.
 if new.content->>'kind'<>'context' and new.content->>'status'='withdrawn' then
  if tg_op='UPDATE' then previous:=old.content;
  else select content into previous from public.harmonious_records where kind='discussion' and id=new.id and owner_id=new.owner_id; end if;
  withdrawal:=coalesce(previous->>'status'='active'
   and (new.content - array['status','version','updatedAt','history'])=(previous - array['status','version','updatedAt','history'])
   and (new.content->>'version')::bigint=(previous->>'version')::bigint+1
   and new.content->'history'=(previous->'history'||jsonb_build_array(previous-'history')),false);
 end if;
 if new.content->>'kind'<>'context' then
  select content into thread from public.harmonious_records where kind='comparison_thread' and id=new.content->>'comparisonId';
  if thread is null or not (thread->'participants' @> jsonb_build_array(new.owner_id::text)) then raise exception using errcode='PT403',message='Conversation requires comparison membership'; end if;
  for target_map in select value from jsonb_array_elements_text(jsonb_build_array(thread->>'aMapId',thread->>'bMapId')) loop
   select content into source from public.harmonious_records where kind='map' and id=target_map;
   if source is null or (source->>'ownerId' is distinct from new.owner_id::text and source->>'visibility' is distinct from 'shared') then raise exception using errcode='PT403',message='Both comparison maps must be available'; end if;
  end loop;
 end if;
 if withdrawal then return new; end if;
 if new.content->>'kind'='reply' and new.content->'target'->>'type' is distinct from 'entry' then raise exception using errcode='PT400',message='A response requires a contribution target'; end if;
 if reason and (coalesce(new.content->'target'->>'type','') not in ('node','entry') or coalesce(new.content->'other','null'::jsonb)<>'null'::jsonb) then raise exception using errcode='PT400',message='A reason supports one own position or contribution'; end if;
 for ref in select value from jsonb_array_elements(jsonb_build_array(new.content->'target',new.content->'other')) where value<>'null'::jsonb loop
  if ref->>'type' in ('entry','inference') then
   select content into parent from public.harmonious_records where kind='discussion' and id=ref->>'entryId';
   if parent is null or parent->>'comparisonId' is distinct from new.content->>'comparisonId' or parent->>'status' is distinct from 'active' or parent->>'id'=new.id then raise exception using errcode='PT409',message='Conversation target unavailable'; end if;
   if ref->>'type'='inference' and (parent->>'kind' is distinct from 'argument' or parent->>'action' is distinct from 'reason') then raise exception using errcode='PT409',message='Inference target requires an active reason'; end if;
   if reason and (parent->>'authorId' is distinct from new.owner_id::text or not ((parent->>'kind'='argument' and parent->>'action'='reason') or (parent->>'kind'='reply' and parent->>'layer'='arguments'))) then raise exception using errcode='PT403',message='Explain only your own reason or argument response'; end if;
   if new.content->>'kind'='reply' then
    parent_layer:=case parent->>'kind' when 'relationship' then 'map' when 'correspondence' then 'map' when 'context' then 'map' when 'argument' then 'arguments' when 'reply' then parent->>'layer' else 'inquiries' end;
    if new.content->>'layer' is distinct from parent_layer then raise exception using errcode='PT400',message='A response must stay with its conversation'; end if;
    if new.content->>'action' in ('resolve','reopen','accept','maintain') then
     if parent->>'kind' is distinct from 'argument' or parent->>'action'='reason' then raise exception using errcode='PT400',message='Choose a challenge before recording an outcome'; end if;
     if (new.content->>'action' in ('resolve','reopen') and parent->>'authorId' is distinct from new.owner_id::text) or (new.content->>'action' in ('accept','maintain') and parent->>'authorId'=new.owner_id::text) then raise exception using errcode='PT403',message='Record only your own response or resolution'; end if;
    elsif new.content->>'action' in ('no_position','not_applicable','close_request','reopen_request') then
     if parent->>'kind' is distinct from 'counterpart' then raise exception using errcode='PT400',message='Choose a counterpart request'; end if;
     select content->>'ownerId' into recipient from public.harmonious_records where kind='map' and id=case when parent->'target'->>'mapId'=thread->>'aMapId' then thread->>'bMapId' else thread->>'aMapId' end;
     if (new.content->>'action' in ('close_request','reopen_request') and parent->>'authorId' is distinct from new.owner_id::text) or (new.content->>'action' in ('no_position','not_applicable') and recipient is distinct from new.owner_id::text) then raise exception using errcode='PT403',message='Only the request author or recipient can record this outcome'; end if;
    end if;
   end if;
  else
   target_map:=ref->>'mapId';
   select content into source from public.harmonious_records where kind='map' and id=target_map;
   if source is null then raise exception using errcode='PT409',message='Source map unavailable'; end if;
   if new.content->>'kind'='context' then
    if source->>'ownerId' is distinct from new.owner_id::text or new.content->>'comparisonId' is not null then raise exception using errcode='PT403',message='Only the map author defines its context'; end if;
   elsif target_map not in (thread->>'aMapId',thread->>'bMapId') then raise exception using errcode='PT403',message='Source outside comparison'; end if;
   if new.content->>'kind' in ('counterpart','adoption') and (ref->>'type'<>'node' or source->>'ownerId' is distinct from new.owner_id::text) then raise exception using errcode='PT403',message='Choose your own node'; end if;
   if reason and (ref->>'type' is distinct from 'node' or source->>'ownerId' is distinct from new.owner_id::text or not exists(select 1 from jsonb_array_elements(source->'nodes') n where n->>'id'=ref->>'nodeId' and n->>'parent' is not null)) then raise exception using errcode='PT403',message='Explain only your own ordinary node'; end if;
   if ref->>'type'='node' then
    if not exists(select 1 from jsonb_array_elements(source->'nodes') n where n->>'id'=ref->>'nodeId') then raise exception using errcode='PT409',message='Source node unavailable'; end if;
   elsif ref->>'type'='edge' then
    if not exists(select 1 from jsonb_array_elements(source->'relations') e where e->>'id'=ref->>'edgeId') and not exists(select 1 from jsonb_array_elements(source->'nodes') n where 'structure:'||(n->>'id')=ref->>'edgeId' and n->>'parent' is not null) then raise exception using errcode='PT409',message='Source edge unavailable'; end if;
   else raise exception using errcode='PT400',message='Invalid conversation target'; end if;
  end if;
 end loop;
 -- Explicitly invoked library versions may travel with a reason/response, but
 -- must match the author's private entry exactly. No private library is shared.
 if new.content ? 'definitionRefs' then
  if not (new.content->>'kind' in ('context','argument') or (new.content->>'kind'='reply' and new.content->>'layer'='arguments')) or jsonb_typeof(new.content->'definitionRefs') is distinct from 'array' or jsonb_array_length(new.content->'definitionRefs')>30 then raise exception using errcode='PT400',message='Invalid definition references'; end if;
  for ref in select value from jsonb_array_elements(new.content->'definitionRefs') loop
   select content into definition from public.harmonious_records where kind='definition' and id=ref->>'definitionId' and owner_id=new.owner_id;
   select value into definition_version from jsonb_array_elements(coalesce(definition->'versions','[]'::jsonb)) where value->'version'=ref->'version';
   if definition is null or definition_version is null then raise exception using errcode='PT403',message='Choose an available version from your definitions library'; end if;
   expected_reference:=jsonb_build_object('definitionId',definition->>'id','authorId',definition->>'authorId','type',definition->>'type','version',definition_version->'version','title',definition_version->>'title','body',definition_version->>'body');
   if ref is distinct from expected_reference then raise exception using errcode='PT403',message='Referenced definition wording must match its library version'; end if;
  end loop;
 end if;
 return new;
end;
$$;
