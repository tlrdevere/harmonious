-- A deletion marker preserves historical references without allowing restoration
-- by an old browser or a later stale write. Browser projections hide deleted maps.
create function public.harmonious_check_map_deletion() returns trigger
language plpgsql security invoker set search_path='' as $$
declare previous jsonb; context jsonb; references_json jsonb; parent jsonb;
begin
 if new.kind='map' then
  select content into previous from public.harmonious_records where kind='map' and id=new.id;
  if previous ? 'deletedAt' then raise exception using errcode='PT409',message='This map was deleted'; end if;
  if new.content ? 'deletedAt' then
   context:=nullif(current_setting('harmonious.acting_context',true),'')::jsonb;
   if previous is null or new.content->>'visibility' is distinct from 'private'
      or jsonb_typeof(new.content->'deletedAt') is distinct from 'string'
      or (new.content-array['deletedAt','visibility']) is distinct from (previous-'visibility')
      or context->>'method' is distinct from 'direct'
      or context->>'operatorId' is distinct from new.owner_id::text
      or context->>'participantId' is distinct from new.owner_id::text
      or context->>'draftId' is not null then
    raise exception using errcode='PT403',message='Only the owner can delete a saved map directly';
   end if;
   if not isfinite((new.content->>'deletedAt')::timestamptz) then raise exception using errcode='PT400',message='Invalid deletion date';end if;
  end if;
  return new;
 end if;
 if new.kind in ('profile','definition') or new.kind='endorsement' and new.content->>'status'<>'active' then return new;end if;
 references_json:=new.content;
 if new.content ? 'comparisonId' then
  select content into parent from public.harmonious_records where kind='comparison_thread' and id=new.content->>'comparisonId';
  references_json:=jsonb_build_array(references_json,parent);
 end if;
 if new.content ? 'proposalId' then
  select content into parent from public.harmonious_records where kind='comparison' and id=new.content->>'proposalId';
  references_json:=jsonb_build_array(references_json,parent);
 end if;
 if exists(
  select 1 from public.harmonious_records m
  where m.kind='map' and m.content ? 'deletedAt' and (
   jsonb_path_exists(references_json,'$.**.mapId ? (@ == $id)',jsonb_build_object('id',m.id)) or
   jsonb_path_exists(references_json,'$.**.aMapId ? (@ == $id)',jsonb_build_object('id',m.id)) or
   jsonb_path_exists(references_json,'$.**.bMapId ? (@ == $id)',jsonb_build_object('id',m.id)) or
   jsonb_path_exists(references_json,'$.**.originMapId ? (@ == $id)',jsonb_build_object('id',m.id)) or
   jsonb_path_exists(references_json,'$.**.sourceMapId ? (@ == $id)',jsonb_build_object('id',m.id)) or
   jsonb_path_exists(references_json,'$.**.targetMapId ? (@ == $id)',jsonb_build_object('id',m.id))
  )
 ) then raise exception using errcode='PT409',message='A source map was deleted';end if;
 return new;
end $$;
create trigger harmonious_map_deletion before insert or update on public.harmonious_records
for each row execute function public.harmonious_check_map_deletion();
revoke all on function public.harmonious_check_map_deletion() from public,anon,authenticated;
grant execute on function public.harmonious_check_map_deletion() to service_role;
