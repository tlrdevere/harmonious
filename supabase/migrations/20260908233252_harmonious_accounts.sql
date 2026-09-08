-- The browser never receives a database credential. Only the application Worker
-- may execute these RPCs, after verifying identity with Supabase Auth.
create table public.harmonious_generation (
  id boolean primary key default true check (id),
  revision bigint not null default 0
);
insert into public.harmonious_generation(id) values (true);

create table public.harmonious_records (
  kind text not null check (kind in ('profile','map','idea','endorsement','comparison')),
  id text not null check (length(id) between 1 and 200),
  owner_id uuid not null references auth.users(id) on delete restrict,
  revision bigint not null check (revision > 0),
  content jsonb not null check (jsonb_typeof(content) = 'object' and content->>'id' = id),
  updated_at timestamptz not null default now(),
  primary key(kind,id)
);
create index harmonious_records_owner on public.harmonious_records(owner_id,kind);
alter table public.harmonious_records enable row level security;
alter table public.harmonious_generation enable row level security;
revoke all on public.harmonious_records, public.harmonious_generation from public, anon, authenticated;
grant select, insert, update on public.harmonious_records, public.harmonious_generation to service_role;
-- The service role needs only the account ID for the existence check below.
grant usage on schema auth to service_role;
grant select(id) on auth.users to service_role;

create function public.harmonious_snapshot() returns jsonb
language sql security invoker set search_path = '' as $$
  select jsonb_build_object('revision',g.revision,'records',coalesce((
    select jsonb_agg(jsonb_build_object('kind',r.kind,'id',r.id,'ownerId',r.owner_id,'revision',r.revision,'value',r.content) order by r.kind,r.id)
    from public.harmonious_records r
  ),'[]'::jsonb)) from public.harmonious_generation g where g.id;
$$;

-- Serializing this short commit protects the source snapshot used to validate
-- endorsements. Individual record revisions still allow unrelated edits to be
-- retried without overwriting another user's work. Every batch is atomic.
create function public.harmonious_commit(p_actor uuid,p_generation bigint,p_changes jsonb) returns jsonb
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
  for item in select value from jsonb_array_elements(p_changes) loop
    if item->>'kind' not in ('profile','map','idea','endorsement','comparison') or
       item->>'id' is null or item->'value'->>'id' is distinct from item->>'id' or
       not (item ? 'expectedRevision') then
      raise exception using errcode='PT400',message='Invalid record';
    end if;
    record_key := '[' || to_jsonb(item->>'kind')::text || ',' || to_jsonb(item->>'id')::text || ']';
    if record_key=any(seen) then raise exception using errcode='PT400',message='Duplicate record'; end if;
    seen := array_append(seen,record_key);
    select * into existing from public.harmonious_records where kind=item->>'kind' and id=item->>'id';
    if found and existing.owner_id<>p_actor then
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
revoke all on function public.harmonious_snapshot() from public, anon, authenticated;
revoke all on function public.harmonious_commit(uuid,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.harmonious_snapshot() to service_role;
grant execute on function public.harmonious_commit(uuid,bigint,jsonb) to service_role;
