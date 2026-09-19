-- One durable parent for each unordered worldview pair. Existing proposals
-- retain their IDs, judgments and history. No participant content is removed.
alter table public.harmonious_records drop constraint harmonious_records_kind_check;
alter table public.harmonious_records add constraint harmonious_records_kind_check
  check (kind in ('profile','map','idea','endorsement','comparison','comparison_thread'));

create unique index harmonious_comparison_pair on public.harmonious_records
  ((least(content->>'aMapId' collate "C",content->>'bMapId' collate "C")),
   (greatest(content->>'aMapId' collate "C",content->>'bMapId' collate "C")))
  where kind='comparison_thread';

insert into public.harmonious_records(kind,id,owner_id,revision,content)
select 'comparison_thread',p.id,p.owner_id,1,jsonb_build_object(
  'id',p.id,'aMapId',p.a,'bMapId',p.b,'createdBy',coalesce(p.content->>'createdBy',p.owner_id::text),
  'participants',(select jsonb_agg(owner order by owner collate "C") from (select distinct unnest(array[ma.owner_id::text,mb.owner_id::text]) as owner) owners),
  'createdAt',coalesce(p.content->>'createdAt',p.updated_at::text),'status','active')
from (
  select distinct on (least(content->>'aMapId' collate "C",content->>'bMapId' collate "C"),greatest(content->>'aMapId' collate "C",content->>'bMapId' collate "C"))
    r.*,least(content->>'aMapId' collate "C",content->>'bMapId' collate "C") a,greatest(content->>'aMapId' collate "C",content->>'bMapId' collate "C") b
  from public.harmonious_records r where kind='comparison'
  order by least(content->>'aMapId' collate "C",content->>'bMapId' collate "C"),greatest(content->>'aMapId' collate "C",content->>'bMapId' collate "C"),id collate "C"
) p
join public.harmonious_records ma on ma.kind='map' and ma.id=p.a
join public.harmonious_records mb on mb.kind='map' and mb.id=p.b;

update public.harmonious_records p set content=p.content||jsonb_build_object('comparisonId',t.id),revision=p.revision+1,updated_at=now()
from public.harmonious_records t where p.kind='comparison' and t.kind='comparison_thread'
  and least(p.content->>'aMapId' collate "C",p.content->>'bMapId' collate "C")=t.content->>'aMapId'
  and greatest(p.content->>'aMapId' collate "C",p.content->>'bMapId' collate "C")=t.content->>'bMapId';
update public.harmonious_generation set revision=revision+1 where id;

-- This trigger guards the structural identity even for service-role writes.
-- Identity/visibility and per-author judgment permissions remain in the Worker.
create function public.harmonious_check_comparison_parent() returns trigger
language plpgsql security invoker set search_path='' as $$
declare parent jsonb; owners jsonb;
begin
  if new.kind='comparison_thread' then
    if tg_op='UPDATE' and new.content is distinct from old.content then
      raise exception using errcode='PT409',message='Comparison identity cannot change';
    end if;
    select jsonb_agg(owner order by owner collate "C") into owners from (
      select distinct owner_id::text owner from public.harmonious_records
      where kind='map' and id in (new.content->>'aMapId',new.content->>'bMapId')
    ) participants;
    if not (new.content->>'aMapId' collate "C" < new.content->>'bMapId' collate "C")
       or (select count(*) from public.harmonious_records where kind='map' and id in (new.content->>'aMapId',new.content->>'bMapId'))<>2
       or new.content->'participants' is distinct from owners
       or not coalesce(owners @> jsonb_build_array(new.content->>'createdBy'),false)
       or new.content->>'status' is distinct from 'active' then
      raise exception using errcode='PT400',message='Invalid comparison sources';
    end if;
  elsif new.kind='comparison' then
    select content into parent from public.harmonious_records where kind='comparison_thread' and id=new.content->>'comparisonId';
    if parent is null or
       least(new.content->>'aMapId' collate "C",new.content->>'bMapId' collate "C") is distinct from parent->>'aMapId' or
       greatest(new.content->>'aMapId' collate "C",new.content->>'bMapId' collate "C") is distinct from parent->>'bMapId' then
      raise exception using errcode='PT409',message='Comparison parent is missing or mismatched';
    end if;
    if tg_op='UPDATE' and new.content->>'comparisonId' is distinct from old.content->>'comparisonId' then
      raise exception using errcode='PT409',message='Comparison parent cannot change';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.harmonious_check_comparison_parent() from public,anon,authenticated;
