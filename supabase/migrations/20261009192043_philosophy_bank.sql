-- Extend the private philosophy bank without rewriting existing entries or uses.
create or replace function public.harmonious_check_definition() returns trigger
language plpgsql security invoker set search_path='' as $$
declare previous_versions jsonb; v jsonb; n bigint;
begin
 if new.kind<>'definition' then return new; end if;
 if new.content->>'authorId' is distinct from new.owner_id::text then raise exception using errcode='PT403',message='Invalid definition author'; end if;
 if coalesce(new.content->>'type','') not in ('definition','standard','principle','belief','other') or coalesce(new.content->>'status','') not in ('active','archived') or jsonb_typeof(new.content->'versions') is distinct from 'array' or jsonb_array_length(new.content->'versions') not between 1 and 1000 then raise exception using errcode='PT400',message='Invalid definition'; end if;
 for v,n in select value,ordinality from jsonb_array_elements(new.content->'versions') with ordinality loop
  if (v->>'version')::bigint is distinct from n or coalesce(length(trim(v->>'title')),0) not between 1 and 200 or coalesce(length(trim(v->>'body')),0) not between 1 and 10000 then raise exception using errcode='PT400',message='Invalid definition version'; end if;
 end loop;
 if tg_op='UPDATE' then
  select jsonb_agg(value order by ordinality) into previous_versions from jsonb_array_elements(new.content->'versions') with ordinality where ordinality<=jsonb_array_length(old.content->'versions');
  if previous_versions is distinct from old.content->'versions' or new.content->>'type' is distinct from old.content->>'type' or new.content->>'authorId' is distinct from old.content->>'authorId' then raise exception using errcode='PT409',message='Definition history cannot change'; end if;
 end if;
 return new;
end;
$$;
create or replace function public.harmonious_valid_premise(p jsonb, actor text) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare wording jsonb; context_record jsonb; ref jsonb; field text; prior_id text; definition_ids text[];
begin
 if jsonb_typeof(p) is distinct from 'object' then return false; end if;
 if (select count(*) from jsonb_object_keys(p))<>6 or not (p ?& array['mapId','nodeId','ideaId','ideaVersion','wording','contexts']) then return false; end if;
 foreach field in array array['mapId','nodeId','ideaId'] loop
  if jsonb_typeof(p->field) is distinct from 'string' or length(btrim(p->>field))=0 or length(p->>field)>200 then return false; end if;
 end loop;
 if jsonb_typeof(p->'ideaVersion') is distinct from 'number' or (p->>'ideaVersion')::numeric not between 1 and 9007199254740991 or trunc((p->>'ideaVersion')::numeric)<>(p->>'ideaVersion')::numeric then return false; end if;
 wording:=p->'wording';
 if jsonb_typeof(wording) is distinct from 'object' then return false; end if;
 if (select count(*) from jsonb_object_keys(wording))<>8 or not (wording ?& array['kind','title','summary','details','timeScope','sourceTitle','sourceUrl','frame']) or wording->>'kind' is distinct from 'position' or coalesce(wording->>'timeScope','') not in ('history','present','likely_future') or coalesce(wording->>'frame','') not in ('status','action','goal') then return false; end if;
 foreach field in array array['title','summary','details','sourceTitle','sourceUrl'] loop
  if jsonb_typeof(wording->field) is distinct from 'string' or length(wording->>field)>(case when field='title' then 200 when field in ('sourceTitle','sourceUrl') then 2000 else 10000 end) then return false; end if;
 end loop;
 if length(btrim(wording->>'title'))=0 or (wording->>'sourceUrl'<>'' and wording->>'sourceUrl' !~* '^https?://[^[:space:]]+') then return false; end if;
 if jsonb_typeof(p->'contexts') is distinct from 'array' then return false; end if;
 if jsonb_array_length(p->'contexts')>30 then return false; end if;
 for context_record in select value from jsonb_array_elements(p->'contexts') loop
  if jsonb_typeof(context_record) is distinct from 'object' then return false; end if;
  if (select count(*) from jsonb_object_keys(context_record))<>5 or not (context_record ?& array['id','authorId','version','body','definitionRefs']) then return false; end if;
  if jsonb_typeof(context_record->'id') is distinct from 'string' or length(btrim(context_record->>'id'))=0 or length(context_record->>'id')>200 or context_record->>'authorId' is distinct from actor or jsonb_typeof(context_record->'body') is distinct from 'string' or length(context_record->>'body')>10000 then return false; end if;
  if prior_id is not null and prior_id collate "C">=(context_record->>'id') collate "C" then return false; end if;
  prior_id:=context_record->>'id';
  if jsonb_typeof(context_record->'version') is distinct from 'number' or (context_record->>'version')::numeric not between 1 and 9007199254740991 or trunc((context_record->>'version')::numeric)<>(context_record->>'version')::numeric then return false; end if;
  if jsonb_typeof(context_record->'definitionRefs') is distinct from 'array' then return false; end if;
  if jsonb_array_length(context_record->'definitionRefs')>30 then return false; end if;
  definition_ids:=array[]::text[];
  for ref in select value from jsonb_array_elements(context_record->'definitionRefs') loop
   if jsonb_typeof(ref) is distinct from 'object' then return false; end if;
   if (select count(*) from jsonb_object_keys(ref))<>6 or not (ref ?& array['definitionId','authorId','type','version','title','body']) or ref->>'authorId' is distinct from actor or coalesce(ref->>'type','') not in ('definition','standard','principle','belief','other') then return false; end if;
   foreach field in array array['definitionId','title','body'] loop
    if jsonb_typeof(ref->field) is distinct from 'string' or length(btrim(ref->>field))=0 or length(ref->>field)>(case when field='body' then 10000 else 200 end) then return false; end if;
   end loop;
   if jsonb_typeof(ref->'version') is distinct from 'number' or (ref->>'version')::numeric not between 1 and 9007199254740991 or trunc((ref->>'version')::numeric)<>(ref->>'version')::numeric or ref->>'definitionId'=any(definition_ids) then return false; end if;
   definition_ids:=array_append(definition_ids,ref->>'definitionId');
  end loop;
 end loop;
 return true;
end;
$$;
revoke all on function public.harmonious_check_definition(),public.harmonious_valid_premise(jsonb,text) from public,anon,authenticated;
grant execute on function public.harmonious_check_definition(),public.harmonious_valid_premise(jsonb,text) to service_role;
