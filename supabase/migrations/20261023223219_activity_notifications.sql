-- Activity is derived only from accepted canonical writes. Installing the hook
-- does not backfill older contributions, and private draft validation rolls its
-- activity rows back with its deliberately rolled-back canonical subtransaction.
create table public.harmonious_activity_events (
 id bigint generated always as identity primary key,
 record_kind text not null check(record_kind in ('discussion','endorsement')),
 record_id text not null,
 revision bigint not null check(revision>0),
 event_type text not null check(event_type in ('agree','disagree','no_position','inquiry','dispute','respond','interaction_changed','interaction_withdrawn','counterpart_requested','counterpart_linked','counterpart_unlinked','standstill_proposed','standstill_suggested','standstill_confirmed','standstill_resumed','standstill_changed','standstill_withdrawn','cosigned')),
 author_id uuid not null references auth.users(id),
 recorder_id uuid references auth.users(id),
 comparison_id text,
 source_map_id text,
 created_at timestamptz not null default now(),
 constraint harmonious_activity_record_revision unique(record_kind,record_id,revision,event_type)
);
create table public.harmonious_activity_recipients (
 event_id bigint not null references public.harmonious_activity_events(id),
 recipient_id uuid not null references auth.users(id),
 read_at timestamptz,
 suppressed boolean not null default false,
 primary key(event_id,recipient_id)
);
create table public.harmonious_activity_mutes (
 recipient_id uuid not null references auth.users(id),
 comparison_id text not null,
 primary key(recipient_id,comparison_id)
);
create index harmonious_activity_inbox on public.harmonious_activity_recipients(recipient_id,event_id desc);
create index harmonious_activity_author on public.harmonious_activity_events(author_id);
create index harmonious_activity_recorder on public.harmonious_activity_events(recorder_id) where recorder_id is not null;
alter table public.harmonious_activity_events enable row level security;
alter table public.harmonious_activity_recipients enable row level security;
alter table public.harmonious_activity_mutes enable row level security;
revoke all on public.harmonious_activity_events,public.harmonious_activity_recipients,public.harmonious_activity_mutes from public,anon,authenticated;
revoke all on sequence public.harmonious_activity_events_id_seq from public,anon,authenticated;
grant select,insert on public.harmonious_activity_events,public.harmonious_activity_recipients to service_role;
grant update(read_at,suppressed) on public.harmonious_activity_recipients to service_role;
grant select,insert,delete on public.harmonious_activity_mutes to service_role;
grant usage,select on sequence public.harmonious_activity_events_id_seq to service_role;

