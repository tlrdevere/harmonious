-- Existing conversations keep their snapshots. Resolve a source against the live edge
-- only while the child's saved branch identity still matches that source.
create function public.harmonious_structural_edge_id(node jsonb) returns text
language sql immutable strict set search_path = '' as $$
  select coalesce(node->>'structuralEdgeId', 'structure:' || (node->>'id'))
$$;
revoke all on function public.harmonious_structural_edge_id(jsonb) from public,anon,authenticated;
grant execute on function public.harmonious_structural_edge_id(jsonb) to service_role;

-- Update the lookup only, preserving the individual functions' permission, scope
-- and history checks. Fail the migration if an expected lookup has changed.
do $migration$
declare item record; original text; replacement text;
begin
  for item in select * from (values
    ('public.harmonious_check_discussion()', 'n'),
    ('public.harmonious_check_premise()', 'value'),
    ('public.harmonious_reflection_snapshot_base(jsonb)', 'value'),
    ('public.harmonious_interaction_classification(jsonb)', 'value')
  ) as lookups(signature, alias) loop
    original := pg_get_functiondef(item.signature::regprocedure);
    replacement := replace(original, format('''structure:''||(%s->>''id'')',item.alias),
      format('public.harmonious_structural_edge_id(%s)',item.alias));
    if replacement = original then raise exception 'Missing structural lookup in %',item.signature; end if;
    execute replacement;
  end loop;
end $migration$;

-- A stale tab cannot silently restore the former key or move a branch while
-- retaining its old key. Only compare nodes present in both saved revisions.
create function public.harmonious_branch_identity() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (
    select 1 from jsonb_array_elements(old.content->'nodes') prior
    join jsonb_array_elements(new.content->'nodes') current_node
      on prior->>'id'=current_node->>'id'
    where prior->>'parent' is not null and (
      (prior->>'parent'=current_node->>'parent') is distinct from
        (public.harmonious_structural_edge_id(prior)=public.harmonious_structural_edge_id(current_node))
      or (prior->>'parent'<>current_node->>'parent' and
          coalesce(current_node->>'structuralEdgeId','') !~ '^branch-[A-Za-z0-9_-]{1,140}$')
    )
  ) then raise exception using errcode='PT409',message='The branch connection changed. Reopen the map before saving.'; end if;
  return new;
end $$;
revoke all on function public.harmonious_branch_identity() from public,anon,authenticated;
grant execute on function public.harmonious_branch_identity() to service_role;
create trigger harmonious_branch_identity before update on public.harmonious_records
  for each row when (new.kind='map') execute function public.harmonious_branch_identity();