grant execute on function public.harmonious_check_comparison_parent() to service_role;
create trigger harmonious_comparison_parent before insert or update on public.harmonious_records
for each row execute function public.harmonious_check_comparison_parent();
-- Shared comparisons keep the source record with their creator while allowing
-- the other map owner to submit updates validated by the Worker.
-- The Worker enforces field ownership; this RPC is service-role-only.
create or replace function public.harmonious_commit(p_actor uuid,p_generation bigint,p_changes jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  generation bigint;
  item jsonb;
  existing public.harmonious_records%rowtype;
  next_revision bigint;
  result jsonb := '{}'::jsonb;
  seen text[] := array[]::text[];
  record_key text;
begin
  if p_actor is null or not exists(select 1 from auth.users where id=p_actor) then
    raise exception using errcode='PT403',message='Unknown account';
  end if;
  if jsonb_typeof(p_changes) is distinct from 'array' or jsonb_array_length(p_changes) not between 1 and 500 then
    raise exception using errcode='PT400',message='Invalid change batch';
  end if;
  select revision into generation from public.harmonious_generation where id for update;
  if generation is distinct from p_generation then
    raise exception using errcode='PT409',message='snapshot_changed';
  end if;
  for item in select value from jsonb_array_elements(p_changes)
    order by case value->>'kind' when 'comparison_thread' then 1 when 'comparison' then 2 else 0 end loop
    if item->>'kind' not in ('profile','map','idea','endorsement','comparison','comparison_thread') or
       item->>'id' is null or item->'value'->>'id' is distinct from item->>'id' or
       not (item ? 'expectedRevision') then
      raise exception using errcode='PT400',message='Invalid record';
    end if;
    record_key := '[' || to_jsonb(item->>'kind')::text || ',' || to_jsonb(item->>'id')::text || ']';
    if record_key=any(seen) then raise exception using errcode='PT400',message='Duplicate record'; end if;
    seen := array_append(seen,record_key);
    select * into existing from public.harmonious_records where kind=item->>'kind' and id=item->>'id';
    if found and existing.owner_id<>p_actor and not (
      item->>'kind'='comparison' and coalesce(existing.content->'participants','[]'::jsonb) @> jsonb_build_array(p_actor::text)
    ) then
      raise exception using errcode='PT403',message='Record belongs to another account';
    end if;
    if coalesce(existing.revision,0) is distinct from (item->>'expectedRevision')::bigint then
      raise exception using errcode='PT409',message='record_changed';
    end if;
    if (item->>'kind'='profile' and item->>'id'<>p_actor::text) or
       (item->>'kind'='map' and item->'value'->>'ownerId' is distinct from p_actor::text) or
       (item->>'kind'='endorsement' and item->'value'->>'participantId' is distinct from p_actor::text) then
      raise exception using errcode='PT403',message='Invalid record owner';
    end if;
    next_revision := coalesce(existing.revision,0)+1;
    insert into public.harmonious_records(kind,id,owner_id,revision,content)
      values(item->>'kind',item->>'id',p_actor,next_revision,item->'value')
      on conflict(kind,id) do update set content=excluded.content,revision=excluded.revision,updated_at=now();
    result := result || jsonb_build_object(record_key,next_revision);
  end loop;
  update public.harmonious_generation set revision=revision+1 where id;
  return jsonb_build_object('revision',generation+1,'revisions',result);
end;
$$;