-- Only deliberate published interaction changes count. Snapshot refreshes,
-- version/history bookkeeping and classification metadata are not new activity.
create function public.harmonious_activity_interaction_content(r jsonb) returns jsonb
language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('action',r->'action','body',r->'body','status',r->'status',
 'interaction',jsonb_build_object('mode',r#>'{interaction,mode}','options',r#>'{interaction,options}',
 'otherText',r#>'{interaction,otherText}','reference',r#>'{interaction,reference,target}',
 'replyTo',r#>'{interaction,replyTo}','placement',r#>'{interaction,placement}'),
 'definitionRefs',r->'definitionRefs','referenceUrl',r->'referenceUrl','premise',r->'premise');
$$;

create function public.harmonious_record_activity() returns trigger
language plpgsql security invoker set search_path='' as $$
declare
 r jsonb:=new.content; previous jsonb; recipient uuid; author uuid;
 event_type text; activity_comparison_id text; source_map_id text; event_id bigint;
 context jsonb; recorder uuid; thread jsonb; target jsonb; seen text[]:=array[]::text[];
begin
 if new.kind not in ('discussion','endorsement') then return new; end if;
 if tg_op='UPDATE' then previous:=old.content; end if;
 if previous is not null and new.content=old.content then return new; end if;
 author:=new.owner_id;
 if new.kind='endorsement' then
  if previous is not null or r->>'status'<>'active' then return new; end if;
  source_map_id:=r->>'sourceMapId';
  select owner_id into recipient from public.harmonious_records where kind='map' and id=source_map_id;
  event_type:='cosigned';
 else
  activity_comparison_id:=r->>'comparisonId';
  select content into thread from public.harmonious_records where kind='comparison_thread' and id=activity_comparison_id;
  if thread is null or not coalesce(thread->'participants' @> jsonb_build_array(author::text),false) then return new; end if;
  if r->>'kind'='interaction' then
   recipient:=(r#>>'{interaction,recipientId}')::uuid;
   if previous is null then
    if r->>'status'<>'active' then return new; end if;
    event_type:=case r->>'action' when 'endorse' then 'agree' when 'disagree' then 'disagree'
      when 'decline' then 'no_position' when 'dispute' then 'dispute' when 'respond' then 'respond'
      when 'request_reason' then 'inquiry' when 'request_explanation' then 'inquiry'
      when 'offer_reason' then 'inquiry' when 'propose_alternative' then 'inquiry' end;
   elsif public.harmonious_activity_interaction_content(r) is distinct from public.harmonious_activity_interaction_content(previous) then
    event_type:=case when r->>'status'='withdrawn' and previous->>'status'<>'withdrawn' then 'interaction_withdrawn' else 'interaction_changed' end;
   end if;
  else
   select value::uuid into recipient from jsonb_array_elements_text(thread->'participants') where value<>author::text limit 1;
   if r->>'kind'='standstill' then
    if previous is null and r->>'status'='active' then
     event_type:=case r->>'action' when 'propose_standstill' then 'standstill_proposed'
       when 'suggest_standstill' then 'standstill_suggested' when 'confirm_standstill' then 'standstill_confirmed'
       when 'resume_standstill' then 'standstill_resumed' end;
    elsif previous is not null and r->>'status'='withdrawn' and previous->>'status'<>'withdrawn' then event_type:='standstill_withdrawn';
    elsif previous is not null and r->>'status'='active' and (r->'body' is distinct from previous->'body' or r->'standstill' is distinct from previous->'standstill') then event_type:='standstill_changed'; end if;
   elsif r->>'kind'='counterpart' and previous is null and r->>'status'='active' then event_type:='counterpart_requested';
   elsif r->>'kind' in ('correspondence','relationship') then
    if previous is null and r->>'status'='active' then event_type:='counterpart_linked';
    elsif previous is not null and previous->>'status'='active' and r->>'status'='withdrawn' then event_type:='counterpart_unlinked'; end if;
   elsif r->>'kind'='counterpart_unlink' and previous is null and r->>'status'='active' then event_type:='counterpart_unlinked'; end if;
  end if;
  -- Resolve identifiers only; no source wording or historical snapshot is stored.
  target:=r->'target';
  while target->>'type' in ('entry','inference') and not coalesce(target->>'entryId'=any(seen),false) loop
   seen:=array_append(seen,target->>'entryId');
   select content->'target' into target from public.harmonious_records where kind='discussion' and id=target->>'entryId';
  end loop;
  source_map_id:=target->>'mapId';
 end if;
 if event_type is null or recipient is null or recipient=author then return new; end if;
 if activity_comparison_id is not null and not coalesce(thread->'participants' @> jsonb_build_array(recipient::text),false) then return new; end if;
 context:=nullif(current_setting('harmonious.acting_context',true),'')::jsonb;
 recorder:=nullif(coalesce(context->>'enteredBy',context->>'operatorId'),author::text)::uuid;
 insert into public.harmonious_activity_events(record_kind,record_id,revision,event_type,author_id,recorder_id,comparison_id,source_map_id)
 values(new.kind,new.id,new.revision,event_type,author,recorder,activity_comparison_id,source_map_id)
 on conflict on constraint harmonious_activity_record_revision do nothing returning id into event_id;
 if event_id is not null then
  insert into public.harmonious_activity_recipients(event_id,recipient_id,suppressed)
  values(event_id,recipient,exists(select 1 from public.harmonious_activity_mutes m where m.recipient_id=recipient and m.comparison_id=activity_comparison_id));
 end if;
 return new;
end;
$$;
create trigger harmonious_publish_activity after insert or update on public.harmonious_records for each row execute function public.harmonious_record_activity();

-- The Worker supplies the authenticated actor and applies the full current
-- workspace projection before exposing event metadata, counts, or read actions.
-- A shared generation lock keeps that snapshot coherent with canonical commits;
-- activity operations never increment the content generation or enter autosave.
create function public.harmonious_activity(p_actor uuid,p_command text,p_input jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare generation bigint; requested bigint[]; output jsonb; comparison jsonb;
begin
 if p_actor is null or not exists(select 1 from auth.users where id=p_actor) then raise exception using errcode='PT403',message='Unknown account'; end if;
 if jsonb_typeof(p_input) is distinct from 'object' then raise exception using errcode='PT400',message='Invalid activity request'; end if;
 select revision into generation from public.harmonious_generation where id for share;
 if p_command='snapshot' then
  select public.harmonious_snapshot() || jsonb_build_object(
   'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id::text,'recordKind',e.record_kind,'recordId',e.record_id,'revision',e.revision,
    'eventType',e.event_type,'authorId',e.author_id,'recorderId',e.recorder_id,'comparisonId',e.comparison_id,'sourceMapId',e.source_map_id,
    'createdAt',e.created_at,'read',s.read_at is not null,'suppressed',s.suppressed) order by e.id desc)
    from public.harmonious_activity_recipients s join public.harmonious_activity_events e on e.id=s.event_id where s.recipient_id=p_actor),'[]'::jsonb),
   'mutes',coalesce((select jsonb_agg(comparison_id order by comparison_id) from public.harmonious_activity_mutes where recipient_id=p_actor),'[]'::jsonb)
  ) into output;
  return output;
 end if;
 if jsonb_typeof(p_input->'generation') is distinct from 'number' or (p_input->>'generation')::numeric<>generation then raise exception using errcode='PT409',message='snapshot_changed'; end if;
 if p_command='read' then
  if jsonb_typeof(p_input->'ids') is distinct from 'array' or jsonb_array_length(p_input->'ids') not between 1 and 200 or jsonb_typeof(p_input->'read') is distinct from 'boolean' then raise exception using errcode='PT400',message='Choose activity to update'; end if;
  if exists(select 1 from jsonb_array_elements(p_input->'ids') v where case when jsonb_typeof(v)='string' and v#>>'{}' ~ '^[1-9][0-9]{0,18}$' then (v#>>'{}')::numeric>9223372036854775807 else true end) then raise exception using errcode='PT400',message='Invalid activity IDs'; end if;
  select array_agg(distinct value::bigint) into requested from jsonb_array_elements_text(p_input->'ids');
  if (select count(*) from public.harmonious_activity_recipients where recipient_id=p_actor and event_id=any(requested))<>cardinality(requested) then raise exception using errcode='PT403',message='Activity is unavailable'; end if;
  update public.harmonious_activity_recipients set
    read_at=case when (p_input->>'read')::boolean then coalesce(read_at,now()) else null end,
    suppressed=case when (p_input->>'read')::boolean then suppressed else false end
   where recipient_id=p_actor and event_id=any(requested);
  return jsonb_build_object('saved',true);
 elsif p_command='mute' then
  if jsonb_typeof(p_input->'comparisonId') is distinct from 'string' or length(p_input->>'comparisonId') not between 1 and 200 or jsonb_typeof(p_input->'muted') is distinct from 'boolean' then raise exception using errcode='PT400',message='Choose a comparison'; end if;
  select content into comparison from public.harmonious_records where kind='comparison_thread' and id=p_input->>'comparisonId';
  if comparison is null or not coalesce(comparison->'participants' @> jsonb_build_array(p_actor::text),false) then raise exception using errcode='PT403',message='Comparison is unavailable'; end if;
  if (p_input->>'muted')::boolean then insert into public.harmonious_activity_mutes(recipient_id,comparison_id) values(p_actor,p_input->>'comparisonId') on conflict do nothing;
  else delete from public.harmonious_activity_mutes where recipient_id=p_actor and comparison_id=p_input->>'comparisonId'; end if;
  return jsonb_build_object('saved',true);
 end if;
 raise exception using errcode='PT400',message='Unknown activity operation';
end;
$$;
revoke all on function public.harmonious_activity_interaction_content(jsonb),public.harmonious_record_activity(),public.harmonious_activity(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.harmonious_activity_interaction_content(jsonb),public.harmonious_record_activity(),public.harmonious_activity(uuid,text,jsonb) to service_role;
