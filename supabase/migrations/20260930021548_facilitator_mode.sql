-- Delegation remains a Worker-verified operation. These stores/RPCs are never
-- available to browser database roles; the manager argument comes from binding.
create table public.harmonious_facilitation_grants (
 participant_id uuid primary key references auth.users(id), operator_id uuid not null references auth.users(id),
 version bigint not null check(version>0), active boolean not null, at timestamptz not null default now(),
 method text not null check(method='assisted-session'), check(participant_id<>operator_id)
);
create table public.harmonious_facilitation_drafts (
 id text primary key, participant_id uuid not null references auth.users(id), operator_id uuid not null references auth.users(id),
 grant_version bigint not null, version bigint not null default 1 check(version=1), changes jsonb not null,
 state text not null check(state in ('pending','approved','declined','withdrawn')), at timestamptz not null default now(),
 ended_at timestamptz, ended_by uuid references auth.users(id)
);
create table public.harmonious_facilitation_operations (
 id text primary key, operator_id uuid not null references auth.users(id), request jsonb not null, result jsonb not null, at timestamptz not null default now()
);
create table public.harmonious_facilitation_audit (
 id bigint generated always as identity primary key, operator_id uuid not null references auth.users(id), participant_id uuid not null references auth.users(id),
 operation_id text not null, grant_version bigint, method text not null, entered_by uuid references auth.users(id), draft_id text, kind text not null, record_id text not null,
 revision bigint not null, content_before jsonb, content_after jsonb, nodes jsonb not null, connections jsonb not null, at timestamptz not null default now()
);
alter table public.harmonious_facilitation_grants enable row level security;
alter table public.harmonious_facilitation_drafts enable row level security;
alter table public.harmonious_facilitation_operations enable row level security;
alter table public.harmonious_facilitation_audit enable row level security;
revoke all on public.harmonious_facilitation_grants,public.harmonious_facilitation_drafts,public.harmonious_facilitation_operations,public.harmonious_facilitation_audit from public,anon,authenticated;
grant select,insert,update on public.harmonious_facilitation_grants,public.harmonious_facilitation_drafts to service_role;
grant select,insert on public.harmonious_facilitation_operations,public.harmonious_facilitation_audit to service_role;
grant usage,select on sequence public.harmonious_facilitation_audit_id_seq to service_role;
create index harmonious_facilitation_draft_owner on public.harmonious_facilitation_drafts(participant_id,state);
create index harmonious_facilitation_audit_record on public.harmonious_facilitation_audit(kind,record_id,revision);

create function public.harmonious_audit_facilitation() returns trigger language plpgsql security invoker set search_path='' as $$
declare context jsonb; previous jsonb; changed_nodes jsonb:='[]'; changed_connections jsonb:='[]';
begin
 if new.kind not in ('map','discussion') then return new; end if;
 context:=nullif(current_setting('harmonious.acting_context',true),'')::jsonb;
 if context is null then return new; end if;
 if context->>'operatorId'=context->>'participantId' and context->>'draftId' is null and not exists(select 1 from public.harmonious_facilitation_audit where kind=new.kind and record_id=new.id) then return new; end if;
 previous:=case when tg_op='UPDATE' then old.content else '{}'::jsonb end;
 if new.kind='map' then
  select coalesce(jsonb_agg(coalesce(a->>'id',b->>'id')),'[]') into changed_nodes
  from jsonb_array_elements(coalesce(previous->'nodes','[]')) a full join jsonb_array_elements(new.content->'nodes') b on a->>'id'=b->>'id'
  where (a-array['ideaId','ideaVersion','reuseMode','copiedFrom']) is distinct from (b-array['ideaId','ideaVersion','reuseMode','copiedFrom']);
  select coalesce(jsonb_agg(coalesce(a->>'id',b->>'id')),'[]') into changed_connections
  from jsonb_array_elements(coalesce(previous->'relations','[]')) a full join jsonb_array_elements(coalesce(new.content->'relations','[]')) b on a->>'id'=b->>'id' where a is distinct from b;
 end if;
 insert into public.harmonious_facilitation_audit(operator_id,participant_id,operation_id,grant_version,method,entered_by,draft_id,kind,record_id,revision,content_before,content_after,nodes,connections)
 values((context->>'operatorId')::uuid,(context->>'participantId')::uuid,context->>'operationId',(context->>'grantVersion')::bigint,context->>'method',coalesce(context->>'enteredBy',context->>'operatorId')::uuid,context->>'draftId',new.kind,new.id,new.revision,previous,new.content,changed_nodes,changed_connections);
 return new;
end $$;
create trigger harmonious_facilitation_audit after insert or update on public.harmonious_records for each row execute function public.harmonious_audit_facilitation();

alter function public.harmonious_commit(uuid,bigint,jsonb) rename to harmonious_commit_before_facilitation;
create function public.harmonious_commit(p_actor uuid,p_generation bigint,p_changes jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 perform set_config('harmonious.acting_context',jsonb_build_object('operatorId',p_actor,'participantId',p_actor,'operationId','direct-'||p_actor||'-'||p_generation,'method','direct')::text,true);
 result:=public.harmonious_commit_before_facilitation(p_actor,p_generation,p_changes);
 perform set_config('harmonious.acting_context','',true);return result;
end $$;

alter function public.harmonious_snapshot() rename to harmonious_snapshot_before_facilitation;
create function public.harmonious_snapshot() returns jsonb language sql security invoker set search_path='' as $$
 select public.harmonious_snapshot_before_facilitation() || jsonb_build_object(
 'facilitationOperations',coalesce((select jsonb_agg(jsonb_build_object('id',id,'operatorId',operator_id,'request',request,'result',result)) from public.harmonious_facilitation_operations),'[]'),
 'facilitationGrants',coalesce((select jsonb_agg(jsonb_build_object('participantId',participant_id,'operatorId',operator_id,'version',version,'active',active,'at',at,'method',method)) from public.harmonious_facilitation_grants),'[]'),
 'facilitationDrafts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'participantId',participant_id,'operatorId',operator_id,'grantVersion',grant_version,'version',version,'changes',changes,'state',state,'at',at,'endedAt',ended_at,'endedBy',ended_by)) from public.harmonious_facilitation_drafts),'[]'),
 'facilitationHistory',coalesce((select jsonb_agg(jsonb_build_object('id',id::text,'operatorId',operator_id,'participantId',participant_id,'operationId',operation_id,'grantVersion',grant_version,'method',method,'enteredBy',entered_by,'draftId',draft_id,'kind',kind,'recordId',record_id,'revision',revision,'nodes',nodes,'connections',connections,'at',at) order by id) from public.harmonious_facilitation_audit),'[]'));
$$;

create function public.harmonious_facilitation_scope(changes jsonb,is_draft boolean) returns void
language plpgsql security invoker set search_path='' as $$
declare item jsonb; old_map jsonb; changed_count integer; non_deleted integer; node_change record; discussion jsonb; map_change jsonb; new_node text;
begin
 if jsonb_typeof(changes) is distinct from 'array' or jsonb_array_length(changes) not between 1 and 30 then raise exception using errcode='PT400',message='Choose one contribution'; end if;
 if not exists(select 1 from jsonb_array_elements(changes) c where c->>'kind' in ('map','discussion','comparison_thread')) then raise exception using errcode='PT400',message='Choose a contribution';end if;
 if (select count(*) from jsonb_array_elements(changes) c where c->>'kind'='map')>1 or (select count(*) from jsonb_array_elements(changes) c where c->>'kind'='discussion')>1 then raise exception using errcode='PT400',message='Record contributions separately'; end if;
 for item in select value from jsonb_array_elements(changes) loop
  if item->>'kind' not in ('map','idea','discussion','comparison_thread') then raise exception using errcode='PT403',message='Unsupported facilitated action'; end if;
  if item->>'kind'='comparison_thread' and (is_draft or jsonb_array_length(changes)<>1) then raise exception using errcode='PT400',message='Open a comparison separately'; end if;
  if item->>'kind'='discussion' then
   discussion:=item->'value';
   if discussion->>'kind' not in ('interaction','standstill','correspondence','counterpart','counterpart_unlink','context') then raise exception using errcode='PT400',message='Unsupported contribution type'; end if;
   if is_draft and (discussion->>'kind'<>'interaction' or discussion->>'status'<>'active' or discussion->>'action' not in ('dispute','respond') or discussion->>'action'='respond' and exists(select 1 from jsonb_array_elements_text(discussion#>'{interaction,options}') o where o<>'reply')) then raise exception using errcode='PT400',message='Decisions require participant direction'; end if;
  end if;
  if item->>'kind'='map' then
   map_change:=item->'value';select content into old_map from public.harmonious_records where kind='map' and id=item->>'id';
   if is_draft and (old_map is null or old_map->'name' is distinct from map_change->'name' or old_map->'visibility' is distinct from map_change->'visibility') then raise exception using errcode='PT400',message='Map creation and sharing require direction'; end if;
   changed_count:=0;non_deleted:=0;
   for node_change in select a as before,b as after from jsonb_array_elements(coalesce(old_map->'nodes','[]')) a full join jsonb_array_elements(map_change->'nodes') b on a->>'id'=b->>'id' where (a-array['ideaId','ideaVersion','reuseMode','copiedFrom']) is distinct from (b-array['ideaId','ideaVersion','reuseMode','copiedFrom']) loop
    changed_count:=changed_count+1;if node_change.after is not null then non_deleted:=non_deleted+1;end if;
    if node_change.before is null then new_node:=node_change.after->>'id';end if;
    if is_draft and (node_change.after is null or node_change.before is not null and node_change.before->'confidence' is distinct from node_change.after->'confidence' or node_change.before is null and node_change.after->'confidence' is distinct from 'null'::jsonb) then raise exception using errcode='PT400',message='Confidence and deletion require direction'; end if;
   end loop;
   if old_map is not null and changed_count>1 and non_deleted>0 then raise exception using errcode='PT400',message='Record each node separately';end if;
   if old_map is not null and not (changed_count>1 and non_deleted=0) and (select count(*) from jsonb_array_elements(coalesce(old_map->'relations','[]')) a full join jsonb_array_elements(coalesce(map_change->'relations','[]')) b on a->>'id'=b->>'id' where a is distinct from b)>1 then raise exception using errcode='PT400',message='Record connections separately';end if;
   if is_draft then
    for node_change in select a as before,b as after from jsonb_array_elements(coalesce(old_map->'relations','[]')) a full join jsonb_array_elements(coalesce(map_change->'relations','[]')) b on a->>'id'=b->>'id' where a is distinct from b loop
     if node_change.before is not null or new_node is null or new_node not in (node_change.after->>'from',node_change.after->>'to') then raise exception using errcode='PT400',message='Connections require participant direction';end if;
    end loop;
   end if;
  end if;
 end loop;
 if map_change is not null and discussion is not null and (new_node is null or not exists(select 1 from jsonb_array_elements(jsonb_build_array(discussion->'other',discussion#>'{interaction,reference}')) r where r->>'mapId'=map_change->>'id' and r->>'nodeId'=new_node)) then raise exception using errcode='PT400',message='Record unrelated map and conversation changes separately'; end if;
end $$;
revoke all on function public.harmonious_facilitation_scope(jsonb,boolean) from public,anon,authenticated;
grant execute on function public.harmonious_facilitation_scope(jsonb,boolean) to service_role;

create function public.harmonious_facilitate(p_operator uuid,p_manager uuid,p_generation bigint,p_command text,p_input jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare generation bigint; participant uuid:=(p_input->>'participantId')::uuid; grant_row public.harmonious_facilitation_grants%rowtype;
 draft public.harmonious_facilitation_drafts%rowtype; prior public.harmonious_facilitation_operations%rowtype;
 op text:=p_input->>'operationId'; result jsonb; item jsonb; method text:=p_input->>'method';
begin
 if p_operator is null or not exists(select 1 from auth.users where id=p_operator) or op is null or length(op) not between 10 and 100 then raise exception using errcode='PT403',message='Invalid facilitator identity or operation'; end if;
 select revision into generation from public.harmonious_generation where id for update;
 select * into grant_row from public.harmonious_facilitation_grants where participant_id=participant;
 if p_command='grant' then
  if p_operator is distinct from p_manager or p_operator=participant or p_input->'attested' is distinct from 'true'::jsonb or p_input->'verifiedTest' is distinct from 'true'::jsonb then raise exception using errcode='PT403',message='Only the verified organizer can record permission for a test account'; end if;
 elsif p_command='revoke' then
  if grant_row.participant_id is null or p_operator not in (participant,grant_row.operator_id) or p_operator<>participant and p_operator is distinct from p_manager then raise exception using errcode='PT403',message='Only the participant or organizer may stop facilitation'; end if;
 else
  if grant_row.participant_id is null or not grant_row.active or grant_row.version is distinct from (p_input->>'grantVersion')::bigint then raise exception using errcode='PT403',message='Facilitation permission ended or changed'; end if;
  if p_operator<>participant and (p_operator is distinct from p_manager or p_operator<>grant_row.operator_id) then raise exception using errcode='PT403',message='This facilitator cannot act for that participant'; end if;
  if p_operator=participant and p_command not in ('approve','decline') then raise exception using errcode='PT403',message='Use your ordinary account controls'; end if;
 end if;
 select * into prior from public.harmonious_facilitation_operations where id=op;
 if found then
  if prior.operator_id<>p_operator or prior.request is distinct from jsonb_build_object('command',p_command,'input',p_input) then raise exception using errcode='PT409',message='This operation was already used with different content'; end if;
  return prior.result||jsonb_build_object('replayed',true);
 end if;
 if generation is distinct from p_generation then raise exception using errcode='PT409',message='snapshot_changed'; end if;
 if p_command in ('draft','record','approve','comparison') then perform public.harmonious_facilitation_scope(p_input->'changes',p_command in ('draft','approve'));end if;
 if p_command in ('grant','revoke') then
  if coalesce(grant_row.version,0) is distinct from (p_input->>'expectedVersion')::bigint then raise exception using errcode='PT409',message='Permission changed; reopen its current state'; end if;
  insert into public.harmonious_facilitation_grants(participant_id,operator_id,version,active,method)
  values(participant,coalesce(grant_row.operator_id,p_operator),coalesce(grant_row.version,0)+1,p_command='grant','assisted-session')
  on conflict(participant_id) do update set version=excluded.version,active=excluded.active,at=now();
  result:=jsonb_build_object('saved',true);
 elsif p_command='draft' then
  if jsonb_typeof(p_input->'changes') is distinct from 'array' or jsonb_array_length(p_input->'changes') not between 1 and 30 then raise exception using errcode='PT400',message='Choose a contribution'; end if;
  for item in select value from jsonb_array_elements(p_input->'changes') loop
   if item->>'kind' not in ('map','idea','discussion') then raise exception using errcode='PT400',message='This action cannot be drafted'; end if;
   if exists(select 1 from public.harmonious_records where kind=item->>'kind' and id=item->>'id' and owner_id<>participant) then raise exception using errcode='PT403',message='Draft belongs to another account'; end if;
  end loop;
  -- Run the canonical guards in a subtransaction which always rolls back.
  -- A private draft must be valid, but must never publish even temporarily.
  begin
   perform public.harmonious_commit_before_facilitation(participant,generation,p_input->'changes');
   raise exception using errcode='Z0001',message='draft_validation_only';
  exception when sqlstate 'Z0001' then null; end;
  insert into public.harmonious_facilitation_drafts(id,participant_id,operator_id,grant_version,changes,state)
  values(op,participant,p_operator,grant_row.version,p_input->'changes','pending');
  result:=jsonb_build_object('draftId',op,'savedDraft',true);
 elsif p_command in ('approve','decline','withdraw') then
  select * into draft from public.harmonious_facilitation_drafts where id=p_input->>'draftId';
  if draft.id is null or draft.participant_id<>participant or draft.grant_version<>grant_row.version or draft.version is distinct from (p_input->>'draftVersion')::bigint or draft.state<>'pending' then raise exception using errcode='PT409',message='This draft changed or ended'; end if;
  if p_command='decline' and p_operator<>participant or p_command='withdraw' and p_operator<>draft.operator_id then raise exception using errcode='PT403',message='This draft action belongs to the other person'; end if;
  if p_command='approve' then
   if p_input->'changes' is distinct from draft.changes then raise exception using errcode='PT409',message='Review the exact saved draft'; end if;
   if p_operator=participant and method is distinct from 'direct' or p_operator<>participant and (method is distinct from 'verbal' or p_input->'attested' is distinct from 'true'::jsonb) then raise exception using errcode='PT403',message='Record how this wording was approved'; end if;
  end if;
  update public.harmonious_facilitation_drafts set state=case p_command when 'approve' then 'approved' when 'decline' then 'declined' else 'withdrawn' end,ended_at=now(),ended_by=p_operator where id=draft.id;
  result:=jsonb_build_object('draftId',draft.id,'saved',true);
 elsif p_command='record' then
  if method is distinct from 'directed' or p_input->'attested' is distinct from 'true'::jsonb then raise exception using errcode='PT403',message='Record the participant’s explicit direction'; end if;
 elsif p_command<>'comparison' then raise exception using errcode='PT400',message='Unknown facilitator action';
 end if;
 if p_command in ('record','approve','comparison') then
  if jsonb_typeof(p_input->'changes') is distinct from 'array' or jsonb_array_length(p_input->'changes') not between 1 and 30 then raise exception using errcode='PT400',message='Choose one contribution'; end if;
  for item in select value from jsonb_array_elements(p_input->'changes') loop
   if item->>'kind' not in ('map','idea','discussion','comparison_thread') or p_command='comparison' and (item->>'kind'<>'comparison_thread' or jsonb_array_length(p_input->'changes')<>1) then raise exception using errcode='PT403',message='Unsupported facilitated action'; end if;
  end loop;
  perform set_config('harmonious.acting_context',jsonb_build_object('operatorId',p_operator,'enteredBy',case when p_command='approve' then draft.operator_id else p_operator end,'draftId',case when p_command='approve' then draft.id else null end,'participantId',participant,'operationId',op,'grantVersion',grant_row.version,'method',coalesce(method,'directed'))::text,true);
  result:=coalesce(result,'{}')||public.harmonious_commit_before_facilitation(participant,generation,p_input->'changes');
  perform set_config('harmonious.acting_context','',true);
 else update public.harmonious_generation set revision=revision+1 where id;
 end if;
 insert into public.harmonious_facilitation_operations(id,operator_id,request,result) values(op,p_operator,jsonb_build_object('command',p_command,'input',p_input),result);
 return result;
end $$;
revoke all on function public.harmonious_audit_facilitation(),public.harmonious_commit(uuid,bigint,jsonb),public.harmonious_snapshot(),public.harmonious_facilitate(uuid,uuid,bigint,text,jsonb) from public,anon,authenticated;
grant execute on function public.harmonious_audit_facilitation(),public.harmonious_commit(uuid,bigint,jsonb),public.harmonious_snapshot(),public.harmonious_facilitate(uuid,uuid,bigint,text,jsonb) to service_role;
